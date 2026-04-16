export const PERFORMANCE_BAND_SENTENCES: Record<string, string> = {
  factual_only: "During the above tenure, the employee was associated with the organization in the stated role and department.",
  standard: "During the tenure, the employee carried out assigned responsibilities in a satisfactory manner.",
  good: "During the tenure, the employee demonstrated diligence and responsibility in assigned work.",
  very_good: "During the tenure, the employee demonstrated professionalism, commitment, and good execution of assigned responsibilities.",
  excellent: "During the tenure, the employee demonstrated a high level of professionalism, ownership, and effectiveness in assigned responsibilities.",
};

export const CONDUCT_BAND_SENTENCES: Record<string, string> = {
  standard: "Professional conduct during the tenure was satisfactory.",
  good: "Professional conduct during the tenure was good.",
  very_good: "Professional conduct during the tenure was very good.",
};

export const COMPLETION_BAND_SENTENCES: Record<string, string> = {
  successfully_completed: "successfully completed",
  completed: "completed",
  served_during_period: "served during the period",
};

export const CLOSING_LINE_SENTENCES: Record<string, string> = {
  wish_success: "We wish him/her all the best in future endeavours.",
  wish_career: "We wish him/her continued success in their career.",
  wish_professional: "We wish him/her the very best in all future professional pursuits.",
};

export const PERFORMANCE_BANDS = [
  { value: "factual_only", label: "Factual Only" },
  { value: "standard", label: "Standard" },
  { value: "good", label: "Good" },
  { value: "very_good", label: "Very Good" },
  { value: "excellent", label: "Excellent" },
];

export const CONDUCT_BANDS = [
  { value: "standard", label: "Satisfactory" },
  { value: "good", label: "Good" },
  { value: "very_good", label: "Very Good" },
];

export const COMPLETION_BANDS = [
  { value: "successfully_completed", label: "Successfully Completed" },
  { value: "completed", label: "Completed" },
  { value: "served_during_period", label: "Served During the Period" },
];

export const CLOSING_LINES = [
  { value: "wish_success", label: "We wish him/her all the best in future endeavours." },
  { value: "wish_career", label: "We wish him/her continued success in their career." },
  { value: "wish_professional", label: "We wish him/her the very best in all future professional pursuits." },
];

export const TEMPLATE_PREFIX_MAP: Record<string, string> = {
  experience: "EXP",
  internship_completion: "INT",
  internship_certificate: "CRT",
  relieving: "REL",
};

export const TEMPLATE_LABELS: Record<string, string> = {
  experience: "Employee Experience Letter",
  internship_completion: "Internship Completion Letter",
  internship_certificate: "Internship Certificate",
  relieving: "Relieving Letter",
};

export interface RoleResponsibilityOption {
  label: string;
  text: string;
}

export interface RoleResponsibilitySummary {
  designation: string;
  options: [RoleResponsibilityOption, RoleResponsibilityOption];
}

export const ROLE_RESPONSIBILITY_SUMMARIES: RoleResponsibilitySummary[] = [
  {
    designation: "Healthcare Sourcer - Intern",
    options: [
      {
        label: "Option A",
        text: "Supported sourcing activities for healthcare positions by identifying potential candidates, screening basic profile fit, maintaining candidate records, and assisting the recruitment team with pipeline updates and follow-ups.",
      },
      {
        label: "Option B",
        text: "Assisted in talent sourcing for healthcare roles through profile review, candidate outreach support, database maintenance, and coordination of candidate information for the recruiting team.",
      },
    ],
  },
  {
    designation: "Healthcare Sourcer - Senior",
    options: [
      {
        label: "Option A",
        text: "Handled sourcing for healthcare positions by building candidate pipelines, identifying qualified professionals, conducting initial profile assessments, maintaining sourcing trackers, and supporting timely submission readiness.",
      },
      {
        label: "Option B",
        text: "Managed targeted sourcing for healthcare requirements through market mapping, resume screening, candidate outreach, database organization, and ongoing pipeline support aligned with business priorities.",
      },
    ],
  },
  {
    designation: "Healthcare Sourcer - Lead",
    options: [
      {
        label: "Option A",
        text: "Led healthcare sourcing activities by driving candidate pipeline generation, guiding sourcing priorities, supporting team coordination, maintaining sourcing quality standards, and enabling recruiters with qualified candidate flow.",
      },
      {
        label: "Option B",
        text: "Oversaw sourcing execution for healthcare roles through pipeline planning, profile quality checks, team guidance, sourcing process improvement, and support for timely recruitment delivery.",
      },
    ],
  },
  {
    designation: "Healthcare Recruiter - Intern",
    options: [
      {
        label: "Option A",
        text: "Supported healthcare recruitment activities by assisting with candidate sourcing, screening coordination, interview scheduling, database updates, and follow-up communication throughout the hiring process.",
      },
      {
        label: "Option B",
        text: "Assisted the recruitment team in handling healthcare hiring tasks including candidate coordination, basic profile review, scheduling support, and maintaining recruitment records and status updates.",
      },
    ],
  },
  {
    designation: "Healthcare Recruiter - Senior",
    options: [
      {
        label: "Option A",
        text: "Managed end-to-end recruitment for healthcare positions including candidate sourcing, screening, interview coordination, submission management, offer follow-up, and stakeholder communication.",
      },
      {
        label: "Option B",
        text: "Handled full-cycle healthcare recruitment by identifying suitable candidates, evaluating profile fit, coordinating interviews, maintaining candidate engagement, and supporting closure of open requirements.",
      },
    ],
  },
  {
    designation: "Healthcare Recruiter - Lead",
    options: [
      {
        label: "Option A",
        text: "Led healthcare recruitment delivery by managing critical requirements, supporting team members, driving submission quality, coordinating hiring activities, and ensuring timely follow-up across the recruitment lifecycle.",
      },
      {
        label: "Option B",
        text: "Oversaw recruitment execution for healthcare roles through candidate pipeline management, screening oversight, recruiter guidance, process coordination, and focus on quality and turnaround timelines.",
      },
    ],
  },
  {
    designation: "Healthcare Recruiter - Manager",
    options: [
      {
        label: "Option A",
        text: "Managed healthcare recruitment operations by overseeing team performance, monitoring hiring pipelines, supporting delivery planning, coordinating with stakeholders, and ensuring process discipline, quality, and target achievement.",
      },
      {
        label: "Option B",
        text: "Led the healthcare recruitment function through team supervision, workload planning, escalation handling, performance monitoring, and alignment of hiring delivery with business and client requirements.",
      },
    ],
  },
  {
    designation: "IT Recruiter - Intern",
    options: [
      {
        label: "Option A",
        text: "Supported IT recruitment activities by assisting with candidate sourcing, basic profile screening, interview coordination, applicant tracking updates, and follow-up communication during the hiring process.",
      },
      {
        label: "Option B",
        text: "Assisted the recruitment team in IT hiring operations through profile review support, candidate coordination, scheduling assistance, tracker maintenance, and timely status updates.",
      },
    ],
  },
  {
    designation: "IT Recruiter - Senior",
    options: [
      {
        label: "Option A",
        text: "Managed end-to-end recruitment for IT positions including sourcing, screening, candidate evaluation, interview coordination, submission handling, and offer-stage follow-up.",
      },
      {
        label: "Option B",
        text: "Handled full-cycle IT recruitment by identifying qualified candidates, assessing technical profile alignment, coordinating interviews, maintaining candidate engagement, and supporting hiring closures.",
      },
    ],
  },
  {
    designation: "IT Recruiter - Lead",
    options: [
      {
        label: "Option A",
        text: "Led IT recruitment delivery by managing priority requirements, guiding recruiters, improving submission quality, coordinating hiring workflows, and ensuring timely progress across open positions.",
      },
      {
        label: "Option B",
        text: "Oversaw recruitment execution for IT roles through team support, candidate pipeline management, screening oversight, process improvement, and delivery alignment with hiring goals.",
      },
    ],
  },
  {
    designation: "IT Recruiter - Manager",
    options: [
      {
        label: "Option A",
        text: "Managed IT recruitment operations by supervising team performance, planning hiring delivery, monitoring open positions, supporting stakeholder communication, and ensuring quality, compliance, and target achievement.",
      },
      {
        label: "Option B",
        text: "Led the IT recruitment function through team management, process oversight, escalation resolution, hiring pipeline monitoring, and alignment of recruitment outcomes with business needs.",
      },
    ],
  },
];
