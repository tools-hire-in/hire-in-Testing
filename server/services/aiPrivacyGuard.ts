/**
 * AI Privacy Guard
 *
 * Before any data reaches an external AI provider, it must be passed through
 * sanitizeForAI(). This strips all real PII and replaces it with opaque
 * reference codes. The AI only sees role categories, counts, and control
 * metadata — never personal details.
 *
 * Fields that MUST NEVER reach the AI:
 *   - Name (first, last, full)
 *   - Email address
 *   - Phone number
 *   - Salary / compensation figures
 *   - Medical or disability flags
 *   - Authentication tokens / secrets
 *   - Complaint or grievance free-text (unless it contains only work-objective info)
 *   - National IDs, bank details
 */

export interface EmployeeRef {
  id: string;
  role?: string | null;
  designation?: string | null;
  departmentName?: string | null;
}

export interface SanitizedEmployee {
  ref: string;
  roleCategory: string;
  department: string;
}

const PROHIBITED_FIELDS = new Set([
  "firstName", "first_name",
  "lastName", "last_name",
  "fullName", "full_name",
  "name",
  "email",
  "phone",
  "salary",
  "basicSalary", "basic_salary",
  "grossSalary", "gross_salary",
  "netPayable", "net_payable",
  "compensation",
  "esiDisability", "esi_disability",
  "medicalFlag", "medical_flag",
  "disability",
  "totpSecret", "totp_secret",
  "password",
  "passwordResetToken", "password_reset_token",
  "accountNumber", "account_number",
  "ifscCode", "ifsc_code",
  "bankName", "bank_name",
  "nationalId", "national_id",
  "panNumber", "pan_number",
  "aadhar",
  "grievanceText", "grievance_text",
  "complainText", "complain_text",
]);

/**
 * Sanitize a single employee record for safe AI consumption.
 * Returns a SanitizedEmployee with an opaque reference code.
 */
export function sanitizeEmployee(
  emp: EmployeeRef,
  counter: number,
): SanitizedEmployee {
  const ref = `EMP-${counter.toString().padStart(3, "0")}`;
  const roleCategory = mapRoleToCategory(emp.role ?? null);
  const department = emp.departmentName ? sanitizeDepartment(emp.departmentName) : "Unknown";
  return { ref, roleCategory, department };
}

/**
 * Strip all prohibited PII fields from a plain object before it reaches AI.
 * Works recursively on nested objects and arrays.
 * Returns a deep copy with prohibited fields replaced by "[REDACTED]".
 */
export function sanitizeObjectForAI(
  data: unknown,
  path = "",
): unknown {
  if (data === null || data === undefined) return data;
  if (Array.isArray(data)) {
    return data.map((item, i) => sanitizeObjectForAI(item, `${path}[${i}]`));
  }
  if (typeof data === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (PROHIBITED_FIELDS.has(key)) {
        out[key] = "[REDACTED]";
      } else {
        out[key] = sanitizeObjectForAI(value, `${path}.${key}`);
      }
    }
    return out;
  }
  return data;
}

/**
 * Assert no prohibited field names exist in a JSON string (for unit testing).
 * Returns an array of prohibited fields found (empty = clean).
 */
export function auditPromptForPII(promptText: string): string[] {
  const found: string[] = [];
  for (const field of PROHIBITED_FIELDS) {
    const pattern = new RegExp(`\\b${field}\\b`, "i");
    if (pattern.test(promptText)) {
      found.push(field);
    }
  }
  const emailPattern = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/;
  if (emailPattern.test(promptText)) found.push("__email_address__");
  const phonePattern = /\b\d{10}\b|\+\d{10,13}\b/;
  if (phonePattern.test(promptText)) found.push("__phone_number__");
  return found;
}

export function mapRoleToCategory(role: string | null): string {
  if (!role) return "staff";
  const map: Record<string, string> = {
    super_admin: "leadership",
    admin: "leadership",
    hr: "hr",
    finance: "finance",
    operations: "operations",
    manager: "manager",
    recruiter: "recruiter",
    employee: "staff",
    executive: "executive",
  };
  return map[role] ?? "staff";
}

function sanitizeDepartment(dept: string): string {
  return dept.replace(/\s+\d+/g, "").trim().substring(0, 50);
}

/**
 * Redact likely PII patterns from free text before including in AI prompts.
 * Strips email addresses, phone numbers, and common name-prefixed patterns.
 * This is a best-effort defence — do NOT rely on it as the only PII control;
 * use anonymised structural data wherever possible instead of free text.
 */
export function redactFreeTextForAI(text: string): string {
  if (!text) return "";
  return text
    .replace(/\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g, "[EMAIL]")
    .replace(/\b(\+91|0)?[6-9]\d{9}\b/g, "[PHONE]")
    .replace(/\b(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[PHONE]")
    .replace(/\b(Mr|Mrs|Ms|Dr|Prof)\.?\s+[A-Z][a-z]+([\s\-'][A-Z][a-z]+)*/g, "[NAME]")
    .replace(/\b[A-Z][a-z]{2,}\s+[A-Z][a-z]{2,}(\s+[A-Z][a-z]{2,})?\b/g, "[NAME]");
}

export interface GovernanceControlSummary {
  controlType: string;
  roleCategory: string;
  department: string;
  daysOverdue: number;
  escalationLevel: number;
  status: string;
  requiredAction: string;
}

/**
 * Build an anonymized summary of a governance control record.
 * This is the ONLY shape that should ever be passed to an AI prompt.
 */
export function buildAnonymizedControlSummary(opts: {
  controlType: string;
  roleCategory: string;
  department: string;
  dueDate: string;
  escalationLevel: number;
  status: string;
  requiredAction: string;
}): GovernanceControlSummary {
  const dueMs = new Date(opts.dueDate).getTime();
  const nowMs = Date.now();
  const daysOverdue = Math.max(0, Math.floor((nowMs - dueMs) / 86400000));
  return {
    controlType: opts.controlType,
    roleCategory: opts.roleCategory,
    department: opts.department,
    daysOverdue,
    escalationLevel: opts.escalationLevel,
    status: opts.status,
    requiredAction: redactFreeTextForAI(opts.requiredAction).substring(0, 120),
  };
}
