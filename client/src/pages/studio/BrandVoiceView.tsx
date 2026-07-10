import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { useStudioProject } from "@/pages/admin/studio/useStudioProject";
import { BRAND_VOICE_FRAMEWORKS, type BrandVoiceConfig } from "@shared/studioAi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Loader2, Mic2, Save } from "lucide-react";

interface BrandVoiceResponse {
  projectId: string;
  config: BrandVoiceConfig | null;
  /** composeBrandVoice() output — the flat params handed to AI prompts. */
  resolved: { brand_name: string; brand_tagline: string; brand_voice: string };
}

const PLATFORM_TABS = [
  { key: "linkedin", label: "LinkedIn" },
  { key: "instagram", label: "Instagram" },
  { key: "story", label: "Story" },
] as const;

const FRAMEWORK_LABELS: Record<string, string> = {
  none: "None — free-form",
  aida: "AIDA (Attention → Interest → Desire → Action)",
  pas: "PAS (Problem → Agitate → Solve)",
  bab: "BAB (Before → After → Bridge)",
};

/** Textarea whose lines map to a string[] field. */
function ListField({
  label, hint, value, onChange, testId,
}: {
  label: string;
  hint?: string;
  value: string[];
  onChange: (v: string[]) => void;
  testId: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <Textarea
        rows={3}
        className="mt-1"
        value={value.join("\n")}
        onChange={(e) => onChange(e.target.value.split("\n"))}
        onBlur={(e) => onChange(e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))}
        data-testid={testId}
      />
    </div>
  );
}

type PlatformDraft = { tone: string[]; signaturePhrases: string[] };
const emptyPlatform = (): PlatformDraft => ({ tone: [], signaturePhrases: [] });

export default function BrandVoiceView() {
  const { toast } = useToast();
  const { can } = usePermissions();
  const canEdit = can("studio.edit_article");
  const { selectedProjectId, projects } = useStudioProject();
  const projectName = projects?.find((p) => p.id === selectedProjectId)?.name ?? "";

  const { data, isLoading } = useQuery<BrandVoiceResponse>({
    queryKey: ["/api/studio/projects", selectedProjectId, "brand-voice"],
    enabled: !!selectedProjectId,
  });

  const [draft, setDraft] = useState<{
    tone: string[];
    guardrails: string[];
    bannedPhrases: string[];
    signaturePhrases: string[];
    icpOneLiner: string;
    brandPromise: string;
    ctaStyle: string;
    complianceNotes: string;
    defaultFramework: string;
  }>({
    tone: [], guardrails: [], bannedPhrases: [], signaturePhrases: [],
    icpOneLiner: "", brandPromise: "", ctaStyle: "", complianceNotes: "",
    defaultFramework: "none",
  });
  const [platforms, setPlatforms] = useState<Record<string, PlatformDraft>>({
    linkedin: emptyPlatform(), instagram: emptyPlatform(), story: emptyPlatform(),
  });

  useEffect(() => {
    const d = data?.config?.default;
    setDraft({
      tone: d?.tone ?? [],
      guardrails: d?.guardrails ?? [],
      bannedPhrases: d?.bannedPhrases ?? [],
      signaturePhrases: d?.signaturePhrases ?? [],
      icpOneLiner: d?.icpOneLiner ?? "",
      brandPromise: d?.brandPromise ?? "",
      ctaStyle: d?.ctaStyle ?? "",
      complianceNotes: d?.complianceNotes ?? "",
      defaultFramework: d?.defaultFramework ?? "none",
    });
    const p = data?.config?.platforms ?? {};
    setPlatforms({
      linkedin: { tone: p.linkedin?.tone ?? [], signaturePhrases: p.linkedin?.signaturePhrases ?? [] },
      instagram: { tone: p.instagram?.tone ?? [], signaturePhrases: p.instagram?.signaturePhrases ?? [] },
      story: { tone: p.story?.tone ?? [], signaturePhrases: p.story?.signaturePhrases ?? [] },
    });
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const def: Record<string, unknown> = {};
      if (draft.tone.length) def.tone = draft.tone;
      if (draft.guardrails.length) def.guardrails = draft.guardrails;
      if (draft.bannedPhrases.length) def.bannedPhrases = draft.bannedPhrases;
      if (draft.signaturePhrases.length) def.signaturePhrases = draft.signaturePhrases;
      if (draft.icpOneLiner.trim()) def.icpOneLiner = draft.icpOneLiner.trim();
      if (draft.brandPromise.trim()) def.brandPromise = draft.brandPromise.trim();
      if (draft.ctaStyle.trim()) def.ctaStyle = draft.ctaStyle.trim();
      if (draft.complianceNotes.trim()) def.complianceNotes = draft.complianceNotes.trim();
      if (draft.defaultFramework && draft.defaultFramework !== "none") def.defaultFramework = draft.defaultFramework;

      const plats: Record<string, PlatformDraft> = {};
      for (const { key } of PLATFORM_TABS) {
        const p = platforms[key];
        const override: PlatformDraft = { tone: [], signaturePhrases: [] };
        let any = false;
        if (p?.tone?.length) { override.tone = p.tone; any = true; }
        if (p?.signaturePhrases?.length) { override.signaturePhrases = p.signaturePhrases; any = true; }
        if (any) {
          plats[key] = {
            ...(override.tone.length ? { tone: override.tone } : {}),
            ...(override.signaturePhrases.length ? { signaturePhrases: override.signaturePhrases } : {}),
          } as PlatformDraft;
        }
      }

      const hasDefault = Object.keys(def).length > 0;
      const hasPlatforms = Object.keys(plats).length > 0;
      const config = hasDefault || hasPlatforms
        ? {
            ...(hasDefault ? { default: def } : {}),
            ...(hasPlatforms ? { platforms: plats } : {}),
          }
        : null;
      return apiRequest("PUT", `/api/studio/projects/${selectedProjectId}/brand-voice`, { config });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/studio/projects", selectedProjectId, "brand-voice"] });
      toast({ title: "Brand voice saved", description: "All future AI drafts for this project will use it." });
    },
    onError: (e: any) => toast({ title: "Failed to save", description: e?.message, variant: "destructive" }),
  });

  if (!selectedProjectId) return <p className="text-sm text-muted-foreground">Select a project first.</p>;
  if (isLoading) return <Skeleton className="h-80 w-full" />;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <Mic2 className="h-5 w-5 text-primary" /> Brand Voice
        </h1>
        <p className="text-sm text-muted-foreground">
          One place to define how {projectName || "this project"} sounds. Every AI draft — articles,
          social posts, campaign plans, outreach — uses this voice.
        </p>
      </div>

      <Tabs defaultValue="default">
        <TabsList data-testid="tabs-brand-voice">
          <TabsTrigger value="default" data-testid="tab-voice-default">Default</TabsTrigger>
          {PLATFORM_TABS.map(({ key, label }) => (
            <TabsTrigger key={key} value={key} data-testid={`tab-voice-${key}`}>{label}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="default">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Default voice</CardTitle>
              <CardDescription>Leave anything blank to fall back to sensible defaults.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ListField
                label="Tone (one per line)"
                hint='e.g. "warm and direct", "confident but not salesy"'
                value={draft.tone}
                onChange={(v) => setDraft({ ...draft, tone: v })}
                testId="input-voice-tone"
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Ideal customer (one line)</Label>
                  <Input className="mt-1" value={draft.icpOneLiner} onChange={(e) => setDraft({ ...draft, icpOneLiner: e.target.value })} data-testid="input-voice-icp" />
                </div>
                <div>
                  <Label>Brand promise</Label>
                  <Input className="mt-1" value={draft.brandPromise} onChange={(e) => setDraft({ ...draft, brandPromise: e.target.value })} data-testid="input-voice-promise" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>CTA style</Label>
                  <Input className="mt-1" placeholder='e.g. "soft ask, invite a conversation"' value={draft.ctaStyle} onChange={(e) => setDraft({ ...draft, ctaStyle: e.target.value })} data-testid="input-voice-cta" />
                </div>
                <div>
                  <Label>Copy framework</Label>
                  <Select value={draft.defaultFramework} onValueChange={(v) => setDraft({ ...draft, defaultFramework: v })}>
                    <SelectTrigger className="mt-1" data-testid="select-voice-framework"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BRAND_VOICE_FRAMEWORKS.map((f) => (
                        <SelectItem key={f} value={f}>{FRAMEWORK_LABELS[f] ?? f.toUpperCase()}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-xs text-muted-foreground">Asks the AI to structure copy with this framework.</p>
                </div>
              </div>
              <ListField
                label="Guardrails (one per line)"
                hint="Things the AI must always respect."
                value={draft.guardrails}
                onChange={(v) => setDraft({ ...draft, guardrails: v })}
                testId="input-voice-guardrails"
              />
              <ListField
                label="Banned phrases (one per line)"
                value={draft.bannedPhrases}
                onChange={(v) => setDraft({ ...draft, bannedPhrases: v })}
                testId="input-voice-banned"
              />
              <ListField
                label="Signature phrases (one per line)"
                value={draft.signaturePhrases}
                onChange={(v) => setDraft({ ...draft, signaturePhrases: v })}
                testId="input-voice-signature"
              />
              <div>
                <Label>Compliance notes</Label>
                <Textarea rows={2} className="mt-1" value={draft.complianceNotes} onChange={(e) => setDraft({ ...draft, complianceNotes: e.target.value })} data-testid="input-voice-compliance" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {PLATFORM_TABS.map(({ key, label }) => (
          <TabsContent key={key} value={key}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">{label} override</CardTitle>
                <CardDescription>
                  Only tone and signature phrases can be overridden per platform. Everything left
                  blank inherits from the Default tab.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ListField
                  label="Tone (one per line)"
                  hint={`Overrides the default tone for ${label} content only.`}
                  value={platforms[key]?.tone ?? []}
                  onChange={(v) => setPlatforms({ ...platforms, [key]: { ...(platforms[key] ?? emptyPlatform()), tone: v } })}
                  testId={`input-voice-${key}-tone`}
                />
                <ListField
                  label="Signature phrases (one per line)"
                  hint={`Overrides the default signature phrases for ${label} content only.`}
                  value={platforms[key]?.signaturePhrases ?? []}
                  onChange={(v) => setPlatforms({ ...platforms, [key]: { ...(platforms[key] ?? emptyPlatform()), signaturePhrases: v } })}
                  testId={`input-voice-${key}-signature`}
                />
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {canEdit && (
        <Button onClick={() => save.mutate()} disabled={save.isPending} data-testid="button-save-voice">
          {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save brand voice
        </Button>
      )}

      {data?.resolved && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Live preview — what the AI is told</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p data-testid="text-resolved-brand">
              <span className="font-medium">Brand:</span> {data.resolved.brand_name}
              {data.resolved.brand_tagline ? ` — ${data.resolved.brand_tagline}` : ""}
            </p>
            <p className="whitespace-pre-wrap" data-testid="text-resolved-voice">
              <span className="font-medium">Voice instructions:</span> {data.resolved.brand_voice}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
