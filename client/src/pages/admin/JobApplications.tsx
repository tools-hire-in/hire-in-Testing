import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Search, Eye, Download, CheckCircle, XCircle, Clock, ExternalLink, Briefcase, RefreshCw, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
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

const statusConfig = {
  new: { label: "New", icon: Clock, color: "bg-blue-100 text-blue-800" },
  reviewed: { label: "Reviewed", icon: Eye, color: "bg-yellow-100 text-yellow-800" },
  shortlisted: { label: "Shortlisted", icon: CheckCircle, color: "bg-green-100 text-green-800" },
  rejected: { label: "Rejected", icon: XCircle, color: "bg-red-100 text-red-800" },
};

const ceipalSyncConfig: Record<string, { label: string; color: string }> = {
  synced: { label: "Synced", color: "bg-green-100 text-green-800" },
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-800" },
  failed: { label: "Failed", color: "bg-red-100 text-red-800" },
  skipped: { label: "Skipped", color: "bg-gray-100 text-gray-800" },
};

export default function JobApplications() {
  const params = useParams<{ jobId: string }>();
  const jobId = params.jobId;
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedApp, setSelectedApp] = useState<ApplicationWithJob | null>(null);
  const [jobDetailApp, setJobDetailApp] = useState<ApplicationWithJob | null>(null);

  const { data: applications, isLoading } = useQuery<ApplicationWithJob[]>({
    queryKey: ["/api/admin/applications", { jobId }],
    queryFn: async () => {
      const res = await fetch(`/api/admin/applications?jobId=${encodeURIComponent(jobId)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch applications");
      return res.json();
    },
    enabled: isAuthenticated && !!jobId,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return apiRequest("PATCH", `/api/admin/applications/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/applications"] });
      toast({ title: "Status updated" });
    },
  });

  const retryCeipalMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/admin/applications/${id}/retry-ceipal`);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/applications"] });
      if (data.success) {
        toast({ title: "Synced to Ceipal", description: data.ceipalId ? `Ceipal ID: ${data.ceipalId}` : "Successfully synced" });
        if (selectedApp) {
          setSelectedApp({ ...selectedApp, ceipalSyncStatus: "synced", ceipalApplicantId: data.ceipalId || null });
        }
      } else {
        toast({ title: "Ceipal sync failed", description: data.error || "Unknown error", variant: "destructive" });
        if (selectedApp) {
          setSelectedApp({ ...selectedApp, ceipalSyncStatus: "failed" });
        }
      }
    },
    onError: () => {
      toast({ title: "Retry failed", description: "Could not connect to Ceipal", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/admin/login");
    }
  }, [authLoading, isAuthenticated, setLocation]);

  if (authLoading || !isAuthenticated) {
    return null;
  }

  const isUnlinked = jobId === "unlinked";
  const firstApp = applications?.[0];
  const jobInfo = isUnlinked ? {
    title: "Unlinked Applications",
    requirementId: undefined,
    ceipalCode: undefined,
    city: undefined,
    state: undefined,
    type: undefined,
  } : firstApp ? {
    title: firstApp.jobTitle || "Unknown Job",
    requirementId: firstApp.jobRequirementId,
    ceipalCode: firstApp.ceipalJobCode || firstApp.ceipalJobId,
    city: firstApp.jobCity,
    state: firstApp.jobState,
    type: firstApp.jobType,
  } : null;

  const filteredApps = applications?.filter((app) => {
    const matchesSearch =
      app.candidateName.toLowerCase().includes(search.toLowerCase()) ||
      app.email.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || app.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-start gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/admin/applications")}
            data-testid="button-back-applications"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold" data-testid="text-job-title">
              {isLoading ? <Skeleton className="h-8 w-64" /> : (jobInfo?.title || "Job Applications")}
            </h1>
            <p className="text-muted-foreground">
              {isLoading ? (
                <Skeleton className="h-4 w-48 mt-1" />
              ) : (
                <>
                  {filteredApps?.length ?? 0} application{(filteredApps?.length ?? 0) !== 1 ? "s" : ""}
                </>
              )}
            </p>
          </div>
        </div>

        {jobInfo && (
          <div className="flex items-center gap-3 flex-wrap">
            {jobInfo.requirementId && (
              <Badge variant="outline" data-testid="badge-req-id">Req: {jobInfo.requirementId}</Badge>
            )}
            {jobInfo.ceipalCode && (
              <Badge variant="outline" data-testid="badge-ceipal-code">Ceipal: {jobInfo.ceipalCode}</Badge>
            )}
            {(jobInfo.city || jobInfo.state) && (
              <Badge variant="outline" data-testid="badge-location">
                {[jobInfo.city, jobInfo.state].filter(Boolean).join(", ")}
              </Badge>
            )}
            {jobInfo.type && (
              <Badge variant="outline" data-testid="badge-job-type">{jobInfo.type}</Badge>
            )}
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              data-testid="input-search-job-applications"
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

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Experience</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ceipal</TableHead>
                  <TableHead>Applied</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredApps && filteredApps.length > 0 ? (
                  filteredApps.map((app) => {
                    const status = statusConfig[app.status as keyof typeof statusConfig] || statusConfig.new;
                    const syncStatus = ceipalSyncConfig[app.ceipalSyncStatus || "pending"] || ceipalSyncConfig.pending;
                    return (
                      <TableRow key={app.id} data-testid={`row-application-${app.id}`}>
                        <TableCell className="font-medium">{app.candidateName}</TableCell>
                        <TableCell>
                          <div className="text-sm">{app.email}</div>
                          <div className="text-xs text-muted-foreground">{app.phone}</div>
                        </TableCell>
                        <TableCell>
                          {app.yearsExperience ? `${app.yearsExperience} years` : "\u2014"}
                        </TableCell>
                        <TableCell>
                          <Badge className={status.color}>{status.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={syncStatus.color} data-testid={`badge-ceipal-sync-${app.id}`}>
                            {syncStatus.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {app.createdAt
                            ? format(new Date(app.createdAt), "MMM d, yyyy")
                            : "\u2014"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedApp(app)}
                            data-testid={`button-view-application-${app.id}`}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No applications found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {selectedApp && (
          <Dialog open={!!selectedApp} onOpenChange={() => setSelectedApp(null)}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{selectedApp.candidateName}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Email</label>
                    <p>{selectedApp.email}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Phone</label>
                    <p>{selectedApp.phone}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Experience</label>
                    <p>{selectedApp.yearsExperience ? `${selectedApp.yearsExperience} years` : "Not specified"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Current Employer</label>
                    <p>{selectedApp.currentEmployer || "Not specified"}</p>
                  </div>
                </div>

                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-start justify-between gap-3">
                    <div className="grid grid-cols-2 gap-3 flex-1">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Ceipal Sync Status</label>
                        <div className="mt-1">
                          <Badge className={(ceipalSyncConfig[selectedApp.ceipalSyncStatus || "pending"] || ceipalSyncConfig.pending).color}>
                            <RefreshCw className="h-3 w-3 mr-1" />
                            {(ceipalSyncConfig[selectedApp.ceipalSyncStatus || "pending"] || ceipalSyncConfig.pending).label}
                          </Badge>
                        </div>
                      </div>
                      {selectedApp.ceipalApplicantId && (
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Ceipal Applicant ID</label>
                          <p className="text-sm font-mono" data-testid="text-ceipal-applicant-id">{selectedApp.ceipalApplicantId}</p>
                        </div>
                      )}
                    </div>
                    {(selectedApp.ceipalSyncStatus === "failed" || selectedApp.ceipalSyncStatus === "pending") && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => retryCeipalMutation.mutate(selectedApp.id)}
                        disabled={retryCeipalMutation.isPending}
                        data-testid="button-retry-ceipal"
                      >
                        <RefreshCw className={`h-3 w-3 mr-1 ${retryCeipalMutation.isPending ? "animate-spin" : ""}`} />
                        {retryCeipalMutation.isPending ? "Syncing..." : "Retry Sync"}
                      </Button>
                    )}
                  </div>
                </div>

                {selectedApp.resumePath && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Resume</label>
                    <p>
                      <a
                        href={selectedApp.resumePath}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-1"
                        data-testid="link-app-resume"
                      >
                        <Download className="h-4 w-4" />
                        Download Resume
                      </a>
                    </p>
                  </div>
                )}
                {selectedApp.linkedinUrl && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">LinkedIn</label>
                    <p>
                      <a
                        href={selectedApp.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-1"
                      >
                        <ExternalLink className="h-4 w-4" />
                        {selectedApp.linkedinUrl}
                      </a>
                    </p>
                  </div>
                )}
                {selectedApp.coverLetter && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Cover Letter</label>
                    <p className="whitespace-pre-wrap text-sm bg-muted p-3 rounded-lg">
                      {selectedApp.coverLetter}
                    </p>
                  </div>
                )}
                <div className="flex items-center gap-4 pt-4 border-t">
                  <label className="text-sm font-medium">Update Status:</label>
                  <Select
                    value={selectedApp.status}
                    onValueChange={(status) => {
                      updateStatusMutation.mutate({ id: selectedApp.id, status });
                      setSelectedApp({ ...selectedApp, status });
                    }}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="reviewed">Reviewed</SelectItem>
                      <SelectItem value="shortlisted">Shortlisted</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {jobDetailApp && (
          <Dialog open={!!jobDetailApp} onOpenChange={() => setJobDetailApp(null)}>
            <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5" />
                  {jobDetailApp.jobTitle || "Job Details"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {jobDetailApp.jobRequirementId && (
                    <div className="p-2 bg-muted rounded">
                      <label className="text-xs font-medium text-muted-foreground">Requirement ID</label>
                      <p className="text-sm font-medium">{jobDetailApp.jobRequirementId}</p>
                    </div>
                  )}
                  {(jobDetailApp.ceipalJobCode || jobDetailApp.ceipalJobId) && (
                    <div className="p-2 bg-muted rounded">
                      <label className="text-xs font-medium text-muted-foreground">Ceipal Job ID</label>
                      <p className="text-sm font-medium">{jobDetailApp.ceipalJobCode || jobDetailApp.ceipalJobId}</p>
                    </div>
                  )}
                  {jobDetailApp.jobType && (
                    <div className="p-2 bg-muted rounded">
                      <label className="text-xs font-medium text-muted-foreground">Employment Type</label>
                      <p className="text-sm font-medium">{jobDetailApp.jobType}</p>
                    </div>
                  )}
                  {(jobDetailApp.jobCity || jobDetailApp.jobState) && (
                    <div className="p-2 bg-muted rounded">
                      <label className="text-xs font-medium text-muted-foreground">Location</label>
                      <p className="text-sm font-medium">{[jobDetailApp.jobCity, jobDetailApp.jobState].filter(Boolean).join(", ")}</p>
                    </div>
                  )}
                </div>

                {jobDetailApp.jobDescription && (
                  <div>
                    <label className="text-sm font-semibold">Job Description</label>
                    <div
                      className="mt-2 prose prose-sm max-w-none bg-muted/50 p-4 rounded-lg text-sm"
                      dangerouslySetInnerHTML={{
                        __html: jobDetailApp.jobDescription
                          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
                          .replace(/on\w+\s*=/gi, "data-removed=")
                      }}
                      data-testid="text-job-description"
                    />
                  </div>
                )}

                {!jobDetailApp.jobDescription && (
                  <p className="text-center text-muted-foreground py-4">No job description available.</p>
                )}

                {jobDetailApp.jobId && (
                  <div className="pt-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(`/jobs/${jobDetailApp.jobId}`, "_blank")}
                      data-testid="button-open-job-page"
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Open Job Page
                    </Button>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </AdminLayout>
  );
}
