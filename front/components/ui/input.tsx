import type { InputHTMLAttributes } from 'react';

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

export function Input({ label, error, id, className = '', ...props }: InputProps) {
  const inputId = id ?? props.name;
  const errorId = error && inputId ? `${inputId}-error` : undefined;

  return (
    <div className="ui-field">
      <label className="ui-label" htmlFor={inputId}>
        {label}
      </label>
      <input
        className={`ui-input ${className}`.trim()}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        {...props}
      />
      {error && (
        <span className="ui-field-error" id={errorId} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
