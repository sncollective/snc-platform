import { Link } from "@tanstack/react-router";
import type React from "react";
import { Mic, ShoppingBag, Leaf } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  DialogRoot,
  DialogBackdrop,
  DialogContent,
  DialogTitle,
} from "../ui/dialog.js";
import styles from "./nav-overflow-sheet.module.css";

// ── Public Types ──

export interface NavOverflowSheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

// ── Private Constants ──

interface OverflowItem {
  readonly to: string;
  readonly label: string;
  readonly icon: LucideIcon;
}

const OVERFLOW_ITEMS: readonly OverflowItem[] = [
  { to: "/studio", label: "Studio", icon: Mic },
  { to: "/merch", label: "Merch", icon: ShoppingBag },
  { to: "/emissions", label: "Emissions", icon: Leaf },
];

// ── Public API ──

/**
 * Bottom-anchored navigation sheet for mobile overflow routes (Studio, Merch,
 * Emissions). Opened from the "More" tab in the bottom tab bar. Selecting a
 * link closes the sheet and navigates. Desktop-hidden via the bottom tab bar's
 * own `display: none` at ≥768px; the sheet never mounts on desktop because
 * its trigger isn't visible there.
 */
export function NavOverflowSheet({
  open,
  onOpenChange,
}: NavOverflowSheetProps): React.ReactElement {
  return (
    <DialogRoot
      open={open}
      onOpenChange={(details) => { onOpenChange(details.open); }}
      lazyMount
      unmountOnExit
    >
      <DialogBackdrop />
      <DialogContent className={styles.sheet!}>
        <DialogTitle className={styles.srOnly}>More navigation</DialogTitle>
        <ul className={styles.list}>
          {OVERFLOW_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={styles.item}
                  onClick={() => { onOpenChange(false); }}
                >
                  <Icon size={20} aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </DialogRoot>
  );
}
