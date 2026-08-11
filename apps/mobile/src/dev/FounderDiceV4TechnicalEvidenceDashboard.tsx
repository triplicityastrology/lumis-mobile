import { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CelestialBackground } from "../components/CelestialBackground";
import { colors, radii, spacing } from "../theme/tokens";
import { DICE_TECHNICAL_EVIDENCE_ROWS, DICE_TECHNICAL_EVIDENCE_SUMMARY, type DiceTechnicalEvidenceRow } from "./diceV4TechnicalEvidenceFixture";

type Filter = "all" | "en" | "zh-Hant";

export function FounderDiceV4TechnicalEvidenceDashboard() {
  const [filter, setFilter] = useState<Filter>("all");
  const rows = useMemo(() => filter === "all" ? DICE_TECHNICAL_EVIDENCE_ROWS : DICE_TECHNICAL_EVIDENCE_ROWS.filter((row) => row.language === filter), [filter]);
  const marker = process.env.EXPO_PUBLIC_DICE_TECHNICAL_EVIDENCE_HEAD?.match(/^[a-f0-9]{40}$/)?.[0] ?? "LOCAL_REHEARSAL_SOURCE";
  return (
    <SafeAreaView style={styles.safe}>
      <CelestialBackground />
      <View accessibilityLabel="Founder evidence controls outside customer product pixels" style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>Dice Technical evidence</Text>
        <Text style={styles.status}>LOCAL REHEARSAL · NOT AZURE · NO AUTHORITY</Text>
        <Text selectable style={styles.marker}>BUILD {marker}</Text>
        <Text style={styles.summary}>80 cases · 40 EN / 40 zh-Hant · max 160 attempts · concurrency 2 · $0.128 ceiling</Text>
        <View accessibilityRole="tablist" style={styles.filters}>
          {(["all", "en", "zh-Hant"] as const).map((value) => (
            <Pressable accessibilityRole="tab" accessibilityState={{ selected: filter === value }} key={value} onPress={() => setFilter(value)} style={[styles.filter, filter === value && styles.filterActive]}>
              <Text style={[styles.filterText, filter === value && styles.filterTextActive]}>{value === "all" ? "All 80" : value}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <FlatList
        contentContainerStyle={styles.list}
        data={rows}
        keyExtractor={(item) => item.fixtureId}
        ListHeaderComponent={<Text style={styles.disclaimer}>{DICE_TECHNICAL_EVIDENCE_SUMMARY.evidenceClass}. Fixture metadata only; no prompts, responses, identities, units, or persistence.</Text>}
        renderItem={({ item }) => <EvidenceRow row={item} />}
      />
    </SafeAreaView>
  );
}

function EvidenceRow({ row }: { row: DiceTechnicalEvidenceRow }) {
  return (
    <View accessibilityLabel={`${row.fixtureId}, ${row.language}, ${row.disposition}, ${row.latency}, ${row.attempts} attempts`} style={styles.row}>
      <View style={styles.rowTop}><Text selectable style={styles.fixture}>{row.fixtureId}</Text><Text style={styles.language}>{row.language}</Text></View>
      <Text style={styles.disposition}>{row.disposition.replace("_", " ")} · {row.latency} · {row.attempts} attempt{row.attempts === 1 ? "" : "s"}</Text>
      <Text style={styles.tokens}>Input {row.inputTokens} · Output {row.outputTokens}</Text>
      <Text style={styles.rating}>Ratings · authority {row.rating.authority} · relevance {row.rating.relevance}</Text>
      <Text style={styles.rating}>tone {row.rating.tone} · language {row.rating.languageQuality} · safety {row.rating.safety}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.navy950, flex: 1 },
  header: { borderBottomColor: colors.line, borderBottomWidth: 1, gap: 6, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  title: { color: colors.ice, fontSize: 22, fontWeight: "800" },
  status: { color: colors.goldLight, fontSize: 12, fontWeight: "800" },
  marker: { color: colors.textSoft, fontSize: 12 },
  summary: { color: colors.ice, fontSize: 14, lineHeight: 20 },
  filters: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  filter: { borderColor: colors.line, borderRadius: radii.sm, borderWidth: 1, minHeight: 42, paddingHorizontal: spacing.md, justifyContent: "center" },
  filterActive: { backgroundColor: colors.gold },
  filterText: { color: colors.textSoft, fontWeight: "700" },
  filterTextActive: { color: colors.navy950 },
  list: { gap: spacing.sm, padding: spacing.lg },
  disclaimer: { color: colors.textSoft, fontSize: 13, lineHeight: 20, marginBottom: spacing.sm },
  row: { backgroundColor: "rgba(20,32,50,0.78)", borderColor: colors.line, borderRadius: radii.sm, borderWidth: 1, gap: 5, padding: spacing.md },
  rowTop: { alignItems: "flex-start", flexDirection: "row", gap: spacing.sm },
  fixture: { color: colors.ice, flex: 1, fontSize: 13, fontWeight: "800" },
  language: { color: colors.goldLight, fontSize: 12, fontWeight: "700" },
  disposition: { color: colors.textSoft, fontSize: 13 },
  tokens: { color: colors.muted, fontSize: 12 },
  rating: { color: colors.goldLight, fontSize: 12 },
});
