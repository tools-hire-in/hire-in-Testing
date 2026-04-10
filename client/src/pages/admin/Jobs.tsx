import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Upload, Trash2, Edit, MoreHorizontal, Search, Eye, EyeOff, Download, CheckSquare, RefreshCw } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Job } from "@shared/schema";

interface JobFormData {
  title: string;
  specialty: string;
  city: string;
  state: string;
  jobType: string;
  shift: string;
  department: string;
  facility: string;
  payRate: string;
  description: string;
  requirements: string;
  isActive: boolean;
  isHot: boolean;
}

const emptyFormData: JobFormData = {
  title: "",
  specialty: "",
  city: "",
  state: "",
  jobType: "Full-Time",
  shift: "",
  department: "",
  facility: "",
  payRate: "",
  description: "",
  requirements: "",
  isActive: true,
  isHot: false,
};

export function AdminJobsContent() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [jobFormOpen, setJobFormOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [formData, setFormData] = useState<JobFormData>(emptyFormData);
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState<string | null>(null);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);

  const { data: jobs, isLoading } = useQuery<Job[]>({
    queryKey: ["/api/admin/jobs"],
    enabled: isAuthenticated,
  });

  const { data: applicationCounts } = useQuery<Record<string, number>>({
    queryKey: ["/api/admin/jobs/application-counts"],
    enabled: isAuthenticated,
  });

  const createMutation = useMutation({
    mutationFn: async (data: JobFormData) => {
      return apiRequest("POST", "/api/admin/jobs", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: "Job created successfully" });
      setJobFormOpen(false);
      setFormData(emptyFormData);
    },
    onError: () => {
      toast({ title: "Failed to create job", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<JobFormData> }) => {
      return apiRequest("PATCH", `/api/admin/jobs/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: "Job updated successfully" });
      setJobFormOpen(false);
      setEditingJob(null);
      setFormData(emptyFormData);
    },
    onError: () => {
      toast({ title: "Failed to update job", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/jobs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: "Job deleted successfully" });
      setDeleteConfirmOpen(false);
      setJobToDelete(null);
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return apiRequest("POST", "/api/admin/jobs/bulk-delete", { ids });
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: `Deleted ${ids.length} jobs` });
      setSelectedJobs(new Set());
      setBulkDeleteConfirmOpen(false);
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ ids, updates }: { ids: string[]; updates: Partial<Job> }) => {
      return apiRequest("POST", "/api/admin/jobs/bulk-update", { ids, updates });
    },
    onSuccess: (_, { ids }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: `Updated ${ids.length} jobs` });
      setSelectedJobs(new Set());
    },
  });

  const ceipalSyncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/jobs/sync-ceipal");
      return await res.json();
    },
    onSuccess: (data: { message?: string; created?: number; updated?: number; total?: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({
        title: "Ceipal Sync Complete",
        description: data.message || `${data.created || 0} new, ${data.updated || 0} updated`,
      });
    },
    onError: (err: any) => {
      toast({ title: "Ceipal sync failed", description: err.message, variant: "destructive" });
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

  const filteredJobs = jobs?.filter(
    (job) =>
      job.title.toLowerCase().includes(search.toLowerCase()) ||
      job.specialty?.toLowerCase().includes(search.toLowerCase()) ||
      job.city?.toLowerCase().includes(search.toLowerCase())
  );

  const downloadTemplate = () => {
    const headers = ["title", "specialty", "city", "state", "jobType", "shift", "department", "facility", "payRate", "description", "requirements"];
    const sampleRow = [
      "Registered Nurse",
      "ICU",
      "Houston",
      "TX",
      "Full-Time",
      "Day",
      "Emergency",
      "Memorial Hospital",
      "$45/hr",
      "We are seeking an experienced ICU Registered Nurse to join our team.",
      "Active RN license; 2+ years ICU experience; BLS and ACLS certification"
    ];
    const csvContent = [headers.join(","), sampleRow.join(",")].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "job_upload_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const openAddJob = () => {
    setEditingJob(null);
    setFormData(emptyFormData);
    setJobFormOpen(true);
  };

  const openEditJob = (job: Job) => {
    setEditingJob(job);
    setFormData({
      title: job.title || "",
      specialty: job.specialty || "",
      city: job.city || "",
      state: job.state || "",
      jobType: job.jobType || "Full-Time",
      shift: job.shift || "",
      department: job.department || "",
      facility: job.facility || "",
      payRate: job.payRate || "",
      description: job.description || "",
      requirements: job.requirements || "",
      isActive: job.isActive,
      isHot: job.isHot,
    });
    setJobFormOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    if (editingJob) {
      updateMutation.mutate({ id: editingJob.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const confirmDelete = (id: string) => {
    setJobToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const handleSelectAll = () => {
    if (!filteredJobs) return;
    if (selectedJobs.size === filteredJobs.length) {
      setSelectedJobs(new Set());
    } else {
      setSelectedJobs(new Set(filteredJobs.map(j => j.id)));
    }
  };

  const toggleJobSelection = (id: string) => {
    const newSelected = new Set(selectedJobs);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedJobs(newSelected);
  };

  const handleBulkActivate = () => {
    bulkUpdateMutation.mutate({ ids: Array.from(selectedJobs), updates: { isActive: true } });
  };

  const handleBulkDeactivate = () => {
    bulkUpdateMutation.mutate({ ids: Array.from(selectedJobs), updates: { isActive: false } });
  };

  const handleBulkDelete = () => {
    setBulkDeleteConfirmOpen(true);
  };

  const confirmBulkDelete = () => {
    bulkDeleteMutation.mutate(Array.from(selectedJobs));
  };

  return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Jobs</h1>
            <p className="text-muted-foreground">
              Manage job listings and upload new positions
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Button
              variant="outline"
              onClick={() => ceipalSyncMutation.mutate()}
              disabled={ceipalSyncMutation.isPending}
              data-testid="button-sync-ceipal"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${ceipalSyncMutation.isPending ? "animate-spin" : ""}`} />
              {ceipalSyncMutation.isPending ? "Syncing..." : "Sync from Ceipal"}
            </Button>
            <Button variant="outline" onClick={() => setUploadOpen(true)} data-testid="button-upload-csv">
              <Upload className="h-4 w-4 mr-2" />
              Upload CSV
            </Button>
            <Button onClick={openAddJob} data-testid="button-add-job">
              <Plus className="h-4 w-4 mr-2" />
              Add Job
            </Button>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {selectedJobs.size > 0 && (
          <Card className="bg-muted/50">
            <CardContent className="py-3 px-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <span className="text-sm font-medium">
                  {selectedJobs.size} job{selectedJobs.size > 1 ? "s" : ""} selected
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={handleBulkActivate} data-testid="button-bulk-activate">
                    <Eye className="h-4 w-4 mr-1" />
                    Activate
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleBulkDeactivate} data-testid="button-bulk-deactivate">
                    <EyeOff className="h-4 w-4 mr-1" />
                    Deactivate
                  </Button>
                  <Button size="sm" variant="destructive" onClick={handleBulkDelete} data-testid="button-bulk-delete">
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedJobs(new Set())}>
                    Clear
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search jobs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            data-testid="input-search-jobs"
          />
        </div>

        {/* Jobs Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={filteredJobs && filteredJobs.length > 0 && selectedJobs.size === filteredJobs.length}
                      onCheckedChange={handleSelectAll}
                      data-testid="checkbox-select-all"
                    />
                  </TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Job ID</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Applications</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredJobs && filteredJobs.length > 0 ? (
                  filteredJobs.map((job) => (
                    <TableRow key={job.id} data-testid={`row-job-${job.id}`}>
                      <TableCell>
                        <Checkbox
                          checked={selectedJobs.has(job.id)}
                          onCheckedChange={() => toggleJobSelection(job.id)}
                          data-testid={`checkbox-job-${job.id}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {job.title}
                            {job.isHot && <Badge variant="destructive" className="text-xs">Hot</Badge>}
                            {job.source === "ceipal" && <Badge variant="outline" className="text-xs">Ceipal</Badge>}
                          </div>
                          {job.specialty && (
                            <span className="text-sm text-muted-foreground">{job.specialty}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground font-mono" data-testid={`text-jobid-${job.id}`}>
                          {job.jobId || job.ceipalJobCode || job.ceipalJobId || "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {[job.city, job.state].filter(Boolean).join(", ") || "Remote"}
                      </TableCell>
                      <TableCell>{job.jobType || "—"}</TableCell>
                      <TableCell>
                        {(() => {
                          const count = applicationCounts?.[job.id] || 0;
                          if (count > 0) {
                            return (
                              <Link href={`/admin/applications/job/${job.id}`}>
                                <Badge variant="default" className="cursor-pointer" data-testid={`badge-app-count-${job.id}`}>
                                  {count}
                                </Badge>
                              </Link>
                            );
                          }
                          return <span className="text-muted-foreground text-sm" data-testid={`text-app-count-${job.id}`}>0</span>;
                        })()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={job.isActive ? "default" : "secondary"}>
                          {job.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`button-actions-${job.id}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditJob(job)} data-testid={`button-edit-${job.id}`}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                updateMutation.mutate({
                                  id: job.id,
                                  data: { isActive: !job.isActive },
                                })
                              }
                            >
                              {job.isActive ? (
                                <>
                                  <EyeOff className="h-4 w-4 mr-2" />
                                  Deactivate
                                </>
                              ) : (
                                <>
                                  <Eye className="h-4 w-4 mr-2" />
                                  Activate
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => confirmDelete(job.id)}
                              data-testid={`button-delete-${job.id}`}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No jobs found. Upload a CSV or add a job manually.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Add/Edit Job Dialog */}
        <Dialog open={jobFormOpen} onOpenChange={setJobFormOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingJob ? "Edit Job" : "Add New Job"}</DialogTitle>
              <DialogDescription>
                {editingJob ? "Update the job details below." : "Fill in the job details to create a new listing."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., Registered Nurse"
                    data-testid="input-job-title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="specialty">Specialty</Label>
                  <Input
                    id="specialty"
                    value={formData.specialty}
                    onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                    placeholder="e.g., ICU, ER, Med-Surg"
                    data-testid="input-job-specialty"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="e.g., Houston"
                    data-testid="input-job-city"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    placeholder="e.g., TX"
                    data-testid="input-job-state"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="jobType">Job Type</Label>
                  <Select
                    value={formData.jobType}
                    onValueChange={(value) => setFormData({ ...formData, jobType: value })}
                  >
                    <SelectTrigger data-testid="select-job-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Full-Time">Full-Time</SelectItem>
                      <SelectItem value="Part-Time">Part-Time</SelectItem>
                      <SelectItem value="Contract">Contract</SelectItem>
                      <SelectItem value="Travel">Travel</SelectItem>
                      <SelectItem value="Per Diem">Per Diem</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shift">Shift</Label>
                  <Input
                    id="shift"
                    value={formData.shift}
                    onChange={(e) => setFormData({ ...formData, shift: e.target.value })}
                    placeholder="e.g., Day, Night"
                    data-testid="input-job-shift"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payRate">Pay Rate</Label>
                  <Input
                    id="payRate"
                    value={formData.payRate}
                    onChange={(e) => setFormData({ ...formData, payRate: e.target.value })}
                    placeholder="e.g., $45/hr"
                    data-testid="input-job-pay"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="facility">Facility</Label>
                  <Input
                    id="facility"
                    value={formData.facility}
                    onChange={(e) => setFormData({ ...formData, facility: e.target.value })}
                    placeholder="e.g., Memorial Hospital"
                    data-testid="input-job-facility"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <Input
                    id="department"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    placeholder="e.g., Emergency"
                    data-testid="input-job-department"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Job description..."
                  rows={3}
                  data-testid="input-job-description"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="requirements">Requirements</Label>
                <Textarea
                  id="requirements"
                  value={formData.requirements}
                  onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                  placeholder="Job requirements..."
                  rows={3}
                  data-testid="input-job-requirements"
                />
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData({ ...formData, isActive: !!checked })}
                    data-testid="checkbox-job-active"
                  />
                  <Label htmlFor="isActive">Active</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="isHot"
                    checked={formData.isHot}
                    onCheckedChange={(checked) => setFormData({ ...formData, isHot: !!checked })}
                    data-testid="checkbox-job-hot"
                  />
                  <Label htmlFor="isHot">Mark as Hot Job</Label>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setJobFormOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-job"
              >
                {createMutation.isPending || updateMutation.isPending ? "Saving..." : editingJob ? "Update Job" : "Create Job"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Job</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this job? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => jobToDelete && deleteMutation.mutate(jobToDelete)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Bulk Delete Confirmation Dialog */}
        <AlertDialog open={bulkDeleteConfirmOpen} onOpenChange={setBulkDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {selectedJobs.size} Jobs</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedJobs.size} job{selectedJobs.size > 1 ? "s" : ""}? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmBulkDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete {selectedJobs.size} Jobs
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* CSV Upload Dialog */}
        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Jobs CSV</DialogTitle>
              <DialogDescription>
                Upload a CSV or XLSX file exported from your ATS. All columns will be imported
                and stored for reference.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                <p className="text-sm text-muted-foreground mb-2">
                  Drag and drop your file here, or click to browse
                </p>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  id="csv-upload"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const formData = new FormData();
                      formData.append("file", file);
                      try {
                        await fetch("/api/admin/jobs/upload", {
                          method: "POST",
                          body: formData,
                        });
                        queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs"] });
                        queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
                        toast({ title: "Jobs uploaded successfully" });
                        setUploadOpen(false);
                      } catch {
                        toast({
                          title: "Upload failed",
                          description: "Please check your file format",
                          variant: "destructive",
                        });
                      }
                    }
                  }}
                />
                <Button variant="outline" asChild>
                  <label htmlFor="csv-upload" className="cursor-pointer">
                    Browse Files
                  </label>
                </Button>
              </div>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-xs text-muted-foreground">
                  Supported formats: CSV, XLSX, XLS. Maximum file size: 10MB
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-primary"
                  onClick={downloadTemplate}
                  data-testid="button-download-template"
                >
                  <Download className="h-3 w-3 mr-1" />
                  Download Template
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
  );
}

export default function AdminJobs() {
  return (
    <AdminLayout>
      <AdminJobsContent />
    </AdminLayout>
  );
}
