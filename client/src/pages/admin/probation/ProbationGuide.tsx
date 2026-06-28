import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ShieldCheck,
  CalendarClock,
  ClipboardCheck,
  Target,
  Gauge,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  PROBATION_CADENCE_DAYS,
  isFormalMilestoneDay,
  type ProbationWeight,
} from "@shared/probation";

interface ScoringBand {
  id?: string;
  min_score: number;
  max_score: number;
  label: string;
  recommended_outcome?: string | null;
  meaning?: string | null;
}

interface ScoringResponse {
  bands: ScoringBand[];
  passRule: any;
  finalWeights: ProbationWeight[] | null;
  source: string;
}

function passRuleMin(passRule: any): number | null {
  if (!passRule || typeof passRule !== "object") return null;
  const v = passRule.minScore ?? passRule.min_overall ?? passRule.minOverall ?? passRule.pass_min ?? passRule.min;
  return typeof v === "number" ? v : null;
}

export default function ProbationGuide() {
  const { data, isLoading } = useQuery<ScoringResponse>({
    queryKey: ["/api/hr/probation-scoring-bands"],
  });

  const weights = data?.finalWeights ?? [];
  const bands = data?.bands ?? [];
  const passMin = passRuleMin(data?.passRule);
  const totalWeight = weights.reduce((sum, w) => sum + Number(w.weight), 0);

  return (
    <AdminLayout>
      <div className="v2-surface p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
              <ShieldCheck className="h-6 w-6 text-primary" />
              90-Day Probation Guide
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              As the owning manager you are accountable for running this plan to completion.
            </p>
          </div>
          <Link href="/admin/performance/check-ins">
            <Button data-testid="button-open-checkins">
              Open Check-Ins
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </div>

        {/* Manager responsibilities */}
        <Card data-testid="card-responsibilities">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              Your responsibilities
            </CardTitle>
            <CardDescription>What every probation owner is expected to do.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
              <li>Run every check-in on cadence — Day 1, 7, 15, 30, 45, 60, 75 and 90.</li>
              <li>Complete the formal milestone scorecards at Day 30, 60 and 90.</li>
              <li>Log clear notes and evidence at every check-in (notes are required to mark one complete).</li>
              <li>Surface concerns early — missed milestones escalate to HR and your manager.</li>
              <li>Record the final recommendation at Day 90.</li>
            </ul>
          </CardContent>
        </Card>

        {/* Cadence */}
        <Card data-testid="card-cadence">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarClock className="h-5 w-5 text-primary" />
              Check-in cadence
            </CardTitle>
            <CardDescription>
              Formal milestones require a scored review. Pulse check-ins are lightweight coaching conversations.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {PROBATION_CADENCE_DAYS.map((day) => {
                const formal = isFormalMilestoneDay(day);
                return (
                  <div
                    key={day}
                    data-testid={`cadence-day-${day}`}
                    className={`rounded-lg border px-3 py-2 text-center min-w-[72px] ${
                      formal
                        ? "border-primary/40 bg-primary/5"
                        : "border-border bg-muted/30"
                    }`}
                  >
                    <p className="text-sm font-semibold">Day {day}</p>
                    <Badge
                      variant="outline"
                      className={`mt-1 text-[10px] ${formal ? "border-primary/50 text-primary" : "text-muted-foreground"}`}
                    >
                      {formal ? "Milestone" : "Pulse"}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Scoring areas */}
        <Card data-testid="card-scoring-areas">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Target className="h-5 w-5 text-primary" />
              How milestones are scored
            </CardTitle>
            <CardDescription>
              Each milestone review scores these weighted areas (0–100). The weighted average is the overall score.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading scoring model…
              </div>
            ) : weights.length === 0 ? (
              <p className="text-sm text-muted-foreground">No scoring areas are configured yet.</p>
            ) : (
              <div className="space-y-2">
                {weights.map((w) => (
                  <div
                    key={w.area}
                    data-testid={`weight-${w.area}`}
                    className="flex items-center justify-between gap-3 rounded-md border p-3"
                  >
                    <span className="text-sm font-medium">{w.area}</span>
                    <Badge variant="secondary">{w.weight}%</Badge>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-3 px-3 pt-1 text-xs text-muted-foreground">
                  <span>Total weight</span>
                  <span className={totalWeight === 100 ? "" : "text-amber-600 font-medium"}>{totalWeight}%</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bands + pass rule */}
        <Card data-testid="card-bands">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Gauge className="h-5 w-5 text-primary" />
              Score bands &amp; outcomes
            </CardTitle>
            {passMin != null && (
              <CardDescription>
                Pass threshold: an overall score of <strong>{passMin}</strong> or above is required to confirm.
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading bands…
              </div>
            ) : bands.length === 0 ? (
              <p className="text-sm text-muted-foreground">No score bands are configured yet.</p>
            ) : (
              <div className="space-y-2">
                {bands.map((b, i) => (
                  <div
                    key={b.id ?? i}
                    data-testid={`band-${i}`}
                    className="rounded-md border p-3"
                  >
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <span className="text-sm font-semibold">{b.label}</span>
                      <Badge variant="outline">
                        {b.min_score}–{b.max_score}
                      </Badge>
                    </div>
                    {b.recommended_outcome && (
                      <p className="text-xs text-primary mt-1">Recommended: {b.recommended_outcome}</p>
                    )}
                    {b.meaning && (
                      <p className="text-xs text-muted-foreground mt-1">{b.meaning}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
