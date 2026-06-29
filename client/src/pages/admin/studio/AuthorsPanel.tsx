import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Plus,
  UserCircle,
  Pencil,
  ShieldCheck,
  Users,
  Camera,
  X,
  MoreHorizontal,
  Trash2,
  EyeOff,
  Eye,
  Building2,
  HandHeart,
  UserCheck,
  GitMerge,
  UserPlus,
} from "lucide-react";
import type { StudioAuthorProfile } from "@shared/schema";

type AuthorMode = "internal" | "external";
type ExternalType = "consulting" | "volunteer" | "guest";

interface AuthorForm {
  displayName: string;
  publicTitle: string;
  title: string;
  bio: string;
  linkedinUrl: string;
  photoUrl: string;
  consented: boolean;
  isActive: boolean;
}

const EMPTY_FORM: AuthorForm = {
  displayName: "",
  publicTitle: "",
  title: "",
  bio: "",
  linkedinUrl: "",
  photoUrl: "",
  consented: false,
  isActive: true,
};

interface EmployeeCandidate {
  id: string;
  displayName: string;
  title: string | null;
  photoUrl: string | null;
  email: string;
  linkedinUrl: string | null;
}

function authorModeFromType(authorType: string | null | undefined): AuthorMode {
  return authorType === "employee" ? "internal" : "external";
}

function externalTypeFromAuthorType(authorType: string | null | undefined): ExternalType {
  if (authorType === "consulting" || authorType === "volunteer" || authorType === "guest") {
    return authorType;
  }
  return "consulting";
}

export function AuthorsPanel({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const { can } = usePermissions();
  const canManage = can("studio.manage_authors");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StudioAuthorProfile | null>(null);
  const [form, setForm] = useState<AuthorForm>(EMPTY_FORM);
  const [authorMode, setAuthorMode] = useState<AuthorMode>("internal");
  const [externalType, setExternalType] = useState<ExternalType>("consulting");
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>("");
  const [showInactive, setShowInactive] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StudioAuthorProfile | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [mergeSource, setMergeSource] = useState<StudioAuthorProfile | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<string>("");
  const [employeePickerOpen, setEmployeePickerOpen] = useState(false);
  const [quickEmployeeId, setQuickEmployeeId] = useState<string>("");

  const { data: authors, isLoading } = useQuery<StudioAuthorProfile[]>({
    queryKey: ["/api/admin/studio/authors", { projectId }],
    enabled: !!projectId,
  });

  const { data: candidates, isLoading: candidatesLoading } = useQuery<EmployeeCandidate[]>({
    queryKey: ["/api/admin/studio/author-candidates"],
    enabled: open && !editing && authorMode === "internal" && canManage,
  });

  // Separate fetch for the one-click "Add from employee" picker (independent of
  // the create dialog state).
  const { data: quickCandidates, isLoading: quickCandidatesLoading } = useQuery<EmployeeCandidate[]>({
    queryKey: ["/api/admin/studio/author-candidates"],
    enabled: employeePickerOpen && canManage,
  });

  // Article counts per author — used to show "N articles will move" on merge.
  const { data: articleCounts } = useQuery<{ authorProfileId: string | null; count: number }[]>({
    queryKey: ["/api/admin/studio/authors/article-counts", { projectId }],
    enabled: !!projectId && canManage,
  });
  const countFor = (authorId: string): number =>
    articleCounts?.find((c) => c.authorProfileId === authorId)?.count ?? 0;

  // Pre-fill form fields when an employee candidate is selected.
  useEffect(() => {
    if (!selectedCandidateId || !candidates) return;
    const candidate = candidates.find((c) => c.id === selectedCandidateId);
    if (!candidate) return;
    setForm((f) => ({
      ...f,
      displayName: candidate.displayName,
      title: candidate.title ?? "",
      photoUrl: candidate.photoUrl ?? "",
      linkedinUrl: candidate.linkedinUrl ?? "",
    }));
  }, [selectedCandidateId, candidates]);

  const visibleAuthors = authors
    ? showInactive
      ? authors
      : authors.filter((a) => a.isActive)
    : [];

  const inactiveCount = authors ? authors.filter((a) => !a.isActive).length : 0;

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setAuthorMode("internal");
    setExternalType("consulting");
    setSelectedCandidateId("");
    setOpen(true);
  };

  const openEdit = (a: StudioAuthorProfile) => {
    setEditing(a);
    setForm({
      displayName: a.displayName ?? "",
      publicTitle: (a as any).publicTitle ?? "",
      title: a.title ?? "",
      bio: a.bio ?? "",
      linkedinUrl: a.linkedinUrl ?? "",
      photoUrl: a.photoUrl ?? "",
      consented: !!a.consentedAt,
      isActive: a.isActive,
    });
    setAuthorMode(authorModeFromType((a as any).authorType));
    setExternalType(externalTypeFromAuthorType((a as any).authorType));
    setSelectedCandidateId("");
    setOpen(true);
  };

  const linkedinRequired = authorMode === "internal";
  const linkedinMissing = linkedinRequired && !form.linkedinUrl.trim();

  const saveMutation = useMutation({
    mutationFn: async () => {
      const authorType = authorMode === "internal" ? "employee" : externalType;
      const linkedUserId = authorMode === "internal" && selectedCandidateId
        ? selectedCandidateId
        : editing
          ? (editing as any).linkedUserId ?? null
          : null;

      const payload: Record<string, unknown> = {
        displayName: form.displayName.trim(),
        publicTitle: form.publicTitle.trim() || null,
        title: form.title.trim() || null,
        bio: form.bio.trim() || null,
        linkedinUrl: form.linkedinUrl.trim() || null,
        photoUrl: form.photoUrl.trim() || null,
        isActive: form.isActive,
        consentedAt: form.consented ? (editing?.consentedAt ?? new Date().toISOString()) : null,
        authorType,
        linkedUserId,
      };
      if (!editing) payload.projectId = projectId;
      const res = await apiRequest(
        editing ? "PATCH" : "POST",
        editing
          ? `/api/admin/studio/authors/${editing.id}`
          : "/api/admin/studio/authors",
        payload,
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/authors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/author-candidates"] });
      setOpen(false);
      toast({ title: editing ? "Author updated" : "Author created" });
    },
    onError: (err: Error) => {
      toast({ title: "Could not save author", description: err.message, variant: "destructive" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admin/studio/authors/${id}`, { isActive });
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/authors"] });
      toast({ title: variables.isActive ? "Author reactivated" : "Author deactivated" });
    },
    onError: (err: Error) => {
      toast({ title: "Could not update author", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/studio/authors/${id}`);
      if (res.status === 409) {
        const body = await res.json();
        throw new Error(body.error ?? "Cannot delete author");
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to delete author");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/authors"] });
      setDeleteTarget(null);
      setDeleteError(null);
      toast({ title: "Author deleted" });
    },
    onError: (err: Error) => {
      setDeleteError(err.message);
    },
  });

  const mergeMutation = useMutation({
    mutationFn: async ({ sourceId, targetAuthorId }: { sourceId: string; targetAuthorId: string }) => {
      const res = await apiRequest("POST", `/api/admin/studio/authors/${sourceId}/merge`, {
        targetAuthorId,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to merge author");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/authors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/authors/article-counts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/articles"] });
      setMergeSource(null);
      setMergeTargetId("");
      toast({ title: `Merged — ${data.movedArticleCount} article(s) moved` });
    },
    onError: (err: Error) => {
      toast({ title: "Could not merge author", description: err.message, variant: "destructive" });
    },
  });

  const fromEmployeeMutation = useMutation({
    mutationFn: async (employeeId: string) => {
      const res = await apiRequest("POST", "/api/admin/studio/authors/from-employee", {
        employeeId,
        projectId,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to create author");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/authors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/author-candidates"] });
      setEmployeePickerOpen(false);
      setQuickEmployeeId("");
      toast({ title: "Author added from employee" });
    },
    onError: (err: Error) => {
      toast({ title: "Could not add author", description: err.message, variant: "destructive" });
    },
  });

  const saveDisabled =
    !form.displayName.trim() ||
    saveMutation.isPending ||
    linkedinMissing ||
    (!editing && authorMode === "internal" && !selectedCandidateId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Bylines available for articles in this project.
        </p>
        <div className="flex items-center gap-2">
          {canManage && inactiveCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowInactive((v) => !v)}
              data-testid="button-toggle-inactive"
            >
              {showInactive ? (
                <>
                  <EyeOff className="mr-1.5 h-3.5 w-3.5" />
                  Hide inactive
                </>
              ) : (
                <>
                  <Eye className="mr-1.5 h-3.5 w-3.5" />
                  Show inactive ({inactiveCount})
                </>
              )}
            </Button>
          )}
          {canManage && (
            <Button
              variant="outline"
              onClick={() => { setQuickEmployeeId(""); setEmployeePickerOpen(true); }}
              data-testid="button-add-from-employee"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Add from employee
            </Button>
          )}
          {canManage && (
            <Button onClick={openCreate} data-testid="button-new-author">
              <Plus className="mr-2 h-4 w-4" />
              New Author
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !authors || authors.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <UserCircle className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No author profiles yet.</p>
            {canManage && (
              <Button variant="outline" size="sm" onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Add an author
              </Button>
            )}
          </CardContent>
        </Card>
      ) : visibleAuthors.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <UserCircle className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No active authors.</p>
            {inactiveCount > 0 && (
              <Button variant="outline" size="sm" onClick={() => setShowInactive(true)} data-testid="button-show-inactive-empty">
                <Eye className="mr-2 h-4 w-4" />
                Show {inactiveCount} inactive
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleAuthors.map((a) => (
            <AuthorCard
              key={a.id}
              author={a}
              canManage={canManage}
              articleCount={countFor(a.id)}
              onEdit={() => openEdit(a)}
              onToggleActive={() => toggleActiveMutation.mutate({ id: a.id, isActive: !a.isActive })}
              onDelete={() => { setDeleteTarget(a); setDeleteError(null); }}
              onMerge={() => { setMergeSource(a); setMergeTargetId(""); }}
            />
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Author" : "Add Author"}</DialogTitle>
            <DialogDescription>
              Author bylines can be linked to articles in this project.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* Internal / External toggle */}
            {editing ? (
              <div className="rounded-md border px-3 py-2 bg-muted/40">
                <p className="text-xs text-muted-foreground mb-1">Author type</p>
                <p className="text-sm font-medium">
                  {authorMode === "internal" ? "Internal (Employee)" : `External — ${externalType.charAt(0).toUpperCase() + externalType.slice(1)}`}
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Author type</Label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthorMode("internal");
                      setSelectedCandidateId("");
                      setForm(EMPTY_FORM);
                    }}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors text-left ${
                      authorMode === "internal"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border hover:bg-muted/50"
                    }`}
                    data-testid="radio-mode-internal"
                  >
                    <div className="flex items-center gap-2">
                      <Users className="h-3.5 w-3.5" />
                      Internal (Employee)
                    </div>
                    <p className="text-xs font-normal text-muted-foreground mt-0.5">Link to an HR record</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthorMode("external");
                      setSelectedCandidateId("");
                      setForm(EMPTY_FORM);
                    }}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors text-left ${
                      authorMode === "external"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border hover:bg-muted/50"
                    }`}
                    data-testid="radio-mode-external"
                  >
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-3.5 w-3.5" />
                      External
                    </div>
                    <p className="text-xs font-normal text-muted-foreground mt-0.5">Guest, consultant, or volunteer</p>
                  </button>
                </div>
              </div>
            )}

            {/* Internal: employee picker */}
            {!editing && authorMode === "internal" && (
              <div className="space-y-2">
                <Label>Select employee</Label>
                {candidatesLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading employees…
                  </div>
                ) : !candidates || candidates.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    All active employees are already linked as authors.
                  </p>
                ) : (
                  <Select
                    value={selectedCandidateId}
                    onValueChange={setSelectedCandidateId}
                  >
                    <SelectTrigger data-testid="select-employee-candidate">
                      <SelectValue placeholder="Choose an employee…" />
                    </SelectTrigger>
                    <SelectContent>
                      {candidates.map((c) => (
                        <SelectItem key={c.id} value={c.id} data-testid={`option-candidate-${c.id}`}>
                          {c.displayName}
                          {c.title ? ` — ${c.title}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {selectedCandidateId && (
                  <p className="text-xs text-muted-foreground">
                    Fields below are pre-filled from the employee record — you can edit them before saving.
                  </p>
                )}
              </div>
            )}

            {/* External: author type picker */}
            {!editing && authorMode === "external" && (
              <div className="space-y-2">
                <Label>Author category</Label>
                <Select value={externalType} onValueChange={(v) => setExternalType(v as ExternalType)}>
                  <SelectTrigger data-testid="select-external-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="consulting" data-testid="option-type-consulting">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 text-blue-500" />
                        Consulting
                      </div>
                    </SelectItem>
                    <SelectItem value="volunteer" data-testid="option-type-volunteer">
                      <div className="flex items-center gap-2">
                        <HandHeart className="h-3.5 w-3.5 text-green-500" />
                        Volunteer
                      </div>
                    </SelectItem>
                    <SelectItem value="guest" data-testid="option-type-guest">
                      <div className="flex items-center gap-2">
                        <UserCheck className="h-3.5 w-3.5 text-purple-500" />
                        Guest
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Shared form fields */}
            <AuthorFormFields
              form={form}
              setForm={setForm}
              linkedinRequired={linkedinRequired}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveDisabled}
              data-testid="button-save-author"
            >
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Save changes" : "Create author"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) { setDeleteTarget(null); setDeleteError(null); }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete author profile?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteError ? (
                <span className="text-destructive">{deleteError}</span>
              ) : (
                <>
                  <strong>{deleteTarget?.displayName}</strong> will be permanently removed. This
                  cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-author">Cancel</AlertDialogCancel>
            {!deleteError && (
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={(e) => {
                  e.preventDefault();
                  if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
                }}
                disabled={deleteMutation.isPending}
                data-testid="button-confirm-delete-author"
              >
                {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Merge author dialog */}
      <Dialog
        open={!!mergeSource}
        onOpenChange={(o) => { if (!o) { setMergeSource(null); setMergeTargetId(""); } }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge author</DialogTitle>
            <DialogDescription>
              Move all articles from{" "}
              <strong>{mergeSource?.displayName}</strong> onto another author, then
              delete this author.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm" data-testid="text-merge-article-count">
              {mergeSource ? countFor(mergeSource.id) : 0} article
              {(mergeSource ? countFor(mergeSource.id) : 0) !== 1 ? "s" : ""} will move to the target author.
            </div>
            <div className="space-y-2">
              <Label>Merge into</Label>
              <Select value={mergeTargetId} onValueChange={setMergeTargetId}>
                <SelectTrigger data-testid="select-merge-target">
                  <SelectValue placeholder="Choose target author…" />
                </SelectTrigger>
                <SelectContent>
                  {(authors ?? [])
                    .filter((a) => a.id !== mergeSource?.id)
                    .map((a) => (
                      <SelectItem key={a.id} value={a.id} data-testid={`option-merge-target-${a.id}`}>
                        {a.displayName}
                        {!a.isActive ? " (inactive)" : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setMergeSource(null); setMergeTargetId(""); }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (mergeSource && mergeTargetId) {
                  mergeMutation.mutate({ sourceId: mergeSource.id, targetAuthorId: mergeTargetId });
                }
              }}
              disabled={!mergeTargetId || mergeMutation.isPending}
              data-testid="button-confirm-merge"
            >
              {mergeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Merge & delete source
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* One-click add-from-employee dialog */}
      <Dialog
        open={employeePickerOpen}
        onOpenChange={(o) => { setEmployeePickerOpen(o); if (!o) setQuickEmployeeId(""); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add author from employee</DialogTitle>
            <DialogDescription>
              Creates an author profile instantly from the employee's HR record.
              Missing byline fields (bio, public title, photo) are flagged on the
              card — you can fill them in later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <Label>Employee</Label>
            {quickCandidatesLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading employees…
              </div>
            ) : !quickCandidates || quickCandidates.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                All active employees are already linked as authors.
              </p>
            ) : (
              <Select value={quickEmployeeId} onValueChange={setQuickEmployeeId}>
                <SelectTrigger data-testid="select-quick-employee">
                  <SelectValue placeholder="Choose an employee…" />
                </SelectTrigger>
                <SelectContent>
                  {quickCandidates.map((c) => (
                    <SelectItem key={c.id} value={c.id} data-testid={`option-quick-employee-${c.id}`}>
                      {c.displayName}
                      {c.title ? ` — ${c.title}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmployeePickerOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => { if (quickEmployeeId) fromEmployeeMutation.mutate(quickEmployeeId); }}
              disabled={!quickEmployeeId || fromEmployeeMutation.isPending}
              data-testid="button-confirm-from-employee"
            >
              {fromEmployeeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add as author
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- Author Card ----

function AuthorTypeBadge({ authorType }: { authorType?: string | null }) {
  if (!authorType || authorType === "external") {
    return (
      <Badge variant="secondary" className="gap-1 text-[10px] px-1.5 py-0">
        External
      </Badge>
    );
  }
  if (authorType === "employee") {
    return (
      <Badge variant="outline" className="gap-1 text-[10px] px-1.5 py-0">
        <Users className="h-3 w-3" />
        Employee
      </Badge>
    );
  }
  if (authorType === "consulting") {
    return (
      <Badge className="gap-1 text-[10px] px-1.5 py-0 bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
        <Building2 className="h-3 w-3" />
        Consulting
      </Badge>
    );
  }
  if (authorType === "volunteer") {
    return (
      <Badge className="gap-1 text-[10px] px-1.5 py-0 bg-green-100 text-green-700 border-green-200 hover:bg-green-100 dark:bg-green-950 dark:text-green-300 dark:border-green-800">
        <HandHeart className="h-3 w-3" />
        Volunteer
      </Badge>
    );
  }
  if (authorType === "guest") {
    return (
      <Badge className="gap-1 text-[10px] px-1.5 py-0 bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-100 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800">
        <UserCheck className="h-3 w-3" />
        Guest
      </Badge>
    );
  }
  return null;
}

function AuthorCard({
  author: a,
  canManage,
  articleCount,
  onEdit,
  onToggleActive,
  onDelete,
  onMerge,
}: {
  author: StudioAuthorProfile;
  canManage: boolean;
  articleCount: number;
  onEdit: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
  onMerge: () => void;
}) {
  const fields = [
    { label: "Byline name", filled: !!a.displayName?.trim() },
    { label: "Public title", filled: !!(a as any).publicTitle?.trim() },
    { label: "Short bio", filled: !!a.bio?.trim() },
    { label: "Photo", filled: !!(a as any).photoUrl?.trim() },
  ];
  const filledCount = fields.filter((f) => f.filled).length;
  const total = fields.length;
  const isComplete = filledCount === total;
  const missing = fields.filter((f) => !f.filled).map((f) => f.label);

  return (
    <Card data-testid={`card-author-${a.id}`} className={!a.isActive ? "opacity-60" : ""}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <Avatar className="h-10 w-10">
            {a.photoUrl && <AvatarImage src={a.photoUrl} alt={a.displayName} />}
            <AvatarFallback>
              {a.displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 font-semibold">
              <span className="truncate">{a.displayName}</span>
              {!a.isActive && (
                <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 py-0" data-testid={`badge-inactive-${a.id}`}>
                  Inactive
                </Badge>
              )}
            </div>
            {a.title && (
              <div className="truncate text-xs text-muted-foreground">{a.title}</div>
            )}
          </div>
          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  data-testid={`button-actions-author-${a.id}`}
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit} data-testid={`menu-edit-author-${a.id}`}>
                  <Pencil className="mr-2 h-3.5 w-3.5" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onToggleActive} data-testid={`menu-toggle-active-author-${a.id}`}>
                  {a.isActive ? (
                    <>
                      <EyeOff className="mr-2 h-3.5 w-3.5" />
                      Deactivate
                    </>
                  ) : (
                    <>
                      <Eye className="mr-2 h-3.5 w-3.5" />
                      Reactivate
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onMerge} data-testid={`menu-merge-author-${a.id}`}>
                  <GitMerge className="mr-2 h-3.5 w-3.5" />
                  Merge into…
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={onDelete}
                  data-testid={`menu-delete-author-${a.id}`}
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {a.bio && <p className="line-clamp-3 text-sm text-muted-foreground">{a.bio}</p>}

        <div className="space-y-1.5" data-testid={`profile-completion-${a.id}`}>
          <div className="flex items-center justify-between text-xs">
            <span className={isComplete ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>
              {isComplete ? "Profile complete" : `${filledCount}/${total} fields filled`}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all ${isComplete ? "bg-emerald-500" : "bg-amber-400"}`}
              style={{ width: `${(filledCount / total) * 100}%` }}
            />
          </div>
          {!isComplete && canManage && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Missing: {missing.join(", ")} — complete profile before assigning articles.
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Badge variant={a.isActive ? "default" : "secondary"}>
            {a.isActive ? "Active" : "Inactive"}
          </Badge>
          <AuthorTypeBadge authorType={(a as any).authorType} />
          {articleCount > 0 && (
            <Badge variant="outline" data-testid={`badge-article-count-${a.id}`}>
              {articleCount} article{articleCount !== 1 ? "s" : ""}
            </Badge>
          )}
          {a.consentedAt && (
            <Badge variant="outline" className="gap-1">
              <ShieldCheck className="h-3 w-3" />
              Consented
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ---- Shared form fields ----

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PHOTO_SIZE = 5 * 1024 * 1024;

function AuthorFormFields({
  form,
  setForm,
  linkedinRequired,
}: {
  form: AuthorForm;
  setForm: React.Dispatch<React.SetStateAction<AuthorForm>>;
  linkedinRequired: boolean;
}) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const initials = form.displayName.trim()
    ? form.displayName.trim().slice(0, 2).toUpperCase()
    : "AU";

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast({ title: "Unsupported file type", description: "Please choose a JPG, PNG, or WebP image.", variant: "destructive" });
      return;
    }
    if (file.size > MAX_PHOTO_SIZE) {
      toast({ title: "File too large", description: "Photo must be 5 MB or smaller.", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const urlRes = await fetch("/api/uploads/request-url", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      if (!urlRes.ok) throw new Error("Could not get upload URL");
      const { uploadURL, objectPath } = await urlRes.json();

      const putRes = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!putRes.ok) throw new Error("Upload failed");

      setForm((f) => ({ ...f, photoUrl: objectPath }));
      toast({ title: "Photo uploaded" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="author-name">Display name</Label>
        <Input
          id="author-name"
          value={form.displayName}
          onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
          data-testid="input-author-name"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="author-public-title">
          Public title / role <span className="text-destructive">*</span>
        </Label>
        <Input
          id="author-public-title"
          value={form.publicTitle}
          onChange={(e) => setForm((f) => ({ ...f, publicTitle: e.target.value }))}
          placeholder="e.g. Senior Talent Partner · Healthcare Staffing"
          data-testid="input-author-public-title"
        />
        <p className="text-xs text-muted-foreground">Shown on public author cards. Required for profile completion.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="author-title">Internal title / role</Label>
        <Input
          id="author-title"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          placeholder="e.g. Talent Partner"
          data-testid="input-author-title"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="author-bio">Bio</Label>
        <Textarea
          id="author-bio"
          rows={3}
          value={form.bio}
          onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
          data-testid="input-author-bio"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="author-linkedin" className={linkedinRequired && !form.linkedinUrl.trim() ? "text-destructive" : ""}>
          LinkedIn URL{linkedinRequired ? <span className="text-destructive ml-0.5">*</span> : ""}
        </Label>
        <Input
          id="author-linkedin"
          value={form.linkedinUrl}
          onChange={(e) => setForm((f) => ({ ...f, linkedinUrl: e.target.value }))}
          placeholder="https://linkedin.com/in/…"
          className={linkedinRequired && !form.linkedinUrl.trim() ? "border-destructive focus-visible:ring-destructive" : ""}
          data-testid="input-author-linkedin"
        />
        {linkedinRequired && !form.linkedinUrl.trim() && (
          <p className="text-xs text-destructive">LinkedIn URL is required for internal authors.</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Headshot</Label>
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 shrink-0" data-testid="avatar-author-preview">
            {form.photoUrl && <AvatarImage src={form.photoUrl} alt="Author headshot" />}
            <AvatarFallback className="text-lg">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-1.5">
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_IMAGE_TYPES.join(",")}
              className="hidden"
              onChange={handleFileChange}
              data-testid="input-author-photo-file"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              data-testid="button-upload-photo"
            >
              {uploading ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Camera className="mr-2 h-3.5 w-3.5" />
              )}
              {uploading ? "Uploading…" : form.photoUrl ? "Change photo" : "Upload photo"}
            </Button>
            {form.photoUrl && !uploading && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive h-7 px-2 text-xs"
                onClick={() => setForm((f) => ({ ...f, photoUrl: "" }))}
                data-testid="button-remove-photo"
              >
                <X className="mr-1 h-3 w-3" />
                Remove photo
              </Button>
            )}
            <p className="text-xs text-muted-foreground">JPG, PNG or WebP · max 5 MB</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-md border p-3">
        <div>
          <Label htmlFor="author-consent">Consent to publish</Label>
          <p className="text-xs text-muted-foreground">
            Author has agreed to have their byline published.
          </p>
        </div>
        <Switch
          id="author-consent"
          checked={form.consented}
          onCheckedChange={(v) => setForm((f) => ({ ...f, consented: v }))}
          data-testid="switch-author-consent"
        />
      </div>
      <div className="flex items-center justify-between rounded-md border p-3">
        <Label htmlFor="author-active">Active</Label>
        <Switch
          id="author-active"
          checked={form.isActive}
          onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
          data-testid="switch-author-active"
        />
      </div>
    </div>
  );
}
