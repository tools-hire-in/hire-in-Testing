import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { V2PageHeader } from "@/components/admin/V2PageHeader";
import { useNewLook } from "@/hooks/use-new-look";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  Calculator, MapPin, Search, AlertTriangle, CheckCircle, TrendingUp,
  Copy, Save, Send, Info,
  DollarSign, Plus, Edit, AlertCircle, RefreshCw, FileDown
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

const ROLE_TYPES = [
  { value: "healthcare_travel", label: "Healthcare Travel (RN, Allied)" },
  { value: "it_engineering", label: "IT / Engineering" },
  { value: "professional_services", label: "Professional Services" },
];

const MONTHS = [
  { value: 1, label: "January" }, { value: 2, label: "February" }, { value: 3, label: "March" },
  { value: 4, label: "April" }, { value: 5, label: "May" }, { value: 6, label: "June" },
  { value: 7, label: "July" }, { value: 8, label: "August" }, { value: 9, label: "September" },
  { value: 10, label: "October" }, { value: 11, label: "November" }, { value: 12, label: "December" },
];

function fmt(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  if (isNaN(v)) return "$0.00";
  return v.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtPct(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  if (isNaN(v)) return "0.00%";
  return v.toFixed(2) + "%";
}
function num(v: string | number | null | undefined): number {
  return parseFloat(String(v ?? "0")) || 0;
}

interface CalcState {
  candidateName: string;
  facilityClientName: string;
  weeksInAssignment: string;
  assignmentZip: string;
  month: number;
  year: number;
  roleType: string;
  dailyMie: string;
  dailyLodging: string;
  awayDays: string;
  decreasedStipendOverride: string;
  w2Hourly: string;
  totalHours: string;
  otMultiplier: string;
  masterBillRate: string;
  otBillRate: string;
  clientOtMultiplier: string;
  vmsFeePct: string;
  orientationHoursTotal: string;
  orientationHoursBillable: string;
  orientationPayRate: string;
  orientationOtMultiplier: string;
  completionBonus: string;
  payrollBurdenPct: string;
  onCallRate: string;
  callbackRate: string;
  holidayRate: string;
  gsaSnapshotId: string;
  city: string;
  state: string;
  county: string;
}

interface CalcOutputs {
  billAfterVms: number;
  orientationRevenue: number;
  orientationCandidateCost: number;
  orientationNet: number;
  regularBilling: number;
  otBilling: number;
  totalBillingWeekly: number;
  totalBillingContract: number;
  wagePayableWeekly: number;
  payrollTaxesWeekly: number;
  weeklyNonTaxable: number;
  gsaCapWeekly: number;
  stipendCompliance: "compliant" | "over_cap";
  totalExpenseWeekly: number;
  totalExpenseContract: number;
  grossProfitWeekly: number;
  netMarginPct: number;
  netMarginPerHour: number;
  netMarginPerWeek: number;
  netMarginPerContract: number;
  marginStatus: "green" | "yellow" | "red";
  weeklyGross: number;
  weeklyTaxable: number;
  weeklyNonTaxableOut: number;
  hourlyTaxable: number;
  hourlyBlended: number;
  otRate: number;
  callbackRateOut: number;
  holidayRateOut: number;
  onCallRateOut: number;
}

function defaultState(): CalcState {
  const now = new Date();
  return {
    candidateName: "",
    facilityClientName: "",
    weeksInAssignment: "13",
    assignmentZip: "",
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    roleType: "healthcare_travel",
    dailyMie: "",
    dailyLodging: "",
    awayDays: "5",
    decreasedStipendOverride: "",
    w2Hourly: "",
    totalHours: "36",
    otMultiplier: "1.5",
    masterBillRate: "",
    otBillRate: "",
    clientOtMultiplier: "1.5",
    vmsFeePct: "3",
    orientationHoursTotal: "0",
    orientationHoursBillable: "0",
    orientationPayRate: "",
    orientationOtMultiplier: "1",
    completionBonus: "0",
    payrollBurdenPct: "18.8",
    onCallRate: "0",
    callbackRate: "0",
    holidayRate: "0",
    gsaSnapshotId: "",
    city: "",
    state: "",
    county: "",
  };
}

function MarginBadge({ status, pct }: { status: string; pct: number }) {
  if (status === "green") return <Badge className="bg-green-600 text-white text-lg px-3 py-1">{fmtPct(pct)}</Badge>;
  if (status === "yellow") return <Badge className="bg-yellow-500 text-white text-lg px-3 py-1">{fmtPct(pct)}</Badge>;
  return <Badge className="bg-red-600 text-white text-lg px-3 py-1">{fmtPct(pct)}</Badge>;
}

function RowTable({ rows, className }: { rows: { label: string; weekly?: string; contract?: string; highlight?: boolean; negative?: boolean }[]; className?: string }) {
  return (
    <div className={`rounded-lg border overflow-hidden ${className ?? ""}`}>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 border-b">
            <th className="text-left p-2 pl-3 font-medium text-muted-foreground">Item</th>
            <th className="text-right p-2 font-medium text-muted-foreground">Per Week</th>
            <th className="text-right p-2 pr-3 font-medium text-muted-foreground">Per Contract</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={`border-b last:border-0 ${r.highlight ? "bg-primary/5 font-semibold" : ""} ${r.negative ? "text-red-600" : ""}`}>
              <td className="p-2 pl-3">{r.label}</td>
              <td className="text-right p-2">{r.weekly ?? "—"}</td>
              <td className="text-right p-2 pr-3">{r.contract ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function TravelCalculator() {
  const { user } = useAuth();
  const { enabled: newLook } = useNewLook();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isAdmin = ["super_admin", "admin", "hr"].includes(user?.role ?? "");

  const [tab, setTab] = useState("new");
  const [form, setForm] = useState<CalcState>(defaultState());
  const [outputs, setOutputs] = useState<CalcOutputs | null>(null);
  const [gsaLoading, setGsaLoading] = useState(false);
  const [gsaError, setGsaError] = useState<string | null>(null);
  const [gsaSource, setGsaSource] = useState<string | null>(null);
  const [savedQuoteId, setSavedQuoteId] = useState<string | null>(null);
  const [overrideModal, setOverrideModal] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const [marginFloors, setMarginFloors] = useState<Record<string, any>>({});

  const { data: quotesData, isLoading: quotesLoading } = useQuery<any[]>({
    queryKey: ["/api/travel/quotes"],
    queryFn: async () => {
      const res = await fetch("/api/travel/quotes", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: tab === "list",
  });

  useEffect(() => {
    fetch("/api/travel/margin-floors", { credentials: "include" })
      .then(r => r.json())
      .then((floors: any[]) => {
        const m: Record<string, any> = {};
        for (const f of floors) m[f.roleType] = f;
        setMarginFloors(m);
      })
      .catch(() => {});
  }, []);

  const calcOutputs = useCallback(async (f: CalcState) => {
    try {
      const res = await fetch("/api/travel/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          w2Hourly: num(f.w2Hourly),
          totalHours: num(f.totalHours),
          otMultiplier: num(f.otMultiplier),
          masterBillRate: num(f.masterBillRate),
          otBillRate: num(f.otBillRate),
          clientOtMultiplier: num(f.clientOtMultiplier),
          vmsFeePct: num(f.vmsFeePct),
          weeksInAssignment: num(f.weeksInAssignment),
          awayDays: num(f.awayDays),
          dailyLodging: num(f.dailyLodging),
          dailyMie: num(f.dailyMie),
          firstLastDayMie: num(f.dailyMie) * 0.75,
          decreasedStipendOverride: f.decreasedStipendOverride !== "" ? num(f.decreasedStipendOverride) : null,
          orientationHoursTotal: num(f.orientationHoursTotal),
          orientationHoursBillable: num(f.orientationHoursBillable),
          orientationPayRate: f.orientationPayRate !== "" ? num(f.orientationPayRate) : num(f.w2Hourly),
          orientationOtMultiplier: num(f.orientationOtMultiplier),
          completionBonus: num(f.completionBonus),
          payrollBurdenPct: num(f.payrollBurdenPct),
          onCallRate: num(f.onCallRate),
          callbackRate: num(f.callbackRate),
          holidayRate: num(f.holidayRate),
          roleType: f.roleType,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setOutputs(data);
      }
    } catch { }
  }, []);

  useEffect(() => {
    if (num(form.w2Hourly) > 0 && num(form.masterBillRate) > 0) {
      const timeout = setTimeout(() => calcOutputs(form), 400);
      return () => clearTimeout(timeout);
    }
  }, [form, calcOutputs]);

  function setField(key: keyof CalcState, val: string | number) {
    setForm(prev => ({ ...prev, [key]: String(val) }));
  }

  async function lookupGsa() {
    if (!form.assignmentZip || !form.month || !form.year) {
      toast({ title: "Enter ZIP, month, and year first", variant: "destructive" });
      return;
    }
    setGsaLoading(true);
    setGsaError(null);
    try {
      const res = await fetch("/api/travel/gsa-rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ zip: form.assignmentZip, month: form.month, year: form.year }),
      });
      if (!res.ok) {
        const d = await res.json();
        setGsaError(d.error || "GSA rate not found");
        return;
      }
      const data = await res.json();
      setForm(prev => ({
        ...prev,
        dailyMie: String(data.mieRate),
        dailyLodging: String(data.lodgingRate),
        gsaSnapshotId: data.snapshotId,
        city: data.city || "",
        state: data.state || "",
        county: data.county || "",
      }));
      setGsaSource(`${data.sourceVersion ?? "GSA"} · ${data.city ?? ""}${data.state ? `, ${data.state}` : ""} · ${data.isCached ? "Cached" : "Live"}`);
    } catch {
      setGsaError("Failed to fetch GSA rate");
    } finally {
      setGsaLoading(false);
    }
  }

  const gsaCapWeekly = (num(form.dailyLodging) + num(form.dailyMie)) * num(form.awayDays);
  // Raw proposed value — NOT clamped, so over_cap is detectable
  const stipendProposedWeekly = form.decreasedStipendOverride !== "" ? num(form.decreasedStipendOverride) : gsaCapWeekly;
  const stipendOverCap = gsaCapWeekly > 0 && stipendProposedWeekly > gsaCapWeekly;

  const buildSaveBody = (overrideReason?: string) => ({
    candidateName: form.candidateName,
    facilityClientName: form.facilityClientName,
    assignmentZip: form.assignmentZip,
    state: form.state,
    county: form.county,
    city: form.city,
    roleType: form.roleType,
    weeksInAssignment: num(form.weeksInAssignment),
    month: form.month,
    year: form.year,
    awayDays: num(form.awayDays),
    scheduledHours: num(form.totalHours),
    w2Hourly: num(form.w2Hourly),
    otMultiplier: num(form.otMultiplier),
    totalHours: num(form.totalHours),
    masterBillRate: num(form.masterBillRate),
    otBillRate: form.otBillRate !== "" ? num(form.otBillRate) : null,
    clientOtMultiplier: num(form.clientOtMultiplier),
    vmsFeePct: num(form.vmsFeePct),
    orientationHoursTotal: num(form.orientationHoursTotal),
    orientationHoursBillable: num(form.orientationHoursBillable),
    orientationHoursFree: Math.max(0, num(form.orientationHoursTotal) - num(form.orientationHoursBillable)),
    orientationPayRate: form.orientationPayRate !== "" ? num(form.orientationPayRate) : num(form.w2Hourly),
    orientationOtMultiplier: num(form.orientationOtMultiplier),
    completionBonus: num(form.completionBonus),
    dailyMie: form.dailyMie !== "" ? num(form.dailyMie) : null,
    dailyLodging: form.dailyLodging !== "" ? num(form.dailyLodging) : null,
    decreasedStipendOverride: form.decreasedStipendOverride !== "" ? num(form.decreasedStipendOverride) : null,
    payrollBurdenPct: num(form.payrollBurdenPct),
    onCallRate: num(form.onCallRate),
    callbackRate: num(form.callbackRate),
    holidayRate: num(form.holidayRate),
    gsaSnapshotId: form.gsaSnapshotId || null,
    ...(overrideReason ? { overrideReason } : {}),
  });

  const saveMutation = useMutation({
    mutationFn: async (overrideReason?: string) => {
      const body = buildSaveBody(overrideReason);
      const url = editingQuoteId ? `/api/travel/quotes/${editingQuoteId}` : "/api/travel/quotes";
      const method = editingQuoteId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to save" }));
        throw new Error(err.error || "Failed to save quote");
      }
      return res.json() as Promise<{ quote: any; outputs: any }>;
    },
    onSuccess: (data) => {
      if (data.quote?.id) setSavedQuoteId(data.quote.id);
      if (!editingQuoteId && data.quote?.id) setEditingQuoteId(data.quote.id);
      toast({ title: "Quote saved" });
      qc.invalidateQueries({ queryKey: ["/api/travel/quotes"] });
    },
    onError: (e: any) => toast({ title: e?.message || "Failed to save quote", variant: "destructive" }),
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!savedQuoteId && !editingQuoteId) throw new Error("Save first");
      const id = editingQuoteId || savedQuoteId;
      return apiRequest("POST", `/api/travel/quotes/${id}/submit`, {});
    },
    onSuccess: () => {
      toast({ title: "Quote submitted for review" });
      qc.invalidateQueries({ queryKey: ["/api/travel/quotes"] });
    },
    onError: (e: any) => toast({ title: e?.message || "Failed to submit", variant: "destructive" }),
  });

  const overrideMutation = useMutation({
    mutationFn: async () => {
      return saveMutation.mutateAsync(overrideReason);
    },
    onSuccess: () => {
      toast({ title: "Quote saved with compliance override request" });
      setOverrideModal(false);
      setOverrideReason("");
    },
    onError: (e: any) => toast({ title: e?.message || "Failed to save override", variant: "destructive" }),
  });

  function copyToClipboard() {
    if (!outputs) return;
    const loc = [form.city, form.state].filter(Boolean).join(", ") || form.assignmentZip;
    const text = `📋 Your Estimated Travel Pay Package
Facility: ${form.facilityClientName || "—"}
Location: ${loc}
Assignment: ${form.weeksInAssignment} weeks | ${form.totalHours} hrs/week

Estimated Weekly Pay
─────────────────────────────
Weekly Gross:         ${fmt(outputs.weeklyGross)}
  Weekly Taxable:     ${fmt(outputs.weeklyTaxable)}
  Weekly Non-Taxable: ${fmt(outputs.weeklyNonTaxableOut)}

Hourly Rates
─────────────────────────────
Hourly Taxable:       ${fmt(outputs.hourlyTaxable)}
Hourly Blended:       ${fmt(outputs.hourlyBlended)}
Overtime:             ${fmt(outputs.otRate)}
Call Back:            ${fmt(outputs.callbackRateOut)}
Holiday Pay:          ${fmt(outputs.holidayRateOut)}
On Call:              ${fmt(outputs.onCallRateOut)}

Note: Non-taxable amounts are per diem reimbursements
based on GSA rates for your assignment location and
are subject to IRS accountable plan requirements.`;

    navigator.clipboard.writeText(text).then(() => {
      toast({ title: "Copied to clipboard!" });
    }).catch(() => {
      toast({ title: "Copy failed — please copy manually", variant: "destructive" });
    });
  }

  function loadQuote(item: any) {
    const q = item.quote;
    setForm({
      candidateName: q.candidateName || "",
      facilityClientName: q.facilityClientName || "",
      weeksInAssignment: String(q.weeksInAssignment || "13"),
      assignmentZip: q.assignmentZip || "",
      month: q.month || new Date().getMonth() + 1,
      year: q.year || new Date().getFullYear(),
      roleType: q.roleType || "healthcare_travel",
      dailyMie: q.dailyMie || "",
      dailyLodging: q.dailyLodging || "",
      awayDays: String(q.awayDays || "5"),
      decreasedStipendOverride: q.decreasedStipendOverride || "",
      w2Hourly: q.w2Hourly || "",
      totalHours: q.totalHours || "36",
      otMultiplier: q.otMultiplier || "1.5",
      masterBillRate: q.masterBillRate || "",
      otBillRate: q.otBillRate || "",
      clientOtMultiplier: q.clientOtMultiplier || "1.5",
      vmsFeePct: q.vmsFeePct || "3",
      orientationHoursTotal: q.orientationHoursTotal || "0",
      orientationHoursBillable: q.orientationHoursBillable || "0",
      orientationPayRate: q.orientationPayRate || "",
      orientationOtMultiplier: q.orientationOtMultiplier || "1",
      completionBonus: q.completionBonus || "0",
      payrollBurdenPct: q.payrollBurdenPct || "18.8",
      onCallRate: q.onCallRate || "0",
      callbackRate: q.callbackRate || "0",
      holidayRate: q.holidayRate || "0",
      gsaSnapshotId: q.gsaSnapshotId || "",
      city: q.city || "",
      state: q.state || "",
      county: q.county || "",
    });
    setEditingQuoteId(q.id);
    setSavedQuoteId(q.id);
    if (item.outputs) {
      setOutputs(item.outputs);
    }
    setTab("new");
  }

  function resetForm() {
    setForm(defaultState());
    setOutputs(null);
    setSavedQuoteId(null);
    setEditingQuoteId(null);
    setGsaSource(null);
    setGsaError(null);
  }

  const freeHours = Math.max(0, num(form.orientationHoursTotal) - num(form.orientationHoursBillable));

  const thisMonthQuotes = quotesData?.length ?? 0;
  const avgMargin = quotesData && quotesData.length > 0
    ? quotesData.reduce((s: number, q: any) => s + num(q.outputs?.netMarginPct), 0) / quotesData.length
    : 0;
  const belowFloor = quotesData?.filter((q: any) => q.outputs?.marginStatus === "red").length ?? 0;
  const complianceFlags = quotesData?.filter((q: any) => q.outputs?.stipendComplianceStatus === "over_cap" || q.outputs?.stipendComplianceStatus === "override_pending").length ?? 0;

  return (
    <AdminLayout>
      <div className="p-6 space-y-6 max-w-[1400px] mx-auto v2-surface">
        {newLook ? (
          <V2PageHeader
            icon={Calculator}
            eyebrow="Finance"
            title="Travel Pay Calculator"
            subtitle="GSA per diem · IRS accountable plan · Blended rate engine"
          />
        ) : (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Calculator className="h-6 w-6 text-primary" />
              Travel Pay Calculator
            </h1>
            <p className="text-muted-foreground text-sm mt-1">GSA per diem · IRS accountable plan · Blended rate engine</p>
          </div>
          <div className="flex gap-2">
            {editingQuoteId && (
              <Button variant="outline" size="sm" onClick={resetForm}>
                <Plus className="h-4 w-4 mr-1" /> New Quote
              </Button>
            )}
          </div>
        </div>
        )}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="new" data-testid="tab-new-quote">
              {editingQuoteId ? "Edit Quote" : "New Quote"}
            </TabsTrigger>
            <TabsTrigger value="list" data-testid="tab-my-quotes">My Quotes</TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="settings" data-testid="tab-settings">Settings</TabsTrigger>
            )}
          </TabsList>

          {/* ═══════════════════════════════════ NEW QUOTE TAB ═══════════════════════════════════ */}
          <TabsContent value="new" className="space-y-5 mt-4">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
              {/* LEFT: INPUTS */}
              <div className="xl:col-span-2 space-y-5">

                {/* BASIC INFORMATION */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Basic Information</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 sm:col-span-1">
                      <Label>Candidate Name</Label>
                      <Input data-testid="input-candidate-name" value={form.candidateName} onChange={e => setField("candidateName", e.target.value)} placeholder="John Smith" />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <Label>Facility / Client Name</Label>
                      <Input data-testid="input-facility-name" value={form.facilityClientName} onChange={e => setField("facilityClientName", e.target.value)} placeholder="Memorial Hospital" />
                    </div>
                    <div>
                      <Label>Weeks in Assignment</Label>
                      <Input data-testid="input-weeks" type="number" value={form.weeksInAssignment} onChange={e => setField("weeksInAssignment", e.target.value)} min={1} />
                    </div>
                    <div>
                      <Label>Role Type</Label>
                      <Select value={form.roleType} onValueChange={v => setField("roleType", v)}>
                        <SelectTrigger data-testid="select-role-type"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ROLE_TYPES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Month</Label>
                      <Select value={String(form.month)} onValueChange={v => setForm(p => ({ ...p, month: Number(v) }))}>
                        <SelectTrigger data-testid="select-month"><SelectValue /></SelectTrigger>
                        <SelectContent>{MONTHS.map(m => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Year</Label>
                      <Input data-testid="input-year" type="number" value={form.year} onChange={e => setForm(p => ({ ...p, year: Number(e.target.value) }))} min={2020} max={2040} />
                    </div>
                  </CardContent>
                </Card>

                {/* STIPENDS / GSA */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Stipends (GSA Per Diem)</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Label>Assignment ZIP</Label>
                        <Input data-testid="input-zip" value={form.assignmentZip} onChange={e => setField("assignmentZip", e.target.value)} placeholder="90210" maxLength={5} />
                      </div>
                      <div className="flex items-end">
                        <Button data-testid="button-lookup-gsa" onClick={lookupGsa} disabled={gsaLoading} variant="outline">
                          {gsaLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                          <span className="ml-1">Look up GSA</span>
                        </Button>
                      </div>
                    </div>
                    {gsaError && (
                      <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-md p-2">
                        <AlertCircle className="h-4 w-4 flex-shrink-0" />
                        {gsaError}
                      </div>
                    )}
                    {gsaSource && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        {gsaSource}
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Daily M&IE (GSA)</Label>
                        <Input data-testid="input-daily-mie" type="number" step="0.01" value={form.dailyMie} onChange={e => setField("dailyMie", e.target.value)} placeholder="0.00" />
                      </div>
                      <div>
                        <Label>Daily Lodging (GSA)</Label>
                        <Input data-testid="input-daily-lodging" type="number" step="0.01" value={form.dailyLodging} onChange={e => setField("dailyLodging", e.target.value)} placeholder="0.00" />
                      </div>
                      <div>
                        <Label>Away Days (1–7)</Label>
                        <Input data-testid="input-away-days" type="number" value={form.awayDays} onChange={e => setField("awayDays", e.target.value)} min={1} max={7} />
                        <p className="text-xs text-muted-foreground mt-1">Calendar days away from tax home this week</p>
                      </div>
                      <div>
                        <Label>Decreased Stipend Override</Label>
                        <Input data-testid="input-decreased-stipend" type="number" step="0.01" value={form.decreasedStipendOverride} onChange={e => setField("decreasedStipendOverride", e.target.value)} placeholder="Optional — leave blank for full GSA" />
                        {form.decreasedStipendOverride !== "" && num(form.dailyMie) > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {fmt(gsaCapWeekly - num(form.decreasedStipendOverride))} below GSA cap
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-sm rounded-lg bg-muted/40 p-3">
                      <div>
                        <div className="text-muted-foreground text-xs">GSA Daily Total</div>
                        <div className="font-semibold">{fmt(num(form.dailyLodging) + num(form.dailyMie))}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-xs">GSA Weekly Cap</div>
                        <div className="font-semibold">{fmt(gsaCapWeekly)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-xs">First/Last Day M&IE (75%)</div>
                        <div className="font-semibold">{fmt(num(form.dailyMie) * 0.75)}</div>
                      </div>
                    </div>
                    {stipendOverCap && (
                      <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                        <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        <div>
                          <strong>Compliance alert:</strong> Proposed stipend exceeds GSA cap by {fmt(stipendProposedWeekly - gsaCapWeekly)}. This does not meet IRS accountable plan requirements.
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* PAY SCALE */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Pay Scale</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Hourly W2 Rate</Label>
                      <Input data-testid="input-w2-hourly" type="number" step="0.01" value={form.w2Hourly} onChange={e => setField("w2Hourly", e.target.value)} placeholder="0.00" />
                    </div>
                    <div>
                      <Label>Total Hours / Week</Label>
                      <Input data-testid="input-total-hours" type="number" step="0.5" value={form.totalHours} onChange={e => setField("totalHours", e.target.value)} />
                    </div>
                    <div>
                      <Label>OT Multiplier</Label>
                      <Input data-testid="input-ot-multiplier" type="number" step="0.01" value={form.otMultiplier} onChange={e => setField("otMultiplier", e.target.value)} />
                    </div>
                    <div>
                      <Label>Payroll Burden %</Label>
                      <Input data-testid="input-payroll-burden" type="number" step="0.1" value={form.payrollBurdenPct} onChange={e => setField("payrollBurdenPct", e.target.value)} />
                      <p className="text-xs text-muted-foreground mt-1">FICA 7.65% + FUTA/SUTA 3% + WC ~4% + other ~4%</p>
                    </div>
                  </CardContent>
                </Card>

                {/* BILLING */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Billing</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Standard Bill Rate / hr</Label>
                        <Input data-testid="input-bill-rate" type="number" step="0.01" value={form.masterBillRate} onChange={e => setField("masterBillRate", e.target.value)} placeholder="0.00" />
                      </div>
                      <div>
                        <Label>VMS Fee %</Label>
                        <Input data-testid="input-vms-fee" type="number" step="0.1" value={form.vmsFeePct} onChange={e => setField("vmsFeePct", e.target.value)} />
                      </div>
                      <div>
                        <Label>OT Bill Rate / hr</Label>
                        <Input data-testid="input-ot-bill-rate" type="number" step="0.01" value={form.otBillRate} onChange={e => setField("otBillRate", e.target.value)} placeholder="Auto (bill rate × OT mult.)" />
                      </div>
                      <div>
                        <Label>Client OT Multiplier</Label>
                        <Input data-testid="input-client-ot-mult" type="number" step="0.01" value={form.clientOtMultiplier} onChange={e => setField("clientOtMultiplier", e.target.value)} />
                      </div>
                    </div>
                    {outputs && (
                      <div className="grid grid-cols-2 gap-3 text-sm rounded-lg bg-muted/40 p-3">
                        <div>
                          <div className="text-muted-foreground text-xs">Bill Rate After VMS</div>
                          <div className="font-semibold">{fmt(outputs.billAfterVms)}/hr</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground text-xs">Total Weekly Billing</div>
                          <div className="font-semibold">{fmt(outputs.totalBillingWeekly)}</div>
                        </div>
                      </div>
                    )}

                    <Separator />
                    <div>
                      <p className="text-sm font-medium mb-3">Orientation</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Total Orientation Hours</Label>
                          <Input data-testid="input-orientation-total" type="number" step="0.5" value={form.orientationHoursTotal} onChange={e => setField("orientationHoursTotal", e.target.value)} />
                        </div>
                        <div>
                          <Label>Billable Orientation Hours (client pays)</Label>
                          <Input data-testid="input-orientation-billable" type="number" step="0.5" value={form.orientationHoursBillable} onChange={e => setField("orientationHoursBillable", e.target.value)} />
                          <p className="text-xs text-muted-foreground mt-1">Free / non-billable: {freeHours} hrs</p>
                        </div>
                        <div>
                          <Label>Candidate Orientation Pay Rate</Label>
                          <Input data-testid="input-orientation-pay-rate" type="number" step="0.01" value={form.orientationPayRate} onChange={e => setField("orientationPayRate", e.target.value)} placeholder={`Default: W2 rate (${form.w2Hourly || "0"})`} />
                        </div>
                        <div>
                          <Label>Orientation OT Multiplier</Label>
                          <Input data-testid="input-orientation-ot-mult" type="number" step="0.01" value={form.orientationOtMultiplier} onChange={e => setField("orientationOtMultiplier", e.target.value)} />
                        </div>
                      </div>
                      {freeHours > 0 && outputs && (
                        <div className="mt-3 flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                          <div>
                            <strong>{freeHours} free orientation hours</strong> cost {fmt(outputs.orientationCandidateCost)} with {fmt(outputs.orientationRevenue)} revenue — orientation net: {fmt(outputs.orientationNet)} {outputs.orientationNet < 0 ? "(drag on margin)" : ""}
                          </div>
                        </div>
                      )}
                    </div>

                    <Separator />
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Completion / Sign-On Bonus</Label>
                        <Input data-testid="input-completion-bonus" type="number" step="0.01" value={form.completionBonus} onChange={e => setField("completionBonus", e.target.value)} />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* SPECIAL RATES */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Special Pay Rates</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <Label>Call Back Rate / hr</Label>
                      <Input data-testid="input-callback-rate" type="number" step="0.01" value={form.callbackRate} onChange={e => setField("callbackRate", e.target.value)} />
                    </div>
                    <div>
                      <Label>Holiday Pay / hr</Label>
                      <Input data-testid="input-holiday-rate" type="number" step="0.01" value={form.holidayRate} onChange={e => setField("holidayRate", e.target.value)} />
                    </div>
                    <div>
                      <Label>On-Call Rate / hr</Label>
                      <Input data-testid="input-on-call-rate" type="number" step="0.01" value={form.onCallRate} onChange={e => setField("onCallRate", e.target.value)} />
                    </div>
                  </CardContent>
                </Card>

                {/* EXPENSES TABLE */}
                {outputs && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Expenses Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <RowTable rows={[
                        { label: "Wage Payable", weekly: fmt(outputs.wagePayableWeekly), contract: fmt(outputs.wagePayableWeekly * num(form.weeksInAssignment)) },
                        { label: "Payroll Taxes", weekly: fmt(outputs.payrollTaxesWeekly), contract: fmt(outputs.payrollTaxesWeekly * num(form.weeksInAssignment)) },
                        { label: "Non-Taxable (Stipend)", weekly: fmt(outputs.weeklyNonTaxableOut), contract: fmt(outputs.weeklyNonTaxableOut * num(form.weeksInAssignment)) },
                        { label: "Orientation Candidate Cost", weekly: fmt(outputs.orientationCandidateCost), contract: fmt(outputs.orientationCandidateCost * num(form.weeksInAssignment)) },
                        { label: "Orientation Revenue", weekly: fmt(outputs.orientationRevenue), contract: fmt(outputs.orientationRevenue * num(form.weeksInAssignment)) },
                        { label: "Orientation Net", weekly: fmt(outputs.orientationNet), contract: fmt(outputs.orientationNet * num(form.weeksInAssignment)), negative: outputs.orientationNet < 0 },
                        { label: "Completion Bonus", weekly: fmt(num(form.completionBonus)), contract: fmt(num(form.completionBonus) * num(form.weeksInAssignment)) },
                        { label: "Total Expense", weekly: fmt(outputs.totalExpenseWeekly), contract: fmt(outputs.totalExpenseContract), highlight: true },
                      ]} />
                    </CardContent>
                  </Card>
                )}

                {/* SAVE / SUBMIT ACTIONS */}
                <div className="flex flex-wrap gap-3 justify-end">
                  {outputs?.stipendCompliance === "over_cap" && (
                    <Button data-testid="button-request-override" variant="outline" className="border-amber-500 text-amber-700" onClick={() => setOverrideModal(true)}>
                      <AlertTriangle className="h-4 w-4 mr-1" /> Request Compliance Override
                    </Button>
                  )}
                  <Button data-testid="button-save-quote" onClick={() => {
                    if (stipendOverCap) { setOverrideModal(true); return; }
                    saveMutation.mutate();
                  }} disabled={saveMutation.isPending || !form.candidateName || !form.masterBillRate}>
                    <Save className="h-4 w-4 mr-1" />
                    {saveMutation.isPending ? "Saving…" : editingQuoteId ? "Update Quote" : "Save Quote"}
                  </Button>
                  <Button data-testid="button-submit-quote" variant="default" onClick={() => submitMutation.mutate()}
                    disabled={submitMutation.isPending || (!savedQuoteId && !editingQuoteId) || outputs?.stipendCompliance === "over_cap"}>
                    <Send className="h-4 w-4 mr-1" />
                    {submitMutation.isPending ? "Submitting…" : "Submit for Review"}
                  </Button>
                </div>
              </div>

              {/* RIGHT: RESULTS PANEL */}
              <div className="space-y-4">
                {/* CANDIDATE PAY */}
                <Card className="sticky top-4">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-primary" />
                      Candidate's Pay
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {outputs ? (
                      <>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Hours / Week</span>
                            <span className="font-medium">{form.totalHours}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Weekly Gross</span>
                            <span className="font-semibold">{fmt(outputs.weeklyGross)}</span>
                          </div>
                          <div className="flex justify-between pl-3">
                            <span className="text-muted-foreground">Weekly Taxable</span>
                            <span>{fmt(outputs.weeklyTaxable)}</span>
                          </div>
                          <div className="flex justify-between pl-3">
                            <span className="text-muted-foreground">Weekly Non-Taxable</span>
                            <span>{fmt(outputs.weeklyNonTaxableOut)}</span>
                          </div>
                        </div>
                        <Separator />
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Hourly Taxable</span>
                            <span className="font-medium">{fmt(outputs.hourlyTaxable)}</span>
                          </div>
                          <div className="flex justify-between bg-primary/10 rounded px-2 py-1">
                            <span className="font-semibold">Hourly Blended</span>
                            <span className="font-bold text-primary text-base">{fmt(outputs.hourlyBlended)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Overtime</span>
                            <span>{fmt(outputs.otRate)}/hr</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Call Back</span>
                            <span>{fmt(outputs.callbackRateOut)}/hr</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Holiday Pay</span>
                            <span>{fmt(outputs.holidayRateOut)}/hr</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">On Call</span>
                            <span>{fmt(outputs.onCallRateOut)}/hr</span>
                          </div>
                        </div>
                        <Button data-testid="button-copy-pay" variant="outline" size="sm" className="w-full mt-2" onClick={copyToClipboard}>
                          <Copy className="h-4 w-4 mr-1" /> Copy to Share with Candidate
                        </Button>
                      </>
                    ) : (
                      <div className="text-center text-muted-foreground text-sm py-6">
                        Enter W2 rate and bill rate to see results
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* PROFIT */}
                {outputs && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        Profit Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Net Margin %</span>
                        <MarginBadge status={outputs.marginStatus} pct={outputs.netMarginPct} />
                      </div>
                      {outputs.marginStatus === "red" && (
                        <div className="text-xs text-red-600 bg-red-50 rounded p-2">
                          Margin below minimum — consider increasing bill rate or reducing stipend to taxable.
                        </div>
                      )}
                      {outputs.marginStatus === "yellow" && (
                        <div className="text-xs text-amber-700 bg-amber-50 rounded p-2">
                          Margin at floor — healthy range starts at {marginFloors[form.roleType]?.yellowThresholdPct ?? "?"}%.
                        </div>
                      )}
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Net Margin / Hr</span>
                          <span className="font-medium">{fmt(outputs.netMarginPerHour)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Net Margin / Week</span>
                          <span className="font-medium">{fmt(outputs.netMarginPerWeek)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Net Margin / Contract</span>
                          <span className="font-semibold">{fmt(outputs.netMarginPerContract)}</span>
                        </div>
                      </div>
                      <Separator />
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <div className="flex justify-between">
                          <span>Total Billing / Week</span><span>{fmt(outputs.totalBillingWeekly)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Total Expense / Week</span><span>{fmt(outputs.totalExpenseWeekly)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Total Billing / Contract</span><span>{fmt(outputs.totalBillingContract)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Total Expense / Contract</span><span>{fmt(outputs.totalExpenseContract)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ═══════════════════════════════════ MY QUOTES TAB ═══════════════════════════════════ */}
          <TabsContent value="list" className="mt-4">
            {/* Summary Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
              {[
                { label: "Quotes This Month", value: String(thisMonthQuotes) },
                { label: "Avg Margin %", value: fmtPct(avgMargin) },
                { label: "Below Floor", value: String(belowFloor) },
                { label: "Compliance Flags", value: String(complianceFlags) },
              ].map(item => (
                <Card key={item.label}>
                  <CardContent className="pt-4 pb-3">
                    <div className="text-xs text-muted-foreground">{item.label}</div>
                    <div className="text-xl font-bold">{item.value}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {quotesLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground p-8 justify-center">
                <RefreshCw className="h-4 w-4 animate-spin" /> Loading quotes…
              </div>
            ) : !quotesData?.length ? (
              <div className="text-center text-muted-foreground py-12">
                <Calculator className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>No quotes yet. Create your first quote above.</p>
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      <th className="text-left p-3 font-medium">Candidate</th>
                      <th className="text-left p-3 font-medium hidden md:table-cell">Facility / Client</th>
                      <th className="text-left p-3 font-medium hidden lg:table-cell">Location</th>
                      <th className="text-left p-3 font-medium hidden md:table-cell">Role</th>
                      <th className="text-right p-3 font-medium">Blended</th>
                      <th className="text-right p-3 font-medium">Margin</th>
                      <th className="text-center p-3 font-medium">Status</th>
                      <th className="text-right p-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotesData.map((item: any, i: number) => {
                      const q = item.quote;
                      const o = item.outputs;
                      const ms = o?.marginStatus ?? "red";
                      const statusColor = q.status === "approved" ? "bg-green-100 text-green-800" : q.status === "submitted" ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-700";
                      return (
                        <tr key={q.id} data-testid={`row-quote-${i}`} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="p-3 font-medium">{q.candidateName}</td>
                          <td className="p-3 hidden md:table-cell text-muted-foreground">{q.facilityClientName}</td>
                          <td className="p-3 hidden lg:table-cell text-muted-foreground">{q.assignmentZip}{q.state ? `, ${q.state}` : ""}</td>
                          <td className="p-3 hidden md:table-cell">
                            <span className="text-xs text-muted-foreground">{ROLE_TYPES.find(r => r.value === q.roleType)?.label ?? q.roleType}</span>
                          </td>
                          <td className="p-3 text-right font-semibold">{o ? fmt(o.hourlyBlended) : "—"}</td>
                          <td className="p-3 text-right">
                            {o ? <MarginBadge status={ms} pct={num(o.netMarginPct)} /> : "—"}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor}`}>{q.status}</span>
                            {(o?.stipendComplianceStatus === "over_cap" || o?.stipendComplianceStatus === "override_pending") && (
                              <AlertTriangle className="h-3 w-3 text-amber-500 inline ml-1" />
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex gap-1 justify-end">
                              <Button data-testid={`button-edit-quote-${i}`} variant="ghost" size="sm" onClick={() => loadQuote(item)}>
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                              <Button data-testid={`button-pdf-quote-${i}`} variant="ghost" size="sm" title="Export PDF" onClick={() => window.open(`/api/travel/quotes/${q.id}/pdf`, "_blank")}>
                                <FileDown className="h-3.5 w-3.5" />
                              </Button>
                              {o && (
                                <Button data-testid={`button-copy-pay-${i}`} variant="ghost" size="sm" onClick={() => {
                                  setForm(prev => ({ ...prev, candidateName: q.candidateName, facilityClientName: q.facilityClientName, totalHours: q.totalHours, weeksInAssignment: String(q.weeksInAssignment), city: q.city || "", state: q.state || "", assignmentZip: q.assignmentZip }));
                                  setOutputs({
                                    billAfterVms: num(o.billAfterVms ?? 0),
                                    orientationRevenue: num(o.orientationRevenue ?? 0),
                                    orientationCandidateCost: num(o.orientationCandidateCost ?? 0),
                                    orientationNet: num(o.orientationNet ?? 0),
                                    regularBilling: num(o.totalBillingWeekly ?? 0),
                                    otBilling: 0,
                                    totalBillingWeekly: num(o.totalBillingWeekly ?? 0),
                                    totalBillingContract: num(o.totalBillingContract ?? 0),
                                    wagePayableWeekly: num(o.wagePayableWeekly ?? 0),
                                    payrollTaxesWeekly: num(o.payrollTaxesWeekly ?? 0),
                                    weeklyNonTaxable: num(o.weeklyNonTaxable ?? 0),
                                    gsaCapWeekly: 0,
                                    stipendCompliance: (o.stipendComplianceStatus === "over_cap" ? "over_cap" : "compliant") as any,
                                    totalExpenseWeekly: num(o.totalExpenseWeekly ?? 0),
                                    totalExpenseContract: num(o.totalExpenseContract ?? 0),
                                    grossProfitWeekly: num(o.grossProfitWeekly ?? 0),
                                    netMarginPct: num(o.netMarginPct ?? 0),
                                    netMarginPerHour: num(o.netMarginPerHour ?? 0),
                                    netMarginPerWeek: num(o.netMarginPerWeek ?? 0),
                                    netMarginPerContract: num(o.netMarginPerContract ?? 0),
                                    marginStatus: (o.marginStatus ?? "red") as any,
                                    weeklyGross: num(o.weeklyGross ?? 0),
                                    weeklyTaxable: num(o.weeklyTaxable ?? 0),
                                    weeklyNonTaxableOut: num(o.weeklyNonTaxable ?? 0),
                                    hourlyTaxable: num(o.hourlyTaxable ?? 0),
                                    hourlyBlended: num(o.hourlyBlended ?? 0),
                                    otRate: num(o.otRate ?? 0),
                                    callbackRateOut: num(q.callbackRate ?? 0),
                                    holidayRateOut: num(q.holidayRate ?? 0),
                                    onCallRateOut: num(q.onCallRate ?? 0),
                                  });
                                  setTimeout(copyToClipboard, 100);
                                }}>
                                  <Copy className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* ═══════════════════════════════════ SETTINGS TAB ═══════════════════════════════════ */}
          {isAdmin && (
            <TabsContent value="settings" className="mt-4">
              <MarginFloorSettings />
            </TabsContent>
          )}
        </Tabs>

        {/* COMPLIANCE OVERRIDE MODAL */}
        <Dialog open={overrideModal} onOpenChange={setOverrideModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" /> Request Compliance Override
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                The proposed non-taxable stipend exceeds the GSA cap for this location and period. This may not comply with IRS accountable plan rules. Provide a justification for HR/Admin review.
              </p>
              <div>
                <Label>Justification</Label>
                <textarea
                  data-testid="input-override-reason"
                  className="w-full mt-1 min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={overrideReason}
                  onChange={e => setOverrideReason(e.target.value)}
                  placeholder="Explain the business reason for exceeding GSA cap…"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOverrideModal(false)}>Cancel</Button>
              <Button onClick={() => overrideMutation.mutate()} disabled={!overrideReason.trim() || overrideMutation.isPending}>
                {overrideMutation.isPending ? "Submitting…" : "Submit Override Request"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}

function MarginFloorSettings() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: floors, isLoading } = useQuery<any[]>({
    queryKey: ["/api/travel/margin-floors"],
    queryFn: async () => {
      const res = await fetch("/api/travel/margin-floors", { credentials: "include" });
      return res.json();
    },
  });

  const [local, setLocal] = useState<Record<string, any>>({});
  useEffect(() => {
    if (floors) {
      const m: Record<string, any> = {};
      for (const f of floors) m[f.roleType] = { ...f };
      setLocal(m);
    }
  }, [floors]);

  const saveMutation = useMutation({
    mutationFn: async ({ roleType, data }: { roleType: string; data: any }) => {
      const res = await fetch(`/api/travel/margin-floors/${roleType}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Settings saved" });
      qc.invalidateQueries({ queryKey: ["/api/travel/margin-floors"] });
    },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  const defaultFloors = [
    { roleType: "healthcare_travel", label: "Healthcare Travel (RN, Allied)", redThresholdPct: "10", yellowThresholdPct: "17" },
    { roleType: "it_engineering", label: "IT / Engineering", redThresholdPct: "20", yellowThresholdPct: "27" },
    { roleType: "professional_services", label: "Professional Services", redThresholdPct: "14", yellowThresholdPct: "21" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-semibold text-base">Margin Floor Thresholds</h2>
        <p className="text-sm text-muted-foreground">Configure the Red / Yellow / Green margin thresholds by role type. Also set global defaults for payroll burden and standard rates.</p>
      </div>
      {isLoading ? <div className="text-muted-foreground text-sm">Loading…</div> : (
        <div className="space-y-4">
          {defaultFloors.map(({ roleType, label }) => {
            const f = local[roleType] ?? {};
            const update = (key: string, val: string) => setLocal(prev => ({ ...prev, [roleType]: { ...(prev[roleType] ?? {}), [key]: val } }));
            return (
              <Card key={roleType}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">{label}</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <Label className="text-xs">Red Threshold %</Label>
                    <Input type="number" step="0.1" value={f.redThresholdPct ?? ""} onChange={e => update("redThresholdPct", e.target.value)} placeholder="e.g. 10" />
                    <p className="text-xs text-muted-foreground mt-0.5">Below this = red</p>
                  </div>
                  <div>
                    <Label className="text-xs">Yellow Threshold %</Label>
                    <Input type="number" step="0.1" value={f.yellowThresholdPct ?? ""} onChange={e => update("yellowThresholdPct", e.target.value)} placeholder="e.g. 17" />
                    <p className="text-xs text-muted-foreground mt-0.5">Below this = yellow</p>
                  </div>
                  <div>
                    <Label className="text-xs">Payroll Burden %</Label>
                    <Input type="number" step="0.1" value={f.payrollBurdenPct ?? "18.8"} onChange={e => update("payrollBurdenPct", e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Default VMS Fee %</Label>
                    <Input type="number" step="0.1" value={f.defaultVmsFeePct ?? "3"} onChange={e => update("defaultVmsFeePct", e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Default OT Multiplier</Label>
                    <Input type="number" step="0.01" value={f.defaultOtMultiplier ?? "1.5"} onChange={e => update("defaultOtMultiplier", e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Default Callback Rate</Label>
                    <Input type="number" step="0.01" value={f.defaultCallbackRate ?? "0"} onChange={e => update("defaultCallbackRate", e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Default Holiday Rate</Label>
                    <Input type="number" step="0.01" value={f.defaultHolidayRate ?? "0"} onChange={e => update("defaultHolidayRate", e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Default On-Call Rate</Label>
                    <Input type="number" step="0.01" value={f.defaultOnCallRate ?? "0"} onChange={e => update("defaultOnCallRate", e.target.value)} />
                  </div>
                  <div className="col-span-2 sm:col-span-4 flex justify-end">
                    <Button data-testid={`button-save-floor-${roleType}`} size="sm" onClick={() => saveMutation.mutate({ roleType, data: f })} disabled={saveMutation.isPending}>
                      <Save className="h-3.5 w-3.5 mr-1" /> Save {label}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
