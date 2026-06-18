import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Settings, Plus, Pencil, Trash2, CalendarDays, Building2, Upload, Download, Info, Scale, Users, CheckSquare, FileText, ChevronDown, ChevronUp, Shield } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { DEFAULT_COMPANY_PROFILE, type CompanyProfile } from "@shared/companyProfile";
import { OFFER_CLAUSE_CATEGORY, ADDENDUM_CLAUSE_CATEGORY, PERFORMANCE_CLAUSE_CATEGORY_LABELS } from "@shared/performanceClauses";

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

function TrainingSettingsSection() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isHrOrAbove = ["super_admin", "admin", "hr"].includes(user?.role || "");

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

function RegularizationPolicySection() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isHrOrAbove = ["super_admin", "admin", "hr"].includes(user?.role || "");
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

function PerformanceSettingsSection() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isHrOrAbove = ["super_admin", "admin", "hr"].includes(user?.role || "");

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

function RayoAcademySettingsSection() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isHrOrAbove = ["super_admin", "admin", "hr"].includes(user?.role || "");
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

interface AnnouncementBlock {
  icon: string;
  title: string;
  body: string;
  cta_label: string;
  cta_path: string;
}

interface AnnouncementContent {
  title: string;
  subtitle: string;
  blocks: AnnouncementBlock[];
}

interface AnnouncementAdminData {
  version: string;
  content: AnnouncementContent | null;
  lastSent: { sentAt: string; recipientCount: number; failedCount: number } | null;
}

const ICON_OPTIONS = ["star", "message", "clock", "bell", "heart", "award"];

function CommunicationsSection() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isHr = ["super_admin", "admin", "hr"].includes(user?.role || "");

  const defaultContent: AnnouncementContent = {
    title: "What's new at Hire'in",
    subtitle: "Three updates made just for you",
    blocks: [
      { icon: "star", title: "", body: "", cta_label: "", cta_path: "" },
    ],
  };

  const [form, setForm] = useState<AnnouncementContent>(defaultContent);
  const [version, setVersion] = useState("");
  const [confirmSend, setConfirmSend] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [recipientCount, setRecipientCount] = useState<number | null>(null);

  const { data: announcementData, isLoading } = useQuery<AnnouncementAdminData>({
    queryKey: ["/api/admin/announcements"],
    enabled: isHr,
  });

  const { data: recipientData } = useQuery<{ count: number }>({
    queryKey: ["/api/admin/announcements/recipient-count"],
    enabled: isHr,
  });

  useEffect(() => {
    if (announcementData) {
      setVersion(announcementData.version || "2024-06");
      if (announcementData.content) {
        setForm(announcementData.content);
      }
    }
  }, [announcementData]);

  useEffect(() => {
    if (recipientData) setRecipientCount(recipientData.count);
  }, [recipientData]);

  const saveMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", "/api/admin/announcements", { content: form }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/announcements"] });
      toast({ title: "Content saved", description: "Announcement content updated." });
    },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  const publishMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", "/api/admin/announcements", { version, content: form }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/announcements"] });
      setConfirmPublish(false);
      toast({ title: "Published", description: "Version updated — all employees will see the modal on next login." });
    },
    onError: () => toast({ title: "Failed to publish", variant: "destructive" }),
  });

  const sendEmailMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/announcements/send-email");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/announcements"] });
      setConfirmSend(false);
      toast({ title: "Email blast sent", description: `Sent to ${data.sent} recipients${data.failed > 0 ? `, ${data.failed} failed` : ""}.` });
    },
    onError: (err: any) => {
      setConfirmSend(false);
      toast({ title: "Failed to send", description: err.message || "Check that notifications are enabled.", variant: "destructive" });
    },
  });

  const updateBlock = (idx: number, field: keyof AnnouncementBlock, value: string) => {
    setForm(prev => ({
      ...prev,
      blocks: prev.blocks.map((b, i) => i === idx ? { ...b, [field]: value } : b),
    }));
  };

  const addBlock = () => {
    if (form.blocks.length >= 5) return;
    setForm(prev => ({
      ...prev,
      blocks: [...prev.blocks, { icon: "star", title: "", body: "", cta_label: "", cta_path: "" }],
    }));
  };

  const removeBlock = (idx: number) => {
    setForm(prev => ({
      ...prev,
      blocks: prev.blocks.filter((_, i) => i !== idx),
    }));
  };

  if (!isHr) return null;
  if (isLoading) return null;

  const lastSent = announcementData?.lastSent;

  return (
    <Card data-testid="card-communications-section">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Settings className="h-4 w-4" />
          What's New — Announcement System
        </CardTitle>
        <div className="flex flex-wrap gap-4 mt-2 text-xs text-muted-foreground">
          <span>Current version: <strong className="text-foreground">{announcementData?.version || "—"}</strong></span>
          {lastSent && (
            <span>
              Last emailed: <strong className="text-foreground">
                {new Date(lastSent.sentAt).toLocaleDateString()} — {lastSent.recipientCount} recipients
              </strong>
            </span>
          )}
          {recipientCount !== null && (
            <span>Eligible recipients: <strong className="text-foreground">{recipientCount}</strong></span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Version string</Label>
              <Input
                value={version}
                onChange={e => setVersion(e.target.value)}
                placeholder="e.g. 2024-06"
                data-testid="input-announcement-version"
              />
              <p className="text-xs text-muted-foreground">Changing version re-triggers modal for all users</p>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Modal title</Label>
            <Input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="What's new at Hire'in"
              data-testid="input-announcement-title"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Subtitle</Label>
            <Input
              value={form.subtitle}
              onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))}
              placeholder="Three updates made just for you"
              data-testid="input-announcement-subtitle"
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Feature blocks ({form.blocks.length}/5)</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={addBlock}
              disabled={form.blocks.length >= 5}
              data-testid="button-add-block"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add block
            </Button>
          </div>

          {form.blocks.map((block, idx) => (
            <div key={idx} className="border rounded-lg p-4 space-y-3 bg-muted/30" data-testid={`block-editor-${idx}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Block {idx + 1}</span>
                {form.blocks.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeBlock(idx)}
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    data-testid={`button-remove-block-${idx}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Icon</Label>
                  <Select value={block.icon} onValueChange={v => updateBlock(idx, "icon", v)}>
                    <SelectTrigger data-testid={`select-block-icon-${idx}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ICON_OPTIONS.map(ic => (
                        <SelectItem key={ic} value={ic}>{ic}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Title</Label>
                  <Input
                    value={block.title}
                    onChange={e => updateBlock(idx, "title", e.target.value)}
                    placeholder="Feature name"
                    data-testid={`input-block-title-${idx}`}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Body text</Label>
                <Textarea
                  value={block.body}
                  onChange={e => updateBlock(idx, "body", e.target.value)}
                  placeholder="Describe the feature in 1–2 sentences"
                  rows={2}
                  data-testid={`textarea-block-body-${idx}`}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">CTA label</Label>
                  <Input
                    value={block.cta_label}
                    onChange={e => updateBlock(idx, "cta_label", e.target.value)}
                    placeholder="Try it now"
                    data-testid={`input-block-cta-label-${idx}`}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">CTA path</Label>
                  <Input
                    value={block.cta_path}
                    onChange={e => updateBlock(idx, "cta_path", e.target.value)}
                    placeholder="/admin/praise"
                    data-testid={`input-block-cta-path-${idx}`}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t">
          <Button
            variant="outline"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            data-testid="button-save-announcement-content"
          >
            {saveMutation.isPending ? "Saving..." : "Save content"}
          </Button>
          <Button
            onClick={() => setConfirmPublish(true)}
            disabled={publishMutation.isPending}
            data-testid="button-publish-announcement"
          >
            Publish to all employees
          </Button>
          <Button
            variant="secondary"
            onClick={() => setConfirmSend(true)}
            disabled={sendEmailMutation.isPending}
            data-testid="button-send-announcement-email"
          >
            Send email blast
          </Button>
        </div>
      </CardContent>

      <Dialog open={confirmPublish} onOpenChange={setConfirmPublish}>
        <DialogContent data-testid="dialog-confirm-publish">
          <DialogHeader>
            <DialogTitle>Publish announcement?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will save the content and set version to <strong>{version}</strong>.
            All employees and managers will see the "What's New" modal on their next login.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmPublish(false)}>Cancel</Button>
            <Button
              onClick={() => publishMutation.mutate()}
              disabled={publishMutation.isPending}
              data-testid="button-confirm-publish"
            >
              {publishMutation.isPending ? "Publishing..." : "Yes, publish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmSend} onOpenChange={setConfirmSend}>
        <DialogContent data-testid="dialog-confirm-send-email">
          <DialogHeader>
            <DialogTitle>Send email blast?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will send the current announcement email to{" "}
            <strong>{recipientCount ?? "all"} eligible employees</strong>.
            Make sure you have saved your content first and that the Notifications feature flag is enabled.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSend(false)}>Cancel</Button>
            <Button
              onClick={() => sendEmailMutation.mutate()}
              disabled={sendEmailMutation.isPending}
              data-testid="button-confirm-send-email"
            >
              {sendEmailMutation.isPending ? "Sending..." : "Yes, send emails"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function FeatureFlagsSection() {
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
            <div key={def.key} className="flex items-center justify-between gap-4 py-1">
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
          );
        })}
      </CardContent>
    </Card>
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

interface LetterTemplateSentence {
  id: string;
  key: string;
  category: string;
  label: string;
  sentence: string;
  sortOrder: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  performance_band: "Performance Band Sentences",
  conduct_band: "Conduct Band Sentences",
  completion_band: "Completion Band Phrases",
  closing_line: "Closing Line Sentences",
  ...PERFORMANCE_CLAUSE_CATEGORY_LABELS,
};

const CLAUSE_DOWNLOAD_CATEGORIES = [OFFER_CLAUSE_CATEGORY, ADDENDUM_CLAUSE_CATEGORY];

function LetterTemplatesSection() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = ["super_admin", "admin"].includes(user?.role || "");
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<string, string>>({});

  const { data: sentences = [], isLoading } = useQuery<LetterTemplateSentence[]>({
    queryKey: ["/api/hr/letter-templates/sentences"],
    queryFn: async () => {
      const res = await fetch("/api/hr/letter-templates/sentences", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAdmin,
    staleTime: 30000,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, sentence }: { id: string; sentence: string }) => {
      const res = await apiRequest("PATCH", `/api/hr/letter-templates/sentences/${id}`, { sentence });
      return res.json();
    },
    onMutate: async ({ id, sentence }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/hr/letter-templates/sentences"] });
      const previous = queryClient.getQueryData<LetterTemplateSentence[]>(["/api/hr/letter-templates/sentences"]);
      if (previous) {
        queryClient.setQueryData<LetterTemplateSentence[]>(
          ["/api/hr/letter-templates/sentences"],
          previous.map(s => s.id === id ? { ...s, sentence } : s),
        );
      }
      return { previous };
    },
    onSuccess: (updated, _vars, context) => {
      queryClient.setQueryData<LetterTemplateSentence[]>(
        ["/api/hr/letter-templates/sentences"],
        (old) => old ? old.map(s => s.id === updated.id ? updated : s) : old,
      );
      setEditing(prev => {
        const next = { ...prev };
        delete next[updated.id];
        return next;
      });
      toast({ title: "Sentence updated", description: "The template sentence has been updated." });
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["/api/hr/letter-templates/sentences"], context.previous);
      }
      toast({ title: "Failed to update sentence", variant: "destructive" });
    },
  });

  if (!isAdmin) return null;

  const grouped = sentences.reduce<Record<string, LetterTemplateSentence[]>>((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {});

  const categories = ["performance_band", "conduct_band", "completion_band", "closing_line", OFFER_CLAUSE_CATEGORY, ADDENDUM_CLAUSE_CATEGORY];

  const handleDownloadClause = async (id: string, label: string) => {
    try {
      const res = await fetch(`/api/hr/letter-templates/sentences/${id}/download`, { credentials: "include" });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${label.replace(/[^a-z0-9]+/gi, "_")}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast({ title: "Failed to download clause", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Letter Template Sentences
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Customize the sentences used in generated HR letters. Changes take effect immediately for new letters — no redeployment needed.
        </p>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
          <div className="space-y-2">
            {categories.map((cat) => {
              const items = grouped[cat] || [];
              const isExpanded = expandedCategory === cat;
              return (
                <div key={cat} className="border rounded-md overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between p-3 bg-muted/40 hover:bg-muted/70 transition-colors text-left"
                    onClick={() => setExpandedCategory(isExpanded ? null : cat)}
                    data-testid={`btn-expand-category-${cat}`}
                  >
                    <span className="font-medium text-sm">{CATEGORY_LABELS[cat] || cat}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{items.length} sentences</span>
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="p-3 space-y-4 border-t">
                      {items.map((sentence) => {
                        const isEditing = editing[sentence.id] !== undefined;
                        const currentValue = isEditing ? editing[sentence.id] : sentence.sentence;
                        return (
                          <div key={sentence.id} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs font-semibold">{sentence.label}</Label>
                              {!isEditing ? (
                                <div className="flex gap-2">
                                  {CLAUSE_DOWNLOAD_CATEGORIES.includes(sentence.category) && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleDownloadClause(sentence.id, sentence.label)}
                                      data-testid={`btn-download-clause-${sentence.id}`}
                                    >
                                      <Download className="h-3 w-3 mr-1" />DOCX
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setEditing(prev => ({ ...prev, [sentence.id]: sentence.sentence }))}
                                    data-testid={`btn-edit-sentence-${sentence.id}`}
                                  >
                                    <Pencil className="h-3 w-3 mr-1" />Edit
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => updateMutation.mutate({ id: sentence.id, sentence: currentValue })}
                                    disabled={updateMutation.isPending || !currentValue.trim()}
                                    data-testid={`btn-save-sentence-${sentence.id}`}
                                  >
                                    {updateMutation.isPending ? "Saving..." : "Save"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setEditing(prev => { const n = { ...prev }; delete n[sentence.id]; return n; })}
                                    data-testid={`btn-cancel-sentence-${sentence.id}`}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              )}
                            </div>
                            {isEditing ? (
                              <Textarea
                                value={currentValue}
                                onChange={(e) => setEditing(prev => ({ ...prev, [sentence.id]: e.target.value }))}
                                rows={3}
                                className="text-sm"
                                data-testid={`textarea-sentence-${sentence.id}`}
                              />
                            ) : (
                              <p className="text-sm text-muted-foreground bg-muted/30 rounded p-2 leading-relaxed" data-testid={`text-sentence-${sentence.id}`}>
                                {sentence.sentence}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
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

function DataMaintenanceSection() {
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

  if (user?.role !== "super_admin") return null;

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
};

function GoalTemplatesSection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isHrOrAbove = ["super_admin", "admin", "hr"].includes(user?.role || "");
  const [filterPlanType, setFilterPlanType] = useState("probation");
  const [filterRole, setFilterRole] = useState("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<PlanGoalTemplate>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    plan_type: "probation", role_slug: "associate_recruiter",
    goal_title: "", goal_category: "individual",
    goal_description: "", target_metric: "", sort_order: "0",
  });

  const { data: templates = [], isLoading, refetch } = useQuery<PlanGoalTemplate[]>({
    queryKey: ["/api/hr/plan-templates-all"],
    queryFn: async () => {
      const res = await fetch("/api/hr/plan-templates?active_only=false", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isHrOrAbove,
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; body: Partial<PlanGoalTemplate> }) =>
      apiRequest("PATCH", `/api/hr/plan-templates/${data.id}`, data.body),
    onSuccess: () => { refetch(); setEditingId(null); toast({ title: "Template updated" }); },
    onError: () => toast({ title: "Update failed", variant: "destructive" }),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof addForm) => apiRequest("POST", "/api/hr/plan-templates", {
      ...data, sort_order: parseInt(data.sort_order, 10),
    }),
    onSuccess: () => {
      refetch();
      setShowAdd(false);
      setAddForm({ plan_type: "probation", role_slug: "associate_recruiter", goal_title: "", goal_category: "individual", goal_description: "", target_metric: "", sort_order: "0" });
      toast({ title: "Template created" });
    },
    onError: () => toast({ title: "Create failed", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/hr/plan-templates/${id}`),
    onSuccess: () => { refetch(); toast({ title: "Template deleted" }); },
    onError: () => toast({ title: "Delete failed", variant: "destructive" }),
  });

  if (!isHrOrAbove) return null;

  const filtered = templates.filter(t =>
    (filterPlanType === "all" || t.plan_type === filterPlanType) &&
    (filterRole === "all" || t.role_slug === filterRole)
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
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Healthcare Goal Templates
          </CardTitle>
          <Button size="sm" onClick={() => setShowAdd(true)} data-testid="button-add-goal-template">
            <Plus className="h-4 w-4 mr-1" /> Add Template
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Predefined goal templates loaded into annexures when creating Probation, Growth, or PIP plans for Healthcare team members.
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
              <SelectTrigger className="h-8 w-40 text-xs" data-testid="select-filter-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="associate_recruiter">Associate Recruiter</SelectItem>
                <SelectItem value="senior_recruiter">Senior Recruiter</SelectItem>
                <SelectItem value="lead_recruiter">Lead Recruiter</SelectItem>
                <SelectItem value="associate_manager">Associate Manager</SelectItem>
                <SelectItem value="account_manager">Account Manager</SelectItem>
                <SelectItem value="foundation_to_senior">Foundation → Senior Recruiter</SelectItem>
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
                        <td className="py-2 px-2" colSpan={5}>
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
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                value={String(editForm.sort_order ?? 0)}
                                onChange={e => setEditForm(prev => ({ ...prev, sort_order: parseInt(e.target.value, 10) }))}
                                placeholder="Order"
                                className="h-7 text-xs w-16"
                                data-testid={`input-edit-order-${t.id}`}
                              />
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
                          </div>
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
                          <Switch
                            checked={t.is_active}
                            onCheckedChange={v => updateMutation.mutate({ id: t.id, body: { is_active: v } })}
                            data-testid={`switch-template-active-${t.id}`}
                          />
                        </td>
                        <td className="py-2 px-2">
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
                <Label className="text-xs">Role</Label>
                <Select value={addForm.role_slug} onValueChange={v => setAddForm(prev => ({ ...prev, role_slug: v }))}>
                  <SelectTrigger className="h-8 text-xs" data-testid="select-add-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="associate_recruiter">Associate Recruiter</SelectItem>
                    <SelectItem value="senior_recruiter">Senior Recruiter</SelectItem>
                    <SelectItem value="lead_recruiter">Lead Recruiter</SelectItem>
                    <SelectItem value="associate_manager">Associate Manager</SelectItem>
                    <SelectItem value="account_manager">Account Manager</SelectItem>
                    <SelectItem value="foundation_to_senior">Foundation → Senior Recruiter</SelectItem>
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
      </CardContent>
    </Card>
  );
}

function ShiftsSection() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isHrOrAbove = ["super_admin", "admin", "hr"].includes(user?.role || "");
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

function AccessControlSection() {
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

export default function HRSettings() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { toast } = useToast();

  const [showLeaveType, setShowLeaveType] = useState(false);
  const [editingLeaveType, setEditingLeaveType] = useState<LeaveType | null>(null);
  const [ltForm, setLtForm] = useState({ name: "", defaultDays: "0", monthlyAccrual: "0", minHoursForAccrual: "128", description: "", isActive: true, isConditional: true, carryForwardCap: "0" });

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

  const [showAdjustment, setShowAdjustment] = useState(false);
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [adjForm, setAdjForm] = useState({ userId: "", leaveTypeId: "", adjustmentDays: "", reason: "", year: String(new Date().getFullYear()) });
  const [adjHistoryYear, setAdjHistoryYear] = useState(String(new Date().getFullYear()));

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
    mutationFn: (id: string) => apiRequest("DELETE", `/api/hr/leave-types/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/leave-types"] });
      toast({ title: "Deleted", description: "Leave type deleted." });
    },
  });

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

  interface AdminUser {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    isActive: boolean;
  }

  interface LeaveAdjustment {
    id: string;
    userId: string;
    leaveTypeId: string;
    adjustmentDays: string;
    reason: string;
    year: number;
    adjustedBy: string;
    createdAt: string;
    userName: string;
    leaveTypeName: string;
    adjustedByName: string;
  }

  const isHrOrAbove = user?.role === "super_admin" || user?.role === "admin" || user?.role === "hr";

  const { data: allUsersResponse } = useQuery<{ users: AdminUser[]; counts: { active: number; disabled: number; deleted: number } }>({
    queryKey: ["/api/admin/users"],
    enabled: isAuthenticated && isHrOrAbove,
    retry: 2,
    staleTime: 30000,
  });
  const allUsers = allUsersResponse?.users;

  const { data: adjustmentHistory, isLoading: adjHistLoading } = useQuery<LeaveAdjustment[]>({
    queryKey: ["/api/hr/leave-adjustments", adjHistoryYear],
    enabled: isAuthenticated && isHrOrAbove,
    queryFn: async () => {
      const res = await fetch(`/api/hr/leave-adjustments?year=${adjHistoryYear}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const adjustMutation = useMutation({
    mutationFn: (data: { userId: string; leaveTypeId: string; adjustmentDays: number; reason: string; year: number }) =>
      apiRequest("POST", "/api/hr/leave-balances/adjust", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/leave-adjustments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/leave-balances"] });
      setShowAdjustment(false);
      setAdjForm({ userId: "", leaveTypeId: "", adjustmentDays: "", reason: "", year: String(new Date().getFullYear()) });
      toast({ title: "Adjusted", description: "Leave balance adjusted successfully." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to adjust balance", variant: "destructive" });
    },
  });

  const bulkAdjustMutation = useMutation({
    mutationFn: (data: { userIds: string[]; leaveTypeId: string; adjustmentDays: number; reason: string; year: number }) =>
      apiRequest("POST", "/api/hr/leave-balances/bulk-adjust", data),
    onSuccess: async (res) => {
      const result = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/hr/leave-adjustments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/leave-balances"] });
      setShowAdjustment(false);
      setSelectedUserIds([]);
      setAdjForm({ userId: "", leaveTypeId: "", adjustmentDays: "", reason: "", year: String(new Date().getFullYear()) });
      toast({ title: "Bulk Adjusted", description: result.message || `Adjusted ${result.successCount} employees.` });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to bulk adjust balances", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/admin/login");
  }, [authLoading, isAuthenticated, setLocation]);

  if (authLoading || !isAuthenticated) return null;

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
      });
    } else {
      setEditingLeaveType(null);
      setLtForm({ name: "", defaultDays: "0", monthlyAccrual: "0", minHoursForAccrual: "128", description: "", isActive: true, isConditional: true, carryForwardCap: "0" });
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
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-hr-settings-title">HR Settings</h1>
          <p className="text-muted-foreground">Manage leave types, holidays, and company policies</p>
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
                          <Badge variant={lt.isConditional ? "default" : "secondary"} className="text-xs">
                            {lt.isConditional ? "Conditional (EL)" : "Unconditional (SL)"}
                          </Badge>
                        </td>
                        <td className="py-2 px-2 text-muted-foreground">
                          {(lt.carryForwardCap ?? 0) > 0 ? `${lt.carryForwardCap} days` : "None"}
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openLeaveTypeForm(lt)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteLeaveTypeMutation.mutate(lt.id)}
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

        <ShiftsSection />

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
                    data-testid="switch-lt-conditional"
                  />
                  <div>
                    <Label>Conditional Accrual (EL)</Label>
                    <p className="text-xs text-muted-foreground">If enabled, requires min hours/month to qualify. Disable for unconditional leave (SL).</p>
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
                    monthlyAccrual: ltForm.monthlyAccrual,
                    minHoursForAccrual: ltForm.minHoursForAccrual,
                    carryForwardCap: parseInt(ltForm.carryForwardCap) || 0,
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

        {isHrOrAbove && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base">Balance Adjustments</CardTitle>
              <Button size="sm" onClick={() => { setShowAdjustment(true); setIsBulkMode(false); setSelectedUserIds([]); }} data-testid="button-add-adjustment">
                <Plus className="h-4 w-4 mr-1" />
                Adjust Balance
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Filter Year</Label>
                  <Select value={adjHistoryYear} onValueChange={setAdjHistoryYear}>
                    <SelectTrigger className="w-[120px]" data-testid="select-adj-history-year">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[0, 1, 2].map(offset => {
                        const y = new Date().getFullYear() - offset;
                        return <SelectItem key={y} value={String(y)}>{y}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {adjHistLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : adjustmentHistory && adjustmentHistory.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2 font-medium text-muted-foreground">Date</th>
                        <th className="text-left py-3 px-2 font-medium text-muted-foreground">Employee</th>
                        <th className="text-left py-3 px-2 font-medium text-muted-foreground">Leave Type</th>
                        <th className="text-left py-3 px-2 font-medium text-muted-foreground">Days</th>
                        <th className="text-left py-3 px-2 font-medium text-muted-foreground">Reason</th>
                        <th className="text-left py-3 px-2 font-medium text-muted-foreground">Adjusted By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adjustmentHistory.map((adj) => (
                        <tr key={adj.id} className="border-b last:border-0" data-testid={`adj-row-${adj.id}`}>
                          <td className="py-2 px-2 text-muted-foreground">{adj.createdAt ? new Date(adj.createdAt).toLocaleDateString() : "-"}</td>
                          <td className="py-2 px-2 font-medium">{adj.userName}</td>
                          <td className="py-2 px-2">{adj.leaveTypeName}</td>
                          <td className="py-2 px-2">
                            <Badge variant="secondary" className={parseFloat(adj.adjustmentDays) >= 0 ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"}>
                              {parseFloat(adj.adjustmentDays) >= 0 ? "+" : ""}{adj.adjustmentDays}
                            </Badge>
                          </td>
                          <td className="py-2 px-2 text-muted-foreground max-w-[200px] truncate">{adj.reason}</td>
                          <td className="py-2 px-2 text-muted-foreground">{adj.adjustedByName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-4">
                  <Scale className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No balance adjustments found for {adjHistoryYear}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <FeatureFlagsSection />

        <AccessControlSection />

        <CompanyProfileSection />

        <TrainingSettingsSection />

        <RegularizationPolicySection />

        <PerformanceSettingsSection />
        <RayoAcademySettingsSection />
        <CommunicationsSection />
        <LetterTemplatesSection />
        <GoalTemplatesSection />
        <DataMaintenanceSection />

        <Dialog open={showAdjustment} onOpenChange={setShowAdjustment}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Adjust Leave Balance</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="bulk-mode"
                  checked={isBulkMode}
                  onCheckedChange={(v) => {
                    setIsBulkMode(!!v);
                    if (!v) setSelectedUserIds([]);
                    setAdjForm(prev => ({ ...prev, userId: "" }));
                  }}
                  data-testid="checkbox-bulk-mode"
                />
                <Label htmlFor="bulk-mode">Bulk adjust (multiple employees)</Label>
              </div>

              {isBulkMode ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <Label>Select Employees</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const activeUsers = allUsers?.filter(u => u.isActive) || [];
                        if (selectedUserIds.length === activeUsers.length) {
                          setSelectedUserIds([]);
                        } else {
                          setSelectedUserIds(activeUsers.map(u => u.id));
                        }
                      }}
                      data-testid="button-select-all-users"
                    >
                      <CheckSquare className="h-4 w-4 mr-1" />
                      {selectedUserIds.length === (allUsers?.filter(u => u.isActive)?.length || 0) ? "Deselect All" : "Select All"}
                    </Button>
                  </div>
                  <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-1">
                    {!allUsers ? (
                      <p className="text-sm text-muted-foreground py-2 text-center">Loading employees...</p>
                    ) : allUsers.filter(u => u.isActive).length === 0 ? (
                      <p className="text-sm text-muted-foreground py-2 text-center">No active employees found</p>
                    ) : (
                      allUsers.filter(u => u.isActive).map(u => (
                        <div key={u.id} className="flex items-center gap-2 py-1">
                          <Checkbox
                            id={`user-${u.id}`}
                            checked={selectedUserIds.includes(u.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedUserIds(prev => [...prev, u.id]);
                              } else {
                                setSelectedUserIds(prev => prev.filter(id => id !== u.id));
                              }
                            }}
                            data-testid={`checkbox-user-${u.id}`}
                          />
                          <Label htmlFor={`user-${u.id}`} className="text-sm cursor-pointer">
                            {u.firstName} {u.lastName} ({u.email})
                          </Label>
                        </div>
                      ))
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{selectedUserIds.length} employee(s) selected</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Employee</Label>
                  <Select
                    value={adjForm.userId}
                    onValueChange={(v) => setAdjForm(prev => ({ ...prev, userId: v }))}
                  >
                    <SelectTrigger data-testid="select-adj-user">
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {allUsers?.filter(u => u.isActive).map(u => (
                        <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Leave Type</Label>
                <Select
                  value={adjForm.leaveTypeId}
                  onValueChange={(v) => setAdjForm(prev => ({ ...prev, leaveTypeId: v }))}
                >
                  <SelectTrigger data-testid="select-adj-leave-type">
                    <SelectValue placeholder="Select leave type" />
                  </SelectTrigger>
                  <SelectContent>
                    {leaveTypes?.map(lt => (
                      <SelectItem key={lt.id} value={lt.id}>{lt.name}{!lt.isActive ? " (inactive)" : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Adjustment Days (+/-)</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={adjForm.adjustmentDays}
                    onChange={(e) => setAdjForm(prev => ({ ...prev, adjustmentDays: e.target.value }))}
                    placeholder="e.g. 3 or -1"
                    data-testid="input-adj-days"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Year</Label>
                  <Select value={adjForm.year} onValueChange={(v) => setAdjForm(prev => ({ ...prev, year: v }))}>
                    <SelectTrigger data-testid="select-adj-year">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[0, 1, 2].map(offset => {
                        const y = new Date().getFullYear() - offset;
                        return <SelectItem key={y} value={String(y)}>{y}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Reason</Label>
                <Textarea
                  value={adjForm.reason}
                  onChange={(e) => setAdjForm(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="e.g. Adding previous Sick Leave balance (0.5/month for Jan-Jun)"
                  data-testid="input-adj-reason"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAdjustment(false)}>Cancel</Button>
              <Button
                onClick={() => {
                  const days = parseFloat(adjForm.adjustmentDays);
                  const year = parseInt(adjForm.year);
                  if (isNaN(days) || days === 0) {
                    toast({ title: "Error", description: "Please enter a valid non-zero adjustment amount", variant: "destructive" });
                    return;
                  }
                  if (isBulkMode) {
                    bulkAdjustMutation.mutate({
                      userIds: selectedUserIds,
                      leaveTypeId: adjForm.leaveTypeId,
                      adjustmentDays: days,
                      reason: adjForm.reason,
                      year,
                    });
                  } else {
                    adjustMutation.mutate({
                      userId: adjForm.userId,
                      leaveTypeId: adjForm.leaveTypeId,
                      adjustmentDays: days,
                      reason: adjForm.reason,
                      year,
                    });
                  }
                }}
                disabled={
                  (!isBulkMode && !adjForm.userId) ||
                  (isBulkMode && selectedUserIds.length === 0) ||
                  !adjForm.leaveTypeId ||
                  !adjForm.adjustmentDays ||
                  !adjForm.reason ||
                  adjustMutation.isPending ||
                  bulkAdjustMutation.isPending
                }
                data-testid="button-submit-adjustment"
              >
                {(adjustMutation.isPending || bulkAdjustMutation.isPending) ? "Adjusting..." : isBulkMode ? `Adjust ${selectedUserIds.length} Employee(s)` : "Apply Adjustment"}
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
      </div>
    </AdminLayout>
  );
}
