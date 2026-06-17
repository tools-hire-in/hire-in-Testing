import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Link2, Check } from "lucide-react";
import { SiLinkedin, SiX, SiFacebook, SiWhatsapp } from "react-icons/si";
import type { IconType } from "react-icons";

interface SharePlatform {
  key: string;
  label: string;
  Icon: IconType;
  build: (url: string, title: string) => string;
}

const PLATFORMS: SharePlatform[] = [
  {
    key: "linkedin",
    label: "Share on LinkedIn",
    Icon: SiLinkedin,
    build: (url) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  },
  {
    key: "twitter",
    label: "Share on X",
    Icon: SiX,
    build: (url, title) =>
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
  },
  {
    key: "facebook",
    label: "Share on Facebook",
    Icon: SiFacebook,
    build: (url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    key: "whatsapp",
    label: "Share on WhatsApp",
    Icon: SiWhatsapp,
    build: (url, title) => `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`,
  },
];

export function ShareBar({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleShare = (platform: SharePlatform) => {
    const href = platform.build(window.location.href, title);
    window.open(href, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="mt-8 border-t pt-8" data-testid="share-bar">
      <h3 className="mb-4 text-lg font-semibold">Share this article</h3>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={handleCopy}
          data-testid="button-copy-link"
        >
          {copied ? (
            <>
              <Check className="mr-2 h-4 w-4 text-green-600" />
              Copied!
            </>
          ) : (
            <>
              <Link2 className="mr-2 h-4 w-4" />
              Copy Link
            </>
          )}
        </Button>

        <div className="flex items-center gap-2">
          {PLATFORMS.map((p) => (
            <Button
              key={p.key}
              type="button"
              variant="outline"
              size="icon"
              onClick={() => handleShare(p)}
              aria-label={p.label}
              title={p.label}
              data-testid={`button-share-${p.key}`}
            >
              <p.Icon className="h-4 w-4" />
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
