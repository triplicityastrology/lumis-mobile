import { Bell, ChevronLeft, MessageCircle } from "lucide-react-native";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";

import type { ChartV2 } from "@lumis/shared";

import { CelestialBackground } from "../components/CelestialBackground";
import { MainTabBar, type MainTab } from "../components/MainTabBar";
import { MiniChartWheel } from "../components/MiniChartWheel";
import { colors, radii, spacing } from "../theme/tokens";

export function ChartInsightsScreen({
  chart,
  name,
  onBack,
  onAskLumis,
  onNotifications,
  onSelectTab
}: {
  chart: ChartV2;
  name: string;
  onBack: () => void;
  onAskLumis: () => void;
  onNotifications: () => void;
  onSelectTab: (tab: MainTab) => void;
}) {
  return (
    <SafeAreaView style={styles.safe}>
      <CelestialBackground />
      <View style={styles.frame}>
        <View style={styles.header}>
          <Pressable style={styles.back} onPress={onBack} accessibilityLabel="Back">
            <ChevronLeft color={colors.ice} size={21} />
          </Pressable>
          <Text style={styles.headerTitle}>Your chart</Text>
          <Pressable style={styles.back} onPress={onNotifications} accessibilityLabel="Notifications">
            <Bell color={colors.ice} size={19} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <MiniChartWheel size={220} />
            <Text style={styles.heroLabel}>{name.toUpperCase()} · NATAL CHART</Text>
            <Text style={styles.heroTitle}>The sky you arrived with.</Text>
            <Text style={styles.heroBody}>
              {chart.precision === "full"
                ? "Your full timed chart is active for future Lumis conversations."
                : "Your birth time is unknown, so Lumis hides houses, Ascendant, and MC."}
            </Text>
          </View>

          <Text style={styles.sectionLabel}>PLACEMENTS</Text>
          <View style={styles.placementList}>
            {chart.planets.map((planet) => (
              <View key={planet.key} style={styles.placementRow}>
                <View style={styles.planetBadge}>
                  <Text style={styles.planetGlyph}>{glyphFor(planet.key)}</Text>
                </View>
                <View style={styles.placementCopy}>
                  <Text style={styles.planetName}>{planet.label}</Text>
                  <Text style={styles.planetPosition}>
                    {planet.sign} · {formatDegree(planet.degree)}
                  </Text>
                </View>
                {planet.house != null ? <Text style={styles.house}>HOUSE {planet.house}</Text> : null}
              </View>
            ))}
          </View>

          <Pressable style={styles.askButton} onPress={onAskLumis}>
            <MessageCircle color={colors.navy950} size={20} />
            <Text style={styles.askButtonText}>Ask Lumis about my chart</Text>
          </Pressable>
        </ScrollView>
        <MainTabBar active="insights" onSelect={onSelectTab} />
      </View>
    </SafeAreaView>
  );
}

function formatDegree(value: number) {
  return `${Number(value).toFixed(2)}°`;
}

function glyphFor(key: string) {
  return {
    sun: "☉",
    moon: "☽",
    mercury: "☿",
    venus: "♀",
    mars: "♂",
    jupiter: "♃",
    saturn: "♄",
    uranus: "♅",
    neptune: "♆",
    pluto: "♇",
    chiron: "⚷",
    true_node: "☊",
    ascendant: "ASC",
    medium_coeli: "MC"
  }[key] ?? "✦";
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy950 },
  frame: { flex: 1, width: "100%", maxWidth: 480, alignSelf: "center", backgroundColor: "transparent" },
  header: { minHeight: 64, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.line },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  headerTitle: { color: colors.ice, fontFamily: "Georgia", fontSize: 20, fontWeight: "600" },
  content: { padding: spacing.lg, paddingBottom: 40 },
  hero: { alignItems: "center", paddingVertical: 15 },
  heroLabel: { color: colors.gold, fontSize: 9.5, fontWeight: "700", letterSpacing: 1.7, marginTop: 16 },
  heroTitle: { color: colors.ice, fontFamily: "Georgia", fontSize: 27, lineHeight: 33, textAlign: "center", marginTop: 10 },
  heroBody: { color: colors.textSoft, fontSize: 13, lineHeight: 20, textAlign: "center", maxWidth: 360, marginTop: 8 },
  sectionLabel: { color: colors.muted, fontSize: 9.5, fontWeight: "700", letterSpacing: 1.7, marginTop: 17, marginBottom: 10 },
  placementList: { borderWidth: 1, borderColor: colors.line, borderRadius: radii.lg, overflow: "hidden", backgroundColor: colors.surface },
  placementRow: { minHeight: 66, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, borderTopWidth: 1, borderTopColor: colors.lineSoft },
  planetBadge: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: colors.goldFill },
  planetGlyph: { color: colors.gold, fontFamily: "Georgia", fontSize: 17, fontWeight: "600" },
  placementCopy: { flex: 1 },
  planetName: { color: colors.ice, fontSize: 14, fontWeight: "700" },
  planetPosition: { color: colors.textSoft, fontSize: 11.5, marginTop: 3 },
  house: { color: colors.muted, fontSize: 8.5, fontWeight: "700", letterSpacing: 1 },
  askButton: { minHeight: 54, marginTop: 18, borderRadius: radii.md, flexDirection: "row", gap: 9, alignItems: "center", justifyContent: "center", backgroundColor: colors.gold },
  askButtonText: { color: colors.navy950, fontSize: 14.5, fontWeight: "700" }
});
