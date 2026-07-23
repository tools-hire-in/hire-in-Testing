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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PlayCircle, RefreshCw, Mail, Bell, AlertTriangle, CheckCircle2, Eye, EyeOff, Inbox, Trash2, X } from "lucide-react";
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

interface DevInboxEntry {
  id: number;
  envMode: string;
  type: string;
  sourceJob: string;
  toAddresses: string[];
  ccAddresses: string[];
  subject: string;
  bodyHtml: string | null;
  bodyText: string | null;
  capturedAt: string;
}

function EnvironmentTab({ status, onRefresh }: { status: DevToolsStatus; onRefresh: () => void }) {
  const { toast } = useToast();
  const [selectedMode, setSelectedMode] = useState(status.envMode === "production" ? "dev" : status.envMode);
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
    mutationFn: (payload: { dryRun?: boolean }) =>
      apiRequest("POST", "/api/dev-tools/email-intercept", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dev-tools/status"] });
      onRefresh();
      toast({ title: "Email settings saved" });
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
          Changing env_mode suspends crons and routes all outgoing emails to the local Dev Inbox (no SendGrid). This panel is never shown in production (APP_ENV=production hard-gates everything).
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
            Controls cron suspension and email capture behaviour.
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
                <SelectItem value="dev">dev — all crons suspended, emails captured to Dev Inbox</SelectItem>
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
            In DEV/QA mode, <strong className="text-zinc-200">all outgoing emails go to the Dev Inbox — nothing reaches SendGrid</strong>, regardless of any override address setting. The override address field is preserved for reference but has no effect on delivery.
            Enable dry-run to suppress inbox writes too (pure log-only mode).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert className="border-green-800 bg-green-950/30">
            <CheckCircle2 className="h-4 w-4 text-green-400" />
            <AlertDescription className="text-green-200 text-sm">
              <strong>Emails are captured locally</strong> — all outgoing mail in DEV/QA is written to the{" "}
              <a href="/dev-tools/inbox" className="underline text-green-300 hover:text-green-100">Dev Inbox</a>{" "}
              tab. Zero bytes leave the system toward SendGrid.
            </AlertDescription>
          </Alert>

          <div className="flex items-center justify-between rounded-lg border border-zinc-700 p-4">
            <div>
              <p className="text-zinc-100 font-medium text-sm">Dry-run mode</p>
              <p className="text-zinc-400 text-xs mt-0.5">
                When ON, emails are logged to the comm log as <code className="text-zinc-300">dry_run</code> but skipped from the Dev Inbox too.
                Use this for pure suppression with no inbox writes.
              </p>
            </div>
            <Switch
              checked={dryRun}
              onCheckedChange={setDryRun}
              data-testid="switch-dry-run"
            />
          </div>

          {status.emailIntercept.dryRun && (
            <Alert className="border-yellow-800 bg-yellow-950/30">
              <AlertTriangle className="h-4 w-4 text-yellow-400" />
              <AlertDescription className="text-yellow-200 text-sm">
                <strong>Dry-run ON</strong> — emails are suppressed entirely (no inbox write, no SendGrid).
              </AlertDescription>
            </Alert>
          )}

          <Button
            onClick={() => interceptMutation.mutate({ dryRun })}
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

function DevInboxTab() {
  const { toast } = useToast();
  const [selected, setSelected] = useState<DevInboxEntry | null>(null);

  const { data: entries = [], refetch, isLoading } = useQuery<DevInboxEntry[]>({
    queryKey: ["/api/dev-tools/inbox"],
    refetchInterval: 10_000,
  });

  const clearMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/dev-tools/inbox"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dev-tools/inbox"] });
      toast({ title: "Dev inbox cleared" });
    },
    onError: (err: any) => toast({ title: "Clear failed", description: err.message, variant: "destructive" }),
  });

  const envBadgeClass: Record<string, string> = {
    dev: "border-yellow-700 text-yellow-400",
    qa: "border-blue-700 text-blue-400",
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40 text-zinc-400">
        <RefreshCw className="h-4 w-4 animate-spin mr-2" /> Loading…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Alert className="border-zinc-700 bg-zinc-900/60">
        <Inbox className="h-4 w-4 text-zinc-400" />
        <AlertDescription className="text-zinc-300 text-sm">
          All emails sent in DEV/QA are captured here instead of reaching SendGrid.
          Rows are auto-purged weekly (Sundays 02:00 IST, 7-day retention).
          Click any row to preview the full HTML body.
        </AlertDescription>
      </Alert>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <div className="flex items-center gap-2">
            <CardTitle className="text-zinc-100 text-base">
              Captured Emails
            </CardTitle>
            {entries.length > 0 && (
              <Badge className="bg-orange-600 text-white text-[10px] px-1.5 py-0.5">
                {entries.length}
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 gap-1.5 text-xs"
              onClick={() => refetch()}
              data-testid="button-refresh-inbox"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-red-800 text-red-400 hover:bg-red-950/30 gap-1.5 text-xs"
              onClick={() => clearMutation.mutate()}
              disabled={clearMutation.isPending || entries.length === 0}
              data-testid="button-clear-inbox"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {clearMutation.isPending ? "Clearing…" : "Clear All"}
            </Button>
          </div>
        </CardHeader>

        {entries.length === 0 ? (
          <CardContent>
            <div className="text-center py-10 text-zinc-500">
              <Inbox className="h-8 w-8 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No captured emails yet.</p>
              <p className="text-xs mt-1">Emails triggered in DEV/QA will appear here instead of reaching SendGrid.</p>
            </div>
          </CardContent>
        ) : (
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-400 font-medium w-12">Env</TableHead>
                  <TableHead className="text-zinc-400 font-medium">Subject</TableHead>
                  <TableHead className="text-zinc-400 font-medium">To</TableHead>
                  <TableHead className="text-zinc-400 font-medium">Type</TableHead>
                  <TableHead className="text-zinc-400 font-medium">Captured</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow
                    key={entry.id}
                    className="border-zinc-800 hover:bg-zinc-800/50 cursor-pointer"
                    onClick={() => setSelected(entry)}
                    data-testid={`row-inbox-${entry.id}`}
                  >
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] ${envBadgeClass[entry.envMode] ?? "border-zinc-600 text-zinc-400"}`}>
                        {entry.envMode.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-zinc-100 text-sm max-w-[260px] truncate">
                      {entry.subject}
                    </TableCell>
                    <TableCell className="text-zinc-400 text-xs max-w-[180px] truncate">
                      {entry.toAddresses.join(", ")}
                    </TableCell>
                    <TableCell className="text-zinc-500 text-xs font-mono">
                      {entry.type}
                    </TableCell>
                    <TableCell className="text-zinc-500 text-xs whitespace-nowrap">
                      {new Date(entry.capturedAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        )}
      </Card>

      {/* Email detail dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-zinc-100 max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-zinc-100 text-base pr-6">
              {selected?.subject}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              {/* Metadata */}
              <div className="rounded-lg border border-zinc-700 p-4 space-y-2 text-xs text-zinc-400 font-mono">
                <div className="flex gap-2">
                  <span className="text-zinc-500 w-16 shrink-0">Env</span>
                  <Badge variant="outline" className={`text-[10px] ${envBadgeClass[selected.envMode] ?? "border-zinc-600 text-zinc-400"}`}>
                    {selected.envMode.toUpperCase()}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <span className="text-zinc-500 w-16 shrink-0">To</span>
                  <span className="text-zinc-200">{selected.toAddresses.join(", ")}</span>
                </div>
                {selected.ccAddresses.length > 0 && (
                  <div className="flex gap-2">
                    <span className="text-zinc-500 w-16 shrink-0">CC</span>
                    <span className="text-zinc-200">{selected.ccAddresses.join(", ")}</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <span className="text-zinc-500 w-16 shrink-0">Type</span>
                  <span className="text-zinc-200">{selected.type}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-zinc-500 w-16 shrink-0">Source</span>
                  <span className="text-zinc-200">{selected.sourceJob}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-zinc-500 w-16 shrink-0">Time</span>
                  <span className="text-zinc-200">{new Date(selected.capturedAt).toLocaleString()}</span>
                </div>
              </div>

              {/* HTML body rendered in sandboxed iframe */}
              {selected.bodyHtml ? (
                <div className="space-y-1">
                  <p className="text-xs text-zinc-500 font-medium uppercase tracking-wide">HTML Preview</p>
                  <div className="rounded border border-zinc-700 overflow-hidden">
                    <iframe
                      sandbox="allow-same-origin"
                      srcDoc={selected.bodyHtml}
                      className="w-full h-[400px] bg-white"
                      title="Email preview"
                      data-testid="iframe-email-preview"
                    />
                  </div>
                </div>
              ) : selected.bodyText ? (
                <div className="space-y-1">
                  <p className="text-xs text-zinc-500 font-medium uppercase tracking-wide">Text Body</p>
                  <pre className="text-xs text-zinc-300 bg-zinc-800 rounded border border-zinc-700 p-4 whitespace-pre-wrap overflow-auto max-h-64">
                    {selected.bodyText}
                  </pre>
                </div>
              ) : (
                <p className="text-zinc-500 text-sm">No body content captured.</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
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
            Send a test notification/email to any employee. Uses the real notification gateway — emails are captured in the Dev Inbox (no SendGrid).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-green-800 bg-green-950/30">
            <CheckCircle2 className="h-4 w-4 text-green-400" />
            <AlertDescription className="text-green-200 text-sm">
              Test emails go to the <a href="/dev-tools/inbox" className="underline text-green-300 hover:text-green-100">Dev Inbox</a>, not to real recipients. No SendGrid call is made in DEV/QA.
            </AlertDescription>
          </Alert>
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
  const isInbox = location === "/dev-tools/inbox";

  if ((isError || !status) && !isViewAs && !isInbox) {
    return <Redirect to="/admin/my-desk" />;
  }

  const isCrons = location === "/dev-tools/crons";
  const isNotifications = location === "/dev-tools/notifications";

  return (
    <DevToolsShell>
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {!isCrons && !isNotifications && !isViewAs && !isInbox && (
          <EnvironmentTab status={status!} onRefresh={handleRefresh} />
        )}
        {isInbox && (
          <DevInboxTab />
        )}
        {isCrons && (
          <CronsTab status={status!} onRefresh={handleRefresh} />
        )}
        {isNotifications && (
          <NotificationSandboxTab status={status!} onRefresh={handleRefresh} />
        )}
        {isViewAs && (
          <ViewAsTab />
        )}
      </div>
    </DevToolsShell>
  );
}
