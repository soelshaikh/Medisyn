import mongoose, { Schema, Document, Types } from "mongoose";

/* ─── Union types ──────────────────────────────────────────────────────────── */

export type ThreadEntityType =
  | "prescription"
  | "order"
  | "ask_pharmacist"
  | "minor_ailment"
  | "compounding"
  | "appointment"
  | "patient";

export type ThreadChannel = "patient" | "internal" | "direct";

/* ─── IThread ──────────────────────────────────────────────────────────────── */

export interface IThread extends Document {
  entityType:         ThreadEntityType;
  entityId:           Types.ObjectId;
  channel:            ThreadChannel;
  messageCount:       number;
  lastMessageAt:      Date | null;
  lastMessagePreview: string;
  createdAt:          Date;
  updatedAt:          Date;
}

/* ─── IThreadMessage ────────────────────────────────────────────────────────── */

export interface IReadByEntry {
  userId: Types.ObjectId;
  readAt: Date;
}

export interface IThreadMessage extends Document {
  threadId:        Types.ObjectId;
  parentMessageId: Types.ObjectId | null;
  authorId:        Types.ObjectId;
  authorName:      string;
  authorRole:      "admin" | "patient" | "system";
  body:            string;
  readBy:          IReadByEntry[];
  editedAt:        Date | null;
  deletedAt:       Date | null;
  createdAt:       Date;
  updatedAt:       Date;
}

/* ─── Schemas ───────────────────────────────────────────────────────────────── */

const ReadByEntrySchema = new Schema<IReadByEntry>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    readAt: { type: Date, required: true },
  },
  { _id: false },
);

const ThreadMessageSchema = new Schema<IThreadMessage>(
  {
    threadId:        { type: Schema.Types.ObjectId, ref: "Thread", required: true, index: true },
    parentMessageId: { type: Schema.Types.ObjectId, ref: "ThreadMessage", default: null },
    authorId:        { type: Schema.Types.ObjectId, ref: "User", required: true },
    authorName:      { type: String, required: true, maxlength: 200 },
    authorRole:      { type: String, enum: ["admin", "patient", "system"], required: true },
    body:            { type: String, required: true, maxlength: 5000, trim: true },
    readBy:          { type: [ReadByEntrySchema], default: [] },
    editedAt:        { type: Date, default: null },
    deletedAt:       { type: Date, default: null },
  },
  { timestamps: true },
);

ThreadMessageSchema.index({ threadId: 1, createdAt: 1 });
ThreadMessageSchema.index({ threadId: 1, parentMessageId: 1 });

const ThreadSchema = new Schema<IThread>(
  {
    entityType:         {
      type:     String,
      enum:     ["prescription", "order", "ask_pharmacist", "minor_ailment", "compounding", "appointment", "patient"],
      required: true,
    },
    entityId:           { type: Schema.Types.ObjectId, required: true },
    channel:            { type: String, enum: ["patient", "internal", "direct"], required: true },
    messageCount:       { type: Number, default: 0 },
    lastMessageAt:      { type: Date, default: null },
    lastMessagePreview: { type: String, default: "" },
  },
  { timestamps: true },
);

ThreadSchema.index({ entityType: 1, entityId: 1, channel: 1 }, { unique: true });
ThreadSchema.index({ entityId: 1, entityType: 1 });
ThreadSchema.index({ lastMessageAt: -1 });

/* ─── Models ────────────────────────────────────────────────────────────────── */

export const ThreadMessage = mongoose.model<IThreadMessage>("ThreadMessage", ThreadMessageSchema);
export const Thread        = mongoose.model<IThread>("Thread", ThreadSchema);
