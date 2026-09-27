import { Router, type Request } from "express";
import { authenticate, requirePermission } from "@/common/middleware/auth.middleware";
import { asyncHandler } from "@/common/utils/asyncHandler";
import { sendSuccess } from "@/common/utils/response";
import { OrderModel } from "@/modules/orders/orders.schema";
import { UserModel } from "@/modules/users/users.schema";
import { CouponModel } from "@/modules/coupons/coupons.schema";

const router = Router();
router.use(authenticate, requirePermission("reports.read"));

/* ────────────────────────────────────────────────────────────────────
   Helper: resolve date range from preset or explicit from/to
   ──────────────────────────────────────────────────────────────────── */
function resolveDateRange(req: Request): { start: Date; end: Date } {
  const { preset, from, to } = req.query as Record<string, string | undefined>;
  const now    = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (preset === "today") {
    return { start: todayStart, end: now };
  }
  if (preset === "yesterday") {
    const s = new Date(todayStart); s.setDate(s.getDate() - 1);
    const e = new Date(todayStart); e.setMilliseconds(-1);
    return { start: s, end: e };
  }
  if (preset === "30d") {
    const s = new Date(now); s.setDate(s.getDate() - 30); s.setHours(0, 0, 0, 0);
    return { start: s, end: now };
  }
  if (preset === "month") {
    const s = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start: s, end: now };
  }
  if (from && to) {
    return { start: new Date(from), end: new Date(to) };
  }
  /* default: last 7 days */
  const s = new Date(now); s.setDate(s.getDate() - 7); s.setHours(0, 0, 0, 0);
  return { start: s, end: now };
}

/* ────────────────────────────────────────────────────────────────────
   GET /sales
   Returns: summary KPIs + daily revenue+orders chart
   ──────────────────────────────────────────────────────────────────── */
router.get("/sales", asyncHandler(async (req, res) => {
  const { start, end } = resolveDateRange(req);

  const [summary, dailyChart] = await Promise.all([
    OrderModel.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end }, status: { $nin: ["cancelled"] } } },
      { $group: {
        _id:      null,
        revenue:  { $sum: "$total" },
        count:    { $sum: 1 },
        discount: { $sum: "$discountAmount" },
      }},
    ]),
    OrderModel.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end }, status: { $nin: ["cancelled"] } } },
      { $group: {
        _id:     { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        revenue: { $sum: "$total" },
        count:   { $sum: 1 },
      }},
      { $sort: { _id: 1 } },
    ]),
  ]);

  const s = summary[0] ?? { revenue: 0, count: 0, discount: 0 };
  const aov = s.count > 0 ? s.revenue / s.count : 0;

  sendSuccess(res, {
    period:     { start, end },
    summary: {
      revenueCents:   s.revenue,
      revenueCAD:     (s.revenue  / 100).toFixed(2),
      orderCount:     s.count,
      aovCents:       Math.round(aov),
      aovCAD:         (aov / 100).toFixed(2),
      discountCents:  s.discount,
      discountCAD:    (s.discount / 100).toFixed(2),
    },
    chart: dailyChart,
  });
}));

/* ────────────────────────────────────────────────────────────────────
   GET /orders
   Returns: orders by status + daily order count chart
   ──────────────────────────────────────────────────────────────────── */
router.get("/orders", asyncHandler(async (req, res) => {
  const { start, end } = resolveDateRange(req);

  const [byStatus, dailyChart, guestVsUser] = await Promise.all([
    OrderModel.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    OrderModel.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $group: {
        _id:   { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        count: { $sum: 1 },
      }},
      { $sort: { _id: 1 } },
    ]),
    OrderModel.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $group: {
        _id:   { $cond: [{ $ifNull: ["$userId", false] }, "registered", "guest"] },
        count: { $sum: 1 },
      }},
    ]),
  ]);

  sendSuccess(res, {
    period:      { start, end },
    byStatus,
    dailyChart,
    guestVsUser,
  });
}));

/* ────────────────────────────────────────────────────────────────────
   GET /products
   Returns: top 10 by units sold + top 10 by revenue
   ──────────────────────────────────────────────────────────────────── */
router.get("/products", asyncHandler(async (req, res) => {
  const { start, end } = resolveDateRange(req);
  const matchClause = { createdAt: { $gte: start, $lte: end }, status: { $nin: ["cancelled"] } };

  const [topByQty, topByRevenue] = await Promise.all([
    OrderModel.aggregate([
      { $match: matchClause },
      { $unwind: "$items" },
      { $group: {
        _id:     "$items.sku",
        name:    { $first: "$items.name" },
        qtySold: { $sum: "$items.quantity" },
        revenue: { $sum: "$items.lineTotal" },
      }},
      { $sort: { qtySold: -1 } },
      { $limit: 10 },
    ]),
    OrderModel.aggregate([
      { $match: matchClause },
      { $unwind: "$items" },
      { $group: {
        _id:     "$items.sku",
        name:    { $first: "$items.name" },
        qtySold: { $sum: "$items.quantity" },
        revenue: { $sum: "$items.lineTotal" },
      }},
      { $sort: { revenue: -1 } },
      { $limit: 10 },
    ]),
  ]);

  sendSuccess(res, {
    period:       { start, end },
    topByQty,
    topByRevenue,
  });
}));

/* ────────────────────────────────────────────────────────────────────
   GET /customers
   Returns: new registrations by day + period total + all-time total
   ──────────────────────────────────────────────────────────────────── */
router.get("/customers", asyncHandler(async (req, res) => {
  const { start, end } = resolveDateRange(req);

  const [dailyNew, periodTotal, allTimeTotal, activeInPeriod] = await Promise.all([
    UserModel.aggregate([
      { $match: { role: "patient", createdAt: { $gte: start, $lte: end } } },
      { $group: {
        _id:   { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        count: { $sum: 1 },
      }},
      { $sort: { _id: 1 } },
    ]),
    UserModel.countDocuments({ role: "patient", createdAt: { $gte: start, $lte: end } }),
    UserModel.countDocuments({ role: "patient" }),
    /* registered customers who placed an order in the period */
    OrderModel.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end }, userId: { $ne: null } } },
      { $group: { _id: "$userId" } },
      { $count: "count" },
    ]),
  ]);

  sendSuccess(res, {
    period:          { start, end },
    allTimeTotal,
    periodNewCount:  periodTotal,
    activeCount:     activeInPeriod[0]?.count ?? 0,
    dailyChart:      dailyNew,
  });
}));

/* ────────────────────────────────────────────────────────────────────
   GET /coupons
   Returns: coupon usage counts + most-used coupons + savings given
   ──────────────────────────────────────────────────────────────────── */
router.get("/coupons", asyncHandler(async (req, res) => {
  const { start, end } = resolveDateRange(req);

  const [withCoupon, topCoupons, allCoupons] = await Promise.all([
    /* Orders with vs without coupon in period */
    OrderModel.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $group: {
        _id:   { $cond: [{ $ne: ["$couponCode", null] }, "with_coupon", "no_coupon"] },
        count: { $sum: 1 },
      }},
    ]),
    /* Top coupons by usage in period */
    OrderModel.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end }, couponCode: { $ne: null } } },
      { $group: {
        _id:          "$couponCode",
        usageCount:   { $sum: 1 },
        totalSavings: { $sum: "$discountAmount" },
      }},
      { $sort: { usageCount: -1 } },
      { $limit: 10 },
    ]),
    /* All-time coupon stats from the coupons collection */
    CouponModel.find({}, { code: 1, usageCount: 1, usageLimit: 1, discountType: 1, discountValue: 1 })
      .sort({ usageCount: -1 })
      .limit(20)
      .lean(),
  ]);

  sendSuccess(res, {
    period:     { start, end },
    withCoupon,
    topCoupons,
    allCoupons,
  });
}));

export default router;
