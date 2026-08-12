import ChevronLeft from "lucide-react-native/icons/chevron-left";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { FounderDiceInterpretationWorkbench } from "./FounderDiceInterpretationWorkbench";
import {
  T316_ACCEPTED_TECHNICAL_EVIDENCE_SHA256,
  T316_FOUNDER_FIXTURES,
  parseAcceptedTechnicalEvidence,
  resolveTomorrowSessionReadiness,
  type AcceptedTechnicalEvidence,
} from "./founderTomorrowSession";
import { colors, radii, spacing } from "../theme/tokens";

type Section = "dice" | "evidence" | "founder40" | "chat";

export function FounderTomorrowDiceChatSession() {
  const [section, setSection] = useState<Section>("dice");
  const [fixtureIndex, setFixtureIndex] = useState(0);
  const [evidenceText, setEvidenceText] = useState("");
  const [evidenceSha, setEvidenceSha] = useState("");
  const [evidence, setEvidence] = useState<AcceptedTechnicalEvidence | null>(null);
  const [importStatus, setImportStatus] = useState("No accepted Technical evidence imported");
  const build = process.env.EXPO_PUBLIC_FOUNDER_T316_HEAD ?? "unavailable";
  const readiness = useMemo(() => resolveTomorrowSessionReadiness({ technicalEvidence: evidence }), [evidence]);
  const fixture = T316_FOUNDER_FIXTURES[fixtureIndex];

  function importEvidence() {
    try {
      setEvidence(parseAcceptedTechnicalEvidence(evidenceText, evidenceSha, T316_ACCEPTED_TECHNICAL_EVIDENCE_SHA256));
      setImportStatus("Accepted Technical 80 evidence imported");
    } catch (error) {
      setEvidence(null);
      setImportStatus(error instanceof Error ? error.message : "STOP_S2_T316_TECHNICAL_EVIDENCE");
    }
  }

  return (
    <SafeAreaView style={styles.root}>
      <View accessibilityLabel="Founder session evidence controls outside product pixels" style={styles.externalHeader}>
        <Text style={styles.kicker}>Tomorrow Founder session · DEV only · no provider · no persistence · no units</Text>
        <Text numberOfLines={1} selectable style={styles.marker}>Build {build} · Dice {readiness.dice} · Chat {readiness.chat}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {(["dice", "evidence", "founder40", "chat"] as const).map((item) => (
            <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: section === item }} onPress={() => setSection(item)} style={[styles.tab, section === item && styles.tabSelected]}>
              <Text style={[styles.tabText, section === item && styles.tabTextSelected]}>{item === "founder40" ? "Founder 40" : item[0].toUpperCase() + item.slice(1)}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {section === "dice" ? <FounderDiceInterpretationWorkbench onBack={() => setSection("founder40")} /> : null}
      {section === "evidence" ? (
        <ExternalPanel title="Import accepted Technical evidence" status={importStatus}>
          <Text style={styles.body}>Only an independently reviewed digest compiled into this build can pass. Pasted or self-authored JSON stays rejected.</Text>
          <TextInput accessibilityLabel="Technical evidence JSON" multiline onChangeText={setEvidenceText} placeholder="Paste closed metadata-only evidence JSON" placeholderTextColor={colors.muted} style={styles.input} value={evidenceText} />
          <TextInput accessibilityLabel="Independent evidence SHA-256" autoCapitalize="none" onChangeText={setEvidenceSha} placeholder="Independent SHA-256" placeholderTextColor={colors.muted} style={styles.input} value={evidenceSha} />
          <Pressable accessibilityRole="button" onPress={importEvidence} style={styles.action}><Text style={styles.actionText}>Validate import</Text></Pressable>
        </ExternalPanel>
      ) : null}
      {section === "founder40" ? (
        <ExternalPanel title="Founder 40 fixture controls" status={readiness.dice}>
          <View style={styles.fixtureNav}>
            <Pressable accessibilityLabel="Previous fixture" accessibilityRole="button" onPress={() => setFixtureIndex((fixtureIndex + 39) % 40)} style={styles.arrow}><ChevronLeft color={colors.ice} size={20} /></Pressable>
            <View style={styles.fixtureCopy}><Text style={styles.fixtureId}>{fixture.fixture_id} · {fixture.authoring_id}</Text><Text selectable style={styles.question}>{fixture.exact_text}</Text></View>
            <Pressable accessibilityLabel="Next fixture" accessibilityRole="button" onPress={() => setFixtureIndex((fixtureIndex + 1) % 40)} style={styles.arrow}><ChevronRight color={colors.ice} size={20} /></Pressable>
          </View>
          <Text style={styles.body}>20 EN + 20 zh-Hant. ZH04 excluded. ZH08 remains the bundled-question rejection; ZH09 remains the accepted single-question control.</Text>
          <Text style={styles.warning}>Invocation unavailable until accepted Technical evidence and separate Founder-window authority both exist.</Text>
        </ExternalPanel>
      ) : null}
      {section === "chat" ? (
        <ExternalPanel title="Normal Chat readiness" status={readiness.chat}>
          <Text style={styles.body}>Dice interpretations remain on the Dice result card. Chat opens only when Reflect in Chat is explicitly tapped.</Text>
          <Text style={styles.body}>Normal Chat remains separate and blocked by accepted Dice Technical evidence plus separate Chat deployment and traffic authority.</Text>
          <Text selectable style={styles.marker}>Next: {readiness.next}</Text>
        </ExternalPanel>
      ) : null}
    </SafeAreaView>
  );
}

function ExternalPanel({ title, status, children }: { title: string; status: string; children: React.ReactNode }) {
  return <ScrollView contentContainerStyle={styles.panel}><Text accessibilityRole="header" style={styles.title}>{title}</Text><Text selectable style={styles.status}>{status}</Text>{children}</ScrollView>;
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.navy950, flex: 1 },
  externalHeader: { backgroundColor: "#071422", borderBottomColor: colors.line, borderBottomWidth: 1, gap: 6, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  kicker: { color: colors.goldLight, fontSize: 11, fontWeight: "800" },
  marker: { color: colors.muted, fontFamily: "Courier", fontSize: 9, lineHeight: 13 },
  tabs: { gap: 6 },
  tab: { borderColor: colors.line, borderRadius: radii.sm, borderWidth: 1, minHeight: 34, paddingHorizontal: 12, paddingVertical: 8 },
  tabSelected: { backgroundColor: colors.gold },
  tabText: { color: colors.textSoft, fontSize: 11, fontWeight: "700" },
  tabTextSelected: { color: colors.navy950 },
  panel: { gap: spacing.md, padding: spacing.lg },
  title: { color: colors.ice, fontSize: 22, fontWeight: "800" },
  status: { color: colors.goldLight, fontFamily: "Courier", fontSize: 11 },
  body: { color: colors.textSoft, fontSize: 15, lineHeight: 22 },
  warning: { color: colors.warn, fontSize: 14, fontWeight: "700", lineHeight: 21 },
  input: { borderColor: colors.line, borderRadius: radii.sm, borderWidth: 1, color: colors.ice, minHeight: 48, padding: spacing.sm },
  action: { alignItems: "center", backgroundColor: colors.gold, borderRadius: radii.sm, minHeight: 44, justifyContent: "center" },
  actionText: { color: colors.navy950, fontWeight: "800" },
  fixtureNav: { alignItems: "center", flexDirection: "row", gap: spacing.sm },
  arrow: { alignItems: "center", borderColor: colors.line, borderRadius: radii.sm, borderWidth: 1, height: 44, justifyContent: "center", width: 44 },
  fixtureCopy: { flex: 1, gap: 6 },
  fixtureId: { color: colors.goldLight, fontFamily: "Courier", fontSize: 11 },
  question: { color: colors.ice, fontSize: 17, lineHeight: 25 },
});
