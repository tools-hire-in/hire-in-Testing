import { useState, useRef, useCallback, useEffect } from "react";
import { Eye } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { V2PageHeader } from "@/components/admin/V2PageHeader";
import { useNewLook } from "@/hooks/use-new-look";
import { PulseHeader } from "@/components/observation/PulseHeader";
import { PlansBoard } from "@/components/observation/PlansBoard";
import { ComplianceRadar } from "@/components/observation/ComplianceRadar";
import { GoalsMilestonesPanel } from "@/components/observation/GoalsMilestonesPanel";
import { ExitSignalsPanel } from "@/components/observation/ExitSignalsPanel";
import { queryClient } from "@/lib/queryClient";

const ALLOWED_ROLES = ["super_admin", "admin"];

export default function ObservationTower() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { enabled: newLook } = useNewLook();
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const pulseRefetchRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!isLoading && user && !ALLOWED_ROLES.includes(user.role)) {
      setLocation("/admin/hr");
    }
  }, [isLoading, user, setLocation]);

  if (!isLoading && user && !ALLOWED_ROLES.includes(user.role)) {
    return null;
  }

  const handleRefreshAll = useCallback(() => {
    setLastRefreshed(new Date());
    queryClient.invalidateQueries({ queryKey: ["/api/observation/pulse"] });
    queryClient.invalidateQueries({ queryKey: ["/api/observation/compliance-radar"] });
    queryClient.invalidateQueries({ queryKey: ["/api/observation/exit-signals"] });
    queryClient.invalidateQueries({ queryKey: ["/api/ceo/goals"] });
  }, []);

  return (
    <AdminLayout>
      <div className="space-y-4 max-w-[1400px] v2-surface" data-testid="observation-tower-page">
        {newLook ? (
          <V2PageHeader
            icon={Eye}
            eyebrow="Analytics"
            title="Observation Tower"
            subtitle="Live org intelligence — plans, compliance, goals & early exit signals"
          />
        ) : (
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-lg font-bold text-foreground">Observation Tower</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Live org intelligence — plans, compliance, goals & early exit signals
              </p>
            </div>
          </div>
        )}

        {/* Org Health banner — full width */}
        <PulseHeader
          lastRefreshed={lastRefreshed}
          onRefreshAll={handleRefreshAll}
          queryRef={pulseRefetchRef}
        />

        {/* 2-column grid: collapses to single on mobile */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Left column: Plans Board + Compliance Radar */}
          <div className="space-y-4">
            <PlansBoard />
            <ComplianceRadar />
          </div>

          {/* Right column: Goals & Milestones + Exit Signals */}
          <div className="space-y-4">
            <GoalsMilestonesPanel />
            <ExitSignalsPanel />
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
