import { BlurView } from "expo-blur";
import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from "react-native";

/**
 * Founder branding fix (1/8/2026, RULE 1) — genuine native frosted glass.
 *
 * Cards/panels/row-groups over the sky must be translucent navy with a real
 * background blur so the sunset/starfield hints through — never a solid #16273D
 * fill. This is the shared primitive: a rounded, clipped container that layers a
 * native `BlurView` under a translucent navy overlay, with the hairline border
 * on top. Consumers pass only layout (padding/margins/size) via `style`; the fill
 * (blur + overlay + border) is owned here.
 *
 * iPhone (Expo Go) is the acceptance target; expo-blur renders a real backdrop
 * blur there. On Android the blur is best-effort — the translucent overlay keeps
 * it safe and visually close.
 */
const OVERLAY = {
  primary: "rgba(22,39,61,0.55)", // --surface @ 55%
  secondary: "rgba(26,53,80,0.60)", // --surface-2 @ 60% (chips, hover)
  tertiary: "rgba(19,35,58,0.50)" // --surface-3 @ 50% (note/empty)
} as const;

export type FrostedTier = keyof typeof OVERLAY;

export function FrostedCard({
  children,
  style,
  radius = 18,
  tier = "primary",
  intensity = 26,
  border = true,
  borderColor = "rgba(255,255,255,0.09)",
  ...viewProps
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  tier?: FrostedTier;
  intensity?: number;
  border?: boolean;
  borderColor?: string;
} & Pick<ViewProps, "accessibilityLabel" | "accessibilityViewIsModal" | "accessibilityRole" | "accessibilityHint" | "testID">) {
  return (
    <View
      {...viewProps}
      style={[
        { borderRadius: radius, overflow: "hidden" },
        border ? { borderWidth: 1, borderColor } : null,
        style
      ]}
    >
      <BlurView intensity={intensity} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: OVERLAY[tier] }]} pointerEvents="none" />
      {children}
    </View>
  );
}
