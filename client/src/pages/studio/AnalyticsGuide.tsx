import { Link } from "wouter";
import { StudioShell } from "@/components/studio/StudioShell";
import { studioPath } from "@/lib/studioBase";
import {
  BarChart2,
  BookOpen,
  ExternalLink,
  Info,
  Lightbulb,
  TrendingUp,
} from "lucide-react";

function Section({ id, title, icon: Icon, children }: {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-6">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-5 w-5 text-primary" />
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 text-sm leading-relaxed">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
        {n}
      </span>
      <span>{children}</span>
    </div>
  );
}

function FieldCallout({ field, children }: { field: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm dark:border-blue-800 dark:bg-blue-950/20">
      <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
      <span>
        <span className="font-semibold text-blue-800 dark:text-blue-300">Enter this as → {field}: </span>
        <span className="text-blue-700 dark:text-blue-400">{children}</span>
      </span>
    </div>
  );
}

function ProTip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm dark:border-amber-800 dark:bg-amber-950/30">
      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <span className="text-amber-800 dark:text-amber-300">{children}</span>
    </div>
  );
}

export default function AnalyticsGuide() {
  return (
    <StudioShell>
      <div className="mx-auto max-w-3xl space-y-10 pb-16">
        {/* Header */}
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            <BookOpen className="h-4 w-4" />
            <Link href={studioPath("/guide")}>
              <span className="cursor-pointer hover:underline">Guide</span>
            </Link>
            <span>/</span>
            <span>How to Pull Your Analytics</span>
          </div>
          <h1 className="text-2xl font-bold" data-testid="text-analytics-guide-title">
            How to Pull Your Analytics
          </h1>
          <p className="mt-2 text-muted-foreground">
            A step-by-step reference for the content team. Use this guide each time you log post
            performance in Studio — after a post has been live for at least 48–72 hours.
          </p>
          <div className="mt-3 flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm dark:border-blue-800 dark:bg-blue-950/20">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
            <span className="text-blue-700 dark:text-blue-300">
              Why log manually? Platform API access for LinkedIn and Instagram requires approved
              OAuth app status (months-long process). Manual entry takes under 2 minutes and gives
              the AI real signal about what content style is working.
            </span>
          </div>
        </div>

        {/* Jump links */}
        <nav className="flex flex-wrap gap-2 text-sm">
          {[
            { href: "#linkedin", label: "LinkedIn" },
            { href: "#instagram", label: "Instagram" },
            { href: "#facebook", label: "Facebook" },
            { href: "#x", label: "X (Twitter)" },
            { href: "#tips", label: "Tips & Cadence" },
          ].map(({ href, label }) => (
            <a
              key={href}
              href={href}
              className="rounded-md border px-3 py-1 hover:bg-muted"
              data-testid={`link-guide-jump-${label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              {label}
            </a>
          ))}
        </nav>

        {/* ── LinkedIn ── */}
        <Section id="linkedin" title="LinkedIn Page Analytics" icon={BarChart2}>
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              LinkedIn shows post-level analytics on your <strong className="text-foreground">Company Page</strong>.
              Personal profile analytics are separate and not needed here.
            </p>
            <div className="space-y-2">
              <Step n={1}>Go to your <strong className="text-foreground">LinkedIn Company Page</strong>.</Step>
              <Step n={2}>Click <strong className="text-foreground">Analytics</strong> in the left panel → then <strong className="text-foreground">Content</strong>.</Step>
              <Step n={3}>Find the post you want to log. Use the date filter or scroll to the correct week.</Step>
              <Step n={4}>Click the post row to expand metrics, or click <strong className="text-foreground">View Analytics</strong> on the post itself.</Step>
            </div>
            <div className="space-y-2 pt-2">
              <FieldCallout field="Impressions">Total number shown under "Impressions". This counts every time the post entered a feed, even if not clicked.</FieldCallout>
              <FieldCallout field="Reactions">The total reaction count (👍 ❤️ 🎉 etc.) shown under the post.</FieldCallout>
              <FieldCallout field="Comments">The comment count shown under the post or in the analytics row.</FieldCallout>
              <FieldCallout field="Shares/Reposts">The "Reposts" count shown under the post.</FieldCallout>
              <FieldCallout field="Clicks">Shown as "Link clicks" or "Clicks" in the expanded analytics panel. Includes link + headline clicks.</FieldCallout>
              <FieldCallout field="Reach">LinkedIn calls this "Unique impressions". Use that number if shown; otherwise leave Reach blank.</FieldCallout>
            </div>
            <ProTip>
              Wait at least <strong>48–72 hours</strong> after publishing before logging. LinkedIn continues
              showing posts to new viewers for several days. Early numbers undercount reach significantly.
            </ProTip>
          </div>
        </Section>

        {/* ── Instagram ── */}
        <Section id="instagram" title="Instagram Insights" icon={BarChart2}>
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              Instagram Insights is only available on <strong className="text-foreground">Business or Creator accounts</strong>.
              Access it from the mobile app or from Meta Business Suite on desktop.
            </p>
            <div className="space-y-2">
              <Step n={1}>Open the Instagram app and go to your <strong className="text-foreground">Profile</strong>.</Step>
              <Step n={2}>Tap the post you want to log.</Step>
              <Step n={3}>Tap <strong className="text-foreground">View Insights</strong> below the post image.</Step>
              <Step n={4}>The insights panel slides up showing all metrics for that specific post.</Step>
            </div>
            <div className="space-y-2 pt-2">
              <FieldCallout field="Impressions">Listed as "Impressions" — total views of the post (including repeat views from the same account).</FieldCallout>
              <FieldCallout field="Reactions/Likes">Listed as "Likes" in the insights panel.</FieldCallout>
              <FieldCallout field="Comments">Listed as "Comments".</FieldCallout>
              <FieldCallout field="Shares/Reposts">Listed as "Shares" (direct shares via DM or link).</FieldCallout>
              <FieldCallout field="Clicks">Listed as "Profile visits" or "Website clicks" — use Website clicks if it's a link post.</FieldCallout>
              <FieldCallout field="Reach">Listed as "Accounts reached" — use this for the Reach field.</FieldCallout>
            </div>
            <ProTip>
              For carousel posts, the Insights panel shows metrics for the <strong>whole carousel</strong>, not per-slide.
              Log the full carousel numbers and note in "What worked" whether it was a carousel format.
            </ProTip>
          </div>
        </Section>

        {/* ── Facebook ── */}
        <Section id="facebook" title="Facebook Page Insights" icon={BarChart2}>
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              Facebook post analytics are available from <strong className="text-foreground">Meta Business Suite</strong> or
              directly from your Page on desktop.
            </p>
            <div className="space-y-2">
              <Step n={1}>Go to your <strong className="text-foreground">Facebook Page</strong> on desktop.</Step>
              <Step n={2}>Click <strong className="text-foreground">Insights</strong> in the left menu → then <strong className="text-foreground">Posts</strong>.</Step>
              <Step n={3}>Find your post and click <strong className="text-foreground">See post details</strong>.</Step>
            </div>
            <div className="space-y-2 pt-2">
              <FieldCallout field="Impressions">Listed as "Post impressions" — total reach including paid (if boosted).</FieldCallout>
              <FieldCallout field="Reactions">Sum of all reactions (Like + Love + Haha etc.) shown at the bottom of the post.</FieldCallout>
              <FieldCallout field="Comments">Comment count shown at the bottom of the post.</FieldCallout>
              <FieldCallout field="Shares">Share count shown at the bottom of the post.</FieldCallout>
              <FieldCallout field="Clicks">Listed as "Post clicks" in insights — includes link, photo, and video clicks.</FieldCallout>
              <FieldCallout field="Reach">Listed as "People reached" — unique accounts who saw the post.</FieldCallout>
            </div>
          </div>
        </Section>

        {/* ── X (Twitter) ── */}
        <Section id="x" title="X (Twitter) Analytics" icon={BarChart2}>
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              X analytics are available on desktop at <a href="https://analytics.twitter.com" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-primary hover:underline">analytics.twitter.com <ExternalLink className="h-3 w-3" /></a> or
              directly on each post via the chart icon.
            </p>
            <div className="space-y-2">
              <Step n={1}>Find the post on X and click the <strong className="text-foreground">chart icon</strong> (📊) below it.</Step>
              <Step n={2}>The "Post Analytics" panel appears showing all metrics for that post.</Step>
            </div>
            <div className="space-y-2 pt-2">
              <FieldCallout field="Impressions">Listed as "Impressions" — total views of the post.</FieldCallout>
              <FieldCallout field="Reactions/Likes">Listed as "Likes".</FieldCallout>
              <FieldCallout field="Comments">Listed as "Replies".</FieldCallout>
              <FieldCallout field="Shares/Reposts">Listed as "Reposts" (includes Quote Posts).</FieldCallout>
              <FieldCallout field="Clicks">Listed as "Link clicks" — use this for the Clicks field.</FieldCallout>
              <FieldCallout field="Reach">X does not provide a separate "Reach" metric. Leave Reach blank.</FieldCallout>
            </div>
            <ProTip>
              X analytics are time-sensitive — early engagement (first 2–4 hours) drives most reach.
              Log within 24 hours and then again at 72 hours for a useful before/after comparison.
            </ProTip>
          </div>
        </Section>

        {/* ── Tips ── */}
        <Section id="tips" title="Tips & Logging Cadence" icon={Lightbulb}>
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <div className="space-y-2">
              <p className="font-medium text-foreground">Impressions vs Reach — what's the difference?</p>
              <p>
                <strong className="text-foreground">Impressions</strong> = total times the post was displayed (the same person
                seeing it three times = 3 impressions).
              </p>
              <p>
                <strong className="text-foreground">Reach</strong> = unique accounts that saw the post (that same person = 1 reach).
              </p>
              <p>
                A high Impressions-to-Reach ratio means your post is getting repeated views — usually a good
                sign (people are sharing it or returning to it). Log both whenever your platform provides them.
              </p>
            </div>

            <div className="space-y-2">
              <p className="font-medium text-foreground">Ideal logging cadence</p>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>Log <strong className="text-foreground">once per post</strong>, 48–72 hours after publishing.</li>
                <li>For high-engagement posts, log a second time at 7 days to capture long-tail reach.</li>
                <li>You can log multiple entries for the same post — the system shows a trend arrow when 2+ entries exist for the same platform.</li>
                <li>Focus on Impressions and Reactions first — those two together tell 80% of the story.</li>
              </ul>
            </div>

            <div className="space-y-2">
              <p className="font-medium text-foreground">Writing useful "What worked" notes</p>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>Note the hook style used (e.g. "mechanism reveal opened with a specific chokepoint").</li>
                <li>Note the content archetype (e.g. "red-flag checklist format, 7 items").</li>
                <li>Note anything surprising about the performance — good or bad.</li>
                <li>One or two sentences is enough. The AI uses these notes to calibrate future drafts.</li>
              </ul>
            </div>

            <ProTip>
              The AI uses your logged performance entries when regenerating articles — it sees which platform,
              how many impressions, and what you noted as "what worked". The more you log, the better its
              suggestions become.
            </ProTip>

            <div className="pt-2 border-t">
              <p className="text-foreground font-medium">Ready to log?</p>
              <p className="mt-1">
                Open any published or done idea in the{" "}
                <Link href={studioPath("/calendar")}>
                  <span className="cursor-pointer text-primary hover:underline">Content Pipeline</span>
                </Link>
                {" "}and click the <strong className="text-foreground">Performance</strong> tab in the side panel.
                You'll see a <strong className="text-foreground">Log Performance</strong> button there.
              </p>
            </div>
          </div>
        </Section>
      </div>
    </StudioShell>
  );
}
