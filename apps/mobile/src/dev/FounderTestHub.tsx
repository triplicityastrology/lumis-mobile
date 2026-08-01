import ArrowLeft from "lucide-react-native/icons/arrow-left";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import FlaskConical from "lucide-react-native/icons/flask-conical";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, radii, spacing } from "../theme/tokens";

export function FounderTestHub({
  onClose,
  onOpenCareCircle,
  onOpenBuildStatus,
  onOpenPersonaComparison,
  onOpenQuotaVerification,
  onOpenReflectionDeletion,
}: {
  onClose: () => void;
  onOpenCareCircle: () => void;
  onOpenBuildStatus: () => void;
  onOpenPersonaComparison: () => void;
  onOpenQuotaVerification: () => void;
  onOpenReflectionDeletion: () => void;
}) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Return to Lumis" accessibilityRole="button" onPress={onClose} style={styles.iconButton}>
          <ArrowLeft color={colors.ice} size={20} />
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>Founder Test Hub</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="never">
        <View style={styles.notice}>
          <FlaskConical color={colors.gold} size={20} />
          <Text style={styles.noticeText}>Development evidence only. Test fixtures are not live AI responses or production capabilities.</Text>
        </View>
        <Pressable
          accessibilityHint="Shows the source commit and test surfaces included in this Metro bundle"
          accessibilityLabel="Current build and feature status"
          accessibilityRole="button"
          onPress={onOpenBuildStatus}
          style={styles.row}
        >
          <View style={styles.rowCopy}>
            <Text style={styles.rowTitle}>Current build and feature status</Text>
            <Text style={styles.rowDetail}>Source marker · bundled test surfaces</Text>
            <Text style={styles.fixtureLabel}>Detect a stale Metro bundle</Text>
          </View>
          <ChevronRight color={colors.muted} size={20} />
        </Pressable>
        <Pressable
          accessibilityHint="Opens the gated disposable-account Care Circle staging journey"
          accessibilityLabel="Care Circle staging test"
          accessibilityRole="button"
          onPress={onOpenCareCircle}
          style={styles.row}
        >
          <View style={styles.rowCopy}>
            <Text style={styles.rowTitle}>Care Circle staging test</Text>
            <Text style={styles.rowDetail}>One iPhone · Caree ↔ Carer</Text>
            <Text style={styles.fixtureLabel}>Deployment gate required</Text>
          </View>
          <ChevronRight color={colors.muted} size={20} />
        </Pressable>
        <Pressable
          accessibilityHint="Opens the local Acceptance, Spark, and Awareness comparison"
          accessibilityLabel="Persona behaviour comparison"
          accessibilityRole="button"
          onPress={onOpenPersonaComparison}
          style={styles.row}
        >
          <View style={styles.rowCopy}>
            <Text style={styles.rowTitle}>Persona behaviour comparison</Text>
            <Text style={styles.rowDetail}>Acceptance · Spark · Awareness</Text>
            <Text style={styles.fixtureLabel}>Local fixture, not live AI</Text>
          </View>
          <ChevronRight color={colors.muted} size={20} />
        </Pressable>
        <Pressable
          accessibilityHint="Opens read-only birth-change quota evidence"
          accessibilityLabel="Quota verification"
          accessibilityRole="button"
          onPress={onOpenQuotaVerification}
          style={styles.row}
        >
          <View style={styles.rowCopy}>
            <Text style={styles.rowTitle}>Quota verification</Text>
            <Text style={styles.rowDetail}>Remaining · consumed · refresh source</Text>
            <Text style={styles.fixtureLabel}>Read-only account refresh</Text>
          </View>
          <ChevronRight color={colors.muted} size={20} />
        </Pressable>
        <Pressable
          accessibilityHint="Opens a disposable local reflection deletion journey"
          accessibilityLabel="Past Reflections deletion test"
          accessibilityRole="button"
          onPress={onOpenReflectionDeletion}
          style={styles.row}
        >
          <View style={styles.rowCopy}>
            <Text style={styles.rowTitle}>Past Reflections deletion test</Text>
            <Text style={styles.rowDetail}>Cancel · failure preservation · retry · delete</Text>
            <Text style={styles.fixtureLabel}>Disposable local fixture only</Text>
          </View>
          <ChevronRight color={colors.muted} size={20} />
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

export function FounderTestHubEntry({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel="Open Founder Test Hub"
      accessibilityRole="button"
      onPress={onPress}
      style={styles.entry}
    >
      <FlaskConical color={colors.navy950} size={17} />
      <Text style={styles.entryText}>Founder tests</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.navy950, flex: 1 },
  header: { alignItems: "center", borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", minHeight: 64, paddingHorizontal: spacing.lg },
  iconButton: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 20, borderWidth: 1, height: 40, justifyContent: "center", width: 40 },
  title: { color: colors.ice, flex: 1, fontSize: 21, fontWeight: "700", textAlign: "center" },
  headerSpacer: { width: 40 },
  content: { gap: spacing.md, padding: spacing.lg },
  notice: { alignItems: "flex-start", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radii.sm, borderWidth: 1, flexDirection: "row", gap: spacing.sm, padding: spacing.md },
  noticeText: { color: colors.textSoft, flex: 1, fontSize: 14, lineHeight: 21 },
  row: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radii.sm, borderWidth: 1, flexDirection: "row", minHeight: 104, padding: spacing.md },
  rowCopy: { flex: 1, gap: 5 },
  rowTitle: { color: colors.ice, fontSize: 17, fontWeight: "700" },
  rowDetail: { color: colors.textSoft, fontSize: 14 },
  fixtureLabel: { color: colors.goldLight, fontSize: 12, fontWeight: "600" },
  entry: { alignItems: "center", backgroundColor: colors.gold, borderRadius: 18, bottom: 84, flexDirection: "row", gap: 6, minHeight: 40, paddingHorizontal: 13, position: "absolute", right: 14, zIndex: 50 },
  entryText: { color: colors.navy950, fontSize: 12, fontWeight: "800" },
});
