import { type Page, type BrowserContext, request } from "@playwright/test";

export const E2E_ADMIN_EMAIL     = "e2e-admin@hire-in.com";
export const E2E_EMPLOYEE_EMAIL  = "e2e-employee@hire-in.com";
export const E2E_MANAGER_EMAIL   = "e2e-manager@hire-in.com";
export const E2E_HR_EMAIL        = "e2e-hr@hire-in.com";
export const E2E_RECRUITER_EMAIL = "e2e-recruiter@hire-in.com";
export const E2E_PASSWORD        = "E2eTest@2024!";

export async function checkServerReachable(baseURL: string): Promise<boolean> {
  try {
    const ctx = await request.newContext();
    const res = await ctx.get(baseURL + "/admin/login", { timeout: 5_000 });
    await ctx.dispose();
    return res.status() < 500;
  } catch {
    return false;
  }
}

export async function loginViaUI(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto("/admin/login");
  await page.waitForSelector('[data-testid="input-email"]', { timeout: 10_000 });
  await page.fill('[data-testid="input-email"]', email);
  await page.fill('[data-testid="input-password"]', password);
  await page.click('[data-testid="button-submit"]');
  await page.waitForURL((url) => !url.pathname.includes("/admin/login"), {
    timeout: 15_000,
  });
}

export async function loginViaAPI(
  context: BrowserContext,
  baseURL: string,
  email: string,
  password: string
): Promise<void> {
  const apiCtx = await request.newContext({ baseURL });
  const res = await apiCtx.post("/api/auth/login", {
    data: { email, password },
  });
  const body = await res.json();
  if (!res.ok() || !body.id) {
    await apiCtx.dispose();
    throw new Error(`Login failed for ${email}: ${JSON.stringify(body)}`);
  }
  const cookies = res.headers()["set-cookie"];
  if (cookies) {
    const parsed = parseCookies(cookies, baseURL);
    await context.addCookies(parsed);
  }
  await apiCtx.dispose();
}

export async function apiPost(
  context: BrowserContext,
  baseURL: string,
  path: string,
  data: unknown
): Promise<{ status: number; body: unknown }> {
  const cookies = await context.cookies();
  const apiCtx = await request.newContext({
    baseURL,
    extraHTTPHeaders: {
      Cookie: cookies.map((c) => `${c.name}=${c.value}`).join("; "),
    },
  });
  const res = await apiCtx.post(path, { data: data as Record<string, unknown> });
  const body = await res.json().catch(() => ({}));
  await apiCtx.dispose();
  return { status: res.status(), body };
}

export async function apiGet(
  context: BrowserContext,
  baseURL: string,
  path: string
): Promise<{ status: number; body: unknown }> {
  const cookies = await context.cookies();
  const apiCtx = await request.newContext({
    baseURL,
    extraHTTPHeaders: {
      Cookie: cookies.map((c) => `${c.name}=${c.value}`).join("; "),
    },
  });
  const res = await apiCtx.get(path);
  const body = await res.json().catch(() => ({}));
  await apiCtx.dispose();
  return { status: res.status(), body };
}

function parseCookies(
  setCookieHeader: string,
  baseURL: string
): Array<{ name: string; value: string; domain: string; path: string; httpOnly: boolean; secure: boolean }> {
  const url = new URL(baseURL);
  return setCookieHeader.split(/,(?=[^ ].*?=)/).map((raw) => {
    const [nameVal, ...parts] = raw.trim().split(";");
    const eqIdx = nameVal.indexOf("=");
    const name = nameVal.slice(0, eqIdx).trim();
    const value = nameVal.slice(eqIdx + 1).trim();
    let path = "/";
    for (const part of parts) {
      const [k, v] = part.trim().split("=");
      if (k.toLowerCase() === "path" && v) path = v;
    }
    return {
      name,
      value,
      domain: url.hostname,
      path,
      httpOnly: raw.toLowerCase().includes("httponly"),
      secure: raw.toLowerCase().includes("secure"),
    };
  });
}
