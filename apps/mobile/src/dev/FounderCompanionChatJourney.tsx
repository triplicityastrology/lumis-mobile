import * as Crypto from "expo-crypto";
import { CheckCircle2, LockKeyhole, MessageCircle, ShieldCheck, Sparkles } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CelestialBackground } from "../components/CelestialBackground";
import { colors, radii, spacing } from "../theme/tokens";
import {
  COMPANION_FIXTURE_IDS,
  RATING_DIMENSIONS,
  createCompanionFixtureExport,
  freezeCompanionDraft,
  validateCompanionDraft,
  type CompanionDraftDecision,
  type CompanionLanguage,
  type CompanionRatings,
  type CompanionVerdictEntry,
  type FrozenCompanionFixture,
  type RatingDimension,
} from "./founderCompanionChatContract";
import {
  ACCEPTED_CHAT_EXECUTION_EVIDENCE_SHA256,
  ACCEPTED_CHAT_WINDOW_AUTHORIZATION_SHA256,
  ACCEPTED_DICE_TECHNICAL_EVIDENCE_SHA256,
  ACCEPTED_POST_WINDOW_DISABLED_PROOF_SHA256,
  DOCUMENTED_CHAT_RUNTIME_COMMIT,
  FINAL_DICE_DEPLOYMENT_EVIDENCE_SCHEMA,
  FINAL_DICE_TECHNICAL_EVIDENCE_SCHEMA,
  FINAL_DICE_TECHNICAL_AUTHORITY,
  FOUNDER_CHAT_FIXTURE_SETS,
  WINDOW_PREVIEW_RECORDS,
  canonicalJson,
  createFounderWindowVerdict,
  inspectDiceTechnicalEvidence,
  inspectPostWindowDisabledProof,
  surfaceForFixture,
  type FounderChatSurface,
} from "./founderCompanionChatWindowContract";

const BUILD_SHA = process.env.EXPO_PUBLIC_FOUNDER_COMPANION_HEAD ?? "0000000000000000000000000000000000000000";
const BUILD_VALID = /^[a-f0-9]{40}$/.test(BUILD_SHA) && !/^0+$/.test(BUILD_SHA);
const DEFAULT_RATINGS = Object.fromEntries(RATING_DIMENSIONS.map((dimension) => [dimension, 3])) as CompanionRatings;
const LABELS: Record<RatingDimension, { en: string; "zh-Hant": string }> = {
  correctness: { en: "Correctness", "zh-Hant": "準確度" },
  usefulness: { en: "Usefulness", "zh-Hant": "實用度" },
  tone: { en: "Tone", "zh-Hant": "語氣" },
  translation_quality: { en: "Translation quality", "zh-Hant": "翻譯品質" },
  vagueness: { en: "Vagueness", "zh-Hant": "含糊程度" },
  repetition: { en: "Repetition", "zh-Hant": "重複程度" },
  overconfidence: { en: "Overconfidence", "zh-Hant": "過度肯定" },
  safety: { en: "Safety", "zh-Hant": "安全性" },
};

export default function FounderCompanionChatJourney() {
  const [surface, setSurface] = useState<FounderChatSurface>("companion");
  const [language, setLanguage] = useState<CompanionLanguage>("en");
  const [question, setQuestion] = useState("");
  const [decision, setDecision] = useState<CompanionDraftDecision | null>(null);
  const [draftStatus, setDraftStatus] = useState("Draft remains in memory on this device");
  const [frozen, setFrozen] = useState<Record<string, FrozenCompanionFixture>>({});
  const [fixturePackage, setFixturePackage] = useState<{ json: string; sha256: string } | null>(null);
  const [diceEvidenceText, setDiceEvidenceText] = useState("");
  const [diceStatus, setDiceStatus] = useState("Not imported");
  const [disabledProofText, setDisabledProofText] = useState("");
  const [disabledStatus, setDisabledStatus] = useState("Not imported");
  const [selectedId, setSelectedId] = useState(WINDOW_PREVIEW_RECORDS[0].fixture_id);
  const [ratings, setRatings] = useState<Record<string, CompanionRatings>>({});
  const [verdicts, setVerdicts] = useState<Record<string, CompanionVerdictEntry["verdict"]>>({});
  const [verdictPackage, setVerdictPackage] = useState<string | null>(null);

  const previewSet = WINDOW_PREVIEW_RECORDS.filter((record) => record.surface === surface);
  const selected = WINDOW_PREVIEW_RECORDS.find(({ fixture_id }) => fixture_id === selectedId && surfaceForFixture(fixture_id) === surface) ?? previewSet[0];
  const selectedRatings = ratings[selected.fixture_id] ?? DEFAULT_RATINGS;
  const filteredIds = FOUNDER_CHAT_FIXTURE_SETS[surface].filter((id) => language === "en" ? id.startsWith("chat_en_") : id.startsWith("chat_zh_hant_"));
  const nextFixtureId = useMemo(() => filteredIds.find((id) => !frozen[id]) ?? null, [filteredIds, frozen]);
  const surfaceFrozen = Object.values(frozen).filter((fixture) => surfaceForFixture(fixture.fixture_id) === surface && fixture.language === language).length;
  const executionReady = ACCEPTED_DICE_TECHNICAL_EVIDENCE_SHA256 !== null && ACCEPTED_CHAT_WINDOW_AUTHORIZATION_SHA256 !== null;
  const liveEvidenceReady = ACCEPTED_CHAT_EXECUTION_EVIDENCE_SHA256 !== null;

  const chooseSurface = (next: FounderChatSurface) => {
    setSurface(next);
    setDecision(null);
    const first = WINDOW_PREVIEW_RECORDS.find((record) => record.surface === next);
    if (first) setSelectedId(first.fixture_id);
  };

  const validate = () => {
    const next = validateCompanionDraft(question, language);
    setDecision(next);
    setDraftStatus(next.ok ? `${surface === "companion" ? "Companion" : "Chat"} local preflight passed; external routing remains required` : validationMessage(next.code));
  };

  const freeze = () => {
    if (!nextFixtureId || !decision?.ok) return;
    const fixture = freezeCompanionDraft(nextFixtureId, decision);
    if (!fixture || surfaceForFixture(fixture.fixture_id) !== surface) return;
    setFrozen((current) => ({ ...current, [fixture.fixture_id]: fixture }));
    setQuestion("");
    setDecision(null);
    setFixturePackage(null);
    setDraftStatus(`${fixture.fixture_id} frozen locally; it cannot be sent at runtime as text`);
  };

  const prepareFixtureChecksum = async () => {
    const payload = createCompanionFixtureExport(BUILD_SHA, Object.values(frozen));
    const json = canonicalJson(payload);
    const sha256 = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, json);
    setFixturePackage({ json: canonicalJson({ payload, sha256 }), sha256 });
  };

  const inspectDiceEvidence = async () => {
    try {
      const parsed = JSON.parse(diceEvidenceText) as unknown;
      const sha256 = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, canonicalJson(parsed));
      const result = inspectDiceTechnicalEvidence(parsed, sha256);
      setDiceStatus(result.code.replaceAll("_", " "));
    } catch {
      setDiceStatus("DICE EVIDENCE INVALID");
    }
  };

  const inspectDisabledProof = async () => {
    try {
      const parsed = JSON.parse(disabledProofText) as unknown;
      const sha256 = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, canonicalJson(parsed));
      setDisabledStatus(inspectPostWindowDisabledProof(parsed, sha256).code.replaceAll("_", " "));
    } catch {
      setDisabledStatus("POST WINDOW DISABLED INVALID");
    }
  };

  const prepareVerdictChecksum = async () => {
    if (!fixturePackage) {
      setVerdictPackage("Freeze all 60 fixtures and prepare their checksum first.");
      return;
    }
    const entries = WINDOW_PREVIEW_RECORDS.map((record) => ({
      fixture_id: record.fixture_id,
      language: record.language,
      surface: record.surface,
      ratings: ratings[record.fixture_id] ?? DEFAULT_RATINGS,
      verdict: verdicts[record.fixture_id] ?? "pending" as const,
    }));
    const payload = createFounderWindowVerdict({ buildSha: BUILD_SHA, fixtureExportSha256: fixturePackage.sha256, acceptedExecutionEvidenceSha256: null, postWindowDisabledProofSha256: null, entries });
    const sha256 = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, canonicalJson(payload));
    setVerdictPackage(canonicalJson({ payload, sha256 }));
  };

  return (
    <SafeAreaView style={styles.safe}>
      <CelestialBackground />
      <View accessibilityLabel="Exact source build" style={styles.buildStrip}>
        <Text style={styles.buildLabel}>S2-T271 · FOUNDER WINDOW · PRELOGIN · {BUILD_VALID ? "EXACT BUILD" : "BUILD UNAVAILABLE"}</Text>
        <Text numberOfLines={1} selectable style={styles.buildSha}>{BUILD_SHA}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>COMPANION / CHAT SYNTHETIC REVIEW</Text>
        <Text accessibilityRole="header" style={styles.title}>Founder test window</Text>
        <Text style={styles.intro}>A Founder path for closed fixtures and evidence review. Prepare synthetic fixtures now, then import independently accepted evidence later. This route cannot enter normal Chat, retain history, charge units, persist text, or call a provider.</Text>

        <View accessibilityLabel="Window journey status" style={styles.statusBand}>
          <Status icon={<CheckCircle2 color={colors.goldLight} size={18} />} title="Draft + freeze" detail="Local synthetic questions only" />
          <Status icon={<ShieldCheck color={colors.goldLight} size={18} />} title="External validation + routing" detail="Accepted Dice evidence required" />
          <Status icon={<LockKeyhole color={colors.goldLight} size={18} />} title="Fixture-ID execution" detail={executionReady ? "Source authority present" : "Blocked by source allow-list"} />
          <Status icon={<CheckCircle2 color={colors.goldLight} size={18} />} title="Disable + verdict" detail="Evidence and checksum export" />
        </View>

        <Text accessibilityRole="header" style={styles.sectionTitle}>1. Choose review surface</Text>
        <View accessibilityRole="tablist" style={styles.segmented}>
          <Segment label="Companion" selected={surface === "companion"} onPress={() => chooseSurface("companion")} />
          <Segment label="Normal Chat" selected={surface === "normal_chat"} onPress={() => chooseSurface("normal_chat")} />
        </View>
        <Text style={styles.helper}>{surface === "companion" ? "Reflective Companion style" : "Ordinary Chat projection style"}. Both remain synthetic and outside customer routing.</Text>

        <Text accessibilityRole="header" style={styles.sectionTitle}>2. Draft and freeze synthetic fixtures</Text>
        <View accessibilityRole="tablist" style={styles.segmented}>
          <Segment label="English" selected={language === "en"} onPress={() => { setLanguage("en"); setDecision(null); }} />
          <Segment label="繁體中文" selected={language === "zh-Hant"} onPress={() => { setLanguage("zh-Hant"); setDecision(null); }} />
        </View>
        <Text style={styles.helper}>{surfaceFrozen}/15 frozen for this set · {Object.keys(frozen).length}/60 total</Text>
        <TextInput
          accessibilityLabel={language === "en" ? `Synthetic ${surface} question` : `合成 ${surface} 問題`}
          multiline
          onChangeText={(value) => { setQuestion(value); setDecision(null); }}
          placeholder={language === "en" ? "Draft one customer-realistic synthetic question" : "草擬一條貼近客戶語氣的合成問題"}
          placeholderTextColor={colors.muted}
          style={styles.input}
          value={question}
        />
        <View style={styles.actions}>
          <Command label="Validate locally" onPress={validate} />
          <Command disabled={!decision?.ok || !nextFixtureId} label="Freeze next ID" primary onPress={freeze} />
        </View>
        <Text accessibilityLiveRegion="polite" accessibilityRole="text" style={styles.statusText}>{draftStatus}</Text>
        <Command disabled={Object.keys(frozen).length !== COMPANION_FIXTURE_IDS.length || !BUILD_VALID} label={`Prepare fixture checksum · ${Object.keys(frozen).length}/60`} onPress={() => void prepareFixtureChecksum()} />
        {fixturePackage ? <Text selectable style={styles.codeBlock}>{fixturePackage.json}</Text> : null}

        <Text accessibilityRole="header" style={styles.sectionTitle}>3. Import accepted Dice evidence</Text>
        <Text style={styles.helper}>Closed evidence only. Structurally valid self-authored JSON remains unaccepted until its SHA is compiled into this source.</Text>
        <TextInput accessibilityLabel="Accepted Dice evidence JSON" multiline onChangeText={setDiceEvidenceText} placeholder="Paste reviewed evidence envelope" placeholderTextColor={colors.muted} style={styles.evidenceInput} value={diceEvidenceText} />
        <Command disabled={!diceEvidenceText.trim()} label="Verify Dice evidence" onPress={() => void inspectDiceEvidence()} />
        <Text accessibilityLiveRegion="polite" accessibilityRole="text" style={styles.statusText}>{diceStatus}</Text>

        <Text accessibilityRole="header" style={styles.sectionTitle}>4. Authorization and invocation</Text>
        <View style={styles.gateBand}>
          <LockKeyhole color={colors.goldLight} size={20} />
          <View style={styles.flex}>
            <Text style={styles.gateTitle}>{executionReady ? "Authority present" : "Not authorized"}</Text>
            <Text style={styles.helper}>Authorization request requires accepted Dice evidence and a complete fixture checksum. Runtime accepts only fixture_id.</Text>
            <Text style={styles.code}>chat_runtime={DOCUMENTED_CHAT_RUNTIME_COMMIT}</Text>
            <Text style={styles.code}>dice_deployment={FINAL_DICE_DEPLOYMENT_EVIDENCE_SCHEMA}</Text>
            <Text style={styles.code}>dice_technical={FINAL_DICE_TECHNICAL_EVIDENCE_SCHEMA}</Text>
            <Text style={styles.code}>dice_authority={FINAL_DICE_TECHNICAL_AUTHORITY}</Text>
            <Text style={styles.code}>dice_evidence={ACCEPTED_DICE_TECHNICAL_EVIDENCE_SHA256 ?? "null"}</Text>
            <Text style={styles.code}>window_authorization={ACCEPTED_CHAT_WINDOW_AUTHORIZATION_SHA256 ?? "null"}</Text>
            <Text style={styles.code}>future mobile seam={"{\"fixture_id\":\"chat_…_v1\"}"}</Text>
          </View>
        </View>
        <Command disabled label="Request authorization" onPress={() => undefined} />
        <Command disabled label="Invoke selected fixture ID" onPress={() => undefined} />

        <Text accessibilityRole="header" style={styles.sectionTitle}>5. Companion / Chat response</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rail}>
          {previewSet.map((record) => (
            <Pressable accessibilityRole="button" accessibilityState={{ selected: selectedId === record.fixture_id }} key={record.fixture_id} onPress={() => setSelectedId(record.fixture_id)} style={[styles.fixtureChip, selectedId === record.fixture_id && styles.fixtureChipSelected]}>
              <Text style={[styles.fixtureChipText, selectedId === record.fixture_id && styles.fixtureChipTextSelected]}>{record.language} · {record.state === "offline_preview" ? "offline preview" : "not run"}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.responseBand}>
          <View style={styles.responseHeading}>
            {selected.surface === "companion" ? <Sparkles color={colors.goldLight} size={20} /> : <MessageCircle color={colors.goldLight} size={20} />}
            <View style={styles.flex}>
              <Text selectable style={styles.fixtureId}>{selected.fixture_id}</Text>
              <Text style={styles.helper}>{selected.surface.replaceAll("_", " ")} · {selected.language}</Text>
            </View>
            <Text style={styles.stateBadge}>{selected.state.replaceAll("_", " ")}</Text>
          </View>
          <Text style={styles.response}>{selected.assistant_message ?? "No accepted execution evidence imported."}</Text>
          <Text style={styles.code}>result={selected.result} · units_charged=0 · persistence_writes=0</Text>
          <Text style={styles.code}>provider_diagnostics=null · live_evidence={liveEvidenceReady ? "accepted" : "absent"}</Text>
        </View>

        <Text accessibilityRole="header" style={styles.sectionTitle}>6. Rate {selected.surface === "companion" ? "Companion" : "Chat"} response</Text>
        {RATING_DIMENSIONS.map((dimension) => (
          <View key={dimension} style={styles.ratingRow}>
            <Text style={styles.ratingLabel}>{LABELS[dimension][selected.language]}</Text>
            <View style={styles.ratingButtons}>
              {([1, 2, 3, 4, 5] as const).map((value) => (
                <Pressable accessibilityLabel={`${LABELS[dimension][selected.language]} ${value}`} accessibilityRole="button" accessibilityState={{ selected: selectedRatings[dimension] === value }} key={value} onPress={() => setRatings((current) => ({ ...current, [selected.fixture_id]: { ...selectedRatings, [dimension]: value } }))} style={[styles.ratingButton, selectedRatings[dimension] === value && styles.ratingButtonSelected]}>
                  <Text style={[styles.ratingButtonText, selectedRatings[dimension] === value && styles.ratingButtonTextSelected]}>{value}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))}
        <View style={styles.segmented}>
          {(["pending", "accepted", "returned"] as const).map((verdict) => <Segment key={verdict} label={verdict} selected={(verdicts[selected.fixture_id] ?? "pending") === verdict} onPress={() => setVerdicts((current) => ({ ...current, [selected.fixture_id]: verdict }))} />)}
        </View>

        <Text accessibilityRole="header" style={styles.sectionTitle}>7. Prove disabled and export verdict</Text>
        <TextInput accessibilityLabel="Post-window disabled proof JSON" multiline onChangeText={setDisabledProofText} placeholder="Paste reviewed disabled-proof envelope" placeholderTextColor={colors.muted} style={styles.evidenceInput} value={disabledProofText} />
        <Command disabled={!disabledProofText.trim()} label="Verify disabled proof" onPress={() => void inspectDisabledProof()} />
        <Text accessibilityLiveRegion="polite" accessibilityRole="text" style={styles.statusText}>{disabledStatus}</Text>
        <Command disabled={!fixturePackage} label="Prepare checksum verdict" primary onPress={() => void prepareVerdictChecksum()} />
        <Text style={styles.helper}>Export stays on screen. It includes no question text, provider diagnostics, member data, units, or persistence.</Text>
        {verdictPackage ? <Text accessibilityLiveRegion="polite" accessibilityRole="text" selectable style={styles.codeBlock}>{verdictPackage}</Text> : null}

        <View style={styles.boundaryBand}>
          <Text style={styles.code}>post_window_disabled={ACCEPTED_POST_WINDOW_DISABLED_PROOF_SHA256 ?? "null"}</Text>
          <Text style={styles.code}>NO_NORMAL_CHAT_INTEGRATION_AUTHORITY</Text>
          <Text style={styles.code}>NO_AZURE_TRAFFIC_AUTHORITY</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function validationMessage(code: string): string {
  return ({
    QUESTION_EMPTY: "Enter one synthetic question.", QUESTION_TOO_SHORT: "Add enough context for one clear question.", QUESTION_TOO_LONG: "Keep the question to one line and 280 characters.",
    QUESTION_LANGUAGE_MISMATCH: "Use the selected language only.", QUESTION_PRIVATE_DATA: "Remove names, contact details, birth data, and identifiers.", QUESTION_BUNDLED: "Use one question per fixture.",
  } as Record<string, string>)[code] ?? "Question cannot be frozen.";
}

function Status({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return <View style={styles.statusItem}>{icon}<View style={styles.flex}><Text style={styles.statusTitle}>{title}</Text><Text style={styles.statusDetail}>{detail}</Text></View></View>;
}

function Segment({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="tab" accessibilityState={{ selected }} onPress={onPress} style={[styles.segment, selected && styles.segmentSelected]}><Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{label}</Text></Pressable>;
}

function Command({ label, onPress, disabled = false, primary = false }: { label: string; onPress: () => void; disabled?: boolean; primary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.command, primary && styles.commandPrimary, disabled && styles.disabled]}><Text style={[styles.commandText, primary && styles.commandTextPrimary]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.navy950, flex: 1 },
  buildStrip: { backgroundColor: colors.navy950, borderBottomColor: colors.gold, borderBottomWidth: 1, justifyContent: "center", minHeight: 52, paddingHorizontal: spacing.md },
  buildLabel: { color: colors.goldLight, fontSize: 10, fontWeight: "800", letterSpacing: 0 },
  buildSha: { color: colors.textSoft, fontFamily: "Courier", fontSize: 8, marginTop: 2 },
  content: { padding: spacing.lg, paddingBottom: 72 },
  eyebrow: { color: colors.goldLight, fontSize: 12, fontWeight: "800", marginTop: spacing.sm },
  title: { color: colors.ice, fontSize: 30, fontWeight: "800", marginTop: 4 },
  intro: { color: colors.textSoft, fontSize: 15, lineHeight: 22, marginTop: spacing.sm },
  statusBand: { borderBottomColor: colors.line, borderTopColor: colors.line, borderBottomWidth: 1, borderTopWidth: 1, gap: spacing.md, marginTop: spacing.lg, paddingVertical: spacing.md },
  statusItem: { alignItems: "center", flexDirection: "row", gap: spacing.sm },
  statusTitle: { color: colors.ice, fontSize: 14, fontWeight: "800" },
  statusDetail: { color: colors.textSoft, fontSize: 12, lineHeight: 17, marginTop: 2 },
  sectionTitle: { color: colors.ice, fontSize: 19, fontWeight: "800", marginTop: spacing.xl },
  segmented: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radii.sm, borderWidth: 1, flexDirection: "row", marginTop: spacing.md, padding: 4 },
  segment: { alignItems: "center", borderRadius: 6, flex: 1, justifyContent: "center", minHeight: 48, paddingHorizontal: 6 },
  segmentSelected: { backgroundColor: colors.gold },
  segmentText: { color: colors.textSoft, fontSize: 13, fontWeight: "700", textAlign: "center", textTransform: "capitalize" },
  segmentTextSelected: { color: colors.navy950 },
  helper: { color: colors.textSoft, fontSize: 13, lineHeight: 19, marginTop: spacing.sm },
  input: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radii.sm, borderWidth: 1, color: colors.ice, fontSize: 16, lineHeight: 23, marginTop: spacing.md, minHeight: 112, padding: spacing.md, textAlignVertical: "top" },
  evidenceInput: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radii.sm, borderWidth: 1, color: colors.ice, fontFamily: "Courier", fontSize: 12, lineHeight: 17, marginTop: spacing.md, minHeight: 92, padding: spacing.md, textAlignVertical: "top" },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  command: { alignItems: "center", borderColor: colors.gold, borderRadius: 7, borderWidth: 1, flex: 1, justifyContent: "center", marginTop: spacing.md, minHeight: 50, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  commandPrimary: { backgroundColor: colors.gold },
  commandText: { color: colors.goldLight, fontSize: 13, fontWeight: "800", textAlign: "center" },
  commandTextPrimary: { color: colors.navy950 },
  disabled: { opacity: 0.42 },
  statusText: { color: colors.goldLight, fontSize: 12, fontWeight: "700", lineHeight: 18, marginTop: spacing.sm },
  codeBlock: { backgroundColor: colors.surface, borderRadius: radii.sm, color: colors.textSoft, fontFamily: "Courier", fontSize: 9, lineHeight: 13, marginTop: spacing.sm, maxHeight: 190, padding: spacing.sm },
  gateBand: { borderColor: colors.gold, borderRadius: radii.sm, borderWidth: 1, flexDirection: "row", gap: spacing.sm, marginTop: spacing.md, padding: spacing.md },
  gateTitle: { color: colors.ice, fontSize: 16, fontWeight: "800" },
  code: { color: colors.goldLight, fontFamily: "Courier", fontSize: 10, lineHeight: 15, marginTop: spacing.sm },
  flex: { flex: 1 },
  rail: { marginHorizontal: -spacing.lg, marginTop: spacing.md, paddingHorizontal: spacing.lg },
  fixtureChip: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 18, borderWidth: 1, justifyContent: "center", marginRight: 8, minHeight: 42, paddingHorizontal: 12 },
  fixtureChipSelected: { backgroundColor: colors.gold, borderColor: colors.gold },
  fixtureChipText: { color: colors.textSoft, fontSize: 12, fontWeight: "700" },
  fixtureChipTextSelected: { color: colors.navy950 },
  responseBand: { backgroundColor: "rgba(11,25,48,0.72)", borderColor: colors.line, borderRadius: radii.sm, borderWidth: 1, marginTop: spacing.md, padding: spacing.md },
  responseHeading: { alignItems: "flex-start", flexDirection: "row", gap: spacing.sm },
  fixtureId: { color: colors.ice, fontSize: 15, fontWeight: "800" },
  stateBadge: { backgroundColor: colors.surfaceRaised, borderRadius: 12, color: colors.ice, fontSize: 9, fontWeight: "800", overflow: "hidden", paddingHorizontal: 9, paddingVertical: 6, textTransform: "uppercase" },
  response: { color: colors.ice, fontSize: 16, lineHeight: 24, marginTop: spacing.md },
  ratingRow: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "space-between", marginTop: spacing.md },
  ratingLabel: { color: colors.textSoft, flexGrow: 1, fontSize: 13, fontWeight: "600", minWidth: 120 },
  ratingButtons: { flexDirection: "row", gap: 4 },
  ratingButton: { alignItems: "center", borderColor: colors.line, borderRadius: 6, borderWidth: 1, height: 38, justifyContent: "center", width: 38 },
  ratingButtonSelected: { backgroundColor: colors.gold },
  ratingButtonText: { color: colors.textSoft, fontSize: 12, fontWeight: "800" },
  ratingButtonTextSelected: { color: colors.navy950 },
  boundaryBand: { borderTopColor: colors.line, borderTopWidth: 1, marginTop: spacing.xl, paddingTop: spacing.md },
});
