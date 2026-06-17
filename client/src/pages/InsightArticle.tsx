import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import ReactMarkdown from "react-markdown";
import { Layout } from "@/components/layout/Layout";
import { SchemaHead, ORGANIZATION_SCHEMA } from "@/components/SchemaHead";
import { useSEO } from "@/hooks/use-seo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { InsightCard } from "@/components/insights/InsightCard";
import { ReactionBar } from "@/components/insights/ReactionBar";
import { ShareBar } from "@/components/insights/ShareBar";
import { NewsletterSubscribe } from "@/components/insights/NewsletterSubscribe";
import { insightCategoryLabel, ctaForCategory } from "@shared/insights";
import { formatInsightDate, type InsightDetailResponse } from "@/lib/insights";
import { Clock, ArrowLeft, ArrowRight, Linkedin, CheckCircle2, Lightbulb } from "lucide-react";

const BASE_URL = "https://hire-in.com";

export default function InsightArticle() {
  const params = useParams();
  const slug = params.slug as string;

  const { data, isLoading, isError } = useQuery<InsightDetailResponse>({
    queryKey: ["/api/insights", slug],
    queryFn: async () => {
      const res = await fetch(`/api/insights/${encodeURIComponent(slug)}`, {
        credentials: "include",
      });
      if (res.status === 404) throw new Error("not-found");
      if (!res.ok) throw new Error("Failed to load article");
      return res.json();
    },
    retry: false,
  });

  const article = data?.article;

  useSEO({
    title: article ? `${article.seoTitle || article.title} | Hire'in Solutions` : "Insights | Hire'in Solutions",
    description:
      article?.seoDescription ||
      article?.excerpt ||
      "Insights from Hire'in Solutions on staffing, hiring, and recruitment.",
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
        <div className="container mx-auto max-w-3xl px-4 py-16 lg:px-6">
          <Skeleton className="mb-4 h-6 w-32" />
          <Skeleton className="mb-3 h-10 w-full" />
          <Skeleton className="mb-8 h-10 w-2/3" />
          <Skeleton className="mb-6 aspect-[16/9] w-full rounded-xl" />
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
          <h1 className="text-3xl font-bold" data-testid="text-not-found">Article not found</h1>
          <p className="mt-3 text-muted-foreground">
            This article may have been moved or is no longer available.
          </p>
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
  const date = formatInsightDate(article.publishedAt);
  const cta = ctaForCategory(article.category);
  const related = data?.related ?? [];

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

      <article className="px-4 py-10 lg:px-6 lg:py-14">
        <div className="container mx-auto max-w-3xl">
          {/* Breadcrumb / back */}
          <Link
            href="/insights"
            className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            data-testid="link-back-insights"
          >
            <ArrowLeft className="h-4 w-4" />
            All Insights
          </Link>

          {/* Header */}
          <header className="mb-8">
            <Badge className="mb-4" data-testid="badge-article-category">{categoryLabel}</Badge>
            <h1 className="text-3xl font-bold leading-tight md:text-4xl lg:text-5xl" data-testid="text-article-title">
              {article.title}
            </h1>
            {article.excerpt && (
              <p className="mt-4 text-lg text-muted-foreground" data-testid="text-article-excerpt">
                {article.excerpt}
              </p>
            )}
            <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {article.author?.name && (
                <span className="font-medium text-foreground" data-testid="text-article-author">
                  {article.author.name}
                </span>
              )}
              {date && <span data-testid="text-article-date">{date}</span>}
              {article.readTimeMinutes ? (
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {article.readTimeMinutes} min read
                </span>
              ) : null}
            </div>
          </header>

          {/* Cover */}
          {article.coverImageUrl && (
            <img
              src={article.coverImageUrl}
              alt={article.title}
              className="mb-10 aspect-[16/9] w-full rounded-xl object-cover"
              data-testid="img-article-cover"
            />
          )}

          {/* Body */}
          {article.bodyMarkdown && (
            <div
              className="prose prose-lg max-w-none dark:prose-invert prose-headings:font-bold prose-headings:text-foreground prose-a:text-primary prose-blockquote:border-l-primary prose-blockquote:bg-primary/5 prose-blockquote:py-1 prose-blockquote:not-italic prose-img:rounded-xl"
              data-testid="article-body"
            >
              <ReactMarkdown>{article.bodyMarkdown}</ReactMarkdown>
            </div>
          )}

          {/* Hire'in Perspective callout */}
          {article.excerpt && (
            <Card className="mt-10 border-l-4 border-l-primary bg-primary/5" data-testid="card-perspective">
              <CardContent className="flex gap-4 p-6">
                <Lightbulb className="h-6 w-6 flex-shrink-0 text-primary" />
                <div>
                  <h3 className="mb-1 font-semibold text-primary">The Hire'in Perspective</h3>
                  <p className="text-sm text-muted-foreground">{article.excerpt}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Checklist block */}
          {article.checklistItems.length > 0 && (
            <Card className="mt-8" data-testid="card-checklist">
              <CardContent className="p-6">
                <h3 className="mb-4 text-lg font-semibold">Key Takeaways</h3>
                <ul className="space-y-3">
                  {article.checklistItems.map((item, i) => (
                    <li key={i} className="flex items-start gap-3" data-testid={`text-checklist-${i}`}>
                      <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
                      <span className="text-sm">{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* CTA block */}
          <div className="mt-12 rounded-2xl bg-primary px-6 py-10 text-center text-primary-foreground lg:px-10" data-testid="block-cta">
            <h2 className="text-2xl font-bold lg:text-3xl">{cta.heading}</h2>
            <p className="mx-auto mt-3 max-w-xl text-primary-foreground/80">{cta.body}</p>
            <Link href={cta.href}>
              <Button size="lg" variant="secondary" className="mt-6" data-testid="button-cta">
                {cta.buttonLabel}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>

          {/* Author card */}
          {article.author?.name && (
            <Card className="mt-10" data-testid="card-author">
              <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
                <Avatar className="h-16 w-16">
                  {article.author.photoUrl && (
                    <AvatarImage src={article.author.photoUrl} alt={article.author.name} />
                  )}
                  <AvatarFallback>
                    {article.author.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="font-semibold" data-testid="text-author-name">{article.author.name}</div>
                  {article.author.title && (
                    <div className="text-sm text-muted-foreground">{article.author.title}</div>
                  )}
                  {article.author.bio && (
                    <p className="mt-2 text-sm text-muted-foreground">{article.author.bio}</p>
                  )}
                </div>
                {article.author.linkedinUrl && (
                  <a
                    href={article.author.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground transition-colors hover:text-primary"
                    aria-label={`${article.author.name} on LinkedIn`}
                    data-testid="link-author-linkedin"
                  >
                    <Linkedin className="h-5 w-5" />
                  </a>
                )}
              </CardContent>
            </Card>
          )}

          {/* Reader reactions + share */}
          <ReactionBar articleId={article.id} />
          <ShareBar title={article.title} />
        </div>
      </article>

      <section className="px-4 pb-4 lg:px-6">
        <div className="container mx-auto max-w-3xl">
          <NewsletterSubscribe />
        </div>
      </section>

      {/* Related */}
      {related.length > 0 && (
        <section className="border-t bg-muted/30 px-4 py-14 lg:px-6">
          <div className="container mx-auto max-w-6xl">
            <h2 className="mb-8 text-2xl font-bold">Related Insights</h2>
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
