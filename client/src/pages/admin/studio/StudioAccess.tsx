import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { V2PageHeader } from "@/components/admin/V2PageHeader";
import { useNewLook } from "@/hooks/use-new-look";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Loader2,
  Plus,
  Trash2,
  ShieldCheck,
  Info,
  UserCog,
  Search,
} from "lucide-react";
import { format } from "date-fns";

interface StudioAccessUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  designation: string | null;
  studioAddOn: string | null;
  createdAt: string | null;
}

interface AllUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  designation: string | null;
}

const ADD_ON_META: Record<string, { label: string; color: string; emoji: string; capabilities: string[] }> = {
  marketing_manager: {
    label: "Marketing Manager",
    color: "bg-orange-100 text-orange-800 border-orange-200",
    emoji: "🟠",
    capabilities: [
      "View Studio & published content",
      "Submit an article draft",
      "Edit articles (own & anyone's)",
      "Generate AI drafts",
      "Upload & manage assets",
      "Reviewer inbox",
      "CM review queue",
      "Manage authors (add, edit, deactivate)",
      "Marketing approval / sign-off",
      "Content analytics (all)",
    ],
  },
  content_creator: {
    label: "Content Creator",
    color: "bg-blue-100 text-blue-800 border-blue-200",
    emoji: "🔵",
    capabilities: [
      "View Studio & published content",
      "Submit an article draft",
      "Edit articles (own only)",
      "Generate AI drafts",
      "Upload & manage assets",
      "Content analytics (own)",
    ],
  },
  influencer: {
    label: "Influencer / Contributor",
    color: "bg-green-100 text-green-800 border-green-200",
    emoji: "🟢",
    capabilities: [
      "View Studio & published content",
      "Submit an article draft",
    ],
  },
};

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  hr: "HR",
  finance: "Finance",
  operations: "Operations",
  manager: "Manager",
  recruiter: "Recruiter",
  employee: "Employee",
  architect: "Architect",
};

function AddOnBadge({ addOn }: { addOn: string | null }) {
  if (!addOn) return null;
  const meta = ADD_ON_META[addOn];
  if (!meta) return <Badge variant="outline">{addOn}</Badge>;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`cursor-help border ${meta.color} flex items-center gap-1`}
            data-testid={`badge-addon-${addOn}`}
          >
            <span>{meta.emoji}</span>
            <span>{meta.label}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs p-3">
          <p className="mb-2 font-semibold text-sm">{meta.emoji} {meta.label} — capabilities:</p>
          <ul className="space-y-1">
            {meta.capabilities.map((cap) => (
              <li key={cap} className="text-xs flex items-start gap-1.5">
                <span className="mt-0.5 text-emerald-500">✓</span>
                {cap}
              </li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function StudioAccessPanel() {
  const { enabled: newLook } = useNewLook();
  const { toast } = useToast();
  const { can } = usePermissions();
  const canManage = can("studio.manage_authors");

  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedAddOn, setSelectedAddOn] = useState<string>("");
  const [removeTarget, setRemoveTarget] = useState<StudioAccessUser | null>(null);
  const [editTarget, setEditTarget] = useState<StudioAccessUser | null>(null);
  const [editAddOn, setEditAddOn] = useState<string>("");

  const { data: accessUsers, isLoading } = useQuery<StudioAccessUser[]>({
    queryKey: ["/api/admin/studio/access"],
  });

  const { data: allUsersResponse } = useQuery<{ users: AllUser[] }>({
    queryKey: ["/api/admin/users", "active"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users?status=active", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
    enabled: addOpen,
  });

  const grantedIds = new Set(accessUsers?.map((u) => u.id) ?? []);

  const filteredCandidates = (allUsersResponse?.users ?? []).filter(
    (u) =>
      !grantedIds.has(u.id) &&
      (search === "" ||
        `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(search.toLowerCase())),
  );

  const grantMutation = useMutation({
    mutationFn: async ({ userId, addOn }: { userId: string; addOn: string }) => {
      const res = await apiRequest("POST", "/api/admin/studio/access", { userId, addOn });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to grant access");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/access"] });
      setAddOpen(false);
      setSearch("");
      setSelectedUserId("");
      setSelectedAddOn("");
      toast({ title: "Studio access granted" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to grant access", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ userId, addOn }: { userId: string; addOn: string }) => {
      const res = await apiRequest("POST", "/api/admin/studio/access", { userId, addOn });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to update access");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/access"] });
      queryClient.invalidateQueries({ queryKey: ["/api/me/permissions"] });
      setEditTarget(null);
      setEditAddOn("");
      toast({ title: "Studio access level updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update access", description: err.message, variant: "destructive" });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest("DELETE", `/api/admin/studio/access/${userId}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to revoke access");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/access"] });
      queryClient.invalidateQueries({ queryKey: ["/api/me/permissions"] });
      setRemoveTarget(null);
      toast({ title: "Studio access removed" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to remove access", description: err.message, variant: "destructive" });
    },
  });

  const openEdit = (user: StudioAccessUser) => {
    setEditTarget(user);
    setEditAddOn(user.studioAddOn ?? "");
  };

  return (
    <div className="space-y-6 v2-surface">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {newLook ? (
            <V2PageHeader
              icon={UserCog}
              eyebrow="Studio"
              title="Studio Access"
              subtitle="Control who can work in Content Studio without changing their base role."
              testId="text-studio-access-title"
            />
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <UserCog className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight" data-testid="text-studio-access-title">
                  Studio Access
                </h1>
                <p className="text-sm text-muted-foreground">
                  Control who can work in Content Studio without changing their base role.
                </p>
              </div>
            </div>
          )}
          {canManage && (
            <Button onClick={() => setAddOpen(true)} data-testid="button-add-author">
              <Plus className="mr-2 h-4 w-4" />
              Add Author
            </Button>
          )}
        </div>

        <Card>
          <CardContent className="px-0 py-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !accessUsers || accessUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <ShieldCheck className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No Studio authors added yet. Authors get Studio access<br />without changes to their HR role.
                </p>
                {canManage && (
                  <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add first author
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Base Role</TableHead>
                    <TableHead>Studio Level</TableHead>
                    <TableHead>Capabilities</TableHead>
                    {canManage && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accessUsers.map((user) => {
                    const meta = user.studioAddOn ? ADD_ON_META[user.studioAddOn] : null;
                    return (
                      <TableRow key={user.id} data-testid={`row-studio-access-${user.id}`}>
                        <TableCell>
                          <div className="font-medium">
                            {user.firstName} {user.lastName}
                          </div>
                          <div className="text-xs text-muted-foreground">{user.email}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {ROLE_LABELS[user.role] ?? user.role}
                          </Badge>
                          {user.designation && (
                            <div className="text-xs text-muted-foreground mt-0.5">{user.designation}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <AddOnBadge addOn={user.studioAddOn} />
                        </TableCell>
                        <TableCell>
                          {meta && (
                            <Popover>
                              <PopoverTrigger asChild>
                                <button
                                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                                  data-testid={`button-capabilities-${user.id}`}
                                >
                                  <Info className="h-3.5 w-3.5" />
                                  {meta.capabilities.length} capabilities
                                </button>
                              </PopoverTrigger>
                              <PopoverContent side="bottom" className="max-w-xs p-3 w-auto">
                                <ul className="space-y-1">
                                  {meta.capabilities.map((cap) => (
                                    <li key={cap} className="text-xs flex items-start gap-1.5">
                                      <span className="mt-0.5 text-emerald-500">✓</span>
                                      {cap}
                                    </li>
                                  ))}
                                </ul>
                              </PopoverContent>
                            </Popover>
                          )}
                        </TableCell>
                        {canManage && (
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEdit(user)}
                                data-testid={`button-edit-access-${user.id}`}
                              >
                                Change level
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setRemoveTarget(user)}
                                className="text-destructive hover:text-destructive"
                                data-testid={`button-remove-access-${user.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="border-dashed bg-muted/20">
          <CardContent className="py-4 px-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong>How Studio access works:</strong> Each level grants specific Content Studio permissions without changing
              the person&apos;s base HR role (leave, attendance, growth, approvals — all unaffected).{" "}
              <strong>Final Publish</strong> is always Super Admin only and is never granted by any add-on.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              {Object.entries(ADD_ON_META).map(([key, meta]) => (
                <div key={key} className="flex items-center gap-1.5 text-xs">
                  <Badge variant="outline" className={`border ${meta.color}`}>
                    {meta.emoji} {meta.label}
                  </Badge>
                  <span className="text-muted-foreground">{meta.capabilities.length} capabilities</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Studio Author</DialogTitle>
            <DialogDescription>
              Search for a user, pick their Studio access level, and save. Their HR role is unchanged.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Search by name or email…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setSelectedUserId("");
                  }}
                  data-testid="input-search-user"
                />
              </div>
              {search.length > 0 && filteredCandidates.length === 0 && (
                <p className="text-sm text-muted-foreground py-2 text-center">
                  No matching users (already added users are hidden).
                </p>
              )}
              {filteredCandidates.length > 0 && (
                <div className="max-h-44 overflow-y-auto rounded-md border divide-y">
                  {filteredCandidates.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => { setSelectedUserId(u.id); setSearch(`${u.firstName} ${u.lastName}`); }}
                      className={`w-full text-left px-3 py-2.5 text-sm hover:bg-muted/50 transition-colors ${
                        selectedUserId === u.id ? "bg-primary/5 font-medium" : ""
                      }`}
                      data-testid={`option-user-${u.id}`}
                    >
                      <span className="font-medium">{u.firstName} {u.lastName}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {ROLE_LABELS[u.role] ?? u.role}
                        {u.designation ? ` · ${u.designation}` : ""}
                      </span>
                      <br />
                      <span className="text-xs text-muted-foreground">{u.email}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Studio level</label>
              <Select value={selectedAddOn} onValueChange={setSelectedAddOn}>
                <SelectTrigger data-testid="select-addon-level">
                  <SelectValue placeholder="Choose access level…" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ADD_ON_META).map(([key, meta]) => (
                    <SelectItem key={key} value={key} data-testid={`option-addon-${key}`}>
                      <div className="flex items-center gap-2">
                        <span>{meta.emoji}</span>
                        <span>{meta.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedAddOn && (
                <div className="rounded-md border bg-muted/30 p-3">
                  <p className="text-xs font-medium mb-1.5">{ADD_ON_META[selectedAddOn]?.emoji} This level grants:</p>
                  <ul className="space-y-0.5">
                    {ADD_ON_META[selectedAddOn]?.capabilities.map((cap) => (
                      <li key={cap} className="text-xs flex items-start gap-1.5 text-muted-foreground">
                        <span className="mt-0.5 text-emerald-500">✓</span>
                        {cap}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddOpen(false); setSearch(""); setSelectedUserId(""); setSelectedAddOn(""); }}>
              Cancel
            </Button>
            <Button
              onClick={() => grantMutation.mutate({ userId: selectedUserId, addOn: selectedAddOn })}
              disabled={!selectedUserId || !selectedAddOn || grantMutation.isPending}
              data-testid="button-save-access"
            >
              {grantMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Grant access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTarget} onOpenChange={(o) => { if (!o) { setEditTarget(null); setEditAddOn(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Studio Level</DialogTitle>
            <DialogDescription>
              Update {editTarget?.firstName} {editTarget?.lastName}&apos;s Studio access level.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <Select value={editAddOn} onValueChange={setEditAddOn}>
              <SelectTrigger data-testid="select-edit-addon-level">
                <SelectValue placeholder="Choose access level…" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ADD_ON_META).map(([key, meta]) => (
                  <SelectItem key={key} value={key} data-testid={`option-edit-addon-${key}`}>
                    <div className="flex items-center gap-2">
                      <span>{meta.emoji}</span>
                      <span>{meta.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {editAddOn && (
              <div className="rounded-md border bg-muted/30 p-3">
                <p className="text-xs font-medium mb-1.5">{ADD_ON_META[editAddOn]?.emoji} This level grants:</p>
                <ul className="space-y-0.5">
                  {ADD_ON_META[editAddOn]?.capabilities.map((cap) => (
                    <li key={cap} className="text-xs flex items-start gap-1.5 text-muted-foreground">
                      <span className="mt-0.5 text-emerald-500">✓</span>
                      {cap}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditTarget(null); setEditAddOn(""); }}>
              Cancel
            </Button>
            <Button
              onClick={() => editTarget && updateMutation.mutate({ userId: editTarget.id, addOn: editAddOn })}
              disabled={!editAddOn || editAddOn === editTarget?.studioAddOn || updateMutation.isPending}
              data-testid="button-save-edit-access"
            >
              {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removeTarget} onOpenChange={(o) => { if (!o) setRemoveTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Studio access?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{removeTarget?.firstName} {removeTarget?.lastName}</strong> will immediately lose access
              to Content Studio. Their base HR role and all other access remain unchanged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removeTarget && revokeMutation.mutate(removeTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-remove-access"
            >
              {revokeMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Remove access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function StudioAccess() {
  return <AdminLayout><StudioAccessPanel /></AdminLayout>;
}
