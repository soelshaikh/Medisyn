"use client";

import { useRef, useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, MessageCircle, Send } from "lucide-react";
import { patientThreadsApi } from "@/api/threads.api";
import { useAuthStore } from "@/stores/authStore";
import { inputClass } from "@/lib/ui";

interface Props {
  entityType: string;
  entityId:   string;
  title?:     string;
  className?: string;
}

export default function PatientThreadPanel({ entityType, entityId, title = "Messages from Pharmacy", className = "" }: Props) {
  const { user }        = useAuthStore();
  const qc              = useQueryClient();
  const [msgBody, setMsgBody] = useState("");
  const messagesEndRef  = useRef<HTMLDivElement>(null);

  const queryKey = [entityType, "thread", entityId];

  const { data: thread, isLoading } = useQuery({
    queryKey,
    queryFn:         () => patientThreadsApi.getEntityMessages(entityType, entityId),
    enabled:         !!user && !!entityId,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread?.messages?.length]);

  const sendMut = useMutation({
    mutationFn: () => patientThreadsApi.postEntityMessage(entityType, entityId, { body: msgBody.trim() }),
    onSuccess: () => {
      setMsgBody("");
      void qc.invalidateQueries({ queryKey });
    },
  });

  return (
    <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden ${className}`}>
      {/* Header */}
      <div className="border-b border-slate-100 px-6 py-4 flex items-center gap-2">
        <MessageCircle className="h-4 w-4 text-brand-500" />
        <h2 className="font-display text-base font-semibold text-ink-900">{title}</h2>
        {(thread?.messageCount ?? 0) > 0 && (
          <span className="ml-1 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700">
            {thread!.messageCount}
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="px-6 py-4 space-y-3 min-h-[120px] max-h-80 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
          </div>
        ) : !thread?.messages?.length ? (
          <p className="text-center text-sm text-slate-400 py-6">
            No messages yet. Send us a message below if you have any questions.
          </p>
        ) : (
          thread.messages.map((msg) => {
            const isAdmin   = msg.authorRole === "admin" || msg.authorRole === "system";
            const timeLabel = new Date(msg.createdAt).toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit" });
            return (
              <div key={msg._id} className={`flex ${isAdmin ? "justify-start" : "justify-end"}`}>
                <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                  isAdmin
                    ? "bg-slate-100 text-ink-900 rounded-tl-sm"
                    : "bg-brand-600 text-white rounded-tr-sm"
                }`}>
                  {isAdmin && (
                    <p className="mb-0.5 text-xs font-semibold text-brand-600">{msg.authorName}</p>
                  )}
                  <p className="leading-relaxed whitespace-pre-wrap">{msg.body}</p>
                  <p className={`mt-1 text-right text-[10px] ${isAdmin ? "text-slate-400" : "text-brand-200"}`}>
                    {timeLabel}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply box */}
      <div className="border-t border-slate-100 px-6 py-4">
        <textarea
          rows={3}
          value={msgBody}
          onChange={(e) => setMsgBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && msgBody.trim() && !sendMut.isPending) {
              sendMut.mutate();
            }
          }}
          placeholder="Write a message to the pharmacy… (Ctrl+Enter to send)"
          className={inputClass}
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-slate-400">Ctrl+Enter to send</span>
          <button
            type="button"
            onClick={() => sendMut.mutate()}
            disabled={!msgBody.trim() || sendMut.isPending}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            {sendMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send Message
          </button>
        </div>
      </div>
    </div>
  );
}
