import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Wrench, FileText, Receipt, Download, Loader2, User, Building, Search,
  Send, XCircle, Eye, CheckCircle, Clock, Mail, UserPlus, ExternalLink,
  FileSearch, Printer, ShieldCheck, ScrollText, FileStack, FilePlus,
  ChevronDown, ChevronUp, RefreshCw, ArrowRight, RotateCcw,
  Plus, Trash2, Laptop, Shield, BookOpen, Pencil,
} from "lucide-react";
import { PolicySignoffsContent } from "./PolicySignoffs";
import { Textarea } from "@/components/ui/textarea";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetDescription } from "@/components/ui/sheet";
import { OfferLetterBody } from "@/components/OfferLetterBody";
import { LetterGenerator } from "@/components/hr/LetterGenerator";
import { LetterPreview } from "@/components/hr/LetterPreview";
import { LettersDashboard } from "@/components/hr/LettersDashboard";
import { LetterTemplatesSection } from "@/components/hr/LetterTemplatesSection";
import { AnnexureEditor, buildGoalsFromAnnexures, type AnnexureItem } from "@/components/hr/AnnexureEditor";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { numberToWords } from "@/lib/numberToWords";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { AdminUsersResponse, HrLetter } from "@shared/schema";
import { TEMPLATE_LABELS } from "@shared/hrLetterConstants";
import { renderOfferClause, OFFER_CLAUSE_DEFAULT_TEXT, renderAddendumClause, ADDENDUM_CLAUSE_DEFAULT_TEXT } from "@shared/performanceClauses";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatCurrency(value: string | number) {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0.00";
  return num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface SlipFormData {
  employeeName: string;
  employeeId: string;
  designation: string;
  department: string;
  location: string;

  basic: number;
  hra: number;
  conveyance: number;
  specialAllowance: number;
  pfDeduction: number;
  esiDeduction: number;
  professionalTax: number;
  tds: number;
  otherDeductions: number;
  paidDays: number;
  lopDays: number;
  month: number;
  year: number;
}

function getDefaultSlipData(): SlipFormData {
  const now = new Date();
  return {
    employeeName: "",
    employeeId: "",
    designation: "",
    department: "",
    location: "Remote",

    basic: 0,
    hra: 0,
    conveyance: 0,
    specialAllowance: 0,
    pfDeduction: 0,
    esiDeduction: 0,
    professionalTax: 0,
    tds: 0,
    otherDeductions: 0,
    paidDays: 30,
    lopDays: 0,
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  };
}

function generatePayslipHTML(data: SlipFormData): string {
  const monthName = MONTH_NAMES[data.month - 1];
  const totalEarnings = data.basic + data.hra + data.conveyance + data.specialAllowance;
  const totalDeductions = data.pfDeduction + data.esiDeduction + data.professionalTax + data.tds + data.otherDeductions;
  const netPay = totalEarnings - totalDeductions;
  const netPayWords = numberToWords(netPay);

  const NAVY = "#1F3A6E";
  const ORANGE = "#F47C20";

  const fmt = (n: number) =>
    n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const isBlank = (v: string | number | undefined | null): boolean => {
    if (v === undefined || v === null) return true;
    if (typeof v === "number") return v === 0;
    const s = String(v).trim();
    return s === "" || s === "0" || s.toLowerCase() === "n/a";
  };

  const infoRow = (label: string, value: string, shade: boolean) => {
    if (isBlank(value)) return "";
    const bg = shade ? "#F7F9FC" : "#FFFFFF";
    return `<div style="display:flex;padding:5px 12px;font-size:11px;background-color:${bg};border-bottom:1px solid #E8EDF4;">
      <span style="min-width:145px;font-weight:600;color:#374151;">${label}</span>
      <span style="color:#1a1a1a;">${value}</span>
    </div>`;
  };

  const earningsRows = [
    { label: "Basic", amount: data.basic },
    { label: "House Rent Allowance (HRA)", amount: data.hra },
    { label: "Conveyance Allowance", amount: data.conveyance },
    { label: "Special Allowance", amount: data.specialAllowance },
  ].filter(r => r.amount > 0);

  const deductionRows = [
    { label: "Provident Fund (PF)", amount: data.pfDeduction },
    { label: "ESI", amount: data.esiDeduction },
    { label: "Professional Tax", amount: data.professionalTax },
    { label: "TDS", amount: data.tds },
    ...(data.otherDeductions > 0 ? [{ label: "Other Deductions", amount: data.otherDeductions }] : []),
  ].filter(r => r.amount > 0);

  const maxRows = Math.max(earningsRows.length, deductionRows.length);

  let salaryRows = "";
  for (let i = 0; i < maxRows; i++) {
    const e = earningsRows[i];
    const d = deductionRows[i];
    const shade = i % 2 === 1;
    const bg = shade ? "#F7F9FC" : "#FFFFFF";
    const dAmtColor = d && d.amount > 0 ? "#CC2E2E" : "#9CA3AF";
    const dAmtDisplay = d ? (d.amount > 0 ? fmt(d.amount) : "—") : "";
    salaryRows += `<tr style="background:${bg};">
      <td style="padding:6px 12px;color:#1a1a1a;border-bottom:1px solid #E8EDF4;">${e ? e.label : ""}</td>
      <td style="padding:6px 12px;text-align:right;color:#1a1a1a;border-bottom:1px solid #E8EDF4;">${e ? fmt(e.amount) : ""}</td>
      <td style="padding:6px 12px;color:#1a1a1a;border-bottom:1px solid #E8EDF4;border-left:2px solid #C9D5E8;">${d ? d.label : ""}</td>
      <td style="padding:6px 12px;text-align:right;color:${dAmtColor};border-bottom:1px solid #E8EDF4;">${dAmtDisplay}</td>
    </tr>`;
  }

  const summaryRow = (label: string, value: string) => {
    if (isBlank(value)) return "";
    return `<div style="display:flex;padding:5px 0;font-size:11px;gap:0;">
      <span style="min-width:148px;color:#6B7280;font-weight:400;">${label}</span>
      <span style="margin-right:10px;color:#374151;">:</span>
      <span style="color:#111827;font-weight:500;">${value}</span>
    </div>`;
  };

  const employeeInfoRows =
    summaryRow("Full Name", data.employeeName) +
    summaryRow("Employee ID", data.employeeId) +
    summaryRow("Designation", data.designation) +
    summaryRow("Department", data.department) +
    summaryRow("Location", data.location) +
    summaryRow("Pay Period", `${monthName} ${data.year}`);


  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Payslip - ${monthName} ${data.year}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; background: #EEF2F7; padding: 32px; }
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }
  @media print {
    body { background: #fff !important; padding: 0; }
    .slip-wrapper { box-shadow: none; }
  }
</style>
</head>
<body>
<div style="max-width:820px;margin:0 auto;background:#fff;box-shadow:0 4px 24px rgba(31,58,110,0.13);border-radius:4px;overflow:hidden;position:relative;">

  <!-- DIAGONAL WATERMARK -->
  <div style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:0;overflow:hidden;">
    <div style="transform:rotate(-38deg);font-size:68px;font-weight:900;letter-spacing:8px;color:rgba(31,58,110,0.035);white-space:nowrap;user-select:none;line-height:1.6;text-align:center;">
      RAYOMIND SOLUTIONS<br/>RAYOMIND SOLUTIONS<br/>RAYOMIND SOLUTIONS
    </div>
  </div>

  <!-- CONTENT -->
  <div style="position:relative;z-index:1;">

    <!-- HEADER: White — Rayomind logo + address left | HIS logo + payslip title right -->
    <div style="background:#fff;padding:22px 28px 18px;display:flex;align-items:flex-start;justify-content:space-between;">
      <!-- Left: Rayomind logo + address + GSTIN -->
      <div style="display:flex;flex-direction:column;align-items:flex-start;gap:5px;">
        <img src="/rayomind-logo.png" alt="Rayomind Solutions LLP" style="height:40px;object-fit:contain;" />
        <div style="font-size:9.5px;color:#6B7280;margin-top:3px;line-height:1.5;">Suite No-101, Pocket-6, Sector-2<br/>Rohini, New Delhi – 110085, India</div>
        <div style="font-size:8.5px;color:#9CA3AF;letter-spacing:0.3px;">GSTIN/UIN: 07ABMFR1303G1ZF</div>
      </div>
      <!-- Right: HIS logo + "Hire'in Solutions" + payslip month -->
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="text-align:right;">
            <div style="font-size:12px;font-weight:700;color:#111827;">Hire'in Solutions</div>
            <div style="font-size:8.5px;color:${ORANGE};font-weight:600;letter-spacing:0.8px;text-transform:uppercase;margin-top:1px;">A Rayomind Company</div>
          </div>
          <img src="/his-logo.jpg" alt="Hire'in Solutions" style="height:34px;object-fit:contain;border-radius:4px;" />
        </div>
        <div style="text-align:right;margin-top:4px;">
          <div style="font-size:10px;color:#9CA3AF;font-weight:400;">Payslip For the Month</div>
          <div style="font-size:20px;font-weight:800;color:${NAVY};line-height:1.1;margin-top:2px;">${monthName} ${data.year}</div>
        </div>
      </div>
    </div>

    <!-- ORANGE ACCENT LINE -->
    <div style="height:3px;background:linear-gradient(to right,${ORANGE},#FBBB6D,${ORANGE});"></div>

    <!-- EMPLOYEE SUMMARY -->
    <div style="padding:18px 28px 14px;border-bottom:1px solid #E8EDF4;background:#fff;">
      <div style="font-size:9.5px;font-weight:700;color:${NAVY};text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Employee Information</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 0;">
        ${employeeInfoRows}
      </div>
    </div>

    <!-- EARNINGS & DEDUCTIONS TABLE -->
    <div style="margin:16px 0 0;">
      <table style="width:100%;border-collapse:collapse;font-size:11.5px;">
        <thead>
          <tr>
            <th colspan="2" style="background:${ORANGE};color:#fff;padding:7px 12px;text-align:left;font-weight:700;letter-spacing:0.5px;width:50%;font-size:11px;">EARNINGS</th>
            <th colspan="2" style="background:${NAVY};color:#fff;padding:7px 12px;text-align:left;font-weight:700;letter-spacing:0.5px;width:50%;font-size:11px;">DEDUCTIONS</th>
          </tr>
          <tr style="background:#F0F4FA;">
            <th style="padding:5px 12px;text-align:left;color:#374151;font-weight:600;width:32%;border-bottom:1px solid #C9D5E8;">Component</th>
            <th style="padding:5px 12px;text-align:right;color:#374151;font-weight:600;width:18%;border-bottom:1px solid #C9D5E8;">Amount (₹)</th>
            <th style="padding:5px 12px;text-align:left;color:#374151;font-weight:600;width:32%;border-bottom:1px solid #C9D5E8;border-left:2px solid #C9D5E8;">Component</th>
            <th style="padding:5px 12px;text-align:right;color:#374151;font-weight:600;width:18%;border-bottom:1px solid #C9D5E8;">Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${salaryRows}
          <tr style="background:#EEF2F7;font-weight:700;">
            <td style="padding:8px 12px;color:${NAVY};font-size:12px;border-top:2px solid ${NAVY};">Total Earnings</td>
            <td style="padding:8px 12px;text-align:right;color:#1A7A3C;font-size:12px;border-top:2px solid ${NAVY};">${fmt(totalEarnings)}</td>
            <td style="padding:8px 12px;color:${NAVY};font-size:12px;border-top:2px solid ${NAVY};border-left:2px solid #C9D5E8;">Total Deductions</td>
            <td style="padding:8px 12px;text-align:right;color:#CC2E2E;font-size:12px;border-top:2px solid ${NAVY};">${fmt(totalDeductions)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- NET PAY -->
    <div style="margin:12px 28px 0;">
      <div style="background:${NAVY};padding:10px 20px;display:flex;justify-content:space-between;align-items:center;border-radius:3px;">
        <div>
          <div style="color:#fff;font-size:10.5px;font-weight:600;letter-spacing:0.8px;text-transform:uppercase;">Net Salary Payable</div>
          <div style="margin-top:5px;display:flex;gap:18px;">
            <span style="color:rgba(255,255,255,0.65);font-size:9px;">Pay Days: <strong style="color:#fff;">${data.paidDays}</strong></span>
            <span style="color:rgba(255,255,255,0.65);font-size:9px;">LOP Days: <strong style="color:${data.lopDays > 0 ? "#FCA5A5" : "#fff"};">${data.lopDays}</strong></span>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="color:${ORANGE};font-size:19px;font-weight:800;letter-spacing:-0.3px;">₹${fmt(netPay)}</div>
          <div style="color:rgba(255,255,255,0.55);font-size:8.5px;margin-top:2px;font-style:italic;">Rupees ${netPayWords} Only</div>
        </div>
      </div>
    </div>

    <!-- FOOTER -->
    <div style="padding:12px 20px 16px;border-top:3px solid ${ORANGE};margin-top:14px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;">
        <div>
          <div style="font-size:9.5px;color:#6B7280;line-height:1.6;">This is a system-generated payslip and does not require a physical signature.</div>
          <div style="font-size:9.5px;color:#6B7280;">For queries contact: <span style="color:${NAVY};font-weight:600;">jaspreet.singh@rayomind.com</span></div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:9px;color:#9CA3AF;letter-spacing:0.5px;">© ${data.year} Rayomind Solutions LLP</div>
          <div style="display:flex;align-items:center;gap:6px;margin-top:4px;justify-content:flex-end;">
            <img src="/rayomind-logo.png" alt="" style="height:16px;opacity:0.45;" />
          </div>
        </div>
      </div>
    </div>

  </div>
</div>
</body>
</html>`;
}

function SalarySlipGenerator() {
  const { toast } = useToast();
  const [formData, setFormData] = useState<SlipFormData>(getDefaultSlipData());
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [showPreview, setShowPreview] = useState(false);
  const [loadingSlip, setLoadingSlip] = useState(false);

  const { data: usersResponse } = useQuery<{ users: { id: string; firstName: string; lastName: string; email: string; isActive: boolean; employeeId: string | null; departmentId: string | null; salary: string | null; designation: string | null; joiningDate: string | null; role: string }[]; counts: AdminUsersResponse["counts"] }>({
    queryKey: ["/api/admin/users", "all_non_deleted"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users?status=all_non_deleted", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
  });
  const users = usersResponse?.users;

  const { data: departments } = useQuery<any[]>({
    queryKey: ["/api/admin/departments"],
  });

  const activeUsers = useMemo(() => {
    if (!users) return [];
    return users;
  }, [users]);

  const updateField = (field: keyof SlipFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSelectEmployee = async (userId: string) => {
    setSelectedUserId(userId);
    const user = users?.find((u: any) => u.id === userId);
    if (!user) return;

    const dept = departments?.find((d: any) => d.id === user.departmentId);

    setFormData(prev => ({
      ...prev,
      employeeName: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
      employeeId: user.employeeId || user.username || "",
      designation: user.designation || "",
      department: dept?.name || "",
    }));

  };

  const handleLoadExisting = async () => {
    if (!selectedUserId) {
      toast({ title: "Select an employee first", variant: "destructive" });
      return;
    }
    setLoadingSlip(true);
    try {
      const res = await fetch(`/api/hr/admin/salary-slips/${selectedUserId}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const slips = await res.json();

      const match = slips.find((s: any) => s.year === formData.year && s.month === formData.month);
      if (!match) {
        toast({ title: "No existing slip found for this month/year", variant: "destructive" });
        return;
      }

      const detailRes = await fetch(`/api/hr/admin/salary-slip/${match.id}`);
      if (!detailRes.ok) throw new Error("Failed to fetch details");
      const detail = await detailRes.json();

      const grossSalary = parseFloat(detail.grossSalary) || 0;
      const deductions = parseFloat(detail.deductions) || 0;
      const basicSalary = parseFloat(detail.basicSalary) || 0;

      setFormData(prev => ({
        ...prev,
        basic: basicSalary,
        hra: 0,
        conveyance: 0,
        specialAllowance: grossSalary - basicSalary,
        pfDeduction: 0,
        esiDeduction: 0,
        professionalTax: 0,
        tds: 0,
        otherDeductions: deductions,
      }));
      toast({ title: "Loaded existing salary data" });
    } catch {
      toast({ title: "Failed to load existing data", variant: "destructive" });
    } finally {
      setLoadingSlip(false);
    }
  };

  const totalEarnings = formData.basic + formData.hra + formData.conveyance + formData.specialAllowance;
  const totalDeductions = formData.pfDeduction + formData.esiDeduction + formData.professionalTax + formData.tds + formData.otherDeductions;
  const netPay = totalEarnings - totalDeductions;

  const handlePreview = () => {
    if (!formData.employeeName) {
      toast({ title: "Please enter employee name", variant: "destructive" });
      return;
    }
    setShowPreview(true);
  };

  const handleDownload = () => {
    const html = generatePayslipHTML(formData);
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" />
              Employee Selection
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Select Employee</Label>
              <Select value={selectedUserId} onValueChange={handleSelectEmployee}>
                <SelectTrigger data-testid="select-employee-salary">
                  <SelectValue placeholder="Choose an employee..." />
                </SelectTrigger>
                <SelectContent>
                  {activeUsers.map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.firstName} {u.lastName} — {u.designation || u.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Month</Label>
                <Select value={String(formData.month)} onValueChange={v => updateField("month", parseInt(v))}>
                  <SelectTrigger data-testid="select-month-salary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTH_NAMES.map((m, i) => (
                      <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Year</Label>
                <Select value={String(formData.year)} onValueChange={v => updateField("year", parseInt(v))}>
                  <SelectTrigger data-testid="select-year-salary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2024, 2025, 2026, 2027].map(y => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={handleLoadExisting}
              disabled={!selectedUserId || loadingSlip}
              data-testid="button-load-existing-slip"
              className="w-full"
            >
              {loadingSlip ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
              Load from Existing Slip
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Employee Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Name</Label>
                <Input data-testid="input-slip-name" value={formData.employeeName} onChange={e => updateField("employeeName", e.target.value)} />
              </div>
              <div>
                <Label>Employee ID</Label>
                <Input data-testid="input-slip-empid" value={formData.employeeId} onChange={e => updateField("employeeId", e.target.value)} />
              </div>
              <div>
                <Label>Designation</Label>
                <Input data-testid="input-slip-designation" value={formData.designation} onChange={e => updateField("designation", e.target.value)} />
              </div>
              <div>
                <Label>Department</Label>
                <Input data-testid="input-slip-dept" value={formData.department} onChange={e => updateField("department", e.target.value)} />
              </div>
              <div>
                <Label>Location</Label>
                <Input data-testid="input-slip-location" value={formData.location} onChange={e => updateField("location", e.target.value)} />
              </div>
              <div>
                <Label>Pay Days</Label>
                <Input data-testid="input-slip-paiddays" type="number" value={formData.paidDays} onChange={e => updateField("paidDays", parseInt(e.target.value) || 0)} />
              </div>
              <div>
                <Label>LOP Days</Label>
                <Input data-testid="input-slip-lopdays" type="number" value={formData.lopDays} onChange={e => updateField("lopDays", parseInt(e.target.value) || 0)} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-green-700">Earnings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Basic</Label>
                <Input data-testid="input-slip-basic" type="number" value={formData.basic} onChange={e => updateField("basic", parseFloat(e.target.value) || 0)} />
              </div>
              <div>
                <Label>HRA</Label>
                <Input data-testid="input-slip-hra" type="number" value={formData.hra} onChange={e => updateField("hra", parseFloat(e.target.value) || 0)} />
              </div>
              <div>
                <Label>Conveyance</Label>
                <Input data-testid="input-slip-conveyance" type="number" value={formData.conveyance} onChange={e => updateField("conveyance", parseFloat(e.target.value) || 0)} />
              </div>
              <div>
                <Label>Special Allowance</Label>
                <Input data-testid="input-slip-special" type="number" value={formData.specialAllowance} onChange={e => updateField("specialAllowance", parseFloat(e.target.value) || 0)} />
              </div>
            </div>
            <Separator />
            <div className="flex justify-between font-semibold text-sm">
              <span>Total Earnings:</span>
              <span className="text-green-700">₹{formatCurrency(totalEarnings)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base text-red-700">Deductions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>PF</Label>
                <Input data-testid="input-slip-pf-ded" type="number" value={formData.pfDeduction} onChange={e => updateField("pfDeduction", parseFloat(e.target.value) || 0)} />
              </div>
              <div>
                <Label>ESI</Label>
                <Input data-testid="input-slip-esi-ded" type="number" value={formData.esiDeduction} onChange={e => updateField("esiDeduction", parseFloat(e.target.value) || 0)} />
              </div>
              <div>
                <Label>Professional Tax</Label>
                <Input data-testid="input-slip-ptax" type="number" value={formData.professionalTax} onChange={e => updateField("professionalTax", parseFloat(e.target.value) || 0)} />
              </div>
              <div>
                <Label>TDS</Label>
                <Input data-testid="input-slip-tds" type="number" value={formData.tds} onChange={e => updateField("tds", parseFloat(e.target.value) || 0)} />
              </div>
              <div>
                <Label>Other Deductions</Label>
                <Input data-testid="input-slip-other-ded" type="number" value={formData.otherDeductions} onChange={e => updateField("otherDeductions", parseFloat(e.target.value) || 0)} />
              </div>
            </div>
            <Separator />
            <div className="flex justify-between font-semibold text-sm">
              <span>Total Deductions:</span>
              <span className="text-red-700">₹{formatCurrency(totalDeductions)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-bold">
                Net Pay: <span className="text-primary">₹{formatCurrency(netPay)}</span>
              </div>
              <div className="text-sm text-muted-foreground italic">
                (Rupees {numberToWords(netPay)})
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={handlePreview} data-testid="button-preview-slip">
                <Search className="h-4 w-4 mr-2" />
                Preview
              </Button>
              <Button onClick={handleDownload} data-testid="button-download-slip">
                <Download className="h-4 w-4 mr-2" />
                Download as PDF
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {showPreview && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Payslip Preview</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowPreview(false)}>
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden bg-white">
              <iframe
                srcDoc={generatePayslipHTML(formData)}
                className="w-full h-[700px]"
                title="Payslip Preview"
                data-testid="iframe-slip-preview"
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface OfferFormData {
  candidateTitle: string;
  candidateName: string;
  candidatePersonalEmail: string;
  ccEmails: string;
  candidateAddress: string;
  designation: string;
  subjectDesignation: string;
  reportingToUserId: string;
  departmentId: string;
  gender: string;
  employmentType: string;
  attendanceExempt: boolean;
  trainingExempt: boolean;
  maternityLeaveEligible: boolean;
  seedProbationPlan: boolean;
  proposedStartDate: string;
  salary: number;
  salaryInWords: string;
  location: string;
  jurisdiction: string;
  hrManagerName: string;
  offerDate: string;
  splitProbationSalary: boolean;
  performanceProbationReview: boolean;
  maxRevisionSalary: number;
  maxRevisionSalaryInWords: string;
  probationSalary: number;
  probationSalaryInWords: string;
  postProbationSalary: number;
  postProbationSalaryInWords: string;
  probationPeriodMonths: number;
  extendedProbationMonths: number;
}

function getDefaultOfferData(): OfferFormData {
  const today = new Date().toISOString().split("T")[0];
  return {
    candidateTitle: "Mr.",
    candidateName: "",
    candidatePersonalEmail: "",
    ccEmails: "",
    candidateAddress: "",
    designation: "",
    subjectDesignation: "",
    reportingToUserId: "",
    departmentId: "",
    gender: "",
    employmentType: "Full-time / Regular",
    attendanceExempt: false,
    trainingExempt: false,
    maternityLeaveEligible: false,
    seedProbationPlan: false,
    proposedStartDate: "",
    salary: 0,
    salaryInWords: "",
    location: "Delhi",
    jurisdiction: "Delhi",
    hrManagerName: "Alina Carter",
    offerDate: today,
    splitProbationSalary: false,
    performanceProbationReview: false,
    maxRevisionSalary: 0,
    maxRevisionSalaryInWords: "",
    probationSalary: 0,
    probationSalaryInWords: "",
    postProbationSalary: 0,
    postProbationSalaryInWords: "",
    probationPeriodMonths: 3,
    extendedProbationMonths: 0,
  };
}

export function OfferLetterGenerator({ editId }: { editId?: string | null } = {}) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState<OfferFormData>(getDefaultOfferData());
  const [generating, setGenerating] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [editLoadedId, setEditLoadedId] = useState<string | null>(null);
  const [editRejectionReason, setEditRejectionReason] = useState<string | null>(null);
  const [editWasRejected, setEditWasRejected] = useState(false);

  const { data: editLetters } = useQuery<any[]>({
    queryKey: ["/api/hr/tools/offer-letters"],
    enabled: !!editId,
  });

  const { data: usersResp } = useQuery<{ users: { id: string; firstName: string; lastName: string; email: string; isActive: boolean; designation: string | null; departmentId: string | null; salary: string | null; joiningDate: string | null }[]; counts: AdminUsersResponse["counts"] }>({
    queryKey: ["/api/admin/users", "all_non_deleted"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users?status=all_non_deleted", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
  });
  const users = usersResp?.users;

  const activeUsers = useMemo(() => {
    if (!users) return [];
    return users;
  }, [users]);

  const updateField = (field: keyof OfferFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    if (formData.salary > 0) {
      updateField("salaryInWords", numberToWords(formData.salary));
    }
  }, [formData.salary]);

  useEffect(() => {
    if (formData.probationSalary > 0) {
      updateField("probationSalaryInWords", numberToWords(formData.probationSalary));
    }
  }, [formData.probationSalary]);

  useEffect(() => {
    if (formData.postProbationSalary > 0) {
      updateField("postProbationSalaryInWords", numberToWords(formData.postProbationSalary));
    }
  }, [formData.postProbationSalary]);

  useEffect(() => {
    if (formData.maxRevisionSalary > 0) {
      updateField("maxRevisionSalaryInWords", numberToWords(formData.maxRevisionSalary));
    }
  }, [formData.maxRevisionSalary]);

  useEffect(() => {
    const hasProbationMonths = formData.probationPeriodMonths > 0;
    if (hasProbationMonths && !formData.seedProbationPlan) {
      updateField("seedProbationPlan", true);
    }
    if (!hasProbationMonths && formData.seedProbationPlan) {
      updateField("seedProbationPlan", false);
    }
  }, [formData.probationPeriodMonths]);

  const { data: departments } = useQuery<any[]>({
    queryKey: ["/api/departments"],
  });

  const handleLoadEmployee = (userId: string) => {
    setSelectedUserId(userId);
    const user = users?.find((u: any) => u.id === userId);
    if (!user) return;

    setFormData(prev => ({
      ...prev,
      candidateName: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
      designation: user.designation || "",
      subjectDesignation: user.designation || "",
      salary: parseFloat(user.salary) || 0,
      salaryInWords: parseFloat(user.salary) ? numberToWords(parseFloat(user.salary)) : "",
      proposedStartDate: user.joiningDate ? new Date(user.joiningDate).toISOString().split("T")[0] : "",
      departmentId: user.departmentId || "",
      reportingToUserId: user.reportingTo || "",
    }));
  };

  const [sending, setSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [annexures, setAnnexures] = useState<AnnexureItem[]>([]);
  const [policyAnnexures, setPolicyAnnexures] = useState<string[]>([]);

  // Pre-fill the form when editing an existing pending/rejected offer letter.
  useEffect(() => {
    if (!editId) {
      // Editing was cleared (navigated to a fresh "New Offer Letter") — reset once.
      if (editLoadedId !== null) {
        setEditLoadedId(null);
        setEditRejectionReason(null);
        setEditWasRejected(false);
        setFormData(getDefaultOfferData());
        setAnnexures([]);
        setPolicyAnnexures([]);
      }
      return;
    }
    if (editLoadedId === editId) return;
    const letter = editLetters?.find((l: any) => l.id === editId);
    if (!letter) return;

    const toIsoDate = (v: any): string => {
      if (!v) return "";
      const d = new Date(v);
      if (isNaN(d.getTime())) return "";
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };

    const split = !!(letter.probationSalary && letter.postProbationSalary);
    setFormData({
      candidateTitle: letter.candidateTitle || "Mr.",
      candidateName: letter.candidateName || "",
      candidatePersonalEmail: letter.candidatePersonalEmail || "",
      ccEmails: letter.ccEmails || "",
      candidateAddress: letter.candidateAddress || "",
      designation: letter.designation || "",
      subjectDesignation: letter.subjectDesignation || "",
      reportingToUserId: letter.reportingToUserId || "",
      departmentId: letter.departmentId || "",
      gender: "",
      employmentType: letter.employmentType || "Full-time / Regular",
      attendanceExempt: false,
      trainingExempt: false,
      maternityLeaveEligible: false,
      seedProbationPlan: !!letter.seedProbationPlan,
      proposedStartDate: toIsoDate(letter.proposedStartDate),
      salary: letter.salary ? parseFloat(letter.salary) : 0,
      salaryInWords: letter.salaryInWords || "",
      location: letter.location || "Delhi",
      jurisdiction: letter.jurisdiction || "Delhi",
      hrManagerName: letter.hrManagerName || "Alina Carter",
      offerDate: toIsoDate(letter.offerDate) || new Date().toISOString().split("T")[0],
      splitProbationSalary: split,
      performanceProbationReview: !!letter.performanceProbationReview,
      maxRevisionSalary: letter.maxRevisionSalary ? parseFloat(letter.maxRevisionSalary) : 0,
      maxRevisionSalaryInWords: letter.maxRevisionSalaryInWords || "",
      probationSalary: letter.probationSalary ? parseFloat(letter.probationSalary) : 0,
      probationSalaryInWords: letter.probationSalaryInWords || "",
      postProbationSalary: letter.postProbationSalary ? parseFloat(letter.postProbationSalary) : 0,
      postProbationSalaryInWords: letter.postProbationSalaryInWords || "",
      probationPeriodMonths: letter.probationPeriodMonths ?? 3,
      extendedProbationMonths: letter.extendedProbationMonths ?? 0,
    });
    const rawAnn = Array.isArray(letter.annexureData) ? letter.annexureData : [];
    setAnnexures(rawAnn.map((a: any) => ({ title: String(a.title ?? ""), body: String(a.body ?? "") })));
    setPolicyAnnexures(Array.isArray(letter.policyAnnexures) ? letter.policyAnnexures : []);
    setEditWasRejected(letter.status === "rejected");
    setEditRejectionReason(letter.status === "rejected" ? (letter.approvalRejectionReason || null) : null);
    setEditLoadedId(editId);
  }, [editId, editLetters, editLoadedId]);

  const getReportingToName = () => {
    if (!formData.reportingToUserId) return "";
    const mgr = users?.find((u: any) => u.id === formData.reportingToUserId);
    return mgr ? `${mgr.firstName || ""} ${mgr.lastName || ""}`.trim() : "";
  };

  const parseDateLocal = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  };

  const previewOffer = useMemo(() => {
    const deptName = departments?.find((d: any) => d.id === formData.departmentId)?.name ?? null;
    const manager = users?.find((u: any) => u.id === formData.reportingToUserId);
    const managerName = manager
      ? `${manager.firstName || ""} ${manager.lastName || ""}`.trim()
      : null;
    const offerDateFormatted = formData.offerDate
      ? parseDateLocal(formData.offerDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
      : "";
    const startDateFormatted = formData.proposedStartDate
      ? parseDateLocal(formData.proposedStartDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
      : "";
    return {
      candidateTitle: formData.candidateTitle,
      candidateName: formData.candidateName,
      candidateAddress: formData.candidateAddress || null,
      designation: formData.designation,
      subjectDesignation: formData.subjectDesignation || null,
      departmentName: deptName,
      managerName,
      location: formData.location,
      proposedStartDate: startDateFormatted || null,
      employmentType: formData.employmentType,
      salary: formData.splitProbationSalary ? null : (formData.salary ? String(formData.salary) : null),
      hrManagerName: formData.hrManagerName || null,
      offerDate: offerDateFormatted,
      jurisdiction: formData.jurisdiction || null,
      refId: null,
      probationSalary: formData.splitProbationSalary && formData.probationSalary ? String(formData.probationSalary) : null,
      probationSalaryInWords: formData.splitProbationSalary ? formData.probationSalaryInWords || null : null,
      postProbationSalary: formData.splitProbationSalary && formData.postProbationSalary ? String(formData.postProbationSalary) : null,
      postProbationSalaryInWords: formData.splitProbationSalary ? formData.postProbationSalaryInWords || null : null,
      probationPeriodMonths: (formData.splitProbationSalary || formData.performanceProbationReview) ? formData.probationPeriodMonths : null,
      extendedProbationMonths: (formData.splitProbationSalary || formData.performanceProbationReview) && formData.extendedProbationMonths > 0 ? formData.extendedProbationMonths : null,
      performanceProbationReview: formData.performanceProbationReview,
      maxRevisionSalary: formData.performanceProbationReview && formData.maxRevisionSalary ? String(formData.maxRevisionSalary) : null,
      maxRevisionSalaryInWords: formData.performanceProbationReview ? formData.maxRevisionSalaryInWords || null : null,
      performanceClauseText: formData.performanceProbationReview
        ? renderOfferClause(OFFER_CLAUSE_DEFAULT_TEXT, {
            probationSalary: formData.probationSalary ? String(formData.probationSalary) : "",
            probationPeriodMonths: formData.probationPeriodMonths ? String(formData.probationPeriodMonths) : "",
            maxRevisionSalary: formData.maxRevisionSalary ? String(formData.maxRevisionSalary) : "",
            extendedProbationMonths: formData.extendedProbationMonths ? String(formData.extendedProbationMonths) : "",
          })
        : null,
      policyAnnexures: policyAnnexures.length > 0 ? policyAnnexures : null,
    };
  }, [formData, departments, users, policyAnnexures]);

  const handleGenerate = async () => {
    if (!formData.candidateName || !formData.designation) {
      toast({ title: "Please fill in candidate name and designation", variant: "destructive" });
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch("/api/hr/tools/generate-offer-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          reportingTo: getReportingToName(),
          offerDate: formData.offerDate
            ? parseDateLocal(formData.offerDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
            : undefined,
          proposedStartDate: formData.proposedStartDate
            ? parseDateLocal(formData.proposedStartDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
            : "",
          annexureData: annexures.length > 0 ? annexures : undefined,
          salary: (formData.splitProbationSalary || formData.performanceProbationReview) ? undefined : (formData.salary || undefined),
          probationSalary: (formData.splitProbationSalary || formData.performanceProbationReview) && formData.probationSalary ? formData.probationSalary : undefined,
          probationSalaryInWords: (formData.splitProbationSalary || formData.performanceProbationReview) ? formData.probationSalaryInWords || undefined : undefined,
          postProbationSalary: formData.splitProbationSalary && formData.postProbationSalary ? formData.postProbationSalary : undefined,
          postProbationSalaryInWords: formData.splitProbationSalary ? formData.postProbationSalaryInWords || undefined : undefined,
          probationPeriodMonths: (formData.splitProbationSalary || formData.performanceProbationReview) ? formData.probationPeriodMonths : undefined,
          extendedProbationMonths: (formData.splitProbationSalary || formData.performanceProbationReview) && formData.extendedProbationMonths > 0 ? formData.extendedProbationMonths : undefined,
          performanceProbationReview: formData.performanceProbationReview,
          maxRevisionSalary: formData.performanceProbationReview && formData.maxRevisionSalary ? formData.maxRevisionSalary : undefined,
          maxRevisionSalaryInWords: formData.performanceProbationReview ? formData.maxRevisionSalaryInWords || undefined : undefined,
          policyAnnexures: policyAnnexures.length > 0 ? policyAnnexures : undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to generate");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${formData.candidateName.replace(/\s+/g, "_")}_Offer_Letter.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({ title: "Offer letter downloaded successfully" });
    } catch (err: any) {
      toast({ title: err.message || "Failed to generate offer letter", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleSendOffer = async () => {
    if (!formData.candidateName || !formData.designation || !formData.candidatePersonalEmail) {
      toast({ title: "Please fill in candidate name, designation, and personal email", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      const payload = {
        ...formData,
        salary: (formData.splitProbationSalary || formData.performanceProbationReview) ? null : (formData.salary ? String(formData.salary) : null),
        offerDate: formData.offerDate
          ? parseDateLocal(formData.offerDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
          : undefined,
        proposedStartDate: formData.proposedStartDate
          ? parseDateLocal(formData.proposedStartDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
          : "",
        annexureData: annexures.length > 0 ? annexures : undefined,
        probationSalary: (formData.splitProbationSalary || formData.performanceProbationReview) && formData.probationSalary ? formData.probationSalary : undefined,
        probationSalaryInWords: (formData.splitProbationSalary || formData.performanceProbationReview) ? formData.probationSalaryInWords || undefined : undefined,
        postProbationSalary: formData.splitProbationSalary && formData.postProbationSalary ? formData.postProbationSalary : undefined,
        postProbationSalaryInWords: formData.splitProbationSalary ? formData.postProbationSalaryInWords || undefined : undefined,
        probationPeriodMonths: (formData.splitProbationSalary || formData.performanceProbationReview) ? formData.probationPeriodMonths : undefined,
        extendedProbationMonths: (formData.splitProbationSalary || formData.performanceProbationReview) && formData.extendedProbationMonths > 0 ? formData.extendedProbationMonths : undefined,
        performanceProbationReview: formData.performanceProbationReview,
        maxRevisionSalary: formData.performanceProbationReview && formData.maxRevisionSalary ? formData.maxRevisionSalary : undefined,
        maxRevisionSalaryInWords: formData.performanceProbationReview ? formData.maxRevisionSalaryInWords || undefined : undefined,
        policyAnnexures: policyAnnexures.length > 0 ? policyAnnexures : undefined,
        seedProbationPlan: formData.seedProbationPlan,
      };

      // Edit mode: update the existing pending/rejected letter in place instead of creating a new one.
      if (editId) {
        const res = await apiRequest("PATCH", `/api/hr/tools/offer-letters/${editId}`, payload);
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || err.error || "Failed to save changes");
        }
        const result = await res.json();
        queryClient.invalidateQueries({ queryKey: ["/api/hr/tools/offer-letters"] });
        toast({
          title: result.resubmitted ? "Offer letter resubmitted for approval" : "Offer letter updated",
          description: result.resubmitted
            ? "Your revised offer has been sent back to a super admin for approval."
            : "Your changes have been saved.",
        });
        setShowPreview(false);
        setLocation("/admin/new-hire?tab=letters");
        return;
      }

      const res = await apiRequest("POST", "/api/hr/tools/offer-letters", payload);

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || err.error || "Failed to send");
      }

      const result = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/hr/tools/offer-letters"] });

      if (result.pendingApproval) {
        toast({ title: "Offer letter submitted for approval", description: "A super admin will review and approve it before it is sent to the candidate." });
      } else if (result.emailSent === false) {
        toast({
          title: "Offer letter saved, but email delivery failed",
          description: `The offer letter was created but the email to ${formData.candidatePersonalEmail} could not be sent. Check server logs for details.`,
          variant: "destructive",
        });
      } else {
        toast({ title: "Offer letter sent successfully!", description: `An email has been sent to ${formData.candidatePersonalEmail}` });
      }
      setFormData(getDefaultOfferData());
      setSelectedUserId("");
      setAnnexures([]);
      setPolicyAnnexures([]);
      setShowPreview(false);
    } catch (err: any) {
      toast({ title: err.message || "Failed to send offer letter", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {editId && (
        <Card className={editWasRejected ? "border-red-300 bg-red-50/60" : "border-orange-300 bg-orange-50/60"}>
          <CardContent className="py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <Pencil className={editWasRejected ? "h-5 w-5 text-red-600 mt-0.5" : "h-5 w-5 text-[#F47C20] mt-0.5"} />
                <div>
                  <p className="font-semibold text-sm" data-testid="text-edit-mode-heading">
                    {editWasRejected ? "Editing a rejected offer letter" : "Editing a pending offer letter"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {editWasRejected
                      ? "Make your changes and resubmit — it will go back to a super admin for approval."
                      : "Make your changes and save — the offer stays in the approval queue."}
                  </p>
                  {editWasRejected && editRejectionReason && (
                    <p className="mt-2 text-xs text-red-700 bg-red-100 rounded px-2 py-1.5" data-testid="text-edit-rejection-reason">
                      <strong>Rejection reason:</strong> {editRejectionReason}
                    </p>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation("/admin/new-hire?tab=letters")}
                data-testid="button-cancel-edit"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            Load from Existing Employee (Optional)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedUserId} onValueChange={handleLoadEmployee}>
            <SelectTrigger data-testid="select-employee-offer">
              <SelectValue placeholder="Choose an employee to auto-fill..." />
            </SelectTrigger>
            <SelectContent>
              {activeUsers.map((u: any) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.firstName} {u.lastName} — {u.designation || u.role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Candidate Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Title</Label>
                <Select value={formData.candidateTitle} onValueChange={v => updateField("candidateTitle", v)}>
                  <SelectTrigger data-testid="select-offer-title">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Mr.">Mr.</SelectItem>
                    <SelectItem value="Ms.">Ms.</SelectItem>
                    <SelectItem value="Mrs.">Mrs.</SelectItem>
                    <SelectItem value="Dr.">Dr.</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Full Name</Label>
                <Input data-testid="input-offer-name" value={formData.candidateName} onChange={e => updateField("candidateName", e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Address / Location</Label>
              <Input data-testid="input-offer-address" value={formData.candidateAddress} onChange={e => updateField("candidateAddress", e.target.value)} placeholder="e.g., Punjab" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Designation</Label>
                <Input data-testid="input-offer-designation" value={formData.designation} onChange={e => updateField("designation", e.target.value)} placeholder="e.g., Healthcare Sourcer" />
              </div>
              <div>
                <Label>Subject Designation</Label>
                <Input data-testid="input-offer-subject-designation" value={formData.subjectDesignation} onChange={e => updateField("subjectDesignation", e.target.value)} placeholder="Leave blank to use Designation" />
              </div>
            </div>
            <div>
              <Label>Personal Email</Label>
              <Input data-testid="input-offer-email" type="email" value={formData.candidatePersonalEmail} onChange={e => updateField("candidatePersonalEmail", e.target.value)} placeholder="candidate@gmail.com" />
            </div>
            <div>
              <Label>CC Recipients <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input data-testid="input-offer-cc" type="text" value={formData.ccEmails} onChange={e => updateField("ccEmails", e.target.value)} placeholder="manager@hire-in.com, ceo@hire-in.com" />
              <p className="text-xs text-muted-foreground mt-1">Separate multiple emails with commas</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Reporting Manager</Label>
                <Select value={formData.reportingToUserId} onValueChange={v => updateField("reportingToUserId", v)}>
                  <SelectTrigger data-testid="select-offer-reporting">
                    <SelectValue placeholder="Select manager..." />
                  </SelectTrigger>
                  <SelectContent>
                    {activeUsers.map((u: any) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.firstName} {u.lastName} — {u.designation || u.role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Department</Label>
                <Select value={formData.departmentId} onValueChange={v => updateField("departmentId", v)}>
                  <SelectTrigger data-testid="select-offer-department">
                    <SelectValue placeholder="Select department..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(departments || []).filter((d: any) => d.isActive).map((d: any) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Gender</Label>
              <Select value={formData.gender} onValueChange={v => {
                setFormData(prev => ({
                  ...prev,
                  gender: v,
                  maternityLeaveEligible: v === "Female" ? true : prev.maternityLeaveEligible,
                }));
              }}>
                <SelectTrigger data-testid="select-offer-gender">
                  <SelectValue placeholder="Select gender..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Employment Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Employment Type</Label>
              <Select value={formData.employmentType} onValueChange={v => updateField("employmentType", v)}>
                <SelectTrigger data-testid="select-offer-employment-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Full-time / Regular">Full-time / Regular</SelectItem>
                  <SelectItem value="Part-time">Part-time</SelectItem>
                  <SelectItem value="Contract">Contract</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Proposed Start Date</Label>
              <Input data-testid="input-offer-start-date" type="date" value={formData.proposedStartDate} onChange={e => updateField("proposedStartDate", e.target.value)} />
            </div>
            <div className="border rounded-lg p-3 space-y-3">
              <div>
                <Label>Compensation Structure</Label>
                <Select
                  value={formData.performanceProbationReview ? "performance" : (formData.splitProbationSalary ? "committed" : "standard")}
                  onValueChange={v => {
                    if (v === "standard") {
                      updateField("splitProbationSalary", false);
                      updateField("performanceProbationReview", false);
                    } else if (v === "committed") {
                      updateField("splitProbationSalary", true);
                      updateField("performanceProbationReview", false);
                    } else {
                      updateField("splitProbationSalary", false);
                      updateField("performanceProbationReview", true);
                    }
                  }}
                >
                  <SelectTrigger data-testid="select-compensation-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Single fixed salary</SelectItem>
                    <SelectItem value="committed">Two-stage probation (committed post-probation salary)</SelectItem>
                    <SelectItem value="performance">Performance-based probation review (no committed amount)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {!formData.splitProbationSalary && !formData.performanceProbationReview ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Monthly Salary / CTC (₹)</Label>
                    <Input data-testid="input-offer-salary" type="number" value={formData.salary || ""} onChange={e => updateField("salary", parseFloat(e.target.value) || 0)} />
                  </div>
                  <div>
                    <Label>Salary in Words</Label>
                    <Input data-testid="input-offer-salary-words" value={formData.salaryInWords} onChange={e => updateField("salaryInWords", e.target.value)} />
                  </div>
                </div>
              ) : formData.performanceProbationReview ? (
                <div className="space-y-3 pt-1">
                  <p className="text-xs text-muted-foreground">
                    Probation salary is committed; the post-probation figure is reviewed on performance with no committed amount. An optional ceiling and extended-probation period may be specified.
                  </p>
                  <div className="grid grid-cols-3 gap-3 items-end">
                    <div>
                      <Label>Probation Duration</Label>
                      <Select value={String(formData.probationPeriodMonths)} onValueChange={v => updateField("probationPeriodMonths", parseInt(v))}>
                        <SelectTrigger data-testid="select-perf-probation-months">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5, 6].map(m => (
                            <SelectItem key={m} value={String(m)}>{m} month{m !== 1 ? "s" : ""}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <Label>Extended Probation <span className="text-muted-foreground font-normal">(optional)</span></Label>
                      <Select value={String(formData.extendedProbationMonths)} onValueChange={v => updateField("extendedProbationMonths", parseInt(v))}>
                        <SelectTrigger data-testid="select-perf-extended-probation-months">
                          <SelectValue placeholder="No extension" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">No extension</SelectItem>
                          {[4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                            <SelectItem key={m} value={String(m)}>Up to {m} months</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Probation Salary (₹/month)</Label>
                      <Input data-testid="input-perf-probation-salary" type="number" value={formData.probationSalary || ""} onChange={e => updateField("probationSalary", parseFloat(e.target.value) || 0)} />
                    </div>
                    <div>
                      <Label>Probation Salary in Words</Label>
                      <Input data-testid="input-perf-probation-salary-words" value={formData.probationSalaryInWords} onChange={e => updateField("probationSalaryInWords", e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Revision Ceiling "up to ₹" <span className="text-muted-foreground font-normal">(optional)</span></Label>
                      <Input data-testid="input-max-revision-salary" type="number" value={formData.maxRevisionSalary || ""} onChange={e => updateField("maxRevisionSalary", parseFloat(e.target.value) || 0)} />
                    </div>
                    <div>
                      <Label>Ceiling in Words</Label>
                      <Input data-testid="input-max-revision-salary-words" value={formData.maxRevisionSalaryInWords} onChange={e => updateField("maxRevisionSalaryInWords", e.target.value)} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-3 gap-3 items-end">
                    <div>
                      <Label>Probation Duration</Label>
                      <Select value={String(formData.probationPeriodMonths)} onValueChange={v => updateField("probationPeriodMonths", parseInt(v))}>
                        <SelectTrigger data-testid="select-probation-months">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5, 6].map(m => (
                            <SelectItem key={m} value={String(m)}>{m} month{m !== 1 ? "s" : ""}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <Label>Extended Probation <span className="text-muted-foreground font-normal">(optional)</span></Label>
                      <Select value={String(formData.extendedProbationMonths)} onValueChange={v => updateField("extendedProbationMonths", parseInt(v))}>
                        <SelectTrigger data-testid="select-extended-probation-months">
                          <SelectValue placeholder="No extension" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">No extension</SelectItem>
                          {[4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                            <SelectItem key={m} value={String(m)}>Up to {m} months</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Probation Salary (₹/month)</Label>
                      <Input data-testid="input-probation-salary" type="number" value={formData.probationSalary || ""} onChange={e => updateField("probationSalary", parseFloat(e.target.value) || 0)} />
                    </div>
                    <div>
                      <Label>Probation Salary in Words</Label>
                      <Input data-testid="input-probation-salary-words" value={formData.probationSalaryInWords} onChange={e => updateField("probationSalaryInWords", e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Post-Probation Salary (₹/month)</Label>
                      <Input data-testid="input-post-probation-salary" type="number" value={formData.postProbationSalary || ""} onChange={e => updateField("postProbationSalary", parseFloat(e.target.value) || 0)} />
                    </div>
                    <div>
                      <Label>Post-Probation Salary in Words</Label>
                      <Input data-testid="input-post-probation-salary-words" value={formData.postProbationSalaryInWords} onChange={e => updateField("postProbationSalaryInWords", e.target.value)} />
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Work Location</Label>
                <Input data-testid="input-offer-location" value={formData.location} onChange={e => updateField("location", e.target.value)} />
              </div>
              <div>
                <Label>Jurisdiction</Label>
                <Input data-testid="input-offer-jurisdiction" value={formData.jurisdiction} onChange={e => updateField("jurisdiction", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>HR Manager Name</Label>
                <Input data-testid="input-offer-hr-name" value={formData.hrManagerName} onChange={e => updateField("hrManagerName", e.target.value)} />
              </div>
              <div>
                <Label>Offer Date</Label>
                <Input data-testid="input-offer-date" type="date" value={formData.offerDate} onChange={e => updateField("offerDate", e.target.value)} />
              </div>
            </div>
            <div className="border rounded-lg p-3 space-y-2">
              <Label className="text-sm font-medium">Exemption Flags</Label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer" data-testid="check-attendance-exempt">
                  <input
                    type="checkbox"
                    checked={formData.attendanceExempt}
                    onChange={e => updateField("attendanceExempt", e.target.checked)}
                    className="rounded border-border"
                  />
                  <span className="text-sm">Attendance Exempt</span>
                  <span className="text-xs text-muted-foreground">(skip daily punch-in compliance)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer" data-testid="check-training-exempt">
                  <input
                    type="checkbox"
                    checked={formData.trainingExempt}
                    onChange={e => updateField("trainingExempt", e.target.checked)}
                    className="rounded border-border"
                  />
                  <span className="text-sm">Training Exempt</span>
                  <span className="text-xs text-muted-foreground">(skip training compliance lock)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer" data-testid="check-maternity-eligible">
                  <input
                    type="checkbox"
                    checked={formData.maternityLeaveEligible}
                    onChange={e => updateField("maternityLeaveEligible", e.target.checked)}
                    className="rounded border-border"
                  />
                  <span className="text-sm">Maternity Leave Eligible</span>
                  <span className="text-xs text-muted-foreground">(auto-set when gender = Female)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer" data-testid="check-seed-probation-plan">
                  <input
                    type="checkbox"
                    checked={formData.seedProbationPlan}
                    onChange={e => updateField("seedProbationPlan", e.target.checked)}
                    className="rounded border-border"
                  />
                  <span className="text-sm">Seed Probation Plan on Onboarding</span>
                  <span className="text-xs text-muted-foreground">(auto-creates a healthcare probation plan when employee is onboarded)</span>
                </label>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <AnnexureEditor annexures={annexures} onChange={setAnnexures} />

      <Card>
        <CardContent className="pt-6 space-y-3">
          <div>
            <p className="text-sm font-medium mb-0.5">Policy Annexures</p>
            <p className="text-xs text-muted-foreground mb-3">
              Select policies to append as Annexures A–G in the DOCX. The candidate will be asked to acknowledge them at acceptance.
            </p>
            <div className="space-y-2">
              {([
                { key: "leave_policy", label: "Annexure A — Leave Policy" },
                { key: "attendance_policy", label: "Annexure B — Attendance & Regularization Policy" },
                { key: "code_of_conduct", label: "Annexure C — Code of Conduct" },
                { key: "nda", label: "Annexure D — Confidentiality & Non-Disclosure Agreement" },
                { key: "marketing_nda", label: "Annexure E — Marketing & Social Media Confidentiality, NDA & IP Agreement" },
                { key: "marketing_content_policy", label: "Annexure F — Marketing, Social Media & Content Policy" },
                { key: "marketing_code_of_conduct", label: "Annexure G — Marketing Code of Conduct, Data Security & Professional Standards" },
              ] as const).map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer" data-testid={`check-policy-${key}`}>
                  <input
                    type="checkbox"
                    checked={policyAnnexures.includes(key)}
                    onChange={e => {
                      if (e.target.checked) {
                        setPolicyAnnexures(prev => [...prev, key]);
                      } else {
                        setPolicyAnnexures(prev => prev.filter(k => k !== key));
                      }
                    }}
                    className="rounded border-border"
                  />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Generate the DOCX for records, or preview and send the offer to the candidate for digital acceptance.
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleGenerate} disabled={generating || !formData.candidateName || !formData.designation} data-testid="button-generate-offer">
                {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                Download DOCX
              </Button>
              <Button onClick={() => setShowPreview(true)} disabled={!formData.candidateName || !formData.designation || !formData.candidatePersonalEmail} data-testid="button-preview-offer">
                <Eye className="h-4 w-4 mr-2" />
                Preview Offer
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Sheet open={showPreview} onOpenChange={setShowPreview}>
        <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col p-0">
          <SheetHeader className="px-6 py-4 border-b shrink-0">
            <SheetTitle className="flex items-center gap-2 text-blue-900">
              <Eye className="h-5 w-5" />
              Offer Letter Preview
            </SheetTitle>
            <p className="text-sm text-muted-foreground">
              Review the offer letter as the candidate will see it, then confirm to send.
            </p>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            <OfferLetterBody offer={previewOffer} />
          </div>

          <SheetFooter className="px-6 py-4 border-t shrink-0 flex flex-row gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowPreview(false)} data-testid="button-preview-back">
              ← Back to Edit
            </Button>
            <Button
              onClick={handleSendOffer}
              disabled={sending}
              data-testid="button-confirm-send"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : (editId ? <CheckCircle className="h-4 w-4 mr-2" /> : <Send className="h-4 w-4 mr-2" />)}
              {editId ? (editWasRejected ? "Save & Resubmit" : "Save Changes") : "Confirm & Send"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

const STATUS_BADGES: Record<string, { label: string; className: string; icon: any }> = {
  sent: { label: "Sent", className: "bg-blue-50 text-blue-700 border-blue-200", icon: Mail },
  viewed: { label: "Viewed", className: "bg-indigo-50 text-indigo-700 border-indigo-200", icon: Eye },
  accepted: { label: "Accepted", className: "bg-amber-50 text-amber-700 border-amber-200", icon: CheckCircle },
  onboarded: { label: "Onboarded", className: "bg-green-50 text-green-700 border-green-200", icon: UserPlus },
  countersigned: { label: "Countersigned", className: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle },
  expired: { label: "Expired", className: "bg-gray-100 text-gray-600 border-gray-200", icon: Clock },
  cancelled: { label: "Cancelled", className: "bg-red-50 text-red-600 border-red-200", icon: XCircle },
  pending_approval: { label: "Pending Approval", className: "bg-orange-50 text-[#F47C20] border-orange-300", icon: Clock },
  rejected: { label: "Rejected", className: "bg-red-50 text-red-700 border-red-200", icon: XCircle },
};

const ADDENDUM_TYPE_LABELS: Record<string, string> = {
  salary_revision: "Salary Revision",
  role_change: "Role / Title Change",
  probation_extension: "Probation Extension",
  combined: "Combined Role & Salary",
  custom: "Custom Amendment",
  device_allocation: "Company Device Allocation",
};

const ADDENDUM_STATUS_BADGES: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-gray-100 text-gray-600" },
  sent: { label: "Pending Signature", className: "bg-amber-100 text-amber-800" },
  accepted: { label: "Accepted", className: "bg-green-100 text-green-700" },
  countersigned: { label: "Countersigned", className: "bg-emerald-100 text-emerald-700" },
  cancelled: { label: "Cancelled", className: "bg-red-100 text-red-600 line-through" },
};

const HR_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-gray-100 text-gray-600" },
  pending_approval: { label: "Pending Approval", className: "bg-orange-50 text-[#F47C20]" },
  approved: { label: "Approved", className: "bg-blue-100 text-blue-700" },
  issued: { label: "Issued", className: "bg-green-100 text-green-700" },
  reissued: { label: "Reissued", className: "bg-amber-100 text-amber-700" },
  revoked: { label: "Revoked", className: "bg-red-100 text-red-600 line-through" },
};

function AddendumCountBadge({ letterId, onClick }: { letterId: string; onClick: () => void }) {
  const { data: addendums } = useQuery<any[]>({
    queryKey: ["/api/hr/tools/offer-letters", letterId, "addendums"],
  });
  if (!addendums || addendums.length === 0) return null;
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors ml-1"
      data-testid={`badge-addendum-count-${letterId}`}
      title="View addendums"
    >
      <FileStack className="h-2.5 w-2.5" />
      {addendums.length}
    </button>
  );
}

function AddendumSubRow({ letter }: { letter: any }) {
  const { toast } = useToast();
  const { data: addendums, isLoading } = useQuery<any[]>({
    queryKey: ["/api/hr/tools/offer-letters", letter.id, "addendums"],
  });

  const resendMutation = useMutation({
    mutationFn: async (addendumId: string) => {
      const res = await apiRequest("POST", `/api/hr/tools/offer-letters/${letter.id}/addendums/${addendumId}/send`);
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      return res.json();
    },
    onSuccess: () => toast({ title: "Addendum email resent" }),
    onError: (err: any) => toast({ title: err.message, variant: "destructive" }),
  });

  const cancelMutation = useMutation({
    mutationFn: async (addendumId: string) => {
      const res = await apiRequest("POST", `/api/hr/tools/offer-letters/${letter.id}/addendums/${addendumId}/cancel`);
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/tools/offer-letters", letter.id, "addendums"] });
      toast({ title: "Addendum cancelled" });
    },
    onError: (err: any) => toast({ title: err.message, variant: "destructive" }),
  });

  const countersignMutation = useMutation({
    mutationFn: async (addendumId: string) => {
      const res = await apiRequest("POST", `/api/hr/tools/addendums/${addendumId}/countersign`);
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/tools/offer-letters", letter.id, "addendums"] });
      toast({ title: "Addendum counter-signed!" });
    },
    onError: (err: any) => toast({ title: err.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <tr>
        <td colSpan={9} className="p-4 bg-muted/10">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </td>
      </tr>
    );
  }

  if (!addendums || addendums.length === 0) {
    return (
      <tr>
        <td colSpan={9} className="p-4 bg-muted/10 text-sm text-muted-foreground italic">
          No addendums for this offer letter.
        </td>
      </tr>
    );
  }

  return (
    <>
      {addendums.map((addendum) => {
        const statusInfo = ADDENDUM_STATUS_BADGES[addendum.status] || ADDENDUM_STATUS_BADGES.sent;
        return (
          <tr key={addendum.id} className="bg-blue-50/40 border-b border-blue-100" data-testid={`row-addendum-${addendum.id}`}>
            <td colSpan={2} className="p-3 pl-8">
              <div className="flex items-center gap-2 text-sm">
                <ArrowRight className="h-3 w-3 text-blue-400" />
                <span className="font-medium text-blue-900">{ADDENDUM_TYPE_LABELS[addendum.addendumType] || addendum.addendumType}</span>
              </div>
              {addendum.effectiveDate && (
                <div className="text-xs text-muted-foreground ml-5">Effective: {addendum.effectiveDate}</div>
              )}
            </td>
            <td colSpan={2} className="p-3 text-xs text-muted-foreground">
              {addendum.issuedAt ? new Date(addendum.issuedAt).toLocaleDateString() : "—"}
            </td>
            <td colSpan={2} className="p-3">
              <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${statusInfo.className}`} data-testid={`badge-addendum-status-${addendum.id}`}>
                {statusInfo.label}
              </span>
            </td>
            <td colSpan={3} className="p-3">
              <div className="flex gap-1 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => window.open(`/api/hr/tools/offer-letters/${letter.id}/addendums/${addendum.id}/download`, "_blank")}
                  data-testid={`button-download-addendum-${addendum.id}`}
                >
                  <Download className="h-3 w-3 mr-1" />
                  DOCX
                </Button>
                {addendum.status === "sent" && (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => resendMutation.mutate(addendum.id)}
                      disabled={resendMutation.isPending}
                      data-testid={`button-resend-addendum-${addendum.id}`}
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Resend
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-destructive hover:text-destructive"
                      onClick={() => cancelMutation.mutate(addendum.id)}
                      disabled={cancelMutation.isPending}
                      data-testid={`button-cancel-addendum-${addendum.id}`}
                    >
                      <XCircle className="h-3 w-3 mr-1" />
                      Cancel
                    </Button>
                  </>
                )}
                {addendum.status === "accepted" && (
                  <Button
                    size="sm"
                    className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => countersignMutation.mutate(addendum.id)}
                    disabled={countersignMutation.isPending}
                    data-testid={`button-countersign-addendum-${addendum.id}`}
                  >
                    {countersignMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle className="h-3 w-3 mr-1" />}
                    Counter-Sign
                  </Button>
                )}
              </div>
            </td>
          </tr>
        );
      })}
    </>
  );
}

export function OfferLettersDashboard() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [topTab, setTopTab] = useState<"active" | "completed" | "closed">("active");
  const [rejectDialog, setRejectDialog] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [onboardingModal, setOnboardingModal] = useState<any>(null);
  const [countersignModal, setCountersignModal] = useState<any>(null);
  const [viewLetterModal, setViewLetterModal] = useState<any>(null);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [hrViewLetter, setHrViewLetter] = useState<HrLetter | null>(null);
  const [hrRevokeDialog, setHrRevokeDialog] = useState<HrLetter | null>(null);
  const [hrRevokeReason, setHrRevokeReason] = useState("");
  const [hrReissueDialog, setHrReissueDialog] = useState<HrLetter | null>(null);
  const [hrReissueReason, setHrReissueReason] = useState("");
  const [hrEmailDialog, setHrEmailDialog] = useState<HrLetter | null>(null);
  const [hrEmailCc, setHrEmailCc] = useState("");
  const viewModalAnnexureInitials = useMemo<Record<string, string>>(() => {
    const raw = viewLetterModal?.annexureInitials;
    if (!Array.isArray(raw)) return {};
    const map: Record<string, string> = {};
    for (const entry of raw) {
      if (entry && typeof entry.key === "string" && typeof entry.initials === "string") {
        map[entry.key] = entry.initials;
      }
    }
    return map;
  }, [viewLetterModal]);
  const viewModalAnnexureInitialedAt = useMemo<Record<string, string>>(() => {
    const raw = viewLetterModal?.annexureInitials;
    if (!Array.isArray(raw)) return {};
    const map: Record<string, string> = {};
    for (const entry of raw) {
      if (entry && typeof entry.key === "string" && typeof entry.initialedAt === "string") {
        map[entry.key] = entry.initialedAt;
      }
    }
    return map;
  }, [viewLetterModal]);
  const countersignAnnexureInitials = useMemo<Record<string, string>>(() => {
    const raw = countersignModal?.annexureInitials;
    if (!Array.isArray(raw)) return {};
    const map: Record<string, string> = {};
    for (const entry of raw) {
      if (entry && typeof entry.key === "string" && typeof entry.initials === "string") {
        map[entry.key] = entry.initials;
      }
    }
    return map;
  }, [countersignModal]);
  const [annexureViewerKey, setAnnexureViewerKey] = useState<string | null>(null);
  const [annexureContentMap, setAnnexureContentMap] = useState<Record<string, { key: string; label: string; title: string; body: string }>>({});
  useEffect(() => {
    if (!countersignModal || Object.keys(annexureContentMap).length > 0) return;
    fetch("/api/annexure-content")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: { key: string; label: string; title: string; body: string }[]) => {
        const m: Record<string, { key: string; label: string; title: string; body: string }> = {};
        for (const it of data) m[it.key] = it;
        setAnnexureContentMap(m);
      })
      .catch(() => {});
  }, [countersignModal]);
  const annexureViewerContent = annexureViewerKey ? annexureContentMap[annexureViewerKey] : null;
  const [hireInEmail, setHireInEmail] = useState("");
  const [counterSignedName, setCounterSignedName] = useState("Alina Carter");
  const [counterSignedDate, setCounterSignedDate] = useState(new Date().toISOString().split("T")[0]);
  const [onboarding, setOnboarding] = useState(false);
  const [countersigning, setCountersigning] = useState(false);
  const [expandedOfferIds, setExpandedOfferIds] = useState<Set<string>>(new Set());
  const [addendumDialog, setAddendumDialog] = useState<any>(null);
  const [viewAddendum, setViewAddendum] = useState<any>(null);
  const [standaloneDialog, setStandaloneDialog] = useState(false);
  const [standaloneAnnexures, setStandaloneAnnexures] = useState<AnnexureItem[]>([]);
  const [standaloneForm, setStandaloneForm] = useState({
    employeeName: "", employeeEmail: "", employeeDesignation: "",
    employeeDepartment: "", employeeJoiningDate: "", employeeReportingManager: "",
    addendumType: "salary_revision", effectiveDate: "", reason: "",
    hrManagerName: "Alina Carter",
    oldDesignation: "", newDesignation: "",
    oldDepartment: "", newDepartment: "",
    oldSalary: "", newSalary: "",
    oldSalaryInWords: "", newSalaryInWords: "",
    oldConfirmationDate: "", newConfirmationDate: "",
    customClauseTitle: "", customClauseText: "",
    deviceItems: [] as { description: string; serialNumber: string; assetTag: string; condition: string }[],
    ccEmails: "",
    includeGrowthPlanClause: false,
    growthPlanCurrentSalary: "",
    growthPlanMaxRevisionSalary: "",
  });
  const [submittingStandalone, setSubmittingStandalone] = useState(false);
  const [previewingStandalone, setPreviewingStandalone] = useState(false);
  const [standaloneEmployeeSearch, setStandaloneEmployeeSearch] = useState("");
  const [selectedStandaloneEmployeeId, setSelectedStandaloneEmployeeId] = useState<string | null>(null);
  const [addendumForm, setAddendumForm] = useState({
    addendumType: "salary_revision",
    effectiveDate: "",
    reason: "",
    hrManagerName: "Alina Carter",
    oldDesignation: "", newDesignation: "",
    oldDepartment: "", newDepartment: "",
    oldSalary: "", newSalary: "",
    oldSalaryInWords: "", newSalaryInWords: "",
    oldConfirmationDate: "", newConfirmationDate: "",
    customClauseTitle: "", customClauseText: "",
    deviceItems: [] as { description: string; serialNumber: string; assetTag: string; condition: string }[],
    ccEmails: "",
    includeGrowthPlanClause: false,
    growthPlanCurrentSalary: "",
    growthPlanMaxRevisionSalary: "",
  });
  const [submittingAddendum, setSubmittingAddendum] = useState(false);
  const [addendumAnnexures, setAddendumAnnexures] = useState<AnnexureItem[]>([]);

  const toggleAddendumRow = (letterId: string) => {
    setExpandedOfferIds(prev => {
      const next = new Set(prev);
      if (next.has(letterId)) next.delete(letterId);
      else next.add(letterId);
      return next;
    });
  };

  const resetAddendumForm = () => {
    setAddendumForm({
      addendumType: "salary_revision",
      effectiveDate: "",
      reason: "",
      hrManagerName: "Alina Carter",
      oldDesignation: "", newDesignation: "",
      oldDepartment: "", newDepartment: "",
      oldSalary: "", newSalary: "",
      oldSalaryInWords: "", newSalaryInWords: "",
      oldConfirmationDate: "", newConfirmationDate: "",
      customClauseTitle: "", customClauseText: "",
      deviceItems: [],
      ccEmails: "",
      includeGrowthPlanClause: false,
      growthPlanCurrentSalary: "",
      growthPlanMaxRevisionSalary: "",
    });
    setAddendumAnnexures([]);
  };

  const handleCreateAddendum = async () => {
    if (!addendumDialog || !addendumForm.effectiveDate) return;
    if (addendumForm.includeGrowthPlanClause && !addendumForm.growthPlanCurrentSalary.trim()) {
      toast({ title: "Current salary is required for the 90-day performance review clause", variant: "destructive" });
      return;
    }
    setSubmittingAddendum(true);
    try {
      const payload = {
        ...addendumForm,
        ...(addendumAnnexures.length > 0 ? { annexures: addendumAnnexures } : {}),
      };
      const res = await apiRequest("POST", `/api/hr/tools/offer-letters/${addendumDialog.id}/addendums`, payload);
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      const addendumResult = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/hr/tools/offer-letters", addendumDialog.id, "addendums"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/tools/addendums/all"] });
      setExpandedOfferIds(prev => { const next = new Set(prev); next.add(addendumDialog.id); return next; });
      toast({ title: "Addendum created and sent!", description: "The candidate has been emailed a link to sign." });

      const employeeId = addendumDialog.resultingUserId;
      const referenceNumber = addendumResult?.referenceNumber || addendumResult?.id;
      if (employeeId && referenceNumber && addendumAnnexures.length > 0) {
        const goalsToCreate = buildGoalsFromAnnexures(addendumAnnexures, addendumForm.effectiveDate);
        if (goalsToCreate.length > 0) {
          const milestoneCount = goalsToCreate.reduce((sum, g) => sum + (g.milestones?.length || 0), 0);
          try {
            await apiRequest("POST", "/api/performance/goals/batch", {
              employeeId,
              sourceRef: referenceNumber,
              goals: goalsToCreate,
            });
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
      }

      setAddendumDialog(null);
      resetAddendumForm();
    } catch (err: any) {
      toast({ title: err.message || "Failed to create addendum", variant: "destructive" });
    } finally {
      setSubmittingAddendum(false);
    }
  };

  const { data: letters, isLoading } = useQuery<any[]>({
    queryKey: ["/api/hr/tools/offer-letters"],
  });

  const { data: allAddendums } = useQuery<any[]>({
    queryKey: ["/api/hr/tools/addendums/all"],
  });

  const { data: hrLetters } = useQuery<HrLetter[]>({
    queryKey: ["/api/hr/letters"],
    enabled: !!user && ["hr", "admin", "super_admin"].includes(user.role ?? ""),
  });

  const { data: standaloneUsersData } = useQuery<{ users: any[]; counts?: any } | any[]>({
    queryKey: ["/api/admin/users", "all_non_deleted"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users?status=all_non_deleted", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
  });
  const standaloneEmployees: any[] = Array.isArray(standaloneUsersData) ? standaloneUsersData : (standaloneUsersData?.users ?? []);

  const { data: standaloneDepartments } = useQuery<any[]>({
    queryKey: ["/api/departments"],
  });
  const standaloneDeptMap = useMemo(() => {
    const m: Record<string, string> = {};
    (Array.isArray(standaloneDepartments) ? standaloneDepartments : []).forEach((d: any) => { m[d.id] = d.name; });
    return m;
  }, [standaloneDepartments]);

  const filteredStandaloneEmployees = useMemo(() => {
    if (!standaloneEmployeeSearch) return standaloneEmployees.slice(0, 20);
    const s = standaloneEmployeeSearch.toLowerCase();
    return standaloneEmployees.filter((e: any) =>
      `${e.firstName} ${e.lastName}`.toLowerCase().includes(s) ||
      e.employeeId?.toLowerCase().includes(s) ||
      e.email?.toLowerCase().includes(s)
    ).slice(0, 20);
  }, [standaloneEmployees, standaloneEmployeeSearch]);

  const resetStandaloneForm = () => {
    setStandaloneForm({
      employeeName: "", employeeEmail: "", employeeDesignation: "",
      employeeDepartment: "", employeeJoiningDate: "", employeeReportingManager: "",
      addendumType: "salary_revision", effectiveDate: "", reason: "",
      hrManagerName: "Alina Carter",
      oldDesignation: "", newDesignation: "",
      oldDepartment: "", newDepartment: "",
      oldSalary: "", newSalary: "",
      oldSalaryInWords: "", newSalaryInWords: "",
      oldConfirmationDate: "", newConfirmationDate: "",
      customClauseTitle: "", customClauseText: "",
      deviceItems: [],
      ccEmails: "",
      includeGrowthPlanClause: false,
      growthPlanCurrentSalary: "",
      growthPlanMaxRevisionSalary: "",
    });
    setStandaloneAnnexures([]);
    setSelectedStandaloneEmployeeId(null);
    setStandaloneEmployeeSearch("");
  };

  const selectStandaloneEmployee = (emp: any) => {
    const mgr = emp.managerId ? standaloneEmployees.find((e: any) => e.id === emp.managerId) : undefined;
    const deptName = emp.departmentId ? (standaloneDeptMap[emp.departmentId] || "") : "";
    const designation = emp.designation || "";
    setSelectedStandaloneEmployeeId(emp.id);
    setStandaloneForm(f => ({
      ...f,
      employeeName: `${emp.firstName} ${emp.lastName}`.trim(),
      employeeEmail: emp.email || "",
      employeeDesignation: designation,
      employeeDepartment: deptName,
      employeeJoiningDate: emp.joiningDate || "",
      employeeReportingManager: mgr ? `${mgr.firstName} ${mgr.lastName}`.trim() : "",
      oldDesignation: designation,
      oldDepartment: deptName,
      oldSalary: emp.salary || "",
    }));
    setStandaloneEmployeeSearch("");
  };

  const clearStandaloneEmployee = () => {
    setSelectedStandaloneEmployeeId(null);
    setStandaloneEmployeeSearch("");
    setStandaloneForm(f => ({
      ...f,
      employeeName: "", employeeEmail: "", employeeDesignation: "",
      employeeDepartment: "", employeeJoiningDate: "", employeeReportingManager: "",
      oldDesignation: "", oldDepartment: "", oldSalary: "",
    }));
  };

  const handlePreviewStandaloneAddendum = async () => {
    if (!standaloneForm.employeeName || !standaloneForm.effectiveDate) {
      toast({ title: "Fill in Full Name and Effective Date to preview the document", variant: "destructive" });
      return;
    }
    setPreviewingStandalone(true);
    try {
      const res = await apiRequest("POST", "/api/hr/tools/addendums/standalone/preview", {
        ...standaloneForm,
        annexureData: standaloneAnnexures.length > 0 ? standaloneAnnexures : undefined,
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || "Preview failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(standaloneForm.employeeName || "Employee").replace(/\s+/g, "_")}_Addendum_PREVIEW.docx`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 2000);
      toast({ title: "Preview downloaded", description: "Open the DOCX file to review before sending." });
    } catch (err: any) {
      toast({ title: err.message || "Failed to generate preview", variant: "destructive" });
    } finally {
      setPreviewingStandalone(false);
    }
  };

  const handleCreateStandaloneAddendum = async () => {
    if (!standaloneForm.employeeName || !standaloneForm.employeeEmail || !standaloneForm.effectiveDate) return;
    if (standaloneForm.includeGrowthPlanClause && !standaloneForm.growthPlanCurrentSalary.trim()) {
      toast({ title: "Current salary is required for the 90-day performance review clause", variant: "destructive" });
      return;
    }
    setSubmittingStandalone(true);
    try {
      const res = await apiRequest("POST", "/api/hr/tools/addendums/standalone", {
        ...standaloneForm,
        forEmployeeId: selectedStandaloneEmployeeId || undefined,
        annexureData: standaloneAnnexures.length > 0 ? standaloneAnnexures : undefined,
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      const result = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/hr/tools/addendums/all"] });
      toast({ title: "Standalone addendum created and sent!", description: "The employee has been emailed a link to sign." });

      if (selectedStandaloneEmployeeId && standaloneAnnexures.length > 0) {
        const referenceNumber = result?.referenceNumber || result?.id;
        const goalsToCreate: { title: string; description?: string; startDate?: string; targetDate?: string }[] = [];
        for (const ann of standaloneAnnexures) {
          if (!ann.table || !ann.goalPush?.enabled || ann.goalPush.selectedRows.length === 0) continue;
          for (const rowIdx of ann.goalPush.selectedRows) {
            const row = ann.table.rows[rowIdx];
            if (!row || !row[0].trim()) continue;
            goalsToCreate.push({
              title: row[0].trim(),
              description: row[1]?.trim() || undefined,
              startDate: standaloneForm.effectiveDate || undefined,
              targetDate: ann.goalPush.dueDate || undefined,
            });
          }
        }
        if (goalsToCreate.length > 0 && referenceNumber) {
          try {
            await apiRequest("POST", "/api/performance/goals/batch", {
              employeeId: selectedStandaloneEmployeeId,
              sourceRef: referenceNumber,
              goals: goalsToCreate,
            });
            queryClient.invalidateQueries({ queryKey: ["/api/performance/goals"] });
            toast({ title: `${goalsToCreate.length} performance goal${goalsToCreate.length > 1 ? "s" : ""} pushed`, description: `Linked to addendum ${referenceNumber}` });
          } catch {
            toast({ title: "Goals could not be pushed", description: "Addendum was created. Goals may need to be added manually.", variant: "destructive" });
          }
        }
      }

      setStandaloneDialog(false);
      resetStandaloneForm();
    } catch (err: any) {
      toast({ title: err.message || "Failed to create standalone addendum", variant: "destructive" });
    } finally {
      setSubmittingStandalone(false);
    }
  };

  const countersignMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/admin/offer-letters/${id}/countersign`, {
        counterSignedName,
        counterSignedDate
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/tools/offer-letters"] });
      toast({ title: "Offer letter counter-signed" });
      setCountersignModal(null);
    },
    onError: (err: any) => toast({ title: err.message, variant: "destructive" }),
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/hr/tools/offer-letters/${id}/cancel`);
      if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/tools/offer-letters"] });
      toast({ title: "Offer letter cancelled" });
    },
    onError: (err: any) => toast({ title: err.message, variant: "destructive" }),
  });

  const withdrawMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/hr/tools/offer-letters/${id}/withdraw`);
      if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/tools/offer-letters"] });
      toast({ title: "Offer letter withdrawn" });
    },
    onError: (err: any) => toast({ title: err.message, variant: "destructive" }),
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PATCH", `/api/hr/tools/offer-letters/${id}/approve`);
      if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/tools/offer-letters"] });
      toast({ title: "Offer letter approved and sent to candidate" });
    },
    onError: (err: any) => toast({ title: err.message, variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await apiRequest("PATCH", `/api/hr/tools/offer-letters/${id}/reject`, { reason });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/tools/offer-letters"] });
      toast({ title: "Offer letter rejected — manager has been notified" });
      setRejectDialog(null);
      setRejectReason("");
    },
    onError: (err: any) => toast({ title: err.message, variant: "destructive" }),
  });

  const hrRevokeMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      await apiRequest("POST", `/api/hr/letters/${id}/revoke`, { revokeReason: reason });
    },
    onSuccess: () => {
      toast({ title: "Letter revoked" });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/letters"] });
      setHrRevokeDialog(null);
      setHrRevokeReason("");
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const hrReissueMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      await apiRequest("POST", `/api/hr/letters/${id}/reissue`, { reissueReason: reason });
    },
    onSuccess: () => {
      toast({ title: "Letter re-issued", description: "A corrected letter has been issued with the employee's current data." });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/letters"] });
      setHrReissueDialog(null);
      setHrReissueReason("");
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const hrEmailMutation = useMutation({
    mutationFn: async ({ id, ccEmails }: { id: string; ccEmails?: string }) => {
      const res = await apiRequest("POST", `/api/hr/letters/${id}/email`, ccEmails ? { ccEmails } : undefined);
      return res.json();
    },
    onSuccess: (data: { sentTo: string }) => {
      toast({ title: "Email sent", description: `Letter emailed to ${data.sentTo}` });
      setHrEmailDialog(null);
      setHrEmailCc("");
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const addendumResend = async (addendum: any) => {
    const url = addendum.isStandalone
      ? `/api/hr/tools/addendums/${addendum.id}/send`
      : `/api/hr/tools/offer-letters/${addendum.offerLetterId}/addendums/${addendum.id}/send`;
    const res = await apiRequest("POST", url);
    if (res.ok) toast({ title: "Addendum email resent" });
    else toast({ title: "Failed to resend", variant: "destructive" });
  };

  const addendumCancel = async (addendum: any) => {
    const url = addendum.isStandalone
      ? `/api/hr/tools/addendums/${addendum.id}/cancel`
      : `/api/hr/tools/offer-letters/${addendum.offerLetterId}/addendums/${addendum.id}/cancel`;
    const res = await apiRequest("POST", url);
    if (res.ok) { queryClient.invalidateQueries({ queryKey: ["/api/hr/tools/addendums/all"] }); toast({ title: "Addendum cancelled" }); }
    else toast({ title: "Failed to cancel", variant: "destructive" });
  };

  const addendumCountersign = async (addendum: any) => {
    const res = await apiRequest("POST", `/api/hr/tools/addendums/${addendum.id}/countersign`);
    if (res.ok) { queryClient.invalidateQueries({ queryKey: ["/api/hr/tools/addendums/all"] }); toast({ title: "Addendum counter-signed" }); }
    else toast({ title: "Failed to counter-sign", variant: "destructive" });
  };

  const handleStartOnboarding = async () => {
    if (!hireInEmail || !hireInEmail.endsWith("@hire-in.com")) {
      toast({ title: "Email must end with @hire-in.com", variant: "destructive" });
      return;
    }

    setOnboarding(true);
    try {
      const res = await apiRequest("POST", `/api/hr/tools/offer-letters/${onboardingModal.id}/start-onboarding`, {
        hireInEmail,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/hr/tools/offer-letters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Onboarding complete!",
        description: `Employee ID: ${data.employeeId} — Welcome email sent to ${hireInEmail}`,
      });
      setOnboardingModal(null);
      setHireInEmail("");
    } catch (err: any) {
      toast({ title: err.message || "Failed to start onboarding", variant: "destructive" });
    } finally {
      setOnboarding(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isHrOrAdmin = user && ["hr", "admin", "super_admin"].includes(user.role ?? "");
  const canApproveOfferLetter = user?.role === "super_admin";
  const pendingLetters = letters?.filter((l: any) => l.status === "pending_approval") ?? [];
  const statusBucket = (s: string): string => {
    if (["pending_approval", "draft"].includes(s)) return "needs_approval";
    if (["countersigned", "onboarded"].includes(s)) return "signed";
    if (["rejected", "cancelled", "expired", "revoked"].includes(s)) return "closed";
    return "active";
  };
  // Top-level status tabs grouping (layered above the Type/Status dropdowns).
  const topBucket = (s: string): "active" | "completed" | "closed" => {
    if (["accepted", "countersigned", "onboarded", "issued", "delivered", "signed", "reissued"].includes(s)) return "completed";
    if (["rejected", "cancelled", "expired", "revoked"].includes(s)) return "closed";
    return "active";
  };

  const ts = (v: any): number => { const t = v ? new Date(v).getTime() : 0; return isNaN(t) ? 0 : t; };

  type UnifiedRow = {
    key: string;
    kind: "offer" | "addendum" | "standalone_addendum" | "hr_letter";
    typeValue: string;
    typeLabel: string;
    subLabel: string;
    name: string;
    meta: string;
    status: string;
    bucket: string;
    statusLabel: string;
    statusClass: string;
    reference: string;
    sortDate: number;
    dateLabel: string;
    raw: any;
  };

  const rows: UnifiedRow[] = [];

  (letters ?? []).forEach((l: any) => {
    const si = STATUS_BADGES[l.status] || STATUS_BADGES.sent;
    rows.push({
      key: `offer-${l.id}`,
      kind: "offer",
      typeValue: "offer_letter",
      typeLabel: "Offer Letter",
      subLabel: "",
      name: l.candidateName,
      meta: [l.designation, l.departmentName].filter(Boolean).join(" · ") || (l.candidatePersonalEmail || "—"),
      status: l.status,
      bucket: statusBucket(l.status),
      statusLabel: si.label,
      statusClass: si.className,
      reference: "—",
      sortDate: ts(l.createdAt),
      dateLabel: l.createdAt ? new Date(l.createdAt).toLocaleDateString() : "—",
      raw: l,
    });
  });

  (allAddendums ?? []).forEach((a: any) => {
    const si = ADDENDUM_STATUS_BADGES[a.status] || ADDENDUM_STATUS_BADGES.sent;
    const manual = (a.manualEmployeeData as any) || {};
    rows.push({
      key: `addendum-${a.id}`,
      kind: a.isStandalone ? "standalone_addendum" : "addendum",
      typeValue: a.isStandalone ? "standalone_addendum" : "addendum",
      typeLabel: a.isStandalone ? "Standalone · Addendum" : "Addendum",
      subLabel: ADDENDUM_TYPE_LABELS[a.addendumType] || a.addendumType || "",
      name: a.candidateName,
      meta: [manual.designation, manual.department].filter(Boolean).join(" · ") || "—",
      status: a.status,
      bucket: statusBucket(a.status),
      statusLabel: si.label,
      statusClass: si.className,
      reference: a.referenceNumber || "—",
      sortDate: ts(a.createdAt || a.issuedAt),
      dateLabel: a.issuedAt ? new Date(a.issuedAt).toLocaleDateString() : (a.createdAt ? new Date(a.createdAt).toLocaleDateString() : "—"),
      raw: a,
    });
  });

  (hrLetters ?? []).forEach((h: any) => {
    const sc = HR_STATUS_CONFIG[h.status] || HR_STATUS_CONFIG.draft;
    rows.push({
      key: `hr-${h.id}`,
      kind: "hr_letter",
      typeValue: h.templateType,
      typeLabel: TEMPLATE_LABELS[h.templateType] || h.templateType,
      subLabel: "",
      name: h.employeeName,
      meta: [h.employeeCode, h.designation].filter(Boolean).join(" · ") || "—",
      status: h.status,
      bucket: statusBucket(h.status),
      statusLabel: sc.label,
      statusClass: sc.className,
      reference: h.referenceNumber || "—",
      sortDate: ts(h.createdAt || h.issueDate),
      dateLabel: h.issueDate || (h.createdAt ? new Date(h.createdAt).toLocaleDateString() : "—"),
      raw: h,
    });
  });

  const topTabCounts = {
    active: rows.filter((r) => topBucket(r.status) === "active").length,
    completed: rows.filter((r) => topBucket(r.status) === "completed").length,
    closed: rows.filter((r) => topBucket(r.status) === "closed").length,
  };

  const unifiedRows = rows
    .filter((r) => topBucket(r.status) === topTab)
    .filter((r) => typeFilter === "all" || r.typeValue === typeFilter)
    .filter((r) => statusFilter === "all" || r.bucket === statusFilter)
    .sort((a, b) => b.sortDate - a.sortDate);

  const TYPE_FILTER_OPTIONS: { value: string; label: string }[] = [
    { value: "all", label: "All Types" },
    { value: "offer_letter", label: "Offer Letter" },
    { value: "addendum", label: "Addendum" },
    { value: "standalone_addendum", label: "Standalone Addendum" },
    ...Object.entries(TEMPLATE_LABELS).map(([k, v]) => ({ value: k, label: v as string })),
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#1F3A6E]" data-testid="text-letters-heading">Letters</h2>
          <p className="text-sm text-muted-foreground">
            All offer letters, addendums, and HR letters in one place.
          </p>
        </div>
        {isHrOrAdmin && (
          <Button
            size="sm"
            variant="outline"
            className="border-purple-300 text-purple-700 hover:bg-purple-50 shrink-0"
            onClick={() => { resetStandaloneForm(); setStandaloneDialog(true); }}
            data-testid="button-new-standalone-addendum"
          >
            <FilePlus className="h-4 w-4 mr-1.5" />
            New Standalone Addendum
          </Button>
        )}
      </div>

      <Tabs value={topTab} onValueChange={(v) => setTopTab(v as "active" | "completed" | "closed")}>
        <TabsList data-testid="tabs-letters-status">
          <TabsTrigger value="active" data-testid="tab-letters-active">
            Active
            {topTabCounts.active > 0 && (
              <span className="ml-2 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 text-xs font-bold rounded-full bg-[#F47C20] text-white">
                {topTabCounts.active}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="completed" data-testid="tab-letters-completed">
            Completed
            {topTabCounts.completed > 0 && (
              <span className="ml-2 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 text-xs font-bold rounded-full bg-muted text-muted-foreground">
                {topTabCounts.completed}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="closed" data-testid="tab-letters-closed">
            Rejected / Closed
            {topTabCounts.closed > 0 && (
              <span className="ml-2 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 text-xs font-bold rounded-full bg-muted text-muted-foreground">
                {topTabCounts.closed}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-56" data-testid="select-type-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            {TYPE_FILTER_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44" data-testid="select-status-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="needs_approval">Needs Approval</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="signed">Signed</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {unifiedRows.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1" data-testid="text-no-letters">No Letters Found</h3>
            <p className="text-muted-foreground text-sm">Try changing the type or status filter.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="text-left px-4 py-3 font-semibold">Name</th>
                    <th className="text-left px-4 py-3 font-semibold">Type</th>
                    <th className="text-left px-4 py-3 font-semibold">Status</th>
                    <th className="text-left px-4 py-3 font-semibold">Reference</th>
                    <th className="text-left px-4 py-3 font-semibold">Date</th>
                    <th className="text-right px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {unifiedRows.map((row) => {
                    const isPending = row.status === "pending_approval";
                    return (
                      <tr key={row.key} className={`border-b transition-colors hover:bg-muted/20 ${isPending ? "bg-orange-50/60" : ""}`} data-testid={`row-letter-${row.key}`}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-[#1F3A6E]" data-testid={`text-name-${row.key}`}>{row.name}</div>
                          <div className="text-xs text-muted-foreground">{row.meta}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-medium" data-testid={`text-type-${row.key}`}>{row.typeLabel}</span>
                            {row.subLabel && <span className="text-[11px] text-muted-foreground">{row.subLabel}</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${row.statusClass}`} data-testid={`badge-status-${row.key}`}>
                            {row.statusLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{row.reference}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{row.dateLabel}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 flex-wrap justify-end">
                            {row.kind === "offer" && (() => {
                              const letter = row.raw;
                              const canHaveAddendum = letter.status === "countersigned" || letter.status === "onboarded";
                              return (
                                <>
                                  {letter.status !== "cancelled" && letter.status !== "expired" && letter.status !== "rejected" && (
                                    <Button size="sm" variant="outline" onClick={() => setViewLetterModal(letter)} data-testid={`button-view-letter-${letter.id}`}>
                                      <FileSearch className="h-4 w-4 mr-1" /> View
                                    </Button>
                                  )}
                                  {(letter.status === "pending_approval" || letter.status === "rejected") && (user?.role === "super_admin" || letter.createdBy === user?.id) && (
                                    <Button size="sm" variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50" onClick={() => setLocation(`/admin/new-hire?tab=new-offer-letter&editId=${letter.id}`)} data-testid={`button-edit-letter-${letter.id}`}>
                                      <Pencil className="h-4 w-4 mr-1" /> Edit
                                    </Button>
                                  )}
                                  {letter.status === "pending_approval" && (user?.role === "super_admin" || letter.createdBy === user?.id) && (
                                    <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-red-700" onClick={() => { if (window.confirm(`Withdraw the offer letter for ${letter.candidateName}? It will be removed from the approval queue.`)) withdrawMutation.mutate(letter.id); }} disabled={withdrawMutation.isPending} data-testid={`button-withdraw-${letter.id}`}>
                                      <RotateCcw className="h-4 w-4 mr-1" /> Withdraw
                                    </Button>
                                  )}
                                  {isPending && canApproveOfferLetter && (
                                    <>
                                      <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => approveMutation.mutate(letter.id)} disabled={approveMutation.isPending} data-testid={`button-approve-${letter.id}`}>
                                        <CheckCircle className="h-4 w-4 mr-1" /> Approve
                                      </Button>
                                      <Button size="sm" variant="destructive" onClick={() => { setRejectDialog(letter); setRejectReason(""); }} disabled={rejectMutation.isPending} data-testid={`button-reject-${letter.id}`}>
                                        <XCircle className="h-4 w-4 mr-1" /> Reject
                                      </Button>
                                    </>
                                  )}
                                  {(letter.status === "sent" || letter.status === "viewed") && (
                                    <Button size="sm" variant="ghost" onClick={() => cancelMutation.mutate(letter.id)} disabled={cancelMutation.isPending} data-testid={`button-cancel-${letter.id}`}>
                                      <XCircle className="h-4 w-4 mr-1" /> Cancel
                                    </Button>
                                  )}
                                  {letter.status === "accepted" && isHrOrAdmin && (
                                    <>
                                      <Button size="sm" onClick={() => { setCountersignModal(letter); setCounterSignedName("Alina Carter"); setCounterSignedDate(new Date().toISOString().split("T")[0]); }} data-testid={`button-countersign-${letter.id}`}>
                                        <CheckCircle className="h-4 w-4 mr-1" /> Counter Sign
                                      </Button>
                                      <Button size="sm" variant="ghost" onClick={() => cancelMutation.mutate(letter.id)} disabled={cancelMutation.isPending} data-testid={`button-cancel-${letter.id}`}>
                                        <XCircle className="h-4 w-4 mr-1" /> Cancel
                                      </Button>
                                    </>
                                  )}
                                  {letter.status === "countersigned" && (
                                    <Button size="sm" onClick={() => { setOnboardingModal(letter); setHireInEmail(""); }} data-testid={`button-onboard-${letter.id}`}>
                                      <UserPlus className="h-4 w-4 mr-1" /> Onboard
                                    </Button>
                                  )}
                                  {letter.status === "onboarded" && letter.resultingUserId && (
                                    <Button size="sm" variant="outline" onClick={() => setLocation(`/admin/users`)} data-testid={`button-view-employee-${letter.id}`}>
                                      <ExternalLink className="h-4 w-4 mr-1" /> Employee
                                    </Button>
                                  )}
                                  {canHaveAddendum && (
                                    <Button size="sm" variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50" onClick={() => { resetAddendumForm(); setAddendumDialog(letter); }} data-testid={`button-add-addendum-${letter.id}`}>
                                      <FilePlus className="h-4 w-4 mr-1" /> Addendum
                                    </Button>
                                  )}
                                </>
                              );
                            })()}

                            {(row.kind === "addendum" || row.kind === "standalone_addendum") && (() => {
                              const addendum = row.raw;
                              const dlUrl = addendum.isStandalone
                                ? `/api/hr/tools/addendums/${addendum.id}/download`
                                : `/api/hr/tools/offer-letters/${addendum.offerLetterId}/addendums/${addendum.id}/download`;
                              return (
                                <>
                                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setViewAddendum(addendum)} data-testid={`button-view-addendum-${addendum.id}`}>
                                    <Eye className="h-3 w-3 mr-1" /> View
                                  </Button>
                                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => window.open(dlUrl, "_blank")} data-testid={`button-download-addendum-${addendum.id}`}>
                                    <Download className="h-3 w-3 mr-1" /> DOCX
                                  </Button>
                                  {addendum.status === "sent" && (
                                    <>
                                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => addendumResend(addendum)} data-testid={`button-resend-addendum-${addendum.id}`}>
                                        <RefreshCw className="h-3 w-3 mr-1" /> Resend
                                      </Button>
                                      <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => addendumCancel(addendum)} data-testid={`button-cancel-addendum-${addendum.id}`}>
                                        <XCircle className="h-3 w-3 mr-1" /> Cancel
                                      </Button>
                                    </>
                                  )}
                                  {addendum.status === "accepted" && isHrOrAdmin && (
                                    <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => addendumCountersign(addendum)} data-testid={`button-countersign-addendum-${addendum.id}`}>
                                      <CheckCircle className="h-3 w-3 mr-1" /> Counter-Sign
                                    </Button>
                                  )}
                                </>
                              );
                            })()}

                            {row.kind === "hr_letter" && (() => {
                              const letter = row.raw as HrLetter;
                              return (
                                <>
                                  <Button variant="ghost" size="sm" onClick={() => { setHrViewLetter(letter); }} data-testid={`button-view-hr-${letter.id}`}>
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => window.open(`/api/hr/letters/${letter.id}/download`, "_blank")} data-testid={`button-download-hr-${letter.id}`}>
                                    <Download className="h-4 w-4 text-green-600" />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => window.open(`/api/hr/letters/${letter.id}/download?inline=1`, "_blank")} data-testid={`button-print-hr-${letter.id}`}>
                                    <Printer className="h-4 w-4 text-slate-600" />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => { setHrEmailDialog(letter); setHrEmailCc(""); }} disabled={hrEmailMutation.isPending} data-testid={`button-email-hr-${letter.id}`}>
                                    <Mail className="h-4 w-4 text-blue-600" />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => setHrReissueDialog(letter)} data-testid={`button-reissue-hr-${letter.id}`}>
                                    <RotateCcw className="h-4 w-4 text-amber-600" />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => setHrRevokeDialog(letter)} data-testid={`button-revoke-hr-${letter.id}`}>
                                    <XCircle className="h-4 w-4 text-red-600" />
                                  </Button>
                                </>
                              );
                            })()}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!rejectDialog} onOpenChange={(open) => { if (!open) { setRejectDialog(null); setRejectReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Offer Letter</DialogTitle>
            <DialogDescription>
              Reject the offer letter for <strong>{rejectDialog?.candidateName}</strong> ({rejectDialog?.designation}). The manager who submitted it will be notified.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Reason for Rejection (optional)</Label>
              <Textarea
                data-testid="input-rejection-reason"
                placeholder="Explain why this offer is being rejected..."
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectDialog(null); setRejectReason(""); }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => rejectMutation.mutate({ id: rejectDialog.id, reason: rejectReason })}
              disabled={rejectMutation.isPending}
              data-testid="button-confirm-reject"
            >
              {rejectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
              Reject Offer Letter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewAddendum} onOpenChange={(open) => { if (!open) setViewAddendum(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {viewAddendum && (() => {
            const a = viewAddendum;
            const med = (a.manualEmployeeData && typeof a.manualEmployeeData === "object") ? a.manualEmployeeData as Record<string, any> : {};
            const statusInfo = ADDENDUM_STATUS_BADGES[a.status] || ADDENDUM_STATUS_BADGES.sent;
            const ccList: string[] = a.ccEmails ? String(a.ccEmails).split(",").map((e: string) => e.trim()).filter(Boolean) : [];
            const rows: Array<{ label: string; oldVal: string; newVal: string }> = [];
            if (a.addendumType === "salary_revision" || a.addendumType === "combined") {
              if (a.oldSalary || a.newSalary) rows.push({
                label: "Annual CTC",
                oldVal: a.oldSalary ? `${a.oldSalary}${a.oldSalaryInWords ? ` (${a.oldSalaryInWords})` : ""}` : "—",
                newVal: a.newSalary ? `${a.newSalary}${a.newSalaryInWords ? ` (${a.newSalaryInWords})` : ""}` : "—",
              });
            }
            if (a.addendumType === "role_change" || a.addendumType === "combined") {
              if (a.oldDesignation || a.newDesignation) rows.push({ label: "Designation / Title", oldVal: a.oldDesignation || "—", newVal: a.newDesignation || "—" });
              if (a.oldDepartment || a.newDepartment) rows.push({ label: "Department", oldVal: a.oldDepartment || "—", newVal: a.newDepartment || "—" });
            }
            if (a.addendumType === "probation_extension") {
              if (a.oldConfirmationDate || a.newConfirmationDate) rows.push({ label: "Confirmation Date", oldVal: a.oldConfirmationDate || "—", newVal: a.newConfirmationDate || "—" });
            }
            const deviceItems: Array<{ description?: string; serialNumber?: string; assetTag?: string; condition?: string }> = Array.isArray(a.deviceItems) ? a.deviceItems : [];
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <span>{ADDENDUM_TYPE_LABELS[a.addendumType] || a.addendumType}</span>
                    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${statusInfo.className}`} data-testid="text-view-addendum-status">
                      {statusInfo.label}
                    </span>
                  </DialogTitle>
                  <DialogDescription>
                    Amendment letter for <strong>{a.candidateName}</strong>
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm bg-muted/30 rounded-md p-3">
                    <div>
                      <span className="text-xs text-muted-foreground block">Employee</span>
                      <span className="font-medium" data-testid="text-view-employee">{a.candidateName}</span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">Effective Date</span>
                      <span className="font-medium" data-testid="text-view-effective-date">{a.effectiveDate || "—"}</span>
                    </div>
                    {(med.designation || med.department) && (
                      <div>
                        <span className="text-xs text-muted-foreground block">Designation / Dept</span>
                        <span className="font-medium">{med.designation || "—"}{med.department ? ` · ${med.department}` : ""}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-xs text-muted-foreground block">Issued</span>
                      <span className="font-medium">{a.issuedAt ? new Date(a.issuedAt).toLocaleDateString() : "—"}</span>
                    </div>
                  </div>

                  {(rows.length > 0 || deviceItems.length > 0 || a.customClauseTitle || a.customClauseText) && (
                    <div>
                      <h4 className="text-sm font-semibold text-[#1F3A6E] mb-2">Amendment Details</h4>
                      {rows.length > 0 && (
                        <div className="overflow-x-auto rounded-md border">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                                <th className="text-left p-2 font-semibold">Field</th>
                                <th className="text-left p-2 font-semibold">Previous</th>
                                <th className="text-left p-2 font-semibold">New</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((r, i) => (
                                <tr key={i} className="border-t" data-testid={`row-view-term-${i}`}>
                                  <td className="p-2 font-medium">{r.label}</td>
                                  <td className="p-2 text-muted-foreground">{r.oldVal}</td>
                                  <td className="p-2 font-semibold text-green-700">{r.newVal}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {a.addendumType === "device_allocation" && (
                        <div className="overflow-x-auto rounded-md border mt-2">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                                <th className="text-left p-2 font-semibold w-10">#</th>
                                <th className="text-left p-2 font-semibold">Item</th>
                                <th className="text-left p-2 font-semibold">Asset Tag / Serial</th>
                                <th className="text-left p-2 font-semibold">Condition</th>
                              </tr>
                            </thead>
                            <tbody>
                              {deviceItems.length === 0 ? (
                                <tr><td colSpan={4} className="p-3 text-center text-muted-foreground">No devices listed</td></tr>
                              ) : deviceItems.map((d, i) => (
                                <tr key={i} className="border-t" data-testid={`row-view-device-${i}`}>
                                  <td className="p-2 text-center text-muted-foreground">{i + 1}</td>
                                  <td className="p-2 font-medium">{d.description || "—"}</td>
                                  <td className="p-2 text-muted-foreground font-mono text-xs">{d.assetTag || d.serialNumber || "—"}</td>
                                  <td className="p-2 text-muted-foreground">{d.condition || "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {(a.customClauseTitle || a.customClauseText) && (
                        <div className="mt-2 rounded-md border p-3 text-sm">
                          {a.customClauseTitle && <p className="font-semibold text-[#1F3A6E] mb-1">{a.customClauseTitle}</p>}
                          {a.customClauseText && <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{a.customClauseText}</p>}
                        </div>
                      )}
                    </div>
                  )}

                  {a.reason && (
                    <div>
                      <h4 className="text-sm font-semibold text-[#1F3A6E] mb-1">Reason</h4>
                      <p className="text-sm text-muted-foreground">{a.reason}</p>
                    </div>
                  )}

                  {ccList.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-[#1F3A6E] mb-1">CC Recipients</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {ccList.map((e, i) => (
                          <Badge key={i} variant="outline" className="text-xs" data-testid={`badge-view-cc-${i}`}>{e}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="rounded-md border p-3 text-sm space-y-2">
                    <h4 className="text-sm font-semibold text-[#1F3A6E]">Signature Status</h4>
                    {a.acceptedAt ? (
                      <div className="space-y-1" data-testid="text-view-employee-signature">
                        <div className="flex items-center gap-2 text-green-700">
                          <CheckCircle className="h-4 w-4" />
                          <span className="font-medium">Signed by employee</span>
                        </div>
                        <div className="text-xs text-muted-foreground pl-6">
                          {a.acceptedName ? <div>Signed as: <span className="font-medium text-foreground">{a.acceptedName}</span></div> : null}
                          <div>On: {new Date(a.acceptedAt).toLocaleString()}</div>
                          {a.authCode ? <div>Auth code: <code className="font-mono">{a.authCode}</code></div> : null}
                        </div>
                      </div>
                    ) : a.status === "cancelled" ? (
                      <p className="text-xs text-muted-foreground">This amendment was cancelled.</p>
                    ) : (
                      <div className="flex items-center gap-2 text-amber-700" data-testid="text-view-pending-signature">
                        <Clock className="h-4 w-4" />
                        <span className="font-medium">Pending employee signature</span>
                      </div>
                    )}

                    {a.counterSignedAt ? (
                      <div className="space-y-1 border-t pt-2" data-testid="text-view-countersignature">
                        <div className="flex items-center gap-2 text-emerald-700">
                          <CheckCircle className="h-4 w-4" />
                          <span className="font-medium">Counter-signed by HR</span>
                        </div>
                        <div className="text-xs text-muted-foreground pl-6">
                          {a.hrManagerName ? <div>By: <span className="font-medium text-foreground">{a.hrManagerName}</span></div> : null}
                          <div>On: {new Date(a.counterSignedAt).toLocaleString()}</div>
                          {a.counterAuthCode ? <div>Auth code: <code className="font-mono">{a.counterAuthCode}</code></div> : null}
                        </div>
                      </div>
                    ) : a.acceptedAt ? (
                      <div className="flex items-center gap-2 text-amber-700 border-t pt-2">
                        <Clock className="h-4 w-4" />
                        <span className="font-medium">Awaiting HR counter-signature</span>
                      </div>
                    ) : null}
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => window.open(`/api/hr/tools/addendums/${a.id}/download`, "_blank")}
                    data-testid="button-view-download-docx"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download DOCX
                  </Button>
                  <Button onClick={() => setViewAddendum(null)} data-testid="button-view-close">Close</Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={!!onboardingModal} onOpenChange={(open) => { if (!open) setOnboardingModal(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Onboarding</DialogTitle>
            <DialogDescription>
              Create an employee profile for <strong>{onboardingModal?.candidateName}</strong> ({onboardingModal?.designation}).
              An onboarding welcome email will be sent to their @hire-in.com address with login credentials and a 10-step onboarding guide.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Hire-in Email Address</Label>
              <Input
                data-testid="input-hirein-email"
                type="email"
                placeholder="firstname.lastname@hire-in.com"
                value={hireInEmail}
                onChange={e => setHireInEmail(e.target.value)}
              />
              {hireInEmail && !hireInEmail.endsWith("@hire-in.com") && (
                <p className="text-xs text-destructive mt-1">Email must end with @hire-in.com</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOnboardingModal(null)} data-testid="button-cancel-onboard">
              Cancel
            </Button>
            <Button
              onClick={handleStartOnboarding}
              disabled={onboarding || !hireInEmail.endsWith("@hire-in.com")}
              data-testid="button-confirm-onboard"
            >
              {onboarding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Send Onboarding Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!countersignModal} onOpenChange={(open) => { if (!open) setCountersignModal(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Counter-Sign Offer Letter</DialogTitle>
            <DialogDescription>
              Digitally sign the offer letter for <strong>{countersignModal?.candidateName}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-muted/30 p-3 rounded-md space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Candidate Name:</span>
                <span className="font-medium">{countersignModal?.candidateName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Designation:</span>
                <span className="font-medium">{countersignModal?.designation}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Candidate Signed:</span>
                <span className="font-medium">{countersignModal?.acceptedName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Acceptance Date:</span>
                <span className="font-medium">{countersignModal?.acceptanceDate}</span>
              </div>
              <div className="flex flex-col gap-1 mt-1 border-t pt-1">
                <span className="text-muted-foreground">Candidate Auth Code:</span>
                <code className="bg-muted p-1 rounded font-mono text-[10px] break-all">{countersignModal?.authCode}</code>
              </div>
              {Array.isArray(countersignModal?.policyAnnexures) && countersignModal.policyAnnexures.length > 0 && (
                <div className="flex flex-col gap-1.5 mt-1 border-t pt-1">
                  <span className="text-muted-foreground">Attached Policy Annexures (click to read):</span>
                  <div className="flex flex-col gap-1" data-testid="countersign-policy-annexures">
                    {countersignModal.policyAnnexures.map((key: string) => {
                      const label = {
                        leave_policy: "Annexure A — Leave Policy",
                        attendance_policy: "Annexure B — Attendance",
                        code_of_conduct: "Annexure C — Code of Conduct",
                        nda: "Annexure D — NDA",
                      }[key] ?? key;
                      const initials = countersignAnnexureInitials[key];
                      return (
                        <div key={key} className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => setAnnexureViewerKey(key)}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-800 hover:text-blue-900 hover:underline"
                            data-testid={`button-countersign-view-annexure-${key}`}
                          >
                            <BookOpen className="h-3 w-3 shrink-0" />
                            {label}
                          </button>
                          {initials && (
                            <span className="text-[10px] text-muted-foreground shrink-0" data-testid={`text-countersign-annexure-initials-${key}`}>
                              Initialed: <span className="font-semibold text-foreground">{initials}</span>
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>HR Manager Name (Fixed Signatory)</Label>
              <Input
                data-testid="input-countersign-name"
                value={counterSignedName}
                onChange={e => setCounterSignedName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Signing Date</Label>
              <Input
                data-testid="input-countersign-date"
                type="date"
                value={counterSignedDate}
                onChange={e => setCounterSignedDate(e.target.value)}
              />
            </div>

            {counterSignedName && (
              <div className="pt-2">
                <Label className="text-xs text-muted-foreground mb-1 block">Signature Preview</Label>
                <div 
                  className="p-4 border rounded-md bg-white flex items-center justify-center min-h-[80px]"
                  style={{ fontFamily: "'Dancing Script', cursive" }}
                >
                  <span className="text-3xl text-slate-800">{counterSignedName}</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCountersignModal(null)} data-testid="button-cancel-countersign">
              Cancel
            </Button>
            <Button
              onClick={() => countersignMutation.mutate(countersignModal.id)}
              disabled={countersignMutation.isPending || !counterSignedName.trim()}
              data-testid="button-confirm-countersign"
            >
              {countersignMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              Complete Counter-Signature
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Policy Annexure full-text viewer (countersign view) */}
      <Dialog open={annexureViewerKey !== null} onOpenChange={(open) => { if (!open) setAnnexureViewerKey(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="dialog-countersign-annexure-content">
          <DialogHeader>
            <DialogTitle data-testid="text-countersign-annexure-dialog-title">
              {annexureViewerContent?.title ?? "Policy Annexure"}
            </DialogTitle>
          </DialogHeader>
          {annexureViewerContent ? (
            <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed" data-testid="text-countersign-annexure-dialog-body">
              {annexureViewerContent.body}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Addendum Dialog */}
      <Dialog open={!!addendumDialog} onOpenChange={(open) => { if (!open) { setAddendumDialog(null); resetAddendumForm(); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FilePlus className="h-5 w-5 text-blue-600" />
              Create Offer Letter Addendum
            </DialogTitle>
            <DialogDescription>
              Issue an amendment for <strong>{addendumDialog?.candidateName}</strong> ({addendumDialog?.designation}).
              The candidate will receive an email with a link to sign the addendum.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Type */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Addendum Type</Label>
                <Select value={addendumForm.addendumType} onValueChange={v => setAddendumForm(f => ({ ...f, addendumType: v }))}>
                  <SelectTrigger data-testid="select-addendum-type" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="salary_revision">Salary Revision</SelectItem>
                    <SelectItem value="role_change">Role / Title Change</SelectItem>
                    <SelectItem value="probation_extension">Probation Extension</SelectItem>
                    <SelectItem value="combined">Combined Role & Salary</SelectItem>
                    <SelectItem value="custom">Custom Amendment</SelectItem>
                    <SelectItem value="device_allocation">Company Device Allocation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Effective Date</Label>
                <Input
                  data-testid="input-addendum-effective-date"
                  type="date"
                  className="mt-1"
                  value={addendumForm.effectiveDate}
                  onChange={e => setAddendumForm(f => ({ ...f, effectiveDate: e.target.value }))}
                />
              </div>
            </div>

            {/* Salary fields */}
            {(addendumForm.addendumType === "salary_revision" || addendumForm.addendumType === "combined") && (
              <div className="border rounded-lg p-4 space-y-3 bg-muted/10">
                <h4 className="text-sm font-semibold text-blue-900">Salary Details</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Old Annual CTC</Label>
                    <Input data-testid="input-old-salary" className="mt-1" placeholder="e.g. 600000" value={addendumForm.oldSalary} onChange={e => setAddendumForm(f => ({ ...f, oldSalary: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">New Annual CTC</Label>
                    <Input data-testid="input-new-salary" className="mt-1" placeholder="e.g. 720000" value={addendumForm.newSalary} onChange={e => setAddendumForm(f => ({ ...f, newSalary: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Old CTC in Words</Label>
                    <Input data-testid="input-old-salary-words" className="mt-1" placeholder="Six Lakh" value={addendumForm.oldSalaryInWords} onChange={e => setAddendumForm(f => ({ ...f, oldSalaryInWords: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">New CTC in Words</Label>
                    <Input data-testid="input-new-salary-words" className="mt-1" placeholder="Seven Lakh Twenty Thousand" value={addendumForm.newSalaryInWords} onChange={e => setAddendumForm(f => ({ ...f, newSalaryInWords: e.target.value }))} />
                  </div>
                </div>
              </div>
            )}

            {/* Role fields */}
            {(addendumForm.addendumType === "role_change" || addendumForm.addendumType === "combined") && (
              <div className="border rounded-lg p-4 space-y-3 bg-muted/10">
                <h4 className="text-sm font-semibold text-blue-900">Role / Title Details</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Old Designation</Label>
                    <Input data-testid="input-old-designation" className="mt-1" placeholder="Software Engineer" value={addendumForm.oldDesignation} onChange={e => setAddendumForm(f => ({ ...f, oldDesignation: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">New Designation</Label>
                    <Input data-testid="input-new-designation" className="mt-1" placeholder="Senior Software Engineer" value={addendumForm.newDesignation} onChange={e => setAddendumForm(f => ({ ...f, newDesignation: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Old Department</Label>
                    <Input data-testid="input-old-department" className="mt-1" value={addendumForm.oldDepartment} onChange={e => setAddendumForm(f => ({ ...f, oldDepartment: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">New Department</Label>
                    <Input data-testid="input-new-department" className="mt-1" value={addendumForm.newDepartment} onChange={e => setAddendumForm(f => ({ ...f, newDepartment: e.target.value }))} />
                  </div>
                </div>
              </div>
            )}

            {/* Probation fields */}
            {addendumForm.addendumType === "probation_extension" && (
              <div className="border rounded-lg p-4 space-y-3 bg-muted/10">
                <h4 className="text-sm font-semibold text-blue-900">Probation Details</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Original Confirmation Date</Label>
                    <Input data-testid="input-old-confirmation" type="date" className="mt-1" value={addendumForm.oldConfirmationDate} onChange={e => setAddendumForm(f => ({ ...f, oldConfirmationDate: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Revised Confirmation Date</Label>
                    <Input data-testid="input-new-confirmation" type="date" className="mt-1" value={addendumForm.newConfirmationDate} onChange={e => setAddendumForm(f => ({ ...f, newConfirmationDate: e.target.value }))} />
                  </div>
                </div>
              </div>
            )}

            {/* Custom clause fields */}
            {addendumForm.addendumType === "custom" && (
              <div className="border rounded-lg p-4 space-y-3 bg-muted/10">
                <h4 className="text-sm font-semibold text-blue-900">Custom Clause</h4>
                <div>
                  <Label className="text-xs">Clause Title</Label>
                  <Input data-testid="input-clause-title" className="mt-1" placeholder="e.g. Remote Work Policy Amendment" value={addendumForm.customClauseTitle} onChange={e => setAddendumForm(f => ({ ...f, customClauseTitle: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Clause Text</Label>
                  <Textarea data-testid="input-clause-text" className="mt-1" rows={4} placeholder="Enter the full text of the amended clause..." value={addendumForm.customClauseText} onChange={e => setAddendumForm(f => ({ ...f, customClauseText: e.target.value }))} />
                </div>
              </div>
            )}

            {/* Device Allocation */}
            {addendumForm.addendumType === "device_allocation" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    <Laptop className="h-4 w-4 text-blue-600" />
                    Devices / Assets to Allocate
                  </Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    data-testid="button-add-device"
                    onClick={() => setAddendumForm(f => ({
                      ...f,
                      deviceItems: [...f.deviceItems, { description: "", serialNumber: "", assetTag: "", condition: "Good" }],
                    }))}
                  >
                    <Plus className="h-3 w-3 mr-1" /> Add Device
                  </Button>
                </div>
                {addendumForm.deviceItems.length === 0 && (
                  <p className="text-xs text-muted-foreground italic py-2">No devices added. Click "Add Device" to begin.</p>
                )}
                {addendumForm.deviceItems.map((item, idx) => (
                  <div key={idx} className="border rounded-lg p-3 bg-gray-50 space-y-2" data-testid={`device-item-${idx}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-600">Device #{idx + 1}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                        data-testid={`button-remove-device-${idx}`}
                        onClick={() => setAddendumForm(f => ({ ...f, deviceItems: f.deviceItems.filter((_, i) => i !== idx) }))}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div>
                      <Label className="text-xs">Description / Item Name *</Label>
                      <input
                        data-testid={`input-device-desc-${idx}`}
                        className="mt-1 w-full rounded-md border border-input bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="e.g. Apple MacBook Pro 14-inch (M3)"
                        value={item.description}
                        onChange={e => setAddendumForm(f => {
                          const items = [...f.deviceItems];
                          items[idx] = { ...items[idx], description: e.target.value };
                          return { ...f, deviceItems: items };
                        })}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs">Serial Number</Label>
                        <input
                          data-testid={`input-device-serial-${idx}`}
                          className="mt-1 w-full rounded-md border border-input bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="SN123456"
                          value={item.serialNumber}
                          onChange={e => setAddendumForm(f => {
                            const items = [...f.deviceItems];
                            items[idx] = { ...items[idx], serialNumber: e.target.value };
                            return { ...f, deviceItems: items };
                          })}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Asset Tag</Label>
                        <input
                          data-testid={`input-device-asset-${idx}`}
                          className="mt-1 w-full rounded-md border border-input bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="HS-L-001"
                          value={item.assetTag}
                          onChange={e => setAddendumForm(f => {
                            const items = [...f.deviceItems];
                            items[idx] = { ...items[idx], assetTag: e.target.value };
                            return { ...f, deviceItems: items };
                          })}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Condition</Label>
                        <select
                          data-testid={`select-device-condition-${idx}`}
                          className="mt-1 w-full rounded-md border border-input bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          value={item.condition}
                          onChange={e => setAddendumForm(f => {
                            const items = [...f.deviceItems];
                            items[idx] = { ...items[idx], condition: e.target.value };
                            return { ...f, deviceItems: items };
                          })}
                        >
                          <option value="New">New</option>
                          <option value="Excellent">Excellent</option>
                          <option value="Good">Good</option>
                          <option value="Fair">Fair</option>
                          <option value="Refurbished">Refurbished</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Common fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>HR Manager Name</Label>
                <Input data-testid="input-addendum-hr-manager" className="mt-1" value={addendumForm.hrManagerName} onChange={e => setAddendumForm(f => ({ ...f, hrManagerName: e.target.value }))} />
              </div>
              <div>
                <Label>Reason / Remarks (optional)</Label>
                <Input data-testid="input-addendum-reason" className="mt-1" placeholder="e.g. Annual performance review" value={addendumForm.reason} onChange={e => setAddendumForm(f => ({ ...f, reason: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>CC Recipients <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input data-testid="input-addendum-cc" className="mt-1" placeholder="manager@hire-in.com, ceo@hire-in.com" value={addendumForm.ccEmails} onChange={e => setAddendumForm(f => ({ ...f, ccEmails: e.target.value }))} />
              <p className="text-xs text-muted-foreground mt-1">Separate multiple emails with commas</p>
            </div>

            <div className="border rounded-lg p-3 space-y-3 bg-amber-50/40 border-amber-200">
              <label className="flex items-center gap-2 cursor-pointer" data-testid="check-addendum-growth-plan">
                <input
                  type="checkbox"
                  checked={addendumForm.includeGrowthPlanClause}
                  onChange={e => setAddendumForm(f => ({ ...f, includeGrowthPlanClause: e.target.checked }))}
                  className="rounded border-border"
                />
                <span className="text-sm font-medium">Include 90-Day Performance Review &amp; Salary Revision Eligibility clause</span>
              </label>
              {addendumForm.includeGrowthPlanClause && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Current Salary (₹/month)</Label>
                    <Input data-testid="input-addendum-growth-current-salary" className="mt-1" type="number" placeholder="e.g. 50000" value={addendumForm.growthPlanCurrentSalary} onChange={e => setAddendumForm(f => ({ ...f, growthPlanCurrentSalary: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Revision Ceiling "up to ₹" <span className="text-muted-foreground font-normal">(optional)</span></Label>
                    <Input data-testid="input-addendum-growth-max-salary" className="mt-1" type="number" placeholder="optional" value={addendumForm.growthPlanMaxRevisionSalary} onChange={e => setAddendumForm(f => ({ ...f, growthPlanMaxRevisionSalary: e.target.value }))} />
                  </div>
                </div>
              )}
            </div>

            {/* Annexures */}
            <AnnexureEditor annexures={addendumAnnexures} onChange={setAddendumAnnexures} effectiveDate={addendumForm.effectiveDate || undefined} />

            {/* Preview */}
            {addendumForm.effectiveDate && (
              <div className="border rounded-lg p-4 bg-blue-50/60 border-blue-200 space-y-3" data-testid="addendum-preview">
                <h4 className="text-xs font-semibold text-blue-900 uppercase tracking-wider flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5" />
                  Preview — What the candidate will see
                </h4>
                <div className="text-xs space-y-1.5">
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-28 shrink-0">Amendment Type:</span>
                    <span className="font-medium">{ADDENDUM_TYPE_LABELS[addendumForm.addendumType]}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-28 shrink-0">Candidate:</span>
                    <span className="font-medium">{addendumDialog?.candidateName}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-28 shrink-0">Effective Date:</span>
                    <span className="font-medium text-blue-700">{addendumForm.effectiveDate}</span>
                  </div>
                  {(addendumForm.addendumType === "salary_revision" || addendumForm.addendumType === "combined") && addendumForm.newSalary && (
                    <div className="flex gap-2">
                      <span className="text-muted-foreground w-28 shrink-0">New CTC:</span>
                      <span className="font-semibold text-green-700">{addendumForm.newSalary}{addendumForm.newSalaryInWords ? ` (${addendumForm.newSalaryInWords})` : ""}</span>
                    </div>
                  )}
                  {(addendumForm.addendumType === "role_change" || addendumForm.addendumType === "combined") && addendumForm.newDesignation && (
                    <div className="flex gap-2">
                      <span className="text-muted-foreground w-28 shrink-0">New Role:</span>
                      <span className="font-semibold text-green-700">{addendumForm.newDesignation}{addendumForm.newDepartment ? `, ${addendumForm.newDepartment}` : ""}</span>
                    </div>
                  )}
                  {addendumForm.addendumType === "probation_extension" && addendumForm.newConfirmationDate && (
                    <div className="flex gap-2">
                      <span className="text-muted-foreground w-28 shrink-0">New Confirmation:</span>
                      <span className="font-semibold text-green-700">{addendumForm.newConfirmationDate}</span>
                    </div>
                  )}
                  {addendumForm.addendumType === "custom" && addendumForm.customClauseTitle && (
                    <div className="flex gap-2">
                      <span className="text-muted-foreground w-28 shrink-0">Clause:</span>
                      <span className="font-semibold">{addendumForm.customClauseTitle}</span>
                    </div>
                  )}
                  {addendumForm.addendumType === "device_allocation" && addendumForm.deviceItems.length > 0 && (
                    <div className="flex gap-2">
                      <span className="text-muted-foreground w-28 shrink-0">Devices:</span>
                      <span className="font-semibold text-blue-700">{addendumForm.deviceItems.length} device{addendumForm.deviceItems.length !== 1 ? "s" : ""} — {addendumForm.deviceItems.map(d => d.description || "unnamed").join(", ")}</span>
                    </div>
                  )}
                  {addendumForm.reason && (
                    <div className="flex gap-2">
                      <span className="text-muted-foreground w-28 shrink-0">Reason:</span>
                      <span className="italic">{addendumForm.reason}</span>
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-blue-600">An email will be sent to the candidate with a link to digitally sign this amendment.</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddendumDialog(null); resetAddendumForm(); }} data-testid="button-cancel-addendum-dialog">
              Cancel
            </Button>
            <Button
              onClick={handleCreateAddendum}
              disabled={submittingAddendum || !addendumForm.effectiveDate}
              className="bg-blue-700 hover:bg-blue-800"
              data-testid="button-submit-addendum"
            >
              {submittingAddendum ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Create & Send Addendum
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={standaloneDialog} onOpenChange={(open) => { if (!open) { setStandaloneDialog(false); resetStandaloneForm(); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FilePlus className="h-5 w-5 text-purple-600" />
              New Standalone Addendum
            </DialogTitle>
            <DialogDescription>
              Look up an existing employee to auto-fill their details (so goals can be attached), or enter details manually for a legacy employee with no offer letter in the system.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="border rounded-lg p-4 space-y-3 bg-purple-50/30 border-purple-100">
              <h4 className="text-sm font-semibold text-purple-900">Employee Details</h4>

              {selectedStandaloneEmployeeId ? (
                <div className="flex items-center justify-between rounded-md border border-purple-200 bg-white px-3 py-2" data-testid="standalone-selected-employee">
                  <div className="text-sm">
                    <span className="font-medium" data-testid="text-standalone-selected-name">{standaloneForm.employeeName}</span>
                    <span className="text-xs text-emerald-700 ml-2">System employee — goals can be attached</span>
                  </div>
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={clearStandaloneEmployee} data-testid="button-clear-standalone-employee">
                    Clear & enter manually
                  </Button>
                </div>
              ) : (
                <div>
                  <Label className="text-xs">Look up existing employee <span className="text-muted-foreground font-normal">(optional — leave blank for a legacy employee)</span></Label>
                  <div className="relative mt-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, ID, or email..."
                      value={standaloneEmployeeSearch}
                      onChange={e => setStandaloneEmployeeSearch(e.target.value)}
                      className="pl-9"
                      data-testid="input-standalone-employee-search"
                    />
                  </div>
                  {standaloneEmployeeSearch && filteredStandaloneEmployees.length > 0 && (
                    <div className="border rounded-md mt-1 max-h-44 overflow-y-auto bg-white">
                      {filteredStandaloneEmployees.map((emp: any) => (
                        <button
                          key={emp.id}
                          type="button"
                          onClick={() => selectStandaloneEmployee(emp)}
                          className="w-full text-left px-3 py-2 hover:bg-muted text-sm border-b last:border-0"
                          data-testid={`btn-select-standalone-employee-${emp.id}`}
                        >
                          <span className="font-medium">{emp.firstName} {emp.lastName}</span>
                          <span className="text-muted-foreground ml-2">{emp.employeeId || ""} · {emp.email}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {standaloneEmployeeSearch && filteredStandaloneEmployees.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-1">No matching employees found — you can still enter details manually below.</p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Full Name *</Label>
                  <Input data-testid="input-standalone-name" className="mt-1" placeholder="e.g. Ravi Kumar" value={standaloneForm.employeeName} onChange={e => setStandaloneForm(f => ({ ...f, employeeName: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Personal Email * <span className="text-muted-foreground font-normal">(acceptance link sent here)</span></Label>
                  <Input data-testid="input-standalone-email" type="email" className="mt-1" placeholder="ravi.kumar@gmail.com" value={standaloneForm.employeeEmail} onChange={e => setStandaloneForm(f => ({ ...f, employeeEmail: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Current Designation</Label>
                  <Input data-testid="input-standalone-designation" className="mt-1" placeholder="e.g. Software Engineer" value={standaloneForm.employeeDesignation} onChange={e => setStandaloneForm(f => ({ ...f, employeeDesignation: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Department</Label>
                  <Input data-testid="input-standalone-department" className="mt-1" placeholder="e.g. Information Technology" value={standaloneForm.employeeDepartment} onChange={e => setStandaloneForm(f => ({ ...f, employeeDepartment: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Joining / Start Date</Label>
                  <Input data-testid="input-standalone-joining" type="date" className="mt-1" value={standaloneForm.employeeJoiningDate} onChange={e => setStandaloneForm(f => ({ ...f, employeeJoiningDate: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Reporting Manager</Label>
                  <Input data-testid="input-standalone-manager" className="mt-1" placeholder="e.g. Priya Sharma" value={standaloneForm.employeeReportingManager} onChange={e => setStandaloneForm(f => ({ ...f, employeeReportingManager: e.target.value }))} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Addendum Type</Label>
                <Select value={standaloneForm.addendumType} onValueChange={v => setStandaloneForm(f => ({ ...f, addendumType: v }))}>
                  <SelectTrigger data-testid="select-standalone-type" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="salary_revision">Salary Revision</SelectItem>
                    <SelectItem value="role_change">Role / Title Change</SelectItem>
                    <SelectItem value="probation_extension">Probation Extension</SelectItem>
                    <SelectItem value="combined">Combined Role & Salary</SelectItem>
                    <SelectItem value="custom">Custom Amendment</SelectItem>
                    <SelectItem value="device_allocation">Company Device Allocation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Effective Date *</Label>
                <Input data-testid="input-standalone-effective-date" type="date" className="mt-1" value={standaloneForm.effectiveDate} onChange={e => setStandaloneForm(f => ({ ...f, effectiveDate: e.target.value }))} />
              </div>
            </div>

            {(standaloneForm.addendumType === "salary_revision" || standaloneForm.addendumType === "combined") && (
              <div className="border rounded-lg p-4 space-y-3 bg-muted/10">
                <h4 className="text-sm font-semibold text-blue-900">Salary Details</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Old Annual CTC</Label><Input data-testid="input-standalone-old-salary" className="mt-1" placeholder="e.g. 600000" value={standaloneForm.oldSalary} onChange={e => setStandaloneForm(f => ({ ...f, oldSalary: e.target.value }))} /></div>
                  <div><Label className="text-xs">New Annual CTC</Label><Input data-testid="input-standalone-new-salary" className="mt-1" placeholder="e.g. 720000" value={standaloneForm.newSalary} onChange={e => setStandaloneForm(f => ({ ...f, newSalary: e.target.value }))} /></div>
                  <div><Label className="text-xs">Old CTC in Words</Label><Input data-testid="input-standalone-old-salary-words" className="mt-1" placeholder="Six Lakh" value={standaloneForm.oldSalaryInWords} onChange={e => setStandaloneForm(f => ({ ...f, oldSalaryInWords: e.target.value }))} /></div>
                  <div><Label className="text-xs">New CTC in Words</Label><Input data-testid="input-standalone-new-salary-words" className="mt-1" placeholder="Seven Lakh Twenty Thousand" value={standaloneForm.newSalaryInWords} onChange={e => setStandaloneForm(f => ({ ...f, newSalaryInWords: e.target.value }))} /></div>
                </div>
              </div>
            )}

            {(standaloneForm.addendumType === "role_change" || standaloneForm.addendumType === "combined") && (
              <div className="border rounded-lg p-4 space-y-3 bg-muted/10">
                <h4 className="text-sm font-semibold text-blue-900">Role / Title Details</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Old Designation</Label><Input data-testid="input-standalone-old-designation" className="mt-1" value={standaloneForm.oldDesignation} onChange={e => setStandaloneForm(f => ({ ...f, oldDesignation: e.target.value }))} /></div>
                  <div><Label className="text-xs">New Designation</Label><Input data-testid="input-standalone-new-designation" className="mt-1" value={standaloneForm.newDesignation} onChange={e => setStandaloneForm(f => ({ ...f, newDesignation: e.target.value }))} /></div>
                  <div><Label className="text-xs">Old Department</Label><Input data-testid="input-standalone-old-department" className="mt-1" value={standaloneForm.oldDepartment} onChange={e => setStandaloneForm(f => ({ ...f, oldDepartment: e.target.value }))} /></div>
                  <div><Label className="text-xs">New Department</Label><Input data-testid="input-standalone-new-department" className="mt-1" value={standaloneForm.newDepartment} onChange={e => setStandaloneForm(f => ({ ...f, newDepartment: e.target.value }))} /></div>
                </div>
              </div>
            )}

            {standaloneForm.addendumType === "probation_extension" && (
              <div className="border rounded-lg p-4 space-y-3 bg-muted/10">
                <h4 className="text-sm font-semibold text-blue-900">Probation Details</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Original Confirmation Date</Label><Input data-testid="input-standalone-old-confirmation" type="date" className="mt-1" value={standaloneForm.oldConfirmationDate} onChange={e => setStandaloneForm(f => ({ ...f, oldConfirmationDate: e.target.value }))} /></div>
                  <div><Label className="text-xs">Revised Confirmation Date</Label><Input data-testid="input-standalone-new-confirmation" type="date" className="mt-1" value={standaloneForm.newConfirmationDate} onChange={e => setStandaloneForm(f => ({ ...f, newConfirmationDate: e.target.value }))} /></div>
                </div>
              </div>
            )}

            {standaloneForm.addendumType === "custom" && (
              <div className="border rounded-lg p-4 space-y-3 bg-muted/10">
                <h4 className="text-sm font-semibold text-blue-900">Custom Clause</h4>
                <div><Label className="text-xs">Clause Title</Label><Input data-testid="input-standalone-clause-title" className="mt-1" placeholder="e.g. Remote Work Policy Amendment" value={standaloneForm.customClauseTitle} onChange={e => setStandaloneForm(f => ({ ...f, customClauseTitle: e.target.value }))} /></div>
                <div><Label className="text-xs">Clause Text</Label><Textarea data-testid="input-standalone-clause-text" className="mt-1" rows={4} placeholder="Enter the full text of the amended clause..." value={standaloneForm.customClauseText} onChange={e => setStandaloneForm(f => ({ ...f, customClauseText: e.target.value }))} /></div>
              </div>
            )}

            {standaloneForm.addendumType === "device_allocation" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold flex items-center gap-1.5"><Laptop className="h-4 w-4 text-blue-600" />Devices / Assets to Allocate</Label>
                  <Button type="button" size="sm" variant="outline" className="h-7 text-xs" data-testid="button-standalone-add-device" onClick={() => setStandaloneForm(f => ({ ...f, deviceItems: [...f.deviceItems, { description: "", serialNumber: "", assetTag: "", condition: "Good" }] }))}>
                    <Plus className="h-3 w-3 mr-1" /> Add Device
                  </Button>
                </div>
                {standaloneForm.deviceItems.length === 0 && <p className="text-xs text-muted-foreground italic py-2">No devices added. Click "Add Device" to begin.</p>}
                {standaloneForm.deviceItems.map((item, idx) => (
                  <div key={idx} className="border rounded-lg p-3 bg-gray-50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-600">Device #{idx + 1}</span>
                      <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500 hover:text-red-700" onClick={() => setStandaloneForm(f => ({ ...f, deviceItems: f.deviceItems.filter((_, i) => i !== idx) }))}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div><Label className="text-xs">Description / Item Name *</Label><input className="mt-1 w-full rounded-md border border-input bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="e.g. Apple MacBook Pro 14-inch" value={item.description} onChange={e => { const items = [...standaloneForm.deviceItems]; items[idx] = { ...items[idx], description: e.target.value }; setStandaloneForm(f => ({ ...f, deviceItems: items })); }} /></div>
                    <div className="grid grid-cols-3 gap-2">
                      <div><Label className="text-xs">Serial Number</Label><input className="mt-1 w-full rounded-md border border-input bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="SN123456" value={item.serialNumber} onChange={e => { const items = [...standaloneForm.deviceItems]; items[idx] = { ...items[idx], serialNumber: e.target.value }; setStandaloneForm(f => ({ ...f, deviceItems: items })); }} /></div>
                      <div><Label className="text-xs">Asset Tag</Label><input className="mt-1 w-full rounded-md border border-input bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="HS-L-001" value={item.assetTag} onChange={e => { const items = [...standaloneForm.deviceItems]; items[idx] = { ...items[idx], assetTag: e.target.value }; setStandaloneForm(f => ({ ...f, deviceItems: items })); }} /></div>
                      <div><Label className="text-xs">Condition</Label><select className="mt-1 w-full rounded-md border border-input bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" value={item.condition} onChange={e => { const items = [...standaloneForm.deviceItems]; items[idx] = { ...items[idx], condition: e.target.value }; setStandaloneForm(f => ({ ...f, deviceItems: items })); }}><option value="New">New</option><option value="Excellent">Excellent</option><option value="Good">Good</option><option value="Fair">Fair</option><option value="Refurbished">Refurbished</option></select></div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>HR Manager Name</Label>
                <Input data-testid="input-standalone-hr-manager" className="mt-1" value={standaloneForm.hrManagerName} onChange={e => setStandaloneForm(f => ({ ...f, hrManagerName: e.target.value }))} />
              </div>
              <div>
                <Label>Reason / Remarks (optional)</Label>
                <Input data-testid="input-standalone-reason" className="mt-1" placeholder="e.g. Annual performance review" value={standaloneForm.reason} onChange={e => setStandaloneForm(f => ({ ...f, reason: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>CC Recipients <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input data-testid="input-standalone-cc" className="mt-1" placeholder="manager@hire-in.com, ceo@hire-in.com" value={standaloneForm.ccEmails} onChange={e => setStandaloneForm(f => ({ ...f, ccEmails: e.target.value }))} />
              <p className="text-xs text-muted-foreground mt-1">Separate multiple emails with commas</p>
            </div>

            <div className="border rounded-lg p-3 space-y-3 bg-amber-50/40 border-amber-200">
              <label className="flex items-center gap-2 cursor-pointer" data-testid="check-standalone-growth-plan">
                <input
                  type="checkbox"
                  checked={standaloneForm.includeGrowthPlanClause}
                  onChange={e => setStandaloneForm(f => ({ ...f, includeGrowthPlanClause: e.target.checked }))}
                  className="rounded border-border"
                />
                <span className="text-sm font-medium">Include 90-Day Performance Review &amp; Salary Revision Eligibility clause</span>
              </label>
              {standaloneForm.includeGrowthPlanClause && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Current Salary (₹/month)</Label>
                    <Input data-testid="input-standalone-growth-current-salary" className="mt-1" type="number" placeholder="e.g. 50000" value={standaloneForm.growthPlanCurrentSalary} onChange={e => setStandaloneForm(f => ({ ...f, growthPlanCurrentSalary: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Revision Ceiling "up to ₹" <span className="text-muted-foreground font-normal">(optional)</span></Label>
                    <Input data-testid="input-standalone-growth-max-salary" className="mt-1" type="number" placeholder="optional" value={standaloneForm.growthPlanMaxRevisionSalary} onChange={e => setStandaloneForm(f => ({ ...f, growthPlanMaxRevisionSalary: e.target.value }))} />
                  </div>
                </div>
              )}
            </div>

            <AnnexureEditor
              annexures={standaloneAnnexures}
              onChange={setStandaloneAnnexures}
              effectiveDate={standaloneForm.effectiveDate || undefined}
              goalPushDisabled={!selectedStandaloneEmployeeId}
              goalPushDisabledReason="Look up and select a system employee above to push annexure rows as their performance goals."
            />
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            {(!standaloneForm.employeeName || !standaloneForm.employeeEmail || !standaloneForm.effectiveDate) && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2 w-full text-center">
                Required to send:{" "}
                {[
                  !standaloneForm.employeeName && "Full Name",
                  !standaloneForm.employeeEmail && "Personal Email",
                  !standaloneForm.effectiveDate && "Effective Date",
                ].filter(Boolean).join(", ")}
              </p>
            )}
            <div className="flex justify-end gap-2 w-full">
              <Button variant="outline" onClick={() => { setStandaloneDialog(false); resetStandaloneForm(); }} data-testid="button-cancel-standalone-dialog">
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={handlePreviewStandaloneAddendum}
                disabled={previewingStandalone || !standaloneForm.employeeName || !standaloneForm.effectiveDate}
                data-testid="button-preview-standalone"
                className="border-blue-300 text-blue-700 hover:bg-blue-50"
              >
                {previewingStandalone ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
                Preview Document
              </Button>
              <Button
                onClick={handleCreateStandaloneAddendum}
                disabled={submittingStandalone || !standaloneForm.employeeName || !standaloneForm.employeeEmail || !standaloneForm.effectiveDate}
                className="bg-purple-700 hover:bg-purple-800"
                data-testid="button-submit-standalone"
              >
                {submittingStandalone ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Create & Send Addendum
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={!!viewLetterModal} onOpenChange={(open) => { if (!open) setViewLetterModal(null); }}>
        <SheetContent side="right" className="sm:max-w-2xl w-full overflow-y-auto" data-testid="sheet-view-letter">
          <SheetHeader>
            <div className="flex items-center justify-between pr-8">
              <SheetTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Offer Letter — {viewLetterModal?.candidateName}
              </SheetTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const printContent = document.getElementById("offer-letter-print-area");
                  if (!printContent) return;
                  const printWindow = window.open("", "_blank");
                  if (!printWindow) return;
                  const safeTitle = (viewLetterModal?.candidateName || "Document").replace(/[<>"'&]/g, "");
                  printWindow.document.write(`
                    <html>
                      <head>
                        <title>Offer Letter - ${safeTitle}</title>
                        <link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;700&display=swap" rel="stylesheet">
                        <style>
                          * { margin: 0; padding: 0; box-sizing: border-box; }
                          body { font-family: system-ui, -apple-system, sans-serif; padding: 40px 30px; color: #1a1a1a; line-height: 1.6; }
                          h1, h2, h3, h4 { margin-top: 1em; margin-bottom: 0.5em; }
                          p { margin-bottom: 0.5em; }
                          strong { font-weight: 600; }
                          code { font-family: ui-monospace, monospace; font-size: 0.85em; background: #f0f0f0; padding: 2px 6px; border-radius: 3px; }
                          hr { border: none; border-top: 1px solid #e5e5e5; margin: 1em 0; }
                          [data-slot="separator"] { display: block; height: 1px; background: #e5e5e5; margin: 1em 0; }
                          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
                          .space-y-4 > * + * { margin-top: 1em; }
                          .space-y-6 > * + * { margin-top: 1.5em; }
                          .text-muted-foreground { color: #6b7280; }
                          .font-medium { font-weight: 500; }
                          .font-semibold { font-weight: 600; }
                          .text-sm { font-size: 0.875rem; }
                          .text-xs { font-size: 0.75rem; }
                          .text-lg { font-size: 1.125rem; }
                          .text-2xl { font-size: 1.5rem; }
                          .text-3xl { font-size: 1.875rem; }
                          .uppercase { text-transform: uppercase; }
                          .tracking-wider { letter-spacing: 0.05em; }
                          .break-all { word-break: break-all; }
                          .border { border: 1px solid #e5e5e5; }
                          .border-b { border-bottom: 1px solid #e5e5e5; }
                          .rounded-lg, .rounded-md { border-radius: 8px; }
                          .p-3, .p-4 { padding: 12px; }
                          .pt-4, .pt-6 { padding-top: 16px; }
                          .pb-3 { padding-bottom: 12px; }
                          .mb-1 { margin-bottom: 4px; }
                          .mb-2 { margin-bottom: 8px; }
                          .mt-1 { margin-top: 4px; }
                          .mt-2 { margin-top: 8px; }
                          .py-3 { padding-top: 12px; padding-bottom: 12px; }
                          .gap-3 { gap: 12px; }
                          .bg-blue-50 { background: #eff6ff; }
                          .bg-green-50 { background: #f0fdf4; }
                          .bg-purple-50 { background: #faf5ff; }
                          .border-blue-100 { border-color: #dbeafe; }
                          .border-purple-100 { border-color: #e9d5ff; }
                          .text-blue-900 { color: #1e3a5f; }
                          .text-blue-800 { color: #1e40af; }
                          .text-green-900 { color: #14532d; }
                          .text-purple-900 { color: #581c87; }
                          .text-purple-800 { color: #6b21a8; }
                          .flex { display: flex; }
                          .flex-col { flex-direction: column; }
                          .items-center { align-items: center; }
                          .items-start { align-items: flex-start; }
                          .justify-center { justify-content: center; }
                          .gap-2 { gap: 8px; }
                          .text-center { text-align: center; }
                          @media print {
                            body { padding: 20px; }
                            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                          }
                        </style>
                      </head>
                      <body>${printContent.innerHTML}</body>
                    </html>
                  `);
                  printWindow.document.close();
                  printWindow.onload = () => {
                    printWindow.print();
                    printWindow.close();
                  };
                }}
                data-testid="button-download-pdf"
              >
                <Printer className="h-4 w-4 mr-1" />
                Download as PDF
              </Button>
            </div>
            <SheetDescription>
              Full offer letter with signature details
            </SheetDescription>
          </SheetHeader>

          {viewLetterModal && (
            <div className="mt-4 space-y-6 print-area" id="offer-letter-print-area">
              <OfferLetterBody
                offer={{
                  candidateTitle: viewLetterModal.candidateTitle || "",
                  candidateName: viewLetterModal.candidateName,
                  candidateAddress: viewLetterModal.candidateAddress,
                  designation: viewLetterModal.designation,
                  subjectDesignation: viewLetterModal.subjectDesignation,
                  departmentName: viewLetterModal.departmentName,
                  managerName: viewLetterModal.managerName,
                  location: viewLetterModal.location || "",
                  proposedStartDate: viewLetterModal.proposedStartDate,
                  employmentType: viewLetterModal.employmentType || "",
                  salary: viewLetterModal.salary,
                  hrManagerName: viewLetterModal.hrManagerName,
                  offerDate: viewLetterModal.offerDate || "",
                  jurisdiction: viewLetterModal.jurisdiction,
                  refId: viewLetterModal.id,
                  probationSalary: viewLetterModal.probationSalary,
                  probationSalaryInWords: viewLetterModal.probationSalaryInWords,
                  postProbationSalary: viewLetterModal.postProbationSalary,
                  postProbationSalaryInWords: viewLetterModal.postProbationSalaryInWords,
                  probationPeriodMonths: viewLetterModal.probationPeriodMonths,
                  extendedProbationMonths: viewLetterModal.extendedProbationMonths,
                  performanceProbationReview: viewLetterModal.performanceProbationReview,
                  maxRevisionSalary: viewLetterModal.maxRevisionSalary,
                  maxRevisionSalaryInWords: viewLetterModal.maxRevisionSalaryInWords,
                  performanceClauseText: viewLetterModal.performanceClauseText,
                  policyAnnexures: viewLetterModal.policyAnnexures,
                  annexureInitials: viewModalAnnexureInitials,
                  annexureInitialedAt: viewModalAnnexureInitialedAt,
                }}
              />

              {(viewLetterModal.status === "accepted" || viewLetterModal.status === "countersigned" || viewLetterModal.status === "onboarded") && viewLetterModal.acceptedName && (
                <Card data-testid="card-digital-signature">
                  <CardHeader className="bg-green-50 border-b pb-3">
                    <CardTitle className="flex items-center gap-2 text-green-900 text-base">
                      <ShieldCheck className="h-5 w-5" />
                      Digital Signature — Candidate Acceptance
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4">
                    <div className="flex flex-col items-center py-3">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Signed as</p>
                      <p
                        className="text-3xl text-blue-900"
                        style={{ fontFamily: "'Dancing Script', cursive" }}
                        data-testid="text-accepted-signature"
                      >
                        {viewLetterModal.acceptedName}
                      </p>
                    </div>
                    <Separator />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Accepted Name</p>
                        <p className="font-medium" data-testid="text-accepted-name">{viewLetterModal.acceptedName}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Acceptance Date</p>
                        <p className="font-medium" data-testid="text-acceptance-date">{viewLetterModal.acceptanceDate || (viewLetterModal.acceptedAt ? new Date(viewLetterModal.acceptedAt).toLocaleDateString() : "—")}</p>
                      </div>
                    </div>
                    {viewLetterModal.authCode && (
                      <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                        <p className="text-xs font-semibold text-blue-800 uppercase tracking-wider mb-1">Cryptographic Auth Code</p>
                        <code className="text-xs font-mono font-bold text-blue-900 block tracking-wider break-all" data-testid="text-candidate-auth-code">
                          {viewLetterModal.authCode}
                        </code>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {(viewLetterModal.status === "countersigned" || viewLetterModal.status === "onboarded") && viewLetterModal.counterSignedName && (
                <Card data-testid="card-counter-signature">
                  <CardHeader className="bg-purple-50 border-b pb-3">
                    <CardTitle className="flex items-center gap-2 text-purple-900 text-base">
                      <CheckCircle className="h-5 w-5" />
                      Counter-Signature — HR Authorization
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4">
                    <div className="flex flex-col items-center py-3">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Counter-signed by</p>
                      <p
                        className="text-3xl text-blue-900"
                        style={{ fontFamily: "'Dancing Script', cursive" }}
                        data-testid="text-counter-signature"
                      >
                        {viewLetterModal.counterSignedName}
                      </p>
                    </div>
                    <Separator />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Counter-Signer Name</p>
                        <p className="font-medium" data-testid="text-counter-signer-name">{viewLetterModal.counterSignedName}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Counter-Sign Date</p>
                        <p className="font-medium" data-testid="text-counter-sign-date">{viewLetterModal.counterSignedDate || (viewLetterModal.counterSignedAt ? new Date(viewLetterModal.counterSignedAt).toLocaleDateString() : "—")}</p>
                      </div>
                    </div>
                    {viewLetterModal.counterAuthCode && (
                      <div className="bg-purple-50 p-3 rounded-lg border border-purple-100">
                        <p className="text-xs font-semibold text-purple-800 uppercase tracking-wider mb-1">Counter-Signature Auth Code</p>
                        <code className="text-xs font-mono font-bold text-purple-900 block tracking-wider break-all" data-testid="text-counter-auth-code">
                          {viewLetterModal.counterAuthCode}
                        </code>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

        </SheetContent>
      </Sheet>

      <Sheet open={!!hrViewLetter} onOpenChange={(open) => { if (!open) setHrViewLetter(null); }}>
        <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{hrViewLetter ? (TEMPLATE_LABELS[hrViewLetter.templateType] || hrViewLetter.templateType) : "Letter"}</SheetTitle>
            <SheetDescription>{hrViewLetter?.referenceNumber}</SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            {hrViewLetter && <LetterPreview letter={hrViewLetter} />}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={!!hrRevokeDialog} onOpenChange={(open) => { if (!open) { setHrRevokeDialog(null); setHrRevokeReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke Letter</DialogTitle>
            <DialogDescription>This marks the letter as revoked. Provide a reason for the audit trail.</DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for revoking…"
            value={hrRevokeReason}
            onChange={(e) => setHrRevokeReason(e.target.value)}
            data-testid="input-hr-revoke-reason"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setHrRevokeDialog(null); setHrRevokeReason(""); }} data-testid="button-cancel-hr-revoke">Cancel</Button>
            <Button
              variant="destructive"
              disabled={!hrRevokeReason.trim() || hrRevokeMutation.isPending}
              onClick={() => hrRevokeDialog && hrRevokeMutation.mutate({ id: hrRevokeDialog.id, reason: hrRevokeReason })}
              data-testid="button-confirm-hr-revoke"
            >
              {hrRevokeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Revoke"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!hrReissueDialog} onOpenChange={(open) => { if (!open) { setHrReissueDialog(null); setHrReissueReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Re-issue Letter</DialogTitle>
            <DialogDescription>Issues a corrected letter using the employee's current data. Provide a reason for the audit trail.</DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for re-issuing…"
            value={hrReissueReason}
            onChange={(e) => setHrReissueReason(e.target.value)}
            data-testid="input-hr-reissue-reason"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setHrReissueDialog(null); setHrReissueReason(""); }} data-testid="button-cancel-hr-reissue">Cancel</Button>
            <Button
              disabled={!hrReissueReason.trim() || hrReissueMutation.isPending}
              onClick={() => hrReissueDialog && hrReissueMutation.mutate({ id: hrReissueDialog.id, reason: hrReissueReason })}
              data-testid="button-confirm-hr-reissue"
            >
              {hrReissueMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Re-issue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!hrEmailDialog} onOpenChange={(open) => { if (!open) { setHrEmailDialog(null); setHrEmailCc(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Email Letter</DialogTitle>
            <DialogDescription>Send this letter to the employee. Optionally CC additional recipients (comma-separated).</DialogDescription>
          </DialogHeader>
          <Input
            placeholder="cc@example.com, another@example.com"
            value={hrEmailCc}
            onChange={(e) => setHrEmailCc(e.target.value)}
            data-testid="input-hr-email-cc"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setHrEmailDialog(null); setHrEmailCc(""); }} data-testid="button-cancel-hr-email">Cancel</Button>
            <Button
              disabled={hrEmailMutation.isPending}
              onClick={() => hrEmailDialog && hrEmailMutation.mutate({ id: hrEmailDialog.id, ccEmails: hrEmailCc.trim() || undefined })}
              data-testid="button-confirm-hr-email"
            >
              {hrEmailMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function HRTools() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/admin/login");
    }
  }, [authLoading, isAuthenticated, setLocation]);

  if (authLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  if (!isAuthenticated) return null;

  const allowedRoles = ["super_admin", "admin", "hr"];
  if (user && !allowedRoles.includes(user.role)) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">You do not have access to this page.</p>
        </div>
      </AdminLayout>
    );
  }

  const isAdmin = ["super_admin", "admin"].includes(user?.role || "");

  const validTabs = ["salary-slip", "letter-generator", "letters", "policy-signoffs", ...(isAdmin ? ["templates"] : [])];
  let initialTab = "salary-slip";
  try {
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab && validTabs.includes(tab)) initialTab = tab;
  } catch {}

  const handleTabChange = (value: string) => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", value);
      window.history.replaceState({}, "", url.toString());
    } catch {}
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-hr-tools-title">HR Tools</h1>
          <p className="text-muted-foreground">Generate salary slips and HR letters</p>
        </div>

        <Tabs defaultValue={initialTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList data-testid="tabs-hr-tools" className="flex-wrap h-auto gap-1">
            <TabsTrigger value="salary-slip" data-testid="tab-salary-slip">
              <Receipt className="h-4 w-4 mr-2" />
              Salary Slip
            </TabsTrigger>
            <TabsTrigger value="letter-generator" data-testid="tab-letter-generator">
              <ScrollText className="h-4 w-4 mr-2" />
              Letter Generator
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="templates" data-testid="tab-templates">
                <FileText className="h-4 w-4 mr-2" />
                Templates
              </TabsTrigger>
            )}
            <TabsTrigger value="letters" data-testid="tab-letters">
              <FileStack className="h-4 w-4 mr-2" />
              Letters
            </TabsTrigger>
            <TabsTrigger value="policy-signoffs" data-testid="tab-policy-signoffs">
              <Shield className="h-4 w-4 mr-2" />
              Policy Sign-offs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="salary-slip">
            <SalarySlipGenerator />
          </TabsContent>

          <TabsContent value="letter-generator">
            <LetterGenerator />
          </TabsContent>

          {isAdmin && (
            <TabsContent value="templates">
              <LetterTemplatesSection />
            </TabsContent>
          )}

          <TabsContent value="letters">
            <OfferLettersDashboard />
          </TabsContent>

          <TabsContent value="policy-signoffs">
            <PolicySignoffsContent />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
