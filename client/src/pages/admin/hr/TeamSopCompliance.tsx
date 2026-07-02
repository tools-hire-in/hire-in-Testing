import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, CheckCircle2, Clock, GraduationCap, AlertTriangle, ChevronDown, ChevronUp, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSopAccess } from "@/hooks/use-sop-access";

interface SopRow {
  code: string;
  title: string;
  state: "queued" | "training_pending" | "ready" | "acknowledged";
  overdue: boolean;
  dueAt: string | null;
  acknowledgedAt: string | null;
}

interface MemberRow {
  userId: string;
  name: string;
  role: string | null;
  total: number;
  acknowledged: number;
  trainingPending: number;
  overdue: number;
  sops: SopRow[];
}

interface TeamComplianceResponse {
  members: MemberRow[];
}

const STATE_META: Record<SopRow["state"], { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  acknowledged: { label: "Acknowledged", variant: "default" },
  ready: { label: "Pending", variant: "secondary" },
  training_pending: { label: "Training pending", variant: "secondary" },
  queued: { label: "Queued", variant: "outline" },
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }); }
  catch { return "—"; }
}

function SopChip({ sop }: { sop: SopRow }) {
  const meta = sop.overdue ? { label: "Overdue", variant: "destructive" as const } : STATE_META[sop.state];
  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs"
      data-testid={`chip-sop-${sop.code}`}
    >
      <span className="font-mono text-[10px] text-muted-foreground">{sop.code}</span>
      <span className="truncate max-w-[120px]" title={sop.title}>{sop.title}</span>
      <Badge variant={meta.variant} className="text-[10px] shrink-0">{meta.label}</Badge>
      {sop.overdue && sop.dueAt && (
        <span className="text-[10px] text-destructive shrink-0">since {fmtDate(sop.dueAt)}</span>
      )}
    </div>
  );
}

function MemberDetailRow({ member }: { member: MemberRow }) {
  const [expanded, setExpanded] = useState(false);
  const hasIssues = member.overdue > 0 || (member.total > 0 && member.acknowledged < member.total);

  return (
    <>
      <TableRow
        className="cursor-pointer"
        onClick={() => member.sops.length > 0 && setExpanded((v) => !v)}
        data-testid={`row-member-${member.userId}`}
      >
        <TableCell>
          <div className="font-medium">{member.name}</div>
          {member.role && (
            <div className="text-xs text-muted-foreground capitalize">{member.role.replace(/_/g, " ")}</div>
          )}
        </TableCell>
        <TableCell className="text-center tabular-nums">{member.total}</TableCell>
        <TableCell className="text-center tabular-nums text-green-600 font-medium">{member.acknowledged}</TableCell>
        <TableCell className="text-center tabular-nums">
          {member.trainingPending > 0 ? (
            <Badge variant="secondary" className="text-[10px]">{member.trainingPending}</Badge>
          ) : <span className="text-muted-foreground">0</span>}
        </TableCell>
        <TableCell className="text-center tabular-nums">
          {member.overdue > 0 ? (
            <Badge variant="destructive" className="text-[10px]" data-testid={`badge-overdue-${member.userId}`}>{member.overdue}</Badge>
          ) : <span className="text-muted-foreground">0</span>}
        </TableCell>
        <TableCell className="text-right">
          {member.sops.length > 0 ? (
            expanded
              ? <ChevronUp className="h-4 w-4 text-muted-foreground ml-auto" />
              : <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto" />
          ) : null}
        </TableCell>
      </TableRow>
      {expanded && member.sops.length > 0 && (
        <TableRow data-testid={`row-member-detail-${member.userId}`}>
          <TableCell colSpan={6} className="bg-muted/30 pt-2 pb-3">
            <div className="flex flex-wrap gap-1.5 pl-2">
              {member.sops.map((sop) => (
                <SopChip key={sop.code} sop={sop} />
              ))}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export default function TeamSopCompliance() {
  const { enabled, isLoading: accessLoading } = useSopAccess();

  const { data, isLoading } = useQuery<TeamComplianceResponse>({
    queryKey: ["/api/sops/team-compliance"],
    enabled: enabled,
    staleTime: 30000,
  });

  if (accessLoading) {
    return <Skeleton className="h-40 w-full" />;
  }

  if (!enabled) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-center" data-testid="team-sop-not-enabled">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
          <ShieldCheck className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="font-semibold">SOP Compliance unavailable</p>
        <p className="text-sm text-muted-foreground max-w-sm">
          Process Governance hasn't been enabled for your account yet.
        </p>
      </div>
    );
  }

  const members = data?.members ?? [];

  const totalOverdue = members.reduce((s, m) => s + m.overdue, 0);
  const totalAcknowledged = members.reduce((s, m) => s + m.acknowledged, 0);
  const totalAssigned = members.reduce((s, m) => s + m.total, 0);
  const adoptionPct = totalAssigned > 0 ? Math.round((totalAcknowledged / totalAssigned) * 100) : 0;

  return (
    <div className="space-y-4 p-4 sm:p-6" data-testid="team-sop-compliance">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2" data-testid="text-team-sop-title">
          <ShieldCheck className="h-5 w-5 text-primary" /> My Team's SOPs
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Read-only view of your direct reports' SOP acknowledgement status. Expand a row to see per-SOP details.
        </p>
      </div>

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="py-4 text-center">
                <p className="text-2xl font-bold text-green-600" data-testid="stat-team-adoption">{adoptionPct}%</p>
                <p className="text-xs text-muted-foreground mt-0.5">Team adoption</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 text-center">
                <p className="text-2xl font-bold" data-testid="stat-team-acknowledged">{totalAcknowledged}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Acknowledged</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 text-center">
                <p className={`text-2xl font-bold ${totalOverdue > 0 ? "text-destructive" : ""}`} data-testid="stat-team-overdue">{totalOverdue}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Overdue</p>
              </CardContent>
            </Card>
          </div>

          {members.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center" data-testid="team-sop-empty">
              <Users className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No direct reports found.</p>
            </div>
          ) : (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Direct reports — SOP compliance</CardTitle>
              </CardHeader>
              <CardContent className="px-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead className="text-center">Assigned</TableHead>
                        <TableHead className="text-center">Acknowledged</TableHead>
                        <TableHead className="text-center">Training pending</TableHead>
                        <TableHead className="text-center">Overdue</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {members.map((member) => (
                        <MemberDetailRow key={member.userId} member={member} />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
