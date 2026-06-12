import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { FileText, Building, MapPin, Calendar, DollarSign, User, Briefcase } from "lucide-react";
import { numberToWords } from "@/lib/numberToWords";

export interface OfferLetterViewProps {
  candidateTitle: string;
  candidateName: string;
  candidateAddress?: string | null;
  designation: string;
  subjectDesignation?: string | null;
  departmentName?: string | null;
  managerName?: string | null;
  location: string;
  proposedStartDate?: string | null;
  employmentType: string;
  salary?: string | null;
  hrManagerName?: string | null;
  offerDate: string;
  jurisdiction?: string | null;
  refId?: string | null;
  probationSalary?: string | null;
  probationSalaryInWords?: string | null;
  postProbationSalary?: string | null;
  postProbationSalaryInWords?: string | null;
  probationPeriodMonths?: number | null;
  extendedProbationMonths?: number | null;
  performanceProbationReview?: boolean | null;
  maxRevisionSalary?: string | null;
  maxRevisionSalaryInWords?: string | null;
  performanceClauseText?: string | null;
}

export function OfferLetterBody({ offer }: { offer: OfferLetterViewProps }) {
  const hasPerformanceReview = !!(offer.performanceProbationReview && offer.performanceClauseText);
  const hasSplitSalary = !hasPerformanceReview && !!(offer.probationSalary && offer.postProbationSalary);
  const probMonths = offer.probationPeriodMonths ?? 3;
  const probMonthLabel = probMonths === 1 ? "1 month" : `${probMonths} months`;

  return (
    <Card>
      <CardHeader className="bg-blue-50 border-b">
        <CardTitle className="flex items-center gap-2 text-blue-900">
          <FileText className="h-5 w-5" />
          Offer of Employment
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Date: {offer.offerDate}
          {offer.refId ? <> &bull; Ref: OL-{offer.refId.substring(0, 8).toUpperCase()}</> : <> &bull; <span className="italic">Draft — Ref assigned on send</span></>}
        </p>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        <div>
          <p className="text-lg font-semibold" data-testid="text-candidate-name">
            {offer.candidateTitle} {offer.candidateName}
          </p>
          {offer.candidateAddress && (
            <p className="text-muted-foreground">{offer.candidateAddress}</p>
          )}
        </div>

        <div>
          <p className="font-medium mb-1">
            Subject: Offer of Employment — {offer.subjectDesignation || offer.designation}
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Dear {offer.candidateTitle} {offer.candidateName},
          </p>
          <p className="text-muted-foreground leading-relaxed mt-2">
            We are pleased to offer you employment with <strong>Rayomind Solutions</strong> on the
            following terms and conditions. This offer is contingent upon verification of your
            credentials and completion of all onboarding requirements.
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

          {hasPerformanceReview ? (
            <div className="flex items-start gap-3 md:col-span-2">
              <DollarSign className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
              <div className="space-y-3 w-full">
                <p className="text-sm text-muted-foreground">Compensation Structure</p>
                <div className="rounded-lg border bg-amber-50 border-amber-200 p-3 space-y-1" data-testid="text-performance-clause">
                  {offer.performanceClauseText!.split(/\r?\n/).map((line, idx) =>
                    line.trim() === "" ? (
                      <div key={idx} className="h-2" />
                    ) : (
                      <p key={idx} className="text-sm text-foreground leading-relaxed">{line}</p>
                    )
                  )}
                </div>
              </div>
            </div>
          ) : hasSplitSalary ? (
            <div className="flex items-start gap-3 md:col-span-2">
              <DollarSign className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
              <div className="space-y-3 w-full">
                <p className="text-sm text-muted-foreground">Compensation Structure</p>
                <div className="rounded-lg border bg-amber-50 border-amber-200 p-3 space-y-2">
                  <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider">During Probation ({probMonthLabel})</p>
                  <p className="font-medium" data-testid="text-probation-salary">
                    ₹{parseFloat(offer.probationSalary!).toLocaleString("en-IN")} / month
                    {offer.probationSalaryInWords && (
                      <span className="text-muted-foreground text-sm"> ({offer.probationSalaryInWords})</span>
                    )}
                  </p>
                </div>
                <div className="rounded-lg border bg-green-50 border-green-200 p-3 space-y-2">
                  <p className="text-xs font-semibold text-green-800 uppercase tracking-wider">Post-Probation (after {probMonthLabel} review)</p>
                  <p className="font-medium" data-testid="text-post-probation-salary">
                    ₹{parseFloat(offer.postProbationSalary!).toLocaleString("en-IN")} / month
                    {offer.postProbationSalaryInWords && (
                      <span className="text-muted-foreground text-sm"> ({offer.postProbationSalaryInWords})</span>
                    )}
                  </p>
                </div>
                {offer.extendedProbationMonths && (
                  <p className="text-xs text-muted-foreground italic">
                    If additional evaluation is needed, the probation period may be extended up to {offer.extendedProbationMonths} month{offer.extendedProbationMonths !== 1 ? "s" : ""}, with compensation revision reviewed again at that time.
                  </p>
                )}
              </div>
            </div>
          ) : offer.salary ? (
            <div className="flex items-start gap-3 md:col-span-2">
              <DollarSign className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Compensation (Annual CTC)</p>
                <p className="font-medium">
                  ₹{(parseFloat(offer.salary) * 12).toLocaleString("en-IN")}
                  <span className="text-muted-foreground">
                    {" "}({numberToWords(parseFloat(offer.salary) * 12)})
                  </span>
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <Separator />

        <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
          <div>
            <h3 className="font-semibold text-foreground mb-1">1. Probation Period</h3>
            <p>
              Your employment will be subject to a probationary period of six (6) months from the
              date of joining, during which either party may terminate the employment with one (1)
              week's written notice.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-1">2. Working Hours</h3>
            <p>
              Standard working hours shall be 8 hours per day, 5 days a week (Monday to Friday).
              Shift timing: 8:00 PM to 4:00 AM IST. Overtime as per company policy.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-1">3. Confidentiality</h3>
            <p>
              You shall maintain strict confidentiality of all proprietary information, trade
              secrets, client data, and any other confidential material you encounter during the
              course of your employment.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-1">4. Non-Compete</h3>
            <p>
              During employment and for a period of twelve (12) months after termination, you shall
              not engage in any business that directly competes with the company.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-1">5. Termination</h3>
            <p>
              After the probation period, either party may terminate employment with thirty (30)
              days' written notice or payment in lieu thereof.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-1">6. Governing Law</h3>
            <p>
              This offer shall be governed by the laws of India, with jurisdiction in{" "}
              {offer.jurisdiction || "Delhi"} courts.
            </p>
          </div>
        </div>

        <Separator />

        <div className="text-sm text-muted-foreground">
          <p className="font-semibold text-foreground mb-2">
            Annexure-R: Bring Your Own Device (BYOD) Policy
          </p>
          <p>
            Employees may use personal devices for work purposes subject to company security
            policies. The company reserves the right to install security software and conduct audits
            on work-related data stored on personal devices.
          </p>
        </div>

        {offer.hrManagerName && (
          <div className="pt-4 flex flex-col gap-1">
            <p className="text-sm text-muted-foreground italic">Digitally signed by:</p>
            <p
              className="text-2xl text-blue-900"
              style={{ fontFamily: "'Dancing Script', cursive" }}
            >
              {offer.hrManagerName}
            </p>
            <div className="mt-1">
              <p className="font-semibold">{offer.hrManagerName}</p>
              <p className="text-sm text-muted-foreground">HR Manager</p>
              <p className="text-sm text-muted-foreground">
                For and on behalf of Rayomind Solutions
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
