import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef } from "react";
import {
  AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View, type ViewStyle
} from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { colors, radii } from "../../theme/tokens";

/**
 * Shared UI-state kit (AC-UX-12): Quiet Empty State + Friendly Retry Card, plus
 * the brand buttons and glass surfaces used across the notification/care/birth
 * packages. Line-art motifs share the gold hairline language of the dice hand.
 */

export const SUNRISE = ["#E5C06B", "#E9B083", "#E89B92"] as const;

let reduceMotionCache = false;
void AccessibilityInfo.isReduceMotionEnabled().then((v) => {
  reduceMotionCache = v;
});

/* ---------- brand buttons ---------- */

export function BrandButton({
  label, onPress, disabled, loading, style
}: { label: string; onPress: () => void; disabled?: boolean; loading?: boolean; style?: ViewStyle }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      style={[k.brandWrap, (disabled || loading) && k.dim, style]}
    >
      <LinearGradient colors={[...SUNRISE]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.4 }} style={k.brandGrad}>
        <Text style={k.brandText}>{loading ? "…" : label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

export function SoftButton({
  label, onPress, disabled, style
}: { label: string; onPress: () => void; disabled?: boolean; style?: ViewStyle }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={[k.soft, disabled && k.dim, style]}
    >
      <Text style={k.softText}>{label}</Text>
    </Pressable>
  );
}

export function GhostButton({ label, onPress, style }: { label: string; onPress: () => void; style?: ViewStyle }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={[k.ghost, style]}>
      <Text style={k.ghostText}>{label}</Text>
    </Pressable>
  );
}

/* ---------- sky-screen header (circular glass back button + serif title) ---------- */

export function ScreenHeader({
  title, onBack, right
}: { title: string; onBack: () => void; right?: React.ReactNode }) {
  return (
    <View style={k.header}>
      <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" style={k.iconBtn} hitSlop={8}>
        <Svg width={18} height={18} viewBox="0 0 24 24">
          <Path d="M15 5l-7 7 7 7" stroke={colors.ice} strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Pressable>
      <Text style={k.headerTitle}>{title}</Text>
      <View style={k.headerRight}>{right ?? <View style={k.iconBtnGhost} />}</View>
    </View>
  );
}

/* ---------- line-art motifs (gold hairline) ---------- */

type MotifName = "bell" | "book" | "bookmark" | "hands" | "dice" | "cloud" | "wheel";

export function LineMotif({ name, size = 64 }: { name: MotifName; size?: number }) {
  const s = 24;
  const stroke = "#D7B978";
  const common = { stroke, strokeWidth: 1.4, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const star = <Path d="M19 4 L19.5 5.4 L21 5.9 L19.5 6.4 L19 7.8 L18.5 6.4 L17 5.9 L18.5 5.4 Z" fill={stroke} stroke="none" />;
  const paths: Record<MotifName, React.ReactNode> = {
    bell: (<><Path d="M7 10a5 5 0 0 1 10 0c0 4 1.5 5 2 6H5c.5-1 2-2 2-6Z" {...common} /><Path d="M10.5 19a1.6 1.6 0 0 0 3 0" {...common} />{star}</>),
    book: (<><Path d="M4 5.5C6 4.5 9 4.5 11 6v12c-2-1.5-5-1.5-7-.5Z" {...common} /><Path d="M20 5.5C18 4.5 15 4.5 13 6v12c2-1.5 5-1.5 7-.5Z" {...common} />{star}</>),
    bookmark: (<><Path d="M7 4h10v16l-5-3.5L7 20Z" {...common} />{star}</>),
    hands: (<><Path d="M4 13c1-2 3-2.5 5-1.5 M4 13c0 3 3 5 6 5 M20 13c-1-2-3-2.5-5-1.5 M20 13c0 3-3 5-6 5" {...common} />{star}</>),
    dice: (<><Path d="M6 8l3-2 3 2-3 2Z M12 12l3-2 3 2-3 2Z M6 14l3-2 3 2-3 2Z" {...common} /></>),
    cloud: (<><Path d="M7 15a3.2 3.2 0 0 1 .4-6.3A4 4 0 0 1 15 8.5a3 3 0 0 1 1 5.8Z" {...common} />{star}</>),
    wheel: (<><Circle cx="12" cy="12" r="7.5" {...common} /><Circle cx="12" cy="12" r="3" {...common} /><Path d="M12 4.5v3 M12 16.5v3 M4.5 12h3 M16.5 12h3" {...common} /></>)
  };
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${s} ${s}`} accessibilityElementsHidden importantForAccessibility="no">
      {paths[name]}
    </Svg>
  );
}

/* ---------- Quiet Empty State ---------- */

export function QuietEmptyState({
  motif, title, sub, ctaLabel, onCta
}: { motif: MotifName; title: string; sub: string; ctaLabel?: string; onCta?: () => void }) {
  const anim = useRef(new Animated.Value(reduceMotionCache ? 1 : 0)).current;
  useEffect(() => {
    if (reduceMotionCache) return;
    Animated.timing(anim, { toValue: 1, duration: 250, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [anim]);
  return (
    <Animated.View
      accessible
      accessibilityLabel={`${title}. ${sub}`}
      style={[k.empty, { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}
    >
      <LineMotif name={motif} size={64} />
      <Text style={k.emptyTitle}>{title}</Text>
      <Text style={k.emptySub}>{sub}</Text>
      {ctaLabel && onCta ? <SoftButton label={ctaLabel} onPress={onCta} style={{ marginTop: 18 }} /> : null}
    </Animated.View>
  );
}

/* ---------- Friendly Retry Card ---------- */

export function RetryCard({
  title, sub, onRetry, retrying, secondaryLabel, onSecondary
}: {
  title: string; sub: string; onRetry: () => void; retrying?: boolean;
  secondaryLabel?: string; onSecondary?: () => void;
}) {
  return (
    <View accessible accessibilityLabel={`${title}. ${sub}`} style={k.retryCard}>
      <LineMotif name="cloud" size={52} />
      <Text style={k.retryTitle}>{title}</Text>
      <Text style={k.retrySub}>{sub}</Text>
      <BrandButton label="Retry" loading={retrying} onPress={onRetry} style={{ alignSelf: "stretch", marginTop: 16 }} />
      {secondaryLabel && onSecondary ? <GhostButton label={secondaryLabel} onPress={onSecondary} style={{ marginTop: 10 }} /> : null}
    </View>
  );
}

/* ---------- glass card + skeleton row ---------- */

export function GlassCard({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[k.glass, style]}>{children}</View>;
}

export function SkeletonRow() {
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotionCache) return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 700, useNativeDriver: true })
      ])
    ).start();
  }, [shimmer]);
  const opacity = reduceMotionCache ? 0.5 : shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.7] });
  return (
    <View style={k.skelRow}>
      <Animated.View style={[k.skelCircle, { opacity }]} />
      <View style={{ flex: 1, gap: 8 }}>
        <Animated.View style={[k.skelBar, { width: "60%", opacity }]} />
        <Animated.View style={[k.skelBar, { width: "35%", opacity }]} />
      </View>
    </View>
  );
}

/* ---------- Preview / Unavailable truthfulness labels (S1-C02) ---------- */

/** Persistent "Preview" tag for surfaces backed by mock data (not a dev toggle).
 *  Makes it truthful that the content is a preview, not live. */
export function PreviewBadge({ label = "Preview", style }: { label?: string; style?: ViewStyle }) {
  return (
    <View style={[k.previewBadge, style]} accessibilityRole="text" accessibilityLabel={`${label} — sample data, not live`}>
      <Text style={k.previewBadgeText}>{label.toUpperCase()}</Text>
    </View>
  );
}

/** Small "Unavailable" pill for actions that are visibly not usable yet — never
 *  implies the action ran. */
export function UnavailablePill({ label = "Unavailable" }: { label?: string }) {
  return (
    <View style={k.unavailablePill} accessibilityRole="text" accessibilityLabel={`${label} — not available yet`}>
      <Text style={k.unavailablePillText}>{label}</Text>
    </View>
  );
}

/* ---------- safety note (Care Circle) ---------- */

export function SafetyNote({ text }: { text: string }) {
  return (
    <View style={k.safety}>
      <Text style={k.safetyText}>{text}</Text>
    </View>
  );
}

const k = StyleSheet.create({
  dim: { opacity: 0.55 },
  brandWrap: { borderRadius: 15, shadowColor: "#E9B083", shadowOffset: { height: 10, width: 0 }, shadowOpacity: 0.4, shadowRadius: 16 },
  brandGrad: { alignItems: "center", borderRadius: 15, justifyContent: "center", minHeight: 52, paddingHorizontal: 28 },
  brandText: { color: "#3A2218", fontSize: 15.5, fontWeight: "700" },
  soft: { alignItems: "center", backgroundColor: "rgba(122,134,200,0.24)", borderColor: "rgba(139,147,212,0.34)", borderRadius: 15, borderWidth: 1, justifyContent: "center", minHeight: 48, paddingHorizontal: 22 },
  softText: { color: "#EAEDFB", fontSize: 14.5, fontWeight: "600" },
  ghost: { alignItems: "center", justifyContent: "center", minHeight: 40, paddingHorizontal: 16 },
  ghostText: { color: colors.muted, fontSize: 13.5, fontWeight: "600" },
  empty: { alignItems: "center", gap: 10, paddingHorizontal: 24, paddingVertical: 36 },
  emptyTitle: { color: colors.ice, fontFamily: "Georgia", fontSize: 19, marginTop: 6, textAlign: "center" },
  emptySub: { color: colors.muted, fontSize: 13.5, lineHeight: 20, maxWidth: 300, textAlign: "center" },
  retryCard: { alignItems: "center", backgroundColor: "rgba(58,80,118,0.42)", borderColor: colors.line, borderRadius: 22, borderWidth: 1, gap: 8, padding: 22 },
  retryTitle: { color: colors.ice, fontFamily: "Georgia", fontSize: 17, marginTop: 4, textAlign: "center" },
  retrySub: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: "center" },
  glass: { backgroundColor: "rgba(58,80,118,0.42)", borderColor: colors.line, borderRadius: radii.lg, borderWidth: 1, padding: 16 },
  skelRow: { alignItems: "center", flexDirection: "row", gap: 12, paddingVertical: 12 },
  skelCircle: { backgroundColor: colors.line, borderRadius: 16, height: 32, width: 32 },
  skelBar: { backgroundColor: colors.line, borderRadius: 6, height: 10 },
  safety: { backgroundColor: "rgba(58,80,118,0.30)", borderColor: colors.line, borderRadius: radii.md, borderWidth: 1, marginTop: 14, padding: 12 },
  safetyText: { color: colors.muted, fontSize: 11.5, lineHeight: 17, textAlign: "center" },
  previewBadge: { alignSelf: "flex-start", backgroundColor: "rgba(201,169,110,0.12)", borderColor: "rgba(215,185,120,0.45)", borderRadius: 999, borderWidth: 1, borderStyle: "dashed", paddingHorizontal: 9, paddingVertical: 3 },
  previewBadgeText: { color: colors.goldLight, fontSize: 9, fontWeight: "800", letterSpacing: 1.2 },
  unavailablePill: { backgroundColor: "rgba(255,255,255,0.05)", borderColor: colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 3 },
  unavailablePillText: { color: colors.muted, fontSize: 10.5, fontWeight: "700", letterSpacing: 0.4 },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", minHeight: 56, paddingHorizontal: 16 },
  iconBtn: { alignItems: "center", backgroundColor: "rgba(58,80,118,0.42)", borderColor: colors.line, borderRadius: 19, borderWidth: 1, height: 38, justifyContent: "center", width: 38 },
  iconBtnGhost: { height: 38, width: 38 },
  headerTitle: { color: colors.ice, flex: 1, fontFamily: "Georgia", fontSize: 19, textAlign: "center" },
  headerRight: { alignItems: "flex-end", minWidth: 38 }
});
