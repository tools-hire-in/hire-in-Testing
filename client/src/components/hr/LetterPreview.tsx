import { renderLetter, type LetterRenderData } from "@shared/letterRenderer";

const rayomindLogoPath = "/rayomind-logo.png";

export interface LetterSentencesOverride {
  performance_band?: Record<string, string>;
  conduct_band?: Record<string, string>;
  completion_band?: Record<string, string>;
  closing_line?: Record<string, string>;
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
  sentencesOverride?: LetterSentencesOverride;
}

export function LetterPreview({ letter, sentencesOverride }: LetterPreviewProps) {
  const data: LetterRenderData = {
    ...letter,
    startDate: letter.startDate,
    sentencesOverride,
  };

  const rendered = renderLetter(data);

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
          <span>{rendered.refText}</span>
          <span>{rendered.dateText}</span>
        </div>

        <h2 className="text-center font-bold text-lg tracking-wide underline" data-testid="text-letter-title">
          {rendered.title}
        </h2>

        <p>{rendered.greeting}</p>

        {rendered.body.map((para, i) => (
          <p key={i}>
            {para.map((span, j) =>
              span.b ? <strong key={j}>{span.t}</strong> : span.t
            )}
          </p>
        ))}

        <div className="mt-10 pt-4 flex justify-between items-end">
          <div>
            <p className="font-semibold text-sm">For Rayomind Solutions LLP</p>
            <div className="mt-2">
              <p
                style={{ fontFamily: "'Dancing Script', cursive", fontSize: "2rem", lineHeight: 1.2, color: "#1a1a2e" }}
              >
                {rendered.signatoryName}
              </p>
            </div>
            <div className="border-b border-gray-400 w-48 mb-1" />
            <p className="font-semibold text-sm">{rendered.signatoryName}</p>
            <p className="text-gray-500 text-xs">{rendered.signatoryDesignation}</p>
          </div>
          {rendered.includeSeal && (
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
              {rendered.referenceNumber && rendered.authCode ? (
                <>
                  <p className="font-mono font-medium text-gray-500">Ref: {rendered.referenceNumber}</p>
                  <p className="font-mono font-medium text-gray-500">Auth: {rendered.authCode}</p>
                </>
              ) : (
                <p className="italic">Verification assigned on issuance</p>
              )}
            </div>
          </div>
          <p className="text-center text-[9px] text-gray-400 mt-2">
            {rendered.referenceNumber && rendered.authCode
              ? "Verify authenticity at hire-in.com/verify using the reference and auth code above"
              : "Draft — cryptographic verification will be assigned upon issuance"}
          </p>
        </div>
      </div>
    </div>
  );
}
