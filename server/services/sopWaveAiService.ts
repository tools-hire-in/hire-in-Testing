/**
 * SOP Wave AI Scheduling Service
 *
 * Provides AI-powered smart scheduling assistance for wave rollout:
 *   - suggestLaunchWindows: 3 ranked go-live windows avoiding conflicts
 *   - predictAckRate: live prediction badge for a given date + grace period
 *   - generateImpactNarrative: plain-English impact summary for admin approval
 *
 * All employee data is anonymised through aiPrivacyGuard before leaving the
 * server. Every function degrades gracefully — callers catch errors and surface
 * { available: false } to the frontend.
 */

import OpenAI from "openai";
import { db } from "../db";
import {
  holidays,
  salaryReportRuns,
  waveScheduledLaunches,
  sopEmployeeProgress,
  waveSops,
  rolloutWaves,
  sopDocuments,
  leaveRequests,
} from "@shared/schema";
import { and, eq, gte, lte, inArray, or, sql } from "drizzle-orm";
import { redactFreeTextForAI, sanitizeObjectForAI, auditPromptForPII } from "./aiPrivacyGuard";
import { computeCost } from "../config/aiPricing";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const AI_TIMEOUT_MS = 8000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("AI call timed out")), ms),
    ),
  ]);
}

function logCost(label: string, model: string, totalTokens: number) {
  const { costUsd } = computeCost(model, totalTokens);
  console.log(
    `[sopWaveAI] ${label} | model=${model} tokens=${totalTokens} cost=$${costUsd.toFixed(6)} category=sop_wave_scheduling`,
  );
}

/**
 * Sanitize a context object through the privacy guard before building prompts.
 * Redacts any prohibited field names (PII) from the object.
 */
function sanitizeContext(data: Record<string, unknown>): Record<string, unknown> {
  return sanitizeObjectForAI(data) as Record<string, unknown>;
}

/**
 * Audit a prompt string for PII before sending to the AI provider.
 * Logs a warning if any prohibited patterns are found.
 */
function auditPrompt(label: string, prompt: string): void {
  const violations = auditPromptForPII(prompt);
  if (violations.length > 0) {
    console.warn(
      `[sopWaveAI] PRIVACY WARN — ${label}: prompt contains potential PII fields: ${violations.join(", ")}`,
    );
  }
}

export interface LaunchWindowSuggestion {
  startDate: string;
  endDate: string;
  reason: string;
  historicalAckRate: number;
  rank: number;
}

export interface SuggestLaunchWindowsResult {
  available: true;
  suggestions: LaunchWindowSuggestion[];
}

export interface AckPrediction {
  predictedAckRate: number;
  confidence: "high" | "medium" | "low";
  rationale: string;
}

export interface AckPredictionResult {
  available: true;
  prediction: AckPrediction;
}

export interface ImpactNarrative {
  narrative: string;
  riskRating: "LOW" | "MEDIUM" | "HIGH";
  affectedCount: number;
  predictedCompletionRate: number;
  redFlags: string[];
}

export interface ImpactNarrativeResult {
  available: true;
  impact: ImpactNarrative;
}

export type SuggestLaunchWindowsResponse = SuggestLaunchWindowsResult | { available: false };
export type AckPredictionResponse = AckPredictionResult | { available: false };
export type ImpactNarrativeResponse = ImpactNarrativeResult | { available: false };

const SUGGEST_WINDOWS_SCHEMA = {
  type: "object",
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          startDate: { type: "string" },
          endDate: { type: "string" },
          reason: { type: "string" },
          historicalAckRate: { type: "number" },
          rank: { type: "number" },
        },
        required: ["startDate", "endDate", "reason", "historicalAckRate", "rank"],
        additionalProperties: false,
      },
    },
  },
  required: ["suggestions"],
  additionalProperties: false,
};

const PREDICT_ACK_SCHEMA = {
  type: "object",
  properties: {
    predictedAckRate: { type: "number" },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    rationale: { type: "string" },
  },
  required: ["predictedAckRate", "confidence", "rationale"],
  additionalProperties: false,
};

const IMPACT_NARRATIVE_SCHEMA = {
  type: "object",
  properties: {
    narrative: { type: "string" },
    riskRating: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
    affectedCount: { type: "number" },
    predictedCompletionRate: { type: "number" },
    redFlags: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["narrative", "riskRating", "affectedCount", "predictedCompletionRate", "redFlags"],
  additionalProperties: false,
};

async function getHolidayDates(fromDate: string, toDate: string): Promise<string[]> {
  try {
    const rows = await db
      .select({ date: holidays.date })
      .from(holidays)
      .where(and(gte(holidays.date, fromDate), lte(holidays.date, toDate)));
    return rows.map((r) => String(r.date));
  } catch {
    return [];
  }
}

async function getPayrollCutoffDates(fromDate: string, toDate: string): Promise<string[]> {
  try {
    const rows = await db
      .select({ reportDate: salaryReportRuns.reportDate })
      .from(salaryReportRuns)
      .where(
        and(
          gte(salaryReportRuns.reportDate as any, fromDate),
          lte(salaryReportRuns.reportDate as any, toDate),
        ),
      );
    return rows.map((r) => String(r.reportDate)).filter(Boolean);
  } catch {
    return [];
  }
}

async function getExistingWaveLaunches(fromDate: string, toDate: string): Promise<Array<{ waveNumber: number; goLiveDate: string }>> {
  try {
    const rows = await db
      .select({
        waveNumber: waveScheduledLaunches.waveNumber,
        goLiveDate: waveScheduledLaunches.goLiveDate,
      })
      .from(waveScheduledLaunches)
      .where(
        and(
          gte(waveScheduledLaunches.goLiveDate, fromDate),
          lte(waveScheduledLaunches.goLiveDate, toDate),
          or(
            eq(waveScheduledLaunches.status, "pending_approval"),
            eq(waveScheduledLaunches.status, "approved"),
            eq(waveScheduledLaunches.status, "active"),
          ),
        ),
      );
    return rows.map((r) => ({ waveNumber: r.waveNumber, goLiveDate: r.goLiveDate }));
  } catch {
    return [];
  }
}

async function getHistoricalAckStats(): Promise<{
  totalProgress: number;
  totalAcknowledged: number;
  avgAckDays: number | null;
}> {
  try {
    const rows = await db
      .select({
        acknowledged: sopEmployeeProgress.acknowledgedAt,
        timerStarted: (sopEmployeeProgress as any).timerStartedAt,
      })
      .from(sopEmployeeProgress)
      .where(sql`TRUE`)
      .limit(500);

    const total = rows.length;
    const acked = rows.filter((r) => r.acknowledged).length;
    const durations: number[] = [];
    for (const r of rows) {
      if (r.acknowledged && r.timerStarted) {
        const ms = new Date(r.acknowledged).getTime() - new Date(r.timerStarted).getTime();
        if (ms > 0) durations.push(ms / 86400000);
      }
    }
    const avgDays = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : null;
    return { totalProgress: total, totalAcknowledged: acked, avgAckDays: avgDays };
  } catch {
    return { totalProgress: 0, totalAcknowledged: 0, avgAckDays: null };
  }
}

async function getWaveAffectedEmployeeCount(waveNumber: number): Promise<number> {
  try {
    const members = await db
      .select({ sopMasterId: waveSops.sopMasterId })
      .from(waveSops)
      .where(eq(waveSops.waveNumber, waveNumber));
    if (members.length === 0) return 0;

    const masterIds = members.map((m) => m.sopMasterId);
    const progress = await db
      .select({ userId: sopEmployeeProgress.userId })
      .from(sopEmployeeProgress)
      .where(inArray(sopEmployeeProgress.sopMasterId, masterIds));

    const unique = new Set(progress.map((p) => p.userId));
    return unique.size;
  } catch {
    return 0;
  }
}

async function getEmployeesOnLeaveInWindow(
  fromDate: string,
  toDate: string,
): Promise<number> {
  try {
    const rows = await db
      .select({ id: leaveRequests.id })
      .from(leaveRequests)
      .where(
        and(
          eq(leaveRequests.status, "approved"),
          lte(leaveRequests.startDate, toDate),
          gte(leaveRequests.endDate, fromDate),
        ),
      )
      .limit(200);
    return rows.length;
  } catch {
    return 0;
  }
}

export async function suggestLaunchWindows(
  waveNumber: number,
): Promise<SuggestLaunchWindowsResponse> {
  try {
    const now = new Date();
    const fromDate = new Date(now.getTime() + 2 * 86400000).toISOString().slice(0, 10);
    const toDate = new Date(now.getTime() + 60 * 86400000).toISOString().slice(0, 10);

    const [holidayDates, payrollDates, existingLaunches, ackStats] = await Promise.all([
      getHolidayDates(fromDate, toDate),
      getPayrollCutoffDates(fromDate, toDate),
      getExistingWaveLaunches(fromDate, toDate),
      getHistoricalAckStats(),
    ]);

    const overallAckRate =
      ackStats.totalProgress > 0
        ? Math.round((ackStats.totalAcknowledged / ackStats.totalProgress) * 100)
        : 75;

    // Sanitize context object through privacy guard before building prompt
    const ctx = sanitizeContext({
      waveNumber,
      searchFrom: fromDate,
      searchTo: toDate,
      today: now.toISOString().slice(0, 10),
      holidayDates,
      payrollDates,
      existingLaunches,
      overallAckRate,
      avgAckDays: ackStats.avgAckDays !== null ? Math.round(ackStats.avgAckDays) : null,
    });

    const prompt = `You are an SOP rollout scheduler for an HR platform. Given the constraints below, suggest exactly 3 go-live date windows for Wave ${ctx.waveNumber} within the next 60 days.

Today's date: ${ctx.today}
Search window: ${ctx.searchFrom} to ${ctx.searchTo}

Constraints to avoid:
- Public holidays: ${(ctx.holidayDates as string[]).length > 0 ? (ctx.holidayDates as string[]).join(", ") : "None identified"}
- Payroll processing weeks (approximate): ${(ctx.payrollDates as string[]).length > 0 ? (ctx.payrollDates as string[]).join(", ") : "None identified"}
- Existing wave launches already scheduled: ${(ctx.existingLaunches as Array<{ waveNumber: number; goLiveDate: string }>).length > 0 ? (ctx.existingLaunches as Array<{ waveNumber: number; goLiveDate: string }>).map((l) => `Wave ${l.waveNumber} on ${l.goLiveDate}`).join(", ") : "None"}

Historical acknowledgement data:
- Overall org ack rate: ${ctx.overallAckRate}%
- Average days to acknowledge: ${ctx.avgAckDays !== null ? ctx.avgAckDays + " days" : "unknown"}

Rules:
- Each suggestion must be a 5-business-day window (startDate to endDate Monday-to-Friday span)
- Rank 1 = best window (fewest conflicts, highest predicted ack rate)
- Spread suggestions across different weeks (no two suggestions in the same week)
- historicalAckRate must be between 60-95 (realistic, informed by overall org rate of ${ctx.overallAckRate}%)
- reason must be 1 sentence, specific (e.g., "Avoids March payroll week · Historically ${ctx.overallAckRate}% ack rate")
- Return exactly 3 suggestions`;

    auditPrompt("suggestLaunchWindows", prompt);

    const completion = await withTimeout(
      openai.chat.completions.create({
        model: "gpt-5-mini",
        max_completion_tokens: 600,
        messages: [{ role: "user", content: prompt }],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "sop_wave_suggestions",
            strict: true,
            schema: SUGGEST_WINDOWS_SCHEMA,
          },
        },
      }),
      AI_TIMEOUT_MS,
    );

    const totalTokens = completion.usage?.total_tokens ?? 0;
    logCost("suggestLaunchWindows", "gpt-5-mini", totalTokens);

    const content = completion.choices?.[0]?.message?.content;
    if (!content) return { available: false };

    const parsed = JSON.parse(content);
    const suggestions: LaunchWindowSuggestion[] = (parsed.suggestions ?? [])
      .slice(0, 3)
      .map((s: any, i: number) => ({
        startDate: String(s.startDate ?? ""),
        endDate: String(s.endDate ?? ""),
        reason: redactFreeTextForAI(String(s.reason ?? "")),
        historicalAckRate: Math.min(100, Math.max(0, Number(s.historicalAckRate) || overallAckRate)),
        rank: Number(s.rank ?? i + 1),
      }));

    return { available: true, suggestions };
  } catch (err) {
    console.error("[sopWaveAI] suggestLaunchWindows error:", err);
    return { available: false };
  }
}

export async function predictAckRate(
  waveNumber: number,
  goLiveDate: string,
  graceDays: number,
): Promise<AckPredictionResponse> {
  try {
    const windowEnd = new Date(goLiveDate);
    windowEnd.setDate(windowEnd.getDate() + graceDays);
    const windowEndStr = windowEnd.toISOString().slice(0, 10);

    const [ackStats, onLeaveCount, affectedCount] = await Promise.all([
      getHistoricalAckStats(),
      getEmployeesOnLeaveInWindow(goLiveDate, windowEndStr),
      getWaveAffectedEmployeeCount(waveNumber),
    ]);

    const overallAckRate =
      ackStats.totalProgress > 0
        ? Math.round((ackStats.totalAcknowledged / ackStats.totalProgress) * 100)
        : 75;

    // Sanitize context through privacy guard before building prompt
    const ctx = sanitizeContext({
      waveNumber,
      goLiveDate,
      windowEndStr,
      graceDays,
      affectedCount,
      onLeaveCount,
      overallAckRate,
      avgAckDays: ackStats.avgAckDays !== null ? Math.round(ackStats.avgAckDays) : null,
      historicalRecordCount: ackStats.totalProgress,
    });

    const prompt = `Predict the SOP acknowledgement rate for Wave ${ctx.waveNumber}.

Inputs:
- Go-live date: ${ctx.goLiveDate}
- Grace period: ${ctx.graceDays} days (acknowledgement window ends ${ctx.windowEndStr})
- Affected employees: ${ctx.affectedCount}
- Employees on approved leave during this window: ${ctx.onLeaveCount}
- Historical org-wide ack rate: ${ctx.overallAckRate}%
- Average days to acknowledge historically: ${ctx.avgAckDays !== null ? ctx.avgAckDays + " days" : "unknown"}

Provide:
1. predictedAckRate: integer 0-100 (percentage of affected employees expected to acknowledge within the grace window)
2. confidence: "high" if >20 historical records, "medium" if 5-20, "low" if <5 (we have ${ctx.historicalRecordCount} historical records)
3. rationale: 1 sentence explaining the key factors driving this prediction`;

    auditPrompt("predictAckRate", prompt);

    const completion = await withTimeout(
      openai.chat.completions.create({
        model: "gpt-5-mini",
        max_completion_tokens: 200,
        messages: [{ role: "user", content: prompt }],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "sop_ack_prediction",
            strict: true,
            schema: PREDICT_ACK_SCHEMA,
          },
        },
      }),
      AI_TIMEOUT_MS,
    );

    const totalTokens = completion.usage?.total_tokens ?? 0;
    logCost("predictAckRate", "gpt-5-mini", totalTokens);

    const content = completion.choices?.[0]?.message?.content;
    if (!content) return { available: false };

    const parsed = JSON.parse(content);
    const prediction: AckPrediction = {
      predictedAckRate: Math.min(100, Math.max(0, Math.round(Number(parsed.predictedAckRate) || overallAckRate))),
      confidence: (["high", "medium", "low"].includes(parsed.confidence) ? parsed.confidence : "low") as AckPrediction["confidence"],
      rationale: redactFreeTextForAI(String(parsed.rationale ?? "")),
    };

    return { available: true, prediction };
  } catch (err) {
    console.error("[sopWaveAI] predictAckRate error:", err);
    return { available: false };
  }
}

export async function generateImpactNarrative(
  waveNumber: number,
  scheduledLaunchId: string,
): Promise<ImpactNarrativeResponse> {
  try {
    const [launchRows] = await Promise.all([
      db
        .select()
        .from(waveScheduledLaunches)
        .where(eq(waveScheduledLaunches.id, scheduledLaunchId))
        .limit(1),
    ]);

    const launch = launchRows[0];
    if (!launch) return { available: false };

    const [waveRows, memberships, ackStats] = await Promise.all([
      db.select().from(rolloutWaves).where(eq(rolloutWaves.waveNumber, waveNumber)).limit(1),
      db.select().from(waveSops).where(eq(waveSops.waveNumber, waveNumber)),
      getHistoricalAckStats(),
    ]);

    const wave = waveRows[0];
    const sopCodes = memberships.map((m) => m.sopMasterId);
    const operationalCount = memberships.filter((m) => m.operationalAt).length;

    let sopTitles: string[] = [];
    if (sopCodes.length > 0) {
      const docs = await db
        .select({ title: sopDocuments.title, category: sopDocuments.category })
        .from(sopDocuments)
        .where(and(eq(sopDocuments.isCurrent, true), inArray(sopDocuments.sopMasterId, sopCodes)));
      sopTitles = docs.map((d) => d.category ?? "").filter(Boolean).slice(0, 5);
    }

    const affectedCount = await getWaveAffectedEmployeeCount(waveNumber);

    const windowEnd = new Date(launch.goLiveDate);
    windowEnd.setDate(windowEnd.getDate() + (launch.graceDays ?? 14));
    const windowEndStr = windowEnd.toISOString().slice(0, 10);

    const onLeaveCount = await getEmployeesOnLeaveInWindow(launch.goLiveDate, windowEndStr);

    const overallAckRate =
      ackStats.totalProgress > 0
        ? Math.round((ackStats.totalAcknowledged / ackStats.totalProgress) * 100)
        : 75;

    // Sanitize context through privacy guard before building prompt
    const ctx = sanitizeContext({
      waveNumber,
      waveName: wave?.name ?? "Unknown Wave",
      enforcement: wave?.enforcement ?? "soft",
      goLiveDate: launch.goLiveDate,
      graceDays: launch.graceDays ?? 14,
      windowEndStr,
      sopCount: sopCodes.length,
      operationalCount,
      sopCategories: sopTitles,
      affectedCount,
      onLeaveCount,
      overallAckRate,
    });

    const enforcementDesc = ctx.enforcement === "full"
      ? "compliance lock fires for overdue employees"
      : ctx.enforcement === "measured"
      ? "audit visibility only"
      : "coaching banner only";

    const prompt = `You are writing a Wave Impact Summary for an HR admin approving an SOP wave rollout. Write a professional, plain-English 3-4 sentence summary an admin can read in 30 seconds.

Wave details:
- Wave ${ctx.waveNumber}: ${ctx.waveName}
- Enforcement: ${ctx.enforcement} (${enforcementDesc})
- Go-live date: ${ctx.goLiveDate}
- Grace period: ${ctx.graceDays} days (window closes ${ctx.windowEndStr})
- SOPs in wave: ${ctx.sopCount} (${ctx.operationalCount} already operational)
- SOP categories: ${(ctx.sopCategories as string[]).length > 0 ? (ctx.sopCategories as string[]).join(", ") : "Mixed"}
- Affected employees: ${ctx.affectedCount}
- Employees on approved leave during window: ${ctx.onLeaveCount}
- Historical org ack rate: ${ctx.overallAckRate}%

Provide:
1. narrative: 3-4 sentence paragraph describing who's affected, predicted completion likelihood, any red flags, and what admins should check. Do NOT include names, emails, or any PII.
2. riskRating: "LOW", "MEDIUM", or "HIGH" based on: enforcement level, leave impact, historical ack rate, and how many SOPs are not yet operational
3. affectedCount: integer (${ctx.affectedCount})
4. predictedCompletionRate: integer 0-100 based on historical data and window
5. redFlags: array of 0-3 specific concerns (e.g., "18% of employees on leave during window", "3 SOPs not yet operational")`;

    auditPrompt("generateImpactNarrative", prompt);

    const completion = await withTimeout(
      openai.chat.completions.create({
        model: "gpt-5.4",
        max_completion_tokens: 500,
        messages: [{ role: "user", content: prompt }],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "sop_impact_narrative",
            strict: true,
            schema: IMPACT_NARRATIVE_SCHEMA,
          },
        },
      }),
      AI_TIMEOUT_MS,
    );

    const totalTokens = completion.usage?.total_tokens ?? 0;
    logCost("generateImpactNarrative", "gpt-5.4", totalTokens);

    const content = completion.choices?.[0]?.message?.content;
    if (!content) return { available: false };

    const parsed = JSON.parse(content);
    const impact: ImpactNarrative = {
      narrative: redactFreeTextForAI(String(parsed.narrative ?? "")),
      riskRating: (["LOW", "MEDIUM", "HIGH"].includes(parsed.riskRating) ? parsed.riskRating : "MEDIUM") as ImpactNarrative["riskRating"],
      affectedCount: Math.max(0, Number(parsed.affectedCount) || affectedCount),
      predictedCompletionRate: Math.min(100, Math.max(0, Number(parsed.predictedCompletionRate) || overallAckRate)),
      redFlags: (Array.isArray(parsed.redFlags) ? parsed.redFlags : [])
        .slice(0, 3)
        .map((f: any) => redactFreeTextForAI(String(f))),
    };

    return { available: true, impact };
  } catch (err) {
    console.error("[sopWaveAI] generateImpactNarrative error:", err);
    return { available: false };
  }
}
