'use client';

import { Button } from './button';
import { Dialog } from './dialog';

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  busy?: boolean;
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirmar',
  onConfirm,
  busy = false,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} description={description}>
      <div className="ui-dialog-actions">
        <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
          Cancelar
        </Button>
        <Button variant="danger" onClick={onConfirm} disabled={busy}>
          {busy ? 'Procesando…' : confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
