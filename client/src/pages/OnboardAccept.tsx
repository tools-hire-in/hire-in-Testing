import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Loader2, CheckCircle, XCircle, Clock, FileText, Building, MapPin, Calendar, DollarSign, User, Briefcase } from "lucide-react";

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
}

export default function OnboardAccept() {
  const [, params] = useRoute("/onboard/:token");
  const token = params?.token;

  const [loading, setLoading] = useState(true);
  const [offer, setOffer] = useState<OfferData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  const [agreed, setAgreed] = useState(false);
  const [typedName, setTypedName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);

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
        if (data.status === "accepted" || data.status === "onboarded") {
          setAccepted(true);
        }
        setOffer(data);
      })
      .catch(() => setError("Failed to load offer letter"))
      .finally(() => setLoading(false));
  }, [token]);

  const handleAccept = async () => {
    if (!agreed || typedName.trim().length < 2) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/onboard/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acceptedName: typedName.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to accept");
      }
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
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center">
            <CheckCircle className="h-16 w-16 mx-auto text-green-600 mb-4" />
            <h2 className="text-xl font-bold mb-2" data-testid="text-offer-accepted">Offer Accepted!</h2>
            <p className="text-muted-foreground">
              Your offer has been accepted. Our HR team will contact you with onboarding details and your @hire-in.com email account.
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
        <h1 className="text-2xl font-bold" data-testid="text-company-name">Hire'in Solutions</h1>
        <p className="text-blue-200 text-sm mt-1">Rayomind Solutions DBA — AI-Powered Recruitment</p>
      </div>

      <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
        <Card>
          <CardHeader className="bg-blue-50 border-b">
            <CardTitle className="flex items-center gap-2 text-blue-900">
              <FileText className="h-5 w-5" />
              Offer of Employment
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Date: {offer.offerDate} &bull; Ref: Hire'in Solutions / HR / Offer / {new Date().getFullYear()}
            </p>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div>
              <p className="text-lg font-semibold" data-testid="text-candidate-name">{offer.candidateTitle} {offer.candidateName}</p>
              {offer.candidateAddress && <p className="text-muted-foreground">{offer.candidateAddress}</p>}
            </div>

            <div>
              <p className="font-medium mb-1">Subject: Offer of Employment — {offer.subjectDesignation || offer.designation}</p>
              <p className="text-muted-foreground leading-relaxed">
                Dear {offer.candidateTitle} {offer.candidateName},
              </p>
              <p className="text-muted-foreground leading-relaxed mt-2">
                We are pleased to offer you employment with <strong>Rayomind Solutions (DBA Hire'in Solutions)</strong> on the following terms and conditions. This offer is contingent upon verification of your credentials and completion of all onboarding requirements.
              </p>
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <Briefcase className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Designation</p>
                  <p className="font-medium" data-testid="text-designation">{offer.designation}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Building className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Department</p>
                  <p className="font-medium">{offer.departmentName || "To be assigned"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Reporting To</p>
                  <p className="font-medium">{offer.managerName || "To be assigned"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Work Location</p>
                  <p className="font-medium">{offer.location}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Proposed Start Date</p>
                  <p className="font-medium">{offer.proposedStartDate || "To be confirmed"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Briefcase className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Employment Type</p>
                  <p className="font-medium">{offer.employmentType}</p>
                </div>
              </div>
              {offer.salary && (
                <div className="flex items-start gap-3 md:col-span-2">
                  <DollarSign className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Compensation (Monthly CTC)</p>
                    <p className="font-medium">
                      ₹{parseFloat(offer.salary).toLocaleString("en-IN")}
                      {offer.salaryInWords && <span className="text-muted-foreground"> ({offer.salaryInWords})</span>}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
              <div>
                <h3 className="font-semibold text-foreground mb-1">1. Probation Period</h3>
                <p>Your employment will be subject to a probationary period of six (6) months from the date of joining, during which either party may terminate the employment with one (1) week's written notice.</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">2. Working Hours</h3>
                <p>Standard working hours shall be 8 hours per day, 5 days a week (Monday to Friday). Shift timing: 8:00 PM to 4:00 AM IST. Overtime as per company policy.</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">3. Confidentiality</h3>
                <p>You shall maintain strict confidentiality of all proprietary information, trade secrets, client data, and any other confidential material you encounter during the course of your employment.</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">4. Non-Compete</h3>
                <p>During employment and for a period of twelve (12) months after termination, you shall not engage in any business that directly competes with the company.</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">5. Termination</h3>
                <p>After the probation period, either party may terminate employment with thirty (30) days' written notice or payment in lieu thereof.</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">6. Governing Law</h3>
                <p>This offer shall be governed by the laws of India, with jurisdiction in {offer.jurisdiction || "Delhi"} courts.</p>
              </div>
            </div>

            <Separator />

            <div className="text-sm text-muted-foreground">
              <p className="font-semibold text-foreground mb-2">Annexure-R: Bring Your Own Device (BYOD) Policy</p>
              <p>Employees may use personal devices for work purposes subject to company security policies. The company reserves the right to install security software and conduct audits on work-related data stored on personal devices.</p>
            </div>

            {offer.hrManagerName && (
              <div className="pt-4">
                <p className="text-sm text-muted-foreground">For and on behalf of Rayomind Solutions (DBA Hire'in Solutions),</p>
                <p className="font-semibold mt-2">{offer.hrManagerName}</p>
                <p className="text-sm text-muted-foreground">HR Manager</p>
              </div>
            )}
          </CardContent>
        </Card>

        {offer.status !== "accepted" && offer.status !== "onboarded" && offer.status !== "cancelled" && (
          <Card className="border-blue-200 bg-blue-50/50">
            <CardHeader>
              <CardTitle className="text-lg text-blue-900">Accept This Offer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">{error}</div>
              )}

              <div className="flex items-start gap-3">
                <Checkbox
                  id="agree"
                  checked={agreed}
                  onCheckedChange={(v) => setAgreed(!!v)}
                  data-testid="checkbox-agree"
                />
                <label htmlFor="agree" className="text-sm leading-relaxed cursor-pointer">
                  I have read and understood the terms and conditions of this offer letter, including all sections and the BYOD Annexure. I agree to accept this offer of employment.
                </label>
              </div>

              <div>
                <Label htmlFor="typed-name">Type your full name to confirm acceptance</Label>
                <Input
                  id="typed-name"
                  data-testid="input-accept-name"
                  placeholder={offer.candidateName}
                  value={typedName}
                  onChange={(e) => setTypedName(e.target.value)}
                  className="mt-1"
                />
              </div>

              <Button
                onClick={handleAccept}
                disabled={!agreed || typedName.trim().length < 2 || submitting}
                className="w-full bg-blue-700 hover:bg-blue-800"
                size="lg"
                data-testid="button-accept-offer"
              >
                {submitting ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : (
                  <CheckCircle className="h-5 w-5 mr-2" />
                )}
                Accept Offer
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                This offer expires on {new Date(offer.expiresAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}. Your acceptance will be recorded with your IP address and browser details for audit purposes.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="bg-gray-100 py-6 px-4 text-center border-t mt-8">
        <p className="text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} Hire'in Solutions (Rayomind Solutions DBA). All rights reserved.
        </p>
      </div>
    </div>
  );
}