import { useState } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, UserCircle, Pencil, ShieldCheck, Users, Link } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { StudioAuthorProfile } from "@shared/schema";

interface AuthorForm {
  displayName: string;
  title: string;
  bio: string;
  linkedinUrl: string;
  photoUrl: string;
  consented: boolean;
  isActive: boolean;
}

const EMPTY_FORM: AuthorForm = {
  displayName: "",
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
}

export function AuthorsPanel({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const { can } = usePermissions();
  const canManage = can("studio.manage_authors");

  const [open, setOpen] = useState(false);
  const [dialogTab, setDialogTab] = useState<"new" | "link">("new");
  const [editing, setEditing] = useState<StudioAuthorProfile | null>(null);
  const [form, setForm] = useState<AuthorForm>(EMPTY_FORM);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>("");

  const { data: authors, isLoading } = useQuery<StudioAuthorProfile[]>({
    queryKey: ["/api/admin/studio/authors", { projectId }],
    enabled: !!projectId,
  });

  const { data: candidates, isLoading: candidatesLoading } = useQuery<EmployeeCandidate[]>({
    queryKey: ["/api/admin/studio/author-candidates"],
    enabled: open && dialogTab === "link" && canManage,
  });

  const selectedCandidate = candidates?.find((c) => c.id === selectedCandidateId) ?? null;

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setSelectedCandidateId("");
    setDialogTab("new");
    setOpen(true);
  };

  const openEdit = (a: StudioAuthorProfile) => {
    setEditing(a);
    setForm({
      displayName: a.displayName ?? "",
      title: a.title ?? "",
      bio: a.bio ?? "",
      linkedinUrl: a.linkedinUrl ?? "",
      photoUrl: a.photoUrl ?? "",
      consented: !!a.consentedAt,
      isActive: a.isActive,
    });
    setDialogTab("new");
    setOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        displayName: form.displayName.trim(),
        title: form.title.trim() || null,
        bio: form.bio.trim() || null,
        linkedinUrl: form.linkedinUrl.trim() || null,
        photoUrl: form.photoUrl.trim() || null,
        isActive: form.isActive,
        consentedAt: form.consented ? (editing?.consentedAt ?? new Date().toISOString()) : null,
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
      setOpen(false);
      toast({ title: editing ? "Author updated" : "Author created" });
    },
    onError: (err: Error) => {
      toast({ title: "Could not save author", description: err.message, variant: "destructive" });
    },
  });

  const linkEmployeeMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCandidate) throw new Error("No employee selected");
      const payload = {
        projectId,
        displayName: selectedCandidate.displayName,
        title: selectedCandidate.title || null,
        photoUrl: selectedCandidate.photoUrl || null,
        isActive: true,
        linkedEmployeeId: selectedCandidate.id,
        authorType: "employee",
        consentedAt: new Date().toISOString(),
      };
      const res = await apiRequest("POST", "/api/admin/studio/authors", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/authors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/author-candidates"] });
      setOpen(false);
      setSelectedCandidateId("");
      toast({ title: "Employee linked as author" });
    },
    onError: (err: Error) => {
      toast({ title: "Could not link employee", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Bylines available for articles in this project.
        </p>
        {canManage && (
          <Button onClick={openCreate} data-testid="button-new-author">
            <Plus className="mr-2 h-4 w-4" />
            New Author
          </Button>
        )}
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
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {authors.map((a) => (
            <Card key={a.id} data-testid={`card-author-${a.id}`}>
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
                    </div>
                    {a.title && (
                      <div className="truncate text-xs text-muted-foreground">{a.title}</div>
                    )}
                  </div>
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => openEdit(a)}
                      data-testid={`button-edit-author-${a.id}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                {a.bio && <p className="line-clamp-3 text-sm text-muted-foreground">{a.bio}</p>}
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant={a.isActive ? "default" : "secondary"}>
                    {a.isActive ? "Active" : "Inactive"}
                  </Badge>
                  {(a as any).authorType === "employee" && (
                    <Badge variant="outline" className="gap-1">
                      <Users className="h-3 w-3" />
                      Employee
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

          {!editing && canManage && (
            <Tabs value={dialogTab} onValueChange={(v) => { setDialogTab(v as "new" | "link"); setSelectedCandidateId(""); }}>
              <TabsList className="w-full">
                <TabsTrigger value="new" className="flex-1" data-testid="tab-new-author">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  New Author
                </TabsTrigger>
                <TabsTrigger value="link" className="flex-1" data-testid="tab-link-employee">
                  <Link className="mr-1.5 h-3.5 w-3.5" />
                  Link Employee
                </TabsTrigger>
              </TabsList>

              <TabsContent value="new" className="mt-4">
                <ExternalAuthorForm form={form} setForm={setForm} />
              </TabsContent>

              <TabsContent value="link" className="mt-4 space-y-4">
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
                </div>

                {selectedCandidate && (
                  <div className="rounded-md border p-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        {selectedCandidate.photoUrl && <AvatarImage src={selectedCandidate.photoUrl} />}
                        <AvatarFallback className="text-xs">
                          {selectedCandidate.displayName.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-semibold">{selectedCandidate.displayName}</p>
                        {selectedCandidate.title && (
                          <p className="text-xs text-muted-foreground">{selectedCandidate.title}</p>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      This employee will be created as an author profile linked to their HR record. Their name and title will pre-fill from the employee record.
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}

          {editing && (
            <div className="space-y-4 py-2">
              <ExternalAuthorForm form={form} setForm={setForm} />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            {(!editing && dialogTab === "link") ? (
              <Button
                onClick={() => linkEmployeeMutation.mutate()}
                disabled={!selectedCandidateId || linkEmployeeMutation.isPending}
                data-testid="button-link-employee"
              >
                {linkEmployeeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Link Employee
              </Button>
            ) : (
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={!form.displayName.trim() || saveMutation.isPending}
                data-testid="button-save-author"
              >
                {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editing ? "Save changes" : "Create author"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ExternalAuthorForm({
  form,
  setForm,
}: {
  form: AuthorForm;
  setForm: React.Dispatch<React.SetStateAction<AuthorForm>>;
}) {
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
        <Label htmlFor="author-title">Title / role</Label>
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
        <Label htmlFor="author-linkedin">LinkedIn URL</Label>
        <Input
          id="author-linkedin"
          value={form.linkedinUrl}
          onChange={(e) => setForm((f) => ({ ...f, linkedinUrl: e.target.value }))}
          placeholder="https://linkedin.com/in/…"
          data-testid="input-author-linkedin"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="author-photo">Photo URL</Label>
        <Input
          id="author-photo"
          value={form.photoUrl}
          onChange={(e) => setForm((f) => ({ ...f, photoUrl: e.target.value }))}
          placeholder="https://…"
          data-testid="input-author-photo"
        />
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
