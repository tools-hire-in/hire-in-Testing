import { execSync } from "child_process";

export default async function globalTeardown() {
  console.log("[e2e] Removing test users…");
  execSync("npx tsx scripts/e2e-seed.ts teardown", { stdio: "inherit" });
}
