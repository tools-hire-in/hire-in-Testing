import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import ReactMarkdown from "react-markdown";
import { Layout } from "@/components/layout/Layout";
import { SchemaHead, ORGANIZATION_SCHEMA } from "@/components/SchemaHead";
import { useSEO } from "@/hooks/use-seo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ReactionBar } from "@/components/insights/ReactionBar";
import { ShareBar } from "@/components/insights/ShareBar";
import { NewsletterSubscribe } from "@/components/insights/NewsletterSubscribe";
import { InsightCard } from "@/components/insights/InsightCard";
import { insightCategoryLabel, ctaForCategory } from "@shared/insights";
import { formatInsightDate, type InsightDetailResponse } from "@/lib/insights";
import { getStudioContentType, getPipelineContentType } from "@shared/studioContent";
import { Clock, ArrowLeft, ArrowRight, Linkedin, CheckCircle2, Lightbulb } from "lucide-react";

const BASE_URL = "https://hire-in.com";
const NAVY = "#1F3A6E";
const NAVY_DARK = "#162d56";
const ORANGE = "#F47C20";

function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

function getAuthorColor(name: string): string {
  const colors = [NAVY, "#4B7BEC", "#059669", "#7C3AED", "#DC2626", "#D97706"];
  return colors[name.charCodeAt(0) % colors.length];
}

function getCategoryGradient(category: string | null): string {
  const map: Record<string, string> = {
    healthcare: "linear-gradient(140deg,#243f7a 0%,#2e549e 55%,#3d68b8 100%)",
    it_staffing: "linear-gradient(135deg,#2e54a0 0%,#3d6abf 55%,#4d7ad0 100%)",
    ai_in_hiring: "linear-gradient(135deg,#243f7a 0%,#2e549e 45%,#7a4212 80%,#b06428 100%)",
    staffing_market: "linear-gradient(140deg,#243f7a 0%,#2e549e 55%,#4268b8 100%)",
    employer_guide: "linear-gradient(135deg,#2e54a0 0%,#3d6abf 55%,#4d7ad0 100%)",
    recruiter_playbook: "linear-gradient(140deg,#243f7a 0%,#4a2a0a 55%,#7a4212 100%)",
    candidate_hub: "linear-gradient(135deg,#243f7a 0%,#2e549e 55%,#5c3010 100%)",
  };
  return map[category ?? ""] ?? "linear-gradient(140deg,#243f7a 0%,#2e549e 55%,#3d68b8 100%)";
}

export default function InsightArticle() {
  const params = useParams();
  const slug = params.slug as string;

  const { data, isLoading, isError } = useQuery<InsightDetailResponse>({
    queryKey: ["/api/insights", slug],
    queryFn: async () => {
      const res = await fetch(`/api/insights/${encodeURIComponent(slug)}`, { credentials: "include" });
      if (res.status === 404) throw new Error("not-found");
      if (!res.ok) throw new Error("Failed to load article");
      return res.json();
    },
    retry: false,
  });

  const article = data?.article;
  const viewedRef = useRef<string | null>(null);

  useEffect(() => {
    const id = article?.id;
    if (!id || viewedRef.current === id) return;
    viewedRef.current = id;
    fetch(`/api/insights/${encodeURIComponent(id)}/view`, {
      method: "POST",
      credentials: "include",
    }).catch(() => {});
  }, [article?.id]);

  const handleCtaClick = () => {
    const id = article?.id;
    if (!id) return;
    fetch(`/api/insights/${encodeURIComponent(id)}/cta-click`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ href: cta?.href ?? null }),
    }).catch(() => {});
  };

  useSEO({
    title: article ? `${article.seoTitle || article.title} | Hire'in Solutions` : "Insights | Hire'in Solutions",
    description: article?.seoDescription || article?.excerpt || "Insights from Hire'in Solutions on staffing, hiring, and recruitment.",
    canonical: article ? `${BASE_URL}/insights/${article.slug}` : `${BASE_URL}/insights`,
    image: article?.ogImageUrl || article?.coverImageUrl || undefined,
    type: "article",
    publishedTime: article?.publishedAt || undefined,
    modifiedTime: article?.updatedAt || article?.publishedAt || undefined,
    author: article?.author?.name || undefined,
  });

  if (isLoading) {
    return (
      <Layout>
        {/* Gradient hero skeleton */}
        <Skeleton className="w-full rounded-none" style={{ height: 340 }} />
        <div className="container mx-auto max-w-3xl px-4 py-12 lg:px-6">
          <Skeleton className="mb-3 h-10 w-full" />
          <Skeleton className="mb-8 h-10 w-2/3" />
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  if (isError || !article) {
    return (
      <Layout>
        <div className="container mx-auto max-w-2xl px-4 py-24 text-center lg:px-6">
          <h1 className="text-3xl font-bold" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: NAVY }} data-testid="text-not-found">
            Article not found
          </h1>
          <p className="mt-3 text-gray-500">This article may have been moved or is no longer available.</p>
          <Link href="/insights">
            <Button className="mt-6" data-testid="button-back-insights">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Insights
            </Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const categoryLabel = insightCategoryLabel(article.category);
  const contentTypeLabel = (() => {
    const t = article.contentType;
    if (!t) return "Insight";
    const exact = getStudioContentType(t)?.label ?? getPipelineContentType(t)?.label;
    if (exact) return exact;
    const lower = t.toLowerCase();
    const fromLower = getStudioContentType(lower)?.label ?? getPipelineContentType(lower)?.label;
    if (fromLower) return fromLower;
    return lower.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  })();
  const date = formatInsightDate(article.publishedAt);
  const cta = ctaForCategory(article.category);
  const related = data?.related ?? [];
  const gradient = getCategoryGradient(article.category);
  const authorName = article.author?.name ?? "Hire'in Solutions";
  const authorRole = article.author?.title ?? "Editorial Team";
  const initials = getInitials(authorName);
  const authorColor = getAuthorColor(authorName);

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.seoDescription || article.excerpt || "",
    image: article.ogImageUrl || article.coverImageUrl || `${BASE_URL}/og-image.svg`,
    datePublished: article.publishedAt || undefined,
    dateModified: article.updatedAt || article.publishedAt || undefined,
    author: article.author
      ? { "@type": "Person", name: article.author.name }
      : { "@type": "Organization", name: "Hire'in Solutions" },
    publisher: {
      "@type": "Organization",
      name: "Hire'in Solutions",
      logo: { "@type": "ImageObject", url: `${BASE_URL}/logo.jpg` },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": `${BASE_URL}/insights/${article.slug}` },
    articleSection: categoryLabel,
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${BASE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Insights", item: `${BASE_URL}/insights` },
      { "@type": "ListItem", position: 3, name: article.title, item: `${BASE_URL}/insights/${article.slug}` },
    ],
  };

  return (
    <Layout>
      <SchemaHead schema={[ORGANIZATION_SCHEMA, articleSchema, breadcrumbSchema]} />

      {/* ── Gradient hero card ─────────────────────────────────────────────── */}
      <div className="relative overflow-hidden" style={{ background: gradient }}>
        {/* Dot texture */}
        <div
          className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "26px 26px" }}
        />
        {/* Bottom fade */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.35) 0%, transparent 55%)" }} />

        <div className="relative z-10 max-w-4xl mx-auto px-8 py-12">
          {/* Back link */}
          <Link
            href="/insights"
            className="inline-flex items-center gap-1.5 mb-6"
            style={{ fontFamily: "'Inter', sans-serif", color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: 500, textDecoration: "none" }}
            data-testid="link-back-insights"
          >
            <ArrowLeft className="w-4 h-4" />
            All Insights
          </Link>

          {/* Category badge */}
          <div className="mb-4">
            <span
              style={{
                fontFamily: "'Inter', sans-serif",
                background: "rgba(255,255,255,0.15)",
                backdropFilter: "blur(6px)",
                color: "white",
                border: "1px solid rgba(255,255,255,0.22)",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.04em",
                padding: "4px 12px",
                borderRadius: 20,
              }}
              data-testid="badge-article-category"
            >
              {contentTypeLabel}
            </span>
          </div>

          {/* Title */}
          <h1
            style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "white", lineHeight: 1.2, fontWeight: 700 }}
            className="text-3xl lg:text-4xl xl:text-5xl mb-4"
            data-testid="text-article-title"
          >
            {article.title}
          </h1>

          {/* Excerpt */}
          {article.excerpt && (
            <p
              style={{ fontFamily: "'Inter', sans-serif", color: "rgba(255,255,255,0.7)", fontSize: 15, lineHeight: 1.6 }}
              className="mb-8 max-w-2xl"
              data-testid="text-article-excerpt"
            >
              {article.excerpt}
            </p>
          )}

          {/* Author + meta row */}
          <div
            className="flex items-center justify-between"
            style={{ borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: 16 }}
          >
            <div className="flex items-center gap-3">
              {article.author?.photoUrl ? (
                <img
                  src={article.author.photoUrl}
                  alt={authorName}
                  className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                  style={{ border: "2px solid rgba(255,255,255,0.3)" }}
                />
              ) : (
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(255,255,255,0.18)", border: "2px solid rgba(255,255,255,0.3)" }}
                >
                  <span style={{ fontFamily: "'Inter', sans-serif", color: "white", fontSize: 11, fontWeight: 700 }}>{initials}</span>
                </div>
              )}
              <div>
                {article.author?.slug ? (
                  <a
                    href={`/insights/authors/${article.author.slug}`}
                    style={{ fontFamily: "'Inter', sans-serif", color: "white", fontSize: 14, fontWeight: 600, textDecoration: "none" }}
                    className="hover:underline"
                    data-testid="text-article-author"
                  >
                    {authorName}
                  </a>
                ) : (
                  <p style={{ fontFamily: "'Inter', sans-serif", color: "white", fontSize: 14, fontWeight: 600 }} data-testid="text-article-author">{authorName}</p>
                )}
                <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(255,255,255,0.5)", fontSize: 12 }}>{authorRole}</p>
              </div>
              <div style={{ width: 1, height: 26, background: "rgba(255,255,255,0.2)", margin: "0 4px" }} />
              <span style={{ fontFamily: "'Inter', sans-serif", color: "rgba(255,255,255,0.55)", fontSize: 13 }} data-testid="text-article-date">
                {[
                  date,
                  article.readTimeMinutes ? `${article.readTimeMinutes} min read` : null,
                ].filter(Boolean).join(" · ")}
              </span>
            </div>
            {article.author?.linkedinUrl && (
              <a
                href={article.author.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "rgba(255,255,255,0.55)" }}
                className="hover:text-white transition-colors"
                aria-label={`${authorName} on LinkedIn`}
                data-testid="link-author-linkedin"
              >
                <Linkedin className="w-5 h-5" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* ── Article body ──────────────────────────────────────────────────── */}
      <article className="bg-white">
        <div className="max-w-3xl mx-auto px-6 py-12 lg:px-8">

          {/* Cover image (if separate from hero) */}
          {article.coverImageUrl && (
            <img
              src={article.coverImageUrl}
              alt={article.title}
              className="mb-10 aspect-[16/9] w-full rounded-2xl object-cover shadow-sm"
              data-testid="img-article-cover"
            />
          )}

          {/* Body */}
          {article.bodyMarkdown && (
            <div
              className="prose prose-lg max-w-none prose-headings:font-bold prose-headings:text-gray-900 prose-a:text-blue-700 prose-blockquote:border-l-orange-400 prose-blockquote:bg-orange-50 prose-blockquote:py-1 prose-blockquote:not-italic prose-img:rounded-xl"
              style={{ fontFamily: "'Inter', sans-serif" }}
              data-testid="article-body"
            >
              <ReactMarkdown>{article.bodyMarkdown}</ReactMarkdown>
            </div>
          )}

          {/* Key Takeaways */}
          {article.checklistItems.length > 0 && (
            <div
              className="mt-10 rounded-2xl p-6"
              style={{ background: "#f8f9ff", border: `1px solid ${NAVY}20` }}
              data-testid="card-checklist"
            >
              <h3 style={{ fontFamily: "'Playfair Display', Georgia, serif", color: NAVY, fontWeight: 700, fontSize: 18, marginBottom: 16 }}>
                Key Takeaways
              </h3>
              <ul className="space-y-3">
                {article.checklistItems.map((item, i) => (
                  <li key={i} className="flex items-start gap-3" data-testid={`text-checklist-${i}`}>
                    <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0" style={{ color: ORANGE }} />
                    <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: "#374151" }}>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Hire'in Perspective */}
          {article.excerpt && (
            <div
              className="mt-8 rounded-2xl p-6 flex gap-4"
              style={{ background: `${NAVY}08`, border: `1px solid ${NAVY}18` }}
              data-testid="card-perspective"
            >
              <Lightbulb className="h-6 w-6 flex-shrink-0 mt-0.5" style={{ color: ORANGE }} />
              <div>
                <h3 style={{ fontFamily: "'Playfair Display', Georgia, serif", color: NAVY, fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
                  The Hire'in Perspective
                </h3>
                <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: "#4b5563", lineHeight: 1.6 }}>{article.excerpt}</p>
              </div>
            </div>
          )}

          {/* CTA block */}
          <div
            className="mt-12 rounded-2xl px-8 py-10 text-center"
            style={{ background: gradient }}
            data-testid="block-cta"
          >
            <div className="absolute inset-0 opacity-[0.06] rounded-2xl" style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "22px 22px" }} />
            <h2
              style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "white", fontWeight: 700, fontSize: 26 }}
              className="lg:text-3xl"
            >
              {cta.heading}
            </h2>
            <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(255,255,255,0.75)", fontSize: 14, marginTop: 10, marginBottom: 24, lineHeight: 1.6 }}>
              {cta.body}
            </p>
            <Link href={cta.href}>
              <Button
                size="lg"
                onClick={handleCtaClick}
                style={{ background: ORANGE, border: "none", fontFamily: "'Inter', sans-serif", fontWeight: 700 }}
                className="hover:brightness-110"
                data-testid="button-cta"
              >
                {cta.buttonLabel}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>

          {/* Author card */}
          {article.author?.name && (
            <div
              className="mt-10 rounded-2xl p-6 flex flex-col sm:flex-row gap-5 items-start sm:items-center"
              style={{ border: "1px solid #e5e7eb", background: "white" }}
              data-testid="card-author"
            >
              {article.author.photoUrl ? (
                <img
                  src={article.author.photoUrl}
                  alt={authorName}
                  className="w-16 h-16 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: authorColor }}
                >
                  <span style={{ fontFamily: "'Inter', sans-serif", color: "white", fontSize: 18, fontWeight: 700 }}>{initials}</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, color: NAVY, fontSize: 15 }} data-testid="text-author-name">
                  {article.author.slug ? (
                    <a href={`/insights/authors/${article.author.slug}`} className="hover:underline">{authorName}</a>
                  ) : authorName}
                </div>
                {article.author.title && (
                  <div style={{ fontFamily: "'Inter', sans-serif", color: "#6b7280", fontSize: 13, marginTop: 2 }}>{article.author.title}</div>
                )}
                {article.author.bio && (
                  <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: "#4b5563", marginTop: 8, lineHeight: 1.6 }}>{article.author.bio}</p>
                )}
              </div>
              {article.author.linkedinUrl && (
                <a
                  href={article.author.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#6b7280", flexShrink: 0 }}
                  className="hover:text-blue-700 transition-colors"
                  aria-label={`${authorName} on LinkedIn`}
                >
                  <Linkedin className="w-5 h-5" />
                </a>
              )}
            </div>
          )}

          {/* Reactions + share */}
          <ReactionBar articleId={article.id} />
          <ShareBar title={article.title} />
        </div>
      </article>

      {/* Newsletter */}
      <section className="bg-gray-50 px-4 py-12 lg:px-6">
        <div className="container mx-auto max-w-3xl">
          <NewsletterSubscribe />
        </div>
      </section>

      {/* Related */}
      {related.length > 0 && (
        <section className="border-t px-4 py-14 lg:px-6" style={{ background: "white" }}>
          <div className="container mx-auto max-w-6xl">
            <div className="flex items-center gap-4 mb-8">
              <div style={{ background: ORANGE }} className="w-5 h-0.5 rounded-full flex-shrink-0" />
              <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", color: NAVY, fontWeight: 700, fontSize: 22, whiteSpace: "nowrap" }}>
                Related Insights
              </h2>
              <div className="flex-1 h-px" style={{ background: "#e5e7eb" }} />
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {related.map((r) => (
                <InsightCard key={r.id} article={r} />
              ))}
            </div>
          </div>
        </section>
      )}
    </Layout>
  );
}
