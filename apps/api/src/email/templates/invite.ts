import { config } from "../../config.js";

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
  const acceptUrl = `${config.BETTER_AUTH_URL}/invite/${encodeURIComponent(data.token)}`;

  if (data.type === "creator_owner") {
    const displayName = data.payload.displayName as string;
    return {
      subject: `You're invited to create "${displayName}" on S/NC`,
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
      text: `You're invited to set up "${displayName}" as a creator on S/NC.\n\nAccept: ${acceptUrl}\n\nThis invite expires in 7 days.`,
    };
  }

  // team_member
  return {
    subject: "You're invited to join a creator team on S/NC",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Team invite</h2>
        <p>You've been invited to join a creator team on S/NC as a <strong>${data.payload.role as string}</strong>.</p>
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
    text: `You've been invited to join a creator team on S/NC as a ${data.payload.role as string}.\n\nAccept: ${acceptUrl}\n\nThis invite expires in 7 days.`,
  };
};
