import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Loader2, Plus, Search, FileEdit, Clock3, FastForward, UserPlus, UserX, DollarSign, MoreHorizontal, EyeOff, Archive } from "lucide-react";
import { STUDIO_CONTENT_TYPES, getStudioContentType } from "@shared/studioContent";
import { STATUS_LABELS, STATUS_BADGE_CLASS } from "./studioConstants";
import { OutdatedModelBadge } from "./ArticleRegenPanel";
import type { StudioArticle, StudioAuthorProfile } from "@shared/schema";

interface ArticleListResponse {
  items: (StudioArticle & { authorName: string | null })[];
  total: number;
}

const PAGE_SIZE = 20;

export function ArticlesPanel({ projectId, initialStatus }: { projectId: string; initialStatus?: string }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { can, role } = usePermissions();
  const canCreate = can("studio.create_article");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(initialStatus ?? "all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(1);

  // Handle ?new=1 URL param to auto-open the create dialog.
  const [createOpen, setCreateOpen] = useState(
    () => new URLSearchParams(window.location.search).get("new") === "1" && canCreate
  );
  const [newTitle, setNewTitle] = useState(
    () => new URLSearchParams(window.location.search).get("title") ?? ""
  );
  const [newType, setNewType] = useState("quick_take");
  const [newAudience, setNewAudience] = useState("");
  const [newContentGoal, setNewContentGoal] = useState("");
  const [newBrief, setNewBrief] = useState(
    () => new URLSearchParams(window.location.search).get("brief") ?? ""
  );
  const [newDomain, setNewDomain] = useState("");
  const [newPlannedDate, setNewPlannedDate] = useState("");

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const canBulkApprove = can("studio.marketing_approve");
  const canManageAuthors = can("studio.manage_authors");
  const showSelection = canBulkApprove || canManageAuthors;

  const [assignAuthorId, setAssignAuthorId] = useState<string>("");

  const isSuperAdmin = role === "super_admin";
  const [takeDownTarget, setTakeDownTarget] = useState<StudioArticle | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<StudioArticle | null>(null);

  const takeDownMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/admin/studio/articles/${id}/unpublish`);
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || "Failed to take down");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Content taken down", description: "It reverts to an unpublished (approved) state." });
      setTakeDownTarget(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/articles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/stats"] });
    },
    onError: (err: Error) =>
      toast({ title: "Take down failed", description: err.message, variant: "destructive" }),
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/admin/studio/articles/${id}/archive`);
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || "Failed to archive");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Article archived", description: "The article has been moved to the archive." });
      setArchiveTarget(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/articles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/stats"] });
    },
    onError: (err: Error) =>
      toast({ title: "Archive failed", description: err.message, variant: "destructive" }),
  });

  const { data: authors } = useQuery<StudioAuthorProfile[]>({
    queryKey: ["/api/admin/studio/authors", { projectId }],
    enabled: !!projectId && canManageAuthors,
  });
  const activeAuthors = (authors ?? []).filter((a) => a.isActive);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((a) => a.id)));
    }
  };

  const bulkApproveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/studio/articles/bulk-approve", {
        articleIds: Array.from(selectedIds),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || "Bulk approve failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      const succeeded = data.results.filter((r: any) => r.status !== "error" && r.status !== "skipped").length;
      toast({ title: `${succeeded} article(s) advanced in workflow` });
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/articles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/stats"] });
    },
    onError: (err: Error) => toast({ title: "Bulk approve failed", description: err.message, variant: "destructive" }),
  });

  const bulkAssignMutation = useMutation({
    mutationFn: async (authorProfileId: string | null) => {
      const res = await apiRequest("POST", "/api/admin/studio/articles/bulk-assign-author", {
        articleIds: Array.from(selectedIds),
        authorProfileId,
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || "Bulk assign failed");
      }
      return res.json();
    },
    onSuccess: (data, authorProfileId) => {
      toast({
        title: authorProfileId
          ? `${data.updated} article(s) reassigned`
          : `${data.updated} article(s) cleared`,
      });
      setSelectedIds(new Set());
      setAssignAuthorId("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/articles"] });
    },
    onError: (err: Error) => toast({ title: "Bulk assign failed", description: err.message, variant: "destructive" }),
  });

  const queryKey = [
    "/api/admin/studio/articles",
    {
      projectId,
      status: statusFilter === "all" ? "" : statusFilter,
      contentType: typeFilter === "all" ? "" : typeFilter,
      search,
      page,
      pageSize: PAGE_SIZE,
    },
  ];

  const { data, isLoading } = useQuery<ArticleListResponse>({
    queryKey,
    enabled: !!projectId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/studio/articles", {
        projectId,
        title: newTitle.trim(),
        contentType: newType,
        ...(newAudience ? { audience: [newAudience] } : {}),
        ...(newContentGoal ? { contentGoal: newContentGoal } : {}),
        ...(newBrief.trim() ? { generationBrief: newBrief.trim() } : {}),
        ...(newDomain ? { staffingDomain: newDomain } : {}),
        ...(newPlannedDate ? { scheduledAt: newPlannedDate } : {}),
      });
      return res.json();
    },
    onSuccess: (created: StudioArticle) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/articles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/stats"] });
      setCreateOpen(false);
      setNewTitle("");
      setNewType("quick_take");
      setNewAudience("");
      setNewContentGoal("");
      setNewBrief("");
      setNewDomain("");
      setNewPlannedDate("");
      toast({ title: "Article created", description: "Opening the editor…" });
      setLocation(`/admin/studio/articles/${created.id}/edit`);
    },
    onError: (err: Error) => {
      toast({ title: "Could not create article", description: err.message, variant: "destructive" });
    },
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const resetPageAnd = (fn: () => void) => {
    setPage(1);
    fn();
  };

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search titles…"
              value={search}
              onChange={(e) => resetPageAnd(() => setSearch(e.target.value))}
              className="pl-8"
              data-testid="input-search-articles"
            />
          </div>
          {isSuperAdmin && (
            <Button
              variant={statusFilter === "published" ? "default" : "outline"}
              size="sm"
              onClick={() => resetPageAnd(() => setStatusFilter(statusFilter === "published" ? "all" : "published"))}
              data-testid="button-filter-published"
            >
              Published
            </Button>
          )}
          <Select value={statusFilter} onValueChange={(v) => resetPageAnd(() => setStatusFilter(v))}>
            <SelectTrigger className="w-[150px]" data-testid="select-filter-status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.entries(STATUS_LABELS).map(([k, label]) => (
                <SelectItem key={k} value={k}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={(v) => resetPageAnd(() => setTypeFilter(v))}>
            <SelectTrigger className="w-[150px]" data-testid="select-filter-type">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {STUDIO_CONTENT_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          {canBulkApprove && selectedIds.size > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => bulkApproveMutation.mutate()}
              disabled={bulkApproveMutation.isPending}
              data-testid="button-bulk-approve"
            >
              {bulkApproveMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FastForward className="mr-2 h-4 w-4" />
              )}
              Advance {selectedIds.size} article{selectedIds.size !== 1 ? "s" : ""}
            </Button>
          )}
          {canCreate && (
            <Button onClick={() => setCreateOpen(true)} data-testid="button-new-article">
              <Plus className="mr-2 h-4 w-4" />
              New Article
            </Button>
          )}
        </div>
      </div>

      {/* Bulk author assignment bar */}
      {canManageAuthors && selectedIds.size > 0 && (
        <div
          className="flex flex-col gap-2 rounded-md border bg-muted/40 p-3 sm:flex-row sm:items-center sm:justify-between"
          data-testid="bar-bulk-author"
        >
          <span className="text-sm font-medium" data-testid="text-bulk-selected-count">
            {selectedIds.size} article{selectedIds.size !== 1 ? "s" : ""} selected
          </span>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select value={assignAuthorId} onValueChange={setAssignAuthorId}>
              <SelectTrigger className="w-[220px]" data-testid="select-bulk-author">
                <SelectValue placeholder="Choose an author…" />
              </SelectTrigger>
              <SelectContent>
                {activeAuthors.length === 0 ? (
                  <SelectItem value="__none__" disabled>
                    No active authors
                  </SelectItem>
                ) : (
                  activeAuthors.map((a) => (
                    <SelectItem key={a.id} value={a.id} data-testid={`option-bulk-author-${a.id}`}>
                      {a.displayName}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              onClick={() => bulkAssignMutation.mutate(assignAuthorId)}
              disabled={!assignAuthorId || bulkAssignMutation.isPending}
              data-testid="button-bulk-assign-author"
            >
              {bulkAssignMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="mr-2 h-4 w-4" />
              )}
              Assign author
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => bulkAssignMutation.mutate(null)}
              disabled={bulkAssignMutation.isPending}
              data-testid="button-bulk-clear-author"
            >
              <UserX className="mr-2 h-4 w-4" />
              Clear author
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <FileEdit className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No articles found.</p>
              {canCreate && (
                <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create your first article
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {showSelection && (
                    <TableHead className="w-8">
                      <Checkbox
                        checked={items.length > 0 && selectedIds.size === items.length}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all"
                        data-testid="checkbox-select-all"
                      />
                    </TableHead>
                  )}
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Author</TableHead>
                  <TableHead className="text-right">Read</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead>Updated</TableHead>
                  {isSuperAdmin && <TableHead className="w-10" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((a) => (
                  <TableRow
                    key={a.id}
                    className="cursor-pointer"
                    data-testid={`row-article-${a.id}`}
                  >
                    {showSelection && (
                      <TableCell onClick={(e) => { e.stopPropagation(); toggleSelect(a.id); }}>
                        <Checkbox
                          checked={selectedIds.has(a.id)}
                          onCheckedChange={() => toggleSelect(a.id)}
                          aria-label={`Select ${a.title}`}
                          data-testid={`checkbox-article-${a.id}`}
                        />
                      </TableCell>
                    )}
                    <TableCell className="font-medium" data-testid={`text-article-title-${a.id}`} onClick={() => setLocation(`/admin/studio/articles/${a.id}/edit`)}>
                      <span className="flex flex-col gap-0.5">
                        <span>{a.title}</span>
                        <span className="flex items-center gap-1 flex-wrap">
                          {(a as any).hookPattern && (
                            <Badge variant="outline" className="h-4 rounded px-1 py-0 text-[10px] font-normal text-muted-foreground" data-testid={`badge-hook-${a.id}`}>
                              {((a as any).hookPattern as string).replace(/_/g, " ")}
                            </Badge>
                          )}
                          <OutdatedModelBadge
                            articleId={a.id}
                            onRegenClick={() => setLocation(`/admin/studio/articles/${a.id}/edit`)}
                          />
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground" onClick={() => setLocation(`/admin/studio/articles/${a.id}/edit`)}>
                      {getStudioContentType(a.contentType)?.label ?? a.contentType}
                    </TableCell>
                    <TableCell onClick={() => setLocation(`/admin/studio/articles/${a.id}/edit`)}>
                      {(() => {
                        const isRejected = a.status === "draft" && !!(a as any).lastRejectionReason;
                        const displayKey = isRejected ? "needs_revision" : a.status;
                        return (
                          <Badge
                            variant="secondary"
                            className={STATUS_BADGE_CLASS[displayKey] ?? ""}
                            data-testid={`badge-status-${a.id}`}
                            title={isRejected ? ((a as any).lastRejectionReason as string) : undefined}
                          >
                            {STATUS_LABELS[displayKey] ?? a.status}
                          </Badge>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground" onClick={() => setLocation(`/admin/studio/articles/${a.id}/edit`)}>
                      {a.authorName ?? "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-muted-foreground" onClick={() => setLocation(`/admin/studio/articles/${a.id}/edit`)}>
                      <span className="inline-flex items-center gap-1">
                        <Clock3 className="h-3 w-3" />
                        {a.readTimeMinutes ?? "—"}m
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums text-muted-foreground" onClick={() => setLocation(`/admin/studio/articles/${a.id}/edit`)}>
                      {(a as any).totalCostUsd != null ? (
                        <span className="inline-flex items-center gap-0.5" data-testid={`text-cost-${a.id}`}>
                          <DollarSign className="h-3 w-3" />
                          {parseFloat(String((a as any).totalCostUsd)).toFixed(4)}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground" onClick={() => setLocation(`/admin/studio/articles/${a.id}/edit`)}>
                      {a.updatedAt ? new Date(a.updatedAt).toLocaleDateString() : "—"}
                    </TableCell>
                    {isSuperAdmin && (() => {
                      const canTakeDown = a.status === "published" || a.status === "scheduled";
                      const canArchive = a.status !== "archived";
                      if (!canTakeDown && !canArchive) return <TableCell />;
                      return (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                data-testid={`button-row-actions-${a.id}`}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Row actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {canTakeDown && (
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => setTakeDownTarget(a)}
                                  data-testid={`menu-item-take-down-${a.id}`}
                                >
                                  <EyeOff className="mr-2 h-4 w-4" />
                                  Take Down
                                </DropdownMenuItem>
                              )}
                              {canArchive && (
                                <DropdownMenuItem
                                  onClick={() => setArchiveTarget(a)}
                                  data-testid={`menu-item-archive-${a.id}`}
                                >
                                  <Archive className="mr-2 h-4 w-4" />
                                  Archive
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      );
                    })()}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground" data-testid="text-pagination-info">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              data-testid="button-prev-page"
            >
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              data-testid="button-next-page"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* New article dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Article</DialogTitle>
            <DialogDescription>
              Give it a working title and pick a content type. You can change both later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-article-title">Title</Label>
              <Input
                id="new-article-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. 5 ways to speed up IT hiring"
                data-testid="input-new-article-title"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="new-article-type">Content type</Label>
                <Select value={newType} onValueChange={setNewType}>
                  <SelectTrigger id="new-article-type" data-testid="select-new-article-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STUDIO_CONTENT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-article-audience">Audience</Label>
                <Select value={newAudience || "none"} onValueChange={(v) => setNewAudience(v === "none" ? "" : v)}>
                  <SelectTrigger id="new-article-audience" data-testid="select-new-article-audience">
                    <SelectValue placeholder="Not set" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not set</SelectItem>
                    <SelectItem value="AUTO_DETECT">Auto-detect from context</SelectItem>
                    <SelectItem value="EMPLOYER_CLIENT">Employer / Client</SelectItem>
                    <SelectItem value="MSP_STAFFING_PARTNER">MSP / Staffing Partner</SelectItem>
                    <SelectItem value="CANDIDATE_PROFESSIONAL">Candidate / Professional</SelectItem>
                    <SelectItem value="RECRUITER_OPERATOR">Recruiter / Operator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-article-goal">Content goal <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
              <Select value={newContentGoal || "none"} onValueChange={(v) => setNewContentGoal(v === "none" ? "" : v)}>
                <SelectTrigger id="new-article-goal" data-testid="select-new-article-goal">
                  <SelectValue placeholder="Auto-derive from type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Auto-derive from type</SelectItem>
                  <SelectItem value="THOUGHT_LEADERSHIP">Thought Leadership</SelectItem>
                  <SelectItem value="EDUCATIONAL">Educational</SelectItem>
                  <SelectItem value="JOB_MARKETING">Job Marketing</SelectItem>
                  <SelectItem value="BRAND_PERSPECTIVE">Brand Perspective</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="new-article-domain">Staffing domain <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
                <Select value={newDomain || "auto"} onValueChange={(v) => setNewDomain(v === "auto" ? "" : v)}>
                  <SelectTrigger id="new-article-domain" data-testid="select-new-article-domain">
                    <SelectValue placeholder="Auto-detect" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto-detect</SelectItem>
                    <SelectItem value="IT_STAFFING">IT Staffing</SelectItem>
                    <SelectItem value="HEALTHCARE_STAFFING">Healthcare Staffing</SelectItem>
                    <SelectItem value="GOVERNMENT">Government</SelectItem>
                    <SelectItem value="GENERAL_STAFFING">General Staffing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-article-planned-date">Planned publish date <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
                <input
                  id="new-article-planned-date"
                  type="date"
                  value={newPlannedDate}
                  onChange={(e) => setNewPlannedDate(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  data-testid="input-new-article-planned-date"
                />
                <p className="text-xs text-muted-foreground">Sets your target on the editorial calendar. You can change this any time.</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-article-brief">Brief / angle <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
              <Textarea
                id="new-article-brief"
                rows={2}
                value={newBrief}
                onChange={(e) => setNewBrief(e.target.value)}
                placeholder="Key points, angle, or facts the AI must include when generating…"
                className="text-sm"
                data-testid="input-new-article-brief"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!newTitle.trim() || createMutation.isPending}
              data-testid="button-create-article"
            >
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create & Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Take Down confirmation */}
      <AlertDialog open={!!takeDownTarget} onOpenChange={(open) => { if (!open) setTakeDownTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Take this content down?</AlertDialogTitle>
            <AlertDialogDescription>
              "{takeDownTarget?.title}" will be removed from the public site immediately.
              It reverts to an unpublished (approved) state, so its history is preserved
              and it can be republished later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-take-down">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (takeDownTarget) takeDownMutation.mutate(takeDownTarget.id);
              }}
              disabled={takeDownMutation.isPending}
              data-testid="button-confirm-take-down"
            >
              {takeDownMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Take down
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Archive confirmation */}
      <AlertDialog open={!!archiveTarget} onOpenChange={(open) => { if (!open) setArchiveTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this article?</AlertDialogTitle>
            <AlertDialogDescription>
              "{archiveTarget?.title}" will be moved to the archive. It will no longer
              appear in active workflows but its content is preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-archive">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (archiveTarget) archiveMutation.mutate(archiveTarget.id);
              }}
              disabled={archiveMutation.isPending}
              data-testid="button-confirm-archive"
            >
              {archiveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
