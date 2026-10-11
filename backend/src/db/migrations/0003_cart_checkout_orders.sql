CREATE TABLE IF NOT EXISTS "facility_sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_id" uuid NOT NULL,
	"resource_type" text NOT NULL,
	"next_val" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "facility_sequences_facility_resource_unique" UNIQUE("facility_id","resource_type")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shipping_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"flat_rate" numeric(10, 2) NOT NULL,
	"estimated_days_min" integer DEFAULT 0 NOT NULL,
	"estimated_days_max" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shipping_methods_facility_name_unique" UNIQUE("facility_id","name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "carts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_id" uuid NOT NULL,
	"user_id" uuid,
	"cart_token" uuid,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cart_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cart_id" uuid NOT NULL,
	"facility_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"quantity" integer NOT NULL,
	"price_snapshot" numeric(10, 2) NOT NULL,
	"product_name_snapshot" text NOT NULL,
	"variant_label_snapshot" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"order_number" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"shipping_address" jsonb NOT NULL,
	"shipping_method_id" uuid,
	"shipping_method_snapshot" jsonb NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL,
	"tax_breakdown" jsonb NOT NULL,
	"tax_total" numeric(10, 2) NOT NULL,
	"shipping_cost" numeric(10, 2) NOT NULL,
	"total" numeric(10, 2) NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_facility_number_unique" UNIQUE("facility_id","order_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"facility_id" uuid NOT NULL,
	"product_id" uuid,
	"variant_id" uuid,
	"product_name" text NOT NULL,
	"variant_label" text,
	"sku" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"line_total" numeric(10, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"facility_id" uuid NOT NULL,
	"previous_status" text,
	"new_status" text NOT NULL,
	"changed_by_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "facility_sequences" ADD CONSTRAINT "facility_sequences_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shipping_methods" ADD CONSTRAINT "shipping_methods_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "carts" ADD CONSTRAINT "carts_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "carts" ADD CONSTRAINT "carts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "orders" ADD CONSTRAINT "orders_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "orders" ADD CONSTRAINT "orders_patient_id_users_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "orders" ADD CONSTRAINT "orders_shipping_method_id_shipping_methods_id_fk" FOREIGN KEY ("shipping_method_id") REFERENCES "public"."shipping_methods"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_items" ADD CONSTRAINT "order_items_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_changed_by_id_users_id_fk" FOREIGN KEY ("changed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shipping_methods_facility_active_idx" ON "shipping_methods" USING btree ("facility_id","is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "carts_user_idx" ON "carts" USING btree ("facility_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "carts_token_idx" ON "carts" USING btree ("facility_id","cart_token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cart_items_cart_idx" ON "cart_items" USING btree ("cart_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cart_items_product_idx" ON "cart_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_facility_patient_idx" ON "orders" USING btree ("facility_id","patient_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_facility_status_idx" ON "orders" USING btree ("facility_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_created_at_idx" ON "orders" USING btree ("facility_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_status_history_order_idx" ON "order_status_history" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_status_history_facility_idx" ON "order_status_history" USING btree ("facility_id","created_at");
-- ─────────────────────────────────────────────────────────────────────────────
-- Manual additions (not generated by Drizzle)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. UNIQUE NULLS NOT DISTINCT: one cart per authenticated user per facility
ALTER TABLE "carts"
  ADD CONSTRAINT "carts_facility_user_unique"
  UNIQUE NULLS NOT DISTINCT ("facility_id", "user_id");

-- 2. UNIQUE NULLS NOT DISTINCT: one cart per token per facility
ALTER TABLE "carts"
  ADD CONSTRAINT "carts_facility_token_unique"
  UNIQUE NULLS NOT DISTINCT ("facility_id", "cart_token");

-- 3. UNIQUE NULLS NOT DISTINCT: one line item per (cart, product, variant)
--    NULL variant_id treated as a unique value (products without variants).
--    Requires PostgreSQL 15+.
ALTER TABLE "cart_items"
  ADD CONSTRAINT "cart_items_cart_product_variant_unique"
  UNIQUE NULLS NOT DISTINCT ("cart_id", "product_id", "variant_id");

-- 4. Check constraints
ALTER TABLE "shipping_methods"
  ADD CONSTRAINT "shipping_methods_flat_rate_non_negative"
  CHECK ("flat_rate" >= 0);

ALTER TABLE "shipping_methods"
  ADD CONSTRAINT "shipping_methods_days_range_valid"
  CHECK ("estimated_days_max" >= "estimated_days_min");

ALTER TABLE "cart_items"
  ADD CONSTRAINT "cart_items_quantity_positive"
  CHECK ("quantity" > 0);

ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_quantity_positive"
  CHECK ("quantity" > 0);

-- 5. Row-Level Security — all 7 commerce tables
ALTER TABLE "facility_sequences" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "facility_sequences_facility_isolation" ON "facility_sequences"
  USING ("facility_id" = current_facility_id())
  WITH CHECK ("facility_id" = current_facility_id());

ALTER TABLE "shipping_methods" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shipping_methods_facility_isolation" ON "shipping_methods"
  USING ("facility_id" = current_facility_id())
  WITH CHECK ("facility_id" = current_facility_id());

ALTER TABLE "carts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "carts_facility_isolation" ON "carts"
  USING ("facility_id" = current_facility_id())
  WITH CHECK ("facility_id" = current_facility_id());

ALTER TABLE "cart_items" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cart_items_facility_isolation" ON "cart_items"
  USING ("facility_id" = current_facility_id())
  WITH CHECK ("facility_id" = current_facility_id());

ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders_facility_isolation" ON "orders"
  USING ("facility_id" = current_facility_id())
  WITH CHECK ("facility_id" = current_facility_id());

ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_items_facility_isolation" ON "order_items"
  USING ("facility_id" = current_facility_id())
  WITH CHECK ("facility_id" = current_facility_id());

ALTER TABLE "order_status_history" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_status_history_facility_isolation" ON "order_status_history"
  USING ("facility_id" = current_facility_id())
  WITH CHECK ("facility_id" = current_facility_id());

-- 6. Append-only enforcement: orders cannot be deleted; order_items and
--    order_status_history cannot be updated or deleted
REVOKE DELETE ON "orders" FROM app_user;
REVOKE DELETE ON "orders" FROM app_super_admin;
REVOKE UPDATE, DELETE ON "order_items" FROM app_user;
REVOKE UPDATE, DELETE ON "order_items" FROM app_super_admin;
REVOKE UPDATE, DELETE ON "order_status_history" FROM app_user;
REVOKE UPDATE, DELETE ON "order_status_history" FROM app_super_admin;

-- 7. Grants to app_user (RLS-enforced pool)
GRANT SELECT, INSERT, UPDATE, DELETE ON "facility_sequences" TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON "shipping_methods" TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON "carts" TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON "cart_items" TO app_user;
GRANT SELECT, INSERT, UPDATE ON "orders" TO app_user;
GRANT SELECT, INSERT ON "order_items" TO app_user;
GRANT SELECT, INSERT ON "order_status_history" TO app_user;

-- 8. Grants to app_super_admin (BYPASSRLS pool)
GRANT SELECT, INSERT, UPDATE, DELETE ON "facility_sequences" TO app_super_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON "shipping_methods" TO app_super_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON "carts" TO app_super_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON "cart_items" TO app_super_admin;
GRANT SELECT, INSERT, UPDATE ON "orders" TO app_super_admin;
GRANT SELECT, INSERT ON "order_items" TO app_super_admin;
GRANT SELECT, INSERT ON "order_status_history" TO app_super_admin;
