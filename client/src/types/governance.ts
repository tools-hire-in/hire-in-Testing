export interface SopWaveSummary {
  waveNumber: number;
  name: string;
  activated: boolean;
  sopCount: number;
  ackPercent: number;
}

export interface SopSection {
  totalAssigned: number;
  acknowledged: number;
  overdue: number;
  waves: SopWaveSummary[];
}

export interface TrainingSection {
  totalActive: number;
  compliant: number;
  overdue: number;
  locked: number;
}

export interface PlanStages {
  acknowledged: number;
  checkInsInProgress: number;
  overdueCoaching: number;
  noCoachingInThreshold: number;
}

export interface ManagerPlanBreakdown {
  managerId: string;
  managerName: string;
  pipsActive: number;
  pipsStalled: number;
  growthPlansActive: number;
  probationActive: number;
  checkInsOverdue: number;
}

export interface PlansSection {
  pip: PlanStages & { active: number };
  growth: PlanStages & { active: number };
  probation: PlanStages & { active: number };
  perManager: ManagerPlanBreakdown[];
}

export interface ProbationMilestoneDue {
  employeeId: string;
  employeeName: string;
  milestoneDay: number;
  managerId: string | null;
  managerName: string | null;
  daysUntilDue: number;
}

export interface ProbationMilestoneMissed {
  employeeId: string;
  employeeName: string;
  milestoneDay: number;
  managerId: string | null;
  managerName: string | null;
  missedDaysAgo: number;
  strikeCount: number;
}

export interface ProbationSection {
  dueSoon: ProbationMilestoneDue[];
  missedRecently: ProbationMilestoneMissed[];
}

export interface GoalsHealthSplit {
  onTrack: number;
  atRisk: number;
  overdue: number;
  total: number;
}

export interface GoalsSection {
  healthSplit: GoalsHealthSplit;
  escalatedWithCoachingGap: unknown[];
}

export interface OrgCheckinRate {
  scheduled: number;
  completed: number;
  missed: number;
  completionRate: number;
}

export interface ManagerCheckinCompliance {
  managerId: string;
  managerName: string;
  scheduled: number;
  completed: number;
  missed: number;
  missRate: number;
  consecutiveMisses: number;
}

export interface CheckinsSection {
  org: OrgCheckinRate;
  perManager: ManagerCheckinCompliance[];
}

export interface GovernancePulse {
  sop: SopSection;
  training: TrainingSection;
  plans: PlansSection;
  probation: ProbationSection;
  goals: GoalsSection;
  checkins: CheckinsSection;
  action_items: unknown[];
  generatedAt: string;
}
