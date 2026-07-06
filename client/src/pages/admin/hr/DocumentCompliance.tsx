import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Eye,
  Download,
  ShieldCheck,
  XCircle,
  Send,
  Search,
  FileText,
  FolderPlus,
  Landmark,
  Phone,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";

interface ComplianceUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  employeeId: string | null;
  department: string | null;
  employeeCategory: string | null;
}

interface ComplianceDoc {
  id: string;
  userId: string;
  category: string;
  documentType: string;
  fileName: string | null;
  fileUrl: string | null;
  fileSize: number | null;
  status: string;
  isRequired: boolean;
  remarks: string | null;
  uploadedAt: string | null;
  verifiedBy: string | null;
  verifiedAt: string | null;
}

interface ComplianceEmployee {
  user: ComplianceUser;
  docs: ComplianceDoc[];
  requiredTotal: number;
  requiredUploaded: number;
  requiredVerified: number;
}

interface ComplianceReport {
  summary: {
    totalEmployees: number;
    fullyCompliant: number;
    pendingDocs: number;
    noDocs: number;
  };
  employees: ComplianceEmployee[];
}

interface BankDetails {
  id: string;
  userId: string;
  accountNumber: string | null;
  ifscCode: string | null;
  bankName: string | null;
  branchName: string | null;
}

interface EmergencyContact {
  id: string;
  userId: string;
  name: string;
  relationship: string;
  phone: string;
  email: string | null;
  address: string | null;
  isPrimary: boolean;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  aadhaar: "Aadhaar Card",
  pan: "PAN Card",
  passport: "Passport",
  voter_id: "Voter ID",
  driving_license: "Driving License",
  "10th_marksheet": "10th Marksheet",
  "12th_marksheet": "12th Marksheet",
  graduation_cert: "Graduation Certificate",
  postgrad_cert: "Post-Graduation Certificate",
  relieving_letter: "Relieving Letter",
  salary_slips_prev: "Previous Salary Slips",
  form16: "Form 16",
  cancelled_cheque: "Cancelled Cheque",
};

const CATEGORY_LABELS: Record<string, string> = {
  identity: "Identity & KYC",
  education: "Education",
  employment: "Previous Employment",
  bank: "Bank Details",
};

function getStatusBadge(status: string) {
  switch (status) {
    case "verified":
      return <Badge variant="default" className="bg-green-600" data-testid={`badge-status-${status}`}><CheckCircle2 className="mr-1 h-3 w-3" />Verified</Badge>;
    case "uploaded":
      return <Badge variant="outline" data-testid={`badge-status-${status}`}><Clock className="mr-1 h-3 w-3" />Uploaded</Badge>;
    case "rejected":
      return <Badge variant="destructive" data-testid={`badge-status-${status}`}><XCircle className="mr-1 h-3 w-3" />Rejected</Badge>;
    default:
      return <Badge variant="secondary" data-testid={`badge-status-${status}`}><Clock className="mr-1 h-3 w-3" />Pending</Badge>;
  }
}

function getEmployeeStatusBadge(emp: ComplianceEmployee) {
  if (emp.requiredTotal === 0) {
    return <Badge variant="secondary" data-testid="badge-employee-no-docs">No Docs</Badge>;
  }
  if (emp.requiredUploaded === emp.requiredTotal) {
    if (emp.requiredVerified === emp.requiredTotal) {
      return <Badge variant="default" className="bg-green-600" data-testid="badge-employee-verified">Fully Verified</Badge>;
    }
    return <Badge variant="outline" data-testid="badge-employee-complete">Complete</Badge>;
  }
  return <Badge variant="destructive" data-testid="badge-employee-incomplete">Incomplete</Badge>;
}

export function DocumentComplianceContent({ readOnly }: { readOnly?: boolean } = {}) {
  const { toast } = useToast();
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [verifyDialog, setVerifyDialog] = useState<{ docId: string; action: "verified" | "rejected" } | null>(null);
  const [remarks, setRemarks] = useState("");
  const [bankDetailsUserId, setBankDetailsUserId] = useState<string | null>(null);
  const [emergencyContactsUserId, setEmergencyContactsUserId] = useState<string | null>(null);

  const { data: report, isLoading } = useQuery<ComplianceReport>({
    queryKey: ["/api/hr/document-compliance"],
  });

  const verifyMutation = useMutation({
    mutationFn: async ({ docId, status, remarks }: { docId: string; status: string; remarks: string }) => {
      const res = await apiRequest("PATCH", `/api/hr/employee-documents/${docId}/verify`, { status, remarks });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/document-compliance"] });
      toast({ title: "Document updated", description: "Document status has been updated." });
      setVerifyDialog(null);
      setRemarks("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update document status.", variant: "destructive" });
    },
  });

  const reminderMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest("POST", `/api/hr/employee-documents/send-reminder/${userId}`);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Reminder sent", description: data.message || "Document reminder has been sent." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send reminder.", variant: "destructive" });
    },
  });

  const initializeMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest("POST", `/api/hr/employee-documents/initialize/${userId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/document-compliance"] });
      toast({ title: "Documents initialized", description: "Document checklist has been created for this employee." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to initialize documents.", variant: "destructive" });
    },
  });

  const { data: bankDetails, isLoading: bankLoading } = useQuery<BankDetails>({
    queryKey: ["/api/hr/employee-bank-details", bankDetailsUserId],
    enabled: !!bankDetailsUserId,
  });

  const { data: emergencyContacts, isLoading: emergencyLoading } = useQuery<EmergencyContact[]>({
    queryKey: ["/api/hr/employee-emergency-contacts", emergencyContactsUserId],
    enabled: !!emergencyContactsUserId,
  });

  const departments = report
    ? Array.from(new Set(report.employees.map((e) => e.user.department).filter(Boolean)))
    : [];

  const filteredEmployees = report?.employees.filter((emp) => {
    if (statusFilter === "complete" && (emp.requiredTotal === 0 || emp.requiredUploaded < emp.requiredTotal)) return false;
    if (statusFilter === "incomplete" && (emp.requiredTotal === 0 || emp.requiredUploaded >= emp.requiredTotal)) return false;
    if (statusFilter === "no_docs" && emp.requiredTotal > 0) return false;

    if (departmentFilter !== "all" && emp.user.department !== departmentFilter) return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match =
        emp.user.firstName.toLowerCase().includes(q) ||
        emp.user.lastName.toLowerCase().includes(q) ||
        (emp.user.employeeId || "").toLowerCase().includes(q) ||
        emp.user.email.toLowerCase().includes(q);
      if (!match) return false;
    }

    return true;
  }) || [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const summary = report?.summary || { totalEmployees: 0, fullyCompliant: 0, pendingDocs: 0, noDocs: 0 };

  function handleExportCSV() {
    if (!report) return;
    const rows = [["Employee Name", "Employee ID", "Department", "Document Type", "Category", "Status", "Upload Date", "Verified Date"]];
    for (const emp of report.employees) {
      for (const doc of emp.docs) {
        rows.push([
          `${emp.user.firstName} ${emp.user.lastName}`,
          emp.user.employeeId || "",
          emp.user.department || "",
          DOC_TYPE_LABELS[doc.documentType] || doc.documentType,
          CATEGORY_LABELS[doc.category] || doc.category,
          doc.status,
          doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : "",
          doc.verifiedAt ? new Date(doc.verifiedAt).toLocaleDateString() : "",
        ]);
      }
    }
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `document-compliance-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Document Compliance</h1>
          <p className="text-muted-foreground" data-testid="text-page-description">
            Track and verify employee onboarding documents
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!report} data-testid="button-export-doc-compliance-csv">
          <Download className="h-4 w-4 mr-1.5" />
          Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="card-total-employees">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono font-bold" data-testid="text-total-employees">{summary.totalEmployees}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-fully-compliant">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fully Compliant</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono font-bold text-green-600" data-testid="text-fully-compliant">{summary.fullyCompliant}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-pending-docs">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Documents</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono font-bold text-yellow-600" data-testid="text-pending-docs">{summary.pendingDocs}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-missing-required">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Missing Required</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono font-bold text-red-600" data-testid="text-missing-required">{summary.noDocs}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Employee Documents</CardTitle>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or employee ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="complete">Complete</SelectItem>
                <SelectItem value="incomplete">Incomplete</SelectItem>
                <SelectItem value="no_docs">No Documents</SelectItem>
              </SelectContent>
            </Select>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-department-filter">
                <SelectValue placeholder="Filter by department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept!} value={dept!}>{dept}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredEmployees.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground" data-testid="text-no-results">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>No employees match the current filters.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((emp) => (
                  <EmployeeRow
                    key={emp.user.id}
                    emp={emp}
                    isExpanded={expandedUserId === emp.user.id}
                    onToggle={() => setExpandedUserId(expandedUserId === emp.user.id ? null : emp.user.id)}
                    onVerify={(docId) => { setVerifyDialog({ docId, action: "verified" }); setRemarks(""); }}
                    onReject={(docId) => { setVerifyDialog({ docId, action: "rejected" }); setRemarks(""); }}
                    onSendReminder={(userId) => reminderMutation.mutate(userId)}
                    isReminderPending={reminderMutation.isPending}
                    onInitializeDocs={(userId) => initializeMutation.mutate(userId)}
                    isInitializePending={initializeMutation.isPending}
                    onViewBankDetails={(userId) => setBankDetailsUserId(userId)}
                    onViewEmergencyContacts={(userId) => setEmergencyContactsUserId(userId)}
                    readOnly={readOnly}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!verifyDialog} onOpenChange={() => { setVerifyDialog(null); setRemarks(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {verifyDialog?.action === "verified" ? "Verify Document" : "Reject Document"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {verifyDialog?.action === "verified"
                ? "Confirm that this document has been reviewed and is valid."
                : "Provide a reason for rejecting this document. The employee will see this remark."}
            </p>
            <Textarea
              placeholder={verifyDialog?.action === "rejected" ? "Reason for rejection (required)..." : "Optional remarks..."}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              data-testid="input-remarks"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setVerifyDialog(null); setRemarks(""); }} data-testid="button-cancel-action">
              Cancel
            </Button>
            <Button
              variant={verifyDialog?.action === "verified" ? "default" : "destructive"}
              disabled={verifyMutation.isPending || (verifyDialog?.action === "rejected" && !remarks.trim())}
              onClick={() => {
                if (verifyDialog) {
                  verifyMutation.mutate({
                    docId: verifyDialog.docId,
                    status: verifyDialog.action,
                    remarks,
                  });
                }
              }}
              data-testid="button-confirm-action"
            >
              {verifyMutation.isPending ? "Processing..." : verifyDialog?.action === "verified" ? "Verify" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!bankDetailsUserId} onOpenChange={() => setBankDetailsUserId(null)}>
        <DialogContent data-testid="dialog-bank-details">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Landmark className="h-5 w-5" />
              Bank Details
            </DialogTitle>
          </DialogHeader>
          {bankLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-5 w-3/4" />
            </div>
          ) : bankDetails ? (
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-muted-foreground">Account Number</span>
                <span className="text-sm font-medium font-mono" data-testid="text-bank-account">{bankDetails.accountNumber || "—"}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-muted-foreground">IFSC Code</span>
                <span className="text-sm font-medium font-mono" data-testid="text-bank-ifsc">{bankDetails.ifscCode || "—"}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-muted-foreground">Bank Name</span>
                <span className="text-sm font-medium" data-testid="text-bank-name">{bankDetails.bankName || "—"}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-muted-foreground">Branch Name</span>
                <span className="text-sm font-medium" data-testid="text-bank-branch">{bankDetails.branchName || "—"}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6" data-testid="text-no-bank-details">
              No bank details found for this employee.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBankDetailsUserId(null)} data-testid="button-close-bank-details">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!emergencyContactsUserId} onOpenChange={() => setEmergencyContactsUserId(null)}>
        <DialogContent data-testid="dialog-emergency-contacts">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Emergency Contacts
            </DialogTitle>
          </DialogHeader>
          {emergencyLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : emergencyContacts && emergencyContacts.length > 0 ? (
            <div className="space-y-3">
              {emergencyContacts.map((contact) => (
                <div key={contact.id} className="border rounded-md p-3 space-y-1" data-testid={`emergency-contact-${contact.id}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium" data-testid={`text-contact-name-${contact.id}`}>{contact.name}</span>
                    <Badge variant="secondary" className="text-[10px]">{contact.relationship}</Badge>
                    {contact.isPrimary && <Badge variant="default" className="text-[10px]">Primary</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <p data-testid={`text-contact-phone-${contact.id}`}>Phone: {contact.phone}</p>
                    {contact.email && <p data-testid={`text-contact-email-${contact.id}`}>Email: {contact.email}</p>}
                    {contact.address && <p data-testid={`text-contact-address-${contact.id}`}>Address: {contact.address}</p>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6" data-testid="text-no-emergency-contacts">
              No emergency contacts found for this employee.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmergencyContactsUserId(null)} data-testid="button-close-emergency-contacts">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const CATEGORY_BADGE_COLORS: Record<string, string> = {
  experienced: "bg-blue-100 text-blue-800",
  fresher: "bg-green-100 text-green-800",
  intern: "bg-amber-100 text-amber-800",
};

const CATEGORY_LABELS_MAP: Record<string, string> = {
  experienced: "Experienced",
  fresher: "Fresher",
  intern: "Intern",
};

interface EmployeeRowProps {
  emp: ComplianceEmployee;
  isExpanded: boolean;
  onToggle: () => void;
  onVerify: (docId: string) => void;
  onReject: (docId: string) => void;
  onSendReminder: (userId: string) => void;
  isReminderPending: boolean;
  onInitializeDocs: (userId: string) => void;
  isInitializePending: boolean;
  onViewBankDetails: (userId: string) => void;
  onViewEmergencyContacts: (userId: string) => void;
  readOnly?: boolean;
}

function EmployeeRow({ emp, isExpanded, onToggle, onVerify, onReject, onSendReminder, isReminderPending, onInitializeDocs, isInitializePending, onViewBankDetails, onViewEmergencyContacts, readOnly }: EmployeeRowProps) {
  const progressPercent = emp.requiredTotal > 0 ? Math.round((emp.requiredUploaded / emp.requiredTotal) * 100) : 0;
  const hasPendingDocs = emp.docs.some((d) => d.isRequired && d.status === "pending");

  const toggleRequiredMutation = useMutation({
    mutationFn: async (docId: string) => {
      const res = await apiRequest("PATCH", `/api/hr/employee-documents/${docId}/toggle-required`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/document-compliance"] });
    },
  });

  const docsByCategory = emp.docs.reduce<Record<string, ComplianceDoc[]>>((acc, doc) => {
    if (!acc[doc.category]) acc[doc.category] = [];
    acc[doc.category].push(doc);
    return acc;
  }, {});

  return (
    <>
      <TableRow className="cursor-pointer" onClick={onToggle} data-testid={`row-employee-${emp.user.id}`}>
        <TableCell>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium" data-testid={`text-employee-name-${emp.user.id}`}>
                {emp.user.firstName} {emp.user.lastName}
              </span>
              {emp.user.employeeCategory && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${CATEGORY_BADGE_COLORS[emp.user.employeeCategory] || CATEGORY_BADGE_COLORS.experienced}`}
                  data-testid={`badge-category-${emp.user.id}`}
                >
                  {CATEGORY_LABELS_MAP[emp.user.employeeCategory] || emp.user.employeeCategory}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{emp.user.email}</p>
          </div>
        </TableCell>
        <TableCell>
          <span className="text-sm font-mono" data-testid={`text-employee-id-${emp.user.id}`}>
            {emp.user.employeeId || "—"}
          </span>
        </TableCell>
        <TableCell>
          <span className="text-sm" data-testid={`text-department-${emp.user.id}`}>
            {emp.user.department || "—"}
          </span>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2 min-w-[140px]">
            <Progress value={progressPercent} className="h-2 flex-1" />
            <span className="text-xs text-muted-foreground whitespace-nowrap" data-testid={`text-progress-${emp.user.id}`}>
              {emp.requiredUploaded}/{emp.requiredTotal}
            </span>
          </div>
        </TableCell>
        <TableCell>{getEmployeeStatusBadge(emp)}</TableCell>
        <TableCell>
          <div className="flex items-center gap-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
            {!readOnly && emp.requiredTotal === 0 && (
              <Button
                size="sm"
                variant="outline"
                disabled={isInitializePending}
                onClick={() => onInitializeDocs(emp.user.id)}
                data-testid={`button-initialize-docs-${emp.user.id}`}
              >
                <FolderPlus className="h-3 w-3 mr-1" />
                Initialize
              </Button>
            )}
            {!readOnly && hasPendingDocs && (
              <Button
                size="sm"
                variant="outline"
                disabled={isReminderPending}
                onClick={() => onSendReminder(emp.user.id)}
                data-testid={`button-send-reminder-${emp.user.id}`}
              >
                <Send className="h-3 w-3 mr-1" />
                Remind
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onViewBankDetails(emp.user.id)}
              data-testid={`button-view-bank-${emp.user.id}`}
            >
              <Landmark />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onViewEmergencyContacts(emp.user.id)}
              data-testid={`button-view-emergency-${emp.user.id}`}
            >
              <Phone />
            </Button>
          </div>
        </TableCell>
        <TableCell>
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </TableCell>
      </TableRow>
      {isExpanded && (
        <TableRow data-testid={`row-employee-details-${emp.user.id}`}>
          <TableCell colSpan={7} className="bg-muted/30">
            {emp.docs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No documents initialized for this employee.
              </p>
            ) : (
              <div className="space-y-4 py-2">
                {Object.entries(docsByCategory).map(([category, docs]) => (
                  <div key={category}>
                    <h4 className="text-sm font-semibold mb-2">
                      {CATEGORY_LABELS[category] || category}
                    </h4>
                    <div className="space-y-1">
                      {docs.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex flex-wrap items-center gap-3 py-2 px-3 rounded-md bg-background"
                          data-testid={`doc-row-${doc.id}`}
                        >
                          <div className="flex-1 min-w-[180px]">
                            <span className="text-sm font-medium">
                              {DOC_TYPE_LABELS[doc.documentType] || doc.documentType}
                            </span>
                            {doc.isRequired ? (
                              <Badge variant="destructive" className="ml-2 text-[10px]">Required</Badge>
                            ) : (
                              <Badge variant="secondary" className="ml-2 text-[10px]">Optional</Badge>
                            )}
                            {doc.remarks && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Remarks: {doc.remarks}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(doc.status)}
                            {!readOnly && (
                              <Button
                                size="icon"
                                variant="ghost"
                                title={doc.isRequired ? "Mark as Optional" : "Mark as Required"}
                                disabled={toggleRequiredMutation.isPending}
                                onClick={() => toggleRequiredMutation.mutate(doc.id)}
                                data-testid={`button-toggle-required-${doc.id}`}
                              >
                                {doc.isRequired ? <ToggleRight className="h-4 w-4 text-destructive" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                              </Button>
                            )}
                            {doc.fileUrl && (
                              <>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => window.open(doc.fileUrl!, "_blank")}
                                  data-testid={`button-view-doc-${doc.id}`}
                                >
                                  <Eye />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  asChild
                                  data-testid={`button-download-doc-${doc.id}`}
                                >
                                  <a href={doc.fileUrl} download={doc.fileName || undefined}>
                                    <Download />
                                  </a>
                                </Button>
                              </>
                            )}
                            {!readOnly && (doc.status === "uploaded" || doc.status === "rejected") && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onVerify(doc.id)}
                                data-testid={`button-verify-doc-${doc.id}`}
                              >
                                <ShieldCheck className="h-3 w-3 mr-1" />
                                Verify
                              </Button>
                            )}
                            {!readOnly && (doc.status === "uploaded" || doc.status === "verified") && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onReject(doc.id)}
                                data-testid={`button-reject-doc-${doc.id}`}
                              >
                                <XCircle className="h-3 w-3 mr-1" />
                                Reject
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export default function DocumentCompliance() {
  return <DocumentComplianceContent />;
}
