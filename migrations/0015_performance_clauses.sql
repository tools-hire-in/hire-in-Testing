ALTER TABLE "offer_letters" ADD COLUMN IF NOT EXISTS "performance_probation_review" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "offer_letters" ADD COLUMN IF NOT EXISTS "max_revision_salary" numeric;
--> statement-breakpoint
ALTER TABLE "offer_letters" ADD COLUMN IF NOT EXISTS "max_revision_salary_in_words" varchar;
--> statement-breakpoint
ALTER TABLE "offer_letters" ADD COLUMN IF NOT EXISTS "performance_clause_text" text;
--> statement-breakpoint
ALTER TABLE "offer_letter_addendums" ADD COLUMN IF NOT EXISTS "include_growth_plan_clause" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "offer_letter_addendums" ADD COLUMN IF NOT EXISTS "growth_plan_current_salary" varchar;
--> statement-breakpoint
ALTER TABLE "offer_letter_addendums" ADD COLUMN IF NOT EXISTS "growth_plan_max_revision_salary" varchar;
--> statement-breakpoint
ALTER TABLE "offer_letter_addendums" ADD COLUMN IF NOT EXISTS "growth_plan_clause_text" text;
--> statement-breakpoint
INSERT INTO "letter_template_sentences" ("id","key","category","label","sentence","sort_order") VALUES
  (gen_random_uuid(),'probation_performance_review','offer_clause','Probationary Compensation & Performance-Based Salary Review',
E'Your compensation during the initial probation period will be ₹[ProbationSalary] per month. The initial probation period will be [ProbationMonths] from your date of joining.\n\nUpon completion of the initial probation period, the Company will conduct a performance and delivery review. Subject to your performance, achievement of assigned goals, quality of delivery, consistency, professional conduct, and overall contribution, your salary may be reconsidered.\n\nEmployees who meet the expected performance and delivery standards may continue at the existing compensation or may be considered for revision based on management''s assessment. Employees who significantly exceed the expected goals and demonstrate strong ownership, consistent delivery, and measurable business impact may be considered for a salary revision of up to ₹[MaxRevisionSalary] per month.\n\nAny salary revision will be at the sole discretion of the Company and will be confirmed separately in writing. Mention of the review amount does not create an automatic entitlement or guarantee of salary increase.\nThe Company may also extend the probation period up to [ExtendedProbationMonths], if required, based on performance, delivery, conduct, or business needs.',
1),
  (gen_random_uuid(),'growth_plan_review','addendum_clause','90-Day Performance Review & Salary Revision Eligibility',
E'Your current salary is ₹[CurrentSalary] per month. As discussed, a 90-day performance plan with defined goals and targets has been agreed with you.\n\nAt the end of the 90-day period, your performance will be reviewed against the agreed goals and targets, productivity expectations, quality of submissions, successful delivery outcomes, compliance discipline, communication standards, ownership, and overall contribution to the Healthcare Recruitment department.\n\nBased on the outcome of this review:\n- If performance meets the agreed targets, the Company may continue the existing salary or consider a revision based on overall performance and business needs.\n- If performance significantly exceeds the agreed targets and demonstrates strong, measurable results, the Company may consider a salary revision of up to ₹[MaxRevisionSalary] per month.\n- If performance is below the agreed targets, the plan period may be extended or the arrangement reviewed further in accordance with your terms of employment.\n\nAny salary revision, including any increase up to ₹[MaxRevisionSalary] per month, shall not be automatic and will be subject to management review, business requirements, and written approval by the Company.',
1)
ON CONFLICT ON CONSTRAINT "uq_letter_template_key_category" DO NOTHING;
