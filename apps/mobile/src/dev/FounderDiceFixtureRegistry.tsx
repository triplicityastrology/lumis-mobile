import ChevronLeft from "lucide-react-native/icons/chevron-left";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import LockKeyhole from "lucide-react-native/icons/lock-keyhole";
import Snowflake from "lucide-react-native/icons/snowflake";
import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { DiceLanguage } from "@lumis/shared";

import { CelestialBackground } from "../components/CelestialBackground";
import { DiceRitualScreen } from "../features/dice/DiceRitualScreen";
import { colors, spacing } from "../theme/tokens";
import { classifyLocalDraft, freezeLocalFounderFixture, type FrozenFounderFixtureEnvelope } from "./diceFixturePreparation";

const REGISTRY_VERSION = "dice-synthetic-registry-v0.3.0";
const SLOT_COUNTS: Record<DiceLanguage, number> = { en: 20, "zh-Hant": 20 };

export function FounderDiceFixtureRegistry() {
  const [language, setLanguage] = useState<DiceLanguage>("en");
  const [slotIndex, setSlotIndex] = useState(1);
  const [question, setQuestion] = useState("What can I notice about this friendship?");
  const [frozen, setFrozen] = useState<FrozenFounderFixtureEnvelope | null>(null);
  const buildMarker = resolveBuildMarker(process.env.EXPO_PUBLIC_DICE_FIXTURE_REGISTRY_HEAD);
  const decision = useMemo(() => classifyLocalDraft(question, language), [language, question]);
  const fixtureId = `DICE-FOUNDER-${language === "en" ? "EN" : "ZH"}-${String(slotIndex).padStart(2, "0")}`;

  const changeLanguage = (next: DiceLanguage) => {
    setLanguage(next);
    setSlotIndex(1);
    setFrozen(null);
    setQuestion(next === "en" ? "What can I notice about this friendship?" : "我可以如何理解這段友誼？");
  };
  const freeze = () => {
    setFrozen(freezeLocalFounderFixture(fixtureId, language, decision));
  };

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.root}>
      <CelestialBackground />
      <View accessibilityLabel="Founder synthetic fixture preparation controls. Outside customer product pixels." style={styles.controlPanel}>
        <View style={styles.headingRow}>
          <View style={styles.headingCopy}>
            <Text accessibilityRole="header" style={styles.title}>Dice Founder fixture preparation</Text>
            <Text style={styles.disclaimer}>Local synthetic draft · no provider · no persistence · no units</Text>
          </View>
          <LockKeyhole color={colors.goldLight} size={20} />
        </View>
        <View accessibilityRole="tablist" style={styles.tabs}>
          {(["en", "zh-Hant"] as const).map((item) => (
            <Pressable accessibilityRole="tab" accessibilityState={{ selected: language === item }} key={item} onPress={() => changeLanguage(item)} style={[styles.tab, language === item && styles.tabSelected]}>
              <Text style={[styles.tabText, language === item && styles.tabTextSelected]}>{item}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.slotRow}>
          <Pressable accessibilityLabel="Previous reserved slot" accessibilityRole="button" disabled={slotIndex === 1} onPress={() => { setSlotIndex((value) => value - 1); setFrozen(null); }} style={styles.iconButton}><ChevronLeft color={colors.ice} size={18} /></Pressable>
          <Text selectable style={styles.slot}>{fixtureId} · reserved {slotIndex}/{SLOT_COUNTS[language]}</Text>
          <Pressable accessibilityLabel="Next reserved slot" accessibilityRole="button" disabled={slotIndex === SLOT_COUNTS[language]} onPress={() => { setSlotIndex((value) => value + 1); setFrozen(null); }} style={styles.iconButton}><ChevronRight color={colors.ice} size={18} /></Pressable>
        </View>
        <TextInput accessibilityLabel="Synthetic Dice question" multiline onChangeText={(value) => { setQuestion(value); setFrozen(null); }} placeholder={language === "en" ? "Draft one synthetic question" : "草擬一條合成問題"} placeholderTextColor={colors.muted} style={styles.input} value={question} />
        <View style={styles.resultRow}>
          <Text accessibilityLiveRegion="polite" style={[styles.result, !decision.ok && styles.error]}>{decision.ok ? `${decision.route} · ${decision.shape}` : decision.code}</Text>
          <Pressable accessibilityLabel="Freeze reviewed synthetic fixture" accessibilityRole="button" disabled={!decision.ok} onPress={freeze} style={[styles.freezeButton, !decision.ok && styles.disabled]}>
            <Snowflake color={colors.navy950} size={16} />
            <Text style={styles.freezeText}>Freeze fixture</Text>
          </Pressable>
        </View>
        <Text accessibilityLiveRegion="polite" style={styles.frozen}>{frozen ? `Frozen locally: ${frozen.fixture_id} · ${frozen.expected_route}` : "Not frozen · review before allow-list export"}</Text>
        <Text selectable style={styles.marker}>BUILD {buildMarker} · {REGISTRY_VERSION}</Text>
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.productFrame}>
        <DiceRitualScreen
          developmentInitialQuestion={decision.ok ? decision.question : question}
          developmentLanguage={language}
          developmentNoPersistence
          developmentPreSubmitBoundary
          onBack={() => undefined}
          onNotifications={() => undefined}
          onReflect={() => undefined}
          onSelectTab={() => undefined}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function resolveBuildMarker(value: string | undefined): string {
  return value && /^[0-9a-f]{40}$/.test(value) ? value : "INVALID_BUILD_MARKER";
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.navy950, flex: 1 },
  controlPanel: { backgroundColor: "rgba(6,16,28,0.98)", borderBottomColor: colors.line, borderBottomWidth: 1, gap: 8, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  headingRow: { alignItems: "center", flexDirection: "row", gap: 12 },
  headingCopy: { flex: 1 },
  title: { color: colors.ice, fontSize: 17, fontWeight: "700" },
  disclaimer: { color: colors.textSoft, fontSize: 11, lineHeight: 15 },
  tabs: { flexDirection: "row", gap: 8 },
  tab: { borderColor: colors.line, borderRadius: 6, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 },
  tabSelected: { backgroundColor: colors.gold },
  tabText: { color: colors.ice, fontSize: 12, fontWeight: "700" },
  tabTextSelected: { color: colors.navy950 },
  slotRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  slot: { color: colors.goldLight, flex: 1, fontFamily: "monospace", fontSize: 11, textAlign: "center" },
  iconButton: { alignItems: "center", borderColor: colors.line, borderRadius: 18, borderWidth: 1, height: 36, justifyContent: "center", width: 36 },
  input: { backgroundColor: "rgba(22,39,61,0.96)", borderColor: colors.line, borderRadius: 6, borderWidth: 1, color: colors.ice, fontSize: 15, maxHeight: 84, minHeight: 52, paddingHorizontal: 12, paddingVertical: 9 },
  resultRow: { alignItems: "center", flexDirection: "row", gap: 10 },
  result: { color: colors.good, flex: 1, fontSize: 12, fontWeight: "700" },
  error: { color: colors.goldLight },
  freezeButton: { alignItems: "center", backgroundColor: colors.gold, borderRadius: 6, flexDirection: "row", gap: 6, minHeight: 38, paddingHorizontal: 12 },
  disabled: { opacity: 0.42 },
  freezeText: { color: colors.navy950, fontSize: 12, fontWeight: "800" },
  frozen: { color: colors.textSoft, fontSize: 11 },
  marker: { color: colors.muted, fontFamily: "monospace", fontSize: 8 },
  productFrame: { flex: 1, minHeight: 0 },
});
