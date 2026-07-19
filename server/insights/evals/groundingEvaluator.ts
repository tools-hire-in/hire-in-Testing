import type { EvalContext } from "./evalTypes";
import type { EvalOutcome } from "./deterministicEvaluators";

export interface SourceEntry {
  id: string;
  content: string;
  publishedDate?: string;
  sourceType: "primary" | "secondary" | "tertiary" | "unknown";
}

export interface SourcePack {
  sources: SourceEntry[];
  retrievedAt: string;
}

export interface ClaimEntry {
  text: string;
  claimedSourceIds: string[];
  epistemicType: string;
  isHighRisk: boolean;
}

export interface GroundingCheckResult {
  claimText: string;
  claimedSourceIds: string[];
  pass: boolean;
  reason: string;
  conflictDetected: boolean;
  staleSourceDetected: boolean;
  injectionDetected: boolean;
}

export interface GroundingEvalOutcome {
  pass: boolean;
  results: GroundingCheckResult[];
  summary: {
    totalClaims: number;
    groundedClaims: number;
    conflictsDetected: number;
    staleSourcesDetected: number;
    injectionsDetected: number;
  };
}

const STALE_YEAR_THRESHOLD = 3;
const SOURCE_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|rules?|guidelines?)/i,
  /you\s+are\s+now\s+(?:a|an|acting\s+as)/i,
  /disregard\s+(your|all|previous)\s+(instructions?|rules?|training|guidelines?)/i,
  /\[SYSTEM\]|\[OVERRIDE\]|\[ADMIN\]/i,
  /print\s+your\s+(system\s+prompt|instructions)/i,
  /approve\s+this\s+article|set\s+status\s+to\s+(approved|published)/i,
];

function currentYear(): number {
  return new Date().getFullYear();
}

function detectInjectionInSource(source: SourceEntry): boolean {
  const text = source.content;
  return SOURCE_INJECTION_PATTERNS.some((p) => p.test(text));
}

function isSourceStale(source: SourceEntry): boolean {
  if (!source.publishedDate) return false;
  const yearMatch = source.publishedDate.match(/\b(20\d{2})\b/);
  if (!yearMatch) return false;
  const year = parseInt(yearMatch[1], 10);
  return currentYear() - year > STALE_YEAR_THRESHOLD;
}

function detectConflict(claim: ClaimEntry, sources: SourceEntry[]): boolean {
  const claimedSources = sources.filter((s) => claim.claimedSourceIds.includes(s.id));
  if (claimedSources.length < 2) return false;

  const contradictionKeywords = [
    "however",
    "contrary to",
    "contradicts",
    "disagrees",
    "disputes",
    "on the other hand",
    "in contrast",
    "conversely",
  ];

  let supportsCount = 0;
  let contradictCount = 0;

  for (const source of claimedSources) {
    const lower = source.content.toLowerCase();
    const hasContradiction = contradictionKeywords.some((kw) => lower.includes(kw));
    if (hasContradiction) {
      contradictCount++;
    } else {
      supportsCount++;
    }
  }

  return supportsCount > 0 && contradictCount > 0;
}

export function evaluateGrounding(
  claims: ClaimEntry[],
  sourcePack: SourcePack,
): GroundingEvalOutcome {
  const results: GroundingCheckResult[] = [];
  let conflictsDetected = 0;
  let staleSourcesDetected = 0;
  let injectionsDetected = 0;

  for (const source of sourcePack.sources) {
    if (detectInjectionInSource(source)) {
      injectionsDetected++;
    }
  }

  for (const claim of claims) {
    if (!claim.isHighRisk) {
      results.push({
        claimText: claim.text,
        claimedSourceIds: claim.claimedSourceIds,
        pass: true,
        reason: "Not a high-risk claim; grounding check skipped",
        conflictDetected: false,
        staleSourceDetected: false,
        injectionDetected: false,
      });
      continue;
    }

    const claimedSources = sourcePack.sources.filter((s) =>
      claim.claimedSourceIds.includes(s.id),
    );

    if (claimedSources.length === 0) {
      results.push({
        claimText: claim.text,
        claimedSourceIds: claim.claimedSourceIds,
        pass: false,
        reason: `High-risk claim references source IDs [${claim.claimedSourceIds.join(", ")}] but none were found in the source pack`,
        conflictDetected: false,
        staleSourceDetected: false,
        injectionDetected: false,
      });
      continue;
    }

    const conflictDetected = detectConflict(claim, sourcePack.sources);
    if (conflictDetected) conflictsDetected++;

    const staleDetected = claimedSources.some(isSourceStale);
    if (staleDetected) staleSourcesDetected++;

    const injectionDetected = claimedSources.some(detectInjectionInSource);

    const pass = !conflictDetected && !staleDetected && !injectionDetected;
    const reasons: string[] = [];
    if (conflictDetected) reasons.push("source conflict detected between claimed sources");
    if (staleDetected)
      reasons.push(`source is older than ${STALE_YEAR_THRESHOLD} years — freshness check required`);
    if (injectionDetected) reasons.push("source-embedded injection pattern detected");

    results.push({
      claimText: claim.text,
      claimedSourceIds: claim.claimedSourceIds,
      pass,
      reason: pass ? "Claim is grounded in current, non-conflicting sources" : reasons.join("; "),
      conflictDetected,
      staleSourceDetected: staleDetected,
      injectionDetected,
    });
  }

  const groundedClaims = results.filter((r) => r.pass).length;

  return {
    pass: results.every((r) => r.pass) && injectionsDetected === 0,
    results,
    summary: {
      totalClaims: claims.length,
      groundedClaims,
      conflictsDetected,
      staleSourcesDetected,
      injectionsDetected,
    },
  };
}

export function checkSourcePackForInjections(sourcePack: SourcePack): {
  pass: boolean;
  injectedSources: string[];
} {
  const injectedSources: string[] = [];
  for (const source of sourcePack.sources) {
    if (detectInjectionInSource(source)) {
      injectedSources.push(source.id);
    }
  }
  return { pass: injectedSources.length === 0, injectedSources };
}
