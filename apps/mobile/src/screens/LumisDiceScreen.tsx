import { Accelerometer } from "expo-sensors";
import Bell from "lucide-react-native/icons/bell";
import ChevronLeft from "lucide-react-native/icons/chevron-left";
import Dices from "lucide-react-native/icons/dices";
import MessageCircle from "lucide-react-native/icons/message-circle";
import Sparkles from "lucide-react-native/icons/sparkles";
import { useEffect, useRef, useState } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Svg, { Polygon } from "react-native-svg";

import { CelestialBackground } from "../components/CelestialBackground";
import { MainTabBar, type MainTab } from "../components/MainTabBar";
import { colors, radii, spacing } from "../theme/tokens";

type DiceStep = "ask" | "shake" | "result";
type DieKind = "Planet" | "Sign" | "House";
type DieResult = { glyph: string; kind: DieKind; name: string };

const PLANETS: DieResult[] = [
  { glyph: "☉", kind: "Planet", name: "Sun" },
  { glyph: "☽", kind: "Planet", name: "Moon" },
  { glyph: "☿", kind: "Planet", name: "Mercury" },
  { glyph: "♀", kind: "Planet", name: "Venus" },
  { glyph: "♂", kind: "Planet", name: "Mars" },
  { glyph: "♃", kind: "Planet", name: "Jupiter" },
  { glyph: "♄", kind: "Planet", name: "Saturn" }
];
const SIGNS: DieResult[] = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"
].map((name, index) => ({ glyph: ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"][index], kind: "Sign", name }));
const HOUSES: DieResult[] = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"]
  .map((glyph, index) => ({ glyph, kind: "House", name: `${ordinal(index + 1)} house` }));
const EXAMPLE_QUESTION = "Should I say yes to the new project?";

export function LumisDiceScreen({
  onNotifications,
  onReflect,
  onSelectTab
}: {
  onNotifications: () => void;
  onReflect: (chatDraft: string) => void;
  onSelectTab: (tab: MainTab) => void;
}) {
  const [step, setStep] = useState<DiceStep>("ask");
  const [question, setQuestion] = useState("");
  const [rolling, setRolling] = useState(false);
  const [display, setDisplay] = useState(["♀", "♐", "X"]);
  const [result, setResult] = useState<DieResult[] | null>(null);
  const rollingRef = useRef(false);
  const lastShakeAt = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rollRef = useRef<() => void>(() => undefined);

  function roll() {
    if (rollingRef.current) return;

    rollingRef.current = true;
    setRolling(true);
    setResult(null);
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    intervalRef.current = setInterval(() => {
      setDisplay([pick(PLANETS).glyph, pick(SIGNS).glyph, pick(HOUSES).glyph]);
    }, 90);

    timeoutRef.current = setTimeout(() => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      const nextResult = [pick(PLANETS), pick(SIGNS), pick(HOUSES)];
      setResult(nextResult);
      setDisplay(nextResult.map((item) => item.glyph));
      setRolling(false);
      rollingRef.current = false;
      setStep("result");
    }, 1300);
  }
  rollRef.current = roll;

  useEffect(() => {
    if (step !== "shake") return;

    let active = true;
    let subscription: { remove: () => void } | null = null;
    void Accelerometer.isAvailableAsync().then((available) => {
      if (!active || !available) return;
      Accelerometer.setUpdateInterval(120);
      subscription = Accelerometer.addListener(({ x, y, z }) => {
        const now = Date.now();
        if (Math.abs(x) + Math.abs(y) + Math.abs(z) > 3.4 && now - lastShakeAt.current > 1400) {
          lastShakeAt.current = now;
          rollRef.current();
        }
      });
    });

    return () => {
      active = false;
      subscription?.remove();
    };
  }, [step]);

  function clearRollTimers() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    intervalRef.current = null;
    timeoutRef.current = null;
  }

  useEffect(() => () => clearRollTimers(), []);

  function cancelRoll() {
    clearRollTimers();
    setStep("ask");
    setRolling(false);
    rollingRef.current = false;
    setResult(null);
  }

  function reset() {
    cancelRoll();
  }

  const resultTitle = result ? `${result[0].name} in ${result[1].name}, ${result[2].name}.` : "";
  const reflectionPrompt = result
    ? `Help me reflect on my astrology dice roll. My question was: “${question || "What should I notice right now?"}” I rolled ${resultTitle}`
    : "";

  return (
    <SafeAreaView style={styles.safe}>
      <CelestialBackground />
      <View style={styles.frame}>
        <View style={styles.header}>
          {step === "ask" ? <View style={styles.headerSpace} /> : (
            <Pressable style={styles.iconButton} onPress={step === "result" ? reset : cancelRoll} accessibilityLabel="Back">
              <ChevronLeft color={colors.ice} size={20} />
            </Pressable>
          )}
          <Text style={styles.headerTitle}>Astrology Dice</Text>
          <Pressable style={styles.iconButton} onPress={onNotifications} accessibilityLabel="Notifications">
            <Bell color={colors.ice} size={19} />
          </Pressable>
        </View>

        {step === "ask" ? (
          <ScrollView contentContainerStyle={styles.askContent} keyboardShouldPersistTaps="handled">
            <View>
              <Text style={styles.eyebrow}>A REFLECTIVE ROLL</Text>
              <Text style={styles.title}>Hold one question lightly.</Text>
              <Text style={styles.intro}>Three dice, planet, sign, and house, become a prompt to think with.</Text>
            </View>
            <TextInput
              onChangeText={setQuestion}
              placeholder="What is your question?"
              placeholderTextColor={colors.muted}
              style={styles.input}
              value={question}
            />
            <Pressable onPress={() => setQuestion(EXAMPLE_QUESTION)} style={styles.exampleButton}>
              <Text style={styles.exampleText}>“{EXAMPLE_QUESTION}”</Text>
            </Pressable>
            <View style={styles.flexSpacer} />
            <Pressable onPress={() => setStep("shake")} style={styles.primaryButton}>
              <Text style={styles.primaryText}>Next</Text>
              <ChevronLeft color={colors.navy950} size={20} style={styles.nextIcon} />
            </Pressable>
            <Text style={styles.note}>Dice are a mirror for reflection, not a verdict.</Text>
          </ScrollView>
        ) : null}

        {step === "shake" ? (
          <View style={styles.shakeContent}>
            <View style={styles.shakeCenter}>
              {question ? <Text style={styles.question}>“{question}”</Text> : null}
              <Text style={styles.shakeTitle}>{rolling ? "Rolling..." : "Shake to roll"}</Text>
              {!rolling ? <Dices color={colors.gold} size={30} /> : null}
              <Pressable accessibilityRole="button" onPress={roll} style={styles.diceRow}>
                {display.map((glyph, index) => <OctaDie glyph={glyph} key={`${index}-${glyph}`} rolling={rolling} size={84} />)}
              </Pressable>
              <View style={styles.labelsRow}>
                {(["Planet", "Sign", "House"] as const).map((label) => <Text key={label} style={styles.dieLabel}>{label}</Text>)}
              </View>
              {!rolling ? <Text style={styles.shakeHint}>Give your phone a shake, or tap the dice to roll.</Text> : null}
            </View>
            <Pressable disabled={rolling} onPress={roll} style={[styles.primaryButton, rolling && styles.disabled]}>
              <Dices color={colors.navy950} size={20} />
              <Text style={styles.primaryText}>{rolling ? "Rolling..." : "Roll the dice"}</Text>
            </Pressable>
          </View>
        ) : null}

        {step === "result" && result ? (
          <ScrollView contentContainerStyle={styles.resultContent}>
            <View style={styles.companionRow}>
              <View style={styles.avatar}><Sparkles color={colors.navy950} size={17} /></View>
              <View><Text style={styles.companionName}>Lumis</Text><Text style={styles.companionSub}>Reading your roll</Text></View>
            </View>
            {question ? <Text style={styles.question}>“{question}”</Text> : null}
            <View style={styles.resultDiceRow}>
              {result.map((item) => (
                <View key={item.kind} style={styles.resultDieCell}>
                  <OctaDie glyph={item.glyph} size={65} />
                  <Text style={styles.resultKind}>{item.kind}</Text>
                  <Text numberOfLines={2} style={styles.resultName}>{item.name}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.resultTitle}>{resultTitle}</Text>
            <View style={styles.readingBubble}>
              <Text style={styles.readingText}>
                This brings together {result[0].name}, the style of {result[1].name}, and the life area of the {result[2].name}. Notice where that combination feels alive in your question, without treating it as a fixed prediction.
              </Text>
            </View>
            <View style={styles.reflectCard}>
              <Text style={styles.reflectLabel}>A QUESTION TO SIT WITH</Text>
              <Text style={styles.reflectQuestion}>What would become clearer if you treated this roll as a new angle rather than an answer?</Text>
            </View>
            <View style={styles.resultActions}>
              <Pressable onPress={reset} style={styles.secondaryButton}><Dices color={colors.ice} size={18} /><Text style={styles.secondaryText}>Roll again</Text></Pressable>
              <Pressable onPress={() => onReflect(reflectionPrompt)} style={styles.chatButton}><MessageCircle color={colors.gold} size={18} /><Text style={styles.chatText}>Save this reflection</Text></Pressable>
            </View>
            <Text style={styles.note}>Dice are a mirror for reflection, not a verdict.</Text>
          </ScrollView>
        ) : null}

        <MainTabBar active="dice" onSelect={onSelectTab} />
      </View>
    </SafeAreaView>
  );
}

function OctaDie({ glyph, rolling = false, size }: { glyph: string; rolling?: boolean; size: number }) {
  return (
    <View style={[styles.octa, { height: size, opacity: rolling ? 0.72 : 1, width: size }]}>
      <Svg height={size} viewBox="0 0 100 100" width={size}>
        <Polygon fill="#152943" points="50,2 84,16 98,50 84,84 50,98 16,84 2,50 16,16" stroke="#C9A96E" strokeWidth="2" />
        <Polygon fill="none" opacity={0.35} points="50,14 76,24 86,50 76,76 50,86 24,76 14,50 24,24" stroke="#DCC28F" strokeWidth="1" />
      </Svg>
      <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.octaGlyph, { fontSize: size * 0.36 }]}>{glyph}</Text>
    </View>
  );
}

function pick<T>(values: T[]) {
  return values[Math.floor(Math.random() * values.length)];
}

function ordinal(value: number) {
  if (value === 1) return "1st";
  if (value === 2) return "2nd";
  if (value === 3) return "3rd";
  return `${value}th`;
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.navy950, flex: 1 },
  frame: { alignSelf: "center", flex: 1, maxWidth: 480, width: "100%" },
  header: { alignItems: "center", borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", minHeight: 64, paddingHorizontal: spacing.lg },
  headerTitle: { color: colors.ice, fontSize: 15, fontWeight: "700" },
  headerSpace: { width: 40 },
  iconButton: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 20, borderWidth: 1, height: 40, justifyContent: "center", width: 40 },
  askContent: { flexGrow: 1, gap: spacing.md, padding: spacing.lg, paddingBottom: 24 },
  eyebrow: { color: colors.gold, fontSize: 9.5, fontWeight: "700", letterSpacing: 1.6, marginBottom: 10 },
  title: { color: colors.ice, fontFamily: "Georgia", fontSize: 29, lineHeight: 36 },
  intro: { color: colors.textSoft, fontSize: 14, lineHeight: 21, marginTop: 9 },
  input: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radii.md, borderWidth: 1, color: colors.ice, fontSize: 15, minHeight: 54, outlineStyle: "none", paddingHorizontal: 15 } as never,
  exampleButton: { alignSelf: "flex-start", minHeight: 38, justifyContent: "center" },
  exampleText: { color: colors.goldLight, fontSize: 12.5, fontStyle: "italic" },
  flexSpacer: { flex: 1, minHeight: 100 },
  primaryButton: { alignItems: "center", backgroundColor: colors.gold, borderRadius: radii.md, flexDirection: "row", gap: 9, justifyContent: "center", minHeight: 54 },
  primaryText: { color: colors.navy950, fontSize: 15, fontWeight: "700" },
  nextIcon: { transform: [{ rotate: "180deg" }] },
  note: { color: colors.muted, fontSize: 10.5, lineHeight: 16, marginTop: 10, textAlign: "center" },
  shakeContent: { flex: 1, justifyContent: "space-between", padding: spacing.lg },
  shakeCenter: { alignItems: "center", flex: 1, justifyContent: "center" },
  question: { color: colors.textSoft, fontSize: 12.5, fontStyle: "italic", lineHeight: 19, marginBottom: 12, textAlign: "center" },
  shakeTitle: { color: colors.ice, fontFamily: "Georgia", fontSize: 28, marginBottom: 14 },
  diceRow: { flexDirection: "row", gap: 9, marginBottom: 7, marginTop: 17 },
  labelsRow: { flexDirection: "row", gap: 9 },
  dieLabel: { color: colors.muted, fontSize: 9.5, fontWeight: "700", textAlign: "center", width: 84 },
  shakeHint: { color: colors.textSoft, fontSize: 12, marginTop: 17, textAlign: "center" },
  disabled: { opacity: 0.6 },
  resultContent: { padding: spacing.lg, paddingBottom: 28 },
  companionRow: { alignItems: "center", flexDirection: "row", gap: 10, marginBottom: 17 },
  avatar: { alignItems: "center", backgroundColor: colors.gold, borderRadius: 20, height: 40, justifyContent: "center", width: 40 },
  companionName: { color: colors.ice, fontSize: 14.5, fontWeight: "700" },
  companionSub: { color: colors.muted, fontSize: 10.5, marginTop: 2 },
  resultDiceRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  resultDieCell: { alignItems: "center", flex: 1, minWidth: 0 },
  resultKind: { color: colors.gold, fontSize: 8.5, fontWeight: "700", letterSpacing: 0.8, marginTop: 7, textTransform: "uppercase" },
  resultName: { color: colors.ice, fontSize: 10.5, lineHeight: 14, marginTop: 3, minHeight: 28, paddingHorizontal: 2, textAlign: "center" },
  resultTitle: { color: colors.ice, fontFamily: "Georgia", fontSize: 23, lineHeight: 30 },
  readingBubble: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radii.md, borderWidth: 1, marginTop: 12, padding: 15 },
  readingText: { color: colors.textSoft, fontSize: 13, lineHeight: 20 },
  reflectCard: { backgroundColor: colors.periwinkleFill, borderColor: colors.line, borderRadius: radii.md, borderWidth: 1, marginTop: 13, padding: 14 },
  reflectLabel: { color: colors.gold, fontSize: 8.5, fontWeight: "700", letterSpacing: 1.1 },
  reflectQuestion: { color: colors.ice, fontFamily: "Georgia", fontSize: 16, lineHeight: 23, marginTop: 7 },
  resultActions: { flexDirection: "row", gap: 9, marginTop: 18 },
  secondaryButton: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radii.md, borderWidth: 1, flex: 1, flexDirection: "row", gap: 7, justifyContent: "center", minHeight: 50 },
  secondaryText: { color: colors.ice, fontSize: 12, fontWeight: "700" },
  chatButton: { alignItems: "center", borderColor: colors.gold, borderRadius: radii.md, borderWidth: 1, flex: 1.25, flexDirection: "row", gap: 7, justifyContent: "center", minHeight: 50 },
  chatText: { color: colors.gold, fontSize: 11.5, fontWeight: "700" },
  octa: { alignItems: "center", justifyContent: "center" },
  octaGlyph: { color: colors.goldLight, fontFamily: "Georgia", fontWeight: "700", position: "absolute", textAlign: "center", width: "70%" }
});
