import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Wrench, FileText, Receipt, Download, Loader2, User, Building, Search,
} from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { numberToWords } from "@/lib/numberToWords";

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
  bankName: string;
  joiningDate: string;
  bankAccountNo: string;
  designation: string;
  pfNo: string;
  department: string;
  pfUan: string;
  esi: string;
  location: string;
  grade: string;
  lop: number;
  empEffectiveWorkdays: number;
  daysInMonth: number;
  basic: number;
  hra: number;
  conveyance: number;
  specialAllowance: number;
  pfDeduction: number;
  esiDeduction: number;
  professionalTax: number;
  tds: number;
  otherDeductions: number;
  month: number;
  year: number;
}

function getDefaultSlipData(): SlipFormData {
  const now = new Date();
  return {
    employeeName: "",
    bankName: "",
    joiningDate: "",
    bankAccountNo: "",
    designation: "",
    pfNo: "",
    department: "",
    pfUan: "",
    esi: "",
    location: "Noida, U.P.",
    grade: "",
    lop: 0,
    empEffectiveWorkdays: 31,
    daysInMonth: 31,
    basic: 0,
    hra: 0,
    conveyance: 0,
    specialAllowance: 0,
    pfDeduction: 0,
    esiDeduction: 0,
    professionalTax: 0,
    tds: 0,
    otherDeductions: 0,
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

  return `<!DOCTYPE html>
<html>
<head>
<title>Payslip - ${monthName} ${data.year}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; background: #fff; padding: 30px; }
  .slip { max-width: 850px; margin: 0 auto; }
  .header { text-align: center; margin-bottom: 5px; }
  .header .logo-line { display: flex; align-items: center; justify-content: center; gap: 20px; margin-bottom: 2px; }
  .header h1 { font-size: 20px; font-weight: 700; color: #1a1a1a; }
  .header .address { font-size: 11px; color: #555; }
  .blue-line { height: 4px; background: linear-gradient(to right, #1a365d, #3182ce, #1a365d); margin: 10px 0 20px; }
  .payslip-title { text-align: center; margin-bottom: 20px; }
  .payslip-title h2 { font-size: 16px; text-decoration: underline; font-weight: 600; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid #333; margin-bottom: 20px; }
  .info-left, .info-right { padding: 0; }
  .info-left { border-right: 1px solid #333; }
  .info-row { display: flex; padding: 4px 10px; font-size: 12px; min-height: 24px; }
  .info-row .lbl { min-width: 140px; font-weight: 600; color: #1a1a1a; }
  .info-row .val { color: #333; }
  .earnings-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
  .earnings-table th, .earnings-table td { border: 1px solid #333; padding: 5px 10px; font-size: 12px; text-align: left; }
  .earnings-table th { background: #f0f0f0; font-weight: 700; }
  .earnings-table .amount { text-align: right; }
  .earnings-table .total-row { font-weight: 700; background: #f0f0f0; }
  .net-pay-row { font-weight: 700; font-size: 13px; }
  .net-pay-words { font-style: italic; font-weight: 700; font-size: 12px; padding: 5px 10px; }
  .remarks { margin-top: 30px; font-size: 11px; }
  .remarks .title { font-weight: 700; margin-bottom: 5px; }
  .disclaimer { margin-top: 15px; font-size: 11px; color: #777; text-align: center; }
  @media print {
    body { padding: 10px; }
  }
</style>
</head>
<body>
<div class="slip">
  <div class="header">
    <h1>Rayomind Solutions DBA Hire'in Solutions</h1>
    <div class="address">Suite No-101, Pocket-6, Sector-2, Rohini, New Delhi, 110085, India</div>
  </div>
  <div class="blue-line"></div>
  <div class="payslip-title">
    <h2>Payslip for the month of ${monthName}- ${data.year}</h2>
  </div>

  <div class="info-grid">
    <div class="info-left">
      <div class="info-row"><span class="lbl">Name:</span><span class="val">${data.employeeName}</span></div>
      <div class="info-row"><span class="lbl">Joining Date:</span><span class="val">${data.joiningDate}</span></div>
      <div class="info-row"><span class="lbl">Designation:</span><span class="val">${data.designation}</span></div>
      <div class="info-row"><span class="lbl">Department:</span><span class="val">${data.department}</span></div>
      <div class="info-row" style="height:24px"></div>
      <div class="info-row"><span class="lbl">Location:</span><span class="val">${data.location}</span></div>
      <div class="info-row"><span class="lbl">Grade:</span><span class="val">${data.grade}</span></div>
      <div class="info-row"><span class="lbl">EMP EFFECTIVE WORKDAYS:</span><span class="val">${data.empEffectiveWorkdays}</span></div>
      <div class="info-row"><span class="lbl">DAYS IN MONTH:</span><span class="val">${data.daysInMonth}</span></div>
    </div>
    <div class="info-right">
      <div class="info-row"><span class="lbl">Bank Name:</span><span class="val">${data.bankName}</span></div>
      <div class="info-row"><span class="lbl">Bank Account No:</span><span class="val">${data.bankAccountNo}</span></div>
      <div class="info-row"><span class="lbl">PF No:</span><span class="val">${data.pfNo}</span></div>
      <div class="info-row"><span class="lbl">PF UAN:</span><span class="val">${data.pfUan}</span></div>
      <div class="info-row"><span class="lbl">ESI:</span><span class="val">${data.esi}</span></div>
      <div class="info-row" style="height:24px"></div>
      <div class="info-row" style="height:24px"></div>
      <div class="info-row"><span class="lbl">LOP:</span><span class="val">${data.lop}</span></div>
      <div class="info-row" style="height:24px"></div>
    </div>
  </div>

  <table class="earnings-table">
    <thead>
      <tr>
        <th>Earnings</th>
        <th class="amount">Amount</th>
        <th>Deductions</th>
        <th class="amount">Amount</th>
        <th class="amount">YTD</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>BASIC</td>
        <td class="amount">${formatCurrency(data.basic)}</td>
        <td>${data.pfDeduction > 0 ? 'PF' : ''}</td>
        <td class="amount">${data.pfDeduction > 0 ? formatCurrency(data.pfDeduction) : ''}</td>
        <td class="amount"></td>
      </tr>
      <tr>
        <td>HRA</td>
        <td class="amount">${formatCurrency(data.hra)}</td>
        <td>${data.esiDeduction > 0 ? 'ESI' : ''}</td>
        <td class="amount">${data.esiDeduction > 0 ? formatCurrency(data.esiDeduction) : ''}</td>
        <td class="amount"></td>
      </tr>
      <tr>
        <td>CONVEYANCE</td>
        <td class="amount">${formatCurrency(data.conveyance)}</td>
        <td>${data.professionalTax > 0 ? 'Professional Tax' : ''}</td>
        <td class="amount">${data.professionalTax > 0 ? formatCurrency(data.professionalTax) : ''}</td>
        <td class="amount"></td>
      </tr>
      <tr>
        <td>SPECIAL ALLOWANCE</td>
        <td class="amount">${formatCurrency(data.specialAllowance)}</td>
        <td>${data.tds > 0 ? 'TDS' : ''}</td>
        <td class="amount">${data.tds > 0 ? formatCurrency(data.tds) : ''}</td>
        <td class="amount"></td>
      </tr>
      ${data.otherDeductions > 0 ? `<tr>
        <td></td>
        <td class="amount"></td>
        <td>Other Deductions</td>
        <td class="amount">${formatCurrency(data.otherDeductions)}</td>
        <td class="amount"></td>
      </tr>` : ''}
      <tr class="total-row">
        <td>Total Earnings</td>
        <td class="amount">${formatCurrency(totalEarnings)}</td>
        <td>Total Deduction</td>
        <td class="amount">${formatCurrency(totalDeductions)}</td>
        <td class="amount"></td>
      </tr>
    </tbody>
  </table>

  <table class="earnings-table">
    <tr class="net-pay-row">
      <td colspan="5">Net Pay for the month : <span style="float:right">${formatCurrency(netPay)}</span></td>
    </tr>
    <tr>
      <td colspan="5" class="net-pay-words">(Rupees ${netPayWords})</td>
    </tr>
  </table>

  <div class="remarks">
    <div class="title">Remarks:</div>
  </div>
  <div class="disclaimer">This is a computer generated payslip and does not require a signature</div>
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

  const { data: users } = useQuery<any[]>({
    queryKey: ["/api/admin/users"],
  });

  const { data: departments } = useQuery<any[]>({
    queryKey: ["/api/admin/departments"],
  });

  const activeUsers = useMemo(() => {
    if (!users) return [];
    return users.filter((u: any) => u.isActive);
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
      designation: user.designation || "",
      department: dept?.name || "",
      joiningDate: user.joiningDate ? new Date(user.joiningDate).toLocaleDateString("en-IN") : "",
    }));

    try {
      const bankRes = await fetch(`/api/hr/employee-bank-details/${userId}`);
      if (bankRes.ok) {
        const bank = await bankRes.json();
        if (bank) {
          setFormData(prev => ({
            ...prev,
            bankName: bank.bankName || "",
            bankAccountNo: bank.accountNumber || "",
          }));
        }
      }
    } catch {}
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
        empEffectiveWorkdays: detail.totalWorkingDays || prev.empEffectiveWorkdays,
        daysInMonth: detail.totalWorkingDays || prev.daysInMonth,
        lop: detail.daysAbsent || 0,
        bankName: detail.bankDetails?.bankName || prev.bankName,
        bankAccountNo: detail.bankDetails?.accountNumber || prev.bankAccountNo,
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
                <Label>Bank Name</Label>
                <Input data-testid="input-slip-bank" value={formData.bankName} onChange={e => updateField("bankName", e.target.value)} />
              </div>
              <div>
                <Label>Joining Date</Label>
                <Input data-testid="input-slip-joining" value={formData.joiningDate} onChange={e => updateField("joiningDate", e.target.value)} />
              </div>
              <div>
                <Label>Bank Account No</Label>
                <Input data-testid="input-slip-account" value={formData.bankAccountNo} onChange={e => updateField("bankAccountNo", e.target.value)} />
              </div>
              <div>
                <Label>Designation</Label>
                <Input data-testid="input-slip-designation" value={formData.designation} onChange={e => updateField("designation", e.target.value)} />
              </div>
              <div>
                <Label>PF No</Label>
                <Input data-testid="input-slip-pf" value={formData.pfNo} onChange={e => updateField("pfNo", e.target.value)} />
              </div>
              <div>
                <Label>Department</Label>
                <Input data-testid="input-slip-dept" value={formData.department} onChange={e => updateField("department", e.target.value)} />
              </div>
              <div>
                <Label>PF UAN</Label>
                <Input data-testid="input-slip-uan" value={formData.pfUan} onChange={e => updateField("pfUan", e.target.value)} />
              </div>
              <div>
                <Label>ESI</Label>
                <Input data-testid="input-slip-esi" value={formData.esi} onChange={e => updateField("esi", e.target.value)} />
              </div>
              <div>
                <Label>Location</Label>
                <Input data-testid="input-slip-location" value={formData.location} onChange={e => updateField("location", e.target.value)} />
              </div>
              <div>
                <Label>Grade</Label>
                <Input data-testid="input-slip-grade" value={formData.grade} onChange={e => updateField("grade", e.target.value)} />
              </div>
              <div>
                <Label>LOP (Days)</Label>
                <Input data-testid="input-slip-lop" type="number" value={formData.lop} onChange={e => updateField("lop", parseInt(e.target.value) || 0)} />
              </div>
              <div>
                <Label>Effective Workdays</Label>
                <Input data-testid="input-slip-workdays" type="number" value={formData.empEffectiveWorkdays} onChange={e => updateField("empEffectiveWorkdays", parseInt(e.target.value) || 0)} />
              </div>
              <div>
                <Label>Days in Month</Label>
                <Input data-testid="input-slip-daysinmonth" type="number" value={formData.daysInMonth} onChange={e => updateField("daysInMonth", parseInt(e.target.value) || 0)} />
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
  candidateAddress: string;
  designation: string;
  subjectDesignation: string;
  reportingTo: string;
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
    candidateAddress: "",
    designation: "",
    subjectDesignation: "",
    reportingTo: "",
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

  const { data: users } = useQuery<any[]>({
    queryKey: ["/api/admin/users"],
  });

  const activeUsers = useMemo(() => {
    if (!users) return [];
    return users.filter((u: any) => u.isActive);
  }, [users]);

  const updateField = (field: keyof OfferFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    if (formData.salary > 0) {
      updateField("salaryInWords", numberToWords(formData.salary));
    }
  }, [formData.salary]);

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
    }));
  };

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
          offerDate: formData.offerDate
            ? new Date(formData.offerDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
            : undefined,
          proposedStartDate: formData.proposedStartDate
            ? new Date(formData.proposedStartDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
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
              <Label>Reporting To</Label>
              <Input data-testid="input-offer-reporting" value={formData.reportingTo} onChange={e => updateField("reportingTo", e.target.value)} />
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
              The offer letter will be generated as a Word document (.docx) matching the company template with all 12 legal sections and the BYOD Annexure.
            </div>
            <Button onClick={handleGenerate} disabled={generating || !formData.candidateName || !formData.designation} data-testid="button-generate-offer">
              {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
              Generate & Download
            </Button>
          </div>
        </CardContent>
      </Card>
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
          <p className="text-muted-foreground">Generate salary slips and offer letters</p>
        </div>

        <Tabs defaultValue="salary-slip" className="space-y-6">
          <TabsList data-testid="tabs-hr-tools">
            <TabsTrigger value="salary-slip" data-testid="tab-salary-slip">
              <Receipt className="h-4 w-4 mr-2" />
              Salary Slip Generator
            </TabsTrigger>
            <TabsTrigger value="offer-letter" data-testid="tab-offer-letter">
              <FileText className="h-4 w-4 mr-2" />
              Offer Letter Generator
            </TabsTrigger>
          </TabsList>

          <TabsContent value="salary-slip">
            <SalarySlipGenerator />
          </TabsContent>

          <TabsContent value="offer-letter">
            <OfferLetterGenerator />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
