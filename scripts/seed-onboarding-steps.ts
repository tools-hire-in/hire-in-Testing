/**
 * Standalone runner for the onboarding steps seed.
 * Delegates to server/onboardingFlowSeed.ts which holds the actual data.
 *
 * Run with: npx tsx scripts/seed-onboarding-steps.ts
 */
import { seedOnboardingSteps } from "../server/onboardingFlowSeed";

seedOnboardingSteps()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[seed-onboarding-steps] Error:", err);
    process.exit(1);
  });
