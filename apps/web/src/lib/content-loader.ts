import { CREATOR_ROLE_PERMISSIONS } from "@snc/shared";
import type { FeedItem, SubscriptionPlan } from "@snc/shared";

import { fetchApiServer } from "./api-server.js";

/** Check whether a content item's media is gated behind a subscription. */
export function isContentLocked(item: FeedItem): boolean {
  return item.visibility === "subscribers" && item.mediaUrl === null && item.body === null;
}

/** Fetch subscription plans for locked content. Returns [] on failure. */
export async function fetchLockedContentPlans(
  item: FeedItem,
): Promise<readonly SubscriptionPlan[]> {
  if (!isContentLocked(item)) return [];
  try {
    const data = (await fetchApiServer({
      data: `/api/subscriptions/plans?creatorId=${encodeURIComponent(item.creatorId)}`,
    })) as { plans: SubscriptionPlan[] };
    return data.plans;
  } catch {
    // Plans fetch failure is non-fatal — SubscribeCta will show
    // the platform subscription fallback link instead
    return [];
  }
}

/** Check whether the current user can manage the given creator's content. */
export async function resolveCanManage(creatorId: string): Promise<boolean> {
  let me: { user: { id: string }; roles: string[] } | null;
  try {
    me = (await fetchApiServer({ data: "/api/me" })) as { user: { id: string }; roles: string[] } | null;
  } catch {
    // Not logged in
    return false;
  }
  if (!me?.user) return false;
  if (me.roles.includes("admin")) return true;

  let membersRes: { members: Array<{ userId: string; role: string }> };
  try {
    membersRes = (await fetchApiServer({
      data: `/api/creators/${encodeURIComponent(creatorId)}/members`,
    })) as { members: Array<{ userId: string; role: string }> };
  } catch {
    // Not a member — can't manage
    return false;
  }
  const membership = membersRes.members.find((m) => m.userId === me.user.id);
  if (membership) {
    const role = membership.role as "owner" | "editor" | "viewer";
    return CREATOR_ROLE_PERMISSIONS[role].manageContent === true;
  }
  return false;
}
