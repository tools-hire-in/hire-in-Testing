import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Search, Briefcase, MapPin, Clock, Users, LinkIcon } from "lucide-react";
import { format } from "date-fns";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useNewLook } from "@/hooks/use-new-look";
import { V2PageHeader } from "@/components/admin/V2PageHeader";
import type { Application } from "@shared/schema";

type ApplicationWithJob = Application & {
  jobTitle?: string;
  jobRequirementId?: string;
  ceipalJobId?: string;
  ceipalJobCode?: string;
  jobDescription?: string;
  jobCity?: string;
  jobState?: string;
  jobType?: string;
};

type JobGroup = {
  jobId: string | null;
  jobTitle: string;
  jobRequirementId?: string;
  ceipalJobCode?: string;
  ceipalJobId?: string;
  jobCity?: string;
  jobState?: string;
  jobType?: string;
  applications: ApplicationWithJob[];
  statusCounts: Record<string, number>;
  ceipalStatusCounts: Record<string, number>;
  latestAppliedDate: string | null;
};

const statusLabels: Record<string, string> = {
  new: "New",
  reviewed: "Reviewed",
  shortlisted: "Shortlisted",
  rejected: "Rejected",
};

const statusColors: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  reviewed: "bg-yellow-100 text-yellow-800",
  shortlisted: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

export function AdminApplicationsContent({ embedded = false }: { embedded?: boolean }) {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { enabled: newLook } = useNewLook();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: applications, isLoading } = useQuery<ApplicationWithJob[]>({
    queryKey: ["/api/admin/applications"],
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/admin/login");
    }
  }, [authLoading, isAuthenticated, setLocation]);

  const jobGroups = useMemo(() => {
    if (!applications) return [];

    const groupMap = new Map<string, JobGroup>();

    for (const app of applications) {
      const key = app.jobId || "__unlinked__";

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          jobId: app.jobId || null,
          jobTitle: app.jobTitle || (app.jobId ? "Unknown Job" : "Unlinked Applications"),
          jobRequirementId: app.jobRequirementId,
          ceipalJobCode: app.ceipalJobCode,
          ceipalJobId: app.ceipalJobId,
          jobCity: app.jobCity,
          jobState: app.jobState,
          jobType: app.jobType,
          applications: [],
          statusCounts: {},
          ceipalStatusCounts: {},
          latestAppliedDate: null,
        });
      }

      const group = groupMap.get(key)!;
      group.applications.push(app);

      const status = app.status || "new";
      group.statusCounts[status] = (group.statusCounts[status] || 0) + 1;

      const ceipalStatus = app.ceipalSyncStatus || "pending";
      group.ceipalStatusCounts[ceipalStatus] = (group.ceipalStatusCounts[ceipalStatus] || 0) + 1;

      if (app.createdAt) {
        const appDate = new Date(app.createdAt).toISOString();
        if (!group.latestAppliedDate || appDate > group.latestAppliedDate) {
          group.latestAppliedDate = appDate;
        }
      }
    }

    const groups = Array.from(groupMap.values());
    groups.sort((a, b) => {
      if (a.jobId === null) return 1;
      if (b.jobId === null) return -1;
      return b.applications.length - a.applications.length;
    });

    return groups;
  }, [applications]);

  const filteredGroups = useMemo(() => {
    return jobGroups.filter((group) => {
      const searchLower = search.toLowerCase();
      const matchesSearch =
        !search ||
        group.jobTitle.toLowerCase().includes(searchLower) ||
        (group.jobRequirementId || "").toLowerCase().includes(searchLower) ||
        (group.ceipalJobCode || "").toLowerCase().includes(searchLower) ||
        group.applications.some(
          (app) =>
            app.candidateName.toLowerCase().includes(searchLower) ||
            app.email.toLowerCase().includes(searchLower)
        );

      const matchesStatus =
        statusFilter === "all" ||
        group.applications.some((app) => app.status === statusFilter);

      return matchesSearch && matchesStatus;
    });
  }, [jobGroups, search, statusFilter]);

  const totalApplications = applications?.length ?? 0;
  const totalJobsWithApps = jobGroups.filter((g) => g.jobId !== null).length;

  if (authLoading || !isAuthenticated) {
    return null;
  }

  return (
      <div className="space-y-6">
        {newLook ? (
          !embedded && (
            <V2PageHeader
              icon={Users}
              eyebrow="Recruitment"
              title="Applications"
              subtitle="Review and manage job applications"
              testId="text-page-title"
            />
          )
        ) : (
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-page-title">Applications</h1>
            <p className="text-muted-foreground">Review and manage job applications</p>
          </div>
        )}

        <div className="flex items-center gap-4 flex-wrap">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold" data-testid="text-total-applications">{isLoading ? "—" : totalApplications}</p>
                <p className="text-xs text-muted-foreground">Total Applications</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Briefcase className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold" data-testid="text-total-jobs">{isLoading ? "—" : totalJobsWithApps}</p>
                <p className="text-xs text-muted-foreground">Jobs with Applications</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by job title, ID, or candidate..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              data-testid="input-search-applications"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="reviewed">Reviewed</SelectItem>
              <SelectItem value="shortlisted">Shortlisted</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-5 space-y-3">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-10 w-20" />
                  <Skeleton className="h-4 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredGroups.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredGroups.map((group) => {
              const isUnlinked = group.jobId === null;
              const location = [group.jobCity, group.jobState].filter(Boolean).join(", ");
              const codeDisplay = group.ceipalJobCode || group.ceipalJobId || group.jobRequirementId;

              return (
                <Card
                  key={group.jobId || "__unlinked__"}
                  className="cursor-pointer hover-elevate transition-colors"
                  onClick={() => {
                    if (isUnlinked) {
                      setLocation("/admin/applications/job/unlinked");
                    } else {
                      setLocation(`/admin/applications/job/${group.jobId}`);
                    }
                  }}
                  data-testid={`card-job-group-${group.jobId || "unlinked"}`}
                >
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate" data-testid={`text-job-title-${group.jobId || "unlinked"}`}>
                          {isUnlinked ? (
                            <span className="flex items-center gap-1.5">
                              <LinkIcon className="h-4 w-4 flex-shrink-0" />
                              {group.jobTitle}
                            </span>
                          ) : (
                            group.jobTitle
                          )}
                        </h3>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {codeDisplay && !isUnlinked && (
                            <span className="text-xs text-muted-foreground" data-testid={`text-job-code-${group.jobId}`}>
                              {group.jobRequirementId ? `Req: ${group.jobRequirementId}` : ""}
                              {group.jobRequirementId && (group.ceipalJobCode || group.ceipalJobId) ? " · " : ""}
                              {(group.ceipalJobCode || group.ceipalJobId) ? `Ceipal: ${group.ceipalJobCode || group.ceipalJobId}` : ""}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-3xl font-bold" data-testid={`text-app-count-${group.jobId || "unlinked"}`}>
                          {group.applications.length}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          application{group.applications.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>

                    {location && !isUnlinked && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 flex-shrink-0" />
                        <span>{location}</span>
                        {group.jobType && (
                          <>
                            <span className="mx-1">·</span>
                            <span>{group.jobType}</span>
                          </>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {Object.entries(group.statusCounts).map(([status, count]) => (
                        <Badge
                          key={status}
                          variant="secondary"
                          className={`text-xs ${statusColors[status] || ""}`}
                          data-testid={`badge-status-${status}-${group.jobId || "unlinked"}`}
                        >
                          {count} {statusLabels[status] || status}
                        </Badge>
                      ))}
                    </div>

                    {group.latestAppliedDate && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground pt-1">
                        <Clock className="h-3 w-3" />
                        <span>Latest: {format(new Date(group.latestAppliedDate), "MMM d, yyyy")}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No applications found.
            </CardContent>
          </Card>
        )}
      </div>
  );
}

export default function AdminApplications() {
  return (
    <AdminLayout>
      <AdminApplicationsContent />
    </AdminLayout>
  );
}
