CREATE TABLE IF NOT EXISTS "vaccine_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"duration_minutes" integer NOT NULL,
	"eligibility_notes" text,
	"dose_number" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "availability_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"slot_date" text NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"capacity" integer NOT NULL,
	"booking_type" text NOT NULL,
	"open_capacity" integer,
	"booked_count" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"slot_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"reason" text,
	"internal_notes" text,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "appointment_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"appointment_id" uuid NOT NULL,
	"facility_id" uuid NOT NULL,
	"previous_status" text,
	"new_status" text NOT NULL,
	"changed_by_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vaccine_services" ADD CONSTRAINT "vaccine_services_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "availability_slots" ADD CONSTRAINT "availability_slots_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "availability_slots" ADD CONSTRAINT "availability_slots_service_id_vaccine_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."vaccine_services"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "appointments" ADD CONSTRAINT "appointments_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_users_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "appointments" ADD CONSTRAINT "appointments_slot_id_availability_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."availability_slots"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "appointments" ADD CONSTRAINT "appointments_service_id_vaccine_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."vaccine_services"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "appointment_status_history" ADD CONSTRAINT "appt_history_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "appointment_status_history" ADD CONSTRAINT "appt_history_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "appointment_status_history" ADD CONSTRAINT "appt_history_changed_by_id_users_id_fk" FOREIGN KEY ("changed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vaccine_services_facility_idx" ON "vaccine_services" USING btree ("facility_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "availability_slots_facility_service_date_idx" ON "availability_slots" USING btree ("facility_id","service_id","slot_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "availability_slots_facility_active_idx" ON "availability_slots" USING btree ("facility_id","is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "appointments_facility_patient_idx" ON "appointments" USING btree ("facility_id","patient_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "appointments_facility_slot_idx" ON "appointments" USING btree ("facility_id","slot_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "appointments_facility_status_idx" ON "appointments" USING btree ("facility_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "appt_history_appointment_idx" ON "appointment_status_history" USING btree ("appointment_id","created_at");
-- ─────────────────────────────────────────────────────────────────────────────
-- Manual additions (not generated by Drizzle)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Check constraints
ALTER TABLE "vaccine_services"
  ADD CONSTRAINT "vaccine_services_duration_check"
  CHECK ("duration_minutes" > 0);

ALTER TABLE "vaccine_services"
  ADD CONSTRAINT "vaccine_services_name_length_check"
  CHECK (char_length("name") <= 200);

ALTER TABLE "vaccine_services"
  ADD CONSTRAINT "vaccine_services_dose_number_length_check"
  CHECK ("dose_number" IS NULL OR char_length("dose_number") <= 50);

ALTER TABLE "availability_slots"
  ADD CONSTRAINT "availability_slots_booking_type_check"
  CHECK ("booking_type" IN ('STRICT', 'OPEN'));

ALTER TABLE "availability_slots"
  ADD CONSTRAINT "availability_slots_capacity_check"
  CHECK ("capacity" > 0);

ALTER TABLE "availability_slots"
  ADD CONSTRAINT "availability_slots_end_after_start_check"
  CHECK ("end_time" > "start_time");

ALTER TABLE "availability_slots"
  ADD CONSTRAINT "availability_slots_open_capacity_check"
  CHECK (
    "booking_type" = 'STRICT'
    OR ("open_capacity" IS NOT NULL AND "open_capacity" >= "capacity")
  );

ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_status_check"
  CHECK ("status" IN ('scheduled', 'completed', 'cancelled', 'no_show'));

-- 2. Partial unique index — prevents duplicate active bookings per patient+slot;
--    allows re-booking after cancellation.
CREATE UNIQUE INDEX "appointments_slot_patient_active_unique"
  ON "appointments" ("slot_id", "patient_id")
  WHERE "status" != 'cancelled';

-- 3. Case-insensitive unique name per facility for vaccine services
CREATE UNIQUE INDEX "vaccine_services_facility_name_lower_unique"
  ON "vaccine_services" ("facility_id", LOWER("name"));

-- 4. Row-Level Security — all 4 tables
ALTER TABLE "vaccine_services" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vaccine_services_facility_isolation" ON "vaccine_services"
  USING ("facility_id" = current_facility_id())
  WITH CHECK ("facility_id" = current_facility_id());

ALTER TABLE "availability_slots" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "availability_slots_facility_isolation" ON "availability_slots"
  USING ("facility_id" = current_facility_id())
  WITH CHECK ("facility_id" = current_facility_id());

ALTER TABLE "appointments" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "appointments_facility_isolation" ON "appointments"
  USING ("facility_id" = current_facility_id())
  WITH CHECK ("facility_id" = current_facility_id());

ALTER TABLE "appointment_status_history" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "appointment_status_history_facility_isolation" ON "appointment_status_history"
  USING ("facility_id" = current_facility_id())
  WITH CHECK ("facility_id" = current_facility_id());

-- 5. Append-only enforcement on appointment_status_history
REVOKE UPDATE, DELETE ON "appointment_status_history" FROM app_user;
REVOKE UPDATE, DELETE ON "appointment_status_history" FROM app_super_admin;

-- 6. DELETE revoked on appointments (soft-delete via status only)
REVOKE DELETE ON "appointments" FROM app_user;
REVOKE DELETE ON "appointments" FROM app_super_admin;

-- 7. Grants to app_user (RLS-enforced pool)
GRANT SELECT, INSERT, UPDATE ON "vaccine_services" TO app_user;
GRANT SELECT, INSERT, UPDATE ON "availability_slots" TO app_user;
GRANT SELECT, INSERT, UPDATE ON "appointments" TO app_user;
GRANT SELECT, INSERT ON "appointment_status_history" TO app_user;

-- 8. Grants to app_super_admin (BYPASSRLS pool)
GRANT SELECT, INSERT, UPDATE, DELETE ON "vaccine_services" TO app_super_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON "availability_slots" TO app_super_admin;
GRANT SELECT, INSERT, UPDATE ON "appointments" TO app_super_admin;
GRANT SELECT, INSERT ON "appointment_status_history" TO app_super_admin;
