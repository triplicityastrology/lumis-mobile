import { memo, useEffect, useMemo, useRef, useState } from "react";
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
  delay: number;
  duration: number;
  opacity: number;
  radius: number;
};


/** Care Circle uses a cooler blue/teal-green sky to set the whole area apart
 *  (design handoff 2026-07-21, `.ac-sky.care`). Default is the warm sunrise sky. */
const SKY_VARIANTS = {
  default: {
    grad: ["#0A1524", "#0E1D31", "#1C2C46", "#3E3A58", "#795A64", "#B27B68"],
    top: "#5B63B7", left: "#E5C06B", right: "#E89B92", bottom: "#F3CBA9", horizon: "#F3CBA9"
  },
  care: {
    grad: ["#081C22", "#0A222B", "#123544", "#1C4A50", "#2C6B62", "#4C8F72"],
    top: "#5B96B7", left: "#3AA88C", right: "#66B2CC", bottom: "#78BEA6", horizon: "#96DBC4"
  }
} as const;

export type SkyVariant = keyof typeof SKY_VARIANTS;

export const CelestialBackground = memo(function CelestialBackground({ variant = "default" }: { variant?: SkyVariant }) {
  const sky = SKY_VARIANTS[variant];
  const [reduceMotion, setReduceMotion] = useState(false);
  const shootingStars = useRef([new Animated.Value(0), new Animated.Value(0)]).current;
  const layerA = useRef(new Animated.Value(1)).current;
  const layerB = useRef(new Animated.Value(0.82)).current;
  const stars = useMemo(() => buildStars(), []);

  // One shared pulse per star layer (native-driven opacity) — cheap to mount.
  useEffect(() => {
    if (reduceMotion) {
      layerA.setValue(1);
      layerB.setValue(1);
      return;
    }
    const pulse = (v: Animated.Value, lo: number, hi: number, dur: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: lo, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(v, { toValue: hi, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true })
        ])
      );
    const a = pulse(layerA, 0.6, 1, 2200);
    const b = pulse(layerB, 1, 0.68, 2800);
    a.start();
    b.start();
    return () => {
      a.stop();
      b.stop();
    };
  }, [reduceMotion, layerA, layerB]);

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
      shootingStars.forEach((value, index) => {
        const cycle = index === 0 ? 9000 : 11000;
        const animation = Animated.sequence([
          Animated.delay(index === 0 ? 1500 : 6000),
          Animated.loop(
            Animated.sequence([
            Animated.timing(value, {
              duration: cycle,
              easing: Easing.in(Easing.quad),
              toValue: 1,
              useNativeDriver: true
            }),
            Animated.timing(value, { duration: 0, toValue: 0, useNativeDriver: true })
            ])
          )
        ]);
        animation.start();
        animations.push(animation);
      });
    }

    return () => animations.forEach((animation) => animation.stop());
  }, [reduceMotion, shootingStars]);

  return (
    <View pointerEvents="none" style={styles.fill} accessibilityElementsHidden>
      <Svg height="100%" preserveAspectRatio="none" viewBox="0 0 390 844" width="100%">
        <Defs>
          <LinearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
            <Stop offset="0" stopColor={sky.grad[0]} />
            <Stop offset="0.32" stopColor={sky.grad[1]} />
            <Stop offset="0.54" stopColor={sky.grad[2]} />
            <Stop offset="0.72" stopColor={sky.grad[3]} />
            <Stop offset="0.87" stopColor={sky.grad[4]} />
            <Stop offset="1" stopColor={sky.grad[5]} />
          </LinearGradient>
          <RadialGradient cx="50%" cy="-6%" id="topGlow" rx="75%" ry="58%">
            <Stop offset="0" stopColor={sky.top} stopOpacity="0.46" />
            <Stop offset="0.62" stopColor={sky.top} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient cx="2%" cy="100%" id="leftGlow" rx="58%" ry="62%">
            <Stop offset="0" stopColor={sky.left} stopOpacity="0.6" />
            <Stop offset="0.7" stopColor={sky.left} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient cx="98%" cy="100%" id="rightGlow" rx="58%" ry="62%">
            <Stop offset="0" stopColor={sky.right} stopOpacity="0.55" />
            <Stop offset="0.7" stopColor={sky.right} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient cx="50%" cy="100%" id="bottomGlow" rx="82%" ry="54%">
            <Stop offset="0" stopColor={sky.bottom} stopOpacity="0.5" />
            <Stop offset="0.74" stopColor={sky.bottom} stopOpacity="0" />
          </RadialGradient>
          <LinearGradient id="milkyWay" x1="0" x2="0" y1="0" y2="1">
            <Stop offset="0" stopColor="#E0E4FC" stopOpacity="0" />
            <Stop offset="0.28" stopColor="#E0E4FC" stopOpacity="0.035" />
            <Stop offset="0.5" stopColor="#E0E4FC" stopOpacity="0.1" />
            <Stop offset="0.72" stopColor="#E0E4FC" stopOpacity="0.035" />
            <Stop offset="1" stopColor="#E0E4FC" stopOpacity="0" />
          </LinearGradient>
          <LinearGradient id="horizon" x1="0" x2="1" y1="0" y2="0">
            <Stop offset="0" stopColor={sky.horizon} stopOpacity="0" />
            <Stop offset="0.5" stopColor={sky.horizon} stopOpacity="0.9" />
            <Stop offset="1" stopColor={sky.horizon} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Rect fill="url(#sky)" height="844" width="390" />
        <G rotation="-18" origin="195,320">
          <Rect fill="url(#milkyWay)" height="438" width="620" x="-115" y="100" />
        </G>
        <Rect fill="url(#topGlow)" height="844" width="390" />
        <Rect fill="url(#leftGlow)" height="844" width="390" />
        <Rect fill="url(#rightGlow)" height="844" width="390" />
        <Rect fill="url(#bottomGlow)" height="844" width="390" />
        <Rect fill="url(#horizon)" height="8" opacity="0.18" width="336" x="27" y="690" />
        <Rect fill="url(#horizon)" height="1.5" width="336" x="27" y="693" />
      </Svg>

      {/* Two star layers, each pulsed by ONE shared loop (2 animations total, not
          66) so mounting the sky on every screen navigation stays cheap and the
          Back transition doesn't hitch. */}
      <AnimatedSvg height="100%" preserveAspectRatio="none" style={[styles.fill, { opacity: layerA }]} viewBox="0 0 390 844" width="100%">
        {stars.filter((_, i) => i % 2 === 0).map((star, index) => (
          <Circle key={index} cx={star.cx} cy={star.cy} r={star.radius} fill="#EAF0FF" opacity={star.opacity} />
        ))}
      </AnimatedSvg>
      <AnimatedSvg height="100%" preserveAspectRatio="none" style={[styles.fill, { opacity: layerB }]} viewBox="0 0 390 844" width="100%">
        {stars.filter((_, i) => i % 2 === 1).map((star, index) => (
          <Circle key={index} cx={star.cx} cy={star.cy} r={star.radius} fill="#EAF0FF" opacity={star.opacity} />
        ))}
      </AnimatedSvg>

      {!reduceMotion
        ? shootingStars.map((value, index) => (
            <ShootingStar
              key={index}
              index={index}
              progress={value}
            />
          ))
        : null}

    </View>
  );
});

const AnimatedSvg = Animated.createAnimatedComponent(Svg);

function ShootingStar({
  index,
  progress
}: {
  index: number;
  progress: Animated.Value;
}) {
  return (
    <Animated.View
      style={[
        styles.shootingStar,
        index === 0 ? styles.shootingStarOne : styles.shootingStarTwo,
        {
          opacity: progress.interpolate({
            inputRange: [0, 0.04, 0.18, 0.3, 1],
            outputRange: [0, 1, 0.9, 0, 0]
          }),
          transform: [
            { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, 150] }) },
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, 60] }) },
            { rotate: "22deg" }
          ]
        }
      ]}
    >
      <Svg height="4" viewBox="0 0 78 4" width="78">
        <Defs>
          <LinearGradient id={`shootingTail${index}`} x1="0" x2="1" y1="0" y2="0">
            <Stop offset="0" stopColor="#FFF7EB" stopOpacity="0" />
            <Stop offset="0.65" stopColor="#FFF7EB" stopOpacity="0.05" />
            <Stop offset="1" stopColor="#F3CBA9" stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect fill={`url(#shootingTail${index})`} height="1.4" rx="0.7" width="78" y="1.3" />
      </Svg>
    </Animated.View>
  );
}

function buildStars(): Star[] {
  const random = seededRandom(1337);
  return Array.from({ length: 66 }, () => ({
    cx: Number((random() * 390).toFixed(1)),
    cy: Number((random() * 844).toFixed(1)),
    radius: Number((0.5 + random() * 1.3).toFixed(2)),
    opacity: Number((0.3 + random() * 0.5).toFixed(2)),
    duration: Number((2.6 + random() * 4).toFixed(2)) * 1000,
    delay: Number((random() * 5).toFixed(2)) * 1000
  }));
}

function seededRandom(seed: number) {
  let value = seed;
  return () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden"
  },
  shootingStar: {
    height: 4,
    position: "absolute",
    shadowColor: "#F3CBA9",
    shadowOpacity: 0.8,
    shadowRadius: 3,
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
