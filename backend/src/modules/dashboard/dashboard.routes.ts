import { Router } from "express";
import { authenticate, requirePermission } from "@/common/middleware/auth.middleware";
import { asyncHandler } from "@/common/utils/asyncHandler";
import { sendSuccess } from "@/common/utils/response";
import { UserModel } from "@/modules/users/users.schema";
import { OrderModel } from "@/modules/orders/orders.schema";
import { ProductModel } from "@/modules/products/products.schema";
import { InventoryModel } from "@/modules/inventory/inventory.schema";
import { CompoundingModel } from "@/modules/compounding/compounding.schema";
import { AskPharmacistModel } from "@/modules/ask-pharmacist/ask-pharmacist.schema";
import { AppointmentBookingModel } from "@/modules/appointments/appointments.schema";
import { PrescriptionModel } from "@/modules/prescriptions/prescriptions.schema";

const router = Router();

router.get("/metrics", authenticate, asyncHandler(async (_req, res) => {
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

  const [
    totalUsers, newUsersToday,
    pendingClinics, pendingPartners,
    totalOrders, ordersToday, pendingOrders,
    totalProducts, lowStockCount,
    revenueResult,
    pendingCompounding, openAskPharmacist,
    pendingAppointments, activePrescriptions,
  ] = await Promise.all([
    UserModel.countDocuments({ role: "patient" }),
    UserModel.countDocuments({ role: "patient", createdAt: { $gte: todayStart } }),
    UserModel.countDocuments({ role: "clinic",            status: "pending_approval" }),
    UserModel.countDocuments({ role: "pharmacy_partner",  status: "pending_approval" }),
    OrderModel.countDocuments(),
    OrderModel.countDocuments({ createdAt: { $gte: todayStart } }),
    OrderModel.countDocuments({ status: "pending" }),
    ProductModel.countDocuments({ status: "active" }),
    InventoryModel.countDocuments({
      trackInventory: true,
      $expr: { $lte: ["$quantity", "$lowStockThreshold"] },
    }),
    OrderModel.aggregate([
      { $match: { status: { $nin: ["cancelled"] } } },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]),
    CompoundingModel.countDocuments({ status: { $in: ["submitted", "reviewing"] } }),
    AskPharmacistModel.countDocuments({ status: "open" }),
    AppointmentBookingModel.countDocuments({ status: { $in: ["pending", "confirmed"] } }),
    PrescriptionModel.countDocuments({ status: "active" }),
  ]);

  const totalRevenue = revenueResult[0]?.total ?? 0;

  /* Orders by status */
  const ordersByStatus = await OrderModel.aggregate([
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  /* Last 7 days orders */
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const dailyOrders = await OrderModel.aggregate([
    { $match: { createdAt: { $gte: sevenDaysAgo } } },
    { $group: {
      _id:     { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
      count:   { $sum: 1 },
      revenue: { $sum: "$total" },
    }},
    { $sort: { _id: 1 } },
  ]);

  sendSuccess(res, {
    users:      { total: totalUsers, newToday: newUsersToday },
    approvals:  { pendingClinics, pendingPartners },
    orders:     { total: totalOrders, today: ordersToday, pending: pendingOrders, byStatus: ordersByStatus },
    products:   { active: totalProducts, lowStock: lowStockCount },
    revenue:    { totalCents: totalRevenue, totalCAD: (totalRevenue / 100).toFixed(2) },
    charts:     { dailyOrders },
    healthcare: {
      pendingCompounding,
      openAskPharmacist,
      pendingAppointments,
      activePrescriptions,
    },
  });
}));

export default router;
