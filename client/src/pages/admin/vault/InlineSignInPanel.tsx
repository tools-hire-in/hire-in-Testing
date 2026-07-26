import { useState, useEffect, useRef } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Copy, Check, Timer, X, AlertTriangle } from "lucide-react";

const SENSITIVITY_INFO: Record<string, { autoHideSeconds: number; requiresTotp: boolean }> = {
  low:      { autoHideSeconds: 60, requiresTotp: false },
  medium:   { autoHideSeconds: 60, requiresTotp: false },
  high:     { autoHideSeconds: 60, requiresTotp: true },
  critical: { autoHideSeconds: 30, requiresTotp: true },
};

interface Props {
  secretId: string;
  sensitivity: string;
  onClose: () => void;
}

export default function InlineSignInPanel({ secretId, sensitivity, onClose }: Props) {
  const { toast } = useToast();
  const info = SENSITIVITY_INFO[sensitivity] ?? SENSITIVITY_INFO.medium;

  const [reason, setReason] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [loading, setLoading] = useState(false);

  const [revealed, setRevealed] = useState<{ username?: string; password: string } | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [copiedUsername, setCopiedUsername] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const canSubmit = reason.trim().length >= 10 && (!info.requiresTotp || totpCode.trim().length === 6);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await apiRequest("POST", `/api/secrets/${secretId}/reveal`, {
        reason: reason.trim(),
        totpCode: totpCode.trim() || undefined,
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error((b as any).error ?? `Error ${res.status}`);
      }
      const data = await res.json() as { value: string; username?: string; sensitivity: string };

      setRevealed({ username: data.username, password: data.value });
      setCountdown(info.autoHideSeconds);
      timerRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev === null || prev <= 1) {
            clearInterval(timerRef.current!);
            onClose();
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (e: any) {
      toast({ title: "Cannot reveal", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (value: string, type: "username" | "password") => {
    try {
      await navigator.clipboard.writeText(value);
      if (type === "username") {
        setCopiedUsername(true);
        setTimeout(() => setCopiedUsername(false), 2000);
      } else {
        setCopiedPassword(true);
        setTimeout(() => setCopiedPassword(false), 2000);
      }
    } catch {
      toast({ title: "Copy failed", description: "Could not access clipboard", variant: "destructive" });
    }
  };

  return (
    <div className="bg-accent/30 border border-border rounded-md p-3 space-y-3" data-testid={`inline-signin-panel-${secretId}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Credentials for this site
        </p>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
          data-testid={`button-close-signin-panel-${secretId}`}
          aria-label="Close sign-in panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {!revealed ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">The login page is opening in a new tab. Enter your reason below to reveal credentials.</p>
          <div className="space-y-1">
            <Label className="text-xs">
              Business Reason <span className="text-red-500">*</span>
            </Label>
            <Textarea
              data-testid={`input-signin-reason-${secretId}`}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Briefly describe why you need these credentials (min. 10 characters)"
              rows={2}
              className="text-sm resize-none"
            />
            {reason.trim().length > 0 && reason.trim().length < 10 && (
              <p className="text-xs text-amber-600">At least 10 characters required.</p>
            )}
          </div>

          {info.requiresTotp && (
            <div className="space-y-1">
              <Label className="text-xs">
                TOTP Code <span className="text-red-500">*</span>
              </Label>
              <Input
                data-testid={`input-signin-totp-${secretId}`}
                value={totpCode}
                onChange={e => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="6-digit code"
                maxLength={6}
                className="font-mono text-center tracking-widest text-sm"
              />
            </div>
          )}

          {sensitivity === "critical" && (
            <div className="rounded-md border border-red-200 bg-red-50 p-2 flex gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">Critical credential — your access will be permanently logged.</p>
            </div>
          )}

          <Button
            size="sm"
            className="w-full gap-1.5"
            data-testid={`button-signin-confirm-${secretId}`}
            disabled={!canSubmit || loading}
            onClick={handleSubmit}
          >
            {loading ? "Revealing…" : "Reveal credentials"}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {countdown !== null && (
            <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
              <Timer className="h-3.5 w-3.5 shrink-0" />
              Auto-closing in <strong>{countdown}s</strong>
            </div>
          )}

          {revealed.username !== undefined && (
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0 bg-background border rounded px-2 py-1.5">
                <p className="text-xs text-muted-foreground mb-0.5">Username</p>
                <p className="text-sm font-mono truncate" data-testid={`text-signin-username-${secretId}`}>{revealed.username}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-9 w-9 p-0 shrink-0"
                data-testid={`button-signin-copy-username-${secretId}`}
                onClick={() => copyToClipboard(revealed.username!, "username")}
                title="Copy username"
              >
                {copiedUsername ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0 bg-background border rounded px-2 py-1.5">
              <p className="text-xs text-muted-foreground mb-0.5">Password</p>
              <p className="text-sm font-mono select-all" data-testid={`text-signin-password-${secretId}`}>{revealed.password}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-9 w-9 p-0 shrink-0"
              data-testid={`button-signin-copy-password-${secretId}`}
              onClick={() => copyToClipboard(revealed.password, "password")}
              title="Copy password"
            >
              {copiedPassword ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Paste into the login tab that opened. This view closes automatically.
          </p>
        </div>
      )}
    </div>
  );
}
