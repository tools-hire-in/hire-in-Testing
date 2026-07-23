import { StudioShell } from "@/components/studio/StudioShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Rocket, Zap, Bug, Wrench } from "lucide-react";

interface ChangelogEntry {
  version: string;
  date: string;
  items: { type: "feature" | "improvement" | "fix"; text: string }[];
}

const CHANGELOG: ChangelogEntry[] = [
  {
    version: "July 2026",
    date: "2026-07-23",
    items: [
      { type: "feature", text: "Unified Settings page — Brand Voice & AI, Templates, and Studio Access consolidated under /studio/settings with tab deep-linking." },
      { type: "feature", text: "Recent Activity feed on the dashboard — last 10 content actions across all articles, with clickable article links." },
      { type: "improvement", text: "Analytics tab promoted to top-level navigation with three flat sub-tabs: Performance, Feedback, and AI Spend." },
      { type: "improvement", text: "Dashboard quick-actions: New Social Post, New Article, New Campaign buttons replace the single 'Write something' button." },
      { type: "improvement", text: "Authors section moved into the Articles page as a dedicated tab." },
      { type: "fix", text: "Review queue and pipeline links now route to correct full-page article destinations (/studio/articles/:id/edit)." },
    ],
  },
  {
    version: "June 2026",
    date: "2026-06-01",
    items: [
      { type: "feature", text: "Keyboard Shortcuts modal accessible from the Help menu." },
      { type: "feature", text: "Studio Onboarding Checklist to guide new projects through setup milestones." },
      { type: "improvement", text: "Content Pulse card shows top-performing articles by engagement score." },
      { type: "improvement", text: "Upcoming Occasions panel shows events in the next 14 days with one-click idea creation." },
      { type: "fix", text: "Brand voice tip no longer shows for projects that already have brand voice configured." },
    ],
  },
  {
    version: "May 2026",
    date: "2026-05-01",
    items: [
      { type: "feature", text: "AI-powered article generation with configurable tone and framework." },
      { type: "feature", text: "Campaign management — group articles under named campaigns with funnel stages." },
      { type: "feature", text: "Engagement analytics: reaction tracking, CTA click attribution, and audience feedback." },
      { type: "improvement", text: "Content pipeline summary with status chip navigation." },
    ],
  },
];

const TYPE_META = {
  feature: { label: "New", icon: Rocket, cls: "bg-primary/10 text-primary border-primary/20" },
  improvement: { label: "Improved", icon: Zap, cls: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900" },
  fix: { label: "Fixed", icon: Bug, cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900" },
} as const;

export default function StudioChangelog() {
  return (
    <StudioShell>
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-changelog-title">
            What's New in Studio
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Release notes and feature updates for Hire'in Solutions Content Studio.
          </p>
        </div>

        <div className="space-y-4">
          {CHANGELOG.map((entry) => (
            <Card key={entry.version} data-testid={`card-changelog-${entry.version.replace(/\s+/g, "-").toLowerCase()}`}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wrench className="h-4 w-4 text-muted-foreground" />
                  {entry.version}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2.5">
                  {entry.items.map((item, i) => {
                    const meta = TYPE_META[item.type];
                    const Icon = meta.icon;
                    return (
                      <li
                        key={i}
                        className="flex items-start gap-3"
                        data-testid={`changelog-item-${entry.version.replace(/\s+/g, "-").toLowerCase()}-${i}`}
                      >
                        <span className={`mt-0.5 inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold ${meta.cls}`}>
                          <Icon className="h-2.5 w-2.5" />
                          {meta.label}
                        </span>
                        <span className="text-sm leading-snug">{item.text}</span>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </StudioShell>
  );
}
