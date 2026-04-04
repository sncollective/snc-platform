import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type React from "react";

import type { ValidateInviteResponse } from "@snc/shared";

import { RouteErrorBoundary } from "../../components/error/route-error-boundary.js";
import { fetchApiServer, fetchAuthStateServer } from "../../lib/api-server.js";
import { apiMutate } from "../../lib/fetch-utils.js";
import { buildLoginRedirect } from "../../lib/return-to.js";
import formStyles from "../../styles/form.module.css";
import styles from "./invite.module.css";

// ── Route ──

export const Route = createFileRoute("/invite/$token")({
  beforeLoad: async ({ location }) => {
    const { user } = await fetchAuthStateServer();
    if (!user) {
      throw redirect(buildLoginRedirect(location.pathname));
    }
  },
  errorComponent: RouteErrorBoundary,
  head: () => ({ meta: [{ title: "Accept Invite — S/NC" }] }),
  loader: async ({ params }) => {
    const invite = await fetchApiServer({
      data: `/api/invites/${encodeURIComponent(params.token)}`,
    }) as ValidateInviteResponse;
    return { invite, token: params.token };
  },
  component: AcceptInvitePage,
});

// ── Component ──

function AcceptInvitePage(): React.ReactElement {
  const { invite, token } = Route.useLoaderData();
  const navigate = useNavigate();
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState("");

  const handleAccept = async (): Promise<void> => {
    setIsAccepting(true);
    setError("");

    try {
      const result = await apiMutate<{ type: string; creatorId: string }>(
        `/api/invites/${encodeURIComponent(token)}/accept`,
        { method: "POST" },
      );

      if (result.type === "creator_owner") {
        void navigate({ to: `/creators/${result.creatorId}/manage/settings` });
      } else {
        void navigate({ to: `/creators/${result.creatorId}/manage` });
      }
    } catch {
      setError("Failed to accept invite. It may have expired.");
    } finally {
      setIsAccepting(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1>
          {invite.type === "creator_owner"
            ? "Create Your Creator Profile"
            : "Join a Creator Team"}
        </h1>

        {invite.type === "creator_owner" && (
          <p>
            You've been invited to set up{" "}
            <strong>{(invite.payload as { displayName: string }).displayName}</strong>{" "}
            as a creator on S/NC.
          </p>
        )}

        {invite.type === "team_member" && (
          <p>
            You've been invited to join a creator team as a{" "}
            <strong>{(invite.payload as { role: string }).role}</strong>.
          </p>
        )}

        <div
          className={formStyles.serverError}
          role={error ? "alert" : undefined}
          aria-live="polite"
          style={error ? undefined : { visibility: "hidden" }}
        >
          {error || "\u00A0"}
        </div>

        <button
          type="button"
          className={formStyles.submitButton}
          onClick={() => { void handleAccept(); }}
          disabled={isAccepting}
        >
          {isAccepting ? "Accepting..." : "Accept Invite"}
        </button>
      </div>
    </div>
  );
}
