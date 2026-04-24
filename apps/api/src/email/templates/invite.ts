import { getFrontendBaseUrl } from "../../lib/route-utils.js";
import { escapeHtml } from "../templates.js";

// ── Public Types ──

export interface InviteEmailData {
  readonly type: "creator_owner" | "team_member";
  readonly email: string;
  readonly token: string;
  readonly payload: Record<string, unknown>;
}

// ── Public API ──

/** Format an invite email with accept link. */
export const formatInviteEmail = (data: InviteEmailData) => {
  const rawAcceptUrl = `${getFrontendBaseUrl()}/invite/${encodeURIComponent(data.token)}`;
  const acceptUrl = escapeHtml(rawAcceptUrl);

  if (data.type === "creator_owner") {
    const rawDisplayName = data.payload.displayName as string;
    const displayName = escapeHtml(rawDisplayName);
    return {
      subject: `You're invited to create "${rawDisplayName}" on S/NC`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>You're invited to S/NC!</h2>
          <p>You've been invited to set up <strong>${displayName}</strong> as a creator on S/NC — the Signal to Noise Collective platform.</p>
          <p>
            <a href="${acceptUrl}"
               style="display: inline-block; padding: 12px 24px; background: #1a1a1a; color: #fff; text-decoration: none; border-radius: 6px;">
              Accept invite
            </a>
          </p>
          <p style="color: #666; font-size: 12px; margin-top: 24px;">
            This invite expires in 7 days. If you didn't expect this, you can ignore it.
          </p>
        </div>
      `,
      text: `You're invited to set up "${rawDisplayName}" as a creator on S/NC.\n\nAccept: ${rawAcceptUrl}\n\nThis invite expires in 7 days.`,
    };
  }

  // team_member
  const rawRole = data.payload.role as string;
  const role = escapeHtml(rawRole);
  return {
    subject: "You're invited to join a creator team on S/NC",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Team invite</h2>
        <p>You've been invited to join a creator team on S/NC as a <strong>${role}</strong>.</p>
        <p>
          <a href="${acceptUrl}"
             style="display: inline-block; padding: 12px 24px; background: #1a1a1a; color: #fff; text-decoration: none; border-radius: 6px;">
            Accept invite
          </a>
        </p>
        <p style="color: #666; font-size: 12px; margin-top: 24px;">
          This invite expires in 7 days. If you didn't expect this, you can ignore it.
        </p>
      </div>
    `,
    text: `You've been invited to join a creator team on S/NC as a ${rawRole}.\n\nAccept: ${rawAcceptUrl}\n\nThis invite expires in 7 days.`,
  };
};
