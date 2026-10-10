import { eq, sql, desc, asc } from 'drizzle-orm';
import { TenantTransaction } from '@/db';
import { orders, orderItems, orderStatusHistory } from '@/db/schema/commerce';
import type {
  OrderStatus,
  OrderItem,
  OrderStatusHistoryEntry,
  OrderSummary,
  OrderDetail,
  AdminOrderDetail,
} from './order.types';

// ── Sequence helpers ──────────────────────────────────────────────────────

export async function ensureSequenceRow(
  facilityId: string,
  tx: TenantTransaction,
): Promise<void> {
  await tx.execute(sql`
    INSERT INTO facility_sequences (facility_id, resource_type, next_val)
    VALUES (${facilityId}, 'order', 1)
    ON CONFLICT DO NOTHING
  `);
}

export async function lockAndGetSequence(
  facilityId: string,
  tx: TenantTransaction,
): Promise<number> {
  const rows = await tx.execute(sql`
    SELECT next_val FROM facility_sequences
    WHERE facility_id = ${facilityId} AND resource_type = 'order'
    FOR UPDATE
  `);
  const row = (rows as Record<string, unknown>[])[0];
  return row.next_val as number;
}

export async function incrementSequence(
  facilityId: string,
  tx: TenantTransaction,
): Promise<void> {
  await tx.execute(sql`
    UPDATE facility_sequences
    SET next_val = next_val + 1, updated_at = now()
    WHERE facility_id = ${facilityId} AND resource_type = 'order'
  `);
}

export function formatOrderNumber(val: number): string {
  return `ORD-${String(val).padStart(5, '0')}`;
}

// ── insertOrder ───────────────────────────────────────────────────────────

export async function insertOrder(
  data: typeof orders.$inferInsert,
  tx: TenantTransaction,
): Promise<{ id: string }> {
  const [row] = await tx.insert(orders).values(data).returning({ id: orders.id });
  return row;
}

// ── insertOrderItem ───────────────────────────────────────────────────────

export async function insertOrderItem(
  data: typeof orderItems.$inferInsert,
  tx: TenantTransaction,
): Promise<void> {
  await tx.insert(orderItems).values(data);
}

// ── insertOrderStatusHistory ──────────────────────────────────────────────

export async function insertOrderStatusHistory(
  data: typeof orderStatusHistory.$inferInsert,
  tx: TenantTransaction,
): Promise<void> {
  await tx.insert(orderStatusHistory).values(data);
}

// ── findOrderById ─────────────────────────────────────────────────────────

export async function findOrderById(
  id: string,
  tx: TenantTransaction,
): Promise<typeof orders.$inferSelect | undefined> {
  const [row] = await tx.select().from(orders).where(eq(orders.id, id)).limit(1);
  return row;
}

// ── updateOrderStatus ─────────────────────────────────────────────────────

export async function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
  tx: TenantTransaction,
): Promise<void> {
  await tx
    .update(orders)
    .set({ status: newStatus, updatedAt: new Date() })
    .where(eq(orders.id, orderId));
}

// ── updateOrderNotes ──────────────────────────────────────────────────────

export async function updateOrderNotes(
  orderId: string,
  notes: string,
  tx: TenantTransaction,
): Promise<void> {
  await tx
    .update(orders)
    .set({ notes, updatedAt: new Date() })
    .where(eq(orders.id, orderId));
}

// ── Patient order queries ─────────────────────────────────────────────────

export async function listOrdersByPatient(
  facilityId: string,
  patientId: string,
  opts: { status?: OrderStatus; page: number; limit: number },
  tx: TenantTransaction,
): Promise<{ rows: OrderSummary[]; total: number }> {
  const offset = (opts.page - 1) * opts.limit;

  const baseCondition = opts.status
    ? sql`${orders.facilityId} = ${facilityId} AND ${orders.patientId} = ${patientId} AND ${orders.status} = ${opts.status}`
    : sql`${orders.facilityId} = ${facilityId} AND ${orders.patientId} = ${patientId}`;

  const [{ count }] = await tx
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(orders)
    .where(baseCondition);

  if (count === 0) return { rows: [], total: 0 };

  const rows = await tx
    .select({
      id: orders.id,
      facilityId: orders.facilityId,
      patientId: orders.patientId,
      orderNumber: orders.orderNumber,
      status: orders.status,
      subtotal: orders.subtotal,
      taxTotal: orders.taxTotal,
      shippingCost: orders.shippingCost,
      total: orders.total,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
    })
    .from(orders)
    .where(baseCondition)
    .orderBy(desc(orders.createdAt))
    .limit(opts.limit)
    .offset(offset);

  return { rows: rows as OrderSummary[], total: count };
}

export async function findOrderDetailForPatient(
  facilityId: string,
  orderId: string,
  patientId: string,
  tx: TenantTransaction,
): Promise<OrderDetail | null> {
  const [order] = await tx
    .select()
    .from(orders)
    .where(
      sql`${orders.id} = ${orderId} AND ${orders.facilityId} = ${facilityId} AND ${orders.patientId} = ${patientId}`,
    )
    .limit(1);

  if (!order) return null;

  const items = await tx
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId))
    .orderBy(asc(orderItems.createdAt));

  const history = await tx.execute(sql`
    SELECT
      osh.id, osh.order_id AS "orderId", osh.facility_id AS "facilityId",
      osh.previous_status AS "previousStatus", osh.new_status AS "newStatus",
      osh.changed_by_id AS "changedById", osh.note, osh.created_at AS "createdAt",
      CASE WHEN u.id IS NOT NULL THEN CONCAT(u.first_name, ' ', u.last_name) ELSE NULL END AS "changedByName"
    FROM order_status_history osh
    LEFT JOIN users u ON u.id = osh.changed_by_id
    WHERE osh.order_id = ${orderId}
    ORDER BY osh.created_at ASC
  `);

  return {
    id: order.id,
    facilityId: order.facilityId,
    patientId: order.patientId,
    orderNumber: order.orderNumber,
    status: order.status as OrderStatus,
    shippingAddress: order.shippingAddress as Record<string, unknown>,
    shippingMethodId: order.shippingMethodId,
    shippingMethodSnapshot: order.shippingMethodSnapshot as Record<string, unknown>,
    subtotal: order.subtotal,
    taxBreakdown: order.taxBreakdown as unknown[],
    taxTotal: order.taxTotal,
    shippingCost: order.shippingCost,
    total: order.total,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    items: items as unknown as OrderItem[],
    statusHistory: history as unknown as OrderStatusHistoryEntry[],
  };
}

// ── Admin order queries ───────────────────────────────────────────────────

export async function listOrdersForAdmin(
  facilityId: string,
  opts: {
    status?: OrderStatus;
    patientId?: string;
    orderNumber?: string;
    dateFrom?: string;
    dateTo?: string;
    page: number;
    limit: number;
    sort?: 'createdAt:asc' | 'createdAt:desc' | 'total:asc' | 'total:desc';
  },
  tx: TenantTransaction,
): Promise<{ rows: (OrderSummary & { patientName: string })[]; total: number }> {
  const offset = (opts.page - 1) * opts.limit;

  const conditions: string[] = [`o.facility_id = '${facilityId}'`];
  if (opts.status) conditions.push(`o.status = '${opts.status}'`);
  if (opts.patientId) conditions.push(`o.patient_id = '${opts.patientId}'`);
  if (opts.orderNumber) conditions.push(`o.order_number ILIKE '%${opts.orderNumber.replace(/'/g, "''")}%'`);
  if (opts.dateFrom) conditions.push(`o.created_at >= '${opts.dateFrom}'`);
  if (opts.dateTo) conditions.push(`o.created_at <= '${opts.dateTo}'`);
  const whereClause = conditions.join(' AND ');

  const sortMap: Record<string, string> = {
    'createdAt:asc': 'o.created_at ASC',
    'createdAt:desc': 'o.created_at DESC',
    'total:asc': 'o.total ASC',
    'total:desc': 'o.total DESC',
  };
  const orderBy = sortMap[opts.sort ?? 'createdAt:desc'] ?? 'o.created_at DESC';

  const countResult = await tx.execute(
    sql.raw(`SELECT COUNT(*)::int AS count FROM orders o WHERE ${whereClause}`),
  );
  const total = (countResult as unknown as { count: number }[])[0].count;
  if (total === 0) return { rows: [], total: 0 };

  const rows = await tx.execute(
    sql.raw(`
      SELECT o.id, o.facility_id AS "facilityId", o.patient_id AS "patientId",
             o.order_number AS "orderNumber", o.status, o.subtotal, o.tax_total AS "taxTotal",
             o.shipping_cost AS "shippingCost", o.total, o.created_at AS "createdAt",
             o.updated_at AS "updatedAt",
             CONCAT(u.first_name, ' ', u.last_name) AS "patientName"
      FROM orders o
      JOIN users u ON u.id = o.patient_id
      WHERE ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ${opts.limit} OFFSET ${offset}
    `),
  );

  return { rows: rows as unknown as (OrderSummary & { patientName: string })[], total };
}

export async function findOrderDetailForAdmin(
  facilityId: string,
  orderId: string,
  tx: TenantTransaction,
): Promise<AdminOrderDetail | null> {
  const rows = await tx.execute(sql`
    SELECT o.*, u.first_name AS "patientFirstName", u.last_name AS "patientLastName", u.email AS "patientEmail"
    FROM orders o
    JOIN users u ON u.id = o.patient_id
    WHERE o.id = ${orderId} AND o.facility_id = ${facilityId}
    LIMIT 1
  `);

  if ((rows as unknown[]).length === 0) return null;
  const raw = (rows as Record<string, unknown>[])[0];

  const items = await tx
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId))
    .orderBy(asc(orderItems.createdAt));

  const history = await tx.execute(sql`
    SELECT osh.id, osh.order_id AS "orderId", osh.facility_id AS "facilityId",
           osh.previous_status AS "previousStatus", osh.new_status AS "newStatus",
           osh.changed_by_id AS "changedById", osh.note, osh.created_at AS "createdAt",
           CASE WHEN u.id IS NOT NULL THEN CONCAT(u.first_name, ' ', u.last_name) ELSE NULL END AS "changedByName"
    FROM order_status_history osh
    LEFT JOIN users u ON u.id = osh.changed_by_id
    WHERE osh.order_id = ${orderId}
    ORDER BY osh.created_at ASC
  `);

  return {
    id: raw.id as string,
    facilityId: raw.facility_id as string,
    patientId: raw.patient_id as string,
    orderNumber: raw.order_number as string,
    status: raw.status as OrderStatus,
    shippingAddress: raw.shipping_address as Record<string, unknown>,
    shippingMethodId: raw.shipping_method_id as string | null,
    shippingMethodSnapshot: raw.shipping_method_snapshot as Record<string, unknown>,
    subtotal: raw.subtotal as string,
    taxBreakdown: raw.tax_breakdown as unknown[],
    taxTotal: raw.tax_total as string,
    shippingCost: raw.shipping_cost as string,
    total: raw.total as string,
    notes: raw.notes as string | null,
    createdAt: raw.created_at as Date,
    updatedAt: raw.updated_at as Date,
    patientName: `${raw.patientFirstName as string} ${raw.patientLastName as string}`,
    patientEmail: raw.patientEmail as string,
    items: items as unknown as OrderItem[],
    statusHistory: history as unknown as OrderStatusHistoryEntry[],
  };
}
