import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Users, CheckCircle2, XCircle, AlertCircle, ExternalLink, Search, Shield, UserPlus, RefreshCw } from "lucide-react";
import { V2PageHeader } from "@/components/admin/V2PageHeader";
import { useNewLook } from "@/hooks/use-new-look";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { OfferLetterGenerator, OfferLettersDashboard } from "@/pages/admin/hr/HRTools";
import type { AdminUsersResponse } from "@shared/schema";
import { formatLocalDate } from "@/lib/dateUtils";

interface NewHire {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  employee_id: string | null;
  designation: string | null;
  joining_date: string | null;
  role: string;
  department_name: string | null;
  document_count: number;
  has_bank_details: boolean;
  has_ns_consent: boolean;
  training_pct: number;
  gender: string | null;
  employment_type: string | null;
  attendance_exempt: boolean;
  training_exempt: boolean;
  maternity_leave_eligible: boolean;
  is_reissue: boolean;
  offer_id: string | null;
}

const roleLabels: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  hr: "HR",
  operations: "Operations",
  manager: "Manager",
  executive: "Executive",
  employee: "Employee",
};

const roleColors: Record<string, string> = {
  super_admin: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  admin: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  hr: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  operations: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  manager: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
  executive: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  employee: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
};

function StatusChip({ ok, label, na }: { ok: boolean; label: string; na?: boolean }) {
  if (na) {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
        <AlertCircle className="h-3 w-3" />
        {label} N/A
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
      ok ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
         : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
    }`}>
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {label}
    </span>
  );
}

function TrainingBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? "bg-green-500" : pct >= 40 ? "bg-amber-500" : "bg-red-400";
  return (
    <div className="flex items-center gap-2 min-w-[90px]">
      <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">{pct}%</span>
    </div>
  );
}

function formatJoiningDate(date: string | null): string {
  if (!date) return "Not set";
  const formatted = formatLocalDate(date, "en-GB", { day: "2-digit", month: "short", year: "numeric" });
  return formatted === "—" ? "Not set" : formatted;
}

function OnboardingTab() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [applyTarget, setApplyTarget] = useState<{ hire: NewHire } | null>(null);

  const { data: hires, isLoading } = useQuery<NewHire[]>({
    queryKey: ["/api/hr/new-hire/onboarding-status"],
  });

  const applyMutation = useMutation({
    mutationFn: async (offerId: string) => {
      const res = await apiRequest("POST", `/api/hr/offer-letters/${offerId}/apply-to-profile`, {});
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to apply offer letter to profile");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Profile updated", description: "Designation, department, and salary have been applied from the offer letter." });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/new-hire/onboarding-status"] });
      setApplyTarget(null);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const canApplyToProfile = ["super_admin", "admin", "hr"].includes((user as any)?.role || "");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!hires || hires.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-3">
          <Users className="h-10 w-10 text-muted-foreground/40" />
          <p className="font-medium text-muted-foreground">No recent hires found</p>
          <p className="text-sm text-muted-foreground">Employees who joined within the last 90 days, those with no joining date set, and re-engagement offer letter recipients will appear here.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Showing <strong>{hires.length}</strong> employee{hires.length !== 1 ? "s" : ""}. Includes recent hires, employees with no joining date set, and existing employees with a linked re-engagement offer.
      </p>

      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Employee</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Joined</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Gender</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Training</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Docs</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Bank Details</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">NS Consent</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Flags</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Re-engagement</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {hires.map((h, i) => {
              return (
                <tr
                  key={h.id}
                  className={`border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer ${i % 2 === 0 ? "" : "bg-muted/10"}`}
                  onClick={() => setLocation(`/admin/hr/people?tab=users&userId=${h.id}`)}
                  data-testid={`row-new-hire-${h.id}`}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">{h.first_name} {h.last_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {h.employee_id ? `${h.employee_id} · ` : ""}{h.designation || h.role}
                      {h.department_name ? ` · ${h.department_name}` : ""}
                    </div>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">
                    {h.joining_date ? (
                      formatJoiningDate(h.joining_date)
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        <AlertCircle className="h-3 w-3" />
                        Not set
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {h.employment_type || <span className="text-muted-foreground/50">—</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {h.gender || <span className="text-muted-foreground/50">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {h.training_exempt ? (
                      <StatusChip ok na label="Exempt" />
                    ) : (
                      <TrainingBar pct={h.training_pct} />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusChip ok={h.document_count > 0} label={h.document_count > 0 ? `${h.document_count} uploaded` : "Missing"} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusChip ok={h.has_bank_details} label={h.has_bank_details ? "Added" : "Missing"} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusChip ok={h.has_ns_consent} label={h.has_ns_consent ? "Signed" : "Pending"} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {h.attendance_exempt && (
                        <span className="inline-flex items-center text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" title="Attendance Exempt">AEx</span>
                      )}
                      {h.training_exempt && (
                        <span className="inline-flex items-center text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" title="Training Exempt">TEx</span>
                      )}
                      {h.maternity_leave_eligible && (
                        <span className="inline-flex items-center text-xs px-1.5 py-0.5 rounded bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400" title="Maternity Leave Eligible">Mat</span>
                      )}
                      {!h.attendance_exempt && !h.training_exempt && !h.maternity_leave_eligible && (
                        <span className="text-muted-foreground/50 text-xs">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {h.is_reissue ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 text-[10px] font-medium" data-testid={`badge-reissue-${h.id}`}>
                        <RefreshCw className="h-3 w-3" /> Re-engagement
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {h.is_reissue && h.offer_id && canApplyToProfile && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1 text-xs border-[#1F3A6E] text-[#1F3A6E] hover:bg-[#1F3A6E]/5"
                          onClick={(e) => { e.stopPropagation(); setApplyTarget({ hire: h }); }}
                          data-testid={`button-apply-to-profile-${h.id}`}
                        >
                          Apply to Profile
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 text-xs"
                        onClick={(e) => { e.stopPropagation(); setLocation(`/admin/hr/people?tab=users&userId=${h.id}`); }}
                        data-testid={`button-view-hire-${h.id}`}
                      >
                        <ExternalLink className="h-3 w-3" />
                        View
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {applyTarget && (
        <Dialog open onOpenChange={() => setApplyTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Apply Offer Letter to Profile</DialogTitle>
              <DialogDescription>
                This will update <strong>{applyTarget.hire.first_name} {applyTarget.hire.last_name}</strong>'s designation, department, and salary based on the linked re-engagement offer letter. This action is logged in the audit trail.
              </DialogDescription>
            </DialogHeader>
            <div className="py-2 text-sm text-muted-foreground">
              The following will be overwritten on the employee's profile:
              <ul className="mt-2 ml-4 list-disc space-y-1">
                <li>Designation (if specified on the offer)</li>
                <li>Department (if specified on the offer)</li>
                <li>Salary — a salary change ledger entry will be created</li>
              </ul>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setApplyTarget(null)} data-testid="button-cancel-apply">Cancel</Button>
              <Button
                onClick={() => applyMutation.mutate(applyTarget.hire.offer_id!)}
                disabled={applyMutation.isPending}
                data-testid="button-confirm-apply"
                className="bg-[#1F3A6E] hover:bg-[#1F3A6E]/90"
              >
                {applyMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Applying…</> : "Apply to Profile"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

interface Department {
  id: string;
  name: string;
}

function UsersTab() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");

  const { data: usersResponse, isLoading } = useQuery<AdminUsersResponse>({
    queryKey: ["/api/admin/users", "active"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users?status=active", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
  });

  const { data: departments } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  const deptMap = new Map((departments ?? []).map((d) => [d.id, d.name]));

  const users = usersResponse?.users ?? [];

  const filtered = search.trim()
    ? users.filter((u) => {
        const q = search.toLowerCase();
        return (
          `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
          (u.email || "").toLowerCase().includes(q) ||
          (u.employeeId || "").toLowerCase().includes(q) ||
          (u.designation || "").toLowerCase().includes(q)
        );
      })
    : users;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, or ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
          data-testid="input-search-users-tab"
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-3">
            <Users className="h-10 w-10 text-muted-foreground/40" />
            <p className="font-medium text-muted-foreground">No users found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Employee</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Department</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Joining Date</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => (
                <tr
                  key={u.id}
                  className={`border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer ${i % 2 === 0 ? "" : "bg-muted/10"}`}
                  onClick={() => setLocation(`/admin/hr/people?tab=users&userId=${u.id}`)}
                  data-testid={`row-user-${u.id}`}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium flex items-center gap-1">
                      {u.firstName} {u.lastName}
                      {u.role === "super_admin" && <Shield className="h-3 w-3 text-purple-600" />}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {u.employeeId ? `${u.employeeId} · ` : ""}{u.email}
                      {u.designation ? ` · ${u.designation}` : ""}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${roleColors[u.role] || roleColors.employee}`}>
                      {roleLabels[u.role] || u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {u.departmentId ? (deptMap.get(u.departmentId) ?? "—") : "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">
                    {u.joiningDate ? (
                      formatLocalDate(u.joiningDate, "en-GB", { day: "2-digit", month: "short", year: "numeric" })
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        <AlertCircle className="h-3 w-3" />
                        Not set
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={u.isActive ? "default" : "secondary"} data-testid={`badge-status-${u.id}`}>
                      {u.isActive ? "Active" : "Disabled"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 text-xs"
                      onClick={(e) => { e.stopPropagation(); setLocation(`/admin/hr/people?tab=users&userId=${u.id}`); }}
                      data-testid={`button-view-user-${u.id}`}
                    >
                      <ExternalLink className="h-3 w-3" />
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function NewHire() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { enabled: newLook } = useNewLook();

  // Tab derives reactively from the URL (?tab=). The sidebar sub-nav owns navigation now.
  const params = new URLSearchParams(search);
  const rawTab = params.get("tab");
  const editId = params.get("editId") || undefined;
  // Back-compat: the old single "offer-letters" tab is now split; default to the list.
  const tab = !rawTab || rawTab === "offer-letters" ? "letters" : rawTab;

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/admin/login");
  }, [authLoading, isAuthenticated, setLocation]);

  useEffect(() => {
    if (!authLoading && user) {
      const allowed = ["super_admin", "admin", "hr", "operations", "manager"];
      if (!allowed.includes(user.role)) setLocation("/admin/hr");
    }
  }, [authLoading, user, setLocation]);

  if (authLoading || !isAuthenticated) return null;

  const headers: Record<string, { title: string; subtitle: string }> = {
    "new-offer-letter": { title: editId ? "Edit Offer Letter" : "New Offer Letter", subtitle: editId ? "Update the offer details and save your changes" : "Generate a new offer letter for a candidate" },
    letters: { title: "Letters", subtitle: "Track and manage offer letters" },
    onboarding: { title: "Onboarding", subtitle: "Track new employee setup and document status" },
    users: { title: "Users", subtitle: "Manage employee accounts" },
  };
  const header = headers[tab] ?? { title: "New Hire", subtitle: "Manage offer letters and track new employee setup" };

  return (
    <AdminLayout>
      <div className="space-y-6 v2-surface">
        {newLook ? (
          <V2PageHeader
            icon={UserPlus}
            eyebrow="New Hire"
            title={header.title}
            subtitle={header.subtitle}
            testId="text-new-hire-title"
          />
        ) : (
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-new-hire-title">{header.title}</h1>
            <p className="text-muted-foreground">{header.subtitle}</p>
          </div>
        )}

        {tab === "new-offer-letter" && <OfferLetterGenerator editId={editId} />}
        {tab === "letters" && <OfferLettersDashboard />}
        {tab === "onboarding" && <OnboardingTab />}
        {tab === "users" && <UsersTab />}
      </div>
    </AdminLayout>
  );
}
