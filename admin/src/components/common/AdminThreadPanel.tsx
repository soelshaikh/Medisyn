"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  MessageCircle, ChevronDown, ChevronUp,
  Reply, Pencil, Trash2, Lock,
  Loader2, Send, X, RotateCcw,
} from "lucide-react";
import {
  useThreadMessages, usePostMessage,
  useEditMessage, useDeleteMessage,
} from "@/hooks/useThreads";
import { threadsApi, type ThreadEntityType, type ThreadChannel, type ThreadMessage } from "@/api/threads.api";
import { useAdminAuthStore } from "@/stores/adminAuthStore";

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
  return d.toLocaleDateString("en-CA", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function fmtTime(iso: string) {
  const d    = new Date(iso);
  let   hrs  = d.getHours();
  const min  = String(d.getMinutes()).padStart(2, "0");
  const ampm = hrs >= 12 ? "PM" : "AM";
  hrs = hrs % 12 || 12;
  return `${hrs}:${min} ${ampm}`;
}

function fmtFullDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-CA", {
    year: "numeric", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

/* ── Tab config ──────────────────────────────────────────────────────────── */

interface TabConfig {
  channel:    ThreadChannel;
  label:      string;
  isInternal: boolean;
}

function getTabConfig(entityType: ThreadEntityType): TabConfig[] {
  if (entityType === "patient") {
    return [
      { channel: "direct",   label: "Direct Chat",    isInternal: false },
      { channel: "internal", label: "Internal Notes", isInternal: true  },
    ];
  }
  return [
    { channel: "patient",  label: "Patient Thread", isInternal: false },
    { channel: "internal", label: "Internal Notes", isInternal: true  },
  ];
}

/* ── Message bubble ──────────────────────────────────────────────────────── */

interface BubbleProps {
  msg:           ThreadMessage;
  isInternal:    boolean;
  isUnread:      boolean;
  currentUserId: string;
  onReply:       (msg: ThreadMessage) => void;
  onEdit:        (msg: ThreadMessage) => void;
  onDelete:      (id: string) => void;
  isDeleting:    boolean;
}

function MessageBubble({ msg, isInternal, isUnread, currentUserId, onReply, onEdit, onDelete, isDeleting }: BubbleProps) {
  const isOwn     = msg.authorId === currentUserId;
  const isDeleted = !!msg.deletedAt;

  const bg = isInternal
    ? "bg-amber-50 border-amber-200"
    : isUnread
    ? "bg-[var(--color-info-light)] border-[var(--color-info)]"
    : "bg-[var(--color-primary-light)] border-[var(--color-border)]";

  return (
    <div className={["rounded-[var(--radius-md)] border px-4 py-3 group relative transition-opacity", bg, isDeleted ? "opacity-50" : ""].join(" ")}>
      {/* Row: author + time + actions */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[var(--font-size-xs)] font-semibold text-[var(--color-text-primary)] truncate">
            {msg.authorName}
            {isOwn && (
              <span className="ml-1 font-normal text-[var(--color-text-muted)]">(You)</span>
            )}
          </span>
          {msg.authorRole === "patient" && (
            <span className="rounded-full bg-[var(--color-info-light)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-info)] shrink-0">
              Patient
            </span>
          )}
          {isUnread && !isDeleted && (
            <span className="rounded-full bg-[var(--color-info)] px-1.5 py-0.5 text-[10px] font-bold text-white shrink-0 uppercase tracking-wide">
              New
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Full timestamp on hover */}
          <span
            className="text-[10px] text-[var(--color-text-muted)] whitespace-nowrap"
            title={fmtFullDateTime(msg.createdAt)}
          >
            {fmtTime(msg.createdAt)}
            {msg.editedAt && <span className="ml-1 italic opacity-70">(edited)</span>}
          </span>

          {/* Hover actions */}
          {!isDeleted && (
            <div className="hidden group-hover:flex items-center gap-0.5">
              <button
                title="Reply to this message"
                onClick={() => onReply(msg)}
                className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-white/70 transition-colors"
              >
                <Reply size={12} />
              </button>
              {isOwn && (
                <>
                  <button
                    title="Edit message"
                    onClick={() => onEdit(msg)}
                    className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-white/70 transition-colors"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    title="Delete message"
                    disabled={isDeleting}
                    onClick={() => onDelete(msg._id)}
                    className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-error)] hover:bg-[var(--color-error-light)] transition-colors disabled:opacity-50"
                  >
                    <Trash2 size={12} />
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Quoted parent */}
      {msg.parentMessage && !isDeleted && (
        <div className="mb-2.5 rounded border-l-2 border-[var(--color-primary)] bg-white/60 px-3 py-1.5">
          <p className="text-[10px] font-semibold text-[var(--color-primary)] mb-0.5">
            ↩ {msg.parentMessage.authorName}
          </p>
          <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)] line-clamp-2 italic leading-relaxed">
            {msg.parentMessage.bodyPreview}
          </p>
        </div>
      )}

      {/* Body */}
      {isDeleted ? (
        <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)] italic">
          This message was deleted.
        </p>
      ) : (
        <p className="text-[var(--font-size-sm)] text-[var(--color-text-primary)] whitespace-pre-wrap break-words leading-relaxed">
          {msg.body}
        </p>
      )}
    </div>
  );
}

/* ── Inline edit form ────────────────────────────────────────────────────── */

interface EditFormProps {
  initialBody: string;
  isInternal:  boolean;
  isPending:   boolean;
  onSave:      (body: string) => void;
  onCancel:    () => void;
}

function InlineEditForm({ initialBody, isInternal, isPending, onSave, onCancel }: EditFormProps) {
  const [body, setBody] = useState(initialBody);

  const bg = isInternal
    ? "bg-amber-50 border-amber-300"
    : "bg-[var(--color-primary-light)] border-[var(--color-primary)]";

  return (
    <div className={["rounded-[var(--radius-md)] border-2 p-3 space-y-2", bg].join(" ")}>
      <p className="text-[var(--font-size-xs)] font-semibold text-[var(--color-primary)]">
        Editing message
      </p>
      <textarea
        autoFocus
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 py-2 text-[var(--font-size-sm)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
      />
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded-[var(--radius-md)] text-[var(--font-size-xs)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!body.trim() || isPending}
          onClick={() => onSave(body)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] text-[var(--font-size-xs)] font-semibold bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)] disabled:opacity-50 transition-colors"
        >
          {isPending && <Loader2 size={11} className="animate-spin" />}
          Save
        </button>
      </div>
    </div>
  );
}

/* ── Date divider ────────────────────────────────────────────────────────── */

function DateDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-1">
      <div className="flex-1 h-px bg-[var(--color-border)]" />
      <span className="text-[10px] font-semibold text-[var(--color-text-muted)] whitespace-nowrap uppercase tracking-wider">
        {label}
      </span>
      <div className="flex-1 h-px bg-[var(--color-border)]" />
    </div>
  );
}

/* ── Props ───────────────────────────────────────────────────────────────── */

export interface AdminThreadPanelProps {
  entityType:   ThreadEntityType;
  entityId:     string;
  defaultOpen?: boolean;
}

/* ── Main panel ──────────────────────────────────────────────────────────── */

export function AdminThreadPanel({ entityType, entityId, defaultOpen = false }: AdminThreadPanelProps) {
  const { user }  = useAdminAuthStore();
  const tabs      = getTabConfig(entityType);

  const [isOpen,       setIsOpen]       = useState(defaultOpen);
  const [activeTabIdx, setActiveTabIdx] = useState(0);
  const [replyingTo,   setReplyingTo]   = useState<ThreadMessage | null>(null);
  const [body,         setBody]         = useState("");
  const [editingId,    setEditingId]    = useState<string | null>(null);
  const [deletingId,   setDeletingId]   = useState<string | null>(null);
  const [localReadIds, setLocalReadIds] = useState(() => new Set<string>());

  const activeTab  = tabs[activeTabIdx];
  const textareaRef  = useRef<HTMLTextAreaElement>(null);
  const bottomRef    = useRef<HTMLDivElement>(null);

  const { data, isLoading, refetch } = useThreadMessages(entityType, entityId, activeTab.channel);
  const postMut   = usePostMessage(entityType, entityId, activeTab.channel);
  const editMut   = useEditMessage(entityType, entityId, activeTab.channel);
  const deleteMut = useDeleteMessage(entityType, entityId, activeTab.channel);

  const messages = data?.messages ?? [];

  /* A message is unread if it came from a patient and this admin hasn't read it */
  const isUnreadMsg = useCallback((msg: ThreadMessage): boolean => {
    if (msg.authorRole !== "patient" || !!msg.deletedAt) return false;
    if (localReadIds.has(msg._id)) return false;
    return !msg.readBy.some((r) => r.userId === (user?.id ?? ""));
  }, [localReadIds, user?.id]);

  const unreadCount = messages.filter(isUnreadMsg).length;

  /* Auto-mark unread patient messages as read when panel is open on the patient tab */
  useEffect(() => {
    if (!isOpen || activeTab.channel === "internal" || !user?.id) return;
    const userId = user.id;
    const unread = messages.filter((m) => {
      if (m.authorRole !== "patient" || !!m.deletedAt) return false;
      if (localReadIds.has(m._id)) return false;
      return !m.readBy.some((r) => r.userId === userId);
    });
    if (!unread.length) return;
    const ids = unread.map((m) => m._id);
    setLocalReadIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
    ids.forEach((id) => void threadsApi.markRead(id));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, messages.length, activeTabIdx, user?.id]);

  /* Scroll to bottom on open / new messages */
  useEffect(() => {
    if (isOpen) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isOpen, activeTabIdx]);

  /* Focus compose when reply set */
  useEffect(() => {
    if (replyingTo) textareaRef.current?.focus();
  }, [replyingTo]);

  /* Reset compose on tab switch */
  function switchTab(i: number) {
    setActiveTabIdx(i);
    setReplyingTo(null);
    setBody("");
    setEditingId(null);
  }

  /* Send */
  function handleSend() {
    const trimmed = body.trim();
    if (!trimmed || postMut.isPending) return;
    postMut.mutate(
      { body: trimmed, parentMessageId: replyingTo?._id ?? undefined },
      { onSuccess: () => { setBody(""); setReplyingTo(null); } },
    );
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  }

  /* Edit */
  function handleEditSave(messageId: string, newBody: string) {
    editMut.mutate(
      { messageId, body: newBody },
      { onSuccess: () => setEditingId(null) },
    );
  }

  /* Delete */
  async function handleDelete(msgId: string) {
    if (!window.confirm("Delete this message? It will be soft-deleted and show as removed.")) return;
    setDeletingId(msgId);
    try {
      await deleteMut.mutateAsync(msgId);
    } finally {
      setDeletingId(null);
    }
  }

  /* Header summary */
  const count = data?.messageCount ?? 0;
  const headerSummary = count === 0
    ? "No messages"
    : `${count} ${count === 1 ? "message" : "messages"}`
    + (unreadCount > 0 ? ` · ${unreadCount} unread` : "");

  const sendLabel = activeTab.isInternal
    ? "Add Note"
    : activeTab.channel === "direct"
    ? "Send Message"
    : "Send to Patient";

  /* ── Render ── */
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white shadow-[var(--shadow-sm)] overflow-hidden">

      {/* ── Collapsed header ── */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-[var(--color-surface)] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <MessageCircle size={16} className="text-[var(--color-primary)] shrink-0" />
          <span className="text-[var(--font-size-sm)] font-semibold text-[var(--color-text-primary)]">
            Communications
          </span>
          <span className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">
            {headerSummary}
          </span>
          {unreadCount > 0 && !isOpen && (
            <span className="rounded-full bg-[var(--color-error)] px-1.5 py-0.5 text-[10px] font-bold text-white">
              {unreadCount} new
            </span>
          )}
        </div>
        {isOpen
          ? <ChevronUp  size={15} className="text-[var(--color-text-muted)] shrink-0" />
          : <ChevronDown size={15} className="text-[var(--color-text-muted)] shrink-0" />}
      </button>

      {isOpen && (
        <>
          {/* ── Tabs ── */}
          <div className="flex border-b border-[var(--color-border)] bg-[var(--color-surface)]">
            {tabs.map((tab, i) => (
              <button
                key={tab.channel}
                type="button"
                onClick={() => switchTab(i)}
                className={[
                  "flex items-center gap-1.5 px-4 py-2.5 text-[var(--font-size-sm)] font-medium border-b-2 transition-colors",
                  activeTabIdx === i
                    ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                    : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
                ].join(" ")}
              >
                {tab.isInternal && <Lock size={12} />}
                {tab.label}
                {!tab.isInternal && unreadCount > 0 && activeTabIdx !== i && (
                  <span className="rounded-full bg-[var(--color-error)] px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {unreadCount}
                  </span>
                )}
                {activeTabIdx === i && count > 0 && (
                  <span className="rounded-full bg-[var(--color-primary-light)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-primary)]">
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── Internal notes warning banner ── */}
          {activeTab.isInternal && (
            <div className="flex items-center gap-2 px-5 py-2 bg-amber-50 border-b border-amber-200">
              <Lock size={11} className="text-amber-600 shrink-0" />
              <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide">
                Staff only — never visible to patient
              </p>
            </div>
          )}

          {/* ── Message list ── */}
          <div className="px-5 py-4 max-h-[440px] overflow-y-auto flex flex-col gap-2.5">
            {isLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 size={20} className="animate-spin text-[var(--color-text-muted)]" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <MessageCircle size={28} className="text-[var(--color-border)]" />
                <p className="text-[var(--font-size-sm)] text-[var(--color-text-muted)]">
                  No messages yet.
                </p>
                <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">
                  {activeTab.isInternal ? "Add the first internal note below." : "Send the first message below."}
                </p>
              </div>
            ) : (
              <>
                {/* Load earlier */}
                {data?.hasMore && (
                  <button
                    type="button"
                    onClick={() => void refetch()}
                    className="self-center flex items-center gap-1.5 text-[var(--font-size-xs)] text-[var(--color-primary)] hover:underline"
                  >
                    <RotateCcw size={11} /> Load earlier messages
                  </button>
                )}

                {messages.map((msg, idx) => {
                  const showDate = idx === 0 || !isSameDay(messages[idx - 1].createdAt, msg.createdAt);
                  const isEditing = editingId === msg._id;

                  return (
                    <div key={msg._id}>
                      {showDate && <DateDivider label={fmtDateDivider(msg.createdAt)} />}

                      {isEditing ? (
                        <InlineEditForm
                          initialBody={msg.body}
                          isInternal={activeTab.isInternal}
                          isPending={editMut.isPending}
                          onSave={(newBody) => handleEditSave(msg._id, newBody)}
                          onCancel={() => setEditingId(null)}
                        />
                      ) : (
                        <MessageBubble
                          msg={msg}
                          isInternal={activeTab.isInternal}
                          isUnread={isUnreadMsg(msg)}
                          currentUserId={user?.id ?? ""}
                          onReply={setReplyingTo}
                          onEdit={(m) => setEditingId(m._id)}
                          onDelete={handleDelete}
                          isDeleting={deletingId === msg._id}
                        />
                      )}
                    </div>
                  );
                })}

                <div ref={bottomRef} />
              </>
            )}
          </div>

          {/* ── Compose area ── */}
          <div className="border-t border-[var(--color-border)] px-5 py-4 space-y-3 bg-[var(--color-surface)]">

            {/* Reply-to banner */}
            {replyingTo && (
              <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--color-primary)] bg-[var(--color-primary-light)] px-3 py-2">
                <Reply size={12} className="text-[var(--color-primary)] mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-[var(--color-primary)]">
                    Replying to {replyingTo.authorName}
                  </p>
                  <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)] truncate italic mt-0.5">
                    {replyingTo.body.length > 100 ? replyingTo.body.slice(0, 100) + "…" : replyingTo.body}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyingTo(null)}
                  className="text-[var(--color-text-muted)] hover:text-[var(--color-error)] transition-colors shrink-0 mt-0.5"
                >
                  <X size={13} />
                </button>
              </div>
            )}

            <textarea
              ref={textareaRef}
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                activeTab.isInternal
                  ? "Add an internal staff note… (Ctrl+Enter to send)"
                  : activeTab.channel === "direct"
                  ? "Message the patient directly… (Ctrl+Enter to send)"
                  : "Write a message to the patient… (Ctrl+Enter to send)"
              }
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-[var(--font-size-sm)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-shadow"
            />

            <div className="flex items-center justify-between">
              <p className="text-[10px] text-[var(--color-text-muted)]">
                Ctrl+Enter to send
              </p>
              <button
                type="button"
                disabled={!body.trim() || postMut.isPending}
                onClick={handleSend}
                className="flex items-center gap-1.5 px-4 py-2 rounded-[var(--radius-md)] text-[var(--font-size-sm)] font-semibold bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {postMut.isPending
                  ? <Loader2 size={13} className="animate-spin" />
                  : <Send size={13} />}
                {sendLabel}
              </button>
            </div>

            {postMut.isError && (
              <p className="text-[var(--font-size-xs)] text-[var(--color-error)]">
                Failed to send. Please try again.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
