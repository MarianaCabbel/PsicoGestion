import type { InputHTMLAttributes, ReactNode } from 'react';

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: ReactNode;
};

export function Checkbox({ label, id, ...props }: CheckboxProps) {
  const inputId = id ?? props.name;

  return (
    <label className="ui-checkbox" htmlFor={inputId}>
      <input id={inputId} type="checkbox" {...props} />
      <span>{label}</span>
    </label>
  );
}
