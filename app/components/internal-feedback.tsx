'use client';
import Image from 'next/image';
import { useEffect, useState } from 'react';

const vibrate = (pattern: number | number[]) => {
  if ('vibrate' in navigator) navigator.vibrate(pattern);
};

export function InternalFeedback() {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const minimum = window.setTimeout(() => setLoading(false), 380);
    const tap = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('button,a,input,select,summary')) return;
      const button = target.closest('button');
      if (button?.disabled) return;
      vibrate(button?.classList.contains('admin-gold') || button?.classList.contains('gloss-button') ? 24 : 10);
    };
    const change = () => vibrate(10);
    document.addEventListener('click', tap);
    document.addEventListener('change', change);
    return () => { window.clearTimeout(minimum); document.removeEventListener('click', tap); document.removeEventListener('change', change); };
  }, []);
  if (!loading) return null;
  return <div className="brand-loader" aria-label="Loading Royal Mechanics"><div className="brand-loader-ring"><Image src="/royal-mechanics-logo-alpha.png" width={92} height={92} alt="" priority /></div><span>PREPARING THE WORKSHOP</span></div>;
}

export const haptic = { tap: () => vibrate(10), confirm: () => vibrate(25), success: () => vibrate([18, 45, 18]), error: () => vibrate(70), capture: () => vibrate(35) };
