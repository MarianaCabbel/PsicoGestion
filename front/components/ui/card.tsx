import type { HTMLAttributes } from 'react';

type CardProps = HTMLAttributes<HTMLElement>;

export function Card({ className = '', ...props }: CardProps) {
  return <section className={`ui-card ${className}`.trim()} {...props} />;
}

export function CardHeader({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <header className={`ui-card-header ${className}`.trim()} {...props} />;
}

export function CardContent({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`ui-card-content ${className}`.trim()} {...props} />;
}
