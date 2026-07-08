import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { relocatedSettingsTabTarget } from "@/lib/settings-redirect";
import { Settings, Plus, Pencil, Trash2, CalendarDays, Building2, Upload, Download, Info, Users, CheckSquare, FileText, ChevronDown, ChevronUp, Shield, Lock, Clock, X, ShieldCheck } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { DEFAULT_COMPANY_PROFILE, type CompanyProfile } from "@shared/companyProfile";
import { SalaryStructuresSection, StateRegistrationsSection, CoverageSection } from "./settings/PayrollSettings";

interface LeaveType {
  id: string;
  name: string;
  defaultDays: number;
  monthlyAccrual: string;
  minHoursForAccrual: string;
  description: string | null;
  isActive: boolean;
  isConditional: boolean;
  carryForwardCap: number | null;
}

interface Holiday {
  id: string;
  name: string;
  date: string;
  type: string;
  isOptional: boolean;
}

interface Department {
  id: string;
  name: string;
  description: string | null;
  headId: string | null;
  isActive: boolean;
}

export function TrainingSettingsSection() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isHrOrAbove = ["super_admin", "admin", "hr", "executive"].includes(user?.role || "");

  const { data: flagData, isLoading } = useQuery<{ value: any }>({
    queryKey: ["/api/system-settings/onboarding_training_enabled"],
    queryFn: async () => {
      const res = await fetch("/api/system-settings/onboarding_training_enabled", { credentials: "include" });
      if (!res.ok) return { value: false };
      return res.json();
    },
    enabled: isHrOrAbove,
  });

  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await apiRequest("PUT", "/api/system-settings/onboarding_training_enabled", { value: enabled });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/system-settings/onboarding_training_enabled"] });
      toast({
        title: data.value ? "Training module enabled for all employees" : "Training module hidden from employees",
        description: data.value
          ? "Employees can now see and access My Training."
          : "Admins and managers can still access training.",
      });
    },
    onError: () => toast({ title: "Failed to update setting", variant: "destructive" }),
  });

  if (!isHrOrAbove) return null;

  const enabled = flagData?.value === true;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Settings className="h-4 w-4" />
          Training &amp; Onboarding
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-4 py-1">
          <div>
            <p className="font-medium text-sm">Enable Training Module for Employees</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              When enabled, employees see "My Training" in their sidebar and can access assigned tracks.
              Admins, HR, and managers always have access regardless of this setting.
            </p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={(v) => toggleMutation.mutate(v)}
            disabled={isLoading || toggleMutation.isPending}
            data-testid="switch-training-enabled"
          />
        </div>
        {enabled && (
          <div className="mt-3 px-3 py-2 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">
            Training module is currently <strong>visible to all employees</strong>. Toggle off to restrict access during review.
          </div>
        )}
        {!enabled && !isLoading && (
          <div className="mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-700">
            Training module is currently <strong>in review mode</strong> — only admins, HR, and managers can access it.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface SalaryAdvancePolicyShape {
  enabled: boolean;
  maxAdvancePctOfNet: number;
  exceptionCeilingPct: number;
  defaultMaxMonths: number;
  managerMaxMonths: number;
  ceoMaxMonths: number;
  requireProbationComplete: boolean;
  minTenureMonths: number;
  oneActiveAdvanceOnly: boolean;
}

function SalaryAdvancePolicySection() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isHrOrAbove = ["super_admin", "admin", "hr", "executive"].includes(user?.role || "");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<SalaryAdvancePolicyShape | null>(null);

  const { data: policy, isLoading } = useQuery<SalaryAdvancePolicyShape>({
    queryKey: ["/api/salary-advances/policy"],
    enabled: isHrOrAbove,
  });

  useEffect(() => {
    if (policy && !form) setForm(policy);
  }, [policy]);

  const saveMutation = useMutation({
    mutationFn: async (data: SalaryAdvancePolicyShape) => {
      const res = await apiRequest("PUT", "/api/salary-advances/policy", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/salary-advances/policy"] });
      toast({ title: "Salary advance policy saved" });
      setEditing(false);
    },
    onError: () => toast({ title: "Failed to save policy", variant: "destructive" }),
  });

  if (!isHrOrAbove) return null;

  const setField = <K extends keyof SalaryAdvancePolicyShape>(key: K, value: SalaryAdvancePolicyShape[K]) =>
    setForm(prev => (prev ? { ...prev, [key]: value } : prev));

  const numFields: Array<{ key: keyof SalaryAdvancePolicyShape; label: string; hint: string; min: number; max: number }> = [
    { key: "maxAdvancePctOfNet", label: "Standard Cap (% of net salary)", hint: "Above this, an exception is required", min: 0, max: 100 },
    { key: "exceptionCeilingPct", label: "Absolute Ceiling (% of net salary)", hint: "Hard upper limit even with exception", min: 0, max: 200 },
    { key: "defaultMaxMonths", label: "Default Max Repayment Months", hint: "Standard installment limit", min: 1, max: 36 },
    { key: "managerMaxMonths", label: "Manager Max Repayment Months", hint: "Cap a manager may approve", min: 1, max: 36 },
    { key: "ceoMaxMonths", label: "Super Admin Max Repayment Months", hint: "Cap on final approval", min: 1, max: 36 },
    { key: "minTenureMonths", label: "Minimum Tenure (months)", hint: "0 = no tenure requirement", min: 0, max: 120 },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckSquare className="h-4 w-4" />
            Salary Advance Policy
          </CardTitle>
          {!editing && (
            <Button size="sm" variant="outline" onClick={() => { setEditing(true); if (policy) setForm(policy); }} data-testid="button-edit-advance-policy">
              Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading || !form ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-8 rounded bg-muted animate-pulse" />)}</div>
        ) : editing ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>Feature Enabled</Label>
                <p className="text-xs text-muted-foreground">When off, employees cannot submit new advance requests</p>
              </div>
              <Switch checked={form.enabled} onCheckedChange={(v) => setField("enabled", v)} data-testid="switch-advance-enabled" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {numFields.map(f => (
                <div className="space-y-2" key={String(f.key)}>
                  <Label>{f.label}</Label>
                  <Input
                    type="number"
                    min={f.min}
                    max={f.max}
                    value={String(form[f.key] as number)}
                    onChange={(e) => setField(f.key, (parseInt(e.target.value, 10) || 0) as any)}
                    data-testid={`input-advance-${String(f.key)}`}
                  />
                  <p className="text-xs text-muted-foreground">{f.hint}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>Require Probation Complete</Label>
                <p className="text-xs text-muted-foreground">Warn when a probationary employee requests an advance</p>
              </div>
              <Switch checked={form.requireProbationComplete} onCheckedChange={(v) => setField("requireProbationComplete", v)} data-testid="switch-advance-probation" />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>One Active Advance Only</Label>
                <p className="text-xs text-muted-foreground">Warn when the employee already has an open advance</p>
              </div>
              <Switch checked={form.oneActiveAdvanceOnly} onCheckedChange={(v) => setField("oneActiveAdvanceOnly", v)} data-testid="switch-advance-one-active" />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => form && saveMutation.mutate(form)} disabled={saveMutation.isPending} data-testid="button-save-advance-policy">
                {saveMutation.isPending ? "Saving..." : "Save"}
              </Button>
              <Button variant="outline" onClick={() => { setEditing(false); if (policy) setForm(policy); }}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-muted/40 rounded-lg text-center">
              <p className="text-2xl font-bold font-mono" data-testid="text-advance-enabled">{form.enabled ? "On" : "Off"}</p>
              <p className="text-xs text-muted-foreground mt-1">Feature</p>
            </div>
            <div className="p-3 bg-muted/40 rounded-lg text-center">
              <p className="text-2xl font-bold font-mono">{form.maxAdvancePctOfNet}%</p>
              <p className="text-xs text-muted-foreground mt-1">Standard cap</p>
            </div>
            <div className="p-3 bg-muted/40 rounded-lg text-center">
              <p className="text-2xl font-bold font-mono">{form.exceptionCeilingPct}%</p>
              <p className="text-xs text-muted-foreground mt-1">Ceiling</p>
            </div>
            <div className="p-3 bg-muted/40 rounded-lg text-center">
              <p className="text-2xl font-bold font-mono">{form.defaultMaxMonths}/{form.managerMaxMonths}/{form.ceoMaxMonths}</p>
              <p className="text-xs text-muted-foreground mt-1">Months: default/mgr/admin</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RegularizationPolicySection() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isHrOrAbove = ["super_admin", "admin", "hr", "executive"].includes(user?.role || "");
  const [editing, setEditing] = useState(false);
  const [windowDays, setWindowDays] = useState("7");
  const [cutoffDay, setCutoffDay] = useState("20");
  const [policyVersion, setPolicyVersion] = useState("1");

  const { data: config, isLoading } = useQuery<{ employeeWindowDays: number; managerCutoffDay: number; policyVersion: string }>({
    queryKey: ["/api/hr/attendance/regularization/policy"],
    enabled: isHrOrAbove,
    onSuccess: (d: any) => {
      setWindowDays(String(d.employeeWindowDays));
      setCutoffDay(String(d.managerCutoffDay));
      setPolicyVersion(d.policyVersion);
    },
  } as any);

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Auto-bump policy version when window days or cutoff day changes
      let effectiveVersion = policyVersion;
      const origWindowDays = String(config?.employeeWindowDays ?? 7);
      const origCutoffDay = String(config?.managerCutoffDay ?? 20);
      const policyChanged = windowDays !== origWindowDays || cutoffDay !== origCutoffDay;
      if (policyChanged && effectiveVersion === String(config?.policyVersion ?? "1")) {
        const num = parseInt(effectiveVersion, 10);
        effectiveVersion = isNaN(num) ? `${effectiveVersion}.1` : String(num + 1);
      }
      await apiRequest("PUT", "/api/system-settings/regularization_employee_window_days", { value: windowDays });
      await apiRequest("PUT", "/api/system-settings/regularization_manager_cutoff_day", { value: cutoffDay });
      await apiRequest("PUT", "/api/system-settings/regularization_policy_version", { value: effectiveVersion });
      return { effectiveVersion, policyChanged };
    },
    onSuccess: ({ effectiveVersion, policyChanged }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/attendance/regularization/policy"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/attendance/regularization/window"] });
      toast({
        title: "Policy settings saved",
        description: policyChanged
          ? `Policy version updated to v${effectiveVersion}. All employees will be prompted to re-acknowledge.`
          : "Settings saved.",
      });
      setEditing(false);
    },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  if (!isHrOrAbove) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckSquare className="h-4 w-4" />
            Attendance Regularization Policy
          </CardTitle>
          {!editing && (
            <Button size="sm" variant="outline" onClick={() => { setEditing(true); if (config) { setWindowDays(String(config.employeeWindowDays)); setCutoffDay(String(config.managerCutoffDay)); setPolicyVersion(config.policyVersion); } }} data-testid="button-edit-reg-policy">
              Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-8 rounded bg-muted animate-pulse" />)}</div>
        ) : editing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Employee Window (working days)</Label>
                <Input type="number" min={1} max={30} value={windowDays} onChange={(e) => setWindowDays(e.target.value)} data-testid="input-reg-window-days" />
                <p className="text-xs text-muted-foreground">Days from incident to raise a request</p>
              </div>
              <div className="space-y-2">
                <Label>Manager Cutoff Day</Label>
                <Input type="number" min={1} max={28} value={cutoffDay} onChange={(e) => setCutoffDay(e.target.value)} data-testid="input-reg-cutoff-day" />
                <p className="text-xs text-muted-foreground">Day of month; after this HR handles it</p>
              </div>
              <div className="space-y-2">
                <Label>Policy Version</Label>
                <Input value={policyVersion} onChange={(e) => setPolicyVersion(e.target.value)} data-testid="input-reg-policy-version" />
                <p className="text-xs text-muted-foreground">Increment to re-prompt all employees</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="button-save-reg-policy">
                {saveMutation.isPending ? "Saving..." : "Save"}
              </Button>
              <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            <div className="p-3 bg-muted/40 rounded-lg text-center">
              <p className="text-2xl font-bold font-mono" data-testid="text-reg-window">{config?.employeeWindowDays ?? 7}</p>
              <p className="text-xs text-muted-foreground mt-1">Working days window</p>
            </div>
            <div className="p-3 bg-muted/40 rounded-lg text-center">
              <p className="text-2xl font-bold font-mono" data-testid="text-reg-cutoff">{config?.managerCutoffDay ?? 20}</p>
              <p className="text-xs text-muted-foreground mt-1">Manager cutoff day</p>
            </div>
            <div className="p-3 bg-muted/40 rounded-lg text-center">
              <p className="text-2xl font-bold font-mono" data-testid="text-reg-version">v{config?.policyVersion ?? "1"}</p>
              <p className="text-xs text-muted-foreground mt-1">Policy version</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function PerformanceSettingsSection() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isHrOrAbove = ["super_admin", "admin", "hr", "executive"].includes(user?.role || "");

  const { data: flagData, isLoading } = useQuery<{ value: boolean | null }>({
    queryKey: ["/api/system-settings/performance_management_enabled"],
    queryFn: async () => {
      const res = await fetch("/api/system-settings/performance_management_enabled", { credentials: "include" });
      if (!res.ok) return { value: false };
      return res.json();
    },
    enabled: isHrOrAbove,
  });

  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await apiRequest("PUT", "/api/system-settings/performance_management_enabled", { value: enabled });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/system-settings/performance_management_enabled"] });
      toast({
        title: data.value ? "Performance module enabled for all employees" : "Performance module hidden from employees",
        description: data.value
          ? "Employees can now see and access Performance features."
          : "Admins, HR, and managers can still access performance management.",
      });
    },
    onError: () => toast({ title: "Failed to update setting", variant: "destructive" }),
  });

  if (!isHrOrAbove) return null;

  const enabled = flagData?.value === true;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Settings className="h-4 w-4" />
          Performance Management
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-4 py-1">
          <div>
            <p className="font-medium text-sm" data-testid="text-perf-toggle-label">Enable Performance Module for Employees</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              When enabled, employees see "My Goals", "Check-Ins", "My Reviews", and "Feedback" in their sidebar.
              Admins, HR, and managers always have access regardless of this setting.
            </p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={(v) => toggleMutation.mutate(v)}
            disabled={isLoading || toggleMutation.isPending}
            data-testid="switch-performance-enabled"
          />
        </div>
        {enabled && (
          <div className="mt-3 px-3 py-2 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">
            Performance module is currently <strong>visible to all employees</strong>. Toggle off to restrict access.
          </div>
        )}
        {!enabled && !isLoading && (
          <div className="mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-700">
            Performance module is currently <strong>in review mode</strong> — only admins, HR, and managers can access it.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function RayoAcademySettingsSection() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isHrOrAbove = ["super_admin", "admin", "hr", "executive"].includes(user?.role || "");
  const [urlValue, setUrlValue] = useState("");
  const [editing, setEditing] = useState(false);

  const { data: urlData, isLoading } = useQuery<{ value: any }>({
    queryKey: ["/api/system-settings/rayo_academy_url"],
    queryFn: async () => {
      const res = await fetch("/api/system-settings/rayo_academy_url", { credentials: "include" });
      if (!res.ok) return { value: "" };
      return res.json();
    },
    enabled: isHrOrAbove,
  });

  const saveMutation = useMutation({
    mutationFn: async (url: string) => {
      const res = await apiRequest("PUT", "/api/system-settings/rayo_academy_url", { value: url });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/system-settings/rayo_academy_url"] });
      setEditing(false);
      toast({ title: "Rayo Academy URL saved" });
    },
    onError: () => toast({ title: "Failed to save URL", variant: "destructive" }),
  });

  if (!isHrOrAbove) return null;

  const currentUrl = urlData?.value || "";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Settings className="h-4 w-4" />
          Rayo Academy
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Configure the Rayo Academy URL. Employees can access it from the Performance section with their email pre-filled.
          </p>
          {editing ? (
            <div className="flex items-center gap-2">
              <Input
                value={urlValue}
                onChange={(e) => setUrlValue(e.target.value)}
                placeholder="https://academy.example.com"
                className="flex-1"
                data-testid="input-rayo-academy-url"
              />
              <Button
                size="sm"
                onClick={() => saveMutation.mutate(urlValue)}
                disabled={saveMutation.isPending}
                data-testid="button-save-rayo-url"
              >
                {saveMutation.isPending ? "Saving..." : "Save"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <div className="text-sm">
                {currentUrl ? (
                  <span className="text-blue-600 dark:text-blue-400 break-all">{currentUrl}</span>
                ) : (
                  <span className="text-muted-foreground">Not configured</span>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setUrlValue(currentUrl);
                  setEditing(true);
                }}
                data-testid="button-edit-rayo-url"
              >
                {currentUrl ? "Edit" : "Configure"}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function FeatureFlagsSection() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = ["super_admin", "admin"].includes(user?.role || "");

  const { data: flags, isLoading } = useQuery<Record<string, boolean>>({
    queryKey: ["/api/system/feature-flags"],
    enabled: isAdmin,
  });

  const toggleMutation = useMutation({
    mutationFn: async (update: Record<string, boolean>) => {
      const res = await apiRequest("PATCH", "/api/system/feature-flags", update);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/system/feature-flags"] });
      toast({ title: "Feature flag updated" });
    },
    onError: () => toast({ title: "Failed to update feature flag", variant: "destructive" }),
  });

  if (!isAdmin) return null;

  const flagDefs = [
    {
      key: "notifications_enabled",
      label: "In-App Notifications",
      description: "When enabled, employees see a notification bell in the header and receive in-app notifications for reminders and alerts.",
    },
    {
      key: "document_reminder_email_enabled",
      label: "Document Reminder Emails",
      description: "When enabled, the Remind button on Document Compliance sends an email to employees with pending documents.",
    },
    {
      key: "esign_docusign_flow",
      label: "DocuSign-Style E-Sign Flow",
      description: "When enabled, candidates and clients are shown a professional guided signing experience: e-sign consent gate, signature style setup, auto-advance initialing, and pre-filled final signature. When disabled, the original single-step signing form is used.",
    },
    {
      key: "new_look",
      label: "New Look Rollout (master switch)",
      description: "Rollout gate for the redesigned portal (v2 shell + Command Center cockpit). When ON, users see a \"Try the new look\" option in their profile and can opt in individually; opted-in users get the new shell and cockpit. When OFF, the option is hidden and everyone sees the classic portal — use this as an instant kill-switch.",
    },
    {
      key: "probation_framework_db",
      label: "Probation Framework from Database",
      description: "When ON (default), the probation pass rule and Day-90 final weights are read from dedicated database tables (alongside the scoring bands) for a single, scalable source of truth. Turn OFF to instantly revert to the legacy settings-based values if anything looks wrong — no data is lost either way.",
    },
    {
      key: "process_governance",
      label: "Process Governance Center (master switch)",
      description: "Master switch for the SOP / Process Governance Center (21-SOP library + version control). When ON, the SOP library becomes available to super admins/admins and to whoever is included in the rollout scope below. When OFF, the entire feature is hidden — use this as an instant kill-switch.",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Settings className="h-4 w-4" />
          Feature Flags
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {flagDefs.map((def) => {
          const enabled = flags?.[def.key] === true;
          return (
            <div key={def.key}>
              <div className="flex items-center justify-between gap-4 py-1">
                <div>
                  <p className="font-medium text-sm" data-testid={`text-flag-${def.key}`}>{def.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{def.description}</p>
                </div>
                <Switch
                  checked={enabled}
                  onCheckedChange={(v) => toggleMutation.mutate({ [def.key]: v })}
                  disabled={isLoading || toggleMutation.isPending}
                  data-testid={`switch-flag-${def.key}`}
                />
              </div>
              {def.key === "process_governance" && enabled && <ProcessGovernanceRolloutEditor />}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

interface SopRolloutScope {
  mode: "pilot" | "all";
  roles: string[];
  userIds: string[];
}

const SOP_ROLLOUT_ROLES = ["hr", "operations", "manager", "recruiter", "finance", "employee"];

function ProcessGovernanceRolloutEditor() {
  const { toast } = useToast();
  const { data: rollout, isLoading } = useQuery<SopRolloutScope>({
    queryKey: ["/api/sops/rollout"],
  });

  const [mode, setMode] = useState<"pilot" | "all">("pilot");
  const [roles, setRoles] = useState<string[]>([]);
  const [userIdsText, setUserIdsText] = useState("");

  useEffect(() => {
    if (rollout) {
      setMode(rollout.mode);
      setRoles(rollout.roles ?? []);
      setUserIdsText((rollout.userIds ?? []).join(", "));
    }
  }, [rollout]);

  const saveMutation = useMutation({
    mutationFn: async (next: SopRolloutScope) => {
      const res = await apiRequest("PATCH", "/api/sops/rollout", next);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sops/rollout"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sops/access"] });
      toast({ title: "Rollout scope updated" });
    },
    onError: () => toast({ title: "Failed to update rollout scope", variant: "destructive" }),
  });

  const toggleRole = (role: string) => {
    setRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  };

  const handleSave = () => {
    const userIds = userIdsText.split(",").map((s) => s.trim()).filter(Boolean);
    saveMutation.mutate({ mode, roles, userIds });
  };

  return (
    <div className="mt-3 ml-1 rounded-md border bg-muted/40 p-4 space-y-4" data-testid="section-sop-rollout">
      <div>
        <p className="text-sm font-medium">Rollout Scope</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Choose who can access the Process Governance Center while the master switch is ON. Super admins and admins always have access.
        </p>
      </div>

      <div className="space-y-1.5 max-w-xs">
        <Label className="text-xs">Mode</Label>
        <Select value={mode} onValueChange={(v) => setMode(v as "pilot" | "all")}>
          <SelectTrigger data-testid="select-sop-rollout-mode">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pilot">Pilot (selected roles / users only)</SelectItem>
            <SelectItem value="all">All eligible users</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {mode === "pilot" && (
        <>
          <div className="space-y-2">
            <Label className="text-xs">Pilot roles</Label>
            <div className="flex flex-wrap gap-3">
              {SOP_ROLLOUT_ROLES.map((role) => (
                <label key={role} className="flex items-center gap-2 text-sm capitalize cursor-pointer">
                  <Checkbox
                    checked={roles.includes(role)}
                    onCheckedChange={() => toggleRole(role)}
                    data-testid={`checkbox-sop-role-${role}`}
                  />
                  {role.replace("_", " ")}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Pilot user IDs (optional, comma-separated)</Label>
            <Textarea
              value={userIdsText}
              onChange={(e) => setUserIdsText(e.target.value)}
              placeholder="user-id-1, user-id-2"
              rows={2}
              data-testid="textarea-sop-user-ids"
            />
          </div>
        </>
      )}

      <Button
        size="sm"
        onClick={handleSave}
        disabled={isLoading || saveMutation.isPending}
        data-testid="button-save-sop-rollout"
      >
        {saveMutation.isPending ? "Saving..." : "Save rollout scope"}
      </Button>
    </div>
  );
}

function CompanyProfileSection() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = ["super_admin", "admin"].includes(user?.role || "");

  const { data, isLoading } = useQuery<CompanyProfile>({
    queryKey: ["/api/company-profile"],
    enabled: isAdmin,
  });

  const [form, setForm] = useState<CompanyProfile>(DEFAULT_COMPANY_PROFILE);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (payload: CompanyProfile) => {
      const res = await apiRequest("PATCH", "/api/company-profile", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company-profile"] });
      toast({ title: "Company profile updated" });
    },
    onError: () => toast({ title: "Failed to update company profile", variant: "destructive" }),
  });

  if (!isAdmin) return null;

  const set = <K extends keyof CompanyProfile>(key: K, value: CompanyProfile[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const setAddress = (which: "addressUS" | "addressIndia", field: keyof CompanyProfile["addressUS"], value: string) =>
    setForm((prev) => ({ ...prev, [which]: { ...prev[which], [field]: value } }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          Company Profile
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Government contracting credentials and company details shown across the public site and capability decks.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Identity */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="cp-name">Company Name</Label>
            <Input id="cp-name" value={form.name} onChange={(e) => set("name", e.target.value)} data-testid="input-cp-name" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cp-legalName">Legal Name</Label>
            <Input id="cp-legalName" value={form.legalName} onChange={(e) => set("legalName", e.target.value)} data-testid="input-cp-legalname" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cp-established">Established</Label>
            <Input id="cp-established" value={form.established} onChange={(e) => set("established", e.target.value)} data-testid="input-cp-established" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cp-brandLine">Brand Line</Label>
            <Input id="cp-brandLine" value={form.brandLine} onChange={(e) => set("brandLine", e.target.value)} data-testid="input-cp-brandline" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cp-uei">UEI</Label>
            <Input id="cp-uei" value={form.uei} onChange={(e) => set("uei", e.target.value)} data-testid="input-cp-uei" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cp-cage">CAGE / NCAGE Code</Label>
            <Input id="cp-cage" value={form.cage} onChange={(e) => set("cage", e.target.value)} data-testid="input-cp-cage" />
          </div>
        </div>

        {/* NAICS Codes */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>NAICS Codes</Label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => set("naicsCodes", [...form.naicsCodes, { code: "", label: "" }])}
              data-testid="button-cp-add-naics"
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Code
            </Button>
          </div>
          {form.naicsCodes.map((naics, i) => (
            <div key={i} className="flex items-center gap-2" data-testid={`row-cp-naics-${i}`}>
              <Input
                className="w-32"
                placeholder="Code"
                value={naics.code}
                onChange={(e) => {
                  const next = [...form.naicsCodes];
                  next[i] = { ...next[i], code: e.target.value };
                  set("naicsCodes", next);
                }}
                data-testid={`input-cp-naics-code-${i}`}
              />
              <Input
                placeholder="Label"
                value={naics.label}
                onChange={(e) => {
                  const next = [...form.naicsCodes];
                  next[i] = { ...next[i], label: e.target.value };
                  set("naicsCodes", next);
                }}
                data-testid={`input-cp-naics-label-${i}`}
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => set("naicsCodes", form.naicsCodes.filter((_, idx) => idx !== i))}
                data-testid={`button-cp-remove-naics-${i}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        {/* SAM.gov status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
          <div className="flex items-center justify-between gap-4 py-1">
            <div>
              <p className="font-medium text-sm">SAM.gov Active</p>
              <p className="text-xs text-muted-foreground mt-0.5">Mark whether the SAM.gov registration is active.</p>
            </div>
            <Switch
              checked={form.samStatus.active}
              onCheckedChange={(v) => set("samStatus", { ...form.samStatus, active: v })}
              data-testid="switch-cp-sam-active"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cp-sam-exp">SAM.gov Expiration Date</Label>
            <Input
              id="cp-sam-exp"
              type="date"
              value={form.samStatus.expirationDate}
              onChange={(e) => set("samStatus", { ...form.samStatus, expirationDate: e.target.value })}
              data-testid="input-cp-sam-expiration"
            />
          </div>
        </div>

        {/* Certifications */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Certifications</Label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => set("certifications", [...form.certifications, { name: "", issuingBody: "" }])}
              data-testid="button-cp-add-cert"
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Certification
            </Button>
          </div>
          {form.certifications.map((cert, i) => (
            <div key={i} className="flex items-center gap-2" data-testid={`row-cp-cert-${i}`}>
              <Input
                placeholder="Name"
                value={cert.name}
                onChange={(e) => {
                  const next = [...form.certifications];
                  next[i] = { ...next[i], name: e.target.value };
                  set("certifications", next);
                }}
                data-testid={`input-cp-cert-name-${i}`}
              />
              <Input
                placeholder="Issuing body (optional)"
                value={cert.issuingBody}
                onChange={(e) => {
                  const next = [...form.certifications];
                  next[i] = { ...next[i], issuingBody: e.target.value };
                  set("certifications", next);
                }}
                data-testid={`input-cp-cert-body-${i}`}
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => set("certifications", form.certifications.filter((_, idx) => idx !== i))}
                data-testid={`button-cp-remove-cert-${i}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        {/* Addresses */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {(["addressUS", "addressIndia"] as const).map((which) => (
            <div key={which} className="space-y-2">
              <Label>{which === "addressUS" ? "US Address" : "India Address"}</Label>
              <Input placeholder="Street" value={form[which].street} onChange={(e) => setAddress(which, "street", e.target.value)} data-testid={`input-cp-${which}-street`} />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="City" value={form[which].city} onChange={(e) => setAddress(which, "city", e.target.value)} data-testid={`input-cp-${which}-city`} />
                <Input placeholder="State" value={form[which].state} onChange={(e) => setAddress(which, "state", e.target.value)} data-testid={`input-cp-${which}-state`} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="ZIP" value={form[which].zip} onChange={(e) => setAddress(which, "zip", e.target.value)} data-testid={`input-cp-${which}-zip`} />
                <Input placeholder="Country" value={form[which].country} onChange={(e) => setAddress(which, "country", e.target.value)} data-testid={`input-cp-${which}-country`} />
              </div>
            </div>
          ))}
        </div>

        {/* Phones & Emails */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="cp-phone-main">Main Phone</Label>
            <Input id="cp-phone-main" value={form.phones.main} onChange={(e) => set("phones", { ...form.phones, main: e.target.value })} data-testid="input-cp-phone-main" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cp-phone-healthcare">Healthcare Phone</Label>
            <Input id="cp-phone-healthcare" value={form.phones.healthcare} onChange={(e) => set("phones", { ...form.phones, healthcare: e.target.value })} data-testid="input-cp-phone-healthcare" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cp-phone-it">IT Phone</Label>
            <Input id="cp-phone-it" value={form.phones.it} onChange={(e) => set("phones", { ...form.phones, it: e.target.value })} data-testid="input-cp-phone-it" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cp-email-general">General Email</Label>
            <Input id="cp-email-general" value={form.emails.general} onChange={(e) => set("emails", { ...form.emails, general: e.target.value })} data-testid="input-cp-email-general" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cp-email-careers">Careers Email</Label>
            <Input id="cp-email-careers" value={form.emails.careers} onChange={(e) => set("emails", { ...form.emails, careers: e.target.value })} data-testid="input-cp-email-careers" />
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={() => saveMutation.mutate(form)}
            disabled={isLoading || saveMutation.isPending}
            data-testid="button-cp-save"
          >
            {saveMutation.isPending ? "Saving..." : "Save Company Profile"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface ShiftInfo {
  id: string;
  name: string;
  displayLabel: string;
  scheduledHours: number;
  gracePeriodMinutes: number;
  istStart: string;
  istEnd: string;
}

interface BackfillOverride {
  elOverride?: number;
  slOverride?: number;
}

interface CorrectionCandidate {
  attendanceId: string | null;
  userId: string;
  employeeName: string;
  date: string;
  shiftId: string | null;
  shiftName: string;
  punchFound: boolean;
  punchTime: string | null;
  suggestedStatus: string;
  isPayrollLocked: boolean;
  isPendingProposal: boolean;
  pendingChangeId: string | null;
}

function candidateKey(c: CorrectionCandidate): string {
  return c.attendanceId
    ? c.attendanceId
    : `${c.userId}-${c.date}${c.pendingChangeId ? `-pc-${c.pendingChangeId}` : ""}`;
}

function AbsentCorrectionSection() {
  const { user } = useAuth();
  const { toast } = useToast();

  const todayStr = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [fromDate, setFromDate] = useState(thirtyDaysAgo);
  const [toDate, setToDate] = useState(todayStr);
  const [candidates, setCandidates] = useState<CorrectionCandidate[] | null>(null);
  const [rowStates, setRowStates] = useState<Record<string, { included: boolean; status: string }>>({});
  const [auditNote, setAuditNote] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  const dryRunMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/hr/absent-correction/dry-run", { fromDate, toDate });
      return res.json();
    },
    onSuccess: (data: { candidates: CorrectionCandidate[] }) => {
      setCandidates(data.candidates);
      const states: Record<string, { included: boolean; status: string }> = {};
      for (const c of data.candidates) {
        if (!c.isPayrollLocked) {
          states[candidateKey(c)] = { included: c.punchFound, status: c.suggestedStatus };
        }
      }
      setRowStates(states);
      toast({ title: "Scan complete", description: `${data.candidates.length} absent record${data.candidates.length !== 1 ? "s" : ""} found in range.` });
    },
    onError: (err: any) => toast({ title: "Scan failed", description: err.message, variant: "destructive" }),
  });

  const applyMutation = useMutation({
    mutationFn: async () => {
      const corrections = (candidates ?? [])
        .filter(c => !c.isPayrollLocked && rowStates[candidateKey(c)]?.included)
        .map(c => ({
          attendanceId: c.attendanceId,
          userId: c.userId,
          attendanceDate: c.date,
          newStatus: rowStates[candidateKey(c)]?.status ?? c.suggestedStatus,
          isPendingProposal: c.isPendingProposal,
          pendingChangeId: c.pendingChangeId,
        }));
      const res = await apiRequest("POST", "/api/admin/hr/absent-correction/apply", { corrections, auditNote });
      return res.json();
    },
    onSuccess: (data: { correctedCount: number; message: string }) => {
      setShowConfirm(false);
      toast({ title: "Corrections applied", description: data.message });
      setCandidates(null);
      setRowStates({});
      setAuditNote("");
    },
    onError: (err: any) => {
      setShowConfirm(false);
      toast({ title: "Failed to apply corrections", description: err.message, variant: "destructive" });
    },
  });

  if (!["super_admin", "hr"].includes(user?.role || "")) return null;

  const unlocked = (candidates ?? []).filter(c => !c.isPayrollLocked);
  const selectedCount = Object.values(rowStates).filter(s => s.included).length;
  const lockedCount = (candidates ?? []).filter(c => c.isPayrollLocked).length;
  const allUnlockedSelected = unlocked.length > 0 && selectedCount === unlocked.length;
  const canApply = selectedCount > 0 && auditNote.trim().length >= 20;
  const manualOverrides = (candidates ?? []).filter(
    c => rowStates[candidateKey(c)]?.included && rowStates[candidateKey(c)]?.status !== c.suggestedStatus
  );

  return (
    <>
    <div className="pt-4 mt-4 border-t space-y-4">
      <div>
        <p className="font-medium text-sm mb-1">Absent Record Correction</p>
        <p className="text-xs text-muted-foreground">
          Bulk-correct attendance records that were incorrectly marked absent — e.g. overnight-shift employees missed by the absence sweep.
          Months with an approved or sent payroll report are read-only.
        </p>
      </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Label className="text-xs whitespace-nowrap">From</Label>
            <Input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="w-36 text-xs"
              data-testid="input-absent-from-date"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs whitespace-nowrap">To</Label>
            <Input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="w-36 text-xs"
              data-testid="input-absent-to-date"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => dryRunMutation.mutate()}
            disabled={dryRunMutation.isPending}
            data-testid="button-absent-dry-run"
          >
            {dryRunMutation.isPending ? "Scanning…" : "Dry Run (Preview)"}
          </Button>
        </div>

        {candidates !== null && (
          <div className="space-y-3">
            {candidates.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center border rounded-md">
                No absent records found in the selected date range.
              </div>
            ) : (
              <>
                <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
                  <span><strong className="text-foreground">{candidates.length}</strong> absent records found</span>
                  <span className="text-green-700 dark:text-green-400"><strong>{selectedCount}</strong> selected to correct</span>
                  {lockedCount > 0 && (
                    <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <Lock className="h-3 w-3" /><strong>{lockedCount}</strong> payroll-locked (read-only)
                    </span>
                  )}
                </div>

                <div className="max-h-96 overflow-y-auto border rounded-md">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted z-10">
                      <tr className="border-b">
                        <th className="py-2 px-2 text-center w-8">
                          <Checkbox
                            checked={allUnlockedSelected}
                            onCheckedChange={(v) => {
                              const next = { ...rowStates };
                              for (const c of unlocked) {
                                if (next[candidateKey(c)]) {
                                  next[candidateKey(c)] = { ...next[candidateKey(c)], included: !!v };
                                }
                              }
                              setRowStates(next);
                            }}
                            data-testid="checkbox-select-all-absent"
                          />
                        </th>
                        <th className="text-left py-2 px-2 font-medium">Employee</th>
                        <th className="text-left py-2 px-2 font-medium">Date</th>
                        <th className="text-left py-2 px-2 font-medium">Shift</th>
                        <th className="text-left py-2 px-2 font-medium">Punch Found</th>
                        <th className="text-left py-2 px-2 font-medium">New Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {candidates.map((c, i) => {
                        const key = candidateKey(c);
                        const rs = rowStates[key];
                        const isEdited = rs && rs.status !== c.suggestedStatus;
                        return (
                          <tr
                            key={key}
                            className={`border-b last:border-0 ${
                              c.isPayrollLocked
                                ? "opacity-50 bg-muted/30"
                                : isEdited
                                  ? "bg-amber-50 dark:bg-amber-950/30 border-l-2 border-l-amber-400"
                                  : rs?.included
                                    ? "hover:bg-muted/40"
                                    : "opacity-60 hover:bg-muted/40"
                            }`}
                            data-testid={`absent-row-${i}`}
                          >
                            <td className="py-1.5 px-2 text-center">
                              {c.isPayrollLocked ? (
                                <Lock className="h-3 w-3 text-muted-foreground mx-auto" />
                              ) : (
                                <Checkbox
                                  checked={rs?.included ?? false}
                                  onCheckedChange={(v) =>
                                    setRowStates(prev => ({
                                      ...prev,
                                      [key]: { ...prev[key], included: !!v },
                                    }))
                                  }
                                  data-testid={`checkbox-absent-include-${i}`}
                                />
                              )}
                            </td>
                            <td className="py-1.5 px-2 font-medium">
                              {c.employeeName}
                              {c.isPendingProposal && (
                                <span className="ml-1.5 px-1 py-0.5 rounded text-[10px] bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700" title="Pending absent sweep proposal — not yet applied">
                                  Pending
                                </span>
                              )}
                              {isEdited && <span className="ml-1 text-amber-600 dark:text-amber-400" title="Status overridden">✎</span>}
                            </td>
                            <td className="py-1.5 px-2 text-muted-foreground font-mono">{c.date}</td>
                            <td className="py-1.5 px-2 text-muted-foreground">{c.shiftName}</td>
                            <td className="py-1.5 px-2">
                              {c.punchFound ? (
                                <span className="text-green-700 dark:text-green-400 font-medium">
                                  {c.punchTime} IST
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="py-1.5 px-2">
                              {c.isPayrollLocked ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-muted border text-muted-foreground">
                                  <Lock className="h-2.5 w-2.5" /> Locked
                                </span>
                              ) : (
                                <select
                                  value={rs?.status ?? c.suggestedStatus}
                                  onChange={e =>
                                    setRowStates(prev => ({
                                      ...prev,
                                      [key]: { ...prev[key], status: e.target.value },
                                    }))
                                  }
                                  disabled={!rs?.included}
                                  className="border rounded px-1 py-0.5 text-xs bg-background disabled:opacity-50"
                                  data-testid={`select-absent-status-${i}`}
                                >
                                  <option value="present">Present</option>
                                  <option value="late">Late</option>
                                  <option value="short_day">Short Day</option>
                                  <option value="half_day">Half Day</option>
                                </select>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="text-xs text-muted-foreground">
                  <strong className="text-foreground">{selectedCount}</strong> record{selectedCount !== 1 ? "s" : ""} to correct
                  {lockedCount > 0 && <>, <strong className="text-amber-600 dark:text-amber-400">{lockedCount}</strong> locked (read-only)</>}
                </div>

                {selectedCount > 0 && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium" htmlFor="absent-audit-note">
                      Audit note <span className="text-destructive">*</span> <span className="text-muted-foreground font-normal">(minimum 20 characters)</span>
                    </Label>
                    <Textarea
                      id="absent-audit-note"
                      value={auditNote}
                      onChange={e => setAuditNote(e.target.value)}
                      placeholder="Explain why these records are being corrected (e.g. 'Overnight shift employees incorrectly marked absent by sweep on 2026-06-18 — punches confirmed')…"
                      className="text-xs min-h-[72px]"
                      data-testid="textarea-absent-audit-note"
                    />
                    {auditNote.trim().length > 0 && auditNote.trim().length < 20 && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        {20 - auditNote.trim().length} more character{20 - auditNote.trim().length !== 1 ? "s" : ""} required
                      </p>
                    )}
                    <Button
                      size="sm"
                      onClick={() => setShowConfirm(true)}
                      disabled={!canApply}
                      data-testid="button-absent-open-confirm"
                    >
                      Confirm &amp; Apply Corrections ({selectedCount})
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Bulk Absent Correction</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              You are about to correct <strong>{selectedCount}</strong> attendance record{selectedCount !== 1 ? "s" : ""}.
              Each selected absent record will be updated to the chosen status and marked with your audit note.
            </p>
            {manualOverrides.length > 0 && (
              <div className="border rounded-md p-2 bg-amber-50 dark:bg-amber-950/30 space-y-1">
                <p className="text-xs font-medium text-amber-800 dark:text-amber-300">Manually overridden statuses:</p>
                {manualOverrides.map(c => (
                  <div key={candidateKey(c)} className="text-xs text-amber-700 dark:text-amber-400">
                    <strong>{c.employeeName}</strong> {c.date}: {c.suggestedStatus} → {rowStates[candidateKey(c)]?.status}
                  </div>
                ))}
              </div>
            )}
            <div className="border rounded-md p-2 bg-muted/50 text-xs">
              <span className="font-medium">Audit note: </span>{auditNote}
            </div>
            <p className="text-xs text-muted-foreground">
              This operation is idempotent — running it again on already-corrected records with the same status has no effect.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>Cancel</Button>
            <Button
              onClick={() => applyMutation.mutate()}
              disabled={applyMutation.isPending}
              data-testid="button-absent-apply-confirm"
            >
              {applyMutation.isPending ? "Applying…" : "Confirm & Apply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function DataMaintenanceSection() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingDryRun, setPendingDryRun] = useState(false);
  const [backfillResult, setBackfillResult] = useState<any>(null);
  // Map of userId -> override values (only set when user edits a cell)
  const [overrides, setOverrides] = useState<Record<string, BackfillOverride>>({});
  const [overrideNote, setOverrideNote] = useState("");

  const hasOverrides = Object.keys(overrides).length > 0;
  const overrideCount = Object.keys(overrides).length;

  // Total rows that would be created (from last dry run result)
  const totalRows = backfillResult
    ? (backfillResult.accrualRowsCreated ?? 0) + (backfillResult.correctionRowsApplied ?? 0)
    : 0;

  const backfillMutation = useMutation({
    mutationFn: async (dryRun: boolean) => {
      const body: any = { dryRun };
      if (!dryRun && hasOverrides) {
        body.overrideNote = overrideNote;
        body.overrides = Object.entries(overrides).map(([userId, ov]) => ({
          userId,
          ...ov,
          note: overrideNote,
        }));
      }
      const res = await apiRequest("POST", "/api/admin/hr/backfill-leave-accruals", body);
      return res.json();
    },
    onSuccess: (data) => {
      setBackfillResult(data);
      if (!pendingDryRun) {
        // After a real run, clear overrides
        setOverrides({});
        setOverrideNote("");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/hr/leave-balances"] });
      toast({
        title: pendingDryRun ? "Dry Run Complete" : "Backfill Complete",
        description: data.message,
      });
      setShowConfirm(false);
    },
    onError: (err: any) => {
      toast({ title: "Backfill Failed", description: err.message || "An error occurred", variant: "destructive" });
      setShowConfirm(false);
    },
  });

  if (!["super_admin", "hr"].includes(user?.role || "")) return null;

  function setElOverride(userId: string, computedEl: number, value: string) {
    const num = parseFloat(value);
    if (isNaN(num)) return;
    if (Math.abs(num - computedEl) < 0.001) {
      // Reverted to computed — remove override for this field if no sl override either
      setOverrides(prev => {
        const existing = prev[userId];
        if (!existing) return prev;
        const next = { ...existing };
        delete next.elOverride;
        if (Object.keys(next).length === 0) {
          const { [userId]: _, ...rest } = prev;
          return rest;
        }
        return { ...prev, [userId]: next };
      });
    } else {
      setOverrides(prev => ({ ...prev, [userId]: { ...prev[userId], elOverride: num } }));
    }
  }

  function setSlOverride(userId: string, computedSl: number, value: string) {
    const num = parseFloat(value);
    if (isNaN(num)) return;
    if (Math.abs(num - computedSl) < 0.001) {
      setOverrides(prev => {
        const existing = prev[userId];
        if (!existing) return prev;
        const next = { ...existing };
        delete next.slOverride;
        if (Object.keys(next).length === 0) {
          const { [userId]: _, ...rest } = prev;
          return rest;
        }
        return { ...prev, [userId]: next };
      });
    } else {
      setOverrides(prev => ({ ...prev, [userId]: { ...prev[userId], slOverride: num } }));
    }
  }

  const runBackfillLabel = backfillResult
    ? `Run Backfill (${totalRows} rows${overrideCount > 0 ? `, ${overrideCount} override${overrideCount > 1 ? "s" : ""}` : ""})`
    : "Run Backfill";

  const canRunBackfill = !backfillMutation.isPending && (!hasOverrides || overrideNote.trim().length > 0);

  // Collect override details for confirmation dialog
  const overrideDetails = backfillResult?.details
    ? Object.entries(overrides).map(([userId, ov]) => {
        const detail = backfillResult.details.find((d: any) => d.userId === userId);
        if (!detail) return null;
        return { name: detail.name, computedEl: detail.elAdded, computedSl: detail.slAdded, ...ov };
      }).filter(Boolean)
    : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Settings className="h-4 w-4" />
          Data Maintenance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {user?.role === "super_admin" && (<>
        <div>
          <p className="font-medium text-sm mb-1">Backfill Historical Leave Accruals</p>
          <p className="text-xs text-muted-foreground mb-3">
            Credits leave from each employee's joining date through May 2026 at the correct rate (1.5 EL/month, 0.67 SL/month).
            Applies ±corrections to Jan–May 2026 cron months with wrong rates. Inserts missing leave requests and HR-directed
            balance adjustments for specific employees. Fully idempotent — safe to run multiple times.
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setPendingDryRun(true); setShowConfirm(true); }}
              disabled={backfillMutation.isPending}
              data-testid="button-backfill-dry-run"
            >
              {backfillMutation.isPending && pendingDryRun ? "Running..." : "Dry Run (Preview)"}
            </Button>
            <Button
              size="sm"
              onClick={() => { setPendingDryRun(false); setShowConfirm(true); }}
              disabled={!canRunBackfill}
              data-testid="button-backfill-run"
            >
              {backfillMutation.isPending && !pendingDryRun ? "Running..." : runBackfillLabel}
            </Button>
          </div>
          {hasOverrides && overrideNote.trim().length === 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              A reason is required before running the backfill when overrides are present.
            </p>
          )}
        </div>

        {backfillResult && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-4 flex-wrap text-sm">
              <span className="font-medium">{backfillResult.message}</span>
            </div>
            <div className="flex gap-4 flex-wrap text-xs text-muted-foreground">
              <span>Employees processed: <strong className="text-foreground">{backfillResult.employeesProcessed}</strong></span>
              <span>Skipped (inactive): <strong className="text-foreground">{backfillResult.skippedInactive}</strong></span>
              <span>Accrual rows created: <strong className="text-green-700 dark:text-green-400">{backfillResult.accrualRowsCreated}</strong></span>
              <span>Corrections applied: <strong className="text-amber-600 dark:text-amber-400">{backfillResult.correctionRowsApplied}</strong></span>
            </div>
            {backfillResult.resolvedLeaveTypes && (
              <div className="text-xs text-muted-foreground bg-muted/50 rounded px-3 py-1.5 border" data-testid="backfill-resolved-leave-types">
                Resolved leave types — EL: <strong className="text-foreground">{backfillResult.resolvedLeaveTypes.el.name}</strong> (id: {backfillResult.resolvedLeaveTypes.el.id}) · SL: <strong className="text-foreground">{backfillResult.resolvedLeaveTypes.sl.name}</strong> (id: {backfillResult.resolvedLeaveTypes.sl.id})
              </div>
            )}
            {backfillResult.details && backfillResult.details.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Edit <strong className="text-foreground">EL Added</strong> or <strong className="text-foreground">SL Added</strong> values to override individual employees. Edited rows are highlighted.
                </p>
                <div className="max-h-96 overflow-y-auto border rounded-md">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted">
                      <tr className="border-b">
                        <th className="text-left py-2 px-2 font-medium">Employee</th>
                        <th className="text-left py-2 px-2 font-medium">Joined</th>
                        <th className="text-left py-2 px-2 font-medium">First Acc</th>
                        <th className="text-right py-2 px-2 font-medium">EL Added</th>
                        <th className="text-right py-2 px-2 font-medium">SL Added</th>
                        <th className="text-right py-2 px-2 font-medium">EL Bal</th>
                        <th className="text-right py-2 px-2 font-medium">SL Bal</th>
                        <th className="text-left py-2 px-2 font-medium">Flags</th>
                      </tr>
                    </thead>
                    <tbody>
                      {backfillResult.details.map((d: any, i: number) => {
                        const ov = overrides[d.userId];
                        const isEdited = !!ov;
                        return (
                          <tr
                            key={i}
                            className={`border-b last:border-0 ${isEdited ? "bg-amber-50 dark:bg-amber-950/30 border-l-2 border-l-amber-400" : "hover:bg-muted/40"}`}
                            data-testid={`backfill-row-${i}`}
                          >
                            <td className="py-1.5 px-2 font-medium">
                              {d.name}
                              {d.isPartTime && <span className="ml-1 text-xs text-purple-600 dark:text-purple-400">(PT)</span>}
                              {isEdited && <span className="ml-1 text-amber-600 dark:text-amber-400" title="Overridden">✎</span>}
                            </td>
                            <td className="py-1.5 px-2 text-muted-foreground">{d.joiningDate || "—"}</td>
                            <td className="py-1.5 px-2 text-muted-foreground">{d.firstAccrualMonth || "—"}</td>
                            <td className="py-1.5 px-2 text-right">
                              <input
                                type="number"
                                step="0.01"
                                defaultValue={d.elAdded}
                                className={`w-16 text-right border rounded px-1 py-0.5 text-xs bg-background ${ov?.elOverride !== undefined ? "border-amber-400 dark:border-amber-500" : "border-border"}`}
                                onChange={e => setElOverride(d.userId, d.elAdded, e.target.value)}
                                data-testid={`input-el-override-${i}`}
                              />
                            </td>
                            <td className="py-1.5 px-2 text-right">
                              <input
                                type="number"
                                step="0.01"
                                defaultValue={d.slAdded}
                                className={`w-16 text-right border rounded px-1 py-0.5 text-xs bg-background ${ov?.slOverride !== undefined ? "border-amber-400 dark:border-amber-500" : "border-border"}`}
                                onChange={e => setSlOverride(d.userId, d.slAdded, e.target.value)}
                                data-testid={`input-sl-override-${i}`}
                              />
                            </td>
                            <td className="py-1.5 px-2 text-right font-medium">{d.newELBalance}</td>
                            <td className="py-1.5 px-2 text-right font-medium">{d.newSLBalance}</td>
                            <td className="py-1.5 px-2">
                              <div className="flex flex-wrap gap-1">
                                {d.monthsELSkipped.length > 0 && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" title={`EL skipped: ${d.monthsELSkipped.join(", ")}`}>
                                    {d.monthsELSkipped.length} EL skipped
                                  </span>
                                )}
                                {d.monthsELMissingData.length > 0 && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" title={`Missing attendance: ${d.monthsELMissingData.join(", ")}`}>
                                    {d.monthsELMissingData.length} no data
                                  </span>
                                )}
                                {d.correctionsApplied > 0 && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
                                    {d.correctionsApplied} corrected
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {hasOverrides && (
                  <div className="space-y-1.5 pt-1">
                    <label className="text-xs font-medium text-amber-700 dark:text-amber-400" htmlFor="override-note">
                      Reason for override (required for audit) *
                    </label>
                    <Textarea
                      id="override-note"
                      value={overrideNote}
                      onChange={e => setOverrideNote(e.target.value)}
                      placeholder="Explain why these values are being overridden…"
                      className="text-xs min-h-[64px]"
                      data-testid="textarea-override-note"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        </>)}
        <AbsentCorrectionSection />
      </CardContent>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{pendingDryRun ? "Dry Run — Preview Only" : "Run Backfill — This Writes to DB"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            {pendingDryRun ? (
              <p>
                A dry run will compute what would be backfilled for each employee and return a detailed preview
                — without writing anything to the database. Use this to verify the numbers before committing.
              </p>
            ) : (
              <div className="space-y-2">
                <p>
                  This will insert historical leave accrual rows, apply 2026 cron corrections, run the 2025 year-end
                  carry-forward/lapse, insert confirmed leave requests, and apply HR-directed balance adjustments.
                </p>
                {backfillResult && (
                  <p className="text-muted-foreground text-xs">
                    <strong className="text-foreground">{totalRows}</strong> rows will be created
                    {overrideCount > 0 && <>, <strong className="text-amber-700 dark:text-amber-400">{overrideCount}</strong> employee override{overrideCount > 1 ? "s" : ""} applied</>}.
                  </p>
                )}
                {overrideDetails.length > 0 && (
                  <div className="space-y-1 border rounded-md p-2 bg-amber-50 dark:bg-amber-950/30">
                    <p className="text-xs font-medium text-amber-800 dark:text-amber-300">Overrides to be applied:</p>
                    {overrideDetails.map((ov: any, i: number) => (
                      <div key={i} className="text-xs text-amber-700 dark:text-amber-400">
                        <strong>{ov.name}</strong>:{" "}
                        {ov.elOverride !== undefined && (
                          <span>EL {ov.computedEl} → {ov.elOverride} </span>
                        )}
                        {ov.slOverride !== undefined && (
                          <span>SL {ov.computedSl} → {ov.slOverride}</span>
                        )}
                      </div>
                    ))}
                    {overrideNote && (
                      <p className="text-xs text-muted-foreground mt-1 italic">Reason: {overrideNote}</p>
                    )}
                  </div>
                )}
                <p className="font-medium text-amber-700 dark:text-amber-400">
                  The operation is idempotent — running it again will not create duplicate rows.
                  All corrections use offset rows for a full audit trail.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>Cancel</Button>
            <Button
              onClick={() => backfillMutation.mutate(pendingDryRun)}
              disabled={backfillMutation.isPending || (!pendingDryRun && hasOverrides && overrideNote.trim().length === 0)}
              data-testid="button-confirm-backfill"
            >
              {backfillMutation.isPending ? "Running..." : pendingDryRun ? "Run Dry Run" : "Confirm & Run"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

interface PlanGoalTemplate {
  id: string;
  plan_type: string;
  role_slug: string;
  goal_title: string;
  goal_category: string;
  goal_description: string | null;
  target_metric: string | null;
  sort_order: number;
  is_active: boolean;
  department: string | null;
  role: string | null;
  level: string | null;
  weight: number | null;
  milestone: string | null;
  is_universal: boolean;
}

interface ProbationScoringBand {
  id: string;
  min_score: number;
  max_score: number;
  label: string;
  meaning: string | null;
  recommended_outcome: string | null;
  sort_order: number;
  is_active: boolean;
}

const PLAN_TYPE_LABELS: Record<string, string> = {
  probation: "Probation",
  growth: "Growth Plan",
  pip: "PIP",
};

const ROLE_SLUG_LABELS: Record<string, string> = {
  associate_recruiter: "Associate Recruiter",
  senior_recruiter: "Senior Recruiter",
  lead_recruiter: "Lead Recruiter",
  associate_manager: "Associate Manager",
  account_manager: "Account Manager",
  foundation_to_senior: "Foundation → Senior Recruiter",
  universal: "Universal (all roles)",
  ta_recruiter_associate: "Recruiter — Associate",
  ta_recruiter_senior: "Recruiter — Senior",
  ta_lead_recruiter: "Lead Recruiter / Asst. Manager",
  ta_account_manager: "Account / Delivery Manager",
  hr_operations: "HR / Operations / Admin",
  marketing_content: "Marketing / Content / Social",
};

const DEPARTMENT_LABELS: Record<string, string> = {
  healthcare: "Healthcare",
  it: "IT",
  engineering: "Engineering",
  marketing: "Marketing",
  sales_bd: "Sales / BD",
  hr_ops: "HR / Operations",
  professional_services: "Professional Services",
};

const LEVEL_LABELS: Record<string, string> = {
  associate: "Associate",
  senior: "Senior",
  lead: "Lead",
  manager: "Manager",
  all: "All Levels",
};

const MILESTONE_LABELS: Record<string, string> = {
  day_30: "Day 30",
  day_60: "Day 60",
  day_90: "Day 90",
};

export function GoalTemplatesSection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const canManage = ["super_admin", "admin", "hr"].includes(user?.role || "");
  const canView = canManage || user?.role === "manager";
  const [filterPlanType, setFilterPlanType] = useState("probation");
  const [filterRole, setFilterRole] = useState("all");
  const [filterDepartment, setFilterDepartment] = useState("all");
  const [filterLevel, setFilterLevel] = useState("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<PlanGoalTemplate>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    plan_type: "probation", role_slug: "associate_recruiter",
    goal_title: "", goal_category: "individual",
    goal_description: "", target_metric: "", sort_order: "0",
    department: "", role: "", level: "", weight: "", milestone: "", is_universal: false,
  });

  const { data: templates = [], isLoading, refetch } = useQuery<PlanGoalTemplate[]>({
    queryKey: ["/api/hr/plan-templates-all"],
    queryFn: async () => {
      const res = await fetch("/api/hr/plan-templates?active_only=false", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: canView,
  });

  const { data: scoringData } = useQuery<{ bands: ProbationScoringBand[]; passRule: string | null; finalWeights: { area: string; weight: number }[] | null }>({
    queryKey: ["/api/hr/probation-scoring-bands"],
    enabled: canView,
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; body: Partial<PlanGoalTemplate> }) =>
      apiRequest("PATCH", `/api/hr/plan-templates/${data.id}`, data.body),
    onSuccess: () => { refetch(); setEditingId(null); toast({ title: "Template updated" }); },
    onError: () => toast({ title: "Update failed", variant: "destructive" }),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof addForm) => apiRequest("POST", "/api/hr/plan-templates", {
      ...data,
      sort_order: parseInt(data.sort_order, 10),
      department: data.department || null,
      role: data.role || null,
      level: data.level || null,
      weight: data.weight ? parseInt(data.weight, 10) : null,
      milestone: data.milestone || null,
      is_universal: data.is_universal,
    }),
    onSuccess: () => {
      refetch();
      setShowAdd(false);
      setAddForm({ plan_type: "probation", role_slug: "associate_recruiter", goal_title: "", goal_category: "individual", goal_description: "", target_metric: "", sort_order: "0", department: "", role: "", level: "", weight: "", milestone: "", is_universal: false });
      toast({ title: "Template created" });
    },
    onError: () => toast({ title: "Create failed", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/hr/plan-templates/${id}`),
    onSuccess: () => { refetch(); toast({ title: "Template deleted" }); },
    onError: () => toast({ title: "Delete failed", variant: "destructive" }),
  });

  if (!canView) return null;

  const filtered = templates.filter(t =>
    (filterPlanType === "all" || t.plan_type === filterPlanType) &&
    (filterRole === "all" || t.role_slug === filterRole) &&
    (filterDepartment === "all" || (filterDepartment === "none" ? !t.department : t.department === filterDepartment)) &&
    (filterLevel === "all" || (filterLevel === "none" ? !t.level : t.level === filterLevel))
  );

  function startEdit(t: PlanGoalTemplate) {
    setEditingId(t.id);
    setEditForm({
      goal_title: t.goal_title,
      goal_category: t.goal_category,
      goal_description: t.goal_description || "",
      target_metric: t.target_metric || "",
      sort_order: t.sort_order,
      is_active: t.is_active,
      weight: t.weight,
      milestone: t.milestone,
      department: t.department,
      role: t.role,
      level: t.level,
      is_universal: t.is_universal,
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Plan Goal Templates
          </CardTitle>
          {canManage && (
            <Button size="sm" onClick={() => setShowAdd(true)} data-testid="button-add-goal-template">
              <Plus className="h-4 w-4 mr-1" /> Add Template
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Predefined goal templates loaded into annexures when creating Probation, Growth, or PIP plans. Probation templates are keyed by department, role, and level (universal goals always apply); Growth and PIP remain Healthcare-scoped.
        </p>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Label className="text-xs whitespace-nowrap">Plan Type</Label>
            <Select value={filterPlanType} onValueChange={setFilterPlanType}>
              <SelectTrigger className="h-8 w-32 text-xs" data-testid="select-filter-plan-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="probation">Probation</SelectItem>
                <SelectItem value="growth">Growth Plan</SelectItem>
                <SelectItem value="pip">PIP</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs whitespace-nowrap">Role</Label>
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="h-8 w-44 text-xs" data-testid="select-filter-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {Object.entries(ROLE_SLUG_LABELS).map(([slug, label]) => (
                  <SelectItem key={slug} value={slug}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs whitespace-nowrap">Department</Label>
            <Select value={filterDepartment} onValueChange={setFilterDepartment}>
              <SelectTrigger className="h-8 w-40 text-xs" data-testid="select-filter-department">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                <SelectItem value="none">Any / Unset</SelectItem>
                {Object.entries(DEPARTMENT_LABELS).map(([slug, label]) => (
                  <SelectItem key={slug} value={slug}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs whitespace-nowrap">Level</Label>
            <Select value={filterLevel} onValueChange={setFilterLevel}>
              <SelectTrigger className="h-8 w-32 text-xs" data-testid="select-filter-level">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="none">Unset</SelectItem>
                {Object.entries(LEVEL_LABELS).map(([slug, label]) => (
                  <SelectItem key={slug} value={slug}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <span className="text-xs text-muted-foreground">{filtered.length} template{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        {isLoading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 bg-muted animate-pulse rounded" />)}</div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No templates found for this selection.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left py-2 px-2 font-medium">Goal Title</th>
                  <th className="text-left py-2 px-2 font-medium">Type / Role</th>
                  <th className="text-left py-2 px-2 font-medium">Dept / Level</th>
                  <th className="text-left py-2 px-2 font-medium">Milestone</th>
                  <th className="text-left py-2 px-2 font-medium">Weight</th>
                  <th className="text-left py-2 px-2 font-medium">Target Metric</th>
                  <th className="text-left py-2 px-2 font-medium">Category</th>
                  <th className="text-left py-2 px-2 font-medium">Order</th>
                  <th className="text-left py-2 px-2 font-medium">Active</th>
                  <th className="text-left py-2 px-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => (
                  <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30" data-testid={`row-template-${t.id}`}>
                    {editingId === t.id ? (
                      <>
                        <td className="py-2 px-2" colSpan={8}>
                          <div className="space-y-2">
                            <Input
                              value={String(editForm.goal_title ?? "")}
                              onChange={e => setEditForm(prev => ({ ...prev, goal_title: e.target.value }))}
                              placeholder="Goal title"
                              className="h-7 text-xs"
                              data-testid={`input-edit-title-${t.id}`}
                            />
                            <Input
                              value={String(editForm.target_metric ?? "")}
                              onChange={e => setEditForm(prev => ({ ...prev, target_metric: e.target.value }))}
                              placeholder="Target metric"
                              className="h-7 text-xs"
                              data-testid={`input-edit-metric-${t.id}`}
                            />
                            <div className="flex items-center gap-2 flex-wrap">
                              <Input
                                type="number"
                                value={String(editForm.sort_order ?? 0)}
                                onChange={e => setEditForm(prev => ({ ...prev, sort_order: parseInt(e.target.value, 10) }))}
                                placeholder="Order"
                                className="h-7 text-xs w-16"
                                data-testid={`input-edit-order-${t.id}`}
                              />
                              <Input
                                type="number"
                                value={editForm.weight ?? ""}
                                onChange={e => setEditForm(prev => ({ ...prev, weight: e.target.value === "" ? null : parseInt(e.target.value, 10) }))}
                                placeholder="Weight %"
                                className="h-7 text-xs w-20"
                                data-testid={`input-edit-weight-${t.id}`}
                              />
                              <Select
                                value={editForm.milestone ?? "none"}
                                onValueChange={v => setEditForm(prev => ({ ...prev, milestone: v === "none" ? null : v }))}
                              >
                                <SelectTrigger className="h-7 text-xs w-28">
                                  <SelectValue placeholder="Milestone" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">No milestone</SelectItem>
                                  <SelectItem value="day_30">Day 30</SelectItem>
                                  <SelectItem value="day_60">Day 60</SelectItem>
                                  <SelectItem value="day_90">Day 90</SelectItem>
                                </SelectContent>
                              </Select>
                              <Select
                                value={String(editForm.goal_category ?? "individual")}
                                onValueChange={v => setEditForm(prev => ({ ...prev, goal_category: v }))}
                              >
                                <SelectTrigger className="h-7 text-xs w-28">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="individual">Individual</SelectItem>
                                  <SelectItem value="team">Team</SelectItem>
                                  <SelectItem value="development">Development</SelectItem>
                                  <SelectItem value="company">Company</SelectItem>
                                </SelectContent>
                              </Select>
                              <div className="flex items-center gap-1.5">
                                <Switch
                                  checked={!!editForm.is_active}
                                  onCheckedChange={v => setEditForm(prev => ({ ...prev, is_active: v }))}
                                  data-testid={`switch-edit-active-${t.id}`}
                                />
                                <span className="text-xs">Active</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Select
                                value={editForm.department || "none"}
                                onValueChange={v => setEditForm(prev => ({ ...prev, department: v === "none" ? null : v }))}
                              >
                                <SelectTrigger className="h-7 text-xs w-36" data-testid={`select-edit-department-${t.id}`}>
                                  <SelectValue placeholder="Department" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Any / Unset dept</SelectItem>
                                  {Object.entries(DEPARTMENT_LABELS).map(([slug, label]) => (
                                    <SelectItem key={slug} value={slug}>{label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Select
                                value={editForm.role || "none"}
                                onValueChange={v => setEditForm(prev => ({ ...prev, role: v === "none" ? null : v }))}
                              >
                                <SelectTrigger className="h-7 text-xs w-36" data-testid={`select-edit-role-family-${t.id}`}>
                                  <SelectValue placeholder="Role family" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Unset role</SelectItem>
                                  <SelectItem value="recruiter">Recruiter</SelectItem>
                                  <SelectItem value="lead_recruiter">Lead Recruiter</SelectItem>
                                  <SelectItem value="account_manager">Account Manager</SelectItem>
                                  <SelectItem value="hr_ops">HR / Operations</SelectItem>
                                  <SelectItem value="marketing">Marketing</SelectItem>
                                </SelectContent>
                              </Select>
                              <Select
                                value={editForm.level || "none"}
                                onValueChange={v => setEditForm(prev => ({ ...prev, level: v === "none" ? null : v }))}
                              >
                                <SelectTrigger className="h-7 text-xs w-32" data-testid={`select-edit-level-${t.id}`}>
                                  <SelectValue placeholder="Level" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Unset level</SelectItem>
                                  {Object.entries(LEVEL_LABELS).map(([slug, label]) => (
                                    <SelectItem key={slug} value={slug}>{label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <div className="flex items-center gap-1.5">
                                <Switch
                                  checked={!!editForm.is_universal}
                                  onCheckedChange={v => setEditForm(prev => ({ ...prev, is_universal: v }))}
                                  data-testid={`switch-edit-universal-${t.id}`}
                                />
                                <span className="text-xs">Universal goal</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-2" colSpan={2}>
                          <div className="flex gap-1.5">
                            <Button
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => updateMutation.mutate({ id: t.id, body: editForm })}
                              disabled={updateMutation.isPending}
                              data-testid={`button-save-template-${t.id}`}
                            >
                              Save
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingId(null)}>
                              Cancel
                            </Button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-2 px-2 max-w-xs">
                          <span className="font-medium text-xs leading-tight" data-testid={`text-template-title-${t.id}`}>{t.goal_title}</span>
                          {t.goal_description && (
                            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{t.goal_description}</p>
                          )}
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex flex-col gap-0.5">
                            <Badge variant="outline" className="text-[10px] h-4 px-1 w-fit">{PLAN_TYPE_LABELS[t.plan_type] || t.plan_type}</Badge>
                            <span className="text-[11px] text-muted-foreground">{ROLE_SLUG_LABELS[t.role_slug] || t.role_slug}</span>
                            {t.is_universal && (
                              <Badge variant="secondary" className="text-[10px] h-4 px-1 w-fit">Universal</Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[11px] text-muted-foreground">{t.department ? (DEPARTMENT_LABELS[t.department] || t.department) : "Any"}</span>
                            {t.level && <span className="text-[11px] text-muted-foreground">{LEVEL_LABELS[t.level] || t.level}</span>}
                          </div>
                        </td>
                        <td className="py-2 px-2">
                          {t.milestone ? (
                            <Badge variant="outline" className="text-[10px] h-4 px-1">{MILESTONE_LABELS[t.milestone] || t.milestone}</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-2 px-2">
                          <span className="text-xs font-mono">{t.weight != null ? `${t.weight}%` : "—"}</span>
                        </td>
                        <td className="py-2 px-2 max-w-[200px]">
                          <span className="text-xs text-muted-foreground">{t.target_metric || "—"}</span>
                        </td>
                        <td className="py-2 px-2">
                          <Badge variant="secondary" className="text-[10px] h-4 px-1">{t.goal_category}</Badge>
                        </td>
                        <td className="py-2 px-2">
                          <span className="text-xs font-mono">{t.sort_order}</span>
                        </td>
                        <td className="py-2 px-2">
                          {canManage ? (
                            <Switch
                              checked={t.is_active}
                              onCheckedChange={v => updateMutation.mutate({ id: t.id, body: { is_active: v } })}
                              data-testid={`switch-template-active-${t.id}`}
                            />
                          ) : (
                            <Badge variant={t.is_active ? "secondary" : "outline"} className="text-[10px] h-4 px-1">
                              {t.is_active ? "Active" : "Inactive"}
                            </Badge>
                          )}
                        </td>
                        <td className="py-2 px-2">
                          {canManage ? (
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={() => startEdit(t)}
                                data-testid={`button-edit-template-${t.id}`}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                                onClick={() => deleteMutation.mutate(t.id)}
                                disabled={deleteMutation.isPending}
                                data-testid={`button-delete-template-${t.id}`}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {showAdd && (
          <div className="border rounded-md p-4 space-y-3 bg-muted/30">
            <p className="text-sm font-medium">New Template</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Plan Type</Label>
                <Select value={addForm.plan_type} onValueChange={v => setAddForm(prev => ({ ...prev, plan_type: v }))}>
                  <SelectTrigger className="h-8 text-xs" data-testid="select-add-plan-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="probation">Probation</SelectItem>
                    <SelectItem value="growth">Growth Plan</SelectItem>
                    <SelectItem value="pip">PIP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Role Key (unique slug)</Label>
                <Input
                  value={addForm.role_slug}
                  onChange={e => setAddForm(prev => ({ ...prev, role_slug: e.target.value }))}
                  placeholder="e.g. ta_recruiter_associate or universal"
                  className="h-8 text-xs"
                  data-testid="input-add-role-slug"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Department</Label>
                <Select value={addForm.department || "none"} onValueChange={v => setAddForm(prev => ({ ...prev, department: v === "none" ? "" : v }))}>
                  <SelectTrigger className="h-8 text-xs" data-testid="select-add-department">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Any / Unset</SelectItem>
                    {Object.entries(DEPARTMENT_LABELS).map(([slug, label]) => (
                      <SelectItem key={slug} value={slug}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Role Family</Label>
                <Select value={addForm.role || "none"} onValueChange={v => setAddForm(prev => ({ ...prev, role: v === "none" ? "" : v }))}>
                  <SelectTrigger className="h-8 text-xs" data-testid="select-add-role-family">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unset</SelectItem>
                    <SelectItem value="recruiter">Recruiter</SelectItem>
                    <SelectItem value="lead_recruiter">Lead Recruiter</SelectItem>
                    <SelectItem value="account_manager">Account Manager</SelectItem>
                    <SelectItem value="hr_ops">HR / Operations</SelectItem>
                    <SelectItem value="marketing">Marketing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Level</Label>
                <Select value={addForm.level || "none"} onValueChange={v => setAddForm(prev => ({ ...prev, level: v === "none" ? "" : v }))}>
                  <SelectTrigger className="h-8 text-xs" data-testid="select-add-level">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unset</SelectItem>
                    {Object.entries(LEVEL_LABELS).map(([slug, label]) => (
                      <SelectItem key={slug} value={slug}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Goal Title *</Label>
              <Input
                value={addForm.goal_title}
                onChange={e => setAddForm(prev => ({ ...prev, goal_title: e.target.value }))}
                placeholder="e.g. Achieve qualified submissions target"
                className="h-8 text-xs"
                data-testid="input-add-goal-title"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Target Metric</Label>
              <Input
                value={addForm.target_metric}
                onChange={e => setAddForm(prev => ({ ...prev, target_metric: e.target.value }))}
                placeholder="e.g. 5 qualified submissions per week"
                className="h-8 text-xs"
                data-testid="input-add-target-metric"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Description</Label>
              <Textarea
                value={addForm.goal_description}
                onChange={e => setAddForm(prev => ({ ...prev, goal_description: e.target.value }))}
                placeholder="Optional description..."
                rows={2}
                className="text-xs"
                data-testid="input-add-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Category</Label>
                <Select value={addForm.goal_category} onValueChange={v => setAddForm(prev => ({ ...prev, goal_category: v }))}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Individual</SelectItem>
                    <SelectItem value="team">Team</SelectItem>
                    <SelectItem value="development">Development</SelectItem>
                    <SelectItem value="company">Company</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Sort Order</Label>
                <Input
                  type="number"
                  value={addForm.sort_order}
                  onChange={e => setAddForm(prev => ({ ...prev, sort_order: e.target.value }))}
                  className="h-8 text-xs"
                  data-testid="input-add-sort-order"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 items-end">
              <div className="space-y-1">
                <Label className="text-xs">Weight (%)</Label>
                <Input
                  type="number"
                  value={addForm.weight}
                  onChange={e => setAddForm(prev => ({ ...prev, weight: e.target.value }))}
                  placeholder="e.g. 40"
                  className="h-8 text-xs"
                  data-testid="input-add-weight"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Milestone</Label>
                <Select value={addForm.milestone || "none"} onValueChange={v => setAddForm(prev => ({ ...prev, milestone: v === "none" ? "" : v }))}>
                  <SelectTrigger className="h-8 text-xs" data-testid="select-add-milestone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No milestone</SelectItem>
                    <SelectItem value="day_30">Day 30</SelectItem>
                    <SelectItem value="day_60">Day 60</SelectItem>
                    <SelectItem value="day_90">Day 90</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 h-8">
                <Switch
                  checked={addForm.is_universal}
                  onCheckedChange={v => setAddForm(prev => ({ ...prev, is_universal: v }))}
                  data-testid="switch-add-universal"
                />
                <span className="text-xs">Universal goal</span>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                onClick={() => createMutation.mutate(addForm)}
                disabled={!addForm.goal_title || createMutation.isPending}
                data-testid="button-save-new-template"
              >
                {createMutation.isPending ? "Saving..." : "Save Template"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {filterPlanType === "probation" && scoringData && (scoringData.bands?.length > 0 || scoringData.passRule) && (
          <div className="border rounded-md p-4 space-y-3 mt-4" data-testid="card-scoring-bands">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Probation Scoring Bands & Pass Rule</p>
              <Badge variant="outline" className="text-[10px] h-4 px-1">Reference</Badge>
            </div>
            {scoringData.bands?.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="text-left py-2 px-2 font-medium">Score</th>
                      <th className="text-left py-2 px-2 font-medium">Meaning</th>
                      <th className="text-left py-2 px-2 font-medium">Recommended Outcome</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scoringData.bands.map(b => (
                      <tr key={b.id} className="border-b last:border-0" data-testid={`row-band-${b.id}`}>
                        <td className="py-2 px-2"><Badge variant="secondary" className="text-[10px] h-4 px-1 font-mono">{b.label}</Badge></td>
                        <td className="py-2 px-2 text-xs text-muted-foreground">{b.meaning || "—"}</td>
                        <td className="py-2 px-2 text-xs text-muted-foreground">{b.recommended_outcome || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {scoringData.finalWeights && scoringData.finalWeights.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium">Day 90 Final Weights</p>
                <div className="flex flex-wrap gap-1.5">
                  {scoringData.finalWeights.map((w, i) => (
                    <Badge key={i} variant="outline" className="text-[10px] h-5 px-1.5" data-testid={`badge-weight-${i}`}>
                      {w.area}: {w.weight}%
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {scoringData.passRule && (
              <div className="space-y-1">
                <p className="text-xs font-medium">Pass Rule</p>
                <p className="text-xs text-muted-foreground" data-testid="text-pass-rule">{scoringData.passRule}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ShiftsSection() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isHrOrAbove = ["super_admin", "admin", "hr", "executive"].includes(user?.role || "");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");

  const { data: shifts, isLoading, refetch } = useQuery<ShiftInfo[]>({
    queryKey: ["/api/hr/shifts"],
    enabled: isHrOrAbove,
  });

  const graceMutation = useMutation({
    mutationFn: ({ id, value }: { id: string; value: number }) =>
      apiRequest("PATCH", `/api/hr/admin/shifts/${id}/grace-period`, { gracePeriodMinutes: value }),
    onSuccess: () => {
      refetch();
      setEditingId(null);
      toast({ title: "Grace period updated" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to update", description: err.message || "Error", variant: "destructive" });
    },
  });

  if (!isHrOrAbove) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Settings className="h-4 w-4" />
          Shifts & Grace Periods
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-3">
          Configure the grace window for each shift. Employees punching in after the shift start + grace period are automatically marked as <strong>Late</strong>.
        </p>
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : shifts && shifts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground">Shift</th>
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground">Hours</th>
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground">Start Time</th>
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground">Grace Period (min)</th>
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {shifts.map((s) => (
                  <tr key={s.id} className="border-b last:border-0" data-testid={`shift-row-${s.id}`}>
                    <td className="py-3 px-2 font-medium">{s.displayLabel || s.name}</td>
                    <td className="py-3 px-2">{s.scheduledHours}h</td>
                    <td className="py-3 px-2 font-mono">{s.istStart}</td>
                    <td className="py-3 px-2">
                      {editingId === s.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={editValue}
                            min={0}
                            max={120}
                            className="h-7 w-20 text-sm"
                            onChange={(e) => setEditValue(e.target.value)}
                            data-testid={`input-grace-period-${s.id}`}
                          />
                          <Button
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => graceMutation.mutate({ id: s.id, value: parseInt(editValue, 10) })}
                            disabled={graceMutation.isPending}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <span className="font-mono" data-testid={`text-grace-period-${s.id}`}>{s.gracePeriodMinutes ?? 15} min</span>
                      )}
                    </td>
                    <td className="py-3 px-2">
                      {editingId !== s.id && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7"
                          onClick={() => {
                            setEditingId(s.id);
                            setEditValue(String(s.gracePeriodMinutes ?? 15));
                          }}
                          data-testid={`button-edit-grace-${s.id}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No active shifts found.</p>
        )}
      </CardContent>
    </Card>
  );
}

interface AccessControlData {
  matrix: Record<string, string[]>;
  enabled: boolean;
  roles: { value: string; label: string }[];
  defaults: Record<string, string[]>;
}

const ACCESS_GROUP_LABELS: Record<string, string> = {
  admin: "Admin & Recruitment",
  auth: "Authentication",
  companyProfile: "Company Profile",
  contracts: "Contracts",
  departments: "Departments",
  hr: "HR Portal",
  onboarding: "Onboarding & Training",
  performance: "Performance",
  rayoAcademy: "Rayo Academy",
  system: "System",
  systemSettings: "System Settings",
};

function prettyFeatureLabel(key: string): string {
  const parts = key.split(".").slice(1);
  if (parts.length === 0) return key;
  return parts
    .map((p) => p.replace(/([a-z])([A-Z])/g, "$1 $2"))
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" › ");
}

export function AccessControlSection() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";

  const [draft, setDraft] = useState<Record<string, string[]> | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const { data, isLoading } = useQuery<AccessControlData>({
    queryKey: ["/api/admin/access-control"],
    enabled: isSuperAdmin,
  });

  useEffect(() => {
    if (data?.matrix) setDraft(data.matrix);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (payload: { matrix?: Record<string, string[]>; enabled?: boolean }) => {
      const res = await apiRequest("PUT", "/api/admin/access-control", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/access-control"] });
      queryClient.invalidateQueries({ queryKey: ["/api/me/permissions"] });
      toast({ title: "Access control updated", description: "Changes take effect immediately." });
    },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/access-control/reset");
      return res.json();
    },
    onSuccess: (d: AccessControlData) => {
      setDraft(d.matrix);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/access-control"] });
      queryClient.invalidateQueries({ queryKey: ["/api/me/permissions"] });
      toast({ title: "Reset to defaults", description: "The matrix was restored to the shipped defaults." });
    },
    onError: () => toast({ title: "Failed to reset", variant: "destructive" }),
  });

  if (!isSuperAdmin) return null;

  const roles = data?.roles ?? [];
  const PROTECTED = "super_admin";

  const toggleRole = (feature: string, role: string, checked: boolean) => {
    if (role === PROTECTED) return; // guardrail: super_admin can't be removed
    setDraft((prev) => {
      if (!prev) return prev;
      const current = new Set(prev[feature] ?? []);
      if (checked) current.add(role);
      else current.delete(role);
      current.add(PROTECTED);
      return { ...prev, [feature]: Array.from(current) };
    });
  };

  const isDirty = draft && data?.matrix && JSON.stringify(draft) !== JSON.stringify(data.matrix);

  // Group feature keys by their first segment
  const grouped: Record<string, string[]> = {};
  if (draft) {
    for (const key of Object.keys(draft).sort()) {
      const group = key.split(".")[0];
      (grouped[group] = grouped[group] || []).push(key);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Access Control (RBAC)
          </CardTitle>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">DB-driven</span>
              <Switch
                checked={data?.enabled ?? false}
                onCheckedChange={(v) => saveMutation.mutate({ enabled: v })}
                disabled={isLoading || saveMutation.isPending}
                data-testid="switch-access-control-enabled"
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Edit which roles can use each feature. When <strong>DB-driven</strong> is off, the system uses the
          shipped config defaults (current behavior). Super Admin always retains access and cannot be removed.
        </p>

        {isLoading || !draft ? (
          <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-8 rounded bg-muted animate-pulse" />)}</div>
        ) : (
          <div className="space-y-3">
            {Object.keys(grouped).sort().map((group) => {
              const isOpen = openGroups[group] ?? false;
              return (
                <div key={group} className="border rounded-lg">
                  <button
                    type="button"
                    onClick={() => setOpenGroups((p) => ({ ...p, [group]: !isOpen }))}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium hover:bg-accent rounded-lg"
                    data-testid={`button-access-group-${group}`}
                  >
                    <span>{ACCESS_GROUP_LABELS[group] || group} <span className="text-muted-foreground font-normal">({grouped[group].length})</span></span>
                    {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                  {isOpen && (
                    <div className="overflow-x-auto border-t">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b bg-muted/40">
                            <th className="text-left p-2 font-medium sticky left-0 bg-muted/40">Feature</th>
                            {roles.map((r) => (
                              <th key={r.value} className="p-2 font-medium text-center whitespace-nowrap">{r.label}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {grouped[group].map((feature) => (
                            <tr key={feature} className="border-b hover:bg-muted/20" data-testid={`row-access-${feature}`}>
                              <td className="p-2 sticky left-0 bg-background font-mono text-[11px]" title={feature}>
                                {prettyFeatureLabel(feature)}
                              </td>
                              {roles.map((r) => {
                                const checked = (draft[feature] ?? []).includes(r.value);
                                const locked = r.value === PROTECTED;
                                return (
                                  <td key={r.value} className="p-2 text-center">
                                    <Checkbox
                                      checked={checked}
                                      disabled={locked}
                                      onCheckedChange={(c) => toggleRole(feature, r.value, !!c)}
                                      data-testid={`checkbox-access-${feature}-${r.value}`}
                                    />
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}

            <div className="flex items-center gap-2 pt-2">
              <Button
                onClick={() => draft && saveMutation.mutate({ matrix: draft })}
                disabled={!isDirty || saveMutation.isPending}
                data-testid="button-save-access-control"
              >
                {saveMutation.isPending ? "Saving..." : "Save changes"}
              </Button>
              <Button
                variant="outline"
                onClick={() => data?.matrix && setDraft(data.matrix)}
                disabled={!isDirty}
                data-testid="button-revert-access-control"
              >
                Revert
              </Button>
              <Button
                variant="ghost"
                onClick={() => resetMutation.mutate()}
                disabled={resetMutation.isPending}
                data-testid="button-reset-access-control"
              >
                Reset to defaults
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AttendanceExceptionThresholdsSection() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isHrOrAbove = ["super_admin", "admin", "hr", "executive"].includes(user?.role || "");

  const { data: settings, isLoading } = useQuery<{
    standardShiftHours: number;
    tier1: number;
    tier2: number;
    tier3: number;
    minExceptionShortfallMinutes: number;
  }>({
    queryKey: ["/api/attendance/settings"],
    queryFn: async () => {
      const res = await fetch("/api/attendance/settings", { credentials: "include" });
      if (!res.ok) return { standardShiftHours: 9, tier1: 2, tier2: 5, tier3: 10, minExceptionShortfallMinutes: 30 };
      return res.json();
    },
    enabled: isHrOrAbove,
  });

  const [form, setForm] = useState({ standardShiftHours: "9", tier1: "2", tier2: "5", tier3: "10", minExceptionShortfallMinutes: "30" });
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm({
        standardShiftHours: String(settings.standardShiftHours ?? 9),
        tier1: String(settings.tier1 ?? 2),
        tier2: String(settings.tier2 ?? 5),
        tier3: String(settings.tier3 ?? 10),
        minExceptionShortfallMinutes: String(settings.minExceptionShortfallMinutes ?? 30),
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", "/api/attendance/settings", {
        standardShiftHours: parseFloat(form.standardShiftHours),
        tier1: parseInt(form.tier1),
        tier2: parseInt(form.tier2),
        tier3: parseInt(form.tier3),
        minExceptionShortfallMinutes: parseInt(form.minExceptionShortfallMinutes),
      });
      if (!res.ok) throw new Error("Failed to save");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/settings"] });
      setEditing(false);
      toast({ title: "Saved", description: "Attendance exception thresholds updated." });
    },
    onError: () => toast({ title: "Error", description: "Failed to save settings", variant: "destructive" }),
  });

  if (!isHrOrAbove) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Attendance Exception Thresholds
          </CardTitle>
          {!editing ? (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)} data-testid="button-edit-att-thresholds">
              <Pencil className="h-4 w-4 mr-1" />Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
              <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="button-save-att-thresholds">
                {saveMutation.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-2">{[1, 2, 3, 4].map(i => <div key={i} className="h-8 rounded bg-muted animate-pulse" />)}</div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="att-standard-hours">Standard Shift Hours</Label>
                <p className="text-xs text-muted-foreground">Threshold for a full day. Short day = ≥50% but &lt;100% of this value.</p>
                {editing ? (
                  <Input
                    id="att-standard-hours"
                    type="number"
                    min="1"
                    max="24"
                    step="0.5"
                    value={form.standardShiftHours}
                    onChange={(e) => setForm(f => ({ ...f, standardShiftHours: e.target.value }))}
                    data-testid="input-standard-shift-hours"
                  />
                ) : (
                  <p className="font-medium text-sm">{settings?.standardShiftHours ?? 9} hours</p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="att-min-shortfall">Minimum Exception Shortfall (minutes)</Label>
                <p className="text-xs text-muted-foreground">Shortfalls below this duration will not generate an exception (industry default: 30 min).</p>
                {editing ? (
                  <Input
                    id="att-min-shortfall"
                    type="number"
                    min="0"
                    max="480"
                    step="5"
                    value={form.minExceptionShortfallMinutes}
                    onChange={(e) => setForm(f => ({ ...f, minExceptionShortfallMinutes: e.target.value }))}
                    data-testid="input-min-exception-shortfall"
                  />
                ) : (
                  <p className="font-medium text-sm">{settings?.minExceptionShortfallMinutes ?? 30} minutes</p>
                )}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-3">Escalation Alert Tiers (monthly short/late day count)</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { key: "tier1", label: "Tier 1 — Manager notified", color: "bg-yellow-50 border-yellow-200", textColor: "text-yellow-700" },
                  { key: "tier2", label: "Tier 2 — Admin notified", color: "bg-orange-50 border-orange-200", textColor: "text-orange-700" },
                  { key: "tier3", label: "Tier 3 — HR + Super Admin", color: "bg-red-50 border-red-200", textColor: "text-red-700" },
                ].map(({ key, label, color, textColor }) => (
                  <div key={key} className={`p-3 rounded-lg border ${color}`}>
                    <p className={`text-xs font-medium mb-1 ${textColor}`}>{label}</p>
                    {editing ? (
                      <Input
                        type="number"
                        min="1"
                        max="31"
                        value={form[key as keyof typeof form]}
                        onChange={(e) => setForm(f => ({ ...f, [key]: e.target.value }))}
                        className="h-8 text-sm"
                        data-testid={`input-${key}`}
                      />
                    ) : (
                      <p className={`text-2xl font-bold ${textColor}`}>{settings?.[key as keyof typeof settings] ?? (key === "tier1" ? 2 : key === "tier2" ? 5 : 10)}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">occurrences/month</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export type SettingsGroupKey =
  | "leave-attendance"
  | "organization"
  | "payroll";

interface SettingsGroupItem {
  id: string;
  label: string;
  hrOnly?: boolean;
  salaryFlag?: boolean;
}

// NOTE: keep client/src/lib/settings-redirect.ts (SETTINGS_TAB_TO_GROUP) in
// sync with the group/item ids below — it maps legacy ?tab= deep links to the
// new per-group routes.
export const SETTINGS_GROUPS: Record<
  SettingsGroupKey,
  { label: string; description: string; items: SettingsGroupItem[] }
> = {
  "leave-attendance": {
    label: "Leave & Attendance",
    description: "Leave types, holidays, attendance policy, shifts, and salary advance",
    items: [
      { id: "leave-types", label: "Leave Types" },
      { id: "holidays", label: "Holidays" },
      { id: "attendance-policy", label: "Attendance Policy" },
      { id: "shifts", label: "Shifts" },
      { id: "salary-advance-policy", label: "Salary Advance", hrOnly: true, salaryFlag: true },
    ],
  },
  organization: {
    label: "Organization",
    description: "Departments and company identity",
    items: [
      { id: "departments", label: "Departments" },
      { id: "company-profile", label: "Company Profile" },
    ],
  },
  payroll: {
    label: "Payroll",
    description: "Salary structures, state registrations, and statutory coverage",
    items: [
      { id: "salary-structures", label: "Salary Structures", hrOnly: true },
      { id: "state-registrations", label: "State Registrations", hrOnly: true },
      { id: "coverage", label: "EPF & ESI Coverage", hrOnly: true },
    ],
  },
};

export default function HRSettings({ group }: { group?: string }) {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { isEnabled } = useFeatureFlags();
  const salaryAdvanceEnabled = isEnabled("salary_advance_enabled");
  const groupKey: SettingsGroupKey =
    group && group in SETTINGS_GROUPS ? (group as SettingsGroupKey) : "leave-attendance";
  const groupDef = SETTINGS_GROUPS[groupKey];
  const { toast } = useToast();

  // Redirect stale deep-links for tabs that have been relocated out of Settings
  // (e.g. /admin/settings/leave-attendance?tab=balance-adjustments) to their new
  // home instead of silently falling back to the group's first section.
  useEffect(() => {
    try {
      const tab = new URLSearchParams(window.location.search).get("tab");
      const target = relocatedSettingsTabTarget(tab);
      if (target) setLocation(target);
    } catch {}
  }, [setLocation]);

  const [showLeaveType, setShowLeaveType] = useState(false);
  const [editingLeaveType, setEditingLeaveType] = useState<LeaveType | null>(null);
  const [ltForm, setLtForm] = useState({ name: "", defaultDays: "0", monthlyAccrual: "0", minHoursForAccrual: "128", description: "", isActive: true, isConditional: true, carryForwardCap: "0", blockEntitlement: false });
  const [deleteLtTarget, setDeleteLtTarget] = useState<LeaveType | null>(null);
  const [deleteLtUsage, setDeleteLtUsage] = useState<{ balances: number; accruals: number; adjustments: number; requests: number; employees: number; remainingDays: number } | null>(null);
  const [deleteLtMode, setDeleteLtMode] = useState<"transfer" | "expire">("transfer");
  const [transferTargetId, setTransferTargetId] = useState<string>("");

  const [showHoliday, setShowHoliday] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [hForm, setHForm] = useState({ name: "", date: "", type: "public", isOptional: false });

  const [showUploadHoliday, setShowUploadHoliday] = useState(false);
  const [uploadYear, setUploadYear] = useState(String(new Date().getFullYear()));
  const [uploadNote, setUploadNote] = useState("Employee's can apply any two regional holidays without any loss of pay for india office. US Holidays are mandatory for US Client Team.");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showDepartment, setShowDepartment] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [dForm, setDForm] = useState({ name: "", description: "", isActive: true });

  const [activeSection, setActiveSection] = useState<string>(() => {
    try {
      const tab = new URLSearchParams(window.location.search).get("tab");
      if (tab && groupDef.items.some((i) => i.id === tab)) return tab;
    } catch {}
    return groupDef.items[0].id;
  });

  const { data: leaveTypes, isLoading: ltLoading } = useQuery<LeaveType[]>({
    queryKey: ["/api/hr/leave-types"],
    enabled: isAuthenticated,
    retry: 2,
    staleTime: 30000,
  });

  const { data: holidays, isLoading: hLoading } = useQuery<Holiday[]>({
    queryKey: ["/api/hr/holidays"],
    enabled: isAuthenticated,
  });

  const leaveTypeMutation = useMutation({
    mutationFn: (data: { id?: string; body: any }) => {
      if (data.id) {
        return apiRequest("PATCH", `/api/hr/leave-types/${data.id}`, data.body);
      }
      return apiRequest("POST", "/api/hr/leave-types", data.body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/leave-types"] });
      setShowLeaveType(false);
      setEditingLeaveType(null);
      toast({ title: "Saved", description: "Leave type saved." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to save", variant: "destructive" });
    },
  });

  const deleteLeaveTypeMutation = useMutation({
    mutationFn: (data: { id: string; mode?: "transfer" | "expire"; targetLeaveTypeId?: string }) =>
      apiRequest("DELETE", `/api/hr/leave-types/${data.id}`, data.mode ? { mode: data.mode, targetLeaveTypeId: data.targetLeaveTypeId } : undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/leave-types"] });
      setDeleteLtTarget(null);
      setDeleteLtUsage(null);
      toast({ title: "Deleted", description: "Leave type deleted." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to delete", variant: "destructive" });
    },
  });

  const startDeleteLeaveType = async (lt: LeaveType) => {
    try {
      const res = await apiRequest("GET", `/api/hr/leave-types/${lt.id}/usage`);
      const usage = await res.json();
      const inUse = usage.balances > 0 || usage.accruals > 0 || usage.adjustments > 0 || usage.requests > 0;
      if (!inUse) {
        if (window.confirm(`Delete "${lt.name}"? No employee data is attached to this leave type.`)) {
          deleteLeaveTypeMutation.mutate({ id: lt.id });
        }
        return;
      }
      setDeleteLtTarget(lt);
      setDeleteLtUsage(usage);
      setDeleteLtMode("transfer");
      setTransferTargetId("");
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to check leave type usage", variant: "destructive" });
    }
  };

  const accrualMutation = useMutation({
    mutationFn: (data: { year?: number; month?: number }) => apiRequest("POST", "/api/hr/leave-accruals/run", data),
    onSuccess: async (res) => {
      const result = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/hr/leave-balances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/leave-accruals/run-log"] });
      const desc = `${result.usersProcessed} users processed, ${result.accrualsMade} accruals made, ${result.skippedUsers?.length || 0} skipped.`;
      toast({ title: "Accrual Complete", description: desc });
    },
    onError: () => {
      toast({ title: "Failed", description: "Could not run leave accrual", variant: "destructive" });
    },
  });

  const yearEndMutation = useMutation({
    mutationFn: (data: { year: number }) => apiRequest("POST", "/api/hr/leave-accruals/year-end", data),
    onSuccess: async (res) => {
      const result = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/hr/leave-balances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/leave-accruals/run-log"] });
      toast({ title: "Year-End Batch Complete", description: `${result.elCarried} EL carry-forwards, ${result.slLapsed} SL lapsed.` });
    },
    onError: () => {
      toast({ title: "Failed", description: "Could not run year-end batch", variant: "destructive" });
    },
  });

  const { data: accrualLog, isLoading: accrualLogLoading } = useQuery<{ latest: any; history: any[]; yearEndLog: any[] }>({
    queryKey: ["/api/hr/leave-accruals/run-log"],
    enabled: isAuthenticated && (user?.role === "hr" || user?.role === "admin" || user?.role === "super_admin"),
    staleTime: 30000,
  });

  const holidayMutation = useMutation({
    mutationFn: (data: { id?: string; body: any }) => {
      if (data.id) {
        return apiRequest("PATCH", `/api/hr/holidays/${data.id}`, data.body);
      }
      return apiRequest("POST", "/api/hr/holidays", data.body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/holidays"] });
      setShowHoliday(false);
      setEditingHoliday(null);
      toast({ title: "Saved", description: "Holiday saved." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to save", variant: "destructive" });
    },
  });

  const deleteHolidayMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/hr/holidays/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/holidays"] });
      toast({ title: "Deleted", description: "Holiday deleted." });
    },
  });

  const uploadHolidayMutation = useMutation({
    mutationFn: async () => {
      if (!uploadFile) throw new Error("No file selected");
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("year", uploadYear);
      formData.append("note", uploadNote);
      const res = await fetch("/api/hr/holidays/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/holidays"] });
      setShowUploadHoliday(false);
      setUploadFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      let desc = data.message;
      if (data.errors && data.errors.length > 0) {
        desc += `. ${data.errors.length} error(s) encountered.`;
      }
      toast({ title: "Upload Complete", description: desc });
    },
    onError: (err: any) => {
      toast({ title: "Upload Failed", description: err.message || "Failed to upload", variant: "destructive" });
    },
  });

  const downloadTemplate = () => {
    const csv = "Date,Holiday Name,Regional Holiday\nJan 1st,New Year,\nMarch 3rd,,Holi\nMarch 20th,,Eid-ul-Fitr\nMay 27th,,Eid-ul-Adha (Bakrid)\nSep 7th,Labour Day USA,\nNov 12th,,Diwali\nNov 26th,Thanksgiving day,\nDec 25th,Christmas,\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "holiday_calendar_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const { data: deptList, isLoading: deptLoading } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
    enabled: isAuthenticated,
  });

  const deptMutation = useMutation({
    mutationFn: (data: { id?: string; body: any }) => {
      if (data.id) {
        return apiRequest("PATCH", `/api/departments/${data.id}`, data.body);
      }
      return apiRequest("POST", "/api/departments", data.body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      setShowDepartment(false);
      setEditingDepartment(null);
      toast({ title: "Saved", description: "Department saved." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to save", variant: "destructive" });
    },
  });

  const deleteDeptMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/departments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      toast({ title: "Deleted", description: "Department deleted." });
    },
  });

  const { can } = usePermissions();
  // Use permission key instead of inline role array so the check stays consistent with route-level guards
  const isHrOrAbove = can("payroll.structures.read");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/admin/login");
  }, [authLoading, isAuthenticated, setLocation]);

  // What's New / Release Notes moved out of Settings into the Communications
  // area. Redirect any legacy grouped deep-link (e.g. /admin/settings/system?tab=whats-new).
  let relocatedTab: string | null = null;
  try {
    relocatedTab = new URLSearchParams(window.location.search).get("tab");
  } catch {}
  const isRelocatedTab = relocatedTab === "whats-new" || relocatedTab === "release-notes";
  useEffect(() => {
    if (isRelocatedTab) {
      setLocation(`/admin/communications?tab=${relocatedTab}`);
    }
  }, [isRelocatedTab, relocatedTab, setLocation]);

  const visibleItems = groupDef.items.filter(
    (it) => (!it.hrOnly || isHrOrAbove) && (!it.salaryFlag || salaryAdvanceEnabled),
  );

  // When the group (route) changes, snap the active section to the URL's ?tab=
  // (if valid for this group) or the first visible item.
  useEffect(() => {
    let tab: string | null = null;
    try {
      tab = new URLSearchParams(window.location.search).get("tab");
    } catch {}
    if (tab && visibleItems.some((i) => i.id === tab)) {
      setActiveSection(tab);
    } else if (!visibleItems.some((i) => i.id === activeSection)) {
      setActiveSection(visibleItems[0]?.id ?? groupDef.items[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupKey, salaryAdvanceEnabled, isHrOrAbove]);

  const handleSectionChange = (id: string) => {
    setActiveSection(id);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", id);
      window.history.replaceState({}, "", url.toString());
    } catch {}
  };

  if (authLoading || !isAuthenticated) return null;
  if (isRelocatedTab) return null;

  const openLeaveTypeForm = (lt?: LeaveType) => {
    if (lt) {
      setEditingLeaveType(lt);
      setLtForm({
        name: lt.name,
        defaultDays: String(lt.defaultDays),
        monthlyAccrual: lt.monthlyAccrual || "0",
        minHoursForAccrual: lt.minHoursForAccrual || "128",
        description: lt.description || "",
        isActive: lt.isActive,
        isConditional: lt.isConditional ?? true,
        carryForwardCap: String(lt.carryForwardCap ?? 0),
        blockEntitlement: (lt as any).blockEntitlement ?? false,
      });
    } else {
      setEditingLeaveType(null);
      setLtForm({ name: "", defaultDays: "0", monthlyAccrual: "0", minHoursForAccrual: "128", description: "", isActive: true, isConditional: true, carryForwardCap: "0", blockEntitlement: false });
    }
    setShowLeaveType(true);
  };

  const openHolidayForm = (h?: Holiday) => {
    if (h) {
      setEditingHoliday(h);
      setHForm({ name: h.name, date: h.date, type: h.type, isOptional: h.isOptional });
    } else {
      setEditingHoliday(null);
      setHForm({ name: "", date: "", type: "public", isOptional: false });
    }
    setShowHoliday(true);
  };

  const openDeptForm = (d?: Department) => {
    if (d) {
      setEditingDepartment(d);
      setDForm({ name: d.name, description: d.description || "", isActive: d.isActive });
    } else {
      setEditingDepartment(null);
      setDForm({ name: "", description: "", isActive: true });
    }
    setShowDepartment(true);
  };

  return (
    <AdminLayout>
      {/* Dialogs — always in DOM, controlled by open prop */}
        <Dialog open={showLeaveType} onOpenChange={setShowLeaveType}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingLeaveType ? "Edit" : "Add"} Leave Type</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={ltForm.name}
                  onChange={(e) => setLtForm(prev => ({ ...prev, name: e.target.value }))}
                  data-testid="input-lt-name"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Annual Days (Max)</Label>
                  <Input
                    type="number"
                    value={ltForm.defaultDays}
                    onChange={(e) => setLtForm(prev => ({ ...prev, defaultDays: e.target.value }))}
                    data-testid="input-lt-days"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Monthly Accrual</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={ltForm.monthlyAccrual}
                    onChange={(e) => setLtForm(prev => ({ ...prev, monthlyAccrual: e.target.value }))}
                    data-testid="input-lt-monthly-accrual"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Min Hours/Month</Label>
                  <Input
                    type="number"
                    value={ltForm.minHoursForAccrual}
                    onChange={(e) => setLtForm(prev => ({ ...prev, minHoursForAccrual: e.target.value }))}
                    disabled={!ltForm.isConditional}
                    data-testid="input-lt-min-hours"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Carry-Forward Cap (days)</Label>
                  <Input
                    type="number"
                    value={ltForm.carryForwardCap}
                    onChange={(e) => setLtForm(prev => ({ ...prev, carryForwardCap: e.target.value }))}
                    placeholder="0 = no carry-forward"
                    data-testid="input-lt-carry-forward-cap"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={ltForm.description}
                  onChange={(e) => setLtForm(prev => ({ ...prev, description: e.target.value }))}
                  data-testid="input-lt-description"
                />
              </div>
              <div className="flex items-center gap-6 flex-wrap">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={ltForm.isActive}
                    onCheckedChange={(v) => setLtForm(prev => ({ ...prev, isActive: v }))}
                    data-testid="switch-lt-active"
                  />
                  <Label>Active</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={ltForm.isConditional}
                    onCheckedChange={(v) => setLtForm(prev => ({ ...prev, isConditional: v }))}
                    disabled={ltForm.blockEntitlement}
                    data-testid="switch-lt-conditional"
                  />
                  <div>
                    <Label>Conditional Accrual (EL)</Label>
                    <p className="text-xs text-muted-foreground">If enabled, requires min hours/month to qualify. Disable for unconditional leave (SL).</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={ltForm.blockEntitlement}
                    onCheckedChange={(v) => setLtForm(prev => ({
                      ...prev,
                      blockEntitlement: v,
                      ...(v ? { monthlyAccrual: "0", isConditional: false, carryForwardCap: "0" } : {}),
                    }))}
                    data-testid="switch-lt-block-entitlement"
                  />
                  <div>
                    <Label>Block Entitlement (Maternity/Paternity)</Label>
                    <p className="text-xs text-muted-foreground">Non-accruing. Granted on application up to "Annual Days (Max)" — no monthly accrual or carry-forward.</p>
                  </div>
                </div>
              </div>
              {!ltForm.isConditional && (
                <div className="p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    <strong>Legal Note:</strong> Delhi S&amp;E Act mandates minimum 12 combined casual/sick days per year. Client policy sets 8 SL days following UP/Haryana rules. Confirm with legal before deployment.
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowLeaveType(false)}>Cancel</Button>
              <Button
                onClick={() => leaveTypeMutation.mutate({
                  id: editingLeaveType?.id,
                  body: {
                    ...ltForm,
                    defaultDays: parseInt(ltForm.defaultDays),
                    monthlyAccrual: ltForm.blockEntitlement ? "0" : ltForm.monthlyAccrual,
                    minHoursForAccrual: ltForm.minHoursForAccrual,
                    carryForwardCap: ltForm.blockEntitlement ? 0 : (parseInt(ltForm.carryForwardCap) || 0),
                    isConditional: ltForm.blockEntitlement ? false : ltForm.isConditional,
                    blockEntitlement: ltForm.blockEntitlement,
                  },
                })}
                disabled={!ltForm.name || leaveTypeMutation.isPending}
                data-testid="button-save-leave-type"
              >
                {leaveTypeMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!deleteLtTarget} onOpenChange={(open) => { if (!open) { setDeleteLtTarget(null); setDeleteLtUsage(null); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete "{deleteLtTarget?.name}"</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-300">
                This leave type is in use. Deleting affects{" "}
                <strong>{deleteLtUsage?.employees ?? 0}</strong> employee(s),{" "}
                <strong>{deleteLtUsage?.balances ?? 0}</strong> balance record(s) (
                <strong>{deleteLtUsage?.remainingDays ?? 0}</strong> remaining day(s)),{" "}
                <strong>{deleteLtUsage?.requests ?? 0}</strong> request(s) and{" "}
                <strong>{deleteLtUsage?.accruals ?? 0}</strong> accrual record(s).
              </div>
              <div className="space-y-3">
                <label className="flex items-start gap-2 cursor-pointer" data-testid="radio-delete-transfer">
                  <input
                    type="radio"
                    className="mt-1"
                    checked={deleteLtMode === "transfer"}
                    onChange={() => setDeleteLtMode("transfer")}
                  />
                  <div>
                    <div className="font-medium text-sm">Transfer balances to another leave type</div>
                    <p className="text-xs text-muted-foreground">Remaining balances are merged into the chosen type; history is reassigned to it.</p>
                  </div>
                </label>
                {deleteLtMode === "transfer" && (
                  <div className="pl-6">
                    <Select value={transferTargetId} onValueChange={setTransferTargetId}>
                      <SelectTrigger data-testid="select-transfer-target">
                        <SelectValue placeholder="Select target leave type" />
                      </SelectTrigger>
                      <SelectContent>
                        {(leaveTypes || [])
                          .filter(t => t.id !== deleteLtTarget?.id && t.isActive)
                          .map(t => (
                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <label className="flex items-start gap-2 cursor-pointer" data-testid="radio-delete-expire">
                  <input
                    type="radio"
                    className="mt-1"
                    checked={deleteLtMode === "expire"}
                    onChange={() => setDeleteLtMode("expire")}
                  />
                  <div>
                    <div className="font-medium text-sm">Expire balances</div>
                    <p className="text-xs text-muted-foreground">Remaining balances and history for this type are discarded.</p>
                  </div>
                </label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setDeleteLtTarget(null); setDeleteLtUsage(null); }}>Cancel</Button>
              <Button
                variant="destructive"
                disabled={deleteLeaveTypeMutation.isPending || (deleteLtMode === "transfer" && !transferTargetId)}
                onClick={() => deleteLtTarget && deleteLeaveTypeMutation.mutate({
                  id: deleteLtTarget.id,
                  mode: deleteLtMode,
                  targetLeaveTypeId: deleteLtMode === "transfer" ? transferTargetId : undefined,
                })}
                data-testid="button-confirm-delete-leave-type"
              >
                {deleteLeaveTypeMutation.isPending ? "Deleting..." : "Delete leave type"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showDepartment} onOpenChange={setShowDepartment}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingDepartment ? "Edit" : "Add"} Department</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Department Name</Label>
                <Input
                  value={dForm.name}
                  onChange={(e) => setDForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Engineering, Healthcare, HR"
                  data-testid="input-dept-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={dForm.description}
                  onChange={(e) => setDForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of the department"
                  data-testid="input-dept-description"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={dForm.isActive}
                  onCheckedChange={(v) => setDForm(prev => ({ ...prev, isActive: v }))}
                  data-testid="switch-dept-active"
                />
                <Label>Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDepartment(false)}>Cancel</Button>
              <Button
                onClick={() => deptMutation.mutate({
                  id: editingDepartment?.id,
                  body: dForm,
                })}
                disabled={!dForm.name || deptMutation.isPending}
                data-testid="button-save-department"
              >
                {deptMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showHoliday} onOpenChange={setShowHoliday}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingHoliday ? "Edit" : "Add"} Holiday</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={hForm.name}
                  onChange={(e) => setHForm(prev => ({ ...prev, name: e.target.value }))}
                  data-testid="input-holiday-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={hForm.date}
                  onChange={(e) => setHForm(prev => ({ ...prev, date: e.target.value }))}
                  data-testid="input-holiday-date"
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={hForm.type} onValueChange={(v) => setHForm(prev => ({ ...prev, type: v }))}>
                  <SelectTrigger data-testid="select-holiday-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="national">National</SelectItem>
                    <SelectItem value="religious">Religious</SelectItem>
                    <SelectItem value="company">Company</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={hForm.isOptional}
                  onCheckedChange={(v) => setHForm(prev => ({ ...prev, isOptional: v }))}
                  data-testid="switch-holiday-optional"
                />
                <Label>Optional Holiday</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowHoliday(false)}>Cancel</Button>
              <Button
                onClick={() => holidayMutation.mutate({
                  id: editingHoliday?.id,
                  body: hForm,
                })}
                disabled={!hForm.name || !hForm.date || holidayMutation.isPending}
                data-testid="button-save-holiday"
              >
                {holidayMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showUploadHoliday} onOpenChange={setShowUploadHoliday}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Upload Holiday Calendar</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>CSV File</Label>
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  data-testid="input-upload-holiday-file"
                />
                <p className="text-xs text-muted-foreground">
                  CSV must have columns: Date, Holiday Name, Regional Holiday
                </p>
              </div>
              <div className="space-y-2">
                <Label>Year</Label>
                <Input
                  type="number"
                  value={uploadYear}
                  onChange={(e) => setUploadYear(e.target.value)}
                  data-testid="input-upload-holiday-year"
                />
              </div>
              <div className="space-y-2">
                <Label>Note</Label>
                <Textarea
                  value={uploadNote}
                  onChange={(e) => setUploadNote(e.target.value)}
                  rows={3}
                  data-testid="input-upload-holiday-note"
                />
              </div>
              <Button variant="outline" size="sm" onClick={downloadTemplate} data-testid="button-download-template">
                <Download className="h-4 w-4 mr-1" />
                Download Template
              </Button>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowUploadHoliday(false)}>Cancel</Button>
              <Button
                onClick={() => uploadHolidayMutation.mutate()}
                disabled={!uploadFile || uploadHolidayMutation.isPending}
                data-testid="button-submit-upload-holidays"
              >
                {uploadHolidayMutation.isPending ? "Uploading..." : "Upload"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      {/* Settings sub-category page: header + single row of tabs */}
      <div className="space-y-6 v2-surface">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-settings-group-title">
            <Settings className="h-5 w-5" />
            {groupDef.label}
          </h1>
          <p className="text-muted-foreground text-sm">{groupDef.description}</p>
        </div>

        {visibleItems.length > 1 && (
          <div className="inline-flex flex-wrap gap-1 rounded-lg bg-muted p-1 max-w-full" data-testid="tabs-settings-sections">
            {visibleItems.map((item) => (
              <button
                key={item.id}
                data-testid={`nav-${item.id}`}
                onClick={() => handleSectionChange(item.id)}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap",
                  activeSection === item.id
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}

        {/* Active section content */}
        <div className="space-y-6 min-w-0">

          {/* Leave Types */}
          {activeSection === "leave-types" && (
            <>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-section-leave-types">Leave Types</h1>
            <p className="text-muted-foreground text-sm">Configure leave types and run monthly accrual batches</p>
          </div>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">Leave Types</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={() => accrualMutation.mutate({})}
                disabled={accrualMutation.isPending}
                data-testid="button-run-accrual"
              >
                {accrualMutation.isPending ? "Running..." : "Run Monthly Accrual"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => yearEndMutation.mutate({ year: new Date().getFullYear() - 1 })}
                disabled={yearEndMutation.isPending}
                data-testid="button-run-year-end"
              >
                {yearEndMutation.isPending ? "Running..." : "Run Year-End Batch"}
              </Button>
              <Button size="sm" onClick={() => openLeaveTypeForm()} data-testid="button-add-leave-type">
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {ltLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : leaveTypes && leaveTypes.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Name</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Annual Days</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Monthly Accrual</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Type</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Carry Fwd Cap</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaveTypes.filter(lt => lt.isActive).map((lt) => (
                      <tr key={lt.id} className="border-b last:border-0" data-testid={`leave-type-row-${lt.id}`}>
                        <td className="py-2 px-2 font-medium">{lt.name}</td>
                        <td className="py-2 px-2">{lt.defaultDays}</td>
                        <td className="py-2 px-2">{parseFloat(lt.monthlyAccrual || "0")}/month</td>
                        <td className="py-2 px-2">
                          {(lt as any).blockEntitlement ? (
                            <Badge variant="outline" className="text-xs">Block Entitlement</Badge>
                          ) : (
                            <Badge variant={lt.isConditional ? "default" : "secondary"} className="text-xs">
                              {lt.isConditional ? "Conditional (EL)" : "Unconditional (SL)"}
                            </Badge>
                          )}
                        </td>
                        <td className="py-2 px-2 text-muted-foreground">
                          {(lt.carryForwardCap ?? 0) > 0 ? `${lt.carryForwardCap} days` : "None"}
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openLeaveTypeForm(lt)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {user?.role === "super_admin" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => startDeleteLeaveType(lt)}
                                data-testid={`button-delete-leave-type-${lt.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No leave types configured</p>
            )}
          </CardContent>
        </Card>
        {isHrOrAbove && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Accrual Run Log</CardTitle>
            </CardHeader>
            <CardContent>
              {accrualLogLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : accrualLog ? (
                <div className="space-y-4">
                  {accrualLog.latest && (
                    <div className="p-3 rounded-md border bg-muted/30">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Latest Accrual Run</p>
                      <div className="flex flex-wrap gap-4 text-sm">
                        <span><strong>{accrualLog.latest.month}/{accrualLog.latest.year}</strong></span>
                        <span className="text-green-700 dark:text-green-400">{accrualLog.latest.accrualsMade} accruals made</span>
                        <span>{accrualLog.latest.usersProcessed} users processed</span>
                        {accrualLog.latest.skippedCount > 0 && (
                          <span className="text-red-600 dark:text-red-400">{accrualLog.latest.skippedCount} skipped</span>
                        )}
                        <span className="text-muted-foreground">{new Date(accrualLog.latest.runAt).toLocaleString()}</span>
                      </div>
                      {accrualLog.latest.skippedUsers && accrualLog.latest.skippedUsers.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs text-muted-foreground font-medium mb-1">Skipped employees:</p>
                          <div className="max-h-32 overflow-y-auto space-y-0.5">
                            {accrualLog.latest.skippedUsers.map((s: { name: string; leaveTypeName: string; reason: string }, i: number) => (
                              <div key={i} className="text-xs text-muted-foreground flex gap-2" data-testid={`skipped-user-${i}`}>
                                <span className="font-medium text-foreground">{s.name}</span>
                                <span>— {s.leaveTypeName}: {s.reason}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {accrualLog.history && accrualLog.history.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Run History</p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2 px-2 font-medium text-muted-foreground">Period</th>
                              <th className="text-left py-2 px-2 font-medium text-muted-foreground">Processed</th>
                              <th className="text-left py-2 px-2 font-medium text-muted-foreground">Accruals</th>
                              <th className="text-left py-2 px-2 font-medium text-muted-foreground">Skipped</th>
                              <th className="text-left py-2 px-2 font-medium text-muted-foreground">Run At</th>
                            </tr>
                          </thead>
                          <tbody>
                            {accrualLog.history.map((h: { month: number; year: number; usersProcessed: number; accrualsMade: number; skippedCount: number; runAt: string }, i: number) => (
                              <tr key={i} className="border-b last:border-0" data-testid={`accrual-history-row-${i}`}>
                                <td className="py-1.5 px-2">{h.month}/{h.year}</td>
                                <td className="py-1.5 px-2">{h.usersProcessed}</td>
                                <td className="py-1.5 px-2 text-green-700 dark:text-green-400">{h.accrualsMade}</td>
                                <td className="py-1.5 px-2 text-red-600 dark:text-red-400">{h.skippedCount}</td>
                                <td className="py-1.5 px-2 text-muted-foreground">{new Date(h.runAt).toLocaleDateString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  {/* Year-end cap events: EL carry-forward truncations where excess was forfeited */}
                  {accrualLog.yearEndLog && accrualLog.yearEndLog.length > 0 && accrualLog.yearEndLog.some((ye: any) => ye.capEvents && ye.capEvents.length > 0) && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">EL Cap Events (Year-End)</p>
                      <div className="space-y-2">
                        {accrualLog.yearEndLog.filter((ye: any) => ye.capEvents && ye.capEvents.length > 0).map((ye: { year: number; runAt: string; capEvents: Array<{ name: string; leaveTypeName: string; remaining: number; cap: number; forfeited: number }> }, yi: number) => (
                          <div key={yi} className="p-2 rounded border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
                            <p className="text-xs font-medium text-amber-800 dark:text-amber-400 mb-1">
                              Year-end {ye.year} — {ye.capEvents.length} employee(s) had EL capped at carry-forward limit
                            </p>
                            <div className="max-h-28 overflow-y-auto space-y-0.5">
                              {ye.capEvents.map((ev, ei: number) => (
                                <div key={ei} className="text-xs text-amber-700 dark:text-amber-300 flex gap-2" data-testid={`cap-event-${yi}-${ei}`}>
                                  <span className="font-medium">{ev.name}</span>
                                  <span>— {ev.leaveTypeName}: had {ev.remaining.toFixed(1)} days, capped at {ev.cap}, forfeited {ev.forfeited.toFixed(1)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {!accrualLog.latest && (!accrualLog.history || accrualLog.history.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-4">No accrual runs recorded yet. Click "Run Monthly Accrual" to start.</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No accrual log available.</p>
              )}
            </CardContent>
          </Card>
          )}
          </>
          )}

          {/* Holidays */}
          {activeSection === "holidays" && (
            <>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-section-holidays">Holidays</h1>
            <p className="text-muted-foreground text-sm">Manage the company holiday calendar</p>
          </div>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">Holidays ({new Date().getFullYear()})</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={() => setShowUploadHoliday(true)} data-testid="button-upload-holidays">
                <Upload className="h-4 w-4 mr-1" />
                Upload CSV
              </Button>
              <Button size="sm" onClick={() => openHolidayForm()} data-testid="button-add-holiday">
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {hLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : holidays && holidays.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Date</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Holiday Name</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Regional Holiday</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {holidays.map((h) => (
                      <tr key={h.id} className="border-b last:border-0" data-testid={`holiday-row-${h.id}`}>
                        <td className="py-2 px-2">{h.date}</td>
                        <td className="py-2 px-2 font-medium">{h.type !== "regional" ? h.name : ""}</td>
                        <td className="py-2 px-2">{h.type === "regional" || h.isOptional ? h.name : ""}</td>
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openHolidayForm(h)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteHolidayMutation.mutate(h.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-4">
                <CalendarDays className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No holidays configured</p>
              </div>
            )}
            <div className="mt-4 p-3 rounded-md border border-dashed flex items-start gap-2" data-testid="text-holiday-note">
              <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-sm text-muted-foreground font-medium">
                Note : Employee's can apply any two regional holidays without any loss of pay for india office. US Holidays are mandatory for US Client Team.
              </p>
            </div>
          </CardContent>
        </Card>
            </>
          )}

          {/* Attendance Policy */}
          {activeSection === "attendance-policy" && (
            <>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-section-attendance-policy">Attendance Policy</h1>
            <p className="text-muted-foreground text-sm">Configure regularisation and attendance rules</p>
          </div>
              <RegularizationPolicySection />
              <AttendanceExceptionThresholdsSection />
            </>
          )}

          {/* Salary Advance Policy */}
          {activeSection === "salary-advance-policy" && salaryAdvanceEnabled && (
            <>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-section-salary-advance-policy">Salary Advance Policy</h1>
            <p className="text-muted-foreground text-sm">Configure caps, repayment limits, and eligibility for salary advance requests</p>
          </div>
              <SalaryAdvancePolicySection />
            </>
          )}

          {/* Shifts */}
          {activeSection === "shifts" && (
            <>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-section-shifts">Shifts</h1>
            <p className="text-muted-foreground text-sm">Manage work shifts and schedules</p>
          </div>
              <ShiftsSection />
            </>
          )}

          {/* Departments */}
          {activeSection === "departments" && (
            <>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-section-departments">Departments</h1>
            <p className="text-muted-foreground text-sm">Manage company departments</p>
          </div>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">Departments</CardTitle>
            <Button size="sm" onClick={() => openDeptForm()} data-testid="button-add-department">
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </CardHeader>
          <CardContent>
            {deptLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : deptList && deptList.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Name</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Description</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Status</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deptList.map((d) => (
                      <tr key={d.id} className="border-b last:border-0" data-testid={`dept-row-${d.id}`}>
                        <td className="py-2 px-2 font-medium">{d.name}</td>
                        <td className="py-2 px-2 text-muted-foreground max-w-[200px] truncate">{d.description || "-"}</td>
                        <td className="py-2 px-2">
                          <Badge variant={d.isActive ? "default" : "secondary"}>
                            {d.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openDeptForm(d)} data-testid={`button-edit-dept-${d.id}`}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {user?.role === "super_admin" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteDeptMutation.mutate(d.id)}
                                data-testid={`button-delete-dept-${d.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-4">
                <Building2 className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No departments configured</p>
              </div>
            )}
          </CardContent>
        </Card>
            </>
          )}

          {activeSection === "company-profile" && (
            <>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-section-company-profile">Company Profile</h1>
            <p className="text-muted-foreground text-sm">Manage company identity and branding</p>
          </div>
              <CompanyProfileSection />
            </>
          )}

          {activeSection === "salary-structures" && (
            <SalaryStructuresSection />
          )}

          {activeSection === "state-registrations" && (
            <StateRegistrationsSection />
          )}

          {activeSection === "coverage" && (
            <CoverageSection />
          )}

        </div>
      </div>
    </AdminLayout>
  );
}

export function AllowedDomainsSection() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";

  const { data, isLoading } = useQuery<{ domains: string[] }>({
    queryKey: ["/api/system/allowed-domains"],
    enabled: isSuperAdmin,
  });

  const [editing, setEditing] = useState(false);
  const [domains, setDomains] = useState<string[]>([]);
  const [newDomain, setNewDomain] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);

  useEffect(() => {
    if (data?.domains) {
      setDomains(data.domains);
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (nextDomains: string[]) => {
      const res = await apiRequest("PATCH", "/api/system/allowed-domains", { domains: nextDomains });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/system/allowed-domains"] });
      toast({ title: "Allowed domains updated" });
      setEditing(false);
    },
    onError: () => toast({ title: "Failed to update allowed domains", variant: "destructive" }),
  });

  const handleAddDomain = () => {
    const trimmed = newDomain.trim().toLowerCase();
    if (!trimmed) {
      setInputError("Domain cannot be empty");
      return;
    }
    if (trimmed.includes("@")) {
      setInputError("Enter the domain without the @ symbol (e.g. hire-in.com)");
      return;
    }
    if (trimmed.includes(" ")) {
      setInputError("Domain cannot contain spaces");
      return;
    }
    if (!trimmed.includes(".")) {
      setInputError("Enter a valid domain (e.g. hire-in.com)");
      return;
    }
    if (domains.includes(trimmed)) {
      setInputError("This domain is already in the list");
      return;
    }
    setInputError(null);
    setDomains((prev) => [...prev, trimmed]);
    setNewDomain("");
  };

  const handleRemoveDomain = (domain: string) => {
    setDomains((prev) => prev.filter((d) => d !== domain));
  };

  const handleCancel = () => {
    setDomains(data?.domains ?? []);
    setNewDomain("");
    setInputError(null);
    setEditing(false);
  };

  if (!isSuperAdmin) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" />
          Allowed Email Domains
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Only email addresses from these domains can log in or be registered as admin users. Changes take effect immediately — no restart required.
        </p>

        {isLoading ? (
          <div className="flex gap-2">
            <div className="h-6 w-24 rounded-full bg-muted animate-pulse" />
            <div className="h-6 w-32 rounded-full bg-muted animate-pulse" />
          </div>
        ) : (
          <div className="flex flex-wrap gap-2" data-testid="list-allowed-domains">
            {domains.map((domain) => (
              <span
                key={domain}
                className="inline-flex items-center gap-1.5 rounded-full border bg-muted px-3 py-1 text-sm font-medium"
                data-testid={`chip-domain-${domain}`}
              >
                @{domain}
                {editing && domains.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveDomain(domain)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    data-testid={`button-remove-domain-${domain}`}
                    aria-label={`Remove ${domain}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
        )}

        {editing && (
          <div className="space-y-2">
            <div className="flex gap-2 max-w-sm">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm select-none">@</span>
                <Input
                  className="pl-7"
                  placeholder="example.com"
                  value={newDomain}
                  onChange={(e) => {
                    setNewDomain(e.target.value);
                    setInputError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddDomain();
                    }
                  }}
                  data-testid="input-new-domain"
                />
              </div>
              <Button type="button" variant="outline" size="sm" onClick={handleAddDomain} data-testid="button-add-domain">
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
            {inputError && <p className="text-xs text-destructive" data-testid="text-domain-error">{inputError}</p>}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          {!editing ? (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)} data-testid="button-edit-domains">
              <Pencil className="h-4 w-4 mr-1" />
              Edit domains
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                onClick={() => saveMutation.mutate(domains)}
                disabled={saveMutation.isPending || domains.length === 0}
                data-testid="button-save-domains"
              >
                {saveMutation.isPending ? "Saving..." : "Save"}
              </Button>
              <Button size="sm" variant="outline" onClick={handleCancel} disabled={saveMutation.isPending} data-testid="button-cancel-domains">
                Cancel
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
