import { Shield } from "lucide-react";
import GovernanceSettingsPanel from "@/components/admin/governance/GovernanceSettingsPanel";

export default function GovernanceHub() {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary shrink-0">
          <Shield className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Governance Hub</h2>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Configure and monitor governance enforcement across SOPs, PIPs, growth plans, and probation milestones.
          </p>
        </div>
      </div>

      <GovernanceSettingsPanel />
    </div>
  );
}
