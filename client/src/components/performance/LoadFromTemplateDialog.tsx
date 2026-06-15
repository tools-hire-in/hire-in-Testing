import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export interface PlanGoalTemplate {
  id: string;
  plan_type: string;
  role_slug: string;
  goal_title: string;
  goal_category: string;
  goal_description: string | null;
  target_metric: string | null;
  sort_order: number;
  is_active: boolean;
}

export const ROLE_SLUG_LABELS: Record<string, string> = {
  associate_recruiter: "Associate Recruiter",
  senior_recruiter: "Senior Recruiter",
  foundation_to_senior: "Foundation → Senior Recruiter",
  lead_recruiter: "Lead Recruiter",
  associate_manager: "Associate Manager",
  account_manager: "Account Manager",
};

export const PLAN_TYPE_LABELS: Record<string, string> = {
  probation: "Probation",
  growth: "Growth Plan",
  pip: "PIP",
};

interface TemplateMeta {
  plan_type: string;
  role_slug: string;
  department_scope: string;
}

export function LoadFromTemplateDialog({
  open,
  onOpenChange,
  onLoad,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onLoad: (templates: PlanGoalTemplate[]) => void;
}) {
  const [deptScope, setDeptScope] = useState("healthcare");
  const [planType, setPlanType] = useState("");
  const [roleSlug, setRoleSlug] = useState("");

  // Fetch distinct role slugs available for the selected dept from the DB
  const { data: metaRows = [] } = useQuery<TemplateMeta[]>({
    queryKey: ["/api/hr/plan-templates/meta", deptScope],
    queryFn: async () => {
      const params = new URLSearchParams({ department_scope: deptScope });
      const res = await fetch(`/api/hr/plan-templates/meta?${params}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Derive unique role slugs available for the currently selected plan type
  const availableRoles = Array.from(
    new Set(
      metaRows
        .filter((m) => !planType || m.plan_type === planType)
        .map((m) => m.role_slug)
    )
  );

  // Clear role if it's no longer valid after planType change
  const effectiveRole = availableRoles.includes(roleSlug) ? roleSlug : "";

  const { data: templates = [], isLoading } = useQuery<PlanGoalTemplate[]>({
    queryKey: ["/api/hr/plan-templates", deptScope, planType, effectiveRole],
    queryFn: async () => {
      if (!planType && !effectiveRole) return [];
      const params = new URLSearchParams();
      params.set("department_scope", deptScope);
      if (planType) params.set("plan_type", planType);
      if (effectiveRole) params.set("role_slug", effectiveRole);
      const res = await fetch(`/api/hr/plan-templates?${params}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!(planType || effectiveRole),
  });

  function handleLoad() {
    onLoad(templates);
    onOpenChange(false);
    setPlanType("");
    setRoleSlug("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" /> Load from Template
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Select a department, plan type and role to load predefined goal templates as table rows.
          </p>
          <div className="space-y-1.5">
            <Label className="text-xs">Department</Label>
            <Select value={deptScope} onValueChange={setDeptScope}>
              <SelectTrigger data-testid="select-template-dept-scope">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="healthcare">Healthcare</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Plan Type</Label>
              <Select value={planType} onValueChange={setPlanType}>
                <SelectTrigger data-testid="select-template-plan-type">
                  <SelectValue placeholder="Select plan..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="probation">Probation</SelectItem>
                  <SelectItem value="growth">Growth Plan</SelectItem>
                  <SelectItem value="pip">PIP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Role</Label>
              <Select
                value={effectiveRole}
                onValueChange={setRoleSlug}
                disabled={availableRoles.length === 0}
              >
                <SelectTrigger data-testid="select-template-role">
                  <SelectValue placeholder={availableRoles.length === 0 ? "No roles available" : "Select role..."} />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map((slug) => (
                    <SelectItem key={slug} value={slug}>
                      {ROLE_SLUG_LABELS[slug] ?? slug}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading && <p className="text-xs text-muted-foreground">Loading templates…</p>}

          {!isLoading && (planType || roleSlug) && templates.length === 0 && (
            <p className="text-xs text-amber-600">No active templates found for this selection.</p>
          )}

          {templates.length > 0 && (
            <div className="border rounded-md overflow-hidden">
              <div className="bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                {templates.length} template{templates.length !== 1 ? "s" : ""} will be loaded
              </div>
              <div className="max-h-48 overflow-y-auto divide-y">
                {templates.map((t) => (
                  <div key={t.id} className="px-3 py-2 space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium">{t.goal_title}</span>
                      <Badge variant="outline" className="text-[10px] h-4 px-1">
                        {t.goal_category}
                      </Badge>
                    </div>
                    {t.target_metric && (
                      <p className="text-[11px] text-muted-foreground">Target: {t.target_metric}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleLoad}
            disabled={templates.length === 0}
            data-testid="button-load-templates"
          >
            Load {templates.length > 0 ? `${templates.length} Template${templates.length !== 1 ? "s" : ""}` : "Templates"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
