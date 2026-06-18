import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ESIGN_FONTS } from "./EsignSetup";

/**
 * SignatureBlock — the central, reusable e-signature form atom.
 *
 * Renders the interactive signing form shared by every formal acceptance flow
 * (offer letters, addendums, contracts, …): an optional consent checkbox, an
 * optional typed-name confirmation with exact-match validation, an optional
 * signing-date field, a live cursive signature preview, an optional extra gate
 * (e.g. policy annexures initialed), a submit button, and an audit notice.
 *
 * When `presetName` + `presetFont` are provided (DocuSign flow ON), the name
 * input is hidden and the signature preview renders with the pre-chosen style
 * immediately, reducing the final step to just the consent checkbox + submit.
 */
export interface SignatureBlockProps {
  /** Consent checkbox. Omit for flows that confirm purely via typed name. */
  consent?: {
    label: React.ReactNode;
    /** Contract-style white bordered box vs. a plain inline row. */
    boxed?: boolean;
  };
  /** Typed-name confirmation. Omit for flows that confirm purely via checkbox. */
  nameConfirmation?: {
    expectedName: string;
    label?: string;
    testId?: string;
  };
  /** Signing-date field (offer acceptance). Controlled by the parent page. */
  signingDate?: {
    value: string;
    onChange: (v: string) => void;
    label?: string;
    testId?: string;
  };
  /** Show the cursive signature preview of the typed name. */
  showPreview?: boolean;
  /** Include the signing date under the signature preview. */
  previewShowDate?: boolean;
  /** Additional gating condition (e.g. all annexures initialed). Defaults to true. */
  extraGateMet?: boolean;
  /** Message shown when extraGateMet is false. */
  extraGateMessage?: React.ReactNode;
  extraGateTestId?: string;
  submitLabel: string;
  /** Optional label shown while submitting (defaults to submitLabel). */
  submittingLabel?: string;
  submitClassName?: string;
  submitSize?: "lg" | "default";
  submitTestId?: string;
  /** Audit / legal notice rendered below the submit button. */
  notice?: React.ReactNode;
  error?: string | null;
  submitting: boolean;
  onSubmit: (data: { acceptedName: string }) => void;
  /**
   * DocuSign flow: pre-filled name from the setup step.
   * When provided, the name input is hidden and the preset value is used directly.
   */
  presetName?: string;
  /**
   * DocuSign flow: font ID chosen in setup step (e.g. "dancing-script").
   * When provided alongside presetName, signature preview uses this font.
   */
  presetFont?: string;
}

export function SignatureBlock({
  consent,
  nameConfirmation,
  signingDate,
  showPreview,
  previewShowDate,
  extraGateMet = true,
  extraGateMessage,
  extraGateTestId,
  submitLabel,
  submittingLabel,
  submitClassName,
  submitSize = "lg",
  submitTestId,
  notice,
  error,
  submitting,
  onSubmit,
  presetName,
  presetFont,
}: SignatureBlockProps) {
  const [agreed, setAgreed] = useState(false);
  const [typedName, setTypedName] = useState("");

  const isDocuSignMode = !!presetName;
  const effectiveName = isDocuSignMode ? presetName : typedName;

  const fontFamily = (() => {
    if (isDocuSignMode && presetFont) {
      return ESIGN_FONTS.find((f) => f.id === presetFont)?.family ?? "'Dancing Script', cursive";
    }
    return "'Dancing Script', cursive";
  })();

  const isNameMatch =
    isDocuSignMode
      ? true
      : !nameConfirmation ||
        typedName.trim().toLowerCase() === nameConfirmation.expectedName.trim().toLowerCase();
  const consentMet = !consent || agreed;
  const canSubmit = consentMet && isNameMatch && extraGateMet;

  function handleSubmit() {
    if (!canSubmit || submitting) return;
    onSubmit({ acceptedName: effectiveName.trim() });
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">{error}</div>
      )}

      {isDocuSignMode ? (
        <div className="p-6 bg-white border border-dashed border-blue-200 rounded-lg text-center space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">
            Your Signature
          </p>
          <p className="text-4xl text-blue-900" style={{ fontFamily }} data-testid="text-signature-preview">
            {presetName}
          </p>
          {previewShowDate && signingDate && (
            <p className="text-xs text-muted-foreground">{signingDate.value}</p>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            Using the style you chose during setup. This is your legally binding electronic signature.
          </p>
        </div>
      ) : null}

      {consent && (
        <div
          className={cn(
            "flex items-start gap-3",
            consent.boxed && "bg-white border rounded-lg p-4",
          )}
        >
          <Checkbox
            id="agree"
            checked={agreed}
            onCheckedChange={(v) => setAgreed(v === true)}
            data-testid="checkbox-agree"
          />
          <label
            htmlFor="agree"
            className="text-sm text-slate-700 leading-relaxed cursor-pointer"
          >
            {consent.label}
          </label>
        </div>
      )}

      {!isDocuSignMode && (nameConfirmation || signingDate) && (
        <div className={cn(signingDate && "grid grid-cols-1 md:grid-cols-2 gap-4")}>
          {nameConfirmation && (
            <div className="space-y-2">
              <Label htmlFor="typed-name">
                {nameConfirmation.label || "Type your full name to confirm acceptance"}
              </Label>
              <Input
                id="typed-name"
                data-testid={nameConfirmation.testId || "input-accept-name"}
                placeholder={nameConfirmation.expectedName}
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                className={cn("mt-1", typedName && !isNameMatch && "border-red-500 bg-red-50")}
              />
              {typedName && !isNameMatch && (
                <p className="text-xs text-red-600">
                  Name must match exactly: &ldquo;{nameConfirmation.expectedName}&rdquo;
                </p>
              )}
            </div>
          )}
          {signingDate && (
            <div className="space-y-2">
              <Label htmlFor="signing-date">{signingDate.label || "Your signing date"}</Label>
              <Input
                id="signing-date"
                type="date"
                data-testid={signingDate.testId || "input-accept-date"}
                value={signingDate.value}
                onChange={(e) => signingDate.onChange(e.target.value)}
                className="mt-1"
              />
            </div>
          )}
        </div>
      )}

      {isDocuSignMode && signingDate && (
        <div className="space-y-2">
          <Label htmlFor="signing-date">{signingDate.label || "Your signing date"}</Label>
          <Input
            id="signing-date"
            type="date"
            data-testid={signingDate.testId || "input-accept-date"}
            value={signingDate.value}
            onChange={(e) => signingDate.onChange(e.target.value)}
            className="mt-1"
          />
        </div>
      )}

      {!isDocuSignMode && showPreview && typedName.length > 1 && (
        <div className="p-6 bg-white border border-dashed border-blue-200 rounded-lg text-center space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">
            Signature Preview
          </p>
          <p className="text-4xl text-blue-900" style={{ fontFamily: "'Dancing Script', cursive" }}>
            {typedName}
          </p>
          {previewShowDate && signingDate && (
            <p className="text-xs text-muted-foreground">{signingDate.value}</p>
          )}
        </div>
      )}

      {!extraGateMet && extraGateMessage && (
        <p
          className="text-sm text-amber-700 bg-amber-50 border border-amber-200 p-3 rounded-md"
          data-testid={extraGateTestId}
        >
          {extraGateMessage}
        </p>
      )}

      <Button
        onClick={handleSubmit}
        disabled={!canSubmit || submitting}
        className={cn("w-full", submitClassName)}
        size={submitSize}
        data-testid={submitTestId}
      >
        {submitting ? (
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
        ) : (
          <CheckCircle className="h-5 w-5 mr-2" />
        )}
        {submitting && submittingLabel ? submittingLabel : submitLabel}
      </Button>

      {notice && (
        <p className="text-xs text-muted-foreground text-center">{notice}</p>
      )}
    </div>
  );
}
