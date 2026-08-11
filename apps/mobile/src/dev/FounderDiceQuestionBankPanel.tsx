import * as Crypto from "expo-crypto";
import { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { colors, radii, spacing } from "../theme/tokens";
import {
  FOUNDER_ENGLISH_DRAFTS,
  FOUNDER_QUESTION_DRAFTS,
  FOUNDER_SELECTION_INSTRUCTION,
  FOUNDER_ZH_HANT_DRAFTS,
  NON_EXCLUDABLE_ZH_AUTHORING_IDS,
  buildFounderQuestionRegistry,
  type QuestionChecksum,
} from "./founderDiceQuestionBank";

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function FounderDiceQuestionBankPanel({ buildSha }: { buildSha: string }) {
  const { fontScale, width } = useWindowDimensions();
  const stacked = width < 760 || fontScale >= 1.2;
  const [excludedZhId, setExcludedZhId] = useState<string | null>(null);
  const [checksums, setChecksums] = useState<readonly QuestionChecksum[]>([]);
  const [exportText, setExportText] = useState<string | null>(null);
  const [status, setStatus] = useState("Traditional Chinese registry blocked pending one exclusion");

  useEffect(() => {
    let active = true;
    void Promise.all(FOUNDER_QUESTION_DRAFTS.map(async (draft) => ({
      authoring_id: draft.authoring_id,
      sha256: await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, draft.exact_text),
    }))).then((items) => { if (active) setChecksums(items); });
    return () => { active = false; };
  }, []);

  const checksumById = useMemo(() => new Map(checksums.map((item) => [item.authoring_id, item.sha256])), [checksums]);

  const prepareExport = async () => {
    try {
      const registry = buildFounderQuestionRegistry(excludedZhId, checksums);
      const registryJson = canonicalJson({ build_sha: buildSha, registry });
      const sha256 = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, registryJson);
      setExportText(canonicalJson({ registry, registry_sha256: sha256, build_sha: buildSha }));
      setStatus(`20/20 local registry ready · excluded ${excludedZhId} · runtime unavailable`);
    } catch (error) {
      setExportText(null);
      setStatus(error instanceof Error ? error.message : "STOP_S2_T295_REGISTRY");
    }
  };

  const downloadExport = () => {
    if (!exportText || Platform.OS !== "web" || typeof document === "undefined") {
      setStatus(exportText ? "Export is selectable below on this device" : "Select one exclusion before export");
      return;
    }
    const href = URL.createObjectURL(new Blob([`${exportText}\n`], { type: "application/json;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `lumis-founder-dice-question-bank-${buildSha.slice(0, 12)}.json`;
    anchor.click();
    URL.revokeObjectURL(href);
    setStatus("Downloaded exact-text 20/20 review registry");
  };

  return <View accessibilityLabel="Founder exact Dice question bank" style={styles.card}>
    <Text accessibilityRole="header" style={styles.title}>Founder question bank</Text>
    <Text style={styles.helper}>All 41 supplied drafts are preserved exactly. English is locally frozen. Traditional Chinese remains entirely unfrozen until one exclusion is selected.</Text>
    <View accessibilityLiveRegion="polite" accessibilityRole="text" style={styles.blocker}>
      <Text style={styles.blockerText}>{FOUNDER_SELECTION_INSTRUCTION}</Text>
      <Text style={styles.statusText}>{excludedZhId ? `${excludedZhId} selected for exclusion · 20 zh-Hant entries can now be frozen on export` : "No zh-Hant entry frozen · 20/20 registry blocked"}</Text>
    </View>
    <View style={[styles.columns, stacked && styles.columnsStacked]}>
      <View style={styles.column}>
        <Text accessibilityRole="header" style={styles.columnTitle}>English · 20 frozen</Text>
        {FOUNDER_ENGLISH_DRAFTS.map((draft) => <QuestionRow checksum={checksumById.get(draft.authoring_id)} draft={draft} key={draft.authoring_id} state="frozen" />)}
      </View>
      <View style={styles.column}>
        <Text accessibilityRole="header" style={styles.columnTitle}>繁體中文 · 21 supplied</Text>
        {FOUNDER_ZH_HANT_DRAFTS.map((draft) => {
          const selected = excludedZhId === draft.authoring_id;
          const nonExcludable = (NON_EXCLUDABLE_ZH_AUTHORING_IDS as readonly string[]).includes(draft.authoring_id);
          return <Pressable
            accessibilityLabel={`${draft.authoring_id}, ${nonExcludable ? "required control, cannot be excluded" : selected ? "selected for exclusion" : "candidate to exclude"}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected, disabled: nonExcludable }}
            disabled={nonExcludable}
            key={draft.authoring_id}
            onPress={() => { setExcludedZhId(draft.authoring_id); setExportText(null); setStatus(`${draft.authoring_id} selected for exclusion · export not prepared`); }}
            style={[styles.choice, selected && styles.choiceSelected, nonExcludable && styles.choiceLocked]}
          >
            <QuestionRow checksum={checksumById.get(draft.authoring_id)} draft={draft} state={nonExcludable ? "required control" : selected ? "excluded" : "pending"} />
          </Pressable>;
        })}
      </View>
    </View>
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: excludedZhId === null || checksums.length !== 41 }} disabled={excludedZhId === null || checksums.length !== 41} onPress={() => void prepareExport()} style={[styles.button, (excludedZhId === null || checksums.length !== 41) && styles.disabled]}>
      <Text style={styles.buttonText}>Freeze selected 20/20 registry</Text>
    </Pressable>
    {exportText ? <Pressable accessibilityRole="button" onPress={downloadExport} style={styles.secondaryButton}><Text style={styles.secondaryText}>Download rating / review export</Text></Pressable> : null}
    <Text accessibilityLiveRegion="polite" accessibilityRole="text" style={styles.statusText}>{status}</Text>
    <Text style={styles.runtime}>Runtime accepts fixture_id only · unavailable · provider calls 0 · units 0 · persistence 0</Text>
    {exportText ? <Text selectable style={styles.preview}>{exportText}</Text> : null}
  </View>;
}

function QuestionRow({ checksum, draft, state }: { checksum?: string; draft: { authoring_id: string; exact_text: string }; state: "frozen" | "pending" | "excluded" | "required control" }) {
  return <View style={styles.row}>
    <View style={styles.rowHeading}><Text style={styles.id}>{draft.authoring_id}</Text><Text style={styles.state}>{state}</Text></View>
    <Text selectable style={styles.question}>{draft.exact_text}</Text>
    <Text selectable style={styles.checksum}>SHA-256 {checksum ?? "calculating"}</Text>
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: "rgba(22,39,61,0.94)", borderColor: colors.gold, borderRadius: radii.sm, borderWidth: 1, marginTop: spacing.md, padding: spacing.md },
  title: { color: colors.ice, fontSize: 20, fontWeight: "800" },
  helper: { color: colors.textSoft, fontSize: 14, lineHeight: 21, marginTop: spacing.sm },
  blocker: { backgroundColor: "rgba(134,200,166,0.12)", borderColor: colors.gold, borderRadius: radii.sm, borderWidth: 1, marginTop: spacing.md, padding: spacing.md },
  blockerText: { color: colors.goldLight, fontSize: 17, fontWeight: "800", lineHeight: 24 },
  columns: { alignItems: "flex-start", flexDirection: "row", gap: spacing.md, marginTop: spacing.md },
  columnsStacked: { flexDirection: "column" },
  column: { flex: 1, minWidth: 0, width: "100%" },
  columnTitle: { color: colors.ice, fontSize: 16, fontWeight: "800", marginBottom: spacing.sm },
  choice: { borderColor: "transparent", borderRadius: radii.sm, borderWidth: 1, marginBottom: 6 },
  choiceSelected: { backgroundColor: "rgba(221,178,85,0.12)", borderColor: colors.gold },
  choiceLocked: { backgroundColor: "rgba(134,200,166,0.08)", borderColor: colors.goldLight },
  row: { borderBottomColor: colors.line, borderBottomWidth: 1, padding: spacing.sm },
  rowHeading: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, justifyContent: "space-between" },
  id: { color: colors.goldLight, fontSize: 12, fontWeight: "800" },
  state: { color: colors.muted, fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  question: { color: colors.ice, fontSize: 15, lineHeight: 23, marginTop: 5 },
  checksum: { color: colors.muted, fontFamily: "Courier", fontSize: 9, lineHeight: 14, marginTop: 6 },
  button: { alignItems: "center", backgroundColor: colors.gold, borderRadius: 7, justifyContent: "center", marginTop: spacing.md, minHeight: 52, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  buttonText: { color: colors.navy950, fontSize: 14, fontWeight: "800", textAlign: "center" },
  disabled: { opacity: 0.4 },
  secondaryButton: { alignItems: "center", borderColor: colors.gold, borderRadius: 7, borderWidth: 1, justifyContent: "center", marginTop: spacing.sm, minHeight: 48, paddingHorizontal: spacing.md },
  secondaryText: { color: colors.goldLight, fontSize: 13, fontWeight: "800", textAlign: "center" },
  statusText: { color: colors.textSoft, fontSize: 13, lineHeight: 20, marginTop: spacing.sm },
  runtime: { color: colors.goldLight, fontSize: 12, fontWeight: "700", lineHeight: 18, marginTop: spacing.sm },
  preview: { backgroundColor: colors.navy950, color: colors.textSoft, fontFamily: "Courier", fontSize: 9, lineHeight: 14, marginTop: spacing.md, maxHeight: 220, padding: spacing.sm },
});
