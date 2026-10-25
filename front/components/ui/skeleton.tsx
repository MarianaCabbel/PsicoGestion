import type { HTMLAttributes } from 'react';

export function Skeleton({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={`ui-skeleton ${className}`.trim()} {...props} />;
}
