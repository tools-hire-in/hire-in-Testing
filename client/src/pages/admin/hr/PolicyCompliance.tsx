import { useQuery, useMutation } from "@tanstack/react-query";
import { Shield, CheckCircle, AlertTriangle, Clock, RefreshCw, Download, Moon, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";

interface PolicyTrackMeta {
  id: string;
  title: string;
  versionNumber: number;
  publishedAt: string | null;
  isUniversal?: boolean;
}

interface TrackStatus {
  trackId: string;
  trackTitle: string;
  status: "signed" | "outdated" | "in_progress" | "not_signed" | "not_assigned" | "expiring_soon";
  signedVersion: number | null;
  currentVersion: number;
  signedAt: string | null;
  assignmentId: string | null;
}

interface NightShiftStatus {
  signedAt?: string;
  expiresAt?: string;
  status: "valid" | "expiring_soon" | "expired" | "not_signed";
  daysToExpiry?: number;
}

interface UserRow {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    employeeId: string | null;
    role: string;
    gender: string | null;
  };
  trackStatuses: TrackStatus[];
  nightShiftStatus: NightShiftStatus | null;
}

interface PolicyComplianceData {
  policyTracks: PolicyTrackMeta[];
  matrix: UserRow[];
}

interface NightShiftConsent {
  id: string;
  userId: string;
  signedAt: string;
  expiresAt: string;
  typedName: string;
  isActive: boolean;
  status: "valid" | "expiring_soon" | "expired";
  daysToExpiry: number;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    employeeId: string | null;
    gender: string | null;
  };
}

function statusBadge(status: string, label?: string) {
  const displayLabel = label ?? status;
  switch (status) {
    case "signed":
    case "valid":
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200">{displayLabel === status ? "Signed" : displayLabel}</Badge>;
    case "outdated":
      return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200">Re-sign Required</Badge>;
    case "in_progress":
      return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200">In Progress</Badge>;
    case "not_signed":
      return <Badge variant="destructive">Not Signed</Badge>;
    case "not_assigned":
      return <Badge variant="outline" className="text-muted-foreground">Not Assigned</Badge>;
    case "expiring_soon":
      return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200">Expiring Soon</Badge>;
    case "expired":
      return <Badge variant="destructive">Expired</Badge>;
    default:
      return <Badge variant="outline">{displayLabel}</Badge>;
  }
}

function PolicyMatrix({ data }: { data: PolicyComplianceData }) {
  const tracks = data.policyTracks;
  const matrix = data.matrix;

  const signedCount = matrix.filter(row =>
    row.trackStatuses.every(s => s.status === "signed")
  ).length;
  const pendingCount = matrix.length - signedCount;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <Users className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Total Employees</p>
              <p className="text-xl font-bold" data-testid="count-total-employees">{matrix.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-xs text-muted-foreground">Fully Compliant</p>
              <p className="text-xl font-bold text-green-600" data-testid="count-fully-compliant">{signedCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <div>
              <p className="text-xs text-muted-foreground">Pending / Outdated</p>
              <p className="text-xl font-bold text-amber-600" data-testid="count-pending">{pendingCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Matrix Table */}
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-background z-10 min-w-[180px]">Employee</TableHead>
              <TableHead className="min-w-[100px]">Role</TableHead>
              {tracks.map(t => (
                <TableHead key={t.id} className="min-w-[140px]">
                  <div className="space-y-0.5">
                    <div className="font-medium truncate max-w-32">{t.title}</div>
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-xs font-normal text-muted-foreground">v{t.versionNumber}</span>
                      {t.isUniversal && (
                        <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 px-1.5 py-0 rounded-full font-medium leading-tight">Universal</span>
                      )}
                    </div>
                  </div>
                </TableHead>
              ))}
              <TableHead className="min-w-[120px]">Night Shift</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {matrix.map(row => {
              const hasUnsignedTrack = row.trackStatuses.some(s =>
                s.status === "not_signed" || s.status === "outdated" || s.status === "in_progress"
              );
              const hasNsIssue = row.user.gender === "Female" && (
                !row.nightShiftStatus || row.nightShiftStatus.status === "expired" || row.nightShiftStatus.status === "not_signed"
              );
              const isNonCompliant = hasUnsignedTrack || hasNsIssue;
              const isPartial = !isNonCompliant && row.trackStatuses.some(s => s.status === "expiring_soon") ||
                (row.user.gender === "Female" && row.nightShiftStatus?.status === "expiring_soon");
              return (
              <TableRow key={row.user.id} data-testid={`row-compliance-${row.user.id}`} className={isNonCompliant ? "bg-red-50/30 dark:bg-red-950/10" : ""}>
                <TableCell className="sticky left-0 bg-background z-10">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{row.user.firstName} {row.user.lastName}</span>
                      {isNonCompliant && (
                        <Badge variant="destructive" className="text-xs py-0 px-1.5 h-4" data-testid={`badge-noncompliant-${row.user.id}`}>
                          Non-Compliant
                        </Badge>
                      )}
                      {!isNonCompliant && isPartial && (
                        <Badge className="text-xs py-0 px-1.5 h-4 bg-amber-100 text-amber-800 border-amber-200" data-testid={`badge-expiring-${row.user.id}`}>
                          Expiring Soon
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">{row.user.employeeId || row.user.email}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs capitalize">{row.user.role}</Badge>
                </TableCell>
                {tracks.map(t => {
                  const s = row.trackStatuses.find(ts => ts.trackId === t.id);
                  return (
                    <TableCell key={t.id}>
                      <div className="space-y-1">
                        {s ? statusBadge(s.status) : statusBadge("not_assigned")}
                        {s?.signedAt && (
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(s.signedAt), "MMM d, yyyy")}
                          </div>
                        )}
                        {s?.status === "outdated" && (
                          <div className="text-xs text-amber-600">v{s.signedVersion} → v{s.currentVersion}</div>
                        )}
                      </div>
                    </TableCell>
                  );
                })}
                <TableCell>
                  {row.user.gender !== "Female" ? (
                    <span className="text-xs text-muted-foreground">N/A</span>
                  ) : row.nightShiftStatus ? (
                    <div className="space-y-1">
                      {statusBadge(row.nightShiftStatus.status)}
                      {row.nightShiftStatus.expiresAt && (
                        <div className="text-xs text-muted-foreground">
                          Exp: {format(new Date(row.nightShiftStatus.expiresAt), "MMM d, yyyy")}
                        </div>
                      )}
                    </div>
                  ) : (
                    statusBadge("not_signed")
                  )}
                </TableCell>
              </TableRow>
            ); })}
            {matrix.length === 0 && (
              <TableRow>
                <TableCell colSpan={3 + tracks.length} className="text-center py-10 text-muted-foreground">
                  No employees found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function NightShiftConsentsTable({ consents }: { consents: NightShiftConsent[] }) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead>
            <TableHead>ID</TableHead>
            <TableHead>Signed On</TableHead>
            <TableHead>Expires On</TableHead>
            <TableHead>Days Left</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {consents.map(c => (
            <TableRow key={c.id} data-testid={`row-night-shift-${c.id}`}>
              <TableCell>
                <div>
                  <div className="font-medium text-sm">{c.user.firstName} {c.user.lastName}</div>
                  <div className="text-xs text-muted-foreground">{c.user.email}</div>
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{c.user.employeeId || "—"}</TableCell>
              <TableCell className="text-sm">{format(new Date(c.signedAt), "MMM d, yyyy")}</TableCell>
              <TableCell className="text-sm">{format(new Date(c.expiresAt), "MMM d, yyyy")}</TableCell>
              <TableCell>
                {c.status === "expired" ? (
                  <span className="text-destructive font-medium text-sm">Expired</span>
                ) : (
                  <span className={`text-sm font-medium ${c.daysToExpiry <= 30 ? "text-amber-600" : "text-green-600"}`}>
                    {c.daysToExpiry}d
                  </span>
                )}
              </TableCell>
              <TableCell>{statusBadge(c.status)}</TableCell>
            </TableRow>
          ))}
          {consents.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                No active night shift consents found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export function PolicyComplianceContent() {
  const { toast } = useToast();

  const { data, isLoading, refetch } = useQuery<PolicyComplianceData>({
    queryKey: ["/api/onboarding/policy-compliance"],
    queryFn: async () => {
      const res = await fetch("/api/onboarding/policy-compliance", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch policy compliance");
      return res.json();
    },
  });

  const { data: nightShiftConsents, isLoading: nightShiftLoading } = useQuery<NightShiftConsent[]>({
    queryKey: ["/api/onboarding/night-shift-consents"],
    queryFn: async () => {
      const res = await fetch("/api/onboarding/night-shift-consents", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch night shift consents");
      return res.json();
    },
  });

  const retroactiveMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/onboarding/retroactive-assign-policies", {}),
    onSuccess: async (res: any) => {
      const data = await res.json();
      toast({ title: "Retroactive assignment complete", description: `Assigned: ${data.assigned}, Skipped: ${data.skipped}` });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/policy-compliance"] });
    },
    onError: (error: any) => {
      toast({ title: "Failed", description: error?.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6" data-testid="section-policy-compliance">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Policy Compliance Dashboard
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track mandatory policy acknowledgments and night shift consents across your organization.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { refetch(); }}
            data-testid="button-refresh-compliance"
          >
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => retroactiveMutation.mutate()}
            disabled={retroactiveMutation.isPending}
            data-testid="button-retroactive-assign"
          >
            <Download className="h-4 w-4 mr-1.5" />
            {retroactiveMutation.isPending ? "Assigning…" : "Assign to All"}
          </Button>
        </div>
      </div>

      <section className="space-y-3" data-testid="section-policy-matrix">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          Policy Matrix
        </h3>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : data ? (
          <PolicyMatrix data={data} />
        ) : null}
      </section>

      <section className="space-y-3" data-testid="section-night-shift">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <Moon className="h-4 w-4 text-primary" />
          Night Shift Consents
        </h3>
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-300">
            <Clock className="h-4 w-4 shrink-0" />
            <span>
              Night Shift Consent is required annually (12-month validity) for Female employees.
              Alerts are sent 30 days (to HR) and 14 days (to employee) before expiry.
            </span>
          </div>
          {nightShiftLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : nightShiftConsents ? (
            <NightShiftConsentsTable consents={nightShiftConsents} />
          ) : null}
        </div>
      </section>
    </div>
  );
}
