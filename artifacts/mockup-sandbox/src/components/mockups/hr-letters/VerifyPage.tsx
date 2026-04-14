import { CheckCircle2 } from 'lucide-react';

export function VerifyPage() {
  return (
    <div className="min-h-screen bg-gray-50 font-['Inter']">
      <div className="max-w-lg mx-auto pt-16 px-6">
        <div className="text-center mb-10">
          <img
            src="/__mockup/images/rayomind-logo.png"
            alt="Rayomind Solutions LLP"
            className="h-14 mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold text-gray-900">Document Verification</h1>
          <p className="text-sm text-gray-500 mt-1">Verify the authenticity of HR documents issued by Rayomind Solutions LLP</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Reference Number</label>
              <input
                type="text"
                value="RL/EXP/2026/0047"
                readOnly
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm bg-gray-50 text-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Auth Code</label>
              <input
                type="text"
                value="A7F3-B92E"
                readOnly
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm bg-gray-50 text-gray-700"
              />
            </div>
            <button
              className="w-full py-2.5 rounded-lg text-white font-semibold text-sm transition-colors"
              style={{ background: 'hsl(15, 94%, 61%)' }}
            >
              Verify Document
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-green-200 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-green-800">Document Verified</h2>
              <p className="text-xs text-green-600">This document is authentic and was issued by Rayomind Solutions LLP</p>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4 space-y-3">
            <Row label="Document Type" value="Experience Letter" />
            <Row label="Name" value="Mr. Arjun Mehta" />
            <Row label="Employee ID" value="RSL-1042" />
            <Row label="Designation" value="Senior Software Engineer" />
            <Row label="Department" value="Engineering" />
            <Row label="Tenure" value="15/03/2022 — 31/03/2026" />
            <Row label="Issued On" value="14/04/2026" />
            <Row label="Status" value="Issued" highlight />
          </div>
        </div>

        <p className="text-center text-[10px] text-gray-400 mt-8 pb-8">
          Rayomind Solutions LLP — Suite No-101, Pocket-6, Sector-2, Rohini, New Delhi, 110085
        </p>
      </div>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-gray-500">{label}</span>
      {highlight ? (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
          {value}
        </span>
      ) : (
        <span className="font-medium text-gray-900">{value}</span>
      )}
    </div>
  );
}
