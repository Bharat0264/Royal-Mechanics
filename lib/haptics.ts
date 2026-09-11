export type HapticType = 'light' | 'medium' | 'success' | 'error' | 'capture';
export function triggerHaptic(type: HapticType) {
  if (
    typeof navigator === 'undefined' ||
    typeof navigator.vibrate !== 'function'
  )
    return;
  const patterns = {
    light: 10,
    medium: 25,
    success: [15, 50, 15],
    error: 60,
    capture: 15,
  };
  try {
    navigator.vibrate(patterns[type]);
  } catch {
    /* Unsupported devices fail silently. */
  }
}
