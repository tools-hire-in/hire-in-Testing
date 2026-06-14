import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
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
  policyAnnexures?: string[] | null;
}

const POLICY_ANNEXURE_LABELS: Record<string, string> = {
  leave_policy: "Annexure A — Leave Policy",
  attendance_policy: "Annexure B — Attendance & Regularization Policy",
  code_of_conduct: "Annexure C — Code of Conduct",
  nda: "Annexure D — Confidentiality & Non-Disclosure Agreement",
};

export function OfferLetterBody({ offer }: { offer: OfferLetterViewProps }) {
  const hasPerformanceReview = !!(offer.performanceProbationReview && offer.performanceClauseText);
  const hasSplitSalary = !hasPerformanceReview && !!(offer.probationSalary && offer.postProbationSalary);
  const probMonths = offer.probationPeriodMonths ?? 3;
  const probMonthLabel = probMonths === 1 ? "1 month" : `${probMonths} months`;
  const hasPolicyAnnexures = Array.isArray(offer.policyAnnexures) && offer.policyAnnexures.length > 0;

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
              <div className="space-y-2 w-full">
                <p className="text-sm text-muted-foreground">Compensation Structure</p>
                <div className="border-l-2 border-border pl-4 space-y-1" data-testid="text-performance-clause">
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
              <div className="space-y-2 w-full">
                <p className="text-sm text-muted-foreground">Compensation Structure</p>
                <div className="border rounded-md divide-y overflow-hidden">
                  <div className="px-4 py-3 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">During Probation ({probMonthLabel})</p>
                      <p className="font-semibold text-base" data-testid="text-probation-salary">
                        ₹{parseFloat(offer.probationSalary!).toLocaleString("en-IN")} / month
                      </p>
                      {offer.probationSalaryInWords && (
                        <p className="text-xs text-muted-foreground mt-0.5">{offer.probationSalaryInWords}</p>
                      )}
                    </div>
                  </div>
                  <div className="px-4 py-3 flex items-center justify-between gap-4 bg-muted/20">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Post-Probation (after {probMonthLabel} review)</p>
                      <p className="font-semibold text-base" data-testid="text-post-probation-salary">
                        ₹{parseFloat(offer.postProbationSalary!).toLocaleString("en-IN")} / month
                      </p>
                      {offer.postProbationSalaryInWords && (
                        <p className="text-xs text-muted-foreground mt-0.5">{offer.postProbationSalaryInWords}</p>
                      )}
                    </div>
                  </div>
                </div>
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
            <h3 className="font-semibold text-foreground mb-2">1. Probationary Period and Performance Review</h3>
            <p className="mb-2">
              Your employment will commence with an initial probation period of three (3) months from your date of
              joining. During this probation period, either party may terminate the employment by providing one (1)
              week's written notice.
            </p>
            <p className="mb-2">
              Upon completion of the initial probation period, the Company will conduct a performance and delivery
              review. Subject to your performance, achievement of assigned goals, quality of delivery, consistency,
              professional conduct, and overall contribution, your compensation may be reconsidered.
            </p>
            <p className="mb-2">
              Employees who significantly exceed the expected goals and demonstrate strong ownership, consistent
              delivery, and measurable business impact may be considered for a salary revision up to the
              post-probation amount stated above. Any salary revision shall not be automatic and will be at the
              sole discretion of the Company, subject to management review, business requirements, and confirmed
              separately in writing. Mention of a review amount does not constitute a guarantee or automatic
              entitlement to a salary increase.
            </p>
            <p>
              The Company may extend the probation period up to six (6) months if required, based on
              performance, delivery, conduct, or business needs.
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

        {hasPolicyAnnexures && (
          <>
            <Separator />
            <div>
              <p className="font-semibold text-foreground mb-3 text-sm">Attached Policy Annexures</p>
              <div className="flex flex-wrap gap-2" data-testid="policy-annexures-list">
                {offer.policyAnnexures!.map((key) => (
                  <Badge
                    key={key}
                    variant="outline"
                    className="text-xs font-normal border-blue-200 text-blue-800 bg-blue-50"
                    data-testid={`badge-policy-annexure-${key}`}
                  >
                    {POLICY_ANNEXURE_LABELS[key] ?? key}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                These policy documents are attached to this offer letter and form part of your terms of employment.
              </p>
            </div>
          </>
        )}

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
