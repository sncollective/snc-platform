import { escapeHtml } from "../templates.js";

// ── Public Types ──

export interface NewContentEmailData {
  readonly creatorName: string;
  readonly contentTitle: string;
  readonly contentUrl: string;
}

// ── Public API ──

/** Format a new content notification email. */
export const formatNewContentEmail = (data: NewContentEmailData) => {
  const name = escapeHtml(data.creatorName);
  const title = escapeHtml(data.contentTitle);
  const url = escapeHtml(data.contentUrl);
  return {
    subject: `New from ${data.creatorName}: ${data.contentTitle}`,
    html: `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>New from ${name}</h2>
      <p><strong>${title}</strong></p>
      <p>
        <a href="${url}"
           style="display: inline-block; padding: 12px 24px; background: #1a1a1a; color: #fff; text-decoration: none; border-radius: 6px;">
          Watch / Listen
        </a>
      </p>
      <p style="color: #666; font-size: 12px; margin-top: 24px;">
        You received this because you follow ${name} on S/NC.
      </p>
    </div>
  `,
    text: `New from ${data.creatorName}: ${data.contentTitle}\n\n${data.contentUrl}`,
  };
};
