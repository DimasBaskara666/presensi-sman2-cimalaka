"use client";

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

const emptySubscribe = () => () => {};

export type ConfirmDialogProps = {
  isOpen: boolean;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
  isPending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel = "Konfirmasi",
  cancelLabel = "Batal",
  variant = "danger",
  isPending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const backdropRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const previousActiveElement = document.activeElement as HTMLElement | null;

    // Focus cancel button initially so pressing Enter does not accidentally confirm
    const timer = setTimeout(() => {
      cancelButtonRef.current?.focus();
    }, 16);

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }

      if (event.key === "Tab") {
        const container = dialogRef.current;
        if (!container) return;

        const focusable = container.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );

        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    const backdropElement = backdropRef.current;

    function handleBackdropClick(event: MouseEvent) {
      if (event.target === backdropElement && !isPending) {
        onCancel();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    backdropElement?.addEventListener("click", handleBackdropClick);

    return () => {
      clearTimeout(timer);
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      backdropElement?.removeEventListener("click", handleBackdropClick);
      previousActiveElement?.focus();
    };
  }, [isOpen, isPending, onCancel]);

  if (!isClient || !isOpen || typeof document === "undefined") {
    return null;
  }

  const confirmButtonClass = variant === "danger" ? "button button-danger" : "button button-primary";

  return createPortal(
    <div ref={backdropRef} className="modal-backdrop">
      <div
        ref={dialogRef}
        className="modal-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
      >
        <div className="modal-header">
          <div
            className={`modal-icon ${variant === "danger" ? "modal-icon-danger" : "modal-icon-primary"}`}
            aria-hidden="true"
          >
            {variant === "danger" ? (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10 6v5M10 14.5v.5" strokeLinecap="round" />
                <path d="M8.57 3.235L1.644 15.08A1.667 1.667 0 003.074 17.5h13.852a1.667 1.667 0 001.43-2.42L11.43 3.235a1.667 1.667 0 00-2.86 0z" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="10" cy="10" r="8" />
                <path d="M10 6v5M10 14v.5" strokeLinecap="round" />
              </svg>
            )}
          </div>
          <div>
            <h2 id="confirm-dialog-title" className="modal-title">
              {title}
            </h2>
          </div>
        </div>

        <div id="confirm-dialog-description" className="modal-body">
          {description}
        </div>

        <div className="modal-actions">
          <button
            ref={cancelButtonRef}
            type="button"
            className="button button-secondary"
            disabled={isPending}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={confirmButtonClass}
            disabled={isPending}
            onClick={onConfirm}
          >
            {isPending ? "Memproses..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
