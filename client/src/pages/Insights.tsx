import { useState, useEffect } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useLocation, useSearch, Link } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { SchemaHead, ORGANIZATION_SCHEMA } from "@/components/SchemaHead";
import { useSEO } from "@/hooks/use-seo";
import { Skeleton } from "@/components/ui/skeleton";
import { NewsletterSubscribe } from "@/components/insights/NewsletterSubscribe";
import { INSIGHT_CATEGORIES, insightCategoryLabel } from "@shared/insights";
import { formatInsightDate, type InsightListResponse, type PublicInsight } from "@/lib/insights";
import { Loader2, Clock } from "lucide-react";

const BASE_URL = "https://hire-in.com";
const PAGE_SIZE = 12;
const NAVY = "#1F3A6E";
const NAVY_DARK = "#162d56";
const ORANGE = "#F47C20";

const SLOT_CONFIGS = [
  {
    badge: "🏅  Featured",
    label: "EDITOR'S PICK",
    badgeBg: "rgba(255,255,255,0.15)",
    gradient: "linear-gradient(140deg,#243f7a 0%,#2e549e 55%,#3d68b8 100%)",
  },
  {
    badge: "🔥  Trending",
    label: "MOST READ",
    badgeBg: "rgba(244,124,32,0.28)",
    gradient: "linear-gradient(135deg,#2e54a0 0%,#3d6abf 55%,#4d7ad0 100%)",
  },
  {
    badge: "⭐  Latest",
    label: "JUST PUBLISHED",
    badgeBg: "rgba(255,255,255,0.13)",
    gradient: "linear-gradient(135deg,#243f7a 0%,#2e549e 45%,#7a4212 80%,#b06428 100%)",
  },
];

const TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "Executive Insight": { bg: "#1F3A6E14", text: "#1F3A6E", border: "#1F3A6E30" },
  "Analysis": { bg: "#0891b214", text: "#0e7490", border: "#0891b230" },
  "Field Report": { bg: "#16a34a14", text: "#15803d", border: "#16a34a30" },
  "Case Study": { bg: "#7c3aed14", text: "#6d28d9", border: "#7c3aed30" },
  "Market Brief": { bg: "#6b728014", text: "#4b5563", border: "#6b728030" },
  "Opinion": { bg: "#ec489914", text: "#db2777", border: "#ec489930" },
};

function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

function getAuthorColor(name: string): string {
  const colors = [NAVY, "#4B7BEC", "#059669", "#7C3AED", "#DC2626", "#D97706"];
  const idx = name.charCodeAt(0) % colors.length;
  return colors[idx];
}

function ArticleTypeBadge({ type }: { type: string | null }) {
  const label = type ?? "Insight";
  const c = TYPE_COLORS[label] ?? TYPE_COLORS["Market Brief"];
  return (
    <span
      style={{
        background: c.bg,
        color: c.text,
        border: `1px solid ${c.border}`,
        fontFamily: "'Inter', sans-serif",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.05em",
        padding: "2px 8px",
        borderRadius: 4,
        textTransform: "uppercase" as const,
        whiteSpace: "nowrap" as const,
      }}
    >
      {label}
    </span>
  );
}

/* ─── Featured Carousel ─────────────────────────────────────────────────── */
function FeaturedCarousel({ articles }: { articles: PublicInsight[] }) {
  const [active, setActive] = useState(0);
  const cards = articles.slice(0, 3);

  useEffect(() => { setActive(0); }, [articles]);

  if (cards.length === 0) return null;

  const slot = SLOT_CONFIGS[active % SLOT_CONFIGS.length];
  const art = cards[active];
  const authorName = art.author?.name ?? "Hire'in Solutions";
  const authorRole = art.author?.title ?? "Editorial Team";
  const initials = getInitials(authorName);
  const date = formatInsightDate(art.publishedAt);

  return (
    <div className="mb-10">
      <Link href={`/insights/${art.slug}`}>
        <div
          className="relative rounded-2xl overflow-hidden cursor-pointer transition-all hover:shadow-2xl"
          style={{ minHeight: 300, background: slot.gradient }}
        >
          {/* Dot texture */}
          <div
            className="absolute inset-0 opacity-[0.08]"
            style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "26px 26px" }}
          />
          {/* Bottom fade */}
          <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.38) 0%, transparent 50%)" }} />

          <div className="relative flex flex-col justify-between p-10 h-full" style={{ minHeight: 300 }}>
            {/* Badge + label */}
            <div className="flex flex-col gap-2">
              <span
                style={{
                  fontFamily: "'Inter', sans-serif",
                  background: slot.badgeBg,
                  backdropFilter: "blur(6px)",
                  color: "white",
                  border: "1px solid rgba(255,255,255,0.22)",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  padding: "4px 12px",
                  borderRadius: 20,
                  alignSelf: "flex-start",
                }}
              >
                {slot.badge}
              </span>
              <span style={{ fontFamily: "'Inter', sans-serif", color: "rgba(255,255,255,0.4)", letterSpacing: "0.12em", fontSize: 9, fontWeight: 700, textTransform: "uppercase" }}>
                {slot.label}
              </span>
            </div>

            {/* Title */}
            <div className="py-8 max-w-3xl">
              <h2
                style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "white", lineHeight: 1.25, fontWeight: 700, fontSize: 30 }}
                className="line-clamp-3"
              >
                {art.title}
              </h2>
              {art.excerpt && (
                <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(255,255,255,0.65)", fontSize: 14, marginTop: 10, lineHeight: 1.5 }} className="line-clamp-2">
                  {art.excerpt}
                </p>
              )}
            </div>

            {/* Bottom row: author · meta | dots + CTA */}
            <div
              className="grid items-center"
              style={{ borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: 16, gridTemplateColumns: "1fr auto" }}
            >
              {/* Author + meta */}
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(255,255,255,0.18)", border: "2px solid rgba(255,255,255,0.3)" }}
                >
                  <span style={{ fontFamily: "'Inter', sans-serif", color: "white", fontSize: 10, fontWeight: 700 }}>{initials}</span>
                </div>
                <div>
                  <p style={{ fontFamily: "'Inter', sans-serif", color: "white", fontSize: 13, fontWeight: 600, lineHeight: 1.2 }}>{authorName}</p>
                  <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(255,255,255,0.5)", fontSize: 11, lineHeight: 1.2 }}>{authorRole}</p>
                </div>
                <div style={{ width: 1, height: 26, background: "rgba(255,255,255,0.18)", margin: "0 4px" }} />
                <span style={{ fontFamily: "'Inter', sans-serif", color: "rgba(255,255,255,0.55)", fontSize: 12 }}>
                  {[date, art.readTimeMinutes ? `${art.readTimeMinutes} min read` : null].filter(Boolean).join(" · ")}
                </span>
              </div>
              {/* CTA */}
              <button
                style={{ background: ORANGE, fontFamily: "'Inter', sans-serif", flexShrink: 0 }}
                className="px-5 py-2 rounded-full text-white text-sm font-bold hover:brightness-110 transition-all"
                onClick={(e) => e.stopPropagation()}
              >
                Read article →
              </button>
            </div>

            {/* Dots pinned to bottom center */}
            {cards.length > 1 && (
              <div
                style={{ position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 7 }}
              >
                {cards.map((_, i) => (
                  <button
                    key={i}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActive(i); }}
                    style={{
                      width: i === active ? 22 : 7,
                      height: 7,
                      borderRadius: 4,
                      background: i === active ? "white" : "rgba(255,255,255,0.4)",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                      transition: "all 0.25s",
                    }}
                    data-testid={`dot-carousel-${i}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}

/* ─── Article row ────────────────────────────────────────────────────────── */
function ArticleRow({ article, rank }: { article: PublicInsight; rank: number }) {
  const authorName = article.author?.name ?? "Hire'in Solutions";
  const date = formatInsightDate(article.publishedAt);
  const initials = getInitials(authorName);
  const authorColor = getAuthorColor(authorName);

  return (
    <Link href={`/insights/${article.slug}`} data-testid={`link-insight-${article.slug}`}>
      <div
        className="grid items-start gap-4 px-4 py-4 rounded-xl border border-transparent hover:border-gray-100 hover:bg-gray-50/70 transition-all cursor-pointer group"
        style={{ gridTemplateColumns: "32px 1fr 160px 130px 80px" }}
      >
        {/* Rank */}
        <span
          style={{ fontFamily: "'Inter', sans-serif", color: rank <= 2 ? ORANGE : "#d1d5db", fontSize: 13, fontWeight: 700 }}
          className="tabular-nums pt-0.5"
          data-testid={`text-rank-${article.slug}`}
        >
          {String(rank).padStart(2, "0")}
        </span>

        {/* Title + excerpt */}
        <div className="min-w-0">
          <h3
            style={{ color: NAVY, fontFamily: "'Playfair Display', Georgia, serif", lineHeight: 1.25, fontSize: 14, fontWeight: 700 }}
            className="group-hover:text-blue-700 transition-colors line-clamp-2 mb-1"
            data-testid={`text-insight-title-${article.slug}`}
          >
            {article.title}
          </h3>
          {article.excerpt && (
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 11 }} className="text-gray-400 line-clamp-1 leading-snug">
              {article.excerpt}
            </p>
          )}
        </div>

        {/* Author */}
        <div className="flex items-start gap-2 min-w-0" data-testid={`text-insight-author-${article.slug}`}>
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ background: authorColor }}
          >
            <span style={{ fontFamily: "'Inter', sans-serif", color: "white", fontSize: 9, fontWeight: 700 }}>{initials}</span>
          </div>
          <div className="min-w-0">
            <p style={{ color: NAVY, fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 600, lineHeight: 1.3 }} className="break-words">
              {authorName}
            </p>
            {date && (
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 10 }} className="text-gray-400 leading-tight mt-0.5">
                {date}
              </p>
            )}
          </div>
        </div>

        {/* Type */}
        <div className="pt-0.5">
          <ArticleTypeBadge type={article.contentType} />
          {article.category && (
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 9 }} className="text-gray-400 mt-1 uppercase tracking-wide">
              {insightCategoryLabel(article.category)}
            </p>
          )}
        </div>

        {/* Read time */}
        <div className="flex items-center gap-1 pt-0.5" style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: "#6b7280" }}>
          <Clock className="w-3 h-3 flex-shrink-0" />
          {article.readTimeMinutes ? `${article.readTimeMinutes} min` : "—"}
        </div>
      </div>
    </Link>
  );
}

/* ─── List header ────────────────────────────────────────────────────────── */
function ListHeader() {
  return (
    <div
      className="grid items-center gap-4 px-4 py-2 mb-1 rounded-lg"
      style={{ gridTemplateColumns: "32px 1fr 160px 130px 80px", background: "#f9fafb" }}
    >
      {["#", "Article", "Author", "Type", "Read"].map((h) => (
        <span key={h} style={{ fontFamily: "'Inter', sans-serif", color: "#9ca3af", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>
          {h}
        </span>
      ))}
    </div>
  );
}

/* ─── Sidebar ────────────────────────────────────────────────────────────── */
function InsightsSidebar({ articles, onCategory }: { articles: PublicInsight[]; onCategory: (c: string) => void }) {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  // Derive trending tags from articles
  const tagCounts: Record<string, number> = {};
  for (const a of articles) {
    for (const t of a.tags ?? []) {
      tagCounts[t] = (tagCounts[t] ?? 0) + 1;
    }
  }
  const trendingTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([t]) => t);

  // Derive top authors
  const authorMap: Record<string, { name: string; title: string | null; count: number }> = {};
  for (const a of articles) {
    if (a.author?.name) {
      const key = a.author.name;
      if (!authorMap[key]) authorMap[key] = { name: key, title: a.author.title, count: 0 };
      authorMap[key].count++;
    }
  }
  const topAuthors = Object.values(authorMap).sort((a, b) => b.count - a.count).slice(0, 3);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) setSubscribed(true);
  };

  return (
    <aside className="w-64 flex-shrink-0 space-y-7 pl-8 border-l border-gray-100">
      {/* Trending topics */}
      {trendingTags.length > 0 && (
        <div>
          <p style={{ color: NAVY, fontFamily: "'Inter', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }} className="mb-3 flex items-center gap-2">
            <span style={{ background: ORANGE, width: 12, height: 2, borderRadius: 2, display: "inline-block", flexShrink: 0 }} />
            Trending Topics
          </p>
          <div className="flex flex-wrap gap-1.5">
            {trendingTags.map((t) => (
              <button
                key={t}
                style={{ fontFamily: "'Inter', sans-serif", fontSize: 11 }}
                className="px-2.5 py-1 rounded-full font-medium bg-gray-50 text-gray-600 border border-gray-100 hover:border-gray-300 transition-all"
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Categories */}
      <div>
        <p style={{ color: NAVY, fontFamily: "'Inter', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }} className="mb-3 flex items-center gap-2">
          <span style={{ background: ORANGE, width: 12, height: 2, borderRadius: 2, display: "inline-block", flexShrink: 0 }} />
          Browse By Topic
        </p>
        <div className="space-y-1.5">
          {INSIGHT_CATEGORIES.map((c) => (
            <button
              key={c.value}
              onClick={() => onCategory(c.value)}
              style={{ fontFamily: "'Inter', sans-serif", color: "#6b7280", fontSize: 12, display: "flex", alignItems: "center", gap: 6, width: "100%", textAlign: "left" }}
              className="hover:text-gray-900 transition-colors group"
              data-testid={`sidebar-category-${c.value}`}
            >
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#d1d5db", flexShrink: 0, display: "inline-block" }} className="group-hover:bg-orange-400 transition-colors" />
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Top authors */}
      {topAuthors.length > 0 && (
        <div>
          <p style={{ color: NAVY, fontFamily: "'Inter', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }} className="mb-3 flex items-center gap-2">
            <span style={{ background: ORANGE, width: 12, height: 2, borderRadius: 2, display: "inline-block", flexShrink: 0 }} />
            Top Authors
          </p>
          <div className="space-y-3">
            {topAuthors.map((a) => (
              <div key={a.name} className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: getAuthorColor(a.name) }}
                >
                  <span style={{ fontFamily: "'Inter', sans-serif", color: "white", fontSize: 11, fontWeight: 700 }}>{getInitials(a.name)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p style={{ color: NAVY, fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 600 }} className="truncate">{a.name}</p>
                  {a.title && <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 10 }} className="text-gray-400 truncate">{a.title}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Newsletter */}
      <div className="rounded-xl p-5" style={{ background: `linear-gradient(135deg,${NAVY_DARK} 0%,${NAVY} 100%)` }}>
        <p style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "white", fontWeight: 700, fontSize: 15, lineHeight: 1.3, marginBottom: 4 }}>
          Get insights in your inbox
        </p>
        <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(255,255,255,0.55)", fontSize: 12, lineHeight: 1.6, marginBottom: 14 }}>
          Weekly digest of our best healthcare and talent strategy content.
        </p>
        {subscribed ? (
          <p style={{ fontFamily: "'Inter', sans-serif", color: "#86efac", fontSize: 12, fontWeight: 600 }}>✓ You're subscribed!</p>
        ) : (
          <form onSubmit={handleSubscribe}>
            <input
              type="email"
              placeholder="Your work email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-xs outline-none border-0 mb-2.5"
              style={{ fontFamily: "'Inter', sans-serif", background: "rgba(255,255,255,0.12)", color: "white" }}
              data-testid="input-sidebar-email"
            />
            <button
              type="submit"
              style={{ background: ORANGE, fontFamily: "'Inter', sans-serif", width: "100%" }}
              className="py-2 rounded-lg text-white text-xs font-bold hover:brightness-110 transition-all"
              data-testid="button-sidebar-subscribe"
            >
              Subscribe Free →
            </button>
          </form>
        )}
      </div>
    </aside>
  );
}

/* ─── Main page ──────────────────────────────────────────────────────────── */
export default function Insights() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const category = new URLSearchParams(search).get("category") ?? "";

  const setCategory = (next: string) => {
    navigate(next ? `/insights?category=${encodeURIComponent(next)}` : "/insights");
  };

  useSEO({
    title: "Insights | Hire'in Solutions",
    description:
      "Staffing market trends, hiring playbooks, and AI-in-recruitment insights from Hire'in Solutions — covering Healthcare, IT, Engineering, and Professional Services.",
    canonical: `${BASE_URL}/insights`,
  });

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery<InsightListResponse>({
      queryKey: ["/api/insights", category || "all"],
      initialPageParam: 1,
      queryFn: async ({ pageParam }) => {
        const params = new URLSearchParams();
        if (category) params.set("category", category);
        params.set("page", String(pageParam));
        params.set("pageSize", String(PAGE_SIZE));
        const res = await fetch(`/api/insights?${params.toString()}`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to load insights");
        return res.json();
      },
      getNextPageParam: (lastPage, allPages) => {
        const loaded = allPages.reduce((n, p) => n + p.items.length, 0);
        return loaded < lastPage.total ? allPages.length + 1 : undefined;
      },
    });

  const articles = data?.pages.flatMap((p) => p.items) ?? [];
  const carouselArticles = !category ? articles.slice(0, 3) : [];
  const listArticles = !category ? articles.slice(0) : articles; // show all in list; carousel is purely visual overlay

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${BASE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Insights", item: `${BASE_URL}/insights` },
    ],
  };

  return (
    <Layout>
      <SchemaHead schema={[ORGANIZATION_SCHEMA, breadcrumbSchema]} />

      <main className="bg-white min-h-screen">
        <div className="max-w-7xl mx-auto px-8 pt-10 pb-16">

          {/* Filter chips */}
          <div className="flex items-center gap-2 flex-wrap mb-8">
            <button
              onClick={() => setCategory("")}
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 12,
                fontWeight: category === "" ? 700 : 500,
                color: category === "" ? "white" : "#6b7280",
                background: category === "" ? NAVY : "white",
                border: category === "" ? `1.5px solid ${NAVY}` : "1.5px solid #e5e7eb",
                borderRadius: 20,
                padding: "5px 14px",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.15s",
              }}
              data-testid="chip-category-all"
            >
              All Insights
            </button>
            {INSIGHT_CATEGORIES.map((c) => (
              <button
                key={c.value}
                onClick={() => setCategory(c.value)}
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 12,
                  fontWeight: category === c.value ? 700 : 500,
                  color: category === c.value ? "white" : "#6b7280",
                  background: category === c.value ? NAVY : "white",
                  border: category === c.value ? `1.5px solid ${NAVY}` : "1.5px solid #e5e7eb",
                  borderRadius: 20,
                  padding: "5px 14px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s",
                }}
                data-testid={`chip-category-${c.value}`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Carousel — only when no category filter and articles loaded */}
          {!category && !isLoading && carouselArticles.length > 0 && (
            <FeaturedCarousel articles={carouselArticles} />
          )}
          {!category && isLoading && (
            <Skeleton className="w-full rounded-2xl mb-10" style={{ height: 300 }} />
          )}

          {/* "ALL ARTICLES" divider */}
          <div className="flex items-center gap-4 mb-5">
            <div style={{ background: ORANGE }} className="w-5 h-0.5 rounded-full flex-shrink-0" />
            <p style={{ color: NAVY, fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.16em", whiteSpace: "nowrap" }}>
              {category ? INSIGHT_CATEGORIES.find(c => c.value === category)?.label ?? "Articles" : "All Articles"}
            </p>
            <div className="flex-1 h-px" style={{ background: "#e5e7eb" }} />
          </div>

          {/* Main content + sidebar */}
          {isLoading ? (
            <div className="flex gap-8">
              <div className="flex-1 space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-xl" />
                ))}
              </div>
              <div className="w-64 flex-shrink-0 space-y-4 pl-8 border-l border-gray-100">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-32 w-full rounded-xl" />
                <Skeleton className="h-6 w-28" />
                <Skeleton className="h-24 w-full rounded-xl" />
              </div>
            </div>
          ) : listArticles.length === 0 ? (
            <div className="py-20 text-center" data-testid="text-empty-state">
              <h2 className="text-xl font-semibold" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: NAVY }}>No articles yet</h2>
              <p className="mt-2 text-gray-400" style={{ fontFamily: "'Inter', sans-serif" }}>
                {category ? "No articles in this category yet. Check back soon." : "We're working on fresh insights. Check back soon."}
              </p>
            </div>
          ) : (
            <div className="flex gap-0">
              {/* Article list */}
              <div className="flex-1 min-w-0 pr-8">
                <ListHeader />
                <div className="divide-y divide-gray-50">
                  {listArticles.map((a, idx) => (
                    <ArticleRow key={a.id} article={a} rank={idx + 1} />
                  ))}
                </div>

                {hasNextPage && (
                  <div className="mt-8 flex items-center justify-center">
                    <button
                      onClick={() => fetchNextPage()}
                      disabled={isFetchingNextPage}
                      style={{ color: NAVY, fontFamily: "'Inter', sans-serif", border: `1.5px solid ${NAVY}` }}
                      className="px-6 py-2.5 rounded-full text-sm font-semibold flex items-center gap-2 hover:bg-gray-50 transition-all disabled:opacity-50"
                      data-testid="button-load-more"
                    >
                      {isFetchingNextPage ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Loading…</>
                      ) : (
                        <>Load more articles <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg></>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Sidebar */}
              <InsightsSidebar articles={listArticles} onCategory={setCategory} />
            </div>
          )}

          {/* Newsletter */}
          <div className="mt-14">
            <NewsletterSubscribe />
          </div>
        </div>
      </main>
    </Layout>
  );
}
