import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { threadsApi, type ThreadEntityType, type ThreadChannel } from "@/api/threads.api";

function key(entityType: ThreadEntityType, entityId: string, channel: ThreadChannel) {
  return ["threads", entityType, entityId, channel] as const;
}

export function useThreadMessages(
  entityType: ThreadEntityType,
  entityId:   string,
  channel:    ThreadChannel,
  opts?:      { limit?: number; before?: string },
) {
  return useQuery({
    queryKey: key(entityType, entityId, channel),
    queryFn:  () => threadsApi.getMessages(entityType, entityId, channel, { limit: 50, ...opts }),
    enabled:  !!entityId,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function usePostMessage(
  entityType: ThreadEntityType,
  entityId:   string,
  channel:    ThreadChannel,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { body: string; parentMessageId?: string }) =>
      threadsApi.postMessage(entityType, entityId, channel, payload),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: key(entityType, entityId, channel) }),
  });
}

export function useEditMessage(
  entityType: ThreadEntityType,
  entityId:   string,
  channel:    ThreadChannel,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, body }: { messageId: string; body: string }) =>
      threadsApi.editMessage(messageId, body),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: key(entityType, entityId, channel) }),
  });
}

export function useDeleteMessage(
  entityType: ThreadEntityType,
  entityId:   string,
  channel:    ThreadChannel,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (messageId: string) => threadsApi.deleteMessage(messageId),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: key(entityType, entityId, channel) }),
  });
}
