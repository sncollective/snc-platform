import { escapeHtml } from "../templates.js";

// ── Public Types ──

export interface ChannelGoLiveEmailData {
  readonly channelName: string;
  readonly liveUrl: string;
}

// ── Public API ──

/** Format a channel-go-live notification email (notify-me-when-live loop). */
export const formatChannelGoLiveEmail = (data: ChannelGoLiveEmailData) => {
  const name = escapeHtml(data.channelName);
  const url = escapeHtml(data.liveUrl);
  return {
    subject: `${data.channelName} is live on S/NC!`,
    html: `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>${name} is live!</h2>
      <p>The channel you asked to be notified about just went live.</p>
      <p>
        <a href="${url}"
           style="display: inline-block; padding: 12px 24px; background: #1a1a1a; color: #fff; text-decoration: none; border-radius: 6px;">
          Watch now
        </a>
      </p>
      <p style="color: #666; font-size: 12px; margin-top: 24px;">
        You received this because you asked to be notified when ${name} goes live on S/NC.
      </p>
    </div>
  `,
    text: `${data.channelName} is live on S/NC! Watch now: ${data.liveUrl}`,
  };
};
