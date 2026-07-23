import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  User,
  Mail,
  Building2,
  Calendar,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
  BookOpen,
  ClipboardList,
  Hash,
  ExternalLink,
  UserCog,
  KeyRound,
  ShieldOff,
  UserX,
  UserCheck,
} from "lucide-react";

interface DossierData {
  profile: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    designation: string | null;
    departmentId: string | null;
    departmentName: string | null;
    managerId: string | null;
    managerName: string | null;
    joiningDate: string | null;
    shiftId: string | null;
    shiftName: string | null;
    gender: string | null;
    employmentStatus: string | null;
    isActive: boolean;
    totpEnabled: boolean;
    employeeId: string | null;
    hierarchyLevel: string | null;
    salary: string | null;
    attendanceExempt: boolean;
  };
  policyCompliance: {
    tracks: PolicyTrack[];
    nightShiftConsent: NightShiftConsent | null;
  };
  training: TrainingTrack[];
  documents: {
    offerLetters: OfferLetterSummary[];
    hrLetters: HrLetterSummary[];
    leaveBalances: LeaveBalanceSummary[];
  };
}

interface PolicyTrack {
  assignmentId: string;
  trackId: string;
  trackTitle: string;
  isPolicyTrack: boolean;
  status: string;
  completionPct: number;
  dueDate: string | null;
  completedAt: string | null;
  isOverdue: boolean;
  lastActivityAt: string | null;
  signedVersion: number | null;
  currentVersion: number;
}

interface TrainingTrack {
  assignmentId: string;
  trackId: string;
  trackTitle: string;
  isPolicyTrack: boolean;
  status: string;
  completionPct: number;
  dueDate: string | null;
  completedAt: string | null;
  isOverdue: boolean;
  lastActivityAt: string | null;
}

interface NightShiftConsent {
  status: "valid" | "expired" | "expiring_soon" | "not_signed";
  signedAt?: string;
  expiresAt?: string;
}

interface OfferLetterSummary {
  id: string;
  token: string;
  status: string;
  candidateName: string;
  designation: string;
  proposedStartDate: string | null;
  offerDate: string | null;
  acceptedAt: string | null;
  counterSignedAt: string | null;
  createdAt: string;
}

interface HrLetterSummary {
  id: string;
  templateType: string;
  status: string;
  referenceNumber: string | null;
  issueDate: string | null;
  issuedAt: string | null;
  employeeName: string;
}

interface LeaveBalanceSummary {
  id: string;
  leaveTypeId: string;
  leaveTypeName: string;
  totalDays: string;
  usedDays: string;
  year: number;
}

const roleLabels: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  hr: "HR",
  operations: "Operations",
  manager: "Manager",
  employee: "Employee",
};

const roleColors: Record<string, string> = {
  super_admin: "bg-purple-100 text-purple-800",
  admin: "bg-blue-100 text-blue-800",
  hr: "bg-green-100 text-green-800",
  operations: "bg-orange-100 text-orange-800",
  manager: "bg-violet-100 text-violet-800",
  employee: "bg-gray-100 text-gray-800",
};

const levelLabels: Record<string, string> = {
  ceo: "CEO",
  vp: "Vice President",
  director: "Director",
  manager: "Manager",
  team_lead: "Team Lead",
  delivery_manager: "Delivery Manager",
  team_member: "Team Member",
};

const templateTypeLabels: Record<string, string> = {
  experience: "Experience Letter",
  internship_completion: "Internship Completion",
  internship_certificate: "Internship Certificate",
  relieving: "Relieving Letter",
  salary_revision: "Salary Revision",
  role_change: "Role Change / Promotion",
  combined: "Combined Letter",
  device_allocation: "Device Allocation",
};

function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    return format(new Date(d), "dd MMM yyyy");
  } catch {
    return d;
  }
}

function PolicyStatusBadge({ track }: { track: PolicyTrack }) {
  if (track.status === "completed") {
    if (track.signedVersion !== null && track.signedVersion === track.currentVersion) {
      return <Badge className="bg-green-100 text-green-800">Signed</Badge>;
    }
    return <Badge className="bg-amber-100 text-amber-800">Outdated</Badge>;
  }
  if (track.isOverdue) return <Badge variant="destructive">Overdue</Badge>;
  if (track.status === "in_progress") return <Badge className="bg-blue-100 text-blue-800">In Progress</Badge>;
  return <Badge variant="outline" className="text-muted-foreground">Pending</Badge>;
}

function TrainingStatusBadge({ track }: { track: TrainingTrack }) {
  if (track.status === "completed") return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
  if (track.isOverdue) return <Badge variant="destructive">Overdue</Badge>;
  if (track.status === "in_progress") return <Badge className="bg-blue-100 text-blue-800">In Progress</Badge>;
  return <Badge variant="outline" className="text-muted-foreground">Not Started</Badge>;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b last:border-0">
      <span className="text-xs font-medium text-muted-foreground w-36 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm flex-1">{value ?? "—"}</span>
    </div>
  );
}

interface Props {
  userId: string | null;
  onClose: () => void;
  canEdit?: boolean;
  canResetPassword?: boolean;
  canReset2FA?: boolean;
  canToggleActive?: boolean;
  onEditProfile?: () => void;
  onResetPassword?: () => void;
  onReset2FA?: () => void;
  onToggleActive?: () => void;
  reset2FAIsPending?: boolean;
}

export function EmployeeDossierSheet({ userId, onClose, canEdit, canResetPassword, canReset2FA, canToggleActive, onEditProfile, onResetPassword, onReset2FA, onToggleActive, reset2FAIsPending }: Props) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  const { data, isLoading } = useQuery<DossierData>({
    queryKey: ["/api/admin/employees", userId, "dossier"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/employees/${userId}/dossier`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch dossier");
      return res.json();
    },
    enabled: !!userId,
  });

  const exemptMutation = useMutation({
    mutationFn: async (newValue: boolean) => {
      return apiRequest("PATCH", `/api/admin/users/${userId}`, { attendanceExempt: newValue });
    },
    onMutate: async (newValue: boolean) => {
      await queryClient.cancelQueries({ queryKey: ["/api/admin/employees", userId, "dossier"] });
      const previous = queryClient.getQueryData<DossierData>(["/api/admin/employees", userId, "dossier"]);
      if (previous) {
        queryClient.setQueryData<DossierData>(["/api/admin/employees", userId, "dossier"], {
          ...previous,
          profile: { ...previous.profile, attendanceExempt: newValue },
        });
      }
      return { previous };
    },
    onError: (_err, _newValue, context: { previous?: DossierData } | undefined) => {
      if (context?.previous) {
        queryClient.setQueryData(["/api/admin/employees", userId, "dossier"], context.previous);
      }
      toast({ title: "Failed to update attendance exemption", variant: "destructive" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/employees", userId, "dossier"] });
      toast({ title: "Attendance exemption updated" });
    },
  });

  const canToggleExemption = ["super_admin", "admin", "hr"].includes(currentUser?.role ?? "");

  const nonCompliantCount = data
    ? data.policyCompliance.tracks.filter(t => {
        if (t.status === "completed" && t.signedVersion === t.currentVersion) return false;
        return true;
      }).length
    : 0;

  const overdueTrainingCount = data
    ? data.training.filter(t => t.isOverdue).length
    : 0;

  return (
    <Sheet open={!!userId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl overflow-y-auto p-0"
        data-testid="employee-dossier-sheet"
      >
        {isLoading || !data ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
            <div className="space-y-3 mt-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </div>
        ) : (
          <>
            <SheetHeader className="px-6 pt-6 pb-4 border-b">
              <SheetTitle className="text-xl" data-testid="dossier-employee-name">
                {data.profile.firstName} {data.profile.lastName}
              </SheetTitle>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <Badge className={roleColors[data.profile.role] || roleColors.employee}>
                  {roleLabels[data.profile.role] || data.profile.role}
                </Badge>
                {data.profile.employeeId && (
                  <span className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                    <Hash className="h-3 w-3" />{data.profile.employeeId}
                  </span>
                )}
                {data.profile.employmentStatus && data.profile.employmentStatus !== "active" && (
                  <Badge variant="outline" className="text-orange-600 border-orange-300">
                    {data.profile.employmentStatus === "relieved" ? "Relieved" : "Left Company"}
                  </Badge>
                )}
                {!data.profile.isActive && data.profile.employmentStatus === "active" && (
                  <Badge variant="secondary">Disabled</Badge>
                )}
              </div>

            </SheetHeader>

            {/* Quick Actions bar — sticky below the header */}
            {(canEdit || canResetPassword || canReset2FA || canToggleActive) && (
              <div className="sticky top-0 z-10 bg-background border-b px-6 py-2.5 flex flex-wrap gap-2">
                {canEdit && onEditProfile && (
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={onEditProfile}
                    data-testid="dossier-btn-edit-profile"
                  >
                    <UserCog className="h-3.5 w-3.5" />
                    Edit Profile
                  </Button>
                )}
                {canResetPassword && onResetPassword && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={onResetPassword}
                    data-testid="dossier-btn-reset-password"
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    Reset Password
                  </Button>
                )}
                {canReset2FA && onReset2FA && data.profile.totpEnabled && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={onReset2FA}
                    disabled={reset2FAIsPending}
                    data-testid="dossier-btn-reset-2fa"
                  >
                    <ShieldOff className="h-3.5 w-3.5" />
                    Reset 2FA
                  </Button>
                )}
                {canToggleActive && onToggleActive && (
                  <Button
                    size="sm"
                    variant="outline"
                    className={`gap-1.5 ${data.profile.isActive ? "text-amber-700 border-amber-400 hover:bg-amber-50" : "text-green-700 border-green-400 hover:bg-green-50"}`}
                    onClick={onToggleActive}
                    data-testid="dossier-btn-toggle-active"
                  >
                    {data.profile.isActive
                      ? <><UserX className="h-3.5 w-3.5" /> Disable Account</>
                      : <><UserCheck className="h-3.5 w-3.5" /> Enable Account</>}
                  </Button>
                )}
              </div>
            )}

            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="flex w-full rounded-none border-b h-auto p-0 bg-transparent">
                <TabsTrigger
                  value="overview"
                  className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none py-3"
                  data-testid="dossier-tab-overview"
                >
                  Overview
                </TabsTrigger>
                <TabsTrigger
                  value="compliance"
                  className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none py-3 gap-2"
                  data-testid="dossier-tab-compliance"
                >
                  Compliance
                  {nonCompliantCount > 0 && (
                    <Badge variant="destructive" className="h-5 text-xs px-1.5">{nonCompliantCount}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="training"
                  className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none py-3 gap-2"
                  data-testid="dossier-tab-training"
                >
                  Training
                  {overdueTrainingCount > 0 && (
                    <Badge variant="destructive" className="h-5 text-xs px-1.5">{overdueTrainingCount}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="documents"
                  className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none py-3"
                  data-testid="dossier-tab-documents"
                >
                  Documents
                </TabsTrigger>
              </TabsList>

              {/* OVERVIEW TAB */}
              <TabsContent value="overview" className="p-6 space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                    <User className="h-4 w-4" /> Profile
                  </h3>
                  <div className="divide-y">
                    <InfoRow label="Full Name" value={`${data.profile.firstName} ${data.profile.lastName}`} />
                    <InfoRow label="Employee ID" value={
                      data.profile.employeeId
                        ? <span className="font-mono text-xs">{data.profile.employeeId}</span>
                        : null
                    } />
                    <InfoRow label="Email" value={
                      <span className="flex items-center gap-1">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                        {data.profile.email}
                      </span>
                    } />
                    <InfoRow label="Role" value={
                      <Badge className={roleColors[data.profile.role] || roleColors.employee}>
                        {roleLabels[data.profile.role] || data.profile.role}
                      </Badge>
                    } />
                    <InfoRow label="Designation" value={data.profile.designation} />
                    <InfoRow label="Department" value={
                      data.profile.departmentName
                        ? <span className="flex items-center gap-1">
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                            {data.profile.departmentName}
                          </span>
                        : null
                    } />
                    <InfoRow label="Manager" value={data.profile.managerName} />
                    <InfoRow label="Hierarchy Level" value={
                      data.profile.hierarchyLevel
                        ? levelLabels[data.profile.hierarchyLevel] || data.profile.hierarchyLevel
                        : null
                    } />
                    <InfoRow label="Joining Date" value={
                      data.profile.joiningDate
                        ? <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                            {formatDate(data.profile.joiningDate + "T00:00:00")}
                          </span>
                        : null
                    } />
                    <InfoRow label="Shift" value={
                      data.profile.shiftName
                        ? <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            {data.profile.shiftName}
                          </span>
                        : null
                    } />
                    <InfoRow label="Gender" value={data.profile.gender} />
                    <InfoRow label="Employment Status" value={
                      data.profile.employmentStatus === "active"
                        ? <Badge variant={data.profile.isActive ? "default" : "secondary"}>
                            {data.profile.isActive ? "Active" : "Disabled"}
                          </Badge>
                        : data.profile.employmentStatus === "relieved"
                        ? <Badge className="bg-orange-100 text-orange-800">Relieved</Badge>
                        : data.profile.employmentStatus === "left_company"
                        ? <Badge className="bg-rose-100 text-rose-800">Left Company</Badge>
                        : null
                    } />
                    <InfoRow label="2FA Status" value={
                      <span className="flex items-center gap-1">
                        <Shield className={`h-3.5 w-3.5 ${data.profile.totpEnabled ? "text-green-600" : "text-amber-500"}`} />
                        {data.profile.totpEnabled
                          ? <span className="text-green-600 font-medium">Enabled</span>
                          : <span className="text-amber-600">Not set up</span>}
                      </span>
                    } />
                  </div>
                </div>
              </TabsContent>

              {/* COMPLIANCE TAB */}
              <TabsContent value="compliance" className="p-6 space-y-6">
                {/* Attendance Exemption — visible to super_admin, admin, hr only */}
                {canToggleExemption && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                      <Shield className="h-4 w-4" /> Attendance Settings
                    </h3>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <Label htmlFor="dossier-attendance-exempt" className="text-sm font-medium cursor-pointer">
                          Attendance Exempt
                        </Label>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Exempt from punch in/out requirements. Leave accrual continues normally.
                        </p>
                      </div>
                      <Switch
                        id="dossier-attendance-exempt"
                        checked={data.profile.attendanceExempt}
                        onCheckedChange={(checked) => exemptMutation.mutate(checked)}
                        disabled={exemptMutation.isPending}
                        data-testid="toggle-dossier-attendance-exempt"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                    <ClipboardList className="h-4 w-4" /> Policy Documents
                  </h3>
                  {data.policyCompliance.tracks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No policy tracks assigned.</p>
                  ) : (
                    <div className="space-y-3">
                      {data.policyCompliance.tracks.map(track => {
                        const isSigned = track.status === "completed" && track.signedVersion === track.currentVersion;
                        const isOutdated = track.status === "completed" && track.signedVersion !== track.currentVersion;
                        return (
                          <div
                            key={track.assignmentId}
                            className="flex items-start justify-between gap-3 p-3 rounded-lg border"
                            data-testid={`dossier-policy-track-${track.trackId}`}
                          >
                            <div className="flex items-start gap-2 flex-1 min-w-0">
                              {isSigned
                                ? <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                                : isOutdated
                                ? <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                                : <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />}
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{track.trackTitle}</p>
                                {isSigned && track.completedAt && (
                                  <p className="text-xs text-muted-foreground">Signed {formatDate(track.completedAt)}</p>
                                )}
                                {isOutdated && (
                                  <p className="text-xs text-amber-600">Policy updated — re-signature required</p>
                                )}
                                {track.isOverdue && (
                                  <p className="text-xs text-red-600">Overdue since {formatDate(track.dueDate)}</p>
                                )}
                              </div>
                            </div>
                            <PolicyStatusBadge track={track} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {data.profile.gender === "Female" && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                      <Clock className="h-4 w-4" /> Night Shift Consent
                    </h3>
                    {data.policyCompliance.nightShiftConsent ? (
                      <div className="p-3 rounded-lg border">
                        {data.policyCompliance.nightShiftConsent.status === "valid" ? (
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <div>
                              <p className="text-sm font-medium text-green-700">Consent valid</p>
                              <p className="text-xs text-muted-foreground">
                                Signed {formatDate(data.policyCompliance.nightShiftConsent.signedAt)} ·
                                Expires {formatDate(data.policyCompliance.nightShiftConsent.expiresAt)}
                              </p>
                            </div>
                          </div>
                        ) : data.policyCompliance.nightShiftConsent.status === "expiring_soon" ? (
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                            <div>
                              <p className="text-sm font-medium text-amber-700">Expiring soon</p>
                              <p className="text-xs text-muted-foreground">
                                Expires {formatDate(data.policyCompliance.nightShiftConsent.expiresAt)}
                              </p>
                            </div>
                          </div>
                        ) : data.policyCompliance.nightShiftConsent.status === "expired" ? (
                          <div className="flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-red-500" />
                            <p className="text-sm font-medium text-red-700">Consent expired — renewal required</p>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-red-500" />
                            <p className="text-sm font-medium text-red-700">Consent not signed</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Not applicable.</p>
                    )}
                  </div>
                )}
              </TabsContent>

              {/* TRAINING TAB */}
              <TabsContent value="training" className="p-6 space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <BookOpen className="h-4 w-4" /> Assigned Learning Tracks
                </h3>
                {data.training.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No training tracks assigned.</p>
                ) : (
                  <div className="space-y-3">
                    {data.training.map(track => (
                      <div
                        key={track.assignmentId}
                        className="p-3 rounded-lg border space-y-2"
                        data-testid={`dossier-training-track-${track.trackId}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium">{track.trackTitle}</p>
                          <TrainingStatusBadge track={track} />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Completion</span>
                            <span>{track.completionPct}%</span>
                          </div>
                          <Progress value={track.completionPct} className="h-1.5" />
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                          {track.dueDate && (
                            <span className={track.isOverdue ? "text-red-600" : ""}>
                              Due: {formatDate(track.dueDate)}
                            </span>
                          )}
                          {track.completedAt && (
                            <span>Completed: {formatDate(track.completedAt)}</span>
                          )}
                          {track.lastActivityAt && !track.completedAt && (
                            <span>Last activity: {formatDate(track.lastActivityAt)}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* DOCUMENTS TAB */}
              <TabsContent value="documents" className="p-6 space-y-6">
                {/* Offer Letters */}
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4" /> Offer Letters
                  </h3>
                  {data.documents.offerLetters.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No offer letters found.</p>
                  ) : (
                    <div className="space-y-2">
                      {data.documents.offerLetters.map(ol => (
                        <div key={ol.id} className="p-3 rounded-lg border" data-testid={`dossier-offer-letter-${ol.id}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{ol.designation}</p>
                              <p className="text-xs text-muted-foreground">
                                Offered: {formatDate(ol.offerDate || ol.createdAt)}
                                {ol.acceptedAt && ` · Accepted: ${formatDate(ol.acceptedAt)}`}
                                {ol.counterSignedAt && ` · Countersigned: ${formatDate(ol.counterSignedAt)}`}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge variant="outline" className="capitalize">{ol.status}</Badge>
                              <a
                                href={`/offer/${ol.token}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-muted-foreground hover:text-foreground"
                                title="View offer letter"
                                data-testid={`dossier-offer-letter-view-${ol.id}`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* HR Letters */}
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4" /> HR Letters Issued
                  </h3>
                  {data.documents.hrLetters.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No HR letters issued.</p>
                  ) : (
                    <div className="space-y-2">
                      {data.documents.hrLetters.map(letter => (
                        <div key={letter.id} className="p-3 rounded-lg border" data-testid={`dossier-hr-letter-${letter.id}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium">
                                {templateTypeLabels[letter.templateType] || letter.templateType}
                              </p>
                              <div className="flex flex-wrap gap-2 mt-0.5">
                                {letter.referenceNumber && (
                                  <span className="text-xs text-muted-foreground font-mono">{letter.referenceNumber}</span>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  {formatDate(letter.issueDate || letter.issuedAt)}
                                </span>
                              </div>
                            </div>
                            <Badge variant="outline" className="shrink-0 capitalize">{letter.status}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Leave Balances */}
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                    <Calendar className="h-4 w-4" /> Leave Balances ({new Date().getFullYear()})
                  </h3>
                  {data.documents.leaveBalances.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No leave balances for the current year.</p>
                  ) : (
                    <div className="space-y-2">
                      {data.documents.leaveBalances.map(bal => {
                        const total = parseFloat(bal.totalDays);
                        const used = parseFloat(bal.usedDays);
                        const remaining = Math.max(total - used, 0);
                        const pct = total > 0 ? Math.round((used / total) * 100) : 0;
                        return (
                          <div key={bal.id} className="p-3 rounded-lg border space-y-2" data-testid={`dossier-leave-balance-${bal.leaveTypeId}`}>
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium">{bal.leaveTypeName}</p>
                              <span className="text-xs text-muted-foreground">
                                {remaining} / {total} days remaining
                              </span>
                            </div>
                            <Progress value={pct} className="h-1.5" />
                            <p className="text-xs text-muted-foreground">{used} used · {total} total</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
