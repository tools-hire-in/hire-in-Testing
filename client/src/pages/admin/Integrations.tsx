import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  CheckCircle, XCircle, AlertCircle, RefreshCw, ExternalLink,
  ChevronDown, ChevronRight, Plug, Users, BarChart2, Eye,
  Check, Circle, AlertTriangle, Wifi, WifiOff,
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

type IntegrationStatus = "connected" | "error" | "unconfigured";

interface CeipalLastError {
  status: number;
  message: string;
  at: string;
}

interface IntegrationInfo {
  key: string;
  status: IntegrationStatus;
  lastCheckedAt?: string;
  lastError?: string;
  meta?: Record<string, any>;
  envConfigured?: boolean;
  ceipalLastError?: CeipalLastError | null;
  /** Number of Ceipal recruiter emails that don't match any admin_users email. null = never checked. */
  recruiterUnmatchedCount?: number | null;
  /** Whether the Ceipal v2 API endpoint is accessible. null = never checked. */
  v2AccessVerified?: boolean | null;
  tokenHealth?: {
    lastAuthAt: string | null;
    tokenExpiresAt: string | null;
    tokenValid: boolean;
  };
  unmatchedCeipalUsers?: string[];
}

interface CeipalInterviewDetail {
  interviewId: string;
  submissionId?: string;
  interviewMode?: string;
  interviewOutcome?: string;
  interviewDate?: string;
  scheduledDate?: string;
  recruiterEmail?: string;
  recruiterId?: string;
  [key: string]: any;
}

interface CeipalPlacementDetail {
  placementId: string;
  jobSeekerId?: string;
  clientBillRate?: string;
  payRateMode?: string;
  placementStatus?: string;
  startDate?: string;
  recruiterEmail?: string;
  recruiterId?: string;
  [key: string]: any;
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
  ceipalUserId?: string;
  teamName?: string;
  businessUnitId?: string;
  ceipalRole?: string;
  reportingTo?: string;
  latestInterview?: CeipalInterviewDetail;
  latestPlacement?: CeipalPlacementDetail;
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

const CEIPAL_TROUBLESHOOTING = [
  {
    title: "Token Expired",
    fix: "Click Test Connection to refresh the authentication token. Tokens expire after a set period.",
  },
  {
    title: "Email mismatch",
    fix: "Ensure the Ceipal recruiter email exactly matches the HR portal email (case-insensitive). Any difference will prevent submissions from being attributed correctly.",
  },
  {
    title: "API 404 on submissions",
    fix: "Your Ceipal plan may not include API access. Contact Ceipal support to confirm API access is enabled for your account.",
  },
  {
    title: "Jobs not syncing",
    fix: "Check the business unit filter in Ceipal's API settings. Jobs outside the configured business unit will not be imported.",
  },
  {
    title: "v2 endpoints returning 401",
    fix: "The v2 API requires an upgraded Ceipal plan. Contact your Ceipal account manager to enable v2 API access.",
  },
];

const ZOOM_TROUBLESHOOTING = [
  {
    title: "Invalid credentials",
    fix: "Verify your Account ID, Client ID, and Client Secret match exactly what is shown in the Server-to-Server OAuth app on Zoom Marketplace.",
  },
  {
    title: "Missing scopes",
    fix: "Your Zoom app must have these scopes enabled: phone:read:admin, phone:read:call_log:admin, meeting:read:admin. Check the scopes tab in your app on Zoom Marketplace.",
  },
  {
    title: "Test returns 401",
    fix: "Regenerate your Client Secret in Zoom Marketplace (your app → Credentials tab → Client Secret → Regenerate), then re-enter the new secret here.",
  },
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

interface ChecklistStep {
  label: string;
  detail?: string;
  detected: boolean | "unknown";
}

function SetupChecklist({ steps, defaultOpen }: { steps: ChecklistStep[]; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const doneCount = steps.filter(s => s.detected === true).length;
  const total = steps.length;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mt-3 w-full"
          data-testid="button-setup-checklist-toggle"
        >
          {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
          <span>Admin Setup Checklist</span>
          <span className="ml-auto text-xs tabular-nums">
            {doneCount}/{total} done
          </span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ol className="mt-3 space-y-2.5">
          {steps.map((step, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="mt-0.5 shrink-0">
                {step.detected === true ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : step.detected === "unknown" ? (
                  <Circle className="h-4 w-4 text-muted-foreground/50" />
                ) : (
                  <Circle className="h-4 w-4 text-orange-400" />
                )}
              </span>
              <div>
                <p className={`text-sm leading-snug ${step.detected === true ? "text-muted-foreground line-through decoration-green-600/50" : "text-foreground"}`}>
                  <span className="font-medium not-italic no-underline" style={{ textDecoration: "none" }}>
                    Step {i + 1}:
                  </span>{" "}
                  <span style={{ textDecoration: step.detected === true ? "line-through" : "none" }}>{step.label}</span>
                </p>
                {step.detail && (
                  <p className="text-xs text-muted-foreground mt-0.5">{step.detail}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </CollapsibleContent>
    </Collapsible>
  );
}

function TroubleshootingSection({ items }: { items: { title: string; fix: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mt-1"
          data-testid="button-troubleshooting-toggle"
        >
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          Common Issues
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 space-y-2.5 border rounded-lg p-3 bg-muted/20">
          {items.map((item, i) => (
            <div key={i}>
              <p className="text-sm font-medium flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                {item.title}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 pl-5">{item.fix}</p>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function CeipalCard({ info }: { info: IntegrationInfo | undefined }) {
  const { toast } = useToast();
  const status = info?.status ?? "unconfigured";
  const meta = info?.meta as Record<string, any> | undefined;
  const tokenValid = info?.tokenHealth?.tokenValid ?? false;
  const lastSyncCreated = meta?.lastSyncCreated ?? 0;

  const recruiterUnmatchedCount = info?.recruiterUnmatchedCount;
  const v2AccessVerified = info?.v2AccessVerified;

  // Step 5: null = never synced (unknown); 0 = all matched (done); >0 = mismatches (not done)
  const step5Detected: boolean | "unknown" =
    recruiterUnmatchedCount === null || recruiterUnmatchedCount === undefined
      ? "unknown"
      : recruiterUnmatchedCount === 0;

  // Step 6: null = never probed (unknown); true = verified; false = not accessible
  const step6Detected: boolean | "unknown" =
    v2AccessVerified === null || v2AccessVerified === undefined
      ? "unknown"
      : v2AccessVerified === true;

  const checklistSteps: ChecklistStep[] = [
    {
      label: "Log in to Ceipal as an administrator → go to Settings → API Access → copy your API Key.",
      detected: info?.envConfigured ? true : false,
    },
    {
      label: "Set CEIPAL_EMAIL, CEIPAL_PASSWORD, and CEIPAL_API_KEY in the Replit Secrets panel.",
      detail: "Ask your platform super admin if you do not have access to Secrets.",
      detected: info?.envConfigured ? true : false,
    },
    {
      label: "Click Test Connection below — the status badge should turn green.",
      detected: tokenValid,
    },
    {
      label: "Click Sync Now — jobs should be imported from Ceipal.",
      detail: lastSyncCreated > 0 ? `${lastSyncCreated} jobs created in last sync.` : "No jobs created yet in any sync.",
      detected: lastSyncCreated > 0,
    },
    {
      label: "Verify recruiter emails in Ceipal match the HR portal emails exactly.",
      detail:
        recruiterUnmatchedCount === null || recruiterUnmatchedCount === undefined
          ? "Run Sync Now to check — unmatched emails mean submissions won't be attributed correctly."
          : recruiterUnmatchedCount === 0
          ? "All recruiter emails match HR portal users."
          : `${recruiterUnmatchedCount} Ceipal recruiter email(s) don't match any HR portal user — check for typos or missing accounts.`,
      detected: step5Detected,
    },
    {
      label: "Ask your Ceipal account manager to enable v2 API access for advanced features.",
      detail:
        v2AccessVerified === null || v2AccessVerified === undefined
          ? "Click Test Connection to probe v2 access. Required for enhanced submission reporting."
          : v2AccessVerified
          ? "v2 API access confirmed."
          : "v2 API returned 401 — contact your Ceipal account manager to upgrade your plan.",
      detected: step6Detected,
    },
  ];

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

  const ceipalLastError = info?.ceipalLastError;

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

        {/* Unmatched Ceipal users warning */}
        {info?.unmatchedCeipalUsers && info.unmatchedCeipalUsers.length > 0 && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg" data-testid="banner-ceipal-unmatched">
            <p className="text-xs font-semibold text-yellow-800 mb-1">
              {info.unmatchedCeipalUsers.length} Ceipal {info.unmatchedCeipalUsers.length === 1 ? "user has" : "users have"} no matching local account — check email alignment
            </p>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {info.unmatchedCeipalUsers.map((email) => (
                <span key={email} className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded font-mono" data-testid={`badge-unmatched-${email}`}>
                  {email}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Last API error detail */}
        {ceipalLastError && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2" data-testid="ceipal-last-error">
            <XCircle className="h-3.5 w-3.5 text-red-600 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-red-700">
                Last API Error
                {ceipalLastError.status > 0 && (
                  <span className="ml-1.5 font-mono text-red-600">HTTP {ceipalLastError.status}</span>
                )}
              </p>
              <p className="text-xs text-red-700 mt-0.5 break-words">{ceipalLastError.message}</p>
              <p className="text-[10px] text-red-500 mt-0.5">{new Date(ceipalLastError.at).toLocaleString()}</p>
            </div>
          </div>
        )}

        {info?.lastError && !ceipalLastError && status === "error" && (
          <p className="text-xs text-red-600 bg-red-50 rounded px-3 py-2">Error: {info.lastError}</p>
        )}

        <div className="text-xs text-muted-foreground bg-muted/30 rounded px-3 py-2">
          Credentials are configured via environment variables (CEIPAL_EMAIL, CEIPAL_PASSWORD, CEIPAL_API_KEY) —
          not stored in-app for security. Status:{" "}
          {info?.envConfigured ? (
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

        <SetupChecklist steps={checklistSteps} defaultOpen={status === "unconfigured"} />

        <TroubleshootingSection items={CEIPAL_TROUBLESHOOTING} />

        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Helpful Links</p>
          <HelpfulLinks links={CEIPAL_LINKS} />
        </div>
      </CardContent>
    </Card>
  );
}

function ZoomCard({
  info,
  onConfigureClick,
  configureRef,
}: {
  info: IntegrationInfo | undefined;
  onConfigureClick?: () => void;
  configureRef?: React.RefObject<HTMLDivElement>;
}) {
  const { toast } = useToast();
  const status = info?.status ?? "unconfigured";
  const [form, setForm] = useState({ accountId: "", clientId: "", clientSecret: "" });
  const [showForm, setShowForm] = useState(false);
  const [testErrorDetail, setTestErrorDetail] = useState<{
    statusCode?: number;
    errorCode?: number | string;
    message?: string;
  } | null>(null);
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
        setTestErrorDetail(null);
        setForm({ accountId: "", clientId: "", clientSecret: "" });
      } else {
        setTestErrorDetail({
          statusCode: data.statusCode,
          errorCode: data.errorCode,
          message: data.message,
        });
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
        setTestErrorDetail(null);
        toast({ title: "Zoom connection verified" });
      } else {
        setTestErrorDetail({
          statusCode: data.statusCode,
          errorCode: data.errorCode,
          message: data.message,
        });
        toast({ title: "Zoom test failed", description: data.error, variant: "destructive" });
      }
    },
    onError: () => toast({ title: "Test failed", variant: "destructive" }),
  });

  return (
    <Card data-testid="card-zoom-integration" ref={configureRef}>
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

        {/* Zoom test / connect error detail */}
        {testErrorDetail && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2" data-testid="zoom-test-error-detail">
            <XCircle className="h-3.5 w-3.5 text-red-600 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-red-700">
                Connection Error
                {testErrorDetail.statusCode && (
                  <span className="ml-1.5 font-mono text-red-600">HTTP {testErrorDetail.statusCode}</span>
                )}
                {testErrorDetail.errorCode != null && (
                  <span className="ml-1.5 font-mono text-red-500">code {testErrorDetail.errorCode}</span>
                )}
              </p>
              {testErrorDetail.message && (
                <p className="text-xs text-red-700 mt-0.5 break-words">{testErrorDetail.message}</p>
              )}
            </div>
          </div>
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
              <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); setTestErrorDetail(null); }}>Cancel</Button>
            </div>
          </div>
        )}

        <SetupChecklist
          steps={[
            { label: "Sign in to Zoom as an admin and go to Zoom Marketplace (marketplace.zoom.us).", detected: status === "connected" },
            { label: "Click Develop → Build App → choose Server-to-Server OAuth.", detected: status === "connected" },
            { label: "Enable required scopes: phone:read:admin, phone:read:call_log:admin, meeting:read:admin.", detected: status === "connected" },
            { label: "Copy your Account ID, Client ID, and Client Secret from the app credentials page.", detected: status === "connected" },
            { label: "Enter credentials below and click Save & Test Connection.", detected: status === "connected" },
          ]}
          defaultOpen={status === "unconfigured"}
        />

        <TroubleshootingSection items={ZOOM_TROUBLESHOOTING} />

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

          {recruiter.latestInterview && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Latest Interview</p>
              <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
                {recruiter.latestInterview.interviewDate && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Date</span>
                    <span className="font-medium" data-testid="text-interview-date">{recruiter.latestInterview.interviewDate}</span>
                  </div>
                )}
                {recruiter.latestInterview.interviewMode && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Mode</span>
                    <span className="font-medium capitalize" data-testid="text-interview-mode">{recruiter.latestInterview.interviewMode}</span>
                  </div>
                )}
                {recruiter.latestInterview.interviewOutcome && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Outcome</span>
                    <span className="font-medium capitalize" data-testid="text-interview-outcome">{recruiter.latestInterview.interviewOutcome}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {recruiter.latestPlacement && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Latest Placement</p>
              <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
                {recruiter.latestPlacement.startDate && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Start Date</span>
                    <span className="font-medium" data-testid="text-placement-start-date">{recruiter.latestPlacement.startDate}</span>
                  </div>
                )}
                {recruiter.latestPlacement.clientBillRate && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Client Bill Rate</span>
                    <span className="font-medium" data-testid="text-placement-bill-rate">{recruiter.latestPlacement.clientBillRate}</span>
                  </div>
                )}
                {recruiter.latestPlacement.payRateMode && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Pay Rate Mode</span>
                    <span className="font-medium capitalize" data-testid="text-placement-pay-rate-mode">{recruiter.latestPlacement.payRateMode}</span>
                  </div>
                )}
                {recruiter.latestPlacement.placementStatus && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant="outline" className="text-xs capitalize" data-testid="text-placement-status">{recruiter.latestPlacement.placementStatus}</Badge>
                  </div>
                )}
              </div>
            </div>
          )}

          {(recruiter.teamName || recruiter.businessUnitId || recruiter.ceipalRole || recruiter.reportingTo) && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Ceipal Profile</p>
              <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
                {recruiter.teamName && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Team</span>
                    <span className="font-medium" data-testid="text-ceipal-team">{recruiter.teamName}</span>
                  </div>
                )}
                {recruiter.businessUnitId && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Business Unit</span>
                    <span className="font-medium" data-testid="text-ceipal-bu">{recruiter.businessUnitId}</span>
                  </div>
                )}
                {recruiter.ceipalRole && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Role in Ceipal</span>
                    <span className="font-medium" data-testid="text-ceipal-role">{recruiter.ceipalRole}</span>
                  </div>
                )}
                {recruiter.reportingTo && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Reporting To</span>
                    <span className="font-medium" data-testid="text-ceipal-reporting">{recruiter.reportingTo}</span>
                  </div>
                )}
                {recruiter.ceipalUserId && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Ceipal ID</span>
                    <span className="text-xs font-mono text-muted-foreground" data-testid="text-ceipal-id">{recruiter.ceipalUserId}</span>
                  </div>
                )}
              </div>
            </div>
          )}

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

function RecruiterPerformanceTab({
  zoomStatus,
  onConfigureZoom,
}: {
  zoomStatus: IntegrationStatus;
  onConfigureZoom: () => void;
}) {
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
      {/* Zoom not connected banner — shown only when Zoom is not connected */}
      {zoomStatus !== "connected" && (
        <Alert className="border-orange-200 bg-orange-50" data-testid="alert-zoom-not-connected">
          <WifiOff className="h-4 w-4 text-orange-600" />
          <AlertDescription className="flex items-center justify-between gap-3 flex-wrap">
            <span className="text-orange-800 text-sm">
              <strong>Zoom not connected</strong> — call and meeting data is unavailable.
            </span>
            <Button
              size="sm"
              variant="outline"
              className="border-orange-300 text-orange-700 hover:bg-orange-100 shrink-0"
              onClick={onConfigureZoom}
              data-testid="button-configure-zoom-from-metrics"
            >
              <Wifi className="h-3.5 w-3.5 mr-1.5" />
              Configure Zoom →
            </Button>
          </AlertDescription>
        </Alert>
      )}

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
  const [activeTab, setActiveTab] = useState("connections");
  const { data, isLoading } = useQuery<{ integrations: IntegrationInfo[] }>({
    queryKey: ["/api/integrations/status"],
  });

  const integrations = data?.integrations ?? [];
  const ceipalInfo = integrations.find(i => i.key === "ceipal");
  const zoomInfo = integrations.find(i => i.key === "zoom");
  const zoomStatus = zoomInfo?.status ?? "unconfigured";

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

        <Tabs value={activeTab} onValueChange={setActiveTab}>
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
                <ZoomCard
                  info={zoomInfo}
                  onConfigureClick={() => setActiveTab("connections")}
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="performance" className="mt-6">
            <RecruiterPerformanceTab
              zoomStatus={zoomStatus}
              onConfigureZoom={() => setActiveTab("connections")}
            />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
