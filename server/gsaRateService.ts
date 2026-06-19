import { db } from "./db";
import { eq, and, desc, gte } from "drizzle-orm";
import { gsaRateSnapshots } from "@shared/schema";
import { sql } from "drizzle-orm";

export interface GsaRateResult {
  zip: string;
  city: string | null;
  county: string | null;
  state: string | null;
  fiscalYear: number;
  month: number;
  lodgingRate: number;
  mieRate: number;
  firstLastDayMie: number;
  snapshotId: string;
  isCached: boolean;
  snapshotDate: Date | null;
  sourceVersion: string | null;
}

function calMonthToFiscalYear(month: number, year: number): number {
  return month >= 10 ? year + 1 : year;
}

async function fetchFromGsaApi(zip: string, fiscalYear: number, month: number): Promise<{
  city: string | null;
  county: string | null;
  state: string | null;
  lodgingRate: number;
  mieRate: number;
  firstLastDayMie: number;
  sourceVersion: string;
} | null> {
  try {
    const url = `https://api.gsa.gov/travel/perdiem/v2/rates/zip/${zip}/year/${fiscalYear}`;
    const resp = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) {
      console.warn(`[GSA API] ${resp.status} for ZIP ${zip} FY${fiscalYear}`);
      return null;
    }
    const data: any = await resp.json();
    const rates = data?.rates;
    if (!Array.isArray(rates) || rates.length === 0) return null;

    const entry = rates[0];
    const months: any[] = entry?.rate ?? [];
    const monthEntry = months.find((m: any) => parseInt(m.month, 10) === month);
    if (!monthEntry) {
      const fallback = months[0];
      if (!fallback) return null;
      const lodging = parseFloat(fallback.value ?? "0") || 0;
      const mie = parseFloat(entry.meals ?? data?.meals ?? "0") || 0;
      const firstLast = Math.round(mie * 0.75 * 100) / 100;
      return {
        city: entry.city ?? null,
        county: entry.county ?? null,
        state: entry.state ?? null,
        lodgingRate: lodging,
        mieRate: mie,
        firstLastDayMie: firstLast,
        sourceVersion: `GSA FY${fiscalYear}`,
      };
    }
    const lodging = parseFloat(monthEntry.value ?? "0") || 0;
    const mie = parseFloat(entry.meals ?? data?.meals ?? "0") || 0;
    const firstLast = Math.round(mie * 0.75 * 100) / 100;
    return {
      city: entry.city ?? null,
      county: entry.county ?? null,
      state: entry.state ?? null,
      lodgingRate: lodging,
      mieRate: mie,
      firstLastDayMie: firstLast,
      sourceVersion: `GSA FY${fiscalYear}`,
    };
  } catch (err) {
    console.warn("[GSA API] fetch error:", err);
    return null;
  }
}

export async function getGsaRate(zip: string, month: number, year: number): Promise<GsaRateResult | null> {
  const fiscalYear = calMonthToFiscalYear(month, year);

  const existing = await db
    .select()
    .from(gsaRateSnapshots)
    .where(and(eq(gsaRateSnapshots.zip, zip), eq(gsaRateSnapshots.fiscalYear, fiscalYear), eq(gsaRateSnapshots.month, month)))
    .limit(1);

  if (existing.length > 0) {
    const snap = existing[0];
    return {
      zip: snap.zip,
      city: snap.city,
      county: snap.county,
      state: snap.state,
      fiscalYear: snap.fiscalYear,
      month: snap.month,
      lodgingRate: parseFloat(snap.lodgingRate as string),
      mieRate: parseFloat(snap.mieRate as string),
      firstLastDayMie: parseFloat(snap.firstLastDayMie as string),
      snapshotId: snap.id,
      isCached: true,
      snapshotDate: snap.snapshotDate,
      sourceVersion: snap.sourceVersion,
    };
  }

  const apiResult = await fetchFromGsaApi(zip, fiscalYear, month);
  if (!apiResult) {
    const fallback = await db
      .select()
      .from(gsaRateSnapshots)
      .where(eq(gsaRateSnapshots.zip, zip))
      .orderBy(desc(gsaRateSnapshots.snapshotDate))
      .limit(1);
    if (fallback.length > 0) {
      const snap = fallback[0];
      return {
        zip: snap.zip,
        city: snap.city,
        county: snap.county,
        state: snap.state,
        fiscalYear: snap.fiscalYear,
        month: snap.month,
        lodgingRate: parseFloat(snap.lodgingRate as string),
        mieRate: parseFloat(snap.mieRate as string),
        firstLastDayMie: parseFloat(snap.firstLastDayMie as string),
        snapshotId: snap.id,
        isCached: true,
        snapshotDate: snap.snapshotDate,
        sourceVersion: snap.sourceVersion,
      };
    }
    return null;
  }

  try {
    const inserted = await db
      .insert(gsaRateSnapshots)
      .values({
        zip,
        city: apiResult.city,
        county: apiResult.county,
        state: apiResult.state,
        fiscalYear,
        month,
        lodgingRate: String(apiResult.lodgingRate),
        mieRate: String(apiResult.mieRate),
        firstLastDayMie: String(apiResult.firstLastDayMie),
        sourceVersion: apiResult.sourceVersion,
        isCached: false,
      })
      .onConflictDoUpdate({
        target: [gsaRateSnapshots.zip, gsaRateSnapshots.fiscalYear, gsaRateSnapshots.month],
        set: {
          lodgingRate: String(apiResult.lodgingRate),
          mieRate: String(apiResult.mieRate),
          firstLastDayMie: String(apiResult.firstLastDayMie),
          sourceVersion: apiResult.sourceVersion,
          city: apiResult.city,
          county: apiResult.county,
          state: apiResult.state,
          isCached: false,
          snapshotDate: new Date(),
        },
      })
      .returning();

    const snap = inserted[0];
    return {
      zip: snap.zip,
      city: snap.city,
      county: snap.county,
      state: snap.state,
      fiscalYear: snap.fiscalYear,
      month: snap.month,
      lodgingRate: parseFloat(snap.lodgingRate as string),
      mieRate: parseFloat(snap.mieRate as string),
      firstLastDayMie: parseFloat(snap.firstLastDayMie as string),
      snapshotId: snap.id,
      isCached: false,
      snapshotDate: snap.snapshotDate,
      sourceVersion: snap.sourceVersion,
    };
  } catch (err) {
    console.error("[GSA] insert snapshot failed:", err);
    return null;
  }
}

export async function refreshRecentZips(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const recent = await db
      .select({ zip: gsaRateSnapshots.zip, fiscalYear: gsaRateSnapshots.fiscalYear, month: gsaRateSnapshots.month })
      .from(gsaRateSnapshots)
      .where(gte(gsaRateSnapshots.snapshotDate, cutoff));

    const unique = new Map<string, { zip: string; fiscalYear: number; month: number }>();
    for (const r of recent) {
      const key = `${r.zip}:${r.fiscalYear}:${r.month}`;
      if (!unique.has(key)) unique.set(key, r);
    }

    for (const entry of unique.values()) {
      await getGsaRate(entry.zip, entry.month, entry.month >= 10 ? (entry.fiscalYear - 1) : entry.fiscalYear);
    }
    console.log(`[GSA] Refreshed ${unique.size} zip+month combos`);
  } catch (err) {
    console.error("[GSA] Nightly refresh failed:", err);
  }
}
