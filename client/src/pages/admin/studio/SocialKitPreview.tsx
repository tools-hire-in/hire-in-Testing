import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CanonicalSocialKit } from "@shared/studioAi";

const platformLabels: Record<string, string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  facebook: "Facebook",
  twitter: "X (Twitter)",
};

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
