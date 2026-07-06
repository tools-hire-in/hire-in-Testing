import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { FileBarChart } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { SalaryReportsContent } from "./SalaryReports";
import { DocumentComplianceContent } from "./DocumentCompliance";
import { AuditLogsContent } from "@/pages/admin/AuditLogs";
import { PolicyComplianceContent } from "./PolicyCompliance";

export default function ReportsCompliance() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();

  const isAdmin = ["super_admin", "admin"].includes(user?.role || "");
  const isHR = ["super_admin", "admin", "hr"].includes(user?.role || "");
  const isFinance = user?.role === "finance";
  const isExecutive = user?.role === "executive";
  const canViewAudit = isAdmin || isExecutive;

  const params = new URLSearchParams(window.location.search);
  const requestedTab = params.get("tab");
  const validTabs = [
    ...(isHR || isFinance || isExecutive ? ["salary"] : []),
    ...(isHR || isExecutive ? ["compliance"] : []),
    ...(isHR || isExecutive ? ["policy"] : []),
    ...(canViewAudit ? ["audit"] : []),
  ];
  const defaultTab = validTabs[0] || "salary";
  const initialTab = requestedTab && validTabs.includes(requestedTab) ? requestedTab : defaultTab;
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/admin/login");
  }, [authLoading, isAuthenticated, setLocation]);

  if (authLoading || !isAuthenticated) return null;

  if (validTabs.length === 0) {
    return (
      <AdminLayout>
        <div className="p-8 text-center text-muted-foreground" data-testid="reports-no-access">
          You do not have access to any reports in this section.
        </div>
      </AdminLayout>
    );
  }

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const url = new URL(window.location.href);
    if (value === "salary") {
      url.searchParams.delete("tab");
    } else {
      url.searchParams.set("tab", value);
    }
    window.history.replaceState({}, "", url.toString());
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-reports-title">
            <FileBarChart className="h-6 w-6 text-primary" />
            Reports & Compliance
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Salary reports, document compliance, policy acknowledgments, and audit logs
          </p>
        </div>
        <Tabs value={activeTab} onValueChange={handleTabChange} data-testid="tabs-reports">
          <TabsList>
            {(isHR || isFinance || isExecutive) && <TabsTrigger value="salary" data-testid="tab-salary">Salary Reports</TabsTrigger>}
            {(isHR || isExecutive) && <TabsTrigger value="compliance" data-testid="tab-compliance">Document Compliance</TabsTrigger>}
            {(isHR || isExecutive) && <TabsTrigger value="policy" data-testid="tab-policy">Policy Compliance</TabsTrigger>}
            {canViewAudit && <TabsTrigger value="audit" data-testid="tab-audit">Audit Logs</TabsTrigger>}
          </TabsList>
          {(isHR || isFinance || isExecutive) && (
            <TabsContent value="salary">
              <SalaryReportsContent readOnly={isExecutive} />
            </TabsContent>
          )}
          {(isHR || isExecutive) && (
            <TabsContent value="compliance">
              <DocumentComplianceContent readOnly={isExecutive} />
            </TabsContent>
          )}
          {(isHR || isExecutive) && (
            <TabsContent value="policy">
              <PolicyComplianceContent readOnly={isExecutive} />
            </TabsContent>
          )}
          {canViewAudit && (
            <TabsContent value="audit">
              <AuditLogsContent />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </AdminLayout>
  );
}
