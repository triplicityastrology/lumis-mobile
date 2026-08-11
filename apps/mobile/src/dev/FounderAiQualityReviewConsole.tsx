import * as Crypto from "expo-crypto";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text as NativeText, TextInput, type TextProps, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CelestialBackground } from "../components/CelestialBackground";
import { colors, radii, spacing } from "../theme/tokens";
import {
  ACCEPTED_DICE_TECHNICAL_EVIDENCE_SHA256,
  LATER_CHAT_FIXTURE_IDS,
  RATING_DIMENSIONS,
  RESERVED_DICE_FOUNDER_IDS,
  REVIEW_FIXTURES,
  canonicalJson,
  createFounderFixtureExportPayload,
  createNotRunRecord,
  createVerdictPayload,
  freezeFounderDiceDraft,
  resolveCompanionGate,
  validateFounderDiceDraft,
  type DraftDecision,
  type FrozenFounderQuestion,
  type RatingDimension,
  type ReviewRatings,
  type ReviewSection,
  type SyntheticReviewRecord,
} from "./founderAiReviewContract";
import {
  createDisabledFounderDiceGateway,
  resolveFounderDiceJourneyState,
} from "./founderDiceE2eContract";

const BUILD_SHA = process.env.EXPO_PUBLIC_FOUNDER_AI_REVIEW_HEAD ?? "build-unavailable";
const BUILD_STATE = process.env.EXPO_PUBLIC_FOUNDER_AI_REVIEW_STATE ?? "dice-founder-intake";
const DEFAULT_RATINGS: ReviewRatings = {
  correctness: 3,
  usefulness: 3,
  tone: 3,
  astrological_sense: 3,
  translation_quality: 3,
  vagueness: 3,
  repetition: 3,
  overconfidence: 3,
  safety: 3,
};

const LABELS: Record<RatingDimension, string> = {
  correctness: "Correctness",
  usefulness: "Usefulness",
  tone: "Tone",
  astrological_sense: "Astrological sense",
  translation_quality: "Translation quality",
  vagueness: "Vagueness",
  repetition: "Repetition",
  overconfidence: "Overconfidence",
  safety: "Safety",
};

function Text({ maxFontSizeMultiplier = 1.4, ...props }: TextProps) {
  return <NativeText {...props} maxFontSizeMultiplier={maxFontSizeMultiplier} />;
}

function allRecords(section: ReviewSection, frozen: Readonly<Record<string, FrozenFounderQuestion>>): SyntheticReviewRecord[] {
  const fixtureMap = new Map(REVIEW_FIXTURES.filter((item) => item.section === section).map((item) => [item.fixture_id, item]));
  const ids = section === "dice" ? RESERVED_DICE_FOUNDER_IDS : LATER_CHAT_FIXTURE_IDS;
  return ids.map((id, index) => {
    const existing = fixtureMap.get(id);
    if (existing) return existing;
    const candidate = frozen[id];
    return createNotRunRecord(id, section, candidate?.expected_route === "judgment" ? "judgment" : index % 5 === 0 ? "safety" : "descriptive");
  });
}

export default function FounderAiQualityReviewConsole() {
  const { fontScale, width } = useWindowDimensions();
  const compactLayout = width < 420 || fontScale >= 1.2;
  const [section, setSection] = useState<ReviewSection>("dice");
  const [frozenFixtures, setFrozenFixtures] = useState<Record<string, FrozenFounderQuestion>>({});
  const records = useMemo(() => allRecords(section, frozenFixtures), [frozenFixtures, section]);
  const [selectedIds, setSelectedIds] = useState<Record<ReviewSection, string>>({ dice: "DICE-FOUNDER-EN-01", companion_chat: "chat_en_reflection_01" });
  const selected = records.find((record) => record.fixture_id === selectedIds[section]) ?? records[0];
  const [ratings, setRatings] = useState<Record<string, ReviewRatings>>({});
  const [verdicts, setVerdicts] = useState<Record<string, "pending" | "accepted" | "returned">>({});
  const [exportText, setExportText] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState("Not exported");
  const [draftLanguage, setDraftLanguage] = useState<"en" | "zh-Hant">("en");
  const [draftQuestion, setDraftQuestion] = useState("");
  const [draftDecision, setDraftDecision] = useState<DraftDecision | null>(null);
  const [draftStatus, setDraftStatus] = useState("Draft has not been validated");
  const [fixtureExport, setFixtureExport] = useState<string | null>(null);
  const founderGateway = useMemo(() => createDisabledFounderDiceGateway(), []);
  const selectedRatings = ratings[selected.fixture_id] ?? DEFAULT_RATINGS;
  const diceEvidenceAccepted = ACCEPTED_DICE_TECHNICAL_EVIDENCE_SHA256 !== null;
  const companionGate = resolveCompanionGate(diceEvidenceAccepted, false);
  const ratingEligible = section === "dice" && selected.rendered_output !== null &&
    (selected.state === "offline_preview" || (selected.state === "live_synthetic" && diceEvidenceAccepted));
  const journeyState = resolveFounderDiceJourneyState({
    frozen: Boolean(frozenFixtures[selected.fixture_id]),
    offlinePreview: selected.state === "offline_preview",
    acceptedEnvelope: null,
    gatewayStatus: founderGateway.status(),
  });

  const updateRating = (dimension: RatingDimension, value: 1 | 2 | 3 | 4 | 5) => {
    setRatings((current) => ({ ...current, [selected.fixture_id]: { ...(current[selected.fixture_id] ?? DEFAULT_RATINGS), [dimension]: value } }));
    setExportText(null);
    setExportStatus("Changed since last export");
  };

  const validateDraft = () => {
    const decision = validateFounderDiceDraft(draftQuestion, draftLanguage);
    setDraftDecision(decision);
    setDraftStatus(decision.ok
      ? `Validated · ${decision.classification} · ${decision.language}`
      : `Not accepted · ${decision.code.replaceAll("_", " ").toLowerCase()}`);
  };

  const freezeDraft = () => {
    if (!draftDecision?.ok) return;
    const slot = selectedIds.dice;
    const expectedPrefix = draftLanguage === "en" ? "DICE-FOUNDER-EN-" : "DICE-FOUNDER-ZH-";
    if (!slot.startsWith(expectedPrefix)) {
      setDraftStatus(`Select a ${draftLanguage} slot before freezing`);
      return;
    }
    if (frozenFixtures[slot]) {
      setDraftStatus(`${slot} is already frozen`);
      return;
    }
    const fixture = freezeFounderDiceDraft(slot, draftDecision);
    if (!fixture) {
      setDraftStatus("Freeze stopped by the closed fixture boundary");
      return;
    }
    setFrozenFixtures((current) => ({ ...current, [slot]: fixture }));
    setSelectedIds((current) => ({ ...current, dice: slot }));
    setDraftQuestion("");
    setDraftDecision(null);
    setFixtureExport(null);
    setDraftStatus(`${slot} frozen locally · pending review · zero provider calls`);
  };

  const prepareFixtureExport = async () => {
    const fixtures = Object.values(frozenFixtures).sort((a, b) => a.fixture_id.localeCompare(b.fixture_id));
    if (fixtures.length !== 40) {
      setDraftStatus(`Complete all 40 slots first · ${fixtures.length}/40 frozen`);
      return;
    }
    const payload = createFounderFixtureExportPayload(BUILD_SHA, fixtures);
    const canonical = canonicalJson(payload);
    const sha256 = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, canonical);
    setFixtureExport(canonicalJson({ payload, sha256 }));
    setDraftStatus(`Fixture package ready · ${fixtures.length}/40 frozen · ${sha256.slice(0, 12)}…`);
  };

  const exportVerdicts = async () => {
    const reviewedIds = [...new Set([...Object.keys(ratings), ...Object.keys(verdicts)])].sort();
    const payload = createVerdictPayload(BUILD_SHA, reviewedIds.map((fixtureId) => ({
      fixture_id: fixtureId,
      ratings: ratings[fixtureId] ?? DEFAULT_RATINGS,
      verdict: verdicts[fixtureId] ?? "pending",
    })));
    const canonical = canonicalJson(payload);
    const sha256 = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, canonical);
    setExportText(canonicalJson({ payload, sha256 }));
    setExportStatus(`Checksum ready · ${sha256.slice(0, 12)}…`);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <CelestialBackground />
      <View accessibilityLabel={`Founder AI review build ${BUILD_SHA}, state ${BUILD_STATE}`} style={styles.evidenceStrip}>
        <Text style={styles.evidenceText}>FOUNDER AI E2E · STATE {BUILD_STATE}</Text>
        <Text selectable style={styles.evidenceSha}>BUILD {BUILD_SHA}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>DEVELOPMENT REVIEW ONLY</Text>
        <Text accessibilityRole="header" style={styles.title}>AI quality review</Text>
        <Text style={styles.intro}>Synthetic evidence only. This console cannot call Azure, charge units, write member data, or enter customer navigation.</Text>

        <View accessibilityLabel="Founder review journey" style={styles.journey}>
          <Text style={styles.journeyStep}>1 · Select and freeze question</Text>
          <Text style={styles.journeyStep}>2 · External validation + classification</Text>
          <Text style={styles.journeyStep}>3 · Eligibility</Text>
          <Text style={styles.journeyStep}>4 · Fixture ID-only invoke seam</Text>
          <Text style={styles.journeyStep}>5 · Evidence-bound synthetic result</Text>
          <Text style={styles.journeyStep}>6 · Rating</Text>
          <Text style={styles.journeyStep}>7 · Checksum verdict</Text>
        </View>

        <View accessibilityRole="tablist" style={styles.tabs}>
          <SectionTab label="Dice" largeText={compactLayout} selected={section === "dice"} onPress={() => setSection("dice")} />
          <SectionTab label="Companion / Chat" largeText={compactLayout} selected={section === "companion_chat"} onPress={() => setSection("companion_chat")} />
        </View>

        <View style={styles.summaryRow}>
          <Summary label="Fixture set" value={section === "dice" ? "40 reserved · 20 EN / 20 zh-Hant" : "Later closed cases"} />
          <Summary label="Current state" value={selected.state.replaceAll("_", " ")} />
        </View>

        {section === "dice" ? (
          <View style={styles.card}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>Prepare Founder questions</Text>
            <Text style={styles.helper}>Draft and preflight locally, then freeze exactly 20 EN and 20 zh-Hant questions. The checksum package goes to external Technical validation and classification; only accepted eligible IDs can run later.</Text>
            <View style={[styles.languageRow, compactLayout && styles.wrapRow]}>
              <SectionTab label="English" largeText={compactLayout} selected={draftLanguage === "en"} onPress={() => { setDraftLanguage("en"); setDraftDecision(null); }} />
              <SectionTab label="繁體中文" largeText={compactLayout} selected={draftLanguage === "zh-Hant"} onPress={() => { setDraftLanguage("zh-Hant"); setDraftDecision(null); }} />
            </View>
            <Text style={styles.slotLabel}>SELECT SLOT · {selectedIds.dice}</Text>
            <ScrollView accessibilityLabel={`${draftLanguage} Founder fixture slots`} horizontal showsHorizontalScrollIndicator={false} style={styles.slotRail}>
              {RESERVED_DICE_FOUNDER_IDS.filter((id) => id.includes(draftLanguage === "en" ? "-EN-" : "-ZH-")).map((id) => (
                <Pressable
                  accessibilityLabel={`${id}${frozenFixtures[id] ? ", frozen" : ", available"}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: selectedIds.dice === id }}
                  key={id}
                  onPress={() => setSelectedIds((current) => ({ ...current, dice: id }))}
                  style={[styles.slotButton, selectedIds.dice === id && styles.slotButtonSelected]}
                >
                  <Text style={[styles.slotButtonText, selectedIds.dice === id && styles.slotButtonTextSelected]}>{id.slice(-2)}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <TextInput
              accessibilityLabel="Synthetic Founder Dice question"
              maxFontSizeMultiplier={1.4}
              multiline
              onChangeText={(value) => { setDraftQuestion(value); setDraftDecision(null); setDraftStatus("Changed since validation"); }}
              placeholder={draftLanguage === "en" ? "What should I notice about this decision?" : "這個決定有什麼值得我留意？"}
              placeholderTextColor={colors.muted}
              style={styles.draftInput}
              value={draftQuestion}
            />
            <View style={[styles.actionRow, compactLayout && styles.wrapRow]}>
              <Pressable accessibilityRole="button" onPress={validateDraft} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Validate</Text></Pressable>
              <Pressable accessibilityRole="button" accessibilityState={{ disabled: !draftDecision?.ok }} disabled={!draftDecision?.ok} onPress={freezeDraft} style={[styles.exportButton, styles.flexButton, !draftDecision?.ok && styles.disabledButton]}><Text style={styles.exportButtonText}>Freeze selected slot</Text></Pressable>
            </View>
            <Text accessibilityLiveRegion="polite" accessibilityRole="text" style={styles.exportStatus}>{draftStatus}</Text>
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: Object.keys(frozenFixtures).length !== 40 }} disabled={Object.keys(frozenFixtures).length !== 40} onPress={() => void prepareFixtureExport()} style={[styles.fixtureExportButton, Object.keys(frozenFixtures).length !== 40 && styles.disabledButton]}><Text style={styles.secondaryButtonText}>Prepare fixture checksum · {Object.keys(frozenFixtures).length}/40</Text></Pressable>
            {fixtureExport ? <Text selectable style={styles.exportPreview}>{fixtureExport}</Text> : null}
          </View>
        ) : (
          <View style={styles.gateCard}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>Companion / Chat remains gated</Text>
            <Text style={styles.helper}>Companion requires accepted Dice Technical evidence first, then its own separately accepted Companion authority. Neither exists in this build. This console cannot enable Chat or call chat-message.</Text>
            <Text accessibilityRole="text" style={styles.gateCode}>GATE · {companionGate.reason.replaceAll("_", " ")}</Text>
            <Text accessibilityRole="text" style={styles.gateCode}>NO_NORMAL_CHAT_INTEGRATION_AUTHORITY</Text>
          </View>
        )}

        <Text accessibilityRole="header" style={styles.sectionTitle}>Review case</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.fixtureRail}>
          {records.map((record) => (
            <Pressable
              accessibilityLabel={`Review ${record.fixture_id}, ${record.state.replaceAll("_", " ")}`}
              accessibilityRole="button"
              accessibilityState={{ selected: record.fixture_id === selected.fixture_id }}
              key={record.fixture_id}
              onPress={() => setSelectedIds((current) => ({ ...current, [section]: record.fixture_id }))}
              style={[styles.fixtureChip, record.fixture_id === selected.fixture_id && styles.fixtureChipSelected]}
            >
              <Text style={[styles.fixtureChipText, record.fixture_id === selected.fixture_id && styles.fixtureChipTextSelected]}>{record.fixture_id.replace(/^DICE-FOUNDER-/, "").replace(/^chat_/, "")}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.card}>
          <View style={styles.cardHeadingRow}>
            <View style={styles.flex}>
              <Text style={styles.fixtureId}>{selected.fixture_id}</Text>
              <Text style={styles.expected}>{selected.language} · expected {selected.expected_class.replaceAll("_", " ")}</Text>
            </View>
            <StateBadge state={selected.state} />
          </View>
          <Text style={styles.outputLabel}>{selected.state === "offline_preview" ? "OFFLINE DEMO OUTPUT" : "ACCEPTED EVIDENCE OUTPUT"}</Text>
          <Text style={styles.output}>{selected.rendered_output ?? "Not yet run. No checksum-bound accepted Dice Technical evidence exists for this fixture."}</Text>
          {frozenFixtures[selected.fixture_id] ? <Text style={styles.frozenNote}>Locally frozen · {frozenFixtures[selected.fixture_id].expected_route.replaceAll("_", " ")} · pending external validation, classification and eligibility</Text> : null}
        </View>

        {section === "dice" ? (
          <View accessibilityLabel="Founder Dice eligibility and gateway status" style={styles.card}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>Eligibility and invoke seam</Text>
            <View style={styles.readinessList}>
              <Readiness label="Selected and frozen" value={journeyState.frozen ? "ready" : "not ready"} />
              <Readiness label="External validation / classification" value={journeyState.external_validation.replaceAll("_", " ")} />
              <Readiness label="Founder eligibility" value={journeyState.eligibility.replaceAll("_", " ")} />
              <Readiness label="Gateway" value={journeyState.gateway} />
            </View>
            <Text style={styles.helper}>The invoke boundary accepts only the selected fixture ID. This exact build has no accepted Founder envelope, so provider access remains disabled and no request can leave the device.</Text>
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: true }} disabled style={[styles.exportButton, styles.disabledButton]}>
              <Text style={styles.exportButtonText}>Invoke eligible fixture ID</Text>
            </Pressable>
            <Text accessibilityLiveRegion="polite" accessibilityRole="text" style={styles.exportStatus}>STOP_S2_T264_GATEWAY_DISABLED · accepted envelope required</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>Founder ratings</Text>
          <Text style={styles.helper}>{ratingEligible ? "1 means return; 5 means strong. Ratings remain in memory until exported." : "Rating unlocks only for an offline demo or a checksum-verified live result."}</Text>
          {RATING_DIMENSIONS.map((dimension) => (
            <View key={dimension} style={[styles.ratingRow, compactLayout && styles.ratingRowCompact]}>
              <Text style={styles.ratingLabel}>{LABELS[dimension]}</Text>
              <View accessibilityLabel={`${LABELS[dimension]} rating ${selectedRatings[dimension]}`} style={styles.ratingButtons}>
                {([1, 2, 3, 4, 5] as const).map((value) => (
                  <Pressable
                    accessibilityLabel={`${LABELS[dimension]} ${value}`}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !ratingEligible, selected: selectedRatings[dimension] === value }}
                    disabled={!ratingEligible}
                    key={value}
                    onPress={() => updateRating(dimension, value)}
                    style={[styles.ratingButton, selectedRatings[dimension] === value && styles.ratingButtonSelected, !ratingEligible && styles.disabledButton]}
                  >
                    <Text style={[styles.ratingButtonText, selectedRatings[dimension] === value && styles.ratingButtonTextSelected]}>{value}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
          <View style={styles.verdictRow}>
            {(["pending", "accepted", "returned"] as const).map((verdict) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: !ratingEligible, selected: (verdicts[selected.fixture_id] ?? "pending") === verdict }}
                disabled={!ratingEligible}
                key={verdict}
                onPress={() => { setVerdicts((current) => ({ ...current, [selected.fixture_id]: verdict })); setExportText(null); setExportStatus("Changed since last export"); }}
                style={[styles.verdictButton, (verdicts[selected.fixture_id] ?? "pending") === verdict && styles.verdictButtonSelected, !ratingEligible && styles.disabledButton]}
              >
                <Text style={styles.verdictText}>{verdict}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>Review package</Text>
          <Text style={styles.helper}>Closed allow-list: build SHA, fixture IDs, ratings and verdicts only. No prompts, accounts, provider diagnostics, URLs or secrets.</Text>
          <Pressable accessibilityRole="button" onPress={() => void exportVerdicts()} style={styles.exportButton}>
            <Text style={styles.exportButtonText}>Prepare checksum package</Text>
          </Pressable>
          <Text accessibilityLiveRegion="polite" accessibilityRole="text" style={styles.exportStatus}>{exportStatus}</Text>
          {exportText ? <Text selectable style={styles.exportPreview}>{exportText}</Text> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionTab({ label, largeText = false, selected, onPress }: { label: string; largeText?: boolean; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="tab" accessibilityState={{ selected }} onPress={onPress} style={[styles.tab, largeText && styles.tabLargeText, selected && styles.tabSelected]}><Text style={[styles.tabText, selected && styles.tabTextSelected]}>{label}</Text></Pressable>;
}
function Summary({ label, value }: { label: string; value: string }) {
  return <View style={styles.summary}><Text style={styles.metaLabel}>{label}</Text><Text style={styles.summaryValue}>{value}</Text></View>;
}
function Readiness({ label, value }: { label: string; value: string }) {
  return <View style={styles.readinessRow}><Text style={styles.readinessLabel}>{label}</Text><Text style={styles.readinessValue}>{value}</Text></View>;
}
function StateBadge({ state }: { state: SyntheticReviewRecord["state"] }) {
  return <View style={[styles.badge, state === "live_synthetic" && styles.badgeLive]}><Text style={styles.badgeText}>{state.replaceAll("_", " ")}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.navy950, flex: 1 },
  evidenceStrip: { backgroundColor: colors.navy950, borderBottomColor: colors.gold, borderBottomWidth: 1, minHeight: 46, justifyContent: "center", paddingHorizontal: 14, zIndex: 5 },
  evidenceText: { color: colors.goldLight, fontSize: 10, fontWeight: "800", letterSpacing: 0 },
  evidenceSha: { color: colors.textSoft, fontFamily: "Courier", fontSize: 8, letterSpacing: 0, marginTop: 2 },
  content: { padding: spacing.lg, paddingBottom: 60 },
  eyebrow: { color: colors.goldLight, fontSize: 12, fontWeight: "800", marginTop: spacing.sm },
  title: { color: colors.ice, fontSize: 30, fontWeight: "800", marginTop: 4 },
  intro: { color: colors.textSoft, fontSize: 15, lineHeight: 22, marginTop: spacing.sm },
  journey: { borderColor: colors.line, borderRadius: radii.sm, borderWidth: 1, gap: 6, marginTop: spacing.lg, padding: spacing.md },
  journeyStep: { color: colors.textSoft, fontSize: 13, fontWeight: "700", lineHeight: 18 },
  tabs: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radii.sm, borderWidth: 1, flexDirection: "row", marginTop: spacing.lg, padding: 4 },
  tab: { alignItems: "center", borderRadius: 6, flex: 1, justifyContent: "center", minHeight: 48, paddingHorizontal: 6 },
  tabLargeText: { minHeight: 64, paddingVertical: 8 },
  tabSelected: { backgroundColor: colors.gold },
  tabText: { color: colors.textSoft, fontSize: 14, fontWeight: "700", textAlign: "center" },
  tabTextSelected: { color: colors.navy950 },
  summaryRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  summary: { backgroundColor: "rgba(22,39,61,0.88)", borderColor: colors.line, borderRadius: radii.sm, borderWidth: 1, flex: 1, minHeight: 72, padding: spacing.sm },
  summaryValue: { color: colors.ice, fontSize: 13, fontWeight: "700", lineHeight: 18, marginTop: 4 },
  sectionTitle: { color: colors.ice, fontSize: 19, fontWeight: "800", marginTop: spacing.lg },
  fixtureRail: { marginHorizontal: -spacing.lg, marginTop: spacing.sm, paddingHorizontal: spacing.lg },
  fixtureChip: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 18, borderWidth: 1, justifyContent: "center", marginRight: 8, minHeight: 38, paddingHorizontal: 12 },
  fixtureChipSelected: { backgroundColor: colors.gold, borderColor: colors.gold },
  fixtureChipText: { color: colors.textSoft, fontSize: 12, fontWeight: "700" },
  fixtureChipTextSelected: { color: colors.navy950 },
  card: { backgroundColor: "rgba(22,39,61,0.94)", borderColor: colors.line, borderRadius: radii.sm, borderWidth: 1, marginTop: spacing.md, padding: spacing.md },
  gateCard: { backgroundColor: "rgba(22,39,61,0.94)", borderColor: colors.gold, borderRadius: radii.sm, borderWidth: 1, marginTop: spacing.md, padding: spacing.md },
  cardHeadingRow: { alignItems: "flex-start", flexDirection: "row", gap: spacing.sm },
  flex: { flex: 1 },
  fixtureId: { color: colors.ice, fontSize: 18, fontWeight: "800" },
  expected: { color: colors.textSoft, fontSize: 13, marginTop: 3 },
  badge: { backgroundColor: colors.surfaceRaised, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5 },
  badgeLive: { backgroundColor: "rgba(134,200,166,0.22)" },
  badgeText: { color: colors.ice, fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  outputLabel: { color: colors.muted, fontSize: 11, fontWeight: "800", marginTop: spacing.lg },
  output: { color: colors.ice, fontSize: 16, lineHeight: 24, marginTop: spacing.sm },
  metaLabel: { color: colors.muted, fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  helper: { color: colors.textSoft, fontSize: 13, lineHeight: 19, marginTop: spacing.sm },
  languageRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  wrapRow: { flexWrap: "wrap" },
  slotLabel: { color: colors.goldLight, fontSize: 11, fontWeight: "800", marginTop: spacing.md },
  slotRail: { marginTop: spacing.sm },
  slotButton: { alignItems: "center", borderColor: colors.line, borderRadius: 6, borderWidth: 1, height: 42, justifyContent: "center", marginRight: 7, width: 42 },
  slotButtonSelected: { backgroundColor: colors.gold, borderColor: colors.gold },
  slotButtonText: { color: colors.textSoft, fontSize: 13, fontWeight: "800" },
  slotButtonTextSelected: { color: colors.navy950 },
  draftInput: { backgroundColor: colors.navy950, borderColor: colors.line, borderRadius: radii.sm, borderWidth: 1, color: colors.ice, fontSize: 16, lineHeight: 23, marginTop: spacing.md, minHeight: 96, padding: spacing.md, textAlignVertical: "top" },
  actionRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  flexButton: { flex: 1, marginTop: 0 },
  secondaryButton: { alignItems: "center", borderColor: colors.gold, borderRadius: 7, borderWidth: 1, flex: 1, justifyContent: "center", minHeight: 48 },
  secondaryButtonText: { color: colors.goldLight, fontSize: 13, fontWeight: "800", textAlign: "center" },
  disabledButton: { opacity: 0.42 },
  fixtureExportButton: { alignItems: "center", borderColor: colors.line, borderRadius: 7, borderWidth: 1, justifyContent: "center", marginTop: spacing.md, minHeight: 44, paddingHorizontal: spacing.sm },
  frozenNote: { color: colors.goldLight, fontSize: 12, fontWeight: "700", marginTop: spacing.md },
  readinessList: { gap: spacing.sm, marginTop: spacing.md },
  readinessRow: { alignItems: "flex-start", borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", gap: spacing.sm, justifyContent: "space-between", paddingBottom: spacing.sm },
  readinessLabel: { color: colors.textSoft, flex: 1, fontSize: 13, lineHeight: 19 },
  readinessValue: { color: colors.goldLight, fontSize: 12, fontWeight: "800", textAlign: "right" },
  gateCode: { color: colors.goldLight, fontFamily: "Courier", fontSize: 11, marginTop: spacing.md },
  ratingRow: { alignItems: "center", flexDirection: "row", gap: 8, justifyContent: "space-between", marginTop: spacing.md },
  ratingRowCompact: { alignItems: "flex-start", flexDirection: "column" },
  ratingLabel: { color: colors.textSoft, flex: 1, fontSize: 13, fontWeight: "600" },
  ratingButtons: { flexDirection: "row", gap: 4 },
  ratingButton: { alignItems: "center", borderColor: colors.line, borderRadius: 6, borderWidth: 1, height: 34, justifyContent: "center", width: 34 },
  ratingButtonSelected: { backgroundColor: colors.gold },
  ratingButtonText: { color: colors.textSoft, fontSize: 12, fontWeight: "800" },
  ratingButtonTextSelected: { color: colors.navy950 },
  verdictRow: { flexDirection: "row", gap: 8, marginTop: spacing.lg },
  verdictButton: { alignItems: "center", borderColor: colors.line, borderRadius: 6, borderWidth: 1, flex: 1, justifyContent: "center", minHeight: 42 },
  verdictButtonSelected: { borderColor: colors.gold, backgroundColor: colors.goldFill },
  verdictText: { color: colors.ice, fontSize: 12, fontWeight: "800", textTransform: "capitalize" },
  exportButton: { alignItems: "center", backgroundColor: colors.gold, borderRadius: 7, justifyContent: "center", marginTop: spacing.md, minHeight: 48 },
  exportButtonText: { color: colors.navy950, fontSize: 14, fontWeight: "800" },
  exportStatus: { color: colors.goldLight, fontSize: 12, fontWeight: "700", marginTop: spacing.sm },
  exportPreview: { backgroundColor: colors.navy950, borderRadius: 6, color: colors.textSoft, fontFamily: "Courier", fontSize: 9, lineHeight: 13, marginTop: spacing.sm, maxHeight: 180, padding: spacing.sm },
});
