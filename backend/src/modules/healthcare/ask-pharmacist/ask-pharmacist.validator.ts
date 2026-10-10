import { z } from 'zod';

const CONVERSATION_STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;
const CLOSEABLE_STATUSES = ['resolved', 'closed'] as const;

export const StartConversationBodySchema = z.object({
  subject: z.string().min(1).max(200),
  body: z.string().min(10),
  medicationName: z.string().max(200).optional(),
});

export const AddMessageBodySchema = z.object({
  body: z.string().min(10),
});

export const AssignConversationBodySchema = z.object({
  assignedTo: z.string().uuid(),
});

export const ConversationStatusBodySchema = z.object({
  newStatus: z.enum(CLOSEABLE_STATUSES),
  note: z.string().max(500).optional(),
});

export const UpdateConversationNotesBodySchema = z.object({
  notes: z.string().max(2000),
});

export const ListConversationsQuerySchema = z.object({
  status: z.enum(CONVERSATION_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const AdminListConversationsQuerySchema = z.object({
  status: z.enum(CONVERSATION_STATUSES).optional(),
  assignedTo: z.string().uuid().optional(),
  patientId: z.string().uuid().optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['createdAt:asc', 'createdAt:desc']).default('createdAt:desc'),
});

export type StartConversationBody = z.infer<typeof StartConversationBodySchema>;
export type AddMessageBody = z.infer<typeof AddMessageBodySchema>;
export type AssignConversationBody = z.infer<typeof AssignConversationBodySchema>;
export type ConversationStatusBody = z.infer<typeof ConversationStatusBodySchema>;
export type UpdateConversationNotesBody = z.infer<typeof UpdateConversationNotesBodySchema>;
export type ListConversationsQuery = z.infer<typeof ListConversationsQuerySchema>;
export type AdminListConversationsQuery = z.infer<typeof AdminListConversationsQuerySchema>;
