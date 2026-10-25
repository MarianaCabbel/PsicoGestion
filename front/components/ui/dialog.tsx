'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
};

export function Dialog({ open, onOpenChange, title, description, children }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const id = useId();
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      aria-describedby={description ? descriptionId : undefined}
      aria-labelledby={titleId}
      className="ui-dialog"
      onCancel={() => onOpenChange(false)}
      onClose={() => onOpenChange(false)}
      onClick={(event) => {
        if (event.target === dialogRef.current) onOpenChange(false);
      }}
      ref={dialogRef}
    >
      <h2 id={titleId}>{title}</h2>
      {description && <p id={descriptionId}>{description}</p>}
      {children}
    </dialog>
  );
}
