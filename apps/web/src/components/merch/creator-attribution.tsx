import type React from "react";
import { Link } from "@tanstack/react-router";

// ── Public Types ──

export interface CreatorAttributionProps {
  readonly creatorId: string | null;
  readonly creatorName: string;
  readonly linkClassName?: string | undefined;
  readonly prefix?: string;
}

// ── Public API ──

export function CreatorAttribution({
  creatorId,
  creatorName,
  linkClassName,
  prefix,
}: CreatorAttributionProps): React.ReactElement {
  const nameElement = creatorId ? (
    <Link
      to="/creators/$creatorId"
      params={{ creatorId }}
      className={linkClassName}
      onClick={prefix ? undefined : (e: React.MouseEvent) => e.stopPropagation()}
    >
      {creatorName}
    </Link>
  ) : (
    creatorName
  );

  if (prefix) {
    return <>{prefix} {nameElement}</>;
  }

  return <>{nameElement}</>;
}
