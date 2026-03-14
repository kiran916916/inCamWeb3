import { test, expect } from "@playwright/test";

test.describe("Landing Page", () => {
  test("loads and shows hero content", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/InCam/);
    await expect(page.getByRole("heading", { name: /Own Your Content/i })).toBeVisible();
    await expect(page.getByText("Browse NFTs")).toBeVisible();
  });

  test("shows platform stats", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("12,400+")).toBeVisible();
    await expect(page.getByText("Creators")).toBeVisible();
  });

  test("navigates to marketplace", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Browse NFTs").click();
    await expect(page).toHaveURL("/marketplace");
    await expect(page.getByRole("heading", { name: "NFT Marketplace" })).toBeVisible();
  });

  test("is accessible without wallet connection", async ({ page }) => {
    await page.goto("/feed");
    await expect(page.getByRole("heading", { name: "Content Feed" })).toBeVisible();
    // Freemium content should be visible without wallet
    await expect(page.getByText("Free")).toBeVisible();
  });

  test("shows premium lock for gated content", async ({ page }) => {
    await page.goto("/feed");
    await expect(page.getByText("Premium").first()).toBeVisible();
  });

  test("marketplace filters work", async ({ page }) => {
    await page.goto("/marketplace");
    await page.getByText("Premium").first().click();
    await expect(page.getByText("Apply Filters")).toBeVisible();
  });

  test("rewards page shows quest board", async ({ page }) => {
    await page.goto("/rewards");
    await expect(page.getByRole("heading", { name: "Reward Centre" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Quest Board" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Leaderboard" })).toBeVisible();
  });

  test("is mobile friendly at 375px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Own Your Content/i })).toBeVisible();
    await page.goto("/marketplace");
    await expect(page.getByRole("heading", { name: "NFT Marketplace" })).toBeVisible();
  });
});
