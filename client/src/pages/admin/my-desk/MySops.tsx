import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ShieldCheck, CheckCircle2, Clock, GraduationCap, AlertTriangle, Lock, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [ackSop, setAckSop] = useState<MySopAssignment | null>(null);

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

      {actionable.length > 0 && (
        <SopGroup title="Needs your attention" sops={actionable} onAck={setAckSop} />
      )}
      {queued.length > 0 && (
        <SopGroup title="Coming soon (not yet operational)" sops={queued} onAck={setAckSop} />
      )}
      {acknowledged.length > 0 && (
        <SopGroup title="Acknowledged" sops={acknowledged} onAck={setAckSop} />
      )}

      {ackSop && (
        <AcknowledgeDialog sop={ackSop} onClose={() => setAckSop(null)} />
      )}
    </div>
  );
}

// Soft-enforcement coaching nudge for the dashboard. Shows when the user has
// operational SOPs in soft/measured-enforced waves that they haven't
// acknowledged yet. Full-enforcement overdue SOPs are handled by the compliance
// lock, not this banner. The banner is dismissible for the current session
// (sessionStorage), so it reappears on the user's next login.
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

function SopGroup({ title, sops, onAck }: { title: string; sops: MySopAssignment[]; onAck: (s: MySopAssignment) => void }) {
  const [, setLocation] = useLocation();
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</p>
      <div className="space-y-2">
        {sops.map((sop) => {
          const meta = STATE_META[sop.state];
          const Icon = meta.icon;
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
                  <Badge variant={meta.variant} className="shrink-0 gap-1" data-testid={`badge-mysop-state-${sop.code}`}>
                    <Icon className="h-3 w-3" /> {meta.label}
                  </Badge>
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
                  <div className="flex gap-2">
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
                      <Button
                        size="sm"
                        onClick={() => onAck(sop)}
                        data-testid={`button-mysop-ack-${sop.code}`}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Acknowledge
                      </Button>
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

function AcknowledgeDialog({ sop, onClose }: { sop: MySopAssignment; onClose: () => void }) {
  const { toast } = useToast();
  const [typedName, setTypedName] = useState("");
  const ackMut = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/sops/${sop.sopId}/acknowledge`, { typedName })).json(),
    onSuccess: (res: { refNumber?: string }) => {
      toast({ title: "SOP acknowledged", description: `Reference: ${res?.refNumber ?? ""}` });
      queryClient.invalidateQueries({ queryKey: ["/api/sops/my-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/compliance-status"] });
      onClose();
    },
    onError: (e: any) => toast({ title: "Cannot acknowledge", description: e?.message, variant: "destructive" }),
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
