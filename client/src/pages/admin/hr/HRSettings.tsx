import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Settings, Plus, Pencil, Trash2, CalendarDays, Building2, Upload, Download, Info, Scale, Users, CheckSquare, FileText, ChevronDown, ChevronUp } from "lucide-react";
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
};

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

  const categories = ["performance_band", "conduct_band", "completion_band", "closing_line"];

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
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setEditing(prev => ({ ...prev, [sentence.id]: sentence.sentence }))}
                                  data-testid={`btn-edit-sentence-${sentence.id}`}
                                >
                                  <Pencil className="h-3 w-3 mr-1" />Edit
                                </Button>
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

        <TrainingSettingsSection />

        <PerformanceSettingsSection />
        <RayoAcademySettingsSection />
        <LetterTemplatesSection />

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
