import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ShieldCheck, CheckCircle2, Clock, GraduationCap, AlertTriangle, Lock, X, FileUp, Upload, ChevronDown, ChevronUp, Brain, Download, Award, RadioTower } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface MySopAssignment {
  sopId: string;
  sopMasterId: string;
  code: string;
  title: string;
  category: string;
  lifecycleStatus: string;
  version: number;
  learningTrackId: string | null;
  trainingCompletedAt: string | null;
  acknowledgedAt: string | null;
  acknowledgedCurrentVersion: boolean;
  waveNumber: number | null;
  waveStatus: string | null;
  enforcement: "soft" | "measured" | "full" | null;
  operational: boolean;
  operationalAt: string | null;
  dueAt: string | null;
  overdue: boolean;
  state: "queued" | "training_pending" | "ready" | "acknowledged";
  evidenceText: string | null;
  evidenceFileUrl: string | null;
  evidenceDescription: string | null;
  quizRequired: boolean;
  quizPassed: boolean;
  quizAttempts: number;
  quizPassedAt: string | null;
}

interface WaveAttestation {
  id: string;
  waveNumber: number;
  attestedAt: string;
  refNumber: string;
  hasCheatSheet: boolean;
}

interface MyAssignmentsResponse {
  enabled: boolean;
  assignments: MySopAssignment[];
}

const STATE_META: Record<MySopAssignment["state"], { label: string; variant: "default" | "secondary" | "outline" | "destructive"; icon: typeof CheckCircle2 }> = {
  acknowledged: { label: "Acknowledged", variant: "default", icon: CheckCircle2 },
  ready: { label: "Action needed", variant: "destructive", icon: AlertTriangle },
  training_pending: { label: "Training pending", variant: "secondary", icon: GraduationCap },
  queued: { label: "Queued", variant: "outline", icon: Clock },
};

function fmtDate(d: string | null): string {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }); }
  catch { return "—"; }
}

export default function MySops() {
  const { data, isLoading } = useQuery<MyAssignmentsResponse>({
    queryKey: ["/api/sops/my-assignments"],
    staleTime: 30000,
  });
  const { data: waveAttestations } = useQuery<WaveAttestation[]>({
    queryKey: ["/api/sops/my-wave-attestations"],
    staleTime: 60000,
  });
  const [ackSop, setAckSop] = useState<MySopAssignment | null>(null);
  const [quizSop, setQuizSop] = useState<MySopAssignment | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading your SOPs…</span>
        </div>
      </div>
    );
  }

  if (!data?.enabled) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center" data-testid="mysops-not-enabled">
        <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
          <ShieldCheck className="h-7 w-7 text-muted-foreground" />
        </div>
        <p className="font-semibold text-foreground">SOPs aren't available for your account yet</p>
        <p className="text-sm text-muted-foreground max-w-sm">
          The Process Governance rollout hasn't reached your role yet. You'll see your assigned SOPs here once it does.
        </p>
      </div>
    );
  }

  const assignments = data.assignments;
  const actionable = assignments.filter((a) => a.state === "ready" || a.state === "training_pending");
  const acknowledged = assignments.filter((a) => a.state === "acknowledged");
  const queued = assignments.filter((a) => a.state === "queued");

  if (assignments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center" data-testid="mysops-empty">
        <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
          <CheckCircle2 className="h-7 w-7 text-emerald-600" />
        </div>
        <p className="font-semibold text-foreground">No SOPs assigned to you</p>
        <p className="text-sm text-muted-foreground max-w-sm">
          You have no Standard Operating Procedures assigned right now. They'll appear here as they're rolled out.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5" data-testid="mysops-view">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2" data-testid="text-mysops-title">
          <ShieldCheck className="h-5 w-5 text-primary" /> My SOPs
        </h2>
        <p className="text-sm text-muted-foreground">
          Standard Operating Procedures assigned to you. Complete any linked training, then acknowledge to confirm you've read and understood each one.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <SummaryStat label="Need action" value={actionable.length} tone="amber" testid="stat-mysops-actionable" />
        <SummaryStat label="Acknowledged" value={acknowledged.length} tone="emerald" testid="stat-mysops-acknowledged" />
        <SummaryStat label="Queued" value={queued.length} tone="slate" testid="stat-mysops-queued" />
      </div>

      {(waveAttestations ?? []).length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Wave Completions</p>
          {(waveAttestations ?? []).map((wa) => (
            <WaveAttestationCard key={wa.waveNumber} attestation={wa} />
          ))}
        </div>
      )}

      {actionable.length > 0 && (
        <SopGroup title="Needs your attention" sops={actionable} onAck={setAckSop} onQuiz={setQuizSop} />
      )}
      {queued.length > 0 && (
        <SopGroup title="Coming soon (not yet operational)" sops={queued} onAck={setAckSop} onQuiz={setQuizSop} />
      )}
      {acknowledged.length > 0 && (
        <SopGroup title="Acknowledged" sops={acknowledged} onAck={setAckSop} onQuiz={setQuizSop} />
      )}

      {ackSop && (
        <AcknowledgeDialog sop={ackSop} onClose={() => setAckSop(null)} />
      )}
      {quizSop && (
        <QuizDialog
          sop={quizSop}
          onClose={() => {
            setQuizSop(null);
            queryClient.invalidateQueries({ queryKey: ["/api/sops/my-assignments"] });
          }}
          onPassedAndAck={() => {
            const sopToAck = quizSop;
            setQuizSop(null);
            queryClient.invalidateQueries({ queryKey: ["/api/sops/my-assignments"] });
            setAckSop(sopToAck);
          }}
        />
      )}
    </div>
  );
}

function WaveAttestationCard({ attestation }: { attestation: WaveAttestation }) {
  const { toast } = useToast();
  const [content, setContent] = useState<string | null>(null);
  const [showSheet, setShowSheet] = useState(false);

  const genMut = useMutation({
    mutationFn: async () =>
      (await apiRequest("POST", `/api/sops/waves/${attestation.waveNumber}/cheat-sheet`, {})).json(),
    onSuccess: (res: { content: string }) => {
      setContent(res.content);
      setShowSheet(true);
    },
    onError: (e: any) => toast({ title: "Could not generate cheat sheet", description: e?.message, variant: "destructive" }),
  });

  const handleDownload = () => {
    if (content) { setShowSheet(true); return; }
    genMut.mutate();
  };

  return (
    <>
      <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-700 px-4 py-2.5" data-testid={`card-wave-attest-${attestation.waveNumber}`}>
        <div className="flex items-center gap-2.5">
          <Award className="h-4 w-4 text-emerald-600 shrink-0" />
          <div>
            <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200">Wave {attestation.waveNumber} Complete</p>
            <p className="text-xs text-emerald-700 dark:text-emerald-400">{attestation.refNumber} · {new Date(attestation.attestedAt).toLocaleDateString()}</p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="border-emerald-300 text-emerald-800 hover:bg-emerald-100 dark:text-emerald-200 gap-1.5"
          onClick={handleDownload}
          disabled={genMut.isPending}
          data-testid={`button-cheat-sheet-${attestation.waveNumber}`}
        >
          {genMut.isPending ? (
            <><div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> Generating…</>
          ) : (
            <><Download className="h-3.5 w-3.5" /> Cheat Sheet</>
          )}
        </Button>
      </div>
      {showSheet && content && (
        <CheatSheetDialog
          waveNumber={attestation.waveNumber}
          content={content}
          onClose={() => setShowSheet(false)}
        />
      )}
    </>
  );
}

function CheatSheetDialog({ waveNumber, content, onClose }: { waveNumber: number; content: string; onClose: () => void }) {
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = () => {
    if (!printRef.current) return;
    const html = printRef.current.innerHTML;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<html><head><title>Wave ${waveNumber} Cheat Sheet</title><style>
      body { font-family: sans-serif; max-width: 800px; margin: 40px auto; line-height: 1.6; }
      h1 { font-size: 1.2rem; } p { margin: 0.4rem 0; }
      strong { display: block; margin-top: 1rem; }
    </style></head><body>${html}</body></html>`);
    win.document.close();
    win.print();
  };

  // Safe line-by-line renderer — no HTML injection, no dangerouslySetInnerHTML
  const renderLines = (text: string) =>
    text.split("\n").map((line, i) => {
      const stripped = line.replace(/^#{1,3}\s+/, "").replace(/^[-*•]\s+/, "• ");
      const isBold = /^\*\*.+\*\*$/.test(stripped.trim()) || /^#{1,3}\s/.test(line);
      const clean = stripped.replace(/\*\*(.*?)\*\*/g, "$1");
      return (
        <p key={i} className={`text-sm ${isBold ? "font-semibold mt-2" : ""} ${!clean.trim() ? "h-2" : ""}`}>
          {clean}
        </p>
      );
    });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="dialog-cheat-sheet">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" /> Wave {waveNumber} Cheat Sheet
          </DialogTitle>
        </DialogHeader>
        <div
          ref={printRef}
          className="space-y-0.5 text-sm"
          data-testid="cheat-sheet-content"
        >
          {renderLines(content)}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cheat-sheet-close">Close</Button>
          <Button onClick={handlePrint} className="gap-1.5" data-testid="button-cheat-sheet-print">
            <Download className="h-3.5 w-3.5" /> Print / Save PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const SOP_BANNER_DISMISS_KEY = "sop-coaching-banner-dismissed";

export function SopCoachingBanner() {
  const [, setLocation] = useLocation();
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(SOP_BANNER_DISMISS_KEY) === "1"; } catch { return false; }
  });
  const { data } = useQuery<MyAssignmentsResponse>({
    queryKey: ["/api/sops/my-assignments"],
    staleTime: 30000,
  });
  if (dismissed) return null;
  if (!data?.enabled) return null;
  const pending = data.assignments.filter(
    (a) =>
      (a.enforcement === "soft" || a.enforcement === "measured") &&
      a.operational &&
      !a.acknowledgedCurrentVersion &&
      a.state !== "queued",
  );
  if (pending.length === 0) return null;

  const dismiss = () => {
    try { sessionStorage.setItem(SOP_BANNER_DISMISS_KEY, "1"); } catch { /* ignore */ }
    setDismissed(true);
  };

  return (
    <div
      className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 px-4 py-3"
      data-testid="banner-sop-coaching"
    >
      <ShieldCheck className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
          You have {pending.length} SOP{pending.length > 1 ? "s" : ""} to review and acknowledge
        </p>
        <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5">
          Please review {pending.length > 1 ? "them" : "it"} soon. Acknowledgement confirms you've read and understood the procedure.
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="shrink-0 border-amber-400 text-amber-800 hover:bg-amber-100 dark:text-amber-200"
        onClick={() => setLocation("/admin/my-desk?tab=my-sops")}
        data-testid="button-sop-coaching-review"
      >
        Review now
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="shrink-0 h-7 w-7 text-amber-700 hover:bg-amber-100 dark:text-amber-300"
        onClick={dismiss}
        data-testid="button-sop-coaching-dismiss"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

function SummaryStat({ label, value, tone, testid }: { label: string; value: number; tone: "amber" | "emerald" | "slate"; testid: string }) {
  const toneClasses: Record<string, string> = {
    amber: "text-amber-600",
    emerald: "text-emerald-600",
    slate: "text-slate-500",
  };
  return (
    <Card>
      <CardContent className="py-4 text-center">
        <p className={`text-2xl font-bold ${toneClasses[tone]}`} data-testid={testid}>{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </CardContent>
    </Card>
  );
}

function EvidenceSection({ sop }: { sop: MySopAssignment }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(sop.evidenceText ?? "");
  const [fileUploading, setFileUploading] = useState(false);
  const [fileUrl, setFileUrl] = useState(sop.evidenceFileUrl ?? "");
  const [fileName, setFileName] = useState<string | null>(sop.evidenceFileUrl ? sop.evidenceFileUrl.split("/").pop() ?? null : null);
  const fileRef = useRef<HTMLInputElement>(null);

  const saveMut = useMutation({
    mutationFn: async (updates: { evidenceText?: string; evidenceFileUrl?: string }) =>
      (await apiRequest("PATCH", `/api/sops/${sop.sopMasterId}/evidence`, updates)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sops/my-assignments"] });
    },
    onError: (e: any) => toast({ title: "Save failed", description: e?.message, variant: "destructive" }),
  });

  const handleBlur = () => {
    saveMut.mutate({ evidenceText: text });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/sops/${sop.sopMasterId}/evidence-upload`, {
        method: "POST",
        body: form,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Upload failed");
      }
      const { url } = await res.json();
      setFileUrl(url);
      setFileName(file.name);
      await saveMut.mutateAsync({ evidenceFileUrl: url });
      toast({ title: "File uploaded", description: file.name });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err?.message, variant: "destructive" });
    } finally {
      setFileUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const hasEvidence = text.trim() || fileUrl.trim();

  if (!open) {
    return (
      <button
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setOpen(true)}
        data-testid={`button-mysop-evidence-expand-${sop.code}`}
      >
        <FileUp className="h-3.5 w-3.5" />
        {hasEvidence ? (
          <span className="text-emerald-600 font-medium">Evidence submitted</span>
        ) : (
          <span>Add evidence</span>
        )}
        <ChevronDown className="h-3 w-3" />
      </button>
    );
  }

  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-3" data-testid={`section-mysop-evidence-${sop.code}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <FileUp className="h-3.5 w-3.5" /> Evidence
          {hasEvidence && <span className="text-emerald-600">✓</span>}
        </p>
        <button
          className="text-muted-foreground hover:text-foreground"
          onClick={() => setOpen(false)}
          data-testid={`button-mysop-evidence-collapse-${sop.code}`}
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
      </div>

      {sop.evidenceDescription && (
        <p className="text-xs text-muted-foreground italic">
          {sop.evidenceDescription}
        </p>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs">Written response</Label>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={handleBlur}
          placeholder="Describe how you applied this SOP in your work…"
          rows={3}
          className="text-sm resize-none"
          data-testid={`textarea-mysop-evidence-text-${sop.code}`}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">File attachment (PDF, PNG, JPG, DOCX — max 10 MB)</Label>
        {fileUrl ? (
          <div className="flex items-center gap-2 text-xs text-emerald-600">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{fileName ?? "File uploaded"}</span>
            <button
              className="text-muted-foreground hover:text-destructive ml-auto shrink-0"
              onClick={async () => {
                setFileUrl("");
                setFileName(null);
                await saveMut.mutateAsync({ evidenceFileUrl: "" });
              }}
              data-testid={`button-mysop-evidence-remove-file-${sop.code}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.docx"
              className="hidden"
              onChange={handleFileChange}
              data-testid={`input-mysop-evidence-file-${sop.code}`}
            />
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs"
              onClick={() => fileRef.current?.click()}
              disabled={fileUploading}
              data-testid={`button-mysop-evidence-upload-${sop.code}`}
            >
              <Upload className="h-3 w-3" />
              {fileUploading ? "Uploading…" : "Choose file"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function SopGroup({ title, sops, onAck, onQuiz }: { title: string; sops: MySopAssignment[]; onAck: (s: MySopAssignment) => void; onQuiz: (s: MySopAssignment) => void }) {
  const [, setLocation] = useLocation();
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</p>
      <div className="space-y-2">
        {sops.map((sop) => {
          const meta = STATE_META[sop.state];
          const Icon = meta.icon;
          const evidenceRequired = !!(sop.evidenceDescription?.trim());
          const hasEvidence = !!(sop.evidenceText?.trim() || sop.evidenceFileUrl?.trim());
          const ackBlocked = evidenceRequired && !hasEvidence;
          const quizBlocked = sop.quizRequired && !sop.quizPassed;
          return (
            <Card key={sop.sopId} data-testid={`card-mysop-${sop.code}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{sop.code}</span>
                      <span className="truncate">{sop.title}</span>
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">{sop.category} · v{sop.version}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {sop.quizRequired && (
                      <Badge variant={sop.quizPassed ? "default" : "outline"} className="gap-1 text-[10px]" data-testid={`badge-quiz-${sop.code}`}>
                        <Brain className="h-2.5 w-2.5" /> {sop.quizPassed ? "Quiz ✓" : `Quiz (${sop.quizAttempts}/3)`}
                      </Badge>
                    )}
                    <Badge variant={meta.variant} className="gap-1" data-testid={`badge-mysop-state-${sop.code}`}>
                      <Icon className="h-3 w-3" /> {meta.label}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {sop.waveNumber !== null && (
                    <Badge variant="outline" className="gap-1">Wave {sop.waveNumber}</Badge>
                  )}
                  {sop.enforcement === "full" && sop.operational && (
                    <Badge variant="outline" className="gap-1 border-red-300 text-red-600">
                      <Lock className="h-3 w-3" /> Enforced
                    </Badge>
                  )}
                  {sop.enforcement === "measured" && sop.operational && (
                    <Badge variant="outline" className="gap-1 border-amber-300 text-amber-600">
                      Audited
                    </Badge>
                  )}
                  {sop.operational && sop.dueAt && !sop.acknowledgedCurrentVersion && (
                    <span className={sop.overdue ? "text-red-600 font-medium" : ""}>
                      {sop.overdue ? "Overdue since " : "Acknowledge by "}{fmtDate(sop.dueAt)}
                    </span>
                  )}
                  {sop.acknowledgedCurrentVersion && sop.acknowledgedAt && (
                    <span>Acknowledged {fmtDate(sop.acknowledgedAt)}</span>
                  )}
                  {!sop.operational && (
                    <span>Not yet operational — no action needed yet</span>
                  )}
                </div>

                {sop.state !== "queued" && !sop.acknowledgedCurrentVersion && (
                  <EvidenceSection sop={sop} />
                )}

                {sop.state !== "queued" && !sop.acknowledgedCurrentVersion && (
                  <div className="flex flex-wrap gap-2 items-center">
                    {sop.state === "training_pending" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setLocation("/admin/growth")}
                        data-testid={`button-mysop-training-${sop.code}`}
                      >
                        <GraduationCap className="h-3.5 w-3.5 mr-1" /> Complete training
                      </Button>
                    ) : (
                      <>
                        {sop.quizRequired && !sop.quizPassed && (
                          <Button
                            size="sm"
                            variant={sop.quizAttempts > 0 ? "outline" : "default"}
                            onClick={() => onQuiz(sop)}
                            disabled={sop.quizAttempts >= 3}
                            data-testid={`button-mysop-quiz-${sop.code}`}
                          >
                            <Brain className="h-3.5 w-3.5 mr-1" />
                            {sop.quizAttempts === 0 ? "Take Knowledge Check" : sop.quizAttempts >= 3 ? "Attempts exhausted" : `Retry Quiz (${sop.quizAttempts}/3)`}
                          </Button>
                        )}
                        {sop.quizRequired && sop.quizPassed && (
                          <span className="text-xs text-emerald-600 font-medium flex items-center gap-1" data-testid={`text-quiz-passed-${sop.code}`}>
                            <CheckCircle2 className="h-3.5 w-3.5" /> Knowledge check passed
                          </span>
                        )}
                        <Button
                          size="sm"
                          onClick={() => onAck(sop)}
                          disabled={ackBlocked || quizBlocked}
                          data-testid={`button-mysop-ack-${sop.code}`}
                          title={quizBlocked ? "Pass the knowledge check first" : ackBlocked ? "Add evidence first" : undefined}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Acknowledge
                        </Button>
                        {(ackBlocked || quizBlocked) && (
                          <span className="text-xs text-muted-foreground" data-testid={`text-mysop-blocked-${sop.code}`}>
                            {quizBlocked ? "Pass knowledge check first" : "Add evidence first"}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                )}

                {sop.code === "OPS-001" && (
                  <div className="rounded-md border border-dashed p-2.5 space-y-1.5" data-testid={`ops001-access-cta-${sop.code}`}>
                    <p className="text-xs text-muted-foreground">
                      Need a tool or system? Requesting access under least privilege is your responsibility — raise it here for approval.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setLocation("/admin/service-desk")}
                      data-testid={`button-mysop-request-access-${sop.code}`}
                    >
                      <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Request tool access
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ── Quiz Dialog (Task #1419) ──────────────────────────────────────────────────
interface QuizQuestion {
  id: string;
  questionText: string;
  options: string[];
  explanation: string | null;
  position: number;
}

interface ReviewItem {
  questionText: string;
  yourAnswer: number;
  correctIndex: number;
  options: string[];
  explanation: string | null;
  wasCorrect: boolean;
}

interface QuizAttemptResult {
  passed: boolean;
  scorePct: number;
  correct: number;
  total: number;
  attemptNumber: number;
  attemptsRemaining: number;
  cooldownUntil: string | null;
  reviewItems?: ReviewItem[];
}

function QuizDialog({ sop, onClose, onPassedAndAck }: { sop: MySopAssignment; onClose: () => void; onPassedAndAck?: () => void }) {
  const { toast } = useToast();
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [result, setResult] = useState<QuizAttemptResult | null>(null);

  const { data: questions, isLoading } = useQuery<QuizQuestion[]>({
    queryKey: ["/api/sops", sop.sopId, "questions"],
    staleTime: 60000,
  });

  const submitMut = useMutation({
    mutationFn: async () =>
      (await apiRequest("POST", `/api/sops/${sop.sopId}/quiz-attempt`, { answers })).json(),
    onSuccess: (res: QuizAttemptResult) => {
      setResult(res);
      if (res.passed) {
        toast({ title: "Knowledge check passed!", description: `Score: ${res.scorePct}%` });
      }
    },
    onError: (e: any) => toast({ title: "Could not submit", description: e?.message, variant: "destructive" }),
  });

  const qs = questions ?? [];
  const allAnswered = qs.length > 0 && answers.length === qs.length && answers.every((a) => a !== null);

  if (isLoading) {
    return (
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-lg" data-testid="dialog-quiz">
          <DialogHeader><DialogTitle>Knowledge Check — {sop.code}</DialogTitle></DialogHeader>
          <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
        </DialogContent>
      </Dialog>
    );
  }

  if (qs.length === 0) {
    return (
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-lg" data-testid="dialog-quiz">
          <DialogHeader><DialogTitle>Knowledge Check — {sop.code}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">No questions have been added yet.</p>
          <DialogFooter><Button variant="outline" onClick={onClose}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto" data-testid="dialog-quiz">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" /> Knowledge Check — {sop.code}
          </DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="space-y-4 py-2">
            <div className={`flex flex-col items-center gap-2 rounded-lg border p-6 ${result.passed ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20" : "border-red-200 bg-red-50 dark:bg-red-900/20"}`} data-testid="quiz-result">
              {result.passed ? (
                <CheckCircle2 className="h-10 w-10 text-emerald-600" />
              ) : (
                <AlertTriangle className="h-10 w-10 text-red-500" />
              )}
              <p className="text-xl font-bold">{result.scorePct}%</p>
              <p className="text-sm font-medium">{result.passed ? "Passed!" : "Not passed"}</p>
              <p className="text-xs text-muted-foreground">{result.correct}/{result.total} correct</p>
              {!result.passed && result.attemptsRemaining > 0 && (
                <p className="text-xs text-amber-700 dark:text-amber-400 text-center">
                  {result.attemptsRemaining} attempt{result.attemptsRemaining > 1 ? "s" : ""} remaining.
                  {result.cooldownUntil && ` You can retry after ${new Date(result.cooldownUntil).toLocaleTimeString()}.`}
                </p>
              )}
              {!result.passed && result.attemptsRemaining === 0 && (
                <p className="text-xs text-red-600 text-center">No more attempts available. Contact your manager or HR.</p>
              )}
            </div>
            <Progress value={result.scorePct} className="h-2" />

            {/* Review items — shown on pass or final attempt */}
            {result.reviewItems && result.reviewItems.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Answer Review</p>
                {result.reviewItems.map((item, qi) => (
                  <div key={qi} className="rounded-md border p-3 space-y-2" data-testid={`review-item-${qi}`}>
                    <p className="text-sm font-medium">{qi + 1}. {item.questionText}</p>
                    <div className="space-y-1">
                      {item.options.map((opt, oi) => (
                        <div
                          key={oi}
                          className={`text-xs rounded px-2 py-1 border ${
                            oi === item.correctIndex
                              ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                              : oi === item.yourAnswer && !item.wasCorrect
                              ? "border-red-200 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                              : "border-border text-muted-foreground"
                          }`}
                        >
                          {oi === item.correctIndex && <CheckCircle2 className="h-3 w-3 inline mr-1 text-emerald-600" />}
                          {oi === item.yourAnswer && !item.wasCorrect && <X className="h-3 w-3 inline mr-1 text-red-500" />}
                          {opt}
                        </div>
                      ))}
                    </div>
                    {item.explanation && (
                      <p className="text-xs text-muted-foreground border-l-2 border-primary/30 pl-2 italic">{item.explanation}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={onClose} data-testid="button-quiz-close">
                {result.passed && !onPassedAndAck ? "Continue" : "Close"}
              </Button>
              {result.passed && onPassedAndAck && (
                <Button onClick={() => { onClose(); onPassedAndAck(); }} data-testid="button-quiz-close-and-acknowledge">
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Close &amp; Acknowledge
                </Button>
              )}
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">
              {qs.length} question{qs.length > 1 ? "s" : ""} · Pass threshold: 70% · Max 3 attempts per SOP version
            </p>
            <div className="space-y-5">
              {qs.map((q, qi) => (
                <div key={q.id} className="space-y-2" data-testid={`quiz-question-${qi}`}>
                  <p className="text-sm font-medium">{qi + 1}. {q.questionText}</p>
                  <div className="space-y-1.5">
                    {q.options.map((opt, oi) => (
                      <button
                        key={oi}
                        onClick={() => {
                          const next = [...answers];
                          next[qi] = oi;
                          setAnswers(next);
                        }}
                        className={`w-full text-left text-sm rounded-md border px-3 py-2 transition-colors ${
                          answers[qi] === oi
                            ? "border-primary bg-primary/10 text-primary font-medium"
                            : "border-border hover:bg-muted/50"
                        }`}
                        data-testid={`quiz-option-${qi}-${oi}`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose} data-testid="button-quiz-cancel">Cancel</Button>
              <Button
                disabled={!allAnswered || submitMut.isPending}
                onClick={() => submitMut.mutate()}
                data-testid="button-quiz-submit"
              >
                {submitMut.isPending ? "Submitting…" : "Submit Answers"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AcknowledgeDialog({ sop, onClose }: { sop: MySopAssignment; onClose: () => void }) {
  const { toast } = useToast();
  const [typedName, setTypedName] = useState("");
  const ackMut = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/sops/${sop.sopId}/acknowledge`, { typedName })).json(),
    onSuccess: (res: { refNumber?: string }) => {
      toast({ title: "SOP acknowledged", description: `Reference: ${res?.refNumber ?? ""}` });
      queryClient.invalidateQueries({ queryKey: ["/api/sops/my-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sops/my-wave-attestations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/compliance-status"] });
      onClose();
    },
    onError: (e: any) => {
      const msg = e?.message ?? "";
      if (msg.includes("quiz_required") || msg.includes("knowledge check")) {
        toast({ title: "Knowledge check required", description: "Please pass the knowledge check before acknowledging this SOP.", variant: "destructive" });
      } else if (msg.includes("evidence")) {
        toast({ title: "Evidence required", description: "Please add your evidence before acknowledging this SOP.", variant: "destructive" });
      } else {
        toast({ title: "Cannot acknowledge", description: msg, variant: "destructive" });
      }
    },
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" data-testid="dialog-mysop-acknowledge">
        <DialogHeader>
          <DialogTitle>Acknowledge {sop.code} v{sop.version}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          By typing your name you confirm you have read, understood, and will follow this SOP version. This is recorded in the signature ledger.
        </p>
        <div className="space-y-1.5">
          <Label className="text-xs">Type your full name</Label>
          <Input
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            placeholder="Your full name"
            data-testid="input-mysop-ack-name"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-mysop-cancel-ack">Cancel</Button>
          <Button
            disabled={!typedName.trim() || ackMut.isPending}
            onClick={() => ackMut.mutate()}
            data-testid="button-mysop-confirm-ack"
          >
            {ackMut.isPending ? "Recording…" : "Acknowledge"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
