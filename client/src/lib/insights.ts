// Client-side shape of a published insight as returned by the public
// /api/insights endpoints (see sanitizePublicInsight in server/routes.ts).

export interface PublicInsightAuthor {
  name: string;
  title: string | null;
  bio: string | null;
  photoUrl: string | null;
  linkedinUrl: string | null;
  slug: string | null;
}

export interface PublicInsight {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  bodyMarkdown: string | null;
  category: string | null;
  contentType: string | null;
  coverImageUrl: string | null;
  ogImageUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  tags: string[];
  readTimeMinutes: number | null;
  publishedAt: string | null;
  updatedAt: string | null;
  checklistItems: string[];
  author: PublicInsightAuthor | null;
}

export interface InsightListResponse {
  items: PublicInsight[];
  total: number;
}

export interface InsightDetailResponse {
  article: PublicInsight;
  related: PublicInsight[];
}

export function formatInsightDate(value: string | null): string {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "";
  }
}
