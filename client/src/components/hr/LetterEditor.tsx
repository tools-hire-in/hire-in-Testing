import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  FileText, Loader2, Search, ChevronRight, ChevronLeft, Eye, CheckCircle,
  TrendingUp, Award, Layers, Laptop, Plus, Trash2, Mail,
  Cloud, CloudOff, AlertTriangle, RotateCcw, AlertCircle,
  LayoutTemplate, Star, ChevronDown as ChevronDownIcon,
} from "lucide-react";
import { AnnexureEditor, buildGoalsFromAnnexures, type AnnexureItem } from "./AnnexureEditor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LetterPreview, type LetterSentencesOverride } from "./LetterPreview";
import type { AdminUser, RoleSummaryTemplate, LetterTemplateSentence, HrLetter } from "@shared/schema";
import { useDraft } from "@/hooks/useDraft";
import {
  PERFORMANCE_BANDS,
  CONDUCT_BANDS,
  COMPLETION_BANDS,
  CLOSING_LINES,
  CLOSING_LINE_SENTENCES,
  TEMPLATE_LABELS,
  ROLE_RESPONSIBILITY_SUMMARIES,
  AMENDMENT_TEMPLATE_TYPES,
} from "@shared/hrLetterConstants";
import type { TemplateConfig } from "@shared/letterRenderer";
import { hrLetterConfig, HR_LETTER_BAND_VISIBILITY } from "@shared/letterTemplates/hrLetter";
import { amendmentConfig } from "@shared/letterTemplates/amendment";

const ALL_STANDARD_TEMPLATE_TYPES = ["experience", "internship_completion", "internship_certificate", "relieving"];

const AMENDMENT_CARD_CONFIG = [
  {
    value: "salary_revision",
    label: "Salary Revision",
    description: "Document a change in monthly salary",
    icon: TrendingUp,
  },
  {
    value: "role_change",
    label: "Designation / Promotion",
    description: "Formalise a title or department change",
    icon: Award,
  },
  {
    value: "combined",
    label: "Salary + Designation",
    description: "Combined salary & role change",
    icon: Layers,
  },
  {
    value: "device_allocation",
    label: "Device Allocation",
    description: "Allocate company devices to an employee",
    icon: Laptop,
  },
];

interface DeviceItem {
  description: string;
  serialNumber: string;
  assetTag: string;
  condition: string;
}

interface AmendmentMeta {
  effectiveDate: string;
  reason: string;
  previousSalary: string;
  newSalary: string;
  newSalaryInWords: string;
  previousDesignation: string;
  newDesignation: string;
  previousDepartment: string;
  newDepartment: string;
  deviceItems: DeviceItem[];
}

interface FormData {
  templateType: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  designation: string;
  department: string;
  employmentType: string;
  location: string;
  reportingManager: string;
  startDate: string;
  endDate: string;
  lastWorkingDay: string;
  performanceBand: string;
  conductBand: string;
  completionBand: string;
  closingLine: string;
  includeResponsibilities: boolean;
  responsibilitiesSummary: string;
  includeProject: boolean;
  projectName: string;
  includeSeal: boolean;
  signatoryId: string;
  signatoryName: string;
  signatoryDesignation: string;
  issueDate: string;
  customOverrideText: string;
}

const defaultForm: FormData = {
  templateType: "",
  employeeId: "",
  employeeName: "",
  employeeCode: "",
  designation: "",
  department: "",
  employmentType: "",
  location: "",
  reportingManager: "",
  startDate: "",
  endDate: "",
  lastWorkingDay: "",
  performanceBand: "",
  conductBand: "",
  completionBand: "",
  closingLine: "wish_success",
  includeResponsibilities: false,
  responsibilitiesSummary: "",
  includeProject: false,
  projectName: "",
  includeSeal: false,
  signatoryId: "",
  signatoryName: "",
  signatoryDesignation: "",
  issueDate: new Date().toISOString().split("T")[0],
  customOverrideText: "",
};

const defaultAmendmentMeta: AmendmentMeta = {
  effectiveDate: new Date().toISOString().split("T")[0],
  reason: "",
  previousSalary: "",
  newSalary: "",
  newSalaryInWords: "",
  previousDesignation: "",
  newDesignation: "",
  previousDepartment: "",
  newDepartment: "",
  deviceItems: [{ description: "", serialNumber: "", assetTag: "", condition: "" }],
};

function buildFormFromLetter(letter: HrLetter): FormData {
  return {
    templateType: letter.templateType,
    employeeId: letter.employeeId || "",
    employeeName: letter.employeeName,
    employeeCode: letter.employeeCode || "",
    designation: letter.designation,
    department: letter.department || "",
    employmentType: letter.employmentType || "",
    location: letter.location || "",
    reportingManager: letter.reportingManager || "",
    startDate: letter.startDate || "",
    endDate: letter.endDate || "",
    lastWorkingDay: letter.lastWorkingDay || "",
    performanceBand: letter.performanceBand || "",
    conductBand: letter.conductBand || "",
    completionBand: letter.completionBand || "",
    closingLine: letter.closingLine || "wish_success",
    includeResponsibilities: letter.includeResponsibilities || false,
    responsibilitiesSummary: letter.responsibilitiesSummary || "",
    includeProject: letter.includeProject || false,
    projectName: letter.projectName || "",
    includeSeal: letter.includeSeal || false,
    signatoryId: letter.signatoryId || "",
    signatoryName: letter.signatoryName || "",
    signatoryDesignation: letter.signatoryDesignation || "",
    issueDate: letter.issueDate || new Date().toISOString().split("T")[0],
    customOverrideText: letter.customOverrideText || "",
  };
}

function buildAmendmentMetaFromLetter(letter: HrLetter): AmendmentMeta {
  const meta = ((letter.metadata as Record<string, unknown>) || {}) as Record<string, unknown>;
  return {
    effectiveDate: (meta.effectiveDate as string) || new Date().toISOString().split("T")[0],
    reason: (meta.reason as string) || "",
    previousSalary: (meta.oldSalary as string) || "",
    newSalary: (meta.newSalary as string) || "",
    newSalaryInWords: (meta.newSalaryInWords as string) || "",
    previousDesignation: (meta.oldDesignation as string) || "",
    newDesignation: (meta.newDesignation as string) || "",
    previousDepartment: (meta.oldDepartment as string) || "",
    newDepartment: (meta.newDepartment as string) || "",
    deviceItems: (meta.deviceItems as DeviceItem[]) || [{ description: "", serialNumber: "", assetTag: "", condition: "" }],
  };
}

function buildSentencesOverride(sentences: LetterTemplateSentence[]): LetterSentencesOverride {
  const override: LetterSentencesOverride = {
    performance_band: {},
    conduct_band: {},
    completion_band: {},
    closing_line: {},
  };
  for (const s of sentences) {
    if (s.category === "performance_band") override.performance_band![s.key] = s.sentence;
    else if (s.category === "conduct_band") override.conduct_band![s.key] = s.sentence;
    else if (s.category === "completion_band") override.completion_band![s.key] = s.sentence;
    else if (s.category === "closing_line") override.closing_line![s.key] = s.sentence;
  }
  return override;
}

export interface LetterEditorProps {
  letterType?: "hr_letter" | "amendment" | "all";
  config?: TemplateConfig;
  editingLetter?: HrLetter;
  onResubmitted?: () => void;
  initialTemplateId?: number;
}

export function LetterEditor({ letterType = "all", config, editingLetter, onResubmitted, initialTemplateId }: LetterEditorProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(editingLetter ? 1 : 0);
  const [form, setForm] = useState<FormData>(editingLetter ? buildFormFromLetter(editingLetter) : { ...defaultForm });
  const [amendmentMeta, setAmendmentMeta] = useState<AmendmentMeta>(editingLetter ? buildAmendmentMetaFromLetter(editingLetter) : { ...defaultAmendmentMeta });
  const [isManualEntry, setIsManualEntry] = useState(false);
  const [manualEmployeeEmail, setManualEmployeeEmail] = useState("");
  const [sendEmail, setSendEmail] = useState(false);
  const [ccEmails, setCcEmails] = useState((editingLetter as any)?.ccEmails || "");
  const [showPreview, setShowPreview] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [annexures, setAnnexures] = useState<AnnexureItem[]>([]);
  const [amendmentPolicyAnnexures, setAmendmentPolicyAnnexures] = useState<string[]>([]);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [appliedTemplateId, setAppliedTemplateId] = useState<number | null>(null);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);

  const effectiveConfig: TemplateConfig = config ?? (
    letterType === "hr_letter"  ? hrLetterConfig  :
    letterType === "amendment"  ? amendmentConfig  :
    {
      letterType: "hr_letter",
      templateTypes: [...ALL_STANDARD_TEMPLATE_TYPES, ...(AMENDMENT_TEMPLATE_TYPES as string[])],
      bandOptions: { showPerformanceBand: true, showConductBand: true, showCompletionBand: true },
    }
  );

  const configAllowedTypes = new Set(effectiveConfig.templateTypes);
  const showStandardTemplates = letterType === "all" || letterType === "hr_letter";
  const showAmendmentTemplates = letterType === "all" || letterType === "amendment";

  const STANDARD_TEMPLATE_TYPES = showStandardTemplates
    ? ALL_STANDARD_TEMPLATE_TYPES.filter(t => letterType === "all" || configAllowedTypes.has(t))
    : [];
  const visibleAmendmentCards = showAmendmentTemplates
    ? AMENDMENT_CARD_CONFIG.filter(c => letterType === "all" || configAllowedTypes.has(c.value))
    : [];

  const isAdmin = user?.role === "super_admin" || user?.role === "admin";
  const isAmendmentType = (AMENDMENT_TEMPLATE_TYPES as readonly string[]).includes(form.templateType);

  const { draftId, saveState, rehydratedLetter, isRehydrating, saveDraft, discardDraft, clearDraft } = useDraft();
  const rehydrated = useRef(false);

  const isRevisionMode = !!(rehydratedLetter && ["needs_revision", "resubmitted"].includes(rehydratedLetter.status));

  // Rehydrate form state from server draft on mount (only once)
  useEffect(() => {
    if (!rehydratedLetter || rehydrated.current) return;
    rehydrated.current = true;
    const d = rehydratedLetter.draftData as Record<string, unknown> | null;
    if (!d) {
      if (rehydratedLetter.templateType) {
        setForm(prev => ({ ...prev, templateType: rehydratedLetter.templateType }));
      }
      return;
    }
    if (d.form) setForm(prev => ({ ...prev, ...(d.form as Partial<FormData>) }));
    if (d.amendmentMeta) setAmendmentMeta(prev => ({ ...prev, ...(d.amendmentMeta as Partial<AmendmentMeta>) }));
    if (typeof d.isManualEntry === "boolean") setIsManualEntry(d.isManualEntry);
    if (typeof d.manualEmployeeEmail === "string") setManualEmployeeEmail(d.manualEmployeeEmail);
    if (Array.isArray(d.annexures)) setAnnexures(d.annexures as AnnexureItem[]);
    if (Array.isArray(d.amendmentPolicyAnnexures)) setAmendmentPolicyAnnexures(d.amendmentPolicyAnnexures as string[]);
    if (typeof d.ccEmails === "string") setCcEmails(d.ccEmails);
    if (typeof d._step === "number") setStep(d._step);
    if (typeof d.appliedTemplateId === "number") setAppliedTemplateId(d.appliedTemplateId);
  }, [rehydratedLetter]);

  // Auto-apply initialTemplateId from template library "Use" action
  const initialTemplateApplied = useRef(false);
  useEffect(() => {
    if (!initialTemplateId || initialTemplateApplied.current) return;
    if (letterTemplates.length === 0) return;
    const tpl = letterTemplates.find((t) => t.id === initialTemplateId);
    if (!tpl) return;
    initialTemplateApplied.current = true;
    const td = tpl.template_data || {};
    setForm((prev) => ({
      ...prev,
      templateType: tpl.letter_type,
      performanceBand: (td.performanceBand as string) || prev.performanceBand,
      conductBand: (td.conductBand as string) || prev.conductBand,
      completionBand: (td.completionBand as string) || prev.completionBand,
      closingLine: (td.closingLine as string) || prev.closingLine,
      signatoryDesignation: (td.signatoryDesignation as string) || prev.signatoryDesignation,
      signatoryName: (td.defaultSignatoryName as string) || prev.signatoryName,
      customOverrideText: (td.customBodyText as string) || prev.customOverrideText,
    }));
    setAppliedTemplateId(tpl.id);
    setShowTemplatePicker(false);
    setStep(1);
  }, [initialTemplateId, letterTemplates]);

  // Prefill from banner navigation (sessionStorage handoff) — run once on mount, skip if editing existing letter
  useEffect(() => {
    if (editingLetter) return;
    try {
      const raw = sessionStorage.getItem("letter_editor_prefill");
      if (!raw) return;
      sessionStorage.removeItem("letter_editor_prefill");
      const p = JSON.parse(raw) as {
        templateType?: string;
        employeeId?: string;
        effectiveDate?: string;
        newSalary?: string;
        oldSalary?: string;
        newDesignation?: string;
        oldDesignation?: string;
      };
      if (p.templateType) {
        setForm(prev => ({ ...prev, templateType: p.templateType! }));
      }
      setAmendmentMeta(prev => ({
        ...prev,
        ...(p.effectiveDate ? { effectiveDate: p.effectiveDate } : {}),
        ...(p.newSalary ? { newSalary: p.newSalary } : {}),
        ...(p.oldSalary ? { previousSalary: p.oldSalary } : {}),
        ...(p.newDesignation ? { newDesignation: p.newDesignation } : {}),
        ...(p.oldDesignation ? { oldDesignation: p.oldDesignation } : {}),
      }));
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save: debounced PATCH on every meaningful state change
  useEffect(() => {
    if (!form.templateType) return;
    if (isRehydrating) return;
    if (editingLetter) return;
    saveDraft(form.templateType, {
      form,
      amendmentMeta,
      isManualEntry,
      manualEmployeeEmail,
      annexures,
      amendmentPolicyAnnexures,
      appliedTemplateId,
      ccEmails,
    }, step);
  }, [form, amendmentMeta, isManualEntry, manualEmployeeEmail, annexures, amendmentPolicyAnnexures, appliedTemplateId, ccEmails, step]);

  const { data: usersData } = useQuery<{ users: AdminUser[]; counts?: Record<string, number> } | AdminUser[]>({
    queryKey: ["/api/admin/users", "all_non_deleted"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users?status=all_non_deleted", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
  });
  const employees: AdminUser[] = Array.isArray(usersData) ? usersData : (usersData?.users ?? []);

  const { data: departmentsData = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/departments"],
  });
  const departments = Array.isArray(departmentsData) ? departmentsData : [];

  const { data: dbSentences = [] } = useQuery<LetterTemplateSentence[]>({
    queryKey: ["/api/hr/letter-templates/sentences"],
    queryFn: async () => {
      const res = await fetch("/api/hr/letter-templates/sentences", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60000,
  });

  const sentencesOverride = useMemo(() => buildSentencesOverride(dbSentences), [dbSentences]);

  const closingSentences = useMemo(() => {
    const merged = { ...CLOSING_LINE_SENTENCES, ...(sentencesOverride.closing_line || {}) };
    return merged;
  }, [sentencesOverride]);

  const { data: letterTemplates = [] } = useQuery<Array<{
    id: number; name: string; description: string | null; letter_type: string;
    template_data: Record<string, unknown>; is_system: boolean; usage_count: number;
  }>>({
    queryKey: ["/api/hr/templates"],
    queryFn: async () => {
      const res = await fetch("/api/hr/templates", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60000,
  });

  const { data: allDbRoles = [] } = useQuery<RoleSummaryTemplate[]>({
    queryKey: ["/api/hr/letter-templates/roles"],
    queryFn: async () => {
      const res = await fetch("/api/hr/letter-templates/roles", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60000,
  });

  const filteredEmployees = useMemo(() => {
    if (!employeeSearch) return employees.slice(0, 20);
    const s = employeeSearch.toLowerCase();
    return employees.filter((e) =>
      `${e.firstName} ${e.lastName}`.toLowerCase().includes(s) ||
      e.employeeId?.toLowerCase().includes(s) ||
      e.email?.toLowerCase().includes(s)
    ).slice(0, 20);
  }, [employees, employeeSearch]);

  const normalizeDesignation = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

  const matchedDbRoles = useMemo(() => {
    const designation = normalizeDesignation(form.designation);
    if (!designation) return [] as RoleSummaryTemplate[];
    return allDbRoles.filter(r => normalizeDesignation(r.roleLabel) === designation);
  }, [allDbRoles, form.designation]);

  const filteredResponsibilityOptions = useMemo(() => {
    const designation = normalizeDesignation(form.designation);
    if (!designation) return [] as typeof ROLE_RESPONSIBILITY_SUMMARIES;
    return ROLE_RESPONSIBILITY_SUMMARIES.filter(
      (r) => normalizeDesignation(r.designation) === designation
    );
  }, [form.designation]);

  const hasDbMatch = matchedDbRoles.length > 0;

  useEffect(() => {
    if (!form.responsibilitiesSummary) return;

    if (hasDbMatch) {
      const allTexts = matchedDbRoles.flatMap(r => [r.defaultSummary, r.alternateSummary]);
      if (!allTexts.includes(form.responsibilitiesSummary)) {
        setForm((prev) => ({ ...prev, responsibilitiesSummary: "" }));
      }
    } else if (filteredResponsibilityOptions.length > 0) {
      const allTexts = filteredResponsibilityOptions.flatMap((r) => r.options.map((o) => o.text));
      if (!allTexts.includes(form.responsibilitiesSummary)) {
        setForm((prev) => ({ ...prev, responsibilitiesSummary: "" }));
      }
    }
  }, [form.designation]);

  useEffect(() => {
    if (!draftRestoredRef.current) {
      draftRestoredRef.current = true;
      const saved = readDraft();
      if (saved && saved.templateType) {
        const { templateType, employeeName, employeeId, designation, department, startDate, endDate, performanceBand, conductBand, completionBand, closingLine, signatoryName, signatoryDesignation } = saved;
        setForm(prev => ({
          ...prev,
          templateType: templateType ?? "",
          employeeName: String(employeeName ?? ""),
          employeeId: String(employeeId ?? ""),
          designation: String(designation ?? ""),
          department: String(department ?? ""),
          startDate: String(startDate ?? ""),
          endDate: String(endDate ?? ""),
          performanceBand: String(performanceBand ?? ""),
          conductBand: String(conductBand ?? ""),
          completionBand: String(completionBand ?? ""),
          closingLine: String(closingLine ?? "wish_success"),
          signatoryName: String(signatoryName ?? ""),
          signatoryDesignation: String(signatoryDesignation ?? ""),
        }));
      }
    }
  }, []);

  useEffect(() => {
    if (form.templateType) {
      saveDraft({
        templateType: form.templateType,
        employeeName: form.employeeName,
        employeeId: form.employeeId,
        designation: form.designation,
        department: form.department,
        startDate: form.startDate,
        endDate: form.endDate,
        performanceBand: form.performanceBand,
        conductBand: form.conductBand,
        completionBand: form.completionBand,
        closingLine: form.closingLine,
        signatoryName: form.signatoryName,
        signatoryDesignation: form.signatoryDesignation,
      });
    }
  }, [form.templateType, form.employeeName, form.designation, form.department, form.startDate, form.endDate, form.performanceBand, form.conductBand, form.completionBand, form.closingLine, form.signatoryName, form.signatoryDesignation]);

  useEffect(() => {
    if (hasDbMatch && matchedDbRoles.length > 0 && !form.responsibilitiesSummary && form.includeResponsibilities) {
      setForm(prev => ({ ...prev, responsibilitiesSummary: matchedDbRoles[0].defaultSummary }));
    }
  }, [hasDbMatch, matchedDbRoles, form.includeResponsibilities]);

  const signatoryOptions = useMemo(() => {
    return employees.filter((e) =>
      ["super_admin", "admin", "hr"].includes(e.role) && e.isActive
    );
  }, [employees]);

  const deptMap = useMemo(() => {
    const map: Record<string, string> = {};
    departments.forEach((d) => { map[d.id] = d.name; });
    return map;
  }, [departments]);

  async function pushAnnexureGoals(
    referenceNumber: string,
    employeeId: string,
    startDate: string,
    currentAnnexures: AnnexureItem[]
  ) {
    const goalsToCreate = buildGoalsFromAnnexures(currentAnnexures, startDate);
    if (goalsToCreate.length === 0) return;
    const milestoneCount = goalsToCreate.reduce((sum, g) => sum + (g.milestones?.length || 0), 0);
    try {
      await apiRequest("POST", "/api/performance/goals/batch", {
        employeeId,
        sourceRef: referenceNumber,
        goals: goalsToCreate,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/performance/goals"] });
      toast({
        title: `${goalsToCreate.length} performance goal${goalsToCreate.length > 1 ? "s" : ""} pushed`,
        description: milestoneCount > 0
          ? `${milestoneCount} milestone${milestoneCount > 1 ? "s" : ""} linked to addendum ${referenceNumber}`
          : `Linked to addendum ${referenceNumber}`,
      });
    } catch {
      toast({ title: "Goals could not be pushed", description: "Addendum was created. Goals may need to be added manually.", variant: "destructive" });
    }
  }

  const editMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      await apiRequest("PATCH", `/api/hr/letters/${editingLetter!.id}/draft`, data);
      const res = await apiRequest("POST", `/api/hr/letters/${editingLetter!.id}/resubmit`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Letter resubmitted for approval" });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/letters"] });
      onResubmitted?.();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("POST", "/api/hr/letters", data);
      return res.json() as Promise<{ id: string; referenceNumber?: string; templateType?: string }>;
    },
    onSuccess: async (data) => {
      const isAmendment = data.templateType && (AMENDMENT_TEMPLATE_TYPES as readonly string[]).includes(data.templateType);
      if (isAmendment && data.id) {
        const link = document.createElement("a");
        link.href = `/api/hr/letters/${data.id}/download`;
        link.download = `${data.referenceNumber || "letter"}.docx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      if (isAmendment && data.referenceNumber && !isManualEntry && form.employeeId) {
        await pushAnnexureGoals(
          data.referenceNumber,
          form.employeeId,
          amendmentMeta.effectiveDate,
          annexures
        );
      }
      toast({ title: "Letter created", description: isAmendment ? "DOCX downloaded successfully." : "Letter has been generated successfully." });
      clearDraft();
      rehydrated.current = false;
      queryClient.invalidateQueries({ queryKey: ["/api/hr/letters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setForm({ ...defaultForm });
      setAmendmentMeta({ ...defaultAmendmentMeta });
      setIsManualEntry(false);
      setManualEmployeeEmail("");
      setSendEmail(false);
      setAnnexures([]);
      setAmendmentPolicyAnnexures([]);
      clearDraft();
      setStep(0);
    },
    onError: (err: Error) => {
      const msg = err.message.toLowerCase();
      if (msg.includes("designation")) {
        setStep(1);
        setFieldErrors({ designation: err.message });
      } else if (msg.includes("department")) {
        setStep(1);
        setFieldErrors({ department: err.message });
      } else if (msg.includes("joining date") || msg.includes("start date")) {
        setStep(1);
        setFieldErrors({ startDate: err.message });
      } else if (msg.includes("end date")) {
        setStep(1);
        setFieldErrors({ endDate: err.message });
      } else {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    },
  });

  function selectEmployee(emp: AdminUser) {
    const managerEmp = emp.managerId ? employees.find((e: AdminUser) => e.id === emp.managerId) : undefined;
    setForm(prev => ({
      ...prev,
      employeeId: emp.id,
      employeeName: `${emp.firstName} ${emp.lastName}`,
      employeeCode: emp.employeeId || "",
      designation: emp.designation || "",
      department: emp.departmentId ? deptMap[emp.departmentId] || "" : "",
      reportingManager: managerEmp ? `${managerEmp.firstName} ${managerEmp.lastName}` : "",
      startDate: emp.joiningDate || "",
    }));
    if (isAmendmentType) {
      setAmendmentMeta(prev => ({
        ...prev,
        previousDesignation: emp.designation || "",
        previousDepartment: emp.departmentId ? deptMap[emp.departmentId] || "" : "",
      }));
      setManualEmployeeEmail(emp.email || "");
    }
    setEmployeeSearch("");
  }

  function selectSignatory(emp: AdminUser) {
    setForm(prev => ({
      ...prev,
      signatoryId: emp.id,
      signatoryName: `${emp.firstName} ${emp.lastName}`,
      signatoryDesignation: emp.designation || "HR Manager",
    }));
  }

  const bandVis = form.templateType in HR_LETTER_BAND_VISIBILITY
    ? HR_LETTER_BAND_VISIBILITY[form.templateType as keyof typeof HR_LETTER_BAND_VISIBILITY]
    : { performance: false, conduct: false, completion: false, project: false, lastWorkingDay: false };

  const showPerformanceBand = bandVis.performance && effectiveConfig.bandOptions?.showPerformanceBand !== false;
  const showConductBand = bandVis.conduct && effectiveConfig.bandOptions?.showConductBand !== false;
  const showCompletionBand = bandVis.completion && effectiveConfig.bandOptions?.showCompletionBand !== false;
  const showProject = bandVis.project;
  const showLastWorkingDay = bandVis.lastWorkingDay;
  const isIntern = ["internship_completion", "internship_certificate"].includes(form.templateType);

  const steps = [
    { title: "Template", subtitle: "Select document type" },
    { title: isAmendmentType ? "Employee" : "Employee", subtitle: isAmendmentType ? "Lookup or manual entry" : isIntern ? "Select intern" : "Select employee" },
    { title: "Details", subtitle: isAmendmentType ? "Amendment fields" : "Bands & options" },
    { title: "Signatory", subtitle: "Review & generate" },
  ];

  function validateStep1(): boolean {
    const errors: Record<string, string> = {};

    if (isAmendmentType) {
      if (!isManualEntry && !form.employeeId) {
        errors.employeeSearch = "Please search and select an employee before continuing.";
      }
      if (!form.employeeName) errors.employeeName = "Full name is required.";
      if (!form.designation) errors.designation = "Designation is required.";
      if (isManualEntry && !manualEmployeeEmail) errors.manualEmail = "Email is required for manual entry.";
    } else {
      if (!form.employeeId) errors.employeeSearch = "Please search and select an employee before continuing.";
      if (!form.employeeName) errors.employeeName = "Full name is required.";
      if (!form.designation) errors.designation = "Designation is required.";
      if (!form.department) errors.department = "Department is required.";
      if (!form.startDate) errors.startDate = "Start date is required.";
      const endDateRequired = ["experience", "internship_completion", "relieving"].includes(form.templateType);
      if (endDateRequired && !form.endDate) errors.endDate = "End date is required for this letter type.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function validateStep2(): boolean {
    if (!isAmendmentType) return true;
    const errors: Record<string, string> = {};
    if (!amendmentMeta.effectiveDate) errors.effectiveDate = "Effective date is required.";
    if (form.templateType === "role_change" || form.templateType === "combined") {
      if (!amendmentMeta.newDesignation) errors.newDesignation = "New designation is required.";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleNext() {
    if (step === 1) {
      if (!validateStep1()) return;
    }
    if (step === 2) {
      if (!validateStep2()) return;
    }
    setFieldErrors({});
    setStep(s => s + 1);
  }

  function canNext() {
    if (step === 0) return !!form.templateType;
    if (step === 2) return true;
    return !!form.signatoryName;
  }

  function handleSubmit() {
    if (editingLetter) {
      const payload: Record<string, unknown> = { ...form };
      if (isAmendmentType) {
        const metadata: Record<string, unknown> = { effectiveDate: amendmentMeta.effectiveDate };
        if (form.templateType === "salary_revision" || form.templateType === "combined") {
          metadata.oldSalary = amendmentMeta.previousSalary;
          metadata.newSalary = amendmentMeta.newSalary;
          metadata.newSalaryInWords = amendmentMeta.newSalaryInWords;
        }
        if (form.templateType === "role_change" || form.templateType === "combined") {
          metadata.oldDesignation = amendmentMeta.previousDesignation;
          metadata.newDesignation = amendmentMeta.newDesignation;
          metadata.oldDepartment = amendmentMeta.previousDepartment;
          metadata.newDepartment = amendmentMeta.newDepartment;
        }
        if (form.templateType === "device_allocation") {
          metadata.deviceItems = amendmentMeta.deviceItems.filter(d => d.description.trim());
        }
        if (amendmentMeta.reason) metadata.reason = amendmentMeta.reason;
        payload.metadata = metadata;
      }
      editMutation.mutate(payload);
      return;
    }

    if (isAmendmentType) {
      const metadata: Record<string, unknown> = {
        effectiveDate: amendmentMeta.effectiveDate,
      };

      if (form.templateType === "salary_revision" || form.templateType === "combined") {
        metadata.oldSalary = amendmentMeta.previousSalary;
        metadata.newSalary = amendmentMeta.newSalary;
        metadata.newSalaryInWords = amendmentMeta.newSalaryInWords;
      }
      if (form.templateType === "role_change" || form.templateType === "combined") {
        metadata.oldDesignation = amendmentMeta.previousDesignation;
        metadata.newDesignation = amendmentMeta.newDesignation;
        metadata.oldDepartment = amendmentMeta.previousDepartment;
        metadata.newDepartment = amendmentMeta.newDepartment;
      }
      if (form.templateType === "device_allocation") {
        metadata.deviceItems = amendmentMeta.deviceItems.filter(d => d.description.trim());
      }
      if (amendmentMeta.reason) {
        metadata.reason = amendmentMeta.reason;
      }
      if (amendmentPolicyAnnexures.length > 0) {
        metadata.policyAnnexures = amendmentPolicyAnnexures;
      }

      if (isManualEntry) {
        metadata.manualEmployeeName = form.employeeName;
        metadata.manualDesignation = form.designation;
        metadata.manualDepartment = form.department;
        metadata.manualEmail = manualEmployeeEmail;
      }

      const payload: Record<string, unknown> = {
        templateType: form.templateType,
        employeeName: form.employeeName,
        designation: form.designation,
        department: form.department,
        effectiveDate: amendmentMeta.effectiveDate,
        startDate: form.startDate || undefined,
        signatoryId: form.signatoryId || undefined,
        signatoryName: form.signatoryName,
        signatoryDesignation: form.signatoryDesignation,
        isManualEntry,
        manualEmployeeEmail: manualEmployeeEmail || undefined,
        sendEmail,
        ccEmails: ccEmails.trim() || undefined,
        metadata,
        annexureData: annexures.length > 0 ? annexures : undefined,
      };

      if (!isManualEntry) {
        payload.employeeId = form.employeeId;
        payload.employeeCode = form.employeeCode;
      }
      if (appliedTemplateId) payload.fromTemplateId = appliedTemplateId;
      createMutation.mutate(payload);
    } else {
      const payload: Record<string, unknown> = { ...form };
      if (!isAdmin || !form.customOverrideText) {
        delete payload.customOverrideText;
      }
      if (!payload.performanceBand) delete payload.performanceBand;
      if (!payload.conductBand) delete payload.conductBand;
      if (!payload.completionBand) delete payload.completionBand;
      if (!payload.endDate) delete payload.endDate;
      if (!payload.lastWorkingDay) delete payload.lastWorkingDay;
      if (!payload.signatoryId) delete payload.signatoryId;
      if (!payload.employeeId) delete payload.employeeId;
      if (annexures.length > 0) payload.annexureData = annexures;
      if (appliedTemplateId) payload.fromTemplateId = appliedTemplateId;
      payload.ccEmails = ccEmails.trim() || undefined;
      createMutation.mutate(payload);
    }
  }

  function updateDeviceItem(idx: number, field: keyof DeviceItem, value: string) {
    setAmendmentMeta(prev => {
      const items = [...prev.deviceItems];
      items[idx] = { ...items[idx], [field]: value };
      return { ...prev, deviceItems: items };
    });
  }

  function addDeviceItem() {
    setAmendmentMeta(prev => ({
      ...prev,
      deviceItems: [...prev.deviceItems, { description: "", serialNumber: "", assetTag: "", condition: "" }],
    }));
  }

  function removeDeviceItem(idx: number) {
    setAmendmentMeta(prev => ({
      ...prev,
      deviceItems: prev.deviceItems.filter((_, i) => i !== idx),
    }));
  }

  const employeeEmail = isManualEntry
    ? manualEmployeeEmail
    : employees.find(e => e.id === form.employeeId)?.email || "";

  function SaveStateIndicator() {
    if (!draftId && saveState === "idle") return null;
    if (saveState === "saving") return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground" data-testid="text-draft-saving">
        <Loader2 className="h-3 w-3 animate-spin" /> Saving…
      </span>
    );
    if (saveState === "saved") return (
      <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400" data-testid="text-draft-saved">
        <Cloud className="h-3 w-3" /> Draft saved
      </span>
    );
    if (saveState === "error") return (
      <span className="flex items-center gap-1 text-xs text-destructive" data-testid="text-draft-error">
        <CloudOff className="h-3 w-3" /> Save failed
      </span>
    );
    return null;
  }

  return (
    <>
    {showDiscardDialog && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" data-testid="dialog-discard-draft">
        <div className="bg-background rounded-lg border shadow-lg p-6 max-w-sm w-full mx-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <h3 className="font-semibold">Discard Draft?</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">This will permanently delete the saved draft and reset the form. This cannot be undone.</p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowDiscardDialog(false)} data-testid="btn-cancel-discard">Cancel</Button>
            <Button variant="destructive" size="sm" data-testid="btn-confirm-discard" onClick={async () => {
              setShowDiscardDialog(false);
              await discardDraft();
              rehydrated.current = false;
              setForm({ ...defaultForm });
              setAmendmentMeta({ ...defaultAmendmentMeta });
              setIsManualEntry(false);
              setManualEmployeeEmail("");
              setSendEmail(false);
              setAnnexures([]);
              setAmendmentPolicyAnnexures([]);
              setStep(0);
            }}>Discard</Button>
          </div>
        </div>
      </div>
    )}
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2" data-testid="text-letter-generator-title">
            <FileText className="h-5 w-5" />
            {editingLetter ? "Edit & Resubmit Letter" : "Letter Generator"}
          </CardTitle>
          {!editingLetter && (
            <div className="flex items-center gap-3">
              <SaveStateIndicator />
              {draftId && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground h-7 px-2"
                  onClick={() => setShowDiscardDialog(true)}
                  data-testid="btn-discard-draft"
                >
                  <RotateCcw className="h-3 w-3 mr-1" /> Discard Draft
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isRehydrating && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4 p-3 bg-muted rounded-lg" data-testid="text-draft-loading">
            <Loader2 className="h-4 w-4 animate-spin" /> Restoring your draft…
          </div>
        )}
        {isRevisionMode && rehydratedLetter?.revisionReason && (
          <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg" data-testid="banner-revision-reason">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Returned for Revision</p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-0.5">{rehydratedLetter.revisionReason}</p>
              </div>
            </div>
          </div>
        )}
        {isRevisionMode && (
          <div className="mb-4 p-3 bg-muted border rounded-lg text-sm text-muted-foreground" data-testid="banner-revision-locked">
            You are editing a returned letter. Locked fields cannot be changed.
          </div>
        )}
        {editingLetter && (editingLetter as any).revisionReason && (
          <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800" data-testid="edit-revision-reason-banner">
            <p className="font-semibold mb-1 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Returned for revision
            </p>
            <p>{(editingLetter as any).revisionReason}</p>
          </div>
        )}
        <div className="flex gap-2 mb-6">
          {steps.map((s, i) => (
            <div key={i} className={`flex-1 text-center p-2 rounded text-sm ${i === step ? "bg-primary text-primary-foreground" : i < step ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200" : "bg-muted text-muted-foreground"}`}>
              <div className="font-medium">{s.title}</div>
              <div className="text-xs opacity-75">{s.subtitle}</div>
            </div>
          ))}
        </div>

        {step === 0 && (
          <div className="space-y-4">
            {showStandardTemplates && (
              <div>
                <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Standard Letters</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                  {STANDARD_TEMPLATE_TYPES.map(type => (
                    <button
                      key={type}
                      data-testid={`btn-template-${type}`}
                      disabled={isRevisionMode}
                      onClick={() => {
                        if (isRevisionMode) return;
                        setForm(prev => ({ ...prev, templateType: type }));
                        setAppliedTemplateId(null);
                        setShowTemplatePicker(false);
                      }}
                      className={`p-4 rounded-lg border text-left transition-colors ${isRevisionMode ? "opacity-50 cursor-not-allowed" : ""} ${form.templateType === type ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                    >
                      <div className="font-medium">{TEMPLATE_LABELS[type]}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {showStandardTemplates && showAmendmentTemplates && <Separator />}
            {showAmendmentTemplates && (
              <div>
                <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Amendment Letters</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                  {visibleAmendmentCards.map(cfg => {
                    const Icon = cfg.icon;
                    return (
                      <button
                        key={cfg.value}
                        data-testid={`btn-template-${cfg.value}`}
                        disabled={isRevisionMode}
                        onClick={() => {
                          if (isRevisionMode) return;
                          setForm(prev => ({ ...prev, templateType: cfg.value }));
                          setAppliedTemplateId(null);
                          setShowTemplatePicker(false);
                        }}
                        className={`p-4 rounded-lg border text-left transition-colors ${isRevisionMode ? "opacity-50 cursor-not-allowed" : ""} ${form.templateType === cfg.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Icon className="h-4 w-4 text-primary" />
                          <div className="font-medium">{cfg.label}</div>
                        </div>
                        <div className="text-xs text-muted-foreground">{cfg.description}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Template picker — shown when a letter type is selected */}
            {form.templateType && !isRevisionMode && (() => {
              const typeTemplates = letterTemplates.filter(t => t.letter_type === form.templateType);
              if (typeTemplates.length === 0) return null;
              return (
                <div className="border rounded-lg overflow-hidden" data-testid="template-picker-section">
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors text-sm font-medium"
                    onClick={() => setShowTemplatePicker(v => !v)}
                    data-testid="btn-toggle-template-picker"
                  >
                    <div className="flex items-center gap-2">
                      <LayoutTemplate className="h-4 w-4 text-primary" />
                      {appliedTemplateId
                        ? <span>Template applied: <span className="text-primary">{typeTemplates.find(t => t.id === appliedTemplateId)?.name}</span></span>
                        : <span>Start from a saved template <span className="text-muted-foreground font-normal">({typeTemplates.length} available)</span></span>
                      }
                    </div>
                    <ChevronDownIcon className={`h-4 w-4 text-muted-foreground transition-transform ${showTemplatePicker ? "rotate-180" : ""}`} />
                  </button>
                  {showTemplatePicker && (
                    <div className="divide-y">
                      {typeTemplates.map(tpl => (
                        <button
                          key={tpl.id}
                          className={`w-full flex items-start justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors gap-3 ${appliedTemplateId === tpl.id ? "bg-primary/5 border-l-2 border-primary" : ""}`}
                          onClick={() => {
                            const td = tpl.template_data || {};
                            setForm(prev => ({
                              ...prev,
                              performanceBand: (td.performanceBand as string) || prev.performanceBand,
                              conductBand: (td.conductBand as string) || prev.conductBand,
                              completionBand: (td.completionBand as string) || prev.completionBand,
                              closingLine: (td.closingLine as string) || prev.closingLine,
                              signatoryDesignation: (td.signatoryDesignation as string) || prev.signatoryDesignation,
                              signatoryName: (td.defaultSignatoryName as string) || prev.signatoryName,
                              customOverrideText: (td.customBodyText as string) || prev.customOverrideText,
                            }));
                            setAppliedTemplateId(tpl.id);
                            setShowTemplatePicker(false);
                          }}
                          data-testid={`btn-apply-template-${tpl.id}`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium truncate">{tpl.name}</span>
                              {tpl.is_system && (
                                <Badge variant="secondary" className="text-xs flex items-center gap-1 bg-amber-50 text-amber-700 border-amber-200 shrink-0">
                                  <Star className="h-2.5 w-2.5" /> System
                                </Badge>
                              )}
                            </div>
                            {tpl.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{tpl.description}</p>}
                          </div>
                          {appliedTemplateId === tpl.id && (
                            <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            {isAmendmentType && (
              <div className="flex gap-3 p-1 bg-muted rounded-lg">
                <button
                  data-testid="toggle-system-employee"
                  onClick={() => { setIsManualEntry(false); setForm(prev => ({ ...prev, employeeId: "", employeeName: "", employeeCode: "", designation: "", department: "", startDate: "" })); setManualEmployeeEmail(""); }}
                  className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${!isManualEntry ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  System Employee
                </button>
                <button
                  data-testid="toggle-manual-entry"
                  onClick={() => { setIsManualEntry(true); setForm(prev => ({ ...prev, employeeId: "", employeeCode: "" })); setEmployeeSearch(""); }}
                  className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${isManualEntry ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Manual Entry
                </button>
              </div>
            )}

            {(!isAmendmentType || !isManualEntry) && (
              <div>
                <Label>Search {isIntern ? "Intern" : "Employee"} *</Label>
                <div className="relative mt-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, ID, or email..."
                    value={employeeSearch}
                    onChange={e => { setEmployeeSearch(e.target.value); setFieldErrors(prev => ({ ...prev, employeeSearch: "" })); }}
                    className={`pl-9 ${fieldErrors.employeeSearch ? "border-destructive" : ""}`}
                    data-testid="input-employee-search"
                  />
                </div>
                {form.employeeId && !fieldErrors.employeeSearch && (
                  <p className="text-xs text-muted-foreground mt-1">{form.employeeName} selected</p>
                )}
                {fieldErrors.employeeSearch && <p className="text-xs text-destructive mt-1" data-testid="error-employee-search">{fieldErrors.employeeSearch}</p>}
                {employeeSearch && filteredEmployees.length > 0 && (
                  <div className="border rounded-md mt-1 max-h-48 overflow-y-auto">
                    {filteredEmployees.map((emp) => (
                      <button
                        key={emp.id}
                        onClick={() => { selectEmployee(emp); setFieldErrors(prev => ({ ...prev, employeeSearch: "", employeeName: "" })); }}
                        className="w-full text-left px-3 py-2 hover:bg-muted text-sm border-b last:border-0"
                        data-testid={`btn-select-employee-${emp.id}`}
                      >
                        <span className="font-medium">{emp.firstName} {emp.lastName}</span>
                        <span className="text-muted-foreground ml-2">{emp.employeeId || ""} · {emp.email}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <Separator />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Full Name *</Label>
                <Input
                  value={form.employeeName}
                  onChange={e => { setForm(prev => ({ ...prev, employeeName: e.target.value })); setFieldErrors(prev => ({ ...prev, employeeName: "" })); }}
                  placeholder="Enter full name"
                  data-testid="input-employee-name"
                  className={fieldErrors.employeeName ? "border-destructive" : ""}
                />
                {fieldErrors.employeeName && <p className="text-xs text-destructive mt-1" data-testid="error-employee-name">{fieldErrors.employeeName}</p>}
              </div>

              {!isManualEntry && (
                <div>
                  <Label>{isIntern ? "Intern" : "Employee"} ID</Label>
                  <Input value={form.employeeCode} readOnly className="bg-muted" data-testid="input-employee-code" />
                </div>
              )}

              {isAmendmentType && isManualEntry && (
                <div>
                  <Label>Employee ID (optional)</Label>
                  <Input
                    value={form.employeeCode}
                    onChange={e => setForm(prev => ({ ...prev, employeeCode: e.target.value }))}
                    placeholder="e.g. HIS-HR-NOVA"
                    data-testid="input-employee-code-manual"
                  />
                </div>
              )}

              <div>
                <Label>Current Designation *</Label>
                <Input
                  value={form.designation}
                  onChange={e => { setForm(prev => ({ ...prev, designation: e.target.value })); setFieldErrors(prev => ({ ...prev, designation: "" })); }}
                  placeholder="e.g. Software Engineer"
                  data-testid="input-designation"
                  className={fieldErrors.designation ? "border-destructive" : ""}
                />
                {fieldErrors.designation && <p className="text-xs text-destructive mt-1" data-testid="error-designation">{fieldErrors.designation}</p>}
              </div>

              <div>
                <Label>Department {!isAmendmentType && <span className="text-destructive">*</span>}</Label>
                <Input
                  value={form.department}
                  onChange={e => { setForm(prev => ({ ...prev, department: e.target.value })); setFieldErrors(prev => ({ ...prev, department: "" })); }}
                  placeholder="e.g. Engineering"
                  data-testid="input-department"
                  className={fieldErrors.department ? "border-destructive" : ""}
                />
                {fieldErrors.department && <p className="text-xs text-destructive mt-1" data-testid="error-department">{fieldErrors.department}</p>}
              </div>

              {!isAmendmentType && (
                <>
                  <div>
                    <Label>Start Date *</Label>
                    <Input type="date" value={form.startDate} onChange={e => { setForm(prev => ({ ...prev, startDate: e.target.value })); setFieldErrors(prev => ({ ...prev, startDate: "" })); }} data-testid="input-start-date" className={fieldErrors.startDate ? "border-destructive" : ""} />
                    {fieldErrors.startDate && <p className="text-xs text-destructive mt-1" data-testid="error-start-date">{fieldErrors.startDate}</p>}
                  </div>
                  <div>
                    <Label>End Date {["experience", "internship_completion", "relieving"].includes(form.templateType) && <span className="text-destructive">*</span>}</Label>
                    <Input type="date" value={form.endDate} onChange={e => { setForm(prev => ({ ...prev, endDate: e.target.value })); setFieldErrors(prev => ({ ...prev, endDate: "" })); }} data-testid="input-end-date" className={fieldErrors.endDate ? "border-destructive" : ""} />
                    {fieldErrors.endDate && <p className="text-xs text-destructive mt-1" data-testid="error-end-date">{fieldErrors.endDate}</p>}
                  </div>
                  {showLastWorkingDay && (
                    <div>
                      <Label>Last Working Day</Label>
                      <Input type="date" value={form.lastWorkingDay} onChange={e => setForm(prev => ({ ...prev, lastWorkingDay: e.target.value }))} data-testid="input-last-working-day" />
                    </div>
                  )}
                  <div>
                    <Label>Location</Label>
                    <Input value={form.location} onChange={e => setForm(prev => ({ ...prev, location: e.target.value }))} placeholder="e.g. New Delhi" data-testid="input-location" />
                  </div>
                </>
              )}

              {isAmendmentType && isManualEntry && (
                <>
                  <div>
                    <Label>Date of Joining</Label>
                    <Input type="date" value={form.startDate} onChange={e => setForm(prev => ({ ...prev, startDate: e.target.value }))} data-testid="input-doj" />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Personal Email *</Label>
                    <Input
                      type="email"
                      value={manualEmployeeEmail}
                      onChange={e => { setManualEmployeeEmail(e.target.value); setFieldErrors(prev => ({ ...prev, manualEmail: "" })); }}
                      placeholder="employee@example.com"
                      data-testid="input-manual-email"
                      className={fieldErrors.manualEmail ? "border-destructive" : ""}
                    />
                    {fieldErrors.manualEmail && <p className="text-xs text-destructive mt-1">{fieldErrors.manualEmail}</p>}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            {isAmendmentType && (
              <>
                <div>
                  <Label>Effective Date *</Label>
                  <Input
                    type="date"
                    value={amendmentMeta.effectiveDate}
                    onChange={e => { setAmendmentMeta(prev => ({ ...prev, effectiveDate: e.target.value })); setFieldErrors(prev => ({ ...prev, effectiveDate: "" })); }}
                    data-testid="input-effective-date"
                    className={fieldErrors.effectiveDate ? "border-destructive" : ""}
                  />
                  {fieldErrors.effectiveDate && <p className="text-xs text-destructive mt-1">{fieldErrors.effectiveDate}</p>}
                </div>

                {(form.templateType === "salary_revision" || form.templateType === "combined") && (
                  <>
                    <Separator />
                    <p className="text-sm font-semibold">Salary Details</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Previous Monthly Salary (₹)</Label>
                        <Input
                          value={amendmentMeta.previousSalary}
                          onChange={e => setAmendmentMeta(prev => ({ ...prev, previousSalary: e.target.value }))}
                          placeholder="e.g. 45000"
                          data-testid="input-prev-salary"
                        />
                      </div>
                      <div>
                        <Label>New Monthly Salary (₹)</Label>
                        <Input
                          value={amendmentMeta.newSalary}
                          onChange={e => setAmendmentMeta(prev => ({ ...prev, newSalary: e.target.value }))}
                          placeholder="e.g. 55000"
                          data-testid="input-new-salary"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label>New Salary in Words</Label>
                        <Input
                          value={amendmentMeta.newSalaryInWords}
                          onChange={e => setAmendmentMeta(prev => ({ ...prev, newSalaryInWords: e.target.value }))}
                          placeholder="e.g. Fifty-Five Thousand Only"
                          data-testid="input-salary-in-words"
                        />
                      </div>
                    </div>
                  </>
                )}

                {(form.templateType === "role_change" || form.templateType === "combined") && (
                  <>
                    <Separator />
                    <p className="text-sm font-semibold">Role / Designation Details</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Previous Designation</Label>
                        <Input
                          value={amendmentMeta.previousDesignation}
                          onChange={e => setAmendmentMeta(prev => ({ ...prev, previousDesignation: e.target.value }))}
                          placeholder="e.g. Software Engineer"
                          data-testid="input-prev-designation"
                        />
                      </div>
                      <div>
                        <Label>New Designation *</Label>
                        <Input
                          value={amendmentMeta.newDesignation}
                          onChange={e => { setAmendmentMeta(prev => ({ ...prev, newDesignation: e.target.value })); setFieldErrors(prev => ({ ...prev, newDesignation: "" })); }}
                          placeholder="e.g. Senior Software Engineer"
                          data-testid="input-new-designation"
                          className={fieldErrors.newDesignation ? "border-destructive" : ""}
                        />
                        {fieldErrors.newDesignation && <p className="text-xs text-destructive mt-1">{fieldErrors.newDesignation}</p>}
                      </div>
                      <div>
                        <Label>Previous Department (optional)</Label>
                        <Input
                          value={amendmentMeta.previousDepartment}
                          onChange={e => setAmendmentMeta(prev => ({ ...prev, previousDepartment: e.target.value }))}
                          placeholder="e.g. Engineering"
                          data-testid="input-prev-department"
                        />
                      </div>
                      <div>
                        <Label>New Department (optional)</Label>
                        <Input
                          value={amendmentMeta.newDepartment}
                          onChange={e => setAmendmentMeta(prev => ({ ...prev, newDepartment: e.target.value }))}
                          placeholder="e.g. Product"
                          data-testid="input-new-department"
                        />
                      </div>
                    </div>
                  </>
                )}

                {form.templateType === "device_allocation" && (
                  <>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">Device / Asset List</p>
                      <Button type="button" size="sm" variant="outline" onClick={addDeviceItem} data-testid="btn-add-device">
                        <Plus className="h-3 w-3 mr-1" /> Add Device
                      </Button>
                    </div>
                    <div className="space-y-3">
                      {amendmentMeta.deviceItems.map((item, idx) => (
                        <div key={idx} className="border rounded-lg p-3 space-y-2" data-testid={`device-item-${idx}`}>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">Device #{idx + 1}</span>
                            {amendmentMeta.deviceItems.length > 1 && (
                              <Button type="button" size="sm" variant="ghost" onClick={() => removeDeviceItem(idx)} data-testid={`btn-remove-device-${idx}`}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="col-span-2">
                              <Label className="text-xs">Description *</Label>
                              <Input
                                value={item.description}
                                onChange={e => updateDeviceItem(idx, "description", e.target.value)}
                                placeholder="e.g. MacBook Pro 14-inch"
                                data-testid={`input-device-desc-${idx}`}
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Serial Number</Label>
                              <Input
                                value={item.serialNumber}
                                onChange={e => updateDeviceItem(idx, "serialNumber", e.target.value)}
                                placeholder="S/N"
                                data-testid={`input-device-serial-${idx}`}
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Asset Tag</Label>
                              <Input
                                value={item.assetTag}
                                onChange={e => updateDeviceItem(idx, "assetTag", e.target.value)}
                                placeholder="Asset ID"
                                data-testid={`input-device-asset-${idx}`}
                              />
                            </div>
                            <div className="col-span-2">
                              <Label className="text-xs">Condition</Label>
                              <Input
                                value={item.condition}
                                onChange={e => updateDeviceItem(idx, "condition", e.target.value)}
                                placeholder="e.g. New / Good / Refurbished"
                                data-testid={`input-device-condition-${idx}`}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {form.templateType !== "device_allocation" && (
                  <div>
                    <Label>Reason / Remarks (optional)</Label>
                    <Textarea
                      value={amendmentMeta.reason}
                      onChange={e => setAmendmentMeta(prev => ({ ...prev, reason: e.target.value }))}
                      placeholder="Optional reason for this amendment..."
                      data-testid="input-amendment-reason"
                    />
                  </div>
                )}

                <Separator />
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium">Policy Annexures (optional)</p>
                    <p className="text-xs text-muted-foreground mt-0.5 mb-3">
                      Attach Engineering Pack annexures to this amendment letter. Engineering annexures include a two-column execution/signature block in the DOCX.
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Engineering Pack</p>
                    <div className="space-y-2">
                      {([
                        { key: "eng_nda", label: "Annexure H — Confidentiality, Non-Disclosure & Proprietary Information" },
                        { key: "eng_ip", label: "Annexure I — Intellectual Property, Code Ownership & Work Product Assignment" },
                        { key: "eng_byod", label: "Annexure J — BYOD, Cloud-Only Development, Security & Data Access Policy" },
                        { key: "eng_data_protection", label: "Annexure K — Data Protection, Privacy & Client/Candidate Information Handling" },
                        { key: "eng_access_policy", label: "Annexure L — Access, Password, AI Tool & Communication Policy" },
                        { key: "eng_exit_certification", label: "Annexure M — Exit, Return, Deletion & Certification" },
                      ] as const).map(({ key, label }) => (
                        <label key={key} className="flex items-center gap-2 cursor-pointer" data-testid={`check-amendment-policy-${key}`}>
                          <input
                            type="checkbox"
                            checked={amendmentPolicyAnnexures.includes(key)}
                            onChange={e => {
                              if (e.target.checked) {
                                setAmendmentPolicyAnnexures(prev => [...prev, key]);
                              } else {
                                setAmendmentPolicyAnnexures(prev => prev.filter(k => k !== key));
                              }
                            }}
                            className="rounded border-border"
                          />
                          <span className="text-sm">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}

            {!isAmendmentType && (
              <>
                {showPerformanceBand && (
                  <div>
                    <Label>Performance Band</Label>
                    <Select value={form.performanceBand} onValueChange={v => setForm(prev => ({ ...prev, performanceBand: v }))}>
                      <SelectTrigger data-testid="select-performance-band"><SelectValue placeholder="Select performance band" /></SelectTrigger>
                      <SelectContent>
                        {PERFORMANCE_BANDS.map(b => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {showConductBand && (
                  <div>
                    <Label>Conduct Band</Label>
                    <Select value={form.conductBand} onValueChange={v => setForm(prev => ({ ...prev, conductBand: v }))}>
                      <SelectTrigger data-testid="select-conduct-band"><SelectValue placeholder="Select conduct band" /></SelectTrigger>
                      <SelectContent>
                        {CONDUCT_BANDS.map(b => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {showCompletionBand && (
                  <div>
                    <Label>Completion Band</Label>
                    <Select value={form.completionBand} onValueChange={v => setForm(prev => ({ ...prev, completionBand: v }))}>
                      <SelectTrigger data-testid="select-completion-band"><SelectValue placeholder="Select completion band" /></SelectTrigger>
                      <SelectContent>
                        {COMPLETION_BANDS.map(b => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label>Closing Line</Label>
                  <Select value={form.closingLine} onValueChange={v => setForm(prev => ({ ...prev, closingLine: v }))}>
                    <SelectTrigger data-testid="select-closing-line"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CLOSING_LINES.map(c => (
                        <SelectItem key={c.value} value={c.value}>
                          {closingSentences[c.value] || c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Include responsibilities summary</Label>
                    <Switch checked={form.includeResponsibilities} onCheckedChange={v => setForm(prev => ({ ...prev, includeResponsibilities: v }))} data-testid="switch-responsibilities" />
                  </div>
                  {form.includeResponsibilities && (
                    <div className="space-y-2">
                      {hasDbMatch ? (
                        <ResponsibilityCardSelector
                          role={matchedDbRoles[0]}
                          selected={form.responsibilitiesSummary}
                          onSelect={v => setForm(prev => ({ ...prev, responsibilitiesSummary: v }))}
                        />
                      ) : filteredResponsibilityOptions.length > 0 ? (
                        <ResponsibilityCardSelector
                          optionA={filteredResponsibilityOptions[0].options[0].text}
                          optionB={filteredResponsibilityOptions[0].options[1].text}
                          selected={form.responsibilitiesSummary}
                          onSelect={v => setForm(prev => ({ ...prev, responsibilitiesSummary: v }))}
                        />
                      ) : (
                        <div className="space-y-2">
                          {form.designation.trim() && (
                            <p className="text-xs text-muted-foreground">
                              No template found for &quot;{form.designation}&quot;. Select from all available role templates:
                            </p>
                          )}
                          <Select
                            value={form.responsibilitiesSummary}
                            onValueChange={v => setForm(prev => ({ ...prev, responsibilitiesSummary: v }))}
                          >
                            <SelectTrigger data-testid="select-all-roles-fallback">
                              <SelectValue placeholder="Select a role template..." />
                            </SelectTrigger>
                            <SelectContent>
                              {allDbRoles.length > 0
                                ? allDbRoles.filter(r => r.isActive).map((role) => (
                                    <SelectGroup key={role.id}>
                                      <SelectLabel>{role.roleLabel}</SelectLabel>
                                      <SelectItem value={role.defaultSummary} data-testid={`fallback-role-${role.roleKey}-a`}>Option A</SelectItem>
                                      <SelectItem value={role.alternateSummary} data-testid={`fallback-role-${role.roleKey}-b`}>Option B</SelectItem>
                                    </SelectGroup>
                                  ))
                                : ROLE_RESPONSIBILITY_SUMMARIES.map((role) => (
                                    <SelectGroup key={role.designation}>
                                      <SelectLabel>{role.designation}</SelectLabel>
                                      {role.options.map((opt, idx) => (
                                        <SelectItem
                                          key={`${role.designation}-${idx}`}
                                          value={opt.text}
                                          data-testid={`fallback-role-${role.designation.replace(/\s+/g, "-").toLowerCase()}-${idx}`}
                                        >
                                          {opt.label}
                                        </SelectItem>
                                      ))}
                                    </SelectGroup>
                                  ))}
                            </SelectContent>
                          </Select>
                          {form.responsibilitiesSummary && (
                            <p className="text-sm text-muted-foreground bg-muted rounded-md p-3 mt-2">{form.responsibilitiesSummary}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {showProject && (
                    <>
                      <div className="flex items-center justify-between">
                        <Label>Include internship project name</Label>
                        <Switch checked={form.includeProject} onCheckedChange={v => setForm(prev => ({ ...prev, includeProject: v }))} data-testid="switch-project" />
                      </div>
                      {form.includeProject && (
                        <Select value={form.projectName} onValueChange={v => setForm(prev => ({ ...prev, projectName: v }))}>
                          <SelectTrigger data-testid="select-project-name"><SelectValue placeholder="Select project category" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Web Application Development">Web Application Development</SelectItem>
                            <SelectItem value="Mobile Application Development">Mobile Application Development</SelectItem>
                            <SelectItem value="Data Analytics & Visualization">Data Analytics & Visualization</SelectItem>
                            <SelectItem value="Machine Learning & AI">Machine Learning & AI</SelectItem>
                            <SelectItem value="Cloud Infrastructure & DevOps">Cloud Infrastructure & DevOps</SelectItem>
                            <SelectItem value="UI/UX Design & Research">UI/UX Design & Research</SelectItem>
                            <SelectItem value="Quality Assurance & Automation">Quality Assurance & Automation</SelectItem>
                            <SelectItem value="Business Process Automation">Business Process Automation</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </>
                  )}
                  <div className="flex items-center justify-between">
                    <Label>Include company seal</Label>
                    <Switch checked={form.includeSeal} onCheckedChange={v => setForm(prev => ({ ...prev, includeSeal: v }))} data-testid="switch-seal" />
                  </div>
                </div>
                {isAdmin && (
                  <>
                    <Separator />
                    <div>
                      <Label className="text-amber-600">Custom Paragraph Override (Admin Only)</Label>
                      <Textarea placeholder="Optional custom paragraph..." value={form.customOverrideText} onChange={e => setForm(prev => ({ ...prev, customOverrideText: e.target.value }))} className="mt-1" data-testid="input-custom-override" />
                    </div>
                  </>
                )}
              </>
            )}

            <AnnexureEditor annexures={annexures} onChange={setAnnexures} effectiveDate={amendmentMeta.effectiveDate || undefined} />
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div>
              <Label>Signatory</Label>
              <Select value={form.signatoryId} onValueChange={v => {
                const emp = signatoryOptions.find((e) => e.id === v);
                if (emp) selectSignatory(emp);
              }}>
                <SelectTrigger data-testid="select-signatory"><SelectValue placeholder="Select signatory" /></SelectTrigger>
                <SelectContent>
                  {signatoryOptions.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName} — {e.designation || e.role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Signatory Name</Label>
                <Input value={form.signatoryName} readOnly disabled className="bg-muted" data-testid="input-signatory-name" />
              </div>
              <div>
                <Label>Signatory Designation</Label>
                <Input value={form.signatoryDesignation} readOnly disabled className="bg-muted" data-testid="input-signatory-designation" />
              </div>
            </div>
            {!isAmendmentType && (
              <div>
                <Label>Issue Date</Label>
                <Input type="date" value={form.issueDate} onChange={e => setForm(prev => ({ ...prev, issueDate: e.target.value }))} data-testid="input-issue-date" />
              </div>
            )}

            {isAmendmentType && (
              <div className="bg-muted rounded-lg p-4 space-y-2 text-sm">
                <p className="font-semibold">Summary</p>
                <p><span className="text-muted-foreground">Employee:</span> {form.employeeName}</p>
                <p><span className="text-muted-foreground">Current Designation:</span> {form.designation}</p>
                {form.department && <p><span className="text-muted-foreground">Department:</span> {form.department}</p>}
                <p><span className="text-muted-foreground">Effective Date:</span> {amendmentMeta.effectiveDate}</p>
                {(form.templateType === "salary_revision" || form.templateType === "combined") && amendmentMeta.newSalary && (
                  <p><span className="text-muted-foreground">New Monthly Salary:</span> ₹{amendmentMeta.newSalary}</p>
                )}
                {(form.templateType === "role_change" || form.templateType === "combined") && amendmentMeta.newDesignation && (
                  <p><span className="text-muted-foreground">New Designation:</span> {amendmentMeta.newDesignation}</p>
                )}
                {form.templateType === "device_allocation" && (
                  <p><span className="text-muted-foreground">Devices:</span> {amendmentMeta.deviceItems.filter(d => d.description).length} item(s)</p>
                )}
              </div>
            )}

            <Separator />

            {isAmendmentType && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <Label>Send to employee email</Label>
                  </div>
                  <Switch checked={sendEmail} onCheckedChange={setSendEmail} data-testid="switch-send-email" />
                </div>
                {sendEmail && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Sending to:</Label>
                    <Input value={employeeEmail} readOnly className="bg-muted text-sm mt-1" data-testid="input-email-preview" />
                    {!employeeEmail && (
                      <p className="text-xs text-amber-600 mt-1">No email found — enter email in the employee step first.</p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1">
              <Label>CC Recipients <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
              <Input
                value={ccEmails}
                onChange={e => setCcEmails(e.target.value)}
                placeholder="manager@hire-in.com, ceo@hire-in.com"
                data-testid="input-cc-emails"
              />
              <p className="text-xs text-muted-foreground">Separate multiple emails with commas</p>
            </div>

            {!isAmendmentType && (
              <Button variant="outline" onClick={() => setShowPreview(true)} data-testid="btn-preview-letter">
                <Eye className="h-4 w-4 mr-2" /> Preview Letter
              </Button>
            )}
          </div>
        )}

        <div className="flex justify-between mt-6">
          <Button variant="outline" onClick={() => { setStep(s => s - 1); setFieldErrors({}); }} disabled={step === 0} data-testid="btn-prev-step">
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          {step < steps.length - 1 ? (
            <Button onClick={handleNext} disabled={step !== 1 && step !== 2 && !canNext()} data-testid="btn-next-step">
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={!canNext() || createMutation.isPending || editMutation.isPending} data-testid="btn-create-letter">
              {(createMutation.isPending || editMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingLetter ? "Resubmit Letter" : isAmendmentType ? "Generate DOCX" : "Create Letter"}
            </Button>
          )}
        </div>

        <Sheet open={showPreview} onOpenChange={setShowPreview}>
          <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Letter Preview</SheetTitle>
              <SheetDescription>Preview of the letter before creation</SheetDescription>
            </SheetHeader>
            <div className="mt-4">
              <LetterPreview letter={form} sentencesOverride={sentencesOverride} />
            </div>
          </SheetContent>
        </Sheet>
      </CardContent>
    </Card>
    </>
  );
}

interface ResponsibilityCardSelectorProps {
  role?: RoleSummaryTemplate;
  optionA?: string;
  optionB?: string;
  selected: string;
  onSelect: (text: string) => void;
}

function ResponsibilityCardSelector({ role, optionA, optionB, selected, onSelect }: ResponsibilityCardSelectorProps) {
  const textA = role ? role.defaultSummary : optionA || "";
  const textB = role ? role.alternateSummary : optionB || "";

  return (
    <div className="space-y-3" data-testid="responsibility-card-selector">
      <p className="text-xs text-muted-foreground">Select a responsibilities summary for the letter:</p>
      <div className="grid grid-cols-1 gap-3">
        <button
          type="button"
          onClick={() => onSelect(textA)}
          data-testid="card-responsibility-option-a"
          className={`text-left p-4 rounded-lg border-2 transition-all ${selected === textA ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
        >
          <div className="flex items-start gap-2">
            <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${selected === textA ? "border-primary bg-primary" : "border-muted-foreground"}`}>
              {selected === textA && <CheckCircle className="h-3 w-3 text-primary-foreground" />}
            </div>
            <div>
              <p className="font-semibold text-sm mb-1">Option A</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{textA}</p>
            </div>
          </div>
        </button>
        <button
          type="button"
          onClick={() => onSelect(textB)}
          data-testid="card-responsibility-option-b"
          className={`text-left p-4 rounded-lg border-2 transition-all ${selected === textB ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
        >
          <div className="flex items-start gap-2">
            <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${selected === textB ? "border-primary bg-primary" : "border-muted-foreground"}`}>
              {selected === textB && <CheckCircle className="h-3 w-3 text-primary-foreground" />}
            </div>
            <div>
              <p className="font-semibold text-sm mb-1">Option B</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{textB}</p>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
