import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line } from "react-native-svg";

import { colors } from "../theme/tokens";

/**
 * The chart-generation loading experience (design handoff §6): a self-drawing
 * chart wheel floating on the sky with a soft glow, two concentric rings
 * counter-rotating (outer ~14s, inner ~22s reverse), a serif headline, and a
 * 4-step checklist revealed one step at a time. Reduced motion disables the
 * rotation. Shared by onboarding chart generation and existing-user chart edits
 * so both go through the same full chart page.
 */
export function GeneratingView({
  activeStep,
  name,
  eyebrow = "READING YOUR SKY…",
  title,
  steps
}: {
  activeStep: number;
  name?: string;
  eyebrow?: string;
  title?: string;
  steps?: string[];
}) {
  const stepLabels = steps ?? [
    "Aligning your ephemeris data",
    "Positioning your Ascendant and angles",
    "Turning your chart into personal algorithms",
    "Preparing your first psychological insight"
  ];
  const headline = title ?? `Building your sanctuary${name ? `, ${name}` : ""}.`;

  const [reduceMotion, setReduceMotion] = useState(false);
  const outer = useRef(new Animated.Value(0)).current;
  const inner = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;

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
    const loops = [
      Animated.loop(Animated.timing(outer, { toValue: 1, duration: 14000, easing: Easing.linear, useNativeDriver: true })),
      Animated.loop(Animated.timing(inner, { toValue: 1, duration: 22000, easing: Easing.linear, useNativeDriver: true })),
      Animated.loop(Animated.timing(spin, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true }))
    ];
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [reduceMotion, outer, inner, spin]);

  const outerSpin = outer.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const innerSpin = inner.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "-360deg"] });
  const activeSpin = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <View style={styles.wrap}>
      <View style={styles.stage}>
        <View style={styles.glow} />

        {/* outer counter-rotating ring */}
        <Animated.View style={[styles.ring, { transform: [{ rotate: outerSpin }] }]}>
          <Svg width={210} height={210} viewBox="0 0 210 210">
            <Circle cx="105" cy="105" r="100" fill="none" stroke="#D7A950" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="2 10" />
          </Svg>
        </Animated.View>

        {/* inner counter-rotating ring */}
        <Animated.View style={[styles.ring, { transform: [{ rotate: innerSpin }] }]}>
          <Svg width={168} height={168} viewBox="0 0 168 168">
            <Circle cx="84" cy="84" r="80" fill="none" stroke="#9298D5" strokeOpacity="0.4" strokeWidth="1" strokeDasharray="1 14" />
          </Svg>
        </Animated.View>

        {/* undecorated chart wheel */}
        <Svg width={132} height={132} viewBox="0 0 132 132">
          <Circle cx="66" cy="66" r="60" fill="rgba(7,19,33,0.4)" stroke="#D7A950" strokeOpacity="0.65" strokeWidth="1" />
          <Circle cx="66" cy="66" r="44" fill="none" stroke="#EDE3D4" strokeOpacity="0.35" strokeWidth="0.7" />
          <Circle cx="66" cy="66" r="26" fill="none" stroke="#9298D5" strokeOpacity="0.4" strokeWidth="0.7" />
          {Array.from({ length: 12 }).map((_, index) => {
            const angle = (index * 30 - 90) * (Math.PI / 180);
            return (
              <Line
                key={index}
                x1={66 + Math.cos(angle) * 26}
                y1={66 + Math.sin(angle) * 26}
                x2={66 + Math.cos(angle) * 60}
                y2={66 + Math.sin(angle) * 60}
                stroke="#EDE3D4"
                strokeOpacity="0.25"
                strokeWidth="0.6"
              />
            );
          })}
          <Circle cx="66" cy="66" r="3" fill="#D7A950" />
        </Svg>
      </View>

      <View style={styles.eyebrowRow}>
        <Text style={styles.eyebrow}>✦ {eyebrow}</Text>
      </View>
      <Text style={styles.title}>{headline}</Text>

      <View style={styles.steps}>
        {stepLabels.map((label, index) => {
          const done = index < activeStep;
          const active = index === activeStep;
          return (
            <View key={label} style={[styles.stepRow, !done && !active && styles.stepRowIdle]}>
              <View style={[styles.stepIcon, done && styles.stepIconDone]}>
                {done ? (
                  <Text style={styles.stepCheck}>✓</Text>
                ) : active && !reduceMotion ? (
                  <Animated.View style={[styles.stepSpinner, { transform: [{ rotate: activeSpin }] }]} />
                ) : (
                  <Text style={styles.stepNum}>{index + 1}</Text>
                )}
              </View>
              <Text style={[styles.stepText, (done || active) && styles.stepTextActive]}>{label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", flex: 1, justifyContent: "center", paddingHorizontal: 36 },
  stage: { alignItems: "center", height: 210, justifyContent: "center", marginBottom: 30, width: 210 },
  glow: { position: "absolute", width: 190, height: 190, borderRadius: 95, backgroundColor: "rgba(201,169,110,0.12)" },
  ring: { position: "absolute", alignItems: "center", justifyContent: "center" },
  eyebrowRow: { flexDirection: "row" },
  eyebrow: { color: "#E9B083", fontSize: 11, fontWeight: "700", letterSpacing: 1.6 },
  title: { color: colors.ice, fontFamily: "Georgia", fontSize: 26, lineHeight: 32, marginTop: 8, textAlign: "center" },
  steps: { alignSelf: "stretch", gap: 16, marginTop: 34 },
  stepRow: { alignItems: "center", flexDirection: "row", gap: 14 },
  stepRowIdle: { opacity: 0.4 },
  stepIcon: { alignItems: "center", borderColor: colors.line, borderRadius: 13, borderWidth: 1, height: 26, justifyContent: "center", width: 26 },
  stepIconDone: { backgroundColor: colors.gold, borderColor: colors.gold },
  stepCheck: { color: colors.navy950, fontSize: 13, fontWeight: "700" },
  stepNum: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  stepSpinner: { borderColor: "rgba(215,185,120,0.35)", borderRadius: 9, borderTopColor: colors.gold, borderWidth: 2, height: 18, width: 18 },
  stepText: { color: colors.muted, flex: 1, fontSize: 14.5 },
  stepTextActive: { color: colors.ice }
});
