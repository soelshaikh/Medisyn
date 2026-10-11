import { sql } from 'drizzle-orm';
import { withTenantContext } from '@/lib/tenant-context';
import { superAdminDb } from '@/db';
import type { AuthContext } from '@/core/auth/middleware/parse-jwt';
import type { ReportQuery } from './reports.validator';
import type {
  SalesReportResult,
  OrderReportResult,
  PatientReportResult,
  DashboardResult,
  TrendBucket,
  TopProduct,
  TopPatient,
} from './reports.types';


// ── Helpers ───────────────────────────────────────────────────────────────

const PERIOD_MAP = { daily: 'day', weekly: 'week', monthly: 'month' } as const;

const REVENUE_STATUSES = ['shipped', 'delivered'] as const;

function toDateRange(from: string, to: string): { fromDate: Date; toExclusive: Date } {
  const fromDate = new Date(from + 'T00:00:00Z');
  const toDay = new Date(to + 'T00:00:00Z');
  const toExclusive = new Date(toDay.getTime() + 86_400_000);
  return { fromDate, toExclusive };
}

function bucketStart(date: Date, period: 'daily' | 'weekly' | 'monthly'): Date {
  if (period === 'monthly') {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  }
  if (period === 'weekly') {
    const day = date.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day; // back to Monday
    const d = new Date(date);
    d.setUTCDate(d.getUTCDate() + diff);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function generateBuckets(from: string, to: string, period: 'daily' | 'weekly' | 'monthly'): string[] {
  const end = new Date(to + 'T00:00:00Z');
  const result: string[] = [];
  let cur = bucketStart(new Date(from + 'T00:00:00Z'), period);

  while (cur <= end) {
    result.push(cur.toISOString().split('T')[0]!);
    const next = new Date(cur);
    if (period === 'daily') next.setUTCDate(next.getUTCDate() + 1);
    else if (period === 'weekly') next.setUTCDate(next.getUTCDate() + 7);
    else next.setUTCMonth(next.getUTCMonth() + 1);
    cur = next;
  }
  return result;
}

function bucketKey(v: unknown): string {
  if (v instanceof Date) return v.toISOString().split('T')[0]!;
  if (typeof v === 'string') return v.split('T')[0]!;
  return String(v);
}

function addDecimals(a: string, b: string): string {
  const result = (parseFloat(a) + parseFloat(b)).toFixed(2);
  return result;
}

// ── getSalesReport ────────────────────────────────────────────────────────

export async function getSalesReport(
  auth: AuthContext,
  input: ReportQuery,
): Promise<SalesReportResult> {
  const facilityId = auth.facilityId!;
  const { fromDate, toExclusive } = toDateRange(input.from, input.to);
  const periodUnit = PERIOD_MAP[input.period];

  return withTenantContext(facilityId, async (tx) => {
    // Revenue trend
    const trendRows = await tx.execute<{
      bucket: Date;
      revenue: string;
      order_count: number;
    }>(sql`
      SELECT
        date_trunc(${sql.raw(`'${periodUnit}'`)}, o.created_at) AS bucket,
        COALESCE(SUM(o.total), 0)::text                         AS revenue,
        COUNT(o.id)::int                                        AS order_count
      FROM orders o
      WHERE o.created_at >= ${fromDate}
        AND o.created_at < ${toExclusive}
        AND o.status IN ('shipped', 'delivered')
      GROUP BY bucket
      ORDER BY bucket
    `);

    const trendMap = new Map<string, { revenue: string; orderCount: number }>();
    for (const row of trendRows) {
      trendMap.set(bucketKey(row.bucket), {
        revenue: row.revenue,
        orderCount: row.order_count,
      });
    }

    const allBuckets = generateBuckets(input.from, input.to, input.period);
    const trend: TrendBucket[] = allBuckets.map((b) => ({
      bucket: b,
      revenue: trendMap.get(b)?.revenue ?? '0.00',
      orderCount: trendMap.get(b)?.orderCount ?? 0,
    }));

    const totalRevenue = trend.reduce((sum, b) => addDecimals(sum, b.revenue ?? '0'), '0.00');
    const totalOrderCount = trend.reduce((sum, b) => sum + (b.orderCount ?? 0), 0);
    const averageOrderValue =
      totalOrderCount > 0
        ? (parseFloat(totalRevenue) / totalOrderCount).toFixed(2)
        : '0.00';

    // Top products
    const productRows = await tx.execute<{
      product_id: string | null;
      product_name: string;
      total_revenue: string;
      units_sold: number;
      order_count: number;
    }>(sql`
      SELECT
        oi.product_id,
        oi.product_name,
        SUM(oi.line_total)::text                AS total_revenue,
        SUM(oi.quantity)::int                   AS units_sold,
        COUNT(DISTINCT oi.order_id)::int        AS order_count
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.created_at >= ${fromDate}
        AND o.created_at < ${toExclusive}
        AND o.status IN ('shipped', 'delivered')
      GROUP BY oi.product_id, oi.product_name
      ORDER BY SUM(oi.line_total) DESC
      LIMIT ${input.limit}
    `);

    const topProducts: TopProduct[] = Array.from(productRows).map((r) => ({
      productId: r.product_id,
      productName: r.product_name,
      totalRevenue: r.total_revenue,
      unitsSold: r.units_sold,
      orderCount: r.order_count,
    }));

    return {
      period: input.period,
      from: input.from,
      to: input.to,
      summary: {
        totalRevenue,
        orderCount: totalOrderCount,
        averageOrderValue,
        revenueStatuses: [...REVENUE_STATUSES],
      },
      trend,
      topProducts,
    };
  });
}

// ── getDashboard ──────────────────────────────────────────────────────────

function buildDashboardResult(
  patientTotal: number,
  patientNewToday: number,
  orderStatuses: Array<{ status: string; cnt: number }>,
  orderToday: number,
  productActive: number,
  productLowStock: number,
  revenueTotalCAD: string,
  dailyOrders: Array<{ date: unknown; cnt: number; revenue: string }>,
  midnightUtc: Date,
  pendingCompounding: number,
  openAskPharmacist: number,
  pendingAppointments: number,
  activePrescriptions: number,
): DashboardResult {
  const byStatus = orderStatuses.map((r) => ({ status: r.status, count: r.cnt }));
  const orderTotal = byStatus.reduce((s, r) => s + r.count, 0);
  const orderPending = byStatus.find((r) => r.status === 'pending')?.count ?? 0;

  const totalCents = Math.round(parseFloat(revenueTotalCAD || '0') * 100);

  // Fill 7-day chart (oldest first, newest = today)
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    days.push(new Date(midnightUtc.getTime() - i * 86_400_000).toISOString().split('T')[0]!);
  }
  const dailyMap = new Map(
    dailyOrders.map((r) => [bucketKey(r.date), { count: r.cnt, revenue: parseFloat(r.revenue || '0') }]),
  );
  const dailyChart = days.map((d) => ({
    date:    d,
    count:   dailyMap.get(d)?.count   ?? 0,
    revenue: dailyMap.get(d)?.revenue ?? 0,
  }));

  return {
    users:     { total: patientTotal, newToday: patientNewToday },
    approvals: { pendingClinics: 0, pendingPartners: 0 },
    orders:    { total: orderTotal, today: orderToday, pending: orderPending, byStatus },
    products:  { active: productActive, lowStock: productLowStock },
    revenue:   { totalCents, totalCAD: Number(revenueTotalCAD || 0).toFixed(2) },
    charts:    { dailyOrders: dailyChart },
    healthcare: { pendingCompounding, openAskPharmacist, pendingAppointments, activePrescriptions },
  };
}

export async function getDashboard(auth: AuthContext): Promise<DashboardResult> {
  const now = new Date();
  const midnightUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const sevenDaysAgo = new Date(midnightUtc.getTime() - 6 * 86_400_000);
  // postgres-js requires strings for timestamp params, not Date objects
  const midnightIso   = midnightUtc.toISOString();
  const sevenDaysIso  = sevenDaysAgo.toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const runQueries = async (db: any) => {
    const [
      patientRows,
      patientTodayRows,
      orderStatusRows,
      orderTodayRows,
      productActiveRows,
      productLowStockRows,
      revenueRows,
      dailyOrderRows,
      compoundingRows,
      convRows,
      appointmentRows,
      prescRows,
    ] = await Promise.all([
      db.execute(sql`
        SELECT COUNT(*)::int AS cnt
        FROM users u
        JOIN facility_users fu ON fu.user_id = u.id
        JOIN facility_roles  fr ON fr.id     = fu.role_id
        WHERE fr.name = 'patient'
      `),
      db.execute(sql`
        SELECT COUNT(*)::int AS cnt
        FROM users u
        JOIN facility_users fu ON fu.user_id = u.id
        JOIN facility_roles  fr ON fr.id     = fu.role_id
        WHERE fr.name = 'patient'
          AND u.created_at >= ${midnightIso}
      `),
      db.execute(sql`
        SELECT status, COUNT(*)::int AS cnt
        FROM orders
        GROUP BY status
      `),
      db.execute(sql`
        SELECT COUNT(*)::int AS cnt
        FROM orders
        WHERE created_at >= ${midnightIso}
      `),
      db.execute(sql`
        SELECT COUNT(*)::int AS cnt
        FROM products
        WHERE is_active = true
      `),
      db.execute(sql`
        SELECT COUNT(DISTINCT ir.product_id)::int AS cnt
        FROM inventory_records ir
        JOIN products p ON p.id = ir.product_id
        WHERE ir.quantity      <= p.low_stock_threshold
          AND p.low_stock_threshold > 0
          AND p.is_active = true
      `),
      db.execute(sql`
        SELECT COALESCE(SUM(total), 0)::text AS total_cad
        FROM orders
        WHERE status IN ('shipped', 'delivered')
      `),
      db.execute(sql`
        SELECT
          (created_at AT TIME ZONE 'UTC')::date AS date,
          COUNT(*)::int                          AS cnt,
          COALESCE(SUM(total), 0)::text          AS revenue
        FROM orders
        WHERE created_at >= ${sevenDaysIso}
        GROUP BY (created_at AT TIME ZONE 'UTC')::date
        ORDER BY date
      `),
      db.execute(sql`
        SELECT COUNT(*)::int AS cnt
        FROM compounding_requests
        WHERE status IN ('submitted', 'reviewing')
      `),
      db.execute(sql`
        SELECT COUNT(*)::int AS cnt
        FROM pharmacist_conversations
        WHERE status = 'open'
      `),
      db.execute(sql`
        SELECT COUNT(*)::int AS cnt
        FROM appointments
        WHERE status = 'scheduled'
      `),
      db.execute(sql`
        SELECT COUNT(*)::int AS cnt
        FROM prescription_requests
        WHERE status IN ('submitted', 'under_review')
      `),
    ]);

    type CntRow    = { cnt: number };
    type RevRow    = { total_cad: string };
    type StatusRow = { status: string; cnt: number };
    type DayRow    = { date: unknown; cnt: number; revenue: string };

    return buildDashboardResult(
      (Array.from(patientRows)      as CntRow[])[0]?.cnt       ?? 0,
      (Array.from(patientTodayRows) as CntRow[])[0]?.cnt       ?? 0,
      Array.from(orderStatusRows)   as StatusRow[],
      (Array.from(orderTodayRows)   as CntRow[])[0]?.cnt       ?? 0,
      (Array.from(productActiveRows)   as CntRow[])[0]?.cnt    ?? 0,
      (Array.from(productLowStockRows) as CntRow[])[0]?.cnt    ?? 0,
      (Array.from(revenueRows)      as RevRow[])[0]?.total_cad ?? '0.00',
      Array.from(dailyOrderRows)    as DayRow[],
      midnightUtc,
      (Array.from(compoundingRows)  as CntRow[])[0]?.cnt       ?? 0,
      (Array.from(convRows)         as CntRow[])[0]?.cnt       ?? 0,
      (Array.from(appointmentRows)  as CntRow[])[0]?.cnt       ?? 0,
      (Array.from(prescRows)        as CntRow[])[0]?.cnt       ?? 0,
    );
  };

  // Super admin without facilityId → platform-wide via BYPASSRLS pool
  if (auth.isSuperAdmin || !auth.facilityId) {
    return runQueries(superAdminDb);
  }

  return withTenantContext(auth.facilityId, (tx) => runQueries(tx));
}

// ── getOrderReport ────────────────────────────────────────────────────────

export async function getOrderReport(
  auth: AuthContext,
  input: ReportQuery,
): Promise<OrderReportResult> {
  const facilityId = auth.facilityId!;
  const { fromDate, toExclusive } = toDateRange(input.from, input.to);
  const periodUnit = PERIOD_MAP[input.period];

  return withTenantContext(facilityId, async (tx) => {
    const [statusRows, fulfillRows, trendRows] = await Promise.all([
      tx.execute<{ status: string; cnt: number }>(sql`
        SELECT status, COUNT(*)::int AS cnt
        FROM orders
        WHERE created_at >= ${fromDate}
          AND created_at < ${toExclusive}
        GROUP BY status
      `),
      tx.execute<{ avg_hours: number | null }>(sql`
        SELECT AVG(
          EXTRACT(EPOCH FROM (osh.created_at - o.created_at)) / 3600.0
        )::float AS avg_hours
        FROM orders o
        JOIN order_status_history osh
          ON osh.order_id = o.id
         AND osh.new_status = 'shipped'
        WHERE o.created_at >= ${fromDate}
          AND o.created_at < ${toExclusive}
      `),
      tx.execute<{ bucket: Date; order_count: number }>(sql`
        SELECT
          date_trunc(${sql.raw(`'${periodUnit}'`)}, created_at) AS bucket,
          COUNT(*)::int                                          AS order_count
        FROM orders
        WHERE created_at >= ${fromDate}
          AND created_at < ${toExclusive}
        GROUP BY bucket
        ORDER BY bucket
      `),
    ]);

    const byStatus = {
      pending: 0, confirmed: 0, processing: 0, ready: 0,
      shipped: 0, delivered: 0, cancelled: 0, refunded: 0,
    } as OrderReportResult['summary']['byStatus'];

    for (const row of statusRows) {
      const key = row.status as keyof typeof byStatus;
      if (key in byStatus) byStatus[key] = row.cnt;
    }

    const totalOrders = Object.values(byStatus).reduce((a, b) => a + b, 0);
    const cancellationRate =
      totalOrders > 0
        ? Math.round((byStatus.cancelled / totalOrders) * 1000) / 10
        : 0;

    const fulfill = Array.from(fulfillRows)[0];
    const averageFulfillmentHours =
      fulfill?.avg_hours != null
        ? Math.round(fulfill.avg_hours * 10) / 10
        : null;

    const trendMap = new Map<string, number>();
    for (const row of trendRows) {
      trendMap.set(bucketKey(row.bucket), row.order_count);
    }

    const allBuckets = generateBuckets(input.from, input.to, input.period);
    const trend: TrendBucket[] = allBuckets.map((b) => ({
      bucket: b,
      orderCount: trendMap.get(b) ?? 0,
    }));

    return {
      period: input.period,
      from: input.from,
      to: input.to,
      summary: { totalOrders, byStatus, cancellationRate, averageFulfillmentHours },
      trend,
    };
  });
}

// ── getPatientReport ──────────────────────────────────────────────────────

export async function getPatientReport(
  auth: AuthContext,
  input: ReportQuery,
): Promise<PatientReportResult> {
  const facilityId = auth.facilityId!;
  const { fromDate, toExclusive } = toDateRange(input.from, input.to);
  const periodUnit = PERIOD_MAP[input.period];
  const twelveMonthsAgo = new Date(new Date(input.to + 'T00:00:00Z').getTime() - 365 * 86_400_000);

  return withTenantContext(facilityId, async (tx) => {
    const [trendRows, activeRows, retentionRows, topRows] = await Promise.all([
      tx.execute<{ bucket: Date; new_patients: number }>(sql`
        SELECT
          date_trunc(${sql.raw(`'${periodUnit}'`)}, u.created_at) AS bucket,
          COUNT(*)::int                                             AS new_patients
        FROM users u
        JOIN facility_users fu ON fu.user_id = u.id
        JOIN facility_roles  fr ON fr.id     = fu.role_id
        WHERE fr.name      = 'patient'
          AND u.created_at >= ${fromDate}
          AND u.created_at < ${toExclusive}
        GROUP BY bucket
        ORDER BY bucket
      `),
      tx.execute<{ cnt: number }>(sql`
        SELECT COUNT(DISTINCT u.id)::int AS cnt
        FROM users u
        JOIN facility_users fu ON fu.user_id = u.id
        JOIN facility_roles  fr ON fr.id     = fu.role_id
        WHERE fr.name = 'patient'
          AND (
            EXISTS (
              SELECT 1 FROM orders o
              WHERE o.patient_id = u.id
                AND o.created_at >= ${twelveMonthsAgo}
            )
            OR EXISTS (
              SELECT 1 FROM prescription_requests pr
              WHERE pr.patient_id = u.id
                AND pr.created_at >= ${twelveMonthsAgo}
            )
          )
      `),
      tx.execute<{ with_one: number; with_two_plus: number }>(sql`
        SELECT
          COUNT(DISTINCT CASE WHEN order_count >= 1 THEN patient_id END)::int AS with_one,
          COUNT(DISTINCT CASE WHEN order_count >= 2 THEN patient_id END)::int AS with_two_plus
        FROM (
          SELECT o.patient_id, COUNT(*)::int AS order_count
          FROM orders o
          JOIN facility_users fu ON fu.user_id = o.patient_id
          JOIN facility_roles  fr ON fr.id     = fu.role_id
          WHERE fr.name = 'patient'
          GROUP BY o.patient_id
        ) sub
      `),
      tx.execute<{
        user_id: string;
        first_name: string;
        last_name: string;
        order_count: number;
        lifetime_spend: string;
      }>(sql`
        SELECT
          u.id                                        AS user_id,
          u.first_name,
          u.last_name,
          COUNT(DISTINCT o.id)::int                  AS order_count,
          COALESCE(SUM(o.total), 0)::text            AS lifetime_spend
        FROM users u
        JOIN facility_users fu ON fu.user_id = u.id
        JOIN facility_roles  fr ON fr.id     = fu.role_id
        LEFT JOIN orders o ON o.patient_id = u.id
        WHERE fr.name = 'patient'
        GROUP BY u.id, u.first_name, u.last_name
        ORDER BY SUM(o.total) DESC NULLS LAST
        LIMIT ${input.limit}
      `),
    ]);

    const trendMap = new Map<string, number>();
    for (const row of trendRows) {
      trendMap.set(bucketKey(row.bucket), row.new_patients);
    }
    const allBuckets = generateBuckets(input.from, input.to, input.period);
    const trend: TrendBucket[] = allBuckets.map((b) => ({
      bucket: b,
      newPatients: trendMap.get(b) ?? 0,
    }));
    const newPatientsInRange = trend.reduce((s, b) => s + (b.newPatients ?? 0), 0);

    const active = Array.from(activeRows)[0];
    const ret = Array.from(retentionRows)[0];
    const retentionRate =
      ret && ret.with_one > 0
        ? Math.round((ret.with_two_plus / ret.with_one) * 1000) / 10
        : null;

    const topPatients: TopPatient[] = Array.from(topRows).map((r) => ({
      userId: r.user_id,
      firstName: r.first_name,
      lastName: r.last_name,
      orderCount: r.order_count,
      lifetimeSpend: r.lifetime_spend,
    }));

    return {
      period: input.period,
      from: input.from,
      to: input.to,
      summary: {
        newPatientsInRange,
        totalActivePatients: active?.cnt ?? 0,
        retentionRate,
      },
      trend,
      topPatients,
    };
  });
}
