import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type React from "react";
import QRCode from "qrcode";

import type { JoinConfig } from "@snc/shared";

import { apiGet, apiMutate } from "../../../../lib/fetch-utils.js";
import styles from "./join-manage.module.css";

export const Route = createFileRoute("/creators/$creatorId/manage/join")({
  component: ManageJoinPage,
});

function ManageJoinPage(): React.ReactElement {
  const { creatorId } = Route.useParams();

  // The public join URL uses the creator's handle when available, else the id.
  // We have creatorId from the route; the handle is fetched with the profile, but
  // the join route resolves either, so the id form is always valid.
  const joinPath = `/join/${creatorId}`;
  const joinUrl = typeof window !== "undefined" ? `${window.location.origin}${joinPath}` : joinPath;

  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [config, setConfig] = useState<JoinConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Render the QR as SVG (poster-legible, no canvas).
  useEffect(() => {
    QRCode.toString(joinUrl, { type: "svg", margin: 1, width: 256 })
      .then(setQrSvg)
      .catch(() => setQrSvg(null));
  }, [joinUrl]);

  // Load the config (defaults shown before first save).
  useEffect(() => {
    apiGet<JoinConfig>(`/api/creators/${creatorId}/join-config`)
      .then(setConfig)
      .catch(() => setConfig({ incentiveText: null, showSncExplainer: true, showSubscribeCta: true }));
  }, [creatorId]);

  const save = async (): Promise<void> => {
    if (!config) return;
    setSaving(true);
    setSaved(false);
    try {
      const next = await apiMutate<JoinConfig>(`/api/creators/${creatorId}/join-config`, {
        method: "PATCH",
        body: config,
      });
      setConfig(next);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  const copyUrl = async (): Promise<void> => {
    await navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Join page</h1>
      <p className={styles.lead}>
        Share this QR or link at shows. Fans scan it to follow the band in one step.
      </p>

      <section className={styles.urlRow}>
        <code className={styles.url}>{joinUrl}</code>
        <button type="button" className={styles.copyButton} onClick={() => void copyUrl()}>
          {copied ? "Copied!" : "Copy"}
        </button>
      </section>

      <section className={styles.qrSection}>
        {qrSvg ? (
          <div
            className={styles.qr}
            // qrcode produces a trusted SVG string from our own URL.
            dangerouslySetInnerHTML={{ __html: qrSvg }}
            aria-label="Join page QR code"
          />
        ) : (
          <p>Generating QR…</p>
        )}
        <button type="button" className={styles.printButton} onClick={() => window.print()}>
          Print poster
        </button>
      </section>

      {config && (
        <section className={styles.configForm}>
          <h2 className={styles.subheading}>Page settings</h2>

          <label className={styles.label} htmlFor="incentive">
            Incentive line (shown after signup)
          </label>
          <input
            id="incentive"
            className={styles.input}
            value={config.incentiveText ?? ""}
            placeholder="e.g. Free sticker at the merch desk"
            onChange={(e) =>
              setConfig({ ...config, incentiveText: e.target.value || null })
            }
          />

          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={config.showSncExplainer}
              onChange={(e) => setConfig({ ...config, showSncExplainer: e.target.checked })}
            />
            <span>Show the "What is S/NC?" explainer to new followers</span>
          </label>

          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={config.showSubscribeCta}
              onChange={(e) => setConfig({ ...config, showSubscribeCta: e.target.checked })}
            />
            <span>Show the subscribe / support CTA</span>
          </label>

          <button type="button" className={styles.saveButton} onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
          {saved && <span className={styles.savedNote}>Saved</span>}
        </section>
      )}
    </div>
  );
}
