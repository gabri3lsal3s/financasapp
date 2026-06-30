/**
 * Centralized haptic feedback utility.
 * Multi-stage vibrate patterns for pull gestures and triggers.
 */

export type HapticType = 'start' | 'active' | 'cancel' | 'trigger'

export function triggerHaptic(type: HapticType): void {
  try {
    if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return

    switch (type) {
      case 'start':
        navigator.vibrate(5)
        break
      case 'active':
        navigator.vibrate(15)
        break
      case 'cancel':
        navigator.vibrate([5, 30, 5])
        break
      case 'trigger':
        navigator.vibrate([12, 20, 12])
        break
    }
  } catch {
    // Vibração é um recurso não crítico — ignora falhas silenciosamente
  }
}
