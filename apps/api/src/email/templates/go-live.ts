import { escapeHtml } from "../templates.js";

// ── Public Types ──

export interface GoLiveEmailData {
  readonly creatorName: string;
  readonly liveUrl: string;
}

// ── Public API ──

/** Format a go-live notification email. */
export const formatGoLiveEmail = (data: GoLiveEmailData) => {
  const name = escapeHtml(data.creatorName);
  const url = escapeHtml(data.liveUrl);
  return {
    subject: `${data.creatorName} is live on S/NC!`,
    html: `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>${name} is live!</h2>
      <p>Head over to S/NC to watch the stream.</p>
      <p>
        <a href="${url}"
           style="display: inline-block; padding: 12px 24px; background: #1a1a1a; color: #fff; text-decoration: none; border-radius: 6px;">
          Watch now
        </a>
      </p>
      <p style="color: #666; font-size: 12px; margin-top: 24px;">
        You received this because you follow ${name} on S/NC.
      </p>
    </div>
  `,
    text: `${data.creatorName} is live on S/NC! Watch now: ${data.liveUrl}`,
  };
};
