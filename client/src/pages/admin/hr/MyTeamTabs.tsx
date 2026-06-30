import { useEffect, useMemo } from "react";
import { useLocation, useSearch } from "wouter";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAuth } from "@/hooks/use-auth";
import MyTeam from "./MyTeam";
import TeamAttendance from "./TeamAttendance";
import LeaveApprovals from "./LeaveApprovals";
import TrainingProgress from "./TrainingProgress";
import AttendanceApproval from "./AttendanceApproval";
import TicketApprovalsTab from "./TicketApprovalsTab";

const TABS = ["overview", "attendance", "exceptions", "leave-approvals", "training-progress", "attendance-approval", "approvals"] as const;
type Tab = typeof TABS[number];

// Legacy nested-param aliases → current single-level section values.
const TAB_ALIASES: Record<string, Tab> = {
  "exception-review": "exceptions",
  "team-attendance": "attendance",
};

// Sections whose child component renders no page header of its own — supply a
// lightweight one here so every destination has consistent context.
const SECTION_HEADERS: Partial<Record<Tab, { title: string; desc: string }>> = {
  exceptions: { title: "Exception Review", desc: "Short-day and attendance exceptions awaiting review" },
  "attendance-approval": { title: "Month-End Approval", desc: "Review and approve monthly attendance reports" },
  approvals: { title: "Request Approvals", desc: "Pending team requests awaiting your action" },
};

export default function MyTeamTabs() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();

  // Active section is driven by ?tab= (set from the sidebar Team sub-nav).
  // Unknown values (including MyTeam's own internal tabs corrections/plans)
  // fall back to "overview" so MyTeam can handle them itself.
  const activeTab: Tab = useMemo(() => {
    try {
      const tab = new URLSearchParams(search).get("tab");
      if (tab && TABS.includes(tab as Tab)) return tab as Tab;
      if (tab && TAB_ALIASES[tab]) return TAB_ALIASES[tab];
    } catch {}
    return "overview";
  }, [search]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/admin/login");
  }, [authLoading, isAuthenticated, setLocation]);

  useEffect(() => {
    if (!authLoading && user) {
      const allowed = ["super_admin", "admin", "hr", "operations", "manager"];
      if (!allowed.includes(user.role || "")) setLocation("/admin/hr");
    }
  }, [authLoading, user, setLocation]);

  useEffect(() => {
    document.title = "My Team | Hire'in Portal";
  }, []);

  if (authLoading || !isAuthenticated) return null;

  const sectionHeader = SECTION_HEADERS[activeTab];

  return (
    <AdminLayout>
      <div className="space-y-4 v2-surface">
        {sectionHeader && (
          <div className="v2-page-head">
            <h1 className="text-2xl font-bold" data-testid="text-myteam-title">{sectionHeader.title}</h1>
            <p className="text-sm text-muted-foreground">{sectionHeader.desc}</p>
          </div>
        )}

        {/* Content driven by the sidebar Team sub-nav — single level, no nested tabs */}
        <div>
          {activeTab === "overview" && <MyTeam />}
          {activeTab === "attendance" && <TeamAttendance view="attendance" />}
          {activeTab === "exceptions" && <TeamAttendance view="exceptions" />}
          {activeTab === "leave-approvals" && <LeaveApprovals />}
          {activeTab === "training-progress" && <TrainingProgress />}
          {activeTab === "attendance-approval" && <AttendanceApproval />}
          {activeTab === "approvals" && <TicketApprovalsTab />}
        </div>
      </div>
    </AdminLayout>
  );
}
