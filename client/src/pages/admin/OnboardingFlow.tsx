import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Redirect } from "wouter";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { StepCard, type OnboardingStep } from "@/components/onboarding/StepCard";
import { useAuth } from "@/hooks/use-auth";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Rocket } from "lucide-react";

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

export default function OnboardingFlow() {
  const { user } = useAuth();
  const { isEnabled, isLoading: flagsLoading } = useFeatureFlags();
  const [, setLocation] = useLocation();

  const flowEnabled = isEnabled("onboarding_flow_enabled");
  const enforceAlways = isEnabled("onboarding_enforce_always");

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
            <Button onClick={() => setLocation("/admin/my-desk")}>Go to Dashboard</Button>
          </div>
        </div>
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
            <Button onClick={() => setLocation("/admin/my-desk")} className="gap-2" data-testid="button-go-to-dashboard">
              <Rocket className="h-4 w-4" />
              Go to Dashboard
            </Button>
          </div>
        </div>
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
    </AdminLayout>
  );
}
