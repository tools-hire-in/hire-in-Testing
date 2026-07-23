/**
 * Ceipal Compliance Modal — E2E regression suite
 *
 * The "Quick Ceipal Check-in" popup fires after punch-out for eligible roles
 * (recruiter / operations / account_manager). It is non-dismissible via Escape
 * or click-outside and has two resolution paths:
 *   • "Yes" → success screen → auto-close
 *   • "No"  → reason textarea (mandatory) → Submit & Close
 *
 * Strategy:
 *   Tests are split into two groups:
 *
 *   A) TRIGGER tests (2 tests)
 *      Use real punch-in → punch-out to confirm the popup fires from the
 *      actual attendance mutation. Run first so the recruiter is not yet
 *      punched in for the day.
 *
 *   B) MODAL-INTERACTION tests (4 tests)
 *      Use the ?ceipal=1 deep-link (the morning-reminder CTA path) to open
 *      the modal directly, bypassing attendance state entirely. This keeps
 *      them idempotent across runs regardless of the recruiter's attendance
 *      status for today.
 *
 *   The mock for GET /api/ceipal/today-status (hasAnsweredToday=false,
 *   promptEnabled=true) is applied before page.goto() in all recruiter
 *   tests so the frontend always shows the eligible-prompt state.
 *
 * Testids (from CeipalComplianceModal.tsx & CommandCenter.tsx):
 *   cc-button-punch-in      CommandCenter punch-in
 *   cc-button-punch-out     CommandCenter punch-out
 *   ceipal-compliance-modal The dialog container
 *   ceipal-btn-yes          "Yes, I updated Ceipal today"
 *   ceipal-btn-not-yet      "No, I haven't updated yet"
 *   ceipal-success-screen   Success step container
 *   ceipal-input-reason     Reason textarea (deferred step)
 *   ceipal-btn-confirm-defer "Submit & Close"
 */

import { test, expect } from "@playwright/test";
import {
  E2E_RECRUITER_EMAIL,
  E2E_ADMIN_EMAIL,
  E2E_PASSWORD,
  loginViaAPI,
  apiPost,
} from "./fixtures/auth";

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:5000";

// ── shared helpers ─────────────────────────────────────────────────────────────

/** Mock today-status so the modal always triggers for recruiter regardless of real DB state. */
async function mockCeipalNotAnsweredToday(page: import("@playwright/test").Page) {
  await page.route("**/api/ceipal/today-status", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        hasAnsweredToday: false,
        status: null,
        promptEnabled: true,
        consecutiveSkips: 0,
      }),
    })
  );
}

/** Navigate to the Ceipal deep-link that opens the modal without needing punch-out. */
async function openCeipalModalViaDeepLink(page: import("@playwright/test").Page) {
  await page.goto("/admin/my-desk?ceipal=1");
  await page.waitForLoadState("networkidle");
  // The CommandCenter reads ?ceipal=1 on mount and opens the modal if eligible
  await page
    .locator('[data-testid="ceipal-compliance-modal"]')
    .waitFor({ state: "visible", timeout: 8_000 });
}

// ── tests ─────────────────────────────────────────────────────────────────────

test.describe("Ceipal Compliance Modal — punch-out flow", () => {
  // ════════════════════════════════════════════════════════════════════════════
  // A) TRIGGER tests — verify the popup fires from the real punch-out path
  // ════════════════════════════════════════════════════════════════════════════
  test.describe("A — trigger: popup fires on punch-out for eligible role", () => {
    test.beforeEach(async ({ context }) => {
      await loginViaAPI(context, BASE_URL, E2E_RECRUITER_EMAIL, E2E_PASSWORD);
    });

    test("Ceipal modal appears after punch-out for a recruiter", async ({
      page,
      context,
    }) => {
      await mockCeipalNotAnsweredToday(page);
      await page.goto("/admin/my-desk");
      await page.waitForLoadState("networkidle");

      // Ensure punched out first so punch-in button is shown
      await apiPost(context, BASE_URL, "/api/hr/attendance/punch-out", {}).catch(() => {});
      await page.reload();
      await page.waitForLoadState("networkidle");

      // Punch in
      const punchInBtn = page.locator('[data-testid="cc-button-punch-in"]');
      await punchInBtn.waitFor({ state: "visible", timeout: 10_000 });
      await punchInBtn.click();
      await page.locator('[data-testid="cc-button-punch-out"]').waitFor({ state: "visible", timeout: 10_000 });

      // Punch out — modal should appear within 3 s (600 ms delay + render)
      await page.locator('[data-testid="cc-button-punch-out"]').click();

      await expect(
        page.locator('[data-testid="ceipal-compliance-modal"]')
      ).toBeVisible({ timeout: 5_000 });

      // Clean up: resolve the modal via Yes so the recruiter isn't left in limbo
      await page.locator('[data-testid="ceipal-btn-yes"]').click();
      await page
        .locator('[data-testid="ceipal-compliance-modal"]')
        .waitFor({ state: "hidden", timeout: 8_000 })
        .catch(() => {});
    });

    test("admin punching out from CommandCenter does NOT trigger the Ceipal modal", async ({
      page,
      context,
    }) => {
      // Re-login as admin
      await loginViaAPI(context, BASE_URL, E2E_ADMIN_EMAIL, E2E_PASSWORD);
      await apiPost(context, BASE_URL, "/api/hr/attendance/punch-out", {}).catch(() => {});
      await page.goto("/admin/my-desk");
      await page.waitForLoadState("networkidle");
      await page.reload();
      await page.waitForLoadState("networkidle");

      const punchInBtn = page.locator('[data-testid="cc-button-punch-in"]');
      if (await punchInBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await punchInBtn.click();
        await page.locator('[data-testid="cc-button-punch-out"]').waitFor({ state: "visible", timeout: 10_000 });
      }

      await page.locator('[data-testid="cc-button-punch-out"]').click();

      // Wait 2 s — the modal must NOT appear
      await page.waitForTimeout(2_000);
      await expect(
        page.locator('[data-testid="ceipal-compliance-modal"]')
      ).not.toBeVisible();
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // B) MODAL-INTERACTION tests — open via ?ceipal=1 deep-link (idempotent)
  // ════════════════════════════════════════════════════════════════════════════
  test.describe("B — modal interactions via deep-link", () => {
    test.beforeEach(async ({ context, page }) => {
      await loginViaAPI(context, BASE_URL, E2E_RECRUITER_EMAIL, E2E_PASSWORD);
      await mockCeipalNotAnsweredToday(page);
    });

    test("Escape and click-outside cannot dismiss the Ceipal modal", async ({
      page,
    }) => {
      await openCeipalModalViaDeepLink(page);
      const modal = page.locator('[data-testid="ceipal-compliance-modal"]');

      // Escape must NOT close the modal
      await page.keyboard.press("Escape");
      await expect(modal).toBeVisible();

      // Click well outside the dialog — modal must remain
      await page.mouse.click(10, 10);
      await expect(modal).toBeVisible();

      // Resolve via Yes to leave clean state
      await page.locator('[data-testid="ceipal-btn-yes"]').click();
      await modal.waitFor({ state: "hidden", timeout: 8_000 }).catch(() => {});
    });

    test('"Yes, I updated Ceipal" → success screen is shown then modal auto-closes', async ({
      page,
    }) => {
      await openCeipalModalViaDeepLink(page);

      await page.locator('[data-testid="ceipal-btn-yes"]').click();

      // Success screen must appear
      await expect(
        page.locator('[data-testid="ceipal-success-screen"]')
      ).toBeVisible({ timeout: 5_000 });
      await expect(
        page.locator('[data-testid="ceipal-success-screen"]')
      ).toContainText(/great work/i);

      // Modal auto-closes within ~3 s (1 800 ms auto-close timeout)
      await page
        .locator('[data-testid="ceipal-compliance-modal"]')
        .waitFor({ state: "hidden", timeout: 6_000 });
    });

    test('"No, I haven\'t updated" → deferred step shows mandatory reason textarea', async ({
      page,
    }) => {
      await openCeipalModalViaDeepLink(page);

      await page.locator('[data-testid="ceipal-btn-not-yet"]').click();

      await expect(
        page.locator('[data-testid="ceipal-input-reason"]')
      ).toBeVisible({ timeout: 3_000 });
      await expect(
        page.locator('[data-testid="ceipal-btn-confirm-defer"]')
      ).toBeVisible();

      // Submit button is disabled with empty reason
      await expect(
        page.locator('[data-testid="ceipal-btn-confirm-defer"]')
      ).toBeDisabled();

      // Resolve to leave clean state
      await page
        .locator('[data-testid="ceipal-input-reason"]')
        .fill("Test cleanup reason");
      await page.locator('[data-testid="ceipal-btn-confirm-defer"]').click();
      await page
        .locator('[data-testid="ceipal-compliance-modal"]')
        .waitFor({ state: "hidden", timeout: 8_000 })
        .catch(() => {});
    });

    test("Submit is disabled until ≥1 word entered; enabled after valid reason", async ({
      page,
    }) => {
      await openCeipalModalViaDeepLink(page);
      await page.locator('[data-testid="ceipal-btn-not-yet"]').click();

      const confirmBtn = page.locator('[data-testid="ceipal-btn-confirm-defer"]');
      await confirmBtn.waitFor({ state: "visible", timeout: 3_000 });

      // Empty → disabled
      await expect(confirmBtn).toBeDisabled();

      // Valid reason → enabled
      await page
        .locator('[data-testid="ceipal-input-reason"]')
        .fill("Waiting on client feedback");
      await expect(confirmBtn).toBeEnabled({ timeout: 2_000 });

      // Submit → modal closes
      await confirmBtn.click();
      await page
        .locator('[data-testid="ceipal-compliance-modal"]')
        .waitFor({ state: "hidden", timeout: 8_000 });
    });

    test('"No" with valid reason → POST status=deferred recorded → modal closes', async ({
      page,
    }) => {
      let capturedBody: Record<string, unknown> = {};

      // Intercept the log POST (let it continue to real backend)
      await page.route("**/api/ceipal/update-log", async (route) => {
        if (route.request().method() === "POST") {
          try {
            capturedBody = JSON.parse(route.request().postData() ?? "{}");
          } catch {
            capturedBody = {};
          }
        }
        await route.continue();
      });

      await openCeipalModalViaDeepLink(page);
      await page.locator('[data-testid="ceipal-btn-not-yet"]').click();
      await page
        .locator('[data-testid="ceipal-input-reason"]')
        .fill("No candidate calls today — manager approved leave");
      await page.locator('[data-testid="ceipal-btn-confirm-defer"]').click();

      // Modal must close
      await page
        .locator('[data-testid="ceipal-compliance-modal"]')
        .waitFor({ state: "hidden", timeout: 8_000 });

      // Verify the backend received status=deferred with a reason
      expect(capturedBody.status).toBe("deferred");
      expect(typeof capturedBody.deferredReason).toBe("string");
      expect((capturedBody.deferredReason as string).length).toBeGreaterThan(5);
    });
  });
});
