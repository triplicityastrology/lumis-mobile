import { LinearGradient } from "expo-linear-gradient";
import Bell from "lucide-react-native/icons/bell";
import MessageCircle from "lucide-react-native/icons/message-circle";
import Moon from "lucide-react-native/icons/moon";
import Sparkles from "lucide-react-native/icons/sparkles";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G, Line, Text as SvgText } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";

import type { ChartV2 } from "@lumis/shared";

import { CelestialBackground } from "../components/CelestialBackground";
import { MainTabBar, type MainTab } from "../components/MainTabBar";
import { colors, radii, spacing } from "../theme/tokens";

const SUNRISE = ["#E5C06B", "#E9B083", "#E89B92"] as const;

const SIGN_INDEX: Record<string, number> = {
  aries: 0, taurus: 1, gemini: 2, cancer: 3, leo: 4, virgo: 5,
  libra: 6, scorpio: 7, sagittarius: 8, capricorn: 9, aquarius: 10, pisces: 11
};

const SIGN_GLYPHS = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"];

const PLANET_GLYPHS: Record<string, string> = {
  sun: "☉", moon: "☽", mercury: "☿", venus: "♀", mars: "♂", jupiter: "♃",
  saturn: "♄", uranus: "♅", neptune: "♆", pluto: "♇", chiron: "⚷",
  true_node: "☊", south_node: "☋", ascendant: "ASC", medium_coeli: "MC"
};

function zodiacLongitude(sign: string, degree: number) {
  return (SIGN_INDEX[sign.toLowerCase()] ?? 0) * 30 + degree;
}

function pointOnWheel(longitude: number, radius: number) {
  const radians = ((longitude - 90) * Math.PI) / 180;
  return { x: 150 + Math.cos(radians) * radius, y: 150 + Math.sin(radians) * radius };
}

function InsightsChartWheel({ chart, size = 230 }: { chart: ChartV2; size?: number }) {
  const center = 150;
  const plotted = chart.planets.filter(
    (planet) => planet.key !== "ascendant" && planet.key !== "medium_coeli"
  );
  const houseAngles =
    chart.precision === "full"
      ? chart.houses.map((house) => zodiacLongitude(house.sign, house.cuspDegree))
      : [];
  const ascLongitude = chart.angles.ascendant
    ? zodiacLongitude(chart.angles.ascendant.sign, chart.angles.ascendant.degree)
    : null;

  return (
    <Svg accessibilityLabel="Natal chart wheel" height={size} viewBox="0 0 300 300" width={size}>
      <Circle cx={center} cy={center} fill="rgba(7,19,33,0.55)" r="137" stroke="#D7A950" strokeWidth="1.2" />
      <Circle cx={center} cy={center} fill="none" opacity="0.72" r="112" stroke="#EDE3D4" strokeWidth="0.7" />
      <Circle cx={center} cy={center} fill="none" opacity="0.52" r="80" stroke="#9298D5" strokeWidth="0.8" />
      <Circle cx={center} cy={center} fill="none" opacity="0.42" r="46" stroke="#EDE3D4" strokeWidth="0.6" />

      {/* sign sector dividers + glyphs on the rim */}
      {Array.from({ length: 12 }).map((_, index) => {
        const outer = pointOnWheel(index * 30, 136);
        const inner = pointOnWheel(index * 30, 112);
        const glyphPoint = pointOnWheel(index * 30 + 15, 124);
        return (
          <G key={`sign-${index}`}>
            <Line opacity="0.4" stroke="#EDE3D4" strokeWidth="0.6" x1={inner.x} x2={outer.x} y1={inner.y} y2={outer.y} />
            <SvgText fill="#C9A96E" fontSize="12" opacity="0.9" textAnchor="middle" x={glyphPoint.x} y={glyphPoint.y + 4}>
              {SIGN_GLYPHS[index]}
            </SvgText>
          </G>
        );
      })}

      {/* house cusp spokes */}
      {houseAngles.map((angle, index) => {
        const outer = pointOnWheel(angle, 111);
        const inner = pointOnWheel(angle, 46);
        return <Line key={`house-${index}`} opacity="0.26" stroke="#D7A950" strokeWidth="0.7" x1={inner.x} x2={outer.x} y1={inner.y} y2={outer.y} />;
      })}

      {/* Ascendant / Descendant axis */}
      {ascLongitude != null ? (
        <Line
          opacity="0.7"
          stroke="#EDE3D4"
          strokeWidth="1.1"
          x1={pointOnWheel(ascLongitude, 112).x}
          x2={pointOnWheel(ascLongitude + 180, 112).x}
          y1={pointOnWheel(ascLongitude, 112).y}
          y2={pointOnWheel(ascLongitude + 180, 112).y}
        />
      ) : null}

      {/* planets */}
      {plotted.map((planet, index) => {
        const angle = planet.absoluteLongitude ?? zodiacLongitude(planet.sign, planet.degree);
        const point = pointOnWheel(angle, 94 - (index % 3) * 9);
        const luminary = planet.key === "sun" || planet.key === "moon";
        return (
          <SvgText
            fill={luminary ? "#F1C56B" : "#F7EBDD"}
            fontSize={luminary ? 17 : 14}
            fontWeight="600"
            key={`${planet.key}-${index}`}
            textAnchor="middle"
            x={point.x}
            y={point.y + 5}
          >
            {PLANET_GLYPHS[planet.key] ?? "•"}
          </SvgText>
        );
      })}

      {ascLongitude != null ? (
        <SvgText fill="#8A9BB0" fontSize="9" fontWeight="700" textAnchor="middle" x={pointOnWheel(ascLongitude, 146).x} y={pointOnWheel(ascLongitude, 146).y + 3}>
          ASC
        </SvgText>
      ) : null}
      <Circle cx={center} cy={center} fill="#D7A950" r="3.5" />
    </Svg>
  );
}

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
              <InsightsChartWheel chart={chart} size={232} />
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
