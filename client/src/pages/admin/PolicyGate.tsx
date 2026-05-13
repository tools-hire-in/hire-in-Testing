import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Shield, CheckCircle, Clock, FileText, ArrowRight, Loader2, AlertTriangle, Moon, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { COMPANY } from "@/lib/constants";
import ReactMarkdown from "react-markdown";

interface PolicySection {
  id: string;
  title: string;
  body: string;
  orderIndex: number;
  minDwellSeconds: number;
  estimatedMinutes: number;
}

interface PendingPolicy {
  trackId: string;
  title: string;
  description: string | null;
  versionNumber: number;
  assignmentId: string;
  status: string;
  sections: PolicySection[];
}

interface PolicyGateStatus {
  hasPendingPolicies: boolean;
  policies: PendingPolicy[];
  nightShiftPending: boolean;
  nightShiftConsent: { status: "expired" | "not_signed"; expiresAt: string | null } | null;
}

export default function PolicyGate() {
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();

  const [currentPolicyIndex, setCurrentPolicyIndex] = useState(0);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [typedName, setTypedName] = useState("");
  const [dwellElapsed, setDwellElapsed] = useState(0);
  const [signedSections, setSignedSections] = useState<Set<string>>(new Set());
  const [showNightShiftStep, setShowNightShiftStep] = useState(false);
  const [nsTypedName, setNsTypedName] = useState("");
  const dwellInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Exception request state (for overdue training visible while in policy gate)
  const [exceptionAssignmentId, setExceptionAssignmentId] = useState<string | null>(null);
  const [exceptionReason, setExceptionReason] = useState("");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/admin/login");
  }, [authLoading, isAuthenticated, setLocation]);

  const { data: complianceStatus } = useQuery<{
    locked: boolean; overdueCount: number; trackTitles: string[];
    overdueAssignments?: { id: string; trackTitle: string; dueDate: string | null }[];
    pendingExtensions: any[];
  }>({
    queryKey: ["/api/onboarding/compliance-status"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/onboarding/compliance-status", { credentials: "include" });
        if (!res.ok) return { locked: false, overdueCount: 0, trackTitles: [], overdueAssignments: [], pendingExtensions: [] };
        return res.json();
      } catch { return { locked: false, overdueCount: 0, trackTitles: [], overdueAssignments: [], pendingExtensions: [] }; }
    },
    enabled: isAuthenticated,
  });

  const submitExceptionMutation = useMutation({
    mutationFn: async ({ assignmentId, reason }: { assignmentId: string; reason: string }) => {
      const res = await fetch("/api/onboarding/extension-requests", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId, reason, newDueDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), requestType: "exception" }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/compliance-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/extension-requests/my"] });
      toast({ title: "Exception request submitted", description: "Your manager/HR will be notified to review it." });
      setExceptionAssignmentId(null);
      setExceptionReason("");
    },
    onError: (err: any) => toast({ title: err.message || "Failed to submit exception request", variant: "destructive" }),
  });

  const { data: status, isLoading } = useQuery<PolicyGateStatus>({
    queryKey: ["/api/onboarding/policy-gate-status"],
    queryFn: async () => {
      const res = await fetch("/api/onboarding/policy-gate-status", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch policy gate status");
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const allPoliciesSigned = !status?.policies?.length || currentPolicyIndex >= (status?.policies?.length ?? 0);

  // When all policies are done and night shift is pending, show night shift step
  useEffect(() => {
    if (allPoliciesSigned && status?.nightShiftPending && !showNightShiftStep) {
      setShowNightShiftStep(true);
    }
  }, [allPoliciesSigned, status?.nightShiftPending]);

  const policy = status?.policies?.[currentPolicyIndex];
  const section = policy?.sections?.[currentSectionIndex];
  const totalPolicies = status?.policies?.length ?? 0;
  const totalSections = policy?.sections?.length ?? 0;
  const minDwell = section?.minDwellSeconds ?? 30;
  const dwellMet = dwellElapsed >= minDwell;

  const sectionKey = section ? `${policy?.assignmentId}-${section.id}` : null;
  const alreadySigned = sectionKey ? signedSections.has(sectionKey) : false;

  // Reset dwell when section changes
  useEffect(() => {
    setDwellElapsed(0);
    setTypedName("");
    if (dwellInterval.current) clearInterval(dwellInterval.current);
    dwellInterval.current = setInterval(() => {
      setDwellElapsed(prev => prev + 1);
    }, 1000);
    return () => {
      if (dwellInterval.current) clearInterval(dwellInterval.current);
    };
  }, [currentSectionIndex, currentPolicyIndex]);

  const signSectionMutation = useMutation({
    mutationFn: async ({ assignmentId, sectionId, typedName, dwellSeconds }: { assignmentId: string; sectionId: string; typedName: string; dwellSeconds: number }) => {
      return apiRequest("POST", "/api/onboarding/policy-gate/sign-section", { assignmentId, sectionId, typedName, dwellSeconds });
    },
    onError: (error: any) => {
      const msg = error?.message || "Failed to sign section";
      toast({ title: "Failed to sign section", description: msg.includes("Typed name") ? msg : msg, variant: "destructive" });
    },
  });

  const completeTrackMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      return apiRequest("POST", "/api/onboarding/policy-gate/complete-track", { assignmentId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/policy-gate-status"] });
    },
    onError: (error: any) => {
      toast({ title: "Failed to complete policy", description: error?.message, variant: "destructive" });
    },
  });

  const nightShiftSignMutation = useMutation({
    mutationFn: async ({ typedName }: { typedName: string }) => {
      return apiRequest("POST", "/api/onboarding/night-shift-consent/sign", { typedName });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/policy-gate-status"] });
      toast({ title: "Night Shift Consent signed", description: "Your consent has been recorded. You now have full access to the portal." });
      setLocation("/admin/hr");
    },
    onError: (error: any) => {
      toast({ title: "Failed to sign Night Shift Consent", description: error?.message, variant: "destructive" });
    },
  });

  const handleSignSection = async () => {
    if (!policy || !section) return;
    const fullName = `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim();
    if (typedName.trim().toLowerCase() !== fullName.toLowerCase()) {
      toast({
        title: "Name doesn't match",
        description: `Please type your full name exactly as: ${fullName}`,
        variant: "destructive",
      });
      return;
    }

    await signSectionMutation.mutateAsync({
      assignmentId: policy.assignmentId,
      sectionId: section.id,
      typedName: typedName.trim(),
      dwellSeconds: dwellElapsed,
    });

    const newSigned = new Set(signedSections);
    newSigned.add(`${policy.assignmentId}-${section.id}`);
    setSignedSections(newSigned);

    const isLastSection = currentSectionIndex >= totalSections - 1;
    if (isLastSection) {
      await completeTrackMutation.mutateAsync(policy.assignmentId);

      const isLastPolicy = currentPolicyIndex >= totalPolicies - 1;
      if (isLastPolicy) {
        if (status?.nightShiftPending) {
          setShowNightShiftStep(true);
        } else {
          toast({ title: "All policies signed!", description: "You now have full access to the portal." });
          setLocation("/admin/hr");
        }
      } else {
        setCurrentPolicyIndex(prev => prev + 1);
        setCurrentSectionIndex(0);
        setSignedSections(new Set());
      }
    } else {
      setCurrentSectionIndex(prev => prev + 1);
    }
  };

  const handleNightShiftSign = async () => {
    const fullName = `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim();
    if (nsTypedName.trim().toLowerCase() !== fullName.toLowerCase()) {
      toast({
        title: "Name doesn't match",
        description: `Please type your full name exactly as: ${fullName}`,
        variant: "destructive",
      });
      return;
    }
    await nightShiftSignMutation.mutateAsync({ typedName: nsTypedName.trim() });
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!status?.hasPendingPolicies) {
    setLocation("/admin/hr");
    return null;
  }

  // Night Shift Consent step — shown after all policies are signed for Female employees
  if (showNightShiftStep && status?.nightShiftPending) {
    const fullName = `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim();
    return (
      <div className="min-h-screen bg-background flex flex-col" data-testid="page-night-shift-consent">
        <div className="border-b bg-card px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Moon className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-lg font-bold text-foreground">Night Shift Consent</h1>
              <p className="text-xs text-muted-foreground">Required for female employees before accessing the portal</p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs">Mandatory</Badge>
        </div>

        <div className="flex-1 max-w-3xl mx-auto w-full p-6">
          {status.nightShiftConsent?.status === "expired" && (
            <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Your previous Night Shift Consent has expired. Please re-sign to continue.</span>
            </div>
          )}

          <div className="bg-card border rounded-lg overflow-hidden">
            <div className="px-6 py-6 prose prose-sm dark:prose-invert max-w-none" data-testid="night-shift-consent-body">
              <h2>Night Shift Work Consent — {COMPANY.legalName}</h2>
              <p>
                In accordance with applicable labour laws (including the Factories Act, 1948, the Shops and Establishments Act, and relevant state amendments) and {COMPANY.legalName} policy, female employees are required to provide explicit written consent before being assigned to night shift hours, defined as any hours between <strong>9:00 PM and 7:00 AM IST</strong>.
              </p>
              <p>By signing below, I <strong>{fullName}</strong> hereby declare that:</p>
              <ul>
                <li>I <strong>voluntarily consent</strong> to being assigned night shift work hours as required by my role and business needs.</li>
                <li>I have been informed of my statutory rights and protections applicable to female employees working night hours under applicable law.</li>
                <li>I understand that the company will provide adequate safety measures, transport, and facilities as required by law for night shift female employees.</li>
                <li>I will receive reasonable advance notice of night shift assignments wherever operationally feasible.</li>
                <li>I understand I may <strong>withdraw this consent at any time</strong> by submitting a written request to HR. Withdrawal will take effect at the next scheduling cycle without adverse employment consequence.</li>
              </ul>
              <p>
                This consent is valid for <strong>12 months</strong> from the date of signing and must be renewed annually. Failure to renew before expiry will result in suspension of night shift assignments until renewed consent is obtained.
              </p>
              <p className="text-xs text-muted-foreground">
                This consent record is securely maintained in accordance with {COMPANY.legalName}'s HR Compliance Policy. The record is accessible only to authorised HR personnel and is not shared with line managers or third parties without your knowledge.
              </p>
            </div>

            <div className="border-t px-6 py-5 bg-muted/10">
              <div className="space-y-3">
                <div>
                  <Label htmlFor="ns-typed-name" className="text-sm font-medium">
                    Type your full name to sign this consent
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Type exactly: <strong>{fullName}</strong>
                  </p>
                </div>
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <Input
                      id="ns-typed-name"
                      placeholder={fullName}
                      value={nsTypedName}
                      onChange={(e) => setNsTypedName(e.target.value)}
                      disabled={nightShiftSignMutation.isPending}
                      data-testid="input-ns-typed-name"
                      className="font-medium"
                    />
                  </div>
                  <Button
                    onClick={handleNightShiftSign}
                    disabled={!nsTypedName.trim() || nightShiftSignMutation.isPending}
                    data-testid="button-sign-night-shift"
                    className="shrink-0"
                  >
                    {nightShiftSignMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Signing…</>
                    ) : (
                      <><CheckCircle className="h-4 w-4 mr-2" />Sign Consent & Enter Portal</>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!policy) return null;

  const overallProgress = ((currentPolicyIndex * 100) + (currentSectionIndex / totalSections * 100)) / (totalPolicies + (status?.nightShiftPending ? 1 : 0));

  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="page-policy-gate">
      {/* Header */}
      <div className="border-b bg-card px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-lg font-bold text-foreground" data-testid="text-policy-gate-title">
              {COMPANY.name} — Policy Acknowledgment
            </h1>
            <p className="text-xs text-muted-foreground">
              Please review and sign all required employment policies to access the portal.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            Policy {currentPolicyIndex + 1} of {totalPolicies}{status?.nightShiftPending ? ` + Night Shift Consent` : ""}
          </span>
          <Badge variant="outline" className="text-xs" data-testid="badge-policy-progress">
            {Math.round(overallProgress)}% Complete
          </Badge>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-6 py-2 border-b bg-muted/30">
        <Progress value={overallProgress} className="h-2" data-testid="progress-policy-overall" />
        <div className="flex items-center gap-2 mt-2">
          {status?.policies.map((p, i) => (
            <div key={p.trackId} className={`flex items-center gap-1 text-xs ${i === currentPolicyIndex ? "text-primary font-medium" : i < currentPolicyIndex ? "text-green-600" : "text-muted-foreground"}`}>
              {i < currentPolicyIndex ? <CheckCircle className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
              <span className="hidden sm:inline truncate max-w-32">{p.title}</span>
              <ArrowRight className="h-3 w-3 text-muted-foreground/50 ml-1" />
            </div>
          ))}
          {status?.nightShiftPending && (
            <div className={`flex items-center gap-1 text-xs ${showNightShiftStep ? "text-primary font-medium" : "text-muted-foreground"}`}>
              <Moon className="h-3 w-3" />
              <span className="hidden sm:inline">Night Shift Consent</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row max-w-7xl mx-auto w-full gap-0 lg:gap-8 p-6">
        {/* Section nav panel */}
        <div className="w-full lg:w-64 shrink-0 mb-6 lg:mb-0">
          <div className="bg-card border rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-1" data-testid="text-policy-title">{policy.title}</h3>
            {policy.description && (
              <p className="text-xs text-muted-foreground mb-3">{policy.description}</p>
            )}
            <div className="space-y-1">
              {policy.sections.map((s, i) => {
                const key = `${policy.assignmentId}-${s.id}`;
                const isSigned = signedSections.has(key);
                const isCurrent = i === currentSectionIndex;
                return (
                  <div
                    key={s.id}
                    className={`flex items-center gap-2 rounded px-2 py-1.5 text-xs ${isCurrent ? "bg-primary/10 text-primary font-medium" : isSigned ? "text-green-600" : "text-muted-foreground"}`}
                    data-testid={`nav-section-${i}`}
                  >
                    {isSigned ? <CheckCircle className="h-3 w-3 shrink-0" /> : <div className={`h-3 w-3 rounded-full border shrink-0 ${isCurrent ? "border-primary bg-primary/20" : "border-muted-foreground/40"}`} />}
                    <span className="truncate">{s.title}</span>
                  </div>
                );
              })}
            </div>
            {policy.versionNumber > 1 && (
              <div className="mt-3 flex items-center gap-1 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded px-2 py-1">
                <AlertTriangle className="h-3 w-3" />
                <span>Updated to v{policy.versionNumber} — re-sign required</span>
              </div>
            )}
          </div>

          {/* Overdue training notice with exception request */}
          {(complianceStatus?.overdueAssignments?.length ?? 0) > 0 && (
            <div className="mt-4 border border-red-200 dark:border-red-800 rounded-lg p-3 bg-red-50 dark:bg-red-950/20" data-testid="panel-overdue-training">
              <div className="flex items-center gap-1.5 mb-2">
                <AlertCircle className="h-3.5 w-3.5 text-red-600 shrink-0" />
                <p className="text-xs font-semibold text-red-700 dark:text-red-300">
                  {complianceStatus!.overdueCount} overdue training {complianceStatus!.overdueCount === 1 ? "track" : "tracks"}
                </p>
              </div>
              <div className="space-y-1.5">
                {complianceStatus!.overdueAssignments!.map(a => {
                  const hasPending = (complianceStatus!.pendingExtensions || []).some((e: any) => e.assignment_id === a.id || e.assignmentId === a.id);
                  return (
                    <div key={a.id}>
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs text-red-700 dark:text-red-300 truncate">{a.trackTitle}</span>
                        {!hasPending && (
                          <button
                            className="text-xs text-red-700 dark:text-red-300 underline underline-offset-2 whitespace-nowrap shrink-0"
                            onClick={() => setExceptionAssignmentId(prev => prev === a.id ? null : a.id)}
                            data-testid={`button-request-exception-${a.id}`}
                          >
                            {exceptionAssignmentId === a.id ? "Cancel" : "Request Exception"}
                          </button>
                        )}
                        {hasPending && (
                          <span className="text-xs text-amber-600 dark:text-amber-400 whitespace-nowrap shrink-0">Request pending</span>
                        )}
                      </div>
                      {exceptionAssignmentId === a.id && (
                        <div className="mt-1.5 space-y-1.5" data-testid={`form-exception-${a.id}`}>
                          <textarea
                            className="w-full text-xs rounded border border-red-300 dark:border-red-700 bg-white dark:bg-background p-1.5 resize-none"
                            rows={2}
                            placeholder="Reason for exception (e.g. role change, external certification)..."
                            value={exceptionReason}
                            onChange={e => setExceptionReason(e.target.value)}
                            data-testid={`input-exception-reason-${a.id}`}
                          />
                          <Button
                            size="sm"
                            className="h-6 text-xs w-full bg-red-700 hover:bg-red-800"
                            disabled={!exceptionReason.trim() || submitExceptionMutation.isPending}
                            onClick={() => submitExceptionMutation.mutate({ assignmentId: a.id, reason: exceptionReason })}
                            data-testid={`button-submit-exception-${a.id}`}
                          >
                            {submitExceptionMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                            Submit Exception Request
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="bg-card border rounded-lg overflow-hidden">
            {/* Section header */}
            <div className="border-b px-6 py-4 bg-muted/20">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold" data-testid="text-section-title">{section?.title}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Section {currentSectionIndex + 1} of {totalSections}</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {dwellMet ? (
                    <span className="text-green-600 font-medium">Read requirement met</span>
                  ) : (
                    <span>Please read for {minDwell - dwellElapsed}s more</span>
                  )}
                </div>
              </div>
              <Progress value={Math.min(100, (dwellElapsed / minDwell) * 100)} className="h-1 mt-2" data-testid="progress-dwell" />
            </div>

            {/* Section body */}
            <div className="px-6 py-6 max-h-[55vh] overflow-y-auto prose prose-sm dark:prose-invert max-w-none" data-testid="section-body">
              {section?.body ? (
                <ReactMarkdown>{section.body}</ReactMarkdown>
              ) : (
                <p className="text-muted-foreground italic">No content for this section.</p>
              )}
            </div>

            {/* Sign-off panel */}
            <div className={`border-t px-6 py-5 bg-muted/10 transition-opacity ${!dwellMet ? "opacity-60" : ""}`}>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="typed-name" className="text-sm font-medium">
                    Type your full name to acknowledge this section
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    By signing, you confirm you have read and understood the content above.
                  </p>
                </div>
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <Input
                      id="typed-name"
                      placeholder={`${user?.firstName ?? ""} ${user?.lastName ?? ""}`}
                      value={typedName}
                      onChange={(e) => setTypedName(e.target.value)}
                      disabled={!dwellMet || signSectionMutation.isPending || completeTrackMutation.isPending || alreadySigned}
                      data-testid="input-typed-name"
                      className="font-medium"
                    />
                  </div>
                  <Button
                    onClick={handleSignSection}
                    disabled={
                      !dwellMet || !typedName.trim() ||
                      signSectionMutation.isPending || completeTrackMutation.isPending || alreadySigned
                    }
                    data-testid="button-sign-section"
                    className="shrink-0"
                  >
                    {signSectionMutation.isPending || completeTrackMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Signing…</>
                    ) : alreadySigned ? (
                      <><CheckCircle className="h-4 w-4 mr-2" />Signed</>
                    ) : currentSectionIndex >= totalSections - 1 && currentPolicyIndex >= totalPolicies - 1 && !status?.nightShiftPending ? (
                      "Sign & Finish"
                    ) : currentSectionIndex >= totalSections - 1 && currentPolicyIndex >= totalPolicies - 1 && status?.nightShiftPending ? (
                      "Sign & Continue to Consent →"
                    ) : currentSectionIndex >= totalSections - 1 ? (
                      "Sign & Next Policy →"
                    ) : (
                      "Sign & Continue →"
                    )}
                  </Button>
                </div>
                {!dwellMet && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Please read the full section before signing ({minDwell - dwellElapsed}s remaining)
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
