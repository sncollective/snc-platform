import type React from "react";

import { authClient } from "../../lib/auth-client.js";
import { socialProviders } from "../../lib/config.js";
import styles from "./social-login-buttons.module.css";

// ── Public Types ──

export interface SocialLoginButtonsProps {
  readonly callbackURL: string;
  readonly onMastodonClick: () => void;
}

// ── Private Helpers ──

const PROVIDER_LABELS: Record<string, string> = {
  google: "Google",
  apple: "Apple",
  twitch: "Twitch",
  mastodon: "Mastodon",
};

// ── Public API ──

/** Renders social login buttons for all enabled providers, with a divider. Returns null when no providers are enabled. */
export function SocialLoginButtons({
  callbackURL,
  onMastodonClick,
}: SocialLoginButtonsProps): React.ReactElement | null {
  const enabledProviders = (
    Object.keys(socialProviders) as Array<keyof typeof socialProviders>
  ).filter((key) => socialProviders[key]);

  if (enabledProviders.length === 0) return null;

  const handleBuiltInProvider = async (
    provider: "google" | "apple" | "twitch",
  ): Promise<void> => {
    await authClient.signIn.social({ provider, callbackURL });
  };

  return (
    <div className={styles.container}>
      <div className={styles.divider}>
        <span className={styles.dividerText}>or continue with</span>
      </div>
      <div className={styles.buttons}>
        {enabledProviders.map((provider) => {
          if (provider === "mastodon") {
            return (
              <button
                key="mastodon"
                type="button"
                className={styles.button}
                onClick={onMastodonClick}
              >
                {PROVIDER_LABELS.mastodon}
              </button>
            );
          }

          return (
            <button
              key={provider}
              type="button"
              className={styles.button}
              onClick={() => void handleBuiltInProvider(provider)}
            >
              {PROVIDER_LABELS[provider]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
