import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { startScheduler } from "./scheduler";
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
        ALTER TABLE offer_letters ADD COLUMN IF NOT EXISTS cc_emails TEXT
      `);
      return;
    }

    log("Creating offer_letter_addendums table...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS offer_letter_addendums (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        offer_letter_id VARCHAR NOT NULL REFERENCES offer_letters(id),
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

  await runMigrations();
  await ensurePerformanceTables();
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
