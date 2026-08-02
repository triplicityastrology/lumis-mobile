import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, Line, RadialGradient, Stop } from "react-native-svg";

import { colors } from "../../theme/tokens";

/**
 * PROF-005 — Regenerating chart (founder rework pack, SPEC.md).
 *
 * A dedicated, decorative regeneration loader that is intentionally NOT the real
 * natal wheel and carries NO astrology glyphs — so nothing can be substituted by
 * the OS as a colour emoji (founder note: "glyph should not be in emoji"). It is
 * a slow gold dashed ring with radial spokes, a centre dot and a soft gold halo.
 *
 * The presentation is truthful: the backend exposes no per-step progress, so the
 * checklist is an equal in-progress list — no step is marked complete on a timer
 * (authority rule D). The step the parent transitions away from is driven only by
 * the real backend outcome.
 */
const RING_SPOKES = Array.from({ length: 8 }, (_, index) => (index * 360) / 8);

export function RegeneratingView({
  eyebrow = "UPDATING YOUR SKY…",
  title = "Regenerating your chart.",
  subtitle,
  steps
}: {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  steps?: string[];
}) {
  const stepLabels = steps ?? [
    "Reading your updated birth details",
    "Recalculating your sky",
    "Regenerating your Lumis profile",
    "Preparing your new chart context"
  ];

  const [reduceMotion, setReduceMotion] = useState(false);
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    // Slow, elegant 12s rotation (SPEC) — not a bouncy spinner.
    const spinLoop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 12000, easing: Easing.linear, useNativeDriver: true })
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
      ])
    );
    spinLoop.start();
    pulseLoop.start();
    return () => {
      spinLoop.stop();
      pulseLoop.stop();
    };
  }, [reduceMotion, spin, pulse]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const dotOpacity = reduceMotion ? 1 : pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] });

  return (
    <View style={styles.wrap}>
      <View style={styles.ring}>
        <Animated.View style={reduceMotion ? undefined : { transform: [{ rotate }] }}>
          <Svg width={150} height={150} viewBox="0 0 150 150">
            <Defs>
              <RadialGradient id="regen-halo" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor="rgba(215,185,120,0.10)" />
                <Stop offset="70%" stopColor="rgba(215,185,120,0)" />
              </RadialGradient>
            </Defs>
            {/* soft gold halo */}
            <Circle cx="75" cy="75" r="75" fill="url(#regen-halo)" />
            {/* faint base ring */}
            <Circle cx="75" cy="75" r="58" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
            {/* dashed gold accent ring */}
            <Circle
              cx="75"
              cy="75"
              r="58"
              fill="none"
              stroke={colors.accent}
              strokeWidth="1"
              strokeDasharray="4 7"
              opacity={0.75}
            />
            {/* eight radial spokes */}
            {RING_SPOKES.map((deg) => {
              const rad = (deg * Math.PI) / 180;
              return (
                <Line
                  key={deg}
                  x1={75 + Math.cos(rad) * 30}
                  y1={75 + Math.sin(rad) * 30}
                  x2={75 + Math.cos(rad) * 58}
                  y2={75 + Math.sin(rad) * 58}
                  stroke="rgba(255,255,255,0.10)"
                  strokeWidth="1"
                />
              );
            })}
            {/* centre dot */}
            <Circle cx="75" cy="75" r="5" fill={colors.accent} />
          </Svg>
        </Animated.View>
      </View>

      <Text style={styles.eyebrow}>✦ {eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

      <View
        accessibilityLabel="Chart regeneration is in progress"
        accessibilityRole="progressbar"
        style={styles.steps}
      >
        {stepLabels.map((label) => (
          <View key={label} style={styles.stepRow}>
            <View style={styles.stepDot}>
              {/* Equal in-progress marker — never a timer-driven checkmark. */}
              <Animated.View style={[styles.stepDotCore, { opacity: dotOpacity }]} />
            </View>
            <Text style={styles.stepText}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", flex: 1, justifyContent: "center", paddingBottom: 40, paddingHorizontal: 32, paddingTop: 22 },
  ring: { alignItems: "center", height: 150, justifyContent: "center", marginBottom: 26, width: 150 },
  eyebrow: { color: colors.accent, fontSize: 11, fontWeight: "700", letterSpacing: 1.6 },
  title: { color: colors.ice, fontFamily: "Newsreader-Medium", fontSize: 26, lineHeight: 32, marginTop: 8, textAlign: "center" },
  subtitle: { color: colors.textSoft, fontSize: 13, lineHeight: 19, marginTop: 9, maxWidth: 330, textAlign: "center" },
  steps: { alignItems: "flex-start", alignSelf: "center", gap: 18, marginTop: 30, maxWidth: 300 },
  stepRow: { alignItems: "center", flexDirection: "row", gap: 14 },
  stepDot: { alignItems: "center", borderColor: colors.accent, borderRadius: 13, borderWidth: 1.5, height: 26, justifyContent: "center", width: 26 },
  stepDotCore: { backgroundColor: colors.accent, borderRadius: 4, height: 8, width: 8 },
  stepText: { color: colors.textSoft, flex: 1, fontSize: 14.5, lineHeight: 20 }
});
