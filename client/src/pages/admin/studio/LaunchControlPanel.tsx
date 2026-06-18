import { useQuery, useMutation } from "@tanstack/react-query";
import {
  CheckCircle2,
  Loader2,
  Rocket,
  BookOpen,
  Megaphone,
  ChevronRight,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

interface RoutingPoolEntry {
  category: string;
  team: string;
  pool: number;
  fellBack: boolean;
}

interface LaunchStatus {
  articlesLoaded: number;
  articlesRouted: number;
  announced: boolean;
  routingPoolSummary: RoutingPoolEntry[];
  canControl: boolean;
}

export function LaunchControlPanel() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: status, isLoading } = useQuery<LaunchStatus>({
    queryKey: ["/api/admin/studio/insights-launch/status"],
    refetchInterval: false,
  });

  const loadArticles = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/studio/insights-launch/load");
      return res.json();
    },
    onSuccess: (data: { articlesLoaded?: number; inserted?: number }) => {
      toast({
        title: "Pilot articles loaded",
        description: `${data?.articlesLoaded ?? 0} articles ready as drafts. Routing rules written.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/insights-launch/status"] });
    },
    onError: (err: Error) => {
      toast({
        title: "Could not load articles",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const announceAndRoute = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/studio/insights-launch/announce-and-route");
      return res.json();
    },
    onSuccess: (data: { notified?: number; assigned?: number }) => {
      toast({
        title: "Launch announced & articles routed",
        description: `Team notified (${data?.notified ?? 0} users). ${data?.assigned ?? 0} articles assigned to reviewers.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/insights-launch/status"] });
    },
    onError: (err: Error) => {
      toast({
        title: "Could not announce launch",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  if (user?.role !== "super_admin") return null;

  const step1Done = (status?.articlesLoaded ?? 0) > 0;
  const step2Done = !!status?.announced;
  const bothDone = step1Done && step2Done;

  return (
    <div className="border-t pt-4 space-y-4" data-testid="section-launch-control-panel">
      <div className="flex items-center gap-2">
        <Rocket className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold" data-testid="text-launch-control-heading">
          Pilot Launch Control
        </h2>
        {bothDone && (
          <Badge variant="secondary" className="gap-1 ml-auto" data-testid="badge-launch-complete">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
            Launch complete
          </Badge>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        Two-step controlled launch. No emails, assignments, or notifications fire automatically — only when you trigger them here.
      </p>

      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" data-testid="spinner-launch-status" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Step 1 */}
          <Card
            className={step1Done ? "border-green-200 bg-green-50/40 dark:border-green-800 dark:bg-green-950/20" : ""}
            data-testid="card-step1-load"
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                  1
                </span>
                <BookOpen className="h-4 w-4" />
                Load pilot articles
              </CardTitle>
              <CardDescription className="text-xs">
                Seeds 13 articles as drafts and writes Senior+ routing rules. No emails. Safe to re-run.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {step1Done ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-sm text-green-700 dark:text-green-400 font-medium" data-testid="text-step1-done">
                    <CheckCircle2 className="h-4 w-4" />
                    {status?.articlesLoaded} articles loaded as drafts
                  </div>
                  {(status?.routingPoolSummary?.length ?? 0) > 0 && (
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <div className="font-medium mb-1 flex items-center gap-1">
                        <Users className="h-3 w-3" /> Routing pool per category:
                      </div>
                      {status!.routingPoolSummary.map((entry) => (
                        <div key={entry.category} className="flex justify-between" data-testid={`text-pool-${entry.team}`}>
                          <span className="truncate max-w-[160px]">{entry.category}</span>
                          <span className="font-medium ml-2">
                            {entry.pool} reviewer{entry.pool !== 1 ? "s" : ""}
                            {entry.fellBack ? " (fallback)" : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 w-full text-xs"
                    onClick={() => loadArticles.mutate()}
                    disabled={loadArticles.isPending}
                    data-testid="button-reload-articles"
                  >
                    {loadArticles.isPending ? (
                      <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                    ) : null}
                    Re-run (idempotent)
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => loadArticles.mutate()}
                  disabled={loadArticles.isPending}
                  data-testid="button-load-articles"
                >
                  {loadArticles.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <BookOpen className="mr-2 h-4 w-4" />
                  )}
                  Load pilot articles
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Step 2 */}
          <Card
            className={
              step2Done
                ? "border-green-200 bg-green-50/40 dark:border-green-800 dark:bg-green-950/20"
                : !step1Done
                  ? "opacity-50"
                  : ""
            }
            data-testid="card-step2-announce"
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                  2
                </span>
                <Megaphone className="h-4 w-4" />
                Send announcement &amp; route
              </CardTitle>
              <CardDescription className="text-xs">
                Sends team announcement email + in-app notification, then moves articles to review and emails assigned reviewers. One-time only.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              {step2Done ? (
                <div className="flex items-center gap-1 text-sm text-green-700 dark:text-green-400 font-medium" data-testid="text-step2-done">
                  <CheckCircle2 className="h-4 w-4" />
                  Announced — {status?.articlesRouted ?? 0} articles routed to reviewers
                </div>
              ) : (
                <div className="space-y-2">
                  {!step1Done && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground" data-testid="text-step2-waiting">
                      <ChevronRight className="h-3 w-3" />
                      Complete Step 1 first
                    </div>
                  )}
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => announceAndRoute.mutate()}
                    disabled={!step1Done || announceAndRoute.isPending}
                    data-testid="button-announce-and-route"
                  >
                    {announceAndRoute.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Megaphone className="mr-2 h-4 w-4" />
                    )}
                    Send announcement &amp; route
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
