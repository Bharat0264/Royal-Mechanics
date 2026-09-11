'use client';
import { useEffect } from 'react';
import { triggerHaptic } from '@/lib/haptics';
export function InternalFeedback() {
  useEffect(() => {
    const invalid = () => triggerHaptic('error');
    const click = (event: MouseEvent) => {
      if ((event.target as Element)?.closest('a,button,summary'))
        triggerHaptic('light');
    };
    const change = (event: Event) => {
      if ((event.target as Element)?.matches('input[type="checkbox"]'))
        triggerHaptic('medium');
    };
    const submit = () => triggerHaptic('medium');
    document.addEventListener('invalid', invalid, true);
    document.addEventListener('click', click);
    document.addEventListener('change', change);
    document.addEventListener('submit', submit);
    return () => {
      document.removeEventListener('invalid', invalid, true);
      document.removeEventListener('click', click);
      document.removeEventListener('change', change);
      document.removeEventListener('submit', submit);
    };
  }, []);
  return null;
}
