import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";

import { type } from "../theme/typography";

/**
 * The single global primary CTA (Codex signed-off). One gradient, reused by every
 * large primary/full-width/modal button across the app. Never a flat rectangle.
 *
 * Gradient: linear-gradient(100°, #E5C06B 0%, #E9B083 55%, #E89B92 100%)
 *   ≈ start (0.15, 0) → end (0.85, 1). Text on gold: #3A2218 (ink.on-gold).
 *
 * Small solid-gold chips (Past Reflections "+", notification Accept pill, Profile
 * badge) intentionally do NOT use this — they stay solid per the Rule 2 exception.
 */
export const BRAND_GOLD_GRADIENT = ["#E5C06B", "#E9B083", "#E89B92"] as const;
export const BRAND_GOLD_LOCATIONS = [0, 0.55, 1] as const;
export const BRAND_GOLD_START = { x: 0.15, y: 0 } as const;
export const BRAND_GOLD_END = { x: 0.85, y: 1 } as const;
export const BRAND_GOLD_INK = "#3A2218";

export function BrandPrimaryButton({
  label,
  onPress,
  icon,
  iconLeft,
  disabled = false,
  busy = false,
  style,
  accessibilityLabel
}: {
  label: string;
  onPress: () => void;
  icon?: ReactNode;
  iconLeft?: ReactNode;
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: disabled || busy, busy }}
      style={[styles.wrap, (disabled || busy) && styles.dim, style]}
    >
      <LinearGradient
        colors={BRAND_GOLD_GRADIENT}
        locations={BRAND_GOLD_LOCATIONS}
        start={BRAND_GOLD_START}
        end={BRAND_GOLD_END}
        style={styles.gradient}
      >
        {iconLeft}
        <Text style={styles.label}>{label}</Text>
        {icon}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Rounded clip + subtle gold glow shadow (SPEC: 0 6px 18px -8px rgba(215,185,120,0.45)).
  wrap: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#E89B92",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.55,
    shadowRadius: 18
  },
  gradient: {
    alignItems: "center",
    flexDirection: "row",
    gap: 9,
    justifyContent: "center",
    minHeight: 54,
    paddingHorizontal: 20,
    paddingVertical: 15
  },
  label: type.buttonLabel,
  dim: { opacity: 0.5 }
});
