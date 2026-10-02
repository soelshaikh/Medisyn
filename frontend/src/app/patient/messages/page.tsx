"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, MessageCircle, Reply, Send, X, RotateCcw } from "lucide-react";
import { patientThreadsApi, type ThreadMessage } from "@/api/threads.api";
import { useAuthStore } from "@/stores/authStore";

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function isSameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

function fmtDateDivider(iso: string) {
  const d = new Date(iso);
  const today     = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString())     return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function fmtTime(iso: string) {
  const d    = new Date(iso);
  let   hrs  = d.getHours();
  const min  = String(d.getMinutes()).padStart(2, "0");
  const ampm = hrs >= 12 ? "PM" : "AM";
  hrs = hrs % 12 || 12;
  return `${hrs}:${min} ${ampm}`;
}

/* ── Message bubble ──────────────────────────────────────────────────────── */

interface BubbleProps {
  msg:           ThreadMessage;
  currentUserId: string;
  onReply:       (msg: ThreadMessage) => void;
}

function MessageBubble({ msg, currentUserId, onReply }: BubbleProps) {
  const isOwn     = msg.authorId === currentUserId;
  const isDeleted = !!msg.deletedAt;
  const isAdmin   = msg.authorRole === "admin" || msg.authorRole === "system";

  return (
    <div className={["flex gap-3", isOwn ? "flex-row-reverse" : "flex-row"].join(" ")}>
      {/* Avatar */}
      <div className={[
        "shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
        isAdmin ? "bg-brand-100 text-brand-700" : "bg-slate-200 text-slate-600",
      ].join(" ")}>
        {msg.authorName.charAt(0).toUpperCase()}
      </div>

      {/* Bubble */}
      <div className={["max-w-[75%] group", isOwn ? "items-end" : "items-start", "flex flex-col gap-1"].join(" ")}>
        {/* Author + time */}
        <div className={["flex items-center gap-2 text-xs text-slate-400", isOwn ? "flex-row-reverse" : "flex-row"].join(" ")}>
          <span className="font-medium text-slate-600">{isOwn ? "You" : msg.authorName}</span>
          <span title={new Date(msg.createdAt).toLocaleString("en-CA")}>{fmtTime(msg.createdAt)}</span>
          {msg.editedAt && <span className="italic opacity-70">(edited)</span>}
        </div>

        {/* Quoted parent */}
        {msg.parentMessage && !isDeleted && (
          <div className="rounded-lg border-l-2 border-brand-400 bg-slate-50 px-3 py-1.5 mb-1">
            <p className="text-[10px] font-semibold text-brand-600 mb-0.5">
              ↩ {msg.parentMessage.authorName}
            </p>
            <p className="text-xs text-slate-500 line-clamp-2 italic">
              {msg.parentMessage.bodyPreview}
            </p>
          </div>
        )}

        {/* Message body */}
        <div className={[
          "relative rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          isOwn
            ? "bg-brand-600 text-white rounded-tr-sm"
            : "bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm",
          isDeleted ? "opacity-50" : "",
        ].join(" ")}>
          {isDeleted ? (
            <span className="italic opacity-70">This message was deleted.</span>
          ) : (
            <p className="whitespace-pre-wrap break-words">{msg.body}</p>
          )}
        </div>

        {/* Reply button — show on hover */}
        {!isDeleted && (
          <button
            type="button"
            onClick={() => onReply(msg)}
            className="hidden group-hover:flex items-center gap-1 text-[10px] text-slate-400 hover:text-brand-600 transition-colors"
          >
            <Reply size={11} /> Reply
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function PatientMessagesPage() {
  const { user } = useAuthStore();
  const qc       = useQueryClient();

  const [body,       setBody]       = useState("");
  const [replyingTo, setReplyingTo] = useState<ThreadMessage | null>(null);
  const bottomRef   = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data, isLoading } = useQuery({
    queryKey:  ["patient-messages"],
    queryFn:   () => patientThreadsApi.getMyMessages({ limit: 50 }),
    enabled:   !!user,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const postMut = useMutation({
    mutationFn: (payload: { body: string; parentMessageId?: string }) =>
      patientThreadsApi.postMessage(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["patient-messages"] });
      setBody("");
      setReplyingTo(null);
    },
  });

  const messages = data?.messages ?? [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    if (replyingTo) textareaRef.current?.focus();
  }, [replyingTo]);

  function handleSend() {
    const trimmed = body.trim();
    if (!trimmed || postMut.isPending) return;
    postMut.mutate({ body: trimmed, parentMessageId: replyingTo?._id ?? undefined });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-2xl">
      {/* Header */}
      <div className="mb-4">
        <h1 className="font-display text-2xl font-bold text-ink-900">Messages</h1>
        <p className="mt-1 text-sm text-slate-600">
          Direct conversation with your pharmacy team.
        </p>
      </div>

      {/* Chat window */}
      <div className="flex-1 flex flex-col rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden shadow-sm">
        {/* Chat header */}
        <div className="flex items-center gap-3 px-5 py-3.5 bg-white border-b border-slate-100">
          <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center">
            <MessageCircle className="h-4 w-4 text-brand-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink-900">MediSyn Pharmacy</p>
            <p className="text-xs text-slate-400">Your pharmacy team</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {isLoading ? (
            <div className="flex justify-center pt-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center gap-3 pt-12 text-center">
              <MessageCircle className="h-10 w-10 text-slate-200" />
              <p className="text-sm font-medium text-slate-500">No messages yet</p>
              <p className="text-xs text-slate-400">
                Send a message below to start a conversation with your pharmacy team.
              </p>
            </div>
          ) : (
            <>
              {data?.hasMore && (
                <button
                  type="button"
                  onClick={() => qc.invalidateQueries({ queryKey: ["patient-messages"] })}
                  className="self-center w-full flex items-center justify-center gap-1.5 py-2 text-xs text-brand-600 hover:underline"
                >
                  <RotateCcw className="h-3 w-3" /> Load earlier messages
                </button>
              )}

              {messages.map((msg, idx) => {
                const showDate = idx === 0 || !isSameDay(messages[idx - 1].createdAt, msg.createdAt);
                return (
                  <div key={msg._id}>
                    {showDate && (
                      <div className="flex items-center gap-3 my-3">
                        <div className="flex-1 h-px bg-slate-200" />
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                          {fmtDateDivider(msg.createdAt)}
                        </span>
                        <div className="flex-1 h-px bg-slate-200" />
                      </div>
                    )}
                    <MessageBubble
                      msg={msg}
                      currentUserId={user?.id ?? ""}
                      onReply={setReplyingTo}
                    />
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </>
          )}
        </div>

        {/* Compose */}
        <div className="bg-white border-t border-slate-100 px-4 py-3 space-y-2">
          {/* Reply banner */}
          {replyingTo && (
            <div className="flex items-start gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2">
              <Reply className="h-3.5 w-3.5 text-brand-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold text-brand-600">
                  Replying to {replyingTo.authorRole === "admin" ? replyingTo.authorName : "yourself"}
                </p>
                <p className="text-xs text-slate-500 truncate italic mt-0.5">
                  {replyingTo.body.length > 80 ? replyingTo.body.slice(0, 80) + "…" : replyingTo.body}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReplyingTo(null)}
                className="text-slate-400 hover:text-red-400 transition-colors shrink-0"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <div className="flex items-end gap-3">
            <textarea
              ref={textareaRef}
              rows={2}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message… (Ctrl+Enter to send)"
              className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-ink-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow"
            />
            <button
              type="button"
              disabled={!body.trim() || postMut.isPending}
              onClick={handleSend}
              className="shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Send (Ctrl+Enter)"
            >
              {postMut.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Send className="h-4 w-4" />}
            </button>
          </div>

          {postMut.isError && (
            <p className="text-xs text-red-500">Failed to send. Please try again.</p>
          )}
        </div>
      </div>
    </div>
  );
}
