import { test, expect } from "@playwright/test";
import {
  E2E_EMPLOYEE_EMAIL,
  E2E_PASSWORD,
  loginViaAPI,
  apiPost,
} from "./fixtures/auth";

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:5000";

/**
 * Dismiss first-visit modals in the correct order.
 *
 * Both appear simultaneously for new-session users.  The RadixUI dialog-app-tour
 * renders in a portal appended LAST to <body> — it intercepts pointer events via
 * DOM order even against higher-z-index siblings.  We must close app-tour first
 * (Escape), then dismiss the announcement modal.
 *
 * The dismiss endpoint is mocked to 200 so React's onSuccess fires and the modal
 * unmounts cleanly without any DOM manipulation that would break reconciliation.
 */
async function dismissModalsIfPresent(page: import("@playwright/test").Page) {
  // 1. App-tour guided checklist (Escape closes RadixUI Dialog)
  const appTour = page.locator('[data-testid="dialog-app-tour"]');
  if (await appTour.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await page.keyboard.press("Escape");
    await appTour.waitFor({ state: "hidden", timeout: 5_000 }).catch(() => {});
  }

  // 2. Announcement / "What's new" modal
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

test.describe("Punch In / Punch Out flow", () => {
  test.beforeEach(async ({ context }) => {
    await loginViaAPI(context, BASE_URL, E2E_EMPLOYEE_EMAIL, E2E_PASSWORD);
  });

  test("Attendance tab shows a Punch In or Punch Out button for an authenticated employee", async ({
    page,
  }) => {
    await page.goto("/admin/my-desk?tab=attendance");
    await page.waitForLoadState("networkidle");
    await dismissModalsIfPresent(page);

    const punchInBtn  = page.locator('[data-testid="button-punch-in"]');
    const punchOutBtn = page.locator('[data-testid="button-punch-out"]');

    await punchInBtn.or(punchOutBtn).waitFor({ state: "visible", timeout: 15_000 });

    const punchInVisible  = await punchInBtn.isVisible().catch(() => false);
    const punchOutVisible = await punchOutBtn.isVisible().catch(() => false);
    expect(punchInVisible || punchOutVisible).toBe(true);
  });

  test("Employee punches in, Punch Out appears, then punches out and today's record is saved", async ({
    page,
    context,
  }) => {
    // Ensure the day starts at not-punched-in.
    await apiPost(context, BASE_URL, "/api/hr/attendance/punch-out", {}).catch(() => {});

    await page.goto("/admin/my-desk?tab=attendance");
    await page.waitForLoadState("networkidle");
    await dismissModalsIfPresent(page);

    const punchInBtn  = page.locator('[data-testid="button-punch-in"]');
    const punchOutBtn = page.locator('[data-testid="button-punch-out"]');

    await punchInBtn.waitFor({ state: "visible", timeout: 15_000 });
    await expect(punchInBtn).toBeEnabled();

    await punchInBtn.click();

    await punchOutBtn.waitFor({ state: "visible", timeout: 15_000 });
    await expect(punchOutBtn).toBeEnabled();

    await punchOutBtn.click();

    // After punch-out, status becomes "completed" — the UI shows a completion
    // message instead of any button, and a row for today appears in the records table.
    await punchOutBtn.waitFor({ state: "hidden", timeout: 15_000 });
    await expect(page.locator("body")).toContainText(
      /attendance recorded|productive|great work/i,
      { timeout: 8_000 }
    );

    // Verify today's attendance row appears in the recent records table.
    const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    await expect(
      page.locator(`[data-testid="attendance-row-${todayStr}"]`)
    ).toBeVisible({ timeout: 10_000 });
  });
});
