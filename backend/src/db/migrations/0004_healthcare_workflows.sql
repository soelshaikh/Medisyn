CREATE TABLE IF NOT EXISTS "prescription_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"type" text NOT NULL,
	"medication_name" text NOT NULL,
	"dosage" text,
	"prescriber_name" text,
	"prescriber_fax" text,
	"file_reference" text,
	"status" text DEFAULT 'submitted' NOT NULL,
	"dispense_notes" text,
	"internal_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "prescription_request_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"facility_id" uuid NOT NULL,
	"previous_status" text,
	"new_status" text NOT NULL,
	"changed_by_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "compounding_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"compound_name" text NOT NULL,
	"strength" text,
	"form" text NOT NULL,
	"quantity" text NOT NULL,
	"special_instructions" text,
	"prescriber_name" text,
	"file_reference" text,
	"quoted_price" numeric(10, 2),
	"quoted_turnaround_days" integer,
	"status" text DEFAULT 'submitted' NOT NULL,
	"internal_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "compounding_request_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"facility_id" uuid NOT NULL,
	"previous_status" text,
	"new_status" text NOT NULL,
	"changed_by_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "minor_ailment_catalog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "minor_ailment_catalog_facility_name_unique" UNIQUE("facility_id","name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "minor_ailment_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"ailment_id" uuid NOT NULL,
	"symptoms" text NOT NULL,
	"duration" text NOT NULL,
	"current_medications" text,
	"health_history" text,
	"treatment_note" text,
	"internal_notes" text,
	"status" text DEFAULT 'submitted' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "minor_ailment_request_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"facility_id" uuid NOT NULL,
	"previous_status" text,
	"new_status" text NOT NULL,
	"changed_by_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pharmacist_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"subject" text NOT NULL,
	"medication_name" text,
	"assigned_to" uuid,
	"status" text DEFAULT 'open' NOT NULL,
	"internal_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conversation_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"facility_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"sender_type" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prescription_requests" ADD CONSTRAINT "prescription_requests_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prescription_requests" ADD CONSTRAINT "prescription_requests_patient_id_users_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prescription_request_history" ADD CONSTRAINT "prescription_request_history_request_id_prescription_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."prescription_requests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prescription_request_history" ADD CONSTRAINT "prescription_request_history_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prescription_request_history" ADD CONSTRAINT "prescription_request_history_changed_by_id_users_id_fk" FOREIGN KEY ("changed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "compounding_requests" ADD CONSTRAINT "compounding_requests_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "compounding_requests" ADD CONSTRAINT "compounding_requests_patient_id_users_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "compounding_request_history" ADD CONSTRAINT "compounding_request_history_request_id_compounding_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."compounding_requests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "compounding_request_history" ADD CONSTRAINT "compounding_request_history_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "compounding_request_history" ADD CONSTRAINT "compounding_request_history_changed_by_id_users_id_fk" FOREIGN KEY ("changed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "minor_ailment_catalog" ADD CONSTRAINT "minor_ailment_catalog_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "minor_ailment_requests" ADD CONSTRAINT "minor_ailment_requests_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "minor_ailment_requests" ADD CONSTRAINT "minor_ailment_requests_patient_id_users_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "minor_ailment_requests" ADD CONSTRAINT "minor_ailment_requests_ailment_id_minor_ailment_catalog_id_fk" FOREIGN KEY ("ailment_id") REFERENCES "public"."minor_ailment_catalog"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "minor_ailment_request_history" ADD CONSTRAINT "minor_ailment_request_history_request_id_minor_ailment_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."minor_ailment_requests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "minor_ailment_request_history" ADD CONSTRAINT "minor_ailment_request_history_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "minor_ailment_request_history" ADD CONSTRAINT "minor_ailment_request_history_changed_by_id_users_id_fk" FOREIGN KEY ("changed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pharmacist_conversations" ADD CONSTRAINT "pharmacist_conversations_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pharmacist_conversations" ADD CONSTRAINT "pharmacist_conversations_patient_id_users_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pharmacist_conversations" ADD CONSTRAINT "pharmacist_conversations_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_conversation_id_pharmacist_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."pharmacist_conversations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rx_requests_facility_patient_idx" ON "prescription_requests" USING btree ("facility_id","patient_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rx_requests_facility_status_idx" ON "prescription_requests" USING btree ("facility_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rx_requests_facility_created_idx" ON "prescription_requests" USING btree ("facility_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rx_history_request_idx" ON "prescription_request_history" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "compound_requests_facility_patient_idx" ON "compounding_requests" USING btree ("facility_id","patient_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "compound_requests_facility_status_idx" ON "compounding_requests" USING btree ("facility_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "compound_requests_facility_created_idx" ON "compounding_requests" USING btree ("facility_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "compound_history_request_idx" ON "compounding_request_history" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "minor_ailment_catalog_facility_active_idx" ON "minor_ailment_catalog" USING btree ("facility_id","is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ailment_requests_facility_patient_idx" ON "minor_ailment_requests" USING btree ("facility_id","patient_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ailment_requests_facility_status_idx" ON "minor_ailment_requests" USING btree ("facility_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ailment_requests_facility_created_idx" ON "minor_ailment_requests" USING btree ("facility_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ailment_history_request_idx" ON "minor_ailment_request_history" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversations_facility_patient_idx" ON "pharmacist_conversations" USING btree ("facility_id","patient_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversations_facility_status_idx" ON "pharmacist_conversations" USING btree ("facility_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversations_facility_created_idx" ON "pharmacist_conversations" USING btree ("facility_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conv_messages_conversation_idx" ON "conversation_messages" USING btree ("conversation_id","created_at");
-- ─────────────────────────────────────────────────────────────────────────────
-- Manual additions (not generated by Drizzle)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Check constraints
ALTER TABLE "prescription_requests"
  ADD CONSTRAINT "prescription_requests_type_check"
  CHECK ("type" IN ('refill', 'transfer', 'new'));

ALTER TABLE "compounding_requests"
  ADD CONSTRAINT "compounding_requests_form_check"
  CHECK ("form" IN ('tablet', 'capsule', 'liquid', 'cream', 'suppository', 'other'));

ALTER TABLE "conversation_messages"
  ADD CONSTRAINT "conversation_messages_sender_type_check"
  CHECK ("sender_type" IN ('patient', 'staff'));

-- 2. Row-Level Security — all 9 healthcare tables
ALTER TABLE "prescription_requests" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prescription_requests_facility_isolation" ON "prescription_requests"
  USING ("facility_id" = current_facility_id())
  WITH CHECK ("facility_id" = current_facility_id());

ALTER TABLE "prescription_request_history" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prescription_request_history_facility_isolation" ON "prescription_request_history"
  USING ("facility_id" = current_facility_id())
  WITH CHECK ("facility_id" = current_facility_id());

ALTER TABLE "compounding_requests" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "compounding_requests_facility_isolation" ON "compounding_requests"
  USING ("facility_id" = current_facility_id())
  WITH CHECK ("facility_id" = current_facility_id());

ALTER TABLE "compounding_request_history" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "compounding_request_history_facility_isolation" ON "compounding_request_history"
  USING ("facility_id" = current_facility_id())
  WITH CHECK ("facility_id" = current_facility_id());

ALTER TABLE "minor_ailment_catalog" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "minor_ailment_catalog_facility_isolation" ON "minor_ailment_catalog"
  USING ("facility_id" = current_facility_id())
  WITH CHECK ("facility_id" = current_facility_id());

ALTER TABLE "minor_ailment_requests" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "minor_ailment_requests_facility_isolation" ON "minor_ailment_requests"
  USING ("facility_id" = current_facility_id())
  WITH CHECK ("facility_id" = current_facility_id());

ALTER TABLE "minor_ailment_request_history" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "minor_ailment_request_history_facility_isolation" ON "minor_ailment_request_history"
  USING ("facility_id" = current_facility_id())
  WITH CHECK ("facility_id" = current_facility_id());

ALTER TABLE "pharmacist_conversations" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pharmacist_conversations_facility_isolation" ON "pharmacist_conversations"
  USING ("facility_id" = current_facility_id())
  WITH CHECK ("facility_id" = current_facility_id());

ALTER TABLE "conversation_messages" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conversation_messages_facility_isolation" ON "conversation_messages"
  USING ("facility_id" = current_facility_id())
  WITH CHECK ("facility_id" = current_facility_id());

-- 3. Append-only enforcement on history and message tables
REVOKE UPDATE, DELETE ON "prescription_request_history" FROM app_user;
REVOKE UPDATE, DELETE ON "prescription_request_history" FROM app_super_admin;
REVOKE UPDATE, DELETE ON "compounding_request_history" FROM app_user;
REVOKE UPDATE, DELETE ON "compounding_request_history" FROM app_super_admin;
REVOKE UPDATE, DELETE ON "minor_ailment_request_history" FROM app_user;
REVOKE UPDATE, DELETE ON "minor_ailment_request_history" FROM app_super_admin;
REVOKE UPDATE, DELETE ON "conversation_messages" FROM app_user;
REVOKE UPDATE, DELETE ON "conversation_messages" FROM app_super_admin;
-- request/conversation tables: DELETE revoked (status history makes them effectively immutable records)
REVOKE DELETE ON "prescription_requests" FROM app_user;
REVOKE DELETE ON "prescription_requests" FROM app_super_admin;
REVOKE DELETE ON "compounding_requests" FROM app_user;
REVOKE DELETE ON "compounding_requests" FROM app_super_admin;
REVOKE DELETE ON "minor_ailment_requests" FROM app_user;
REVOKE DELETE ON "minor_ailment_requests" FROM app_super_admin;
REVOKE DELETE ON "pharmacist_conversations" FROM app_user;
REVOKE DELETE ON "pharmacist_conversations" FROM app_super_admin;

-- 4. Grants to app_user (RLS-enforced pool)
GRANT SELECT, INSERT, UPDATE ON "prescription_requests" TO app_user;
GRANT SELECT, INSERT ON "prescription_request_history" TO app_user;
GRANT SELECT, INSERT, UPDATE ON "compounding_requests" TO app_user;
GRANT SELECT, INSERT ON "compounding_request_history" TO app_user;
GRANT SELECT, INSERT, UPDATE ON "minor_ailment_catalog" TO app_user;
GRANT SELECT, INSERT, UPDATE ON "minor_ailment_requests" TO app_user;
GRANT SELECT, INSERT ON "minor_ailment_request_history" TO app_user;
GRANT SELECT, INSERT, UPDATE ON "pharmacist_conversations" TO app_user;
GRANT SELECT, INSERT ON "conversation_messages" TO app_user;

-- 5. Grants to app_super_admin (BYPASSRLS pool)
GRANT SELECT, INSERT, UPDATE ON "prescription_requests" TO app_super_admin;
GRANT SELECT, INSERT ON "prescription_request_history" TO app_super_admin;
GRANT SELECT, INSERT, UPDATE ON "compounding_requests" TO app_super_admin;
GRANT SELECT, INSERT ON "compounding_request_history" TO app_super_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON "minor_ailment_catalog" TO app_super_admin;
GRANT SELECT, INSERT, UPDATE ON "minor_ailment_requests" TO app_super_admin;
GRANT SELECT, INSERT ON "minor_ailment_request_history" TO app_super_admin;
GRANT SELECT, INSERT, UPDATE ON "pharmacist_conversations" TO app_super_admin;
GRANT SELECT, INSERT ON "conversation_messages" TO app_super_admin;
