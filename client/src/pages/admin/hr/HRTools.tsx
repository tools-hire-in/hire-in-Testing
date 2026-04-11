import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Wrench, FileText, Receipt, Download, Loader2, User, Building, Search,
  Send, XCircle, Eye, CheckCircle, Clock, Mail, UserPlus, ExternalLink,
  FileSearch, Printer, ShieldCheck,
} from "lucide-react";
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
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { numberToWords } from "@/lib/numberToWords";
import { apiRequest, queryClient } from "@/lib/queryClient";

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
    <div style="margin:16px 28px 0;background:#FFF7F0;border:1px solid #FDBA8C;border-radius:6px;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;">
      <div>
        <div style="color:${NAVY};font-weight:700;font-size:13px;letter-spacing:0.3px;">Total Net Payable</div>
        <div style="margin-top:10px;display:flex;gap:24px;">
          <div style="font-size:10.5px;">
            <span style="color:#6B7280;">Pay Days: </span>
            <span style="font-weight:700;color:${NAVY};">${data.paidDays}</span>
          </div>
          <div style="font-size:10.5px;">
            <span style="color:#6B7280;">LOP Days: </span>
            <span style="font-weight:700;color:${data.lopDays > 0 ? "#DC2626" : NAVY};">${data.lopDays}</span>
          </div>
        </div>
      </div>
      <div style="text-align:right;">
        <div style="color:${ORANGE};font-size:11px;font-weight:600;letter-spacing:0.5px;margin-bottom:2px;">AMOUNT CREDITED</div>
        <div style="color:${NAVY};font-size:24px;font-weight:800;letter-spacing:-0.5px;">₹${fmt(netPay)}</div>
        <div style="color:#6B7280;font-size:9.5px;margin-top:4px;font-style:italic;">Rupees ${netPayWords} Only</div>
      </div>
    </div>

    <!-- FOOTER -->
    <div style="padding:12px 20px 16px;border-top:3px solid ${ORANGE};margin-top:14px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;">
        <div>
          <div style="font-size:9.5px;color:#6B7280;line-height:1.6;">This is a system-generated payslip and does not require a physical signature.</div>
          <div style="font-size:9.5px;color:#6B7280;">For queries contact: <span style="color:${NAVY};font-weight:600;">alina.carter@hire-in.com</span></div>
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

  const { data: usersResponse } = useQuery<{ users: { id: string; firstName: string; lastName: string; email: string; isActive: boolean; employeeId: string | null; departmentId: string | null; salary: string | null; designation: string | null; joiningDate: string | null; role: string }[]; counts: { active: number; disabled: number; deleted: number } }>({
    queryKey: ["/api/admin/users"],
  });
  const users = usersResponse?.users;

  const { data: departments } = useQuery<any[]>({
    queryKey: ["/api/admin/departments"],
  });

  const activeUsers = useMemo(() => {
    if (!users) return [];
    return users.filter(u => u.isActive);
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
  candidateAddress: string;
  designation: string;
  subjectDesignation: string;
  reportingToUserId: string;
  departmentId: string;
  employmentType: string;
  proposedStartDate: string;
  salary: number;
  salaryInWords: string;
  location: string;
  jurisdiction: string;
  hrManagerName: string;
  offerDate: string;
}

function getDefaultOfferData(): OfferFormData {
  const today = new Date().toISOString().split("T")[0];
  return {
    candidateTitle: "Mr.",
    candidateName: "",
    candidatePersonalEmail: "",
    candidateAddress: "",
    designation: "",
    subjectDesignation: "",
    reportingToUserId: "",
    departmentId: "",
    employmentType: "Full-time / Regular",
    proposedStartDate: "",
    salary: 0,
    salaryInWords: "",
    location: "Delhi",
    jurisdiction: "Delhi",
    hrManagerName: "Alina Carter",
    offerDate: today,
  };
}

function OfferLetterGenerator() {
  const { toast } = useToast();
  const [formData, setFormData] = useState<OfferFormData>(getDefaultOfferData());
  const [generating, setGenerating] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  const { data: usersResp } = useQuery<{ users: { id: string; firstName: string; lastName: string; email: string; isActive: boolean; designation: string | null; departmentId: string | null; salary: string | null; joiningDate: string | null }[]; counts: { active: number; disabled: number; deleted: number } }>({
    queryKey: ["/api/admin/users"],
  });
  const users = usersResp?.users;

  const activeUsers = useMemo(() => {
    if (!users) return [];
    return users.filter(u => u.isActive);
  }, [users]);

  const updateField = (field: keyof OfferFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    if (formData.salary > 0) {
      updateField("salaryInWords", numberToWords(formData.salary));
    }
  }, [formData.salary]);

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
      salary: formData.salary ? String(formData.salary) : null,
      hrManagerName: formData.hrManagerName || null,
      offerDate: offerDateFormatted,
      jurisdiction: formData.jurisdiction || null,
      refId: null,
    };
  }, [formData, departments, users]);

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
      const res = await apiRequest("POST", "/api/hr/tools/offer-letters", {
        ...formData,
        salary: formData.salary ? String(formData.salary) : null,
        offerDate: formData.offerDate
          ? parseDateLocal(formData.offerDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
          : undefined,
        proposedStartDate: formData.proposedStartDate
          ? parseDateLocal(formData.proposedStartDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
          : "",
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || err.error || "Failed to send");
      }

      const result = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/hr/tools/offer-letters"] });

      if (result.emailSent === false) {
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
      setShowPreview(false);
    } catch (err: any) {
      toast({ title: err.message || "Failed to send offer letter", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
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
          </CardContent>
        </Card>
      </div>

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
              {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Confirm &amp; Send
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

const STATUS_BADGES: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string; icon: any }> = {
  sent: { variant: "secondary", label: "Sent", icon: Mail },
  viewed: { variant: "default", label: "Viewed", icon: Eye },
  accepted: { variant: "outline", label: "Accepted", icon: CheckCircle },
  onboarded: { variant: "default", label: "Onboarded", icon: UserPlus },
  countersigned: { variant: "default", label: "Countersigned", icon: CheckCircle },
  expired: { variant: "destructive", label: "Expired", icon: Clock },
  cancelled: { variant: "destructive", label: "Cancelled", icon: XCircle },
};

function OfferLettersDashboard() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [onboardingModal, setOnboardingModal] = useState<any>(null);
  const [countersignModal, setCountersignModal] = useState<any>(null);
  const [viewLetterModal, setViewLetterModal] = useState<any>(null);
  const [hireInEmail, setHireInEmail] = useState("");
  const [counterSignedName, setCounterSignedName] = useState("Alina Carter");
  const [counterSignedDate, setCounterSignedDate] = useState(new Date().toISOString().split("T")[0]);
  const [onboarding, setOnboarding] = useState(false);
  const [countersigning, setCountersigning] = useState(false);

  const { data: letters, isLoading } = useQuery<any[]>({
    queryKey: ["/api/hr/tools/offer-letters"],
  });

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

  return (
    <div className="space-y-4">
      {(!letters || letters.length === 0) ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1" data-testid="text-no-offers">No Offer Letters Yet</h3>
            <p className="text-muted-foreground text-sm">
              Send your first offer letter from the "Offer Letter Generator" tab.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left p-3 font-medium">Candidate</th>
                    <th className="text-left p-3 font-medium">Personal Email</th>
                    <th className="text-left p-3 font-medium">Designation</th>
                    <th className="text-left p-3 font-medium">Department</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Sent</th>
                    <th className="text-left p-3 font-medium">Sent By</th>
                    <th className="text-left p-3 font-medium">Hire-in Email</th>
                    <th className="text-left p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {letters.map((letter: any) => {
                    const statusInfo = STATUS_BADGES[letter.status] || STATUS_BADGES.sent;
                    const StatusIcon = statusInfo.icon;
                    return (
                      <tr key={letter.id} className="border-b hover:bg-muted/20" data-testid={`row-offer-${letter.id}`}>
                        <td className="p-3 font-medium" data-testid={`text-candidate-${letter.id}`}>{letter.candidateName}</td>
                        <td className="p-3 text-muted-foreground">{letter.candidatePersonalEmail}</td>
                        <td className="p-3">{letter.designation}</td>
                        <td className="p-3">{letter.departmentName || "—"}</td>
                        <td className="p-3">
                          <Badge variant={statusInfo.variant} className="gap-1" data-testid={`badge-status-${letter.id}`}>
                            <StatusIcon className="h-3 w-3" />
                            {statusInfo.label}
                          </Badge>
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {letter.createdAt ? new Date(letter.createdAt).toLocaleDateString() : "—"}
                        </td>
                        <td className="p-3">{letter.creatorName}</td>
                        <td className="p-3">{letter.hireInEmail || "—"}</td>
                        <td className="p-3">
                          <div className="flex gap-1">
                            {letter.status !== "cancelled" && letter.status !== "expired" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setViewLetterModal(letter)}
                                data-testid={`button-view-letter-${letter.id}`}
                              >
                                <FileSearch className="h-4 w-4 mr-1" />
                                View Letter
                              </Button>
                            )}
                            {(letter.status === "sent" || letter.status === "viewed") && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => cancelMutation.mutate(letter.id)}
                                disabled={cancelMutation.isPending}
                                data-testid={`button-cancel-${letter.id}`}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Cancel
                              </Button>
                            )}
                            {letter.status === "accepted" && (
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setCountersignModal(letter);
                                    setCounterSignedName("Alina Carter");
                                    setCounterSignedDate(new Date().toISOString().split("T")[0]);
                                  }}
                                  data-testid={`button-countersign-${letter.id}`}
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Counter Sign
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => cancelMutation.mutate(letter.id)}
                                  disabled={cancelMutation.isPending}
                                  data-testid={`button-cancel-${letter.id}`}
                                >
                                  <XCircle className="h-4 w-4 mr-1" />
                                  Cancel
                                </Button>
                              </div>
                            )}
                            {letter.status === "countersigned" && (
                              <Button
                                size="sm"
                                onClick={() => { setOnboardingModal(letter); setHireInEmail(""); }}
                                data-testid={`button-onboard-${letter.id}`}
                              >
                                <UserPlus className="h-4 w-4 mr-1" />
                                Start Onboarding
                              </Button>
                            )}
                            {letter.status === "onboarded" && letter.resultingUserId && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setLocation(`/admin/users`)}
                                data-testid={`button-view-employee-${letter.id}`}
                              >
                                <ExternalLink className="h-4 w-4 mr-1" />
                                View Employee
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
          </CardContent>
        </Card>
      )}

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

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-hr-tools-title">HR Tools</h1>
          <p className="text-muted-foreground">Generate salary slips, offer letters, and manage onboarding</p>
        </div>

        <Tabs defaultValue="salary-slip" className="space-y-6">
          <TabsList data-testid="tabs-hr-tools">
            <TabsTrigger value="salary-slip" data-testid="tab-salary-slip">
              <Receipt className="h-4 w-4 mr-2" />
              Salary Slip
            </TabsTrigger>
            <TabsTrigger value="offer-letter" data-testid="tab-offer-letter">
              <FileText className="h-4 w-4 mr-2" />
              Offer Letter Generator
            </TabsTrigger>
            <TabsTrigger value="offer-letters" data-testid="tab-offer-letters">
              <Mail className="h-4 w-4 mr-2" />
              Offer Letters
            </TabsTrigger>
          </TabsList>

          <TabsContent value="salary-slip">
            <SalarySlipGenerator />
          </TabsContent>

          <TabsContent value="offer-letter">
            <OfferLetterGenerator />
          </TabsContent>

          <TabsContent value="offer-letters">
            <OfferLettersDashboard />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
