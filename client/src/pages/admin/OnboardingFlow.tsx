import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Redirect } from "wouter";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { StepCard, type OnboardingStep } from "@/components/onboarding/StepCard";
import { useAuth } from "@/hooks/use-auth";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, Eye, Rocket, X } from "lucide-react";

interface ProgressResponse {
  track: string;
  steps: OnboardingStep[];
  totalSteps: number;
  completedCount: number;
  progress: {
    completedStepIds?: string[];
    knowledgeCheckPassed?: Record<string, boolean>;
    snoozed?: boolean;
    completedAt?: string | null;
  } | null;
}

const PREVIEW_TRACKS = [
  { value: "employee", label: "Employee" },
  { value: "manager", label: "Manager" },
  { value: "hr", label: "HR" },
  { value: "admin", label: "Admin" },
  { value: "executive", label: "Executive" },
];

// Admin role uses the same "hr" track content
function resolvePreviewTrack(value: string): string {
  return value === "admin" ? "hr" : value;
}

// ── Preview mode overlay ──────────────────────────────────────────────────────

interface PreviewOverlayProps {
  onClose: () => void;
}

function PreviewOverlay({ onClose }: PreviewOverlayProps) {
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null);
  const [previewStepIndex, setPreviewStepIndex] = useState(0);
  const [previewDone, setPreviewDone] = useState(false);

  const resolvedTrack = selectedTrack ? resolvePreviewTrack(selectedTrack) : null;

  const { data: previewSteps, isLoading } = useQuery<OnboardingStep[]>({
    queryKey: ["/api/onboarding/steps", { track: resolvedTrack }],
    enabled: !!resolvedTrack,
    staleTime: 60000,
    select: (rows) => rows.filter((s) => s.isActive !== false),
  });

  const steps = previewSteps ?? [];

  const handleConfirm = () => {
    const next = previewStepIndex + 1;
    if (next >= steps.length) {
      setPreviewDone(true);
    } else {
      setPreviewStepIndex(next);
    }
  };

  const handleBack = () => {
    if (previewStepIndex > 0) setPreviewStepIndex(previewStepIndex - 1);
  };

  const handleTrackChange = (track: string) => {
    setSelectedTrack(track);
    setPreviewStepIndex(0);
    setPreviewDone(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col" data-testid="preview-overlay">
      {/* Preview banner */}
      <div className="shrink-0 bg-amber-500 dark:bg-amber-600 text-white px-4 py-2 flex items-center justify-between gap-3" data-testid="preview-banner">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 shrink-0" />
          <span className="font-semibold text-sm tracking-wide">PREVIEW MODE — no progress recorded</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-white hover:text-white hover:bg-white/20 h-7 gap-1.5"
          onClick={onClose}
          data-testid="button-exit-preview"
        >
          <X className="h-3.5 w-3.5" />
          Exit Preview
        </Button>
      </div>

      {/* Track selector */}
      <div className="shrink-0 border-b bg-card px-6 py-3 flex items-center gap-3" data-testid="preview-track-selector">
        <span className="text-sm text-muted-foreground font-medium">Previewing track:</span>
        <Select value={selectedTrack ?? ""} onValueChange={handleTrackChange}>
          <SelectTrigger className="h-8 text-sm w-44" data-testid="select-preview-track">
            <SelectValue placeholder="Select a track…" />
          </SelectTrigger>
          <SelectContent>
            {PREVIEW_TRACKS.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto">
        {!selectedTrack && (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center space-y-2 max-w-sm">
              <Eye className="h-10 w-10 text-muted-foreground mx-auto opacity-50" />
              <p className="font-medium">Select a track above to begin previewing.</p>
              <p className="text-sm text-muted-foreground">Steps render exactly as the target role would see them. No progress is recorded.</p>
            </div>
          </div>
        )}

        {selectedTrack && isLoading && (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <div className="w-8 h-8 border-2 border-current border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Loading {PREVIEW_TRACKS.find((t) => t.value === selectedTrack)?.label ?? selectedTrack} track…</span>
            </div>
          </div>
        )}

        {selectedTrack && !isLoading && steps.length === 0 && (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center space-y-2">
              <p className="text-muted-foreground text-sm">No active steps configured for the <strong>{PREVIEW_TRACKS.find((t) => t.value === selectedTrack)?.label ?? selectedTrack}</strong> track.</p>
            </div>
          </div>
        )}

        {selectedTrack && !isLoading && steps.length > 0 && previewDone && (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center space-y-4 max-w-md">
              <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
              <h2 className="text-xl font-bold">End of track preview</h2>
              <p className="text-muted-foreground text-sm">You've walked through all {steps.length} steps in the <strong>{selectedTrack}</strong> track. No progress was recorded.</p>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={() => { setPreviewStepIndex(0); setPreviewDone(false); }} data-testid="button-preview-restart">
                  Restart Track
                </Button>
                <Button onClick={onClose} data-testid="button-preview-done">
                  Exit Preview
                </Button>
              </div>
            </div>
          </div>
        )}

        {selectedTrack && !isLoading && steps.length > 0 && !previewDone && (
          <div className="max-w-2xl mx-auto py-6 px-4" data-testid="preview-step-wrapper">
            <StepCard
              key={`preview-${selectedTrack}-${previewStepIndex}`}
              step={steps[previewStepIndex]}
              stepIndex={previewStepIndex}
              totalSteps={steps.length}
              track={resolvedTrack ?? selectedTrack}
              onConfirm={handleConfirm}
              onBack={previewStepIndex > 0 ? handleBack : undefined}
              isSubmitting={false}
              previewMode={true}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Track selector dialog ─────────────────────────────────────────────────────

interface PreviewStartDialogProps {
  open: boolean;
  onClose: () => void;
  onStart: () => void;
}

function PreviewStartDialog({ open, onClose, onStart }: PreviewStartDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-testid="dialog-preview-start">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-amber-500" />
            Preview Track
          </DialogTitle>
          <DialogDescription>
            Walk through any onboarding track as an admin without recording any progress. Useful for demos and QA.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} data-testid="button-preview-dialog-cancel">Cancel</Button>
          <Button onClick={onStart} className="gap-2" data-testid="button-preview-dialog-start">
            <Eye className="h-4 w-4" />
            Open Preview
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function OnboardingFlow() {
  const { user } = useAuth();
  const { isEnabled, isLoading: flagsLoading } = useFeatureFlags();
  const [, setLocation] = useLocation();

  const flowEnabled = isEnabled("onboarding_flow_enabled");
  const enforceAlways = isEnabled("onboarding_enforce_always");

  const isAdmin = user?.role === "super_admin" || user?.role === "admin";

  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const { data, isLoading } = useQuery<ProgressResponse>({
    queryKey: ["/api/onboarding/progress"],
    enabled: !!user && flowEnabled,
    staleTime: 30000,
  });

  // Determine starting step: enforceAlways → always start at 0; otherwise → first incomplete
  const startIndex = (() => {
    if (!data) return 0;
    if (enforceAlways) return 0;
    const completedIds = data.progress?.completedStepIds ?? [];
    const firstIncomplete = data.steps.findIndex((s) => !completedIds.includes(s.id));
    return firstIncomplete === -1 ? 0 : firstIncomplete;
  })();

  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const [allDone, setAllDone] = useState(false);

  // Lazy-init stepIndex after data loads
  const resolvedIndex = stepIndex !== null ? stepIndex : startIndex;

  const completeMutation = useMutation({
    mutationFn: async ({ stepId, knowledgeCheckPassed }: { stepId: string; knowledgeCheckPassed: boolean }) => {
      await apiRequest("POST", `/api/onboarding/step/${stepId}/complete`, { knowledgeCheckPassed });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/progress"] });
    },
  });

  const snoozeMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/onboarding/snooze", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/progress"] });
    },
  });

  // Spec: flag OFF → return null immediately (renders nothing)
  if (!flagsLoading && !flowEnabled) {
    return <Redirect to="/admin/my-desk" />;
  }

  if (isLoading || flagsLoading || !data) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <div className="w-8 h-8 border-2 border-current border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Loading your onboarding guide…</span>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (data.steps.length === 0) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-3 max-w-sm">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
            <h2 className="text-xl font-bold">No steps configured yet</h2>
            <p className="text-muted-foreground text-sm">
              Onboarding steps for your role haven't been set up yet. Check back soon.
            </p>
            <div className="flex flex-col items-center gap-2">
              <Button onClick={() => setLocation("/admin/my-desk")}>Go to Dashboard</Button>
              {isAdmin && (
                <Button variant="outline" className="gap-2" onClick={() => setShowPreviewDialog(true)} data-testid="button-preview-track">
                  <Eye className="h-4 w-4" />
                  Preview Track
                </Button>
              )}
            </div>
          </div>
        </div>
        <PreviewStartDialog open={showPreviewDialog} onClose={() => setShowPreviewDialog(false)} onStart={() => { setShowPreviewDialog(false); setPreviewOpen(true); }} />
        {previewOpen && <PreviewOverlay onClose={() => setPreviewOpen(false)} />}
      </AdminLayout>
    );
  }

  const handleConfirm = async (kcPassed: boolean) => {
    const step = data.steps[resolvedIndex];
    if (!step) return;

    const nextIndex = resolvedIndex + 1;
    const isLast = nextIndex >= data.steps.length;

    // Optimistic advance
    if (isLast) {
      setAllDone(true);
    } else {
      setStepIndex(nextIndex);
    }

    completeMutation.mutate({ stepId: step.id, knowledgeCheckPassed: kcPassed });
  };

  const handleBack = () => {
    if (resolvedIndex > 0) {
      setStepIndex(resolvedIndex - 1);
    }
  };

  const handleSkip = async () => {
    await snoozeMutation.mutateAsync();
    setLocation("/admin/my-desk");
  };

  if (allDone || (data.completedCount >= data.totalSteps && !enforceAlways)) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4 max-w-md">
            <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold" data-testid="text-onboarding-complete">
                Onboarding complete! 🎉
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                You've reviewed all the steps for your role. You're ready to go — your portal is fully unlocked.
              </p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Button onClick={() => setLocation("/admin/my-desk")} className="gap-2" data-testid="button-go-to-dashboard">
                <Rocket className="h-4 w-4" />
                Go to Dashboard
              </Button>
              {isAdmin && (
                <Button variant="outline" className="gap-2" onClick={() => setShowPreviewDialog(true)} data-testid="button-preview-track">
                  <Eye className="h-4 w-4" />
                  Preview Track
                </Button>
              )}
            </div>
          </div>
        </div>
        <PreviewStartDialog open={showPreviewDialog} onClose={() => setShowPreviewDialog(false)} onStart={() => { setShowPreviewDialog(false); setPreviewOpen(true); }} />
        {previewOpen && <PreviewOverlay onClose={() => setPreviewOpen(false)} />}
      </AdminLayout>
    );
  }

  const currentStep = data.steps[resolvedIndex];
  if (!currentStep) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-2">
            <p className="text-muted-foreground">Step not found.</p>
            <Button variant="outline" onClick={() => setStepIndex(0)}>Start from beginning</Button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      {/* Admin toolbar */}
      {isAdmin && (
        <div className="flex justify-end mb-2" data-testid="admin-onboarding-toolbar">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-8 text-sm"
            onClick={() => setShowPreviewDialog(true)}
            data-testid="button-preview-track"
          >
            <Eye className="h-3.5 w-3.5" />
            Preview Track
          </Button>
        </div>
      )}

      <div className="max-w-2xl mx-auto py-6" data-testid="onboarding-flow">
        {/* key by step.id resets all per-step state (kcComplete, exerciseScrolled, etc.) */}
        <StepCard
          key={currentStep.id}
          step={currentStep}
          stepIndex={resolvedIndex}
          totalSteps={data.steps.length}
          track={data.track}
          onConfirm={handleConfirm}
          onBack={resolvedIndex > 0 ? handleBack : undefined}
          onSkip={handleSkip}
          isSubmitting={completeMutation.isPending}
        />
      </div>

      <PreviewStartDialog
        open={showPreviewDialog}
        onClose={() => setShowPreviewDialog(false)}
        onStart={() => { setShowPreviewDialog(false); setPreviewOpen(true); }}
      />
      {previewOpen && <PreviewOverlay onClose={() => setPreviewOpen(false)} />}
    </AdminLayout>
  );
}
