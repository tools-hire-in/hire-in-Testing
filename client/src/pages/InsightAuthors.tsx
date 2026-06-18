import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Linkedin } from "lucide-react";

interface PublicAuthor {
  id: string;
  displayName: string;
  publicTitle: string | null;
  bio: string | null;
  photoUrl: string | null;
  linkedinUrl: string | null;
  specialties: string[];
  slug: string;
  articleCount: number;
}

export default function InsightAuthors() {
  const { data: authors, isLoading } = useQuery<PublicAuthor[]>({
    queryKey: ["/api/public/authors"],
    queryFn: async () => {
      const res = await fetch("/api/public/authors");
      if (!res.ok) throw new Error("Failed to load authors");
      return res.json();
    },
  });

  return (
    <Layout>
      <div className="container mx-auto max-w-5xl px-4 py-16 lg:px-6">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Our Authors</h1>
          <p className="mt-3 text-muted-foreground">
            Meet the people behind Hire'in Solutions' insights on staffing, HR, and recruitment.
          </p>
        </div>

        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border p-6 space-y-3">
                <Skeleton className="h-16 w-16 rounded-full" />
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-12 w-full" />
              </div>
            ))}
          </div>
        ) : !authors?.length ? (
          <p className="py-16 text-center text-muted-foreground">No author profiles yet.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {authors.map((author) => (
              <Link key={author.id} href={`/insights/authors/${author.slug}`}>
                <div
                  className="group rounded-xl border p-6 space-y-4 transition hover:border-primary hover:shadow-md cursor-pointer"
                  data-testid={`card-author-${author.id}`}
                >
                  <div className="flex items-start gap-4">
                    <Avatar className="h-16 w-16 shrink-0">
                      {author.photoUrl && <AvatarImage src={author.photoUrl} alt={author.displayName} />}
                      <AvatarFallback className="text-lg">
                        {author.displayName.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <h2 className="font-semibold group-hover:text-primary transition-colors truncate" data-testid={`text-author-name-${author.id}`}>
                        {author.displayName}
                      </h2>
                      {author.publicTitle && (
                        <p className="text-sm text-muted-foreground truncate">{author.publicTitle}</p>
                      )}
                      {author.linkedinUrl && (
                        <a
                          href={author.linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1"
                          onClick={(e) => e.stopPropagation()}
                          data-testid={`link-linkedin-${author.id}`}
                        >
                          <Linkedin className="h-3 w-3" />
                          LinkedIn
                        </a>
                      )}
                    </div>
                  </div>

                  {author.bio && (
                    <p className="text-sm text-muted-foreground line-clamp-3">{author.bio}</p>
                  )}

                  {author.articleCount > 0 && (
                    <p className="text-xs text-muted-foreground" data-testid={`text-article-count-${author.id}`}>
                      {author.articleCount} {author.articleCount === 1 ? "article" : "articles"} published
                    </p>
                  )}

                  {author.specialties?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {author.specialties.slice(0, 3).map((s) => (
                        <Badge key={s} variant="secondary" className="text-xs">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
