import { AdminLayout } from "@/components/admin/AdminLayout";
import { Settings } from "lucide-react";
import {
  SalaryStructuresSection,
  StateRegistrationsSection,
  CoverageSection,
} from "@/pages/admin/hr/settings/PayrollSettings";

export default function PayrollSetup() {
  return (
    <AdminLayout>
      <div className="space-y-6" data-testid="page-payroll-setup">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-payroll-setup-title">
            <Settings className="h-6 w-6" />
            Payroll Setup
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Configure salary structures, state registrations, and statutory coverage used by the payroll engine.
          </p>
        </div>
        <CoverageSection />
        <SalaryStructuresSection />
        <StateRegistrationsSection />
      </div>
    </AdminLayout>
  );
}
