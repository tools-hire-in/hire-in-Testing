import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { startScheduler } from "./scheduler";
import { db, runMigrations } from "./db";
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
