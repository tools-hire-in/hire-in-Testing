import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff, Copy, Shield, ShieldAlert, Lock, Timer, AlertTriangle } from "lucide-react";

const SENSITIVITY_INFO: Record<string, { label: string; color: string; autoHideSeconds: number; requiresReason: boolean; requiresTotp: boolean }> = {
  low: { label: "Low", color: "bg-green-100 text-green-800", autoHideSeconds: 60, requiresReason: true, requiresTotp: false },
  medium: { label: "Medium", color: "bg-yellow-100 text-yellow-800", autoHideSeconds: 60, requiresReason: true, requiresTotp: false },
  high: { label: "High", color: "bg-orange-100 text-orange-800", autoHideSeconds: 60, requiresReason: true, requiresTotp: true },
  critical: { label: "Critical", color: "bg-red-100 text-red-800", autoHideSeconds: 30, requiresReason: true, requiresTotp: true },
};

type Secret = {
  id: string; systemName: string; sensitivity: string; loginUrl?: string;
};

export default function RevealSecretDialog({ secret, onClose }: { secret: Secret; onClose: () => void }) {
  const { toast } = useToast();
  const info = SENSITIVITY_INFO[secret.sensitivity] ?? SENSITIVITY_INFO.medium;

  const [reason, setReason] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [revealedValue, setRevealedValue] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [masked, setMasked] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const revealMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/secrets/${secret.id}/reveal`, {
        reason: reason.trim() || undefined,
        totpCode: totpCode.trim() || undefined,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Server error ${res.status}`);
      }
      return res.json() as Promise<{ value: string }>;
    },
    onSuccess: (data) => {
      setRevealedValue(data.value);
      setMasked(true);
      // All sensitivity levels auto-hide (low/medium: 60s, high: 60s, critical: 30s)
      if (timerRef.current) clearInterval(timerRef.current);
      setCountdown(info.autoHideSeconds);
      timerRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev === null || prev <= 1) {
            clearInterval(timerRef.current!);
            setRevealedValue(null);
            setMasked(true);
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    },
    onError: (e: any) => {
      const msg = e?.message ?? "Failed to reveal";
      toast({ title: "Cannot reveal", description: msg, variant: "destructive" });
    },
  });

  const copyToClipboard = async () => {
    if (!revealedValue) return;
    await navigator.clipboard.writeText(revealedValue);
    toast({ title: "Copied to clipboard" });
  };

  const canSubmit = (
    (!info.requiresReason || reason.trim().length >= 10) &&
    (!info.requiresTotp || totpCode.trim().length === 6)
  );

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Reveal Password — {secret.systemName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${info.color}`}>
              {secret.sensitivity === "critical" ? <Lock className="h-3 w-3" /> : secret.sensitivity === "high" ? <ShieldAlert className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
              {info.label} sensitivity
            </span>
            {info.autoHideSeconds && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Timer className="h-3 w-3" /> Auto-hides after {info.autoHideSeconds}s
              </span>
            )}
          </div>

          {!revealedValue ? (
            <>
              {info.requiresReason && (
                <div className="space-y-1">
                  <Label>Business Reason <span className="text-red-500">*</span></Label>
                  <Textarea
                    data-testid="input-reveal-reason"
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder="Briefly describe why you need to view this credential (min. 10 characters)"
                    rows={3}
                  />
                  {reason.trim().length > 0 && reason.trim().length < 10 && (
                    <p className="text-xs text-amber-600">Please provide at least 10 characters.</p>
                  )}
                </div>
              )}

              {info.requiresTotp && (
                <div className="space-y-1">
                  <Label>TOTP Code (from your authenticator app) <span className="text-red-500">*</span></Label>
                  <Input
                    data-testid="input-totp-code"
                    value={totpCode}
                    onChange={e => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="6-digit code"
                    maxLength={6}
                    className="font-mono text-center tracking-widest text-lg"
                  />
                  <p className="text-xs text-muted-foreground">Enter the current 6-digit code from your authenticator app.</p>
                </div>
              )}

              {secret.sensitivity === "critical" && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 flex gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700">
                    This is a <strong>Critical</strong> credential. Your access will be logged with your reason and TOTP verification. The password will auto-hide after 30 seconds.
                  </p>
                </div>
              )}

              <Button
                data-testid="button-confirm-reveal"
                onClick={() => revealMutation.mutate()}
                disabled={!canSubmit || revealMutation.isPending}
                className="w-full"
              >
                {revealMutation.isPending ? "Verifying…" : "Reveal Password"}
              </Button>
            </>
          ) : (
            <div className="space-y-3">
              {countdown !== null && (
                <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                  <Timer className="h-4 w-4" />
                  Auto-hiding in <strong>{countdown}s</strong>
                </div>
              )}
              <div className="space-y-1">
                <Label>Password</Label>
                <div className="relative">
                  <Input
                    data-testid="input-revealed-value"
                    type={masked ? "password" : "text"}
                    value={revealedValue}
                    readOnly
                    className="font-mono pr-20"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      onClick={() => setMasked(m => !m)}
                      data-testid="button-toggle-mask"
                    >
                      {masked ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      onClick={copyToClipboard}
                      data-testid="button-copy-revealed"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                This view is logged. Never share this window with others.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-close-reveal">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
