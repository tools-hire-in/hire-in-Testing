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
  KeyRound, Plus, Edit2, Eye, EyeOff, Copy, AlertTriangle, Shield, ShieldCheck,
  Lock, ShieldAlert, ExternalLink, MoreHorizontal, Trash2, LogIn, Users, UserPlus,
  ChevronRight, Folder, ArrowLeft, Settings,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import RevealSecretDialog from "./RevealSecretDialog";
import InlineSignInPanel from "./InlineSignInPanel";

const SENSITIVITY_META: Record<string, { label: string; color: string; icon: typeof Shield; scrutiny: string }> = {
  low: { label: "Low", color: "bg-green-100 text-green-800", icon: Shield, scrutiny: "Click to reveal — no reason required" },
  medium: { label: "Medium", color: "bg-yellow-100 text-yellow-800", icon: ShieldCheck, scrutiny: "Reason required to reveal" },
  high: { label: "High", color: "bg-orange-100 text-orange-800", icon: ShieldAlert, scrutiny: "Reason + TOTP required" },
  critical: { label: "Critical", color: "bg-red-100 text-red-800", icon: Lock, scrutiny: "Reason + TOTP + 30s auto-hide" },
};

type Secret = {
  id: string; vaultId: string; systemName: string; loginUrl?: string;
  sensitivity: string; rotationDueAt?: string; rotationRequired: boolean;
  canCopy: boolean; canReveal: boolean; canEdit?: boolean; createdAt: string;
  username?: string; notes?: string;
};

type TeamVault = {
  id: string; name: string; description?: string; scope: string;
  ownerId?: string; ownerName?: string; isOwner: boolean; memberCount: number;
  createdAt: string;
};

type Member = {
  id: string; vaultId: string; userId: string; role: string; canEdit: boolean;
  grantedAt: string; revokedAt?: string;
  user?: { id: string; firstName: string; lastName: string; role: string } | null;
};

function SensitivityBadge({ sensitivity }: { sensitivity: string }) {
  const meta = SENSITIVITY_META[sensitivity] ?? SENSITIVITY_META.low;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${meta.color}`}>
      <meta.icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

// ── Personal vault secret form ─────────────────────────────────────────────

function PersonalSecretFormDialog({
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
    sensitivity: existing?.sensitivity ?? "low",
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
      queryClient.invalidateQueries({ queryKey: ["/api/my-personal-vault-secrets"] });
      toast({ title: existing ? "Credential updated" : "Credential added" });
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
            <Label>System / Website Name *</Label>
            <Input data-testid="input-personal-system-name" value={form.systemName} onChange={e => setForm(f => ({ ...f, systemName: e.target.value }))} placeholder="e.g. Gmail, LinkedIn" />
          </div>
          <div className="space-y-1">
            <Label>Login URL</Label>
            <Input data-testid="input-personal-login-url" value={form.loginUrl} onChange={e => setForm(f => ({ ...f, loginUrl: e.target.value }))} placeholder="https://…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Username / Email</Label>
              <Input data-testid="input-personal-username" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder={existing ? "Leave blank to keep" : ""} />
            </div>
            <div className="space-y-1">
              <Label>Password</Label>
              <div className="relative">
                <Input data-testid="input-personal-password" type={showPassword ? "text" : "password"} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder={existing ? "Leave blank to keep" : ""} className="pr-9" />
                <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute inset-y-0 right-0 flex items-center px-2.5 text-muted-foreground hover:text-foreground" data-testid="button-toggle-personal-password-visibility" aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Sensitivity</Label>
            <Select value={form.sensitivity} onValueChange={v => setForm(f => ({ ...f, sensitivity: v }))}>
              <SelectTrigger data-testid="select-personal-sensitivity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low — personal credentials (click-to-reveal)</SelectItem>
                <SelectItem value="medium">Medium — shared or important accounts (reason required)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea data-testid="input-personal-notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder={existing ? "Leave blank to keep" : "Account notes, recovery info…"} />
          </div>
          <div className="space-y-1">
            <Label>Password Rotation Due</Label>
            <Input data-testid="input-personal-rotation-due" type="date" value={form.rotationDueAt} onChange={e => setForm(f => ({ ...f, rotationDueAt: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button data-testid="button-save-personal-secret" onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending || !form.systemName.trim()}>
            {saveMutation.isPending ? "Saving…" : (existing ? "Save Changes" : "Add Credential")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PersonalSecretsTable({ vaultId }: { vaultId: string }) {
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editingSecret, setEditingSecret] = useState<Secret | null>(null);
  const [revealSecret, setRevealSecret] = useState<Secret | null>(null);
  const [openSignInId, setOpenSignInId] = useState<string | null>(null);

  const { data: secrets = [], isLoading } = useQuery<Secret[]>({
    queryKey: ["/api/my-personal-vault-secrets"],
    queryFn: async () => {
      const res = await fetch(`/api/vaults/${vaultId}/secrets`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    enabled: !!vaultId,
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/secrets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-personal-vault-secrets"] });
      toast({ title: "Credential removed" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const copyValue = async (secretId: string, type: "username" | "password") => {
    try {
      const res = await apiRequest("POST", `/api/secrets/${secretId}/copy-${type}`);
      const data = await res.json();
      await navigator.clipboard.writeText(data.value);
      toast({ title: `${type === "username" ? "Username" : "Password"} copied` });
    } catch (e: any) {
      toast({ title: "Failed to copy", description: e.message, variant: "destructive" });
    }
  };

  if (isLoading) return <div className="py-8 text-center text-muted-foreground text-sm">Loading credentials…</div>;

  return (
    <div>
      <div className="flex justify-end mb-3">
        <Button size="sm" onClick={() => { setEditingSecret(null); setFormOpen(true); }} data-testid="button-add-personal-secret">
          <Plus className="h-4 w-4 mr-1" /> Add Credential
        </Button>
      </div>
      {!secrets.length ? (
        <div className="py-12 text-center">
          <KeyRound className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground text-sm">No credentials yet. Add your first one above.</p>
        </div>
      ) : (
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
              <TableRow key={s.id} data-testid={`row-personal-secret-${s.id}`}>
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
                        data-testid={`button-personal-open-signin-${s.id}`}
                      >
                        <LogIn className="h-3 w-3 mr-1" /> Open &amp; sign in
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => copyValue(s.id, "username")} data-testid={`button-personal-copy-username-${s.id}`}>
                      <Copy className="h-3 w-3 mr-1" /> Username
                    </Button>
                    {s.canCopy && (
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => copyValue(s.id, "password")} data-testid={`button-personal-copy-password-${s.id}`}>
                        <Copy className="h-3 w-3 mr-1" /> Password
                      </Button>
                    )}
                    {s.canReveal && (
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setRevealSecret(s)} data-testid={`button-personal-reveal-${s.id}`}>
                        <Eye className="h-3 w-3 mr-1" /> Reveal
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" data-testid={`button-personal-more-${s.id}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setEditingSecret(s); setFormOpen(true); }}>
                          <Edit2 className="h-4 w-4 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600" onClick={() => { if (confirm("Remove this credential?")) archiveMutation.mutate(s.id); }}>
                          <Trash2 className="h-4 w-4 mr-2" /> Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
      )}

      {formOpen && (
        <PersonalSecretFormDialog
          key={editingSecret?.id ?? "new"}
          open={formOpen}
          onClose={() => { setFormOpen(false); setEditingSecret(null); }}
          vaultId={vaultId}
          existing={editingSecret}
        />
      )}
      {revealSecret && (
        <RevealSecretDialog secret={revealSecret} onClose={() => setRevealSecret(null)} />
      )}
    </div>
  );
}

function SharedWithMeTable({ secrets }: { secrets: any[] }) {
  const { toast } = useToast();
  const [revealSecret, setRevealSecret] = useState<any | null>(null);
  const [openSignInId, setOpenSignInId] = useState<string | null>(null);

  const copyValue = async (secretId: string, type: "username" | "password") => {
    try {
      const res = await apiRequest("POST", `/api/secrets/${secretId}/copy-${type}`);
      const data = await res.json();
      await navigator.clipboard.writeText(data.value);
      toast({ title: `${type === "username" ? "Username" : "Password"} copied` });
    } catch (e: any) {
      toast({ title: "Failed to copy", description: e.message, variant: "destructive" });
    }
  };

  if (!secrets.length) {
    return (
      <div className="py-16 text-center">
        <Lock className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
        <p className="text-muted-foreground">No credentials shared with you yet.</p>
        <p className="text-sm text-muted-foreground/70 mt-1">Contact your admin to request access.</p>
      </div>
    );
  }

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>System</TableHead>
            <TableHead>Vault</TableHead>
            <TableHead>Sensitivity</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {secrets.map(s => (
            <>
            <TableRow key={s.id} data-testid={`row-shared-${s.id}`}>
              <TableCell>
                <div className="font-medium">{s.systemName}</div>
                {s.loginUrl && (
                  <a href={s.loginUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-0.5">
                    <ExternalLink className="h-3 w-3" /> {s.loginUrl}
                  </a>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{s.vaultName}</TableCell>
              <TableCell>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${SENSITIVITY_META[s.sensitivity]?.color ?? "bg-gray-100 text-gray-800"}`}>
                  {SENSITIVITY_META[s.sensitivity]?.label ?? s.sensitivity}
                </span>
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
                      data-testid={`button-shared-open-signin-${s.id}`}
                    >
                      <LogIn className="h-3 w-3 mr-1" /> Open &amp; sign in
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => copyValue(s.id, "username")} data-testid={`button-shared-copy-username-${s.id}`}>
                    <Copy className="h-3 w-3 mr-1" /> Username
                  </Button>
                  {s.canCopy && (
                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => copyValue(s.id, "password")} data-testid={`button-shared-copy-password-${s.id}`}>
                      <Copy className="h-3 w-3 mr-1" /> Password
                    </Button>
                  )}
                  {s.canReveal && (
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setRevealSecret(s)} data-testid={`button-shared-reveal-${s.id}`}>
                      <Eye className="h-3 w-3 mr-1" /> Reveal
                    </Button>
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
      {revealSecret && <RevealSecretDialog secret={revealSecret} onClose={() => setRevealSecret(null)} />}
    </div>
  );
}

// ── Team vault secret form (supports low/medium/high/critical) ─────────────

function TeamSecretFormDialog({
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
      queryClient.invalidateQueries({ queryKey: [`/api/team-vault-secrets-${vaultId}`] });
      toast({ title: existing ? "Credential updated" : "Credential added" });
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
            <Input data-testid="input-team-system-name" value={form.systemName} onChange={e => setForm(f => ({ ...f, systemName: e.target.value }))} placeholder="e.g. Zoom, Slack, Instagram" />
          </div>
          <div className="space-y-1">
            <Label>Login URL</Label>
            <Input data-testid="input-team-login-url" value={form.loginUrl} onChange={e => setForm(f => ({ ...f, loginUrl: e.target.value }))} placeholder="https://…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Username / Email</Label>
              <Input data-testid="input-team-username" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder={existing ? "Leave blank to keep" : ""} />
            </div>
            <div className="space-y-1">
              <Label>Password</Label>
              <div className="relative">
                <Input data-testid="input-team-password" type={showPassword ? "text" : "password"} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder={existing ? "Leave blank to keep" : ""} className="pr-9" />
                <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute inset-y-0 right-0 flex items-center px-2.5 text-muted-foreground hover:text-foreground" data-testid="button-toggle-team-password-visibility" aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Sensitivity</Label>
            <Select value={form.sensitivity} onValueChange={v => setForm(f => ({ ...f, sensitivity: v }))}>
              <SelectTrigger data-testid="select-team-sensitivity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low — basic shared logins (click-to-reveal)</SelectItem>
                <SelectItem value="medium">Medium — shared team tools (reason required)</SelectItem>
                <SelectItem value="high">High — important accounts (reason + TOTP)</SelectItem>
                <SelectItem value="critical">Critical — critical systems (reason + TOTP + 30s)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Notes (encrypted)</Label>
            <Textarea data-testid="input-team-notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder={existing ? "Leave blank to keep" : "Recovery info, account notes…"} />
          </div>
          <div className="space-y-1">
            <Label>Password Rotation Due</Label>
            <Input data-testid="input-team-rotation-due" type="date" value={form.rotationDueAt} onChange={e => setForm(f => ({ ...f, rotationDueAt: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button data-testid="button-save-team-secret" onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending || !form.systemName.trim()}>
            {saveMutation.isPending ? "Saving…" : (existing ? "Save Changes" : "Add Credential")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Create Team Vault dialog ───────────────────────────────────────────────

function CreateTeamVaultDialog({ open, onClose, existing }: {
  open: boolean; onClose: () => void; existing?: TeamVault | null;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({ name: existing?.name ?? "", description: existing?.description ?? "" });

  const saveMutation = useMutation({
    mutationFn: (data: typeof form) =>
      existing
        ? apiRequest("PATCH", `/api/team-vaults/${existing.id}`, data)
        : apiRequest("POST", "/api/team-vaults", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team-vaults"] });
      toast({ title: existing ? "Vault updated" : "Team vault created" });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit Team Vault" : "Create Team Vault"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Vault Name *</Label>
            <Input data-testid="input-team-vault-name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Recruitment Tools, Social Media" />
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea data-testid="input-team-vault-description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="What this vault is for…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button data-testid="button-save-team-vault" onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending || !form.name.trim()}>
            {saveMutation.isPending ? "Saving…" : (existing ? "Save" : "Create Vault")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Invite member dialog ───────────────────────────────────────────────────

function InviteMemberDialog({ vaultId, onClose }: { vaultId: string; onClose: () => void }) {
  const { toast } = useToast();
  const [selectedUserId, setSelectedUserId] = useState("");
  const [canEdit, setCanEdit] = useState(false);

  const { data: usersData } = useQuery<{ users: any[] }>({ queryKey: ["/api/admin/users"] });
  const users = usersData?.users ?? [];

  const { data: members = [] } = useQuery<Member[]>({
    queryKey: [`/api/team-vaults/${vaultId}/members`],
  });

  const existingUserIds = new Set(members.filter(m => !m.revokedAt).map(m => m.userId));
  const availableUsers = users.filter((u: any) => u.isActive && !u.deletedAt && !existingUserIds.has(u.id));

  const inviteMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/team-vaults/${vaultId}/members`, { userId: selectedUserId, canEdit }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/team-vaults/${vaultId}/members`] });
      queryClient.invalidateQueries({ queryKey: ["/api/team-vaults"] });
      toast({ title: "Member invited" });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" /> Invite Member
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Team Member</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger data-testid="select-invite-user">
                <SelectValue placeholder="Pick a person…" />
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
          <div className="space-y-1">
            <Label>Role</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCanEdit(false)}
                data-testid="button-role-viewer"
                className={`flex-1 border rounded-md px-3 py-2 text-sm text-left transition-colors ${!canEdit ? "border-primary bg-primary/5 text-primary font-medium" : "border-border hover:border-muted-foreground"}`}
              >
                <p className="font-medium">Viewer</p>
                <p className="text-xs text-muted-foreground mt-0.5">Can reveal and copy credentials</p>
              </button>
              <button
                type="button"
                onClick={() => setCanEdit(true)}
                data-testid="button-role-editor"
                className={`flex-1 border rounded-md px-3 py-2 text-sm text-left transition-colors ${canEdit ? "border-primary bg-primary/5 text-primary font-medium" : "border-border hover:border-muted-foreground"}`}
              >
                <p className="font-medium">Editor</p>
                <p className="text-xs text-muted-foreground mt-0.5">Can add and edit credentials</p>
              </button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button data-testid="button-confirm-invite" onClick={() => inviteMutation.mutate()} disabled={!selectedUserId || inviteMutation.isPending}>
            {inviteMutation.isPending ? "Inviting…" : "Invite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Transfer ownership dialog ─────────────────────────────────────────────

function TransferOwnershipDialog({ vault, onClose }: { vault: TeamVault; onClose: () => void }) {
  const { toast } = useToast();
  const [newOwnerId, setNewOwnerId] = useState("");

  const { data: usersData } = useQuery<{ users: any[] }>({ queryKey: ["/api/admin/users"] });
  const users = (usersData?.users ?? []).filter((u: any) => u.isActive && !u.deletedAt && u.id !== vault.ownerId);

  const transferMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/team-vaults/${vault.id}/transfer`, { newOwnerId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team-vaults"] });
      toast({ title: "Ownership transferred" });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Transfer Ownership</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Transfer ownership of <strong>{vault.name}</strong> to another person. You will become a regular member.</p>
        <div className="space-y-1 py-2">
          <Label>New Owner</Label>
          <Select value={newOwnerId} onValueChange={setNewOwnerId}>
            <SelectTrigger data-testid="select-new-owner">
              <SelectValue placeholder="Pick a person…" />
            </SelectTrigger>
            <SelectContent>
              {users.map((u: any) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.firstName} {u.lastName} — {u.role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button data-testid="button-confirm-transfer" variant="destructive" onClick={() => transferMutation.mutate()} disabled={!newOwnerId || transferMutation.isPending}>
            {transferMutation.isPending ? "Transferring…" : "Transfer Ownership"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Team vault detail view ─────────────────────────────────────────────────

function TeamVaultDetail({ vault, onBack }: { vault: TeamVault; onBack: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"credentials" | "members">("credentials");
  const [secretFormOpen, setSecretFormOpen] = useState(false);
  const [editingSecret, setEditingSecret] = useState<Secret | null>(null);
  const [revealSecret, setRevealSecret] = useState<Secret | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const canManage = vault.isOwner;

  const { data: secrets = [], isLoading: secretsLoading } = useQuery<Secret[]>({
    queryKey: [`/api/team-vault-secrets-${vault.id}`],
    queryFn: async () => {
      const res = await fetch(`/api/vaults/${vault.id}/secrets`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  const { data: members = [], isLoading: membersLoading } = useQuery<Member[]>({
    queryKey: [`/api/team-vaults/${vault.id}/members`],
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/secrets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/team-vault-secrets-${vault.id}`] });
      toast({ title: "Credential archived" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const removeMemberMutation = useMutation({
    mutationFn: (shareId: string) => apiRequest("DELETE", `/api/team-vaults/${vault.id}/members/${shareId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/team-vaults/${vault.id}/members`] });
      queryClient.invalidateQueries({ queryKey: ["/api/team-vaults"] });
      toast({ title: "Member removed" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMemberMutation = useMutation({
    mutationFn: ({ shareId, canEdit }: { shareId: string; canEdit: boolean }) =>
      apiRequest("PATCH", `/api/team-vaults/${vault.id}/members/${shareId}`, { canEdit }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/team-vaults/${vault.id}/members`] });
      toast({ title: "Role updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const copyValue = async (secretId: string, type: "username" | "password") => {
    try {
      const res = await apiRequest("POST", `/api/secrets/${secretId}/copy-${type}`);
      const data = await res.json();
      await navigator.clipboard.writeText(data.value);
      toast({ title: `${type === "username" ? "Username" : "Password"} copied` });
    } catch (e: any) {
      toast({ title: "Failed to copy", description: e.message, variant: "destructive" });
    }
  };

  const activeMembers = members.filter(m => !m.revokedAt);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Button variant="ghost" size="sm" className="h-8 px-2" onClick={onBack} data-testid="button-back-to-team-vaults">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">{vault.name}</h2>
            {vault.isOwner && <Badge variant="secondary" className="text-xs">Owner</Badge>}
          </div>
          {vault.description && <p className="text-xs text-muted-foreground">{vault.description}</p>}
        </div>
        {canManage && (
          <Button size="sm" variant="outline" onClick={() => setInviteOpen(true)} data-testid="button-invite-member">
            <UserPlus className="h-4 w-4 mr-1" /> Invite
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as any)}>
        <TabsList>
          <TabsTrigger value="credentials" data-testid="tab-team-credentials">
            Credentials {secrets.length > 0 && <Badge variant="secondary" className="ml-1 text-xs">{secrets.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="members" data-testid="tab-team-members">
            Members {activeMembers.length > 0 && <Badge variant="secondary" className="ml-1 text-xs">{activeMembers.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="credentials" className="mt-4">
          {(canManage || secrets.some(s => s.canEdit)) && (
            <div className="flex justify-end mb-3">
              <Button size="sm" onClick={() => { setEditingSecret(null); setSecretFormOpen(true); }} data-testid="button-add-team-secret">
                <Plus className="h-4 w-4 mr-1" /> Add Credential
              </Button>
            </div>
          )}
          {secretsLoading ? (
            <div className="py-8 text-center text-muted-foreground text-sm">Loading…</div>
          ) : !secrets.length ? (
            <div className="py-12 text-center">
              <KeyRound className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground text-sm">No credentials yet.</p>
            </div>
          ) : (
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
                  <TableRow key={s.id} data-testid={`row-team-secret-${s.id}`}>
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
                      <div className="flex items-center gap-1.5">
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => copyValue(s.id, "username")} data-testid={`button-team-copy-username-${s.id}`}>
                          <Copy className="h-3 w-3 mr-1" /> Username
                        </Button>
                        {s.canCopy && (
                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => copyValue(s.id, "password")} data-testid={`button-team-copy-password-${s.id}`}>
                            <Copy className="h-3 w-3 mr-1" /> Password
                          </Button>
                        )}
                        {s.canReveal && (
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setRevealSecret(s)} data-testid={`button-team-reveal-${s.id}`}>
                            <Eye className="h-3 w-3 mr-1" /> Reveal
                          </Button>
                        )}
                        {(canManage || s.canEdit) && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" data-testid={`button-team-more-${s.id}`}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { setEditingSecret(s); setSecretFormOpen(true); }}>
                                <Edit2 className="h-4 w-4 mr-2" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-red-600" onClick={() => { if (confirm("Archive this credential?")) archiveMutation.mutate(s.id); }}>
                                <Trash2 className="h-4 w-4 mr-2" /> Archive
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="members" className="mt-4">
          {membersLoading ? (
            <div className="py-8 text-center text-muted-foreground text-sm">Loading members…</div>
          ) : !activeMembers.length ? (
            <div className="py-12 text-center">
              <Users className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground text-sm">No members yet. Invite teammates to collaborate.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Added</TableHead>
                  {canManage && <TableHead></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeMembers.map(m => (
                  <TableRow key={m.id} data-testid={`row-member-${m.id}`}>
                    <TableCell>
                      <div className="font-medium">{m.user ? `${m.user.firstName} ${m.user.lastName}` : m.userId}</div>
                      {m.user && <div className="text-xs text-muted-foreground capitalize">{m.user.role}</div>}
                    </TableCell>
                    <TableCell>
                      {canManage ? (
                        <Select
                          value={m.canEdit ? "editor" : "viewer"}
                          onValueChange={v => updateMemberMutation.mutate({ shareId: m.id, canEdit: v === "editor" })}
                        >
                          <SelectTrigger className="h-7 w-28 text-xs" data-testid={`select-member-role-${m.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="viewer">Viewer</SelectItem>
                            <SelectItem value="editor">Editor</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline" className="text-xs">{m.canEdit ? "Editor" : "Viewer"}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(m.grantedAt).toLocaleDateString()}
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                          data-testid={`button-remove-member-${m.id}`}
                          onClick={() => { if (confirm(`Remove ${m.user ? `${m.user.firstName} ${m.user.lastName}` : "this member"} from the vault?`)) removeMemberMutation.mutate(m.id); }}
                          disabled={removeMemberMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>

      {secretFormOpen && (
        <TeamSecretFormDialog
          key={editingSecret?.id ?? "new"}
          open={secretFormOpen}
          onClose={() => { setSecretFormOpen(false); setEditingSecret(null); }}
          vaultId={vault.id}
          existing={editingSecret}
        />
      )}
      {revealSecret && <RevealSecretDialog secret={revealSecret} onClose={() => setRevealSecret(null)} />}
      {inviteOpen && <InviteMemberDialog vaultId={vault.id} onClose={() => setInviteOpen(false)} />}
    </div>
  );
}

// ── Team vaults list + detail ──────────────────────────────────────────────

function TeamVaultsSection() {
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingVault, setEditingVault] = useState<TeamVault | null>(null);
  const [selectedVault, setSelectedVault] = useState<TeamVault | null>(null);
  const [transferVault, setTransferVault] = useState<TeamVault | null>(null);

  const { data: teamVaults = [], isLoading } = useQuery<TeamVault[]>({
    queryKey: ["/api/team-vaults"],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/team-vaults/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team-vaults"] });
      setSelectedVault(null);
      toast({ title: "Vault deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (selectedVault) {
    const freshVault = teamVaults.find(v => v.id === selectedVault.id) ?? selectedVault;
    return (
      <div>
        <TeamVaultDetail vault={freshVault} onBack={() => setSelectedVault(null)} />
        {editingVault && (
          <CreateTeamVaultDialog
            open
            onClose={() => setEditingVault(null)}
            existing={editingVault}
          />
        )}
        {transferVault && (
          <TransferOwnershipDialog vault={transferVault} onClose={() => setTransferVault(null)} />
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">Shared credential vaults you own or belong to</p>
        <Button size="sm" onClick={() => setCreateOpen(true)} data-testid="button-create-team-vault">
          <Plus className="h-4 w-4 mr-1" /> New Team Vault
        </Button>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-muted-foreground text-sm">Loading team vaults…</div>
      ) : !teamVaults.length ? (
        <div className="py-16 text-center">
          <Folder className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">No team vaults yet.</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Create one to share credentials with your team.</p>
          <Button size="sm" className="mt-4" onClick={() => setCreateOpen(true)} data-testid="button-create-team-vault-empty">
            <Plus className="h-4 w-4 mr-1" /> Create Team Vault
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {teamVaults.map(v => (
            <div
              key={v.id}
              className="border rounded-lg p-4 hover:bg-accent/40 transition-colors cursor-pointer"
              data-testid={`card-team-vault-${v.id}`}
              onClick={() => setSelectedVault(v)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Folder className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{v.name}</span>
                      {v.isOwner && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Owner</Badge>}
                    </div>
                    {v.description && <p className="text-xs text-muted-foreground mt-0.5">{v.description}</p>}
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="h-3 w-3" /> {v.memberCount} member{v.memberCount !== 1 ? "s" : ""}
                      </span>
                      {v.ownerName && !v.isOwner && (
                        <span className="text-xs text-muted-foreground">by {v.ownerName}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                  {v.isOwner && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" data-testid={`button-team-vault-menu-${v.id}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingVault(v)}>
                          <Edit2 className="h-4 w-4 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setTransferVault(v)}>
                          <Settings className="h-4 w-4 mr-2" /> Transfer Ownership
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => { if (confirm(`Delete "${v.name}"? This vault and all its credentials will be archived.`)) deleteMutation.mutate(v.id); }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" /> Delete Vault
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateTeamVaultDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      {editingVault && (
        <CreateTeamVaultDialog open onClose={() => setEditingVault(null)} existing={editingVault} />
      )}
      {transferVault && (
        <TransferOwnershipDialog vault={transferVault} onClose={() => setTransferVault(null)} />
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function MyVaultPage() {
  const { enabled: newLook } = useNewLook();
  const { data: personalVault, isLoading: vaultLoading } = useQuery<{ id: string; name: string } | null>({
    queryKey: ["/api/my-personal-vault"],
  });

  const { data: sharedSecrets = [], isLoading: sharedLoading } = useQuery<any[]>({
    queryKey: ["/api/my-vault-access"],
  });

  return (
    <AdminLayout>
      <div className="v2-surface p-6 max-w-5xl mx-auto space-y-6">
        {newLook ? (
          <V2PageHeader
            icon={KeyRound}
            eyebrow="Vault"
            title="My Vault"
            subtitle="Your personal credentials, shared access, and team vaults"
          />
        ) : (
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <KeyRound className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">My Vault</h1>
              <p className="text-sm text-muted-foreground">Your personal credentials, shared access, and team vaults</p>
            </div>
          </div>
        )}

        <Tabs defaultValue="team-vaults">
          <TabsList>
            <TabsTrigger value="team-vaults" data-testid="tab-team-vaults">Team Vaults</TabsTrigger>
            <TabsTrigger value="shared" data-testid="tab-shared-with-me">Shared With Me</TabsTrigger>
            <TabsTrigger value="personal" data-testid="tab-personal-vault">My Personal Vault</TabsTrigger>
          </TabsList>

          <TabsContent value="team-vaults" className="mt-4">
            <TeamVaultsSection />
          </TabsContent>

          <TabsContent value="shared" className="mt-4">
            {sharedLoading ? (
              <div className="py-12 text-center text-muted-foreground text-sm">Loading shared credentials…</div>
            ) : (
              <SharedWithMeTable secrets={sharedSecrets} />
            )}
          </TabsContent>

          <TabsContent value="personal" className="mt-4">
            {vaultLoading ? (
              <div className="py-12 text-center text-muted-foreground text-sm">Loading your vault…</div>
            ) : !personalVault ? (
              <div className="py-12 text-center text-muted-foreground text-sm">Failed to load personal vault.</div>
            ) : (
              <PersonalSecretsTable vaultId={personalVault.id} />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
