import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PlayCircle, RefreshCw, Mail, Bell, AlertTriangle, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { useLocation, Redirect } from "wouter";
import { DevToolsShell } from "@/components/dev-tools/DevToolsShell";
import { NOTIFICATION_TYPES } from "@shared/notificationTypes";
import { useAuth } from "@/hooks/use-auth";
import { useViewAsRole, type AppRole } from "@/hooks/use-view-as-role";

interface CronEntry {
  name: string;
  label: string;
  schedule: string;
  lastTriggeredAt: string | null;
  lastTriggeredBy: string | null;
  suspended: boolean;
}

interface DevToolsStatus {
  envMode: "dev" | "qa" | "production";
  emailIntercept: {
    enabled: boolean;
    overrideAddress: string;
    dryRun: boolean;
  };
  crons: CronEntry[];
}

function EnvironmentTab({ status, onRefresh }: { status: DevToolsStatus; onRefresh: () => void }) {
  const { toast } = useToast();
  const [selectedMode, setSelectedMode] = useState(status.envMode === "production" ? "dev" : status.envMode);
  const [overrideAddress, setOverrideAddress] = useState(status.emailIntercept.overrideAddress);
  const [dryRun, setDryRun] = useState(status.emailIntercept.dryRun);

  const envModeMutation = useMutation({
    mutationFn: (mode: string) => apiRequest("POST", "/api/dev-tools/env-mode", { mode }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dev-tools/status"] });
      onRefresh();
      toast({ title: "Environment mode updated" });
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const interceptMutation = useMutation({
    mutationFn: (payload: { overrideAddress?: string; dryRun?: boolean }) =>
      apiRequest("POST", "/api/dev-tools/email-intercept", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dev-tools/status"] });
      onRefresh();
      toast({ title: "Email intercept settings saved" });
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const envColors: Record<string, string> = {
    dev: "text-yellow-400",
    qa: "text-blue-400",
    production: "text-red-400",
  };

  return (
    <div className="space-y-6">
      <Alert className="border-yellow-700 bg-yellow-950/30">
        <AlertTriangle className="h-4 w-4 text-yellow-400" />
        <AlertDescription className="text-yellow-200 text-sm">
          <strong>Dev Control Center</strong> — only visible in non-production environments.
          Changing env_mode suspends crons and activates email interception. This panel is never shown in production (APP_ENV=production hard-gates everything).
          {" "}
          To manage the master email kill switch or per-type email toggles, visit{" "}
          <a href="/admin/notification-settings" className="underline text-yellow-300 hover:text-yellow-100" data-testid="link-notification-settings-devtools">
            Notification &amp; Email Settings
          </a>.
        </AlertDescription>
      </Alert>

      {/* ── Environment Mode ─────────────────────────────────────────── */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-zinc-100 text-base">Environment Mode</CardTitle>
          <CardDescription className="text-zinc-400">
            Controls cron suspension and email intercept behaviour.
            Current mode:{" "}
            <span className={`font-bold ${envColors[status.envMode]}`}>
              {status.envMode.toUpperCase()}
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-end gap-4">
          <div className="flex-1 max-w-xs">
            <Label className="text-zinc-300 mb-1.5 block">Switch mode</Label>
            <Select value={selectedMode} onValueChange={setSelectedMode}>
              <SelectTrigger
                className="bg-zinc-800 border-zinc-700 text-zinc-100"
                data-testid="select-env-mode"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dev">dev — all crons suspended, email intercepted</SelectItem>
                <SelectItem value="qa">qa — same as dev but tagged [QA]</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={() => envModeMutation.mutate(selectedMode)}
            disabled={envModeMutation.isPending || selectedMode === status.envMode}
            className="bg-orange-600 hover:bg-orange-700 text-white"
            data-testid="button-apply-env-mode"
          >
            {envModeMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Apply"}
          </Button>
        </CardContent>
      </Card>

      {/* ── Email Intercept ──────────────────────────────────────────── */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-zinc-100 text-base">
            <Mail className="h-4 w-4 text-orange-400" />
            Email Intercept
          </CardTitle>
          <CardDescription className="text-zinc-400">
            In dev/qa mode, all outgoing automated emails are intercepted before reaching SendGrid.
            Set an override address to redirect all mail, or enable dry-run to suppress sends entirely.
            The Notification Sandbox will also refuse to dispatch unless one of these is configured.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border border-zinc-700 p-4">
            <div>
              <p className="text-zinc-100 font-medium text-sm">Dry-run mode</p>
              <p className="text-zinc-400 text-xs mt-0.5">
                When ON, emails are logged as <code className="text-zinc-300">dry_run</code> but never delivered to SendGrid.
                Overrides the address field.
              </p>
            </div>
            <Switch
              checked={dryRun}
              onCheckedChange={setDryRun}
              data-testid="switch-dry-run"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-zinc-300">Override recipient address</Label>
            <p className="text-zinc-500 text-xs">
              All automated emails (and Notification Sandbox test sends) are redirected here. Subject is prefixed with [DEV] or [QA] and original recipients are appended to the footer.
            </p>
            <Input
              type="email"
              placeholder="dev-inbox@yourcompany.com"
              value={overrideAddress}
              onChange={(e) => setOverrideAddress(e.target.value)}
              className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
              disabled={dryRun}
              data-testid="input-override-address"
            />
          </div>

          {status.emailIntercept.enabled && !status.emailIntercept.dryRun && (
            <Alert className="border-green-800 bg-green-950/30">
              <CheckCircle2 className="h-4 w-4 text-green-400" />
              <AlertDescription className="text-green-200 text-sm">
                Email intercept <strong>active</strong> — all outgoing mail is redirected to{" "}
                <code className="font-mono">{status.emailIntercept.overrideAddress}</code>
              </AlertDescription>
            </Alert>
          )}
          {status.emailIntercept.dryRun && (
            <Alert className="border-yellow-800 bg-yellow-950/30">
              <AlertTriangle className="h-4 w-4 text-yellow-400" />
              <AlertDescription className="text-yellow-200 text-sm">
                <strong>Dry-run ON</strong> — emails are logged but not sent to SendGrid.
              </AlertDescription>
            </Alert>
          )}
          {!status.emailIntercept.enabled && !status.emailIntercept.dryRun && (
            <Alert className="border-orange-800 bg-orange-950/20">
              <AlertTriangle className="h-4 w-4 text-orange-400" />
              <AlertDescription className="text-orange-200 text-sm">
                <strong>No intercept configured</strong> — emails will go to real recipients. Set an override address or enable dry-run before using the Notification Sandbox.
              </AlertDescription>
            </Alert>
          )}

          <Button
            onClick={() => interceptMutation.mutate({ overrideAddress, dryRun })}
            disabled={interceptMutation.isPending}
            className="bg-orange-600 hover:bg-orange-700 text-white"
            data-testid="button-save-email-intercept"
          >
            {interceptMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
            Save Settings
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function CronsTab({ status, onRefresh }: { status: DevToolsStatus; onRefresh: () => void }) {
  const { toast } = useToast();

  const triggerMutation = useMutation({
    mutationFn: (jobName: string) => apiRequest("POST", `/api/dev-tools/crons/trigger/${jobName}`),
    onSuccess: (_data, jobName) => {
      queryClient.invalidateQueries({ queryKey: ["/api/dev-tools/status"] });
      onRefresh();
      toast({ title: `Job triggered: ${jobName}` });
    },
    onError: (err: any) => toast({ title: "Trigger failed", description: err.message, variant: "destructive" }),
  });

  if (status.crons.length === 0) {
    return (
      <div className="text-center py-12 text-zinc-400">
        No cron jobs registered. The scheduler may need a restart.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Alert className="border-zinc-700 bg-zinc-900/60">
        <AlertDescription className="text-zinc-300 text-sm">
          All jobs are <strong>suspended</strong> in dev/qa mode — their scheduled callbacks return early without executing.
          Use <em>Run Now</em> to trigger a job manually for testing.
        </AlertDescription>
      </Alert>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-zinc-100 text-base">Scheduled Jobs</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="text-zinc-400 font-medium">Job</TableHead>
                <TableHead className="text-zinc-400 font-medium">Schedule</TableHead>
                <TableHead className="text-zinc-400 font-medium">Status</TableHead>
                <TableHead className="text-zinc-400 font-medium">Last Triggered</TableHead>
                <TableHead className="text-zinc-400 font-medium">By</TableHead>
                <TableHead className="text-zinc-400 font-medium w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {status.crons.map((job) => (
                <TableRow key={job.name} className="border-zinc-800 hover:bg-zinc-800/30" data-testid={`row-cron-${job.name}`}>
                  <TableCell>
                    <div>
                      <p className="text-zinc-100 font-medium text-sm">{job.label}</p>
                      <p className="text-zinc-500 text-xs font-mono mt-0.5">{job.name}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-zinc-300 text-sm">{job.schedule}</TableCell>
                  <TableCell>
                    {job.suspended ? (
                      <Badge variant="outline" className="border-yellow-700 text-yellow-400 text-[10px]">
                        Suspended
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-green-700 text-green-400 text-[10px]">
                        Active
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-zinc-400 text-xs">
                    {job.lastTriggeredAt
                      ? new Date(job.lastTriggeredAt).toLocaleString()
                      : <span className="text-zinc-600">Never</span>}
                  </TableCell>
                  <TableCell className="text-zinc-400 text-xs">
                    {job.lastTriggeredBy ?? <span className="text-zinc-600">—</span>}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 text-xs gap-1.5"
                      onClick={() => triggerMutation.mutate(job.name)}
                      disabled={triggerMutation.isPending}
                      data-testid={`button-trigger-${job.name}`}
                    >
                      <PlayCircle className="h-3.5 w-3.5" />
                      Run Now
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function NotificationSandboxTab({ status, onRefresh }: { status: DevToolsStatus; onRefresh: () => void }) {
  const { toast } = useToast();
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [notificationType, setNotificationType] = useState(NOTIFICATION_TYPES[0].typePrefixes[0]);
  const [preview, setPreview] = useState<{ subject: string; html: string; to: string } | null>(null);

  const { data: employees } = useQuery<any[]>({
    queryKey: ["/api/admin/users"],
    select: (data: any) => (Array.isArray(data) ? data : data?.users ?? []),
  });

  const filteredEmployees = (employees ?? []).filter((e: any) =>
    `${e.firstName} ${e.lastName} ${e.email}`.toLowerCase().includes(employeeSearch.toLowerCase())
  ).slice(0, 20);

  const previewMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/dev-tools/notify/preview", { employeeId: selectedEmployeeId, notificationType })
        .then(r => r.json()),
    onSuccess: (data: any) => setPreview(data),
    onError: (err: any) => toast({ title: "Preview failed", description: err.message, variant: "destructive" }),
  });

  const sendTestMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/dev-tools/notify/send-test", { employeeId: selectedEmployeeId, notificationType })
        .then(r => r.json()),
    onSuccess: (data: any) => {
      toast({ title: "Test notification sent", description: `Sent to: ${data.sentTo}` });
      onRefresh();
    },
    onError: (err: any) => toast({ title: "Send failed", description: err.message, variant: "destructive" }),
  });

  // Build the type picker options from shared/notificationTypes.ts:
  // flatten ALL typePrefixes from every definition so each registered type variant is testable
  const SANDBOX_TYPES = NOTIFICATION_TYPES.flatMap((def) =>
    def.typePrefixes.map((prefix) => ({
      key: prefix,
      label: `${def.label} — ${prefix}`,
      category: def.category,
    }))
  );

  return (
    <div className="space-y-6">
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-zinc-100 text-base">
            <Bell className="h-4 w-4 text-orange-400" />
            Notification Sandbox
          </CardTitle>
          <CardDescription className="text-zinc-400">
            Send a test notification/email to any employee. Uses the real notification gateway, so email intercept settings apply.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!status.emailIntercept.enabled && !status.emailIntercept.dryRun && (
            <Alert className="border-orange-700 bg-orange-950/30">
              <AlertTriangle className="h-4 w-4 text-orange-400" />
              <AlertDescription className="text-orange-200 text-sm">
                <strong>Intercept not configured.</strong> Go to the Environment tab and set an override address or enable dry-run before sending. Otherwise Send Test will be blocked to protect real recipients.
              </AlertDescription>
            </Alert>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-zinc-300">Employee</Label>
              <Input
                placeholder="Search by name or email…"
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 mb-1"
                data-testid="input-employee-search"
              />
              <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                <SelectTrigger
                  className="bg-zinc-800 border-zinc-700 text-zinc-100"
                  data-testid="select-employee"
                >
                  <SelectValue placeholder="Select employee…" />
                </SelectTrigger>
                <SelectContent>
                  {filteredEmployees.map((e: any) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.firstName} {e.lastName} — {e.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-300">Notification type</Label>
              <Select value={notificationType} onValueChange={setNotificationType}>
                <SelectTrigger
                  className="bg-zinc-800 border-zinc-700 text-zinc-100"
                  data-testid="select-notification-type"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SANDBOX_TYPES.map((t) => (
                    <SelectItem key={t.key} value={t.key}>
                      <span className="text-xs text-zinc-400 mr-1">[{t.category}]</span>{t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => previewMutation.mutate()}
              disabled={!selectedEmployeeId || previewMutation.isPending}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              data-testid="button-preview-notification"
            >
              {previewMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
              Preview
            </Button>
            <Button
              onClick={() => sendTestMutation.mutate()}
              disabled={!selectedEmployeeId || sendTestMutation.isPending}
              className="bg-orange-600 hover:bg-orange-700 text-white"
              data-testid="button-send-test-notification"
            >
              {sendTestMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
              Send Test
            </Button>
          </div>

          {preview && (
            <div className="rounded-lg border border-zinc-700 p-4 space-y-3 mt-4">
              <p className="text-zinc-300 text-sm font-medium">Preview</p>
              <div className="space-y-1 text-xs text-zinc-400">
                <p><span className="text-zinc-500">To:</span> {preview.to}</p>
                <p><span className="text-zinc-500">Subject:</span> {preview.subject}</p>
              </div>
              <div
                className="rounded border border-zinc-700 p-3 bg-zinc-800 text-sm text-zinc-300 max-h-40 overflow-auto"
                dangerouslySetInnerHTML={{ __html: preview.html }}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  super_admin: "Full access to all admin features, system settings, and dev tools",
  admin:       "Admin access — most features except super-admin-only controls",
  hr:          "HR portal, people management, leave approvals, and HR tools",
  operations:  "Operations view — recruitment pipeline, team management",
  manager:     "Team lead view — team attendance, leave approvals, training oversight",
  recruiter:   "Recruitment-focused — Ceipal modal on punch-out, job pipeline",
  employee:    "Standard employee — My Desk, leave requests, payslips",
  finance:     "Finance & contracts, salary reports, payroll access",
  executive:   "Read-only executive cockpit with high-level metrics",
};

const ALL_ROLES: AppRole[] = [
  "super_admin", "admin", "hr", "operations", "manager",
  "recruiter", "employee", "finance", "executive",
];

function ViewAsTab() {
  const { realRole } = useAuth();
  const { viewAsRole, setViewAsRole, clearViewAsRole } = useViewAsRole(realRole);
  const queryClient = useQueryClient();

  const canOverride = realRole === "super_admin" || realRole === "admin";

  const handleActivate = (role: AppRole) => {
    setViewAsRole(role);
    queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    window.location.href = "/admin/my-desk";
  };

  const handleClear = () => {
    clearViewAsRole();
    queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
  };

  if (!canOverride) {
    return (
      <Alert className="border-red-800 bg-red-950/30">
        <AlertTriangle className="h-4 w-4 text-red-400" />
        <AlertDescription className="text-red-200 text-sm">
          Only <strong>super_admin</strong> and <strong>admin</strong> roles can use View As. Your current real role does not qualify.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-zinc-100 text-base">
            <Eye className="h-4 w-4 text-orange-400" />
            Current Override Status
          </CardTitle>
          <CardDescription className="text-zinc-400">
            {viewAsRole
              ? <>Active: UI is currently showing the <span className="font-semibold text-amber-400 uppercase">{viewAsRole}</span> role experience.</>
              : "No override active — you are seeing your real role view."}
          </CardDescription>
        </CardHeader>
        {viewAsRole && (
          <CardContent>
            <Button
              variant="outline"
              onClick={handleClear}
              className="border-amber-600 text-amber-400 hover:bg-amber-950/40 gap-2"
              data-testid="button-exit-view-as"
            >
              <EyeOff className="h-4 w-4" />
              Exit View As — return to real view
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Warning card */}
      <Alert className="border-zinc-700 bg-zinc-900/60">
        <AlertTriangle className="h-4 w-4 text-zinc-400" />
        <AlertDescription className="text-zinc-300 text-sm">
          <strong>Backend responses are not affected.</strong> API data reflects your real account.
          Only the UI role-gating (navigation, permissions, page access) changes.
          The override lives in <code className="text-zinc-200">sessionStorage</code> and clears automatically when you close the tab or log out.
        </AlertDescription>
      </Alert>

      {/* Role grid */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-zinc-100 text-base">Choose a Role to Simulate</CardTitle>
          <CardDescription className="text-zinc-400">
            Click any role below. You will be redirected to My Desk and the portal will reflect that role's view.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ALL_ROLES.map((role) => {
              const isActive = viewAsRole === role;
              return (
                <button
                  key={role}
                  onClick={() => handleActivate(role)}
                  data-testid={`button-view-as-${role}`}
                  className={`text-left rounded-lg border p-4 transition-colors ${
                    isActive
                      ? "border-amber-500 bg-amber-950/30 text-amber-200"
                      : "border-zinc-700 bg-zinc-800/50 text-zinc-200 hover:border-orange-600 hover:bg-zinc-800"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-bold uppercase tracking-wide ${isActive ? "text-amber-400" : "text-orange-400"}`}>
                      {role}
                    </span>
                    {isActive && (
                      <span className="text-[10px] bg-amber-500 text-black font-bold px-1.5 py-0.5 rounded">ACTIVE</span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 leading-snug">
                    {ROLE_DESCRIPTIONS[role]}
                  </p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function DevTools() {
  const [location] = useLocation();
  const { data: status, refetch, isError, isLoading } = useQuery<DevToolsStatus>({
    queryKey: ["/api/dev-tools/status"],
    refetchInterval: 15_000,
    retry: false,
  });

  const handleRefresh = () => {
    refetch();
  };

  if (isLoading) {
    return (
      <DevToolsShell>
        <div className="flex items-center justify-center h-64 text-zinc-400">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading Dev Control Center…
        </div>
      </DevToolsShell>
    );
  }

  const isViewAs = location === "/dev-tools/view-as";

  if ((isError || !status) && !isViewAs) {
    return <Redirect to="/admin/my-desk" />;
  }

  const isCrons = location === "/dev-tools/crons";
  const isNotifications = location === "/dev-tools/notifications";

  return (
    <DevToolsShell>
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {!isCrons && !isNotifications && !isViewAs && (
          <EnvironmentTab status={status} onRefresh={handleRefresh} />
        )}
        {isCrons && (
          <CronsTab status={status} onRefresh={handleRefresh} />
        )}
        {isNotifications && (
          <NotificationSandboxTab status={status} onRefresh={handleRefresh} />
        )}
        {isViewAs && (
          <ViewAsTab />
        )}
      </div>
    </DevToolsShell>
  );
}
