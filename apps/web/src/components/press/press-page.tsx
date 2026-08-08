import type React from "react";

import { PressTemplateA } from "./press-template-a.js";
import { PressTemplateB } from "./press-template-b.js";
import type { DeliveredPressContent, PressTemplateProps } from "./press-types.js";
import styles from "./press-page.module.css";

const PRESS_TEMPLATES: Record<
  DeliveredPressContent["template"],
  React.ComponentType<PressTemplateProps>
> = {
  A: PressTemplateA,
  B: PressTemplateB,
};

export interface PressPageProps extends PressTemplateProps {}

/** Dispatch a delivered press payload to its exhaustive template shell. */
export function PressPage(props: PressPageProps): React.ReactElement {
  const Template = PRESS_TEMPLATES[props.content.template];
  return (
    <main className={styles.page}>
      <Template {...props} />
    </main>
  );
}
