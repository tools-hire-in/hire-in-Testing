import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { V2PageHeader } from "@/components/admin/V2PageHeader";
import { useNewLook } from "@/hooks/use-new-look";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  KeyRound, Plus, Edit2, Archive, Eye, EyeOff, Copy, ChevronRight, AlertTriangle,
  Shield, ShieldAlert, ShieldCheck, Lock, RefreshCw, Users, ExternalLink,
  MoreHorizontal, Trash2, Share2, Info, LogIn,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link } from "wouter";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import RevealSecretDialog from "./RevealSecretDialog";
import GrantAccessDialog from "./GrantAccessDialog";
import InlineSignInPanel from "./InlineSignInPanel";

const SENSITIVITY_META: Record<string, { label: string; color: string; icon: typeof Shield; scrutiny: string }> = {
  low: { label: "Low", color: "bg-green-100 text-green-800", icon: Shield, scrutiny: "Click to reveal — no reason required" },
  medium: { label: "Medium", color: "bg-yellow-100 text-yellow-800", icon: ShieldCheck, scrutiny: "Reason required to reveal" },
  high: { label: "High", color: "bg-orange-100 text-orange-800", icon: ShieldAlert, scrutiny: "Reason + TOTP required to reveal" },
  critical: { label: "Critical", color: "bg-red-100 text-red-800", icon: Lock, scrutiny: "Reason + TOTP, 30s auto-hide, indefinite logs" },
};

type Vault = { id: string; name: string; description?: string; category?: string; createdAt: string };
type Secret = {
  id: string; vaultId: string; systemName: string; loginUrl?: string;
  sensitivity: string; rotationDueAt?: string; rotationRequired: boolean;
  canCopy: boolean; canReveal: boolean; createdAt: string;
  username?: string; notes?: string;
};
type VaultShare = {
  id: string; vaultId: string; userId: string; role: string;
  grantedBy: string; grantedAt: string; revokedAt?: string;
};

function SensitivityBadge({ sensitivity }: { sensitivity: string }) {
  const meta = SENSITIVITY_META[sensitivity] ?? SENSITIVITY_META.medium;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${meta.color}`}>
      <meta.icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

function SecretFormDialog({
  open, onClose, vaultId, existing,
}: {
  open: boolean; onClose: () => void; vaultId: string; existing?: Secret | null;
}) {
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    systemName: existing?.systemName ?? "",
    loginUrl: existing?.loginUrl ?? "",
    username: existing?.username ?? "",
    password: "",
    notes: existing?.notes ?? "",
    sensitivity: existing?.sensitivity ?? "medium",
    rotationDueAt: existing?.rotationDueAt ? new Date(existing.rotationDueAt).toISOString().slice(0, 10) : "",
  });

  const saveMutation = useMutation({
    mutationFn: (data: typeof form) => {
      if (existing) {
        const patch: Record<string, unknown> = { ...data };
        if (!patch.password) delete patch.password;
        if (!patch.username) delete patch.username;
        if (!patch.notes) delete patch.notes;
        return apiRequest("PATCH", `/api/secrets/${existing.id}`, patch);
      }
      return apiRequest("POST", `/api/vaults/${vaultId}/secrets`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/vaults/${vaultId}/secrets`] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-vault-access"] });
      toast({ title: existing ? "Secret updated" : "Secret created" });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit Credential" : "Add Credential"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>System Name *</Label>
            <Input data-testid="input-system-name" value={form.systemName} onChange={e => setForm(f => ({ ...f, systemName: e.target.value }))} placeholder="e.g. Ceipal ATS" />
          </div>
          <div className="space-y-1">
            <Label>Login URL</Label>
            <Input data-testid="input-login-url" value={form.loginUrl} onChange={e => setForm(f => ({ ...f, loginUrl: e.target.value }))} placeholder="https://app.ceipal.com" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Username / Email</Label>
              <Input data-testid="input-username" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder={existing ? "Leave blank to keep existing" : ""} />
            </div>
            <div className="space-y-1">
              <Label>Password</Label>
              <div className="relative">
                <Input data-testid="input-password" type={showPassword ? "text" : "password"} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder={existing ? "Leave blank to keep existing" : ""} className="pr-9" />
                <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute inset-y-0 right-0 flex items-center px-2.5 text-muted-foreground hover:text-foreground" data-testid="button-toggle-password-visibility" aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Sensitivity Level</Label>
            <Select value={form.sensitivity} onValueChange={v => setForm(f => ({ ...f, sensitivity: v }))}>
              <SelectTrigger data-testid="select-sensitivity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low — Personal / own credentials (click-to-reveal, 3-month logs)</SelectItem>
                <SelectItem value="medium">Medium — Shared team tools (reason required, 6-month logs)</SelectItem>
                <SelectItem value="high">High — Enterprise SaaS (reason + TOTP, 12-month logs)</SelectItem>
                <SelectItem value="critical">Critical — Financial / HR systems (reason + TOTP + 30s auto-hide, indefinite logs)</SelectItem>
              </SelectContent>
            </Select>
            {form.sensitivity && (
              <p className="text-xs text-muted-foreground mt-1">{SENSITIVITY_META[form.sensitivity]?.scrutiny}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label>Notes (encrypted)</Label>
            <Textarea data-testid="input-notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder={existing ? "Leave blank to keep existing" : "Account notes, recovery info, etc."} />
          </div>
          <div className="space-y-1">
            <Label>Password Rotation Due</Label>
            <Input data-testid="input-rotation-due" type="date" value={form.rotationDueAt} onChange={e => setForm(f => ({ ...f, rotationDueAt: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button data-testid="button-save-secret" onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending || !form.systemName.trim()}>
            {saveMutation.isPending ? "Saving…" : (existing ? "Save Changes" : "Add Credential")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VaultFormDialog({ open, onClose, existing }: { open: boolean; onClose: () => void; existing?: Vault | null }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: existing?.name ?? "",
    description: existing?.description ?? "",
    category: existing?.category ?? "",
  });

  const saveMutation = useMutation({
    mutationFn: (data: typeof form) =>
      existing ? apiRequest("PATCH", `/api/vaults/${existing.id}`, data) : apiRequest("POST", "/api/vaults", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vaults"] });
      toast({ title: existing ? "Vault updated" : "Vault created" });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit Vault" : "Create Vault"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Vault Name *</Label>
            <Input data-testid="input-vault-name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. IT Staffing Systems" />
          </div>
          <div className="space-y-1">
            <Label>Category</Label>
            <Input data-testid="input-vault-category" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g. Healthcare, IT, HR" />
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea data-testid="input-vault-description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button data-testid="button-save-vault" onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending || !form.name.trim()}>
            {saveMutation.isPending ? "Saving…" : (existing ? "Save" : "Create Vault")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ShareVaultDialog({ vault, onClose }: { vault: Vault; onClose: () => void }) {
  const { toast } = useToast();
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState<"viewer" | "manager">("viewer");

  const { data: shares = [], isLoading: sharesLoading } = useQuery<VaultShare[]>({
    queryKey: [`/api/vaults/${vault.id}/shares`],
  });

  const { data: usersData } = useQuery<{ users: any[] }>({
    queryKey: ["/api/admin/users"],
  });
  const users = usersData?.users ?? [];

  const activeShares = shares.filter(s => !s.revokedAt);

  const addShareMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/vaults/${vault.id}/shares`, { userId: selectedUserId, role: selectedRole }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/vaults/${vault.id}/shares`] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-vault-access"] });
      toast({ title: "Vault shared" });
      setSelectedUserId("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const revokeShareMutation = useMutation({
    mutationFn: (shareId: string) => apiRequest("DELETE", `/api/vaults/${vault.id}/shares/${shareId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/vaults/${vault.id}/shares`] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-vault-access"] });
      toast({ title: "Access revoked" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const getUserName = (uid: string) => {
    const u = users.find((u: any) => u.id === uid);
    return u ? `${u.firstName} ${u.lastName} (${u.role})` : uid;
  };

  const sharedUserIds = new Set(activeShares.map(s => s.userId));
  const availableUsers = users.filter((u: any) => u.isActive && !u.deletedAt && !sharedUserIds.has(u.id));

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share Vault — {vault.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-3">
              Sharing a vault gives the recipient access to all its credentials. They'll appear in the recipient's "Shared With Me" list.
            </p>

            {sharesLoading ? (
              <div className="py-4 text-center text-sm text-muted-foreground">Loading shares…</div>
            ) : activeShares.length > 0 ? (
              <div className="mb-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Currently Shared With</p>
                <div className="space-y-2">
                  {activeShares.map(s => (
                    <div key={s.id} className="flex items-center justify-between bg-accent/40 rounded-md px-3 py-2" data-testid={`share-row-${s.id}`}>
                      <div>
                        <p className="text-sm font-medium">{getUserName(s.userId)}</p>
                        <p className="text-xs text-muted-foreground capitalize">{s.role}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                        data-testid={`button-revoke-share-${s.id}`}
                        onClick={() => { if (confirm("Revoke vault access for this person?")) revokeShareMutation.mutate(s.id); }}
                        disabled={revokeShareMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mb-4">This vault hasn't been shared with anyone yet.</p>
            )}

            <Separator className="my-3" />

            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Add Person</p>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger data-testid="select-share-user">
                      <SelectValue placeholder="Pick a team member…" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableUsers.map((u: any) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.firstName} {u.lastName} — {u.role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Select value={selectedRole} onValueChange={v => setSelectedRole(v as any)}>
                  <SelectTrigger className="w-32" data-testid="select-share-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">Viewer</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                data-testid="button-add-share"
                disabled={!selectedUserId || addShareMutation.isPending}
                onClick={() => addShareMutation.mutate()}
              >
                {addShareMutation.isPending ? "Sharing…" : "Share Vault"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SecretsTable({ vaultId, isAdmin }: { vaultId: string; isAdmin: boolean }) {
  const { toast } = useToast();
  const [secretFormOpen, setSecretFormOpen] = useState(false);
  const [editingSecret, setEditingSecret] = useState<Secret | null>(null);
  const [revealSecret, setRevealSecret] = useState<Secret | null>(null);
  const [grantSecret, setGrantSecret] = useState<Secret | null>(null);
  const [openSignInId, setOpenSignInId] = useState<string | null>(null);

  const { data: secrets = [], isLoading } = useQuery<Secret[]>({
    queryKey: [`/api/vaults/${vaultId}/secrets`],
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/secrets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/vaults/${vaultId}/secrets`] });
      toast({ title: "Credential archived" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const copyValue = async (secretId: string, type: "username" | "password") => {
    try {
      const res = await apiRequest("POST", `/api/secrets/${secretId}/copy-${type}`);
      const data = await res.json();
      await navigator.clipboard.writeText(data.value);
      toast({ title: `${type === "username" ? "Username" : "Password"} copied to clipboard` });
    } catch (e: any) {
      toast({ title: "Failed to copy", description: e.message, variant: "destructive" });
    }
  };

  if (isLoading) return <div className="py-8 text-center text-muted-foreground text-sm">Loading credentials…</div>;

  return (
    <div>
      {!secrets.length ? (
        <div className="py-12 text-center">
          <KeyRound className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground text-sm">No credentials yet.</p>
          {isAdmin && <Button size="sm" className="mt-3" onClick={() => { setEditingSecret(null); setSecretFormOpen(true); }} data-testid="button-add-secret-empty"><Plus className="h-4 w-4 mr-1" /> Add Credential</Button>}
        </div>
      ) : (
      <>
      {isAdmin && (
        <div className="flex justify-end mb-3">
          <Button size="sm" onClick={() => { setEditingSecret(null); setSecretFormOpen(true); }} data-testid="button-add-secret">
            <Plus className="h-4 w-4 mr-1" /> Add Credential
          </Button>
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>System</TableHead>
            <TableHead>Sensitivity</TableHead>
            <TableHead>Rotation Due</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {secrets.map(s => (
            <>
            <TableRow key={s.id} data-testid={`row-secret-${s.id}`}>
              <TableCell>
                <div className="font-medium">{s.systemName}</div>
                {s.loginUrl && (
                  <a href={s.loginUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-0.5">
                    <ExternalLink className="h-3 w-3" /> {s.loginUrl}
                  </a>
                )}
                {s.rotationRequired && (
                  <span className="inline-flex items-center gap-1 text-xs text-amber-600 mt-0.5">
                    <AlertTriangle className="h-3 w-3" /> Rotation required
                  </span>
                )}
              </TableCell>
              <TableCell><SensitivityBadge sensitivity={s.sensitivity} /></TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {s.rotationDueAt ? new Date(s.rotationDueAt).toLocaleDateString() : "—"}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {s.loginUrl && s.canReveal && (
                    <Button
                      size="sm"
                      variant={openSignInId === s.id ? "default" : "outline"}
                      className="h-7 px-2 text-xs"
                      onClick={() => {
                        if (openSignInId === s.id) { setOpenSignInId(null); }
                        else { window.open(s.loginUrl!, "_blank", "noopener"); setOpenSignInId(s.id); }
                      }}
                      data-testid={`button-open-signin-${s.id}`}
                    >
                      <LogIn className="h-3 w-3 mr-1" /> Open &amp; sign in
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => copyValue(s.id, "username")} data-testid={`button-copy-username-${s.id}`}>
                    <Copy className="h-3 w-3 mr-1" /> Username
                  </Button>
                  {s.canCopy && (
                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => copyValue(s.id, "password")} data-testid={`button-copy-password-${s.id}`}>
                      <Copy className="h-3 w-3 mr-1" /> Password
                    </Button>
                  )}
                  {s.canReveal && (
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setRevealSecret(s)} data-testid={`button-reveal-${s.id}`}>
                      <Eye className="h-3 w-3 mr-1" /> Reveal
                    </Button>
                  )}
                  {isAdmin && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" data-testid={`button-more-${s.id}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setEditingSecret(s); setSecretFormOpen(true); }}>
                          <Edit2 className="h-4 w-4 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setGrantSecret(s)}>
                          <Users className="h-4 w-4 mr-2" /> Manage Access
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600" onClick={() => { if (confirm("Archive this credential? It won't be deleted.")) archiveMutation.mutate(s.id); }}>
                          <Trash2 className="h-4 w-4 mr-2" /> Archive
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </TableCell>
            </TableRow>
            {openSignInId === s.id && s.loginUrl && (
              <TableRow key={`${s.id}-signin`}>
                <TableCell colSpan={4} className="pt-0 pb-3">
                  <InlineSignInPanel
                    secretId={s.id}
                    sensitivity={s.sensitivity}
                    onClose={() => setOpenSignInId(null)}
                  />
                </TableCell>
              </TableRow>
            )}
            </>
          ))}
        </TableBody>
      </Table>
      </>
      )}

      {secretFormOpen && (
        <SecretFormDialog
          key={editingSecret?.id ?? "new"}
          open={secretFormOpen}
          onClose={() => { setSecretFormOpen(false); setEditingSecret(null); }}
          vaultId={vaultId}
          existing={editingSecret}
        />
      )}
      {revealSecret && (
        <RevealSecretDialog secret={revealSecret} onClose={() => setRevealSecret(null)} />
      )}
      {grantSecret && (
        <GrantAccessDialog secret={grantSecret} onClose={() => setGrantSecret(null)} />
      )}
    </div>
  );
}

export default function VaultPage() {
  const { enabled: newLook } = useNewLook();
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === "super_admin" || user?.role === "admin";

  const [vaultFormOpen, setVaultFormOpen] = useState(false);
  const [editingVault, setEditingVault] = useState<Vault | null>(null);
  const [sharingVault, setSharingVault] = useState<Vault | null>(null);
  const [selectedVaultId, setSelectedVaultId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"vaults" | "my-access">("my-access");

  const { data: vaultList = [], isLoading: vaultsLoading } = useQuery<Vault[]>({
    queryKey: ["/api/vaults"],
    enabled: isAdmin,
  });

  const { data: myAccess = [], isLoading: myAccessLoading } = useQuery<any[]>({
    queryKey: ["/api/my-vault-access"],
  });

  const selectedVault = vaultList.find(v => v.id === selectedVaultId) ?? null;

  return (
    <AdminLayout>
      <div className="v2-surface p-6 max-w-6xl mx-auto space-y-6">
        {newLook ? (
          <V2PageHeader
            icon={KeyRound}
            eyebrow="Vault"
            title="Systems Vault"
            subtitle="Encrypted credential storage for company systems"
          />
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <KeyRound className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">Systems Vault</h1>
                <p className="text-sm text-muted-foreground">Encrypted credential storage for company systems</p>
              </div>
            </div>
          </div>
        )}

        <Alert className="border-blue-200 bg-blue-50/60 dark:bg-blue-950/20 dark:border-blue-800" data-testid="alert-vault-credential-rule">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="text-blue-800 dark:text-blue-200 text-sm">
            <strong>Company credential rule:</strong> All passwords, API keys, and access tokens must be stored and shared exclusively through this Vault — never via email, chat, or local files.{" "}
            <Link href="/admin/hr?tab=documents" className="underline underline-offset-2 font-medium hover:text-blue-600">
              View your signed Cybersecurity Policy
            </Link>
          </AlertDescription>
        </Alert>

        <Tabs value={activeTab} onValueChange={v => setActiveTab(v as any)}>
          <TabsList>
            <TabsTrigger value="my-access" data-testid="tab-my-access">My Access</TabsTrigger>
            {isAdmin && <TabsTrigger value="vaults" data-testid="tab-admin-vaults">Manage Vaults</TabsTrigger>}
          </TabsList>

          <TabsContent value="my-access" className="mt-4">
            {myAccessLoading ? (
              <div className="py-12 text-center text-muted-foreground text-sm">Loading your access…</div>
            ) : !myAccess.length ? (
              <div className="py-16 text-center">
                <Lock className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">You haven't been granted access to any credentials yet.</p>
                <p className="text-sm text-muted-foreground/70 mt-1">Contact your admin to request access.</p>
              </div>
            ) : (
              <MyAccessTable secrets={myAccess} />
            )}
          </TabsContent>

          {isAdmin && (
            <TabsContent value="vaults" className="mt-4">
              <div className="flex gap-6">
                <div className="w-64 shrink-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-muted-foreground">Vaults</span>
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => { setEditingVault(null); setVaultFormOpen(true); }} data-testid="button-new-vault">
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="space-y-1">
                    {vaultsLoading ? (
                      <div className="text-xs text-muted-foreground py-2 px-2">Loading…</div>
                    ) : !vaultList.length ? (
                      <div className="text-xs text-muted-foreground py-2 px-2">No vaults yet. Create one →</div>
                    ) : (
                      vaultList.map(v => (
                        <button
                          key={v.id}
                          data-testid={`button-vault-${v.id}`}
                          onClick={() => setSelectedVaultId(v.id)}
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors text-left ${selectedVaultId === v.id ? "bg-accent font-medium" : "hover:bg-accent/60 text-muted-foreground hover:text-foreground"}`}
                        >
                          <KeyRound className="h-3.5 w-3.5 shrink-0" />
                          <span className="flex-1 truncate">{v.name}</span>
                          {v.category && <Badge variant="outline" className="text-[10px] px-1 py-0">{v.category}</Badge>}
                          <ChevronRight className="h-3 w-3 opacity-50" />
                        </button>
                      ))
                    )}
                  </div>
                </div>

                <Separator orientation="vertical" className="h-auto" />

                <div className="flex-1">
                  {!selectedVault ? (
                    <div className="py-20 text-center text-muted-foreground text-sm">
                      <KeyRound className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                      Select a vault to view its credentials.
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h2 className="font-semibold">{selectedVault.name}</h2>
                          {selectedVault.description && <p className="text-xs text-muted-foreground">{selectedVault.description}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" onClick={() => setSharingVault(selectedVault)} data-testid="button-share-vault">
                            <Share2 className="h-4 w-4 mr-1" /> Share Vault
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { setEditingVault(selectedVault); setVaultFormOpen(true); }} data-testid="button-edit-vault">
                            <Edit2 className="h-4 w-4 mr-1" /> Edit Vault
                          </Button>
                        </div>
                      </div>
                      <SecretsTable vaultId={selectedVault.id} isAdmin={isAdmin} />
                    </div>
                  )}
                </div>
              </div>

              <VaultFormDialog
                key={editingVault?.id ?? "new-vault"}
                open={vaultFormOpen}
                onClose={() => { setVaultFormOpen(false); setEditingVault(null); }}
                existing={editingVault}
              />
              {sharingVault && (
                <ShareVaultDialog vault={sharingVault} onClose={() => setSharingVault(null)} />
              )}
            </TabsContent>
          )}
        </Tabs>
      </div>
    </AdminLayout>
  );
}

function MyAccessTable({ secrets }: { secrets: any[] }) {
  const { toast } = useToast();
  const [revealSecret, setRevealSecret] = useState<any | null>(null);
  const [openSignInId, setOpenSignInId] = useState<string | null>(null);

  const copyValue = async (secretId: string, type: "username" | "password") => {
    try {
      const res = await apiRequest("POST", `/api/secrets/${secretId}/copy-${type}`);
      const data = await res.json();
      await navigator.clipboard.writeText(data.value);
      toast({ title: `${type === "username" ? "Username" : "Password"} copied to clipboard` });
    } catch (e: any) {
      toast({ title: "Failed to copy", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>System</TableHead>
            <TableHead>Vault</TableHead>
            <TableHead>Sensitivity</TableHead>
            <TableHead>Rotation Due</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {secrets.map(s => (
            <>
            <TableRow key={s.id} data-testid={`row-access-${s.id}`}>
              <TableCell>
                <div className="font-medium">{s.systemName}</div>
                {s.loginUrl && (
                  <a href={s.loginUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-0.5">
                    <ExternalLink className="h-3 w-3" /> {s.loginUrl}
                  </a>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{s.vaultName}</TableCell>
              <TableCell><SensitivityBadge sensitivity={s.sensitivity} /></TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {s.rotationDueAt ? new Date(s.rotationDueAt).toLocaleDateString() : "—"}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {s.loginUrl && s.canReveal && (
                    <Button
                      size="sm"
                      variant={openSignInId === s.id ? "default" : "outline"}
                      className="h-7 px-2 text-xs"
                      onClick={() => {
                        if (openSignInId === s.id) { setOpenSignInId(null); }
                        else { window.open(s.loginUrl!, "_blank", "noopener"); setOpenSignInId(s.id); }
                      }}
                      data-testid={`button-access-open-signin-${s.id}`}
                    >
                      <LogIn className="h-3 w-3 mr-1" /> Open &amp; sign in
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => copyValue(s.id, "username")} data-testid={`button-access-copy-username-${s.id}`}>
                    <Copy className="h-3 w-3 mr-1" /> Username
                  </Button>
                  {s.canCopy && (
                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => copyValue(s.id, "password")} data-testid={`button-access-copy-password-${s.id}`}>
                      <Copy className="h-3 w-3 mr-1" /> Password
                    </Button>
                  )}
                  {s.canReveal && (
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setRevealSecret(s)} data-testid={`button-access-reveal-${s.id}`}>
                      <Eye className="h-3 w-3 mr-1" /> Reveal
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
            {openSignInId === s.id && s.loginUrl && (
              <TableRow key={`${s.id}-signin`}>
                <TableCell colSpan={5} className="pt-0 pb-3">
                  <InlineSignInPanel
                    secretId={s.id}
                    sensitivity={s.sensitivity}
                    onClose={() => setOpenSignInId(null)}
                  />
                </TableCell>
              </TableRow>
            )}
            </>
          ))}
        </TableBody>
      </Table>
      {revealSecret && <RevealSecretDialog secret={revealSecret} onClose={() => setRevealSecret(null)} />}
    </div>
  );
}
