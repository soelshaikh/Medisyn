-- Migration: change audit FK columns on catalogue tables from NO ACTION to SET NULL
-- Rationale: created_by_id / updated_by_id / actor_id are soft audit references.
-- Deleting a user (e.g. in tests or admin deactivation) must not be blocked by these.

--> statement-breakpoint
ALTER TABLE "categories"
  DROP CONSTRAINT IF EXISTS "categories_created_by_id_users_id_fk",
  ADD CONSTRAINT "categories_created_by_id_users_id_fk"
    FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE "categories"
  DROP CONSTRAINT IF EXISTS "categories_updated_by_id_users_id_fk",
  ADD CONSTRAINT "categories_updated_by_id_users_id_fk"
    FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE "coupons"
  DROP CONSTRAINT IF EXISTS "coupons_created_by_id_users_id_fk",
  ADD CONSTRAINT "coupons_created_by_id_users_id_fk"
    FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE "coupons"
  DROP CONSTRAINT IF EXISTS "coupons_updated_by_id_users_id_fk",
  ADD CONSTRAINT "coupons_updated_by_id_users_id_fk"
    FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE "inventory_transactions"
  DROP CONSTRAINT IF EXISTS "inventory_transactions_actor_id_users_id_fk",
  ADD CONSTRAINT "inventory_transactions_actor_id_users_id_fk"
    FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE "products"
  DROP CONSTRAINT IF EXISTS "products_created_by_id_users_id_fk",
  ADD CONSTRAINT "products_created_by_id_users_id_fk"
    FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE "products"
  DROP CONSTRAINT IF EXISTS "products_updated_by_id_users_id_fk",
  ADD CONSTRAINT "products_updated_by_id_users_id_fk"
    FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE no action;
