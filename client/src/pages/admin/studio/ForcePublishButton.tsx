import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Shield, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";

interface ForcePublishButtonProps {
  articleId: string;
  articleTitle: string;
  riskFlags?: string[] | null;
  onDone?: () => void;
  /** When true, renders only the button (no separator/label wrapper) — for use in horizontal toolbars. */
  compact?: boolean;
}

const STALE_KEYS = [
  ["/api/admin/studio/articles"],
  ["/api/admin/studio/cm-review"],
  ["/api/admin/studio/approvals"],
  ["/api/admin/studio/final-approval"],
  ["/api/admin/studio/stats"],
  ["/api/admin/studio/calendar"],
];

export function ForcePublishButton({
  articleId,
  articleTitle,
  riskFlags,
  onDone,
  compact = false,
}: ForcePublishButtonProps) {
  const { role } = usePermissions();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/admin/studio/articles/${articleId}/force-publish`, {});
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || "Force-publish failed");
      }
      return res.json();
    },
    onSuccess: () => {
      STALE_KEYS.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
      toast({ title: "Article published immediately" });
      setOpen(false);
      onDone?.();
    },
    onError: (err: Error) =>
      toast({ title: "Force-publish failed", description: err.message, variant: "destructive" }),
  });

  if (role !== "super_admin") return null;

  const hasFlags = Array.isArray(riskFlags) && riskFlags.length > 0;

  const trigger = (
    <Button
      variant="destructive"
      size="sm"
      className={compact ? undefined : "w-full"}
      onClick={() => setOpen(true)}
      disabled={mutation.isPending}
      data-testid="button-force-publish"
    >
      {mutation.isPending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Shield className="mr-2 h-4 w-4" />
      )}
      Force Publish Now
    </Button>
  );

  return (
    <>
      {compact ? (
        trigger
      ) : (
        <div className="space-y-2">
          <Separator />
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Super Admin override
          </p>
          {trigger}
        </div>
      )}

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Force-publish &ldquo;{articleTitle}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  This bypasses all remaining workflow stages and publishes immediately. This action
                  cannot be undone.
                </p>
                {hasFlags && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                    <p className="font-semibold">⚠ Unresolved risk flags</p>
                    <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs">
                      {riskFlags!.map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs">
                      These flags were not resolved. You may still proceed, but review them if
                      possible.
                    </p>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-force-publish-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              data-testid="button-force-publish-confirm"
            >
              {mutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Shield className="mr-2 h-4 w-4" />
              )}
              Force Publish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
