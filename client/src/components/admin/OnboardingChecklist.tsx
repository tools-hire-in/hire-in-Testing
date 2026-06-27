import { useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useUpload } from "@/hooks/use-upload";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, ChevronRight, Sparkles, Upload } from "lucide-react";

export interface ChecklistItem {
  key: string;
  label: string;
  complete: boolean;
  section: string;
  actionPath: string;
  message: string;
  count?: number;
  applicable: boolean;
}

export interface OnboardingChecklistData {
  complete: boolean;
  overallPct: number;
  items: ChecklistItem[];
  pendingSections: string[];
  counts: { personal: number; policies: number; total: number };
}

export function useOnboardingChecklist() {
  return useQuery<OnboardingChecklistData>({
    queryKey: ["/api/onboarding/checklist"],
    refetchInterval: 300000,
  });
}

export default function OnboardingChecklist() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data, isLoading } = useOnboardingChecklist();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const { uploadFile, isUploading } = useUpload();

  const saveHeadshot = useMutation({
    mutationFn: (photoUrl: string) =>
      apiRequest("PATCH", "/api/onboarding/my-profile", { photoUrl }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/checklist"] });
      toast({ title: "Headshot uploaded" });
    },
    onError: (err: any) =>
      toast({ title: "Upload failed", description: err?.message, variant: "destructive" }),
  });

  if (isLoading || !data || data.complete) return null;

  const applicable = data.items.filter((i) => i.applicable);
  const pending = applicable.filter((i) => !i.complete);

  const handleHeadshot = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await uploadFile(file);
      if (result?.objectPath) saveHeadshot.mutate(result.objectPath);
    } catch (err: any) {
      toast({ title: "Upload failed", description: err?.message, variant: "destructive" });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Card className="border-primary/30 shadow-sm" data-testid="cc-onboarding-checklist">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Getting started
          </CardTitle>
          <span className="text-sm font-semibold text-muted-foreground" data-testid="text-onboarding-pct">
            {data.overallPct}%
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          A few quick things to set up. You can do these any time — they never block your Punch In.
        </p>
        <Progress value={data.overallPct} className="h-2 mt-2" data-testid="progress-onboarding" />
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-1 space-y-1.5">
        {applicable.map((item) => {
          const isHeadshot = item.key === "headshot";
          return (
            <div
              key={item.key}
              className={`flex items-center gap-3 rounded-lg px-2 py-2 ${
                item.complete ? "opacity-60" : "hover:bg-muted/50"
              }`}
              data-testid={`onboarding-item-${item.key}`}
            >
              {item.complete ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
              ) : (
                <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />
              )}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${item.complete ? "line-through" : ""}`}>
                  {item.label}
                  {!item.complete && item.count ? (
                    <span className="ml-2 text-xs text-muted-foreground">({item.count} left)</span>
                  ) : null}
                </p>
                {!item.complete && (
                  <p className="text-xs text-muted-foreground truncate">{item.message}</p>
                )}
              </div>
              {!item.complete &&
                (isHeadshot ? (
                  <>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleHeadshot}
                      data-testid="input-onboarding-headshot"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 h-8"
                      disabled={isUploading || saveHeadshot.isPending}
                      onClick={() => fileRef.current?.click()}
                      data-testid="button-onboarding-headshot"
                    >
                      <Upload className="h-3.5 w-3.5 mr-1.5" />
                      {isUploading || saveHeadshot.isPending ? "Uploading…" : "Upload"}
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 h-8"
                    onClick={() => setLocation(item.actionPath)}
                    data-testid={`button-onboarding-${item.key}`}
                  >
                    {item.key === "policies" ? "Review & sign" : "Set up"}
                    <ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                ))}
            </div>
          );
        })}
        {pending.length === 0 && (
          <p className="text-sm text-green-600 py-2">All set — nice work! 🎉</p>
        )}
      </CardContent>
    </Card>
  );
}
