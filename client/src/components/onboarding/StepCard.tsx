import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ClipboardCheck,
  Dumbbell,
  HelpCircle,
  MapPin,
  SkipForward,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { KnowledgeCheck, type KCItem } from "./KnowledgeCheck";

export interface OnboardingStep {
  id: string;
  track: string;
  stepNumber: number;
  title: string;
  purpose?: string | null;
  whereToFind?: string | null;
  navRoute?: string | null;
  howToUse?: string | null;
  importantRules?: string[] | null;
  isHighRisk?: boolean;
  commonMistake?: string | null;
  scenario?: string | null;
  practicalExercise?: string | null;
  knowledgeCheck?: KCItem[] | null;
  whereToGetHelp?: string | null;
  isActive?: boolean;
}

interface StepCardProps {
  step: OnboardingStep;
  stepIndex: number;
  totalSteps: number;
  track: string;
  onConfirm: (knowledgeCheckPassed: boolean) => void;
  onBack?: () => void;
  onSkip?: () => void;
  onClose?: () => void;
  isSubmitting?: boolean;
  previewMode?: boolean;
}

export function StepCard({
  step,
  stepIndex,
  totalSteps,
  track,
  onConfirm,
  onBack,
  onSkip,
  onClose,
  isSubmitting = false,
  previewMode = false,
}: StepCardProps) {
  const [scenarioOpen, setScenarioOpen] = useState(false);
  const [kcComplete, setKcComplete] = useState(false);
  const [exerciseScrolled, setExerciseScrolled] = useState(false);

  // Refs for container-relative scroll detection
  const contentContainerRef = useRef<HTMLDivElement>(null);
  const exerciseRef = useRef<HTMLDivElement>(null);

  const hasKC = Array.isArray(step.knowledgeCheck) && step.knowledgeCheck.length > 0;
  const hasExercise = !!step.practicalExercise;
  const hasScenario = !!step.scenario;
  const hasCommonMistake = step.isHighRisk && !!step.commonMistake;
  const hasRules = Array.isArray(step.importantRules) && step.importantRules.length > 0;
  const hasHelp = !!step.whereToGetHelp;

  // Steps without exercises are always "scrolled"
  useEffect(() => {
    if (!hasExercise) {
      setExerciseScrolled(true);
    }
  }, [hasExercise]);

  // Container-relative scroll detection for exercise card
  const checkExerciseVisible = useCallback(() => {
    if (!exerciseRef.current || !contentContainerRef.current) return;
    const exerciseBottom = exerciseRef.current.getBoundingClientRect().bottom;
    const containerBottom = contentContainerRef.current.getBoundingClientRect().bottom;
    if (exerciseBottom <= containerBottom + 16) {
      setExerciseScrolled(true);
    }
  }, []);

  useEffect(() => {
    if (!hasExercise || exerciseScrolled) return;
    const container = contentContainerRef.current;
    if (!container) return;
    container.addEventListener("scroll", checkExerciseVisible, { passive: true });
    // Also check immediately in case the card is already visible
    checkExerciseVisible();
    return () => container.removeEventListener("scroll", checkExerciseVisible);
  }, [hasExercise, exerciseScrolled, checkExerciseVisible]);

  const confirmDisabled =
    isSubmitting ||
    (hasKC && !kcComplete) ||
    (hasExercise && !exerciseScrolled);

  const progressPct = ((stepIndex + 1) / totalSteps) * 100;

  const trackLabel = track.charAt(0).toUpperCase() + track.slice(1) + " track";

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-8rem)] bg-background rounded-xl border shadow-sm overflow-hidden" data-testid="step-card">
      {/* ── Header ── */}
      <div className="shrink-0 px-6 pt-5 pb-4 border-b space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-[10px] tracking-wide uppercase font-semibold" data-testid="badge-track">
              {trackLabel}
            </Badge>
            {step.isHighRisk && (
              <Badge className="bg-red-600 hover:bg-red-700 text-white text-[10px] tracking-wide uppercase font-bold gap-1" data-testid="badge-high-risk">
                <AlertTriangle className="h-3 w-3" />
                HIGH RISK
              </Badge>
            )}
          </div>
          {onClose && (
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose} data-testid="button-close-step">
              <span className="sr-only">Close</span>✕
            </Button>
          )}
        </div>

        <div>
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-xs text-muted-foreground">
              Step {stepIndex + 1} of {totalSteps}
            </span>
            <span className="text-xs text-muted-foreground">
              {Math.round(progressPct)}%
            </span>
          </div>
          <Progress value={progressPct} className="h-1.5" data-testid="step-progress" />
        </div>

        <h2 className="text-lg font-bold leading-tight" data-testid="step-title">
          {step.title}
        </h2>
      </div>

      {/* ── Scrollable content ── */}
      <div
        ref={contentContainerRef}
        className="flex-1 overflow-y-auto px-6 py-4 space-y-5"
      >
        {/* Purpose */}
        {step.purpose && (
          <div data-testid="step-purpose">
            <p className="text-sm text-muted-foreground leading-relaxed">{step.purpose}</p>
          </div>
        )}

        {/* Where to find (nav hint chip) */}
        {step.whereToFind && (
          <div className="flex items-center gap-2" data-testid="step-where-to-find">
            <MapPin className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm">
              <span className="text-muted-foreground">Find it at: </span>
              {step.navRoute ? (
                <a
                  href={step.navRoute}
                  className="font-medium text-primary underline-offset-2 hover:underline"
                  data-testid="link-nav-route"
                >
                  {step.whereToFind}
                </a>
              ) : (
                <span className="font-medium">{step.whereToFind}</span>
              )}
            </span>
          </div>
        )}

        {/* How to use (Markdown) */}
        {step.howToUse && (
          <div className="prose prose-sm dark:prose-invert max-w-none" data-testid="step-how-to-use">
            <ReactMarkdown>{step.howToUse}</ReactMarkdown>
          </div>
        )}

        {/* Important rules */}
        {hasRules && (
          <div className="space-y-1.5" data-testid="step-important-rules">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Important Rules
            </p>
            <ul className="space-y-1">
              {(step.importantRules as string[]).map((rule, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                  <span className="leading-relaxed">{rule}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* HIGH RISK — Common Mistake callout */}
        {hasCommonMistake && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 px-4 py-3" data-testid="step-common-mistake">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                ⚠️ Common Mistake
              </p>
              <p className="text-sm text-amber-900 dark:text-amber-200 leading-relaxed">
                {step.commonMistake}
              </p>
            </div>
          </div>
        )}

        {/* Scenario accordion (HIGH RISK) */}
        {hasScenario && (
          <Collapsible open={scenarioOpen} onOpenChange={setScenarioOpen}>
            <CollapsibleTrigger asChild>
              <button
                className="flex items-center gap-2 text-sm text-primary font-medium hover:underline underline-offset-2"
                data-testid="button-toggle-scenario"
              >
                <ChevronDown
                  className={`h-4 w-4 transition-transform duration-200 ${scenarioOpen ? "rotate-180" : ""}`}
                />
                See a real example
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 rounded-lg border bg-muted/40 px-4 py-3" data-testid="step-scenario">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                  Scenario
                </p>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{step.scenario!}</ReactMarkdown>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Practical Exercise card — scroll detection target */}
        {hasExercise && (
          <div
            ref={exerciseRef}
            className="rounded-lg border-2 border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-950/30 px-4 py-3 space-y-2"
            data-testid="step-practical-exercise"
          >
            <div className="flex items-center gap-2">
              <Dumbbell className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-bold uppercase tracking-wide text-blue-700 dark:text-blue-400">
                Practical Exercise
              </span>
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{step.practicalExercise!}</ReactMarkdown>
            </div>
            {!exerciseScrolled && (
              <p className="text-xs text-blue-600 dark:text-blue-400 italic">
                Scroll down past this card to enable the confirm button.
              </p>
            )}
          </div>
        )}

        {/* Knowledge Check */}
        {hasKC && (
          <KnowledgeCheck
            items={step.knowledgeCheck as KCItem[]}
            onComplete={(done) => setKcComplete(done)}
          />
        )}

        {/* Where to get help (footer) */}
        {hasHelp && (
          <div className="flex items-start gap-2 rounded-lg border bg-muted/30 px-3 py-2.5" data-testid="step-where-to-get-help">
            <HelpCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground">Need help? </span>
              {step.whereToGetHelp}
            </div>
          </div>
        )}

        {/* Spacer so bottom content is scrollable past */}
        <div className="h-4" />
      </div>

      {/* ── Footer actions ── */}
      <div className="shrink-0 border-t px-6 py-4 flex items-center justify-between gap-3 bg-background">
        <div className="flex items-center gap-2">
          {onBack && stepIndex > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="gap-1.5"
              data-testid="button-step-back"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
          )}
          {onSkip && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onSkip}
              className="gap-1.5 text-muted-foreground"
              data-testid="button-step-skip"
            >
              <SkipForward className="h-4 w-4" />
              Skip for now
            </Button>
          )}
        </div>

        <Button
          onClick={() => onConfirm(kcComplete)}
          disabled={confirmDisabled}
          className="gap-2 min-w-[120px]"
          data-testid="button-step-confirm"
        >
          <ClipboardCheck className="h-4 w-4" />
          {previewMode
            ? stepIndex === totalSteps - 1
              ? "End preview"
              : "Next (preview)"
            : isSubmitting
              ? "Saving…"
              : stepIndex === totalSteps - 1
                ? "Complete!"
                : "Got it, next →"}
        </Button>
      </div>
    </div>
  );
}
