-- HIRD: Hire'in Request Desk internal help desk ticketing system
-- Creates all enums, tables, and indexes for the HIRD module.

DO $$ BEGIN
  CREATE TYPE internal_request_status AS ENUM (
    'pending_approval', 'assigned', 'in_progress', 'resolved', 'closed', 'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE internal_request_type AS ENUM ('access', 'hr', 'ops', 'general');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE internal_request_priority AS ENUM ('p1', 'p2', 'p3', 'p4');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS internal_requests (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number varchar NOT NULL UNIQUE,
  requester_id varchar NOT NULL REFERENCES admin_users(id),
  requested_for_id varchar REFERENCES admin_users(id),
  type internal_request_type NOT NULL,
  title varchar NOT NULL,
  description text NOT NULL,
  priority internal_request_priority NOT NULL DEFAULT 'p3',
  status internal_request_status NOT NULL DEFAULT 'pending_approval',
  manager_id varchar REFERENCES admin_users(id),
  assigned_to_id varchar REFERENCES admin_users(id),
  department_id varchar REFERENCES departments(id),
  needed_by_date date,
  template_data jsonb,
  attachment_url text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Add columns that may not exist on environments that ran an earlier version
ALTER TABLE internal_requests ADD COLUMN IF NOT EXISTS requested_for_id varchar REFERENCES admin_users(id);
ALTER TABLE internal_requests ADD COLUMN IF NOT EXISTS attachment_url text;

CREATE TABLE IF NOT EXISTS internal_request_comments (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id varchar NOT NULL REFERENCES internal_requests(id),
  author_id varchar NOT NULL REFERENCES admin_users(id),
  body text NOT NULL,
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS internal_request_approvals (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id varchar NOT NULL REFERENCES internal_requests(id),
  approver_id varchar NOT NULL REFERENCES admin_users(id),
  decision varchar NOT NULL,
  reason text,
  decided_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS internal_request_audit_log (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id varchar NOT NULL REFERENCES internal_requests(id),
  actor_id varchar NOT NULL REFERENCES admin_users(id),
  action varchar NOT NULL,
  old_status varchar,
  new_status varchar,
  metadata jsonb,
  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_internal_requests_requester ON internal_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_internal_requests_status ON internal_requests(status);
CREATE INDEX IF NOT EXISTS idx_internal_requests_manager ON internal_requests(manager_id);
CREATE INDEX IF NOT EXISTS idx_internal_requests_assigned ON internal_requests(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_internal_request_comments_request ON internal_request_comments(request_id);
CREATE INDEX IF NOT EXISTS idx_internal_request_audit_request ON internal_request_audit_log(request_id);
