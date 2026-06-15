import type { Page, TestInfo } from "@playwright/test";

/**
 * Viewport-aware navigation locators.
 *
 * The app uses distinct nav surfaces per breakpoint (see context-shell +
 * bottom-tab-bar). Below 768px the desktop nav is replaced, not merely
 * restyled, so locators must target the surface that is actually present at
 * the running viewport:
 *
 * - Main nav: desktop = `navigation "Main navigation"`; mobile = the fixed
 *   `BottomTabBar` (`navigation "Primary navigation"`).
 * - Context-shell nav (admin / creator-manage / governance): desktop = the
 *   sidebar (`navigation "<label> navigation"`); mobile = the chipBar
 *   (`navigation "<label> mobile navigation"`).
 *
 * The Playwright project name (`"mobile"` for the Pixel 7 project) is the
 * single source of truth for which surface to expect.
 */

/** True when the current test runs under the mobile (Pixel 7) project. */
export function isMobile(testInfo: TestInfo): boolean {
  return testInfo.project.name === "mobile";
}

/** The primary site nav present at the current viewport. */
export function mainNav(page: Page, testInfo: TestInfo) {
  return page.getByRole("navigation", {
    name: isMobile(testInfo) ? "Primary navigation" : "Main navigation",
  });
}

/**
 * The context-shell nav (admin, creator-manage, governance) present at the
 * current viewport, keyed by the context label (e.g. "Admin", "Maya Chen").
 */
export function contextNav(page: Page, testInfo: TestInfo, label: string) {
  return page.getByRole("navigation", {
    name: isMobile(testInfo) ? `${label} mobile navigation` : `${label} navigation`,
  });
}
