import { NotificationModel, type NotificationType } from "./notifications.schema";
import { UserModel } from "@/modules/users/users.schema";
import { logger } from "@/common/utils/logger";

export interface CreateNotificationInput {
  userId:    string;
  type:      NotificationType;
  title:     string;
  message:   string;
  metadata?: Record<string, unknown>;
}

export async function createNotification(input: CreateNotificationInput) {
  return NotificationModel.create(input);
}

/** Create a notification for every user with role "admin" or "staff". */
export async function notifyAdmins(
  input: Omit<CreateNotificationInput, "userId">,
) {
  try {
    const admins = await UserModel.find({ role: "admin" }).select("_id").lean();
    if (admins.length === 0) return;
    await NotificationModel.insertMany(
      admins.map((a) => ({ ...input, userId: a._id })),
      { ordered: false },
    );
  } catch (err) {
    logger.error("[Notifications] notifyAdmins failed", err);
  }
}

export async function listNotifications(userId: string, page = 1, limit = 20) {
  const [total, data] = await Promise.all([
    NotificationModel.countDocuments({ userId }),
    NotificationModel.find({ userId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);
  return { data, total, page, limit };
}

export async function getUnreadCount(userId: string): Promise<number> {
  return NotificationModel.countDocuments({ userId, read: false });
}

export async function markOneRead(id: string, userId: string) {
  const n = await NotificationModel.findOneAndUpdate(
    { _id: id, userId },
    { read: true, readAt: new Date() },
    { new: true },
  );
  if (!n) throw new Error("Notification not found");
  return n;
}

export async function markAllRead(userId: string) {
  const result = await NotificationModel.updateMany(
    { userId, read: false },
    { read: true, readAt: new Date() },
  );
  return { updated: result.modifiedCount };
}
