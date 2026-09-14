'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import './loader.css';
let fullStarted = 0;
export function remainingFullLoaderTime() {
  fullStarted ||= Date.now();
  return Math.max(0, 300 - (Date.now() - fullStarted));
}
export function finishFullLoader() { fullStarted = 0; }

export function useMinimumBusy(initial = false) {
  const [busy, update] = useState(initial);
  const started = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const setBusy = useCallback((value: boolean) => {
    clearTimeout(timer.current);
    if (value) {
      started.current = Date.now();
      update(true);
    } else
      timer.current = setTimeout(
        () => update(false),
        Math.max(0, 300 - (Date.now() - started.current)),
      );
  }, []);
  return [busy, setBusy] as const;
}
export function Loader({
  size = 'button',
  label = 'Loading',
}: {
  size?: 'full' | 'button' | 'skeleton';
  label?: string;
}) {
  useEffect(() => { if (size === 'full') remainingFullLoaderTime(); }, [size]);
  return (
    <output
      className={`rm-loader rm-loader-${size}`}
      aria-label={label}
    >
      {size !== 'skeleton' && (
        <svg viewBox="0 0 80 88" fill="none" aria-hidden="true">
          <path
            className="crest-outline"
            pathLength="100"
            d="M40 3 72 16v30c0 18-15 30-32 39C23 76 8 64 8 46V16Z"
          />
          <path
            className="crest-detail"
            pathLength="100"
            d="m24 24 5 11h22l5-11-10 5-6-12-6 12Zm-2 40 34-22m-34 0 34 22"
          />
          <circle
            className="crest-detail"
            pathLength="100"
            cx="40"
            cy="54"
            r="13"
          />
        </svg>
      )}
      {size === 'full' && <span>ROYAL MECHANICS</span>}
    </output>
  );
}
