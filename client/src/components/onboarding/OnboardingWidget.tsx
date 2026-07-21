import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { CheckCircle2, ChevronRight, X } from "lucide-react";

interface OnboardingProgress {
  track: string;
  totalSteps: number;
  completedCount: number;
  progress: {
    snoozed?: boolean;
    completedAt?: string | null;
  } | null;
}

function lsKey(suffix: string, userId: string) {
  return `onboarding_widget_${suffix}_${userId}`;
}

export function OnboardingWidget() {
  const { user } = useAuth();
  const { isEnabled } = useFeatureFlags();
  const flowEnabled = isEnabled("onboarding_flow_enabled");
  const enforceAlways = isEnabled("onboarding_enforce_always");

  const userId = user?.id ?? "";

  const [dismissed, setDismissed] = useState(() => {
    if (!userId) return false;
    try { return localStorage.getItem(lsKey("dismiss", userId)) === "1"; } catch { return false; }
  });

  // Permanent fade-out persisted in localStorage (survives refresh)
  const [fadedOut, setFadedOut] = useState(() => {
    if (!userId) return false;
    try { return localStorage.getItem(lsKey("faded", userId)) === "1"; } catch { return false; }
  });

  const { data: progressData } = useQuery<OnboardingProgress>({
    queryKey: ["/api/onboarding/progress"],
    enabled: !!user && flowEnabled,
    staleTime: 60000,
  });

  const total = progressData?.totalSteps ?? 0;
  const completed = progressData?.completedCount ?? 0;
  const isComplete = total > 0 && completed >= total;

  // Persist fade-out permanently when complete (unless enforce_always)
  useEffect(() => {
    if (!userId || !isComplete || enforceAlways) return;
    if (fadedOut) return;
    const t = setTimeout(() => {
      setFadedOut(true);
      try { localStorage.setItem(lsKey("faded", userId), "1"); } catch {}
    }, 3000);
    return () => clearTimeout(t);
  }, [userId, isComplete, enforceAlways, fadedOut]);

  // Re-sync dismissed from localStorage when userId becomes available
  useEffect(() => {
    if (!userId) return;
    try { setDismissed(localStorage.getItem(lsKey("dismiss", userId)) === "1"); } catch {}
    try { setFadedOut(localStorage.getItem(lsKey("faded", userId)) === "1"); } catch {}
  }, [userId]);

  const handleDismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(lsKey("dismiss", userId), "1"); } catch {}
  };

  const handleExpand = () => {
    setDismissed(false);
    try { localStorage.removeItem(lsKey("dismiss", userId)); } catch {}
  };

  if (!flowEnabled || !user || !progressData || total === 0) return null;
  if (fadedOut) return null;

  // Collapsed: pulsing green dot
  if (dismissed && !isComplete) {
    return (
      <button
        onClick={handleExpand}
        className="fixed bottom-6 right-6 z-50 w-4 h-4 rounded-full bg-green-500 animate-pulse shadow-lg hover:scale-125 transition-transform"
        title="Continue Onboarding"
        data-testid="widget-onboarding-dot"
      />
    );
  }

  // Complete state
  if (isComplete) {
    return (
      <div
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-green-600 text-white text-sm font-medium px-4 py-2.5 rounded-full shadow-lg"
        data-testid="widget-onboarding-complete"
      >
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        ✓ Onboarding complete
      </div>
    );
  }

  // Normal expanded widget
  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-background border shadow-lg rounded-full px-4 py-2.5 text-sm"
      data-testid="widget-onboarding"
    >
      <div className="flex items-center gap-2">
        <div className="relative w-6 h-6">
          <svg className="w-6 h-6 -rotate-90" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-muted/40" />
            <circle
              cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.5"
              className="text-green-500"
              strokeDasharray={`${2 * Math.PI * 9}`}
              strokeDashoffset={`${2 * Math.PI * 9 * (1 - completed / total)}`}
              strokeLinecap="round"
            />
          </svg>
        </div>
        <span className="text-muted-foreground">
          Step <span className="font-semibold text-foreground">{completed}</span> of <span className="font-semibold text-foreground">{total}</span> complete
        </span>
      </div>

      <Link
        href="/admin/onboarding"
        className="flex items-center gap-1 font-semibold text-primary hover:underline underline-offset-2"
        data-testid="link-widget-continue"
      >
        Continue
        <ChevronRight className="h-3.5 w-3.5" />
      </Link>

      <button
        onClick={handleDismiss}
        className="text-muted-foreground hover:text-foreground transition-colors"
        data-testid="button-widget-dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
