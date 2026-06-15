import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Shield, CheckCircle, XCircle, Loader2, AlertTriangle, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TEMPLATE_LABELS } from "@shared/hrLetterConstants";

const rayomindLogoPath = "/rayomind-logo.png";

interface HrLetterVerifyResult {
  documentType?: "hr_letter";
  employeeName: string;
  templateType: string;
  designation: string;
  department: string | null;
  startDate: string;
  endDate: string | null;
  issueDate: string | null;
  referenceNumber: string;
  status: string;
  verified: boolean;
  warning?: string;
}

interface ContractVerifyResult {
  documentType: "contract";
  clientName: string;
  templateName: string | null;
  candidateName: string | null;
  candidates: Array<{ name: string; role?: string; startDate?: string; location?: string; engagementType?: string }> | null;
  contractStartDate: string | null;
  contractEndDate: string | null;
  agreementDate: string | null;
  billingFrequency: string | null;
  paymentTermsDays: number | null;
  status: string;
  verified: boolean;
  tamperDetected?: boolean;
  warning?: string;
}

interface OfferLetterVerifyResult {
  documentType: "offer_letter";
  employeeName: string;
  designation: string | null;
  location: string | null;
  startDate: string | null;
  offerDate: string | null;
  acceptedName: string | null;
  acceptedAt: string | null;
  referenceNumber: string;
  status: string;
  verified: boolean;
  tamperDetected?: boolean;
  warning?: string;
}

interface AddendumVerifyResult {
  documentType: "addendum";
  employeeName: string;
  addendumType: string | null;
  effectiveDate: string | null;
  acceptedName: string | null;
  acceptedAt: string | null;
  referenceNumber: string;
  status: string;
  verified: boolean;
  tamperDetected?: boolean;
  warning?: string;
}

interface PolicyVerifyResult {
  documentType: "policy";
  employeeName: string;
  policyTitle: string | null;
  policyVersion: number | null;
  signedAt: string | null;
  referenceNumber: string;
  status: string;
  verified: boolean;
  tamperDetected?: boolean;
  warning?: string;
}

type VerifyResult =
  | HrLetterVerifyResult
  | ContractVerifyResult
  | OfferLetterVerifyResult
  | AddendumVerifyResult
  | PolicyVerifyResult;

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
}

function formatDateTime(dateStr?: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleString("en-IN", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function isContract(r: VerifyResult): r is ContractVerifyResult {
  return (r as any).documentType === "contract";
}

function isOfferLetter(r: VerifyResult): r is OfferLetterVerifyResult {
  return (r as any).documentType === "offer_letter";
}

function isAddendum(r: VerifyResult): r is AddendumVerifyResult {
  return (r as any).documentType === "addendum";
}

function isPolicy(r: VerifyResult): r is PolicyVerifyResult {
  return (r as any).documentType === "policy";
}

export default function VerifyLetter() {
  const [refNumber, setRefNumber] = useState("");
  const [authCode, setAuthCode] = useState("");
  const [docType, setDocType] = useState("hr_letter");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [notFound, setNotFound] = useState(false);

  const verifyMutation = useMutation({
    mutationFn: async () => {
      const params = new URLSearchParams({ ref: refNumber, auth: authCode });
      if (docType !== "hr_letter") params.set("documentType", docType);
      const res = await fetch(`/api/verify-letter?${params.toString()}`);
      if (res.status === 404) {
        setNotFound(true);
        setResult(null);
        return null;
      }
      if (!res.ok) throw new Error("Verification failed");
      return res.json();
    },
    onSuccess: (data) => {
      if (data) {
        setResult(data);
        setNotFound(false);
      }
    },
    onError: () => {
      setNotFound(true);
      setResult(null);
    },
  });

  function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!refNumber || !authCode) return;
    verifyMutation.mutate();
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white dark:from-gray-900 dark:to-gray-950">
      <div className="max-w-lg mx-auto pt-12 px-4 pb-16">
        <div className="text-center mb-8">
          <img src={rayomindLogoPath} alt="Rayomind" className="h-14 mx-auto mb-4" />
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-verify-title">Document Verification</h1>
          <p className="text-muted-foreground mt-1">Verify the authenticity of a Rayomind Solutions document</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-5 w-5 text-orange-500" />
              Verify Document
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <Label>Document Type</Label>
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger data-testid="select-doc-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hr_letter">HR Letter (Experience, Internship, Relieving)</SelectItem>
                    <SelectItem value="contract">Staffing Services Agreement (Contract)</SelectItem>
                    <SelectItem value="offer_letter">Offer Letter</SelectItem>
                    <SelectItem value="addendum">Amendment / Addendum Letter</SelectItem>
                    <SelectItem value="policy">Policy Acknowledgement</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Reference Number</Label>
                <Input
                  placeholder={
                    docType === "contract" ? "e.g. CTR/2026/ABCD1234"
                    : docType === "policy" ? "e.g. POL/2026/ABCD1234"
                    : docType === "offer_letter" || docType === "addendum" ? "Document ID"
                    : "e.g. RL/EXP/2026/0001"
                  }
                  value={refNumber}
                  onChange={e => setRefNumber(e.target.value)}
                  data-testid="input-verify-ref"
                />
              </div>
              <div>
                <Label>Auth Code</Label>
                <Input
                  placeholder="e.g. A7F3-B92E"
                  value={authCode}
                  onChange={e => setAuthCode(e.target.value)}
                  data-testid="input-verify-auth"
                />
              </div>
              <Button type="submit" className="w-full" disabled={!refNumber || !authCode || verifyMutation.isPending} data-testid="btn-verify">
                {verifyMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Shield className="h-4 w-4 mr-2" />}
                Verify Document
              </Button>
            </form>
          </CardContent>
        </Card>

        {result && (
          <Card className={`mt-6 ${result.verified === false ? "border-amber-300 dark:border-amber-700" : "border-green-200 dark:border-green-800"}`}>
            <CardContent className="pt-6">
              {result.verified === false ? (
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="h-6 w-6 text-amber-600" />
                  <span className="text-lg font-semibold text-amber-700 dark:text-amber-400" data-testid="text-verify-warning">Document Found — Integrity Warning</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                  <span className="text-lg font-semibold text-green-700 dark:text-green-400" data-testid="text-verify-success">Document Verified</span>
                </div>
              )}
              {result.warning && (
                <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md p-3 mb-4 text-sm text-amber-800 dark:text-amber-200" data-testid="text-verify-tamper-warning">
                  {result.warning}
                </div>
              )}
              <Separator className="mb-4" />

              {isOfferLetter(result) ? (
                /* ── Offer letter result ─────────────────────────────────────── */
                <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Document Type</p>
                    <p className="font-medium">Offer Letter</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <Badge data-testid="badge-verify-status">{result.status?.replace(/_/g, " ")}</Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Candidate Name</p>
                    <p className="font-medium" data-testid="text-verify-name">{result.employeeName}</p>
                  </div>
                  {result.designation && (
                    <div>
                      <p className="text-muted-foreground">Designation</p>
                      <p className="font-medium">{result.designation}</p>
                    </div>
                  )}
                  {result.location && (
                    <div>
                      <p className="text-muted-foreground">Location</p>
                      <p className="font-medium">{result.location}</p>
                    </div>
                  )}
                  {result.startDate && (
                    <div>
                      <p className="text-muted-foreground">Proposed Start Date</p>
                      <p className="font-medium">{formatDate(result.startDate)}</p>
                    </div>
                  )}
                  {result.acceptedName && (
                    <div>
                      <p className="text-muted-foreground">Accepted By</p>
                      <p className="font-medium">{result.acceptedName}</p>
                    </div>
                  )}
                  {result.acceptedAt && (
                    <div>
                      <p className="text-muted-foreground">Accepted On</p>
                      <p className="font-medium">{formatDateTime(result.acceptedAt)}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-muted-foreground">Reference</p>
                    <p className="font-mono text-xs">{result.referenceNumber}</p>
                  </div>
                </div>
              ) : isAddendum(result) ? (
                /* ── Addendum result ─────────────────────────────────────────── */
                <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Document Type</p>
                    <p className="font-medium">Amendment / Addendum Letter</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <Badge data-testid="badge-verify-status">{result.status?.replace(/_/g, " ")}</Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Employee Name</p>
                    <p className="font-medium" data-testid="text-verify-name">{result.employeeName}</p>
                  </div>
                  {result.addendumType && (
                    <div>
                      <p className="text-muted-foreground">Amendment Type</p>
                      <p className="font-medium capitalize">{result.addendumType.replace(/_/g, " ")}</p>
                    </div>
                  )}
                  {result.effectiveDate && (
                    <div>
                      <p className="text-muted-foreground">Effective Date</p>
                      <p className="font-medium">{formatDate(result.effectiveDate)}</p>
                    </div>
                  )}
                  {result.acceptedName && (
                    <div>
                      <p className="text-muted-foreground">Accepted By</p>
                      <p className="font-medium">{result.acceptedName}</p>
                    </div>
                  )}
                  {result.acceptedAt && (
                    <div>
                      <p className="text-muted-foreground">Accepted On</p>
                      <p className="font-medium">{formatDateTime(result.acceptedAt)}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-muted-foreground">Reference</p>
                    <p className="font-mono text-xs">{result.referenceNumber}</p>
                  </div>
                </div>
              ) : isPolicy(result) ? (
                /* ── Policy acknowledgement result ───────────────────────────── */
                <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Document Type</p>
                    <p className="font-medium">Policy Acknowledgement</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <Badge data-testid="badge-verify-status">Signed</Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Employee Name</p>
                    <p className="font-medium" data-testid="text-verify-name">{result.employeeName}</p>
                  </div>
                  {result.policyTitle && (
                    <div>
                      <p className="text-muted-foreground">Policy</p>
                      <p className="font-medium">{result.policyTitle}</p>
                    </div>
                  )}
                  {result.policyVersion != null && (
                    <div>
                      <p className="text-muted-foreground">Version</p>
                      <p className="font-medium">v{result.policyVersion}</p>
                    </div>
                  )}
                  {result.signedAt && (
                    <div>
                      <p className="text-muted-foreground">Signed On</p>
                      <p className="font-medium">{formatDateTime(result.signedAt)}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-muted-foreground">Reference</p>
                    <p className="font-mono text-xs">{result.referenceNumber}</p>
                  </div>
                </div>
              ) : isContract(result) ? (
                /* ── Contract result ─────────────────────────────────────────── */
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold text-slate-700">Staffing Services Agreement</span>
                    <Badge variant={result.status === "cancelled" ? "destructive" : "default"} data-testid="badge-verify-status">
                      {result.status?.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                    <div>
                      <p className="text-muted-foreground">Client</p>
                      <p className="font-medium" data-testid="text-verify-name">{result.clientName}</p>
                    </div>
                    {result.templateName && (
                      <div>
                        <p className="text-muted-foreground">Template</p>
                        <p className="font-medium">{result.templateName}</p>
                      </div>
                    )}
                    {result.agreementDate && (
                      <div>
                        <p className="text-muted-foreground">Agreement Date</p>
                        <p className="font-medium">{result.agreementDate}</p>
                      </div>
                    )}
                    {result.contractStartDate && (
                      <div>
                        <p className="text-muted-foreground">Effective Date</p>
                        <p className="font-medium">{formatDate(result.contractStartDate)}</p>
                      </div>
                    )}
                    {result.billingFrequency && (
                      <div>
                        <p className="text-muted-foreground">Billing Frequency</p>
                        <p className="font-medium capitalize">{result.billingFrequency.replace(/_/g, " ")}</p>
                      </div>
                    )}
                    {result.paymentTermsDays && (
                      <div>
                        <p className="text-muted-foreground">Payment Terms</p>
                        <p className="font-medium">Net {result.paymentTermsDays} days</p>
                      </div>
                    )}
                  </div>
                  {result.candidates && result.candidates.length > 0 && (
                    <div className="mt-3">
                      <p className="text-muted-foreground text-xs uppercase tracking-wide mb-2">Candidates</p>
                      <div className="border rounded-md overflow-hidden">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="text-left px-3 py-2 font-medium">Name</th>
                              <th className="text-left px-3 py-2 font-medium">Role</th>
                              <th className="text-left px-3 py-2 font-medium">Location</th>
                              <th className="text-left px-3 py-2 font-medium">Type</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {result.candidates.map((c, i) => (
                              <tr key={i}>
                                <td className="px-3 py-2 font-medium">{c.name}</td>
                                <td className="px-3 py-2 text-muted-foreground">{c.role || "—"}</td>
                                <td className="px-3 py-2 text-muted-foreground">{c.location || "—"}</td>
                                <td className="px-3 py-2 text-muted-foreground">{c.engagementType || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* ── HR letter result ────────────────────────────────────────── */
                <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Document Type</p>
                    <p className="font-medium">{TEMPLATE_LABELS[(result as HrLetterVerifyResult).templateType] || (result as HrLetterVerifyResult).templateType}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <Badge variant={result.status === "revoked" ? "destructive" : "default"} data-testid="badge-verify-status">
                      {result.status === "revoked" ? "Revoked" : "Issued"}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Employee Name</p>
                    <p className="font-medium" data-testid="text-verify-name">{(result as HrLetterVerifyResult).employeeName}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Designation</p>
                    <p className="font-medium">{(result as HrLetterVerifyResult).designation}</p>
                  </div>
                  {(result as HrLetterVerifyResult).department && (
                    <div>
                      <p className="text-muted-foreground">Department</p>
                      <p className="font-medium">{(result as HrLetterVerifyResult).department}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-muted-foreground">Tenure</p>
                    <p className="font-medium">{formatDate((result as HrLetterVerifyResult).startDate)} — {formatDate((result as HrLetterVerifyResult).endDate)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Issue Date</p>
                    <p className="font-medium">{formatDate((result as HrLetterVerifyResult).issueDate)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Reference</p>
                    <p className="font-mono text-xs">{(result as HrLetterVerifyResult).referenceNumber}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {notFound && (
          <Card className="mt-6 border-red-200 dark:border-red-800">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <XCircle className="h-6 w-6 text-red-600" />
                <span className="font-semibold text-red-700 dark:text-red-400" data-testid="text-verify-not-found">Document not found or auth code does not match</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">Please check the reference number and auth code and try again.</p>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground mt-8">
          Rayomind Solutions LLP — Document Verification Portal
        </p>
      </div>
    </div>
  );
}
