import { createFileRoute } from "@tanstack/react-router";
import type React from "react";
import type { EmissionsBreakdown } from "@snc/shared";

import { ComingSoon } from "../components/coming-soon/coming-soon.js";
import { fetchApiServer } from "../lib/api-server.js";
import { isFeatureEnabled } from "../lib/config.js";
import { formatCo2 } from "../lib/format.js";
import { EmissionsChart } from "../components/emissions/emissions-chart.js";
import { ScopeBreakdown } from "../components/emissions/scope-breakdown.js";
import { CategoryBreakdown } from "../components/emissions/category-breakdown.js";
import { Co2Equivalencies } from "../components/emissions/co2-equivalencies.js";
import { OffsetImpact } from "../components/emissions/offset-impact.js";
import sectionStyles from "../styles/detail-section.module.css";
import pageHeadingStyles from "../styles/page-heading.module.css";
import styles from "./emissions.module.css";

export const Route = createFileRoute("/emissions")({
  loader: async (): Promise<EmissionsBreakdown | null> => {
    if (!isFeatureEnabled("emissions")) return null;
    return (await fetchApiServer({
      data: "/api/emissions/breakdown",
    })) as EmissionsBreakdown;
  },
  component: EmissionsPage,
});

function EmissionsPage(): React.ReactElement {
  const breakdown = Route.useLoaderData();
  if (!isFeatureEnabled("emissions") || breakdown === null) return <ComingSoon feature="emissions" />;

  const grossCo2Value = formatCo2(breakdown.summary.grossCo2Kg);
  const offsetCo2Value = formatCo2(breakdown.summary.offsetCo2Kg);
  const netCo2Value = formatCo2(breakdown.summary.netCo2Kg);
  const netValueClass = breakdown.summary.netCo2Kg <= 0
    ? styles.valueSuccess
    : styles.valueError;
  return (
    <div className={styles.page}>
      <h1 className={pageHeadingStyles.heading}>Emissions</h1>

      <p className={styles.intro}>
          We take responsibility for the ecological impact of what we make. This
          is our honest ledger: what we've emitted, what we've offset, and where
          we stand. We track emissions via the{" "}
          <a
            href="https://ghgprotocol.org/corporate-standard"
            target="_blank"
            rel="noopener noreferrer"
          >
            GHG Protocol
          </a>
          , prioritize reduction, and offset the rest through the{" "}
          <a
            href="https://pikapartners.org/carbon/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Colorado Pika Project
          </a>
          . No greenwashing, just transparency.
      </p>

      {/* ── Net Summary ── */}
      <div className={styles.summaryCard} data-testid="net-summary">
        <p className={styles.summaryLabel}>Net Emissions</p>
        <p className={`${styles.summaryValue} ${netValueClass}`}>
          {netCo2Value}
        </p>
        <p className={styles.summaryMath}>
          <span className={styles.valueError}>{grossCo2Value}</span> emitted
          {" "}&minus;{" "}
          <span className={styles.valueSuccess}>{offsetCo2Value}</span> offset
        </p>
      </div>

      {/* ── Emissions ── */}
      <section className={sectionStyles.section}>
        <h2 className={sectionStyles.sectionHeading}>Emissions</h2>

        <section className={sectionStyles.section}>
          <h3 className={styles.subsectionHeading}>Cumulative</h3>
          <EmissionsChart
            data={breakdown.monthly}
            isLoading={false}
          />
        </section>

        <details className={styles.methodologyDetails}>
          <summary className={styles.methodologySummary}>By Scope</summary>
          <div className={styles.methodologyContent}>
            <ScopeBreakdown data={breakdown.byScope} />
          </div>
        </details>

        <details className={styles.methodologyDetails}>
          <summary className={styles.methodologySummary}>By Category</summary>
          <div className={styles.methodologyContent}>
            <CategoryBreakdown data={breakdown.byCategory} />
          </div>
        </details>
      </section>

      {/* ── What Does This Mean? ── */}
      {breakdown.summary.grossCo2Kg > 0 && (
        <section className={sectionStyles.section}>
          <h2 className={sectionStyles.sectionHeading}>What Does This Mean?</h2>
          <Co2Equivalencies co2Kg={breakdown.summary.grossCo2Kg} />
          <OffsetImpact offsetCo2Kg={breakdown.summary.offsetCo2Kg} />
        </section>
      )}

      {/* ── Methodology ── */}
      <section className={sectionStyles.section}>
        <h2 className={sectionStyles.sectionHeading}>Methodology</h2>
        <p className={styles.methodologyIntro}>
          All figures are estimates — no provider publishes verified per-use
          emissions data. Where multiple estimates exist, we use the highest
          defensible figure (worst-case approach).
        </p>

        <details className={styles.methodologyDetails}>
          <summary className={styles.methodologySummary}>
            AI Development
          </summary>
          <div className={styles.methodologyContent}>
            <p>
              Different token types consume different amounts of energy. We
              apply per-token-type Wh rates with PUE baked in, then convert to
              CO2 via grid carbon intensity (390 gCO2/kWh,{" "}
              <a
                href="https://www.epa.gov/egrid"
                target="_blank"
                rel="noopener noreferrer"
              >
                EPA eGRID
              </a>{" "}
              US average).
            </p>
            <table className={styles.rateTable}>
              <thead>
                <tr>
                  <th>Token type</th>
                  <th>Wh/MTok</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Input</td>
                  <td>417</td>
                  <td><a href="https://epoch.ai/gradient-updates/how-much-energy-does-chatgpt-use" target="_blank" rel="noopener noreferrer">Epoch AI</a> (long-context upper bound)</td>
                </tr>
                <tr>
                  <td>Output</td>
                  <td>600</td>
                  <td><a href="https://epoch.ai/gradient-updates/how-much-energy-does-chatgpt-use" target="_blank" rel="noopener noreferrer">Epoch AI</a> (derived)</td>
                </tr>
                <tr>
                  <td>Cache creation</td>
                  <td>490</td>
                  <td><a href="https://www.simonpcouch.com/blog/2026-01-20-cc-impact/" target="_blank" rel="noopener noreferrer">Simon Couch</a> (2026)</td>
                </tr>
                <tr>
                  <td>Cache read</td>
                  <td>39</td>
                  <td><a href="https://www.simonpcouch.com/blog/2026-01-20-cc-impact/" target="_blank" rel="noopener noreferrer">Simon Couch</a> (2026)</td>
                </tr>
              </tbody>
            </table>
            <p className={styles.methodologyNote}>
              Model training emissions are excluded — there is no reliable way
              to attribute a per-org share. Rates are model-agnostic
              (conservative for smaller models). Anthropic does not publish
              per-request energy data.
            </p>
          </div>
        </details>

        <details className={styles.methodologyDetails}>
          <summary className={styles.methodologySummary}>
            Vinyl Pressing
          </summary>
          <div className={styles.methodologyContent}>
            <p>
              Based on the{" "}
              <a
                href="https://www.vrmagroup.com/in-the-news/new-insights-from-the-second-report-of-the-vinyl-record-manufacturers-associations-carbon-footprinting-group"
                target="_blank"
                rel="noopener noreferrer"
              >
                VRMA/Vinyl Alliance Second Carbon Footprinting Report
              </a>{" "}
              (2025), which expanded data to five manufacturers and
              corrected biogenic carbon accounting. Baseline:{" "}
              <strong>1.15 kg CO2e per 140g 12&quot; record</strong>{" "}
              (cradle-to-factory-gate), originally established in the{" "}
              <a
                href="https://vinylalliance.org/resources/vinyl-alliance-vrma-carbon-footprinting-report/"
                target="_blank"
                rel="noopener noreferrer"
              >
                First Report
              </a>{" "}
              (2024) and confirmed in the Second. Both independently
              verified.
            </p>
            <p>
              AudioDrome adjustments: 100% solar energy eliminates the ~30%
              energy component (confirmed, real reduction). Bio-PVC is confirmed
              for our pressing, but per the Second Report and GHG Protocol
              guidance, biogenic carbon removals are not subtracted — compound
              footprint equals conventional PVC. Steamless pressing and
              biodegradable packaging are confirmed but unquantified.
            </p>
            <p>
              Adjusted per-record figure:{" "}
              <strong>0.82 kg CO2e</strong> (29% reduction from baseline).
            </p>
            <p className={styles.methodologyNote}>
              The baseline is UK-sourced (VFM Ltd). AudioDrome&apos;s actual
              manufacturing process may differ. See the{" "}
              <a
                href="https://vinylalliance.org/resources/vinyl-alliance-vrma-carbon-footprinting-report/"
                target="_blank"
                rel="noopener noreferrer"
              >
                First
              </a>{" "}
              and{" "}
              <a
                href="https://www.vrmagroup.com/in-the-news/new-insights-from-the-second-report-of-the-vinyl-record-manufacturers-associations-carbon-footprinting-group"
                target="_blank"
                rel="noopener noreferrer"
              >
                Second
              </a>{" "}
              VRMA reports for compound comparison data and full methodology.
            </p>
          </div>
        </details>

        <details className={styles.methodologyDetails}>
          <summary className={styles.methodologySummary}>
            Freight
          </summary>
          <div className={styles.methodologyContent}>
            <p>
              Ground freight: <strong>161 gCO2 per tonne-mile</strong> ({" "}
              <a
                href="https://www.epa.gov/climateleadership/ghg-emission-factors-hub"
                target="_blank"
                rel="noopener noreferrer"
              >
                EPA GHG Emission Factors Hub
              </a>
              ).
            </p>
            <p>
              Formula: weight (tonnes) &times; distance (miles) &times; 161
              gCO2/tonne-mile &divide; 1000 = kg CO2.
            </p>
            <p className={styles.methodologyNote}>
              This is a US average across freight modes. Actual emissions depend
              on truck type, load factor, and route.
            </p>
          </div>
        </details>

        <details className={styles.methodologyDetails}>
          <summary className={styles.methodologySummary}>
            Recording Studio
          </summary>
          <div className={styles.methodologyContent}>
            <p>
              Studio emissions are estimated from equipment load profiles
              (active wattage during sessions) converted to CO2 via grid carbon
              intensity (<strong>390 gCO2/kWh</strong>,{" "}
              <a
                href="https://www.epa.gov/egrid"
                target="_blank"
                rel="noopener noreferrer"
              >
                EPA eGRID
              </a>{" "}
              US average).
            </p>
            <table className={styles.rateTable}>
              <thead>
                <tr>
                  <th>Profile</th>
                  <th>Active (W)</th>
                  <th>Idle (W)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Light</td>
                  <td>400</td>
                  <td>50</td>
                </tr>
                <tr>
                  <td>Standard</td>
                  <td>800</td>
                  <td>100</td>
                </tr>
                <tr>
                  <td>Heavy</td>
                  <td>1,500</td>
                  <td>200</td>
                </tr>
              </tbody>
            </table>
            <p>
              Formula: active hours &times; active watts &divide; 1000 &times;
              390 gCO2/kWh &divide; 1000 = kg CO2.
            </p>
            <p className={styles.methodologyNote}>
              HVAC is excluded until dedicated studio climate control is
              installed. Profiles are estimates based on typical studio equipment
              wattage ranges.
            </p>
          </div>
        </details>
      </section>
    </div>
  );
}
