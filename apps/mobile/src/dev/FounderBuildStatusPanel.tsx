import ArrowLeft from "lucide-react-native/icons/arrow-left";
import CheckCircle2 from "lucide-react-native/icons/check-circle-2";
import RefreshCw from "lucide-react-native/icons/refresh-cw";
import { DevSettings, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radii, spacing } from "../theme/tokens";
import { resolveFounderBuildStatus } from "./founderBuildStatus";

export function FounderBuildStatusPanel({ onBack }: { onBack: () => void }) {
  const status = resolveFounderBuildStatus(process.env.EXPO_PUBLIC_LUMIS_SOURCE_COMMIT);
  const shortCommit = status.sourceCommit?.slice(0, 12) ?? "Marker unavailable";
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back to Founder Test Hub" accessibilityRole="button" onPress={onBack} style={styles.iconButton}>
          <ArrowLeft color={colors.ice} size={20} />
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>Current build</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="never">
        <View style={styles.summary}>
          <Text style={styles.eyebrow}>NORMAL EXPO DEVELOPMENT BUNDLE</Text>
          <Text selectable style={styles.commit}>{shortCommit}</Text>
          <Text accessibilityLiveRegion="polite" style={status.markerStatus === "verified" ? styles.ready : styles.warning}>
            {status.markerStatus === "verified" ? "Source marker verified by the launcher." : "Source marker unavailable. Restart Metro with pnpm start:normal-expo before testing."}
          </Text>
          <Text style={styles.version}>Panel {status.version}</Text>
        </View>
        <View style={styles.list}>
          {status.features.map((feature) => (
            <View key={feature.id} style={styles.row}>
              <CheckCircle2 color={colors.gold} size={19} />
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>{feature.label}</Text>
                <Text style={styles.rowDetail}>Included in bundle · {feature.version}</Text>
              </View>
            </View>
          ))}
        </View>
        <Text style={styles.note}>Bundle inclusion does not claim that a staging migration, Edge Function, or remote capability is deployed.</Text>
        <Pressable accessibilityHint="Reloads JavaScript from the currently connected Metro server" accessibilityLabel="Reload current Metro bundle" accessibilityRole="button" onPress={() => DevSettings.reload()} style={styles.reloadButton}>
          <RefreshCw color={colors.navy950} size={19} />
          <Text style={styles.reloadText}>Reload Current Bundle</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.navy950, flex: 1 },
  header: { alignItems: "center", borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", minHeight: 64, paddingHorizontal: spacing.lg },
  iconButton: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 20, borderWidth: 1, height: 40, justifyContent: "center", width: 40 },
  title: { color: colors.ice, flex: 1, fontSize: 21, fontWeight: "700", textAlign: "center" },
  headerSpacer: { width: 40 },
  content: { gap: spacing.md, padding: spacing.lg },
  summary: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radii.sm, borderWidth: 1, gap: spacing.sm, padding: spacing.lg },
  eyebrow: { color: colors.goldLight, fontSize: 12, fontWeight: "800" },
  commit: { color: colors.ice, fontSize: 24, fontWeight: "800" },
  ready: { color: colors.textSoft, fontSize: 14, lineHeight: 21 },
  warning: { color: colors.goldLight, fontSize: 14, fontWeight: "700", lineHeight: 21 },
  version: { color: colors.muted, fontSize: 12 },
  list: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radii.sm, borderWidth: 1, overflow: "hidden" },
  row: { alignItems: "center", borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", gap: spacing.sm, minHeight: 68, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  rowCopy: { flex: 1, gap: 3 },
  rowTitle: { color: colors.ice, fontSize: 15, fontWeight: "700" },
  rowDetail: { color: colors.textSoft, fontSize: 13 },
  note: { color: colors.textSoft, fontSize: 13, lineHeight: 20 },
  reloadButton: { alignItems: "center", backgroundColor: colors.gold, borderRadius: radii.sm, flexDirection: "row", gap: spacing.sm, justifyContent: "center", minHeight: 52, paddingHorizontal: spacing.md },
  reloadText: { color: colors.navy950, fontSize: 16, fontWeight: "800" },
});
