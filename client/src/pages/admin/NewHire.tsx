import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, FileText, Users, CheckCircle2, XCircle, AlertCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { OfferLetterGenerator, OfferLettersDashboard } from "@/pages/admin/hr/HRTools";

interface NewHire {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  employee_id: string | null;
  designation: string | null;
  joining_date: string;
  role: string;
  department_name: string | null;
  document_count: number;
  has_bank_details: boolean;
  has_ns_consent: boolean;
  training_pct: number;
}

function StatusChip({ ok, label, na }: { ok: boolean; label: string; na?: boolean }) {
  if (na) {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
        <AlertCircle className="h-3 w-3" />
        {label} N/A
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
      ok ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
         : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
    }`}>
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {label}
    </span>
  );
}

function TrainingBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? "bg-green-500" : pct >= 40 ? "bg-amber-500" : "bg-red-400";
  return (
    <div className="flex items-center gap-2 min-w-[90px]">
      <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">{pct}%</span>
    </div>
  );
}

function OnboardingTab() {
  const [, setLocation] = useLocation();
  const { data: hires, isLoading } = useQuery<NewHire[]>({
    queryKey: ["/api/hr/new-hire/onboarding-status"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!hires || hires.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-3">
          <Users className="h-10 w-10 text-muted-foreground/40" />
          <p className="font-medium text-muted-foreground">No new hires in the last 90 days</p>
          <p className="text-sm text-muted-foreground">Employees who join within 90 days of today will appear here with their setup status.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Showing <strong>{hires.length}</strong> employee{hires.length !== 1 ? "s" : ""} who joined in the last 90 days.
      </p>

      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Employee</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Joined</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Training</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Docs</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Bank Details</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">NS Consent</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {hires.map((h, i) => {
              const isNightShiftRole = h.role !== "manager";
              return (
                <tr
                  key={h.id}
                  className={`border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer ${i % 2 === 0 ? "" : "bg-muted/10"}`}
                  onClick={() => setLocation(`/admin/hr/people?tab=users&userId=${h.id}`)}
                  data-testid={`row-new-hire-${h.id}`}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">{h.first_name} {h.last_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {h.employee_id ? `${h.employee_id} · ` : ""}{h.designation || h.role}
                      {h.department_name ? ` · ${h.department_name}` : ""}
                    </div>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">
                    {new Date(h.joining_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3">
                    <TrainingBar pct={h.training_pct} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusChip ok={h.document_count > 0} label={h.document_count > 0 ? `${h.document_count} uploaded` : "Missing"} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusChip ok={h.has_bank_details} label={h.has_bank_details ? "Added" : "Missing"} />
                  </td>
                  <td className="px-4 py-3">
                    {isNightShiftRole
                      ? <StatusChip ok={h.has_ns_consent} label={h.has_ns_consent ? "Signed" : "Pending"} />
                      : <StatusChip ok={true} label="N/A" na />
                    }
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 text-xs"
                      onClick={(e) => { e.stopPropagation(); setLocation(`/admin/hr/people?tab=users&userId=${h.id}`); }}
                      data-testid={`button-view-hire-${h.id}`}
                    >
                      <ExternalLink className="h-3 w-3" />
                      View
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function NewHire() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const [tab, setTab] = useState<string>(() => {
    try {
      return new URLSearchParams(window.location.search).get("tab") || "offer-letters";
    } catch {
      return "offer-letters";
    }
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/admin/login");
  }, [authLoading, isAuthenticated, setLocation]);

  useEffect(() => {
    if (!authLoading && user) {
      const allowed = ["super_admin", "admin", "hr", "operations", "manager"];
      if (!allowed.includes(user.role)) setLocation("/admin/hr");
    }
  }, [authLoading, user, setLocation]);

  if (authLoading || !isAuthenticated) return null;

  const handleTabChange = (t: string) => {
    setTab(t);
    const url = new URL(window.location.href);
    t === "offer-letters" ? url.searchParams.delete("tab") : url.searchParams.set("tab", t);
    window.history.replaceState({}, "", url.toString());
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-new-hire-title">New Hire</h1>
          <p className="text-muted-foreground">Manage offer letters and track new employee setup</p>
        </div>

        <Tabs value={tab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList data-testid="tabs-new-hire" className="flex-wrap h-auto gap-1">
            <TabsTrigger value="offer-letters" data-testid="tab-new-hire-offer-letters">
              <FileText className="h-4 w-4 mr-2" />
              Offer Letters
            </TabsTrigger>
            <TabsTrigger value="onboarding" data-testid="tab-new-hire-onboarding">
              <Users className="h-4 w-4 mr-2" />
              Onboarding
            </TabsTrigger>
          </TabsList>

          <TabsContent value="offer-letters" className="space-y-8">
            <OfferLetterGenerator />
            <div className="border-t pt-6">
              <OfferLettersDashboard />
            </div>
          </TabsContent>

          <TabsContent value="onboarding">
            <OnboardingTab />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
