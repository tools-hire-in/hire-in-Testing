import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Loader2,
  Copy,
  RefreshCw,
  Linkedin,
  Instagram,
  Share2,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  MapPin,
  Building2,
  Briefcase,
  ChevronsUpDown,
  ShieldX,
} from "lucide-react";

interface Job {
  id: string;
  title: string;
  specialty: string | null;
  department: string | null;
  city: string | null;
  state: string | null;
  jobType: string | null;
  isActive: boolean;
}

interface GateResult {
  pass: boolean;
  blocked: boolean;
  failures: Array<{
    code: string;
    sentence: string;
    reason: string;
    missingSource?: string;
    recommendedCorrection?: string;
  }>;
}

interface SocialCaptions {
  linkedin: string | null;
  instagram: string | null;
  facebook: string | null;
  generatedAt: string;
  gateResults?: Record<string, GateResult>;
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function CaptionCard({
  platform,
  icon: Icon,
  label,
  text,
  gateResult,
  onCopy,
  onRegenerate,
  isRegenerating,
  copied,
}: {
  platform: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  text: string | null;
  gateResult?: GateResult;
  onCopy: () => void;
  onRegenerate: () => void;
  isRegenerating: boolean;
  copied: boolean;
}) {
  const isBlocked = gateResult?.blocked === true || text === null;

  return (
    <Card
      data-testid={`card-caption-${platform}`}
      className={isBlocked ? "border-destructive/30 bg-destructive/5" : undefined}
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <Icon className="h-4 w-4" />
            {label}
          </span>
          <div className="flex items-center gap-2">
            {isBlocked ? (
              <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive text-[10px]">
                <ShieldX className="mr-1 h-3 w-3" />
                Safety blocked
              </Badge>
            ) : gateResult?.pass ? (
              <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px]">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Safety passed
              </Badge>
            ) : null}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isBlocked ? (
          <div className="flex min-h-[100px] flex-col items-center justify-center gap-3 rounded-md border border-dashed border-destructive/30 bg-destructive/5 p-4 text-center">
            <ShieldX className="h-7 w-7 text-destructive/50" />
            <div>
              <p className="text-sm font-medium text-destructive">Caption blocked by safety gate</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                The AI output violated one or more rules. Click Regenerate to try again.
              </p>
            </div>
            {gateResult?.failures && gateResult.failures.length > 0 && (
              <div className="w-full space-y-1.5 text-left">
                {gateResult.failures.slice(0, 2).map((f, i) => (
                  <Alert key={i} className="border-destructive/20 bg-destructive/5 py-2">
                    <AlertDescription className="text-xs text-destructive/80">
                      <span className="font-medium">{f.code}:</span> {f.reason}
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div
            className="min-h-[100px] rounded-md border bg-muted/30 p-3 text-sm leading-relaxed whitespace-pre-wrap"
            data-testid={`text-caption-${platform}`}
          >
            {text}
          </div>
        )}

        <div className="flex gap-2">
          {!isBlocked && (
            <Button
              size="sm"
              variant="outline"
              onClick={onCopy}
              className="flex-1"
              data-testid={`button-copy-${platform}`}
            >
              {copied ? (
                <><CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-emerald-500" /> Copied!</>
              ) : (
                <><Copy className="mr-1.5 h-3.5 w-3.5" /> Copy</>
              )}
            </Button>
          )}
          <Button
            size="sm"
            variant={isBlocked ? "outline" : "ghost"}
            onClick={onRegenerate}
            disabled={isRegenerating}
            className={isBlocked ? "flex-1" : undefined}
            data-testid={`button-regenerate-${platform}`}
          >
            {isRegenerating ? (
              <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Regenerating…</>
            ) : (
              <><RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Regenerate</>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function JobSearchCombobox({
  jobs,
  isLoading,
  value,
  onChange,
}: {
  jobs: Job[];
  isLoading: boolean;
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedJob = jobs.find((j) => j.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          disabled={isLoading}
          data-testid="button-job-picker"
        >
          {isLoading ? (
            <span className="text-muted-foreground">Loading jobs…</span>
          ) : selectedJob ? (
            <span className="truncate">
              {selectedJob.title}
              {(selectedJob.specialty || selectedJob.department) && (
                <span className="ml-2 text-muted-foreground text-xs">
                  — {selectedJob.specialty || selectedJob.department}
                </span>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground">Search or select a job…</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search jobs…" data-testid="input-job-search" />
          <CommandList>
            <CommandEmpty>No active jobs found.</CommandEmpty>
            <CommandGroup>
              {jobs.map((job) => (
                <CommandItem
                  key={job.id}
                  value={`${job.title} ${job.specialty ?? ""} ${job.department ?? ""} ${job.city ?? ""} ${job.state ?? ""}`}
                  onSelect={() => {
                    onChange(job.id);
                    setOpen(false);
                  }}
                  data-testid={`option-job-${job.id}`}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{job.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {[
                        job.specialty || job.department,
                        job.city && job.state
                          ? `${job.city}, ${job.state}`
                          : job.state || job.city,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function SocialPosts() {
  const { toast } = useToast();
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [captions, setCaptions] = useState<SocialCaptions | null>(null);
  const [copiedPlatform, setCopiedPlatform] = useState<string | null>(null);

  const { data: jobsData, isLoading: jobsLoading } = useQuery<{ jobs: Job[] }>({
    queryKey: ["/api/admin/jobs"],
    queryFn: async () => {
      const res = await fetch("/api/admin/jobs?limit=200&isActive=true", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load jobs");
      return res.json();
    },
  });

  const activeJobs = (jobsData?.jobs ?? []).filter((j) => j.isActive);
  const selectedJob = activeJobs.find((j) => j.id === selectedJobId);

  const { data: existingCaptions, isLoading: captionsLoading } = useQuery<SocialCaptions | null>({
    queryKey: ["/api/studio/jobs", selectedJobId, "social-captions"],
    queryFn: async () => {
      const res = await fetch(`/api/studio/jobs/${selectedJobId}/social-captions`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!selectedJobId,
    staleTime: 5 * 60 * 1000,
  });

  const displayCaptions = captions ?? existingCaptions;

  const generateMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const res = await apiRequest("POST", `/api/studio/jobs/${jobId}/generate-social`, {});
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to generate captions");
      }
      return res.json() as Promise<SocialCaptions>;
    },
    onSuccess: (data) => {
      setCaptions(data);
      queryClient.invalidateQueries({ queryKey: ["/api/studio/jobs", selectedJobId, "social-captions"] });
      const blockedCount = Object.values(data.gateResults ?? {}).filter((r) => r.blocked).length;
      if (blockedCount > 0) {
        toast({
          title: `${blockedCount} caption${blockedCount > 1 ? "s" : ""} blocked by safety gate`,
          description: "Regenerate to try again — the safety gate will re-check.",
          variant: "destructive",
        });
      } else {
        toast({ title: "Captions generated!", description: "Three platform-ready captions are ready to copy." });
      }
    },
    onError: (err: any) => {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    },
  });

  const handleCopy = useCallback((platform: string, text: string | null) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedPlatform(platform);
      setTimeout(() => setCopiedPlatform(null), 2000);
    }).catch(() => {
      toast({ title: "Copy failed", description: "Please select and copy the text manually.", variant: "destructive" });
    });
  }, [toast]);

  const handleJobChange = (jobId: string) => {
    setSelectedJobId(jobId);
    setCaptions(null);
  };

  const platforms = [
    { key: "linkedin", icon: Linkedin, label: "LinkedIn" },
    { key: "instagram", icon: Instagram, label: "Instagram Reels" },
    { key: "facebook", icon: FacebookIcon, label: "Facebook Group" },
  ] as const;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Share2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-social-posts-title">
              Social Posts
            </h1>
            <p className="text-sm text-muted-foreground">
              Generate LinkedIn, Instagram, and Facebook captions for any active job in one click.
            </p>
          </div>
        </div>

        {/* Job picker */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Pick a job to post</CardTitle>
            <CardDescription>
              Select any active job. Captions are grounded in the real job data and safety-checked before display.
              Captions that violate safety rules (invented pay rates, banned phrases, clinical claims) are hard-blocked.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3 items-center">
              <div className="flex-1">
                <JobSearchCombobox
                  jobs={activeJobs}
                  isLoading={jobsLoading}
                  value={selectedJobId}
                  onChange={handleJobChange}
                />
              </div>
              <Button
                onClick={() => generateMutation.mutate(selectedJobId)}
                disabled={!selectedJobId || generateMutation.isPending}
                data-testid="button-generate-captions"
              >
                {generateMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating…</>
                ) : (
                  <><Sparkles className="mr-2 h-4 w-4" /> Generate</>
                )}
              </Button>
            </div>

            {selectedJob && (
              <div className="flex flex-wrap gap-2 rounded-md border bg-muted/30 p-3">
                <span className="text-sm font-medium">{selectedJob.title}</span>
                {(selectedJob.specialty || selectedJob.department) && (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <Briefcase className="h-3 w-3" />
                    {selectedJob.specialty || selectedJob.department}
                  </Badge>
                )}
                {(selectedJob.city || selectedJob.state) && (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <MapPin className="h-3 w-3" />
                    {[selectedJob.city, selectedJob.state].filter(Boolean).join(", ")}
                  </Badge>
                )}
                {selectedJob.jobType && (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <Building2 className="h-3 w-3" />
                    {selectedJob.jobType}
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Captions area */}
        {captionsLoading && selectedJobId ? (
          <div className="grid gap-4 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Card key={i}>
                <CardHeader className="pb-3">
                  <Skeleton className="h-5 w-28" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-24 w-full" />
                  <div className="mt-3 flex gap-2">
                    <Skeleton className="h-8 flex-1" />
                    <Skeleton className="h-8 w-10" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : generateMutation.isPending ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div>
              <p className="font-medium">Generating captions…</p>
              <p className="text-sm text-muted-foreground">Running safety checks on each platform caption.</p>
            </div>
          </div>
        ) : displayCaptions ? (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Generated {new Date(displayCaptions.generatedAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => generateMutation.mutate(selectedJobId)}
                disabled={generateMutation.isPending}
                data-testid="button-regenerate-all"
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Regenerate all
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {platforms.map(({ key, icon, label }) => (
                <CaptionCard
                  key={key}
                  platform={key}
                  icon={icon}
                  label={label}
                  text={displayCaptions[key as keyof Pick<SocialCaptions, "linkedin" | "instagram" | "facebook">]}
                  gateResult={displayCaptions.gateResults?.[key]}
                  onCopy={() => handleCopy(key, displayCaptions[key as keyof Pick<SocialCaptions, "linkedin" | "instagram" | "facebook">])}
                  onRegenerate={() => generateMutation.mutate(selectedJobId)}
                  isRegenerating={generateMutation.isPending}
                  copied={copiedPlatform === key}
                />
              ))}
            </div>
            <p className="text-center text-xs text-muted-foreground">
              Captions are copy-only — no OAuth connections to social platforms. Paste directly into your post editor.
            </p>
          </>
        ) : selectedJobId ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
            <Share2 className="h-8 w-8 text-muted-foreground/40" />
            <div>
              <p className="font-medium">No captions yet</p>
              <p className="text-sm text-muted-foreground">Click Generate to create platform-ready captions for this job.</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
            <Share2 className="h-8 w-8 text-muted-foreground/40" />
            <div>
              <p className="font-medium">Select a job to get started</p>
              <p className="text-sm text-muted-foreground">
                Pick an active job above and click Generate to create LinkedIn, Instagram, and Facebook captions in one click.
              </p>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
