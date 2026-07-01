import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ClipboardCheck, AlertTriangle, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useSopAccess } from "@/hooks/use-sop-access";

interface OwnerUser { id: string; firstName: string | null; lastName: string | null; email: string; }
function ownerLabel(u: OwnerUser) { return `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email; }

interface PendingAuditItem {
  sopId: string;
  sopMasterId: string;
  code: string;
  title: string;
  category: string;
  auditOwnerRole: string | null;
  frequency: string | null;
  weekDate: string;
  audited: boolean;
  lastAudit: { weekDate: string | null; auditScore: number | null; missesCount: number } | null;
  openFindings: number;
}

interface PendingAuditsResponse {
  weekDate: string;
  pendingCount: number;
  items: PendingAuditItem[];
}

export default function PendingSopAuditsCard({ enabled }: { enabled: boolean }) {
  const { enabled: sopEnabled } = useSopAccess();
  const [active, setActive] = useState<PendingAuditItem | null>(null);

  const { data } = useQuery<PendingAuditsResponse>({
    queryKey: ["/api/sops/audits/pending"],
    enabled: enabled && sopEnabled,
  });

  if (!enabled || !sopEnabled || !data || data.items.length === 0) return null;

  const pending = data.items.filter((i) => !i.audited);

  return (
    <>
      <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20" data-testid="card-pending-sop-audits">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-amber-600" />
              <CardTitle className="text-sm font-semibold">Pending SOP Audits</CardTitle>
            </div>
            <Badge variant={pending.length > 0 ? "destructive" : "secondary"} data-testid="badge-pending-audit-count">
              {pending.length} due this week
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {data.items.slice(0, 6).map((item) => (
            <button
              key={item.sopId}
              type="button"
              onClick={() => setActive(item)}
              className="w-full flex items-center justify-between rounded-lg border bg-background px-2.5 py-1.5 text-left text-xs hover:bg-muted/60 transition-colors"
              data-testid={`row-pending-audit-${item.code}`}
            >
              <div className="min-w-0">
                <span className="font-medium">{item.code}</span>
                <span className="text-muted-foreground ml-1.5 truncate">{item.title}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {item.openFindings > 0 && (
                  <Badge variant="outline" className="text-[10px] gap-0.5 text-red-600 border-red-200">
                    <AlertTriangle className="h-2.5 w-2.5" /> {item.openFindings}
                  </Badge>
                )}
                {item.audited ? (
                  <Badge variant="default" className="text-[10px]">Audited</Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px]">Pending</Badge>
                )}
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            </button>
          ))}
        </CardContent>
      </Card>
      {active && (
        <AuditChecklistDrawer item={active} onClose={() => setActive(null)} />
      )}
    </>
  );
}

function AuditChecklistDrawer({ item, onClose }: { item: PendingAuditItem; onClose: () => void }) {
  const { toast } = useToast();
  const [evidenceCollected, setEvidenceCollected] = useState(false);
  const [missesCount, setMissesCount] = useState("0");
  const [auditScore, setAuditScore] = useState("");
  const [notes, setNotes] = useState("");
  const [findingDesc, setFindingDesc] = useState("");
  const [findingAction, setFindingAction] = useState("");
  const [findingDue, setFindingDue] = useState("");
  const [findingOwner, setFindingOwner] = useState("none");

  const { data: usersResp } = useQuery<{ users: OwnerUser[] }>({ queryKey: ["/api/admin/users"] });
  const owners = usersResp?.users ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/sops/audits/pending"] });
    queryClient.invalidateQueries({ queryKey: ["/api/sops", item.sopId, "audits"] });
    queryClient.invalidateQueries({ queryKey: ["/api/sops/compliance/summary"] });
  };

  const submitAudit = useMutation({
    mutationFn: async () =>
      (await apiRequest("POST", `/api/sops/${item.sopId}/audits`, {
        evidenceCollected,
        missesCount: Number(missesCount) || 0,
        auditScore: auditScore === "" ? null : Number(auditScore),
        notes: notes.trim() || null,
      })).json(),
    onSuccess: () => { invalidate(); toast({ title: "Audit submitted", description: `${item.code} audited for this week.` }); onClose(); },
    onError: (e: any) => toast({ title: "Submit failed", description: e?.message, variant: "destructive" }),
  });

  const raiseFinding = useMutation({
    mutationFn: async () =>
      (await apiRequest("POST", `/api/sops/${item.sopId}/findings`, {
        description: findingDesc.trim(),
        correctiveAction: findingAction.trim() || null,
        dueDate: findingDue || null,
        ownerId: findingOwner === "none" ? null : findingOwner,
      })).json(),
    onSuccess: () => { invalidate(); toast({ title: "Finding raised" }); setFindingDesc(""); setFindingAction(""); setFindingDue(""); setFindingOwner("none"); },
    onError: (e: any) => toast({ title: "Failed to raise finding", description: e?.message, variant: "destructive" }),
  });

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto" data-testid="drawer-audit-checklist">
        <SheetHeader>
          <SheetTitle>{item.code} — Weekly Audit</SheetTitle>
          <SheetDescription>{item.title}</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-5 text-sm">
          <div className="rounded-lg border p-3 text-xs text-muted-foreground space-y-1">
            <div className="flex justify-between"><span>Audit owner</span><span className="font-medium text-foreground">{item.auditOwnerRole ?? "—"}</span></div>
            <div className="flex justify-between"><span>Frequency</span><span className="font-medium text-foreground">{item.frequency ?? "—"}</span></div>
            <div className="flex justify-between"><span>Week of</span><span className="font-medium text-foreground">{item.weekDate}</span></div>
            {item.lastAudit?.weekDate && (
              <div className="flex justify-between"><span>Last audit</span><span className="font-medium text-foreground">{item.lastAudit.weekDate} (score {item.lastAudit.auditScore ?? "—"})</span></div>
            )}
          </div>

          {item.audited ? (
            <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/30 p-3 text-xs text-green-700 dark:text-green-300" data-testid="text-already-audited">
              This SOP has already been audited this week.
            </div>
          ) : (
            <div className="space-y-4">
              <p className="font-medium">Checklist</p>
              <div className="flex items-center justify-between">
                <Label htmlFor="evidence" className="text-sm">Evidence collected</Label>
                <Switch id="evidence" checked={evidenceCollected} onCheckedChange={setEvidenceCollected} data-testid="switch-evidence-collected" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="misses" className="text-xs">Misses count</Label>
                  <Input id="misses" type="number" min={0} value={missesCount} onChange={(e) => setMissesCount(e.target.value)} data-testid="input-misses-count" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="score" className="text-xs">Audit score (0-100)</Label>
                  <Input id="score" type="number" min={0} max={100} value={auditScore} onChange={(e) => setAuditScore(e.target.value)} placeholder="—" data-testid="input-audit-score" />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="notes" className="text-xs">Notes</Label>
                <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Observations..." data-testid="input-audit-notes" />
              </div>
              <Button className="w-full" disabled={submitAudit.isPending} onClick={() => submitAudit.mutate()} data-testid="button-submit-audit">
                {submitAudit.isPending ? "Submitting..." : "Submit Audit"}
              </Button>
            </div>
          )}

          <div className="space-y-3 border-t pt-4">
            <p className="font-medium flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> Raise a finding</p>
            <Textarea value={findingDesc} onChange={(e) => setFindingDesc(e.target.value)} rows={2} placeholder="What was the gap or issue?" data-testid="input-finding-description" />
            <Textarea value={findingAction} onChange={(e) => setFindingAction(e.target.value)} rows={2} placeholder="Corrective action (optional)" data-testid="input-finding-action" />
            <div className="space-y-1">
              <Label className="text-xs">Owner (optional)</Label>
              <Select value={findingOwner} onValueChange={setFindingOwner}>
                <SelectTrigger data-testid="select-finding-owner"><SelectValue placeholder="Assign owner" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {owners.map((u) => <SelectItem key={u.id} value={u.id}>{ownerLabel(u)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="due" className="text-xs">Due date (optional)</Label>
              <Input id="due" type="date" value={findingDue} onChange={(e) => setFindingDue(e.target.value)} data-testid="input-finding-due" />
            </div>
            <Button variant="outline" className="w-full" disabled={!findingDesc.trim() || raiseFinding.isPending} onClick={() => raiseFinding.mutate()} data-testid="button-raise-finding">
              {raiseFinding.isPending ? "Saving..." : "Raise Finding"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
