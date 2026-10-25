import type { HTMLAttributes } from 'react';

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: 'default' | 'success' | 'warning' | 'danger';
};

export function Badge({ variant = 'default', className = '', ...props }: BadgeProps) {
  return <span className={`ui-badge ui-badge--${variant} ${className}`.trim()} {...props} />;
}
