import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Shield, CheckCircle, XCircle, Loader2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TEMPLATE_LABELS } from "@shared/hrLetterConstants";

const rayomindLogoPath = "/rayomind-logo.png";

interface VerifyResult {
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

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
}

export default function VerifyLetter() {
  const [refNumber, setRefNumber] = useState("");
  const [authCode, setAuthCode] = useState("");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [notFound, setNotFound] = useState(false);

  const verifyMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/verify-letter?ref=${encodeURIComponent(refNumber)}&auth=${encodeURIComponent(authCode)}`);
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
                <Label>Reference Number</Label>
                <Input
                  placeholder="e.g. RL/EXP/2026/0001"
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
              <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Document Type</p>
                  <p className="font-medium">{TEMPLATE_LABELS[result.templateType] || result.templateType}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge variant={result.status === "revoked" ? "destructive" : "default"} data-testid="badge-verify-status">
                    {result.status === "revoked" ? "Revoked" : "Issued"}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Employee Name</p>
                  <p className="font-medium" data-testid="text-verify-name">{result.employeeName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Designation</p>
                  <p className="font-medium">{result.designation}</p>
                </div>
                {result.department && (
                  <div>
                    <p className="text-muted-foreground">Department</p>
                    <p className="font-medium">{result.department}</p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground">Tenure</p>
                  <p className="font-medium">{formatDate(result.startDate)} — {formatDate(result.endDate)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Issue Date</p>
                  <p className="font-medium">{formatDate(result.issueDate)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Reference</p>
                  <p className="font-mono text-xs">{result.referenceNumber}</p>
                </div>
              </div>
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
