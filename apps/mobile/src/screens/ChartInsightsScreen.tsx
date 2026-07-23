import { LinearGradient } from "expo-linear-gradient";
import Bell from "lucide-react-native/icons/bell";
import MessageCircle from "lucide-react-native/icons/message-circle";
import Moon from "lucide-react-native/icons/moon";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { ChartV2 } from "@lumis/shared";

import { CelestialBackground } from "../components/CelestialBackground";
import { MainTabBar, type MainTab } from "../components/MainTabBar";
import { NatalWheel } from "../components/NatalWheel";
import { colors, radii, spacing } from "../theme/tokens";

const SUNRISE = ["#E5C06B", "#E9B083", "#E89B92"] as const;

const PLANET_GLYPHS: Record<string, string> = {
  sun: "\u2609", moon: "\u263D", mercury: "\u263F", venus: "\u2640", mars: "\u2642", jupiter: "\u2643",
  saturn: "\u2644", uranus: "\u2645", neptune: "\u2646", pluto: "\u2647", chiron: "\u26B7",
  true_node: "\u260A", south_node: "\u260B", ascendant: "ASC", medium_coeli: "MC"
};

export function ChartInsightsScreen({
  chart,
  name,
  onAskLumis,
  onNotifications,
  onSelectTab
}: {
  chart: ChartV2;
  name: string;
  onBack?: () => void;
  onAskLumis: () => void;
  onNotifications: () => void;
  onSelectTab: (tab: MainTab) => void;
}) {
  const placements = chart.planets.filter(
    (planet) => planet.key !== "ascendant" && planet.key !== "medium_coeli"
  );
  const showHouses = chart.precision === "full";

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
      <CelestialBackground />
      <View style={styles.frame}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Sky</Text>
          <Pressable style={styles.iconBtn} onPress={onNotifications} accessibilityLabel="Notifications">
            <Bell color={colors.ice} size={19} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionLabel}>YOUR NATAL CHART</Text>

          {/* chart panel + continuous placements list share one rounded container */}
          <View style={styles.chartPanel}>
            <View style={styles.chartWheelWrap}>
              <NatalWheel chart={chart} size={232} />
            </View>
            <Text style={styles.chartCaption}>{name.toUpperCase()} · NATAL CHART</Text>

            <View style={styles.placementList}>
              {placements.map((planet) => (
                <View key={planet.key} style={styles.placementRow}>
                  <View style={styles.planetBadge}>
                    <Text style={styles.planetGlyph}>{PLANET_GLYPHS[planet.key] ?? "✦"}</Text>
                  </View>
                  <View style={styles.placementCopy}>
                    <Text style={styles.planetName}>{planet.label}</Text>
                    <Text style={styles.planetPosition}>
                      {planet.sign} {formatDegree(planet.degree)}
                      {planet.retrograde ? " ℞" : ""}
                    </Text>
                  </View>
                  {showHouses && planet.house != null ? (
                    <View style={styles.housePill}>
                      <Text style={styles.housePillText}>H{planet.house}</Text>
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          </View>

          <View style={styles.hero}>
            <Text style={styles.heroTitle}>The sky you arrived with.</Text>
            <Text style={styles.heroBody}>
              {showHouses
                ? "Your full timed chart is active for future Lumis conversations."
                : "Your birth time is unknown, so Lumis hides houses, Ascendant, and MC."}
            </Text>
          </View>

          {/* weekly sky forecast */}
          <Text style={styles.sectionLabel}>THIS WEEK'S SKY</Text>
          <View style={styles.weatherCard}>
            <View style={styles.weatherIcon}>
              <Moon color={colors.periwinkle} size={22} />
            </View>
            <Text style={styles.weatherTitle}>A week for steady footing</Text>
            <Text style={styles.weatherSub}>
              The Moon moves through grounding ground midweek — a good stretch to close loops rather than open new ones. Bring one honest conversation into daylight.
            </Text>
          </View>

          <Pressable onPress={onAskLumis} accessibilityRole="button" accessibilityLabel="Ask Lumis about my chart">
            <LinearGradient colors={SUNRISE} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.askButton}>
              <MessageCircle color="#3A2218" size={19} />
              <Text style={styles.askButtonText}>Ask Lumis about my chart</Text>
            </LinearGradient>
          </Pressable>
        </ScrollView>
        <MainTabBar active="insights" onSelect={onSelectTab} />
      </View>
    </SafeAreaView>
  );
}

function formatDegree(value: number) {
  return `${Number(value).toFixed(0)}°`;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy950 },
  frame: { flex: 1, width: "100%", maxWidth: 480, alignSelf: "center", backgroundColor: "transparent" },
  header: { minHeight: 64, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(22,39,61,0.5)", borderWidth: 1, borderColor: colors.line },
  headerTitle: { color: colors.ice, fontFamily: "Georgia", fontSize: 26, fontWeight: "600" },
  content: { padding: spacing.lg, paddingBottom: 40 },
  sectionLabel: { color: colors.muted, fontSize: 9.5, fontWeight: "700", letterSpacing: 1.7, marginTop: 17, marginBottom: 10 },
  chartPanel: { backgroundColor: "rgba(58,80,118,0.24)", borderColor: colors.line, borderRadius: radii.lg, borderWidth: 1, overflow: "hidden", paddingTop: 18 },
  chartWheelWrap: { alignItems: "center" },
  chartCaption: { color: colors.textSoft, fontSize: 9.5, fontWeight: "700", letterSpacing: 1.7, marginTop: 12, marginBottom: 14, textAlign: "center" },
  placementList: { borderTopWidth: 1, borderTopColor: colors.lineSoft },
  placementRow: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, borderTopWidth: 1, borderTopColor: colors.lineSoft },
  planetBadge: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.goldFill },
  planetGlyph: { color: colors.gold, fontFamily: "Georgia", fontSize: 16, fontWeight: "600" },
  placementCopy: { flex: 1 },
  planetName: { color: colors.ice, fontSize: 14, fontWeight: "700" },
  planetPosition: { color: colors.textSoft, fontSize: 11.5, marginTop: 3 },
  housePill: { backgroundColor: "rgba(139,147,212,0.16)", borderColor: colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 3 },
  housePillText: { color: colors.periwinkle, fontSize: 10.5, fontWeight: "700", letterSpacing: 0.5 },
  hero: { alignItems: "center", paddingVertical: 18 },
  heroTitle: { color: colors.ice, fontFamily: "Georgia", fontSize: 26, lineHeight: 32, textAlign: "center" },
  heroBody: { color: colors.textSoft, fontSize: 13, lineHeight: 20, textAlign: "center", maxWidth: 360, marginTop: 8 },
  weatherCard: { backgroundColor: "rgba(58,80,118,0.24)", borderColor: colors.line, borderRadius: radii.lg, borderWidth: 1, padding: 18 },
  weatherIcon: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: colors.periwinkleFill, marginBottom: 12 },
  weatherTitle: { color: colors.ice, fontFamily: "Georgia", fontSize: 18, fontWeight: "600" },
  weatherSub: { color: colors.textSoft, fontSize: 13, lineHeight: 20, marginTop: 7 },
  askButton: { minHeight: 54, marginTop: 20, borderRadius: radii.md, flexDirection: "row", gap: 9, alignItems: "center", justifyContent: "center" },
  askButtonText: { color: "#3A2218", fontSize: 14.5, fontWeight: "700" }
});
