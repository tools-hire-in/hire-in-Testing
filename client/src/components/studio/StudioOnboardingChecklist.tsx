import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Rocket,
  PartyPopper,
} from "lucide-react";
import { studioPath } from "@/lib/studioBase";
import type { StudioProject, StudioAuthorProfile, StudioContentIdea } from "@shared/schema";

/**
 * Studio CMO Playbook (Task #914) — Layer 1: guided setup checklist.
 * Six steps, each checking real system state via existing Studio queries.
 * Collapsed state persists in localStorage. Congratulations state when done.
 */

const COLLAPSE_KEY = "studioOnboardingChecklist.collapsed";

interface BrandVoiceResponse {
  config: Record<string, unknown> | null;
}

interface CampaignRow {
  id: string;
}

export function StudioOnboardingChecklist({
  projectId,
  publishedCount,
}: {
  projectId: string;
  publishedCount: number;
}) {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  });

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const { data: projects } = useQuery<StudioProject[]>({
    queryKey: ["/api/admin/studio/projects"],
  });

  const { data: brandVoice } = useQuery<BrandVoiceResponse>({
    queryKey: ["/api/studio/projects", projectId, "brand-voice"],
    enabled: !!projectId,
  });

  const { data: authors } = useQuery<StudioAuthorProfile[]>({
    queryKey: ["/api/admin/studio/authors", { projectId }],
    enabled: !!projectId,
  });

  const { data: ideas } = useQuery<StudioContentIdea[]>({
    queryKey: ["/api/studio/content-ideas", { projectId }],
    enabled: !!projectId,
  });

  const { data: campaigns } = useQuery<CampaignRow[]>({
    queryKey: ["/api/studio/campaigns", { projectId }],
    enabled: !!projectId,
  });

  const brandVoiceConfigured = (() => {
    const cfg = brandVoice?.config;
    if (!cfg || typeof cfg !== "object") return false;
    const def = (cfg as Record<string, unknown>).default;
    if (def && typeof def === "object" && Object.values(def as Record<string, unknown>).some((v) =>
      Array.isArray(v) ? v.length > 0 : typeof v === "string" ? v.trim() !== "" && v !== "none" : false,
    )) {
      return true;
    }
    return false;
  })();

  const steps: {
    key: string;
    label: string;
    description: string;
    done: boolean;
    href: string;
    cta: string;
  }[] = [
    {
      key: "project",
      label: "Create your first Project",
      description: "One project per brand — it holds the voice, authors, and calendar.",
      done: (projects?.length ?? 0) > 0,
      href: studioPath(""),
      cta: "Do this now",
    },
    {
      key: "brand-voice",
      label: "Configure Brand Voice",
      description: "The single highest-leverage setting — makes AI sound like you.",
      done: brandVoiceConfigured,
      href: studioPath("/settings/brand-voice"),
      cta: "Do this now",
    },
    {
      key: "author",
      label: "Set up an Author Profile",
      description: "Authors appear on every published article. Name, title, bio, photo.",
      done: (authors?.length ?? 0) > 0,
      href: studioPath("/authors"),
      cta: "Do this now",
    },
    {
      key: "idea",
      label: "Plan your first Content Idea",
      description: "Click any date on the calendar — topic, brief, done.",
      done: (ideas?.length ?? 0) > 0,
      href: studioPath("/calendar"),
      cta: "Do this now",
    },
    {
      key: "campaign",
      label: "Create your first Campaign",
      description: "A themed push with a goal. AI can draft the whole plan from your brief.",
      done: (campaigns?.length ?? 0) > 0,
      href: studioPath("/campaigns"),
      cta: "Do this now",
    },
    {
      key: "publish",
      label: "Publish your first article",
      description: "Draft with AI, review, approve — then it goes live on Insights.",
      done: publishedCount > 0,
      href: studioPath("/articles"),
      cta: "Do this now",
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;

  return (
    <Card data-testid="card-onboarding-checklist">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            {allDone ? (
              <PartyPopper className="h-4 w-4 text-emerald-500" />
            ) : (
              <Rocket className="h-4 w-4 text-primary" />
            )}
            {allDone ? "Setup complete" : "Get set up"}
            <Badge variant="secondary" className="tabular-nums" data-testid="badge-checklist-progress">
              {doneCount}/{steps.length}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-1">
            <Link href={studioPath("/guide")}>
              <Button variant="ghost" size="sm" className="h-7 text-xs" data-testid="link-checklist-playbook">
                <BookOpen className="mr-1 h-3.5 w-3.5" />
                View Playbook
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={toggle}
              aria-label={collapsed ? "Expand checklist" : "Collapse checklist"}
              data-testid="button-toggle-checklist"
            >
              {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      {!collapsed && (
        <CardContent className="pt-0">
          {allDone ? (
            <div className="flex flex-col items-center gap-2 py-4 text-center" data-testid="checklist-congrats">
              <p className="text-sm font-medium">
                You're fully set up — project, voice, authors, plan, campaign, and your first published piece.
              </p>
              <p className="text-sm text-muted-foreground">
                Now go deeper: the Playbook covers strategy, AI briefing, and reading your signals.
              </p>
              <Link href={studioPath("/guide")}>
                <Button size="sm" variant="outline" data-testid="link-congrats-playbook">
                  <BookOpen className="mr-1.5 h-4 w-4" />
                  Read the full Playbook →
                </Button>
              </Link>
            </div>
          ) : (
            <ul className="divide-y">
              {steps.map((step, i) => (
                <li
                  key={step.key}
                  className="flex items-center gap-3 py-2.5"
                  data-testid={`checklist-step-${step.key}`}
                >
                  {step.done ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" data-testid={`checklist-done-${step.key}`} />
                  ) : (
                    <Circle className="h-5 w-5 shrink-0 text-muted-foreground/40" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium ${step.done ? "text-muted-foreground line-through" : ""}`}>
                      {i + 1}. {step.label}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{step.description}</p>
                  </div>
                  {!step.done && (
                    <Link href={step.href}>
                      <Button size="sm" variant="outline" className="h-7 shrink-0 text-xs" data-testid={`checklist-cta-${step.key}`}>
                        → {step.cta}
                      </Button>
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      )}
    </Card>
  );
}
