import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle, XCircle, FileText, ArrowRight } from "lucide-react";

interface AddendumData {
  id: string;
  status: string;
  addendumType: string;
  candidateName: string;
  effectiveDate: string | null;
  reason: string | null;
  hrManagerName: string | null;
  oldDesignation: string | null;
  newDesignation: string | null;
  oldDepartment: string | null;
  newDepartment: string | null;
  oldSalary: string | null;
  newSalary: string | null;
  oldSalaryInWords: string | null;
  newSalaryInWords: string | null;
  oldConfirmationDate: string | null;
  newConfirmationDate: string | null;
  customClauseTitle: string | null;
  customClauseText: string | null;
  acceptedName: string | null;
  authCode: string | null;
  originalOfferDate: string | null;
  originalDesignation: string | null;
  offerDate: string | null;
  deviceItems: Array<{ description: string; serialNumber: string | null; assetTag: string | null; condition: string | null }> | null;
}

const ADDENDUM_TYPE_LABELS: Record<string, string> = {
  salary_revision: "Salary Revision",
  role_change: "Role / Title Change",
  probation_extension: "Probation Extension",
  combined: "Combined Role & Salary Change",
  custom: "Custom Amendment",
  device_allocation: "Company Device & Asset Allocation",
};

function ChangedTermsDisplay({ addendum }: { addendum: AddendumData }) {
  const rows: Array<{ label: string; oldVal: string; newVal: string }> = [];

  if (addendum.addendumType === "salary_revision" || addendum.addendumType === "combined") {
    if (addendum.oldSalary || addendum.newSalary) {
      rows.push({
        label: "Annual CTC",
        oldVal: addendum.oldSalary ? `${addendum.oldSalary}${addendum.oldSalaryInWords ? ` (${addendum.oldSalaryInWords})` : ""}` : "—",
        newVal: addendum.newSalary ? `${addendum.newSalary}${addendum.newSalaryInWords ? ` (${addendum.newSalaryInWords})` : ""}` : "—",
      });
    }
  }

  if (addendum.addendumType === "role_change" || addendum.addendumType === "combined") {
    if (addendum.oldDesignation || addendum.newDesignation) {
      rows.push({
        label: "Designation / Title",
        oldVal: addendum.oldDesignation || "—",
        newVal: addendum.newDesignation || "—",
      });
    }
    if (addendum.oldDepartment || addendum.newDepartment) {
      rows.push({
        label: "Department",
        oldVal: addendum.oldDepartment || "—",
        newVal: addendum.newDepartment || "—",
      });
    }
  }

  if (addendum.addendumType === "probation_extension") {
    if (addendum.oldConfirmationDate || addendum.newConfirmationDate) {
      rows.push({
        label: "Confirmation Date",
        oldVal: addendum.oldConfirmationDate || "—",
        newVal: addendum.newConfirmationDate || "—",
      });
    }
  }

  if (addendum.addendumType === "device_allocation") {
    const items = addendum.deviceItems ?? [];
    return (
      <div className="space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-blue-50">
                <th className="text-left p-3 font-semibold text-blue-900 border border-blue-100 w-10">S.No</th>
                <th className="text-left p-3 font-semibold text-blue-900 border border-blue-100">Description / Item</th>
                <th className="text-left p-3 font-semibold text-blue-900 border border-blue-100">Asset Tag / Serial #</th>
                <th className="text-left p-3 font-semibold text-blue-900 border border-blue-100">Condition</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-muted-foreground border border-gray-200">
                    No devices listed
                  </td>
                </tr>
              ) : (
                items.map((item, i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="p-3 border border-gray-200 text-center text-muted-foreground">{i + 1}</td>
                    <td className="p-3 border border-gray-200 font-medium">{item.description}</td>
                    <td className="p-3 border border-gray-200 text-gray-600 font-mono text-xs">
                      {item.assetTag || item.serialNumber || "—"}
                    </td>
                    <td className="p-3 border border-gray-200 text-gray-600">{item.condition || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-md p-4 text-sm">
          <p className="font-semibold text-amber-900 mb-2">Conditions of Use</p>
          <ul className="list-disc list-inside space-y-1 text-amber-800 text-xs leading-relaxed">
            <li>Devices are provided strictly for work-related purposes only.</li>
            <li>You are responsible for the safe custody and proper care of all allocated devices.</li>
            <li>Any loss, theft, or damage must be reported to the IT/HR department immediately.</li>
            <li>All devices must be returned in good working condition upon separation from the company.</li>
          </ul>
        </div>
      </div>
    );
  }

  if (addendum.addendumType === "custom") {
    return (
      <div className="space-y-3">
        {addendum.customClauseTitle && (
          <h4 className="font-semibold text-blue-900">{addendum.customClauseTitle}</h4>
        )}
        {addendum.customClauseText && (
          <p className="text-sm text-gray-700 leading-relaxed">{addendum.customClauseText}</p>
        )}
      </div>
    );
  }

  if (rows.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-blue-50">
            <th className="text-left p-3 font-semibold text-blue-900 border border-blue-100">Field</th>
            <th className="text-left p-3 font-semibold text-blue-900 border border-blue-100">Previous Value</th>
            <th className="text-left p-3 font-semibold text-blue-900 border border-blue-100">New Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
              <td className="p-3 font-medium border border-gray-200">{row.label}</td>
              <td className="p-3 border border-gray-200 text-gray-600">{row.oldVal}</td>
              <td className="p-3 border border-gray-200 font-semibold text-green-700">{row.newVal}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AddendumAccept() {
  const [, params] = useRoute("/addendum/:token");
  const token = params?.token;

  const [loading, setLoading] = useState(true);
  const [addendum, setAddendum] = useState<AddendumData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [typedName, setTypedName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [authCode, setAuthCode] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/addendum/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Failed to load addendum");
          return;
        }
        const data = await res.json();
        if (data.status === "accepted" || data.status === "countersigned") {
          setAccepted(true);
          if (data.authCode) setAuthCode(data.authCode);
        }
        setAddendum(data);
      })
      .catch(() => setError("Failed to load addendum"))
      .finally(() => setLoading(false));
  }, [token]);

  const isNameMatch = typedName.trim().toLowerCase() === addendum?.candidateName.trim().toLowerCase();

  const handleAccept = async () => {
    if (!isNameMatch) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/addendum/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acceptedName: typedName.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to accept");
      }
      const data = await res.json();
      setAuthCode(data.authCode);
      setAccepted(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error && !addendum) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center">
            <XCircle className="h-16 w-16 mx-auto text-red-500 mb-4" />
            <h2 className="text-xl font-bold mb-2" data-testid="text-addendum-error">{error}</h2>
            <p className="text-muted-foreground">Please check the link or contact HR for assistance.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-lg border-green-100">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <CheckCircle className="h-16 w-16 mx-auto text-green-600 mb-2" />
            <h2 className="text-2xl font-bold text-green-900" data-testid="text-addendum-accepted">Addendum Signed!</h2>
            <p className="text-muted-foreground">
              Thank you, <strong>{addendum?.candidateName}</strong>. Your digital signature on the{" "}
              <strong>{ADDENDUM_TYPE_LABELS[addendum?.addendumType || ""] || "Addendum"}</strong> has been recorded.
            </p>

            {authCode && (
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                <p className="text-xs font-semibold text-blue-800 uppercase tracking-wider mb-1">Verification Code</p>
                <code className="text-lg font-mono font-bold text-blue-900 block tracking-widest" data-testid="text-addendum-auth-code">
                  {authCode}
                </code>
                <p className="text-[10px] text-blue-600 mt-2">
                  Keep this code for your records. It cryptographically proves your acceptance of this amendment.
                </p>
              </div>
            )}

            <p className="text-sm text-muted-foreground pt-2">
              Our HR team will be in touch shortly to confirm the updated terms.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!addendum) return null;

  const typeLabel = ADDENDUM_TYPE_LABELS[addendum.addendumType] || "Amendment";

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="bg-gradient-to-r from-blue-800 to-blue-600 text-white py-6 px-4 text-center shadow-lg">
        <h1 className="text-2xl font-bold" data-testid="text-addendum-company">Rayomind Solutions</h1>
        <p className="text-blue-200 text-sm mt-1">AI-Powered Recruitment</p>
      </div>

      <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-6">
        {/* Header */}
        <Card className="border-blue-100">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <FileText className="h-5 w-5 text-blue-700" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-blue-900" data-testid="text-addendum-type">{typeLabel}</h2>
                <p className="text-sm text-muted-foreground">Offer Letter Addendum</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wide">Candidate</p>
                <p className="font-medium" data-testid="text-addendum-candidate">{addendum.candidateName}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wide">Original Offer Date</p>
                <p className="font-medium">{addendum.originalOfferDate || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wide">Original Role</p>
                <p className="font-medium">{addendum.originalDesignation || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wide">Effective Date</p>
                <p className="font-medium text-blue-700" data-testid="text-addendum-effective-date">{addendum.effectiveDate || "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Changed Terms */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-blue-600" />
              Amended Terms
            </h3>
            <ChangedTermsDisplay addendum={addendum} />

            {addendum.reason && (
              <div className="mt-4 p-3 bg-gray-50 rounded-md">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Reason / Remarks</p>
                <p className="text-sm">{addendum.reason}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Legal Note */}
        <div className="text-xs text-muted-foreground bg-amber-50 border border-amber-100 rounded-md p-4">
          <strong>Please note:</strong> All other terms and conditions of your original Offer Letter remain in full force and effect. This Addendum constitutes a binding amendment upon your digital signature.
        </div>

        {/* Sign */}
        {addendum.status === "sent" && (
          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-4">Sign This Addendum</h3>
              <div className="space-y-4">
                {error && (
                  <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">{error}</div>
                )}

                <div>
                  <Label htmlFor="typed-name">Type your full name to confirm acceptance</Label>
                  <Input
                    id="typed-name"
                    data-testid="input-addendum-name"
                    placeholder={addendum.candidateName}
                    value={typedName}
                    onChange={(e) => setTypedName(e.target.value)}
                    className={`mt-1 ${typedName && !isNameMatch ? "border-red-500 bg-red-50" : ""}`}
                  />
                  {typedName && !isNameMatch && (
                    <p className="text-xs text-red-600 mt-1">Name must match exactly: "{addendum.candidateName}"</p>
                  )}
                </div>

                {typedName.length > 1 && (
                  <div className="p-6 bg-white border border-dashed border-blue-200 rounded-lg text-center space-y-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">Signature Preview</p>
                    <p className="text-4xl text-blue-900" style={{ fontFamily: "'Dancing Script', cursive" }}>
                      {typedName}
                    </p>
                  </div>
                )}

                <Button
                  onClick={handleAccept}
                  disabled={!isNameMatch || submitting}
                  className="w-full bg-blue-700 hover:bg-blue-800"
                  size="lg"
                  data-testid="button-accept-addendum"
                >
                  {submitting ? (
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  ) : (
                    <CheckCircle className="h-5 w-5 mr-2" />
                  )}
                  Confirm Digital Signature & Accept Addendum
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  Your acceptance will be recorded with your IP address for audit purposes.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="bg-gray-100 py-6 px-4 text-center border-t mt-8">
        <p className="text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} Rayomind Solutions. All rights reserved.
        </p>
      </div>
    </div>
  );
}
