import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { PenLine, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EsignSetupData {
  name: string;
  initials: string;
  font: string;
}

export interface EsignSetupProps {
  onComplete: (data: EsignSetupData) => void;
}

export const ESIGN_FONTS: Array<{ id: string; label: string; family: string }> = [
  { id: "dancing-script", label: "Elegant", family: "'Dancing Script', cursive" },
  { id: "pacifico", label: "Bold & Friendly", family: "'Pacifico', cursive" },
  { id: "caveat", label: "Handwritten", family: "'Caveat', cursive" },
];

function deriveInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase())
    .join(".");
}

export function EsignSetup({ onComplete }: EsignSetupProps) {
  const [name, setName] = useState("");
  const [selectedFont, setSelectedFont] = useState(ESIGN_FONTS[0].id);

  const initials = name.trim().length > 0 ? deriveInitials(name) : "";
  const fontObj = ESIGN_FONTS.find((f) => f.id === selectedFont) ?? ESIGN_FONTS[0];
  const canContinue = name.trim().length >= 2;

  function handleContinue() {
    if (!canContinue) return;
    onComplete({ name: name.trim(), initials, font: selectedFont });
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
      <div className="max-w-xl w-full space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-2">
            <PenLine className="h-8 w-8 text-blue-700" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Set Up Your Signature</h1>
          <p className="text-muted-foreground text-sm">Type your full name and choose a signature style. You only need to do this once per session.</p>
        </div>

        <Card className="border-blue-100 shadow-sm">
          <CardContent className="pt-6 pb-6 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="esign-name">Your Full Name</Label>
              <Input
                id="esign-name"
                placeholder="e.g. Jane Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="text-base"
                data-testid="input-esign-name"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">Enter your name exactly as it appears on the document.</p>
            </div>

            {name.trim().length >= 2 && (
              <>
                <div className="space-y-3">
                  <Label>Choose Signature Style</Label>
                  <div className="grid gap-3">
                    {ESIGN_FONTS.map((font) => (
                      <button
                        key={font.id}
                        type="button"
                        onClick={() => setSelectedFont(font.id)}
                        className={cn(
                          "relative flex flex-col items-start gap-1 rounded-lg border-2 p-4 text-left transition-all",
                          selectedFont === font.id
                            ? "border-blue-600 bg-blue-50"
                            : "border-slate-200 bg-white hover:border-blue-300"
                        )}
                        data-testid={`button-font-${font.id}`}
                      >
                        {selectedFont === font.id && (
                          <CheckCircle className="absolute top-3 right-3 h-4 w-4 text-blue-600" />
                        )}
                        <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{font.label}</span>
                        <span
                          className="text-3xl text-slate-800 leading-tight"
                          style={{ fontFamily: font.family }}
                        >
                          {name.trim()}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {initials && (
                  <div className="rounded-lg border border-dashed border-blue-200 bg-slate-50 p-4 space-y-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">Your Initials (auto-generated)</p>
                    <p
                      className="text-2xl text-blue-900 font-bold tracking-widest"
                      style={{ fontFamily: fontObj.family }}
                      data-testid="text-esign-initials-preview"
                    >
                      {initials}
                    </p>
                    <p className="text-xs text-muted-foreground">These will be used to acknowledge each section of the document.</p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Button
          onClick={handleContinue}
          disabled={!canContinue}
          className="w-full bg-blue-700 hover:bg-blue-800"
          size="lg"
          data-testid="button-esign-setup-continue"
        >
          Continue to Document
        </Button>
      </div>
    </div>
  );
}
