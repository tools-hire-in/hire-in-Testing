import { AdminLayout } from "@/components/admin/AdminLayout";
import { ManagerCommandCard } from "@/components/onboarding/ManagerCommandCard";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";

const MANAGER_TRACK_ROLES = ["manager", "hr", "admin", "super_admin", "operations"];

export default function ManagerCommandCardPage() {
  const { user } = useAuth();

  if (!user) return null;

  if (!MANAGER_TRACK_ROLES.includes(user.role)) {
    return <Redirect to="/admin/my-desk" />;
  }

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto py-6 px-4 print:p-0" data-testid="manager-command-card-page">
        <div className="mb-6 print:hidden">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <span>My Team</span>
            <span>›</span>
            <span>Reference</span>
          </div>
          <h1 className="text-2xl font-bold">Manager Check-in Reference Card</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Quick reference for probation cadence, escalation rules, leave approvals, and compliance essentials.
            Bookmark this page or print it for offline use.
          </p>
        </div>
        <ManagerCommandCard />
      </div>
    </AdminLayout>
  );
}
