import { z } from 'zod';

export const ListNotificationsQuerySchema = z.object({
  page:       z.coerce.number().int().min(1).default(1),
  limit:      z.coerce.number().int().min(1).max(100).default(20),
  unreadOnly: z.coerce.boolean().optional(),
});

export const NotificationParamsSchema = z.object({
  id: z.string().uuid(),
});

export const BroadcastNotificationBodySchema = z.object({
  userIds: z.array(z.string().uuid()).optional(),
  title:   z.string().min(1).max(200),
  body:    z.string().min(1).max(1000),
  actionUrl: z.string().url().optional(),
});

export type ListNotificationsQuery   = z.infer<typeof ListNotificationsQuerySchema>;
export type NotificationParams       = z.infer<typeof NotificationParamsSchema>;
export type BroadcastNotificationBody = z.infer<typeof BroadcastNotificationBodySchema>;
