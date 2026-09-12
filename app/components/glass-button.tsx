import type { ComponentPropsWithoutRef } from 'react';

/** Shared interactive liquid-glass control for portal actions and filters. */
export function GlassButton({ className = '', ...props }: ComponentPropsWithoutRef<'button'>) {
  return <button {...props} className={`glass-button ${className}`} />;
}
