import { test, expect } from "@playwright/test";

test.describe("Creator profile", () => {
  test("displays bio and social links", async ({ page }) => {
    // Navigate directly to Maya's profile via handle
    await page.goto("/creators/maya-chen");

    // Display name
    await expect(page.getByText("Maya Chen")).toBeVisible();

    // Bio text
    await expect(
      page.getByText(/Electronic and ambient music producer/),
    ).toBeVisible();

    // Social links section (Maya has bandcamp, spotify, instagram)
    await expect(page.getByRole("link", { name: /bandcamp/i })).toBeVisible();
  });
});
