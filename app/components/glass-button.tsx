import type { ComponentPropsWithoutRef } from 'react';

/** A compact control which inherits the admin portal's shared glass material. */
export function GlassButton({
  className = '',
  ...props
}: ComponentPropsWithoutRef<'button'>) {
  return <button {...props} className={`glass-button ${className}`} />;
}
