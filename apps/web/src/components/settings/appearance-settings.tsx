import type { ReactElement } from "react";

import {
  APPEARANCE_PREFERENCES,
  type AppearanceController,
  type AppearancePreference,
} from "../../lib/appearance/appearance-controller.js";
import { useAppearance } from "../../lib/appearance/appearance.js";
import styles from "./appearance-settings.module.css";

const PREFERENCE_COPY: Record<
  AppearancePreference,
  { readonly label: string; readonly description: string }
> = {
  light: { label: "Light", description: "Always use the light appearance" },
  dark: { label: "Dark", description: "Always use the dark appearance" },
  system: { label: "System", description: "Match this device's appearance" },
};

interface AppearanceSettingsProps {
  /** Test seam; production always uses the root's singleton controller. */
  readonly controller?: AppearanceController;
}

export function AppearanceSettings({ controller }: AppearanceSettingsProps): ReactElement {
  const { preference, setPreference } = useAppearance(controller);

  return (
    <section aria-labelledby="appearance-heading">
      <h2 id="appearance-heading">Appearance</h2>
      <p className={styles.description}>Choose how S/NC looks on this device.</p>
      <fieldset className={styles.options}>
        <legend className="sr-only">Theme preference</legend>
        {APPEARANCE_PREFERENCES.map((option) => {
          const copy = PREFERENCE_COPY[option];
          return (
            <label className={styles.option} data-selected={preference === option} key={option}>
              <input
                type="radio"
                name="appearance-theme"
                value={option}
                checked={preference === option}
                onChange={() => setPreference(option)}
              />
              <span>
                <strong>{copy.label}</strong>
                <small>{copy.description}</small>
              </span>
            </label>
          );
        })}
      </fieldset>
    </section>
  );
}
