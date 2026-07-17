import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Download, Loader2, Sparkles } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { CanonicalSocialKit } from "@shared/studioAi";
import type { StudioContentIdea } from "@shared/schema";

const platformLabels: Record<string, string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  facebook: "Facebook",
  twitter: "X (Twitter)",
};

const CARD_LAYOUT_LABELS: Record<string, string> = {
  hook: "Hook card",
  quote: "Quote card",
  stat: "Stat card",
  "story-frame": "Story frame",
  standard: "Standard",
  checklist: "Checklist",
};

interface IdeaCard {
  layout: string;
  platform: string;
  url: string;
  width: number;
  height: number;
}

// Branded creative card gallery for a Social idea (Studio T4). Renders the
// generated card options from socialCardsJsonb with hook-text edit +
// regenerate, per-card PNG download, and "Use this card" (fills creativeLink).
export function IdeaCardGallery({ idea, articleId }: { idea: StudioContentIdea; articleId?: string }) {
  const { toast } = useToast();
  const payload = (idea.socialCardsJsonb as any) ?? null;
  const cards: IdeaCard[] = Array.isArray(payload?.cards) ? payload.cards : [];
  const defaultHook =
    payload?.hookText ||
    (idea.captionCopy ? idea.captionCopy.split("\n")[0] : "") ||
    idea.topic ||
    "";
  const [hookText, setHookText] = useState<string>(defaultHook);
  const [cacheBust, setCacheBust] = useState<number>(0);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(
        "POST",
        `/api/admin/studio/content-ideas/${idea.id}/generate-cards`,
        { hookText: hookText.trim() || null },
      );
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || "Card generation failed");
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      setCacheBust(Date.now());
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/content-ideas"] });
      if (articleId) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/articles", articleId] });
      }
      const n = (data.cards ?? []).length;
      toast({ title: `${n} card${n === 1 ? "" : "s"} generated` });
    },
    onError: (err: Error) =>
      toast({ title: "Could not generate cards", description: err.message ?? "An unexpected error occurred", variant: "destructive" }),
  });

  const useCardMutation = useMutation({
    mutationFn: async (url: string) => {
      const res = await apiRequest("PATCH", `/api/admin/studio/content-ideas/${idea.id}`, {
        creativeLink: url,
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || "Failed to save creative link");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/content-ideas"] });
      toast({ title: "Creative link saved on the idea" });
    },
    onError: (err: Error) =>
      toast({ title: "Could not save creative link", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-3" data-testid="idea-card-gallery">
      <div className="space-y-1.5">
        <Label htmlFor="idea-hook-text">Hook text (used on the cards)</Label>
        <div className="flex gap-2">
          <Input
            id="idea-hook-text"
            value={hookText}
            onChange={(e) => setHookText(e.target.value)}
            placeholder="Big hook line for the card"
            data-testid="input-idea-hook-text"
          />
          <Button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            data-testid="button-generate-idea-cards"
          >
            {generateMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {cards.length > 0 ? "Regenerate" : "Generate cards"}
          </Button>
        </div>
      </div>

      {cards.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="text-no-idea-cards">
          No creative cards yet. Generate branded card options from the hook text above.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {cards.map((card) => {
            const isChosen = idea.creativeLink === card.url;
            return (
              <div
                key={`${card.layout}-${card.platform}`}
                className={`rounded-lg border p-2 ${isChosen ? "border-primary" : ""}`}
                data-testid={`idea-card-${card.layout}-${card.platform}`}
              >
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">
                      {CARD_LAYOUT_LABELS[card.layout] ?? card.layout}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {card.platform} · {card.width}×{card.height}
                    </p>
                  </div>
                  {isChosen && (
                    <Badge className="shrink-0" data-testid={`badge-chosen-${card.layout}-${card.platform}`}>
                      <Check className="mr-1 h-3 w-3" />
                      In use
                    </Badge>
                  )}
                </div>
                <div className="overflow-hidden rounded-md border bg-muted/30">
                  <img
                    src={`${card.url}${cacheBust ? `?t=${cacheBust}` : ""}`}
                    alt={`${card.layout} ${card.platform} card`}
                    className="w-full"
                    style={{ aspectRatio: `${card.width} / ${card.height}` }}
                    loading="lazy"
                  />
                </div>
                <div className="mt-2 flex gap-1.5">
                  <Button
                    size="sm"
                    variant={isChosen ? "secondary" : "default"}
                    className="flex-1"
                    onClick={() => useCardMutation.mutate(card.url)}
                    disabled={useCardMutation.isPending || isChosen}
                    data-testid={`button-use-card-${card.layout}-${card.platform}`}
                  >
                    <Check className="mr-1 h-3.5 w-3.5" />
                    {isChosen ? "In use" : "Use this card"}
                  </Button>
                  <Button size="sm" variant="outline" asChild data-testid={`button-download-card-${card.layout}-${card.platform}`}>
                    <a href={card.url} download={`${idea.id}-${card.layout}-${card.platform}.png`}>
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function SocialKitPreview({ kit }: { kit: CanonicalSocialKit | null }) {
  if (!kit) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground" data-testid="text-no-social-kit">
          No Social Kit was generated for this article.
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-4">
      {(kit.captions ?? []).map((cap) => (
        <Card key={cap.platform} data-testid={`card-caption-${cap.platform}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              {platformLabels[cap.platform] ?? cap.platform}
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {cap.text.length} chars
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="whitespace-pre-wrap text-sm" data-testid={`text-caption-${cap.platform}`}>
              {cap.text}
            </p>
            {(kit.hashtags?.[cap.platform] ?? []).length > 0 && (
              <p className="text-xs text-muted-foreground">
                {kit.hashtags![cap.platform].map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}
              </p>
            )}
          </CardContent>
        </Card>
      ))}

      {(kit.thread ?? []).length > 0 && (
        <Card data-testid="card-thread">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Thread</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {kit.thread!.map((t, i) => (
              <p key={i} className="text-sm" data-testid={`text-thread-${i}`}>
                {i + 1}. {t}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      {(kit.story_frames ?? []).length > 0 && (
        <Card data-testid="card-story-frames">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Story frames</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {kit.story_frames!.map((s, i) => (
              <Badge key={i} variant="secondary" data-testid={`badge-story-${i}`}>
                {s}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      {kit.quote_card_text && (
        <Card data-testid="card-quote">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Quote card</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm italic">{kit.quote_card_text}</p>
          </CardContent>
        </Card>
      )}

      {(kit.checklist_card_items ?? []).length > 0 && (
        <Card data-testid="card-checklist">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Checklist card</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="ml-4 list-disc space-y-1 text-sm">
              {kit.checklist_card_items!.map((c, i) => (
                <li key={i} data-testid={`text-checklist-${i}`}>{c}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
