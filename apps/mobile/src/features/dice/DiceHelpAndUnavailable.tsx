import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";

import { BrandPrimaryButton } from "../../components/BrandPrimaryButton";
import { ScreenHeader, SoftButton } from "../../components/states/StateKit";
import { ink, type } from "../../theme/typography";

/**
 * Batch 2 — DICE-009 (How to ask Dice) and DICE-010 (Dice unavailable outcome).
 * Presentational only: no throw, no backend, no history writes. DICE-010's real
 * trigger is a backend "no throw available" result; the copy and layout are the
 * signed-off authority.
 */

const GOOD = "#7BC784";
const WARN = "#E38E7C";
const CARD_BG = "rgba(58,80,118,0.24)";
const CARD_LINE = "rgba(255,255,255,0.08)";

function CheckGlyph({ color = GOOD }: { color?: string }) {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      <Path d="M5 12.5l4.5 4.5L19 7" stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CrossGlyph({ color = WARN }: { color?: string }) {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      <Path d="M7 7l10 10M17 7L7 17" stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function InfoGlyph({ color = "#D7B978" }: { color?: string }) {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={1.6} fill="none" />
      <Path d="M12 11v5M12 8h.01" stroke={color} strokeWidth={1.7} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

type HelpRow = { good: boolean; heading: string; example: string };

const HELP_ROWS: HelpRow[] = [
  { good: true, heading: "Good", example: "“Is now the right time to reach out to my old mentor?”" },
  { good: true, heading: "Good — one throw per option", example: "“Should I take Job A?” — then a separate throw: “Should I take Job B?”" },
  { good: false, heading: "Avoid — bundled", example: "“Should I take Job A, move city and also break up?”" },
  { good: false, heading: "Avoid — unclear", example: "“Is life going in the right direction?”" }
];

/** DICE-009 — "How to ask Dice" help sheet, presented as a bottom sheet modal. */
export function DiceHelpSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.sheetScrim}>
        <SafeAreaView edges={["bottom", "left", "right"]} style={s.sheetCard}>
          <ScreenHeader title="How to ask Dice" onBack={onClose} />
          <ScrollView contentContainerStyle={s.sheetContent} showsVerticalScrollIndicator={false}>
            <View style={s.eyebrowRow}>
              <Text style={s.sparkle}>✦</Text>
              <Text style={s.eyebrow}>ONE CLEAR QUESTION</Text>
            </View>
            <Text style={s.title}>Ask about one thing at a time.</Text>
            <Text style={s.lead}>
              Dice reflects best when the question is single and specific. It's a nudge for thought, not a verdict.
            </Text>
            <View style={s.card}>
              {HELP_ROWS.map((row, index) => (
                <View key={row.heading} style={[s.helpRow, index === HELP_ROWS.length - 1 && s.helpRowLast]}>
                  <View style={s.helpHeadRow}>
                    {row.good ? <CheckGlyph /> : <CrossGlyph />}
                    <Text style={s.helpHeading}>{row.heading}</Text>
                  </View>
                  <Text style={s.helpExample}>{row.example}</Text>
                </View>
              ))}
            </View>
            <View style={s.safetyNote}>
              <InfoGlyph />
              <Text style={s.safetyText}>Dice results are for reflection. They aren't predictions or professional advice.</Text>
            </View>
            <SoftButton label="Close" onPress={onClose} style={s.closeButton} />
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

/** DICE-010 — backend returned "no throw available"; the question is preserved. */
export function DiceUnavailableView({
  question,
  onReturnToQuestion,
  onBackToChat
}: {
  question: string;
  onReturnToQuestion: () => void;
  onBackToChat: () => void;
}) {
  return (
    <SafeAreaView edges={["top", "left", "right", "bottom"]} style={s.unavailSafe}>
      <ScreenHeader title="Dice" onBack={onBackToChat} />
      <ScrollView contentContainerStyle={s.unavailContent} showsVerticalScrollIndicator={false}>
        <View style={s.unavailIcon}>
          <Svg width={26} height={26} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
            <Path d="M6 8l3-2 3 2-3 2Z M12 12l3-2 3 2-3 2Z M6 14l3-2 3 2-3 2Z" stroke={ink.muted} strokeWidth={1.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </View>
        <Text style={s.unavailTitle}>This throw isn't available right now.</Text>
        <Text style={s.unavailLead}>Your question is safe — we've kept it for you.</Text>
        <View style={s.questionCard}>
          <Text style={s.questionLabel}>YOUR QUESTION</Text>
          <Text style={s.questionText}>{`“${question}”`}</Text>
        </View>
        <BrandPrimaryButton label="Return to your question" onPress={onReturnToQuestion} style={s.unavailPrimary} />
        <SoftButton label="Back to Chat" onPress={onBackToChat} style={s.unavailSoft} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  // DICE-009 sheet.
  sheetScrim: { backgroundColor: "rgba(11,25,48,0.6)", flex: 1, justifyContent: "flex-end" },
  sheetCard: { backgroundColor: "#0F1E33", borderTopLeftRadius: 26, borderTopRightRadius: 26, maxHeight: "92%", overflow: "hidden" },
  sheetContent: { paddingBottom: 28, paddingHorizontal: 24, paddingTop: 4 },
  eyebrowRow: { alignItems: "center", flexDirection: "row", gap: 6, marginBottom: 10 },
  sparkle: { color: ink.gold, fontSize: 11 },
  eyebrow: { ...type.eyebrow },
  title: { ...type.screenTitle, marginBottom: 12 },
  lead: { ...type.bodyLarge, marginBottom: 20 },
  card: { backgroundColor: CARD_BG, borderColor: CARD_LINE, borderRadius: 18, borderWidth: 1, paddingHorizontal: 16 },
  helpRow: { borderBottomColor: CARD_LINE, borderBottomWidth: 1, paddingVertical: 14 },
  helpRowLast: { borderBottomWidth: 0 },
  helpHeadRow: { alignItems: "center", flexDirection: "row", gap: 8, marginBottom: 5 },
  helpHeading: { ...type.cardHeading, fontSize: 14.5 },
  helpExample: { ...type.body, color: ink.soft, fontSize: 13, fontStyle: "italic", lineHeight: 20, paddingLeft: 23 },
  safetyNote: { alignItems: "flex-start", flexDirection: "row", gap: 11, marginTop: 16 },
  safetyText: { ...type.safetyText, flex: 1 },
  closeButton: { marginTop: 18 },
  // DICE-010.
  unavailSafe: { backgroundColor: "transparent", flex: 1 },
  unavailContent: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 28 },
  unavailIcon: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "rgba(138,155,176,0.16)",
    borderRadius: 30,
    height: 60,
    justifyContent: "center",
    marginBottom: 18,
    width: 60
  },
  unavailTitle: { ...type.screenTitle, marginBottom: 12, textAlign: "center" },
  unavailLead: { ...type.bodyLarge, marginBottom: 22, textAlign: "center" },
  questionCard: { backgroundColor: CARD_BG, borderColor: CARD_LINE, borderRadius: 16, borderWidth: 1, marginBottom: 20, paddingHorizontal: 16, paddingVertical: 16 },
  questionLabel: { ...type.fieldLabel, marginBottom: 6 },
  questionText: { color: ink.strong, fontFamily: type.body.fontFamily, fontSize: 14, fontStyle: "italic", lineHeight: 22 },
  unavailPrimary: {},
  unavailSoft: { marginTop: 10 }
});
