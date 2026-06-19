import express, { type Request, Response, NextFunction } from "express";
import { readFileSync } from "fs";
import { join } from "path";
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

async function ensureContentStudioTables() {
  try {
    log("Ensuring Content Studio enum, tables, indexes, and seed project...");

    await db.execute(sql`DO $$ BEGIN
      CREATE TYPE "article_status" AS ENUM ('draft', 'in_review', 'approved', 'scheduled', 'published', 'ready_to_export');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "studio_projects" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" varchar NOT NULL,
        "slug" varchar NOT NULL UNIQUE,
        "description" text,
        "brand_color" varchar,
        "logo_url" varchar,
        "is_primary" boolean DEFAULT false NOT NULL,
        "publishes_to_insights" boolean DEFAULT false NOT NULL,
        "is_active" boolean DEFAULT true NOT NULL,
        "created_by" varchar,
        "created_at" timestamp DEFAULT now() NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "studio_author_profiles" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar,
        "project_id" varchar REFERENCES studio_projects(id),
        "display_name" varchar NOT NULL,
        "title" varchar,
        "bio" text,
        "photo_url" varchar,
        "linkedin_url" varchar,
        "consented_at" timestamp,
        "is_active" boolean DEFAULT true NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "studio_articles" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "project_id" varchar NOT NULL REFERENCES studio_projects(id),
        "status" "article_status" DEFAULT 'draft' NOT NULL,
        "content_type" varchar DEFAULT 'article' NOT NULL,
        "title" varchar NOT NULL,
        "slug" varchar,
        "excerpt" text,
        "body_markdown" text,
        "body_json" jsonb,
        "cover_image_url" varchar,
        "seo_title" varchar,
        "seo_description" text,
        "og_image_url" varchar,
        "tags" text[],
        "read_time_minutes" integer,
        "author_profile_id" varchar REFERENCES studio_author_profiles(id),
        "reviewer_user_id" varchar,
        "approved_by" varchar,
        "approved_at" timestamp,
        "scheduled_at" timestamp,
        "published_at" timestamp,
        "created_by" varchar,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "studio_article_versions" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "article_id" varchar NOT NULL REFERENCES studio_articles(id),
        "version_no" integer NOT NULL,
        "title" varchar,
        "body_markdown" text,
        "body_json" jsonb,
        "created_by" varchar,
        "created_at" timestamp DEFAULT now() NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "studio_review_assignments" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "article_id" varchar NOT NULL REFERENCES studio_articles(id),
        "reviewer_user_id" varchar NOT NULL,
        "status" varchar DEFAULT 'pending' NOT NULL,
        "due_at" timestamp,
        "decision_at" timestamp,
        "comment" text,
        "assigned_by" varchar,
        "created_at" timestamp DEFAULT now() NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "studio_article_reactions" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "article_id" varchar NOT NULL REFERENCES studio_articles(id),
        "reaction_type" varchar NOT NULL,
        "session_hash" varchar,
        "created_at" timestamp DEFAULT now() NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "studio_newsletter_subscribers" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "email" varchar NOT NULL UNIQUE,
        "project_id" varchar REFERENCES studio_projects(id),
        "confirmed_at" timestamp,
        "unsubscribed_at" timestamp,
        "preferences" jsonb,
        "created_at" timestamp DEFAULT now() NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "studio_audit_events" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "article_id" varchar,
        "actor_user_id" varchar,
        "event_type" varchar NOT NULL,
        "metadata" jsonb,
        "created_at" timestamp DEFAULT now() NOT NULL
      )
    `);

    // AI generation: Social Kit + compliance + risk-flag columns on articles.
    await db.execute(sql`ALTER TABLE studio_articles ADD COLUMN IF NOT EXISTS social_kit_jsonb jsonb`);
    await db.execute(sql`ALTER TABLE studio_articles ADD COLUMN IF NOT EXISTS compliance_mode varchar DEFAULT 'normal' NOT NULL`);
    await db.execute(sql`ALTER TABLE studio_articles ADD COLUMN IF NOT EXISTS risk_flags jsonb`);
    await db.execute(sql`ALTER TABLE studio_articles ADD COLUMN IF NOT EXISTS risk_flags_resolved_at timestamp`);
    await db.execute(sql`ALTER TABLE studio_articles ADD COLUMN IF NOT EXISTS risk_flags_resolved_by varchar`);

    // Social-card engine (Task #432): per-article layout override + generated card URLs.
    await db.execute(sql`ALTER TABLE studio_articles ADD COLUMN IF NOT EXISTS card_layout varchar`);
    await db.execute(sql`ALTER TABLE studio_articles ADD COLUMN IF NOT EXISTS social_cards_jsonb jsonb`);
    // Content category (used by analytics category breakdown + insights filtering).
    await db.execute(sql`ALTER TABLE studio_articles ADD COLUMN IF NOT EXISTS category varchar`);
    // Newsletter notify guard: set once when per-publish subscriber email sent.
    await db.execute(sql`ALTER TABLE studio_articles ADD COLUMN IF NOT EXISTS notified_at timestamp`);
    // Launch seeding metadata (Task #473 — Hire'in Insights pilot).
    await db.execute(sql`ALTER TABLE studio_articles ADD COLUMN IF NOT EXISTS seed_batch_id varchar`);
    await db.execute(sql`ALTER TABLE studio_articles ADD COLUMN IF NOT EXISTS requires_author_approval boolean DEFAULT false NOT NULL`);
    await db.execute(sql`ALTER TABLE studio_articles ADD COLUMN IF NOT EXISTS requires_marketing_approval boolean DEFAULT false NOT NULL`);
    await db.execute(sql`ALTER TABLE studio_articles ADD COLUMN IF NOT EXISTS suggested_author_role varchar`);
    await db.execute(sql`ALTER TABLE studio_articles ADD COLUMN IF NOT EXISTS audience text[]`);
    // Newsletter deliverability suppression columns (analytics subscriber counts).
    await db.execute(sql`ALTER TABLE studio_newsletter_subscribers ADD COLUMN IF NOT EXISTS suppressed_at timestamp`);
    await db.execute(sql`ALTER TABLE studio_newsletter_subscribers ADD COLUMN IF NOT EXISTS bounce_count integer DEFAULT 0 NOT NULL`);
    await db.execute(sql`ALTER TABLE studio_newsletter_subscribers ADD COLUMN IF NOT EXISTS last_bounce_at timestamp`);
    await db.execute(sql`ALTER TABLE studio_newsletter_subscribers ADD COLUMN IF NOT EXISTS preferences jsonb`);
    // Multi-brand card variables on the project record.
    await db.execute(sql`ALTER TABLE studio_projects ADD COLUMN IF NOT EXISTS font_url varchar`);
    await db.execute(sql`ALTER TABLE studio_projects ADD COLUMN IF NOT EXISTS footer_url varchar`);
    await db.execute(sql`ALTER TABLE studio_projects ADD COLUMN IF NOT EXISTS active_template_family varchar DEFAULT 'hirein-v1' NOT NULL`);
    // Category -> reviewer pool routing config (older DBs predate this column).
    await db.execute(sql`ALTER TABLE studio_projects ADD COLUMN IF NOT EXISTS routing_rules jsonb`);
    // Author-employee link: connect author profiles to real admin_users.
    await db.execute(sql`ALTER TABLE studio_author_profiles ADD COLUMN IF NOT EXISTS linked_employee_id varchar REFERENCES admin_users(id) ON DELETE SET NULL`);
    await db.execute(sql`ALTER TABLE studio_author_profiles ADD COLUMN IF NOT EXISTS author_type varchar DEFAULT 'external' NOT NULL`);
    // New author profile columns for public directory & workflow linkage.
    await db.execute(sql`ALTER TABLE studio_author_profiles ADD COLUMN IF NOT EXISTS linked_user_id varchar REFERENCES admin_users(id) ON DELETE SET NULL`);
    await db.execute(sql`ALTER TABLE studio_author_profiles ADD COLUMN IF NOT EXISTS public_title varchar`);
    await db.execute(sql`ALTER TABLE studio_author_profiles ADD COLUMN IF NOT EXISTS specialties text[] DEFAULT '{}'`);
    await db.execute(sql`ALTER TABLE studio_author_profiles ADD COLUMN IF NOT EXISTS profile_complete boolean DEFAULT false NOT NULL`);
    await db.execute(sql`ALTER TABLE studio_author_profiles ADD COLUMN IF NOT EXISTS slug varchar`);

    // Seeded, versioned prompt library.
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "studio_prompt_templates" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "project_id" varchar REFERENCES studio_projects(id),
        "content_type" varchar NOT NULL,
        "version" integer DEFAULT 1 NOT NULL,
        "is_active" boolean DEFAULT true NOT NULL,
        "system_prompt" text NOT NULL,
        "user_prompt_template" text NOT NULL,
        "model_name" varchar NOT NULL,
        "model_tier" varchar DEFAULT 'standard' NOT NULL,
        "max_tokens" integer DEFAULT 4000 NOT NULL,
        "output_schema_ref" varchar NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    // Unique key for idempotent seeding of global (project-less) templates.
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS studio_prompt_templates_global_key
      ON studio_prompt_templates(content_type, version)
      WHERE project_id IS NULL
    `);

    // Versioned generation / audit records.
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "studio_generations" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "project_id" varchar,
        "article_id" varchar,
        "prompt_template_id" varchar,
        "prompt_version" integer,
        "kind" varchar NOT NULL,
        "content_type" varchar,
        "model_name" varchar,
        "input_json" jsonb,
        "output_json" jsonb,
        "quality_review_json" jsonb,
        "token_estimate" integer,
        "generated_by_user_id" varchar,
        "status" varchar DEFAULT 'draft' NOT NULL,
        "reviewed_by_user_id" varchar,
        "reviewed_at" timestamp,
        "approval_notes" text,
        "created_at" timestamp DEFAULT now() NOT NULL
      )
    `);

    await db.execute(sql`CREATE INDEX IF NOT EXISTS studio_articles_project_idx ON studio_articles(project_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS studio_articles_status_idx ON studio_articles(status)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS studio_article_versions_article_idx ON studio_article_versions(article_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS studio_review_assignments_article_idx ON studio_review_assignments(article_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS studio_generations_article_idx ON studio_generations(article_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS studio_generations_user_idx ON studio_generations(generated_by_user_id)`);

    // Seed the primary Hire'in project (idempotent — slug is unique).
    await db.execute(sql`
      INSERT INTO studio_projects (name, slug, description, brand_color, is_primary, publishes_to_insights, is_active)
      VALUES ('Hire''in Solutions', 'hirein', 'Primary brand — publishes to the public Insights surface.', '#1F3A6E', true, true, true)
      ON CONFLICT (slug) DO NOTHING
    `);

    log("Content Studio tables, indexes, and seed project ensured");
  } catch (err) {
    console.error("Content Studio table migration error:", err);
  }
}

async function ensureCardTemplatesAndBrand() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "card_templates" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "project_id" varchar REFERENCES studio_projects(id),
        "family" varchar NOT NULL,
        "layout" varchar NOT NULL,
        "platform" varchar NOT NULL,
        "label" varchar,
        "width" integer NOT NULL,
        "height" integer NOT NULL,
        "max_tips" integer,
        "html" text NOT NULL,
        "is_active" boolean DEFAULT true NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    // One default template per family/layout/platform (project_id NULL).
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS card_templates_default_idx
      ON card_templates(family, layout, platform)
      WHERE project_id IS NULL
    `);
    // Optional cached preview thumbnail URL on card templates (Task #432).
    await db.execute(sql`ALTER TABLE card_templates ADD COLUMN IF NOT EXISTS thumbnail_url varchar`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "studio_brand_settings" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "brand_name" varchar NOT NULL DEFAULT 'Hire''in Solutions',
        "tagline" varchar,
        "navy" varchar NOT NULL DEFAULT '#1F3A6E',
        "orange_primary" varchar NOT NULL DEFAULT '#F47C20',
        "orange_accent" varchar NOT NULL DEFAULT '#F96D3E',
        "white" varchar NOT NULL DEFAULT '#FFFFFF',
        "soft_gray" varchar NOT NULL DEFAULT '#F2F4F7',
        "heading_font" varchar NOT NULL DEFAULT 'Playfair Display',
        "body_font" varchar NOT NULL DEFAULT 'Inter',
        "logo_url" varchar,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`
      INSERT INTO studio_brand_settings (brand_name, tagline)
      SELECT 'Hire''in Solutions', 'Smart Solutions. Stronger Teams.'
      WHERE NOT EXISTS (SELECT 1 FROM studio_brand_settings)
    `);

    // Seed the hirein-v1 social-card matrix from disk (idempotent upsert).
    try {
      const dir = join(process.cwd(), "templates/social-cards/hirein-v1");
      const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")) as Array<{
        file: string; family: string; layout: string; platform: string;
        label: string; width: number; height: number; maxTips?: number;
      }>;
      for (const m of manifest) {
        const html = readFileSync(join(dir, m.file), "utf8");
        await db.execute(sql`
          INSERT INTO card_templates
            (project_id, family, layout, platform, label, width, height, max_tips, html, is_active)
          VALUES
            (NULL, ${m.family}, ${m.layout}, ${m.platform}, ${m.label}, ${m.width}, ${m.height}, ${m.maxTips ?? null}, ${html}, true)
          ON CONFLICT (family, layout, platform) WHERE project_id IS NULL
          DO UPDATE SET
            label = EXCLUDED.label,
            width = EXCLUDED.width,
            height = EXCLUDED.height,
            max_tips = EXCLUDED.max_tips,
            html = EXCLUDED.html,
            is_active = true,
            updated_at = now()
        `);
      }
      log(`Card templates seeded (${manifest.length} from disk)`);
    } catch (seedErr) {
      console.error("Card template disk seed error (templates not found?):", seedErr);
    }
  } catch (err) {
    console.error("Card templates / brand settings migration error:", err);
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

  try {
    await db.execute(sql`ALTER TABLE offer_letters ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMP`);
    log("Ensured reminder_sent_at column exists on offer_letters");
  } catch (err) {
    console.error("offer_letters reminder_sent_at column migration error:", err);
  }
}

async function ensureOfferLetterAddendumsTable() {
  try {
    const result = await db.execute(sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'offer_letter_addendums'
    `);
    if (result.rows.length > 0) {
      // Make offer_letter_id nullable so standalone addendums (no parent offer letter) work.
      // ALTER COLUMN ... DROP NOT NULL is idempotent — safe to run every restart.
      await db.execute(sql`
        ALTER TABLE offer_letter_addendums ALTER COLUMN offer_letter_id DROP NOT NULL
      `);
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
      await db.execute(sql`
        ALTER TABLE offer_letter_addendums ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP
      `);
      await db.execute(sql`
        ALTER TABLE offer_letter_addendums ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMP
      `);
      // Add "expired" value to the offer_letter_addendum_status enum if not present
      await db.execute(sql`
        DO $$ BEGIN
          ALTER TYPE offer_letter_addendum_status ADD VALUE IF NOT EXISTS 'expired';
        EXCEPTION WHEN duplicate_object THEN null;
        END $$
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
    await db.execute(sql`ALTER TABLE shifts ALTER COLUMN grace_period_minutes SET DEFAULT 15`);
    await db.execute(sql`ALTER TABLE shifts ADD COLUMN IF NOT EXISTS us_coverage_dst VARCHAR`);
    await db.execute(sql`ALTER TABLE shifts ADD COLUMN IF NOT EXISTS us_coverage_std VARCHAR`);
    await db.execute(sql`ALTER TABLE shifts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`);
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
    // ON CONFLICT DO UPDATE ensures corrections are applied on every server restart.
    // SHIFT_A: moved 1 hour earlier to correctly cover 8:00 AM – 5:00 PM ET.
    // SHIFT_C: moved 1 hour later to correctly cover 12:00 PM – 9:00 PM ET / 9:00 AM – 6:00 PM PT.
    // SHIFT_B: unchanged (was already correct).
    await db.execute(sql`
      INSERT INTO shifts (id, name, display_label, us_coverage, us_coverage_dst, us_coverage_std,
                          ist_start_dst, ist_end_dst, ist_start_std, ist_end_std, scheduled_hours, updated_at)
      VALUES
        ('SHIFT_A', 'SHIFT_A', 'Early U.S. – East Coast', '8:00 AM – 5:00 PM ET',
         '8:00 AM – 5:00 PM ET (Summer)', '8:00 AM – 5:00 PM ET (Winter)',
         '17:30', '02:30', '18:30', '03:30', 9, NOW()),
        ('SHIFT_B', 'SHIFT_B', 'National Coverage', '10:00 AM – 7:00 PM ET / 7:00 AM – 4:00 PM PT',
         '10:00 AM – 7:00 PM ET / 7:00 AM – 4:00 PM PT (Summer)',
         '10:00 AM – 7:00 PM ET / 7:00 AM – 4:00 PM PT (Winter)',
         '19:30', '04:30', '20:30', '05:30', 9, NOW()),
        ('SHIFT_C', 'SHIFT_C', 'Late U.S. – West Coast', '12:00 PM – 9:00 PM ET / 9:00 AM – 6:00 PM PT',
         '12:00 PM – 9:00 PM ET / 9:00 AM – 6:00 PM PT (Summer)',
         '12:00 PM – 9:00 PM ET / 9:00 AM – 6:00 PM PT (Winter)',
         '21:30', '06:30', '22:30', '07:30', 9, NOW())
      ON CONFLICT (id) DO UPDATE SET
        display_label    = EXCLUDED.display_label,
        us_coverage      = EXCLUDED.us_coverage,
        us_coverage_dst  = EXCLUDED.us_coverage_dst,
        us_coverage_std  = EXCLUDED.us_coverage_std,
        ist_start_dst    = EXCLUDED.ist_start_dst,
        ist_end_dst      = EXCLUDED.ist_end_dst,
        ist_start_std    = EXCLUDED.ist_start_std,
        ist_end_std      = EXCLUDED.ist_end_std,
        scheduled_hours  = EXCLUDED.scheduled_hours,
        -- Only advance updated_at when an actual IST timing value changed.
        -- This prevents the regularization-warning cutoff from drifting on every restart.
        updated_at = CASE
          WHEN shifts.ist_start_dst != EXCLUDED.ist_start_dst
            OR shifts.ist_end_dst   != EXCLUDED.ist_end_dst
            OR shifts.ist_start_std != EXCLUDED.ist_start_std
            OR shifts.ist_end_std   != EXCLUDED.ist_end_std
          THEN NOW()
          ELSE COALESCE(shifts.updated_at, NOW())
        END
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
    // Record a one-time cutoff date for the regularization pre-correction warning.
    // This is inserted once (DO NOTHING on conflict) so it never drifts on restarts.
    // The date reflects when the SHIFT_A/SHIFT_C time corrections first took effect.
    const correctionCutoff = "2026-06-19";
    await db.execute(sql`
      INSERT INTO system_settings (key, value)
      VALUES ('shift_correction_applied_at', ${JSON.stringify({ date: correctionCutoff })})
      ON CONFLICT (key) DO NOTHING
    `);

    log("Shift seed data ensured");
  } catch (err) {
    console.error("Shift seed data error:", err);
  }
}

/**
 * One-time idempotent notification for employees on SHIFT_A and SHIFT_C informing
 * them of the corrected shift times. Gated by a system_settings key so it only fires
 * on the first server restart after the correction is applied.
 */
async function notifyShiftCorrectionEmployees() {
  try {
    const NOTIF_KEY = "shift_correction_notified_v2";
    const existing = await db.execute(sql`
      SELECT value FROM system_settings WHERE key = ${NOTIF_KEY} LIMIT 1
    `);
    if (existing.rows.length > 0) return; // already done

    // Fetch current shifts to get the corrected times
    const shiftRows = await db.execute(sql`
      SELECT id, display_label, ist_start_dst, ist_end_dst, ist_start_std, ist_end_std,
             us_coverage_dst, us_coverage_std
      FROM shifts WHERE id IN ('SHIFT_A', 'SHIFT_C') AND is_active = true
    `);
    const shiftMap = new Map<string, any>();
    for (const row of shiftRows.rows as any[]) shiftMap.set(row.id, row);

    // Find all active employees on SHIFT_A or SHIFT_C
    const affected = await db.execute(sql`
      SELECT id, first_name, last_name, email, shift_id
      FROM admin_users
      WHERE shift_id IN ('SHIFT_A', 'SHIFT_C')
        AND is_active = true AND deleted_at IS NULL
    `);

    let notified = 0;
    for (const user of affected.rows as any[]) {
      const shift = shiftMap.get(user.shift_id);
      if (!shift) continue;

      const dstLabel = `${shift.ist_start_dst}–${shift.ist_end_dst} IST · ${shift.us_coverage_dst ?? shift.us_coverage}`;
      const stdLabel = `${shift.ist_start_std}–${shift.ist_end_std} IST · ${shift.us_coverage_std ?? shift.us_coverage}`;

      await storage.createNotification({
        userId: user.id,
        type: "system",
        title: "Your shift times have been updated",
        message: `${shift.display_label}: Summer schedule ${dstLabel} | Winter schedule ${stdLabel}. Please review your updated schedule.`,
        isRead: false,
        metadata: {
          shiftId: user.shift_id,
          shiftLabel: shift.display_label,
          dstTimes: dstLabel,
          stdTimes: stdLabel,
        },
      }).catch(console.error);

      // Log the correction in shift_assignment_log (shift ID unchanged; only times changed)
      await db.execute(sql`
        INSERT INTO shift_assignment_log (user_id, changed_by_id, old_shift_id, new_shift_id, reason)
        VALUES (${user.id}, ${user.id}, ${user.shift_id}, ${user.shift_id},
                'Shift times corrected — see updated schedule')
      `).catch(console.error);

      // Send email notification (fire-and-forget)
      if (user.email) {
        import("./email").then(({ sendPolicyUpdateEmail }) => {
          sendPolicyUpdateEmail({
            to: user.email,
            employeeName: `${user.first_name} ${user.last_name}`,
            policyName: `${shift.display_label} — Updated Schedule`,
            changeDescription: `Your shift times have been corrected.\n\nSummer schedule (DST): ${dstLabel}\nWinter schedule (STD): ${stdLabel}\n\nAll past attendance records remain unchanged. Only future punches will use the updated times.`,
            effectiveDate: new Date().toISOString().slice(0, 10),
          }).catch(console.error);
        }).catch(console.error);
      }

      notified++;
    }

    // Mark as done
    await db.execute(sql`
      INSERT INTO system_settings (key, value)
      VALUES (${NOTIF_KEY}, '{"done":true}')
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `);
    if (notified > 0) log(`Shift correction notifications sent to ${notified} employee(s)`);
  } catch (err) {
    console.error("Shift correction notification error (non-fatal):", err);
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

      // ─── GROWTH: Foundation → Senior Recruiter – Days 1-30 ───────────────────
      { plan_type: "growth", role_slug: "foundation_to_senior", goal_category: "production", goal_title: "D1-30: Pipeline cleanup and review", goal_description: "Conduct a full review and cleanup of the existing live pipeline in Week 1. Update every candidate's status, next action, and priority. The pipeline is not cold-start — conversion is expected in the first 30 days.", target_metric: "Updated pipeline sheet with status, next action, and priority completed by end of Week 1", sort_order: 1 },
      { plan_type: "growth", role_slug: "foundation_to_senior", goal_category: "production", goal_title: "D1-30: Quality submissions", goal_description: "Submit 18–20 quality candidates from the live pipeline. Each submission must have availability confirmed, pay expectations verified, location/commute feasibility confirmed, and candidate commitment established before submission.", target_metric: "18–20 quality submissions with all candidate verification fields completed in the submission tracker", sort_order: 2 },
      { plan_type: "growth", role_slug: "foundation_to_senior", goal_category: "production", goal_title: "D1-30: Interview and client movement", goal_description: "Drive candidates from submission to client/MSP review and interview. Track every status movement and update notes in the system.", target_metric: "5–8 interview or client movement events with status notes and client/MSP updates documented", sort_order: 3 },
      { plan_type: "growth", role_slug: "foundation_to_senior", goal_category: "production", goal_title: "D1-30: Clean POs or starts", goal_description: "Close minimum 3 clean POs or confirmed starts from the live pipeline in the first 30 days, assuming client demand remains active. A PO only counts when the candidate starts, stays, and bills consistently.", target_metric: "Minimum 3 clean POs or starts in the first 30 days; each placement counts only when the candidate starts, stays, and bills consistently", sort_order: 4 },
      { plan_type: "growth", role_slug: "foundation_to_senior", goal_category: "individual", goal_title: "D1-30: 2x weekly candidate follow-up", goal_description: "All submitted candidates must be followed up at least twice per week until a decision is made, a start is confirmed, or the requisition closes. No candidate should go silent without a documented touch.", target_metric: "Follow-up log maintained with date and outcome for every submitted candidate, every week", sort_order: 5 },
      { plan_type: "growth", role_slug: "foundation_to_senior", goal_category: "individual", goal_title: "D1-30: Daily sourcer coordination", goal_description: "Provide daily sourcing priorities and direction to sourcers and junior team members. Conduct at least one quality review of sourcer output per week to assess candidate quality, gaps, and improvements needed.", target_metric: "Daily priorities documented; sourcer assignment log and candidate quality feedback completed each week", sort_order: 6 },
      { plan_type: "growth", role_slug: "foundation_to_senior", goal_category: "individual", goal_title: "D1-30: Confidentiality — no external sharing", goal_description: "No internal information is to be shared outside the company without explicit manager or leadership approval. Internal tools, sourcing strategy, client approach, business metrics, and team matters stay within the company.", target_metric: "Zero incidents of internal tools, client strategy, or business information shared externally without approval", sort_order: 7 },

      // ─── GROWTH: Foundation → Senior Recruiter – Days 31-60 ──────────────────
      { plan_type: "growth", role_slug: "foundation_to_senior", goal_category: "production", goal_title: "D31-60: Quality submissions", goal_description: "Continue submission momentum with 20–25 additional quality submissions. Track rejection reasons for every declined or unresponsive submission to inform sourcing strategy adjustments.", target_metric: "20–25 additional quality submissions with rejection reasons logged in the submission tracker", sort_order: 8 },
      { plan_type: "growth", role_slug: "foundation_to_senior", goal_category: "production", goal_title: "D31-60: Clean POs or starts", goal_description: "Close minimum 3 additional clean POs or confirmed starts. Running total of 6 clean starts by Day 60. Focus on retained placements where the candidate starts, stays, and bills consistently — not just initial PO receipt.", target_metric: "Minimum 3 additional clean POs or starts in Days 31-60; running total of 6 clean starts by Day 60; retained billing status documented for each", sort_order: 9 },
      { plan_type: "growth", role_slug: "foundation_to_senior", goal_category: "individual", goal_title: "D31-60: Rejection tracking and strategy adjustment", goal_description: "Track every submission rejection with a reason code and adjust sourcing and submission strategy based on patterns. Share a weekly reason-code summary and a brief action plan with the manager.", target_metric: "Weekly reason-code summary and strategy adjustment plan submitted each week in this phase", sort_order: 10 },
      { plan_type: "growth", role_slug: "foundation_to_senior", goal_category: "production", goal_title: "D31-60: Reduce weak submissions", goal_description: "Reduce the volume of unconfirmed, low-commitment, or mismatched candidate submissions. Quality review will be conducted by lead/manager at the end of this phase. Every submission should have a clear path to start.", target_metric: "Measurable reduction in weak submissions vs. Days 1-30 — assessed via manager quality review at Day 60", sort_order: 11 },
      { plan_type: "growth", role_slug: "foundation_to_senior", goal_category: "team", goal_title: "D31-60: Sourcer output quality", goal_description: "Ensure sourcers are producing usable, screened candidates — not just pipeline volume. Conduct weekly reviews of sourcer output and provide specific improvement direction where quality falls below standard.", target_metric: "Weekly sourcer output review completed; conversion rate of sourcer candidates improves vs. Days 1-30", sort_order: 12 },
      { plan_type: "growth", role_slug: "foundation_to_senior", goal_category: "individual", goal_title: "D31-60: Risk management and falloff prevention", goal_description: "Proactively identify and document risks on every active candidate — competing offers, availability uncertainty, commitment gaps, or communication breakdowns. No avoidable falloff due to weak screening or missed communication.", target_metric: "Risk log maintained for all active candidates; zero avoidable falloffs due to missed screening or follow-up", sort_order: 13 },

      // ─── GROWTH: Foundation → Senior Recruiter – Days 61-90 ──────────────────
      { plan_type: "growth", role_slug: "foundation_to_senior", goal_category: "production", goal_title: "D61-90: Total quality submissions — 90-day target", goal_description: "Achieve the full 90-day quality submission target. The complete 90-day submission report will be reviewed at the final milestone check-in, with focus on quality, conversion movement, and rejection patterns.", target_metric: "55–65 total quality submissions across the full 90-day plan — full submission report reviewed at Day 90", sort_order: 14 },
      { plan_type: "growth", role_slug: "foundation_to_senior", goal_category: "production", goal_title: "D61-90: Total clean POs or starts — 90-day target", goal_description: "Reach the 90-day placement target with clean, retained starts — minimum 9 total (3 per month). Strong performance is 10+. Each placement is assessed on whether the candidate started, stayed, billed, and the client relationship remained stable.", target_metric: "Minimum 9 total clean POs/starts across the full 90-day plan (3 per month); strong performance = 10+; PO/start and retained billing status documented for every placement", sort_order: 15 },
      { plan_type: "growth", role_slug: "foundation_to_senior", goal_category: "production", goal_title: "D61-90: Candidate retention quality", goal_description: "All starts from this plan period must show 30-day retention. Candidates who start and quickly fall off due to screening gaps, commitment issues, or poor follow-up will impact the overall plan outcome.", target_metric: "30-day retention status tracked for every start; all starts billed and remained committed at the time of review", sort_order: 16 },
      { plan_type: "growth", role_slug: "foundation_to_senior", goal_category: "individual", goal_title: "D61-90: Proactive desk ownership", goal_description: "Demonstrate full senior-level desk ownership in the final phase. Own your priorities, candidate follow-up, and sourcer direction proactively — no repeated manager chasing required. Weekly tracker submitted on time, every week.", target_metric: "Weekly tracker submitted proactively every Friday; no manager follow-up required; desk ownership verified at Day 90 check-in", sort_order: 17 },
      { plan_type: "growth", role_slug: "foundation_to_senior", goal_category: "individual", goal_title: "D61-90: Escalation and communication", goal_description: "Proactively surface all risks, gaps, client/candidate blockers, and concerns in weekly notes and during check-ins. No surprises at the 90-day review. Communication quality and proactiveness are part of the senior ownership standard.", target_metric: "Weekly escalation notes submitted; all risks surfaced proactively — no issues withheld until the final review", sort_order: 18 },
      { plan_type: "growth", role_slug: "foundation_to_senior", goal_category: "individual", goal_title: "D61-90: Trust and confidentiality — senior standard", goal_description: "Maintain strong discretion with all internal company matters through the full 90 days. Internal tools, sourcing strategy, process ideas, client approach, business plans, and team discussions must remain within the company unless clearly approved for sharing.", target_metric: "Zero incidents of external sharing of internal tools, strategy, or business information without approval across the full 90-day period", sort_order: 19 },

      // ─── PIP: New goals not previously seeded ────────────────────────────────
      { plan_type: "pip", role_slug: "associate_recruiter", goal_category: "individual", goal_title: "Build interview pipeline", goal_description: "Drive submitted candidates to interview stage and eliminate repeated submission errors after written coaching", target_metric: "Minimum 2-3 interview-stage candidates during the PIP period, where client/job flow allows; no repeated submission errors after written coaching", sort_order: 5 },
      { plan_type: "pip", role_slug: "senior_recruiter",    goal_category: "individual", goal_title: "Achieve interview conversion target", goal_description: "Move sufficient submitted candidates to interview and offer stage during the PIP window", target_metric: "Minimum 4-6 interview-stage candidates during the PIP period, where client/job flow allows", sort_order: 6 },
      { plan_type: "pip", role_slug: "lead_recruiter",      goal_category: "team",       goal_title: "Drive visible team improvement by final review", goal_description: "Show measurable improvement in team output, quality, and candidate movement by the PIP end date", target_metric: "Demonstrable improvement in interview movement, candidate follow-up, submission quality, or recruiter activity by final review — confirmed by manager", sort_order: 5 },
      { plan_type: "pip", role_slug: "associate_manager",   goal_category: "team",       goal_title: "Drive visible delivery improvement by final review", goal_description: "Show measurable improvement in team delivery outcomes, starts pipeline, or recurring margin contribution by PIP end date", target_metric: "100% same-day or next-business-day follow-up on active interview, offer, onboarding, and start items; visible improvement in team output and starts pipeline by final review", sort_order: 5 },
      { plan_type: "pip", role_slug: "account_manager",     goal_category: "individual", goal_title: "Drive account growth and expansion", goal_description: "Identify and pursue expansion, vendor, or additional requirement opportunities with managed accounts during PIP", target_metric: "Identify at least 1-2 expansion, vendor, or additional requirement opportunities during the PIP period; document in account plan and share with delivery team", sort_order: 5 },

      // ─── PIP: Foundation → Senior Recruiter (all 6 goals) ────────────────────
      { plan_type: "pip", role_slug: "foundation_to_senior", goal_category: "individual", goal_title: "Achieve senior-level daily outreach target", goal_description: "Reach the senior recruiter outreach standard required for the foundation-to-senior transition benchmark", target_metric: "Minimum 50-75 qualified outreach attempts per working day — this is the senior standard; consistent effort is required throughout the PIP period", sort_order: 1 },
      { plan_type: "pip", role_slug: "foundation_to_senior", goal_category: "individual", goal_title: "Complete minimum daily candidate screens", goal_description: "Conduct required daily candidate phone screens to build an interview-ready pipeline", target_metric: "Minimum 5-8 completed candidate screens per working day", sort_order: 2 },
      { plan_type: "pip", role_slug: "foundation_to_senior", goal_category: "individual", goal_title: "Achieve weekly quality submission standard", goal_description: "Submit fully verified, quality candidates every week — no unconfirmed or low-commitment candidates", target_metric: "Minimum 6-8 complete, accurate, and relevant submissions per week; each submission must have availability, pay, location, and commitment confirmed", sort_order: 3 },
      { plan_type: "pip", role_slug: "foundation_to_senior", goal_category: "individual", goal_title: "Achieve interview and conversion movement", goal_description: "Drive candidates from submission to interview and offer stages and prove conversion capability", target_metric: "Minimum 4-6 interview-stage candidates during the PIP period; minimum 1 offer-stage or start-ready candidate, where client/job flow allows", sort_order: 4 },
      { plan_type: "pip", role_slug: "foundation_to_senior", goal_category: "individual", goal_title: "Maintain ATS and tracker accuracy", goal_description: "Keep all candidate records, notes, and tracker fully updated same-day throughout the PIP", target_metric: "98% same-day accuracy for submissions, RTR, follow-ups, interview status, and candidate notes; weekly tracker submitted proactively every Friday without manager follow-up", sort_order: 5 },
      { plan_type: "pip", role_slug: "foundation_to_senior", goal_category: "individual", goal_title: "Demonstrate confidentiality and trust — no violations", goal_description: "Maintain full discretion on all internal company matters throughout the PIP period", target_metric: "Zero incidents of sharing internal tools, sourcing strategy, client approach, business plans, or team matters outside the company without manager approval during the PIP", sort_order: 6 },

      // ─── PROBATION: Foundation → Senior Recruiter (all 5 goals) ─────────────
      { plan_type: "probation", role_slug: "foundation_to_senior", goal_category: "individual", goal_title: "Complete onboarding training and policy acknowledgements", goal_description: "Finish all mandatory policy training and tool access setup as documented in the onboarding plan", target_metric: "All 9 policy areas acknowledged by Day 2; tool training (CEIPAL, SignalHire, Zoom, KlerHire.ai, ProKred) completed by Day 3; controlled production approved by manager by Day 4", sort_order: 1 },
      { plan_type: "probation", role_slug: "foundation_to_senior", goal_category: "individual", goal_title: "Build initial pipeline and quality submissions under manager review", goal_description: "Establish active candidate pipeline and begin quality submissions with manager review before external submission", target_metric: "Minimum 10-15 quality submissions during probation with all candidate verification fields completed; manager-reviewed before submission for first 2 weeks; 15+ active candidates pipelined by Day 30", sort_order: 2 },
      { plan_type: "probation", role_slug: "foundation_to_senior", goal_category: "individual", goal_title: "Demonstrate ATS and sourcing tool mastery", goal_description: "Maintain accurate, complete ATS records and demonstrate proficiency with all assigned sourcing tools", target_metric: "95%+ same-day ATS compliance for candidate notes, status, RTR, follow-up dates, and submission records; manager-verified ATS accuracy by Day 30", sort_order: 3 },
      { plan_type: "probation", role_slug: "foundation_to_senior", goal_category: "individual", goal_title: "Establish sourcer coordination and desk ownership", goal_description: "Begin directing sourcers and demonstrate proactive desk ownership from Day 10 onward — no repeated chasing from manager required", target_metric: "Daily sourcing priorities provided to sourcers from Day 10; weekly sourcer output reviewed and documented; manager confirms independent desk direction without prompting by Day 60", sort_order: 4 },
      { plan_type: "probation", role_slug: "foundation_to_senior", goal_category: "individual", goal_title: "Maintain confidentiality and professional conduct throughout probation", goal_description: "Uphold full confidentiality and professional conduct standards per the Code of Conduct and NDA from Day 1", target_metric: "Zero policy violations; no external sharing of internal tools, strategy, or business information; full adherence to Code of Conduct, NDA, and data security standards throughout probation", sort_order: 5 },

      // ─── GROWTH: Associate Recruiter — 3 additional goals ────────────────────
      { plan_type: "growth", role_slug: "associate_recruiter", goal_category: "production", goal_title: "Achieve first independent placement", goal_description: "Close a clean PO/start without manager-led submission assistance; candidate starts and bills for minimum 30 days", target_metric: "First clean PO/start confirmed with candidate starts, bills, and remains committed for minimum 30 days; PO confirmation and retention status documented", sort_order: 3 },
      { plan_type: "growth", role_slug: "associate_recruiter", goal_category: "production", goal_title: "Improve submission-to-interview conversion rate", goal_description: "Drive submitted candidates to interview stage and reduce submission rejection rate", target_metric: "Minimum 2-3 interview-stage candidates achieved during growth plan window; submission rejection rate reduces vs. pre-plan baseline", sort_order: 4 },
      { plan_type: "growth", role_slug: "associate_recruiter", goal_category: "individual", goal_title: "Demonstrate ATS mastery and reporting discipline", goal_description: "Maintain 98%+ ATS accuracy and proactive weekly reporting throughout the growth plan", target_metric: "ATS accuracy at 98%+ for entire growth period; weekly tracker submitted proactively without manager follow-up; zero same-day logging gaps", sort_order: 5 },

      // ─── GROWTH: Senior Recruiter — 3 additional goals ───────────────────────
      { plan_type: "growth", role_slug: "senior_recruiter", goal_category: "production", goal_title: "Achieve placement volume target", goal_description: "Close a minimum number of clean, retained placements during the growth plan period", target_metric: "Minimum 2 clean POs/starts during growth plan; strong performance is 3+; all starts billed and retained for 30+ days; PO and retention status documented", sort_order: 3 },
      { plan_type: "growth", role_slug: "senior_recruiter", goal_category: "individual", goal_title: "Improve candidate follow-up and falloff prevention", goal_description: "Follow up all submitted candidates consistently and prevent avoidable falloffs throughout the plan", target_metric: "All submitted candidates followed up 2x/week; zero avoidable falloffs due to missed follow-up or screening gaps; risk log maintained for active candidates", sort_order: 4 },
      { plan_type: "growth", role_slug: "senior_recruiter", goal_category: "production", goal_title: "Build repeatable pipeline and conversion discipline", goal_description: "Sustain strong submission volume and track rejections to improve conversion strategy over time", target_metric: "6-8 quality submissions/week sustained for final 4 weeks of plan; rejection reasons tracked and strategy adjusted weekly with documented action plan", sort_order: 5 },

      // ─── GROWTH: Lead Recruiter — 3 additional goals ─────────────────────────
      { plan_type: "growth", role_slug: "lead_recruiter", goal_category: "team",       goal_title: "Elevate team submission quality and reduce rejection rate", goal_description: "Coach team to reduce submission rejection rate and eliminate preventable errors", target_metric: "Team submission rejection rate reduces by minimum 15% vs. pre-plan baseline; zero duplicate or RTR errors under lead oversight during growth plan", sort_order: 3 },
      { plan_type: "growth", role_slug: "lead_recruiter", goal_category: "team",       goal_title: "Build and maintain structured team pipeline review cadence", goal_description: "Conduct regular pipeline aging reviews to ensure all active candidates have documented next steps", target_metric: "Weekly pipeline aging reviews documented for entire growth plan; no active candidate silent for more than 5 business days; all aging candidates with updated next steps", sort_order: 4 },
      { plan_type: "growth", role_slug: "lead_recruiter", goal_category: "individual", goal_title: "Demonstrate delivery leadership and proactive escalation", goal_description: "Own all client/candidate blockers and escalate without prompting throughout the growth plan", target_metric: "All client/candidate/submission blockers escalated within same business day; no issues withheld or escalated late; manager confirms independent delivery leadership at plan review", sort_order: 5 },

      // ─── GROWTH: Associate Manager — 3 additional goals ──────────────────────
      { plan_type: "growth", role_slug: "associate_manager", goal_category: "team",       goal_title: "Drive team to achieve placement target", goal_description: "Ensure team meets or exceeds agreed placement quota during the growth plan period", target_metric: "Team achieves agreed placement quota; individual recruiter performance gaps documented and corrected within 1 week of identification throughout growth plan", sort_order: 3 },
      { plan_type: "growth", role_slug: "associate_manager", goal_category: "team",       goal_title: "Implement and sustain delivery metrics reporting", goal_description: "Deliver proactive weekly reports covering full delivery pipeline for every week of the growth plan", target_metric: "Weekly report covering submissions, interviews, offers, starts, and falloffs delivered proactively; no manager prompting required for any weekly report during growth plan", sort_order: 4 },
      { plan_type: "growth", role_slug: "associate_manager", goal_category: "individual", goal_title: "Demonstrate escalation ownership and quality control", goal_description: "Own all delivery quality issues and escalate proactively without manager prompting throughout the growth plan", target_metric: "All client/candidate/quality issues escalated within same business day; zero quality gaps reaching client without manager awareness; 100% same-day follow-up on active interview, offer, and start items", sort_order: 5 },

      // ─── GROWTH: Account Manager — 3 additional goals ────────────────────────
      { plan_type: "growth", role_slug: "account_manager", goal_category: "production", goal_title: "Increase active requirement intake and account scope", goal_description: "Open new or expanded requirements from managed accounts and document expansion opportunities", target_metric: "Minimum 2 new or expanded requirements opened under account manager ownership during growth plan; all expansion opportunities documented in account plan", sort_order: 3 },
      { plan_type: "growth", role_slug: "account_manager", goal_category: "individual", goal_title: "Build structured client communication cadence", goal_description: "Maintain consistent, documented client touchpoints across all active accounts throughout the growth plan", target_metric: "2-3 documented client touchpoints per active account per week for entire growth plan; client satisfaction maintained with zero unresolved escalations at time of review", sort_order: 4 },
      { plan_type: "growth", role_slug: "account_manager", goal_category: "team",       goal_title: "Deliver weekly delivery team briefing consistently", goal_description: "Brief the delivery team every week without prompting, covering all priorities and client updates", target_metric: "Weekly briefing to delivery team covering priorities, changes, client feedback, and stuck items — delivered proactively for every week of growth plan without manager prompting", sort_order: 5 },
    ];

    // One-time updates: correct PIP target_metrics to exactly match the uploaded doc
    // ("Healthcare PIP Plans by Role"). Only updates rows that still have the old
    // generic values — if an admin already edited a metric, the WHERE match fails
    // and that row is safely skipped.
    const pipMetricUpdates: { role: string; title: string; metric: string }[] = [
      // Associate Recruiter
      { role: "associate_recruiter", title: "Achieve minimum daily outreach target", metric: "Minimum 40-60 qualified outreach attempts per working day, based on assigned roles and portal availability" },
      { role: "associate_recruiter", title: "Complete minimum daily phone screens",  metric: "Minimum 4-6 completed candidate screens per working day" },
      { role: "associate_recruiter", title: "Achieve qualified submissions per week", metric: "Minimum 4-6 manager-approved, complete, and relevant submissions per week" },
      { role: "associate_recruiter", title: "Maintain ATS logging accuracy",          metric: "95%+ same-day updates for candidate status, notes, follow-ups, RTR, and submission details" },
      // Senior Recruiter
      { role: "senior_recruiter", title: "Achieve minimum daily outreach",          metric: "Minimum 50-75 qualified outreach attempts per working day" },
      { role: "senior_recruiter", title: "Complete minimum weekly phone screens",    metric: "Minimum 5-8 completed candidate screens per working day" },
      { role: "senior_recruiter", title: "Restore weekly submission volume",         metric: "Minimum 6-8 complete, accurate, and relevant submissions per week" },
      { role: "senior_recruiter", title: "Achieve placement rate recovery",          metric: "Minimum 1 offer-stage or start-ready candidate during the PIP period, where job flow allows" },
      { role: "senior_recruiter", title: "Maintain ATS compliance and accuracy",     metric: "98% same-day accuracy for submissions, RTR, follow-ups, interview status, and onboarding notes" },
      // Lead Recruiter
      { role: "lead_recruiter", title: "Restore personal outreach and screening metrics",              metric: "Maintain agreed personal recruiter output if the role carries individual requisitions; personal production standard must not fall below minimum while team oversight is active" },
      { role: "lead_recruiter", title: "Recover strategic placement cadence",                          metric: "Zero preventable duplicate or RTR-related errors after PIP start; 100% QC of assigned team submissions before client/VMS submission where required" },
      { role: "lead_recruiter", title: "Improve team submission-to-interview conversion",              metric: "Minimum 2 documented coaching sessions per week with assigned recruiters; minimum 2 structured pipeline aging reviews per week; coaching notes logged and shared" },
      { role: "lead_recruiter", title: "Maintain 100% ATS compliance and update team playbooks",      metric: "95%+ daily accuracy across assigned team pipeline; team tracker updated same-day; ATS compliance verified weekly by manager or lead" },
      // Associate Manager
      { role: "associate_manager", title: "Restore structured direct-report performance oversight",    metric: "100% of direct reports with active goals and documented check-ins; all recruiter performance gaps identified and corrected within same PIP window" },
      { role: "associate_manager", title: "Return team to placement quota",                            metric: "Team achieves agreed placement target improvement during PIP; individual recruiter gaps documented and addressed within 1 week of identification" },
      { role: "associate_manager", title: "Improve team outreach and submission volume",               metric: "100% active roles categorized by urgency and ownership each working day; 95%+ clean submission standard; daily review of recruiter activity and submissions" },
      { role: "associate_manager", title: "Implement structured escalation and ATS audit process",     metric: "100% of escalations logged and resolved within same business day; weekly pipeline report delivered proactively; minimum 3 documented coaching/correction actions per week" },
      // Account Manager
      { role: "account_manager", title: "Recover at-risk client fill rate",            metric: "95%+ complete intake for all active roles: title, location, schedule, pay/rate, must-haves, credentials, submission rules, and client contact path" },
      { role: "account_manager", title: "Improve client communication SLA",             metric: "Same business day response to all active client/MSP/VMS communications; minimum 2-3 meaningful follow-ups per active account per week" },
      { role: "account_manager", title: "Rebuild client pipeline and requisition volume", metric: "Weekly briefing to delivery team covering priorities, client feedback, and stuck items; feedback collected within 24-48 hours on submissions, interviews, and offers" },
      { role: "account_manager", title: "Ensure ATS accuracy for all managed requisitions", metric: "Weekly account risk log maintained for aging roles, low rates, falloffs, and client dissatisfaction; identify at least 1-2 expansion or additional requirement opportunities during PIP" },
    ];
    for (const u of pipMetricUpdates) {
      await db.execute(sql`
        UPDATE plan_goal_templates
        SET target_metric = ${u.metric}
        WHERE plan_type = 'pip'::employee_plan_type AND role_slug = ${u.role} AND goal_title = ${u.title}
      `);
    }

    // Correct foundation_to_senior Growth PO/start targets: 3 per month = 9 minimum across 90 days
    const growthPoStartUpdates: { title: string; metric: string; desc: string }[] = [
      {
        title: "D1-30: Clean POs or starts",
        metric: "Minimum 3 clean POs or starts in the first 30 days; each placement counts only when the candidate starts, stays, and bills consistently",
        desc:   "Close minimum 3 clean POs or confirmed starts from the live pipeline in the first 30 days, assuming client demand remains active. A PO only counts when the candidate starts, stays, and bills consistently.",
      },
      {
        title: "D31-60: Clean POs or starts",
        metric: "Minimum 3 additional clean POs or starts in Days 31-60; running total of 6 clean starts by Day 60; retained billing status documented for each",
        desc:   "Close minimum 3 additional clean POs or confirmed starts. Running total of 6 clean starts by Day 60. Focus on retained placements where the candidate starts, stays, and bills consistently — not just initial PO receipt.",
      },
      {
        title: "D61-90: Total clean POs or starts \u2014 90-day target",
        metric: "Minimum 9 total clean POs/starts across the full 90-day plan (3 per month); strong performance = 10+; PO/start and retained billing status documented for every placement",
        desc:   "Reach the 90-day placement target with clean, retained starts \u2014 minimum 9 total (3 per month). Strong performance is 10+. Each placement is assessed on whether the candidate started, stayed, billed, and the client relationship remained stable.",
      },
    ];
    for (const u of growthPoStartUpdates) {
      await db.execute(sql`
        UPDATE plan_goal_templates
        SET target_metric = ${u.metric}, goal_description = ${u.desc}
        WHERE plan_type = 'growth'::employee_plan_type AND role_slug = 'foundation_to_senior' AND goal_title = ${u.title}
      `);
    }

    // One-time cleanup: remove the 8 original foundation_to_senior growth goals
    // that were replaced with the full 19-goal phase-specific set from the Word doc.
    // Safe to run multiple times — only deletes rows with these exact titles.
    const oldFoundationTitles = [
      "Convert the live pipeline",
      "Build retained placements across the 90-day window",
      "Achieve quality submission targets",
      "Maintain 2× weekly candidate follow-up",
      "Coordinate and review sourcer output",
      "Submit weekly Friday tracker proactively",
      "Demonstrate confidentiality and trust",
      "Operate with senior-level desk ownership",
    ];
    for (const oldTitle of oldFoundationTitles) {
      await db.execute(sql`
        DELETE FROM plan_goal_templates
        WHERE plan_type = 'growth'::employee_plan_type
          AND role_slug = 'foundation_to_senior'
          AND goal_title = ${oldTitle}
      `);
    }

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
    // 'short_day' tier: worked >= half but < full scheduled hours. ADD VALUE cannot
    // run inside a transaction block, so it is executed standalone here.
    await db.execute(sql`ALTER TYPE attendance_status ADD VALUE IF NOT EXISTS 'short_day'`);
    log("Ensured 'short_day' attendance status exists");
  } catch (err) {
    console.error("short_day enum migration error:", err);
  }

  try {
    // No-grace policy: late is marked immediately after shift start. Apply grace=0 to
    // existing shifts exactly once (guarded by a system_settings marker) so that any
    // later HR-configured grace period is NOT overwritten on subsequent restarts.
    const marker = await db.execute(sql`SELECT key FROM system_settings WHERE key = 'grace_zero_applied' LIMIT 1`);
    if (marker.rows.length === 0) {
      await db.execute(sql`UPDATE shifts SET grace_period_minutes = 0 WHERE grace_period_minutes IS DISTINCT FROM 0`);
      await db.execute(sql`
        INSERT INTO system_settings (key, value, updated_at)
        VALUES ('grace_zero_applied', 'true'::jsonb, NOW())
        ON CONFLICT (key) DO NOTHING
      `);
      log("Applied one-time no-grace (grace_period_minutes=0) to all shifts");
    }
  } catch (err) {
    console.error("Grace-zero one-time migration error:", err);
  }

  try {
    // Restore a 15-minute grace window once. The earlier no-grace migration
    // zeroed every shift's grace_period_minutes, which wrongly flagged on-time
    // staff as Late (especially Shift C under DST). This one-time restore (guarded
    // by its own marker) sets grace back to 15 without re-firing on later
    // restarts, so any subsequent HR-configured grace period is preserved.
    const restoreMarker = await db.execute(sql`SELECT key FROM system_settings WHERE key = 'grace_restore_15_applied' LIMIT 1`);
    if (restoreMarker.rows.length === 0) {
      await db.execute(sql`UPDATE shifts SET grace_period_minutes = 15 WHERE grace_period_minutes IS DISTINCT FROM 15`);
      await db.execute(sql`
        INSERT INTO system_settings (key, value, updated_at)
        VALUES ('grace_restore_15_applied', 'true'::jsonb, NOW())
        ON CONFLICT (key) DO NOTHING
      `);
      log("Restored grace_period_minutes=15 on all shifts (one-time)");
    }
  } catch (err) {
    console.error("Grace-restore one-time migration error:", err);
  }

  try {
    // One-time cleanup of wrongful auto-absent rows for shiftless employees. The
    // 23:59 sweep is meant to skip staff with no shift, but production (running an
    // older build) stamped "[Auto] No punch-in recorded" Absents on them. Those
    // rows penalise balances/reports. We void them for employees who currently
    // have no shift assigned, snapshotting what was removed for reviewability.
    const cleanupMarker = await db.execute(sql`SELECT key FROM system_settings WHERE key = 'wrongful_absent_cleanup_v1' LIMIT 1`);
    if (cleanupMarker.rows.length === 0) {
      const doomed = await db.execute(sql`
        SELECT a.id, a.user_id, a.date
        FROM attendance a
        JOIN admin_users u ON u.id = a.user_id
        WHERE a.status = 'absent'
          AND a.notes = '[Auto] No punch-in recorded'
          AND a.punch_in IS NULL
          AND u.shift_id IS NULL
          AND a.date >= (CURRENT_DATE - INTERVAL '60 days')::text
      `);
      const removedRows = doomed.rows as { id: string; user_id: string; date: string }[];
      if (removedRows.length > 0) {
        const ids = removedRows.map(r => r.id);
        await db.execute(sql`
          DELETE FROM attendance
          WHERE id = ANY(ARRAY[${sql.join(ids.map(id => sql`${id}`), sql`, `)}]::varchar[])
        `);
      }
      await db.execute(sql`
        INSERT INTO system_settings (key, value, updated_at)
        VALUES ('wrongful_absent_cleanup_v1', ${JSON.stringify({ removedCount: removedRows.length, removed: removedRows, ranAt: new Date().toISOString() })}::jsonb, NOW())
        ON CONFLICT (key) DO NOTHING
      `);
      log(`Cleaned up ${removedRows.length} wrongful auto-absent row(s) for shiftless employees`);
    }
  } catch (err) {
    console.error("Wrongful-absent cleanup migration error:", err);
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
  await ensureContentStudioTables();
  await ensureCardTemplatesAndBrand();
  try {
    const { seedStudioPromptLibrary } = await import("./studioPromptSeed");
    const seedResult = await seedStudioPromptLibrary();
    log(`Content Studio prompt library: ${seedResult.inserted} new of ${seedResult.total} templates`);
  } catch (err) {
    console.error("Content Studio prompt library seed error:", err);
  }
  try {
    const { runInsightsLaunchSetup, resetLaunchRoutingIfPrematured } = await import("./insightsLaunch");
    const launch = await runInsightsLaunchSetup();
    if (launch.ok) {
      log(`Hire'in Insights launch: ${launch.inserted} seeded, ${launch.skipped} existing (drafts only — no routing on startup)`);
    }
    const resetResult = await resetLaunchRoutingIfPrematured();
    if (resetResult.ok && "reset" in resetResult && resetResult.reset > 0) {
      log(`Hire'in Insights: reset ${resetResult.reset} prematurely routed article(s) back to draft`);
    }
  } catch (err) {
    console.error("Hire'in Insights launch setup error:", err);
  }
  await backfillEmployeeIds();
  await backfillHrLetterNames();
  await backfillHolidayAttendance();
  await applyOneTimeLeaveCorrections();
  await ensureShiftTables();
  await ensureNightShiftConsentsTable();
  await seedShiftData();
  await notifyShiftCorrectionEmployees();

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

  // ── Content Studio approval-workflow enum values ────────────────────────────
  try {
    // New statuses for the marketing → super-admin sign-off gate (idempotent).
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TYPE article_status ADD VALUE IF NOT EXISTS 'pending_marketing';
      EXCEPTION WHEN others THEN NULL; END $$;
    `);
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TYPE article_status ADD VALUE IF NOT EXISTS 'pending_final_approval';
      EXCEPTION WHEN others THEN NULL; END $$;
    `);
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TYPE article_status ADD VALUE IF NOT EXISTS 'archived';
      EXCEPTION WHEN others THEN NULL; END $$;
    `);
    // New statuses for CM → author workflow gate (idempotent).
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TYPE article_status ADD VALUE IF NOT EXISTS 'pending_cm_review';
      EXCEPTION WHEN others THEN NULL; END $$;
    `);
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TYPE article_status ADD VALUE IF NOT EXISTS 'pending_author';
      EXCEPTION WHEN others THEN NULL; END $$;
    `);
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TYPE article_status ADD VALUE IF NOT EXISTS 'author_approved';
      EXCEPTION WHEN others THEN NULL; END $$;
    `);
    log("Content Studio article_status enum values ensured");
  } catch (err) {
    console.error("Content Studio article_status enum migration error:", err);
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
        CREATE TYPE regularization_status AS ENUM('pending','approved','rejected','returned');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    // Existing installs created the enum before 'returned' existed. The status
    // column may be enum-typed (via migration 0008), so extend the enum or the
    // return-for-clarification write will fail at the DB layer.
    await db.execute(sql`ALTER TYPE regularization_status ADD VALUE IF NOT EXISTS 'returned'`);
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
    // Patch columns added after the table's initial release (return-for-clarification flow + evidence).
    await db.execute(sql`ALTER TABLE attendance_regularizations ADD COLUMN IF NOT EXISTS manager_adjusted_punch_in TIMESTAMP`);
    await db.execute(sql`ALTER TABLE attendance_regularizations ADD COLUMN IF NOT EXISTS manager_adjusted_punch_out TIMESTAMP`);
    await db.execute(sql`ALTER TABLE attendance_regularizations ADD COLUMN IF NOT EXISTS return_comment TEXT`);
    await db.execute(sql`ALTER TABLE attendance_regularizations ADD COLUMN IF NOT EXISTS attachment_url TEXT`);
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

  // One-time patch: rename "90-day performance plan" → "90-day growth plan" in the
  // stored addendum clause sentence. Only updates the row if it still has the old wording.
  try {
    await db.execute(sql`
      UPDATE letter_template_sentences
      SET sentence = REPLACE(sentence, '90-day performance plan', '90-day growth plan'),
          label = '90-Day Growth Plan Review & Salary Revision Eligibility'
      WHERE key = 'growth_plan_review'
        AND category = 'addendum_clause'
        AND sentence LIKE '%90-day performance plan%'
    `);
    log("Addendum clause text patched: 'performance plan' → 'growth plan'");
  } catch (err) {
    console.error("Addendum clause text patch error (non-fatal):", err);
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

  // ── Unified signature ledger ──────────────────────────────────────────────────
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS signature_records (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        document_type varchar NOT NULL,
        document_id varchar NOT NULL,
        reference_number varchar,
        signer_name varchar NOT NULL,
        signer_role varchar,
        signer_user_id varchar,
        signed_at timestamp NOT NULL DEFAULT now(),
        ip_address varchar,
        user_agent text,
        content_hash varchar,
        auth_code varchar,
        section_initials jsonb,
        certificate_path varchar,
        metadata jsonb,
        created_at timestamp DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_signature_records_doc ON signature_records(document_type, document_id);
      CREATE INDEX IF NOT EXISTS idx_signature_records_ref ON signature_records(reference_number);
    `);
    await db.execute(sql`ALTER TABLE signature_records ADD COLUMN IF NOT EXISTS consent_accepted_at timestamp`);
    log("Signature ledger table ensured");
  } catch (err) {
    console.error("Signature ledger table migration error:", err);
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

  // ── Pending Changes (automated-job guardrail) ─────────────────────────────────
  // Automated/scheduled jobs propose changes here instead of overwriting user data.
  // A Super Admin reviews and approves (apply + audit) or rejects (discard).
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS pending_changes (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        source_job VARCHAR NOT NULL,
        run_date VARCHAR NOT NULL,
        target_user_id VARCHAR REFERENCES admin_users(id),
        target_table VARCHAR NOT NULL,
        target_record_id VARCHAR,
        change_type VARCHAR NOT NULL,
        field VARCHAR,
        current_value TEXT,
        proposed_value TEXT,
        reason TEXT,
        payload JSONB,
        status VARCHAR NOT NULL DEFAULT 'pending',
        reviewed_by VARCHAR REFERENCES admin_users(id),
        reviewed_at TIMESTAMP,
        review_note TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_pending_change_dedupe
        ON pending_changes(source_job, target_user_id, target_table, run_date, field)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_pending_change_status_date
        ON pending_changes(status, run_date)
    `);
    log("Pending changes table ensured");
  } catch (err) {
    console.error("Pending changes table migration error:", err);
  }

  // Release Notes table
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS release_notes (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        version VARCHAR,
        title VARCHAR,
        body TEXT,
        changelog_input TEXT,
        sent_channels TEXT[] DEFAULT '{}',
        sent_at TIMESTAMP,
        sent_by_user_id VARCHAR REFERENCES admin_users(id),
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);
    log("Release notes table ensured");
  } catch (err) {
    console.error("Release notes table migration error:", err);
  }

  // Attendance exception columns on attendance table + escalation dedup log
  try {
    // Exception review fields stored directly on the attendance row (1:1 relationship)
    await db.execute(sql`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS exception_status VARCHAR`);
    await db.execute(sql`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS exception_standard_hours NUMERIC(5,2)`);
    await db.execute(sql`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS exception_comment TEXT`);
    await db.execute(sql`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS exception_resolved_by VARCHAR REFERENCES admin_users(id)`);
    await db.execute(sql`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS exception_resolved_at TIMESTAMP`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_att_exception_status ON attendance(exception_status) WHERE exception_status IS NOT NULL`);
    // Escalation dedup log — one row per (employee, month, tier); not tied to a single attendance record
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS attendance_escalation_log (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        employee_id VARCHAR NOT NULL REFERENCES admin_users(id),
        month VARCHAR(7) NOT NULL,
        tier INTEGER NOT NULL,
        count_at_trigger INTEGER NOT NULL,
        notified_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_att_escalation_tier
        ON attendance_escalation_log(employee_id, month, tier)
    `);
    log("Attendance exception columns and escalation log ensured");
  } catch (err) {
    console.error("Attendance exception tables migration error:", err);
  }

  // Auto-create attendance report run for current month on server start if none exists
  checkAndAutoCreateRun().catch(err =>
    console.error("[index] Attendance auto-create on startup failed:", err)
  );

  await ensureHealthcarePlansTables();

  // Travel Pay Calculator — enum types + tables (idempotent, matches shared/schema.ts exactly)
  try {
    // Enum types — PG has no IF NOT EXISTS for CREATE TYPE; use DO $$ block
    await db.execute(sql`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'travel_quote_status') THEN
          CREATE TYPE travel_quote_status AS ENUM ('draft','submitted','approved','rejected');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'travel_compliance_status') THEN
          CREATE TYPE travel_compliance_status AS ENUM ('compliant','over_cap','override_pending','override_approved');
        END IF;
      END $$
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS gsa_rate_snapshots (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        zip VARCHAR NOT NULL,
        county VARCHAR,
        state VARCHAR,
        city VARCHAR,
        fiscal_year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        lodging_rate NUMERIC NOT NULL,
        mie_rate NUMERIC NOT NULL,
        first_last_day_mie NUMERIC NOT NULL,
        snapshot_date TIMESTAMP DEFAULT NOW(),
        source_version VARCHAR,
        is_cached BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_gsa_snapshot_zip_fy_month ON gsa_rate_snapshots(zip, fiscal_year, month)
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS travel_margin_floors (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        role_type VARCHAR NOT NULL UNIQUE,
        red_threshold_pct NUMERIC NOT NULL,
        yellow_threshold_pct NUMERIC NOT NULL,
        payroll_burden_pct NUMERIC NOT NULL DEFAULT 18.8,
        default_ot_multiplier NUMERIC NOT NULL DEFAULT 1.5,
        default_callback_rate NUMERIC NOT NULL DEFAULT 0,
        default_holiday_rate NUMERIC NOT NULL DEFAULT 0,
        default_on_call_rate NUMERIC NOT NULL DEFAULT 0,
        default_vms_fee_pct NUMERIC NOT NULL DEFAULT 3,
        updated_at TIMESTAMP DEFAULT NOW(),
        updated_by VARCHAR REFERENCES admin_users(id)
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS travel_quotes (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        recruiter_id VARCHAR NOT NULL REFERENCES admin_users(id),
        candidate_name VARCHAR NOT NULL,
        facility_client_name VARCHAR NOT NULL DEFAULT '',
        label VARCHAR,
        assignment_zip VARCHAR NOT NULL DEFAULT '',
        state VARCHAR,
        county VARCHAR,
        city VARCHAR,
        role_type VARCHAR NOT NULL DEFAULT 'healthcare_travel',
        weeks_in_assignment INTEGER NOT NULL DEFAULT 13,
        month INTEGER NOT NULL DEFAULT 1,
        year INTEGER NOT NULL DEFAULT 2025,
        away_days INTEGER NOT NULL DEFAULT 5,
        scheduled_hours NUMERIC NOT NULL DEFAULT 36,
        w2_hourly NUMERIC NOT NULL DEFAULT 0,
        ot_multiplier NUMERIC NOT NULL DEFAULT 1.5,
        total_hours NUMERIC NOT NULL DEFAULT 36,
        master_bill_rate NUMERIC NOT NULL DEFAULT 0,
        ot_bill_rate NUMERIC,
        client_ot_multiplier NUMERIC NOT NULL DEFAULT 1.5,
        vms_fee_pct NUMERIC NOT NULL DEFAULT 3,
        orientation_hours_total NUMERIC NOT NULL DEFAULT 0,
        orientation_hours_billable NUMERIC NOT NULL DEFAULT 0,
        orientation_hours_free NUMERIC NOT NULL DEFAULT 0,
        orientation_pay_rate NUMERIC,
        orientation_ot_multiplier NUMERIC NOT NULL DEFAULT 1,
        completion_bonus NUMERIC NOT NULL DEFAULT 0,
        daily_mie NUMERIC,
        daily_lodging NUMERIC,
        decreased_stipend_override NUMERIC,
        payroll_burden_pct NUMERIC NOT NULL DEFAULT 18.8,
        on_call_rate NUMERIC NOT NULL DEFAULT 0,
        callback_rate NUMERIC NOT NULL DEFAULT 0,
        holiday_rate NUMERIC NOT NULL DEFAULT 0,
        status VARCHAR NOT NULL DEFAULT 'draft',
        gsa_snapshot_id VARCHAR REFERENCES gsa_rate_snapshots(id),
        compliance_override_by VARCHAR REFERENCES admin_users(id),
        compliance_override_reason TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_travel_quotes_recruiter ON travel_quotes(recruiter_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_travel_quotes_status ON travel_quotes(status)`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS travel_quote_outputs (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        quote_id VARCHAR NOT NULL UNIQUE REFERENCES travel_quotes(id) ON DELETE CASCADE,
        weekly_taxable NUMERIC,
        weekly_non_taxable NUMERIC,
        weekly_gross NUMERIC,
        hourly_taxable NUMERIC,
        hourly_blended NUMERIC,
        ot_rate NUMERIC,
        wage_payable_weekly NUMERIC,
        payroll_taxes_weekly NUMERIC,
        non_taxable_weekly NUMERIC,
        orientation_revenue NUMERIC,
        orientation_candidate_cost NUMERIC,
        orientation_net NUMERIC,
        total_billing_weekly NUMERIC,
        total_billing_contract NUMERIC,
        total_expense_weekly NUMERIC,
        total_expense_contract NUMERIC,
        gross_profit_weekly NUMERIC,
        net_margin_per_hour NUMERIC,
        net_margin_per_week NUMERIC,
        net_margin_per_contract NUMERIC,
        net_margin_pct NUMERIC,
        stipend_compliance_status VARCHAR,
        margin_status VARCHAR,
        calculated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    log("Travel pay calculator tables ensured");
  } catch (err) {
    console.error("Travel pay calculator tables migration error:", err);
  }

  await registerRoutes(httpServer, app);

  try {
    const { hydrateAccessControl } = await import("./accessControlService");
    await hydrateAccessControl();
    log("Access control matrix hydrated");
  } catch (err) {
    console.error("Access control hydration error (non-fatal):", err);
  }

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
