import { useEffect, useRef } from "react";

import { useNavigate } from "@tanstack/react-router";

import { useSession } from "../lib/auth.js";

// ── Public API ──

/**
 * Returns true if the page should render (user is not authenticated).
 * Returns false (and triggers redirect) if user is already authenticated.
 *
 * Once confirmed as guest, stays true even during session refetch flickers
 * (e.g. window focus) to prevent unmounting page content.
 */
export function useGuestRedirect(): boolean {
  const session = useSession();
  const navigate = useNavigate();
  const confirmedGuest = useRef(false);

  useEffect(() => {
    if (session.data) {
      void navigate({ to: "/feed" });
    }
  }, [session.data, navigate]);

  if (!session.isPending && !session.data) {
    confirmedGuest.current = true;
  }

  return confirmedGuest.current;
}
