import apiClient from "@/lib/apiClient";

export type ThreadEntityType =
  | "prescription"
  | "order"
  | "ask_pharmacist"
  | "minor_ailment"
  | "compounding"
  | "appointment"
  | "patient";

export type ThreadChannel = "patient" | "internal" | "direct";

export interface ThreadMessage {
  _id:             string;
  parentMessageId: string | null;
  parentMessage:   { authorName: string; bodyPreview: string } | null;
  authorId:        string;
  authorName:      string;
  authorRole:      "admin" | "patient" | "system";
  body:            string;
  readBy:          Array<{ userId: string; readAt: string }>;
  editedAt:        string | null;
  deletedAt:       string | null;
  createdAt:       string;
}

export interface ThreadResult {
  threadId:     string;
  channel:      ThreadChannel;
  messageCount: number;
  messages:     ThreadMessage[];
  hasMore:      boolean;
}

export interface ThreadSummary {
  _id:                string;
  entityType:         ThreadEntityType;
  entityId:           string;
  channel:            ThreadChannel;
  messageCount:       number;
  lastMessageAt:      string | null;
  lastMessagePreview: string;
}

const BASE = "";

export const threadsApi = {
  getSummary: (entityType: ThreadEntityType, entityId: string) =>
    apiClient
      .get<{ data: ThreadSummary[] }>(`${BASE}/admin/threads/${entityType}/${entityId}`)
      .then((r) => r.data.data),

  getMessages: (
    entityType: ThreadEntityType,
    entityId:   string,
    channel:    ThreadChannel,
    opts?:      { limit?: number; before?: string },
  ) =>
    apiClient
      .get<{ data: ThreadResult }>(
        `${BASE}/admin/threads/${entityType}/${entityId}/${channel}/messages`,
        { params: opts },
      )
      .then((r) => r.data.data),

  postMessage: (
    entityType: ThreadEntityType,
    entityId:   string,
    channel:    ThreadChannel,
    payload:    { body: string; parentMessageId?: string },
  ) =>
    apiClient
      .post<{ data: ThreadMessage }>(
        `${BASE}/admin/threads/${entityType}/${entityId}/${channel}/messages`,
        payload,
      )
      .then((r) => r.data.data),

  editMessage: (messageId: string, body: string) =>
    apiClient
      .patch<{ data: ThreadMessage }>(`${BASE}/admin/threads/messages/${messageId}`, { body })
      .then((r) => r.data.data),

  deleteMessage: (messageId: string) =>
    apiClient
      .delete<{ data: ThreadMessage }>(`${BASE}/admin/threads/messages/${messageId}`)
      .then((r) => r.data.data),

  markRead: (messageId: string) =>
    apiClient.post(`${BASE}/admin/threads/messages/${messageId}/read`),
};
