import { type ButtonHTMLAttributes, type ReactElement, cloneElement, Children } from "react";
import { Spinner } from "./spinner.js";
import styles from "./button.module.css";

// ── Constants (Single Source of Truth) ──

export const BUTTON_VARIANTS = ["primary", "secondary", "outline", "ghost", "danger"] as const;
export type ButtonVariant = (typeof BUTTON_VARIANTS)[number];

export const BUTTON_SIZES = ["sm", "md", "lg"] as const;
export type ButtonSize = (typeof BUTTON_SIZES)[number];

// ── Props ──

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style variant. Defaults to "primary". */
  variant?: ButtonVariant;
  /** Size of the button. Defaults to "md". */
  size?: ButtonSize;
  /** Shows a spinner and disables interaction. Sets aria-busy. */
  loading?: boolean;
  /**
   * When true, merges button props onto its single child element instead of
   * rendering a `<button>`. Use for rendering as `<a>` or TanStack `<Link>`.
   */
  asChild?: boolean;
}

// ── Component ──

/**
 * Polymorphic action button. Supports five variants, three sizes, and a
 * loading state that disables interaction while keeping label text in the DOM.
 * Use `asChild` to render as `<a>` or `<Link>` while inheriting button styles.
 */
export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  asChild = false,
  disabled,
  children,
  className,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const combinedClassName = className ? `${styles.button} ${className}` : styles.button;

  // asChild: merge props onto the single child element (no loading support)
  if (asChild) {
    const child = Children.only(children) as ReactElement<Record<string, unknown>>;
    return cloneElement(child, {
      ...rest,
      className: child.props.className
        ? `${combinedClassName} ${child.props.className}`
        : combinedClassName,
      "data-variant": variant,
      "data-size": size,
    });
  }

  return (
    <button
      type="button"
      data-variant={variant}
      data-size={size}
      className={combinedClassName}
      disabled={isDisabled}
      aria-busy={loading ? "true" : undefined}
      {...rest}
    >
      {/* Content wrapper — hidden visually during load, stays in DOM for a11y */}
      <span
        className={styles.content}
        aria-hidden={loading ? "true" : undefined}
      >
        {children}
      </span>

      {/* Spinner overlay — centered over content during load */}
      {loading && (
        <span className={styles.spinnerOverlay}>
          <Spinner size={size} aria-hidden />
        </span>
      )}
    </button>
  );
}
