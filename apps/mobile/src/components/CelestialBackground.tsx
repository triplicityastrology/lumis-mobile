import { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop
} from "react-native-svg";

type Star = {
  cx: number;
  cy: number;
  opacity: number;
  radius: number;
};

const AnimatedSvg = Animated.createAnimatedComponent(Svg);

export function CelestialBackground() {
  const [reduceMotion, setReduceMotion] = useState(false);
  const twinkles = useRef([new Animated.Value(1), new Animated.Value(0.72), new Animated.Value(0.5)]).current;
  const shootingStars = useRef([new Animated.Value(0), new Animated.Value(0)]).current;
  const starGroups = useMemo(() => buildStars(), []);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const animations: Animated.CompositeAnimation[] = [];

    if (!reduceMotion) {
      twinkles.forEach((value, index) => {
        const animation = Animated.loop(
          Animated.sequence([
            Animated.delay(index * 700),
            Animated.timing(value, {
              duration: 1600 + index * 450,
              easing: Easing.inOut(Easing.sin),
              toValue: 0.25,
              useNativeDriver: true
            }),
            Animated.timing(value, {
              duration: 1600 + index * 450,
              easing: Easing.inOut(Easing.sin),
              toValue: 1,
              useNativeDriver: true
            })
          ])
        );
        animation.start();
        animations.push(animation);
      });

      shootingStars.forEach((value, index) => {
        const cycle = index === 0 ? 9000 : 11000;
        const animation = Animated.loop(
          Animated.sequence([
            Animated.delay(index === 0 ? 1500 : 6000),
            Animated.timing(value, {
              duration: cycle * 0.3,
              easing: Easing.out(Easing.quad),
              toValue: 1,
              useNativeDriver: true
            }),
            Animated.timing(value, {
              duration: cycle * 0.7,
              toValue: 1,
              useNativeDriver: true
            }),
            Animated.timing(value, { duration: 0, toValue: 0, useNativeDriver: true })
          ])
        );
        animation.start();
        animations.push(animation);
      });
    }

    return () => animations.forEach((animation) => animation.stop());
  }, [reduceMotion, shootingStars, twinkles]);

  return (
    <View pointerEvents="none" style={styles.fill} accessibilityElementsHidden>
      <Svg height="100%" preserveAspectRatio="none" viewBox="0 0 390 844" width="100%">
        <Defs>
          <LinearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
            <Stop offset="0" stopColor="#0A1524" />
            <Stop offset="0.32" stopColor="#0E1D31" />
            <Stop offset="0.54" stopColor="#1C2C46" />
            <Stop offset="0.72" stopColor="#3E3A58" />
            <Stop offset="0.87" stopColor="#795A64" />
            <Stop offset="1" stopColor="#B27B68" />
          </LinearGradient>
          <RadialGradient cx="50%" cy="0%" id="topGlow" rx="75%" ry="58%">
            <Stop offset="0" stopColor="#5B63B7" stopOpacity="0.46" />
            <Stop offset="0.62" stopColor="#5B63B7" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient cx="2%" cy="100%" id="leftGlow" rx="58%" ry="62%">
            <Stop offset="0" stopColor="#E5C06B" stopOpacity="0.62" />
            <Stop offset="0.7" stopColor="#E5C06B" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient cx="98%" cy="100%" id="rightGlow" rx="58%" ry="62%">
            <Stop offset="0" stopColor="#E89B92" stopOpacity="0.6" />
            <Stop offset="0.7" stopColor="#E89B92" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient cx="50%" cy="100%" id="bottomGlow" rx="82%" ry="54%">
            <Stop offset="0" stopColor="#F3CBA9" stopOpacity="0.56" />
            <Stop offset="0.74" stopColor="#F3CBA9" stopOpacity="0" />
          </RadialGradient>
          <LinearGradient id="milkyWay" x1="0" x2="0" y1="0" y2="1">
            <Stop offset="0" stopColor="#E0E4FC" stopOpacity="0" />
            <Stop offset="0.28" stopColor="#E0E4FC" stopOpacity="0.035" />
            <Stop offset="0.5" stopColor="#E0E4FC" stopOpacity="0.1" />
            <Stop offset="0.72" stopColor="#E0E4FC" stopOpacity="0.035" />
            <Stop offset="1" stopColor="#E0E4FC" stopOpacity="0" />
          </LinearGradient>
          <LinearGradient id="horizon" x1="0" x2="1" y1="0" y2="0">
            <Stop offset="0" stopColor="#F3CBA9" stopOpacity="0" />
            <Stop offset="0.5" stopColor="#F3CBA9" stopOpacity="0.9" />
            <Stop offset="1" stopColor="#F3CBA9" stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Rect fill="url(#sky)" height="844" width="390" />
        <Rect fill="url(#topGlow)" height="844" width="390" />
        <Rect fill="url(#leftGlow)" height="844" width="390" />
        <Rect fill="url(#rightGlow)" height="844" width="390" />
        <Rect fill="url(#bottomGlow)" height="844" width="390" />
        <G rotation="-18" origin="195,320">
          <Rect fill="url(#milkyWay)" height="438" width="620" x="-115" y="100" />
        </G>
      </Svg>

      {starGroups.map((stars, index) => (
        <AnimatedSvg
          height="100%"
          key={index}
          preserveAspectRatio="none"
          style={[styles.fill, { opacity: reduceMotion ? 0.72 : twinkles[index] }]}
          viewBox="0 0 390 844"
          width="100%"
        >
          {stars.map((star, starIndex) => (
            <Circle
              cx={star.cx}
              cy={star.cy}
              fill="#F8F1E4"
              key={starIndex}
              opacity={star.opacity}
              r={star.radius}
            />
          ))}
        </AnimatedSvg>
      ))}

      {!reduceMotion
        ? shootingStars.map((value, index) => (
            <Animated.View
              key={index}
              style={[
                styles.shootingStar,
                index === 0 ? styles.shootingStarOne : styles.shootingStarTwo,
                {
                  opacity: value.interpolate({
                    inputRange: [0, 0.12, 0.62, 1],
                    outputRange: [0, 1, 1, 0]
                  }),
                  transform: [
                    { rotate: "22deg" },
                    { translateX: value.interpolate({ inputRange: [0, 1], outputRange: [0, 150] }) },
                    { translateY: value.interpolate({ inputRange: [0, 1], outputRange: [0, 60] }) }
                  ]
                }
              ]}
            />
          ))
        : null}

      <View style={styles.horizon} />
    </View>
  );
}

function buildStars(): Star[][] {
  const random = seededRandom(1337);
  const groups: Star[][] = [[], [], []];

  for (let index = 0; index < 66; index += 1) {
    groups[index % groups.length].push({
      cx: random() * 390,
      cy: random() * 844,
      radius: 0.5 + random() * 1.3,
      opacity: 0.3 + random() * 0.5
    });
  }

  return groups;
}

function seededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden"
  },
  horizon: {
    backgroundColor: "rgba(243,203,169,0.82)",
    bottom: 150,
    height: 1.5,
    left: "7%",
    opacity: 0.72,
    position: "absolute",
    right: "7%",
    shadowColor: "#F3CBA9",
    shadowOpacity: 0.65,
    shadowRadius: 13
  },
  shootingStar: {
    backgroundColor: "#F3CBA9",
    borderRadius: 2,
    height: 1.4,
    position: "absolute",
    shadowColor: "#F3CBA9",
    shadowOpacity: 0.8,
    shadowRadius: 5,
    width: 78
  },
  shootingStarOne: {
    left: "-12%",
    top: "12%"
  },
  shootingStarTwo: {
    left: "-12%",
    top: "26%"
  }
});
