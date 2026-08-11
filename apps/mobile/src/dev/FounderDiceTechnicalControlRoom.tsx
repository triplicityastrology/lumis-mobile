import { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CelestialBackground } from "../components/CelestialBackground";
import { colors, radii, spacing } from "../theme/tokens";
import { DICE_CONTROL_ROOM_ROWS, DICE_CONTROL_ROOM_SUMMARY, type DiceControlRoomRow } from "./diceTechnicalControlRoomFixture";

type Filter = "all" | "en" | "zh-Hant";

export function FounderDiceTechnicalControlRoom() {
  const [filter, setFilter] = useState<Filter>("all");
  const [showKill, setShowKill] = useState(false);
  const rows = useMemo(() => filter === "all" ? DICE_CONTROL_ROOM_ROWS : DICE_CONTROL_ROOM_ROWS.filter((row) => row.language === filter), [filter]);
  const marker = process.env.EXPO_PUBLIC_DICE_T294_CONTROL_ROOM_HEAD?.match(/^[a-f0-9]{40}$/)?.[0] ?? "BUILD_MARKER_REQUIRED";
  const summary = DICE_CONTROL_ROOM_SUMMARY;
  return (
    <SafeAreaView style={styles.safe}>
      <CelestialBackground />
      <View accessibilityLabel="Founder Technical run controls outside customer product pixels" style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>Dice Technical run control room</Text>
        <Text style={styles.status}>LOCAL REHEARSAL · NOT AZURE · NO AUTHORITY</Text>
        <Text selectable style={styles.marker}>BUILD {marker}</Text>
        <Text style={styles.next}>Next action: obtain the accepted v4 post-deploy disabled receipt.</Text>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${summary.completed / summary.total * 100}%` }]} /></View>
        <Text style={styles.progress}>{summary.completed} of {summary.total} complete · {summary.attempts} attempts · concurrency {summary.concurrencyPeak}/{summary.concurrencyLimit}</Text>
        <Text style={styles.progress}>Cost ${summary.costUsd.toFixed(5)} of ${summary.costCeilingUsd.toFixed(3)} · provider disabled ✓</Text>
        <Pressable accessibilityRole="button" onPress={() => setShowKill((value) => !value)} style={styles.killButton}>
          <Text style={styles.killText}>{showKill ? "Hide emergency command" : "Show emergency stop command"}</Text>
        </Pressable>
        {showKill ? <Text selectable style={styles.command}>pnpm dice:t294:kill -- --journal &lt;approved-local-journal&gt;</Text> : null}
        <View accessibilityRole="tablist" style={styles.filters}>
          {(["all", "en", "zh-Hant"] as const).map((value) => <Pressable accessibilityRole="tab" accessibilityState={{ selected: filter === value }} key={value} onPress={() => setFilter(value)} style={[styles.filter, filter === value && styles.filterActive]}><Text style={[styles.filterText, filter === value && styles.filterTextActive]}>{value === "all" ? "All 80" : value}</Text></Pressable>)}
        </View>
      </View>
      <FlatList contentContainerStyle={styles.list} data={rows} keyExtractor={(item) => item.fixtureId} ListHeaderComponent={<Text style={styles.disclaimer}>Redacted metadata rehearsal. No prompts, responses, identities, credentials, units, or persistence. Resume never repeats a dispatched or completed provider attempt.</Text>} renderItem={({ item }) => <Row row={item} />} />
    </SafeAreaView>
  );
}

function Row({ row }: { row: DiceControlRoomRow }) {
  return <View accessibilityLabel={`${row.fixtureId}, ${row.language}, ${row.disposition}, ${row.attempts} attempts`} style={styles.row}>
    <View style={styles.rowTop}><Text selectable style={styles.fixture}>{row.fixtureId}</Text><Text style={styles.language}>{row.language}</Text></View>
    <Text style={styles.disposition}>{row.disposition} · {row.latency} · {row.attempts} attempt{row.attempts === 1 ? "" : "s"}</Text>
    <Text style={styles.tokens}>Input {row.inputTokens} · Output {row.outputTokens}</Text>
    <Text style={styles.rating}>Ratings · authority — · relevance — · tone — · language — · safety —</Text>
  </View>;
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.navy950, flex: 1 }, header: { borderBottomColor: colors.line, borderBottomWidth: 1, gap: 7, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  title: { color: colors.ice, fontSize: 22, fontWeight: "800" }, status: { color: colors.goldLight, fontSize: 12, fontWeight: "800" }, marker: { color: colors.textSoft, fontSize: 12 }, next: { color: colors.ice, fontSize: 14, lineHeight: 20 },
  progressTrack: { backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 5, height: 8, overflow: "hidden" }, progressFill: { backgroundColor: colors.gold, height: 8 }, progress: { color: colors.textSoft, fontSize: 13, lineHeight: 18 },
  killButton: { alignItems: "center", borderColor: colors.goldLight, borderRadius: radii.sm, borderWidth: 1, justifyContent: "center", minHeight: 44, paddingHorizontal: spacing.md }, killText: { color: colors.goldLight, fontWeight: "800", textAlign: "center" }, command: { color: colors.ice, fontSize: 12, lineHeight: 18 },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, filter: { borderColor: colors.line, borderRadius: radii.sm, borderWidth: 1, justifyContent: "center", minHeight: 44, paddingHorizontal: spacing.md }, filterActive: { backgroundColor: colors.gold }, filterText: { color: colors.textSoft, fontWeight: "700" }, filterTextActive: { color: colors.navy950 },
  list: { gap: spacing.sm, padding: spacing.lg }, disclaimer: { color: colors.textSoft, fontSize: 13, lineHeight: 20, marginBottom: spacing.sm }, row: { backgroundColor: "rgba(20,32,50,0.78)", borderColor: colors.line, borderRadius: radii.sm, borderWidth: 1, gap: 5, padding: spacing.md }, rowTop: { alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, fixture: { color: colors.ice, flex: 1, flexShrink: 1, fontSize: 13, fontWeight: "800" }, language: { color: colors.goldLight, fontSize: 12, fontWeight: "700" }, disposition: { color: colors.textSoft, fontSize: 13 }, tokens: { color: colors.muted, fontSize: 12 }, rating: { color: colors.goldLight, fontSize: 12, lineHeight: 18 },
});
