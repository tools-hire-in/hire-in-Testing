// Commercial Intelligence Service — thin bridge between BD Agent and Content Studio.
// Provides read-only lookups that both agents can call.
// No claim registry, no ICP database — scoped to the MVP bridge.

import { db } from "../db";
import { sql as drizzleSql } from "drizzle-orm";
import { normalizeDomain, domainToStudioResolved, type CanonicalDomain, type PublishedContentAsset } from "@shared/agentIntelligenceContracts";

// 5-minute in-memory cache — prevents a DB hit on every BD message
interface CacheEntry {
  assets: PublishedContentAsset[];
  expiresAt: number;
}

const _cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function cacheKey(domain: CanonicalDomain): string {
  return `published:${domain}`;
}

function fromCache(domain: CanonicalDomain): PublishedContentAsset[] | null {
  const entry = _cache.get(cacheKey(domain));
  if (!entry || Date.now() > entry.expiresAt) return null;
  return entry.assets;
}

function toCache(domain: CanonicalDomain, assets: PublishedContentAsset[]): void {
  _cache.set(cacheKey(domain), { assets, expiresAt: Date.now() + CACHE_TTL_MS });
}

// Returns recently published articles that match the given domain.
// Used by the BD Agent to surface relevant published content as talking points.
export async function getRelatedPublishedContent(
  rawDomain: string | null | undefined,
  limit = 5,
): Promise<PublishedContentAsset[]> {
  const domain = normalizeDomain(rawDomain);
  const cached = fromCache(domain);
  if (cached) return cached.slice(0, limit);

  try {
    const resolvedValues = domainToStudioResolved(domain);

    // Build the WHERE clause for domain_resolved — includes general staffing as fallback
    // and null domain_resolved rows (no domain restriction).
    const placeholders = resolvedValues.map((_, i) => `$${i + 1}`).join(", ");

    const result = await db.execute(drizzleSql`
      SELECT
        id,
        title,
        slug,
        excerpt,
        domain_resolved,
        published_at,
        tags
      FROM studio_articles
      WHERE status IN ('approved', 'published')
        AND (
          domain_resolved IS NULL
          OR domain_resolved IN (${drizzleSql.raw(resolvedValues.map(v => `'${v}'`).join(", "))})
        )
      ORDER BY published_at DESC NULLS LAST
      LIMIT 20
    `);

    const assets: PublishedContentAsset[] = (result.rows as any[]).map((row) => ({
      id: String(row.id),
      title: String(row.title),
      slug: row.slug ? String(row.slug) : null,
      excerpt: row.excerpt ? String(row.excerpt) : null,
      domainResolved: row.domain_resolved ? String(row.domain_resolved) : null,
      publishedAt: row.published_at ? String(row.published_at) : null,
      tags: Array.isArray(row.tags) ? row.tags.map(String) : null,
    }));

    toCache(domain, assets);
    return assets.slice(0, limit);
  } catch (err) {
    console.error("[commercial-intelligence] getRelatedPublishedContent error:", err);
    return [];
  }
}

// Builds a compact "RELATED PUBLISHED CONTENT" text block for injection into
// the BD Agent system prompt. Returns empty string when no content is available.
export async function buildRelatedContentBlock(rawDomain: string | null | undefined): Promise<string> {
  const assets = await getRelatedPublishedContent(rawDomain, 5);
  if (assets.length === 0) return "";

  const lines = assets.map((a, i) => {
    const excerptLine = a.excerpt ? `  "${a.excerpt.slice(0, 100).trim()}…"` : "";
    const slugLine = a.slug ? `  URL: /insights/${a.slug}` : "";
    return [
      `${i + 1}. ${a.title}`,
      excerptLine,
      slugLine,
    ].filter(Boolean).join("\n");
  });

  return `── RELATED PUBLISHED CONTENT (approved for external reference) ──
The following articles are published on the Hire'in Insights page and can be referenced as proof points or conversation starters with prospects in this domain.
When an article's topic directly matches the buyer's pain point, mention it naturally — do NOT paste the URL unless the user specifically asks to share it.

${lines.join("\n\n")}`;
}

// Invalidates the cache for a given domain when a new article is published.
// Call this from the article status-change route.
export function invalidatePublishedContentCache(rawDomain?: string | null): void {
  if (rawDomain) {
    _cache.delete(cacheKey(normalizeDomain(rawDomain)));
  } else {
    _cache.clear();
  }
}
