import { v4 as uuidv4 } from 'uuid';
import { eq } from 'drizzle-orm';
import { getSuperAdminTestDb } from './db';
import * as commerceSchema from '@/db/schema/commerce';

// ── Shipping method fixture ────────────────────────────────────────────────

export async function createTestShippingMethod(
  facilityId: string,
  overrides: Partial<typeof commerceSchema.shippingMethods.$inferInsert> = {},
): Promise<typeof commerceSchema.shippingMethods.$inferSelect> {
  const sa = getSuperAdminTestDb();
  const [row] = await sa
    .insert(commerceSchema.shippingMethods)
    .values({
      facilityId,
      name: overrides.name ?? `Shipping-${uuidv4().slice(0, 8)}`,
      flatRate: overrides.flatRate ?? '9.99',
      estimatedDaysMin: overrides.estimatedDaysMin ?? 3,
      estimatedDaysMax: overrides.estimatedDaysMax ?? 7,
      isActive: overrides.isActive ?? true,
      displayOrder: overrides.displayOrder ?? 0,
      description: overrides.description,
    })
    .returning();
  return row;
}

// ── Cart fixture ──────────────────────────────────────────────────────────

export async function createTestGuestCart(
  facilityId: string,
): Promise<{ id: string; cartToken: string }> {
  const sa = getSuperAdminTestDb();
  const cartToken = uuidv4();
  const [row] = await sa
    .insert(commerceSchema.carts)
    .values({
      facilityId,
      cartToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    })
    .returning({ id: commerceSchema.carts.id, cartToken: commerceSchema.carts.cartToken });
  return { id: row.id, cartToken: row.cartToken! };
}

export async function createTestAuthCart(
  facilityId: string,
  userId: string,
): Promise<{ id: string }> {
  const sa = getSuperAdminTestDb();
  const [row] = await sa
    .insert(commerceSchema.carts)
    .values({ facilityId, userId })
    .returning({ id: commerceSchema.carts.id });
  return row;
}

// ── Order fixture ─────────────────────────────────────────────────────────

export async function createTestOrder(
  facilityId: string,
  patientId: string,
  shippingMethodId: string,
  overrides: Partial<typeof commerceSchema.orders.$inferInsert> = {},
): Promise<typeof commerceSchema.orders.$inferSelect> {
  const sa = getSuperAdminTestDb();

  const orderNumber = overrides.orderNumber ?? `ORD-${String(Date.now()).slice(-5)}`;

  const [order] = await sa
    .insert(commerceSchema.orders)
    .values({
      facilityId,
      patientId,
      orderNumber,
      status: overrides.status ?? 'pending',
      shippingAddress: overrides.shippingAddress ?? {
        street: '123 Test St',
        city: 'Toronto',
        province: 'ON',
        postalCode: 'M5H 2N2',
        country: 'CA',
      },
      shippingMethodId,
      shippingMethodSnapshot: overrides.shippingMethodSnapshot ?? {
        id: shippingMethodId,
        name: 'Standard Shipping',
        flatRate: '9.99',
      },
      subtotal: overrides.subtotal ?? '50.00',
      taxBreakdown: overrides.taxBreakdown ?? [{ type: 'HST', rate: '0.13', amount: '6.50' }],
      taxTotal: overrides.taxTotal ?? '6.50',
      shippingCost: overrides.shippingCost ?? '9.99',
      total: overrides.total ?? '66.49',
      notes: overrides.notes,
    })
    .returning();

  // Insert initial status history entry
  await sa.insert(commerceSchema.orderStatusHistory).values({
    orderId: order.id,
    facilityId,
    previousStatus: null,
    newStatus: 'pending',
    changedById: null,
    note: null,
  });

  return order;
}

// ── Cleanup helpers ───────────────────────────────────────────────────────

export async function deleteTestOrdersByFacility(facilityId: string): Promise<void> {
  const sa = getSuperAdminTestDb();
  await sa
    .delete(commerceSchema.orders)
    .where(eq(commerceSchema.orders.facilityId, facilityId));
}

export async function deleteTestCartsByFacility(facilityId: string): Promise<void> {
  const sa = getSuperAdminTestDb();
  await sa.delete(commerceSchema.carts).where(eq(commerceSchema.carts.facilityId, facilityId));
}

export async function deleteTestShippingMethodsByFacility(facilityId: string): Promise<void> {
  const sa = getSuperAdminTestDb();
  await sa
    .delete(commerceSchema.shippingMethods)
    .where(eq(commerceSchema.shippingMethods.facilityId, facilityId));
}
