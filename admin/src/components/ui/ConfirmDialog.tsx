"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { Button } from "./Button";

interface ConfirmDialogProps {
  open:          boolean;
  onClose:       () => void;
  onConfirm:     () => void;
  title:         string;
  description?:  string;
  confirmLabel?: string;
  cancelLabel?:  string;
  loading?:      boolean;
  destructive?:  boolean;
}

export function ConfirmDialog({
  open, onClose, onConfirm,
  title, description,
  confirmLabel = "Confirm",
  cancelLabel  = "Cancel",
  loading,
  destructive  = false,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[var(--z-overlay)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <AlertDialog.Content
          className={[
            "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
            "z-[var(--z-modal)] bg-white rounded-[var(--radius-xl)] shadow-[var(--shadow-xl)]",
            "w-full max-w-md p-6 outline-none",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          ].join(" ")}
        >
          <AlertDialog.Title className="text-[var(--font-size-lg)] font-semibold text-[var(--color-text-primary)] mb-2">
            {title}
          </AlertDialog.Title>
          {description && (
            <AlertDialog.Description className="text-[var(--font-size-sm)] text-[var(--color-text-secondary)]">
              {description}
            </AlertDialog.Description>
          )}
          <div className="flex gap-3 justify-end mt-6">
            <AlertDialog.Cancel asChild>
              <Button variant="ghost" onClick={onClose}>{cancelLabel}</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button
                variant={destructive ? "danger" : "primary"}
                loading={loading}
                onClick={onConfirm}
              >
                {confirmLabel}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
