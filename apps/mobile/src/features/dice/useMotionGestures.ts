import { Accelerometer } from "expo-sensors";
import { useEffect, useRef } from "react";

import { DICE_TIMINGS } from "./constants";

/**
 * Shake / flick detection per AC-DICE-01 §3.
 *
 * - Sensors run only while `enabled` (READY/MIXING) — battery + iOS permission timing.
 * - "Up" is computed from a low-passed gravity vector, not raw z, so gestures work
 *   whether the phone is held flat or tilted.
 * - Flat shake: sustained acceleration variance perpendicular to gravity, with no
 *   dominant single upward spike → onMix(energy 0..1) pulses.
 * - Upward flick: sharp spike along gravity-up beyond FLICK_THRESHOLD_G within the
 *   debounce window → onThrow(strength), where strength maps spike magnitude into
 *   the launch clamp range.
 *
 * Thresholds are exported so the dev calibration overlay (spec §3) can tune them;
 * ship the medians found in beta.
 */
export const MOTION_TUNING = {
  updateIntervalMs: 16,
  gravityLowPass: 0.12,
  shakeThresholdG: 0.22,
  shakeEnterCount: 3,
  flickThresholdG: 1.05,
  flickStrengthDivisorG: 1.4
};

export type MotionGestureHandlers = {
  onMix: (energy: number) => void;
  onThrow: (strength: number) => void;
};

export function useMotionGestures(enabled: boolean, handlers: MotionGestureHandlers): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled) return;

    let active = true;
    let subscription: { remove: () => void } | null = null;
    const enabledAt = Date.now();
    const gravity = { x: 0, y: 0, z: -1 };
    let shakeStreak = 0;

    void Accelerometer.isAvailableAsync().then((available) => {
      if (!active || !available) return;
      Accelerometer.setUpdateInterval(MOTION_TUNING.updateIntervalMs);
      subscription = Accelerometer.addListener(({ x, y, z }) => {
        // Low-pass gravity estimate (expo-sensors reports in g's, gravity included).
        const a = MOTION_TUNING.gravityLowPass;
        gravity.x = gravity.x * (1 - a) + x * a;
        gravity.y = gravity.y * (1 - a) + y * a;
        gravity.z = gravity.z * (1 - a) + z * a;
        const gLen = Math.hypot(gravity.x, gravity.y, gravity.z) || 1;

        // Linear acceleration = raw − gravity estimate.
        const lx = x - gravity.x;
        const ly = y - gravity.y;
        const lz = z - gravity.z;

        // Component along "up" (opposite the gravity vector).
        const up = -(lx * gravity.x + ly * gravity.y + lz * gravity.z) / gLen;
        const linMag = Math.hypot(lx, ly, lz);
        const horizontal = Math.sqrt(Math.max(0, linMag * linMag - up * up));

        // Upward flick wins the instant it appears (valid from READY or mid-MIXING),
        // debounced so lifting the phone right after Ready doesn't throw.
        if (up > MOTION_TUNING.flickThresholdG && Date.now() - enabledAt > DICE_TIMINGS.throwDebounce) {
          handlersRef.current.onThrow(
            Math.min(1.6, Math.max(0.6, up / MOTION_TUNING.flickStrengthDivisorG))
          );
          return;
        }

        // Flat shake: horizontal jitter without a dominant upward spike.
        if (horizontal > MOTION_TUNING.shakeThresholdG && up < MOTION_TUNING.flickThresholdG * 0.6) {
          shakeStreak += 1;
          if (shakeStreak >= MOTION_TUNING.shakeEnterCount) {
            handlersRef.current.onMix(Math.min(1, horizontal / 1.2));
          }
        } else {
          shakeStreak = Math.max(0, shakeStreak - 1);
        }
      });
    });

    return () => {
      active = false;
      subscription?.remove();
    };
  }, [enabled]);
}
