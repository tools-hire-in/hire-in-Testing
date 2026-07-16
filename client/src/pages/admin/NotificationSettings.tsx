import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Bell, Mail, MailX, ToggleLeft, ExternalLink, RefreshCw } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

interface NotifConfig {
  typeKey: string;
  label: string;
  description: string;
  category: string;
  scheduleLabel: string;
  recipientRule: string;
  enabled: boolean;
  updatedAt: string | null;
  lastSentAt: string | null;
}

interface NotificationSettingsData {
  emailsMasterEnabled: boolean;
  notificationsEnabled: boolean;
  configs: NotifConfig[];
}

function formatWhen(dateStr: string | null, prefix?: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const label = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return prefix ? `${prefix} ${label}` : label;
}

export default function NotificationSettings() {
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/admin/login");
  }, [authLoading, isAuthenticated, setLocation]);

  const isSuperAdmin = user?.role === "super_admin";

  useEffect(() => {
    if (!authLoading && isAuthenticated && !isSuperAdmin) {
      setLocation("/admin/my-desk");
    }
  }, [authLoading, isAuthenticated, isSuperAdmin, setLocation]);

  const { data, isLoading } = useQuery<NotificationSettingsData>({
    queryKey: ["/api/admin/notification-settings"],
    enabled: isSuperAdmin,
  });

  const globalMutation = useMutation({
    mutationFn: async (payload: { emailsMasterEnabled?: boolean; notificationsEnabled?: boolean }) => {
      const res = await apiRequest("PATCH", "/api/admin/notification-settings", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/notification-settings"] });
      toast({ title: "Settings saved" });
    },
    onError: () => toast({ title: "Failed to save settings", variant: "destructive" }),
  });

  const perTypeMutation = useMutation({
    mutationFn: async ({ key, enabled }: { key: string; enabled: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admin/communication-config/${key}`, { enabled });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/notification-settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/communication-config"] });
      toast({ title: "Email type updated" });
    },
    onError: () => toast({ title: "Failed to update email type", variant: "destructive" }),
  });

  if (authLoading || !isAuthenticated || !isSuperAdmin) return null;

  const grouped = (data?.configs ?? []).reduce<Record<string, NotifConfig[]>>((acc, c) => {
    const cat = c.category ?? "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(c);
    return acc;
  }, {});

  const masterOff = data && !data.emailsMasterEnabled;

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-6 p-4 md:p-6 v2-surface">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-notif-settings-title">
            <Bell className="h-5 w-5" />
            Notifications &amp; Email
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            One place to control all outbound email and in-app notifications. Super Admin only.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
        ) : (
          <>
            {masterOff && (
              <div className="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive" data-testid="banner-master-off">
                <MailX className="h-4 w-4 shrink-0" />
                <span><strong>Master email switch is OFF.</strong> No emails of any kind are leaving the platform right now. Per-type toggles below are saved but have no effect until the master switch is turned back ON.</span>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Card className={cn(masterOff ? "border-destructive/40" : "")}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Mail className="h-4 w-4 text-orange-500" />
                    Master Email Switch
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">All outbound email</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        When OFF, every email from the platform — transactional, automated, and bulk — is suppressed. Suppressed emails are logged with status <code className="text-xs">master_suppressed</code> so the audit trail is preserved. Turn this OFF to immediately stop all sending in any environment.
                      </p>
                    </div>
                    <Switch
                      checked={data?.emailsMasterEnabled ?? true}
                      onCheckedChange={(v) => globalMutation.mutate({ emailsMasterEnabled: v })}
                      disabled={globalMutation.isPending}
                      data-testid="switch-emails-master-enabled"
                    />
                  </div>
                  {data?.emailsMasterEnabled ? (
                    <div className="text-xs px-2 py-1.5 rounded bg-green-50 text-green-700 border border-green-200">
                      Email is <strong>enabled</strong> — all active send functions are operational.
                    </div>
                  ) : (
                    <div className="text-xs px-2 py-1.5 rounded bg-red-50 text-red-700 border border-red-200">
                      Email is <strong>OFF</strong> — all outbound mail suppressed.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Bell className="h-4 w-4 text-blue-500" />
                    In-App Notifications
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">Notification bell &amp; alerts</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        When OFF, no in-app notifications are created for any user. The notification bell is hidden. Governance escalations, leave alerts, training reminders and all other in-app alerts are paused.
                      </p>
                    </div>
                    <Switch
                      checked={data?.notificationsEnabled ?? true}
                      onCheckedChange={(v) => globalMutation.mutate({ notificationsEnabled: v })}
                      disabled={globalMutation.isPending}
                      data-testid="switch-notifications-enabled"
                    />
                  </div>
                  {data?.notificationsEnabled ? (
                    <div className="text-xs px-2 py-1.5 rounded bg-green-50 text-green-700 border border-green-200">
                      In-app notifications are <strong>enabled</strong>.
                    </div>
                  ) : (
                    <div className="text-xs px-2 py-1.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                      In-app notifications are <strong>paused</strong>.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold flex items-center gap-2">
                    <ToggleLeft className="h-4 w-4" />
                    Per-Type Email Controls
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Disable specific automated email types without affecting others. These only apply when the master switch is ON.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLocation("/admin/settings/notifications?tab=communications")}
                  data-testid="button-open-comm-center"
                >
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                  Communications Centre
                </Button>
              </div>

              {Object.entries(grouped).map(([category, types]) => (
                <Card key={category}>
                  <CardHeader className="pb-2 pt-4">
                    <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                      {category}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y">
                      {types.map((t) => (
                        <div
                          key={t.typeKey}
                          className="flex items-start justify-between gap-4 px-4 py-3"
                          data-testid={`row-email-type-${t.typeKey}`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium">{t.label}</span>
                              {!t.enabled && (
                                <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-600">
                                  Disabled
                                </Badge>
                              )}
                              {masterOff && t.enabled && (
                                <Badge variant="outline" className="text-[10px] border-red-300 text-red-500">
                                  Master off
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
                            <div className="flex gap-3 mt-1 text-[11px] text-muted-foreground flex-wrap">
                              {t.scheduleLabel && <span>{t.scheduleLabel}</span>}
                              {t.recipientRule && <span>→ {t.recipientRule}</span>}
                              {t.lastSentAt && <span className="text-green-600">{formatWhen(t.lastSentAt, "Last sent")}</span>}
                              {!t.lastSentAt && <span className="text-muted-foreground/60">Never sent</span>}
                            </div>
                          </div>
                          <Switch
                            checked={t.enabled}
                            onCheckedChange={(v) => perTypeMutation.mutate({ key: t.typeKey, enabled: v })}
                            disabled={perTypeMutation.isPending}
                            data-testid={`switch-email-type-${t.typeKey}`}
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="text-xs text-muted-foreground text-center pt-2">
              For dev/QA dry-run intercept and override address settings, see{" "}
              <button
                className="underline hover:text-foreground"
                onClick={() => setLocation("/dev-tools")}
                data-testid="link-dev-tools"
              >
                Dev Control Center
              </button>.
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
