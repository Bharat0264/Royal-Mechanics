'use client';
import { useEffect } from 'react';
import { triggerHaptic } from '@/lib/haptics';
export function InternalFeedback() {
  useEffect(() => {
    const invalid = () => triggerHaptic('error');
    const triggerTouchFeedback = () => {
      // Touch feedback is deliberately haptic-only: native and custom flashes
      // are suppressed globally so a tap never paints a circle over the UI.
      triggerHaptic('light');
    };
    const tap = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const control = target.closest<HTMLElement>(
        'button:not(:disabled), a[href], summary, [role="button"], [role="switch"], input[type="checkbox"]:not(:disabled)',
      );
      if (control) triggerTouchFeedback();
    };
    document.addEventListener('invalid', invalid, true);
    document.addEventListener('pointerdown', tap, { passive: true });
    return () => {
      document.removeEventListener('invalid', invalid, true);
      document.removeEventListener('pointerdown', tap);
    };
  }, []);
  return null;
}
