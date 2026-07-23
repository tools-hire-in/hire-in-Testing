import { AdminLayout } from "@/components/admin/AdminLayout";
import { Settings } from "lucide-react";
import { V2PageHeader } from "@/components/admin/V2PageHeader";
import { useNewLook } from "@/hooks/use-new-look";
import {
  SalaryStructuresSection,
  StateRegistrationsSection,
  CoverageSection,
} from "@/pages/admin/hr/settings/PayrollSettings";

export default function PayrollSetup() {
  const { enabled: newLook } = useNewLook();
  return (
    <AdminLayout>
      <div className="space-y-6 v2-surface" data-testid="page-payroll-setup">
        {newLook ? (
          <V2PageHeader
            icon={Settings}
            eyebrow="Payroll"
            title="Payroll Setup"
            subtitle="Configure salary structures, state registrations, and statutory coverage used by the payroll engine."
            testId="text-payroll-setup-title"
          />
        ) : (
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-payroll-setup-title">
              <Settings className="h-6 w-6" />
              Payroll Setup
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Configure salary structures, state registrations, and statutory coverage used by the payroll engine.
            </p>
          </div>
        )}
        <CoverageSection />
        <SalaryStructuresSection />
        <StateRegistrationsSection />
      </div>
    </AdminLayout>
  );
}
