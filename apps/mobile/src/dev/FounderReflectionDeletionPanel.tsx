import ArrowLeft from "lucide-react-native/icons/arrow-left";
import MessageCircle from "lucide-react-native/icons/message-circle";
import RotateCcw from "lucide-react-native/icons/rotate-ccw";
import Trash2 from "lucide-react-native/icons/trash-2";
import { useReducer, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radii, spacing } from "../theme/tokens";
import { DISPOSABLE_REFLECTION, createFounderReflectionDeletionState, reduceFounderReflectionDeletion } from "./founderReflectionDeletionJourney";
import { FounderSignedInReflectionDeletionPanel } from "./FounderSignedInReflectionDeletionPanel";

export function FounderReflectionDeletionJourney({ onBack }: { onBack: () => void }) {
  const [mode, setMode] = useState<"local" | "signed_in">("local");
  const [state, dispatch] = useReducer(reduceFounderReflectionDeletion, undefined, createFounderReflectionDeletionState);
  if (mode === "signed_in") {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Back to Founder Test Hub" accessibilityRole="button" onPress={onBack} style={styles.iconButton}><ArrowLeft color={colors.ice} size={20} /></Pressable>
          <Text accessibilityRole="header" style={styles.title}>Reflection deletion test</Text>
          <View style={styles.headerSpacer} />
        </View>
        <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="never" keyboardShouldPersistTaps="handled">
          <Pressable accessibilityRole="button" onPress={() => setMode("local")} style={styles.modeButton}><Text style={styles.modeText}>Switch to local demo</Text></Pressable>
          <FounderSignedInReflectionDeletionPanel />
        </ScrollView>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back to Founder Test Hub" accessibilityRole="button" onPress={onBack} style={styles.iconButton}><ArrowLeft color={colors.ice} size={20} /></Pressable>
        <Text accessibilityRole="header" style={styles.title}>Reflection deletion test</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="never">
        <Pressable accessibilityRole="button" onPress={() => setMode("signed_in")} style={styles.modeButton}><Text style={styles.modeText}>Open gated signed-in staging mode</Text></Pressable>
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>LOCAL DEMO FIXTURE</Text>
          <Text style={styles.noticeBody}>No signed-in account or remote reflection is read or changed. Signed-in deletion is Not Ready until migration 0036 is authorised and applied remotely.</Text>
        </View>
        {state.rowPresent ? (
          <View accessibilityLabel="Disposable local reflection row" style={styles.row}>
            <View style={styles.rowIcon}><MessageCircle color="#8B93D4" size={20} /></View>
            <View style={styles.rowCopy}><Text style={styles.rowTitle}>{DISPOSABLE_REFLECTION.title}</Text><Text style={styles.rowMeta}>{DISPOSABLE_REFLECTION.dateLabel}</Text></View>
            <Pressable accessibilityLabel={`Delete reflection ${DISPOSABLE_REFLECTION.title}`} accessibilityRole="button" hitSlop={10} onPress={() => dispatch({ type: "open_confirmation" })} style={styles.deleteButton}><Trash2 color={colors.goldLight} size={18} /></Pressable>
          </View>
        ) : (
          <View accessibilityLiveRegion="polite" style={styles.deletedState}>
            <Text style={styles.deletedTitle}>Deletion confirmed</Text>
            <Text style={styles.noticeBody}>The disposable row disappeared only after the successful confirmed retry.</Text>
            <Pressable accessibilityLabel="Create another disposable reflection fixture" accessibilityRole="button" onPress={() => dispatch({ type: "reset" })} style={styles.resetButton}><RotateCcw color={colors.navy950} size={18} /><Text style={styles.resetText}>Create Fixture Again</Text></Pressable>
          </View>
        )}
        <View style={styles.steps}>
          <Text style={styles.stepTitle}>Test path</Text>
          <Text style={styles.step}>1. Open Delete, then Cancel. The row remains.</Text>
          <Text style={styles.step}>2. Open Delete again and confirm. The fixture simulates a safe failure; the row remains.</Text>
          <Text style={styles.step}>3. Tap Retry delete. The same logical request is reused and the row disappears only after success.</Text>
        </View>
      </ScrollView>
      <Modal animationType="fade" onRequestClose={() => dispatch({ type: "cancel" })} transparent visible={state.dialogOpen}>
        <View style={styles.overlay}>
          <View accessibilityLabel="Delete Past Reflection" accessibilityViewIsModal style={styles.dialog}>
            <Text style={styles.dialogTitle}>Delete Past Reflection?</Text>
            <Text style={styles.dialogBody}>{DISPOSABLE_REFLECTION.title} · {DISPOSABLE_REFLECTION.dateLabel}</Text>
            <Text style={styles.warning}>This removes this local test reflection and its messages. It cannot be undone.</Text>
            {state.phase === "failed" ? <Text accessibilityLiveRegion="assertive" role="alert" style={styles.error}>Lumis could not delete this reflection. It remains saved. Retry or cancel.</Text> : null}
            <View style={styles.actions}>
              <Pressable accessibilityRole="button" onPress={() => dispatch({ type: "cancel" })} style={styles.cancel}><Text style={styles.cancelText}>Cancel</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={() => dispatch({ type: "confirm" })} style={styles.confirm}><Text style={styles.confirmText}>{state.phase === "failed" ? "Retry delete" : "Delete"}</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.navy950, flex: 1 },
  header: { alignItems: "center", borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", minHeight: 64, paddingHorizontal: spacing.lg },
  iconButton: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 20, borderWidth: 1, height: 40, justifyContent: "center", width: 40 },
  title: { color: colors.ice, flex: 1, fontSize: 20, fontWeight: "700", textAlign: "center" },
  headerSpacer: { width: 40 }, content: { gap: spacing.md, padding: spacing.lg },
  notice: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radii.sm, borderWidth: 1, gap: spacing.sm, padding: spacing.md },
  noticeTitle: { color: colors.goldLight, fontSize: 12, fontWeight: "800" }, noticeBody: { color: colors.textSoft, fontSize: 14, lineHeight: 21 },
  row: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radii.sm, borderWidth: 1, flexDirection: "row", gap: spacing.sm, minHeight: 84, padding: spacing.md },
  rowIcon: { alignItems: "center", backgroundColor: colors.navy900, borderRadius: 20, height: 40, justifyContent: "center", width: 40 },
  rowCopy: { flex: 1, gap: 5 }, rowTitle: { color: colors.ice, fontSize: 16, fontWeight: "700" }, rowMeta: { color: colors.textSoft, fontSize: 13 },
  deleteButton: { alignItems: "center", borderColor: colors.line, borderRadius: 20, borderWidth: 1, height: 40, justifyContent: "center", width: 40 },
  steps: { gap: spacing.sm, paddingVertical: spacing.sm }, stepTitle: { color: colors.ice, fontSize: 16, fontWeight: "700" }, step: { color: colors.textSoft, fontSize: 14, lineHeight: 21 },
  deletedState: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radii.sm, borderWidth: 1, gap: spacing.sm, padding: spacing.lg }, deletedTitle: { color: colors.ice, fontSize: 18, fontWeight: "800" },
  resetButton: { alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.gold, borderRadius: radii.sm, flexDirection: "row", gap: spacing.sm, minHeight: 46, paddingHorizontal: spacing.md }, resetText: { color: colors.navy950, fontWeight: "800" },
  overlay: { alignItems: "center", backgroundColor: "rgba(3, 10, 20, 0.78)", flex: 1, justifyContent: "center", padding: spacing.lg }, dialog: { backgroundColor: colors.navy900, borderColor: colors.line, borderRadius: radii.sm, borderWidth: 1, gap: spacing.md, maxWidth: 420, padding: spacing.lg, width: "100%" },
  dialogTitle: { color: colors.ice, fontSize: 20, fontWeight: "800" }, dialogBody: { color: colors.textSoft, fontSize: 15 }, warning: { color: colors.textSoft, fontSize: 14, lineHeight: 21 }, error: { color: colors.goldLight, fontSize: 14, fontWeight: "700", lineHeight: 21 },
  actions: { flexDirection: "row", gap: spacing.sm }, cancel: { alignItems: "center", borderColor: colors.line, borderRadius: radii.sm, borderWidth: 1, flex: 1, justifyContent: "center", minHeight: 48 }, cancelText: { color: colors.ice, fontWeight: "700" }, confirm: { alignItems: "center", backgroundColor: colors.gold, borderRadius: radii.sm, flex: 1, justifyContent: "center", minHeight: 48 }, confirmText: { color: colors.navy950, fontWeight: "800" },
  modeButton: { alignItems: "center", borderColor: colors.gold, borderRadius: radii.sm, borderWidth: 1, justifyContent: "center", minHeight: 48 }, modeText: { color: colors.goldLight, fontWeight: "800" },
});
