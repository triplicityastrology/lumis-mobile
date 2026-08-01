import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CelestialBackground } from "../components/CelestialBackground";
import { colors, radii, spacing } from "../theme/tokens";
import {
  PERSONA_COMPARISON_EVIDENCE,
  PERSONA_COMPARISON_SAMPLE,
  getPersonaComparisonEvidence,
  type PersonaComparisonPublicName,
} from "./personaComparisonFixture";

export default function PersonaComparisonWorkbench() {
  const [selected, setSelected] = useState<PersonaComparisonPublicName>("Acceptance");
  const evidence = getPersonaComparisonEvidence(selected);

  return (
    <SafeAreaView style={styles.safe}>
      <CelestialBackground />
      <ScrollView
        automaticallyAdjustContentInsets={false}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={styles.content}
      >
        <Text style={styles.eyebrow}>DEVELOPMENT COMPARISON</Text>
        <Text accessibilityRole="header" style={styles.title}>Persona behaviour</Text>
        <Text style={styles.intro}>Compare the same local evidence situation across the three approved public personas.</Text>

        <View accessibilityRole="tablist" style={styles.tabs}>
          {PERSONA_COMPARISON_EVIDENCE.map((entry) => (
            <Pressable
              key={entry.publicName}
              accessibilityLabel={`Select ${entry.publicName}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: selected === entry.publicName }}
              onPress={() => setSelected(entry.publicName)}
              style={[styles.tab, selected === entry.publicName && styles.tabSelected]}
            >
              <Text style={[styles.tabText, selected === entry.publicName && styles.tabTextSelected]}>{entry.publicName}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>SAME SAMPLE SITUATION</Text>
          <Text style={styles.sample}>{PERSONA_COMPARISON_SAMPLE}</Text>
          <Text style={styles.fixtureNote}>{evidence.fixtureNote}</Text>
        </View>

        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.persona}>{evidence.publicName}</Text>
          <Text style={styles.label}>EXPECTED BEHAVIOURAL CONTRACT</Text>
          {evidence.contractChecklist.map((item) => (
            <View key={item} style={styles.checkRow}>
              <Text accessibilityElementsHidden style={styles.check}>✓</Text>
              <Text style={styles.checkText}>{item}</Text>
            </View>
          ))}
        </View>

        <View style={styles.statusCard} accessibilityLabel={`Profile status: ${evidence.profileStatusLabel}. Request status: ${evidence.payloadStatusLabel}.`}>
          <Status label="Resolved profile" value={evidence.profileStatusLabel} />
          <View style={styles.divider} />
          <Status label="Request payload" value={evidence.payloadStatusLabel} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Status({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statusRow}>
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={styles.statusValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.navy950, flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 48 },
  eyebrow: { color: colors.goldLight, fontSize: 12, fontWeight: "700", letterSpacing: 0, marginTop: spacing.sm },
  title: { color: colors.ice, fontSize: 30, fontWeight: "700", letterSpacing: 0, marginTop: spacing.xs },
  intro: { color: colors.textSoft, fontSize: 16, lineHeight: 23, marginTop: spacing.sm },
  tabs: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radii.sm, borderWidth: 1, flexDirection: "row", marginTop: spacing.lg, padding: 4 },
  tab: { alignItems: "center", borderRadius: 6, flex: 1, justifyContent: "center", minHeight: 48, paddingHorizontal: 6 },
  tabSelected: { backgroundColor: colors.gold },
  tabText: { color: colors.textSoft, fontSize: 14, fontWeight: "600" },
  tabTextSelected: { color: colors.navy950 },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radii.sm, borderWidth: 1, marginTop: spacing.md, padding: spacing.md },
  label: { color: colors.muted, fontSize: 12, fontWeight: "700", letterSpacing: 0 },
  sample: { color: colors.ice, fontSize: 17, lineHeight: 25, marginTop: spacing.sm },
  fixtureNote: { color: colors.goldLight, fontSize: 13, lineHeight: 19, marginTop: spacing.md },
  persona: { color: colors.ice, fontSize: 23, fontWeight: "700", marginBottom: spacing.md },
  checkRow: { alignItems: "flex-start", flexDirection: "row", marginTop: spacing.sm },
  check: { color: colors.gold, fontSize: 16, marginRight: spacing.sm },
  checkText: { color: colors.textSoft, flex: 1, fontSize: 15, lineHeight: 22 },
  statusCard: { backgroundColor: colors.surfaceRaised, borderColor: colors.line, borderRadius: radii.sm, borderWidth: 1, marginTop: spacing.md, padding: spacing.md },
  statusRow: { gap: 4 },
  statusLabel: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  statusValue: { color: colors.ice, fontSize: 15, lineHeight: 22 },
  divider: { backgroundColor: colors.line, height: 1, marginVertical: spacing.md },
});
