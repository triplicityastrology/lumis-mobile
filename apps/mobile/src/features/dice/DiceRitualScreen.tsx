import { Bell, ChevronLeft } from "lucide-react-native";
import { getRandomValues } from "expo-crypto";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo, Animated, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View
} from "react-native";
import Svg, {
  Defs, Ellipse, Path, Polygon, RadialGradient, Stop, Text as SvgText
} from "react-native-svg";

import { CelestialBackground } from "../../components/CelestialBackground";
import { MainTabBar, type MainTab } from "../../components/MainTabBar";
import { colors, radii, spacing } from "../../theme/tokens";
import { DICE_TIMINGS, DIE_ORDER, FACE_SETS, type DiceFace } from "./constants";
import { DIE_INRADIUS, DIE_RADIUS, DODECA_FACES, DODECA_VERTICES } from "./geometry";
import { add, dot, length, normalize, quatRotate, scale, sub, vec, type Vec3 } from "./math";
import {
  createWorld, groundDie, launch, randomOrientation, resolveSettledFaces, stepWorld,
  type DiceWorld
} from "./physics";
import { configureSecureRandom, secureRandom } from "./rng";
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

  const phaseRef = useRef<Phase>("IDLE");
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

  const beginReady = useCallback(() => {
    if (phaseRef.current !== "IDLE") return;
    transition("READY");
    handPoseRef.current = 1;
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(() => {
      if (phaseRef.current === "READY" || phaseRef.current === "MIXING") setShowTapThrow(true);
    }, DICE_TIMINGS.tapFallbackAfter);
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
      launch(worldRef.current, strength);
      setTimeout(() => {
        if (phaseRef.current === "THROW") transition("TUMBLE");
      }, DICE_TIMINGS.releaseSwap + 40);
    },
    [transition]
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
        if (settled && currentPhase === "TUMBLE") {
          const { readings } = resolveSettledFaces(worldRef.current);
          for (const die of worldRef.current.dice) groundDie(die);
          const [planetReading, signReading, houseReading] = readings;
          setSymbols({
            planet: FACE_SETS.planet[planetReading.faceIndex],
            sign: FACE_SETS.sign[signReading.faceIndex],
            house: FACE_SETS.house[houseReading.faceIndex]
          });
          settleAtRef.current = Date.now();
          transition("SETTLE");
        }
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

      setFrame((f) => (f + 1) % 1_000_000);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    };
  }, [cardAnim, dimAnim, reduceMotion, transition]);

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
          <Pressable style={styles.iconButton} onPress={onNotifications} accessibilityLabel="Notifications">
            <Bell color={colors.ice} size={19} />
          </Pressable>
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
              {showTable ? renderWorldDice(worldRef.current, W, H, cameraZoomRef.current, glowRef.current, symbols) : null}
              {showPalm && handShownRef.current > 0 ? renderHand(W, H, handPoseRef.current, mixEnergyRef.current) : null}
              {showPalm ? renderPalmDice(palmOrientations.current, W, H) : null}
            </Svg>
          ) : null}

          <View pointerEvents="box-none" style={styles.overlay}>
            <View style={styles.questionCard}>
              <Text style={styles.questionLabel}>你嘅問題 · YOUR QUESTION</Text>
              <TextInput
                editable={phase === "IDLE"}
                onChangeText={setQuestion}
                placeholder="輕按輸入你嘅問題…"
                placeholderTextColor={colors.muted}
                style={styles.questionInput}
                value={question}
              />
            </View>

            <View style={styles.flexSpacer} pointerEvents="none" />

            {phase === "READY" || phase === "MIXING" ? (
              <Text style={styles.hint}>搖一搖 mix 一 mix，向上一拋就擲出去</Text>
            ) : null}
            {phase === "IDLE" ? (
              <Pressable onPress={beginReady} style={styles.primaryButton}>
                <Text style={styles.primaryText}>準備好 · Ready</Text>
              </Pressable>
            ) : null}
            {showTapThrow && (phase === "READY" || phase === "MIXING") ? (
              <Pressable onPress={() => performThrow(1)} style={styles.ghostButton}>
                <Text style={styles.ghostText}>輕按擲骰 · Tap to throw</Text>
              </Pressable>
            ) : null}
          </View>

          <Animated.View pointerEvents="none" style={[styles.dim, { opacity: dimAnim }]} />
        </View>

        {phase === "RESULT" || phase === "INTERPRET" ? (
          <Animated.View
            style={[
              styles.sheet,
              {
                transform: [{
                  translateY: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [420, 0] })
                }]
              }
            ]}
          >
            <Text style={styles.sheetQuestion}>
              「{trimmedQuestion || "What should I notice right now?"}」
            </Text>
            <View style={styles.symbolsRow}>
              {symbols
                ? DIE_ORDER.map((kind) => {
                    const face = symbols[kind];
                    const kindLabel = kind === "planet" ? "行星 PLANET" : kind === "sign" ? "星座 SIGN" : "宮位 HOUSE";
                    return (
                      <View key={kind} style={styles.symbolCell}>
                        <Text style={styles.symbolKind}>{kindLabel}</Text>
                        <Text style={styles.symbolGlyph}>{face.glyph}</Text>
                        <Text style={styles.symbolZh}>{face.zh}</Text>
                        <Text style={styles.symbolEn}>{face.en}</Text>
                      </View>
                    );
                  })
                : null}
            </View>
            <Text style={styles.sheetNote}>呢個係一個角度，唔係一個判詞。</Text>
            {phase === "INTERPRET" ? (
              <View style={styles.sheetActions}>
                <Pressable onPress={rethrow} style={styles.sheetGhost}>
                  <Text style={styles.ghostText}>再擲一次</Text>
                </Pressable>
                <Pressable onPress={() => onReflect(reflectionPrompt)} style={styles.sheetPrimary}>
                  <Text style={styles.primaryText}>返回傾偈</Text>
                </Pressable>
              </View>
            ) : null}
          </Animated.View>
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

function shadeFace(normal: Vec3, t: number): string {
  const lambert = Math.max(0, dot(normal, LIGHT));
  const h = 252 - t * 20;
  const s = 46 + lambert * 10;
  const l = 30 + lambert * 24;
  return `hsl(${h.toFixed(0)}, ${s.toFixed(0)}%, ${l.toFixed(0)}%)`;
}

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
  symbols: StageSymbols | null
) {
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

  type FaceDraw = { depth: number; el: React.JSX.Element[] };
  const faces: FaceDraw[] = [];
  world.dice.forEach((die, dieIndex) => {
    const faceSet = FACE_SETS[DIE_ORDER[dieIndex]];
    const worldVerts = DODECA_VERTICES.map((v) => add(quatRotate(die.orientation, v), die.position));
    DODECA_FACES.forEach((face, faceIndex) => {
      const n = quatRotate(die.orientation, face.normal);
      const center = add(quatRotate(die.orientation, face.center), die.position);
      const camPos = cameraPose(zoom).pos;
      if (dot(n, sub(camPos, center)) <= 0) return;
      const projected = face.vertexIndices.map((vi) => projectPoint(worldVerts[vi], W, H, zoom, 0));
      const pts = projected.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
      const c = projectPoint(center, W, H, zoom, 0);
      const els: React.JSX.Element[] = [
        <Polygon
          key={`f${dieIndex}-${faceIndex}`}
          points={pts}
          fill={shadeFace(n, (faceIndex * 0.618) % 1)}
          stroke="rgba(216,208,250,0.28)"
          strokeWidth={0.7}
        />
      ];
      if (dot(normalize(n), normalize(sub(camPos, center))) > 0.25) {
        const u0 = normalize(sub(DODECA_VERTICES[face.vertexIndices[0]], face.center));
        const v0 = crossV(face.normal, u0);
        const wu = quatRotate(die.orientation, u0);
        const wv = quatRotate(die.orientation, v0);
        const pu = projectPoint(add(center, scale(wu, DIE_INRADIUS)), W, H, zoom, 0);
        const pv = projectPoint(add(center, scale(wv, DIE_INRADIUS)), W, H, zoom, 0);
        const ax = pu.x - c.x;
        const ay = pu.y - c.y;
        let bx = pv.x - c.x;
        let by = pv.y - c.y;
        if (ax * by - ay * bx < 0) { bx = -bx; by = -by; } // never mirror glyphs
        const isTop = glow > 0 && n.y > 0.9;
        const glyphColor = isTop
          ? `rgba(${232},${205 + Math.round(glow * 20)},${154},1)`
          : "rgba(216,176,110,0.9)";
        const k = 0.11;
        els.push(
          <SvgText
            key={`g${dieIndex}-${faceIndex}`}
            transform={`matrix(${(ax * k).toFixed(3)}, ${(ay * k).toFixed(3)}, ${(bx * k).toFixed(3)}, ${(by * k).toFixed(3)}, ${c.x.toFixed(1)}, ${c.y.toFixed(1)})`}
            fontSize={10}
            fontFamily="Georgia"
            fill={glyphColor}
            textAnchor="middle"
          >
            {faceSet[faceIndex].glyph}
          </SvgText>
        );
        if (isTop) {
          els.push(
            <Ellipse
              key={`gl${dieIndex}-${faceIndex}`}
              cx={c.x} cy={c.y}
              rx={DIE_INRADIUS * 2.6 * (FOCAL * (1 + zoom * 0.22) * H) / 7.5}
              ry={DIE_INRADIUS * 2.6 * (FOCAL * (1 + zoom * 0.22) * H) / 7.5}
              fill="url(#glowGrad)"
              opacity={glow}
            />
          );
        }
      }
      faces.push({ depth: c.z, el: els });
    });
  });

  faces.sort((a, b) => b.depth - a.depth);
  for (const f of faces) elements.push(...f.el);
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
    for (const { face, fi, n } of faces) {
      const pts = face.vertexIndices
        .map((vi) => projectLocal(DODECA_VERTICES[vi]))
        .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
        .join(" ");
      elements.push(
        <Polygon
          key={`pf${i}-${fi}`}
          points={pts}
          fill={shadeFace(n, (fi * 0.618) % 1)}
          stroke="rgba(216,208,250,0.2)"
          strokeWidth={0.6}
        />
      );
    }
  }
  return elements;
}

function renderHand(W: number, H: number, pose: number, mixEnergy: number) {
  const s = Math.min(W, 520);
  const cx = W / 2 + (mixEnergy > 0 ? Math.sin(Date.now() / 55) * Math.min(3, mixEnergy * 4) : 0);
  const base = H - s * 0.1 + s * 0.06;
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
  headerSpace: { width: 40 },
  iconButton: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 20, borderWidth: 1, height: 40, justifyContent: "center", width: 40 },
  stage: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", padding: spacing.lg },
  questionCard: { backgroundColor: "rgba(22,39,61,0.72)", borderColor: colors.line, borderRadius: radii.md, borderWidth: 1, maxWidth: 420, paddingHorizontal: 16, paddingVertical: 10, width: "88%" },
  questionLabel: { color: "#E9B083", fontSize: 10, fontWeight: "700", letterSpacing: 1.4, marginBottom: 3, textAlign: "center" },
  questionInput: { color: colors.ice, fontFamily: "Georgia", fontSize: 16, minHeight: 32, padding: 0, textAlign: "center" },
  flexSpacer: { flex: 1 },
  hint: { color: colors.ice, fontSize: 15, marginBottom: 12, textAlign: "center", textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 8 },
  primaryButton: { alignItems: "center", backgroundColor: colors.gold, borderRadius: radii.pill, justifyContent: "center", minHeight: 54, paddingHorizontal: 44, width: "88%" },
  primaryText: { color: colors.navy950, fontSize: 16, fontWeight: "700" },
  ghostButton: { alignItems: "center", backgroundColor: "rgba(46,66,102,0.52)", borderColor: "rgba(243,203,169,0.4)", borderRadius: radii.pill, borderWidth: 1, justifyContent: "center", minHeight: 46, paddingHorizontal: 30 },
  ghostText: { color: "#F3CBA9", fontSize: 14.5, fontWeight: "600" },
  dim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(4,10,20,0.6)" },
  sheet: { backgroundColor: colors.cream, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingBottom: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  sheetQuestion: { color: "#948A7C", fontSize: 12.5, marginBottom: 14, textAlign: "center" },
  symbolsRow: { flexDirection: "row", gap: 8, justifyContent: "center" },
  symbolCell: { alignItems: "center", backgroundColor: "rgba(201,169,110,0.09)", borderColor: "rgba(180,134,63,0.32)", borderRadius: radii.md, borderWidth: 1, flex: 1, maxWidth: 112, paddingVertical: 10 },
  symbolKind: { color: "#a0895c", fontSize: 9, fontWeight: "700", letterSpacing: 1 },
  symbolGlyph: { color: "#B4863F", fontFamily: "Georgia", fontSize: 36, marginTop: 2 },
  symbolZh: { color: "#2B2620", fontSize: 14, marginTop: 2 },
  symbolEn: { color: "#948A7C", fontSize: 11 },
  sheetNote: { color: "#948A7C", fontSize: 12, marginTop: 12, textAlign: "center" },
  sheetActions: { flexDirection: "row", gap: 10, justifyContent: "center", marginTop: 14 },
  sheetGhost: { alignItems: "center", backgroundColor: "rgba(46,66,102,0.15)", borderColor: "rgba(180,134,63,0.4)", borderRadius: radii.pill, borderWidth: 1, flex: 1, justifyContent: "center", minHeight: 48 },
  sheetPrimary: { alignItems: "center", backgroundColor: colors.gold, borderRadius: radii.pill, flex: 1, justifyContent: "center", minHeight: 48 }
});
