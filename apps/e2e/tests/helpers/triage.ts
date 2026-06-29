import { mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";

import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from "@playwright/test/reporter";

const TRIAGE_DIR = "test-results";
const TRIAGE_JSON = "triage.json";
const TRIAGE_MD = "triage.md";
const MAX_ERROR_EXCERPT_LENGTH = 2_000;
const FAILED_STATUSES = new Set<TestResult["status"]>([
  "failed",
  "timedOut",
  "interrupted",
]);

type Artifact = {
  name: string;
  contentType: string;
  path: string;
};

type TriageResult = {
  retry: number;
  status: TestResult["status"];
  durationMs: number;
  outputDir: string;
  errorExcerpt: string | null;
  artifacts: Artifact[];
  visionCandidates: VisionCandidate[];
  nextInspectionSteps: string[];
};

type VisionCandidate = {
  imageArtifact: string;
  imageContentType: string;
  imagePath: string;
  metaArtifact: string | null;
  metaPath: string | null;
  triageQuestion: string | null;
  expectationHint: string | null;
  nonGatePolicy: string;
};

type TriageTest = {
  title: string;
  location: string;
  project: string | null;
  outcome: ReturnType<TestCase["outcome"]>;
  rerunCommand: string;
  results: TriageResult[];
};

type TriageSummary = {
  generatedAt: string;
  status: FullResult["status"];
  rootDir: string;
  failedOrFlakyTestCount: number;
  tests: TriageTest[];
};

export default class E2eTriageReporter implements Reporter {
  private suite: Suite | null = null;
  private rootDir = process.cwd();

  onBegin(config: FullConfig, suite: Suite): void {
    this.suite = suite;
    this.rootDir = config.configFile ? path.dirname(config.configFile) : config.rootDir;
  }

  async onEnd(result: FullResult): Promise<void> {
    const summary = this.buildSummary(result);
    const outputDir = path.join(this.rootDir, TRIAGE_DIR);

    await mkdir(outputDir, { recursive: true });
    await writeFile(
      path.join(outputDir, TRIAGE_JSON),
      `${JSON.stringify(summary, null, 2)}\n`,
      "utf8",
    );
    await writeFile(path.join(outputDir, TRIAGE_MD), renderMarkdown(summary), "utf8");
  }

  private buildSummary(result: FullResult): TriageSummary {
    const tests = this.suite?.allTests() ?? [];
    const failedOrFlakyTests = tests
      .map((test) => this.buildTestSummary(test))
      .filter((test) => test.results.length > 0 || test.outcome === "flaky");

    return {
      generatedAt: new Date().toISOString(),
      status: result.status,
      rootDir: this.rootDir,
      failedOrFlakyTestCount: failedOrFlakyTests.length,
      tests: failedOrFlakyTests,
    };
  }

  private buildTestSummary(test: TestCase): TriageTest {
    const titlePath = test.titlePath();
    const project = test.parent.project()?.name ?? null;
    const failedResults = test.results.filter((testResult) =>
      FAILED_STATUSES.has(testResult.status),
    );

    return {
      title: titlePath.join(" › "),
      location: `${path.relative(this.rootDir, test.location.file)}:${test.location.line}:${test.location.column}`,
      project,
      outcome: test.outcome(),
      rerunCommand: buildRerunCommand(test, project),
      results: failedResults.map((testResult) => buildResultSummary(testResult)),
    };
  }
}

function buildResultSummary(testResult: TestResult): TriageResult {
  const artifacts = testResult.attachments
    .filter((attachment) => !!attachment.path)
    .map((attachment) => ({
      name: attachment.name,
      contentType: attachment.contentType,
      path: attachment.path as string,
    }));

  const visionCandidates = extractVisionCandidates(artifacts);

  return {
    retry: testResult.retry,
    status: testResult.status,
    durationMs: testResult.duration,
    outputDir: inferOutputDir(artifacts),
    errorExcerpt: extractErrorExcerpt(testResult),
    artifacts,
    visionCandidates,
    nextInspectionSteps: buildNextInspectionSteps(artifacts, visionCandidates),
  };
}

function inferOutputDir(artifacts: Artifact[]): string {
  const firstArtifact = artifacts[0];
  return firstArtifact ? path.dirname(firstArtifact.path) : "not reported";
}

function extractErrorExcerpt(testResult: TestResult): string | null {
  const rawErrors = testResult.errors.length > 0 ? testResult.errors : [testResult.error];
  const message = rawErrors
    .filter((error): error is NonNullable<typeof error> => !!error)
    .map((error) => error.stack ?? error.message ?? error.value)
    .filter((error): error is string => !!error)
    .join("\n\n---\n\n");

  if (!message) return null;
  return message.length > MAX_ERROR_EXCERPT_LENGTH
    ? `${message.slice(0, MAX_ERROR_EXCERPT_LENGTH)}…`
    : message;
}

function buildNextInspectionSteps(artifacts: Artifact[], visionCandidates: VisionCandidate[]): string[] {
  const steps = [
    "Read the error excerpt and rerun the named test before changing assertions.",
  ];

  const trace = artifacts.find((artifact) => artifact.name === "trace");
  if (trace) {
    steps.push(`Open the retained trace: bunx playwright show-trace ${trace.path}`);
  }

  const screenshot = artifacts.find((artifact) => artifact.contentType.startsWith("image/"));
  if (screenshot) {
    steps.push(`Inspect failure screenshot: ${screenshot.path}`);
  }

  const video = artifacts.find((artifact) => artifact.contentType.startsWith("video/"));
  if (video) {
    steps.push(`Inspect retained video: ${video.path}`);
  }

  for (const candidate of visionCandidates) {
    steps.push(
      `Vision triage (advisory, NOT a gate): pass ${candidate.imagePath} to a vision-capable agent and ask: "${candidate.triageQuestion ?? "Does this image show real rendered video content rather than a black/blank frame?"}"`,
    );
  }

  if (!trace && !screenshot && !video && visionCandidates.length === 0) {
    steps.push("No visual artifact was attached; inspect the result outputDir for runner logs.");
  }

  return steps;
}

/** Surface `vision-target:*` artifacts (image + JSON metadata sidecar) for post-run vision triage. */
function extractVisionCandidates(artifacts: Artifact[]): VisionCandidate[] {
  const candidates: VisionCandidate[] = [];
  for (const image of artifacts.filter((a) => a.name.startsWith("vision-target:"))) {
    const slug = image.name.slice("vision-target:".length);
    const meta = artifacts.find((a) => a.name === `vision-target-meta:${slug}`);
    const parsedMeta = readVisionMeta(meta);
    candidates.push({
      imageArtifact: image.name,
      imageContentType: image.contentType,
      imagePath: image.path,
      metaArtifact: meta?.name ?? null,
      metaPath: meta?.path ?? null,
      triageQuestion: parsedMeta?.triageQuestion ?? null,
      expectationHint: parsedMeta?.expectationHint ?? null,
      nonGatePolicy: parsedMeta?.nonGatePolicy ?? "advisory-triage-only",
    });
  }
  return candidates;
}

const readVisionMeta = (artifact: Artifact | undefined): VisualTriageCapture | null => {
  if (!artifact) return null;
  // The metadata sidecar is attached as a JSON body that Playwright writes to
  // `artifact.path`. The reporter runs after the test, so the file exists by
  // then. Reading is best-effort and never throws into the report.
  try {
    const body = readFileSync(artifact.path, "utf8");
    return JSON.parse(body) as VisualTriageCapture;
  } catch {
    return null;
  }
};

type VisualTriageCapture = {
  kind: string;
  triageQuestion: string;
  expectationHint: string;
  nonGatePolicy: string;
};

function buildRerunCommand(test: TestCase, project: string | null): string {
  const relativeFile = path.relative(process.cwd(), test.location.file);
  const projectFlag = project ? ` --project=${shellQuote(project)}` : "";
  return `bun run --filter @snc/e2e test -- ${shellQuote(relativeFile)}:${test.location.line}${projectFlag}`;
}

function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_./:=@-]+$/.test(value)) return value;
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function renderMarkdown(summary: TriageSummary): string {
  const lines = [
    "# E2E triage summary",
    "",
    `- Generated: ${summary.generatedAt}`,
    `- Run status: ${summary.status}`,
    `- Failed/flaky tests: ${summary.failedOrFlakyTestCount}`,
    "",
  ];

  if (summary.tests.length === 0) {
    lines.push("No failed or flaky tests were reported.", "");
    return lines.join("\n");
  }

  for (const test of summary.tests) {
    lines.push(`## ${test.title}`, "");
    lines.push(`- Project: ${test.project ?? "unknown"}`);
    lines.push(`- Location: ${test.location}`);
    lines.push(`- Outcome: ${test.outcome}`);
    lines.push(`- Rerun: \`${test.rerunCommand}\``);
    lines.push("");

    if (test.results.length === 0) {
      lines.push("No failed retry remained attached; inspect retry history for flaky behavior.", "");
      continue;
    }

    for (const result of test.results) {
      lines.push(`### Attempt retry=${result.retry} status=${result.status}`, "");
      lines.push(`- Duration: ${result.durationMs}ms`);
      lines.push(`- Output dir: ${result.outputDir}`);
      if (result.artifacts.length > 0) {
        lines.push("- Artifacts:");
        for (const artifact of result.artifacts) {
          lines.push(`  - ${artifact.name} (${artifact.contentType}): ${artifact.path}`);
        }
      } else {
        lines.push("- Artifacts: none attached");
      }
      lines.push("- Next inspection steps:");
      for (const step of result.nextInspectionSteps) {
        lines.push(`  - ${step}`);
      }
      if (result.visionCandidates.length > 0) {
        lines.push("- Vision triage candidates (advisory, NOT a CI gate):");
        for (const candidate of result.visionCandidates) {
          lines.push(`  - ${candidate.imageArtifact}: ${candidate.imagePath}`);
          if (candidate.triageQuestion) {
            lines.push(`    - Question: ${candidate.triageQuestion}`);
          }
          lines.push(`    - Policy: ${candidate.nonGatePolicy}`);
        }
      }
      if (result.errorExcerpt) {
        lines.push("", "```", result.errorExcerpt, "```");
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}
