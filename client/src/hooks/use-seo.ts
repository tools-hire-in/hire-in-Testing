import { useEffect } from "react";

const BASE_URL = "https://hire-in.com";
const DEFAULT_TITLE = "Hire'in Solutions | AI-Powered Recruitment & Staffing";
const DEFAULT_DESCRIPTION =
  "Hire'in Solutions is an AI-powered staffing agency specialising in Healthcare, IT, Engineering, and Professional Services. Find your next career opportunity or hire top talent today.";
const DEFAULT_IMAGE = `${BASE_URL}/og-image.png`;
const SITE_NAME = "Hire'in Solutions";

function setMeta(name: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function removeMeta(name: string) {
  const el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (el) el.remove();
}

function setOgMeta(property: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("property", property);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setCanonical(href: string) {
  let el = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

function removeCanonical() {
  const el = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (el) el.remove();
}

function setOgMetaIf(property: string, content?: string | null) {
  if (!content) return;
  setOgMeta(property, content);
}

function removeOgMeta(property: string) {
  const el = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  if (el) el.remove();
}

interface SEOOptions {
  title: string;
  description: string;
  canonical?: string;
  image?: string;
  /** OpenGraph type. Defaults to "website". Use "article" for blog posts. */
  type?: "website" | "article";
  /** ISO date — only used when type === "article". */
  publishedTime?: string;
  /** ISO date — only used when type === "article". */
  modifiedTime?: string;
  /** Author display name — only used when type === "article". */
  author?: string;
  /** When true, adds noindex,nofollow robots meta tag. */
  noindex?: boolean;
}

export function useSEO({
  title,
  description,
  canonical,
  image,
  type = "website",
  publishedTime,
  modifiedTime,
  author,
  noindex = false,
}: SEOOptions) {
  useEffect(() => {
    const prevTitle = document.title;
    const ogImage = image || DEFAULT_IMAGE;

    document.title = title;
    setMeta("description", description);

    if (noindex) {
      setMeta("robots", "noindex, nofollow");
    } else {
      removeMeta("robots");
    }

    setOgMeta("og:title", title);
    setOgMeta("og:description", description);
    setOgMeta("og:type", type);
    setOgMeta("og:site_name", SITE_NAME);
    setOgMeta("og:image", ogImage);
    setOgMeta("og:image:width", "1200");
    setOgMeta("og:image:height", "630");
    setOgMeta("og:image:alt", `${SITE_NAME} — AI-Powered Recruitment & Staffing`);

    if (type === "article") {
      setOgMetaIf("article:published_time", publishedTime);
      setOgMetaIf("article:modified_time", modifiedTime);
      setOgMetaIf("article:author", author);
      setOgMetaIf("article:section", "Insights");
    }

    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:title", title);
    setMeta("twitter:description", description);
    setMeta("twitter:image", ogImage);

    if (canonical) {
      setCanonical(canonical);
      setOgMeta("og:url", canonical);
    }

    return () => {
      document.title = prevTitle || DEFAULT_TITLE;
      setMeta("description", DEFAULT_DESCRIPTION);
      setOgMeta("og:image", DEFAULT_IMAGE);
      setOgMeta("og:image:width", "1200");
      setOgMeta("og:image:height", "630");
      setMeta("twitter:image", DEFAULT_IMAGE);
      setOgMeta("og:type", "website");
      removeOgMeta("article:published_time");
      removeOgMeta("article:modified_time");
      removeOgMeta("article:author");
      removeOgMeta("article:section");
      removeMeta("robots");
      if (canonical) removeCanonical();
    };
  }, [title, description, canonical, image, type, publishedTime, modifiedTime, author, noindex]);
}
