import { useEffect } from "react";

const DEFAULT_TITLE = "Hire'in Solutions | AI-Powered Recruitment & Staffing";
const DEFAULT_DESCRIPTION =
  "Hire'in Solutions is an AI-powered staffing agency specialising in Healthcare, IT, Engineering, and Professional Services. Find your next career opportunity or hire top talent today.";

function setMeta(name: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
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

interface SEOOptions {
  title: string;
  description: string;
}

export function useSEO({ title, description }: SEOOptions) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title;
    setMeta("description", description);
    setOgMeta("og:title", title);
    setOgMeta("og:description", description);
    setOgMeta("og:type", "website");

    return () => {
      document.title = prevTitle || DEFAULT_TITLE;
      setMeta("description", DEFAULT_DESCRIPTION);
    };
  }, [title, description]);
}
