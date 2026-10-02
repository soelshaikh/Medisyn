import { apiClient } from "@/lib/apiClient";

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
  channel:      string;
  messageCount: number;
  messages:     ThreadMessage[];
  hasMore:      boolean;
}

export const patientThreadsApi = {
  /* GET /threads/my/messages — patient's direct thread with pharmacy */
  getMyMessages: (opts?: { limit?: number; before?: string }) =>
    apiClient
      .get<{ data: ThreadResult }>("/threads/my/messages", { params: opts })
      .then((r) => r.data.data),

  /* POST /threads/my/messages */
  postMessage: (payload: { body: string; parentMessageId?: string }) =>
    apiClient
      .post<{ data: ThreadMessage }>("/threads/my/messages", payload)
      .then((r) => r.data.data),

  /* POST /threads/my/messages/:id/read */
  markRead: (messageId: string) =>
    apiClient.post(`/threads/my/messages/${messageId}/read`),
};
