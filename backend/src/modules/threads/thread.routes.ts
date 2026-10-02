import { Router } from "express";
import { z } from "zod";
import { authenticate, requirePermission } from "@/common/middleware/auth.middleware";
import { asyncHandler } from "@/common/utils/asyncHandler";
import { sendSuccess, sendError } from "@/common/utils/response";
import { AppError } from "@/common/middleware/error.middleware";
import type { ThreadEntityType } from "./thread.schema";
import {
  getThreadSummary,
  getMessages,
  postMessage,
  editMessage,
  softDeleteMessage,
  markRead,
  getPatientDirectMessages,
  getPatientEntityMessages,
} from "./thread.service";

const router = Router();

/* ─── Validation schemas ────────────────────────────────────────────────────── */

const messageBodySchema = z.object({
  body:            z.string().min(1).max(5000).trim(),
  parentMessageId: z.string().optional(),
});

const paginationSchema = z.object({
  limit:  z.coerce.number().int().min(1).max(100).optional(),
  before: z.string().optional(),
});

/* ─── Helper: validate entityType param ─────────────────────────────────────── */

const VALID_ENTITY_TYPES: ThreadEntityType[] = [
  "prescription",
  "order",
  "ask_pharmacist",
  "minor_ailment",
  "compounding",
  "appointment",
  "patient",
];

function parseEntityType(v: string): ThreadEntityType {
  if ((VALID_ENTITY_TYPES as string[]).includes(v)) {
    return v as ThreadEntityType;
  }
  throw new AppError(`Invalid entity type: ${v}`, 400);
}

/* ═══════════════════════════════════════════════════════════════════════════════
   ADMIN ROUTES
   All require authenticate. Mounted at /api/v1 so full paths are used below.
═══════════════════════════════════════════════════════════════════════════════ */

/* GET /admin/threads/:entityType/:entityId — thread summary for an entity */
router.get(
  "/admin/threads/:entityType/:entityId",
  authenticate,
  requirePermission("threads.read"),
  asyncHandler(async (req, res) => {
    const entityType = parseEntityType(req.params["entityType"] as string);
    const entityId   = req.params["entityId"] as string;
    const data = await getThreadSummary(entityType, entityId);
    return sendSuccess(res, data);
  }),
);

/* GET /admin/threads/:entityType/:entityId/:channel/messages — list messages */
router.get(
  "/admin/threads/:entityType/:entityId/:channel/messages",
  authenticate,
  requirePermission("threads.read"),
  asyncHandler(async (req, res) => {
    const entityType = parseEntityType(req.params["entityType"] as string);
    const entityId   = req.params["entityId"] as string;
    const channel    = req.params["channel"] as string;

    if (!["patient", "internal", "direct"].includes(channel)) {
      throw new AppError(`Invalid channel: ${channel}`, 400);
    }

    const { limit, before } = paginationSchema.parse(req.query);
    const data = await getMessages(
      entityType,
      entityId,
      channel as "patient" | "internal" | "direct",
      { limit, before },
    );
    return sendSuccess(res, data);
  }),
);

/* POST /admin/threads/:entityType/:entityId/patient/messages — reply via patient channel */
router.post(
  "/admin/threads/:entityType/:entityId/patient/messages",
  authenticate,
  requirePermission("threads.reply_patient"),
  asyncHandler(async (req, res) => {
    const parsed = messageBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, "Validation failed", 400, parsed.error.flatten().fieldErrors as Record<string, string[]>);
    }

    const entityType = parseEntityType(req.params["entityType"] as string);
    const entityId   = req.params["entityId"] as string;
    const { body, parentMessageId } = parsed.data;

    const message = await postMessage(
      entityType,
      entityId,
      "patient",
      { id: req.user!._id, name: req.user!.fullName, role: "admin" },
      body,
      parentMessageId,
    );
    return sendSuccess(res, message, "Message sent", 201);
  }),
);

/* POST /admin/threads/:entityType/:entityId/direct/messages — reply via direct channel */
router.post(
  "/admin/threads/:entityType/:entityId/direct/messages",
  authenticate,
  requirePermission("threads.reply_patient"),
  asyncHandler(async (req, res) => {
    const parsed = messageBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, "Validation failed", 400, parsed.error.flatten().fieldErrors as Record<string, string[]>);
    }

    const entityType = parseEntityType(req.params["entityType"] as string);
    const entityId   = req.params["entityId"] as string;
    const { body, parentMessageId } = parsed.data;

    const message = await postMessage(
      entityType,
      entityId,
      "direct",
      { id: req.user!._id, name: req.user!.fullName, role: "admin" },
      body,
      parentMessageId,
    );
    return sendSuccess(res, message, "Message sent", 201);
  }),
);

/* POST /admin/threads/:entityType/:entityId/internal/messages — add internal note */
router.post(
  "/admin/threads/:entityType/:entityId/internal/messages",
  authenticate,
  requirePermission("threads.add_note"),
  asyncHandler(async (req, res) => {
    const parsed = messageBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, "Validation failed", 400, parsed.error.flatten().fieldErrors as Record<string, string[]>);
    }

    const entityType = parseEntityType(req.params["entityType"] as string);
    const entityId   = req.params["entityId"] as string;
    const { body, parentMessageId } = parsed.data;

    const message = await postMessage(
      entityType,
      entityId,
      "internal",
      { id: req.user!._id, name: req.user!.fullName, role: "admin" },
      body,
      parentMessageId,
    );
    return sendSuccess(res, message, "Message sent", 201);
  }),
);

/* PATCH /admin/threads/messages/:messageId — edit a message (author or admin) */
router.patch(
  "/admin/threads/messages/:messageId",
  authenticate,
  asyncHandler(async (req, res) => {
    const parsed = z.object({ body: z.string().min(1).max(5000).trim() }).safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, "Validation failed", 400, parsed.error.flatten().fieldErrors as Record<string, string[]>);
    }

    const messageId = req.params["messageId"] as string;
    const message   = await editMessage(messageId, req.user!._id, parsed.data.body);
    return sendSuccess(res, message);
  }),
);

/* DELETE /admin/threads/messages/:messageId — soft-delete a message */
router.delete(
  "/admin/threads/messages/:messageId",
  authenticate,
  asyncHandler(async (req, res) => {
    const messageId = req.params["messageId"] as string;
    const message   = await softDeleteMessage(messageId, req.user!._id, true);
    return sendSuccess(res, message);
  }),
);

/* POST /admin/threads/messages/:messageId/read — mark message as read */
router.post(
  "/admin/threads/messages/:messageId/read",
  authenticate,
  requirePermission("threads.read"),
  asyncHandler(async (req, res) => {
    const messageId = req.params["messageId"] as string;
    await markRead(messageId, req.user!._id);
    return sendSuccess(res, null);
  }),
);

/* ═══════════════════════════════════════════════════════════════════════════════
   PATIENT ROUTES
   authenticate only — no permission keys.
═══════════════════════════════════════════════════════════════════════════════ */

/* GET /threads/my/messages — patient direct messages */
router.get(
  "/threads/my/messages",
  authenticate,
  asyncHandler(async (req, res) => {
    const { limit, before } = paginationSchema.parse(req.query);
    const data = await getPatientDirectMessages(req.user!._id, { limit, before });
    return sendSuccess(res, data);
  }),
);

/* POST /threads/my/messages — patient posts a direct message */
router.post(
  "/threads/my/messages",
  authenticate,
  asyncHandler(async (req, res) => {
    const parsed = messageBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, "Validation failed", 400, parsed.error.flatten().fieldErrors as Record<string, string[]>);
    }

    const { body, parentMessageId } = parsed.data;
    const message = await postMessage(
      "patient",
      req.user!._id,
      "direct",
      { id: req.user!._id, name: req.user!.fullName, role: "patient" },
      body,
      parentMessageId,
    );
    return sendSuccess(res, message, "Message sent", 201);
  }),
);

/* POST /threads/my/messages/:messageId/read — patient marks direct message as read */
router.post(
  "/threads/my/messages/:messageId/read",
  authenticate,
  asyncHandler(async (req, res) => {
    const messageId = req.params["messageId"] as string;
    await markRead(messageId, req.user!._id);
    return sendSuccess(res, null);
  }),
);

/* GET /threads/:entityType/:entityId/patient/messages — patient reads their entity thread */
router.get(
  "/threads/:entityType/:entityId/patient/messages",
  authenticate,
  asyncHandler(async (req, res) => {
    const entityType = req.params["entityType"] as string;
    const entityId   = req.params["entityId"] as string;
    const { limit, before } = paginationSchema.parse(req.query);
    const data = await getPatientEntityMessages(entityType, entityId, { limit, before });
    return sendSuccess(res, data);
  }),
);

export default router;
