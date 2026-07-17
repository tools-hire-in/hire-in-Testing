import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useSEO } from "@/hooks/use-seo";
import { Shield, CheckCircle, XCircle, Loader2, AlertTriangle, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TEMPLATE_LABELS } from "@shared/hrLetterConstants";
import {
  inferDocType, refMatchesDocType, AUTH_CODE_EXAMPLE,
  type AllowedDocType,
} from "@shared/verifySchema";

const rayomindLogoPath = "/rayomind-logo.png";

const DOC_TYPE_LABELS: Record<AllowedDocType, string> = {
  hr_letter: "HR Letter (Experience, Internship, Relieving)",
  contract: "Staffing Services Agreement (Contract)",
  offer_letter: "Offer Letter",
  addendum: "Amendment / Addendum Letter",
};

const REF_PLACEHOLDERS: Record<AllowedDocType, string> = {
  hr_letter: "e.g. RL/EXP/2026/0001",
  contract: "e.g. CTR/2026/ABCD1234",
  offer_letter: "e.g. OL/2026/0042",
  addendum: "e.g. AM/SAL/2026/0007",
};

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

type VerifyResult =
  | HrLetterVerifyResult
  | ContractVerifyResult
  | OfferLetterVerifyResult
  | AddendumVerifyResult;

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


export default function VerifyLetter() {
  useSEO({
    title: "Verify Document | Hire'in Solutions",
    description:
      "Verify the authenticity of an HR letter or document issued by Hire'in Solutions using its reference number and authentication code.",
    canonical: "https://hire-in.com/verify",
    noindex: true,
  });
  const [refNumber, setRefNumber] = useState("");
  const [authCode, setAuthCode] = useState("");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [refError, setRefError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const inferredDocType: AllowedDocType | null = inferDocType(refNumber);

  const AUTH_CODE_RE = /^[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}$/;

  function validateRef(value: string): string | null {
    if (!value.trim()) return null;
    const upper = value.trim().toUpperCase();
    const docType = inferDocType(upper);
    if (!docType) {
      return "Unrecognised prefix. Start with RL/, CTR/, OL/, or AM/";
    }
    if (!refMatchesDocType(upper, docType)) {
      const examples: Record<AllowedDocType, string> = {
        hr_letter: "RL/EXP/2026/0001",
        contract: "CTR/2026/ABCD1234",
        offer_letter: "OL/2026/0042",
        addendum: "AM/SAL/2026/0007",
      };
      return `Invalid format for ${docType}. Example: ${examples[docType]}`;
    }
    return null;
  }

  function validateAuth(value: string): string | null {
    if (!value.trim()) return null;
    if (!AUTH_CODE_RE.test(value.trim())) {
      return `Must be XXXX-XXXX (8 hex digits, e.g. ${AUTH_CODE_EXAMPLE})`;
    }
    return null;
  }

  function handleRefChange(value: string) {
    setRefNumber(value);
    setRefError(validateRef(value));
  }

  function handleAuthChange(value: string) {
    setAuthCode(value);
    setAuthError(validateAuth(value));
  }

  const verifyMutation = useMutation({
    mutationFn: async () => {
      const docType = inferredDocType;
      if (!docType) throw new Error("Cannot determine document type from reference number.");
      const params = new URLSearchParams({
        ref: refNumber.trim().toUpperCase(),
        auth: authCode.trim().toUpperCase(),
        documentType: docType,
      });
      const res = await fetch(`/api/verify-letter?${params.toString()}`);
      if (res.status === 404) {
        setNotFound(true);
        setResult(null);
        return null;
      }
      if (res.status === 400) {
        setNotFound(true);
        setResult(null);
        return null;
      }
      if (res.status === 429) {
        throw new Error("Too many requests. Please wait a minute before trying again.");
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

    const rErr = validateRef(refNumber);
    const aErr = validateAuth(authCode);
    setRefError(rErr);
    setAuthError(aErr);
    if (rErr || aErr || !refNumber.trim() || !authCode.trim()) return;

    verifyMutation.mutate();
  }

  const placeholder = inferredDocType
    ? REF_PLACEHOLDERS[inferredDocType]
    : "e.g. RL/EXP/2026/0001, CTR/2026/..., OL/2026/..., or AM/SAL/2026/...";

  const detectedLabel = inferredDocType ? DOC_TYPE_LABELS[inferredDocType] : null;

  const canSubmit =
    !!refNumber.trim() &&
    !!authCode.trim() &&
    !refError &&
    !authError &&
    !verifyMutation.isPending;

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
                <Label>Reference Number</Label>
                {detectedLabel && (
                  <p className="text-xs text-muted-foreground mb-1">
                    Detected: <span className="font-medium text-foreground">{detectedLabel}</span>
                  </p>
                )}
                <Input
                  placeholder={placeholder}
                  value={refNumber}
                  onChange={e => handleRefChange(e.target.value)}
                  data-testid="input-verify-ref"
                  className={refError ? "border-red-400 focus-visible:ring-red-400" : ""}
                />
                {refError && (
                  <p className="text-xs text-red-500 mt-1" data-testid="text-ref-error">{refError}</p>
                )}
              </div>

              <div>
                <Label>Auth Code</Label>
                <Input
                  placeholder={`e.g. ${AUTH_CODE_EXAMPLE}`}
                  value={authCode}
                  onChange={e => handleAuthChange(e.target.value)}
                  data-testid="input-verify-auth"
                  className={authError ? "border-red-400 focus-visible:ring-red-400" : ""}
                />
                {authError && (
                  <p className="text-xs text-red-500 mt-1" data-testid="text-auth-error">{authError}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={!canSubmit} data-testid="btn-verify">
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
              ) : isContract(result) ? (
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
