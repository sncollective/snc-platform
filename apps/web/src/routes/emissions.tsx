import type React from "react";
import { createFileRoute } from "@tanstack/react-router";

import styles from "./emissions.module.css";

// ── Standing copy page ────────────────────────────────────────────────────────
// The emissions LEDGER (charts + API) is down pending a more robust representation
// (operator 2026-08-15). This page replaces it with standing copy explaining the
// co-op's stance — always on, no feature flag, no API dependency.
//
// COPY GOVERNANCE: the stance sections below carry DRAFT copy, marked as such on the
// page. Final wording is human-in-the-loop (operator/org writing pass) per the
// 2026-08-15 governance ruling. Do not treat the prose here as approved voice.

export const Route = createFileRoute("/emissions")({
  head: () => ({
    meta: [
      { title: "Emissions — S/NC" },
      {
        name: "description",
        content: "Where S/NC stands on emissions — and why our ledger isn't published yet.",
      },
      { property: "og:title", content: "Emissions — S/NC" },
      {
        property: "og:description",
        content: "Where S/NC stands on emissions — and why our ledger isn't published yet.",
      },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://snc.coop/emissions" }],
  }),
  component: EmissionsStancePage,
});

function EmissionsStancePage(): React.ReactElement {
  return (
    <main className={styles.stancePage}>
      <header className={styles.stanceHeader}>
        <h1 className={styles.stanceHeading}>Where we stand on emissions</h1>
        <p className={styles.stanceLede}>
          Transparency is the point of this page — including about what we don&apos;t yet
          know how to measure honestly.
        </p>
      </header>

      <div className={styles.stanceBody}>
        <section className={styles.stanceSection}>
          <h2>Why we track</h2>
          <p>
            Media has a carbon cost — servers, storage, transcoding, streaming, the studio
            itself. A cooperative that asks creators to build here owes them an honest
            account of that cost, the same way it owes them an honest account of the money.
          </p>
        </section>

        <section className={styles.stanceSection}>
          <h2>Why the ledger isn&apos;t published yet</h2>
          <p>
            We built a first ledger and took it down. Its numbers were only as good as
            their assumptions, and we weren&apos;t willing to publish precision we
            didn&apos;t have. We&apos;re rebuilding the measurement — scopes, boundaries,
            and methodology we can defend — and it will be published here when it&apos;s
            real.
          </p>
        </section>

        <section className={styles.stanceSection}>
          <h2>What we commit to in the meantime</h2>
          <p>
            We measure what we can, we say what we can&apos;t, and we don&apos;t dress
            either up. No offset arithmetic that hides emissions, no green charts over
            thin data. When the ledger returns, the methodology ships with it — auditable,
            coarse where honesty requires it, and ours to be held to.
          </p>
        </section>

        <p className={styles.stanceDraftNote} aria-label="Draft copy notice">
          Draft copy — final wording pending the co-op&apos;s writing pass.
        </p>
      </div>
    </main>
  );
}
