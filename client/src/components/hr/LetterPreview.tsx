import { Separator } from "@/components/ui/separator";
import {
  PERFORMANCE_BAND_SENTENCES as PERFORMANCE_SENTENCES,
  CONDUCT_BAND_SENTENCES as CONDUCT_SENTENCES,
  COMPLETION_BAND_SENTENCES as COMPLETION_PHRASES,
  CLOSING_LINE_SENTENCES as CLOSING_SENTENCES,
} from "@shared/hrLetterConstants";

const rayomindLogoPath = "/rayomind-logo.png";

const TEMPLATE_TITLES: Record<string, string> = {
  experience: "EXPERIENCE LETTER",
  internship_completion: "INTERNSHIP COMPLETION LETTER",
  internship_certificate: "INTERNSHIP CERTIFICATE",
  relieving: "RELIEVING LETTER",
};

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
}

function interpolate(sentence: string, data: { employeeName?: string; designation?: string; department?: string | null }): string {
  return sentence
    .replace(/\[Name\]/g, data.employeeName || "—")
    .replace(/\[Company\]/g, "Rayomind Solutions LLP")
    .replace(/\[Role\]/g, data.designation || "—")
    .replace(/\[Department\]/g, data.department || "the assigned");
}

interface LetterPreviewProps {
  letter: {
    templateType: string;
    employeeName: string;
    employeeCode?: string | null;
    designation: string;
    department?: string | null;
    employmentType?: string | null;
    location?: string | null;
    startDate: string;
    endDate?: string | null;
    lastWorkingDay?: string | null;
    performanceBand?: string | null;
    conductBand?: string | null;
    completionBand?: string | null;
    closingLine?: string | null;
    includeResponsibilities?: boolean | null;
    responsibilitiesSummary?: string | null;
    includeProject?: boolean | null;
    projectName?: string | null;
    includeSeal?: boolean | null;
    signatoryName?: string | null;
    signatoryDesignation?: string | null;
    issueDate?: string | null;
    referenceNumber?: string | null;
    authCode?: string | null;
    customOverrideText?: string | null;
    status?: string | null;
  };
}

export function LetterPreview({ letter }: LetterPreviewProps) {
  const title = TEMPLATE_TITLES[letter.templateType] || "HR LETTER";

  return (
    <div className="bg-white text-black rounded-lg border shadow-sm print:shadow-none" data-testid="letter-preview">
      <div className="border-b-4 border-orange-500 p-6 pb-4">
        <div className="flex items-center justify-between">
          <img src={rayomindLogoPath} alt="Rayomind" className="h-12" />
          <div className="text-right text-xs text-gray-500">
            <p className="font-semibold text-gray-700">Rayomind Solutions LLP</p>
            <p>Suite No-101, Pocket-6, Sector-2, Rohini</p>
            <p>New Delhi – 110085, India</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-4 text-sm leading-relaxed">
        <div className="flex justify-between text-xs text-gray-500">
          <span>{letter.referenceNumber ? `Ref: ${letter.referenceNumber}` : "Draft"}</span>
          <span>Date: {formatDate(letter.issueDate)}</span>
        </div>

        <h2 className="text-center font-bold text-lg tracking-wide underline" data-testid="text-letter-title">
          {title}
        </h2>

        <p>To Whom It May Concern,</p>

        {letter.templateType === "experience" && (
          <>
            <p>
              This is to certify that <strong>{letter.employeeName}</strong>
              {letter.employeeCode ? ` (Employee ID: ${letter.employeeCode})` : ""} was employed with
              <strong> Rayomind Solutions LLP</strong> as <strong>{letter.designation}</strong>
              {letter.department ? ` in the ${letter.department} department` : ""} from{" "}
              <strong>{formatDate(letter.startDate)}</strong> to <strong>{formatDate(letter.endDate)}</strong>.
            </p>
            {letter.performanceBand && PERFORMANCE_SENTENCES[letter.performanceBand] && (
              <p>{interpolate(PERFORMANCE_SENTENCES[letter.performanceBand], letter)}</p>
            )}
            {letter.conductBand && CONDUCT_SENTENCES[letter.conductBand] && (
              <p>{CONDUCT_SENTENCES[letter.conductBand]}</p>
            )}
          </>
        )}

        {letter.templateType === "internship_completion" && (
          <>
            <p>
              This is to certify that <strong>{letter.employeeName}</strong>
              {letter.employeeCode ? ` (Intern ID: ${letter.employeeCode})` : ""}{" "}
              has {letter.completionBand ? COMPLETION_PHRASES[letter.completionBand] || "completed" : "completed"} an
              internship with <strong>Rayomind Solutions LLP</strong>
              {letter.department ? ` in the ${letter.department} department` : ""} from{" "}
              <strong>{formatDate(letter.startDate)}</strong> to <strong>{formatDate(letter.endDate)}</strong>.
            </p>
            {letter.includeProject && letter.projectName && (
              <p>During the internship, the intern worked on the project: <strong>{letter.projectName}</strong>.</p>
            )}
            {letter.performanceBand && PERFORMANCE_SENTENCES[letter.performanceBand] && (
              <p>{interpolate(PERFORMANCE_SENTENCES[letter.performanceBand], letter)}</p>
            )}
            <p>This letter is issued for academic/employment/record purposes.</p>
          </>
        )}

        {letter.templateType === "internship_certificate" && (
          <>
            <p>
              This is to certify that <strong>{letter.employeeName}</strong>{" "}
              has {letter.completionBand ? COMPLETION_PHRASES[letter.completionBand] || "completed" : "completed"} an
              internship with <strong>Rayomind Solutions LLP</strong>
              {letter.department ? ` in the ${letter.department} department` : ""} as{" "}
              <strong>{letter.designation}</strong> from{" "}
              <strong>{formatDate(letter.startDate)}</strong> to <strong>{formatDate(letter.endDate)}</strong>.
            </p>
          </>
        )}

        {letter.templateType === "relieving" && (
          <>
            <p>
              This is to certify that <strong>{letter.employeeName}</strong>
              {letter.employeeCode ? ` (Employee ID: ${letter.employeeCode})` : ""} was employed with
              <strong> Rayomind Solutions LLP</strong> as <strong>{letter.designation}</strong>
              {letter.department ? ` in the ${letter.department} department` : ""} from{" "}
              <strong>{formatDate(letter.startDate)}</strong>.
            </p>
            <p>
              The resignation submitted has been accepted and <strong>{letter.employeeName}</strong> has been
              relieved from duties effective <strong>{formatDate(letter.lastWorkingDay || letter.endDate)}</strong>.
            </p>
            <p>All company dues have been settled and all company property has been returned.</p>
            <p>
              The company has no objection to <strong>{letter.employeeName}</strong> seeking employment
              elsewhere.
            </p>
          </>
        )}

        {letter.includeResponsibilities && letter.responsibilitiesSummary && (
          <p><strong>Key Responsibilities:</strong> {letter.responsibilitiesSummary}</p>
        )}

        {letter.customOverrideText && (
          <p>{letter.customOverrideText}</p>
        )}

        {letter.closingLine && CLOSING_SENTENCES[letter.closingLine] && (
          <p>{CLOSING_SENTENCES[letter.closingLine]}</p>
        )}

        <div className="mt-10 pt-4 flex justify-between items-end">
          <div>
            <p className="font-semibold text-sm">For Rayomind Solutions LLP</p>
            <div className="mt-2">
              <p
                style={{ fontFamily: "'Dancing Script', cursive", fontSize: "2rem", lineHeight: 1.2, color: "#1a1a2e" }}
              >
                {letter.signatoryName || "Authorized Signatory"}
              </p>
            </div>
            <div className="border-b border-gray-400 w-48 mb-1" />
            <p className="font-semibold text-sm">{letter.signatoryName || "Authorized Signatory"}</p>
            <p className="text-gray-500 text-xs">{letter.signatoryDesignation || "Authorized Signatory"}</p>
          </div>
          {letter.includeSeal && (
            <div className="flex flex-col items-center">
              <div className="w-24 h-24 rounded-full border-2 border-orange-500 flex items-center justify-center bg-orange-50/60 relative">
                <div className="w-20 h-20 rounded-full border border-orange-400 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-[8px] font-bold text-orange-600 uppercase leading-tight tracking-wider">Rayomind</p>
                    <div className="w-8 border-t border-orange-400 my-1 mx-auto" />
                    <p className="text-[6px] font-semibold text-orange-500 uppercase leading-tight tracking-widest">Solutions LLP</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 pt-4 border-t-2 border-orange-500">
          <div className="flex items-center justify-between text-[10px] text-gray-400">
            <div>
              <p className="font-medium text-gray-500">Digitally Generated Document</p>
              <p>No physical signature required</p>
            </div>
            <div className="text-right">
              {letter.referenceNumber && letter.authCode ? (
                <>
                  <p className="font-mono font-medium text-gray-500">Ref: {letter.referenceNumber}</p>
                  <p className="font-mono font-medium text-gray-500">Auth: {letter.authCode}</p>
                </>
              ) : (
                <p className="italic">Verification assigned on issuance</p>
              )}
            </div>
          </div>
          <p className="text-center text-[9px] text-gray-400 mt-2">
            {letter.referenceNumber && letter.authCode
              ? "Verify authenticity at hire-in.com/verify using the reference and auth code above"
              : "Draft — cryptographic verification will be assigned upon issuance"}
          </p>
        </div>
      </div>
    </div>
  );
}
