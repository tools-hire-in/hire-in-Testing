import { test, expect } from "@playwright/test";
import {
  E2E_ADMIN_EMAIL,
  E2E_PASSWORD,
  loginViaUI,
} from "./fixtures/auth";

test.describe("Login flow", () => {
  test("login page renders all required fields", async ({ page }) => {
    await page.goto("/admin/login");
    await expect(page.locator('[data-testid="input-email"]')).toBeVisible();
    await expect(page.locator('[data-testid="input-password"]')).toBeVisible();
    await expect(page.locator('[data-testid="button-submit"]')).toBeVisible();
    await expect(page.locator('[data-testid="text-login-title"]')).toBeVisible();
  });

  test("wrong credentials show an error and stay on login page", async ({ page }) => {
    await page.goto("/admin/login");
    await page.fill('[data-testid="input-email"]', "notauser@hire-in.com");
    await page.fill('[data-testid="input-password"]', "wrongpassword123");
    await page.click('[data-testid="button-submit"]');

    await expect(
      page.locator('[data-component-name="ToastDescription"], [role="alert"], .text-destructive')
        .filter({ hasText: /invalid email or password/i })
        .first()
    ).toBeVisible({ timeout: 8_000 });

    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("valid credentials redirect to the main dashboard (/admin/my-desk)", async ({ page }) => {
    await loginViaUI(page, E2E_ADMIN_EMAIL, E2E_PASSWORD);

    // /admin routes to /admin/my-desk (the CommandCenter dashboard)
    await expect(page).toHaveURL(/\/admin\/my-desk/, { timeout: 15_000 });
    await expect(page.locator("body")).toBeVisible();
  });
});
