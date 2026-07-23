import { execSync } from "child_process";
import { request } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:5000";

export default async function globalSetup() {
  console.log("[e2e] Seeding test users…");
  execSync("npx tsx scripts/e2e-seed.ts", { stdio: "inherit" });

  console.log("[e2e] Verifying server is reachable at", BASE_URL);
  const maxAttempts = 10;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const ctx = await request.newContext({ baseURL: BASE_URL });
      const res = await ctx.get("/admin/login", { timeout: 5_000 });
      await ctx.dispose();
      if (res.status() < 500) {
        console.log("[e2e] Server ready.");
        return;
      }
    } catch {
    }
    await new Promise((r) => setTimeout(r, 2_000));
  }
  throw new Error(`[e2e] Server at ${BASE_URL} was not reachable after ${maxAttempts} attempts`);
}
