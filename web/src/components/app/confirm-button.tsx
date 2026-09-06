"use client";

import { useEffect, useId, useRef } from "react";

/**
 * Ask before destroying something.
 *
 * Deletes were inconsistent: a saved offer and a draft campaign asked with an
 * inline "are you sure", a service and a reason went the moment the cross was
 * clicked, and a cross is a very easy thing to hit by accident on a row you did
 * not mean to touch. One component so every delete in the product asks the same
 * way and reads the same.
 *
 * A native <dialog> rather than a div: the browser gives modal behaviour,
 * focus trapping, Escape to cancel and the top layer for free, and all of that
 * is a lot of code to get subtly wrong by hand.
 *
 * Two ways to confirm, because there are two kinds of delete here. Client-side
 * removals (a service that has not been saved yet) pass onConfirm. Server
 * actions pass formId and the confirm button submits that form from inside the
 * dialog, which keeps the action, its pending state and its errors exactly
 * where they already were.
 */
export function ConfirmButton({
  children,
  ariaLabel,
  title,
  body,
  confirmLabel = "Delete permanently",
  cancelLabel = "Keep it",
  onConfirm,
  formId,
  disabled,
  className,
}: {
  /** What the trigger looks like. */
  children: React.ReactNode;
  ariaLabel?: string;
  title: string;
  /** One or two sentences on what is about to be lost, and what is not. */
  body: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  /** id of a <form> whose action should run on confirm. */
  formId?: string;
  disabled?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  // A dialog left open while the row under it disappears would strand the
  // page in a modal with nothing behind it.
  useEffect(() => {
    const dialog = ref.current;
    return () => dialog?.close();
  }, []);

  return (
    <>
      <button
        type="button"
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => ref.current?.showModal()}
        className={className}
      >
        {children}
      </button>

      <dialog
        ref={ref}
        aria-labelledby={titleId}
        className="confirm-dialog"
        onClick={(event) => {
          // Clicking the backdrop is a cancel. The dialog element reports the
          // backdrop as a click on itself, so anything on a child is not one.
          if (event.target === ref.current) ref.current?.close();
        }}
      >
        <h2 id={titleId} className="display mb-2 text-[1.125rem] text-ink">
          {title}
        </h2>
        <div className="mb-5 text-[0.9375rem] leading-relaxed text-graphite">
          {body}
        </div>
        <div className="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={() => ref.current?.close()}
            className="rounded-md px-3 py-2 text-[0.9375rem] text-stone hover:text-ink"
          >
            {cancelLabel}
          </button>
          <button
            type={formId ? "submit" : "button"}
            form={formId}
            onClick={() => {
              onConfirm?.();
              ref.current?.close();
            }}
            className="rounded-md bg-[var(--danger)] px-3.5 py-2 text-[0.9375rem] font-medium text-white"
          >
            {confirmLabel}
          </button>
        </div>
      </dialog>
    </>
  );
}
