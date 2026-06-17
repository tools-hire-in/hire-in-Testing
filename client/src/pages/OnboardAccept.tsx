import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle, XCircle, Clock } from "lucide-react";
import { OfferLetterBody } from "@/components/OfferLetterBody";
import { SignatureBlock } from "@/components/esign/SignatureBlock";
import { AnnexureInitialing } from "@/components/esign/AnnexureInitialing";

interface OfferData {
  id: string;
  status: string;
  candidateTitle: string;
  candidateName: string;
  candidateAddress: string;
  designation: string;
  subjectDesignation: string;
  departmentName: string | null;
  managerName: string | null;
  employmentType: string;
  proposedStartDate: string;
  salary: string;
  salaryInWords: string;
  location: string;
  jurisdiction: string;
  hrManagerName: string;
  offerDate: string;
  expiresAt: string;
  acceptedName?: string;
  probationSalary?: string | null;
  probationSalaryInWords?: string | null;
  postProbationSalary?: string | null;
  postProbationSalaryInWords?: string | null;
  probationPeriodMonths?: number | null;
  extendedProbationMonths?: number | null;
  performanceProbationReview?: boolean | null;
  performanceClauseText?: string | null;
  policyAnnexures?: string[] | null;
  annexureInitials?: Array<{ key: string; initials: string; initialedAt?: string }> | null;
  authCode?: string | null;
}

export default function OnboardAccept() {
  const [, params] = useRoute("/onboard/:token");
  const token = params?.token;

  const [loading, setLoading] = useState(true);
  const [offer, setOffer] = useState<OfferData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  const [signingDate, setSigningDate] = useState(new Date().toISOString().split("T")[0]);
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [authCode, setAuthCode] = useState<string | null>(null);
  const [annexureInitials, setAnnexureInitials] = useState<Record<string, string>>({});
  const [annexureInitialedAt, setAnnexureInitialedAt] = useState<Record<string, string>>({});

  const handleAnnexureInitialChange = (key: string, value: string) => {
    setAnnexureInitials((prev) => ({ ...prev, [key]: value }));
    setAnnexureInitialedAt((prev) => ({ ...prev, [key]: new Date().toISOString() }));
  };

  const policyAnnexureKeys = offer?.policyAnnexures ?? [];
  const allAnnexuresInitialed = policyAnnexureKeys.every(
    (k) => (annexureInitials[k] ?? "").trim().length > 0
  );

  useEffect(() => {
    if (!token) return;
    fetch(`/api/onboard/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Failed to load offer");
          setErrorStatus(data.status || null);
          return;
        }
        const data = await res.json();
        if (data.status === "accepted" || data.status === "onboarded" || data.status === "countersigned") {
          setAccepted(true);
          const code = data.authCode ?? null;
          if (code) setAuthCode(code);
        }
        // Pre-populate initials state from DB data so returning visitors see their initials
        if (Array.isArray(data.annexureInitials) && data.annexureInitials.length > 0) {
          const initRec: Record<string, string> = {};
          const atRec: Record<string, string> = {};
          for (const item of data.annexureInitials) {
            if (item?.key) {
              initRec[item.key] = item.initials ?? "";
              if (item.initialedAt) atRec[item.key] = item.initialedAt;
            }
          }
          setAnnexureInitials(initRec);
          setAnnexureInitialedAt(atRec);
        }
        setOffer(data);
      })
      .catch(() => setError("Failed to load offer letter"))
      .finally(() => setLoading(false));
  }, [token]);

  const handleAccept = async (acceptedName: string) => {
    if (!allAnnexuresInitialed) return;
    setSubmitting(true);
    try {
      const annexureInitialsPayload = policyAnnexureKeys.map((k) => ({
        key: k,
        initials: (annexureInitials[k] ?? "").trim(),
        initialedAt: annexureInitialedAt[k] ?? new Date().toISOString(),
      }));
      const res = await fetch(`/api/onboard/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acceptedName,
          acceptanceDate: signingDate,
          annexureInitials: annexureInitialsPayload,
        }),
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

  if (error && !offer) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center">
            {errorStatus === "expired" ? (
              <>
                <Clock className="h-16 w-16 mx-auto text-amber-500 mb-4" />
                <h2 className="text-xl font-bold mb-2" data-testid="text-offer-expired">Offer Expired</h2>
                <p className="text-muted-foreground">This offer letter has expired. Please contact HR for a new offer.</p>
              </>
            ) : (
              <>
                <XCircle className="h-16 w-16 mx-auto text-red-500 mb-4" />
                <h2 className="text-xl font-bold mb-2" data-testid="text-offer-error">{error}</h2>
                <p className="text-muted-foreground">Please check the link or contact HR for assistance.</p>
              </>
            )}
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
            <h2 className="text-2xl font-bold text-green-900" data-testid="text-offer-accepted">Offer Accepted!</h2>
            <p className="text-muted-foreground">
              Thank you, <strong>{offer?.candidateName}</strong>. Your digital signature has been recorded.
            </p>

            {offer?.acceptedName && (
              <div className="py-4 border-y border-green-50">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Digital Signature</p>
                <p className="text-3xl text-blue-900" style={{ fontFamily: "'Dancing Script', cursive" }}>
                  {offer.acceptedName}
                </p>
              </div>
            )}

            {authCode && (
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                <p className="text-xs font-semibold text-blue-800 uppercase tracking-wider mb-1">Verification Code</p>
                <code className="text-lg font-mono font-bold text-blue-900 block tracking-widest" data-testid="text-auth-code">
                  {authCode}
                </code>
                <p className="text-[10px] text-blue-600 mt-2">
                  Keep this code for your records. It cryptographically proves your acceptance of this document.
                </p>
              </div>
            )}

            <p className="text-sm text-muted-foreground pt-2">
              Our HR team will contact you with onboarding details and your @hire-in.com email account.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!offer) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="bg-gradient-to-r from-blue-800 to-blue-600 text-white py-6 px-4 text-center shadow-lg">
        <h1 className="text-2xl font-bold" data-testid="text-company-name">Rayomind Solutions</h1>
        <p className="text-blue-200 text-sm mt-1">AI-Powered Recruitment</p>
      </div>

      <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
        <OfferLetterBody
          offer={{
            candidateTitle: offer.candidateTitle,
            candidateName: offer.candidateName,
            candidateAddress: offer.candidateAddress,
            designation: offer.designation,
            subjectDesignation: offer.subjectDesignation,
            departmentName: offer.departmentName,
            managerName: offer.managerName,
            location: offer.location,
            proposedStartDate: offer.proposedStartDate,
            employmentType: offer.employmentType,
            salary: offer.salary,
            hrManagerName: offer.hrManagerName,
            offerDate: offer.offerDate,
            jurisdiction: offer.jurisdiction,
            refId: offer.id,
            probationSalary: offer.probationSalary,
            probationSalaryInWords: offer.probationSalaryInWords,
            postProbationSalary: offer.postProbationSalary,
            postProbationSalaryInWords: offer.postProbationSalaryInWords,
            probationPeriodMonths: offer.probationPeriodMonths,
            extendedProbationMonths: offer.extendedProbationMonths,
            performanceProbationReview: offer.performanceProbationReview,
            performanceClauseText: offer.performanceClauseText,
            policyAnnexures: offer.policyAnnexures,
            annexureInitials: annexureInitials,
            annexureInitialedAt: annexureInitialedAt,
          }}
        />

        {offer.status !== "accepted" && offer.status !== "onboarded" && offer.status !== "countersigned" && offer.status !== "cancelled" && (
          <Card className="border-blue-200 bg-blue-50/50">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-4">Accept This Offer</h3>
              <div className="space-y-6">
                {policyAnnexureKeys.length > 0 && (
                  <AnnexureInitialing
                    annexureKeys={policyAnnexureKeys}
                    initials={annexureInitials}
                    onInitialChange={handleAnnexureInitialChange}
                  />
                )}
                <SignatureBlock
                  consent={{
                    label:
                      "I have read and understood the terms and conditions of this offer letter, including all sections, the BYOD Annexure, and all attached policy annexures (if any). I agree to abide by the policies set out therein and accept this offer of employment.",
                  }}
                  nameConfirmation={{ expectedName: offer.candidateName }}
                  signingDate={{ value: signingDate, onChange: setSigningDate }}
                  showPreview
                  previewShowDate
                  extraGateMet={allAnnexuresInitialed}
                  extraGateMessage="Please review and initial each attached policy annexure above before accepting."
                  extraGateTestId="text-annexure-initials-required"
                  submitLabel="Confirm Digital Signature & Accept"
                  submitClassName="bg-blue-700 hover:bg-blue-800"
                  submitTestId="button-accept-offer"
                  error={error}
                  submitting={submitting}
                  onSubmit={({ acceptedName }) => handleAccept(acceptedName)}
                  notice={
                    <>
                      This offer expires on {new Date(offer.expiresAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}. Your acceptance will be recorded with your IP address and browser details for audit purposes.
                    </>
                  }
                />
              </div>
            </div>
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
