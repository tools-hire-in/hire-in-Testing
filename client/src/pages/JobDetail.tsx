import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import {
  MapPin,
  Clock,
  DollarSign,
  Calendar,
  Building2,
  Briefcase,
  ArrowLeft,
  Share2,
  Timer,
} from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ApplicationModal } from "@/components/jobs/ApplicationModal";
import { useToast } from "@/hooks/use-toast";
import type { Job } from "@shared/schema";

export default function JobDetail() {
  const [, params] = useRoute("/jobs/:id");
  const jobId = params?.id;
  const [applicationOpen, setApplicationOpen] = useState(false);
  const { toast } = useToast();

  const { data: job, isLoading } = useQuery<Job>({
    queryKey: ["/api/jobs", jobId],
    enabled: !!jobId,
  });

  const location = job
    ? [job.city, job.state].filter(Boolean).join(", ") || "Remote"
    : "";

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast({ title: "Link copied to clipboard" });
    } catch {
      toast({ title: "Could not copy link", variant: "destructive" });
    }
  };

  const descriptionText = job?.description
    ?.replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&") || "";

  const requirementsText = job?.requirements
    ?.replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&") || "";

  return (
    <Layout>
      <section className="py-12 lg:py-16 px-4 lg:px-6">
        <div className="max-w-4xl mx-auto">
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
              <Skeleton className="h-64 w-full" />
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
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-2xl lg:text-3xl font-bold" data-testid="text-job-title">
                      {job.title}
                    </h1>
                    {job.isHot && (
                      <Badge variant="destructive">Hot</Badge>
                    )}
                    {job.source === "ceipal" && (
                      <Badge variant="outline">Ceipal</Badge>
                    )}
                  </div>
                  {job.facility && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Building2 className="h-4 w-4" />
                      <span data-testid="text-job-facility">{job.facility}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
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

              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span data-testid="text-job-location">{location}</span>
                </div>
                {job.jobType && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span data-testid="text-job-type">{job.jobType}</span>
                  </div>
                )}
                {job.payRate && (
                  <div className="flex items-center gap-1.5 text-sm text-primary font-medium">
                    <DollarSign className="h-4 w-4" />
                    <span data-testid="text-job-pay">{job.payRate}</span>
                  </div>
                )}
                {job.duration && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Timer className="h-4 w-4" />
                    <span>{job.duration}</span>
                  </div>
                )}
                {job.startDate && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>Start: {job.startDate}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {job.specialty && (
                  <Badge variant="secondary">
                    <Briefcase className="h-3 w-3 mr-1" />
                    {job.specialty}
                  </Badge>
                )}
                {job.department && (
                  <Badge variant="outline">{job.department}</Badge>
                )}
                {!job.isActive && (
                  <Badge variant="secondary">Closed</Badge>
                )}
              </div>

              <Separator />

              <Card>
                <CardContent className="pt-6">
                  <h2 className="text-lg font-semibold mb-4">Job Description</h2>
                  <div
                    className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed"
                    data-testid="text-job-description"
                  >
                    {descriptionText || "No description available."}
                  </div>
                </CardContent>
              </Card>

              {requirementsText && (
                <Card>
                  <CardContent className="pt-6">
                    <h2 className="text-lg font-semibold mb-4">Skills & Requirements</h2>
                    <div
                      className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed"
                      data-testid="text-job-requirements"
                    >
                      {requirementsText}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="pt-6 text-center">
                  <h2 className="text-lg font-semibold mb-2">Interested in this position?</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    Submit your application and our team will review it promptly.
                  </p>
                  <Button
                    onClick={() => setApplicationOpen(true)}
                    data-testid="button-apply-bottom"
                  >
                    Apply Now
                  </Button>
                </CardContent>
              </Card>
            </div>
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
