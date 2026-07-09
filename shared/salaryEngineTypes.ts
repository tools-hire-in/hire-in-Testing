/**
 * Shared types for the India Payroll Computation Engine.
 * Lives in shared/ so salarySlipHtml.ts (used on both client and server) can import it.
 * The actual computation logic lives in server/salaryEngine.ts.
 */

export interface ComponentBreakdown {
  componentName: string;
  displayName: string;
  rawAmount: number;
  amount: number;
  ruleDescription: string;
}

export interface StatutoryResult {
  employeePf: number;
  employerEpf: number;
  employerEps: number;
  employerEdli: number;
  employerAdminCharges: number;
  employeeEsi: number;
  employerEsi: number;
  professionalTax: number;
  pfBasis: number;
  esiApplicable: boolean;
  totalEmployeeDeductions: number;
  totalEmployerCost: number;
}

export interface SlipComponents {
  earnings: ComponentBreakdown[];
  statutory: StatutoryResult;
  pfMode: "restricted" | "unrestricted";
  structureId: string;
  structureName: string;
  lopFactor: number;
  grossAfterLOP: number;
}
