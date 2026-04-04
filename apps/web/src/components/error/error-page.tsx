import { useState, useEffect } from "react";

import styles from "./error-page.module.css";

interface ErrorPageProps {
  readonly statusCode: number;
  readonly title: string;
  readonly description?: string;
  readonly showRetry?: boolean;
  readonly onRetry?: () => void;
}

/** Full-page error display with status code, title, description, and navigation actions (retry, go back, go home). */
export function ErrorPage({
  statusCode,
  title,
  description,
  showRetry,
  onRetry,
}: ErrorPageProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleRetry = () => {
    if (!onRetry || isRetrying) return;
    setIsRetrying(true);
    onRetry();
  };

  const handleGoBack = () => {
    window.history.back();
  };

  const hasRetry = showRetry === true && onRetry !== undefined;

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.statusCode}>{statusCode}</div>
        <h1 className={styles.title}>{title}</h1>
        {description && <p className={styles.description}>{description}</p>}
        <div className={styles.actions}>
          {hasRetry && (
            <button
              type="button"
              className={styles.primaryButton}
              onClick={handleRetry}
              disabled={isRetrying}
            >
              {isRetrying ? "Retrying\u2026" : "Try again"}
            </button>
          )}
          <button
            type="button"
            className={
              hasRetry ? styles.secondaryButton : styles.primaryButton
            }
            onClick={handleGoBack}
            suppressHydrationWarning
            disabled={!isMounted}
          >
            Go back
          </button>
          <a href="/" className={styles.secondaryButton}>
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}
