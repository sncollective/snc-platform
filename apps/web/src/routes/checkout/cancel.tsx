import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import type React from "react";

import { isFeatureEnabled } from "../../lib/config.js";
import buttonStyles from "../../styles/button.module.css";
import pageHeadingStyles from "../../styles/page-heading.module.css";
import styles from "./cancel.module.css";

export const Route = createFileRoute("/checkout/cancel")({
  beforeLoad: () => {
    if (!isFeatureEnabled("subscription")) throw redirect({ to: "/" });
  },
  head: () => ({ meta: [{ title: "Checkout Canceled — S/NC" }] }),
  component: CheckoutCancelPage,
});

function CheckoutCancelPage(): React.ReactElement {
  return (
    <div className={styles.cancelPage}>
      <h1 className={pageHeadingStyles.heading}>Checkout was canceled</h1>
      <p className={styles.message}>
        Your subscription was not created. No charges were made.
      </p>
      <Link to="/pricing" className={buttonStyles.primaryButtonLink}>
        Back to Pricing
      </Link>
    </div>
  );
}
