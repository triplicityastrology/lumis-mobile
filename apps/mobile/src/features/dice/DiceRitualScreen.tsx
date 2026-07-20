import Bell from "lucide-react-native/icons/bell";
import ChevronLeft from "lucide-react-native/icons/chevron-left";
import List from "lucide-react-native/icons/list";
import { getRandomValues } from "expo-crypto";
import { Accelerometer } from "expo-sensors";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo, Animated, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View
} from "react-native";
import Svg, {
  Circle, Defs, Ellipse, Path, Polygon, RadialGradient, Rect, Stop, Text as SvgText
} from "react-native-svg";

import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

import { CelestialBackground } from "../../components/CelestialBackground";
import { MainTabBar, type MainTab } from "../../components/MainTabBar";
import { colors, radii, spacing } from "../../theme/tokens";
import { DICE_TIMINGS, DIE_ORDER, FACE_SETS, type DiceFace, type DieKind } from "./constants";
import { DIE_INRADIUS, DIE_RADIUS, DODECA_FACES, DODECA_VERTICES } from "./geometry";
import { add, dot, length, normalize, quatRotate, scale, sub, vec, type Vec3 } from "./math";
import {
  createWorld, groundDie, launch, randomOrientation, resolveSettledFaces, stepWorld,
  type DiceWorld
} from "./physics";
import { configureSecureRandom, secureRandom, seededRandom } from "./rng";
import { cradleTick, landingThump, mixTick, releaseImpact, resultTap } from "./haptics";
import { saveDiceThrow } from "../../services/diceThrows";
import { DiceHistorySheet, type SessionRoll } from "./DiceHistorySheet";
import { useMotionGestures } from "./useMotionGestures";

configureSecureRandom(getRandomValues);

/**
 * The Dice ritual stage (AC-DICE-04): IDLE → READY → MIXING ⇄ → THROW → TUMBLE →
 * SETTLE → RESULT → INTERPRET, rendered with react-native-svg using the painter
 * approach validated in the motion prototype.
 *
 * Spike notes for device testing:
 * - The renderer re-renders ~50 SVG nodes per frame. If the mid-range device
 *   can't hold 60fps through TUMBLE, the view layer swaps to
 *   react-three-fiber + expo-gl; the sim, face reading and state flow stay as-is.
 * - Haptics need expo-haptics added to the app before wiring (kept out of the
 *   spike so it stays installable offline).
 */

type Phase = "IDLE" | "READY" | "MIXING" | "THROW" | "TUMBLE" | "SETTLE" | "RESULT" | "INTERPRET";

type StageSymbols = { planet: DiceFace; sign: DiceFace; house: DiceFace };

/** U+FE0E forces text presentation — without it iOS renders ♋/☉/♒… as emoji badges. */
const TEXT_STYLE = "\uFE0E";

const LIGHT = normalize(vec(-0.45, 0.85, 0.35));
const CAMERA_POS = vec(0, 5.1, 7.6);
const CAMERA_TOP = vec(0, 8.4, 1.9); // near-overhead so landed faces read clearly
const CAMERA_TARGET = vec(0, 0.35, 0.1);
const CAMERA_TARGET_TOP = vec(0, 0.1, 0.1);
const FOCAL = 1.35;

/** Camera rises from the throw view to a top view as the settle zoom eases in. */
function cameraPose(zoom: number) {
  const mix = (a: Vec3, b: Vec3) => vec(a.x + (b.x - a.x) * zoom, a.y + (b.y - a.y) * zoom, a.z + (b.z - a.z) * zoom);
  return { pos: mix(CAMERA_POS, CAMERA_TOP), target: mix(CAMERA_TARGET, CAMERA_TARGET_TOP) };
}

const SUNRISE = ["#E5C06B", "#E9B083", "#E89B92"] as const;

function BrandButton({ label, onPress, style }: { label: string; onPress: () => void; style?: object }) {
  return (
    <Pressable onPress={onPress} style={[styles.brandButtonWrap, style]}>
      <LinearGradient
        colors={[...SUNRISE]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.35 }}
        style={styles.brandButtonGrad}
      >
        <Text style={styles.brandButtonText}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

function SoftButton({ label, onPress, style }: { label: string; onPress: () => void; style?: object }) {
  return (
    <Pressable onPress={onPress} style={[styles.softButton, style]}>
      <Text style={styles.softButtonText}>{label}</Text>
    </Pressable>
  );
}

export function DiceRitualScreen({
  onNotifications,
  onReflect,
  onSelectTab
}: {
  onNotifications: () => void;
  onReflect: (chatDraft: string) => void;
  onSelectTab: (tab: MainTab) => void;
}) {
  const [question, setQuestion] = useState("");
  const [phase, setPhase] = useState<Phase>("IDLE");
  const [symbols, setSymbols] = useState<StageSymbols | null>(null);
  const [showTapThrow, setShowTapThrow] = useState(false);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [, setFrame] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const sessionRollsRef = useRef<SessionRoll[]>([]);

  const phaseRef = useRef<Phase>("IDLE");
  const questionRef = useRef("");
  const worldRef = useRef<DiceWorld>(createWorld());
  const palmOrientations = useRef([randomOrientation(), randomOrientation(), randomOrientation()]);
  const palmSpin = useRef<Vec3[]>([vec(0, 0, 0), vec(0, 0, 0), vec(0, 0, 0)]);
  const mixEnergyRef = useRef(0);
  const lastMixAt = useRef(0);
  const settleAtRef = useRef(0);
  const throwAtRef = useRef(0);
  const handPoseRef = useRef(0); // 0 open, 1 cradle, 2 release
  const handShownRef = useRef(1);
  const cameraZoomRef = useRef(0);
  const glowRef = useRef(0);
  const lastTickRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const frameCounter = useRef(0);
  const landedRef = useRef<[boolean, boolean, boolean]>([false, false, false]);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dimAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const sub2 = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      mounted = false;
      sub2.remove();
    };
  }, []);

  const transition = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const completeSettle = useCallback(() => {
    const world = worldRef.current;
    const { readings } = resolveSettledFaces(world);
    for (const die of world.dice) groundDie(die);
    const [planetReading, signReading, houseReading] = readings;
    const nextSymbols = {
      planet: FACE_SETS.planet[planetReading.faceIndex],
      sign: FACE_SETS.sign[signReading.faceIndex],
      house: FACE_SETS.house[houseReading.faceIndex]
    };
    setSymbols(nextSymbols);
    settleAtRef.current = Date.now();
    transition("SETTLE");
    AccessibilityInfo.announceForAccessibility(
      `Dice settled: ${nextSymbols.planet.en}, ${nextSymbols.sign.en}, ${nextSymbols.house.en}`
    );
    // Persist the throw (no-op in local demo mode); interpretation stays unlinked
    // until the user asks Lumis to read it.
    sessionRollsRef.current = [
      {
        question: questionRef.current.trim() || null,
        planetKey: nextSymbols.planet.key,
        signKey: nextSymbols.sign.key,
        houseKey: nextSymbols.house.key,
        at: Date.now()
      },
      ...sessionRollsRef.current
    ];
    void saveDiceThrow({
      question: questionRef.current.trim() || null,
      planetKey: nextSymbols.planet.key,
      signKey: nextSymbols.sign.key,
      houseKey: nextSymbols.house.key
    });
  }, [transition]);

  const beginReady = useCallback(() => {
    if (phaseRef.current !== "IDLE") return;
    transition("READY");
    handPoseRef.current = 1;
    cradleTick();
    AccessibilityInfo.announceForAccessibility("Shake to mix, flick up to throw, or use the throw button.");
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(() => {
      if (phaseRef.current === "READY" || phaseRef.current === "MIXING") setShowTapThrow(true);
    }, DICE_TIMINGS.tapFallbackAfter);
    // iOS motion-permission denial (or missing sensor) → offer tap-to-throw
    // immediately instead of stranding the user for 6 s (AC-DICE-04 §8).
    void (async () => {
      try {
        const available = await Accelerometer.isAvailableAsync();
        if (!available) {
          setShowTapThrow(true);
          return;
        }
        const current = await Accelerometer.getPermissionsAsync();
        if (current.granted) return;
        const asked = await Accelerometer.requestPermissionsAsync();
        if (!asked.granted) setShowTapThrow(true);
      } catch {
        setShowTapThrow(true);
      }
    })();
  }, [transition]);

  const performThrow = useCallback(
    (strength: number) => {
      const current = phaseRef.current;
      if (current !== "READY" && current !== "MIXING") return;
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
      setShowTapThrow(false);
      transition("THROW");
      handPoseRef.current = 2;
      throwAtRef.current = Date.now();
      landedRef.current = [false, false, false];
      releaseImpact();
      launch(worldRef.current, strength);
      if (reduceMotion) {
        // Reduced motion: resolve the same fair physics instantly, then present
        // the settle sequence as fades (AC-DICE-04 §8 parallel cut).
        let guard = 0;
        while (!stepWorld(worldRef.current, 1 / 30) && guard++ < 5000) { /* fast-forward */ }
        handShownRef.current = 0;
        completeSettle();
        return;
      }
      setTimeout(() => {
        if (phaseRef.current === "THROW") transition("TUMBLE");
      }, DICE_TIMINGS.releaseSwap + 40);
    },
    [completeSettle, reduceMotion, transition]
  );

  const rethrow = useCallback(() => {
    dimAnim.setValue(0);
    cardAnim.setValue(0);
    worldRef.current = createWorld();
    palmOrientations.current = [randomOrientation(), randomOrientation(), randomOrientation()];
    handPoseRef.current = 0;
    handShownRef.current = 1;
    cameraZoomRef.current = 0;
    glowRef.current = 0;
    setSymbols(null);
    setShowTapThrow(false);
    transition("IDLE");
  }, [cardAnim, dimAnim, transition]);

  useMotionGestures(phase === "READY" || phase === "MIXING", {
    onMix: (energy) => {
      if (phaseRef.current === "READY") transition("MIXING");
      if (phaseRef.current !== "MIXING") return;
      lastMixAt.current = Date.now();
      mixTick();
      mixEnergyRef.current = Math.min(1, mixEnergyRef.current + energy * 0.4);
      palmSpin.current = palmSpin.current.map((spin) =>
        add(spin, vec(jitter(7 * energy), jitter(7 * energy), jitter(7 * energy)))
      );
    },
    onThrow: performThrow
  });

  // Main tick — drives sim, palm motion, camera, glow. Runs while mounted.
  useEffect(() => {
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - (lastTickRef.current || now)) / 1000);
      lastTickRef.current = now;
      const currentPhase = phaseRef.current;

      if (currentPhase === "MIXING" && Date.now() - lastMixAt.current > DICE_TIMINGS.mixStopSettle) {
        transition("READY");
        mixEnergyRef.current = 0;
      }

      if (currentPhase === "IDLE" || currentPhase === "READY" || currentPhase === "MIXING") {
        palmOrientations.current = palmOrientations.current.map((orientation, i) => {
          let spin = palmSpin.current[i];
          if (currentPhase === "IDLE" && !reduceMotion) {
            spin = add(spin, vec(0, Math.sin(now / DICE_TIMINGS.breathingCycle + i * 2) * 0.02, 0));
          }
          palmSpin.current[i] = scale(spin, 1 - 3.5 * dt);
          const spinLen = length(spin);
          if (spinLen < 1e-5) return orientation;
          return rotateBy(orientation, spin, dt);
        });
        mixEnergyRef.current = Math.max(0, mixEnergyRef.current - dt * 1.2);
      }

      if (currentPhase === "THROW" || currentPhase === "TUMBLE") {
        if (handShownRef.current > 0 && Date.now() - throwAtRef.current > DICE_TIMINGS.handExit) {
          handShownRef.current = Math.max(0, handShownRef.current - dt * 8);
        }
        const settled = stepWorld(worldRef.current, dt);
        worldRef.current.dice.forEach((die, i) => {
          if (!landedRef.current[i] && die.position.y < DIE_INRADIUS * 1.6 && die.velocity.y >= -0.5) {
            landedRef.current[i] = true;
            landingThump();
          }
        });
        if (settled && currentPhase === "TUMBLE") completeSettle();
      }

      if (currentPhase === "SETTLE" || currentPhase === "RESULT" || currentPhase === "INTERPRET") {
        const elapsed = Date.now() - settleAtRef.current;
        const zoomT = reduceMotion ? 1 : Math.min(1, elapsed / DICE_TIMINGS.cameraEase);
        cameraZoomRef.current = zoomT < 0.5 ? 2 * zoomT * zoomT : 1 - Math.pow(-2 * zoomT + 2, 2) / 2;
        const glowStart = reduceMotion ? 100 : DICE_TIMINGS.cameraEase * 0.55;
        glowRef.current = Math.min(1, Math.max(0, elapsed - glowStart) / DICE_TIMINGS.glowRise);
        if (
          currentPhase === "SETTLE" &&
          elapsed > glowStart + DICE_TIMINGS.glowRise + DICE_TIMINGS.heldBeat
        ) {
          transition("RESULT");
          resultTap();
          Animated.timing(dimAnim, {
            toValue: 1, duration: DICE_TIMINGS.sceneDim, useNativeDriver: true
          }).start();
          Animated.timing(cardAnim, {
            toValue: 1, duration: DICE_TIMINGS.cardSlide, useNativeDriver: true
          }).start(() => {
            if (phaseRef.current === "RESULT") transition("INTERPRET");
          });
        }
      }

      frameCounter.current += 1;
      if (currentPhase !== "IDLE" || frameCounter.current % 2 === 0) {
        setFrame((f) => (f + 1) % 1_000_000);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    };
  }, [cardAnim, completeSettle, dimAnim, reduceMotion, transition]);

  const { width: W, height: H } = stageSize;
  const showPalm = phase === "IDLE" || phase === "READY" || phase === "MIXING";
  const showTable = !showPalm;
  const trimmedQuestion = question.trim();
  const reflectionPrompt = symbols
    ? `Help me reflect on my astrology dice throw. My question was: “${trimmedQuestion || "What should I notice right now?"}” The dice showed ${symbols.planet.en}, ${symbols.sign.en}, ${symbols.house.en}.`
    : "";

  return (
    <SafeAreaView style={styles.safe}>
      <CelestialBackground />
      <View style={styles.frame}>
        <View style={styles.header}>
          <View style={styles.headerSpace} />
          <Text style={styles.headerTitle}>Astrology Dice</Text>
          <View style={styles.headerActions}>
            <Pressable style={styles.iconButton} onPress={() => setHistoryOpen(true)} accessibilityLabel="Past rolls">
              <List color={colors.ice} size={19} />
            </Pressable>
            <Pressable style={styles.iconButton} onPress={onNotifications} accessibilityLabel="Notifications">
              <Bell color={colors.ice} size={19} />
            </Pressable>
          </View>
        </View>

        <View
          style={styles.stage}
          onLayout={(e) => setStageSize({
            width: e.nativeEvent.layout.width,
            height: e.nativeEvent.layout.height
          })}
        >
          {W > 0 && H > 0 ? (
            <Svg width={W} height={H}>
              <Defs>
                <RadialGradient id="glowGrad" cx="50%" cy="50%" r="50%">
                  <Stop offset="0%" stopColor="#E8CD9A" stopOpacity="0.5" />
                  <Stop offset="100%" stopColor="#E8CD9A" stopOpacity="0" />
                </RadialGradient>
              </Defs>
              {showTable ? renderTable(W, H, cameraZoomRef.current) : null}
              {showTable
                ? renderWorldDice(
                    worldRef.current, W, H, cameraZoomRef.current, glowRef.current, symbols,
                    phase === "SETTLE" || phase === "RESULT" || phase === "INTERPRET"
                  )
                : null}
              {showPalm || handShownRef.current > 0.01
                ? renderHand(W, H, handPoseRef.current, mixEnergyRef.current, showPalm ? 1 : handShownRef.current)
                : null}
              {showPalm ? renderPalmDice(palmOrientations.current, W, H) : null}
            </Svg>
          ) : null}

          <View pointerEvents="box-none" style={styles.overlay}>
            <BlurView intensity={24} tint="dark" style={styles.questionCard}>
              <Text style={styles.questionLabel}>YOUR QUESTION</Text>
              <TextInput
                editable={phase === "IDLE"}
                onChangeText={(text) => {
                  questionRef.current = text;
                  setQuestion(text);
                }}
                placeholder="What is your question?"
                placeholderTextColor={colors.muted}
                style={styles.questionInput}
                value={question}
              />
            </BlurView>

            <View style={styles.flexSpacer} pointerEvents="none" />

            {phase === "READY" || phase === "MIXING" ? (
              <Text style={styles.hint}>Shake to mix, then flick up to throw</Text>
            ) : null}
            {phase === "IDLE" ? (
              <BrandButton label="Ready" onPress={beginReady} style={styles.fullWidthButton} />
            ) : null}
            {showTapThrow && (phase === "READY" || phase === "MIXING") ? (
              <SoftButton label="Tap to throw" onPress={() => performThrow(1)} />
            ) : null}
          </View>

          <Animated.View pointerEvents="none" style={[styles.dim, { opacity: dimAnim }]} />
        </View>

        {phase === "RESULT" || phase === "INTERPRET" ? (
          <Animated.View
            style={[
              styles.sheetWrap,
              {
                transform: [{
                  translateY: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [420, 0] })
                }]
              }
            ]}
          >
            <BlurView intensity={28} tint="dark" style={styles.sheet}>
            <Text style={styles.sheetQuestion}>
              “{trimmedQuestion || "What should I notice right now?"}”
            </Text>
            <View style={styles.symbolsRow}>
              {symbols
                ? DIE_ORDER.map((kind) => {
                    const face = symbols[kind];
                    const kindLabel = kind === "planet" ? "PLANET" : kind === "sign" ? "SIGN" : "HOUSE";
                    return (
                      <View key={kind} style={styles.symbolCell}>
                        <Text style={styles.symbolKind}>{kindLabel}</Text>
                        <Text style={styles.symbolGlyph}>{face.glyph + TEXT_STYLE}</Text>
                        <Text style={styles.symbolZh}>{face.en}</Text>
                      </View>
                    );
                  })
                : null}
            </View>
            <Text style={styles.sheetNote}>Dice are a mirror for reflection, not a verdict.</Text>
            {phase === "INTERPRET" ? (
              <View style={styles.sheetActions}>
                <SoftButton label="Roll again" onPress={rethrow} style={styles.sheetAction} />
                <BrandButton label="Save this reflection" onPress={() => onReflect(reflectionPrompt)} style={styles.sheetAction} />
              </View>
            ) : null}
            </BlurView>
          </Animated.View>
        ) : null}

        {historyOpen ? (
          <DiceHistorySheet onClose={() => setHistoryOpen(false)} sessionRolls={sessionRollsRef.current} />
        ) : null}

        <MainTabBar active="dice" onSelect={onSelectTab} />
      </View>
    </SafeAreaView>
  );
}

/* ---------- stage painters (ported from the validated motion prototype) ---------- */

function projectPoint(p: Vec3, W: number, H: number, zoom: number, frameShift: number) {
  const { pos, target } = cameraPose(zoom);
  const forward = normalize(sub(target, pos));
  const right = normalize(crossV(forward, vec(0, 1, 0)));
  const up = crossV(right, forward);
  const d = sub(p, pos);
  const zc = dot(d, forward);
  const f = FOCAL * (1 + zoom * 0.22) * H;
  return {
    x: W / 2 + (f * dot(d, right)) / zc,
    y: H * 0.44 - frameShift - (f * dot(d, up)) / zc,
    z: zc
  };
}

function crossV(a: Vec3, b: Vec3): Vec3 {
  return vec(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
}

/** Per-die body colors so the three dice read apart at a glance (founder, 2026-07-20). */
const DIE_BODY: Record<DieKind, { h: number; hueVar: number; s: number; sLam: number; l: number; lLam: number }> = {
  planet: { h: 252, hueVar: 20, s: 46, sLam: 10, l: 30, lLam: 24 }, // violet (matches the physical set)
  sign: { h: 344, hueVar: 12, s: 18, sLam: 8, l: 44, lLam: 20 },    // greyish pink
  house: { h: 174, hueVar: 10, s: 40, sLam: 10, l: 34, lLam: 22 }   // tiffany blue
};

function shadeFace(normal: Vec3, t: number, kind: DieKind): string {
  const lambert = Math.max(0, dot(normal, LIGHT));
  const p = DIE_BODY[kind];
  const h = p.h - t * p.hueVar;
  const s = p.s + lambert * p.sLam;
  const l = p.l + lambert * p.lLam;
  return `hsl(${h.toFixed(0)}, ${s.toFixed(0)}%, ${l.toFixed(0)}%)`;
}

/** Static glitter suspended in the resin — catches light as the die turns, never twinkles at rest. */
const GLITTER = (() => {
  const rnd = seededRandom(42);
  const palette = ["#FFF6E0", "#FFE9B8", "#BFE8FF", "#F4C9FF"];
  return DODECA_FACES.map(() =>
    Array.from({ length: 5 }, () => ({
      u: (rnd() * 2 - 1) * 0.6,
      v: (rnd() * 2 - 1) * 0.6,
      r: 0.35 + rnd() * 0.5,
      a: 0.25 + rnd() * 0.5,
      c: palette[Math.floor(rnd() * palette.length)]
    }))
  );
})();

function renderTable(W: number, H: number, zoom: number) {
  const corners: Array<[number, number]> = [[-1.63, -1.2], [1.63, -1.2], [1.78, 1.5], [-1.78, 1.5]];
  const pts = corners
    .map(([x, z]) => projectPoint(vec(x, 0, z), W, H, zoom, 0))
    .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  return <Polygon key="mat" points={pts} fill="#EDE2CB" stroke="#C3B394" strokeWidth={1} opacity={0.97} />;
}

function renderWorldDice(
  world: DiceWorld,
  W: number,
  H: number,
  zoom: number,
  glow: number,
  symbols: StageSymbols | null,
  settled: boolean
) {
  void symbols;
  const elements: React.JSX.Element[] = [];
  const camScale = (FOCAL * (1 + zoom * 0.22) * H) / 7.5;

  world.dice.forEach((die, dieIndex) => {
    const ground = projectPoint(vec(die.position.x, 0, die.position.z), W, H, zoom, 0);
    const height = Math.max(0, die.position.y - DIE_INRADIUS);
    const shadowScale = 1 / (1 + height * 1.4);
    const shadowAlpha = Math.max(0, 0.3 - height * 0.42);
    if (shadowAlpha > 0.01) {
      elements.push(
        <Ellipse
          key={`sh${dieIndex}`}
          cx={ground.x} cy={ground.y}
          rx={camScale * 0.34 * 0.9 * shadowScale} ry={camScale * 0.34 * 0.34 * shadowScale}
          fill={`rgba(10,16,32,${shadowAlpha.toFixed(2)})`}
        />
      );
    }
  });

  // Rounded faces (fill + fat round-join stroke) painted grazing → front-facing:
  // the most camera-facing face always paints last, so edge bands take its colour
  // and the order never flips between frames (no depth-tie flicker). Dice far → near.
  const camPos = cameraPose(zoom).pos;
  const dieOrder = [0, 1, 2].sort(
    (a, b) =>
      projectPoint(world.dice[b].position, W, H, zoom, 0).z -
      projectPoint(world.dice[a].position, W, H, zoom, 0).z
  );
  for (const dieIndex of dieOrder) {
    const die = world.dice[dieIndex];
    const faceSet = FACE_SETS[DIE_ORDER[dieIndex]];
    const worldVerts = DODECA_VERTICES.map((v) => add(quatRotate(die.orientation, v), die.position));
    const visible: Array<{ faceIndex: number; facing: number; n: Vec3; pts: string; cx: number; cy: number }> = [];
    DODECA_FACES.forEach((face, faceIndex) => {
      const n = quatRotate(die.orientation, face.normal);
      const center = add(quatRotate(die.orientation, face.center), die.position);
      const facing = dot(normalize(n), normalize(sub(camPos, center)));
      if (facing <= 0) return;
      const pts = face.vertexIndices
        .map((vi) => projectPoint(worldVerts[vi], W, H, zoom, 0))
        .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
        .join(" ");
      const c = projectPoint(center, W, H, zoom, 0);
      visible.push({ faceIndex, facing, n, pts, cx: c.x, cy: c.y });
    });
    visible.sort((a, b) => a.facing - b.facing);

    for (const { faceIndex, facing, n, pts, cx, cy } of visible) {
      const face = DODECA_FACES[faceIndex];
      const faceFill = shadeFace(n, (faceIndex * 0.618) % 1, DIE_ORDER[dieIndex]);
      elements.push(
        <Polygon
          key={`f${dieIndex}-${faceIndex}`}
          points={pts}
          fill={faceFill}
          stroke={faceFill}
          strokeWidth={camScale * DIE_RADIUS * 0.14}
          strokeLinejoin="round"
        />
      );
      // In-resin glitter: static points that catch the light as the die turns.
      const lambert = Math.max(0, dot(n, LIGHT));
      if (lambert > 0.25) {
        const gu = normalize(sub(DODECA_VERTICES[face.vertexIndices[0]], face.center));
        const gv = crossV(face.normal, gu);
        GLITTER[faceIndex].forEach((fleck, fleckIndex) => {
          const local = add(face.center, add(scale(gu, fleck.u * DIE_INRADIUS), scale(gv, fleck.v * DIE_INRADIUS)));
          const p = projectPoint(add(quatRotate(die.orientation, local), die.position), W, H, zoom, 0);
          elements.push(
            <Circle
              key={`k${dieIndex}-${faceIndex}-${fleckIndex}`}
              cx={p.x} cy={p.y}
              r={Math.max(0.6, fleck.r * DIE_INRADIUS * camScale * 0.09)}
              fill={fleck.c}
              opacity={fleck.a * lambert * 0.7}
            />
          );
        });
      }
      // Billboard glyphs — upright, sized by face visibility, clamped inside the
      // face. A real die shows exactly one face up: once settled, every non-top
      // glyph shrinks and dims hard so the landed face is unmistakable.
      const isTop = n.y > 0.9;
      if (facing > 0.5) {
        const glyphColor = settled && isTop
          ? `rgba(232,${205 + Math.round(glow * 20)},154,1)`
          : settled
            ? "rgba(216,176,110,0.4)"
            : "rgba(216,176,110,0.9)";
        const sideShrink = settled && !isTop ? 0.55 : 1;
        const glyphSize = camScale * DIE_INRADIUS * 0.92 * Math.pow(facing, 1.6) * sideShrink;
        if (settled && isTop) {
          elements.push(
            <Polygon
              key={`tr${dieIndex}-${faceIndex}`}
              points={pts}
              fill="none"
              stroke={`rgba(232,205,154,${(0.35 + glow * 0.45).toFixed(2)})`}
              strokeWidth={Math.max(1, camScale * DIE_RADIUS * 0.045)}
              strokeLinejoin="round"
            />
          );
        }
        elements.push(
          <SvgText
            key={`g${dieIndex}-${faceIndex}`}
            x={cx}
            y={cy + glyphSize * 0.34}
            fontSize={glyphSize}
            fontFamily="Georgia"
            fill={glyphColor}
            textAnchor="middle"
          >
            {faceSet[faceIndex].glyph + TEXT_STYLE}
          </SvgText>
        );
        const glyphText = faceSet[faceIndex].glyph;
        if (glyphText === "6" || glyphText === "9") {
          elements.push(
            <Rect
              key={`u${dieIndex}-${faceIndex}`}
              x={cx - glyphSize * 0.3}
              y={cy + glyphSize * 0.46}
              width={glyphSize * 0.6}
              height={Math.max(1, glyphSize * 0.06)}
              fill={glyphColor}
            />
          );
        }
        if (settled && isTop && glow > 0) {
          elements.push(
            <Ellipse
              key={`gl${dieIndex}-${faceIndex}`}
              cx={cx} cy={cy}
              rx={DIE_INRADIUS * 2.6 * camScale}
              ry={DIE_INRADIUS * 2.6 * camScale}
              fill="url(#glowGrad)"
              opacity={glow}
            />
          );
        }
      }
    }
  }
  return elements;
}

function renderPalmDice(orientations: ReturnType<typeof randomOrientation>[], W: number, H: number) {
  const s0 = Math.min(W, 520);
  const cy = H - s0 * 0.42;
  const dieScale = s0 * 0.1;
  const tilt = -0.5;
  const elements: React.JSX.Element[] = [];
  const order = [0, 2, 1];
  for (const i of order) {
    const ax = W / 2 + (i - 1) * dieScale * 2.1;
    const ay = cy + (i === 1 ? -dieScale * 1.2 : dieScale * 0.2);
    elements.push(
      <Ellipse
        key={`pg${i}`} cx={ax} cy={ay + dieScale * 0.55}
        rx={dieScale * 0.85} ry={dieScale * 0.26}
        fill="rgba(139,147,212,0.12)"
      />
    );
    const orientation = orientations[i];
    const projectLocal = (v: Vec3) => {
      const r = quatRotate(orientation, scale(v, 0.72 / DIE_RADIUS)); // unit-ish sphere × 0.72
      return {
        x: ax + r.x * dieScale,
        y: ay - (r.y * Math.cos(tilt) - r.z * Math.sin(tilt)) * dieScale,
        z: r.z * Math.cos(tilt) + r.y * Math.sin(tilt)
      };
    };
    const faces = DODECA_FACES
      .map((face, fi) => {
        const n = quatRotate(orientation, face.normal);
        const nz = n.z * Math.cos(tilt) + n.y * Math.sin(tilt);
        return { face, fi, nz, n };
      })
      .filter((f) => f.nz < -0.05)
      .sort((a, b) => b.nz - a.nz);
    for (const { face, fi, n, nz } of faces) {
      const pts = face.vertexIndices
        .map((vi) => projectLocal(DODECA_VERTICES[vi]))
        .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
        .join(" ");
      const palmFill = shadeFace(n, (fi * 0.618) % 1, DIE_ORDER[i]);
      elements.push(
        <Polygon
          key={`pf${i}-${fi}`}
          points={pts}
          fill={palmFill}
          stroke={palmFill}
          strokeWidth={dieScale * 0.16}
          strokeLinejoin="round"
        />
      );
      if (nz < -0.5) {
        const faceSet = FACE_SETS[DIE_ORDER[i]];
        const c = projectLocal(face.center);
        const lambert = Math.max(0, dot(n, LIGHT));
        const gu = normalize(sub(DODECA_VERTICES[face.vertexIndices[0]], face.center));
        const gv = crossV(face.normal, gu);
        GLITTER[fi].slice(0, 3).forEach((fleck, fleckIndex) => {
          const p = projectLocal(
            add(face.center, add(scale(gu, fleck.u * DIE_INRADIUS), scale(gv, fleck.v * DIE_INRADIUS)))
          );
          elements.push(
            <Circle
              key={`pk${i}-${fi}-${fleckIndex}`}
              cx={p.x} cy={p.y}
              r={Math.max(0.6, fleck.r * dieScale * 0.06)}
              fill={fleck.c}
              opacity={fleck.a * (0.3 + 0.6 * lambert)}
            />
          );
        });
        elements.push(
          <SvgText
            key={`pt${i}-${fi}`}
            x={c.x}
            y={c.y + dieScale * 0.16}
            fontSize={dieScale * 0.45}
            fontFamily="Georgia"
            fill={`rgba(216,176,110,${(0.55 + 0.45 * lambert).toFixed(2)})`}
            textAnchor="middle"
          >
            {faceSet[fi].glyph + TEXT_STYLE}
          </SvgText>
        );
      }
    }
  }
  return elements;
}

function renderHand(W: number, H: number, pose: number, mixEnergy: number, shown: number) {
  const s = Math.min(W, 520);
  const cx = W / 2 + (mixEnergy > 0 ? Math.sin(Date.now() / 55) * Math.min(3, mixEnergy * 4) : 0);
  const base = H - s * 0.1 + s * 0.06 + (1 - shown) * H * 0.28; // slides off as it fades
  const cup = pose === 2 ? 0 : Math.min(pose, 1);
  const spreadF = pose === 2 ? 1.22 : 1 - 0.12 * cup;
  const yk = base - s * 0.435;
  const palmW = s * 0.215 * (1 - 0.05 * cup);
  const FX = [-0.78, -0.27, 0.27, 0.8];
  const FL = [0.115, 0.135, 0.125, 0.088];
  const tip = (i: number) => ({
    x: cx + FX[i] * palmW * 1.05 * spreadF + cup * -FX[i] * palmW * 0.16,
    y: yk - s * FL[i] * (1 - 0.4 * cup),
    hw: s * 0.03
  });
  const parts: string[] = [];
  parts.push(`M ${cx - s * 0.125} ${base + s * 0.12}`);
  parts.push(`Q ${cx - palmW * 1.18} ${base - s * 0.1} ${cx - palmW * 1.3} ${base - s * 0.22}`);
  const thTipX = cx - palmW * (1.44 - 0.26 * cup);
  const thTipY = base - s * (0.315 + 0.04 * cup);
  parts.push(`Q ${cx - palmW * 1.44} ${base - s * 0.24} ${thTipX} ${thTipY}`);
  parts.push(`Q ${cx - palmW * (1.3 - 0.2 * cup)} ${base - s * 0.37} ${cx - palmW * 1.02} ${yk + s * 0.055}`);
  for (let i = 0; i < 4; i++) {
    const t = tip(i);
    parts.push(`Q ${t.x - t.hw * 1.4} ${yk - s * 0.015} ${t.x - t.hw} ${t.y + t.hw}`);
    parts.push(`A ${t.hw} ${t.hw} 0 0 1 ${t.x + t.hw} ${t.y + t.hw}`);
    if (i < 3) {
      const next = tip(i + 1);
      const vx = (t.x + next.x) / 2;
      parts.push(`Q ${t.x + t.hw} ${yk - s * 0.02} ${vx} ${yk + s * 0.012}`);
    }
  }
  const last = tip(3);
  parts.push(`Q ${cx + palmW * 1.18} ${yk + s * 0.06} ${cx + palmW * 1.16} ${base - s * 0.2}`);
  parts.push(`Q ${cx + palmW * 1.05} ${base - s * 0.05} ${cx + s * 0.125} ${base + s * 0.12}`);
  void last;
  return (
    <Path
      key="hand"
      d={parts.join(" ")}
      stroke="rgba(229,192,107,0.85)"
      strokeWidth={Math.max(1.3, s * 0.005)}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
      opacity={shown}
    />
  );
}

function rotateBy(orientation: ReturnType<typeof randomOrientation>, spin: Vec3, dt: number) {
  const spinLen = length(spin);
  if (spinLen < 1e-6) return orientation;
  const axis = scale(spin, 1 / spinLen);
  const half = (spinLen * dt) / 2;
  const sin = Math.sin(half);
  const q = { w: Math.cos(half), x: axis.x * sin, y: axis.y * sin, z: axis.z * sin };
  const o = orientation;
  return {
    w: q.w * o.w - q.x * o.x - q.y * o.y - q.z * o.z,
    x: q.w * o.x + q.x * o.w + q.y * o.z - q.z * o.y,
    y: q.w * o.y - q.x * o.z + q.y * o.w + q.z * o.x,
    z: q.w * o.z + q.x * o.y - q.y * o.x + q.z * o.w
  };
}

function jitter(magnitude: number): number {
  return (secureRandom() * 2 - 1) * magnitude;
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.navy950, flex: 1 },
  frame: { alignSelf: "center", flex: 1, maxWidth: 480, width: "100%" },
  header: { alignItems: "center", borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", minHeight: 64, paddingHorizontal: spacing.lg },
  headerTitle: { color: colors.ice, fontSize: 15, fontWeight: "700" },
  headerSpace: { width: 88 },
  headerActions: { flexDirection: "row", gap: 8 },
  iconButton: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 20, borderWidth: 1, height: 40, justifyContent: "center", width: 40 },
  stage: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", padding: spacing.lg },
  questionCard: { backgroundColor: "rgba(58,80,118,0.42)", borderColor: "rgba(206,216,255,0.16)", borderRadius: 22, borderWidth: 1, maxWidth: 420, overflow: "hidden", paddingHorizontal: 16, paddingVertical: 12, width: "88%" },
  questionLabel: { color: "#E9B083", fontSize: 10, fontWeight: "700", letterSpacing: 1.4, marginBottom: 3, textAlign: "center" },
  questionInput: { color: colors.ice, fontFamily: "Georgia", fontSize: 16, minHeight: 32, padding: 0, textAlign: "center" },
  flexSpacer: { flex: 1 },
  hint: { color: colors.ice, fontSize: 15, marginBottom: 12, textAlign: "center", textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 8 },
  brandButtonWrap: { borderRadius: 15, elevation: 6, shadowColor: "#E9B083", shadowOffset: { height: 10, width: 0 }, shadowOpacity: 0.45, shadowRadius: 18 },
  brandButtonGrad: { alignItems: "center", borderRadius: 15, justifyContent: "center", minHeight: 54, paddingHorizontal: 32 },
  brandButtonText: { color: "#3A2218", fontSize: 16, fontWeight: "700" },
  fullWidthButton: { width: "88%" },
  softButton: { alignItems: "center", backgroundColor: "rgba(122,134,200,0.24)", borderColor: "rgba(139,147,212,0.34)", borderRadius: 15, borderWidth: 1, justifyContent: "center", minHeight: 48, paddingHorizontal: 26 },
  softButtonText: { color: "#EAEDFB", fontSize: 14.5, fontWeight: "600" },
  dim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(4,10,20,0.6)" },
  sheetWrap: { borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: "hidden" },
  sheet: { backgroundColor: "rgba(58,80,118,0.42)", borderColor: "rgba(206,216,255,0.16)", borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, paddingBottom: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  sheetQuestion: { color: "#A2B0C6", fontSize: 12.5, fontStyle: "italic", marginBottom: 14, textAlign: "center" },
  symbolsRow: { flexDirection: "row", gap: 8, justifyContent: "center" },
  symbolCell: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.045)", borderColor: "rgba(206,216,255,0.16)", borderRadius: radii.md, borderWidth: 1, flex: 1, maxWidth: 112, paddingVertical: 10 },
  symbolKind: { color: "#A2B0C6", fontSize: 9, fontWeight: "700", letterSpacing: 1 },
  symbolGlyph: { color: colors.gold, fontFamily: "Georgia", fontSize: 36, marginTop: 2 },
  symbolZh: { color: colors.ice, fontSize: 14, marginTop: 2 },
  symbolEn: { color: "#A2B0C6", fontSize: 11 },
  sheetNote: { color: "#A2B0C6", fontSize: 12, marginTop: 12, textAlign: "center" },
  sheetActions: { flexDirection: "row", gap: 10, justifyContent: "center", marginTop: 14 },
  sheetAction: { flex: 1 }
});
