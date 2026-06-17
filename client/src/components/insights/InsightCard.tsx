import { Link } from "wouter";
import { Clock, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { insightCategoryLabel } from "@shared/insights";
import { formatInsightDate, type PublicInsight } from "@/lib/insights";

interface InsightCardProps {
  article: PublicInsight;
  featured?: boolean;
}

export function InsightCard({ article, featured = false }: InsightCardProps) {
  const categoryLabel = insightCategoryLabel(article.category);
  const date = formatInsightDate(article.publishedAt);

  return (
    <Link href={`/insights/${article.slug}`} data-testid={`link-insight-${article.slug}`}>
      <Card
        className={`group h-full overflow-hidden hover-elevate ${featured ? "lg:grid lg:grid-cols-2" : ""}`}
        data-testid={`card-insight-${article.slug}`}
      >
        <div
          className={`relative overflow-hidden bg-muted ${featured ? "aspect-[16/10] lg:aspect-auto lg:h-full" : "aspect-[16/9]"}`}
        >
          {article.coverImageUrl ? (
            <img
              src={article.coverImageUrl}
              alt={article.title}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              data-testid={`img-insight-${article.slug}`}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 to-primary/20">
              <span className="px-4 text-center text-lg font-semibold text-primary/70">
                {article.title}
              </span>
            </div>
          )}
          <Badge className="absolute left-3 top-3" data-testid={`badge-category-${article.slug}`}>
            {categoryLabel}
          </Badge>
        </div>

        <CardContent className={`flex flex-col ${featured ? "justify-center p-6 lg:p-10" : "p-5"}`}>
          {featured && (
            <span className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
              Featured
            </span>
          )}
          <h3
            className={`font-bold leading-snug text-foreground ${featured ? "text-2xl lg:text-3xl" : "text-lg"}`}
            data-testid={`text-insight-title-${article.slug}`}
          >
            {article.title}
          </h3>
          {article.excerpt && (
            <p
              className={`mt-2 text-muted-foreground ${featured ? "text-base line-clamp-3" : "text-sm line-clamp-2"}`}
            >
              {article.excerpt}
            </p>
          )}

          {article.author?.name && (
            <div className="mt-4 flex items-center gap-2 text-xs" data-testid={`text-insight-author-${article.slug}`}>
              <span className="font-semibold text-foreground">{article.author.name}</span>
              {article.author.title && (
                <span className="text-muted-foreground">· {article.author.title}</span>
              )}
            </div>
          )}

          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
            {date && <span data-testid={`text-insight-date-${article.slug}`}>{date}</span>}
            {article.readTimeMinutes ? (
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {article.readTimeMinutes} min read
              </span>
            ) : null}
          </div>

          <span
            className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-primary"
            data-testid={`link-read-more-${article.slug}`}
          >
            {featured ? "Read article" : "Read More"}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}
