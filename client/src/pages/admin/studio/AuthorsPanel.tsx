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
import { Loader2, Plus, UserCircle, Pencil, ShieldCheck } from "lucide-react";
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

export function AuthorsPanel({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const { can } = usePermissions();
  const canManage = can("studio.manage_authors");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StudioAuthorProfile | null>(null);
  const [form, setForm] = useState<AuthorForm>(EMPTY_FORM);

  const { data: authors, isLoading } = useQuery<StudioAuthorProfile[]>({
    queryKey: ["/api/admin/studio/authors", { projectId }],
    enabled: !!projectId,
  });

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
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
            <DialogTitle>{editing ? "Edit Author" : "New Author"}</DialogTitle>
            <DialogDescription>
              Author bylines can be linked to articles in this project.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!form.displayName.trim() || saveMutation.isPending}
              data-testid="button-save-author"
            >
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Save changes" : "Create author"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
