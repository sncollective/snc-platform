import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";

/**
 * Focuses the <h1> or #main-content element after SPA route transitions
 * so screen readers announce the new page.
 */
export function useRouteAnnouncer(): void {
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = router.subscribe("onResolved", () => {
      const target =
        document.querySelector<HTMLElement>("h1") ??
        document.getElementById("main-content");
      if (target) {
        if (!target.hasAttribute("tabindex")) {
          target.setAttribute("tabindex", "-1");
        }
        target.focus();
      }
    });

    return unsubscribe;
  }, [router]);
}
