import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { V2PageHeader } from "@/components/admin/V2PageHeader";
import { useNewLook } from "@/hooks/use-new-look";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePermissions } from "@/hooks/use-permissions";
import { Mail, Users, Download, Search, Loader2, UserCheck, UserX, ShieldAlert } from "lucide-react";

interface SubscriberRow {
  id: string;
  email: string;
  status: "active" | "unsubscribed" | "suppressed";
  subscribedAt: string | null;
  unsubscribedAt: string | null;
  suppressedAt: string | null;
  lastBounceAt: string | null;
  bounceCount: number;
}

interface SubscribersResponse {
  items: SubscriberRow[];
  counts: { active: number; unsubscribed: number; suppressed: number; total: number };
}

function fmtDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function StatusBadge({ status }: { status: SubscriberRow["status"] }) {
  if (status === "active")
    return (
      <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
        Active
      </Badge>
    );
  if (status === "suppressed")
    return (
      <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
        Suppressed
      </Badge>
    );
  return <Badge variant="outline">Unsubscribed</Badge>;
}

export default function Subscribers() {
  const { enabled: newLook } = useNewLook();
  const [, setLocation] = useLocation();
  const { can } = usePermissions();
  const canManage = can("studio.manage_settings");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery<SubscribersResponse>({
    queryKey: ["/api/admin/studio/subscribers"],
    enabled: canManage,
  });

  const filtered = useMemo(() => {
    const items = data?.items ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((s) => s.email.toLowerCase().includes(q));
  }, [data?.items, search]);

  const counts = data?.counts ?? { active: 0, unsubscribed: 0, suppressed: 0, total: 0 };

  const handleExport = () => {
    window.open("/api/admin/studio/subscribers/export", "_blank");
  };

  if (!canManage) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-20 text-center">
          <ShieldAlert className="mb-3 h-10 w-10 text-muted-foreground/60" />
          <h2 className="text-lg font-semibold">Subscribers</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            You don't have permission to manage newsletter subscribers.
          </p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 v2-surface">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {newLook ? (
            <V2PageHeader
              icon={Mail}
              eyebrow="Studio"
              title="Subscribers"
              subtitle="Manage newsletter subscribers."
              testId="text-subscribers-title"
            />
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Mail className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight" data-testid="text-subscribers-title">
                  Subscribers
                </h1>
                <button
                  onClick={() => setLocation("/admin/studio")}
                  className="text-sm text-muted-foreground hover:text-foreground"
                  data-testid="link-back-studio"
                >
                  ← Back to Content Studio
                </button>
              </div>
            </div>
          )}
          <Button onClick={handleExport} variant="outline" data-testid="button-export-csv">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Card data-testid="card-count-total">
            <CardContent className="flex items-center gap-3 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-count-total">{counts.total}</p>
                <p className="text-sm text-muted-foreground">Total</p>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="card-count-active">
            <CardContent className="flex items-center gap-3 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <UserCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-count-active">{counts.active}</p>
                <p className="text-sm text-muted-foreground">Active</p>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="card-count-unsubscribed">
            <CardContent className="flex items-center gap-3 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <UserX className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-count-unsubscribed">{counts.unsubscribed}</p>
                <p className="text-sm text-muted-foreground">Unsubscribed</p>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="card-count-suppressed">
            <CardContent className="flex items-center gap-3 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-count-suppressed">{counts.suppressed}</p>
                <p className="text-sm text-muted-foreground">Suppressed</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email…"
            className="pl-9"
            data-testid="input-search-subscribers"
          />
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground" data-testid="text-empty-subscribers">
                {search ? "No subscribers match your search." : "No subscribers yet."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="px-4 py-3 font-medium">Email</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Subscribed</th>
                      <th className="px-4 py-3 font-medium">Last activity</th>
                      <th className="px-4 py-3 font-medium">Bounces</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s) => (
                      <tr key={s.id} className="border-b last:border-0 hover:bg-muted/40" data-testid={`row-subscriber-${s.id}`}>
                        <td className="px-4 py-3 font-medium" data-testid={`text-email-${s.id}`}>{s.email}</td>
                        <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                        <td className="px-4 py-3 text-muted-foreground">{fmtDate(s.subscribedAt)}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {fmtDate(s.suppressedAt || s.unsubscribedAt || s.subscribedAt)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{s.bounceCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
