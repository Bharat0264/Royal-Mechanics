'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

const STORAGE_KEY = 'royal-mechanics-haptics-enabled';

export type HapticType =
  | 'light'
  | 'medium'
  | 'success'
  | 'error'
  | 'warning'
  // Retained as a light tap for existing camera controls.
  | 'capture';

export const hapticPatterns: Record<HapticType, number[]> = {
  light: [10],
  medium: [25],
  success: [15, 50, 15],
  error: [60],
  warning: [75, 50, 75],
  capture: [15],
};

type HapticsContextValue = {
  isHapticsEnabled: boolean;
  isReducedMotion: boolean;
  isSupported: boolean;
  setHapticsEnabled: (enabled: boolean) => void;
  toggleHaptics: () => void;
};

export const HapticsContext = createContext<HapticsContextValue | null>(null);
let legacyHapticsEnabled = true;

function supportsVibration() {
  return (
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    'vibrate' in navigator &&
    typeof navigator.vibrate === 'function'
  );
}

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

function safelyReadPreference() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

function safelyPersistPreference(enabled: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch {
    // Private browsing and storage restrictions should never break interaction.
  }
}

function vibrate(
  type: HapticType,
  enabled = legacyHapticsEnabled,
  reduced = prefersReducedMotion(),
) {
  if (!enabled || reduced || !supportsVibration()) return;
  try {
    navigator.vibrate(hapticPatterns[type]);
  } catch {
    // Unsupported implementations fail silently.
  }
}

export function HapticsProvider({ children }: { children: ReactNode }) {
  const [isHapticsEnabled, setEnabled] = useState(true);
  const [isReducedMotion, setReducedMotion] = useState(false);
  const [isSupported, setSupported] = useState(false);

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const updateReducedMotion = () => setReducedMotion(media?.matches === true);
    const enabled = safelyReadPreference();
    legacyHapticsEnabled = enabled;
    setEnabled(enabled);
    setSupported(supportsVibration());
    updateReducedMotion();
    media?.addEventListener('change', updateReducedMotion);
    return () => media?.removeEventListener('change', updateReducedMotion);
  }, []);

  const setHapticsEnabled = useCallback((enabled: boolean) => {
    legacyHapticsEnabled = enabled;
    setEnabled(enabled);
    safelyPersistPreference(enabled);
  }, []);

  const toggleHaptics = useCallback(() => {
    setHapticsEnabled(!legacyHapticsEnabled);
  }, [setHapticsEnabled]);

  const value = useMemo(
    () => ({
      isHapticsEnabled,
      isReducedMotion,
      isSupported,
      setHapticsEnabled,
      toggleHaptics,
    }),
    [
      isHapticsEnabled,
      isReducedMotion,
      isSupported,
      setHapticsEnabled,
      toggleHaptics,
    ],
  );

  return (
    <HapticsContext.Provider value={value}>{children}</HapticsContext.Provider>
  );
}

/** SSR-safe semantic haptics API for client components. */
export function useHaptics() {
  const context = useContext(HapticsContext);
  const enabled = context?.isHapticsEnabled ?? legacyHapticsEnabled;
  const reduced = context?.isReducedMotion ?? prefersReducedMotion();
  const trigger = useCallback(
    (type: HapticType) => vibrate(type, enabled, reduced),
    [enabled, reduced],
  );

  return {
    triggerLight: () => trigger('light'),
    triggerMedium: () => trigger('medium'),
    triggerSuccess: () => trigger('success'),
    triggerError: () => trigger('error'),
    triggerWarning: () => trigger('warning'),
    ...context,
  };
}

/** Backward-compatible API used by existing interactive components. */
export function triggerHaptic(type: HapticType) {
  vibrate(type);
}
