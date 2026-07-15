/**
 * Task #1115 — My Pipeline view.
 * Recruiter's personal submission tracker with stage management.
 */
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  CheckCircle2,
  Clock,
  Phone,
  Monitor,
  Trophy,
  XCircle,
  RotateCcw,
  FileText,
  ChevronDown,
  CalendarIcon,
  Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

const STAGES = [
  { value: "submitted", label: "Submitted", icon: FileText, color: "bg-slate-100 text-slate-700 border-slate-200" },
  { value: "phone_screen", label: "Phone Screen", icon: Phone, color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "technical_interview", label: "Technical Interview", icon: Monitor, color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  { value: "final_interview", label: "Final Interview", icon: Users, color: "bg-purple-100 text-purple-700 border-purple-200" },
  { value: "offer_made", label: "Offer Made", icon: CheckCircle2, color: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "placed", label: "Placed ✅", icon: Trophy, color: "bg-green-100 text-green-700 border-green-200" },
  { value: "rejected", label: "Rejected", icon: XCircle, color: "bg-red-100 text-red-700 border-red-200" },
  { value: "withdrawn", label: "Withdrawn", icon: RotateCcw, color: "bg-gray-100 text-gray-700 border-gray-200" },
] as const;

type Stage = typeof STAGES[number]["value"];

interface Application {
  id: string;
  candidateName: string;
  email: string;
  phone: string;
  jobId: string | null;
  status: string;
  stage: string;
  stageUpdatedAt: string | null;
  placementDate: string | null;
  createdAt: string;
  updatedAt: string;
}

function daysSince(dateStr: string | null): number {
  if (!dateStr) return 0;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function StageChip({ stage }: { stage: string }) {
  const def = STAGES.find((s) => s.value === stage);
  if (!def) return <Badge variant="outline">{stage}</Badge>;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${def.color}`}>
      <def.icon className="h-3 w-3" />
      {def.label}
    </span>
  );
}

export default function MyPipeline() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeFilter, setActiveFilter] = useState<Stage | "all" | "closed">("all");
  const [placementModal, setPlacementModal] = useState<{ appId: string; candidateName: string } | null>(null);
  const [placementDate, setPlacementDate] = useState(new Date().toISOString().split("T")[0]);

  const { data: pipeline = [], isLoading } = useQuery<Application[]>({
    queryKey: ["/api/recruiter/pipeline"],
    refetchInterval: 60000,
  });

  const stageMutation = useMutation({
    mutationFn: ({ id, stage, placementDate }: { id: string; stage: string; placementDate?: string }) =>
      apiRequest("PATCH", `/api/recruiter/applications/${id}/stage`, { stage, placementDate }),
    onSuccess: (_, { stage }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/recruiter/pipeline"] });
      setPlacementModal(null);
      toast({ title: "Stage updated", description: stage === "placed" ? "🎉 Placement recorded!" : "Application stage saved." });
    },
    onError: (err: any) => {
      toast({ title: "Update failed", description: err.message || "Could not update stage", variant: "destructive" });
    },
  });

  function handleStageChange(appId: string, candidateName: string, newStage: string) {
    if (newStage === "placed") {
      setPlacementDate(new Date().toISOString().split("T")[0]);
      setPlacementModal({ appId, candidateName });
      return;
    }
    stageMutation.mutate({ id: appId, stage: newStage });
  }

  function confirmPlacement() {
    if (!placementModal) return;
    stageMutation.mutate({
      id: placementModal.appId,
      stage: "placed",
      placementDate,
    });
  }

  const filtered = activeFilter === "all"
    ? pipeline
    : activeFilter === "closed"
    ? pipeline.filter((a) => a.stage === "rejected" || a.stage === "withdrawn")
    : pipeline.filter((a) => a.stage === activeFilter);

  const stageCounts = pipeline.reduce<Record<string, number>>((acc, app) => {
    acc[app.stage] = (acc[app.stage] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4" data-testid="my-pipeline-view">
      <div>
        <h2 className="text-lg font-semibold">My Pipeline</h2>
        <p className="text-sm text-muted-foreground">Your submission tracker — {pipeline.length} total</p>
      </div>

      {/* Stage filter tabs */}
      <div className="flex items-center gap-1 flex-wrap border-b border-border pb-1">
        <button
          onClick={() => setActiveFilter("all")}
          className={`px-3 py-1.5 text-xs font-medium rounded-t transition-colors ${
            activeFilter === "all"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          data-testid="pipeline-filter-all"
        >
          All ({pipeline.length})
        </button>
        {STAGES.filter((s) => !["rejected", "withdrawn"].includes(s.value)).map((s) => {
          const count = stageCounts[s.value] || 0;
          if (count === 0 && activeFilter !== s.value) return null;
          return (
            <button
              key={s.value}
              onClick={() => setActiveFilter(s.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-t transition-colors flex items-center gap-1 ${
                activeFilter === s.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`pipeline-filter-${s.value}`}
            >
              {s.label} {count > 0 && <span className="font-mono">({count})</span>}
            </button>
          );
        })}
        {/* Closed section — shows rejected AND withdrawn together */}
        {(stageCounts["rejected"] || 0) + (stageCounts["withdrawn"] || 0) > 0 && (
          <button
            onClick={() => setActiveFilter(activeFilter === "closed" ? "all" : "closed")}
            className={`px-3 py-1.5 text-xs font-medium rounded-t transition-colors ${
              activeFilter === "closed"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid="pipeline-filter-closed"
          >
            Closed ({(stageCounts["rejected"] || 0) + (stageCounts["withdrawn"] || 0)})
          </button>
        )}
      </div>

      {/* Applications table */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground" data-testid="pipeline-empty">
          <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">No submissions yet</p>
          <p className="text-xs mt-1">Submissions you log will appear here</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm" data-testid="pipeline-table">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Candidate</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground hidden md:table-cell">Stage</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground hidden sm:table-cell">Days in Stage</th>
                <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Advance To</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((app) => {
                const daysInStage = daysSince(app.stageUpdatedAt || app.createdAt);
                const isPlaced = app.stage === "placed";
                return (
                  <tr
                    key={app.id}
                    className="hover:bg-muted/30 transition-colors"
                    data-testid={`pipeline-row-${app.id}`}
                  >
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-foreground">{app.candidateName}</p>
                      <p className="text-xs text-muted-foreground">{app.email}</p>
                      {/* Show stage chip on mobile */}
                      <div className="md:hidden mt-1">
                        <StageChip stage={app.stage} />
                      </div>
                    </td>
                    <td className="px-3 py-2.5 hidden md:table-cell">
                      <StageChip stage={app.stage} />
                      {isPlaced && app.placementDate && (
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <CalendarIcon className="h-3 w-3" />
                          {new Date(app.placementDate + "T00:00:00").toLocaleDateString()}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2.5 hidden sm:table-cell">
                      <span className={`text-xs ${daysInStage > 14 ? "text-amber-600 font-medium" : "text-muted-foreground"}`}>
                        {daysInStage === 0 ? "Today" : `${daysInStage}d`}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {isPlaced ? (
                        <span className="text-xs text-green-600 font-medium">✓ Placed</span>
                      ) : (
                        <Select
                          value={app.stage}
                          onValueChange={(val) => handleStageChange(app.id, app.candidateName, val)}
                          disabled={stageMutation.isPending}
                        >
                          <SelectTrigger
                            className="h-7 text-xs w-[140px] ml-auto"
                            data-testid={`pipeline-stage-select-${app.id}`}
                          >
                            <SelectValue placeholder="Move to…" />
                            <ChevronDown className="h-3 w-3 opacity-50" />
                          </SelectTrigger>
                          <SelectContent>
                            {STAGES.map((s) => (
                              <SelectItem key={s.value} value={s.value} className="text-xs">
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Placement date modal */}
      <Dialog open={!!placementModal} onOpenChange={(open) => !open && setPlacementModal(null)}>
        <DialogContent className="sm:max-w-sm" data-testid="placement-date-modal">
          <DialogHeader>
            <DialogTitle>🎉 Record Placement</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              <strong>{placementModal?.candidateName}</strong> — when did they start / get placed?
            </p>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground flex items-center gap-1">
                <CalendarIcon className="h-3.5 w-3.5" /> Placement Date
              </label>
              <Input
                type="date"
                value={placementDate}
                onChange={(e) => setPlacementDate(e.target.value)}
                className="h-8"
                data-testid="placement-date-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPlacementModal(null)}
              data-testid="placement-cancel-btn"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={confirmPlacement}
              disabled={stageMutation.isPending || !placementDate}
              data-testid="placement-confirm-btn"
            >
              {stageMutation.isPending ? "Saving…" : "Record Placement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
