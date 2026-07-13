import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { StudioShell } from "@/components/studio/StudioShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  ThumbsUp,
  ThumbsDown,
  BarChart3,
  Globe,
  Zap,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { FEEDBACK_REASON_LABELS, type FeedbackReasonCode } from "@shared/agentIntelligenceContracts";

type Days = 7 | 30 | 90;

interface FeedbackSummary {
  days: number;
  byAgent: Record<string, number>;
  positiveRatings: number;
  negativeRatings: number;
  topNegativeReasons: Array<{ reasonCode: string; count: number }>;
  contentOutcomes: Record<string, number>;
  bdActions: Record<string, number>;
  byDomain: Record<string, number>;
}

const CONTENT_OUTCOME_LABELS: Record<string, string> = {
  ACCEPTED: "Accepted",
  EDITED_THEN_ACCEPTED: "Edited then accepted",
  DISCARDED: "Discarded",
  REGENERATED: "Regenerated",
  SENT_FOR_REVIEW: "Sent for review",
  PUBLISHED: "Published",
};

const BD_ACTION_LABELS: Record<string, string> = {
  SAVED_AS_CONTENT_IDEA: "Saved as idea",
  CREATED_CLIENT_DECK: "Created deck",
  USED_IN_CALL: "Used in call",
  USED_IN_DECK: "Used in deck",
  COPIED: "Copied",
};

const DOMAIN_LABELS: Record<string, string> = {
  healthcare: "Healthcare",
  it: "IT / Technology",
  engineering: "Engineering",
  professional_services: "Professional Services",
  general: "General",
  cross_domain: "Cross-Domain",
};

const AGENT_LABELS: Record<string, string> = {
  BD_AGENT: "BD Agent",
  CONTENT_COPILOT: "Content Copilot",
};

function StatCard({
  icon,
  label,
  value,
  loading,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  loading: boolean;
  accent?: "green" | "red" | "blue";
}) {
  const accentClass =
    accent === "green"
      ? "text-emerald-600"
      : accent === "red"
      ? "text-rose-600"
      : "text-primary";

  return (
    <div className="flex flex-col gap-1 rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wide">
        <span className={accentClass}>{icon}</span>
        {label}
      </div>
      {loading ? (
        <Skeleton className="h-8 w-16 mt-1" />
      ) : (
        <span className={`text-2xl font-bold ${accentClass}`}>{value}</span>
      )}
    </div>
  );
}

function SectionCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <span className="text-primary">{icon}</span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function BarRow({
  label,
  count,
  max,
  badge,
}: {
  label: string;
  count: number;
  max: number;
  badge?: React.ReactNode;
}) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-1.5" data-testid="bar-row">
      <span className="w-40 shrink-0 text-sm text-muted-foreground truncate">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 shrink-0 text-right text-sm font-medium">{count}</span>
      {badge}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <p className="text-sm text-muted-foreground py-2 text-center">{label}</p>
  );
}

export default function FeedbackInsightsPage() {
  const [days, setDays] = useState<Days>(30);

  const { data, isLoading } = useQuery<FeedbackSummary>({
    queryKey: ["/api/admin/agent-feedback/summary", days],
    queryFn: async () => {
      const res = await fetch(`/api/admin/agent-feedback/summary?days=${days}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load feedback summary");
      return res.json();
    },
  });

  const totalRatings = (data?.positiveRatings ?? 0) + (data?.negativeRatings ?? 0);
  const satisfactionPct =
    totalRatings > 0
      ? Math.round(((data?.positiveRatings ?? 0) / totalRatings) * 100)
      : null;

  const maxNegReason = Math.max(
    ...(data?.topNegativeReasons ?? []).map((r) => r.count),
    1,
  );

  const contentOutcomeEntries = Object.entries(data?.contentOutcomes ?? {}).sort(
    (a, b) => b[1] - a[1],
  );
  const maxContentOutcome = Math.max(...contentOutcomeEntries.map(([, c]) => c), 1);

  const bdActionEntries = Object.entries(data?.bdActions ?? {}).sort(
    (a, b) => b[1] - a[1],
  );
  const maxBdAction = Math.max(...bdActionEntries.map(([, c]) => c), 1);

  const domainEntries = Object.entries(data?.byDomain ?? {}).sort(
    (a, b) => b[1] - a[1],
  );
  const maxDomain = Math.max(...domainEntries.map(([, c]) => c), 1);

  const agentEntries = Object.entries(data?.byAgent ?? {}).sort(
    (a, b) => b[1] - a[1],
  );

  return (
    <StudioShell>
      <div className="space-y-6 p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold" data-testid="heading-feedback-insights">
              Feedback Insights
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Agent quality signals from ratings and content actions
            </p>
          </div>

          {/* Date range picker */}
          <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1" data-testid="date-range-picker">
            {([7, 30, 90] as Days[]).map((d) => (
              <Button
                key={d}
                variant={days === d ? "default" : "ghost"}
                size="sm"
                className="h-7 px-3 text-xs"
                onClick={() => setDays(d)}
                data-testid={`button-days-${d}`}
              >
                {d}d
              </Button>
            ))}
          </div>
        </div>

        {/* Top stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            icon={<ThumbsUp className="h-3.5 w-3.5" />}
            label="Positive"
            value={data?.positiveRatings ?? 0}
            loading={isLoading}
            accent="green"
          />
          <StatCard
            icon={<ThumbsDown className="h-3.5 w-3.5" />}
            label="Negative"
            value={data?.negativeRatings ?? 0}
            loading={isLoading}
            accent="red"
          />
          <StatCard
            icon={<BarChart3 className="h-3.5 w-3.5" />}
            label="Total ratings"
            value={totalRatings}
            loading={isLoading}
          />
          <StatCard
            icon={<BarChart3 className="h-3.5 w-3.5" />}
            label="Satisfaction"
            value={satisfactionPct !== null ? `${satisfactionPct}%` : "—"}
            loading={isLoading}
            accent={satisfactionPct !== null && satisfactionPct >= 70 ? "green" : "red"}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Top negative reasons */}
          <SectionCard
            icon={<AlertTriangle className="h-4 w-4" />}
            title="Top negative reasons"
          >
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-7 w-full" />
                ))}
              </div>
            ) : (data?.topNegativeReasons ?? []).length === 0 ? (
              <EmptyState label="No negative ratings in this period" />
            ) : (
              <div data-testid="list-negative-reasons">
                {(data?.topNegativeReasons ?? []).map((r) => (
                  <BarRow
                    key={r.reasonCode}
                    label={
                      FEEDBACK_REASON_LABELS[r.reasonCode as FeedbackReasonCode] ??
                      r.reasonCode
                    }
                    count={r.count}
                    max={maxNegReason}
                    badge={
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {r.reasonCode}
                      </Badge>
                    }
                  />
                ))}
              </div>
            )}
          </SectionCard>

          {/* By agent */}
          <SectionCard
            icon={<Zap className="h-4 w-4" />}
            title="Events by agent"
          >
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-7 w-full" />
                <Skeleton className="h-7 w-full" />
              </div>
            ) : agentEntries.length === 0 ? (
              <EmptyState label="No events in this period" />
            ) : (
              <div data-testid="list-by-agent">
                {agentEntries.map(([agent, count]) => (
                  <BarRow
                    key={agent}
                    label={AGENT_LABELS[agent] ?? agent}
                    count={count}
                    max={Math.max(...agentEntries.map(([, c]) => c), 1)}
                  />
                ))}
              </div>
            )}
          </SectionCard>

          {/* Content outcomes */}
          <SectionCard
            icon={<FileText className="h-4 w-4" />}
            title="Content outcomes"
          >
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-7 w-full" />
                ))}
              </div>
            ) : contentOutcomeEntries.length === 0 ? (
              <EmptyState label="No content outcome events in this period" />
            ) : (
              <div data-testid="list-content-outcomes">
                {contentOutcomeEntries.map(([event, count]) => (
                  <BarRow
                    key={event}
                    label={CONTENT_OUTCOME_LABELS[event] ?? event}
                    count={count}
                    max={maxContentOutcome}
                  />
                ))}
              </div>
            )}
          </SectionCard>

          {/* BD actions */}
          <SectionCard
            icon={<Zap className="h-4 w-4" />}
            title="BD agent actions"
          >
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-7 w-full" />
                ))}
              </div>
            ) : bdActionEntries.length === 0 ? (
              <EmptyState label="No BD actions in this period" />
            ) : (
              <div data-testid="list-bd-actions">
                {bdActionEntries.map(([action, count]) => (
                  <BarRow
                    key={action}
                    label={BD_ACTION_LABELS[action] ?? action}
                    count={count}
                    max={maxBdAction}
                  />
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        {/* Domain breakdown — full width */}
        <SectionCard
          icon={<Globe className="h-4 w-4" />}
          title="Events by domain"
        >
          {isLoading ? (
            <div className="grid grid-cols-2 gap-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-7 w-full" />
              ))}
            </div>
          ) : domainEntries.length === 0 ? (
            <EmptyState label="No domain data in this period" />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8" data-testid="list-by-domain">
              {domainEntries.map(([domain, count]) => (
                <BarRow
                  key={domain}
                  label={DOMAIN_LABELS[domain] ?? domain}
                  count={count}
                  max={maxDomain}
                />
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </StudioShell>
  );
}
