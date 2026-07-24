import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  GraduationCap, CheckCircle, Lock, ChevronRight, Clock, BookOpen,
  Loader2, AlertCircle, Trophy, Download, ArrowLeft, X, AlertTriangle,
  ShieldAlert, CalendarPlus, Send, ExternalLink, Award, WifiOff, ShieldCheck,
  FileQuestion, ChevronDown, ChevronUp,
} from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { V2PageHeader } from "@/components/admin/V2PageHeader";
import { useNewLook } from "@/hooks/use-new-look";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

const STATUS_COLORS: Record<string, string> = {
  not_started: "bg-slate-100 text-slate-600",
  in_progress: "bg-amber-100 text-amber-700",
  completed: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-700",
};

function formatDate(d: string | null | undefined) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function DwellTimer({
  minSeconds,
  assignmentId,
  sectionId,
}: {
  minSeconds: number;
  assignmentId: string;
  sectionId: string;
}) {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const postRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setElapsed(prev => {
        const next = prev + 1;
        elapsedRef.current = next;
        return next;
      });
    }, 1000);

    postRef.current = setInterval(async () => {
      await apiRequest("POST", `/api/onboarding/progress/${assignmentId}/${sectionId}/dwell`, { seconds: elapsedRef.current });
    }, 15000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (postRef.current) clearInterval(postRef.current);
      if (elapsedRef.current > 0) {
        apiRequest("POST", `/api/onboarding/progress/${assignmentId}/${sectionId}/dwell`, { seconds: elapsedRef.current });
      }
    };
  }, []);

  const pct = Math.min(100, (elapsed / minSeconds) * 100);
  const done = elapsed >= minSeconds;

  if (done) return null;

  return (
    <div className="bg-muted/40 border rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Clock className="h-4 w-4" />
          Suggested reading time: {minSeconds}s
        </span>
        <span className="font-mono text-xs">{elapsed}s read</span>
      </div>
      <Progress value={pct} className="h-1.5" />
    </div>
  );
}

function ScenarioBanner({ prompt }: { prompt: string }) {
  return (
    <div data-testid="quiz-scenario-question" className="rounded-md overflow-hidden border border-[#1F3A6E]/30 mb-3">
      <div className="bg-[#1F3A6E] px-3 py-1.5 flex items-center gap-2">
        <FileQuestion className="h-3.5 w-3.5 text-white shrink-0" />
        <span className="text-xs font-bold text-white uppercase tracking-wider">Case Scenario</span>
      </div>
      <div className="bg-[#1F3A6E]/5 px-4 py-3">
        <p className="text-sm text-foreground leading-relaxed">{prompt}</p>
      </div>
    </div>
  );
}

function SingleQuestionCard({
  q,
  index,
  total,
  selected,
  onSelect,
  revealed,
}: {
  q: any; index: number; total: number;
  selected: string | null;
  onSelect: (optId: string) => void;
  revealed: boolean;
}) {
  const isScenario = q.questionType === "scenario_single_choice";
  return (
    <div
      className="border rounded-lg p-4 space-y-3 bg-white"
      data-testid={isScenario ? "quiz-scenario-question" : "quiz-standard-question"}
    >
      <div className="flex items-start gap-2">
        <span className="text-xs font-semibold text-muted-foreground shrink-0 mt-0.5">Q{index + 1}/{total}</span>
        {isScenario && (
          <span className="text-xs font-semibold text-[#1F3A6E] bg-[#1F3A6E]/10 px-2 py-0.5 rounded shrink-0">Case</span>
        )}
      </div>
      {isScenario ? (
        <ScenarioBanner prompt={q.questionText} />
      ) : (
        <p className="text-sm font-medium text-foreground">{q.questionText}</p>
      )}
      <div className="space-y-2">
        {q.options.map((opt: any) => {
          const isChosen = selected === opt.id;
          const isCorrectReveal = revealed && opt.isCorrect;
          const isWrongReveal = revealed && isChosen && !opt.isCorrect;
          return (
            <label
              key={opt.id}
              className={`flex items-start gap-3 p-2.5 rounded-md border cursor-pointer transition-colors text-sm
                ${isCorrectReveal ? "bg-green-50 border-green-400 text-green-800" : ""}
                ${isWrongReveal ? "bg-red-50 border-red-400 text-red-800" : ""}
                ${!revealed && isChosen ? "bg-blue-50 border-blue-400" : ""}
                ${!revealed && !isChosen ? "hover:bg-muted/60 border-border" : ""}
              `}
            >
              <input
                type="radio"
                name={`quiz-multi-${q.id}`}
                value={opt.id}
                checked={isChosen}
                onChange={() => !revealed && onSelect(opt.id)}
                disabled={revealed}
                className="mt-0.5 shrink-0"
              />
              <span className="flex-1">
                <span className="font-mono text-xs text-muted-foreground mr-1.5">{opt.orderIndex !== undefined ? String.fromCharCode(65 + opt.orderIndex) : ""}.</span>
                {opt.optionText}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function QuizBlock({
  quiz,
  assignmentId,
  sectionId,
  onPassed,
}: {
  quiz: any;
  assignmentId: string;
  sectionId: string;
  onPassed: () => void;
}) {
  const { toast } = useToast();

  // ── Multi-question mode (v3 Quiz Bank) ─────────────────────────────────────
  const isMulti = quiz?.isMulti === true && Array.isArray(quiz?.questions);

  const [selections, setSelections] = useState<Record<string, string>>({}); // questionId → optionId
  const [batchResult, setBatchResult] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ── Single-question mode (legacy) ──────────────────────────────────────────
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);

  if (isMulti) {
    const questions: any[] = quiz.questions;
    const allAnswered = questions.every(q => selections[q.id]);
    const answeredCount = Object.keys(selections).length;

    const handleBatchSubmit = async () => {
      if (!allAnswered) return;
      setSubmitting(true);
      try {
        const answers = questions.map(q => ({ questionId: q.id, optionId: selections[q.id] }));
        const res = await apiRequest("POST", `/api/onboarding/progress/${assignmentId}/${sectionId}/quiz-batch`, { answers });
        const data = await res.json();
        setBatchResult(data);
        if (data.passed) onPassed();
      } catch {
        toast({ title: "Failed to submit quiz", variant: "destructive" });
      } finally {
        setSubmitting(false);
      }
    };

    const handleRetake = () => {
      setSelections({});
      setBatchResult(null);
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            Module Assessment — {questions.length} Questions
          </p>
          {!batchResult && (
            <span className="text-xs text-muted-foreground">{answeredCount}/{questions.length} answered</span>
          )}
        </div>

        {batchResult && (
          <div className={`rounded-lg p-4 border ${batchResult.passed ? "bg-green-50 border-green-300 text-green-900" : "bg-red-50 border-red-300 text-red-900"}`}>
            <p className="font-bold text-base mb-1">
              {batchResult.passed ? "✓ Quiz Passed!" : "✗ Quiz Not Passed"}
            </p>
            <p className="text-sm">
              Score: <strong>{batchResult.scorePercent}%</strong> ({batchResult.correctCount}/{batchResult.totalQuestions} correct)
              — Required: {batchResult.requiredPassScore}%
            </p>
          </div>
        )}

        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {questions.map((q: any, idx: number) => {
            const qResult = batchResult?.results?.find((r: any) => r.questionId === q.id);
            return (
              <div key={q.id} className="space-y-1">
                <SingleQuestionCard
                  q={q}
                  index={idx}
                  total={questions.length}
                  selected={selections[q.id] ?? null}
                  onSelect={(optId) => setSelections(prev => ({ ...prev, [q.id]: optId }))}
                  revealed={!!batchResult}
                />
                {batchResult && qResult && (
                  <div className={`text-xs px-3 py-2 rounded ${qResult.isCorrect ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800"}`}>
                    {qResult.isCorrect ? "✓ Correct" : `✗ Correct answer: ${qResult.correctOption}`}
                    {qResult.explanation && <span className="ml-2 text-muted-foreground">— {qResult.explanation}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {!batchResult && (
          <Button
            onClick={handleBatchSubmit}
            disabled={!allAnswered || submitting}
            className="w-full"
            data-testid="button-submit-quiz"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Submit All {questions.length} Answers
          </Button>
        )}
        {batchResult && !batchResult.passed && (
          <Button size="sm" variant="outline" onClick={handleRetake} className="w-full" data-testid="button-retake-quiz">
            Retake Quiz
          </Button>
        )}
      </div>
    );
  }

  // ── Single-question legacy mode ─────────────────────────────────────────────
  const isScenario = quiz.questionType === "scenario_single_choice";

  const handleSubmit = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const res = await apiRequest("POST", `/api/onboarding/progress/${assignmentId}/${sectionId}/quiz`, { optionId: selected });
      const data = await res.json();
      setResult(data);
      if (data.passed) onPassed();
    } catch {
      toast({ title: "Failed to submit answer", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const canRetry = result && !result.passed && result.attempts < 3;

  return (
    <div
      className="border rounded-lg p-4 space-y-4 bg-muted/30"
      data-testid={isScenario ? "quiz-scenario-question" : "quiz-standard-question"}
    >
      <p className="font-semibold text-sm flex items-center gap-2">
        <AlertCircle className="h-4 w-4 text-blue-600" />
        Comprehension Check
      </p>

      {isScenario ? (
        <ScenarioBanner prompt={quiz.questionText} />
      ) : (
        <p className="text-sm font-medium">{quiz.questionText}</p>
      )}

      <div className="space-y-2">
        {quiz.options.map((opt: any) => {
          const isChosen = selected === opt.id;
          const isCorrectReveal = result?.passed && opt.id === result?.correctOptionId;
          const isWrongReveal = result && !result.isCorrect && isChosen;
          return (
            <label
              key={opt.id}
              className={`flex items-center gap-3 p-2.5 rounded-md border cursor-pointer transition-colors text-sm
                ${isCorrectReveal ? "bg-green-50 border-green-400 text-green-800" : ""}
                ${isWrongReveal ? "bg-red-50 border-red-400 text-red-800" : ""}
                ${!result && isChosen ? "bg-blue-50 border-blue-400" : ""}
                ${!result && !isChosen ? "hover:bg-muted border-border" : ""}
              `}
            >
              <input
                type="radio"
                name={`quiz-${sectionId}`}
                value={opt.id}
                checked={isChosen}
                onChange={() => !result && setSelected(opt.id)}
                disabled={!!result}
              />
              {opt.optionText}
            </label>
          );
        })}
      </div>

      {result && (
        <div className={`text-sm p-3 rounded-md ${result.isCorrect ? "bg-green-50 text-green-800 border border-green-200" : "bg-amber-50 text-amber-800 border border-amber-200"}`}>
          <p className="font-semibold mb-1">{result.isCorrect ? "✓ Correct!" : result.passed ? "✓ Moving on — correct answer shown above" : `✗ Incorrect (attempt ${result.attempts}/3)`}</p>
          {result.explanation && <p>{result.explanation}</p>}
        </div>
      )}

      {!result && (
        <Button size="sm" onClick={handleSubmit} disabled={!selected || submitting} data-testid="button-submit-quiz">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Submit Answer
        </Button>
      )}
      {canRetry && (
        <Button size="sm" variant="outline" onClick={() => { setResult(null); setSelected(null); }}>
          Try Again
        </Button>
      )}
    </div>
  );
}

function SectionPlayer({
  section,
  isUnlocked,
  isCompleted,
  assignmentId,
  userName,
  onCompleted,
}: {
  section: any;
  isUnlocked: boolean;
  isCompleted: boolean;
  assignmentId: string;
  userName: string;
  onCompleted: () => void;
}) {
  const { toast } = useToast();
  const [step, setStep] = useState<"read" | "quiz" | "signoff">("read");
  const [quizPassed, setQuizPassed] = useState(false);
  const [typedName, setTypedName] = useState("");
  const [acknowledging, setAcknowledging] = useState(false);
  const [viewStarted, setViewStarted] = useState(false);

  const hasQuiz = !!section.quiz;
  const nameMatch = typedName.trim().toLowerCase() === userName.trim().toLowerCase();

  useEffect(() => {
    if (isUnlocked && !isCompleted && !viewStarted) {
      setViewStarted(true);
      apiRequest("POST", `/api/onboarding/progress/${assignmentId}/${section.id}/view`);
    }
    setStep("read");
    setQuizPassed(section.progress?.quizPassed ?? false);
  }, [section.id]);

  const handleAcknowledge = async () => {
    if (!nameMatch) return;
    setAcknowledging(true);
    try {
      const res = await apiRequest("POST", `/api/onboarding/progress/${assignmentId}/${section.id}/acknowledge`, { typedName: typedName.trim() });
      const data = await res.json();
      if (data.autoCompleted) {
        toast({ title: "Track completed! All sections acknowledged." });
        queryClient.invalidateQueries({ queryKey: ["/api/onboarding/my-assignments"] });
        queryClient.invalidateQueries({ queryKey: ["/api/onboarding/my-training-alerts"] });
        queryClient.invalidateQueries({ queryKey: ["/api/onboarding/compliance-status"] });
        queryClient.invalidateQueries({ queryKey: ["/api/rayo-academy/my-assignments"] });
      } else {
        toast({ title: "Section acknowledged!" });
      }
      onCompleted();
    } catch {
      toast({ title: "Failed to acknowledge", variant: "destructive" });
    } finally {
      setAcknowledging(false);
    }
  };

  if (!isUnlocked) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Lock className="h-12 w-12 mb-3 opacity-30" />
        <p className="font-medium">Complete previous sections to unlock this one</p>
      </div>
    );
  }

  if (isCompleted) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg p-4">
          <CheckCircle className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Section completed and signed off</p>
            {section.acknowledgement && (
              <p className="text-sm text-green-600 mt-0.5">
                Signed as "{section.acknowledgement.typedName}" on {formatDate(section.acknowledgement.acknowledgedAt)}
              </p>
            )}
          </div>
        </div>
        <div className="prose prose-sm max-w-none">
          <pre className="whitespace-pre-wrap font-sans text-sm text-muted-foreground leading-relaxed bg-muted/30 p-4 rounded-lg border">
            {section.body}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm">
        {["read", "quiz", "signoff"].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${step === s ? "bg-blue-600 text-white" : "bg-muted text-muted-foreground"}`}>
              {i + 1}. {s === "read" ? "Read" : s === "quiz" ? "Quiz" : "Sign Off"}
            </span>
          </div>
        ))}
      </div>

      {step === "read" && (
        <>
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground bg-muted/20 p-4 rounded-lg border">
            {section.body}
          </pre>

          {(section.progress?.dwellSeconds ?? 0) < section.minDwellSeconds && (
            <DwellTimer
              minSeconds={section.minDwellSeconds}
              assignmentId={assignmentId}
              sectionId={section.id}
            />
          )}

          <Button onClick={() => setStep(hasQuiz ? "quiz" : "signoff")} data-testid="button-continue-to-quiz">
            Continue →
          </Button>
        </>
      )}

      {step === "quiz" && hasQuiz && (
        <div className="space-y-4">
          <QuizBlock
            quiz={section.quiz}
            assignmentId={assignmentId}
            sectionId={section.id}
            onPassed={() => { setQuizPassed(true); setTimeout(() => setStep("signoff"), 1200); }}
          />
          {quizPassed && (
            <Button onClick={() => setStep("signoff")} data-testid="button-continue-to-signoff">
              Continue to Sign Off →
            </Button>
          )}
        </div>
      )}

      {step === "signoff" && (
        <div className="space-y-5">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="font-semibold text-blue-900 mb-1">Section Acknowledgement</p>
            <p className="text-sm text-blue-700">
              By signing, you confirm you have read and understood this section. Your signature is cryptographically recorded with a timestamp.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Type your full name to confirm</Label>
            <Input
              value={typedName}
              onChange={e => setTypedName(e.target.value)}
              placeholder={userName}
              className={typedName && !nameMatch ? "border-red-500" : ""}
              data-testid="input-section-ack-name"
            />
            {typedName && !nameMatch && (
              <p className="text-xs text-red-600">Name must match exactly: "{userName}"</p>
            )}
          </div>

          {typedName.length > 1 && (
            <div className="p-4 bg-white border border-dashed rounded-lg text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Digital Signature Preview</p>
              <p className="text-3xl text-blue-900" style={{ fontFamily: "'Dancing Script', cursive" }}>{typedName}</p>
            </div>
          )}

          <Button
            onClick={handleAcknowledge}
            disabled={!nameMatch || acknowledging}
            className="w-full"
            data-testid="button-acknowledge-section"
          >
            {acknowledging ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
            Acknowledge &amp; Continue
          </Button>
        </div>
      )}
    </div>
  );
}

const LEVEL_BADGE: Record<string, { label: string; cls: string; fullLabel: string }> = {
  awareness:          { label: "A", cls: "bg-blue-100 text-blue-700 border-blue-200",   fullLabel: "Awareness" },
  required:           { label: "R", cls: "bg-amber-100 text-amber-700 border-amber-200", fullLabel: "Required" },
  certification:      { label: "C", cls: "bg-purple-100 text-purple-700 border-purple-200", fullLabel: "Certification" },
  optional_reference: { label: "O", cls: "bg-slate-100 text-slate-600 border-slate-200", fullLabel: "Optional Reference" },
};

function EvidenceSubmissionForm({
  assignmentId,
  sopCode,
  onSubmitted,
}: {
  assignmentId: string;
  sopCode: string;
  onSubmitted: () => void;
}) {
  const { toast } = useToast();
  const [evidenceType, setEvidenceType] = useState("self_attestation");
  const [evidenceNotes, setEvidenceNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: existingSubmissions } = useQuery<any[]>({
    queryKey: ["/api/training/evidence", assignmentId],
    queryFn: async () => {
      const res = await fetch(`/api/training/evidence/${assignmentId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const latestSubmission = existingSubmissions?.[0];
  const isApproved = latestSubmission?.reviewStatus === "approved" || latestSubmission?.review_status === "approved";
  const isPending = latestSubmission?.reviewStatus === "pending" || latestSubmission?.review_status === "pending";
  const needsResubmit = latestSubmission?.reviewStatus === "resubmit_requested" || latestSubmission?.review_status === "resubmit_requested";

  const handleSubmit = async () => {
    if (!evidenceNotes.trim()) {
      toast({ title: "Please describe your evidence", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiRequest("POST", "/api/training/evidence", {
        trackAssignmentId: assignmentId,
        sopCode,
        evidenceType,
        evidenceNotes: evidenceNotes.trim(),
      });
      if (!res.ok) throw new Error("Failed to submit");
      queryClient.invalidateQueries({ queryKey: ["/api/training/evidence", assignmentId] });
      toast({ title: "Evidence submitted! Awaiting manager review." });
      onSubmitted();
    } catch {
      toast({ title: "Failed to submit evidence", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (isApproved) {
    return (
      <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg space-y-2">
        <p className="font-semibold text-green-900 flex items-center gap-2">
          <Award className="h-4 w-4" /> Certification Evidence Approved
        </p>
        <p className="text-sm text-green-700">Your manager has approved your evidence. You can now complete this track.</p>
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
        <p className="font-semibold text-amber-900">Evidence Submitted — Awaiting Review</p>
        <p className="text-sm text-amber-700">Your evidence is under manager review. You will be notified once it's reviewed.</p>
      </div>
    );
  }

  return (
    <div className="mt-6 p-4 bg-purple-50 border border-purple-200 rounded-lg space-y-3">
      <p className="font-semibold text-purple-900 flex items-center gap-2">
        <Award className="h-4 w-4" /> Certification Evidence Required
      </p>
      {needsResubmit && (
        <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          Resubmission requested: {latestSubmission?.review_notes || "Please review the feedback and resubmit."}
        </div>
      )}
      <p className="text-sm text-purple-700">This SOP requires certification-level evidence before completion. Your manager will review and approve.</p>
      <div className="space-y-2">
        <Label className="text-sm font-medium">Evidence Type</Label>
        <select
          value={evidenceType}
          onChange={(e) => setEvidenceType(e.target.value)}
          className="w-full border rounded-md px-3 py-2 text-sm bg-white"
          data-testid="select-evidence-type"
        >
          <option value="self_attestation">Self Attestation</option>
          <option value="screenshot">Screenshot / Photo</option>
          <option value="document">Document / File Reference</option>
          <option value="link">Link / URL</option>
        </select>
      </div>
      <div className="space-y-2">
        <Label className="text-sm font-medium">Evidence Description *</Label>
        <Textarea
          value={evidenceNotes}
          onChange={(e) => setEvidenceNotes(e.target.value)}
          placeholder="Describe how you applied this SOP in your work..."
          rows={3}
          data-testid="textarea-evidence-notes"
        />
      </div>
      <Button size="sm" onClick={handleSubmit} disabled={submitting} className="bg-purple-700 hover:bg-purple-800" data-testid="button-submit-evidence">
        {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
        Submit Evidence for Review
      </Button>
    </div>
  );
}

function TrackPlayer({
  assignmentId,
  onBack,
}: {
  assignmentId: string;
  onBack: () => void;
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [evidenceSubmitted, setEvidenceSubmitted] = useState(false);

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/onboarding/assignments", assignmentId],
    queryFn: async () => {
      const res = await fetch(`/api/onboarding/assignments/${assignmentId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  useEffect(() => {
    if (data?.sections?.length > 0 && !activeSectionId) {
      setActiveSectionId(data.sections[0].id);
    }
    if (data?.assignment?.status === "completed") setCompleted(true);
  }, [data]);

  const isSectionUnlocked = (idx: number) => {
    if (idx === 0) return true;
    const prev = data?.sections?.[idx - 1];
    return prev?.progress?.status === "completed";
  };

  const allDone = data?.sections?.every((s: any) => s.progress?.status === "completed");

  const handleComplete = async () => {
    setCompleting(true);
    try {
      const res = await apiRequest("POST", `/api/onboarding/progress/${assignmentId}/complete`);
      const result = await res.json();
      setReceiptData(result.receiptData);
      setCompleted(true);
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/my-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/compliance-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rayo-academy/my-assignments"] });
      toast({ title: "Track completed! Well done!" });
    } catch {
      toast({ title: "Failed to complete track", variant: "destructive" });
    } finally {
      setCompleting(false);
    }
  };

  const handleDownloadReceipt = () => {
    if (!receiptData) return;
    const content = [
      "TRAINING COMPLETION RECEIPT",
      "===========================",
      `Employee: ${user?.firstName} ${user?.lastName}`,
      `Track: ${data?.track?.title}`,
      `Completed: ${new Date().toLocaleString("en-IN")}`,
      "",
      "SECTION ACKNOWLEDGEMENTS",
      "------------------------",
      ...(receiptData.acknowledgements || []).map((a: any) =>
        `- ${a.sectionId}: signed as "${a.typedName}" at ${new Date(a.acknowledgedAt).toLocaleString("en-IN")}`
      ),
      "",
      `Receipt Hash: ${receiptData.completedAt ? "[computed]" : ""}`,
    ].join("\n");

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `training-receipt-${data?.track?.title?.replace(/\s+/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
    </div>
  );

  if (completed) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center space-y-6">
        <div className="py-8">
          <div className="text-7xl mb-4">🎉</div>
          <Trophy className="h-12 w-12 mx-auto text-amber-500 mb-3" />
          <h2 className="text-2xl font-bold">Track Completed!</h2>
          <p className="text-muted-foreground mt-2">
            You've successfully completed <strong>{data?.track?.title}</strong>. All sections are acknowledged and recorded.
          </p>
        </div>
        <div className="flex gap-3 justify-center flex-wrap">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to My Training
          </Button>
          {receiptData && (
            <Button onClick={handleDownloadReceipt} data-testid="button-download-receipt">
              <Download className="h-4 w-4 mr-2" />
              Download Receipt
            </Button>
          )}
        </div>
      </div>
    );
  }

  const activeSection = data?.sections?.find((s: any) => s.id === activeSectionId);
  const activeSectionIdx = data?.sections?.findIndex((s: any) => s.id === activeSectionId) ?? 0;

  const assignmentLevel = data?.assignment?.assignmentLevel as string | undefined;
  const isCertification = assignmentLevel === "certification";
  const evidenceRequired = data?.assignment?.evidenceRequired ?? isCertification;
  const managerSignoffStatus = data?.assignment?.managerSignoffStatus;
  const sopCode = data?.assignment?.sopCode as string | undefined;
  const levelBadge = LEVEL_BADGE[assignmentLevel ?? "required"] ?? LEVEL_BADGE.required;

  return (
    <div className="flex h-full">
      <div className="w-64 border-r bg-muted/30 p-4 space-y-2 shrink-0">
        <Button variant="ghost" size="sm" onClick={onBack} className="mb-2 -ml-2 text-muted-foreground">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <div className="flex items-center gap-2 mb-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">
            {data?.track?.title}
          </p>
          {assignmentLevel && (
            <span className={`shrink-0 inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-bold ${levelBadge.cls}`} title={levelBadge.fullLabel}>
              {levelBadge.label}
            </span>
          )}
        </div>
        {data?.sections?.map((section: any, idx: number) => {
          const isComplete = section.progress?.status === "completed";
          const isActive = section.id === activeSectionId;
          const unlocked = isSectionUnlocked(idx);
          return (
            <button
              key={section.id}
              onClick={() => unlocked && setActiveSectionId(section.id)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 transition-colors
                ${isActive ? "bg-blue-100 text-blue-900 font-medium" : "hover:bg-muted"}
                ${!unlocked ? "opacity-40 cursor-not-allowed" : ""}
              `}
              data-testid={`nav-section-${section.id}`}
            >
              {isComplete
                ? <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                : unlocked
                  ? <BookOpen className="h-4 w-4 text-blue-600 shrink-0" />
                  : <Lock className="h-4 w-4 shrink-0" />
              }
              <span className="truncate">{section.title}</span>
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {activeSection && (
          <>
            <div className="mb-4">
              <h2 className="text-xl font-bold">{activeSection.title}</h2>
              <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{activeSection.estimatedMinutes} min read</span>
                <span>Section {activeSectionIdx + 1} of {data?.sections?.length}</span>
              </div>
            </div>
            <Separator className="mb-5" />

            <SectionPlayer
              key={activeSection.id}
              section={activeSection}
              isUnlocked={isSectionUnlocked(activeSectionIdx)}
              isCompleted={activeSection.progress?.status === "completed"}
              assignmentId={assignmentId}
              userName={`${user?.firstName || ""} ${user?.lastName || ""}`.trim()}
              onCompleted={async () => {
                await refetch();
                const nextIdx = activeSectionIdx + 1;
                if (nextIdx < (data?.sections?.length ?? 0)) {
                  setTimeout(() => setActiveSectionId(data.sections[nextIdx].id), 500);
                }
              }}
            />

            {allDone && !completed && evidenceRequired && sopCode && (
              <EvidenceSubmissionForm
                assignmentId={assignmentId}
                sopCode={sopCode}
                onSubmitted={() => setEvidenceSubmitted(true)}
              />
            )}

            {allDone && !completed && (!evidenceRequired || evidenceSubmitted || managerSignoffStatus === "approved") && (
              <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded-lg text-center space-y-3">
                <p className="font-semibold text-green-900">All sections complete!</p>
                <p className="text-sm text-green-700">
                  {isCertification
                    ? "Your certification evidence is on record. Click below to finalize."
                    : "Click below to finalize your completion receipt."}
                </p>
                <Button onClick={handleComplete} disabled={completing} className="bg-green-700 hover:bg-green-800" data-testid="button-complete-track">
                  {completing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trophy className="h-4 w-4 mr-2" />}
                  Complete Track &amp; Get Receipt
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ExtensionRequestForm({ assignmentId, trackTitle, onSubmitted, isOverdue, requestType = "extension" }: {
  assignmentId: string;
  trackTitle: string;
  onSubmitted: () => void;
  isOverdue?: boolean;
  requestType?: "extension" | "exception";
}) {
  const { toast } = useToast();
  const [nonCompletionReason, setNonCompletionReason] = useState("");
  const [extensionReason, setExtensionReason] = useState("");
  const [newDueDate, setNewDueDate] = useState("");

  const isException = requestType === "exception";

  const combinedReason = isOverdue && !isException
    ? `[Why not completed] ${nonCompletionReason.trim()}\n[Why extension needed] ${extensionReason.trim()}`
    : extensionReason.trim();

  // For exceptions, auto-set newDueDate to 1 year from now if not provided
  const effectiveNewDueDate = isException && !newDueDate
    ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
    : newDueDate;

  const submitMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/onboarding/extension-requests", {
      assignmentId,
      reason: combinedReason,
      newDueDate: effectiveNewDueDate,
      requestType,
    }),
    onSuccess: () => {
      toast({ title: isException ? "Exception request submitted" : "Extension request submitted" });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/extension-requests/my"] });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/compliance-status"] });
      onSubmitted();
    },
    onError: (err: any) => toast({ title: err?.message || "Failed to submit request", variant: "destructive" }),
  });

  const minDate = new Date(Date.now() + 86400000).toISOString().split("T")[0];
  const isValid = (isOverdue && !isException ? nonCompletionReason.trim().length > 0 : true)
    && extensionReason.trim().length > 0
    && (isException || !!newDueDate);

  return (
    <div
      className={`border rounded-lg p-4 space-y-3 bg-white dark:bg-card ${isException ? "border-purple-200 bg-purple-50 dark:bg-purple-950/20" : ""}`}
      data-testid={`form-${isException ? "exception" : "extension"}-${assignmentId}`}
    >
      <p className="text-sm font-semibold flex items-center gap-2">
        {isException
          ? <><ShieldCheck className="h-4 w-4 text-purple-600" /> Request Training Exception — {trackTitle}</>
          : <><CalendarPlus className="h-4 w-4 text-blue-600" /> Request Due Date Extension — {trackTitle}</>
        }
      </p>
      {isException && (
        <p className="text-xs text-muted-foreground bg-purple-100 dark:bg-purple-900/30 rounded p-2">
          An exception request asks HR/Admin to formally waive the training requirement for you. This is for cases such as role change, medical circumstances, or an equivalent external certification.
        </p>
      )}
      {isOverdue && !isException && (
        <div className="space-y-2">
          <Label>Why were you unable to complete the training on time?</Label>
          <Textarea
            value={nonCompletionReason}
            onChange={e => setNonCompletionReason(e.target.value)}
            placeholder="e.g. Was on approved leave, heavy workload, technical issues..."
            rows={2}
            data-testid="input-non-completion-reason"
          />
        </div>
      )}
      <div className="space-y-2">
        <Label>{isException ? "Reason for exception" : "Why do you need an extension?"}</Label>
        <Textarea
          value={extensionReason}
          onChange={e => setExtensionReason(e.target.value)}
          placeholder={isException
            ? "e.g. Role change, medical leave, equivalent external certification..."
            : "e.g. Need additional time to review materials thoroughly..."}
          rows={2}
          data-testid="input-extension-reason"
        />
      </div>
      {!isException && (
        <div className="space-y-2">
          <Label>Requested new due date</Label>
          <Input
            type="date"
            value={newDueDate}
            min={minDate}
            onChange={e => setNewDueDate(e.target.value)}
            data-testid="input-extension-due-date"
          />
        </div>
      )}
      <Button
        size="sm"
        className={isException ? "bg-purple-700 hover:bg-purple-800" : ""}
        onClick={() => submitMutation.mutate()}
        disabled={!isValid || submitMutation.isPending}
        data-testid="button-submit-extension"
      >
        {submitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
        {isException ? "Submit Exception Request" : "Submit Extension Request"}
      </Button>
    </div>
  );
}

export default function MyTraining() {
  const { enabled: newLook } = useNewLook();
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeAssignmentId, setActiveAssignmentId] = useState<string | null>(() => {
    try { return new URLSearchParams(window.location.search).get("track"); } catch { return null; }
  });
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [trainingTypeFilter, setTrainingTypeFilter] = useState<"all" | "onboarding" | "sop">("all");
  const [showExtensionFor, setShowExtensionFor] = useState<string | null>(null);
  const [showExceptionFor, setShowExceptionFor] = useState<string | null>(null);
  const [showRequestsCard, setShowRequestsCard] = useState(false);

  useEffect(() => {
    const trackParam = new URLSearchParams(window.location.search).get("track");
    if (trackParam) {
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("track");
        window.history.replaceState({}, "", url.toString());
      } catch {}
    }
  }, []);

  const { data: rayoStatus } = useQuery<{ enabled: boolean }>({
    queryKey: ["/api/rayo-academy/status"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/rayo-academy/status", { credentials: "include" });
        if (!res.ok) return { enabled: false };
        return res.json();
      } catch {
        return { enabled: false };
      }
    },
    staleTime: 60000,
  });

  const isRayoEnabled = rayoStatus?.enabled === true;

  const { data: rayoData, isLoading: rayoLoading } = useQuery<{ assignments: any[]; fromApi: boolean }>({
    queryKey: ["/api/rayo-academy/my-assignments"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/rayo-academy/my-assignments", { credentials: "include" });
        if (!res.ok) return { assignments: [], fromApi: false };
        return res.json();
      } catch {
        return { assignments: [], fromApi: false };
      }
    },
  });

  const { data: localAssignments = [], isLoading: localLoading } = useQuery<any[]>({
    queryKey: ["/api/onboarding/my-assignments"],
    queryFn: async () => {
      const res = await fetch("/api/onboarding/my-assignments", { credentials: "include" });
      if (!res.ok) {
        if (res.status === 403) return [];
        throw new Error("Failed to load");
      }
      return res.json();
    },
    enabled: !isRayoEnabled,
  });

  const assignments = isRayoEnabled && rayoData?.fromApi
    ? rayoData.assignments.map((a: any) => ({
        id: a.id,
        status: a.status,
        dueDate: a.dueDate,
        completedAt: a.completedAt,
        totalSections: a.totalSections,
        completedSections: a.completedSections,
        progressPct: a.progressPct,
        track: { title: a.trackTitle, description: a.trackDescription },
        certificateUrl: a.certificateUrl,
        fromRayo: true,
      }))
    : isRayoEnabled && rayoData
      ? rayoData.assignments.map((a: any) => ({
          id: a.id,
          status: a.status,
          dueDate: a.dueDate,
          completedAt: a.completedAt,
          totalSections: a.totalSections,
          completedSections: a.completedSections,
          progressPct: a.progressPct,
          track: { title: a.trackTitle, description: a.trackDescription },
          certificateUrl: a.certificateUrl,
          fromRayo: false,
        }))
      : localAssignments;

  const isLoading = isRayoEnabled ? rayoLoading : localLoading;
  const isFromApi = isRayoEnabled && rayoData?.fromApi === true;
  const showFallbackBanner = isRayoEnabled && rayoData && !rayoData.fromApi;

  const EXEMPT_ROLES = ["super_admin", "admin"];
  const isLockExempt = user?.role ? EXEMPT_ROLES.includes(user.role) : true;

  const { data: complianceStatus } = useQuery<{
    locked: boolean;
    overdueCount: number;
    trackTitles: string[];
    pendingExtensions: any[];
    fromApi?: boolean;
  }>({
    queryKey: isRayoEnabled ? ["/api/rayo-academy/compliance-status"] : ["/api/onboarding/compliance-status"],
    queryFn: async () => {
      try {
        const url = isRayoEnabled ? "/api/rayo-academy/compliance-status" : "/api/onboarding/compliance-status";
        const res = await fetch(url, { credentials: "include" });
        if (!res.ok) return { locked: false, overdueCount: 0, trackTitles: [], pendingExtensions: [] };
        return res.json();
      } catch {
        return { locked: false, overdueCount: 0, trackTitles: [], pendingExtensions: [] };
      }
    },
    enabled: !!user && !isLockExempt,
  });

  const { data: myExtensionRequests = [] } = useQuery<any[]>({
    queryKey: ["/api/onboarding/extension-requests/my"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/onboarding/extension-requests/my", { credentials: "include" });
        if (!res.ok) return [];
        return res.json();
      } catch {
        return [];
      }
    },
    enabled: !!user,
  });

  const isLocked = !isLockExempt && complianceStatus?.locked === true;

  const filteredAssignments = (assignments as any[]).filter((a: any) => {
    if (trainingTypeFilter === "all") return true;
    const hasSopMeta = !!(a.track?.sopCategory || a.track?.launchWave || a.track?.trainingId);
    if (trainingTypeFilter === "sop") return hasSopMeta;
    if (trainingTypeFilter === "onboarding") return !hasSopMeta;
    return true;
  });

  const now = new Date();
  const in3days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const in5days = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
  const activeAssignments = assignments.filter((a: any) => a.status !== "completed");
  const overdueCount = activeAssignments.filter((a: any) => a.dueDate && new Date(a.dueDate) < now).length;
  const dueSoonCount = activeAssignments.filter((a: any) => {
    if (!a.dueDate) return false;
    const d = new Date(a.dueDate);
    return d >= now && d <= in3days;
  }).length;
  const showBanner = !bannerDismissed && !isLoading && (overdueCount > 0 || dueSoonCount > 0);

  const getExtensionForAssignment = (assignmentId: string) => {
    return myExtensionRequests.filter((r: any) => r.assignmentId === assignmentId);
  };

  if (activeAssignmentId && !(assignments as any[]).find((a: any) => a.fromRayo && a.id === activeAssignmentId)) {
    return (
      <AdminLayout>
        <div className="v2-surface">
          <TrackPlayer assignmentId={activeAssignmentId} onBack={() => setActiveAssignmentId(null)} />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6 space-y-6 v2-surface">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            {newLook ? (
              <V2PageHeader icon={GraduationCap} eyebrow="Learning" title="My Training" subtitle="Complete your assigned learning tracks and earn your acknowledgements" />
            ) : (
              <>
                <h1 className="text-xl font-semibold leading-tight">My Training</h1>
                <p className="text-sm text-muted-foreground mt-0.5">Complete your assigned learning tracks and earn your acknowledgements</p>
              </>
            )}
          </div>
          {isRayoEnabled && (
            <Button
              variant="outline"
              onClick={() => window.open("https://rayo.academy", "_blank")}
              className="shrink-0"
              data-testid="button-open-rayo-academy"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open Rayo Academy
            </Button>
          )}
        </div>

        {showFallbackBanner && (
          <Alert variant="warning" data-testid="banner-rayo-fallback">
            <WifiOff className="h-4 w-4" />
            <AlertDescription>
              <p className="font-semibold text-sm">Training data may be delayed</p>
              <p className="text-xs mt-0.5">
                Unable to reach Rayo Academy. Showing locally cached training data. Your progress may not reflect recent activity on Rayo Academy.
              </p>
            </AlertDescription>
          </Alert>
        )}

        {isLocked && (
          <Alert variant="destructive" data-testid="banner-compliance-lock">
            <ShieldAlert className="h-4 w-4" />
            <AlertDescription>
              <p className="font-semibold">Portal Locked — Overdue Training</p>
              <p className="text-sm mt-1">
                Your portal access is restricted because you have {complianceStatus?.overdueCount} overdue training
                {(complianceStatus?.overdueCount ?? 0) === 1 ? " track" : " tracks"}:
                <strong> {complianceStatus?.trackTitles?.join(", ")}</strong>.
                Complete your training or request a due date extension below to restore full access.
              </p>
              <p className="text-xs mt-1">
                Punch-in and punch-out are also blocked while your portal is locked.
              </p>
            </AlertDescription>
          </Alert>
        )}

        {showBanner && !isLocked && (
          <Alert variant={overdueCount > 0 ? "destructive" : "warning"} data-testid="banner-training-due">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-sm">
                    {overdueCount > 0
                      ? `${overdueCount} training ${overdueCount === 1 ? "track is" : "tracks are"} overdue`
                      : `${dueSoonCount} training ${dueSoonCount === 1 ? "track is" : "tracks are"} due within 3 days`}
                  </p>
                  <p className="text-xs mt-0.5">
                    {overdueCount > 0 && dueSoonCount > 0 ? `Also ${dueSoonCount} more due soon. ` : ""}
                    Complete them to stay on track.
                  </p>
                </div>
                <button
                  onClick={() => setBannerDismissed(true)}
                  className="shrink-0 p-1 rounded hover:bg-black/10"
                  data-testid="button-dismiss-training-banner"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Your Requests card */}
        {myExtensionRequests.length > 0 && (
          <Card data-testid="card-your-requests">
            <CardHeader className="pb-2">
              <button
                className="flex items-center gap-2 w-full text-left"
                onClick={() => setShowRequestsCard(v => !v)}
                data-testid="button-toggle-your-requests"
              >
                <FileQuestion className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base flex-1">Your Requests</CardTitle>
                <span className="text-xs text-muted-foreground mr-2">{myExtensionRequests.length} request{myExtensionRequests.length !== 1 ? "s" : ""}</span>
                {showRequestsCard ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
            </CardHeader>
            {showRequestsCard && (
              <CardContent>
                <div className="space-y-2">
                  {myExtensionRequests.map((r: any) => {
                    const statusColors: Record<string, string> = {
                      pending: "bg-amber-100 text-amber-700",
                      endorsed: "bg-blue-100 text-blue-700",
                      approved: "bg-green-100 text-green-700",
                      rejected: "bg-red-100 text-red-700",
                    };
                    return (
                      <div key={r.id} className="flex items-start justify-between border rounded-md p-3 text-sm gap-3" data-testid={`row-request-${r.id}`}>
                        <div className="space-y-0.5 flex-1 min-w-0">
                          <p className="font-medium truncate">{r.trackTitle || "Training request"}</p>
                          <p className="text-xs text-muted-foreground">
                            {r.requestType === "exception" ? "Exception" : "Extension"} — Requested: {formatDate(r.createdAt)}
                          </p>
                          {r.status === "approved" && r.resolverComment && (
                            <p className="text-xs text-green-600">Comment: "{r.resolverComment}"</p>
                          )}
                          {r.status === "rejected" && r.resolverComment && (
                            <p className="text-xs text-red-600">Reason: "{r.resolverComment}"</p>
                          )}
                          {r.status === "endorsed" && r.endorserName && (
                            <p className="text-xs text-blue-600">Endorsed by {r.endorserName} — awaiting final approval</p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[r.status] || "bg-gray-100 text-gray-600"}`}>
                            {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                          </span>
                          {r.requestType === "exception" && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">Exception</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </div>
        )}

        {!isLoading && assignments.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center text-muted-foreground">
              <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No training assigned yet</p>
              <p className="text-sm mt-1">Your manager will assign training tracks when ready.</p>
              {isRayoEnabled && (
                <p className="text-sm mt-3">
                  Visit{" "}
                  <a href="https://rayo.academy" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">
                    Rayo Academy
                  </a>{" "}
                  to explore available courses.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {!isLoading && assignments.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap" data-testid="filter-training-type">
            {[
              { key: "all", label: "All" },
              { key: "onboarding", label: "Onboarding" },
              { key: "sop", label: "SOP Compliance" },
            ].map((opt) => (
              <button
                key={opt.key}
                onClick={() => setTrainingTypeFilter(opt.key as "all" | "onboarding" | "sop")}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  trainingTypeFilter === opt.key
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-muted-foreground border-border hover:bg-muted"
                }`}
                data-testid={`filter-${opt.key}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredAssignments.map((a: any) => {
            const now = new Date();
            let status = a.status;
            if (status !== "completed" && a.dueDate && new Date(a.dueDate) < now) status = "overdue";

            const extensionsForThis = getExtensionForAssignment(a.id);
            const hasPending = extensionsForThis.some((r: any) => r.status === "pending" || r.status === "endorsed");
            const latestExt = extensionsForThis.length > 0
              ? extensionsForThis.sort((x: any, y: any) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime())[0]
              : null;

            const isOverdue = status === "overdue";
            const isDueSoon = !isOverdue && a.dueDate && new Date(a.dueDate) >= now && new Date(a.dueDate) <= in5days;
            const showExtensionSection = status !== "completed" && !a.fromRayo;

            return (
              <div key={a.id} className="space-y-2">
                <Card
                  className="hover:shadow-md transition-all cursor-pointer"
                  onClick={() => {
                    if (a.fromRayo) {
                      window.open("https://rayo.academy", "_blank");
                    } else {
                      setActiveAssignmentId(a.id);
                    }
                  }}
                  data-testid={`card-assignment-${a.id}`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base leading-tight">{a.track?.title}</CardTitle>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2 flex-wrap justify-end">
                        {a.fromRayo && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-indigo-100 text-indigo-700" data-testid={`badge-rayo-${a.id}`}>
                            Rayo Academy
                          </span>
                        )}
                        {a.track?.launchWave && !a.fromRayo && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700" data-testid={`badge-wave-${a.id}`}>
                            {a.track.launchWave}
                          </span>
                        )}
                        {a.track?.sopCategory && !a.fromRayo && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-violet-100 text-violet-700" data-testid={`badge-sop-category-${a.id}`}>
                            SOP
                          </span>
                        )}
                        {isDueSoon && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700" data-testid={`badge-due-soon-${a.id}`}>
                            due soon
                          </span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[status] || STATUS_COLORS.not_started}`}>
                          {status.replace("_", " ")}
                        </span>
                      </div>
                    </div>
                    {a.track?.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{a.track.description}</p>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{a.completedSections} / {a.totalSections} sections</span>
                        <span className="font-medium">{a.progressPct}%</span>
                      </div>
                      <Progress value={a.progressPct} className="h-2" />
                      <p className={`text-xs ${isOverdue ? "text-red-600 font-medium" : isDueSoon ? "text-amber-600 font-medium" : "text-muted-foreground"}`}>
                        {a.dueDate ? (
                          <>Due: {formatDate(a.dueDate)}{isDueSoon && " — due within 5 days"}</>
                        ) : (
                          <>Due date: Not set</>
                        )}
                      </p>
                      {status === "completed" && (
                        <p className="text-xs text-green-600 font-medium">✓ Completed {formatDate(a.completedAt)}</p>
                      )}
                      {status === "completed" && a.certificateUrl && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-1"
                          onClick={(e) => { e.stopPropagation(); window.open(a.certificateUrl, "_blank"); }}
                          data-testid={`button-certificate-${a.id}`}
                        >
                          <Award className="h-4 w-4 mr-1" />
                          View Certificate
                        </Button>
                      )}
                    </div>
                    <Button size="sm" className="mt-3 w-full" variant={status === "completed" ? "outline" : "default"}>
                      {a.fromRayo
                        ? <><ExternalLink className="h-4 w-4 mr-2" />Open in Rayo Academy</>
                        : status === "completed" ? "Review" : status === "not_started" ? "Start" : "Continue"
                      } {!a.fromRayo && "→"}
                  </Button>
                </CardContent>
              </Card>

              {showExtensionSection && (
                <div className="space-y-2">
                  {latestExt && latestExt.status === "pending" && (
                    <div className="text-xs bg-amber-50 dark:bg-amber-950/30 border border-amber-200 rounded-lg p-3 flex items-start gap-2" data-testid={`status-extension-pending-${a.id}`}>
                      <Clock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-amber-800 dark:text-amber-300">Extension request pending review</p>
                        <p className="text-amber-700 dark:text-amber-400">New date requested: {formatDate(latestExt.newDueDate)}</p>
                        <p className="text-amber-600 dark:text-amber-500 mt-1">Awaiting review from your manager/supervisor.</p>
                      </div>
                    </div>
                  )}
                  {latestExt && latestExt.status === "endorsed" && (
                    <div className="text-xs bg-blue-50 dark:bg-blue-950/30 border border-blue-200 rounded-lg p-3 flex items-start gap-2" data-testid={`status-extension-endorsed-${a.id}`}>
                      <Clock className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-blue-800 dark:text-blue-300">Extension endorsed — awaiting final approval</p>
                        <p className="text-blue-700 dark:text-blue-400">New date requested: {formatDate(latestExt.newDueDate)}</p>
                        {latestExt.endorserName && <p className="text-blue-600 dark:text-blue-400 mt-1">Endorsed by: {latestExt.endorserName}</p>}
                        {latestExt.endorserComment && <p className="text-blue-600 dark:text-blue-400">"{latestExt.endorserComment}"</p>}
                      </div>
                    </div>
                  )}
                  {latestExt && latestExt.status === "approved" && (
                    <div className="text-xs bg-green-50 dark:bg-green-950/30 border border-green-200 rounded-lg p-3 flex items-start gap-2" data-testid={`status-extension-approved-${a.id}`}>
                      <CheckCircle className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-green-800 dark:text-green-300">Extension approved</p>
                        <p className="text-green-700 dark:text-green-400">New due date: {formatDate(latestExt.newDueDate)}</p>
                        {latestExt.resolverComment && <p className="text-green-600 dark:text-green-400 mt-1">"{latestExt.resolverComment}"</p>}
                      </div>
                    </div>
                  )}
                  {latestExt && latestExt.status === "rejected" && (
                    <div className="text-xs bg-red-50 dark:bg-red-950/30 border border-red-200 rounded-lg p-3 flex items-start gap-2" data-testid={`status-extension-rejected-${a.id}`}>
                      <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-red-800 dark:text-red-300">Extension request rejected</p>
                        {latestExt.resolverComment && <p className="text-red-700 dark:text-red-400">Reason: "{latestExt.resolverComment}"</p>}
                        <p className="text-red-600 dark:text-red-400 mt-1">Please complete the training as soon as possible.</p>
                      </div>
                    </div>
                  )}
                  {!hasPending && (
                    <>
                      {showExceptionFor === a.id ? (
                        <ExtensionRequestForm
                          assignmentId={a.id}
                          trackTitle={a.track?.title || ""}
                          onSubmitted={() => setShowExceptionFor(null)}
                          isOverdue={isOverdue}
                          requestType="exception"
                        />
                      ) : showExtensionFor === a.id ? (
                        <ExtensionRequestForm
                          assignmentId={a.id}
                          trackTitle={a.track?.title || ""}
                          onSubmitted={() => setShowExtensionFor(null)}
                          isOverdue={isOverdue}
                          requestType="extension"
                        />
                      ) : (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 text-blue-700 border-blue-300 hover:bg-blue-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowExtensionFor(a.id);
                              setShowExceptionFor(null);
                            }}
                            data-testid={`button-apply-extension-${a.id}`}
                          >
                            <CalendarPlus className="h-4 w-4 mr-2" />
                            {a.dueDate ? "Request Extension" : "Request Due Date"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-purple-700 border-purple-300 hover:bg-purple-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowExceptionFor(a.id);
                              setShowExtensionFor(null);
                            }}
                            data-testid={`button-request-exception-${a.id}`}
                          >
                            <ShieldCheck className="h-4 w-4 mr-1" />
                            Exception
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
              </div>
            );
          })}
        </div>
      </div>
    </AdminLayout>
  );
}
