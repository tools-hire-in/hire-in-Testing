import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  FileText, Loader2, Search, ChevronRight, ChevronLeft, Eye,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { LetterPreview } from "./LetterPreview";
import type { AdminUser } from "@shared/schema";
import {
  PERFORMANCE_BANDS,
  CONDUCT_BANDS,
  COMPLETION_BANDS,
  CLOSING_LINES,
  PERFORMANCE_BAND_SENTENCES,
  CONDUCT_BAND_SENTENCES,
  COMPLETION_BAND_SENTENCES,
  CLOSING_LINE_SENTENCES,
  TEMPLATE_LABELS,
  ROLE_RESPONSIBILITY_SUMMARIES,
} from "@shared/hrLetterConstants";

const TEMPLATE_OPTIONS = Object.entries(TEMPLATE_LABELS).map(([value, label]) => ({ value, label }));

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

export function LetterGenerator() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>({ ...defaultForm });
  const [showPreview, setShowPreview] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [showBrowseTemplates, setShowBrowseTemplates] = useState(false);

  const isAdmin = user?.role === "super_admin" || user?.role === "admin";

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

  const filteredEmployees = useMemo(() => {
    if (!employeeSearch) return employees.slice(0, 20);
    const s = employeeSearch.toLowerCase();
    return employees.filter((e) =>
      `${e.firstName} ${e.lastName}`.toLowerCase().includes(s) ||
      e.employeeId?.toLowerCase().includes(s) ||
      e.email?.toLowerCase().includes(s)
    ).slice(0, 20);
  }, [employees, employeeSearch]);

  const filteredResponsibilityOptions = useMemo(() => {
    const designation = form.designation.trim().toLowerCase();
    if (!designation) return [] as typeof ROLE_RESPONSIBILITY_SUMMARIES;
    return ROLE_RESPONSIBILITY_SUMMARIES.filter(
      (r) => r.designation.toLowerCase() === designation
    );
  }, [form.designation]);

  useEffect(() => {
    setShowBrowseTemplates(false);
    if (!form.responsibilitiesSummary) return;
    if (filteredResponsibilityOptions.length === 0) return;
    const allTexts = filteredResponsibilityOptions.flatMap((r) => r.options.map((o) => o.text));
    if (!allTexts.includes(form.responsibilitiesSummary)) {
      setForm((prev) => ({ ...prev, responsibilitiesSummary: "" }));
    }
  }, [form.designation]);

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

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("POST", "/api/hr/letters", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Letter created", description: "Draft letter has been saved successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/letters"] });
      setForm({ ...defaultForm });
      setStep(0);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  function selectEmployee(emp: AdminUser) {
    setForm(prev => ({
      ...prev,
      employeeId: emp.id,
      employeeName: `${emp.firstName} ${emp.lastName}`,
      employeeCode: emp.employeeId || "",
      designation: emp.designation || "",
      department: emp.departmentId ? deptMap[emp.departmentId] || "" : "",
      employmentType: (emp as any).employmentType || "",
      location: (emp as any).location || "",
      reportingManager: emp.managerId
        ? employees.find((e: AdminUser) => e.id === emp.managerId)
          ? `${employees.find((e: AdminUser) => e.id === emp.managerId)!.firstName} ${employees.find((e: AdminUser) => e.id === emp.managerId)!.lastName}`
          : ""
        : "",
      startDate: emp.joiningDate || "",
    }));
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

  const showPerformanceBand = ["experience", "internship_completion"].includes(form.templateType);
  const showConductBand = ["experience"].includes(form.templateType);
  const showCompletionBand = ["internship_completion", "internship_certificate"].includes(form.templateType);
  const showProject = ["internship_completion"].includes(form.templateType);
  const showLastWorkingDay = ["relieving"].includes(form.templateType);
  const isIntern = ["internship_completion", "internship_certificate"].includes(form.templateType);

  const steps = [
    { title: "Template", subtitle: "Select document type" },
    { title: "Employee", subtitle: isIntern ? "Select intern" : "Select employee" },
    { title: "Details", subtitle: "Bands & options" },
    { title: "Signatory", subtitle: "Review & create" },
  ];

  function canNext() {
    if (step === 0) return !!form.templateType;
    if (step === 1) return !!form.employeeId && !!form.employeeName && !!form.designation && !!form.startDate;
    if (step === 2) return true;
    return !!form.signatoryName;
  }

  function handleSubmit() {
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
    createMutation.mutate(payload);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2" data-testid="text-letter-generator-title">
          <FileText className="h-5 w-5" />
          Letter Generator
        </CardTitle>
      </CardHeader>
      <CardContent>
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
            <Label>Document Type</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {TEMPLATE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  data-testid={`btn-template-${opt.value}`}
                  onClick={() => setForm(prev => ({ ...prev, templateType: opt.value }))}
                  className={`p-4 rounded-lg border text-left transition-colors ${form.templateType === opt.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                >
                  <div className="font-medium">{opt.label}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <Label>Search {isIntern ? "Intern" : "Employee"}</Label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, ID, or email..."
                  value={employeeSearch}
                  onChange={e => setEmployeeSearch(e.target.value)}
                  className="pl-9"
                  data-testid="input-employee-search"
                />
              </div>
              {employeeSearch && filteredEmployees.length > 0 && (
                <div className="border rounded-md mt-1 max-h-48 overflow-y-auto">
                  {filteredEmployees.map((emp) => (
                    <button
                      key={emp.id}
                      onClick={() => selectEmployee(emp)}
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
            <Separator />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Full Name *</Label>
                <Input value={form.employeeName} readOnly={!!form.employeeId} className={form.employeeId ? "bg-muted" : ""} onChange={e => { if (!form.employeeId) setForm(prev => ({ ...prev, employeeName: e.target.value })); }} data-testid="input-employee-name" />
                {form.employeeId && <p className="text-xs text-muted-foreground mt-1">Auto-filled from employee record</p>}
              </div>
              <div>
                <Label>{isIntern ? "Intern" : "Employee"} ID</Label>
                <Input value={form.employeeCode} readOnly={!!form.employeeId} className={form.employeeId ? "bg-muted" : ""} onChange={e => { if (!form.employeeId) setForm(prev => ({ ...prev, employeeCode: e.target.value })); }} data-testid="input-employee-code" />
              </div>
              <div>
                <Label>Designation *</Label>
                <Input value={form.designation} readOnly={!!form.employeeId} className={form.employeeId ? "bg-muted" : ""} onChange={e => { if (!form.employeeId) setForm(prev => ({ ...prev, designation: e.target.value })); }} data-testid="input-designation" />
              </div>
              <div>
                <Label>Department</Label>
                <Input value={form.department} readOnly={!!form.employeeId} className={form.employeeId ? "bg-muted" : ""} onChange={e => { if (!form.employeeId) setForm(prev => ({ ...prev, department: e.target.value })); }} data-testid="input-department" />
              </div>
              <div>
                <Label>Start Date *</Label>
                <Input type="date" value={form.startDate} onChange={e => setForm(prev => ({ ...prev, startDate: e.target.value }))} data-testid="input-start-date" />
              </div>
              <div>
                <Label>End Date</Label>
                <Input type="date" value={form.endDate} onChange={e => setForm(prev => ({ ...prev, endDate: e.target.value }))} data-testid="input-end-date" />
              </div>
              {showLastWorkingDay && (
                <div>
                  <Label>Last Working Day</Label>
                  <Input type="date" value={form.lastWorkingDay} onChange={e => setForm(prev => ({ ...prev, lastWorkingDay: e.target.value }))} data-testid="input-last-working-day" />
                </div>
              )}
              <div>
                <Label>Location</Label>
                <Input value={form.location} readOnly={!!form.employeeId} disabled={!!form.employeeId} className={form.employeeId ? "bg-muted" : ""} data-testid="input-location" />
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
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
                  {CLOSING_LINES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
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
                  {filteredResponsibilityOptions.length > 0 ? (
                    <>
                      <Select
                        value={form.responsibilitiesSummary}
                        onValueChange={v => setForm(prev => ({ ...prev, responsibilitiesSummary: v }))}
                      >
                        <SelectTrigger data-testid="select-responsibilities">
                          <SelectValue placeholder="Select an option" />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredResponsibilityOptions.flatMap((role) =>
                            role.options.map((opt, idx) => (
                              <SelectItem
                                key={`${role.designation}-${idx}`}
                                value={opt.text}
                                data-testid={`responsibilities-option-${role.designation.replace(/\s+/g, "-").toLowerCase()}-${idx}`}
                              >
                                {filteredResponsibilityOptions.length === 1
                                  ? opt.label
                                  : `${role.designation} — ${opt.label}`}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      {form.responsibilitiesSummary && (
                        <p className="text-xs text-muted-foreground bg-muted rounded p-2 leading-relaxed">
                          {form.responsibilitiesSummary}
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <Textarea
                        placeholder="Describe the employee's responsibilities..."
                        value={form.responsibilitiesSummary}
                        onChange={e => setForm(prev => ({ ...prev, responsibilitiesSummary: e.target.value }))}
                        data-testid="textarea-responsibilities"
                        rows={4}
                      />
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowBrowseTemplates(prev => !prev)}
                          data-testid="button-browse-templates"
                        >
                          {showBrowseTemplates ? "Hide templates" : "Browse all templates"}
                        </Button>
                      </div>
                      {showBrowseTemplates && (
                        <Select
                          value={form.responsibilitiesSummary}
                          onValueChange={v => setForm(prev => ({ ...prev, responsibilitiesSummary: v }))}
                        >
                          <SelectTrigger data-testid="select-responsibilities-browse">
                            <SelectValue placeholder="Pick from templates" />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLE_RESPONSIBILITY_SUMMARIES.map((role) => (
                              <SelectGroup key={role.designation}>
                                <SelectLabel>{role.designation}</SelectLabel>
                                {role.options.map((opt, idx) => (
                                  <SelectItem
                                    key={`${role.designation}-${idx}`}
                                    value={opt.text}
                                    data-testid={`responsibilities-browse-${role.designation.replace(/\s+/g, "-").toLowerCase()}-${idx}`}
                                  >
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </>
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
            <div>
              <Label>Issue Date</Label>
              <Input type="date" value={form.issueDate} onChange={e => setForm(prev => ({ ...prev, issueDate: e.target.value }))} data-testid="input-issue-date" />
            </div>
            <Separator />
            <Button variant="outline" onClick={() => setShowPreview(true)} data-testid="btn-preview-letter">
              <Eye className="h-4 w-4 mr-2" /> Preview Letter
            </Button>
          </div>
        )}

        <div className="flex justify-between mt-6">
          <Button variant="outline" onClick={() => setStep(s => s - 1)} disabled={step === 0} data-testid="btn-prev-step">
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          {step < steps.length - 1 ? (
            <Button onClick={() => setStep(s => s + 1)} disabled={!canNext()} data-testid="btn-next-step">
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={!canNext() || createMutation.isPending} data-testid="btn-create-letter">
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Draft Letter
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
              <LetterPreview letter={form} />
            </div>
          </SheetContent>
        </Sheet>
      </CardContent>
    </Card>
  );
}
