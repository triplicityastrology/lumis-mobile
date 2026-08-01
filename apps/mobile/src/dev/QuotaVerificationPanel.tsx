import ArrowLeft from "lucide-react-native/icons/arrow-left";
import RefreshCw from "lucide-react-native/icons/refresh-cw";
import { useState } from "react";
import { AccessibilityInfo, ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, radii, spacing } from "../theme/tokens";
import type { QuotaVerificationEvidence } from "./quotaVerification";

type RefreshStatus = "not_refreshed" | "refreshing" | "refreshed" | "failed";

export function QuotaVerificationPanel({
  initialEvidence,
  onBack,
  onReload,
}: {
  initialEvidence: QuotaVerificationEvidence;
  onBack: () => void;
  onReload: () => Promise<QuotaVerificationEvidence>;
}) {
  const [evidence, setEvidence] = useState(initialEvidence);
  const [status, setStatus] = useState<RefreshStatus>("not_refreshed");

  async function reload() {
    if (status === "refreshing") return;
    setStatus("refreshing");
    try {
      const next = await onReload();
      setEvidence(next);
      setStatus("refreshed");
      void AccessibilityInfo.announceForAccessibility("Authoritative quota refresh complete.");
    } catch {
      setStatus("failed");
      void AccessibilityInfo.announceForAccessibility("Quota refresh failed. Existing values were not changed.");
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back to Founder Test Hub" accessibilityRole="button" onPress={onBack} style={styles.iconButton}>
          <ArrowLeft color={colors.ice} size={20} />
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>Quota verification</Text>
        <View style={styles.headerSpacer} />
      </View>
      <View style={styles.content}>
        <Text style={styles.note}>Read-only development evidence. Reload refreshes account state and never changes the quota.</Text>
        <View style={styles.card}>
          <EvidenceRow label="Remaining allowance" value={formatCount(evidence.remainingAllowance)} />
          <EvidenceRow label="Consumed count" value={formatCount(evidence.consumedCount)} />
          <EvidenceRow label="Refresh status" value={formatStatus(status)} />
          <EvidenceRow label="Source" value={evidence.sourceLabel} />
        </View>
        {status === "failed" ? (
          <Text accessibilityLiveRegion="assertive" style={styles.error}>Refresh could not complete. The displayed account state was not replaced.</Text>
        ) : null}
        <Pressable
          accessibilityLabel={status === "failed" ? "Retry quota refresh" : "Reload quota evidence"}
          accessibilityRole="button"
          disabled={status === "refreshing"}
          onPress={() => void reload()}
          style={[styles.reload, status === "refreshing" && styles.disabled]}
        >
          {status === "refreshing" ? <ActivityIndicator color={colors.navy950} /> : <RefreshCw color={colors.navy950} size={18} />}
          <Text style={styles.reloadText}>{status === "failed" ? "Retry" : "Reload"}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function EvidenceRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.row}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text></View>;
}

function formatCount(value: number | null) {
  return value == null ? "Unavailable" : String(value);
}

function formatStatus(status: RefreshStatus) {
  return status === "not_refreshed" ? "Not refreshed" : status === "refreshing" ? "Refreshing" : status === "refreshed" ? "Refreshed" : "Refresh failed";
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.navy950, flex: 1 },
  header: { alignItems: "center", borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", minHeight: 64, paddingHorizontal: spacing.lg },
  iconButton: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 20, borderWidth: 1, height: 40, justifyContent: "center", width: 40 },
  title: { color: colors.ice, flex: 1, fontSize: 21, fontWeight: "700", textAlign: "center" },
  headerSpacer: { width: 40 },
  content: { gap: spacing.md, padding: spacing.lg },
  note: { color: colors.goldLight, fontSize: 13, lineHeight: 20 },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radii.sm, borderWidth: 1, overflow: "hidden" },
  row: { borderTopColor: colors.lineSoft, borderTopWidth: 1, gap: 6, minHeight: 64, padding: spacing.md },
  label: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  value: { color: colors.ice, fontSize: 16, lineHeight: 22 },
  error: { color: colors.warnSolid, fontSize: 14, lineHeight: 21 },
  reload: { alignItems: "center", alignSelf: "stretch", backgroundColor: colors.gold, borderRadius: radii.sm, flexDirection: "row", gap: spacing.sm, justifyContent: "center", minHeight: 50 },
  disabled: { opacity: 0.6 },
  reloadText: { color: colors.navy950, fontSize: 15, fontWeight: "800" },
});
