import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export interface SignalActionResult {
  action: string;
  result: unknown;
  timestamp: string;
}

interface SignalActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create_goal" | "add_coaching_note";
  employeeId: string;
  employeeName: string;
  context: string;
  planId?: string;
  onSuccess: (result: SignalActionResult) => void;
}

export function SignalActionDialog({
  open,
  onOpenChange,
  mode,
  employeeId,
  employeeName,
  context: initialContext,
  planId,
  onSuccess,
}: SignalActionDialogProps) {
  const { toast } = useToast();
  const [contextText, setContextText] = useState(initialContext);
  const [inlineError, setInlineError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setContextText(initialContext);
      setInlineError(null);
    }
  }, [open, initialContext]);

  const mutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        action: mode,
        employeeId,
        context: contextText,
      };
      if (mode === "add_coaching_note" && planId) {
        body.planId = planId;
      }
      const res = await apiRequest("POST", "/api/observation/signal-action", body);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error || "Request failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      const result: SignalActionResult = {
        action: mode,
        result: data,
        timestamp: new Date().toISOString(),
      };
      toast({
        title: mode === "create_goal" ? "Goal created" : "Coaching note added",
        description: `${employeeName} — ${mode === "create_goal" ? "performance goal added" : "note recorded"}`,
      });
      onSuccess(result);
      onOpenChange(false);
    },
    onError: (err: Error) => {
      setInlineError(err.message || "Something went wrong");
    },
  });

  const isGoalMode = mode === "create_goal";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle data-testid="text-signal-action-title">
            {isGoalMode ? "Create Goal" : "Add Coaching Note"}
          </DialogTitle>
          <DialogDescription>
            {isGoalMode
              ? `Create a performance goal for ${employeeName}`
              : `Add a coaching note for ${employeeName}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Employee</Label>
            <p className="text-sm font-medium" data-testid="text-signal-employee-name">{employeeName}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="signal-context" className="text-xs">
              {isGoalMode ? "Goal context / title" : "Coaching note"}
            </Label>
            <Textarea
              id="signal-context"
              data-testid="input-signal-context"
              value={contextText}
              onChange={(e) => setContextText(e.target.value)}
              rows={4}
              placeholder={isGoalMode ? "Describe the goal…" : "Describe the coaching conversation…"}
              className="resize-none"
            />
          </div>

          {inlineError && (
            <p className="text-xs text-red-600" data-testid="text-signal-error">{inlineError}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
            data-testid="button-signal-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={() => { setInlineError(null); mutation.mutate(); }}
            disabled={mutation.isPending || !contextText.trim()}
            data-testid="button-signal-save"
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {isGoalMode ? "Create Goal" : "Save Note"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
