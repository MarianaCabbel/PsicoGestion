'use client';

import { useState, type ReactNode } from 'react';

export type TabItem = {
  id: string;
  label: string;
  content: ReactNode;
};

export function Tabs({
  items,
  defaultValue,
  ariaLabel,
}: {
  items: TabItem[];
  defaultValue?: string;
  ariaLabel: string;
}) {
  const [active, setActive] = useState(defaultValue ?? items[0]?.id ?? '');
  const selected = items.find((item) => item.id === active) ?? items[0];

  return (
    <div className="ui-tabs">
      <div
        className="ui-tab-list"
        onKeyDown={(event) => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          const buttons = Array.from(
            event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
          );
          if (!(event.target instanceof HTMLButtonElement)) return;
          const currentIndex = buttons.indexOf(event.target);
          const nextIndex =
            event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? buttons.length - 1
                : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) %
                  buttons.length;
          const nextTab = buttons[nextIndex];
          if (!nextTab) return;
          event.preventDefault();
          setActive(nextTab.id.replace(/^tab-/, ''));
          nextTab.focus();
        }}
        role="tablist"
        aria-label={ariaLabel}
      >
        {items.map((item) => (
          <button
            aria-controls={`panel-${item.id}`}
            aria-selected={item.id === active}
            className="ui-tab"
            id={`tab-${item.id}`}
            key={item.id}
            onClick={() => setActive(item.id)}
            role="tab"
            tabIndex={item.id === active ? 0 : -1}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>
      {selected && (
        <div
          aria-labelledby={`tab-${selected.id}`}
          className="ui-tab-panel"
          id={`panel-${selected.id}`}
          role="tabpanel"
        >
          {selected.content}
        </div>
      )}
    </div>
  );
}
