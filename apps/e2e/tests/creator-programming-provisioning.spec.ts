import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import { contextNav } from "./helpers/nav.js";

/**
 * Spec B — lazy channel-provisioning path (creator-programming-e2e-provisioning).
 *
 * The demo seed provisions a creator channel for Maya only; Jordan Ellis
 * (`jordan-ellis`) and Sam Okafor (`sam-okafor`) own their profiles but are
 * deliberately left WITHOUT a channel so the lazy-provisioning path stays
 * exercisable. An unprovisioned creator's Programming tab renders the honest
 * "set up streaming" affordance instead of the editorial surface; creating the
 * first stream key lazy-provisions the channel (via `ensureCreatorChannel`) so
 * the editorial surface appears.
 *
 * State isolation across the two unprovisioned creators is deliberate, because
 * provisioning is a persistent one-way change against the shared seed DB and
 * both Playwright projects (chromium + mobile) hit the same backend:
 * - Case 1 reads JORDAN's surface and never mutates it, so the "unprovisioned"
 *   assertion holds in both projects regardless of run order.
 * - Case 2 provisions SAM (a creator no test ever asserts unprovisioned), so
 *   mutating him in both projects / on re-runs is harmless. It still proves the
 *   real affordance→surface transition on a fresh DB and asserts the
 *   surface-renders invariant unconditionally.
 *
 * Auth:
 * - Case 1 uses `auth/creator-unprovisioned.json` (Jordan), minted in
 *   `global.setup.ts`.
 * - Case 2 uses `auth/admin.json` (Alex). Admins bypass the creator-membership
 *   gate and get owner-level permissions, so admin can drive Sam's Streaming +
 *   Programming surface without minting a third per-creator auth state.
 *
 * Pure-UI assertions only — no API probes from the test body, matching the
 * suite's black-box boundary (`request` lives only in `global.setup.ts`).
 */

const SETUP_AFFORDANCE = "Set up streaming to start programming";

/** The three editorial-surface section headings, absent until provisioned. */
function editorialHeadings(page: Page) {
  return {
    nowPlaying: page.getByRole("heading", { name: "Now Playing" }),
    queue: page.getByRole("heading", { name: "Queue" }),
    contentPool: page.getByRole("heading", { name: /^Content Pool/ }),
  };
}

// Case 1 — read-only affordance on Jordan, under his unprovisioned auth state.
test.describe("Creator Programming — unprovisioned affordance", () => {
  test.use({ storageState: "auth/creator-unprovisioned.json" });

  test("unprovisioned creator sees the set-up affordance, not the editorial surface", async ({
    page,
  }) => {
    await page.goto("/creators/jordan-ellis/manage/programming");

    // The honest empty state: a prompt to set up streaming and a link to the
    // Streaming tab where the first stream key is created.
    await expect(page.getByText(SETUP_AFFORDANCE)).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Go to Streaming" }),
    ).toBeVisible();

    // The editorial surface must NOT render while the channel is unprovisioned.
    const headings = editorialHeadings(page);
    await expect(headings.nowPlaying).toHaveCount(0);
    await expect(headings.queue).toHaveCount(0);
    await expect(headings.contentPool).toHaveCount(0);
  });
});

// Case 2 — provisioning transition on Sam, driven via admin (bypasses the
// membership gate, gets owner-level permissions). Isolated to Sam so the
// mutation never invalidates case 1's read on Jordan.
test.describe("Creator Programming — first stream key provisions the channel", () => {
  test.use({ storageState: "auth/admin.json" });

  test("creating a stream key provisions the channel and the editorial surface appears", async ({
    page,
  }, testInfo) => {
    await page.goto("/creators/sam-okafor/manage/programming");

    // Common case (fresh DB / first project): Sam starts unprovisioned, so
    // assert the real affordance→surface transition. If the sibling project or a
    // prior run already provisioned him against the shared DB, skip the
    // pre-condition — key creation is idempotent and the surface-renders
    // invariant below still holds.
    const affordance = page.getByText(SETUP_AFFORDANCE);
    const startedUnprovisioned = await affordance.isVisible();

    if (startedUnprovisioned) {
      await expect(editorialHeadings(page).queue).toHaveCount(0);

      // Follow the affordance to the Streaming tab and create the first key.
      await page.getByRole("link", { name: "Go to Streaming" }).click();
    } else {
      // Already provisioned — reach the Streaming tab via the context nav.
      await contextNav(page, testInfo, "Sam Okafor")
        .getByRole("link", { name: "Streaming" })
        .click();
    }

    await expect(
      page.getByRole("heading", { level: 1, name: "Streaming" }),
    ).toBeVisible();

    // Fill the key name and submit. Reaching the Streaming tab via the
    // client-side affordance link lands on a form that remounts once its
    // `loadKeys` effect settles, which can wipe a value filled too early — so
    // the fill is wrapped in a web-first retry that re-fills until the value
    // sticks and the disabled-until-non-empty submit button enables. This is a
    // hydration-timing guard, not a product workaround: a real user typing
    // after the page settles sees the button enable normally.
    const keyNameInput = page.getByLabel("Stream key name");
    const createButton = page.getByRole("button", { name: "Create Key" });
    await expect(async () => {
      await keyNameInput.fill("E2E Provisioning Key");
      await expect(keyNameInput).toHaveValue("E2E Provisioning Key", { timeout: 1000 });
      await expect(createButton).toBeEnabled({ timeout: 1000 });
    }).toPass({ timeout: 10_000 });
    await createButton.click();

    // Key creation succeeds — the success status banner names the new key. This
    // is the UI signal that `createStreamKey` ran (and, with it,
    // `ensureCreatorChannel` provisioned Sam's channel if it didn't exist).
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: 'Key "E2E Provisioning Key" created' }),
    ).toBeVisible();

    // Return to Programming. The channel now exists, so the editorial surface
    // renders in place of the set-up affordance.
    await contextNav(page, testInfo, "Sam Okafor")
      .getByRole("link", { name: "Programming" })
      .click();
    await expect(page).toHaveURL(
      /\/creators\/sam-okafor\/manage\/programming$/,
    );

    const headings = editorialHeadings(page);
    await expect(headings.nowPlaying).toBeVisible();
    await expect(headings.queue).toBeVisible();
    await expect(headings.contentPool).toBeVisible();

    // The set-up affordance is gone now that the channel is provisioned.
    await expect(page.getByText(SETUP_AFFORDANCE)).toHaveCount(0);
  });
});
