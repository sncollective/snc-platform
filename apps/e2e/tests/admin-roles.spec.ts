import { test, expect } from "@playwright/test";

test.describe("Admin panel", () => {
  test.use({ storageState: "auth/admin.json" });

  test("loads user list and displays role badges", async ({ page }) => {
    await page.goto("/admin");

    // Page heading
    await expect(
      page.getByRole("heading", { name: /admin/i }),
    ).toBeVisible();

    // User list loads with seeded users
    await expect(page.getByText("Pat Morgan")).toBeVisible();
    await expect(page.getByText("Maya Chen")).toBeVisible();
  });

  test("admin sidebar shows streaming management tabs", async ({ page }) => {
    await page.goto("/admin");
    // Context sidebar nav should show Playout and Simulcast tabs (streaming is enabled)
    const sidebar = page.getByRole("navigation", {
      name: "Admin navigation",
    });
    await expect(sidebar.getByRole("link", { name: "Playout" })).toBeVisible();
    await expect(
      sidebar.getByRole("link", { name: "Simulcast" }),
    ).toBeVisible();
  });

  test("playout admin page loads", async ({ page }) => {
    await page.goto("/admin/playout");
    // Should show the playout management heading and "Now Playing" section
    await expect(
      page.getByRole("heading", { level: 1, name: "Playout" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Now Playing" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Playlist" }),
    ).toBeVisible();
  });

  test("simulcast admin page loads", async ({ page }) => {
    await page.goto("/admin/simulcast");
    // Should show the simulcast heading and subtitle about RTMP destinations
    await expect(
      page.getByRole("heading", { level: 1, name: "Simulcast" }),
    ).toBeVisible();
    await expect(
      page.getByText("Manage external RTMP destinations"),
    ).toBeVisible();
  });
});
