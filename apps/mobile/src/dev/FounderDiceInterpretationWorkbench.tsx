import ChevronLeft from "lucide-react-native/icons/chevron-left";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import { classifyDiceQuestionRequest } from "@lumis/shared";
import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CelestialBackground } from "../components/CelestialBackground";
import { DiceRitualScreen } from "../features/dice/DiceRitualScreen";
import type { DiceInterpretationEnvelope } from "../features/dice/DiceRitualScreen";
import {
  createDiceFounderProductBridge,
  isCurrentDiceInterpretationRequest,
} from "../services/diceFounderProductBridge";
import { resolveDiceFounderFixtureByAuthoringId } from "../services/diceFounderFixtureRegistry";
import type { DiceLiveResultState } from "../services/diceLiveResultAdapter";
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
  { id: "zh08", label: "ZH08 bundled rejection", question: ZH08.exact_text, expected: "External classifier rejects it as bundled before the transport boundary." },
  { id: "zh09", label: "ZH09 accepted control", question: ZH09.exact_text, expected: "Accepted as one timing question." },
  { id: "fallback", label: "Safe fallback boundary", question: "What should I notice about this situation?", expected: "Fallback renders in the established result card and remains zero-effect." },
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
  const [interpretationState, setInterpretationState] = useState<DiceInterpretationEnvelope | undefined>();
  const latestRequestRef = useRef<string | null>(null);
  const selected = CASES[caseIndex];
  const build = process.env.EXPO_PUBLIC_FOUNDER_DICE_E2E_HEAD ?? "unavailable";

  const changeCase = (next: number) => {
    const nextIndex = (next + CASES.length) % CASES.length;
    const nextCase = CASES[nextIndex];
    setCaseIndex(nextIndex);
    setExternalState(classifyExternalCase(nextCase));
    setInterpretation(null);
    setInterpretationState(undefined);
    latestRequestRef.current = null;
  };

  const requestInterpretation = async (input: Readonly<{ request_key: string; question: string }>) => {
    const authoringId = selected.id === "zh09" ? "ZH09" : "EN01";
    const registryFixture = resolveDiceFounderFixtureByAuthoringId(authoringId);
    if (!registryFixture) {
      setInterpretation("DICE_FOUNDER_FIXTURE_NOT_APPROVED");
      return;
    }
    latestRequestRef.current = input.request_key;
    setInterpretationState({ request_key: input.request_key, state: { kind: "loading", language: selected.id === "zh09" ? "zh-Hant" : "en", effects: { provider_calls: 0, persistence_writes: 0, units_charged: 0 } } });
    setExternalState((current) => ({ ...current, title: "Offline interpretation preview", detail: "The result remains on the Dice page. Provider, persistence, and units stay disabled." }));
    const state = await createDiceFounderProductBridge({ ai_enabled: false, traffic_authorized: false, authority: null }).request({
      fixture_id: registryFixture.fixture_id,
      question: input.question,
    });
    const offlineState = offlinePreviewFor(selected.id);
    if (!isCurrentDiceInterpretationRequest(latestRequestRef.current, input.request_key)) return;
    setInterpretationState({ request_key: input.request_key, state: offlineState });
    setInterpretation(`${state.kind === "result" && state.result.kind === "disabled" ? state.result.code : "DICE_GATE_UNEXPECTED"} · offline_preview · result stays on Dice`);
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
          onReflect={() => setExternalState((current) => ({ ...current, title: "Reflect in Chat tapped", detail: "Only this explicit action may navigate to Chat in the normal app." }))}
          interpretationState={interpretationState}
          onInterpretationRequested={requestInterpretation}
          onRetryInterpretation={(requestKey) => void requestInterpretation({ request_key: requestKey, question: selected.question || "What should I notice about this situation?" })}
          onSelectTab={() => undefined}
        />
      </View>
    </SafeAreaView>
  );
}

function offlinePreviewFor(id: ReviewCase["id"]): DiceLiveResultState {
  const effects = { provider_calls: 0, persistence_writes: 0, units_charged: 0 } as const;
  if (id === "fallback") return { kind: "fallback", language: "en", message: "Lumis couldn’t complete that reflection just now. Please try again.", effects };
  if (id === "zh08") return { kind: "safety", language: "zh-Hant", message: "請每次只問一個問題，再試一次。", effects };
  if (id === "zh09") return { kind: "interpretation", language: "zh-Hant", reading: "呢個結果提醒你留意事情推進嘅節奏。", watch_out: "避免將時間推測當成保證。", practical_direction: "先確認一個你今日可以跟進嘅步驟。", effects };
  return { kind: "interpretation", language: "en", reading: "This combination invites a closer look at what is already taking shape.", watch_out: "Avoid treating the symbols as a fixed verdict.", practical_direction: "Choose one small, reversible step to test what you noticed.", effects };
}

function classifyExternalCase(reviewCase: ReviewCase): ExternalState {
  if (!reviewCase.question) return INITIAL_STATE;
  const result = classifyDiceQuestionRequest({ question: reviewCase.question });
  return result.accepted
    ? { title: "External preflight accepted", detail: "Type the exact question in the product field. Interpretation remains on Dice after the established roll.", classification: `${result.route} · ${result.shape} · ${result.language}` }
    : { title: validationTitle(result.code), detail: validationGuidance(result.code), classification: `rejected · ${result.code}` };
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
