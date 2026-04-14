export function Letterhead({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-[210mm] min-h-[297mm] bg-white mx-auto font-['Inter'] text-[11pt] text-gray-800 leading-relaxed relative" style={{ padding: '25mm 25mm 30mm 25mm' }}>
      <header className="flex items-start justify-between mb-0 pb-4">
        <div className="flex-shrink-0">
          <img
            src="/__mockup/images/rayomind-logo.png"
            alt="Rayomind Solutions LLP"
            className="h-16 w-auto"
          />
        </div>
        <div className="text-right text-[9pt] text-gray-600 leading-snug">
          <p className="font-bold text-[11pt] text-gray-900 mb-1">Rayomind Solutions LLP</p>
          <p>Suite No-101, Pocket-6, Sector-2</p>
          <p>Rohini, New Delhi, 110085, India</p>
          <p className="mt-1 text-[8.5pt]">contact@hire-in.com | www.rayomind.com</p>
        </div>
      </header>
      <div className="h-[3px] w-full rounded-full mb-6" style={{ background: 'hsl(15, 94%, 61%)' }} />
      {children}
      <VerificationFooter />
    </div>
  );
}

function VerificationFooter() {
  return (
    <div className="absolute bottom-[20mm] left-[25mm] right-[25mm] text-center text-[8pt] text-gray-400 border-t border-gray-200 pt-3">
      This is a system-generated document. Verify at{' '}
      <span className="text-gray-500 font-medium">hire-in.com/verify</span>
    </div>
  );
}

export function RefDateBlock({ refNo, date }: { refNo: string; date: string }) {
  return (
    <div className="flex justify-between mb-6 text-[10pt]">
      <p><span className="font-semibold">Ref No:</span> {refNo}</p>
      <p><span className="font-semibold">Date:</span> {date}</p>
    </div>
  );
}

export function SignatoryBlock({ name, designation }: { name: string; designation: string }) {
  return (
    <div className="mt-12">
      <p className="font-semibold text-gray-900">For Rayomind Solutions LLP</p>
      <div className="mt-10">
        <div className="w-48 border-b border-gray-400 mb-1" />
        <p className="font-semibold text-gray-900">{name}</p>
        <p className="text-[10pt] text-gray-600">{designation}</p>
      </div>
    </div>
  );
}

export function VerificationLine({ refNo, authCode }: { refNo: string; authCode: string }) {
  return (
    <p className="mt-8 text-[8.5pt] text-gray-400 text-center">
      Ref: {refNo} | Auth: {authCode} — Verify at hire-in.com/verify
    </p>
  );
}
