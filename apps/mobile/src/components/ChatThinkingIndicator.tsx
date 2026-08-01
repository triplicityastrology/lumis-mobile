import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
} from "react-native";

const GOLD = "#E8C98D";

export function ChatThinkingIndicator() {
  const [reduceMotion, setReduceMotion] = useState(false);
  const breathe = useRef(new Animated.Value(0)).current;
  const orbit = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion
    );
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    breathe.stopAnimation();
    orbit.stopAnimation();

    if (reduceMotion) {
      breathe.setValue(1);
      orbit.setValue(0);
      return;
    }

    breathe.setValue(0);
    orbit.setValue(0);
    const breathing = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          toValue: 0,
          useNativeDriver: true,
        }),
      ])
    );
    const orbiting = Animated.loop(
      Animated.timing(orbit, {
        duration: 2400,
        easing: Easing.linear,
        toValue: 1,
        useNativeDriver: true,
      })
    );
    breathing.start();
    orbiting.start();

    return () => {
      breathing.stop();
      orbiting.stop();
    };
  }, [breathe, orbit, reduceMotion]);

  const coreStyle = {
    opacity: breathe.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }),
    transform: [
      { scale: breathe.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }) },
    ],
  };
  const orbitStyle = {
    transform: [
      {
        rotate: orbit.interpolate({
          inputRange: [0, 1],
          outputRange: ["0deg", "360deg"],
        }),
      },
    ],
  };

  return (
    <View accessible={false} importantForAccessibility="no" style={styles.mount}>
      <Animated.View style={[styles.coreGlow, coreStyle]}>
        <View style={styles.core} />
      </Animated.View>
      <Animated.View style={[styles.orbit, orbitStyle]}>
        <OrbitSpark angle="0deg" opacity={1} />
        <OrbitSpark angle="120deg" opacity={0.72} />
        <OrbitSpark angle="240deg" opacity={0.48} />
      </Animated.View>
    </View>
  );
}

function OrbitSpark({ angle, opacity }: { angle: string; opacity: number }) {
  return (
    <View style={[styles.sparkArm, { transform: [{ rotate: angle }] }]}>
      <View style={[styles.spark, { opacity }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  core: {
    backgroundColor: GOLD,
    borderRadius: 3,
    height: 5,
    width: 5,
  },
  coreGlow: {
    alignItems: "center",
    backgroundColor: "rgba(232,201,141,0.18)",
    borderRadius: 10,
    height: 20,
    justifyContent: "center",
    shadowColor: GOLD,
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.38,
    shadowRadius: 5,
    width: 20,
  },
  mount: {
    alignItems: "center",
    height: 20,
    justifyContent: "center",
    width: 20,
  },
  orbit: {
    height: 20,
    left: 0,
    position: "absolute",
    top: 0,
    width: 20,
  },
  spark: {
    backgroundColor: GOLD,
    borderRadius: 2,
    height: 3.5,
    position: "absolute",
    right: -1.75,
    shadowColor: GOLD,
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 3,
    top: -1.75,
    width: 3.5,
  },
  sparkArm: {
    height: 1,
    left: 10,
    position: "absolute",
    top: 10,
    width: 7,
  },
});
