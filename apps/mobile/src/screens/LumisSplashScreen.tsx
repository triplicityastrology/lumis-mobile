import { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";

import { colors } from "../theme/tokens";

/**
 * Splash (design handoff 2026-07-21 §1): full-bleed night sky, a thin double-ring
 * brand mark (gold outer + periwinkle inner) with an orbiting dot and a serif ☉,
 * the Lumis wordmark, and a one-line slogan. Auto-advances after ~4s; a tap
 * anywhere skips. The audio/haptic chime is a nice-to-have, omitted here.
 */

export function LumisSplashScreen({ onDone }: { onDone: () => void }) {
  const spin = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const doneRef = useRef(false);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  };

  useEffect(() => {
    let reduce = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => (reduce = v));
    Animated.timing(fade, { toValue: 1, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 6000, easing: Easing.linear, useNativeDriver: true })
    );
    if (!reduce) loop.start();
    const timer = setTimeout(finish, 4000);
    return () => {
      clearTimeout(timer);
      loop.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <Pressable style={styles.flex} onPress={finish} accessibilityRole="button" accessibilityLabel="Skip intro">
      <SafeAreaView style={styles.safe}>
        <Animated.View style={[styles.center, { opacity: fade }]}>
          <View style={styles.mark}>
            <Svg width={120} height={120} viewBox="0 0 120 120">
              <Circle cx="60" cy="60" r="52" stroke="#D7B978" strokeWidth={1.4} fill="none" opacity={0.9} />
              <Circle cx="60" cy="60" r="40" stroke="#8B93D4" strokeWidth={1.2} fill="none" opacity={0.75} />
            </Svg>
            <Animated.View style={[styles.orbit, { transform: [{ rotate }] }]}>
              <Svg width={120} height={120} viewBox="0 0 120 120">
                <Circle cx="60" cy="8" r="3" fill="#E8DCC0" />
              </Svg>
            </Animated.View>
            <Text style={styles.sun}>☉</Text>
          </View>
          <Text style={styles.wordmark}>Lumis</Text>
          <Text style={styles.slogan}>A private space shaped by your birth chart.</Text>
        </Animated.View>
      </SafeAreaView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { backgroundColor: "transparent", flex: 1 },
  center: { alignItems: "center", flex: 1, justifyContent: "center", gap: 4 },
  mark: { alignItems: "center", height: 120, justifyContent: "center", width: 120 },
  orbit: { height: 120, position: "absolute", width: 120 },
  sun: { color: "#E8DCC0", fontFamily: "Georgia", fontSize: 30, position: "absolute" },
  wordmark: { color: colors.ice, fontFamily: "Georgia", fontSize: 34, marginTop: 18 },
  slogan: { color: colors.textSoft, fontSize: 13.5, marginTop: 8, opacity: 0.75, textAlign: "center" }
});
