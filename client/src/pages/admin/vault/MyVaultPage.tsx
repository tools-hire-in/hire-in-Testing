import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { V2PageHeader } from "@/components/admin/V2PageHeader";
import { useNewLook } from "@/hooks/use-new-look";
import { Button } from "@/components/ui/button";
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
  Lock, ExternalLink, MoreHorizontal, Trash2,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import RevealSecretDialog from "./RevealSecretDialog";

const SENSITIVITY_META: Record<string, { label: string; color: string; icon: typeof Shield; scrutiny: string }> = {
  low: { label: "Low", color: "bg-green-100 text-green-800", icon: Shield, scrutiny: "Click to reveal — no reason required" },
  medium: { label: "Medium", color: "bg-yellow-100 text-yellow-800", icon: ShieldCheck, scrutiny: "Reason required to reveal" },
};

type Secret = {
  id: string; vaultId: string; systemName: string; loginUrl?: string;
  sensitivity: string; rotationDueAt?: string; rotationRequired: boolean;
  canCopy: boolean; canReveal: boolean; createdAt: string;
  username?: string; notes?: string;
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
                  <div className="flex items-center gap-1.5">
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
                <div className="flex items-center gap-1.5">
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
          ))}
        </TableBody>
      </Table>
      {revealSecret && <RevealSecretDialog secret={revealSecret} onClose={() => setRevealSecret(null)} />}
    </div>
  );
}

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
            subtitle="Your personal credentials and shared company access"
          />
        ) : (
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <KeyRound className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">My Vault</h1>
              <p className="text-sm text-muted-foreground">Your personal credentials and shared company access</p>
            </div>
          </div>
        )}

        <Tabs defaultValue="shared">
          <TabsList>
            <TabsTrigger value="shared" data-testid="tab-shared-with-me">Shared With Me</TabsTrigger>
            <TabsTrigger value="personal" data-testid="tab-personal-vault">My Personal Vault</TabsTrigger>
          </TabsList>

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
