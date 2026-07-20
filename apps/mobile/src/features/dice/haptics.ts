import * as Haptics from "expo-haptics";

/**
 * Haptic vocabulary for the dice ritual (AC-DICE-04 §2 timing sheet):
 * light ticks while mixing (rate-limited ≤ 8/s), one medium at release,
 * a medium thump per die's first table contact, one soft success at the card.
 * Every call is fire-and-forget and safe when the platform has no haptics.
 */

let lastMixTickAt = 0;

export function mixTick(): void {
  const now = Date.now();
  if (now - lastMixTickAt < 125) return;
  lastMixTickAt = now;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function cradleTick(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function releaseImpact(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

export function landingThump(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

export function resultTap(): void {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
