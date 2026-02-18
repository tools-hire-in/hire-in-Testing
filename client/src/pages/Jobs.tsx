import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Search, MapPin, Clock, DollarSign, Filter, X, ArrowRight } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ApplicationModal } from "@/components/jobs/ApplicationModal";
import type { Job } from "@shared/schema";

export default function Jobs() {
  const [search, setSearch] = useState("");
  const [specialty, setSpecialty] = useState<string>("");
  const [state, setState] = useState<string>("");
  const [jobType, setJobType] = useState<string>("");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [applicationOpen, setApplicationOpen] = useState(false);

  const { data: jobs, isLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs", { search, specialty, state, jobType }],
  });

  const { data: filters } = useQuery<{
    specialties: string[];
    states: string[];
    jobTypes: string[];
  }>({
    queryKey: ["/api/jobs/filters"],
  });

  const clearFilters = () => {
    setSearch("");
    setSpecialty("");
    setState("");
    setJobType("");
  };

  const hasFilters = search || specialty || state || jobType;

  const openApplication = (job: Job) => {
    setSelectedJob(job);
    setApplicationOpen(true);
  };

  return (
    <Layout>
      {/* Header */}
      <section className="py-16 px-4 lg:px-6 bg-gradient-to-br from-primary/5 via-background to-primary/10">
        <div className="container mx-auto max-w-5xl text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4" data-testid="text-jobs-title">
            Career Opportunities
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Find your next career opportunity with Hire'in Solutions. Browse our current
            openings across Healthcare, IT, and Professional Services.
          </p>
        </div>
      </section>

      {/* Filters */}
      <section className="py-8 px-4 lg:px-6 border-b">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by title, specialty, or keyword..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                data-testid="input-search"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <Select value={specialty} onValueChange={setSpecialty}>
                <SelectTrigger className="w-[180px]" data-testid="select-specialty">
                  <SelectValue placeholder="Specialty" />
                </SelectTrigger>
                <SelectContent>
                  {filters?.specialties.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={state} onValueChange={setState}>
                <SelectTrigger className="w-[140px]" data-testid="select-state">
                  <SelectValue placeholder="State" />
                </SelectTrigger>
                <SelectContent>
                  {filters?.states.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={jobType} onValueChange={setJobType}>
                <SelectTrigger className="w-[160px]" data-testid="select-job-type">
                  <SelectValue placeholder="Job Type" />
                </SelectTrigger>
                <SelectContent>
                  {filters?.jobTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {hasFilters && (
                <Button
                  variant="ghost"
                  onClick={clearFilters}
                  className="text-muted-foreground"
                  data-testid="button-clear-filters"
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Job Listings */}
      <section className="py-12 px-4 lg:px-6">
        <div className="container mx-auto max-w-6xl">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2 mt-2" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-4 w-2/3 mb-4" />
                    <Skeleton className="h-10 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : jobs && jobs.length > 0 ? (
            <>
              <p className="text-muted-foreground mb-6">
                Showing {jobs.length} position{jobs.length !== 1 ? "s" : ""}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {jobs.map((job) => (
                  <Card
                    key={job.id}
                    className="flex flex-col hover-elevate"
                    data-testid={`card-job-${job.id}`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/jobs/${job.id}`}>
                          <CardTitle className="text-lg line-clamp-2 cursor-pointer hover:text-primary transition-colors" data-testid={`link-job-title-${job.id}`}>
                            {job.title}
                          </CardTitle>
                        </Link>
                        {job.isHot && (
                          <Badge variant="destructive" className="flex-shrink-0">
                            Hot
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        <span>
                          {[job.city, job.state].filter(Boolean).join(", ") || "Remote"}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col">
                      <div className="flex flex-wrap gap-2 mb-4">
                        {job.jobType && (
                          <Badge variant="secondary">
                            <Clock className="h-3 w-3 mr-1" />
                            {job.jobType}
                          </Badge>
                        )}
                        {job.specialty && (
                          <Badge variant="outline">{job.specialty}</Badge>
                        )}
                      </div>
                      {job.payRate && (
                        <div className="flex items-center gap-1 text-sm text-primary font-medium mb-3">
                          <DollarSign className="h-4 w-4" />
                          {job.payRate}
                        </div>
                      )}
                      {job.description && (
                        <p className="text-sm text-muted-foreground line-clamp-3 mb-4 flex-1">
                          {job.description.replace(/<[^>]*>/g, "").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&")}
                        </p>
                      )}
                      <div className="flex gap-2 mt-auto">
                        <Link href={`/jobs/${job.id}`} className="flex-1">
                          <Button
                            variant="outline"
                            className="w-full"
                            data-testid={`button-view-${job.id}`}
                          >
                            View Details
                            <ArrowRight className="h-4 w-4 ml-1" />
                          </Button>
                        </Link>
                        <Button
                          onClick={() => openApplication(job)}
                          className="flex-1"
                          data-testid={`button-apply-${job.id}`}
                        >
                          Apply Now
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-16">
              <Filter className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No positions found</h3>
              <p className="text-muted-foreground mb-4">
                {hasFilters
                  ? "Try adjusting your filters or search terms"
                  : "Check back soon for new opportunities"}
              </p>
              {hasFilters && (
                <Button variant="outline" onClick={clearFilters}>
                  Clear Filters
                </Button>
              )}
            </div>
          )}
        </div>
      </section>

      {selectedJob && (
        <ApplicationModal
          open={applicationOpen}
          onOpenChange={setApplicationOpen}
          job={selectedJob}
        />
      )}
    </Layout>
  );
}
