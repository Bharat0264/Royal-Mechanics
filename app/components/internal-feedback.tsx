'use client';
import { useEffect } from 'react';
import { triggerHaptic } from '@/lib/haptics';
export function InternalFeedback() {
  useEffect(() => {
    const invalid = () => triggerHaptic('error');
    const tap = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const control = target.closest<HTMLElement>(
        'button:not(:disabled), a[href], summary, [role="button"], [role="switch"], input[type="checkbox"]:not(:disabled)',
      );
      if (control) {
        const bounds = control.getBoundingClientRect();
        control.style.setProperty('--ripple-x', `${event.clientX - bounds.left}px`);
        control.style.setProperty('--ripple-y', `${event.clientY - bounds.top}px`);
        control.classList.remove('liquid-ripple');
        requestAnimationFrame(() => control.classList.add('liquid-ripple'));
        triggerHaptic('light');
      }
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
