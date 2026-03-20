import { createFileRoute } from "@tanstack/react-router";
import type React from "react";

import { STUDIO_SERVICES } from "@snc/shared";

import { ComingSoon } from "../components/coming-soon/coming-soon.js";
import { isFeatureEnabled } from "../lib/config.js";
import { StudioHero } from "../components/studio/studio-hero.js";
import { StudioServiceSection } from "../components/studio/studio-service-section.js";
import { StudioEquipment } from "../components/studio/studio-equipment.js";
import { StudioInquiryForm } from "../components/studio/studio-inquiry-form.js";
import styles from "./studio.module.css";

export const Route = createFileRoute("/studio")({
  component: StudioPage,
});

function StudioPage(): React.ReactElement {
  if (!isFeatureEnabled("booking")) return <ComingSoon feature="booking" />;

  return (
    <div className={styles.studioPage}>
      <StudioHero />
      <div className={styles.sections}>
        {STUDIO_SERVICES.map((service) => (
          <StudioServiceSection key={service} service={service} />
        ))}
      </div>
      <StudioEquipment />
      <StudioInquiryForm />
    </div>
  );
}
