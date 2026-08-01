import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";

/**
 * Founder branding fix (1/8/2026, RULE 2) — brand gold GRADIENT for every large
 * primary/full-width/modal CTA. Never a flat yellow rectangle.
 *
 * Gradient: linear-gradient(100deg, #C9A96E 0%, #D7B978 55%, #E5C58A 100%)
 * Text on gold: #1A1206.
 *
 * Small solid-gold chips (Past Reflections "+", notification Accept pill, Profile
 * badge) intentionally do NOT use this — they stay solid per the Rule 2 exception.
 */
export const BRAND_GOLD_GRADIENT = ["#C9A96E", "#D7B978", "#E5C58A"] as const;
export const BRAND_GOLD_LOCATIONS = [0, 0.55, 1] as const;
export const BRAND_GOLD_INK = "#1A1206";

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
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.35 }}
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
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#D7B978",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14
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
  label: { color: BRAND_GOLD_INK, fontSize: 15.5, fontWeight: "700" },
  dim: { opacity: 0.5 }
});
