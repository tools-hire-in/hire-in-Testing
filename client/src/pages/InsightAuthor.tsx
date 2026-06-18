import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { InsightCard } from "@/components/insights/InsightCard";
import { ArrowLeft, Linkedin } from "lucide-react";
import type { PublicInsight } from "@/lib/insights";

interface PublicAuthor {
  id: string;
  displayName: string;
  publicTitle: string | null;
  bio: string | null;
  photoUrl: string | null;
  linkedinUrl: string | null;
  specialties: string[];
  slug: string;
}

interface AuthorDetailResponse {
  author: PublicAuthor;
  articles: PublicInsight[];
}

export default function InsightAuthor() {
  const params = useParams();
  const slug = params.slug as string;

  const { data, isLoading, isError } = useQuery<AuthorDetailResponse>({
    queryKey: ["/api/public/authors", slug],
    queryFn: async () => {
      const res = await fetch(`/api/public/authors/${encodeURIComponent(slug)}`);
      if (res.status === 404) throw new Error("not-found");
      if (!res.ok) throw new Error("Failed to load author");
      return res.json();
    },
    retry: false,
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto max-w-4xl px-4 py-16 lg:px-6">
          <Skeleton className="mb-6 h-6 w-24" />
          <div className="flex items-start gap-6 mb-10">
            <Skeleton className="h-24 w-24 rounded-full shrink-0" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-16 w-full" />
            </div>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  if (isError || !data) {
    return (
      <Layout>
        <div className="container mx-auto max-w-4xl px-4 py-24 text-center">
          <h1 className="text-2xl font-bold mb-3">Author not found</h1>
          <p className="text-muted-foreground mb-6">This author profile doesn't exist or has been removed.</p>
          <Link href="/insights/authors" className="text-primary hover:underline">
            ← Back to Authors
          </Link>
        </div>
      </Layout>
    );
  }

  const { author, articles } = data;

  return (
    <Layout>
      <div className="container mx-auto max-w-4xl px-4 py-16 lg:px-6">
        <Link
          href="/insights/authors"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8"
          data-testid="link-back-authors"
        >
          <ArrowLeft className="h-4 w-4" />
          All Authors
        </Link>

        <div className="flex flex-col gap-6 sm:flex-row sm:items-start mb-10">
          <Avatar className="h-24 w-24 shrink-0">
            {author.photoUrl && <AvatarImage src={author.photoUrl} alt={author.displayName} />}
            <AvatarFallback className="text-2xl">
              {author.displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 space-y-3">
            <div>
              <h1 className="text-3xl font-bold tracking-tight" data-testid="text-author-name">
                {author.displayName}
              </h1>
              {author.publicTitle && (
                <p className="text-muted-foreground mt-1" data-testid="text-author-title">
                  {author.publicTitle}
                </p>
              )}
            </div>

            {author.bio && (
              <p className="text-sm leading-relaxed" data-testid="text-author-bio">
                {author.bio}
              </p>
            )}

            {author.specialties?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {author.specialties.map((s) => (
                  <Badge key={s} variant="secondary">
                    {s}
                  </Badge>
                ))}
              </div>
            )}

            {author.linkedinUrl && (
              <a
                href={author.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-muted transition-colors"
                data-testid="link-author-linkedin"
              >
                <Linkedin className="h-4 w-4" />
                Connect on LinkedIn
              </a>
            )}
          </div>
        </div>

        {articles.length > 0 && (
          <div>
            <h2 className="mb-6 text-xl font-bold tracking-tight">
              Articles by {author.displayName}
            </h2>
            <div className="grid gap-6 sm:grid-cols-2">
              {articles.map((article) => (
                <InsightCard key={article.id} article={article} />
              ))}
            </div>
          </div>
        )}

        {articles.length === 0 && (
          <p className="py-8 text-center text-muted-foreground">
            No published articles yet.
          </p>
        )}
      </div>
    </Layout>
  );
}
