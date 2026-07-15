import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Settings2, Info } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

const GOVERNANCE_DEFAULTS = {
  governance_sop_grace_days: 15,
  governance_sop_cadence_max_per_week: 2,
  governance_pip_checkin_days: 7,
  governance_growth_checkin_days: 7,
  governance_escalation_probation_first_hours: 24,
  governance_escalation_probation_second_hours: 72,
  governance_goal_coaching_threshold_days: 5,
  governance_nudge_sweep_enabled: true,
} as const;

const settingsSchema = z.object({
  governance_sop_grace_days: z.number().int().min(7).max(60),
  governance_sop_cadence_max_per_week: z.number().int().min(1).max(5),
  governance_pip_checkin_days: z.number().int().min(3).max(30),
  governance_growth_checkin_days: z.number().int().min(7).max(60),
  governance_escalation_probation_first_hours: z.number().int().min(1).max(168),
  governance_escalation_probation_second_hours: z.number().int().min(1).max(336),
  governance_goal_coaching_threshold_days: z.number().int().min(1).max(30),
  governance_nudge_sweep_enabled: z.boolean(),
});

type SettingsForm = z.infer<typeof settingsSchema>;

type GovernanceSettingsResponse = {
  values: {
    governance_sop_grace_days: number | null;
    governance_sop_cadence_max_per_week: number | null;
    governance_pip_checkin_days: number | null;
    governance_growth_checkin_days: number | null;
    governance_escalation_probation_first_hours: number | null;
    governance_escalation_probation_second_hours: number | null;
    governance_goal_coaching_threshold_days: number | null;
    governance_nudge_sweep_enabled: string | boolean | null;
  };
  meta: Record<string, { updatedAt: string | null; updatedByName: string | null }>;
};

function parseValues(raw: GovernanceSettingsResponse["values"]): SettingsForm {
  return {
    governance_sop_grace_days: Number(raw.governance_sop_grace_days ?? GOVERNANCE_DEFAULTS.governance_sop_grace_days),
    governance_sop_cadence_max_per_week: Number(raw.governance_sop_cadence_max_per_week ?? GOVERNANCE_DEFAULTS.governance_sop_cadence_max_per_week),
    governance_pip_checkin_days: Number(raw.governance_pip_checkin_days ?? GOVERNANCE_DEFAULTS.governance_pip_checkin_days),
    governance_growth_checkin_days: Number(raw.governance_growth_checkin_days ?? GOVERNANCE_DEFAULTS.governance_growth_checkin_days),
    governance_escalation_probation_first_hours: Number(raw.governance_escalation_probation_first_hours ?? GOVERNANCE_DEFAULTS.governance_escalation_probation_first_hours),
    governance_escalation_probation_second_hours: Number(raw.governance_escalation_probation_second_hours ?? GOVERNANCE_DEFAULTS.governance_escalation_probation_second_hours),
    governance_goal_coaching_threshold_days: Number(raw.governance_goal_coaching_threshold_days ?? GOVERNANCE_DEFAULTS.governance_goal_coaching_threshold_days),
    governance_nudge_sweep_enabled: raw.governance_nudge_sweep_enabled === true || raw.governance_nudge_sweep_enabled === "true",
  };
}

function MetaLine({ metaEntry }: { metaEntry?: { updatedAt: string | null; updatedByName: string | null } }) {
  if (!metaEntry?.updatedAt && !metaEntry?.updatedByName) return null;
  const parts: string[] = [];
  if (metaEntry.updatedByName) parts.push(metaEntry.updatedByName);
  if (metaEntry.updatedAt) {
    const d = new Date(metaEntry.updatedAt);
    parts.push(`on ${d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`);
  }
  if (parts.length === 0) return null;
  return (
    <p className="text-[11px] text-muted-foreground mt-1">
      Last changed by {parts.join(" ")}
    </p>
  );
}

interface FieldRowProps {
  label: string;
  description: string;
  metaEntry?: { updatedAt: string | null; updatedByName: string | null };
  children: React.ReactNode;
}

function FieldRow({ label, description, metaEntry, children }: FieldRowProps) {
  return (
    <div className="grid gap-1.5 border-b pb-4 last:border-0 last:pb-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <Label className="font-medium text-sm">{label}</Label>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
          <MetaLine metaEntry={metaEntry} />
        </div>
        <div className="shrink-0 pt-0.5">{children}</div>
      </div>
    </div>
  );
}

export default function GovernanceSettingsPanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isSuperAdmin = user?.role === "super_admin";
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  const { data, isLoading } = useQuery<GovernanceSettingsResponse>({
    queryKey: ["/api/system/governance-settings"],
    queryFn: async () => {
      const res = await fetch("/api/system/governance-settings", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load governance settings");
      return res.json();
    },
  });

  const form = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      governance_sop_grace_days: GOVERNANCE_DEFAULTS.governance_sop_grace_days,
      governance_sop_cadence_max_per_week: GOVERNANCE_DEFAULTS.governance_sop_cadence_max_per_week,
      governance_pip_checkin_days: GOVERNANCE_DEFAULTS.governance_pip_checkin_days,
      governance_growth_checkin_days: GOVERNANCE_DEFAULTS.governance_growth_checkin_days,
      governance_escalation_probation_first_hours: GOVERNANCE_DEFAULTS.governance_escalation_probation_first_hours,
      governance_escalation_probation_second_hours: GOVERNANCE_DEFAULTS.governance_escalation_probation_second_hours,
      governance_goal_coaching_threshold_days: GOVERNANCE_DEFAULTS.governance_goal_coaching_threshold_days,
      governance_nudge_sweep_enabled: GOVERNANCE_DEFAULTS.governance_nudge_sweep_enabled,
    },
  });

  useEffect(() => {
    if (data) {
      form.reset(parseValues(data.values));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const isDirty = form.formState.isDirty;

  const saveMutation = useMutation({
    mutationFn: async (values: SettingsForm) => {
      const res = await apiRequest("PATCH", "/api/system/governance-settings", {
        ...values,
        governance_nudge_sweep_enabled: values.governance_nudge_sweep_enabled,
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/system/governance-settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/governance/pulse"] });
      toast({
        title: "Governance settings updated",
        description: "Changes take effect on the next sweep run.",
      });
      form.reset(form.getValues());
    },
    onError: () => toast({ title: "Failed to save settings", variant: "destructive" }),
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", "/api/system/governance-settings", {
        governance_sop_grace_days: GOVERNANCE_DEFAULTS.governance_sop_grace_days,
        governance_sop_cadence_max_per_week: GOVERNANCE_DEFAULTS.governance_sop_cadence_max_per_week,
        governance_pip_checkin_days: GOVERNANCE_DEFAULTS.governance_pip_checkin_days,
        governance_growth_checkin_days: GOVERNANCE_DEFAULTS.governance_growth_checkin_days,
        governance_escalation_probation_first_hours: GOVERNANCE_DEFAULTS.governance_escalation_probation_first_hours,
        governance_escalation_probation_second_hours: GOVERNANCE_DEFAULTS.governance_escalation_probation_second_hours,
        governance_goal_coaching_threshold_days: GOVERNANCE_DEFAULTS.governance_goal_coaching_threshold_days,
        governance_nudge_sweep_enabled: true,
      });
      if (!res.ok) throw new Error("Failed to reset");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/system/governance-settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/governance/pulse"] });
      setResetDialogOpen(false);
      toast({ title: "Governance settings reset to defaults" });
      form.reset({
        governance_sop_grace_days: GOVERNANCE_DEFAULTS.governance_sop_grace_days,
        governance_sop_cadence_max_per_week: GOVERNANCE_DEFAULTS.governance_sop_cadence_max_per_week,
        governance_pip_checkin_days: GOVERNANCE_DEFAULTS.governance_pip_checkin_days,
        governance_growth_checkin_days: GOVERNANCE_DEFAULTS.governance_growth_checkin_days,
        governance_escalation_probation_first_hours: GOVERNANCE_DEFAULTS.governance_escalation_probation_first_hours,
        governance_escalation_probation_second_hours: GOVERNANCE_DEFAULTS.governance_escalation_probation_second_hours,
        governance_goal_coaching_threshold_days: GOVERNANCE_DEFAULTS.governance_goal_coaching_threshold_days,
        governance_nudge_sweep_enabled: GOVERNANCE_DEFAULTS.governance_nudge_sweep_enabled,
      });
    },
    onError: () => toast({ title: "Failed to reset settings", variant: "destructive" }),
  });

  const meta = data?.meta ?? {};

  const NUM_FIELDS: Array<{
    key: keyof Omit<SettingsForm, "governance_nudge_sweep_enabled">;
    label: string;
    description: string;
    unit: string;
    min: number;
    max: number;
  }> = [
    {
      key: "governance_sop_grace_days",
      label: "SOP acknowledgment grace period",
      description: "Days an employee has to acknowledge a new SOP before the overdue nudge starts",
      unit: "days",
      min: 7,
      max: 60,
    },
    {
      key: "governance_sop_cadence_max_per_week",
      label: "Max SOP activations per week",
      description: "Cadence guardrail: how many SOPs can be activated in a rolling 7-day window to avoid overwhelming employees",
      unit: "",
      min: 1,
      max: 5,
    },
    {
      key: "governance_pip_checkin_days",
      label: "PIP check-in frequency",
      description: "How often the system generates a required check-in checkpoint on an active PIP",
      unit: "days",
      min: 3,
      max: 30,
    },
    {
      key: "governance_growth_checkin_days",
      label: "Growth plan check-in frequency",
      description: "Same for growth plans",
      unit: "days",
      min: 7,
      max: 60,
    },
    {
      key: "governance_escalation_probation_first_hours",
      label: "Probation first escalation",
      description: "Hours after a missed probation milestone before the manager receives an automated escalation notification",
      unit: "hours",
      min: 1,
      max: 168,
    },
    {
      key: "governance_escalation_probation_second_hours",
      label: "Probation second escalation",
      description: "Hours after the first escalation before HR is notified (strike 2)",
      unit: "hours",
      min: 1,
      max: 336,
    },
    {
      key: "governance_goal_coaching_threshold_days",
      label: "Goal coaching gap threshold",
      description: "Days without a coaching log entry on an escalated goal before it appears as a critical Action Item",
      unit: "days",
      min: 1,
      max: 30,
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-3 p-1">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }

  return (
    <Accordion type="single" collapsible className="w-full" data-testid="accordion-governance-settings">
      <AccordionItem value="governance-settings" className="border rounded-lg px-4">
        <AccordionTrigger
          className="hover:no-underline py-4"
          data-testid="trigger-governance-settings"
        >
          <div className="flex items-center gap-2 text-left">
            <Settings2 className="h-4 w-4 text-primary shrink-0" />
            <div>
              <p className="font-semibold text-sm">Governance Settings</p>
              <p className="text-xs text-muted-foreground font-normal">
                Configure enforcement cadence for SOPs, PIPs, growth plans, and probation escalations
              </p>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="pt-2 pb-2">
            {!isSuperAdmin && (
              <div className="flex items-center gap-2 mb-4 rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-sm text-blue-700">
                <Info className="h-4 w-4 shrink-0" />
                <span>These settings are read-only for your role. Contact a Super Admin to make changes.</span>
              </div>
            )}

            <form
              onSubmit={form.handleSubmit(values => saveMutation.mutate(values))}
              className="space-y-4"
            >
              <Card>
                <CardContent className="pt-5 space-y-4">
                  {NUM_FIELDS.map(field => {
                    const value = form.watch(field.key as keyof SettingsForm) as number;
                    const error = form.formState.errors[field.key as keyof SettingsForm];
                    return (
                      <FieldRow
                        key={field.key}
                        label={field.label}
                        description={field.description}
                        metaEntry={meta[field.key]}
                      >
                        {isSuperAdmin ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min={field.min}
                              max={field.max}
                              className={`w-20 text-center ${error ? "border-red-500" : ""}`}
                              data-testid={`input-gov-${field.key}`}
                              {...form.register(field.key as keyof SettingsForm, { valueAsNumber: true })}
                            />
                            {field.unit && (
                              <span className="text-xs text-muted-foreground w-8">{field.unit}</span>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-semibold text-sm" data-testid={`text-gov-${field.key}`}>{value}</span>
                            {field.unit && <span className="text-xs text-muted-foreground">{field.unit}</span>}
                          </div>
                        )}
                        {error && (
                          <p className="text-xs text-red-500 mt-0.5">
                            {String(error.message)}
                          </p>
                        )}
                      </FieldRow>
                    );
                  })}

                  <FieldRow
                    label="Compliance sweep nudge emails"
                    description="When enabled, the daily sweep sends automated nudge emails to employees with overdue SOPs"
                    metaEntry={meta["governance_nudge_sweep_enabled"]}
                  >
                    {isSuperAdmin ? (
                      <Switch
                        checked={form.watch("governance_nudge_sweep_enabled")}
                        onCheckedChange={v => form.setValue("governance_nudge_sweep_enabled", v, { shouldDirty: true })}
                        data-testid="switch-gov-nudge-sweep"
                      />
                    ) : (
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          form.watch("governance_nudge_sweep_enabled")
                            ? "bg-green-100 text-green-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                        data-testid="text-gov-nudge-sweep"
                      >
                        {form.watch("governance_nudge_sweep_enabled") ? "Enabled" : "Disabled"}
                      </span>
                    )}
                  </FieldRow>
                </CardContent>
              </Card>

              {isSuperAdmin && (
                <div className="flex items-center gap-3 pt-1">
                  <Button
                    type="submit"
                    disabled={!isDirty || saveMutation.isPending}
                    data-testid="button-save-governance-settings"
                  >
                    {saveMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setResetDialogOpen(true)}
                    disabled={saveMutation.isPending || resetMutation.isPending}
                    data-testid="button-reset-governance-settings"
                  >
                    Reset to Defaults
                  </Button>
                </div>
              )}
            </form>
          </div>
        </AccordionContent>
      </AccordionItem>

      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset governance settings?</DialogTitle>
            <DialogDescription>
              This will reset all 8 governance cadence settings to their system defaults. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialogOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => resetMutation.mutate()}
              disabled={resetMutation.isPending}
              data-testid="button-confirm-reset-governance"
            >
              {resetMutation.isPending ? "Resetting..." : "Reset to Defaults"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Accordion>
  );
}
