import * as Crypto from "expo-crypto";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text as NativeText, TextInput, type TextProps, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CelestialBackground } from "../components/CelestialBackground";
import { colors, radii, spacing } from "../theme/tokens";
import {
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
import {
  ACCEPTED_FOUNDER_WINDOW_RECEIPT_SHA256,
  ACCEPTED_RUNTIME_ENVELOPE_SHA256,
  ACCEPTED_TECHNICAL_EVIDENCE_SHA256,
  T272_RUNTIME_COMMIT,
  authorizationRequestCanonicalJson,
  createFounderWindowAuthorizationRequest,
  parseFounderExecutionEvidence,
  parseFounderWindowAuthorizationReceipt,
  parsePostWindowProof,
  parseRuntimePackageAcceptance,
  parseTechnicalEvidenceImport,
  type FounderWindowAuthorizationReceipt,
  type FounderWindowAuthorizationRequest,
  type RuntimePackageAcceptance,
  type TechnicalEvidenceImport,
} from "./founderDiceWindowContract";
import {
  FOUNDER_INTAKE_STATES,
  createFounderIntakePackage,
  createFounderRatingSheet,
  createFrozenIntakeQuestion,
  intakeCanonicalJson,
  validateFounderIntakeQuestion,
  type FrozenIntakeQuestion,
  type IntakeState,
} from "./founderDiceIntakeContract";

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
  return <NativeText {...props} maxFontSizeMultiplier={maxFontSizeMultiplier} style={[{ flexShrink: 1 }, props.style]} />;
}

function allRecords(section: ReviewSection, frozen: Readonly<Record<string, FrozenFounderQuestion>>, live: Readonly<Record<string, SyntheticReviewRecord>>): SyntheticReviewRecord[] {
  const fixtureMap = new Map(REVIEW_FIXTURES.filter((item) => item.section === section).map((item) => [item.fixture_id, item]));
  const ids = section === "dice" ? RESERVED_DICE_FOUNDER_IDS : LATER_CHAT_FIXTURE_IDS;
  return ids.map((id, index) => {
    const existing = fixtureMap.get(id);
    if (live[id]) return live[id];
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
  const [frozenIntakeFixtures, setFrozenIntakeFixtures] = useState<Record<string, FrozenIntakeQuestion>>({});
  const [liveRecords, setLiveRecords] = useState<Record<string, SyntheticReviewRecord>>({});
  const records = useMemo(() => allRecords(section, frozenFixtures, liveRecords), [frozenFixtures, liveRecords, section]);
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
  const [fixturePackageSha, setFixturePackageSha] = useState<string | null>(null);
  const [ratingSheetExport, setRatingSheetExport] = useState<string | null>(null);
  const [intakeState, setIntakeState] = useState<IntakeState>("validation");
  const [runtimeEnvelopeText, setRuntimeEnvelopeText] = useState("");
  const [runtimeEnvelope, setRuntimeEnvelope] = useState<RuntimePackageAcceptance | null>(null);
  const [runtimeEnvelopeSha, setRuntimeEnvelopeSha] = useState<string | null>(null);
  const [runtimeStatus, setRuntimeStatus] = useState("No accepted final runtime package imported");
  const [technicalEvidenceText, setTechnicalEvidenceText] = useState("");
  const [technicalEvidence, setTechnicalEvidence] = useState<TechnicalEvidenceImport | null>(null);
  const [technicalEvidenceSha, setTechnicalEvidenceSha] = useState<string | null>(null);
  const [technicalStatus, setTechnicalStatus] = useState("No accepted 80-case Technical evidence imported");
  const [authorizationRequest, setAuthorizationRequest] = useState<FounderWindowAuthorizationRequest | null>(null);
  const [authorizationRequestSha, setAuthorizationRequestSha] = useState<string | null>(null);
  const [authorizationStatus, setAuthorizationStatus] = useState("Complete the Technical evidence and 40-fixture gates first");
  const [founderReceiptText, setFounderReceiptText] = useState("");
  const [founderReceipt, setFounderReceipt] = useState<FounderWindowAuthorizationReceipt | null>(null);
  const [founderReceiptSha, setFounderReceiptSha] = useState<string | null>(null);
  const [founderReceiptStatus, setFounderReceiptStatus] = useState("No accepted Founder-window receipt imported");
  const [executionText, setExecutionText] = useState("");
  const [executionStatus, setExecutionStatus] = useState("No accepted Founder execution evidence imported");
  const [postWindowText, setPostWindowText] = useState("");
  const [postWindowStatus, setPostWindowStatus] = useState("Post-window disable proof not received");
  const founderGateway = useMemo(() => createDisabledFounderDiceGateway(), []);
  const selectedRatings = ratings[selected.fixture_id] ?? DEFAULT_RATINGS;
  const diceEvidenceAccepted = technicalEvidence !== null && founderReceipt !== null;
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
    const decision = validateFounderIntakeQuestion(draftQuestion, draftLanguage);
    setDraftDecision(decision);
    setDraftStatus(decision.ok
      ? `Validated · ${decision.classification} · ${decision.language}`
      : `Not accepted · ${decision.code.replaceAll("_", " ").toLowerCase()}`);
  };

  const freezeDraft = async () => {
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
    const questionSha256 = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, fixture.question);
    const intakeFixture = createFrozenIntakeQuestion(slot, fixture.question, fixture.language, questionSha256);
    setFrozenFixtures((current) => ({ ...current, [slot]: fixture }));
    setFrozenIntakeFixtures((current) => ({ ...current, [slot]: intakeFixture }));
    setSelectedIds((current) => ({ ...current, dice: slot }));
    setDraftQuestion("");
    setDraftDecision(null);
    setFixtureExport(null);
    setRatingSheetExport(null);
    setDraftStatus(`${slot} frozen locally · pending review · zero provider calls`);
  };

  const prepareFixtureExport = async () => {
    const fixtures = Object.values(frozenFixtures).sort((a, b) => a.fixture_id.localeCompare(b.fixture_id));
    const intakeFixtures = Object.values(frozenIntakeFixtures).sort((a, b) => a.fixture_id.localeCompare(b.fixture_id));
    if (fixtures.length !== 40 || intakeFixtures.length !== 40) {
      setDraftStatus(`Complete all 40 slots first · ${fixtures.length}/40 frozen`);
      return;
    }
    createFounderFixtureExportPayload(BUILD_SHA, fixtures);
    const payload = createFounderIntakePackage(BUILD_SHA, intakeFixtures);
    const canonical = intakeCanonicalJson(payload);
    const sha256 = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, canonical);
    setFixtureExport(canonicalJson({ payload, sha256 }));
    setRatingSheetExport(intakeCanonicalJson(createFounderRatingSheet(BUILD_SHA, sha256, intakeFixtures)));
    setFixturePackageSha(sha256);
    setAuthorizationRequest(null);
    setAuthorizationRequestSha(null);
    setDraftStatus(`Fixture package ready · ${fixtures.length}/40 frozen · ${sha256.slice(0, 12)}…`);
  };

  const clearSelectedSlot = () => {
    const slot = selectedIds.dice;
    setFrozenFixtures((current) => {
      const next = { ...current };
      delete next[slot];
      return next;
    });
    setFrozenIntakeFixtures((current) => {
      const next = { ...current };
      delete next[slot];
      return next;
    });
    setFixtureExport(null);
    setFixturePackageSha(null);
    setRatingSheetExport(null);
    setAuthorizationRequest(null);
    setAuthorizationRequestSha(null);
    setDraftStatus(`${slot} cleared locally · checksum package invalidated`);
  };

  const importRuntimeEnvelope = async () => {
    setRuntimeEnvelope(null);
    setRuntimeEnvelopeSha(null);
    setTechnicalEvidence(null);
    setTechnicalEvidenceSha(null);
    setFounderReceipt(null);
    if (ACCEPTED_RUNTIME_ENVELOPE_SHA256 === null) {
      setRuntimeStatus("WAITING FOR ACCEPTED FINAL RUNTIME PACKAGE · pasted envelopes cannot self-authorize");
      return;
    }
    try {
      const sha256 = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, runtimeEnvelopeText);
      const parsed = parseRuntimePackageAcceptance(runtimeEnvelopeText, sha256);
      setRuntimeEnvelope(parsed);
      setRuntimeEnvelopeSha(sha256);
      setRuntimeStatus(`Accepted final runtime · default off · ${parsed.final_release_commit.slice(0, 12)}…`);
    } catch (error) {
      setRuntimeStatus(error instanceof Error ? error.message : "STOP_S2_T280_RUNTIME_INVALID");
    }
  };

  const importTechnicalEvidence = async () => {
    setTechnicalEvidence(null);
    setTechnicalEvidenceSha(null);
    setAuthorizationRequest(null);
    if (!runtimeEnvelope || !runtimeEnvelopeSha) {
      setTechnicalStatus("STOP_S2_T280_RUNTIME_PREREQUISITE");
      return;
    }
    if (ACCEPTED_TECHNICAL_EVIDENCE_SHA256 === null) {
      setTechnicalStatus("WAITING FOR ACCEPTED TECHNICAL EVIDENCE · this build cannot self-approve a pasted envelope");
      return;
    }
    try {
      const sha256 = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, technicalEvidenceText);
      const parsed = parseTechnicalEvidenceImport(technicalEvidenceText, sha256, runtimeEnvelope, runtimeEnvelopeSha);
      setTechnicalEvidence(parsed);
      setTechnicalEvidenceSha(sha256);
      setTechnicalStatus(`Accepted 80/80 · 40 EN / 40 zh-Hant · disabled verified · ${sha256.slice(0, 12)}…`);
    } catch (error) {
      setTechnicalStatus(error instanceof Error ? error.message : "STOP_S2_T280_TECHNICAL_EVIDENCE_INVALID");
    }
  };

  const prepareAuthorizationRequest = async () => {
    const fixtures = Object.values(frozenFixtures);
    if (!runtimeEnvelope || !runtimeEnvelopeSha || !technicalEvidence || !technicalEvidenceSha || !fixturePackageSha) {
      setAuthorizationStatus("STOP_S2_T280_AUTHORIZATION_PREREQUISITES");
      return;
    }
    try {
      const request = createFounderWindowAuthorizationRequest({ runtime: runtimeEnvelope, runtimeAcceptanceSha256: runtimeEnvelopeSha, technicalEvidence, technicalEvidenceSha256: technicalEvidenceSha, founderFixturePackageSha256: fixturePackageSha, fixtures });
      const canonical = authorizationRequestCanonicalJson(request);
      const sha256 = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, canonical);
      setAuthorizationRequest(request);
      setAuthorizationRequestSha(sha256);
      setFounderReceipt(null);
      setFounderReceiptSha(null);
      setAuthorizationStatus(`Authorization request ready · not authorized · ${sha256.slice(0, 12)}…`);
    } catch (error) {
      setAuthorizationStatus(error instanceof Error ? error.message : "STOP_S2_T280_AUTHORIZATION_REQUEST");
    }
  };

  const importFounderReceipt = async () => {
    if (!authorizationRequest || !authorizationRequestSha) {
      setFounderReceiptStatus("STOP_S2_T280_FOUNDER_RECEIPT_REQUEST_REQUIRED");
      return;
    }
    if (ACCEPTED_FOUNDER_WINDOW_RECEIPT_SHA256 === null) {
      setFounderReceiptStatus("WAITING FOR SEPARATELY ACCEPTED FOUNDER WINDOW RECEIPT");
      return;
    }
    try {
      const sha256 = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, founderReceiptText);
      const parsed = parseFounderWindowAuthorizationReceipt(founderReceiptText, sha256, authorizationRequestSha, authorizationRequest);
      setFounderReceipt(parsed);
      setFounderReceiptSha(sha256);
      setFounderReceiptStatus(`Founder window accepted · fixture IDs only · ${sha256.slice(0, 12)}…`);
    } catch (error) {
      setFounderReceiptStatus(error instanceof Error ? error.message : "STOP_S2_T280_FOUNDER_RECEIPT_INVALID");
    }
  };

  const importExecutionEvidence = async () => {
    if (!runtimeEnvelope || !technicalEvidenceSha || !founderReceipt || !founderReceiptSha) {
      setExecutionStatus("WAITING FOR ACCEPTED RUNTIME, TECHNICAL EVIDENCE, AND FOUNDER WINDOW RECEIPT");
      return;
    }
    try {
      const sha256 = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, executionText);
      const evidence = parseFounderExecutionEvidence(executionText, sha256, selected.fixture_id, runtimeEnvelope, technicalEvidenceSha, founderReceiptSha);
      const record: SyntheticReviewRecord = {
        schema_version: "s2_t261_founder_ai_review_v2",
        fixture_id: evidence.fixture_id,
        section: "dice",
        language: evidence.language,
        expected_class: evidence.result_class === "safety_redirect" ? "safety" : evidence.result_class === "fixed_fallback" ? "fallback" : evidence.result_class === "technical_error" ? "technical_error" : frozenFixtures[evidence.fixture_id]?.expected_route === "judgment" ? "judgment" : "descriptive",
        state: "live_synthetic",
        rendered_output: evidence.safe_rendered_output,
        latency_bucket: evidence.latency_bucket,
        input_token_bucket: evidence.input_token_bucket,
        output_token_bucket: evidence.output_token_bucket,
        attempt_count: evidence.attempt_count,
        result_class: evidence.result_class,
        retry_class: evidence.attempt_count === 2 ? "retried_once" : "none",
      };
      setLiveRecords((current) => ({ ...current, [evidence.fixture_id]: record }));
      setExecutionStatus(`Verified live synthetic evidence · ${evidence.fixture_id} · ${sha256.slice(0, 12)}…`);
    } catch (error) {
      setExecutionStatus(error instanceof Error ? error.message : "STOP_S2_T280_EXECUTION_INVALID");
    }
  };

  const verifyPostWindow = () => {
    if (!runtimeEnvelope || !founderReceiptSha) {
      setPostWindowStatus("WAITING FOR ACCEPTED FOUNDER WINDOW RECEIPT");
      return;
    }
    try {
      parsePostWindowProof(postWindowText, runtimeEnvelope.final_package_sha256, founderReceiptSha);
      setPostWindowStatus("Window closed · provider disabled · post-window proof verified");
    } catch (error) {
      setPostWindowStatus(error instanceof Error ? error.message : "STOP_S2_T280_POST_WINDOW_INVALID");
    }
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
        <Text maxFontSizeMultiplier={1} style={styles.evidenceText}>FOUNDER AI E2E · STATE {BUILD_STATE}</Text>
        <Text maxFontSizeMultiplier={1} selectable style={styles.evidenceSha}>BUILD {BUILD_SHA}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" style={styles.scroll}>
        <Text style={styles.eyebrow}>DEVELOPMENT REVIEW ONLY</Text>
        <Text accessibilityRole="header" maxFontSizeMultiplier={1.15} style={styles.title}>AI quality review</Text>
        <Text style={styles.intro}>Synthetic evidence only. This console cannot call Azure, charge units, write member data, or enter customer navigation.</Text>
        <Text style={styles.intro}>External validation + classification stays outside product pixels. An Evidence-bound synthetic result is shown only after every accepted checksum gate passes.</Text>

        <View accessibilityLabel="Founder review journey" style={styles.journey}>
          <Text style={styles.journeyStep}>1 · Verify final runtime package and accepted 80-case evidence</Text>
          <Text style={styles.journeyStep}>2 · Freeze exactly 40 questions · 20 EN / 20 zh-Hant</Text>
          <Text style={styles.journeyStep}>3 · Prepare request and import separate Founder authority</Text>
          <Text style={styles.journeyStep}>4 · Later invoke by fixture ID only</Text>
          <Text style={styles.journeyStep}>5 · Verify interpretation · rate · export verdict</Text>
          <Text style={styles.journeyStep}>6 · Verify post-window disabled state</Text>
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
          <>
          <View style={styles.card}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>1 · Final runtime package gate</Text>
            <Text style={styles.helper}>The closed package envelope must bind the completed T272 runtime proof ({T272_RUNTIME_COMMIT.slice(0, 12)}…), a separately reviewed final release, a default-off deployment receipt, and zero provider calls. Migration 0039 cannot be smuggled into this gate.</Text>
            <TextInput accessibilityLabel="Accepted final Dice runtime package JSON" maxFontSizeMultiplier={1.4} multiline onChangeText={setRuntimeEnvelopeText} placeholder="Paste accepted runtime package envelope" placeholderTextColor={colors.muted} style={styles.evidenceInput} value={runtimeEnvelopeText} />
            <Pressable accessibilityRole="button" onPress={() => void importRuntimeEnvelope()} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Verify runtime package</Text></Pressable>
            <Text accessibilityLiveRegion="polite" accessibilityRole="text" style={styles.exportStatus}>{runtimeStatus}</Text>
          </View>
          <View style={styles.card}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>2 · Technical evidence gate</Text>
            <Text style={styles.helper}>Import only the separately accepted 80-case Technical envelope bound to the verified runtime package and PG17 ledger proof. Loading, partial, stale, wrong-package, Founder-bearing, or self-authored evidence is rejected.</Text>
            <TextInput accessibilityLabel="Accepted 80-case Technical evidence JSON" maxFontSizeMultiplier={1.4} multiline onChangeText={setTechnicalEvidenceText} placeholder="Paste closed Technical evidence envelope" placeholderTextColor={colors.muted} style={styles.evidenceInput} value={technicalEvidenceText} />
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: !runtimeEnvelope }} disabled={!runtimeEnvelope} onPress={() => void importTechnicalEvidence()} style={[styles.secondaryButton, !runtimeEnvelope && styles.disabledButton]}><Text style={styles.secondaryButtonText}>Verify 80-case evidence</Text></Pressable>
            <Text accessibilityLiveRegion="polite" accessibilityRole="text" style={styles.exportStatus}>{technicalStatus}</Text>
          </View>
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
              <Pressable accessibilityRole="button" accessibilityState={{ disabled: !draftDecision?.ok }} disabled={!draftDecision?.ok} onPress={() => void freezeDraft()} style={[styles.exportButton, styles.flexButton, !draftDecision?.ok && styles.disabledButton]}><Text style={styles.exportButtonText}>Freeze selected slot</Text></Pressable>
            </View>
            {frozenFixtures[selectedIds.dice] ? <Pressable accessibilityRole="button" onPress={clearSelectedSlot} style={styles.fixtureExportButton}><Text style={styles.secondaryButtonText}>Clear selected slot</Text></Pressable> : null}
            <Text accessibilityLiveRegion="polite" accessibilityRole="text" style={styles.exportStatus}>{draftStatus}</Text>
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: Object.keys(frozenFixtures).length !== 40 }} disabled={Object.keys(frozenFixtures).length !== 40} onPress={() => void prepareFixtureExport()} style={[styles.fixtureExportButton, Object.keys(frozenFixtures).length !== 40 && styles.disabledButton]}><Text style={styles.secondaryButtonText}>Prepare fixture checksum · {Object.keys(frozenFixtures).length}/40</Text></Pressable>
            {fixtureExport ? <Text selectable style={styles.exportPreview}>{fixtureExport}</Text> : null}
            {ratingSheetExport ? <><Text style={styles.slotLabel}>EXPORTABLE FOUNDER RATING SHEET</Text><Text selectable style={styles.exportPreview}>{ratingSheetExport}</Text></> : null}
          </View>
          <View accessibilityLabel="Founder Dice local state navigator" style={styles.card}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>Local state review</Text>
            <Text style={styles.helper}>These are deterministic presentation fixtures. They never indicate live AI, accepted evidence, units, or persistence.</Text>
            <View style={styles.stateGrid}>
              {FOUNDER_INTAKE_STATES.map((state) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: intakeState === state.id }}
                  key={state.id}
                  onPress={() => setIntakeState(state.id)}
                  style={[styles.stateButton, intakeState === state.id && styles.stateButtonSelected]}
                >
                  <Text style={[styles.stateButtonText, intakeState === state.id && styles.stateButtonTextSelected]}>{state.title}</Text>
                </Pressable>
              ))}
            </View>
            <FounderIntakeStatePreview state={intakeState} />
          </View>
          <View style={styles.card}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>3 · Founder-window request</Text>
            <Text style={styles.helper}>This request contains package and evidence checksums plus the exact 20/20 fixture counts. It contains no question text and grants no authority.</Text>
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: !technicalEvidence || !fixturePackageSha }} disabled={!technicalEvidence || !fixturePackageSha} onPress={() => void prepareAuthorizationRequest()} style={[styles.exportButton, (!technicalEvidence || !fixturePackageSha) && styles.disabledButton]}><Text style={styles.exportButtonText}>Prepare authorization request</Text></Pressable>
            <Text accessibilityLiveRegion="polite" accessibilityRole="text" style={styles.exportStatus}>{authorizationStatus}</Text>
            {authorizationRequest ? <Text selectable style={styles.exportPreview}>{authorizationRequestCanonicalJson(authorizationRequest)}</Text> : null}
            <TextInput accessibilityLabel="Accepted Founder window authorization receipt JSON" maxFontSizeMultiplier={1.4} multiline onChangeText={setFounderReceiptText} placeholder="Paste separately accepted Founder receipt" placeholderTextColor={colors.muted} style={styles.evidenceInput} value={founderReceiptText} />
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: !authorizationRequest }} disabled={!authorizationRequest} onPress={() => void importFounderReceipt()} style={[styles.secondaryButton, !authorizationRequest && styles.disabledButton]}><Text style={styles.secondaryButtonText}>Verify Founder window receipt</Text></Pressable>
            <Text accessibilityLiveRegion="polite" accessibilityRole="text" style={styles.exportStatus}>{founderReceiptStatus}</Text>
          </View>
          </>
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
          <Text style={styles.outputLabel}>{selected.state === "offline_preview" ? "OFFLINE DEMO OUTPUT" : selected.state === "live_synthetic" ? "VERIFIED LIVE SYNTHETIC OUTPUT" : "ACCEPTED EVIDENCE OUTPUT"}</Text>
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
            <Text style={styles.helper}>The future invoke boundary accepts only the selected fixture ID. This source build contains no accepted Founder receipt or network client, so provider access remains disabled and no request can leave the device.</Text>
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: true }} disabled style={[styles.exportButton, styles.disabledButton]}>
              <Text style={styles.exportButtonText}>Invoke eligible fixture ID</Text>
            </Pressable>
            <Text accessibilityLiveRegion="polite" accessibilityRole="text" style={styles.exportStatus}>STOP_S2_T280_GATEWAY_DISABLED · accepted runtime, Technical evidence, and Founder receipt required</Text>
            <TextInput accessibilityLabel="Founder fixture execution evidence JSON" maxFontSizeMultiplier={1.4} multiline onChangeText={setExecutionText} placeholder="Paste accepted fixture execution evidence" placeholderTextColor={colors.muted} style={styles.evidenceInput} value={executionText} />
            <Pressable accessibilityRole="button" onPress={() => void importExecutionEvidence()} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Verify selected fixture result</Text></Pressable>
            <Text accessibilityLiveRegion="polite" accessibilityRole="text" style={styles.exportStatus}>{executionStatus}</Text>
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

        {section === "dice" ? <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>6 · Close and disable</Text>
          <Text style={styles.helper}>A Founder window is not complete until the accepted post-window proof says the gateway and provider access are disabled.</Text>
          <TextInput accessibilityLabel="Post-window disabled proof JSON" maxFontSizeMultiplier={1.4} multiline onChangeText={setPostWindowText} placeholder="Paste closed disable proof" placeholderTextColor={colors.muted} style={styles.evidenceInput} value={postWindowText} />
          <Pressable accessibilityRole="button" onPress={verifyPostWindow} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Verify disabled state</Text></Pressable>
          <Text accessibilityLiveRegion="polite" accessibilityRole="text" style={styles.exportStatus}>{postWindowStatus}</Text>
        </View> : null}

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

function FounderIntakeStatePreview({ state }: { state: IntakeState }) {
  const copy: Record<IntakeState, string> = {
    validation: "Enter one clear synthetic question. Specific validation guidance appears before any roll or runtime request.",
    loading: "Preparing a local interpretation preview… No provider request has started.",
    interpretation: "Local deterministic interpretation fixture: pause, compare the practical signals, and choose the next reversible step.",
    safety: "This request needs a safer form of support. No roll, interpretation request, unit, or persistence action occurs.",
    fallback: "Lumis couldn’t complete that reflection just now. Please try again.",
  };
  return <View accessibilityLiveRegion="polite" accessibilityRole="text" style={styles.statePreview}>
    <Text style={styles.outputLabel}>{state.replaceAll("_", " ").toUpperCase()} · LOCAL SYNTHETIC FIXTURE</Text>
    <Text style={styles.output}>{copy[state]}</Text>
    <Text style={styles.frozenNote}>provider calls 0 · units 0 · persistence 0</Text>
  </View>;
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.navy950, flex: 1 },
  scroll: { width: "100%" },
  evidenceStrip: { backgroundColor: colors.navy950, borderBottomColor: colors.gold, borderBottomWidth: 1, minHeight: 46, justifyContent: "center", paddingHorizontal: 14, zIndex: 5 },
  evidenceText: { color: colors.goldLight, fontSize: 10, fontWeight: "800", letterSpacing: 0 },
  evidenceSha: { color: colors.textSoft, fontFamily: "Courier", fontSize: 8, letterSpacing: 0, marginTop: 2 },
  content: { alignItems: "stretch", padding: spacing.lg, paddingBottom: 60, width: "100%" },
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
  summary: { backgroundColor: "rgba(22,39,61,0.88)", borderColor: colors.line, borderRadius: radii.sm, borderWidth: 1, flex: 1, minHeight: 72, minWidth: 0, padding: spacing.sm },
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
  evidenceInput: { backgroundColor: colors.navy950, borderColor: colors.line, borderRadius: radii.sm, borderWidth: 1, color: colors.ice, fontFamily: "Courier", fontSize: 12, lineHeight: 18, marginBottom: spacing.md, marginTop: spacing.md, minHeight: 88, padding: spacing.md, textAlignVertical: "top" },
  actionRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  flexButton: { flex: 1, marginTop: 0 },
  secondaryButton: { alignItems: "center", borderColor: colors.gold, borderRadius: 7, borderWidth: 1, flex: 1, justifyContent: "center", minHeight: 48 },
  secondaryButtonText: { color: colors.goldLight, fontSize: 13, fontWeight: "800", textAlign: "center" },
  disabledButton: { opacity: 0.42 },
  fixtureExportButton: { alignItems: "center", borderColor: colors.line, borderRadius: 7, borderWidth: 1, justifyContent: "center", marginTop: spacing.md, minHeight: 44, paddingHorizontal: spacing.sm },
  stateGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: spacing.md },
  stateButton: { alignItems: "center", borderColor: colors.line, borderRadius: 7, borderWidth: 1, justifyContent: "center", minHeight: 46, paddingHorizontal: 10, paddingVertical: 7 },
  stateButtonSelected: { backgroundColor: colors.gold, borderColor: colors.gold },
  stateButtonText: { color: colors.textSoft, fontSize: 12, fontWeight: "800" },
  stateButtonTextSelected: { color: colors.navy950 },
  statePreview: { backgroundColor: "rgba(9,24,42,0.72)", borderColor: colors.line, borderRadius: radii.sm, borderWidth: 1, marginTop: spacing.md, padding: spacing.md },
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
