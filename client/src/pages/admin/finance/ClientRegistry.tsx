import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Building2, Search, Loader2, PowerOff, Power } from "lucide-react";
import type { ContractClient, InsertContractClient } from "@shared/schema";

interface Props { canManage: boolean; }

const EMPTY: Partial<InsertContractClient> = {
  name: "", address: "", signatoryName: "", signatoryTitle: "", email: "", phone: "", website: "",
};

interface ClientFormProps {
  data: Partial<InsertContractClient>;
  onChange: (d: Partial<InsertContractClient>) => void;
}

function ClientForm({ data, onChange }: ClientFormProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-1.5 col-span-2">
        <Label>Company Name *</Label>
        <Input value={data.name || ""} onChange={e => onChange({ ...data, name: e.target.value })} data-testid="input-client-company" />
      </div>
      <div className="space-y-1.5">
        <Label>Signatory Name</Label>
        <Input value={data.signatoryName || ""} onChange={e => onChange({ ...data, signatoryName: e.target.value })} data-testid="input-signatory-name" />
      </div>
      <div className="space-y-1.5">
        <Label>Signatory Title</Label>
        <Input value={data.signatoryTitle || ""} onChange={e => onChange({ ...data, signatoryTitle: e.target.value })} data-testid="input-signatory-title" />
      </div>
      <div className="space-y-1.5">
        <Label>Email</Label>
        <Input type="email" value={data.email || ""} onChange={e => onChange({ ...data, email: e.target.value })} data-testid="input-client-email" />
      </div>
      <div className="space-y-1.5">
        <Label>Phone</Label>
        <Input value={data.phone || ""} onChange={e => onChange({ ...data, phone: e.target.value })} data-testid="input-client-phone" />
      </div>
      <div className="space-y-1.5">
        <Label>Website</Label>
        <Input value={data.website || ""} onChange={e => onChange({ ...data, website: e.target.value })} data-testid="input-client-website" />
      </div>
      <div className="space-y-1.5 col-span-2">
        <Label>Address</Label>
        <Textarea value={data.address || ""} onChange={e => onChange({ ...data, address: e.target.value })} rows={2} data-testid="textarea-client-address" />
      </div>
    </div>
  );
}

export default function ClientRegistry({ canManage }: Props) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ContractClient | null>(null);
  const [form, setForm] = useState<Partial<InsertContractClient>>(EMPTY);
  const [showNew, setShowNew] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<ContractClient | null>(null);

  const { data: clients = [], isLoading } = useQuery<ContractClient[]>({
    queryKey: ["/api/contracts/clients", "all"],
    queryFn: () => fetch("/api/contracts/clients?activeOnly=false", { credentials: "include" }).then(r => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<InsertContractClient>) => apiRequest("POST", "/api/contracts/clients", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/clients"] });
      setShowNew(false);
      setForm(EMPTY);
      toast({ title: "Client added" });
    },

    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InsertContractClient> }) =>
      apiRequest("PATCH", `/api/contracts/clients/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/clients"] });
      setEditing(null);
      toast({ title: "Client updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiRequest("PATCH", `/api/contracts/clients/${id}/status`, { isActive }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/clients"] });
      setDeactivateTarget(null);
      toast({ title: variables.isActive ? "Client reactivated" : "Client deactivated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const filtered = clients.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search clients..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-clients" />
        </div>
        {canManage && (
          <Button onClick={() => { setForm(EMPTY); setShowNew(true); }} data-testid="button-add-client">
            <Plus className="h-4 w-4 mr-2" /> Add Client
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-14 text-muted-foreground">
          <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No clients yet</p>
          <p className="text-sm">Add your first client to the registry.</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Company</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Signatory</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Phone</th>
                {canManage && <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(client => (
                <tr key={client.id} className="hover:bg-muted/30" data-testid={`row-client-${client.id}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{client.name}</span>
                      {!client.isActive && (
                        <Badge variant="secondary" className="text-xs" data-testid={`badge-inactive-${client.id}`}>Inactive</Badge>
                      )}
                    </div>
                    {client.website && <a href={client.website} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">{client.website}</a>}
                  </td>
                  <td className="px-4 py-3">
                    <div>{client.signatoryName || "—"}</div>
                    {client.signatoryTitle && <div className="text-xs text-muted-foreground">{client.signatoryTitle}</div>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{client.email || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{client.phone || "—"}</td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => { setEditing(client); setForm(client); }} data-testid={`button-edit-client-${client.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {client.isActive ? (
                          <Button
                            variant="ghost" size="sm" className="text-amber-600 hover:text-amber-700"
                            onClick={() => setDeactivateTarget(client)}
                            data-testid={`button-deactivate-client-${client.id}`}
                            title="Deactivate client"
                          >
                            <PowerOff className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost" size="sm" className="text-green-600 hover:text-green-700"
                            onClick={() => statusMutation.mutate({ id: client.id, isActive: true })}
                            disabled={statusMutation.isPending}
                            data-testid={`button-reactivate-client-${client.id}`}
                            title="Reactivate client"
                          >
                            <Power className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Dialog */}
      {(showNew || editing) && (
        <Dialog open onOpenChange={() => { setShowNew(false); setEditing(null); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Client" : "Add Client"}</DialogTitle>
            </DialogHeader>
            <div className="py-2">
              <ClientForm data={form} onChange={setForm} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowNew(false); setEditing(null); }}>Cancel</Button>
              <Button
                onClick={() => editing
                  ? updateMutation.mutate({ id: editing.id, data: form })
                  : createMutation.mutate(form)
                }
                disabled={!form.name || createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-client"
              >
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editing ? "Save Changes" : "Add Client"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Deactivate Confirmation Dialog */}
      {deactivateTarget && (
        <Dialog open onOpenChange={() => setDeactivateTarget(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Deactivate {deactivateTarget.name}?</DialogTitle>
              <DialogDescription>
                They will be hidden from new contract selection but all existing contracts remain intact.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeactivateTarget(null)} data-testid="button-cancel-deactivate">Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => statusMutation.mutate({ id: deactivateTarget.id, isActive: false })}
                disabled={statusMutation.isPending}
                data-testid="button-confirm-deactivate"
              >
                {statusMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Deactivate
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
