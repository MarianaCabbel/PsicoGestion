'use client';

import { MoreHorizontal } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

export type ActionMenuItem = {
  label: string;
  onSelect: () => void;
  variant?: 'default' | 'danger';
  disabled?: boolean;
};

/**
 * Menú de acciones compacto (botón de tres puntos). El popover usa posición fija
 * para no quedar recortado por contenedores con overflow, como las tablas.
 */
export function ActionMenu({ label, items }: { label: string; items: ActionMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, right: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const close = useCallback((focusTrigger = false) => {
    setOpen(false);
    if (focusTrigger) triggerRef.current?.focus();
  }, []);

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      const estimatedHeight = items.length * 38 + 12;
      const spaceBelow = window.innerHeight - rect.bottom;
      setPosition({
        top:
          spaceBelow < estimatedHeight
            ? Math.max(8, rect.top - estimatedHeight - 6)
            : rect.bottom + 6,
        right: Math.max(8, window.innerWidth - rect.right),
      });
    }
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      close(true);
    }

    function handleViewportChange() {
      setOpen(false);
    }

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [close, open]);

  return (
    <div className="ui-action-menu">
      <button
        aria-controls={open ? menuId : undefined}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        className="ui-action-trigger"
        onClick={toggle}
        ref={triggerRef}
        type="button"
      >
        <MoreHorizontal aria-hidden="true" size={18} />
      </button>
      {open && (
        <div
          aria-label={label}
          className="ui-action-popover"
          id={menuId}
          ref={menuRef}
          role="menu"
          style={{ position: 'fixed', top: position.top, right: position.right }}
        >
          {items.map((item) => (
            <button
              className={`ui-action-item${item.variant === 'danger' ? ' ui-action-item--danger' : ''}`}
              disabled={item.disabled}
              key={item.label}
              onClick={() => {
                close();
                item.onSelect();
              }}
              role="menuitem"
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
