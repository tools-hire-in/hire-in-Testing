import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldCheck, FileText } from "lucide-react";

export interface EsignConsentProps {
  onAccept: (consentTimestamp: Date) => void;
}

export function EsignConsent({ onAccept }: EsignConsentProps) {
  const [agreed, setAgreed] = useState(false);

  function handleContinue() {
    if (!agreed) return;
    onAccept(new Date());
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
      <div className="max-w-2xl w-full space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-2">
            <ShieldCheck className="h-8 w-8 text-blue-700" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Electronic Signature Consent</h1>
          <p className="text-muted-foreground text-sm">Before you can sign, please review and accept the terms below.</p>
        </div>

        <Card className="border-blue-100 shadow-sm">
          <CardContent className="pt-6 pb-6 space-y-4">
            <div className="flex items-center gap-2 text-blue-800 font-semibold text-sm">
              <FileText className="h-4 w-4 shrink-0" />
              Electronic Signature Disclosure &amp; Consent
            </div>

            <div className="text-sm text-slate-700 leading-relaxed space-y-3 bg-slate-50 rounded-lg p-4 max-h-64 overflow-y-auto border border-slate-200">
              <p>
                <strong>Consent to Use Electronic Signatures.</strong> By clicking &ldquo;Continue&rdquo;, you agree that your electronic signature on any document presented in this session is legally binding and has the same legal effect as your handwritten signature.
              </p>
              <p>
                Electronic signatures are governed by applicable law, including the Information Technology Act, 2000 (India) and the Electronic Signatures in Global and National Commerce Act (E-SIGN Act, USA), as well as any other applicable electronic signature laws.
              </p>
              <p>
                <strong>What you are consenting to:</strong>
              </p>
              <ul className="list-disc list-inside space-y-1 text-slate-600">
                <li>Your typed name will serve as your electronic signature.</li>
                <li>Your initials will be used to acknowledge individual sections of the document.</li>
                <li>The timestamp of your consent, signature, and IP address will be recorded for audit purposes.</li>
                <li>You may request a paper copy of any document by contacting HR at any time.</li>
              </ul>
              <p>
                <strong>Right to withdraw consent.</strong> You may withdraw your consent to use electronic signatures at any time before signing by closing this page and contacting HR to request a paper-based process.
              </p>
              <p className="text-xs text-muted-foreground">
                Your consent to the use of electronic signatures is timestamped and stored securely alongside your signature record.
              </p>
            </div>

            <div className="flex items-start gap-3 pt-2">
              <Checkbox
                id="esign-consent"
                checked={agreed}
                onCheckedChange={(v) => setAgreed(v === true)}
                data-testid="checkbox-esign-consent"
              />
              <label
                htmlFor="esign-consent"
                className="text-sm text-slate-700 leading-relaxed cursor-pointer"
              >
                I have read and understand the Electronic Signature Disclosure above. I agree that my electronic signature is legally binding and consent to conduct this transaction electronically.
              </label>
            </div>
          </CardContent>
        </Card>

        <Button
          onClick={handleContinue}
          disabled={!agreed}
          className="w-full bg-blue-700 hover:bg-blue-800"
          size="lg"
          data-testid="button-esign-consent-continue"
        >
          <ShieldCheck className="h-5 w-5 mr-2" />
          I Agree — Continue to Document
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          Powered by Hire&rsquo;in Solutions E-Sign &bull; Secured &amp; Audited
        </p>
      </div>
    </div>
  );
}
