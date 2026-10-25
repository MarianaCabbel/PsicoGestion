import type { SelectHTMLAttributes } from 'react';

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
  children: React.ReactNode;
};

export function Select({ label, error, id, className = '', children, ...props }: SelectProps) {
  const selectId = id ?? props.name;
  const errorId = error && selectId ? `${selectId}-error` : undefined;

  return (
    <div className="ui-field">
      <label className="ui-label" htmlFor={selectId}>
        {label}
      </label>
      <select
        className={`ui-select ${className}`.trim()}
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        {...props}
      >
        {children}
      </select>
      {error && (
        <span className="ui-field-error" id={errorId} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
