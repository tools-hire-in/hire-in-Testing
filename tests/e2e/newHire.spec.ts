import { test, expect } from "@playwright/test";
import { E2E_ADMIN_EMAIL, E2E_PASSWORD, loginViaAPI } from "./fixtures/auth";

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:5000";

async function dismissModalsIfPresent(page: import("@playwright/test").Page) {
  // 1. App-tour dialog (RadixUI portal, last in DOM → intercepts clicks first)
  const appTour = page.locator('[data-testid="dialog-app-tour"]');
  if (await appTour.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await page.keyboard.press("Escape");
    await appTour.waitFor({ state: "hidden", timeout: 5_000 }).catch(() => {});
  }

  // 2. Announcement modal — mock dismiss so React onSuccess fires cleanly
  await page.route("**/api/hr/announcements/dismiss", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' })
  );
  const dismissBtn = page.locator('[data-testid="button-announcement-dismiss"]');
  if (await dismissBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await dismissBtn.click();
    await page
      .locator('[data-testid="modal-whats-new"]')
      .waitFor({ state: "hidden", timeout: 5_000 })
      .catch(() => {});
  }
  await page.unroute("**/api/hr/announcements/dismiss").catch(() => {});
}

/** Trigger React controlled-input onChange reliably via character-by-character typing. */
async function reactFill(page: import("@playwright/test").Page, selector: string, value: string) {
  const loc = page.locator(selector);
  await loc.click();
  await loc.selectText().catch(() => {});
  await loc.pressSequentially(value, { delay: 30 });
  await expect(loc).toHaveValue(value, { timeout: 3_000 });
}

/**
 * Advances the offer letter wizard from step 0 to step 2.
 * Requires candidateName already filled (Next is disabled without it at step 0).
 */
async function advanceOfferLetterToStep2(page: import("@playwright/test").Page) {
  const nextBtn = page.locator('[data-testid="button-offer-next"]');
  // Step 0 → 1
  await expect(nextBtn).toBeEnabled({ timeout: 5_000 });
  await nextBtn.click();
  // Step 1 → 2
  await expect(nextBtn).toBeEnabled({ timeout: 5_000 });
  await nextBtn.click();
  // Generate button should now be visible (step 2)
  await expect(page.locator('[data-testid="button-generate-offer"]')).toBeVisible({ timeout: 5_000 });
}

test.describe("Offer letter generation — New Hire section", () => {
  test.beforeEach(async ({ context }) => {
    await loginViaAPI(context, BASE_URL, E2E_ADMIN_EMAIL, E2E_PASSWORD);
  });

  test("New Hire page loads and renders the Letters tab", async ({ page }) => {
    await page.goto("/admin/new-hire");
    await page.waitForLoadState("networkidle");
    await dismissModalsIfPresent(page);

    await expect(page.locator("body")).toContainText(
      /offer letter|letters|new hire/i,
      { timeout: 10_000 }
    );
    await expect(page).not.toHaveURL(/\/admin\/login/);
  });

  test("Offer letter generator form is accessible with required fields", async ({ page }) => {
    await page.goto("/admin/new-hire?tab=new-offer-letter");
    await page.waitForLoadState("networkidle");
    await dismissModalsIfPresent(page);

    // Step 0: name and designation fields must be present
    await expect(page.locator('[data-testid="input-offer-name"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-testid="input-offer-designation"]')).toBeVisible();

    // Fill name so Next is enabled, then advance the wizard to step 2 where
    // the Download DOCX button lives (the form is a 3-step wizard: 0→1→2)
    await reactFill(page, '[data-testid="input-offer-name"]', "E2E Test Candidate");
    await advanceOfferLetterToStep2(page);

    await expect(page.locator('[data-testid="button-generate-offer"]')).toBeVisible();
  });

  test("HR fills the offer letter form and generates a DOCX download", async ({ page }) => {
    await page.goto("/admin/new-hire?tab=new-offer-letter");
    await page.waitForLoadState("networkidle");
    await dismissModalsIfPresent(page);

    await expect(page.locator('[data-testid="input-offer-name"]')).toBeVisible({ timeout: 10_000 });
    // Give the form a moment to finish any async initialisation.
    await page.waitForTimeout(500);

    // Fill required fields at step 0
    await reactFill(page, '[data-testid="input-offer-name"]', "E2E Test Candidate");
    await reactFill(page, '[data-testid="input-offer-designation"]', "QA Engineer");

    // Navigate the wizard to step 2 where the generate button appears
    await advanceOfferLetterToStep2(page);

    const generateBtn = page.locator('[data-testid="button-generate-offer"]');
    await expect(generateBtn).toBeEnabled({ timeout: 8_000 });

    // Click and wait for the browser to fire a download event (DOCX blob).
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 25_000 }),
      generateBtn.click(),
    ]);

    expect(download).not.toBeNull();
    expect(download.suggestedFilename()).toMatch(/\.(docx|pdf)$/i);
  });

  test("Onboarding tab shows employee onboarding status table", async ({ page }) => {
    await page.goto("/admin/new-hire?tab=onboarding");
    await page.waitForLoadState("networkidle");
    await dismissModalsIfPresent(page);

    await expect(page.locator("body")).toContainText(
      /onboarding|new hire|recent hire|joining|employee|no recent hire/i,
      { timeout: 10_000 }
    );
  });
});
