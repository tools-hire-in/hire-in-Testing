import { defineConfig, devices } from "@playwright/test";
import { execSync } from "child_process";

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:5000";

function resolveChromiumPath(): string | undefined {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  }
  try {
    const p = execSync("which chromium 2>/dev/null || which chromium-browser 2>/dev/null", {
      encoding: "utf8",
    }).trim();
    if (p) return p;
  } catch {
  }
  return undefined;
}

const executablePath = resolveChromiumPath();

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ["html", { open: "never", outputFolder: "playwright-report/html" }],
    ["list"],
  ],
  timeout: 45_000,
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
    launchOptions: {
      ...(executablePath ? { executablePath } : {}),
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.E2E_NO_SERVER
    ? undefined
    : {
        command: "npm run dev",
        url: BASE_URL,
        reuseExistingServer: true,
        timeout: 60_000,
      },
  outputDir: "playwright-report/results",
});
