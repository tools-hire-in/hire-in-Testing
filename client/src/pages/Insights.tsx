import { useInfiniteQuery } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { SchemaHead, ORGANIZATION_SCHEMA } from "@/components/SchemaHead";
import { useSEO } from "@/hooks/use-seo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { InsightCard } from "@/components/insights/InsightCard";
import { INSIGHT_CATEGORIES } from "@shared/insights";
import type { InsightListResponse } from "@/lib/insights";
import { Newspaper, Loader2 } from "lucide-react";

const BASE_URL = "https://hire-in.com";
const PAGE_SIZE = 12;

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
        const res = await fetch(`/api/insights?${params.toString()}`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to load insights");
        return res.json();
      },
      getNextPageParam: (lastPage, allPages) => {
        const loaded = allPages.reduce((n, p) => n + p.items.length, 0);
        return loaded < lastPage.total ? allPages.length + 1 : undefined;
      },
    });

  const articles = data?.pages.flatMap((p) => p.items) ?? [];
  const featured = !category ? articles[0] ?? null : null;
  const rest = featured ? articles.slice(1) : articles;

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

      {/* Hero */}
      <section className="bg-gradient-to-br from-primary/5 via-background to-primary/10 px-4 py-16 lg:px-6 lg:py-20">
        <div className="container mx-auto max-w-5xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border bg-card px-4 py-1.5 text-sm font-medium text-primary">
            <Newspaper className="h-4 w-4" />
            Insights
          </div>
          <h1 className="text-4xl font-bold md:text-5xl lg:text-6xl" data-testid="text-page-title">
            Staffing Insights & Hiring Intelligence
          </h1>
          <p className="mx-auto mt-5 max-w-3xl text-lg text-muted-foreground">
            Market trends, employer guides, recruiter playbooks, and a look at how AI is
            reshaping hiring — straight from the Hire'in Solutions team.
          </p>
        </div>
      </section>

      {/* Category filter */}
      <section className="border-b bg-background px-4 py-5 lg:px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              variant={category === "" ? "default" : "outline"}
              size="sm"
              onClick={() => setCategory("")}
              data-testid="chip-category-all"
              className="rounded-full"
            >
              All
            </Button>
            {INSIGHT_CATEGORIES.map((c) => (
              <Button
                key={c.value}
                variant={category === c.value ? "default" : "outline"}
                size="sm"
                onClick={() => setCategory(c.value)}
                data-testid={`chip-category-${c.value}`}
                className="rounded-full"
              >
                {c.label}
              </Button>
            ))}
          </div>
        </div>
      </section>

      {/* Grid */}
      <section className="px-4 py-12 lg:px-6 lg:py-16">
        <div className="container mx-auto max-w-6xl">
          {isLoading ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-[16/9] w-full rounded-xl" />
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </div>
          ) : articles.length === 0 ? (
            <div className="py-20 text-center" data-testid="text-empty-state">
              <Newspaper className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
              <h2 className="text-xl font-semibold">No articles yet</h2>
              <p className="mt-2 text-muted-foreground">
                {category
                  ? "No articles in this category yet. Check back soon."
                  : "We're working on fresh insights. Check back soon."}
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {featured && <InsightCard article={featured} featured />}
              {rest.length > 0 && (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {rest.map((article) => (
                    <InsightCard key={article.id} article={article} />
                  ))}
                </div>
              )}

              {hasNextPage && (
                <div className="flex justify-center pt-4">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    data-testid="button-load-more"
                  >
                    {isFetchingNextPage ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading…
                      </>
                    ) : (
                      "Load more"
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}
