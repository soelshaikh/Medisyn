CREATE TABLE IF NOT EXISTS "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_id" uuid NOT NULL,
	"parent_id" uuid,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"image_url" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_facility_slug_unique" UNIQUE("facility_id","slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "coupons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_id" uuid NOT NULL,
	"code" text NOT NULL,
	"type" text NOT NULL,
	"discount_value" numeric(10, 2) NOT NULL,
	"max_discount_amount" numeric(10, 2),
	"min_order_total" numeric(10, 2),
	"total_usage_limit" integer,
	"per_customer_usage_limit" integer,
	"total_redemption_count" integer DEFAULT 0 NOT NULL,
	"applicable_product_ids" uuid[],
	"applicable_category_ids" uuid[],
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"internal_notes" text,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coupons_facility_code_unique" UNIQUE("facility_id","code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"quantity" integer DEFAULT 0 NOT NULL,
	"allow_negative" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_id" uuid NOT NULL,
	"inventory_record_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"quantity_delta" integer NOT NULL,
	"resulting_balance" integer NOT NULL,
	"reason" text NOT NULL,
	"note" text,
	"actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"sku" text NOT NULL,
	"dimension_value" text NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"compare_at_price" numeric(10, 2),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_variants_facility_sku_unique" UNIQUE("facility_id","sku")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_id" uuid NOT NULL,
	"category_id" uuid,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"short_description" text,
	"brand" text,
	"images" text[] DEFAULT '{}' NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"compare_at_price" numeric(10, 2),
	"variant_dimension_label" text,
	"low_stock_threshold" integer DEFAULT 0 NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_facility_sku_unique" UNIQUE("facility_id","sku"),
	CONSTRAINT "products_facility_slug_unique" UNIQUE("facility_id","slug")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "categories" ADD CONSTRAINT "categories_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "categories" ADD CONSTRAINT "categories_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "categories" ADD CONSTRAINT "categories_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "coupons" ADD CONSTRAINT "coupons_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "coupons" ADD CONSTRAINT "coupons_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "coupons" ADD CONSTRAINT "coupons_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_records" ADD CONSTRAINT "inventory_records_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_records" ADD CONSTRAINT "inventory_records_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_records" ADD CONSTRAINT "inventory_records_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_inventory_record_id_inventory_records_id_fk" FOREIGN KEY ("inventory_record_id") REFERENCES "public"."inventory_records"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "products" ADD CONSTRAINT "products_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "products" ADD CONSTRAINT "products_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "products" ADD CONSTRAINT "products_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "categories_facility_active_idx" ON "categories" USING btree ("facility_id","is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "categories_parent_idx" ON "categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coupons_facility_active_idx" ON "coupons" USING btree ("facility_id","is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_records_product_idx" ON "inventory_records" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_records_variant_idx" ON "inventory_records" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_tx_record_created_idx" ON "inventory_transactions" USING btree ("inventory_record_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_tx_facility_created_idx" ON "inventory_transactions" USING btree ("facility_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_variants_product_idx" ON "product_variants" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_facility_active_idx" ON "products" USING btree ("facility_id","is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_facility_category_idx" ON "products" USING btree ("facility_id","category_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_facility_brand_idx" ON "products" USING btree ("facility_id","brand");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_facility_featured_idx" ON "products" USING btree ("facility_id","is_featured");
-- ─────────────────────────────────────────────────────────────────────────────
-- Manual additions (not generated by Drizzle)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Self-referential FK: categories.parent_id → categories.id
DO $$ BEGIN
  ALTER TABLE "categories"
    ADD CONSTRAINT "categories_parent_id_fk"
    FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 2. UNIQUE NULLS NOT DISTINCT: one inventory record per (product, variant)
--    NULL variant_id treated as a single unique value (one record per product when no variants).
--    Requires PostgreSQL 15+. This project uses PostgreSQL 16 (docker-compose.yml).
ALTER TABLE "inventory_records"
  ADD CONSTRAINT "inventory_records_product_variant_unique"
  UNIQUE NULLS NOT DISTINCT ("product_id", "variant_id");

-- 3. Trigram extension + GIN indexes for fast keyword search on products
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS "products_name_trgm_idx"
  ON "products" USING GIN ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "products_description_trgm_idx"
  ON "products" USING GIN ("description" gin_trgm_ops);

-- 4. Check constraints
ALTER TABLE "products"
  ADD CONSTRAINT "products_price_positive"
  CHECK ("price" >= 0);
ALTER TABLE "coupons"
  ADD CONSTRAINT "coupons_discount_value_positive"
  CHECK ("discount_value" > 0);
ALTER TABLE "coupons"
  ADD CONSTRAINT "coupons_percentage_range"
  CHECK ("type" != 'PERCENTAGE' OR ("discount_value" > 0 AND "discount_value" <= 100));
ALTER TABLE "inventory_records"
  ADD CONSTRAINT "inventory_records_quantity_floor"
  CHECK ("allow_negative" = true OR "quantity" >= 0);

-- 5. Row-Level Security — all 6 catalogue tables
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories_facility_isolation" ON "categories"
  USING ("facility_id" = current_facility_id())
  WITH CHECK ("facility_id" = current_facility_id());

ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products_facility_isolation" ON "products"
  USING ("facility_id" = current_facility_id())
  WITH CHECK ("facility_id" = current_facility_id());

ALTER TABLE "product_variants" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_variants_facility_isolation" ON "product_variants"
  USING ("facility_id" = current_facility_id())
  WITH CHECK ("facility_id" = current_facility_id());

ALTER TABLE "inventory_records" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inventory_records_facility_isolation" ON "inventory_records"
  USING ("facility_id" = current_facility_id())
  WITH CHECK ("facility_id" = current_facility_id());

ALTER TABLE "inventory_transactions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inventory_transactions_facility_isolation" ON "inventory_transactions"
  USING ("facility_id" = current_facility_id())
  WITH CHECK ("facility_id" = current_facility_id());

ALTER TABLE "coupons" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coupons_facility_isolation" ON "coupons"
  USING ("facility_id" = current_facility_id())
  WITH CHECK ("facility_id" = current_facility_id());

-- 6. Append-only enforcement for inventory_transactions (mirrors audit_log pattern)
REVOKE UPDATE, DELETE ON "inventory_transactions" FROM app_user;
REVOKE UPDATE, DELETE ON "inventory_transactions" FROM app_super_admin;

-- 7. Grants to app_user (RLS-enforced pool)
GRANT SELECT, INSERT, UPDATE, DELETE
  ON "categories", "products", "product_variants", "inventory_records", "coupons"
  TO app_user;
GRANT SELECT, INSERT ON "inventory_transactions" TO app_user;

-- 8. Grants to app_super_admin (BYPASSRLS pool)
GRANT SELECT, INSERT, UPDATE, DELETE
  ON "categories", "products", "product_variants", "inventory_records", "coupons"
  TO app_super_admin;
GRANT SELECT, INSERT ON "inventory_transactions" TO app_super_admin;
