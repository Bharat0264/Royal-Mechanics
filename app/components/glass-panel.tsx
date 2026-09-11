import type { ComponentPropsWithoutRef } from 'react';
import './internal-portals.css';
export function GlassPanel({
  className = '',
  ...props
}: ComponentPropsWithoutRef<'section'>) {
  return <section {...props} className={`glass-panel ${className}`} />;
}
