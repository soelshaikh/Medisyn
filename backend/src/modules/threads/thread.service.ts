import { Types } from "mongoose";
import { Thread, ThreadMessage } from "./thread.schema";
import type { ThreadEntityType, ThreadChannel } from "./thread.schema";
import { AppError } from "@/common/middleware/error.middleware";

/* ─── Shared view type ──────────────────────────────────────────────────────── */

export interface MessageView {
  _id:             Types.ObjectId;
  parentMessageId: Types.ObjectId | null;
  parentMessage:   { authorName: string; bodyPreview: string } | null;
  authorId:        Types.ObjectId;
  authorName:      string;
  authorRole:      "admin" | "patient" | "system";
  body:            string;
  readBy:          Array<{ userId: Types.ObjectId; readAt: Date }>;
  editedAt:        Date | null;
  deletedAt:       Date | null;
  createdAt:       Date;
}

/* ─── Internal helpers ──────────────────────────────────────────────────────── */

const ENTITY_TYPES: ThreadEntityType[] = [
  "prescription",
  "order",
  "ask_pharmacist",
  "minor_ailment",
  "compounding",
  "appointment",
  "patient",
];

function isValidEntityType(v: string): v is ThreadEntityType {
  return (ENTITY_TYPES as string[]).includes(v);
}

function toObjectId(v: string): Types.ObjectId {
  return new Types.ObjectId(v);
}

async function upsertThread(
  entityType: ThreadEntityType,
  entityId:   Types.ObjectId | string,
  channel:    ThreadChannel,
) {
  const eId = typeof entityId === "string" ? toObjectId(entityId) : entityId;
  const thread = await Thread.findOneAndUpdate(
    { entityType, entityId: eId, channel },
    { $setOnInsert: { entityType, entityId: eId, channel, messageCount: 0, lastMessageAt: null, lastMessagePreview: "" } },
    { upsert: true, new: true },
  );
  return thread!;
}

function bodyPreview(body: string, maxLen: number): string {
  const trimmed = body.trim();
  return trimmed.length > maxLen ? `${trimmed.slice(0, maxLen)}…` : trimmed;
}

/* ─── getThreadSummary ──────────────────────────────────────────────────────── */

export async function getThreadSummary(
  entityType: ThreadEntityType,
  entityId:   string,
) {
  const eId = toObjectId(entityId);
  const threads = await Thread.find({ entityType, entityId: eId }).lean();
  return threads;
}

/* ─── getMessages ───────────────────────────────────────────────────────────── */

export interface GetMessagesResult {
  threadId:     Types.ObjectId;
  channel:      ThreadChannel;
  messageCount: number;
  messages:     MessageView[];
  hasMore:      boolean;
}

export async function getMessages(
  entityType: ThreadEntityType,
  entityId:   string,
  channel:    ThreadChannel,
  opts:       { limit?: number; before?: string },
): Promise<GetMessagesResult> {
  const thread = await upsertThread(entityType, entityId, channel);
  const limit  = Math.min(opts.limit ?? 50, 100);

  const filter: Record<string, unknown> = {
    threadId:  thread._id,
    deletedAt: null,
  };
  if (opts.before) {
    filter["_id"] = { $lt: toObjectId(opts.before) };
  }

  const rawMessages = await ThreadMessage
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(limit + 1)
    .lean();

  const hasMore = rawMessages.length > limit;
  const page    = hasMore ? rawMessages.slice(0, limit) : rawMessages;

  /* Batch-fetch parent messages */
  const parentIds = [
    ...new Set(
      page
        .filter((m) => m.parentMessageId != null)
        .map((m) => (m.parentMessageId as Types.ObjectId).toString()),
    ),
  ].map((id) => toObjectId(id));

  const parentDocs = parentIds.length
    ? await ThreadMessage.find({ _id: { $in: parentIds } }).lean()
    : [];

  const parentMap = new Map(parentDocs.map((p) => [p._id.toString(), p]));

  /* Build MessageView array — chronological order */
  const messages: MessageView[] = page.reverse().map((m) => {
    let parentMessage: MessageView["parentMessage"] = null;
    if (m.parentMessageId) {
      const parent = parentMap.get(m.parentMessageId.toString());
      if (parent) {
        parentMessage = {
          authorName: parent.authorName,
          bodyPreview: bodyPreview(parent.body, 80),
        };
      }
    }
    return {
      _id:             m._id as Types.ObjectId,
      parentMessageId: (m.parentMessageId as Types.ObjectId | null) ?? null,
      parentMessage,
      authorId:        m.authorId as Types.ObjectId,
      authorName:      m.authorName,
      authorRole:      m.authorRole,
      body:            m.body,
      readBy:          m.readBy as Array<{ userId: Types.ObjectId; readAt: Date }>,
      editedAt:        m.editedAt ?? null,
      deletedAt:       m.deletedAt ?? null,
      createdAt:       m.createdAt,
    };
  });

  return {
    threadId:     thread._id as Types.ObjectId,
    channel,
    messageCount: thread.messageCount,
    messages,
    hasMore,
  };
}

/* ─── postMessage ───────────────────────────────────────────────────────────── */

export async function postMessage(
  entityType:      ThreadEntityType,
  entityId:        string,
  channel:         ThreadChannel,
  actor:           { id: string; name: string; role: "admin" | "patient" | "system" },
  body:            string,
  parentMessageId?: string,
) {
  const thread = await upsertThread(entityType, entityId, channel);

  /* Validate parent message if provided */
  if (parentMessageId) {
    const parent = await ThreadMessage.findById(parentMessageId).lean();
    if (!parent) {
      throw new AppError("Parent message not found", 404);
    }
    if (parent.threadId.toString() !== (thread._id as Types.ObjectId).toString()) {
      throw new AppError("Parent message does not belong to this thread", 400);
    }
    if (parent.deletedAt) {
      throw new AppError("Cannot reply to a deleted message", 400);
    }
  }

  const now = new Date();
  const message = await ThreadMessage.create({
    threadId:        thread._id,
    parentMessageId: parentMessageId ? toObjectId(parentMessageId) : null,
    authorId:        toObjectId(actor.id),
    authorName:      actor.name,
    authorRole:      actor.role,
    body:            body.trim(),
    readBy:          [{ userId: toObjectId(actor.id), readAt: now }],
    editedAt:        null,
    deletedAt:       null,
  });

  /* Update thread metadata */
  await Thread.updateOne(
    { _id: thread._id },
    {
      $inc: { messageCount: 1 },
      $set: {
        lastMessageAt:      now,
        lastMessagePreview: bodyPreview(body, 120),
      },
    },
  );

  return message;
}

/* ─── editMessage ───────────────────────────────────────────────────────────── */

export async function editMessage(
  messageId: string,
  actorId:   string,
  body:      string,
) {
  const message = await ThreadMessage.findById(messageId);
  if (!message) throw new AppError("Message not found", 404);
  if (message.authorId.toString() !== actorId) throw new AppError("Forbidden", 403);
  if (message.deletedAt) throw new AppError("Cannot edit a deleted message", 400);

  const ageMs = Date.now() - message.createdAt.getTime();
  if (ageMs > 15 * 60 * 1000) throw new AppError("Edit window has expired (15 minutes)", 400);

  message.body     = body.trim();
  message.editedAt = new Date();
  await message.save();
  return message;
}

/* ─── softDeleteMessage ─────────────────────────────────────────────────────── */

export async function softDeleteMessage(
  messageId: string,
  actorId:   string,
  isAdmin:   boolean,
) {
  const message = await ThreadMessage.findById(messageId);
  if (!message) throw new AppError("Message not found", 404);
  if (!isAdmin && message.authorId.toString() !== actorId) throw new AppError("Forbidden", 403);
  if (message.deletedAt) throw new AppError("Message is already deleted", 400);

  message.deletedAt = new Date();
  await message.save();
  return message;
}

/* ─── markRead ──────────────────────────────────────────────────────────────── */

export async function markRead(messageId: string, userId: string) {
  await ThreadMessage.updateOne(
    { _id: toObjectId(messageId), "readBy.userId": { $ne: toObjectId(userId) } },
    { $push: { readBy: { userId: toObjectId(userId), readAt: new Date() } } },
  );
}

/* ─── getPatientDirectMessages ──────────────────────────────────────────────── */

export async function getPatientDirectMessages(
  patientId: string,
  opts:       { limit?: number; before?: string },
) {
  return getMessages("patient", patientId, "direct", opts);
}

/* ─── getPatientEntityMessages ──────────────────────────────────────────────── */

export async function getPatientEntityMessages(
  entityType: string,
  entityId:   string,
  opts:       { limit?: number; before?: string },
) {
  if (!isValidEntityType(entityType)) {
    throw new AppError(`Invalid entity type: ${entityType}`, 400);
  }
  return getMessages(entityType, entityId, "patient", opts);
}
