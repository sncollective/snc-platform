import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import type React from "react";

import type { NotificationPreference } from "@snc/shared";

import { RouteErrorBoundary } from "../../components/error/route-error-boundary.js";
import { fetchAuthStateServer, fetchApiServer } from "../../lib/api-server.js";
import { apiMutate } from "../../lib/fetch-utils.js";
import { buildLoginRedirect } from "../../lib/return-to.js";
import settingsStyles from "../../styles/settings-page.module.css";
import listingStyles from "../../styles/listing-page.module.css";

// ── Private Constants ──

const EVENT_TYPE_LABELS: Record<string, string> = {
  go_live: "Creator goes live",
  new_content: "New content published",
};

const CHANNEL_LABELS: Record<string, string> = {
  email: "Email",
};

// ── Route ──

export const Route = createFileRoute("/settings/notifications")({
  beforeLoad: async ({ location }) => {
    const { user } = await fetchAuthStateServer();
    if (!user) throw redirect(buildLoginRedirect(location.pathname));
  },
  errorComponent: RouteErrorBoundary,
  head: () => ({ meta: [{ title: "Notification Preferences — S/NC" }] }),
  loader: async () => {
    const data = await fetchApiServer({ data: "/api/me/notifications" }) as {
      preferences: NotificationPreference[];
    };
    return data;
  },
  component: NotificationPreferencesPage,
});

// ── Component ──

function NotificationPreferencesPage(): React.ReactElement {
  const { preferences: initialPrefs } = Route.useLoaderData();
  const [preferences, setPreferences] = useState(initialPrefs);
  const [saving, setSaving] = useState<string | null>(null);

  const handleToggle = async (pref: NotificationPreference): Promise<void> => {
    const key = `${pref.eventType}-${pref.channel}`;
    setSaving(key);

    const newEnabled = !pref.enabled;

    // Optimistic update
    setPreferences((prev) =>
      prev.map((p) =>
        p.eventType === pref.eventType && p.channel === pref.channel
          ? { ...p, enabled: newEnabled }
          : p,
      ),
    );

    try {
      await apiMutate("/api/me/notifications", {
        method: "PUT",
        body: { eventType: pref.eventType, channel: pref.channel, enabled: newEnabled },
      });
    } catch {
      // Revert on failure
      setPreferences((prev) =>
        prev.map((p) =>
          p.eventType === pref.eventType && p.channel === pref.channel
            ? { ...p, enabled: !newEnabled }
            : p,
        ),
      );
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className={settingsStyles.page}>
      <h1 className={listingStyles.heading}>Notification Preferences</h1>
      <table>
        <thead>
          <tr>
            <th>Event</th>
            <th>Channel</th>
            <th>Enabled</th>
          </tr>
        </thead>
        <tbody>
          {preferences.map((pref) => {
            const key = `${pref.eventType}-${pref.channel}`;
            return (
              <tr key={key}>
                <td>{EVENT_TYPE_LABELS[pref.eventType] ?? pref.eventType}</td>
                <td>{CHANNEL_LABELS[pref.channel] ?? pref.channel}</td>
                <td>
                  <button
                    type="button"
                    onClick={() => { void handleToggle(pref); }}
                    disabled={saving === key}
                    aria-pressed={pref.enabled}
                  >
                    {pref.enabled ? "On" : "Off"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
