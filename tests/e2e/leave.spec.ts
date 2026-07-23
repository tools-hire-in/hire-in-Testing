import { test, expect, request as playwrightRequest } from "@playwright/test";
import {
  E2E_EMPLOYEE_EMAIL,
  E2E_MANAGER_EMAIL,
  E2E_ADMIN_EMAIL,
  E2E_PASSWORD,
  loginViaAPI,
} from "./fixtures/auth";

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:5000";

/** Returns a clean APIRequestContext already authenticated as the given user. */
async function apiLogin(email: string, password: string) {
  const ctx = await playwrightRequest.newContext({ baseURL: BASE_URL });
  const res = await ctx.post("/api/auth/login", { data: { email, password } });
  const body = await res.json();
  if (!res.ok() || !body.id) {
    await ctx.dispose();
    throw new Error(`API login failed for ${email}: ${JSON.stringify(body)}`);
  }
  return ctx;
}

async function dismissModalsIfPresent(page: import("@playwright/test").Page) {
  // App-tour RadixUI portal renders last in <body> → wins click interception regardless of z-index
  const appTour = page.locator('[data-testid="dialog-app-tour"]');
  if (await appTour.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await page.keyboard.press("Escape");
    await appTour.waitFor({ state: "hidden", timeout: 5_000 }).catch(() => {});
  }
  // Mock announcement dismiss so React onSuccess fires without network round-trip
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

function futureDateStr(daysAhead: number): string {
  const d = new Date();
  // Skip weekends to avoid date-picker weekend-blocking logic
  d.setDate(d.getDate() + daysAhead);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

test.describe("Leave application and manager approval flow", () => {
  test("employee submits a leave request via the UI form and it appears as Pending", async ({
    context,
    page,
  }) => {
    await loginViaAPI(context, BASE_URL, E2E_EMPLOYEE_EMAIL, E2E_PASSWORD);

    await page.goto("/admin/my-desk?tab=leave-balance");
    await page.waitForLoadState("networkidle");
    await dismissModalsIfPresent(page);

    // Open the apply-leave form
    const applyBtn = page.locator('[data-testid="button-apply-leave-cta"]');
    await applyBtn.waitFor({ state: "visible", timeout: 12_000 });
    await applyBtn.click();

    // Pick the first available (active) leave type
    const firstLeaveType = page.locator('[data-testid^="button-leave-type-"]').first();
    await firstLeaveType.waitFor({ state: "visible", timeout: 8_000 });
    await firstLeaveType.click();

    // Fill start and end dates (native <input type="date">)
    const leaveDate = futureDateStr(65);
    await page.locator('[data-testid="input-leave-start-date"]').fill(leaveDate);
    await page.locator('[data-testid="input-leave-end-date"]').fill(leaveDate);

    // Select reason from the dropdown (click trigger → pick first option)
    const reasonTrigger = page.locator('[data-testid="trigger-leave-reason"]');
    if (await reasonTrigger.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await reasonTrigger.click();
      const firstOption = page.locator('[role="option"]').first();
      await firstOption.waitFor({ state: "visible", timeout: 5_000 });
      await firstOption.click();
    }

    // Submit the form
    const submitBtn = page.locator('[data-testid="button-submit-leave"]');
    await submitBtn.waitFor({ state: "visible", timeout: 5_000 });
    await expect(submitBtn).toBeEnabled({ timeout: 5_000 });

    // Intercept the POST to capture the created request ID
    const [, leaveRes] = await Promise.all([
      submitBtn.click(),
      page.waitForResponse(
        (r) => r.url().includes("/api/hr/leave-requests") && r.request().method() === "POST",
        { timeout: 15_000 }
      ),
    ]);
    expect(leaveRes.status()).toBe(201);
    const created = await leaveRes.json() as { id: string; status: string };
    expect(created.status).toBe("pending");

    // Verify the success state is shown in the UI
    await expect(page.locator("body")).toContainText(
      /submitted|pending|success|applied|leave/i,
      { timeout: 10_000 }
    );
  });

  test("manager approves employee's pending leave via the Leave Approvals UI and status becomes Approved", async ({
    page,
    context,
  }) => {
    // ── Setup: employee creates a leave request via API (reliable precondition) ──
    const empCtx = await apiLogin(E2E_EMPLOYEE_EMAIL, E2E_PASSWORD);
    const typesRes = await empCtx.get("/api/hr/leave-types");
    expect(typesRes.ok()).toBe(true);
    const types: Array<{ id: string; isActive: boolean; name: string; blockEntitlement?: boolean }> =
      await typesRes.json();
    const eligible = types.find(
      (t) => t.isActive && !t.blockEntitlement && !/lwp|loss.?of.?pay/i.test(t.name)
    );
    if (!eligible) {
      await empCtx.dispose();
      test.skip(true, "No eligible leave type — DB prerequisite");
      return;
    }

    const startDate = futureDateStr(70);
    const createRes = await empCtx.post("/api/hr/leave-requests", {
      data: {
        leaveTypeId: eligible.id,
        startDate,
        endDate: startDate,
        totalDays: "1",
        halfDay: false,
        reason: "E2E manager UI approval test",
      },
    });
    expect(createRes.status()).toBe(201);
    const created = await createRes.json() as { id: string; status: string };
    expect(created.status).toBe("pending");
    const leaveRequestId = created.id;
    await empCtx.dispose();

    // ── Manager approves via Leave Approvals UI ──
    await loginViaAPI(context, BASE_URL, E2E_MANAGER_EMAIL, E2E_PASSWORD);
    await page.goto("/admin/hr/leave-approvals");
    await page.waitForLoadState("networkidle");
    await dismissModalsIfPresent(page);

    // Find and click Approve for this specific leave request
    const approveBtn = page.locator(`[data-testid="button-approve-${leaveRequestId}"]`);
    await approveBtn.waitFor({ state: "visible", timeout: 15_000 });
    await approveBtn.click();

    // Confirm the review in the confirmation dialog
    const confirmBtn = page.locator('[data-testid="button-confirm-review"]');
    await confirmBtn.waitFor({ state: "visible", timeout: 8_000 });
    await confirmBtn.click();

    // Verify the approval succeeded — the confirm button should disappear
    await confirmBtn.waitFor({ state: "hidden", timeout: 8_000 });

    // Double-check status via the employee's own leave history (list endpoint)
    const empVerifyCtx = await apiLogin(E2E_EMPLOYEE_EMAIL, E2E_PASSWORD);
    const listRes = await empVerifyCtx.get("/api/hr/leave-requests/my");
    expect(listRes.ok()).toBe(true);
    const history = await listRes.json() as Array<{ id: string; status: string }>;
    await empVerifyCtx.dispose();
    const approvedReq = history.find((r) => r.id === leaveRequestId);
    expect(approvedReq, "Leave request must appear in employee history").toBeTruthy();
    expect(approvedReq!.status).toBe("approved");
  });

  test("leave approvals page is accessible to admin and shows expected content", async ({
    page,
    context,
  }) => {
    await loginViaAPI(context, BASE_URL, E2E_ADMIN_EMAIL, E2E_PASSWORD);
    await page.goto("/admin/hr/leave-approvals");
    await page.waitForLoadState("networkidle");
    await expect(page).not.toHaveURL(/\/admin\/login/);
    await expect(page.locator("body")).toContainText(
      /leave|approval|pending|approved|request/i,
      { timeout: 10_000 }
    );
  });
});
