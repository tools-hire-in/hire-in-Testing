import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserPlus, Users, Trash2, CheckCircle, XCircle } from "lucide-react";

type Grant = {
  id: string; userId?: string; roleName?: string;
  canCopyPassword: boolean; canRevealPassword: boolean;
  expiresAt?: string; revokedAt?: string; revokedBy?: string;
  createdAt: string;
};

type Secret = { id: string; systemName: string; sensitivity: string };

const ALL_ROLES = ["hr", "operations", "manager", "recruiter", "employee"];

export default function GrantAccessDialog({ secret, onClose }: { secret: Secret; onClose: () => void }) {
  const { toast } = useToast();
  const [tab, setTab] = useState<"active" | "add">("active");
  const [grantType, setGrantType] = useState<"user" | "role">("user");
  const [userId, setUserId] = useState("");
  const [roleName, setRoleName] = useState("");
  const [canCopy, setCanCopy] = useState(true);
  const [canReveal, setCanReveal] = useState(true);
  const [expiresAt, setExpiresAt] = useState("");

  const { data: grants = [], isLoading } = useQuery<Grant[]>({
    queryKey: [`/api/secrets/${secret.id}/grants`],
  });

  const { data: usersData } = useQuery<{ users: any[]; counts: Record<string, number> }>({
    queryKey: ["/api/admin/users"],
  });
  const users = usersData?.users ?? [];

  const addMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/secrets/${secret.id}/grants`, {
      userId: grantType === "user" ? userId : undefined,
      roleName: grantType === "role" ? roleName : undefined,
      canCopyPassword: canCopy,
      canRevealPassword: canReveal,
      expiresAt: expiresAt || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/secrets/${secret.id}/grants`] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-vault-access"] });
      toast({ title: "Access granted" });
      setUserId(""); setRoleName(""); setExpiresAt(""); setTab("active");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const revokeMutation = useMutation({
    mutationFn: (grantId: string) => apiRequest("DELETE", `/api/grants/${grantId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/secrets/${secret.id}/grants`] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-vault-access"] });
      toast({ title: "Access revoked" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const activeGrants = grants.filter(g => !g.revokedAt);
  const revokedGrants = grants.filter(g => g.revokedAt);

  const getUserName = (uid: string) => {
    const u = users.find((u: any) => u.id === uid);
    return u ? `${u.firstName} ${u.lastName} (${u.role})` : uid;
  };

  const canSubmit = grantType === "user" ? !!userId : !!roleName;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Manage Access — {secret.systemName}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={v => setTab(v as any)}>
          <TabsList className="w-full">
            <TabsTrigger value="active" className="flex-1" data-testid="tab-active-grants">
              Active Grants {activeGrants.length > 0 && <Badge variant="secondary" className="ml-1 text-xs">{activeGrants.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="add" className="flex-1" data-testid="tab-add-grant">
              <UserPlus className="h-4 w-4 mr-1" /> Add Grant
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-3 space-y-2">
            {isLoading ? (
              <div className="py-4 text-center text-sm text-muted-foreground">Loading grants…</div>
            ) : !activeGrants.length ? (
              <div className="py-6 text-center text-sm text-muted-foreground">No active grants. Add one →</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Grantee</TableHead>
                    <TableHead>Permissions</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeGrants.map(g => (
                    <TableRow key={g.id} data-testid={`row-grant-${g.id}`}>
                      <TableCell className="text-sm">
                        {g.userId ? getUserName(g.userId) : <span className="font-medium">Role: {g.roleName}</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className={`inline-flex items-center gap-1 text-xs ${g.canCopyPassword ? "text-green-700" : "text-muted-foreground line-through"}`}>
                            {g.canCopyPassword ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />} Copy
                          </span>
                          <span className={`inline-flex items-center gap-1 text-xs ${g.canRevealPassword ? "text-green-700" : "text-muted-foreground line-through"}`}>
                            {g.canRevealPassword ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />} Reveal
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {g.expiresAt ? new Date(g.expiresAt).toLocaleDateString() : "No expiry"}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                          data-testid={`button-revoke-grant-${g.id}`}
                          onClick={() => { if (confirm("Revoke this grant?")) revokeMutation.mutate(g.id); }}
                          disabled={revokeMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {revokedGrants.length > 0 && (
              <p className="text-xs text-muted-foreground">{revokedGrants.length} revoked grant(s) not shown.</p>
            )}
          </TabsContent>

          <TabsContent value="add" className="mt-3 space-y-4">
            <div className="space-y-1">
              <Label>Grant Type</Label>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={grantType === "user" ? "default" : "outline"}
                  onClick={() => setGrantType("user")}
                  data-testid="button-grant-type-user"
                >
                  Specific User
                </Button>
                <Button
                  size="sm"
                  variant={grantType === "role" ? "default" : "outline"}
                  onClick={() => setGrantType("role")}
                  data-testid="button-grant-type-role"
                >
                  By Role
                </Button>
              </div>
            </div>

            {grantType === "user" ? (
              <div className="space-y-1">
                <Label>Select User</Label>
                <Select value={userId} onValueChange={setUserId}>
                  <SelectTrigger data-testid="select-user">
                    <SelectValue placeholder="Pick a user…" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.filter((u: any) => u.isActive && !u.deletedAt).map((u: any) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.firstName} {u.lastName} — {u.role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1">
                <Label>Select Role</Label>
                <Select value={roleName} onValueChange={setRoleName}>
                  <SelectTrigger data-testid="select-role">
                    <SelectValue placeholder="Pick a role…" />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_ROLES.map(r => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={canCopy} onCheckedChange={setCanCopy} id="can-copy" data-testid="switch-can-copy" />
                <Label htmlFor="can-copy" className="cursor-pointer">Can Copy Password</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={canReveal} onCheckedChange={setCanReveal} id="can-reveal" data-testid="switch-can-reveal" />
                <Label htmlFor="can-reveal" className="cursor-pointer">Can Reveal Password</Label>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Expiry Date (optional)</Label>
              <Input
                type="date"
                value={expiresAt}
                onChange={e => setExpiresAt(e.target.value)}
                data-testid="input-grant-expires"
                min={new Date().toISOString().slice(0, 10)}
              />
            </div>

            <Button
              className="w-full"
              onClick={() => addMutation.mutate()}
              disabled={!canSubmit || addMutation.isPending}
              data-testid="button-add-grant"
            >
              {addMutation.isPending ? "Granting…" : "Grant Access"}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
