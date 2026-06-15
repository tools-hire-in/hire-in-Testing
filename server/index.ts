import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { startScheduler } from "./scheduler";
import { checkAndAutoCreateRun } from "./attendanceReport";
import { db, runMigrations } from "./db";
import { seedUniversalPolicies } from "./onboardingSeed";
import { adminUsers, holidays, attendance, regionalHolidaySelections, hrLetters } from "@shared/schema";
import { isNull, eq, or, and, gte, lte, inArray, sql } from "drizzle-orm";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

async function ensurePerformanceTables() {
  // Always run signed_version migration regardless of whether performance tables exist
  try {
    await db.execute(sql`ALTER TABLE track_assignments ADD COLUMN IF NOT EXISTS signed_version INTEGER`);
    await db.execute(sql`ALTER TABLE track_completions ADD COLUMN IF NOT EXISTS signed_version INTEGER`);
    await db.execute(sql`ALTER TABLE section_acknowledgements ADD COLUMN IF NOT EXISTS signed_version INTEGER`);
    log("signed_version columns ensured on track_assignments, track_completions, section_acknowledgements");
  } catch (err) {
    console.error("signed_version column migration error:", err);
  }

  // Always ensure rayo_academy_track_id column exists (added after initial table creation)
  try {
    await db.execute(sql`ALTER TABLE performance_goals ADD COLUMN IF NOT EXISTS rayo_academy_track_id varchar`);
    log("Ensured rayo_academy_track_id column exists on performance_goals");
  } catch (err) {
    console.error("performance_goals rayo_academy_track_id column migration error:", err);
  }

  // Ensure source_ref column exists on performance_goals (for addendum goal traceability)
  try {
    await db.execute(sql`ALTER TABLE performance_goals ADD COLUMN IF NOT EXISTS source_ref varchar`);
    log("Ensured source_ref column exists on performance_goals");
  } catch (err) {
    console.error("performance_goals source_ref column migration error:", err);
  }

  // Ensure notes column exists on performance_goals (employee self-update via My Plan view)
  try {
    await db.execute(sql`ALTER TABLE performance_goals ADD COLUMN IF NOT EXISTS notes TEXT`);
    log("Ensured notes column exists on performance_goals");
  } catch (err) {
    console.error("performance_goals notes column migration error:", err);
  }

  try {
    const result = await db.execute(sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'performance_goals'
    `);
    if (result.rows.length > 0) return;

    log("Creating performance management tables...");

    await db.execute(sql`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'performance_goal_status') THEN
        CREATE TYPE performance_goal_status AS ENUM ('not_started', 'in_progress', 'completed', 'cancelled');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'performance_goal_category') THEN
        CREATE TYPE performance_goal_category AS ENUM ('individual', 'team', 'company', 'development');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'check_in_status') THEN
        CREATE TYPE check_in_status AS ENUM ('scheduled', 'completed', 'cancelled');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'review_cycle_type') THEN
        CREATE TYPE review_cycle_type AS ENUM ('annual', 'semi_annual', 'quarterly');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'review_cycle_status') THEN
        CREATE TYPE review_cycle_status AS ENUM ('draft', 'active', 'in_review', 'closed');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'review_type') THEN
        CREATE TYPE review_type AS ENUM ('self', 'manager');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'review_status') THEN
        CREATE TYPE review_status AS ENUM ('pending', 'submitted');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'feedback_type') THEN
        CREATE TYPE feedback_type AS ENUM ('praise', 'constructive', 'general');
      END IF;
    END $$`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS performance_goals (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id VARCHAR NOT NULL REFERENCES admin_users(id),
        manager_id VARCHAR REFERENCES admin_users(id),
        title VARCHAR NOT NULL,
        description TEXT,
        category performance_goal_category NOT NULL DEFAULT 'individual',
        start_date VARCHAR,
        target_date VARCHAR,
        weight INTEGER DEFAULT 0,
        status performance_goal_status NOT NULL DEFAULT 'not_started',
        progress INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS check_ins (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id VARCHAR NOT NULL REFERENCES admin_users(id),
        manager_id VARCHAR REFERENCES admin_users(id),
        scheduled_date VARCHAR NOT NULL,
        status check_in_status NOT NULL DEFAULT 'scheduled',
        employee_notes TEXT,
        manager_notes TEXT,
        action_items TEXT,
        rating INTEGER,
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS review_cycles (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR NOT NULL,
        start_date VARCHAR NOT NULL,
        end_date VARCHAR NOT NULL,
        type review_cycle_type NOT NULL DEFAULT 'annual',
        status review_cycle_status NOT NULL DEFAULT 'draft',
        created_by VARCHAR REFERENCES admin_users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS reviews (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        cycle_id VARCHAR NOT NULL REFERENCES review_cycles(id),
        employee_id VARCHAR NOT NULL REFERENCES admin_users(id),
        reviewer_id VARCHAR NOT NULL REFERENCES admin_users(id),
        type review_type NOT NULL DEFAULT 'self',
        goals_reflection TEXT,
        strengths TEXT,
        improvements TEXT,
        development_needs TEXT,
        rating INTEGER,
        comments TEXT,
        status review_status NOT NULL DEFAULT 'pending',
        submitted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS performance_feedback (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        from_employee_id VARCHAR NOT NULL REFERENCES admin_users(id),
        to_employee_id VARCHAR NOT NULL REFERENCES admin_users(id),
        type feedback_type NOT NULL DEFAULT 'general',
        message TEXT NOT NULL,
        goal_id VARCHAR REFERENCES performance_goals(id),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    log("Performance management tables created successfully");
  } catch (err) {
    console.error("Performance tables migration error:", err);
  }

  try {
    const extResult = await db.execute(sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'training_extension_requests'
    `);
    if (extResult.rows.length === 0) {
      log("Creating training_extension_requests table...");
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS training_extension_requests (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          assignment_id VARCHAR NOT NULL REFERENCES track_assignments(id),
          user_id VARCHAR NOT NULL REFERENCES admin_users(id),
          requested_by_id VARCHAR NOT NULL REFERENCES admin_users(id),
          reason TEXT NOT NULL,
          new_due_date TIMESTAMP NOT NULL,
          status VARCHAR NOT NULL DEFAULT 'pending',
          endorsed_by_id VARCHAR REFERENCES admin_users(id),
          endorsed_at TIMESTAMP,
          endorser_comment TEXT,
          resolved_by_id VARCHAR REFERENCES admin_users(id),
          resolved_at TIMESTAMP,
          resolver_comment TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      log("training_extension_requests table created successfully");
    }
    // Ensure new columns added by task #192
    await db.execute(sql`ALTER TABLE training_extension_requests ADD COLUMN IF NOT EXISTS request_type VARCHAR NOT NULL DEFAULT 'extension'`);
    await db.execute(sql`ALTER TABLE track_assignments ADD COLUMN IF NOT EXISTS exception_granted_by_id VARCHAR REFERENCES admin_users(id)`);
    await db.execute(sql`ALTER TABLE track_assignments ADD COLUMN IF NOT EXISTS exception_granted_at TIMESTAMP`);
    await db.execute(sql`ALTER TABLE track_assignments ADD COLUMN IF NOT EXISTS exception_reason TEXT`);
  } catch (err) {
    console.error("Training extension requests table migration error:", err);
  }

}

async function ensureGoalMilestonesAndLinks() {
  try {
    await db.execute(sql`ALTER TABLE performance_goals ADD COLUMN IF NOT EXISTS auto_progress_from_milestones boolean NOT NULL DEFAULT false`);
    await db.execute(sql`ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS goal_id varchar REFERENCES performance_goals(id) ON DELETE SET NULL`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS goal_milestones (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        goal_id VARCHAR NOT NULL REFERENCES performance_goals(id) ON DELETE CASCADE,
        title VARCHAR NOT NULL,
        target_date VARCHAR,
        done BOOLEAN NOT NULL DEFAULT false,
        completed_at TIMESTAMP,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS goal_milestones_goal_id_idx ON goal_milestones(goal_id)`);
    log("Ensured goal_milestones table, check_ins.goal_id, and performance_goals.auto_progress_from_milestones");
  } catch (err) {
    console.error("goal milestones / links migration error:", err);
  }
}

async function ensureHrLettersTables() {
  try {
    log("Ensuring HR letters enum types, table, and indexes...");

    await db.execute(sql`DO $$ BEGIN
      CREATE TYPE "hr_letter_template_type" AS ENUM ('experience', 'internship_completion', 'internship_certificate', 'relieving');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$`);

    await db.execute(sql`DO $$ BEGIN
      CREATE TYPE "hr_letter_status" AS ENUM ('draft', 'pending_approval', 'approved', 'issued', 'reissued', 'revoked');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$`);

    await db.execute(sql`DO $$ BEGIN
      CREATE TYPE "hr_letter_performance_band" AS ENUM ('factual_only', 'standard', 'good', 'very_good', 'excellent');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$`);

    await db.execute(sql`DO $$ BEGIN
      CREATE TYPE "hr_letter_conduct_band" AS ENUM ('standard', 'good', 'very_good');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$`);

    await db.execute(sql`DO $$ BEGIN
      CREATE TYPE "hr_letter_completion_band" AS ENUM ('successfully_completed', 'completed', 'served_during_period');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "hr_letters" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "template_type" "hr_letter_template_type" NOT NULL,
        "status" "hr_letter_status" DEFAULT 'draft' NOT NULL,
        "employee_id" varchar,
        "employee_name" varchar NOT NULL,
        "employee_code" varchar,
        "designation" varchar NOT NULL,
        "department" varchar,
        "employment_type" varchar,
        "location" varchar,
        "reporting_manager" varchar,
        "start_date" varchar NOT NULL,
        "end_date" varchar,
        "last_working_day" varchar,
        "performance_band" "hr_letter_performance_band",
        "conduct_band" "hr_letter_conduct_band",
        "completion_band" "hr_letter_completion_band",
        "closing_line" varchar DEFAULT 'wish_success',
        "include_responsibilities" boolean DEFAULT false,
        "responsibilities_summary" text,
        "include_project" boolean DEFAULT false,
        "project_name" varchar,
        "include_seal" boolean DEFAULT false,
        "signatory_id" varchar,
        "signatory_name" varchar,
        "signatory_designation" varchar,
        "issue_date" varchar,
        "reference_number" varchar UNIQUE,
        "auth_code" varchar,
        "document_hash" varchar,
        "pdf_path" varchar,
        "custom_override_text" text,
        "custom_override_by" varchar,
        "custom_override_at" timestamp,
        "created_by" varchar NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "approved_by" varchar,
        "approved_at" timestamp,
        "issued_by" varchar,
        "issued_at" timestamp,
        "revoked_by" varchar,
        "revoked_at" timestamp,
        "revoke_reason" text,
        "reissued_from_letter_id" varchar,
        "reissue_reason" text
      )
    `);

    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS hr_letters_reference_number_idx ON hr_letters(reference_number)
    `);

    await db.execute(sql`
      ALTER TABLE hr_letters ADD COLUMN IF NOT EXISTS cc_emails TEXT
    `);

    log("HR letters enum types, table, and indexes ensured successfully");
  } catch (err) {
    console.error("HR letters table migration error:", err);
  }
}

async function ensureHrLetterAmendmentTypes() {
  try {
    await db.execute(sql`ALTER TYPE hr_letter_template_type ADD VALUE IF NOT EXISTS 'salary_revision'`);
    await db.execute(sql`ALTER TYPE hr_letter_template_type ADD VALUE IF NOT EXISTS 'role_change'`);
    await db.execute(sql`ALTER TYPE hr_letter_template_type ADD VALUE IF NOT EXISTS 'combined'`);
    await db.execute(sql`ALTER TYPE hr_letter_template_type ADD VALUE IF NOT EXISTS 'device_allocation'`);
    await db.execute(sql`ALTER TABLE hr_letters ADD COLUMN IF NOT EXISTS metadata JSONB`);
    await db.execute(sql`ALTER TABLE hr_letters ADD COLUMN IF NOT EXISTS manual_employee_email VARCHAR`);
    log("HR letter amendment types and columns ensured");
  } catch (err) {
    console.error("HR letter amendment types migration error:", err);
  }
}

async function ensureOfferLetterApprovalColumns() {
  try {
    await db.execute(sql`ALTER TABLE offer_letters ADD COLUMN IF NOT EXISTS approved_by VARCHAR REFERENCES admin_users(id)`);
    await db.execute(sql`ALTER TABLE offer_letters ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP`);
    await db.execute(sql`ALTER TABLE offer_letters ADD COLUMN IF NOT EXISTS approval_rejection_reason TEXT`);
    log("Ensured offer_letters approval columns exist");
  } catch (err) {
    console.error("offer_letters approval columns migration error:", err);
  }

  try {
    await db.execute(sql`ALTER TABLE hr_letters ADD COLUMN IF NOT EXISTS annexure_data JSONB`);
    await db.execute(sql`ALTER TABLE offer_letters ADD COLUMN IF NOT EXISTS annexure_data JSONB`);
    log("Ensured annexure_data columns exist on hr_letters and offer_letters");
  } catch (err) {
    console.error("annexure_data migration error:", err);
  }

  try {
    await db.execute(sql`ALTER TABLE offer_letters ADD COLUMN IF NOT EXISTS policy_annexures TEXT[]`);
    log("Ensured policy_annexures column exists on offer_letters");
  } catch (err) {
    console.error("offer_letters policy_annexures column migration error:", err);
  }

  try {
    await db.execute(sql`ALTER TABLE offer_letters ADD COLUMN IF NOT EXISTS seed_probation_plan BOOLEAN NOT NULL DEFAULT false`);
    log("Ensured seed_probation_plan column exists on offer_letters");
  } catch (err) {
    console.error("offer_letters seed_probation_plan column migration error:", err);
  }
}

async function ensureOfferLetterAddendumsTable() {
  try {
    const result = await db.execute(sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'offer_letter_addendums'
    `);
    if (result.rows.length > 0) {
      await db.execute(sql`
        ALTER TABLE offer_letter_addendums ADD COLUMN IF NOT EXISTS device_items JSONB
      `);
      await db.execute(sql`
        ALTER TABLE offer_letter_addendums ADD COLUMN IF NOT EXISTS annexures JSONB
      `);
      await db.execute(sql`
        ALTER TABLE offer_letter_addendums ADD COLUMN IF NOT EXISTS cc_emails TEXT
      `);
      await db.execute(sql`
        ALTER TABLE offer_letter_addendums ADD COLUMN IF NOT EXISTS for_employee_id VARCHAR REFERENCES admin_users(id)
      `);
      await db.execute(sql`
        ALTER TABLE offer_letter_addendums ADD COLUMN IF NOT EXISTS is_standalone BOOLEAN NOT NULL DEFAULT false
      `);
      await db.execute(sql`
        ALTER TABLE offer_letter_addendums ADD COLUMN IF NOT EXISTS manual_employee_data JSONB
      `);
      await db.execute(sql`
        ALTER TABLE offer_letters ADD COLUMN IF NOT EXISTS cc_emails TEXT
      `);
      return;
    }

    log("Creating offer_letter_addendums table...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS offer_letter_addendums (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        offer_letter_id VARCHAR NOT NULL REFERENCES offer_letters(id),
        is_standalone BOOLEAN NOT NULL DEFAULT false,
        manual_employee_data JSONB,
        token VARCHAR NOT NULL UNIQUE,
        addendum_type VARCHAR NOT NULL,
        status VARCHAR NOT NULL DEFAULT 'draft',
        old_designation VARCHAR,
        new_designation VARCHAR,
        old_department VARCHAR,
        new_department VARCHAR,
        old_salary VARCHAR,
        new_salary VARCHAR,
        old_salary_in_words VARCHAR,
        new_salary_in_words VARCHAR,
        old_confirmation_date VARCHAR,
        new_confirmation_date VARCHAR,
        custom_clause_title VARCHAR,
        custom_clause_text TEXT,
        device_items JSONB,
        annexures JSONB,
        cc_emails TEXT,
        for_employee_id VARCHAR REFERENCES admin_users(id),
        effective_date VARCHAR,
        reason TEXT,
        hr_manager_name VARCHAR,
        issued_by VARCHAR REFERENCES admin_users(id),
        issued_at TIMESTAMP,
        candidate_name VARCHAR NOT NULL,
        accepted_at TIMESTAMP,
        accepted_ip VARCHAR,
        accepted_name VARCHAR,
        auth_code VARCHAR,
        document_hash VARCHAR,
        counter_signed_by VARCHAR REFERENCES admin_users(id),
        counter_signed_at TIMESTAMP,
        counter_auth_code VARCHAR,
        counter_document_hash VARCHAR,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    log("offer_letter_addendums table created successfully");
    await db.execute(sql`
      ALTER TABLE offer_letters ADD COLUMN IF NOT EXISTS cc_emails TEXT
    `);
  } catch (err) {
    console.error("Offer letter addendums table migration error:", err);
  }
}

async function backfillEmployeeIds() {
  try {
    const usersWithoutId = await db
      .select({ id: adminUsers.id, joiningDate: adminUsers.joiningDate })
      .from(adminUsers)
      .where(or(isNull(adminUsers.employeeId), eq(adminUsers.employeeId, "")));

    if (usersWithoutId.length === 0) return;

    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (const u of usersWithoutId) {
      const dateStr = u.joiningDate
        ? u.joiningDate.replace(/-/g, "")
        : new Date().toISOString().slice(0, 10).replace(/-/g, "");
      let random4 = "";
      for (let i = 0; i < 4; i++) {
        random4 += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      const empId = `HIS-GEN${dateStr}-${random4}`;
      await db.update(adminUsers).set({ employeeId: empId }).where(eq(adminUsers.id, u.id));
    }
    log(`Backfilled employee IDs for ${usersWithoutId.length} user(s)`);
  } catch (err) {
    console.error("Employee ID backfill error:", err);
  }
}

async function backfillHrLetterNames() {
  try {
    const blankNameLetters = await db
      .select({ id: hrLetters.id, employeeId: hrLetters.employeeId })
      .from(hrLetters)
      .where(or(isNull(hrLetters.employeeName), sql`trim(${hrLetters.employeeName}) = ''`));

    if (blankNameLetters.length === 0) return;

    let fixed = 0;
    for (const letter of blankNameLetters) {
      if (!letter.employeeId) continue;
      const [employee] = await db
        .select({ firstName: adminUsers.firstName, lastName: adminUsers.lastName })
        .from(adminUsers)
        .where(eq(adminUsers.id, letter.employeeId));
      if (!employee) continue;
      const fullName = `${employee.firstName} ${employee.lastName}`.trim();
      if (!fullName) continue;
      await db.update(hrLetters).set({ employeeName: fullName }).where(eq(hrLetters.id, letter.id));
      fixed++;
    }
    if (fixed > 0) {
      log(`Backfilled employee names for ${fixed} HR letter(s) with blank names`);
    }
  } catch (err) {
    console.error("HR letter name backfill error:", err);
  }
}

async function ensureShiftTables() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS shifts (
        id VARCHAR PRIMARY KEY,
        name VARCHAR NOT NULL,
        display_label VARCHAR NOT NULL,
        us_coverage VARCHAR NOT NULL,
        ist_start_dst VARCHAR NOT NULL,
        ist_end_dst VARCHAR NOT NULL,
        ist_start_std VARCHAR NOT NULL,
        ist_end_std VARCHAR NOT NULL,
        scheduled_hours INTEGER NOT NULL DEFAULT 9,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.execute(sql`ALTER TABLE shifts ADD COLUMN IF NOT EXISTS grace_period_minutes INTEGER DEFAULT 15`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS dst_config (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        year INTEGER NOT NULL UNIQUE,
        spring_forward_date VARCHAR NOT NULL,
        fall_back_date VARCHAR NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.execute(sql`ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS shift_id VARCHAR REFERENCES shifts(id)`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS shift_assignment_log (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES admin_users(id),
        changed_by_id VARCHAR NOT NULL REFERENCES admin_users(id),
        old_shift_id VARCHAR REFERENCES shifts(id),
        new_shift_id VARCHAR REFERENCES shifts(id),
        reason TEXT NOT NULL,
        changed_at TIMESTAMP DEFAULT NOW()
      )
    `);
    log("Shift tables ensured");
  } catch (err) {
    console.error("Shift tables migration error:", err);
  }
}

async function ensureNightShiftConsentsTable() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS night_shift_consents (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES admin_users(id),
        signed_at TIMESTAMP NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMP NOT NULL,
        typed_name VARCHAR NOT NULL,
        ip_address VARCHAR,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        document_hash VARCHAR,
        created_at TIMESTAMP DEFAULT NOW(),
        status VARCHAR NOT NULL DEFAULT 'active',
        withdrawn_at TIMESTAMP,
        version INTEGER NOT NULL DEFAULT 1
      )
    `);
    log("night_shift_consents table ensured");
  } catch (err) {
    console.error("night_shift_consents migration error:", err);
  }
}

async function seedShiftData() {
  try {
    await db.execute(sql`
      INSERT INTO shifts (id, name, display_label, us_coverage, ist_start_dst, ist_end_dst, ist_start_std, ist_end_std, scheduled_hours)
      VALUES
        ('SHIFT_A', 'SHIFT_A', 'Shift A – East Coast', 'East Coast', '18:30', '03:30', '19:30', '04:30', 9),
        ('SHIFT_B', 'SHIFT_B', 'Shift B – West Coast', 'West Coast', '20:30', '05:30', '21:30', '06:30', 9),
        ('SHIFT_C', 'SHIFT_C', 'Shift C – Dual Coast', 'Dual Coast', '19:30', '04:30', '20:30', '05:30', 9)
      ON CONFLICT (id) DO NOTHING
    `);

    const dstYears = [
      { year: 2026, spring: "2026-03-08", fall: "2026-11-01" },
      { year: 2027, spring: "2027-03-14", fall: "2027-11-07" },
      { year: 2028, spring: "2028-03-12", fall: "2028-11-05" },
      { year: 2029, spring: "2029-03-11", fall: "2029-11-04" },
      { year: 2030, spring: "2030-03-10", fall: "2030-11-03" },
    ];
    for (const d of dstYears) {
      await db.execute(sql`
        INSERT INTO dst_config (year, spring_forward_date, fall_back_date)
        VALUES (${d.year}, ${d.spring}, ${d.fall})
        ON CONFLICT (year) DO NOTHING
      `);
    }
    log("Shift seed data ensured");
  } catch (err) {
    console.error("Shift seed data error:", err);
  }
}

// One-time idempotent corrections: HR-directed balance adjustments and historical
// leave request inserts. Previously hardcoded in the backfill engine — moved here
// so they run automatically on deploy and never need to live in application code again.
async function applyOneTimeLeaveCorrections() {
  try {
    // EL = is_conditional=true, not occurrence_based, not lwp/comp
    // SL = is_conditional=false, not occurrence_based, not lwp/comp
    // Delete any stale hr_adjustment rows for the affected employees so corrected
    // values can be inserted cleanly (idempotent DELETE — safe to run repeatedly)
    const staleEmployees = [
      { firstName: "Ayushi", lastName: "Tiwari" },
      { firstName: "Maheep", lastName: "Singh" },
      { firstName: "Aditya", lastName: "Gangwar" },
      { firstName: "Anurag", lastName: "Kumar" },
    ];
    for (const emp of staleEmployees) {
      // Only delete the historical startup-correction rows — identified by their specific
      // skip_reason. Endpoint-made rows (skip_reason 'HR manual adjustment:…' at month=0)
      // are never touched by this startup script.
      await db.execute(sql`
        DELETE FROM leave_accruals
        WHERE year = 2026 AND month = 99 AND accrual_type = 'hr_adjustment'
          AND skip_reason = 'Historical leave balance correction — HR directive'
          AND user_id IN (
            SELECT id FROM admin_users
            WHERE first_name = ${emp.firstName} AND last_name = ${emp.lastName} AND deleted_at IS NULL
          )
      `);
    }

    // Ayushi Tiwari: no adjustment needed (both corrections are 0 — no row inserted)
    const hrAdjustments = [
      { firstName: "Maheep",  lastName: "Singh",   elCorrection: "-2", slCorrection: "-2" },
      { firstName: "Aditya",  lastName: "Gangwar", elCorrection: "-3", slCorrection: "-1" },
      { firstName: "Anurag",  lastName: "Kumar",   elCorrection: "-4", slCorrection: "-3" },
    ];

    for (const adj of hrAdjustments) {
      // EL adjustment
      await db.execute(sql`
        INSERT INTO leave_accruals (user_id, leave_type_id, year, month, accrued_days, hours_worked, qualified, accrual_type, skip_reason)
        SELECT u.id, lt.id, 2026, 99, ${adj.elCorrection}, '0', true, 'hr_adjustment', 'Historical leave balance correction — HR directive'
        FROM admin_users u
        JOIN leave_types lt ON lt.is_conditional = true AND lt.is_active = true AND lt.occurrence_based = false
          AND lt.name NOT ILIKE '%lwp%' AND lt.name NOT ILIKE '%loss%' AND lt.name NOT ILIKE '%comp%'
        WHERE u.first_name = ${adj.firstName} AND u.last_name = ${adj.lastName} AND u.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM leave_accruals la2
          WHERE la2.user_id = u.id AND la2.leave_type_id = lt.id
          AND la2.year = 2026 AND la2.month = 99 AND la2.accrual_type = 'hr_adjustment'
        )
      `);
      // SL adjustment
      await db.execute(sql`
        INSERT INTO leave_accruals (user_id, leave_type_id, year, month, accrued_days, hours_worked, qualified, accrual_type, skip_reason)
        SELECT u.id, lt.id, 2026, 99, ${adj.slCorrection}, '0', true, 'hr_adjustment', 'Historical leave balance correction — HR directive'
        FROM admin_users u
        JOIN leave_types lt ON lt.is_conditional = false AND lt.is_active = true AND lt.occurrence_based = false
          AND lt.name NOT ILIKE '%lwp%' AND lt.name NOT ILIKE '%loss%' AND lt.name NOT ILIKE '%comp%'
        WHERE u.first_name = ${adj.firstName} AND u.last_name = ${adj.lastName} AND u.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM leave_accruals la2
          WHERE la2.user_id = u.id AND la2.leave_type_id = lt.id
          AND la2.year = 2026 AND la2.month = 99 AND la2.accrual_type = 'hr_adjustment'
        )
      `);
    }

    // Reconcile leave_balances totals for all 4 affected employees (year 2026)
    // Recompute totalDays from qualified accruals and overwrite — usedDays is untouched.
    const balanceEmployees = [
      { firstName: "Ayushi", lastName: "Tiwari" },
      { firstName: "Maheep", lastName: "Singh" },
      { firstName: "Aditya", lastName: "Gangwar" },
      { firstName: "Anurag", lastName: "Kumar" },
    ];
    for (const emp of balanceEmployees) {
      await db.execute(sql`
        UPDATE leave_balances lb
        SET total_days = sub.computed_total
        FROM (
          SELECT la.user_id, la.leave_type_id,
                 COALESCE(SUM(la.accrued_days), 0) AS computed_total
          FROM leave_accruals la
          JOIN admin_users u ON u.id = la.user_id
          WHERE u.first_name = ${emp.firstName} AND u.last_name = ${emp.lastName}
            AND u.deleted_at IS NULL
            AND la.year = 2026
            AND la.qualified = true
          GROUP BY la.user_id, la.leave_type_id
        ) sub
        WHERE lb.user_id = sub.user_id
          AND lb.leave_type_id = sub.leave_type_id
          AND lb.year = 2026
      `);
    }

    // Historical leave request inserts (approved leaves missing from records)
    const historicalLeaves = [
      { firstName: "Sharad", lastName: "Kumar",       startDate: "2026-05-06", endDate: "2026-05-08", totalDays: "3.0",  halfDay: false },
      { firstName: "Mohd",   lastName: "Shafique Beg", startDate: "2026-05-16", endDate: "2026-05-16", totalDays: "0.5",  halfDay: true  },
    ];

    for (const req of historicalLeaves) {
      await db.execute(sql`
        INSERT INTO leave_requests (user_id, leave_type_id, start_date, end_date, total_days, half_day, reason, status, reviewed_at)
        SELECT u.id, lt.id, ${req.startDate}, ${req.endDate}, ${req.totalDays}, ${req.halfDay},
          'Historical leave — imported from attendance record', 'approved', NOW()
        FROM admin_users u
        JOIN leave_types lt ON lt.is_conditional = true AND lt.is_active = true AND lt.occurrence_based = false
          AND lt.name NOT ILIKE '%lwp%' AND lt.name NOT ILIKE '%loss%' AND lt.name NOT ILIKE '%comp%'
        WHERE u.first_name = ${req.firstName} AND u.last_name = ${req.lastName} AND u.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM leave_requests lr2
          WHERE lr2.user_id = u.id AND lr2.start_date = ${req.startDate}
          AND lr2.end_date = ${req.endDate} AND lr2.status = 'approved'
        )
      `);
    }

    // ── Ayushi Tiwari: zero out EL and SL balances for 2026 ─────────────────
    // Guard: only apply if the sentinel hr_adjustment row (month=98) doesn't exist yet.
    // We use month=98 to distinguish from the historical corrections above (month=99).
    const ayushiGuardEL = await db.execute(sql`
      SELECT la.id FROM leave_accruals la
      JOIN admin_users u ON u.id = la.user_id
      WHERE u.first_name = 'Ayushi' AND u.last_name = 'Tiwari' AND u.deleted_at IS NULL
        AND la.year = 2026 AND la.month = 98 AND la.accrual_type = 'hr_adjustment'
        AND la.skip_reason = 'Ayushi zero-out correction'
      LIMIT 1
    `);
    if (ayushiGuardEL.rows.length === 0) {
      // Query current EL and SL totalDays for Ayushi in 2026
      const ayushiELBal = await db.execute(sql`
        SELECT lb.id, lb.total_days, lb.used_days FROM leave_balances lb
        JOIN admin_users u ON u.id = lb.user_id
        JOIN leave_types lt ON lt.id = lb.leave_type_id
        WHERE u.first_name = 'Ayushi' AND u.last_name = 'Tiwari' AND u.deleted_at IS NULL
          AND lt.is_conditional = true AND lt.is_active = true AND lt.occurrence_based = false
          AND lt.name NOT ILIKE '%lwp%' AND lt.name NOT ILIKE '%loss%' AND lt.name NOT ILIKE '%comp%'
          AND lb.year = 2026
        LIMIT 1
      `);
      const ayushiSLBal = await db.execute(sql`
        SELECT lb.id, lb.total_days, lb.used_days FROM leave_balances lb
        JOIN admin_users u ON u.id = lb.user_id
        JOIN leave_types lt ON lt.id = lb.leave_type_id
        WHERE u.first_name = 'Ayushi' AND u.last_name = 'Tiwari' AND u.deleted_at IS NULL
          AND lt.is_conditional = false AND lt.is_active = true AND lt.occurrence_based = false
          AND lt.name NOT ILIKE '%lwp%' AND lt.name NOT ILIKE '%loss%' AND lt.name NOT ILIKE '%comp%'
          AND lb.year = 2026
        LIMIT 1
      `);

      // EL zero-out: insert negative hr_adjustment so future backfill sums to 0
      if (ayushiELBal.rows.length > 0) {
        const elTotal = parseFloat(String(ayushiELBal.rows[0].total_days));
        const elUsed = parseFloat(String(ayushiELBal.rows[0].used_days));
        // Target: totalDays = usedDays (balance = 0), so delta = usedDays - elTotal
        const elDelta = elUsed - elTotal;
        if (Math.abs(elDelta) >= 0.001 || elTotal > elUsed) {
          await db.execute(sql`
            INSERT INTO leave_accruals (user_id, leave_type_id, year, month, accrued_days, hours_worked, qualified, accrual_type, skip_reason)
            SELECT u.id, lt.id, 2026, 98, ${String(elDelta)}, '0', true, 'hr_adjustment', 'Ayushi zero-out correction'
            FROM admin_users u
            JOIN leave_types lt ON lt.is_conditional = true AND lt.is_active = true AND lt.occurrence_based = false
              AND lt.name NOT ILIKE '%lwp%' AND lt.name NOT ILIKE '%loss%' AND lt.name NOT ILIKE '%comp%'
            WHERE u.first_name = 'Ayushi' AND u.last_name = 'Tiwari' AND u.deleted_at IS NULL
          `);
          // Set totalDays = usedDays (balance = 0) in leave_balances
          await db.execute(sql`
            UPDATE leave_balances SET total_days = used_days
            WHERE id = ${String(ayushiELBal.rows[0].id)}
          `);
        }
      }
      // SL zero-out
      if (ayushiSLBal.rows.length > 0) {
        const slTotal = parseFloat(String(ayushiSLBal.rows[0].total_days));
        const slUsed = parseFloat(String(ayushiSLBal.rows[0].used_days));
        const slDelta = slUsed - slTotal;
        if (Math.abs(slDelta) >= 0.001 || slTotal > slUsed) {
          await db.execute(sql`
            INSERT INTO leave_accruals (user_id, leave_type_id, year, month, accrued_days, hours_worked, qualified, accrual_type, skip_reason)
            SELECT u.id, lt.id, 2026, 98, ${String(slDelta)}, '0', true, 'hr_adjustment', 'Ayushi zero-out correction'
            FROM admin_users u
            JOIN leave_types lt ON lt.is_conditional = false AND lt.is_active = true AND lt.occurrence_based = false
              AND lt.name NOT ILIKE '%lwp%' AND lt.name NOT ILIKE '%loss%' AND lt.name NOT ILIKE '%comp%'
            WHERE u.first_name = 'Ayushi' AND u.last_name = 'Tiwari' AND u.deleted_at IS NULL
          `);
          await db.execute(sql`
            UPDATE leave_balances SET total_days = used_days
            WHERE id = ${String(ayushiSLBal.rows[0].id)}
          `);
        }
      }
      log("Applied Ayushi Tiwari zero-out correction");
    }

    // ── Aditya Gangwar: floor EL totalDays at usedDays to fix -1 balance ────
    const adityaGuard = await db.execute(sql`
      SELECT la.id FROM leave_accruals la
      JOIN admin_users u ON u.id = la.user_id
      WHERE u.first_name = 'Aditya' AND u.last_name = 'Gangwar' AND u.deleted_at IS NULL
        AND la.year = 2026 AND la.month = 98 AND la.accrual_type = 'hr_adjustment'
        AND la.skip_reason = 'Aditya EL floor correction'
      LIMIT 1
    `);
    if (adityaGuard.rows.length === 0) {
      const adityaELBal = await db.execute(sql`
        SELECT lb.id, lb.total_days, lb.used_days FROM leave_balances lb
        JOIN admin_users u ON u.id = lb.user_id
        JOIN leave_types lt ON lt.id = lb.leave_type_id
        WHERE u.first_name = 'Aditya' AND u.last_name = 'Gangwar' AND u.deleted_at IS NULL
          AND lt.is_conditional = true AND lt.is_active = true AND lt.occurrence_based = false
          AND lt.name NOT ILIKE '%lwp%' AND lt.name NOT ILIKE '%loss%' AND lt.name NOT ILIKE '%comp%'
          AND lb.year = 2026
        LIMIT 1
      `);
      if (adityaELBal.rows.length > 0) {
        const elTotal = parseFloat(String(adityaELBal.rows[0].total_days));
        const elUsed = parseFloat(String(adityaELBal.rows[0].used_days));
        if (elTotal < elUsed) {
          const delta = elUsed - elTotal; // positive delta brings total up to used
          await db.execute(sql`
            INSERT INTO leave_accruals (user_id, leave_type_id, year, month, accrued_days, hours_worked, qualified, accrual_type, skip_reason)
            SELECT u.id, lt.id, 2026, 98, ${String(delta)}, '0', true, 'hr_adjustment', 'Aditya EL floor correction'
            FROM admin_users u
            JOIN leave_types lt ON lt.is_conditional = true AND lt.is_active = true AND lt.occurrence_based = false
              AND lt.name NOT ILIKE '%lwp%' AND lt.name NOT ILIKE '%loss%' AND lt.name NOT ILIKE '%comp%'
            WHERE u.first_name = 'Aditya' AND u.last_name = 'Gangwar' AND u.deleted_at IS NULL
          `);
          // Floor totalDays at usedDays so balance = 0 (non-negative)
          await db.execute(sql`
            UPDATE leave_balances SET total_days = used_days
            WHERE id = ${String(adityaELBal.rows[0].id)}
          `);
          log(`Applied Aditya Gangwar EL floor correction: totalDays ${elTotal} → ${elUsed} (usedDays)`);
        } else {
          // Already non-negative; insert guard row so we skip this block on future runs
          await db.execute(sql`
            INSERT INTO leave_accruals (user_id, leave_type_id, year, month, accrued_days, hours_worked, qualified, accrual_type, skip_reason)
            SELECT u.id, lt.id, 2026, 98, '0', '0', false, 'hr_adjustment', 'Aditya EL floor correction'
            FROM admin_users u
            JOIN leave_types lt ON lt.is_conditional = true AND lt.is_active = true AND lt.occurrence_based = false
              AND lt.name NOT ILIKE '%lwp%' AND lt.name NOT ILIKE '%loss%' AND lt.name NOT ILIKE '%comp%'
            WHERE u.first_name = 'Aditya' AND u.last_name = 'Gangwar' AND u.deleted_at IS NULL
            ON CONFLICT DO NOTHING
          `);
        }
      }
    }

    log("One-time leave corrections applied");
  } catch (err) {
    console.error("One-time leave corrections error:", err);
  }
}

async function backfillHolidayAttendance() {
  try {
    const currentYear = new Date().getFullYear();
    const startDate = `${currentYear}-01-01`;
    const endDate = `${currentYear}-12-31`;

    const allHolidays = await db.select().from(holidays)
      .where(and(gte(holidays.date, startDate), lte(holidays.date, endDate)));

    const publicHolidays = allHolidays.filter(h => h.type === "public" || h.type === "mandatory");
    const activeUsers = await db.select({ id: adminUsers.id }).from(adminUsers)
      .where(eq(adminUsers.isActive, true));

    let stamped = 0;

    for (const holiday of publicHolidays) {
      const existingRecords = await db.select({ userId: attendance.userId }).from(attendance)
        .where(and(eq(attendance.date, holiday.date), eq(attendance.status, "holiday")));
      const existingUserIds = new Set(existingRecords.map(r => r.userId));

      for (const user of activeUsers) {
        if (existingUserIds.has(user.id)) continue;
        const anyRecord = await db.select({ id: attendance.id }).from(attendance)
          .where(and(eq(attendance.userId, user.id), eq(attendance.date, holiday.date)));
        if (anyRecord.length > 0) continue;

        await db.insert(attendance).values({
          userId: user.id,
          date: holiday.date,
          status: "holiday",
          punchIn: null,
          punchOut: null,
          totalHours: "0",
          notes: "Auto-stamped holiday (backfill)",
        });
        stamped++;
      }
    }

    const regionalSelections = await db.select().from(regionalHolidaySelections)
      .where(eq(regionalHolidaySelections.year, currentYear));

    const activeUserIds = new Set(activeUsers.map(u => u.id));

    for (const sel of regionalSelections) {
      if (!activeUserIds.has(sel.userId)) continue;
      const holiday = allHolidays.find(h => h.id === sel.holidayId);
      if (!holiday) continue;

      const existing = await db.select({ id: attendance.id }).from(attendance)
        .where(and(eq(attendance.userId, sel.userId), eq(attendance.date, holiday.date)));
      if (existing.length > 0) continue;

      await db.insert(attendance).values({
        userId: sel.userId,
        date: holiday.date,
        status: "holiday",
        punchIn: null,
        punchOut: null,
        totalHours: "0",
        notes: "Auto-stamped regional holiday (backfill)",
      });
      stamped++;
    }

    if (stamped > 0) {
      log(`Backfilled ${stamped} holiday attendance record(s) for ${currentYear}`);
    }
  } catch (err) {
    console.error("Holiday attendance backfill error:", err);
  }
}

async function ensureHealthcarePlansTables() {
  try {
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE employee_plan_type AS ENUM('probation','growth','pip');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE employee_plan_dept_scope AS ENUM('healthcare');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE employee_plan_status AS ENUM('pending','active','completed','extended','closed');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE employee_plan_outcome AS ENUM('confirmed','extended','released','passed','terminated','rolled_over');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE check_in_type AS ENUM('milestone','weekly','pip_review','weekly_update');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS employee_plans (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id VARCHAR NOT NULL REFERENCES admin_users(id),
        manager_id VARCHAR REFERENCES admin_users(id),
        plan_type employee_plan_type NOT NULL,
        department_scope employee_plan_dept_scope NOT NULL DEFAULT 'healthcare',
        status employee_plan_status NOT NULL DEFAULT 'pending',
        outcome employee_plan_outcome,
        start_date VARCHAR NOT NULL,
        end_date VARCHAR NOT NULL,
        duration_days INTEGER NOT NULL,
        acknowledged_at TIMESTAMP,
        acknowledged_by VARCHAR REFERENCES admin_users(id),
        created_by VARCHAR NOT NULL REFERENCES admin_users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS plan_goal_templates (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        plan_type employee_plan_type NOT NULL,
        role_slug VARCHAR NOT NULL,
        department_scope employee_plan_dept_scope NOT NULL DEFAULT 'healthcare',
        goal_title VARCHAR NOT NULL,
        goal_category VARCHAR NOT NULL DEFAULT 'individual',
        goal_description TEXT,
        target_metric VARCHAR,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_plan_goal_templates_type_role ON plan_goal_templates(plan_type, role_slug)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_employee_plans_employee ON employee_plans(employee_id)`);

    await db.execute(sql`ALTER TABLE performance_goals ADD COLUMN IF NOT EXISTS plan_id VARCHAR`);
    await db.execute(sql`ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS plan_id VARCHAR`);
    await db.execute(sql`ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS check_in_type check_in_type DEFAULT 'milestone'`);
    await db.execute(sql`ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS review_scores JSONB`);

    // Add FK constraints for plan_id columns (idempotent via pg_constraint check)
    await db.execute(sql`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'performance_goals_plan_id_fkey') THEN
          ALTER TABLE performance_goals
            ADD CONSTRAINT performance_goals_plan_id_fkey
            FOREIGN KEY (plan_id) REFERENCES employee_plans(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);
    await db.execute(sql`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_ins_plan_id_fkey') THEN
          ALTER TABLE check_ins
            ADD CONSTRAINT check_ins_plan_id_fkey
            FOREIGN KEY (plan_id) REFERENCES employee_plans(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    // Unique index ensures idempotent upsert seeding — admin edits are never overwritten
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_plan_goal_templates_unique
      ON plan_goal_templates (plan_type, role_slug, goal_title)
    `);

    // Allow employee_id to be null so a pending plan can be created at offer acceptance (before onboarding)
    await db.execute(sql`ALTER TABLE employee_plans ALTER COLUMN employee_id DROP NOT NULL`);
    // Track which offer letter this plan originated from (for lifecycle linking)
    await db.execute(sql`ALTER TABLE employee_plans ADD COLUMN IF NOT EXISTS offer_letter_id VARCHAR`);

    // notified_at: tracks when day-before employee reminder was sent (prevents duplicates)
    await db.execute(sql`ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS notified_at TIMESTAMP`);
    // manager_notified_at: tracks when same-day manager reminder was sent (separate dedupe marker)
    await db.execute(sql`ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS manager_notified_at TIMESTAMP`);
    // acknowledged_name: stores the typed full name when employee digitally acknowledges a PIP plan
    await db.execute(sql`ALTER TABLE employee_plans ADD COLUMN IF NOT EXISTS acknowledged_name VARCHAR`);
    // plan_acknowledgements: durable evidence table for PIP name-typed acknowledgements (mirrors section_acknowledgements pattern)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS plan_acknowledgements (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        plan_id VARCHAR NOT NULL,
        user_id VARCHAR NOT NULL REFERENCES admin_users(id),
        plan_type VARCHAR NOT NULL,
        typed_name VARCHAR NOT NULL,
        acknowledged_at TIMESTAMP DEFAULT NOW(),
        ip_address VARCHAR
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_plan_acks_plan_id ON plan_acknowledgements(plan_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_plan_acks_user_id ON plan_acknowledgements(user_id)`);

    log("Healthcare plan tables and columns ensured");
  } catch (err) {
    console.error("Healthcare plan tables migration error:", err);
  }

  // Seed plan_goal_templates for Healthcare roles — idempotent, never destructive.
  // Uses ON CONFLICT DO NOTHING so admin edits, custom templates, and deletions
  // are always preserved across restarts. Only truly missing rows are inserted.
  try {
    log("Ensuring plan_goal_templates seed (inserts missing rows only)...");

    const templates: {
      plan_type: string; role_slug: string; goal_category: string;
      goal_title: string; goal_description?: string; target_metric?: string; sort_order: number;
    }[] = [
      // ─── PROBATION: Associate Recruiter (individual-only) ────────────────────
      { plan_type: "probation", role_slug: "associate_recruiter", goal_category: "individual", goal_title: "Achieve qualified submissions target", goal_description: "Submit qualified candidates meeting job-order criteria", target_metric: "5 qualified submissions per week by week 6", sort_order: 1 },
      { plan_type: "probation", role_slug: "associate_recruiter", goal_category: "individual", goal_title: "Meet interview-to-submission ratio", goal_description: "Maintain an acceptable interview scheduling rate from submissions", target_metric: "≥25% submission-to-interview rate", sort_order: 2 },
      { plan_type: "probation", role_slug: "associate_recruiter", goal_category: "individual", goal_title: "Master ATS and sourcing tools", goal_description: "Demonstrate proficiency with Ceipal ATS, job boards, and LinkedIn Recruiter", target_metric: "100% same-day ATS logging compliance within 30 days", sort_order: 3 },
      { plan_type: "probation", role_slug: "associate_recruiter", goal_category: "individual", goal_title: "Complete onboarding training tracks", goal_description: "Finish all assigned onboarding SOPs and knowledge checks", target_metric: "100% quiz pass rate on all assigned SOPs", sort_order: 4 },
      { plan_type: "probation", role_slug: "associate_recruiter", goal_category: "individual", goal_title: "Pipeline 15+ active candidates in first 30 days", goal_description: "Build initial candidate pipeline for assigned verticals", target_metric: "15 active candidates pipelined in Ceipal by day 30", sort_order: 5 },

      // ─── PROBATION: Senior Recruiter (individual-only) ───────────────────────
      { plan_type: "probation", role_slug: "senior_recruiter", goal_category: "individual", goal_title: "Own full-cycle recruitment for 3+ open requisitions", goal_description: "Manage requisitions end-to-end with minimal oversight", target_metric: "3 active requisitions fully managed independently", sort_order: 1 },
      { plan_type: "probation", role_slug: "senior_recruiter", goal_category: "individual", goal_title: "Achieve first placement by day 75", goal_description: "Close at least one candidate placement within probation window", target_metric: "1 confirmed placement by day 75", sort_order: 2 },
      { plan_type: "probation", role_slug: "senior_recruiter", goal_category: "individual", goal_title: "Maintain pipeline quality score", goal_description: "Ensure candidates submitted meet hiring manager quality bar", target_metric: "≥80% manager-acceptance rate on submissions", sort_order: 3 },
      { plan_type: "probation", role_slug: "senior_recruiter", goal_category: "individual", goal_title: "Demonstrate client communication standards", goal_description: "Lead or shadow at least 3 client intake calls with documented notes", target_metric: "3 client call notes logged in Ceipal by day 60", sort_order: 4 },

      // ─── PROBATION: Lead Recruiter (individual + team) ───────────────────────
      { plan_type: "probation", role_slug: "lead_recruiter", goal_category: "individual", goal_title: "Own strategic requisitions for key accounts", goal_description: "Independently manage high-value or complex requisitions", target_metric: "2 key-account reqs closed in probation window", sort_order: 1 },
      { plan_type: "probation", role_slug: "lead_recruiter", goal_category: "individual", goal_title: "Contribute to team sourcing methodology", goal_description: "Document and share 2 sourcing playbooks for the team", target_metric: "2 sourcing playbooks documented by day 60", sort_order: 2 },
      { plan_type: "probation", role_slug: "lead_recruiter", goal_category: "team", goal_title: "Support team members on pipeline reviews", goal_description: "Conduct weekly pipeline review sessions with ≥2 junior recruiters", target_metric: "8 documented pipeline review sessions in 90 days", sort_order: 3 },
      { plan_type: "probation", role_slug: "lead_recruiter", goal_category: "team", goal_title: "Reduce team-wide submission rejection rate", goal_description: "Help reduce team submission rejection rate through coaching", target_metric: "Team rejection rate ≤15% by end of probation", sort_order: 4 },

      // ─── PROBATION: Associate Manager (individual + team) ────────────────────
      { plan_type: "probation", role_slug: "associate_manager", goal_category: "individual", goal_title: "Establish structured one-on-ones with all direct reports", goal_description: "Hold weekly 1:1s with each direct report from day 15", target_metric: "100% 1:1 completion for all direct reports in weeks 2-12", sort_order: 1 },
      { plan_type: "probation", role_slug: "associate_manager", goal_category: "individual", goal_title: "Apply internal performance management process", goal_description: "Understand goal-setting, check-ins, and review cycle cadence", target_metric: "Goals set with each direct report by day 30", sort_order: 2 },
      { plan_type: "probation", role_slug: "associate_manager", goal_category: "team", goal_title: "Achieve team placement target for quarter", goal_description: "Ensure team meets or exceeds placement target during probation period", target_metric: "Team achieves ≥90% of quarterly placement target", sort_order: 3 },
      { plan_type: "probation", role_slug: "associate_manager", goal_category: "team", goal_title: "Reduce team time-to-submit metric", goal_description: "Improve team average days from requisition open to first submission", target_metric: "Average time-to-submit ≤5 business days by day 90", sort_order: 4 },

      // ─── PROBATION: Account Manager (individual + team) ──────────────────────
      { plan_type: "probation", role_slug: "account_manager", goal_category: "individual", goal_title: "Map and meet key client stakeholders", goal_description: "Complete introductory calls and relationship mapping for all assigned accounts", target_metric: "100% of assigned accounts with documented contact mapping by day 30", sort_order: 1 },
      { plan_type: "probation", role_slug: "account_manager", goal_category: "individual", goal_title: "Develop client account plans", goal_description: "Create 90-day account plans for top 3 accounts", target_metric: "3 account plans submitted and approved by day 45", sort_order: 2 },
      { plan_type: "probation", role_slug: "account_manager", goal_category: "team", goal_title: "Drive collaborative requisition intake with recruiting team", goal_description: "Lead intake meetings and align recruiting team on client requirements", target_metric: "Intake meeting notes documented for 100% of new requisitions", sort_order: 3 },
      { plan_type: "probation", role_slug: "account_manager", goal_category: "team", goal_title: "Achieve client satisfaction baseline", goal_description: "Obtain positive feedback from at least 3 clients by end of probation", target_metric: "≥3 written client satisfaction confirmations by day 90", sort_order: 4 },

      // ─── PIP: Associate Recruiter — outreach/day, screens/day, submissions/week, ATS accuracy
      { plan_type: "pip", role_slug: "associate_recruiter", goal_category: "individual", goal_title: "Achieve minimum daily outreach target", goal_description: "Reach required daily sourcing and outreach contact volume", target_metric: "50 outreach contacts per day, 5 days/week throughout PIP window", sort_order: 1 },
      { plan_type: "pip", role_slug: "associate_recruiter", goal_category: "individual", goal_title: "Complete minimum daily phone screens", goal_description: "Conduct required number of qualified candidate phone screens each day", target_metric: "5 qualified phone screens per day (25/week minimum)", sort_order: 2 },
      { plan_type: "pip", role_slug: "associate_recruiter", goal_category: "individual", goal_title: "Achieve qualified submissions per week", goal_description: "Submit qualified candidates meeting job-order criteria each week", target_metric: "8 qualified submissions per week with manager rejection rate ≤20%", sort_order: 3 },
      { plan_type: "pip", role_slug: "associate_recruiter", goal_category: "individual", goal_title: "Maintain ATS logging accuracy", goal_description: "Log all candidate activity in Ceipal ATS same-day without gaps", target_metric: "ATS logging accuracy ≥98%; all activity logged same-day", sort_order: 4 },

      // ─── PIP: Senior Recruiter — outreach/day, screens/day, submissions/week, ATS accuracy
      { plan_type: "pip", role_slug: "senior_recruiter", goal_category: "individual", goal_title: "Achieve minimum daily outreach", goal_description: "Restore required daily outreach volume across assigned verticals", target_metric: "40 outreach contacts/day; ≥20 new prospecting contacts/day", sort_order: 1 },
      { plan_type: "pip", role_slug: "senior_recruiter", goal_category: "individual", goal_title: "Complete minimum weekly phone screens", goal_description: "Conduct qualified phone screens to restore pipeline depth", target_metric: "6 qualified phone screens/day (30/week minimum)", sort_order: 2 },
      { plan_type: "pip", role_slug: "senior_recruiter", goal_category: "individual", goal_title: "Restore weekly submission volume", goal_description: "Return qualified submission rate to required threshold", target_metric: "12 qualified submissions/week with manager rejection rate ≤20%", sort_order: 3 },
      { plan_type: "pip", role_slug: "senior_recruiter", goal_category: "individual", goal_title: "Achieve placement rate recovery", goal_description: "Re-establish consistent placement cadence within PIP window", target_metric: "1 confirmed placement per month for 3 consecutive months", sort_order: 4 },
      { plan_type: "pip", role_slug: "senior_recruiter", goal_category: "individual", goal_title: "Maintain ATS compliance and accuracy", goal_description: "Ensure all candidate and requisition data is logged accurately", target_metric: "ATS logging accuracy ≥98%; zero missing candidate stages", sort_order: 5 },

      // ─── PIP: Lead Recruiter — personal metrics + team delivery
      { plan_type: "pip", role_slug: "lead_recruiter", goal_category: "individual", goal_title: "Restore personal outreach and screening metrics", goal_description: "Re-achieve required daily sourcing and screening activity", target_metric: "30 outreach contacts/day; 4 qualified phone screens/day minimum", sort_order: 1 },
      { plan_type: "pip", role_slug: "lead_recruiter", goal_category: "individual", goal_title: "Recover strategic placement cadence", goal_description: "Close high-value placements consistently during PIP window", target_metric: "1 strategic placement per month for 2 consecutive months", sort_order: 2 },
      { plan_type: "pip", role_slug: "lead_recruiter", goal_category: "team", goal_title: "Improve team submission-to-interview conversion", goal_description: "Coach team to increase share of submissions that reach interview stage", target_metric: "Team submission-to-interview rate ≥30% within 60 days", sort_order: 3 },
      { plan_type: "pip", role_slug: "lead_recruiter", goal_category: "individual", goal_title: "Maintain 100% ATS compliance and update team playbooks", goal_description: "Model ATS accuracy and refresh sourcing playbooks for team", target_metric: "ATS logging accuracy ≥98%; updated team playbook shared within 30 days", sort_order: 4 },

      // ─── PIP: Associate Manager — individual oversight + team delivery metrics
      { plan_type: "pip", role_slug: "associate_manager", goal_category: "individual", goal_title: "Restore structured direct-report performance oversight", goal_description: "Reinstate consistent 1:1 cadence and documented performance tracking", target_metric: "100% of direct reports with active goals and bi-weekly documented check-ins", sort_order: 1 },
      { plan_type: "pip", role_slug: "associate_manager", goal_category: "team", goal_title: "Return team to placement quota", goal_description: "Ensure team recovers placement throughput during PIP window", target_metric: "Team achieves ≥95% of quota for 2 consecutive months", sort_order: 2 },
      { plan_type: "pip", role_slug: "associate_manager", goal_category: "team", goal_title: "Improve team outreach and submission volume", goal_description: "Drive team to meet required daily and weekly activity minimums", target_metric: "Team average: ≥40 outreach contacts/day, ≥8 submissions/week per recruiter", sort_order: 3 },
      { plan_type: "pip", role_slug: "associate_manager", goal_category: "individual", goal_title: "Implement structured escalation and ATS audit process", goal_description: "Log and resolve all escalations; conduct weekly ATS accuracy audits", target_metric: "100% of escalations logged with resolution; ATS audits completed weekly", sort_order: 4 },

      // ─── PIP: Account Manager — client recovery + fill rate + communication SLA
      { plan_type: "pip", role_slug: "account_manager", goal_category: "individual", goal_title: "Recover at-risk client fill rate", goal_description: "Close more open requisitions on managed accounts within PIP window", target_metric: "Fill rate improves by ≥15% within 60 days on all managed accounts", sort_order: 1 },
      { plan_type: "pip", role_slug: "account_manager", goal_category: "individual", goal_title: "Improve client communication SLA", goal_description: "Address documented gaps in timely client communication", target_metric: "100% of client messages responded to within 24 business hours", sort_order: 2 },
      { plan_type: "pip", role_slug: "account_manager", goal_category: "individual", goal_title: "Rebuild client pipeline and requisition volume", goal_description: "Re-activate or open new requisitions from managed accounts", target_metric: "≥5 new or re-activated requisitions from managed accounts within 45 days", sort_order: 3 },
      { plan_type: "pip", role_slug: "account_manager", goal_category: "individual", goal_title: "Ensure ATS accuracy for all managed requisitions", goal_description: "Maintain full ATS compliance on client requisition tracking", target_metric: "ATS logging accuracy ≥98% for all managed requisitions; zero missing stages", sort_order: 4 },

      // ─── GROWTH: Associate Recruiter (individual + production) ───────────────
      { plan_type: "growth", role_slug: "associate_recruiter", goal_category: "individual", goal_title: "Develop specialization in a healthcare sub-vertical", goal_description: "Build expertise in travel nursing, allied health, or locum tenens", target_metric: "1 specialization training completed; 10+ candidates sourced in chosen vertical", sort_order: 1 },
      { plan_type: "growth", role_slug: "associate_recruiter", goal_category: "production", goal_title: "Increase weekly submission volume by 20%", goal_description: "Expand pipeline activity to exceed current submission baseline", target_metric: "Weekly submission count increases 20% vs. baseline; sustained for 6 consecutive weeks", sort_order: 2 },

      // ─── GROWTH: Senior Recruiter (individual + production) ──────────────────
      { plan_type: "growth", role_slug: "senior_recruiter", goal_category: "individual", goal_title: "Mentor an associate-level recruiter", goal_description: "Take on a formal or informal mentoring role with a junior team member", target_metric: "6 documented mentoring sessions over the growth plan window", sort_order: 1 },
      { plan_type: "growth", role_slug: "senior_recruiter", goal_category: "production", goal_title: "Expand to a new healthcare client vertical", goal_description: "Build active pipeline for a new client or vertical not previously worked", target_metric: "1 new client or vertical with active pipeline and ≥3 submissions by end of plan", sort_order: 2 },

      // ─── GROWTH: Lead Recruiter (individual + team delivery) ─────────────────
      { plan_type: "growth", role_slug: "lead_recruiter", goal_category: "individual", goal_title: "Develop and deliver a team training session", goal_description: "Identify a skill gap in the team and lead a structured training session", target_metric: "1 completed team training session with documented attendee feedback", sort_order: 1 },
      { plan_type: "growth", role_slug: "lead_recruiter", goal_category: "team", goal_title: "Improve team submission-to-placement conversion rate", goal_description: "Coach team to close more placements from the existing submission pipeline", target_metric: "Team placement rate improves ≥10% from baseline by end of plan", sort_order: 2 },

      // ─── GROWTH: Associate Manager (individual + team delivery) ──────────────
      { plan_type: "growth", role_slug: "associate_manager", goal_category: "individual", goal_title: "Develop a direct report into a senior-level performer", goal_description: "Create and execute a growth plan for a high-potential team member", target_metric: "Direct report achieves promotion readiness assessment by end of plan", sort_order: 1 },
      { plan_type: "growth", role_slug: "associate_manager", goal_category: "team", goal_title: "Reduce team average time-to-submit metric", goal_description: "Drive process improvements to shorten requisition open to first-submission window", target_metric: "Team average time-to-submit ≤5 business days sustained for 8 weeks", sort_order: 2 },

      // ─── GROWTH: Account Manager (individual + team delivery) ────────────────
      { plan_type: "growth", role_slug: "account_manager", goal_category: "individual", goal_title: "Grow revenue in existing accounts", goal_description: "Expand scope of engagement with current clients through upsell or new reqs", target_metric: "≥10% revenue increase from existing accounts within plan window", sort_order: 1 },
      { plan_type: "growth", role_slug: "account_manager", goal_category: "team", goal_title: "Improve cross-functional pipeline collaboration", goal_description: "Facilitate joint BD/recruiting planning sessions to align on client strategy", target_metric: "2 collaborative BD/recruiting sessions facilitated and documented", sort_order: 2 },

      // ─── GROWTH: Foundation → Senior Recruiter (Healthcare) ──────────────────
      { plan_type: "growth", role_slug: "foundation_to_senior", goal_category: "production", goal_title: "Convert the live pipeline", goal_description: "Drive immediate placements from the existing active pipeline. Focus on clean, decisive closure of the most closeable candidates in the first 30 days.", target_metric: "1–2 clean POs/starts in first 30 days; 18–20 quality submissions in the same window", sort_order: 1 },
      { plan_type: "growth", role_slug: "foundation_to_senior", goal_category: "production", goal_title: "Build retained placements across the 90-day window", goal_description: "Sustain consistent placement throughput throughout the full plan period, not just the opening sprint. Quality and reliability of closures matters as much as volume.", target_metric: "Minimum 3 clean POs/starts across 90 days; strong performance = 4+", sort_order: 2 },
      { plan_type: "growth", role_slug: "foundation_to_senior", goal_category: "production", goal_title: "Achieve quality submission targets", goal_description: "Hit the total submission volume target while reducing weak, uncertain, or speculative submissions. Each submission should have a clear path to interview.", target_metric: "55–65 total quality submissions over 90 days; fewer weak or uncertain submissions each month", sort_order: 3 },
      { plan_type: "growth", role_slug: "foundation_to_senior", goal_category: "individual", goal_title: "Maintain 2× weekly candidate follow-up", goal_description: "All submitted candidates must be followed up at least twice per week until a decision is made, a start is confirmed, or the requisition closes. No candidate should go silent without a documented touch.", target_metric: "100% of submitted candidates followed up at least 2× per week until decision, start, or closure", sort_order: 4 },
      { plan_type: "growth", role_slug: "foundation_to_senior", goal_category: "individual", goal_title: "Coordinate and review sourcer output", goal_description: "Provide daily direction to sourcers and junior team members on priorities, quality bar, and job-order focus. Conduct a weekly review of sourcer output to assess quality, gaps, and improvements needed.", target_metric: "Daily direction provided to sourcers/juniors; weekly output quality review documented each week", sort_order: 5 },
      { plan_type: "growth", role_slug: "foundation_to_senior", goal_category: "individual", goal_title: "Submit weekly Friday tracker proactively", goal_description: "Own the Friday pipeline tracker submission without requiring follow-up from the manager. Tracker should be submitted before end of business on Friday, every week, with accurate pipeline data.", target_metric: "Friday tracker submitted proactively every week — no repeated manager follow-up required", sort_order: 6 },
      { plan_type: "growth", role_slug: "foundation_to_senior", goal_category: "individual", goal_title: "Demonstrate confidentiality and trust", goal_description: "Do not share internal tools, client strategy, business metrics, candidate pools, pricing, or proprietary information externally without explicit manager or leadership approval.", target_metric: "Zero incidents of internal tools, client strategy, or business info shared externally without approval", sort_order: 7 },
      { plan_type: "growth", role_slug: "foundation_to_senior", goal_category: "individual", goal_title: "Operate with senior-level desk ownership", goal_description: "Move beyond task execution into proactive desk management. Own your priorities, surface risks early, follow up on candidates independently, and drive outcomes that reflect senior-level responsibility — not just individual recruiter activity.", target_metric: "Visible ownership of desk priorities, risk flags, and candidate follow-ups — assessed at each 30/60/90-day milestone check-in", sort_order: 8 },
    ];

    let inserted = 0;
    for (const tpl of templates) {
      const r = await db.execute(sql`
        INSERT INTO plan_goal_templates (plan_type, role_slug, department_scope, goal_title, goal_category, goal_description, target_metric, sort_order, is_active)
        VALUES (
          ${tpl.plan_type}::employee_plan_type,
          ${tpl.role_slug},
          'healthcare'::employee_plan_dept_scope,
          ${tpl.goal_title},
          ${tpl.goal_category},
          ${tpl.goal_description ?? null},
          ${tpl.target_metric ?? null},
          ${tpl.sort_order},
          true
        )
        ON CONFLICT (plan_type, role_slug, goal_title) DO NOTHING
      `);
      if ((r.rowCount ?? 0) > 0) inserted++;
    }
    log(`Plan goal templates seed: ${inserted} new rows inserted (${templates.length - inserted} already present)`);
  } catch (err) {
    console.error("Plan goal templates seed error (non-fatal):", err);
  }
}

(async () => {
  try {
    await db.execute(sql`ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP`);
    log("Ensured deleted_at column exists on admin_users");
  } catch (err) {
    console.error("admin_users deleted_at migration error:", err);
  }

  try {
    await db.execute(sql`ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS gender VARCHAR`);
    log("Ensured gender column exists on admin_users");
  } catch (err) {
    console.error("admin_users gender migration error:", err);
  }

  try {
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE employment_status AS ENUM ('active', 'relieved', 'left_company');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await db.execute(sql`
      ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS employment_status employment_status DEFAULT 'active'
    `);
    await db.execute(sql`
      UPDATE admin_users SET employment_status = 'active' WHERE employment_status IS NULL
    `);
    log("Ensured employment_status column exists on admin_users");
  } catch (err) {
    console.error("admin_users employment_status migration error:", err);
  }

  try {
    await db.execute(sql`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS is_corrected BOOLEAN NOT NULL DEFAULT FALSE`);
    await db.execute(sql`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS correction_source VARCHAR`);
    await db.execute(sql`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS corrected_by_id VARCHAR REFERENCES admin_users(id)`);
    await db.execute(sql`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS correction_note TEXT`);
    await db.execute(sql`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS half_day BOOLEAN NOT NULL DEFAULT FALSE`);
    await db.execute(sql`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS half_day_part VARCHAR`);
    log("Ensured attendance correction columns exist");
  } catch (err) {
    console.error("Attendance correction columns migration error:", err);
  }

  try {
    await db.execute(sql`ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS is_conditional BOOLEAN NOT NULL DEFAULT TRUE`);
    await db.execute(sql`ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS carry_forward_cap INTEGER DEFAULT 0`);
    await db.execute(sql`ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS occurrence_based BOOLEAN NOT NULL DEFAULT FALSE`);
    log("Ensured leave_types extra columns exist");
  } catch (err) {
    console.error("leave_types migration error:", err);
  }

  try {
    // Set EL leave type to correct policy: 1.0 day/month base (bonus months Jan/May/Sep
    // credit 2.0 days via the accrual engine). Annual entitlement = 9×1 + 3×2 = 15 days.
    // Corrects the previous wrong flat 1.5/month setting.
    await db.execute(sql`
      UPDATE leave_types
      SET monthly_accrual = 1.0, default_days = 15
      WHERE is_conditional = TRUE
        AND occurrence_based = FALSE
        AND name NOT ILIKE '%comp%'
        AND name NOT ILIKE '%lwp%'
        AND name NOT ILIKE '%loss%'
        AND (CAST(monthly_accrual AS NUMERIC) != 1.0 OR default_days != 15)
    `);
    log("EL monthly accrual rate ensured at 1.0/month (bonus months Jan/May/Sep credit 2.0 days)");
  } catch (err) {
    console.error("EL rate migration error:", err);
  }

  try {
    await db.execute(sql`ALTER TABLE leave_accruals ADD COLUMN IF NOT EXISTS accrual_type TEXT DEFAULT 'monthly'`);
    await db.execute(sql`ALTER TABLE leave_accruals ADD COLUMN IF NOT EXISTS skip_reason TEXT`);
    log("Ensured leave_accruals extra columns exist");
  } catch (err) {
    console.error("leave_accruals migration error:", err);
  }

  try {
    await db.execute(sql`ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS half_day BOOLEAN NOT NULL DEFAULT FALSE`);
    await db.execute(sql`ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS half_day_part TEXT`);
    await db.execute(sql`ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS split_paid_days NUMERIC`);
    await db.execute(sql`ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS split_lwp_days NUMERIC`);
    log("Ensured leave_requests extra columns exist");
  } catch (err) {
    console.error("leave_requests migration error:", err);
  }

  try {
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE break_type AS ENUM ('lunch', 'tea');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS break_records (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        attendance_id VARCHAR REFERENCES attendance(id),
        user_id VARCHAR NOT NULL REFERENCES admin_users(id),
        date VARCHAR NOT NULL,
        break_type break_type NOT NULL,
        started_at TIMESTAMP NOT NULL,
        ended_at TIMESTAMP,
        duration_minutes NUMERIC,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS break_records_user_date_idx ON break_records (user_id, date)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS break_records_attendance_idx ON break_records (attendance_id)`);
    log("Ensured break_records table and indexes exist");
  } catch (err) {
    console.error("break_records migration error:", err);
  }

  try {
    await db.execute(sql`ALTER TABLE learning_tracks ADD COLUMN IF NOT EXISTS is_policy_track BOOLEAN NOT NULL DEFAULT FALSE`);
    await db.execute(sql`ALTER TABLE learning_tracks ADD COLUMN IF NOT EXISTS is_universal BOOLEAN NOT NULL DEFAULT FALSE`);
    await db.execute(sql`ALTER TABLE learning_tracks ADD COLUMN IF NOT EXISTS version_number INTEGER NOT NULL DEFAULT 1`);
    await db.execute(sql`ALTER TABLE learning_tracks ADD COLUMN IF NOT EXISTS published_at TIMESTAMP`);
    log("Ensured learning_tracks extra columns exist");
  } catch (err) {
    console.error("learning_tracks migration error:", err);
  }

  // Auto-running of the agent-generated migration files (migrations/ folder) is
  // DISABLED by default per request. The idempotent "ensure" blocks below already
  // create/patch all required schema on every boot, so the app stays healthy without it.
  // To apply the committed migration files manually, start with RUN_MIGRATIONS=true
  // (e.g. `RUN_MIGRATIONS=true npm run dev`).
  if (process.env.RUN_MIGRATIONS === "true") {
    log("RUN_MIGRATIONS=true — applying migration files from migrations/ folder");
    await runMigrations();
    log("Migration files applied");
  } else {
    log(
      "WARNING: auto-migrations are DISABLED. Committed migration files in migrations/ " +
        "are NOT being applied. The idempotent ensure blocks below still create/patch core " +
        "schema, but any seed/backfill data inside migration files (e.g. template/letter " +
        "seeds) will NOT run. To apply migration files, restart with RUN_MIGRATIONS=true.",
    );
  }
  await ensurePerformanceTables();
  await ensureGoalMilestonesAndLinks();
  await ensureHrLettersTables();
  await ensureHrLetterAmendmentTypes();
  try {
    await db.execute(sql`ALTER TABLE salary_slips ADD COLUMN IF NOT EXISTS lop_leaves numeric DEFAULT '0'`);
  } catch (err) {
    console.error("salary_slips lop_leaves migration error:", err);
  }
  await ensureOfferLetterApprovalColumns();
  await ensureOfferLetterAddendumsTable();
  await backfillEmployeeIds();
  await backfillHrLetterNames();
  await backfillHolidayAttendance();
  await applyOneTimeLeaveCorrections();
  await ensureShiftTables();
  await ensureNightShiftConsentsTable();
  await seedShiftData();

  try {
    const [firstAdmin] = await db.select({ id: adminUsers.id })
      .from(adminUsers)
      .where(eq(adminUsers.isActive, true))
      .limit(1);
    const seedAs = firstAdmin?.id ?? "system";
    const result = await seedUniversalPolicies(seedAs);
    if (result.created.length > 0) {
      log(`Universal policy tracks created: ${result.created.join(", ")} — assigned to ${result.assigned} user(s)`);
    } else {
      log(`Universal policy tracks already present (${result.skipped.length} existing, ${result.assigned} new assignment(s))`);
    }
  } catch (err) {
    console.error("Universal policy seeding error (non-fatal):", err);
  }

  try {
    await db.execute(sql`ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS attendance_exempt BOOLEAN NOT NULL DEFAULT FALSE`);
    log("Ensured attendance_exempt column on admin_users");
  } catch (err) {
    console.error("attendance_exempt column migration error:", err);
  }

  try {
    await db.execute(sql`ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS employee_category VARCHAR DEFAULT 'experienced'`);
    log("Ensured employee_category column on admin_users");
  } catch (err) {
    console.error("employee_category column migration error:", err);
  }

  try {
    // Seed default probation policy settings (insert only if not already present).
    // probation_policy_date = today means probation applies to employees hired from today onwards
    // (does not retroactively affect any existing employee).
    const todayIso = new Date().toISOString().slice(0, 10); // e.g. "2026-05-19"
    await db.execute(sql`
      INSERT INTO system_settings (key, value)
      VALUES ('probation_months', '3'::jsonb),
             ('probation_policy_date', ${JSON.stringify(todayIso)}::jsonb)
      ON CONFLICT (key) DO NOTHING
    `);
    // Also correct the placeholder 2099 value if it was previously seeded by mistake
    await db.execute(sql`
      UPDATE system_settings
      SET value = ${JSON.stringify(todayIso)}::jsonb
      WHERE key = 'probation_policy_date' AND value = '"2099-01-01"'::jsonb
    `);
    log(`Probation policy settings ensured (probation_months=3, probation_policy_date=${todayIso})`);
  } catch (err) {
    console.error("Probation policy settings seed error (non-fatal):", err);
  }

  try {
    await db.execute(sql`ALTER TABLE contract_clients ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true`);
    log("Ensured is_active column on contract_clients");
  } catch (err) {
    console.error("contract_clients is_active migration error:", err);
  }

  // ── Contract dispatch schema migrations ─────────────────────────────────────
  try {
    // Add pending_dispatch_approval to the contract_status enum (idempotent)
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TYPE contract_status ADD VALUE IF NOT EXISTS 'pending_dispatch_approval';
      EXCEPTION WHEN others THEN NULL;
      END $$;
    `);
    await db.execute(sql`ALTER TABLE contract_templates ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false`);
    await db.execute(sql`ALTER TABLE contracts ADD COLUMN IF NOT EXISTS cc_recipients JSONB DEFAULT '[]'::jsonb`);
    await db.execute(sql`ALTER TABLE contracts ADD COLUMN IF NOT EXISTS rejection_reason TEXT`);
    await db.execute(sql`ALTER TABLE contracts ADD COLUMN IF NOT EXISTS dispatch_method VARCHAR`);
    await db.execute(sql`ALTER TABLE contracts ADD COLUMN IF NOT EXISTS reference_number VARCHAR UNIQUE`);
    await db.execute(sql`ALTER TABLE contracts ADD COLUMN IF NOT EXISTS signed_at TIMESTAMP`);
    await db.execute(sql`ALTER TABLE contracts ADD COLUMN IF NOT EXISTS dispatch_recipient_email VARCHAR`);
    log("Contract dispatch schema columns ensured");
  } catch (err) {
    console.error("Contract dispatch schema migration error:", err);
  }

  // ── 22nd Century Healthcare SSA template seeder ─────────────────────────────
  try {
    const { seedContractTemplates } = await import("./contractTemplateSeed");
    const seedResult = await seedContractTemplates();
    if (seedResult.created) {
      log("22nd Century Healthcare SSA contract template seeded");
    }
  } catch (err) {
    console.error("Contract template seeder error (non-fatal):", err);
  }

  // ── Attendance Regularization tables ─────────────────────────────────────────
  try {
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE regularization_request_type AS ENUM('missed_punch_in','missed_punch_out','wrong_absent','correction');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE regularization_status AS ENUM('pending','approved','rejected');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS attendance_regularizations (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id VARCHAR NOT NULL REFERENCES admin_users(id),
        attendance_date VARCHAR NOT NULL,
        requested_punch_in TIMESTAMP,
        requested_punch_out TIMESTAMP,
        request_type VARCHAR NOT NULL,
        reason TEXT NOT NULL,
        status VARCHAR NOT NULL DEFAULT 'pending',
        reviewed_by VARCHAR REFERENCES admin_users(id),
        reviewer_comment TEXT,
        reviewed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT now(),
        updated_at TIMESTAMP DEFAULT now()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_att_reg_employee_id ON attendance_regularizations(employee_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_att_reg_status ON attendance_regularizations(status)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_att_reg_date ON attendance_regularizations(attendance_date)`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS policy_acknowledgements (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES admin_users(id),
        policy_type VARCHAR NOT NULL,
        policy_version VARCHAR NOT NULL,
        accepted_at TIMESTAMP DEFAULT now()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_policy_ack_user_type ON policy_acknowledgements(user_id, policy_type)`);
    await db.execute(sql`
      INSERT INTO system_settings (key, value)
      VALUES
        ('regularization_employee_window_days', '7'),
        ('regularization_manager_cutoff_day', '20'),
        ('regularization_policy_version', '1')
      ON CONFLICT (key) DO NOTHING
    `);
    log("Attendance regularization tables ensured");
  } catch (err) {
    console.error("Attendance regularization table migration error:", err);
  }

  // Seed What's New announcement defaults
  try {
    const announcementContent = JSON.stringify({
      title: "What's new at Hire'in",
      subtitle: "Three updates made just for you",
      blocks: [
        {
          icon: "star",
          title: "Praise Board",
          body: "Recognise the people who make the difference. Send a badge, give a clap, or pin a shout-out to a colleague's profile — right from the portal.",
          cta_label: "Give your first badge",
          cta_path: "/admin/praise",
        },
        {
          icon: "message",
          title: "Feedback",
          body: "Honest conversations, professionally handled. Share private praise or constructive notes with a colleague — all logged, all confidential.",
          cta_label: "Send feedback",
          cta_path: "/admin/feedback",
        },
        {
          icon: "clock",
          title: "Attendance Corrections Update",
          body: "Faster corrections, cleaner payslips. You now have 24 hours to raise a correction request. All open requests must be resolved by the 25th of each month so payroll can be processed on time.",
          cta_label: "See what changed",
          cta_path: "/admin/hr",
        },
      ],
    });
    await db.execute(sql`
      INSERT INTO system_settings (key, value)
      VALUES
        ('app_announcement_version', '"2024-06"'),
        ('app_announcement_content', ${announcementContent}::jsonb)
      ON CONFLICT (key) DO NOTHING
    `);
    log("App announcement system settings seeded");
  } catch (err) {
    console.error("App announcement seed error (non-fatal):", err);
  }

  // Policy signing tables
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS policy_documents (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        title varchar NOT NULL,
        content jsonb NOT NULL,
        version integer NOT NULL DEFAULT 1,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS policy_signing_requests (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        policy_document_id varchar NOT NULL REFERENCES policy_documents(id),
        employee_id varchar NOT NULL REFERENCES admin_users(id),
        sent_at timestamp DEFAULT now(),
        sent_by_user_id varchar REFERENCES admin_users(id),
        status varchar NOT NULL DEFAULT 'pending',
        due_date timestamp,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS policy_signatures (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        signing_request_id varchar NOT NULL REFERENCES policy_signing_requests(id),
        employee_id varchar NOT NULL REFERENCES admin_users(id),
        signed_at timestamp DEFAULT now(),
        ip_address varchar,
        page_initials jsonb NOT NULL,
        final_signature varchar NOT NULL,
        pdf_path varchar,
        created_at timestamp DEFAULT now()
      );
    `);
    log("Policy signing tables ensured");
  } catch (err) {
    console.error("Policy signing table migration error:", err);
  }

  // ── Attendance Report Approval tables ─────────────────────────────────────────
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS attendance_report_runs (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        month INTEGER NOT NULL,
        year INTEGER NOT NULL,
        status VARCHAR NOT NULL DEFAULT 'pending',
        deadline_at TIMESTAMP NOT NULL,
        locked_at TIMESTAMP,
        override_by VARCHAR REFERENCES admin_users(id),
        override_note TEXT,
        created_by VARCHAR REFERENCES admin_users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE (month, year)
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS attendance_report_entries (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        run_id VARCHAR NOT NULL REFERENCES attendance_report_runs(id) ON DELETE CASCADE,
        user_id VARCHAR NOT NULL REFERENCES admin_users(id),
        manager_id VARCHAR REFERENCES admin_users(id),
        orig_present_days NUMERIC NOT NULL DEFAULT 0,
        orig_absent_days NUMERIC NOT NULL DEFAULT 0,
        orig_lop_days NUMERIC NOT NULL DEFAULT 0,
        orig_leave_days NUMERIC NOT NULL DEFAULT 0,
        orig_holiday_days NUMERIC NOT NULL DEFAULT 0,
        orig_total_hours NUMERIC NOT NULL DEFAULT 0,
        cur_present_days NUMERIC NOT NULL DEFAULT 0,
        cur_absent_days NUMERIC NOT NULL DEFAULT 0,
        cur_lop_days NUMERIC NOT NULL DEFAULT 0,
        cur_leave_days NUMERIC NOT NULL DEFAULT 0,
        cur_holiday_days NUMERIC NOT NULL DEFAULT 0,
        cur_total_hours NUMERIC NOT NULL DEFAULT 0,
        manager_approved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_att_report_entries_run ON attendance_report_entries(run_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_att_report_entries_manager ON attendance_report_entries(manager_id)`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS attendance_report_edits (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        run_id VARCHAR NOT NULL REFERENCES attendance_report_runs(id) ON DELETE CASCADE,
        entry_id VARCHAR NOT NULL REFERENCES attendance_report_entries(id) ON DELETE CASCADE,
        manager_id VARCHAR NOT NULL REFERENCES admin_users(id),
        field VARCHAR NOT NULL,
        original_value NUMERIC NOT NULL,
        proposed_value NUMERIC NOT NULL,
        reason TEXT NOT NULL,
        status VARCHAR NOT NULL DEFAULT 'pending',
        reviewed_by VARCHAR REFERENCES admin_users(id),
        reviewed_at TIMESTAMP,
        rejection_note TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_att_report_edits_run ON attendance_report_edits(run_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_att_report_edits_status ON attendance_report_edits(status)`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS attendance_report_manager_approvals (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        run_id VARCHAR NOT NULL REFERENCES attendance_report_runs(id) ON DELETE CASCADE,
        manager_id VARCHAR NOT NULL REFERENCES admin_users(id),
        status VARCHAR NOT NULL DEFAULT 'pending',
        approved_at TIMESTAMP,
        overridden_at TIMESTAMP,
        override_by VARCHAR REFERENCES admin_users(id),
        override_note TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE (run_id, manager_id)
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_att_report_mgr_approvals_run ON attendance_report_manager_approvals(run_id)`);
    log("Attendance report approval tables ensured");
  } catch (err) {
    console.error("Attendance report approval table migration error:", err);
  }

  // Auto-create attendance report run for current month on server start if none exists
  checkAndAutoCreateRun().catch(err =>
    console.error("[index] Attendance auto-create on startup failed:", err)
  );

  await ensureHealthcarePlansTables();

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
      startScheduler();
    },
  );
})();
