import { createFileRoute } from "@tanstack/react-router";
import type React from "react";

import { PRIVACY_POLICY_VERSION } from "@snc/shared";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
});

/**
 * Placeholder privacy policy. The legal content is operator-supplied — org/legal
 * authors the real text; this route + the PRIVACY_POLICY_VERSION wiring are the
 * platform's. The consent checkbox on the join flow links here.
 */
function PrivacyPage(): React.ReactElement {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1rem" }}>
      <h1>Privacy Policy</h1>
      <p>
        <em>
          Placeholder — operator-supplied content pending. This page exists so the
          consent flow has a policy to link to; the cooperative's legal text replaces
          this copy.
        </em>
      </p>
      <p>
        S/NC captures your email only with your explicit consent, to contact you about
        the bands and content you choose to follow. You can change your notification
        preferences or unsubscribe at any time from your account settings.
      </p>
      <p style={{ color: "#666", fontSize: "0.85rem", marginTop: "2rem" }}>
        Policy version: {PRIVACY_POLICY_VERSION}
      </p>
    </main>
  );
}
