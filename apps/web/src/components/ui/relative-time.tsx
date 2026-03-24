import type React from "react";

import { formatRelativeDate } from "../../lib/format.js";

export interface RelativeTimeProps {
  readonly dateTime: string;
  readonly className?: string | undefined;
  readonly prefix?: string | undefined;
}

/**
 * Renders a <time> element with a relative date string.
 *
 * Uses suppressHydrationWarning because formatRelativeDate depends on
 * Date.now(), which differs between SSR and client hydration — especially
 * near thresholds like "30 days ago" → "about 1 month ago".
 */
export function RelativeTime({
  dateTime,
  className,
  prefix,
}: RelativeTimeProps): React.ReactElement {
  return (
    <time
      className={className}
      dateTime={dateTime}
      suppressHydrationWarning={true}
    >
      {prefix}{formatRelativeDate(dateTime)}
    </time>
  );
}
