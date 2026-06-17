import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Trash2, Save, X } from "lucide-react";

interface Reviewer {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
}

interface RoutingConfig {
  projectId: string;
  strategy: "least_recently_assigned" | "round_robin";
  defaultReviewerUserIds: string[];
  rules: { category: string; reviewerUserIds: string[] }[];
}

function reviewerName(r: Reviewer) {
  const name = `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim();
  return name || r.email;
}

function ReviewerPicker({
  reviewers,
  selected,
  onChange,
  testIdPrefix,
}: {
  reviewers: Reviewer[];
  selected: string[];
  onChange: (ids: string[]) => void;
  testIdPrefix: string;
}) {
  const available = reviewers.filter((r) => !selected.includes(r.id));
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {selected.length === 0 && (
          <span className="text-xs text-muted-foreground">No reviewers selected</span>
        )}
        {selected.map((id) => {
          const r = reviewers.find((x) => x.id === id);
          return (
            <Badge key={id} variant="secondary" className="gap-1" data-testid={`${testIdPrefix}-chip-${id}`}>
              {r ? reviewerName(r) : id}
              <button
                type="button"
                onClick={() => onChange(selected.filter((x) => x !== id))}
                className="ml-0.5 rounded-full hover:text-destructive"
                data-testid={`${testIdPrefix}-remove-${id}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          );
        })}
      </div>
      <Select value="" onValueChange={(v) => v && onChange([...selected, v])}>
        <SelectTrigger className="h-8 w-[220px]" data-testid={`${testIdPrefix}-add`}>
          <SelectValue placeholder="Add reviewer…" />
        </SelectTrigger>
        <SelectContent>
          {available.length === 0 ? (
            <SelectItem value="__none" disabled>
              No more reviewers
            </SelectItem>
          ) : (
            available.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {reviewerName(r)}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
}

export function RoutingSettings({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const [strategy, setStrategy] = useState<RoutingConfig["strategy"]>("least_recently_assigned");
  const [defaultReviewers, setDefaultReviewers] = useState<string[]>([]);
  const [rules, setRules] = useState<{ category: string; reviewerUserIds: string[] }[]>([]);

  const { data: reviewers } = useQuery<Reviewer[]>({
    queryKey: ["/api/admin/studio/reviewers"],
  });

  const { data: config, isLoading } = useQuery<RoutingConfig>({
    queryKey: ["/api/admin/studio/projects", projectId, "routing"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/studio/projects/${projectId}/routing`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load routing config");
      return res.json();
    },
    enabled: !!projectId,
  });

  useEffect(() => {
    if (config) {
      setStrategy(config.strategy ?? "least_recently_assigned");
      setDefaultReviewers(config.defaultReviewerUserIds ?? []);
      setRules(config.rules ?? []);
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", `/api/admin/studio/projects/${projectId}/routing`, {
        strategy,
        defaultReviewerUserIds: defaultReviewers,
        rules: rules
          .map((r) => ({ category: r.category.trim(), reviewerUserIds: r.reviewerUserIds }))
          .filter((r) => r.category),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/studio/projects", projectId, "routing"],
      });
      toast({ title: "Routing rules saved" });
    },
    onError: (err: Error) => {
      toast({ title: "Could not save", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading || !reviewers) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Routing strategy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label>How to pick from a pool</Label>
          <Select value={strategy} onValueChange={(v) => setStrategy(v as RoutingConfig["strategy"])}>
            <SelectTrigger className="w-[280px]" data-testid="select-strategy">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="least_recently_assigned">Least recently assigned</SelectItem>
              <SelectItem value="round_robin">Round robin</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            When an article enters review, the reviewer in the matching pool who was assigned
            longest ago (or never) is chosen.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Category rules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {rules.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No category rules yet. Add one to route specific categories to a reviewer pool.
            </p>
          )}
          {rules.map((rule, idx) => (
            <div
              key={idx}
              className="space-y-3 rounded-lg border p-4"
              data-testid={`rule-${idx}`}
            >
              <div className="flex items-center gap-2">
                <Input
                  value={rule.category}
                  onChange={(e) => {
                    const next = [...rules];
                    next[idx] = { ...next[idx], category: e.target.value };
                    setRules(next);
                  }}
                  placeholder="Category (e.g. Healthcare)"
                  className="max-w-xs"
                  data-testid={`input-rule-category-${idx}`}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  onClick={() => setRules(rules.filter((_, i) => i !== idx))}
                  data-testid={`button-remove-rule-${idx}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <ReviewerPicker
                reviewers={reviewers}
                selected={rule.reviewerUserIds}
                onChange={(ids) => {
                  const next = [...rules];
                  next[idx] = { ...next[idx], reviewerUserIds: ids };
                  setRules(next);
                }}
                testIdPrefix={`rule-${idx}`}
              />
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRules([...rules, { category: "", reviewerUserIds: [] }])}
            data-testid="button-add-rule"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add category rule
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Default reviewer pool</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Used when an article's category does not match any rule (or has no category).
          </p>
          <ReviewerPicker
            reviewers={reviewers}
            selected={defaultReviewers}
            onChange={setDefaultReviewers}
            testIdPrefix="default"
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          data-testid="button-save-routing"
        >
          {saveMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save routing rules
        </Button>
      </div>
    </div>
  );
}

export default RoutingSettings;
