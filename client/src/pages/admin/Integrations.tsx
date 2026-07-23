import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  CheckCircle, XCircle, AlertCircle, RefreshCw, ExternalLink,
  ChevronDown, ChevronRight, Plug, Users, BarChart2, Eye,
} from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { V2PageHeader } from "@/components/admin/V2PageHeader";
import { useNewLook } from "@/hooks/use-new-look";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

type IntegrationStatus = "connected" | "error" | "unconfigured";

interface IntegrationInfo {
  key: string;
  status: IntegrationStatus;
  lastCheckedAt?: string;
  lastError?: string;
  meta?: Record<string, any>;
  envConfigured?: boolean;
  tokenHealth?: {
    lastAuthAt: string | null;
    tokenExpiresAt: string | null;
    tokenValid: boolean;
  };
}

interface RecruiterMetric {
  recruiterId: string;
  recruiterName: string;
  email: string;
  submissionsWeek: number;
  submissionsMonth: number;
  submissionsInPeriod: number;
  interviews: number;
  placements: number;
  placementsYTD: number;
  topChannel: string;
  channels: Record<string, number>;
  callsMade: number;
  callMinutes: number;
  smsSent: number;
  meetingsHosted: number;
  dailyBreakdown: Array<{ date: string; submissions: number; calls: number }>;
}

const CEIPAL_LINKS = [
  { label: "Developer Portal", url: "https://developer.ceipal.com" },
  { label: "API Reference", url: "https://developer.ceipal.com/docs" },
  { label: "Ceipal Support", url: "https://support.ceipal.com" },
];

const ZOOM_LINKS = [
  { label: "Zoom Marketplace", url: "https://marketplace.zoom.us" },
  { label: "Server-to-Server OAuth Guide", url: "https://developers.zoom.us/docs/internal-apps/" },
  { label: "Zoom Phone API", url: "https://developers.zoom.us/docs/zoom-phone/" },
  { label: "Zoom API Reference", url: "https://developers.zoom.us/docs/api/" },
];

const CEIPAL_SETUP_STEPS = [
  "Log in to Ceipal as an administrator.",
  "Go to Settings → API Access and locate your API Key.",
  "Note the email and password of the Ceipal admin account used for sync.",
  "Ask your platform super admin to set the CEIPAL_EMAIL, CEIPAL_PASSWORD, and CEIPAL_API_KEY environment variables in the app settings.",
  "Return here and click Test Connection to verify the credentials are working.",
];

const ZOOM_SETUP_STEPS = [
  "Sign in to your Zoom account as an admin.",
  "Go to Zoom Marketplace (marketplace.zoom.us) and click 'Develop' → 'Build App'.",
  "Select 'Server-to-Server OAuth' as the app type.",
  "Enable the required scopes: phone:read:admin, phone:read:call_log:admin, meeting:read:admin.",
  "Copy your Account ID, Client ID, and Client Secret from the app credentials page.",
  "Paste them into the fields below and click Test Connection.",
];

function StatusDot({ status }: { status: IntegrationStatus }) {
  if (status === "connected") return <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500" />;
  if (status === "error") return <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500" />;
  return <span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-400" />;
}

function StatusBadge({ status }: { status: IntegrationStatus }) {
  if (status === "connected") return <Badge className="bg-green-100 text-green-800 hover:bg-green-100"><CheckCircle className="h-3 w-3 mr-1" />Connected</Badge>;
  if (status === "error") return <Badge className="bg-red-100 text-red-800 hover:bg-red-100"><XCircle className="h-3 w-3 mr-1" />Error</Badge>;
  return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100"><AlertCircle className="h-3 w-3 mr-1" />Not Configured</Badge>;
}

function HelpfulLinks({ links }: { links: { label: string; url: string }[] }) {
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {links.map((link) => (
        <a
          key={link.url}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors border"
          data-testid={`link-${link.label.toLowerCase().replace(/\s+/g, "-")}`}
        >
          <ExternalLink className="h-3 w-3" />
          {link.label}
        </a>
      ))}
    </div>
  );
}

function SetupGuide({ steps, defaultOpen }: { steps: string[]; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mt-3" data-testid="button-setup-guide-toggle">
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          How to set this up
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ol className="mt-2 space-y-1.5 pl-4 border-l-2 border-muted">
          {steps.map((step, i) => (
            <li key={i} className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{i + 1}.</span> {step}
            </li>
          ))}
        </ol>
      </CollapsibleContent>
    </Collapsible>
  );
}

function CeipalCard({ info }: { info: IntegrationInfo | undefined }) {
  const { toast } = useToast();
  const status = info?.status ?? "unconfigured";

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/integrations/ceipal/test");
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/status"] });
      if (data.ok) {
        toast({ title: "Ceipal connection verified" });
      } else {
        toast({ title: "Ceipal test failed", description: data.error, variant: "destructive" });
      }
    },
    onError: () => toast({ title: "Test failed", variant: "destructive" }),
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/integrations/ceipal/sync");
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs"] });
      if (data.ok) {
        toast({ title: "Ceipal sync complete", description: data.message });
      } else {
        toast({ title: "Sync failed", description: data.error, variant: "destructive" });
      }
    },
    onError: () => toast({ title: "Sync failed", variant: "destructive" }),
  });

  const meta = info?.meta as Record<string, any> | undefined;

  return (
    <Card data-testid="card-ceipal-integration">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Plug className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                Ceipal ATS
                <StatusDot status={status} />
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Applicant Tracking & Job Sync</p>
            </div>
          </div>
          <StatusBadge status={status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {meta?.lastSyncAt && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-muted/40 rounded-lg text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Last Sync</p>
              <p className="font-medium">{new Date(meta.lastSyncAt).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Created</p>
              <p className="font-medium text-green-700">{meta.lastSyncCreated ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Updated</p>
              <p className="font-medium text-blue-700">{meta.lastSyncUpdated ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Deactivated</p>
              <p className="font-medium text-orange-700">{meta.lastSyncDeactivated ?? "—"}</p>
            </div>
          </div>
        )}
        {/* Ceipal token / connection health */}
        {info?.tokenHealth && (
          <div className="grid grid-cols-3 gap-3 p-3 bg-muted/20 rounded-lg border text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Last Auth</p>
              <p className="font-medium text-xs">
                {info.tokenHealth.lastAuthAt
                  ? new Date(info.tokenHealth.lastAuthAt).toLocaleString()
                  : "Never (restart server to trigger)"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Token Expiry</p>
              <p className="font-medium text-xs">
                {info.tokenHealth.tokenExpiresAt
                  ? new Date(info.tokenHealth.tokenExpiresAt).toLocaleString()
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Token Status</p>
              <p className={`text-xs font-semibold ${info.tokenHealth.tokenValid ? "text-green-600" : "text-orange-600"}`}>
                {info.tokenHealth.tokenValid ? "Valid" : "Expired / None"}
              </p>
            </div>
          </div>
        )}

        {info?.lastError && status === "error" && (
          <p className="text-xs text-red-600 bg-red-50 rounded px-3 py-2">Error: {info.lastError}</p>
        )}

        <div className="text-xs text-muted-foreground bg-muted/30 rounded px-3 py-2">
          Credentials are configured via environment variables (CEIPAL_EMAIL, CEIPAL_PASSWORD, CEIPAL_API_KEY) —
          not stored in-app for security. Status: {info?.envConfigured ? (
            <span className="text-green-700 font-medium">Env vars detected</span>
          ) : (
            <span className="text-orange-700 font-medium">Not set</span>
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={() => testMutation.mutate()}
            disabled={testMutation.isPending}
            data-testid="button-ceipal-test"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${testMutation.isPending ? "animate-spin" : ""}`} />
            {testMutation.isPending ? "Testing…" : "Test Connection"}
          </Button>
          <Button
            size="sm"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending || !info?.envConfigured}
            data-testid="button-ceipal-sync"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncMutation.isPending ? "animate-spin" : ""}`} />
            {syncMutation.isPending ? "Syncing…" : "Sync Now"}
          </Button>
        </div>

        <SetupGuide steps={CEIPAL_SETUP_STEPS} defaultOpen={status === "unconfigured"} />

        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Helpful Links</p>
          <HelpfulLinks links={CEIPAL_LINKS} />
        </div>
      </CardContent>
    </Card>
  );
}

function ZoomCard({ info }: { info: IntegrationInfo | undefined }) {
  const { toast } = useToast();
  const status = info?.status ?? "unconfigured";
  const [form, setForm] = useState({ accountId: "", clientId: "", clientSecret: "" });
  const [showForm, setShowForm] = useState(false);
  const meta = info?.meta as Record<string, any> | undefined;

  const connectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/integrations/zoom/connect", form);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/status"] });
      if (data.ok) {
        toast({ title: "Zoom connected successfully" });
        setShowForm(false);
        setForm({ accountId: "", clientId: "", clientSecret: "" });
      } else {
        toast({ title: "Zoom connection failed", description: data.error, variant: "destructive" });
      }
    },
    onError: () => toast({ title: "Connection failed", variant: "destructive" }),
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/integrations/zoom/test");
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/status"] });
      if (data.ok) {
        toast({ title: "Zoom connection verified" });
      } else {
        toast({ title: "Zoom test failed", description: data.error, variant: "destructive" });
      }
    },
    onError: () => toast({ title: "Test failed", variant: "destructive" }),
  });

  return (
    <Card data-testid="card-zoom-integration">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-sky-50 flex items-center justify-center">
              <svg className="h-5 w-5 text-sky-600" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.73 2C6.353 2 2 6.353 2 11.73s4.353 9.73 9.73 9.73c5.377 0 9.73-4.353 9.73-9.73S17.107 2 11.73 2zm4.562 12.808l-2.7-1.62v-2.376l2.7-1.62v5.616zm-1.08-7.128l-3.482 2.09-3.481-2.09V6.256l3.481 2.09 3.482-2.09v1.424z" />
              </svg>
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                Zoom
                <StatusDot status={status} />
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Phone, SMS & Meetings</p>
            </div>
          </div>
          <StatusBadge status={status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {meta?.lastTestedAt && (
          <div className="p-3 bg-muted/40 rounded-lg text-sm space-y-2">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <p className="text-xs text-muted-foreground">Last Verified</p>
                <p className="font-medium">{new Date(meta.lastTestedAt).toLocaleString()}</p>
                {meta.clientIdHint && <p className="text-xs text-muted-foreground mt-0.5">Client ID: {meta.clientIdHint}</p>}
              </div>
            </div>
            {Array.isArray(meta.grantedScopes) && meta.grantedScopes.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Granted Scopes</p>
                <div className="flex flex-wrap gap-1">
                  {(meta.grantedScopes as string[]).map((scope) => (
                    <Badge key={scope} variant="outline" className="text-xs font-mono px-1.5 py-0.5" data-testid={`badge-zoom-scope-${scope}`}>
                      {scope}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {info?.lastError && status === "error" && (
          <p className="text-xs text-red-600 bg-red-50 rounded px-3 py-2">Error: {info.lastError}</p>
        )}

        <div className="flex gap-2 flex-wrap">
          {status === "connected" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending}
              data-testid="button-zoom-test"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${testMutation.isPending ? "animate-spin" : ""}`} />
              {testMutation.isPending ? "Testing…" : "Test Connection"}
            </Button>
          )}
          <Button
            size="sm"
            variant={status === "connected" ? "outline" : "default"}
            onClick={() => setShowForm(!showForm)}
            data-testid="button-zoom-configure"
          >
            {status === "connected" ? "Reconfigure" : "Configure"}
          </Button>
        </div>

        {showForm && (
          <div className="space-y-3 p-4 border rounded-lg bg-muted/20">
            <p className="text-sm font-medium">Zoom Server-to-Server OAuth Credentials</p>
            <div className="space-y-2">
              <div>
                <Label className="text-xs">Account ID</Label>
                <Input
                  data-testid="input-zoom-account-id"
                  className="mt-1"
                  placeholder="your-account-id"
                  value={form.accountId}
                  onChange={e => setForm(f => ({ ...f, accountId: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">Client ID</Label>
                <Input
                  data-testid="input-zoom-client-id"
                  className="mt-1"
                  placeholder="your-client-id"
                  value={form.clientId}
                  onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">Client Secret</Label>
                <Input
                  data-testid="input-zoom-client-secret"
                  className="mt-1"
                  type="password"
                  placeholder="your-client-secret"
                  value={form.clientSecret}
                  onChange={e => setForm(f => ({ ...f, clientSecret: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => connectMutation.mutate()}
                disabled={connectMutation.isPending || !form.accountId || !form.clientId || !form.clientSecret}
                data-testid="button-zoom-save"
              >
                {connectMutation.isPending ? "Saving & Testing…" : "Save & Test Connection"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </div>
        )}

        <SetupGuide steps={ZOOM_SETUP_STEPS} defaultOpen={status === "unconfigured"} />

        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Helpful Links</p>
          <HelpfulLinks links={ZOOM_LINKS} />
        </div>
      </CardContent>
    </Card>
  );
}

function RecruiterDrawer({
  recruiter,
  onClose,
}: {
  recruiter: RecruiterMetric;
  onClose: () => void;
}) {
  return (
    <Sheet open onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            {recruiter.recruiterName}
          </SheetTitle>
          <p className="text-sm text-muted-foreground">{recruiter.email}</p>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Activity Summary</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Submissions (Week)", value: recruiter.submissionsWeek },
                { label: "Submissions (Month)", value: recruiter.submissionsMonth },
                { label: "Interviews", value: recruiter.interviews },
                { label: "Placements YTD", value: recruiter.placementsYTD ?? recruiter.placements },
                { label: "Calls Made", value: recruiter.callsMade },
                { label: "Call Minutes", value: recruiter.callMinutes },
                { label: "SMS Sent", value: recruiter.smsSent },
                { label: "Meetings", value: recruiter.meetingsHosted },
              ].map(({ label, value }) => (
                <div key={label} className="p-3 bg-muted/40 rounded-lg">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-xl font-bold">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {Object.keys(recruiter.channels).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Sourcing Channels</p>
              <div className="space-y-2">
                {Object.entries(recruiter.channels)
                  .sort(([, a], [, b]) => b - a)
                  .map(([channel, count]) => (
                    <div key={channel} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{channel}</span>
                      <Badge variant="outline">{count}</Badge>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {recruiter.dailyBreakdown.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Day-by-Day Activity</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Submissions</TableHead>
                    <TableHead className="text-right">Calls</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recruiter.dailyBreakdown.map((day) => (
                    <TableRow key={day.date}>
                      <TableCell className="text-sm">{day.date}</TableCell>
                      <TableCell className="text-right">{day.submissions}</TableCell>
                      <TableCell className="text-right">{day.calls}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function RecruiterPerformanceTab() {
  const [period, setPeriod] = useState<"week" | "month" | "custom">("week");
  const [customFrom, setCustomFrom] = useState<string>(() => {
    const d = new Date(); d.setDate(d.getDate() - 14);
    return d.toISOString().split("T")[0];
  });
  const [customTo, setCustomTo] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [sortField, setSortField] = useState<string>("submissionsWeek");
  const [selectedRecruiter, setSelectedRecruiter] = useState<RecruiterMetric | null>(null);

  const queryParams = period === "custom"
    ? `period=custom&from=${customFrom}&to=${customTo}`
    : `period=${period}`;

  const { data, isLoading } = useQuery<{ metrics: RecruiterMetric[]; zoomAvailable: boolean; ceipalAvailable: boolean }>({
    queryKey: ["/api/integrations/recruiter-metrics", period, period === "custom" ? `${customFrom}:${customTo}` : ""],
    queryFn: async () => {
      const res = await fetch(`/api/integrations/recruiter-metrics?${queryParams}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch metrics");
      return res.json();
    },
  });

  const metrics = data?.metrics ?? [];
  const zoomAvailable = data?.zoomAvailable ?? false;
  const ceipalAvailable = data?.ceipalAvailable ?? false;

  const sorted = [...metrics].sort((a, b) => {
    const av = (a as any)[sortField] ?? 0;
    const bv = (b as any)[sortField] ?? 0;
    return bv - av;
  });

  const interviewRate = (m: RecruiterMetric) => {
    const subs = period === "week" ? m.submissionsWeek : m.submissionsMonth;
    if (!subs) return 0;
    return Math.round((m.interviews / subs) * 100);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm text-muted-foreground">
            Recruiter activity from Ceipal{zoomAvailable ? " + Zoom" : ""}
          </p>
          {!ceipalAvailable && (
            <p className="text-xs text-orange-600 mt-0.5">
              Ceipal not configured — connect it in the Connections tab to see recruiter data.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant={period === "week" ? "default" : "outline"}
            onClick={() => setPeriod("week")}
            data-testid="button-period-week"
          >
            This Week
          </Button>
          <Button
            size="sm"
            variant={period === "month" ? "default" : "outline"}
            onClick={() => setPeriod("month")}
            data-testid="button-period-month"
          >
            30 Days
          </Button>
          <Button
            size="sm"
            variant={period === "custom" ? "default" : "outline"}
            onClick={() => setPeriod("custom")}
            data-testid="button-period-custom"
          >
            Custom
          </Button>
          {period === "custom" && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <Input
                type="date"
                className="h-8 w-36 text-xs"
                value={customFrom}
                max={customTo}
                onChange={e => setCustomFrom(e.target.value)}
                data-testid="input-custom-from"
              />
              <span className="text-xs text-muted-foreground">–</span>
              <Input
                type="date"
                className="h-8 w-36 text-xs"
                value={customTo}
                min={customFrom}
                max={new Date().toISOString().split("T")[0]}
                onChange={e => setCustomTo(e.target.value)}
                data-testid="input-custom-to"
              />
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-16">
          <BarChart2 className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground text-sm font-medium">No recruiter data available</p>
          <p className="text-muted-foreground text-xs mt-1">
            {!ceipalAvailable
              ? "Configure Ceipal in the Connections tab first."
              : "No submissions found for the selected period."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Recruiter</TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/40 select-none"
                  onClick={() => setSortField(period === "week" ? "submissionsWeek" : "submissionsMonth")}
                  data-testid="th-submissions"
                >
                  Submissions {period === "week" ? "(Week)" : "(30d)"}
                </TableHead>
                <TableHead>Interview %</TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/40 select-none"
                  onClick={() => setSortField("placementsYTD")}
                  data-testid="th-placements"
                >
                  Placements YTD
                </TableHead>
                <TableHead>Top Channel</TableHead>
                {zoomAvailable && <>
                  <TableHead className="cursor-pointer hover:bg-muted/40 select-none" onClick={() => setSortField("callsMade")}>Calls</TableHead>
                  <TableHead>Call Mins</TableHead>
                  <TableHead>SMS</TableHead>
                  <TableHead>Meetings</TableHead>
                </>}
                <TableHead className="text-right">Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((m) => (
                <TableRow
                  key={m.recruiterId}
                  data-testid={`row-recruiter-${m.recruiterId}`}
                  className="cursor-pointer hover:bg-muted/30"
                  onClick={() => setSelectedRecruiter(m)}
                >
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{m.recruiterName}</p>
                      <p className="text-xs text-muted-foreground">{m.email}</p>
                    </div>
                  </TableCell>
                  <TableCell className="font-semibold">
                    {period === "week" ? m.submissionsWeek : m.submissionsMonth}
                  </TableCell>
                  <TableCell>
                    {interviewRate(m) > 0 ? (
                      <Badge variant="outline" className="text-xs">{interviewRate(m)}%</Badge>
                    ) : "—"}
                  </TableCell>
                  <TableCell>{m.placementsYTD ?? m.placements ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{m.topChannel || "—"}</TableCell>
                  {zoomAvailable && <>
                    <TableCell>{m.callsMade || "—"}</TableCell>
                    <TableCell>{m.callMinutes || "—"}</TableCell>
                    <TableCell>{m.smsSent || "—"}</TableCell>
                    <TableCell>{m.meetingsHosted || "—"}</TableCell>
                  </>}
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" data-testid={`button-view-recruiter-${m.recruiterId}`}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {selectedRecruiter && (
        <RecruiterDrawer recruiter={selectedRecruiter} onClose={() => setSelectedRecruiter(null)} />
      )}
    </div>
  );
}

export default function Integrations() {
  const { enabled: newLook } = useNewLook();
  const { data, isLoading } = useQuery<{ integrations: IntegrationInfo[] }>({
    queryKey: ["/api/integrations/status"],
  });

  const integrations = data?.integrations ?? [];
  const ceipalInfo = integrations.find(i => i.key === "ceipal");
  const zoomInfo = integrations.find(i => i.key === "zoom");

  return (
    <AdminLayout>
      <div className="space-y-6 v2-surface">
        {newLook ? (
          <V2PageHeader
            icon={Plug}
            eyebrow="Admin"
            title="Integrations Hub"
            subtitle="Manage external connections — Ceipal ATS and Zoom — and view recruiter performance."
          />
        ) : (
        <div>
          <h1 className="text-2xl font-bold">Integrations Hub</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage external connections — Ceipal ATS and Zoom — and view recruiter performance.
          </p>
        </div>
        )}

        <Tabs defaultValue="connections">
          <TabsList>
            <TabsTrigger value="connections" data-testid="tab-connections">Connections</TabsTrigger>
            <TabsTrigger value="performance" data-testid="tab-performance">Recruiter Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="connections" className="mt-6">
            {isLoading ? (
              <div className="grid md:grid-cols-2 gap-6">
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-64 w-full" />
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                <CeipalCard info={ceipalInfo} />
                <ZoomCard info={zoomInfo} />
              </div>
            )}
          </TabsContent>

          <TabsContent value="performance" className="mt-6">
            <RecruiterPerformanceTab />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
