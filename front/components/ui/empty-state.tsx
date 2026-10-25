import type { ReactNode } from 'react';

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="ui-empty-state" role="status">
      <svg aria-hidden="true" className="ui-empty-illustration" fill="none" viewBox="0 0 88 72">
        <path
          d="M8 18.5a6.5 6.5 0 0 1 6.5-6.5h18l7 7H73.5a6.5 6.5 0 0 1 6.5 6.5v31a6.5 6.5 0 0 1-6.5 6.5h-59a6.5 6.5 0 0 1-6.5-6.5v-38Z"
          fill="currentColor"
          opacity=".12"
        />
        <path
          d="M8 27h72l-7.3 29.2a8 8 0 0 1-7.76 6.05H16.06a8 8 0 0 1-7.76-6.05L8 27Z"
          stroke="currentColor"
          strokeWidth="3"
        />
        <circle cx="44" cy="42" r="10" stroke="currentColor" strokeWidth="3" />
        <path d="M44 37v6m0 4h.02" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
      </svg>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
