import ChevronLeft from "lucide-react-native/icons/chevron-left";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import { classifyDiceQuestionRequest } from "@lumis/shared";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CelestialBackground } from "../components/CelestialBackground";
import { DiceRitualScreen } from "../features/dice/DiceRitualScreen";
import { colors, radii, spacing } from "../theme/tokens";
import { FOUNDER_ENGLISH_DRAFTS, FOUNDER_EXCLUDED_ZH_AUTHORING_ID, FOUNDER_ZH_HANT_DRAFTS } from "./founderDiceQuestionBank";

type ReviewCase = Readonly<{
  id: "open" | "en01" | "zh08" | "zh09" | "fallback";
  label: string;
  question: string;
  expected: string;
}>;

const ZH08 = FOUNDER_ZH_HANT_DRAFTS.find((item) => item.authoring_id === "ZH08")!;
const ZH09 = FOUNDER_ZH_HANT_DRAFTS.find((item) => item.authoring_id === "ZH09")!;
const CASES: readonly ReviewCase[] = Object.freeze([
  { id: "open", label: "Try your own question", question: "", expected: "A clear single question can proceed to the existing roll." },
  { id: "en01", label: "EN accepted control", question: FOUNDER_ENGLISH_DRAFTS[0].exact_text, expected: "Accepted before roll; classification remains outside product pixels." },
  { id: "zh08", label: "ZH08 bundled rejection", question: ZH08.exact_text, expected: "External classifier rejects it as bundled; product enforcement awaits an authorized interface hook." },
  { id: "zh09", label: "ZH09 accepted control", question: ZH09.exact_text, expected: "Accepted as one timing question." },
  { id: "fallback", label: "Safe fallback boundary", question: "What should I notice about this situation?", expected: "The current signed-off Dice screen has no authorized AI-result slot; fallback remains external and zero-effect." },
]);

type ExternalState = Readonly<{
  title: string;
  detail: string;
  classification: string;
}>;

const INITIAL_STATE: ExternalState = Object.freeze({
  title: "Ready for a question",
  detail: "Use the unchanged Lumis Dice screen below. Validation runs before the existing roll transition.",
  classification: "not evaluated",
});

export function FounderDiceInterpretationWorkbench({ onBack }: { onBack: () => void }) {
  const [caseIndex, setCaseIndex] = useState(0);
  const [externalState, setExternalState] = useState<ExternalState>(INITIAL_STATE);
  const [interpretation, setInterpretation] = useState<string | null>(null);
  const selected = CASES[caseIndex];
  const build = process.env.EXPO_PUBLIC_FOUNDER_DICE_E2E_HEAD ?? "unavailable";

  const changeCase = (next: number) => {
    const nextIndex = (next + CASES.length) % CASES.length;
    const nextCase = CASES[nextIndex];
    setCaseIndex(nextIndex);
    setExternalState(classifyExternalCase(nextCase));
    setInterpretation(null);
  };

  const handleInterpretationBoundary = () => {
    setExternalState((current) => ({ ...current, title: "Preparing interpretation", detail: "Zero-network local boundary check. The product screen remains unchanged." }));
    setExternalState((current) => ({ ...current, title: "Interpretation interface not authorized", detail: "The signed-off Dice screen has no approved AI-response slot. Integration stops here instead of changing customer pixels." }));
    setInterpretation("SAFE_STOP_DICE_INTERPRETATION_INTERFACE_SLOT_NOT_AUTHORIZED");
  };

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.safe}>
      <CelestialBackground />
      <View accessibilityLabel="Founder Dice evidence controls outside the product screen" style={styles.externalPanel}>
        <View style={styles.pagerRow}>
          <Pressable accessibilityLabel="Previous Founder test case" accessibilityRole="button" onPress={() => changeCase(caseIndex - 1)} style={styles.iconButton}><ChevronLeft color={colors.ice} size={18} /></Pressable>
          <View style={styles.externalCopy}>
            <Text accessibilityRole="header" style={styles.caseLabel}>{selected.label}</Text>
            <Text style={styles.statusTitle}>{externalState.title}</Text>
            <Text style={styles.statusDetail}>{externalState.detail}</Text>
          </View>
          <Pressable accessibilityLabel="Next Founder test case" accessibilityRole="button" onPress={() => changeCase(caseIndex + 1)} style={styles.iconButton}><ChevronRight color={colors.ice} size={18} /></Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.evidenceRail}>
          <Text selectable style={styles.evidenceText}>Expected: {selected.expected}</Text>
          <Text selectable style={styles.evidenceText}>Type exactly: {selected.question || "your own single question"}</Text>
          <Text selectable style={styles.evidenceText}>Classification: {externalState.classification}</Text>
          <Text selectable style={styles.evidenceText}>Build: {build}</Text>
          <Text selectable style={styles.evidenceText}>Registry: 20 EN + 20 zh-Hant · excludes {FOUNDER_EXCLUDED_ZH_AUTHORING_ID}</Text>
          <Text selectable style={styles.evidenceText}>Effects: provider 0 · persistence 0 · units 0</Text>
          {interpretation ? <Text selectable style={styles.evidenceText}>{interpretation}</Text> : null}
        </ScrollView>
      </View>
      <View style={styles.productFrame}>
        <DiceRitualScreen
          key={selected.id}
          onBack={onBack}
          onNotifications={() => undefined}
          onReflect={handleInterpretationBoundary}
          onSelectTab={() => undefined}
        />
      </View>
    </SafeAreaView>
  );
}

function classifyExternalCase(reviewCase: ReviewCase): ExternalState {
  if (!reviewCase.question) return INITIAL_STATE;
  const result = classifyDiceQuestionRequest({ question: reviewCase.question });
  return result.accepted
    ? { title: "External preflight accepted", detail: "Type the exact question in the unchanged product field. The current product interface does not expose an injectable validation hook.", classification: `${result.route} · ${result.shape} · ${result.language}` }
    : { title: validationTitle(result.code), detail: `${validationGuidance(result.code)} The signed-off product interface cannot yet enforce this result without an approved boundary.`, classification: `rejected · ${result.code}` };
}

function validationTitle(code: string): string {
  if (code === "DICE_QUESTION_BUNDLED") return "Ask one question for this throw";
  if (code === "DICE_QUESTION_SAFETY_ROUTE_REQUIRED") return "Use immediate human support";
  if (code === "DICE_QUESTION_PROFESSIONAL_ROUTE_REQUIRED") return "Professional guidance is needed";
  if (code === "DICE_QUESTION_SCOPE_EXCLUDED") return "This is outside Dice scope";
  return "Make the question clearer";
}

function validationGuidance(code: string): string {
  if (code === "DICE_QUESTION_BUNDLED") return "Split the request into one question and try again. No roll, provider call, unit, or persistence action occurred.";
  return `Correct the question before rolling. ${code}. No effect occurred.`;
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.navy950, flex: 1 },
  externalPanel: { backgroundColor: "#071422", borderBottomColor: colors.line, borderBottomWidth: 1, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  pagerRow: { alignItems: "center", flexDirection: "row", gap: spacing.sm },
  externalCopy: { flex: 1, minWidth: 0 },
  caseLabel: { color: colors.goldLight, fontSize: 12, fontWeight: "800" },
  statusTitle: { color: colors.ice, fontSize: 14, fontWeight: "700", marginTop: 2 },
  statusDetail: { color: colors.textSoft, fontSize: 11, lineHeight: 15, marginTop: 2 },
  iconButton: { alignItems: "center", borderColor: colors.line, borderRadius: radii.sm, borderWidth: 1, height: 38, justifyContent: "center", width: 38 },
  evidenceRail: { marginTop: spacing.xs },
  evidenceText: { color: colors.muted, fontFamily: "Courier", fontSize: 9, marginRight: spacing.md },
  productFrame: { flex: 1, minHeight: 0 },
});
