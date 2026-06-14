CREATE TABLE IF NOT EXISTS "policy_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar NOT NULL,
	"content" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "policy_signing_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_document_id" varchar NOT NULL,
	"employee_id" varchar NOT NULL,
	"sent_at" timestamp DEFAULT now(),
	"sent_by_user_id" varchar,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"due_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "policy_signatures" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"signing_request_id" varchar NOT NULL,
	"employee_id" varchar NOT NULL,
	"signed_at" timestamp DEFAULT now(),
	"ip_address" varchar,
	"page_initials" jsonb NOT NULL,
	"final_signature" varchar NOT NULL,
	"pdf_path" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "policy_signing_requests" ADD CONSTRAINT "policy_signing_requests_policy_document_id_policy_documents_id_fk" FOREIGN KEY ("policy_document_id") REFERENCES "public"."policy_documents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "policy_signing_requests" ADD CONSTRAINT "policy_signing_requests_employee_id_admin_users_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "policy_signing_requests" ADD CONSTRAINT "policy_signing_requests_sent_by_user_id_admin_users_id_fk" FOREIGN KEY ("sent_by_user_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "policy_signatures" ADD CONSTRAINT "policy_signatures_signing_request_id_policy_signing_requests_id_fk" FOREIGN KEY ("signing_request_id") REFERENCES "public"."policy_signing_requests"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "policy_signatures" ADD CONSTRAINT "policy_signatures_employee_id_admin_users_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
