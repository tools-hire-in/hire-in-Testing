import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import {
  MapPin,
  DollarSign,
  Calendar,
  ArrowLeft,
  Share2,
  Clock,
  Timer,
  Users,
  ShieldCheck,
  Star,
  Hash,
  ChevronRight,
} from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ApplicationModal } from "@/components/jobs/ApplicationModal";
import { useToast } from "@/hooks/use-toast";
import { useSEO } from "@/hooks/use-seo";
import { stripHtmlEntities, DUPLICATE_LABEL_RE } from "@/lib/jobUtils";
import type { Job } from "@shared/schema";

type DescriptionSegment =
  | { type: "heading"; content: string }
  | { type: "paragraph"; content: string }
  | { type: "bullets"; content: string[] };

const KNOWN_HEADINGS = [
  "requirements",
  "key responsibilities",
  "responsibilities",
  "role overview",
  "qualifications",
  "about the role",
  "shift",
  "benefits",
  "overview",
  "summary",
  "what you will do",
  "what we offer",
  "minimum qualifications",
  "preferred qualifications",
  "education",
  "experience",
  "skills",
];

function isBullet(line: string): boolean {
  return /^[\s]*([•\-*]|\d+\.)\s+/.test(line);
}

function extractBulletText(line: string): string {
  return line.replace(/^[\s]*([•\-*]|\d+\.)\s+/, "").trim();
}

function isHeading(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase().replace(/:$/, "");
  if (KNOWN_HEADINGS.some((h) => lower === h)) return true;
  if (trimmed.endsWith(":") && !trimmed.includes("•") && !trimmed.includes("-")) {
    const wordCount = trimmed.split(/\s+/).length;
    return wordCount <= 6;
  }
  return false;
}

export function parseJobDescription(text: string): DescriptionSegment[] {
  const cleaned = stripHtmlEntities(text);
  const lines = cleaned.split("\n");

  const filtered = lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return true;
    return !DUPLICATE_LABEL_RE.test(trimmed);
  });

  const nonEmpty = filtered.map((l) => l.trim()).filter((l, i, arr) => {
    if (l === "") return i > 0 && arr[i - 1] !== "";
    return true;
  });

  if (nonEmpty.filter((l) => l).length === 0) return [];

  const hasSections = nonEmpty.some((l) => isHeading(l)) || nonEmpty.some((l) => isBullet(l));

  if (!hasSections) {
    const prose = nonEmpty.join("\n").trim();
    if (!prose) return [];
    return [{ type: "paragraph", content: prose }];
  }

  const segments: DescriptionSegment[] = [];
  let i = 0;
  let bulletBuffer: string[] = [];

  const flushBullets = () => {
    if (bulletBuffer.length > 0) {
      segments.push({ type: "bullets", content: [...bulletBuffer] });
      bulletBuffer = [];
    }
  };

  while (i < nonEmpty.length) {
    const line = nonEmpty[i];

    if (line === "") {
      flushBullets();
      i++;
      continue;
    }

    if (isBullet(line)) {
      bulletBuffer.push(extractBulletText(line));
      i++;
      continue;
    }

    flushBullets();

    if (isHeading(line)) {
      const label = line.endsWith(":") ? line.slice(0, -1).trim() : line.trim();
      segments.push({ type: "heading", content: label });
      i++;
      continue;
    }

    let para = line;
    i++;
    while (i < nonEmpty.length && nonEmpty[i] !== "" && !isHeading(nonEmpty[i]) && !isBullet(nonEmpty[i])) {
      para += " " + nonEmpty[i];
      i++;
    }
    segments.push({ type: "paragraph", content: para.trim() });
  }

  flushBullets();
  return segments;
}

function parseSkills(raw: string): string[] {
  return raw
    .split(/[,\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseWorkAuthChips(taxTerms: string | null | undefined): string[] {
  if (!taxTerms) return [];
  return taxTerms
    .split(/[,/\s]+/)
    .map((t) => t.trim().toUpperCase())
    .filter((t) => ["W2", "C2C", "1099", "CORP-TO-CORP", "CORP2CORP", "W-2"].includes(t));
}

function formatPayRate(payRate: string | null | undefined): string {
  if (!payRate) return "";
  const num = parseFloat(payRate.replace(/[^0-9.]/g, ""));
  if (!isNaN(num) && /^\$?[\d,.]+$/.test(payRate.replace(/\s/g, ""))) {
    return `$${num.toFixed(2)}/hr`;
  }
  return payRate;
}

function cleanDuration(duration: string | null | undefined): string {
  if (!duration) return "";
  return duration.replace(/(\d+)\s*day\(s\)/i, (_, n) => {
    const num = parseInt(n);
    return `${num} week${num !== 1 ? "s" : ""}`;
  });
}

interface DetailRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  bold?: boolean;
  testId?: string;
}

function DetailRow({ icon, label, value, bold, testId }: DetailRowProps) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border/50 last:border-0">
      <div className="text-primary mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground uppercase tracking-wide leading-none mb-1">{label}</p>
        <p className={`text-sm break-words ${bold ? "font-semibold text-foreground" : "text-foreground/90"}`} data-testid={testId}>
          {value}
        </p>
      </div>
    </div>
  );
}

function DescriptionRenderer({ segments }: { segments: DescriptionSegment[] }) {
  if (segments.length === 0) {
    return <p className="text-sm text-muted-foreground">No description available.</p>;
  }

  return (
    <div className="space-y-3 text-[15px] text-gray-700 dark:text-gray-300 leading-7" data-testid="text-job-description">
      {segments.map((seg, idx) => {
        if (seg.type === "heading") {
          return (
            <h3
              key={idx}
              className="text-[16px] font-semibold text-gray-900 dark:text-gray-100 border-l-4 border-primary pl-3 mt-6 first:mt-0"
            >
              {seg.content}
            </h3>
          );
        }
        if (seg.type === "bullets") {
          return (
            <ul key={idx} className="list-disc pl-5 space-y-2 text-gray-700 dark:text-gray-300">
              {seg.content.map((item, j) => (
                <li key={j} className="leading-relaxed">{item}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={idx} className="text-gray-700 dark:text-gray-300">
            {seg.content}
          </p>
        );
      })}
    </div>
  );
}

export default function JobDetail() {
  const [, params] = useRoute("/jobs/:id");
  const jobId = params?.id;
  const [applicationOpen, setApplicationOpen] = useState(false);
  const { toast } = useToast();

  const { data: job, isLoading } = useQuery<Job>({
    queryKey: ["/api/jobs", jobId],
    enabled: !!jobId,
  });

  const jobLocation = job ? [job.city, job.state].filter(Boolean).join(", ") || "Remote" : "";
  useSEO({
    title: job
      ? `${job.title} — ${job.company || "Hire'in Solutions"} | Hire'in Solutions Jobs`
      : "Job Details | Hire'in Solutions",
    description: job
      ? `${job.title} at ${job.company || "Hire'in Solutions"}${jobLocation ? ` in ${jobLocation}` : ""}. Apply now through Hire'in Solutions.`
      : "View job details and apply through Hire'in Solutions.",
    canonical: jobId ? `https://hire-in.com/jobs/${jobId}` : undefined,
  });

  const jobExtra = (job ?? {}) as Record<string, any>;

  const { data: similarJobsData } = useQuery<{ jobs: Job[]; total: number }>({
    queryKey: ["/api/jobs", { specialty: job?.specialty, limit: 5 }],
    queryFn: () =>
      fetch(`/api/jobs?specialty=${encodeURIComponent(job?.specialty ?? "")}&limit=5`).then((r) => r.json()),
    enabled: !!job?.specialty,
  });

  const similarJobs = (similarJobsData?.jobs ?? [])
    .filter((j) => j.id !== job?.id)
    .slice(0, 4);

  const location = job ? [job.city, job.state].filter(Boolean).join(", ") || "Remote" : "";

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast({ title: "Link copied to clipboard" });
    } catch {
      toast({ title: "Could not copy link", variant: "destructive" });
    }
  };

  const descriptionSegments = job?.description ? parseJobDescription(job.description) : [];

  const workAuthChips = parseWorkAuthChips(jobExtra.tax_terms);

  const primarySkillsRaw: string = jobExtra.primary_skills ?? "";
  const secondarySkillsRaw: string = jobExtra.secondary_skills ?? "";
  const primarySkills = parseSkills(primarySkillsRaw);
  const secondarySkills = parseSkills(secondarySkillsRaw);
  const fallbackSkills = !primarySkills.length && job?.requirements ? parseSkills(job.requirements.replace(/<[^>]*>/g, "")) : [];

  const payRateDisplay = formatPayRate(job?.payRate);
  const durationDisplay = cleanDuration(job?.duration);

  const shiftDisplay: string = jobExtra.shift ?? job?.shift ?? "";
  const workAuth: string = jobExtra.work_authorization ?? "";
  const experience: string = jobExtra.experience ?? "";
  const positions: string = jobExtra.number_of_positions ? String(jobExtra.number_of_positions) : "";
  const hoursPerWeek: string = jobExtra.required_hours_week ? String(jobExtra.required_hours_week) : "";

  return (
    <Layout>
      <section className="py-10 lg:py-14 px-4 lg:px-6">
        <div className="max-w-6xl mx-auto">
          <Link href="/jobs">
            <Button variant="ghost" className="mb-6 -ml-2" data-testid="button-back-jobs">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Jobs
            </Button>
          </Link>

          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-3/4" />
              <Skeleton className="h-5 w-1/2" />
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8 mt-6">
                <Skeleton className="h-96 w-full" />
                <Skeleton className="h-80 w-full" />
              </div>
            </div>
          ) : !job ? (
            <Card>
              <CardContent className="py-16 text-center">
                <h2 className="text-xl font-semibold mb-2">Job not found</h2>
                <p className="text-muted-foreground mb-6">
                  This position may have been filled or removed.
                </p>
                <Link href="/jobs">
                  <Button data-testid="button-browse-jobs">Browse All Jobs</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Header */}
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-8">
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h1 className="text-2xl lg:text-3xl font-bold" data-testid="text-job-title">
                      {job.title}
                    </h1>
                    {job.isHot && <Badge variant="destructive">Hot</Badge>}
                    {!job.isActive && <Badge variant="secondary">Closed</Badge>}
                  </div>


                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 shrink-0" />
                    <span data-testid="text-job-location">{location}</span>
                  </div>

                  {workAuthChips.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {workAuthChips.map((chip) => (
                        <Badge key={chip} variant="outline" className="text-xs font-medium" data-testid={`badge-workauth-${chip}`}>
                          {chip}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleShare}
                    data-testid="button-share-job"
                  >
                    <Share2 className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={() => setApplicationOpen(true)}
                    data-testid="button-apply-job"
                  >
                    Apply Now
                  </Button>
                </div>
              </div>

              {/* Two-column grid — sidebar first in DOM so mobile stacks: header → sidebar → body */}
              <div className="grid grid-cols-1 lg:grid-cols-[65%_35%] gap-8 items-start">

                {/* ── Sidebar (DOM first, visually right on desktop) ── */}
                <div className="lg:col-start-2 lg:row-start-1 space-y-4">

                  {/* Sticky group: all sidebar cards including Apply CTA at the bottom */}
                  <div className="lg:sticky lg:top-6 space-y-4">
                    {/* Job Details card */}
                    <Card>
                      <CardHeader className="pb-2 pt-5 px-5">
                        <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                          Job Details
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-5 pb-4 pt-0">
                        <DetailRow
                          icon={<Hash className="h-4 w-4" />}
                          label="Job Code"
                          value={job.ceipalJobCode ?? ""}
                          bold
                          testId="text-job-code"
                        />
                        <DetailRow
                          icon={<Clock className="h-4 w-4" />}
                          label="Employment Type"
                          value={job.jobType ?? jobExtra.tax_terms ?? ""}
                          testId="text-job-type"
                        />
                        <DetailRow
                          icon={<MapPin className="h-4 w-4" />}
                          label="Location"
                          value={location}
                          testId="text-sidebar-location"
                        />
                        <DetailRow
                          icon={<Clock className="h-4 w-4" />}
                          label="Shift"
                          value={shiftDisplay}
                          testId="text-job-shift"
                        />
                        <DetailRow
                          icon={<Timer className="h-4 w-4" />}
                          label="Duration"
                          value={durationDisplay}
                          testId="text-job-duration"
                        />
                        <DetailRow
                          icon={<Calendar className="h-4 w-4" />}
                          label="Start Date"
                          value={job.startDate ?? ""}
                          testId="text-job-startdate"
                        />
                        <DetailRow
                          icon={<DollarSign className="h-4 w-4" />}
                          label="Pay Rate"
                          value={payRateDisplay}
                          testId="text-job-pay"
                        />
                        <DetailRow
                          icon={<ShieldCheck className="h-4 w-4" />}
                          label="Work Authorization"
                          value={workAuth}
                          testId="text-job-workauth"
                        />
                        <DetailRow
                          icon={<Star className="h-4 w-4" />}
                          label="Experience Required"
                          value={experience}
                          testId="text-job-experience"
                        />
                        <DetailRow
                          icon={<Users className="h-4 w-4" />}
                          label="Positions Available"
                          value={positions}
                          testId="text-job-positions"
                        />
                        <DetailRow
                          icon={<Clock className="h-4 w-4" />}
                          label="Hours / Week"
                          value={hoursPerWeek}
                          testId="text-job-hours"
                        />
                      </CardContent>
                    </Card>

                    {/* Skills card */}
                    {(primarySkills.length > 0 || secondarySkills.length > 0 || fallbackSkills.length > 0) && (
                      <Card>
                        <CardHeader className="pb-2 pt-5 px-5">
                          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                            Skills
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="px-5 pb-4 pt-0">
                          {(primarySkills.length > 0 ? primarySkills : fallbackSkills).length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-2">
                              {(primarySkills.length > 0 ? primarySkills : fallbackSkills).map((skill) => (
                                <Badge key={skill} variant="secondary" className="text-xs" data-testid={`badge-skill-${skill}`}>
                                  {skill}
                                </Badge>
                              ))}
                            </div>
                          )}
                          {secondarySkills.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {secondarySkills.map((skill) => (
                                <Badge key={skill} variant="outline" className="text-xs text-muted-foreground" data-testid={`badge-skill-secondary-${skill}`}>
                                  {skill}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {/* Similar Jobs card */}
                    {similarJobs.length > 0 && (
                      <Card>
                        <CardHeader className="pb-2 pt-5 px-5">
                          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                            Similar Jobs
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="px-5 pb-3 pt-0">
                          <div className="space-y-1">
                            {similarJobs.map((sj) => {
                              const sjLocation = [sj.city, sj.state].filter(Boolean).join(", ") || "Remote";
                              return (
                                <Link key={sj.id} href={`/jobs/${sj.id}`}>
                                  <div
                                    className="flex items-center justify-between gap-2 py-2.5 px-1 rounded-md hover:bg-muted/50 cursor-pointer transition-colors group"
                                    data-testid={`card-similar-job-${sj.id}`}
                                  >
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                                        {sj.title}
                                      </p>
                                      <p className="text-xs text-muted-foreground">{sjLocation}</p>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
                                  </div>
                                </Link>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Apply CTA — last card in the sticky sidebar block */}
                    <Card className="bg-primary/5 border-primary/20">
                      <CardContent className="pt-5 pb-5 text-center">
                        <h3 className="text-base font-semibold mb-1.5">Ready to apply?</h3>
                        <p className="text-xs text-muted-foreground mb-3">
                          Submit your application and our team will be in touch.
                        </p>
                        <Button
                          className="w-full"
                          onClick={() => setApplicationOpen(true)}
                          data-testid="button-apply-bottom"
                        >
                          Apply Now
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* ── Main content (DOM second, visually left on desktop) ── */}
                <div className="lg:col-start-1 lg:row-start-1 space-y-6 min-w-0">
                  <Card>
                    <CardContent className="pt-6">
                      <h2 className="text-lg font-semibold pb-4 mb-5 border-b border-border">Job Description</h2>
                      <DescriptionRenderer segments={descriptionSegments} />
                    </CardContent>
                  </Card>
                </div>

              </div>
            </>
          )}
        </div>
      </section>

      {job && (
        <ApplicationModal
          job={job}
          open={applicationOpen}
          onOpenChange={setApplicationOpen}
        />
      )}
    </Layout>
  );
}
