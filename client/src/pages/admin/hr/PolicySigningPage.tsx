import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Shield, ChevronRight, ChevronLeft, CheckCircle2, PenLine, FileText, Download, Loader2
} from "lucide-react";

interface PolicyPage {
  page: number;
  body: string;
}

interface PolicyContent {
  requestId: string;
  status: string;
  policyId: string;
  policyTitle: string;
  policyVersion: number;
  pages: PolicyPage[];
  alreadySigned: boolean;
  signedAt: string | null;
  pdfPath: string | null;
}

function deriveInitials(firstName: string, lastName: string): string {
  const f = (firstName || "").trim()[0] || "";
  const l = (lastName || "").trim()[0] || "";
  return (f + l).toUpperCase();
}

function SignedPdfDownloadButton({
  signatureId,
  signingRequestId,
}: {
  signatureId: string | null;
  signingRequestId: string;
}) {
  const { data: sig } = useQuery<{ id: string }>({
    queryKey: ["/api/hr/policy-requests", signingRequestId, "signature"],
    queryFn: async () => {
      const res = await fetch(`/api/hr/policy-requests/${signingRequestId}/signature`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !signatureId,
  });

  const effectiveSigId = signatureId || sig?.id;
  if (!effectiveSigId) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      asChild
      data-testid="button-download-pdf"
    >
      <a href={`/api/hr/policy-signatures/${effectiveSigId}/download`} target="_blank" rel="noreferrer">
        <Download className="h-4 w-4 mr-1.5" />
        Download Acknowledgement PDF
      </a>
    </Button>
  );
}

function SignatureField({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <Input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="text-xl font-medium"
        style={{ fontFamily: "'Dancing Script', cursive, serif" }}
        data-testid="input-signature"
      />
      {value && (
        <p
          className="text-3xl text-blue-900 pl-1 pointer-events-none select-none"
          style={{ fontFamily: "'Dancing Script', cursive, serif" }}
          data-testid="preview-signature"
        >
          {value}
        </p>
      )}
    </div>
  );
}

export default function PolicySigningPage() {
  const { signingId } = useParams<{ signingId: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();

  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [pageInitials, setPageInitials] = useState<Record<number, string>>({});
  const [finalSignature, setFinalSignature] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const [signatureId, setSignatureId] = useState<string | null>(null);

  const { data: policy, isLoading } = useQuery<PolicyContent>({
    queryKey: ["/api/hr/policy-requests", signingId, "content"],
    queryFn: async () => {
      const res = await fetch(`/api/hr/policy-requests/${signingId}/content`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load policy");
      return res.json();
    },
    enabled: !!signingId,
  });

  useEffect(() => {
    if (user && policy) {
      const initials = deriveInitials(user.firstName, user.lastName);
      const initialMap: Record<number, string> = {};
      policy.pages.forEach(p => { initialMap[p.page] = initials; });
      setPageInitials(initialMap);
      setFinalSignature(`${user.firstName} ${user.lastName}`);
    }
  }, [user, policy]);

  const signMutation = useMutation({
    mutationFn: async () => {
      const initialsArray = Object.entries(pageInitials).map(([page, initial]) => ({
        page: parseInt(page),
        initial,
      }));
      const res = await apiRequest("POST", `/api/hr/policy-requests/${signingId}/sign`, {
        pageInitials: initialsArray,
        finalSignature,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      setIsComplete(true);
      setSignatureId(data.signatureId);
      toast({ title: "Policy signed successfully", description: "Your acknowledgement has been recorded." });
    },
    onError: () => {
      toast({ title: "Signing failed", description: "Please try again.", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="max-w-3xl mx-auto space-y-6 p-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </AdminLayout>
    );
  }

  if (!policy) {
    return (
      <AdminLayout>
        <div className="max-w-3xl mx-auto py-20 text-center">
          <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Policy not found or you don't have access.</p>
          <Button variant="outline" className="mt-4" onClick={() => setLocation("/admin/hr?tab=documents")}>
            Back to Documents
          </Button>
        </div>
      </AdminLayout>
    );
  }

  if (policy.alreadySigned || isComplete) {
    return (
      <AdminLayout>
        <div className="max-w-2xl mx-auto py-12 text-center space-y-6">
          <div className="flex flex-col items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-green-700">Policy Signed</h2>
              <p className="text-muted-foreground mt-1">
                You have successfully acknowledged <strong>{policy.policyTitle}</strong>.
              </p>
              {(policy.signedAt || isComplete) && (
                <p className="text-sm text-muted-foreground mt-1">
                  Signed on {policy.signedAt
                    ? new Date(policy.signedAt).toLocaleDateString("en-IN", { dateStyle: "long" })
                    : new Date().toLocaleDateString("en-IN", { dateStyle: "long" })}
                </p>
              )}
            </div>
          </div>

          {(signatureId || policy.pdfPath) && (
            <Card className="text-left">
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground mb-3">Your signed acknowledgement PDF has been generated and stored.</p>
                <SignedPdfDownloadButton signatureId={signatureId} signingRequestId={policy.requestId} />
              </CardContent>
            </Card>
          )}

          <Button onClick={() => setLocation("/admin/hr?tab=documents")} data-testid="button-back-to-docs">
            Back to My Documents
          </Button>
        </div>
      </AdminLayout>
    );
  }

  const pages = policy.pages;
  const totalPages = pages.length;
  const isLastPage = currentPageIndex === totalPages - 1;
  const currentPage = pages[currentPageIndex];
  const currentInitial = pageInitials[currentPage.page] || "";
  const progressPercent = Math.round(((currentPageIndex) / totalPages) * 100);

  function handleNextPage() {
    if (currentPageIndex < totalPages - 1) {
      setCurrentPageIndex(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function handlePrevPage() {
    if (currentPageIndex > 0) {
      setCurrentPageIndex(prev => prev - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  const canProceed = currentInitial.trim().length > 0;
  const canSign = finalSignature.trim().length > 0 && pages.every(p => (pageInitials[p.page] || "").trim().length > 0);

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto space-y-6 pb-16">
        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold" data-testid="text-policy-title">{policy.policyTitle}</h1>
            <Badge variant="outline" className="text-xs">v{policy.policyVersion}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Read each page carefully and initial at the bottom before proceeding.
          </p>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Page {currentPageIndex + 1} of {totalPages}</span>
            <span>{currentPageIndex === totalPages - 1 ? "Final — Signature Required" : `${totalPages - currentPageIndex - 1} page(s) remaining`}</span>
          </div>
          <Progress value={progressPercent} className="h-2" data-testid="progress-pages" />
        </div>

        {/* Page Content */}
        <Card data-testid={`card-page-${currentPage.page}`}>
          <CardHeader className="bg-slate-50 dark:bg-slate-900/30 border-b pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              {policy.policyTitle}
              <span className="text-muted-foreground font-normal text-sm">— Page {currentPage.page}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="prose prose-sm max-w-none dark:prose-invert">
              {currentPage.body.split(/\r?\n/).map((line, idx) => (
                line.trim() === ""
                  ? <div key={idx} className="h-3" />
                  : <p key={idx} className="text-sm leading-relaxed text-foreground mb-0">{line}</p>
              ))}
            </div>

            <Separator className="my-6" />

            {/* Initials field */}
            <div className="bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <PenLine className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-semibold">Initial here to confirm you have read this page</p>
              </div>
              <SignatureField
                value={currentInitial}
                onChange={(v) => setPageInitials(prev => ({ ...prev, [currentPage.page]: v }))}
                placeholder="Your initials (e.g. MN)"
                label={`Page ${currentPage.page} Initials`}
              />
              {!canProceed && (
                <p className="text-xs text-amber-600">Please enter your initials to continue to the next page.</p>
              )}
            </div>

            {/* Final signature — show only on last page */}
            {isLastPage && (
              <>
                <Separator className="my-6" />
                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-4">
                  <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                    Final Declaration
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    I confirm I have read and understood this document in its entirety and agree to comply with its terms.
                  </p>
                  <SignatureField
                    value={finalSignature}
                    onChange={setFinalSignature}
                    placeholder="Type your full name"
                    label="Full Name (Digital Signature)"
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handlePrevPage}
            disabled={currentPageIndex === 0}
            data-testid="button-prev-page"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>

          {isLastPage ? (
            <Button
              onClick={() => signMutation.mutate()}
              disabled={!canSign || signMutation.isPending}
              className="min-w-36"
              data-testid="button-sign-submit"
            >
              {signMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Signing…</>
              ) : (
                <><CheckCircle2 className="h-4 w-4 mr-1.5" /> Sign & Submit</>
              )}
            </Button>
          ) : (
            <Button
              onClick={handleNextPage}
              disabled={!canProceed}
              data-testid="button-next-page"
            >
              Next Page
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
