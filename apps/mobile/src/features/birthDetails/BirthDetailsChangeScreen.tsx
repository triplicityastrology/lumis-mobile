import { randomUUID } from "expo-crypto";
import ArrowRight from "lucide-react-native/icons/arrow-right";
import { useEffect, useRef, useState } from "react";
import {
  BackHandler, Modal, ScrollView, StyleSheet, Switch, Text, TextInput, View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { ChartV2 } from "@lumis/shared";

import { colors, radii, spacing } from "../../theme/tokens";
import { BrandPrimaryButton } from "../../components/BrandPrimaryButton";
import { FrostedCard } from "../../components/FrostedCard";
import { NatalWheel } from "../../components/NatalWheel";
import { GeneratingView } from "../../components/GeneratingView";
import {
  BrandButton, GhostButton, LineMotif, RetryCard, ScreenHeader, SoftButton
} from "../../components/states/StateKit";
import {
  formatBirthTimePickerValue,
  parseBirthTimePickerValue,
} from "./birthTimePicker";
import { WheelPicker } from "./WheelPicker";
import { BIRTH_CHANGE_LIMIT, resolveBirthChangeQuota } from "../../services/birthChangeQuota";
import { resolveBirthPlace } from "../../services/birthPlaceAdapter";

/** Big-three summary for the Birth Details display. Rising is included ONLY when
 *  an authoritative timed chart exists (precision "full" + Ascendant) — never
 *  invented for unknown-time charts (birth-time capability rule C). */
function bigThree(chart: ChartV2) {
  const find = (key: string) => chart.planets.find((p) => p.key === key);
  const items: Array<{ label: string; glyph: string; value: string }> = [];
  const sun = find("sun");
  const moon = find("moon");
  if (sun) items.push({ label: "Sun", glyph: "☉", value: `${sun.sign} ${Math.round(sun.degree)}°` });
  if (moon) items.push({ label: "Moon", glyph: "☽", value: `${moon.sign} ${Math.round(moon.degree)}°` });
  const asc = chart.angles.ascendant;
  if (chart.precision === "full" && asc) {
    items.push({ label: "Rising", glyph: "↑", value: `${asc.sign} ${Math.round(asc.degree)}°` });
  }
  return items;
}

/* ---------- date/time <-> string helpers (native pickers guarantee validity) ---------- */

function parseDate(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (!isNaN(d.getTime())) return d;
  }
  return new Date(1990, 0, 1);
}
function formatDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/* ---------- ONB-005 truthful validation (founder return) ----------
 * Never silently rewrite a future/invalid value: the entered value is kept, the
 * specific message is shown, and Continue is blocked until it is corrected. */
function birthDateError(iso: string): string | null {
  if (!iso.trim()) return null; // empty is "not started", handled by the disabled CTA
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return "That date doesn't look right — please check the day.";
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const daysInMonth = new Date(year, month, 0).getDate();
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth) {
    return "That date doesn't look right — please check the day.";
  }
  const picked = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (picked.getTime() > today.getTime()) return "Birth date can't be in the future.";
  return null;
}
function birthTimeError(iso: string, timeUnknown: boolean): string | null {
  if (timeUnknown) return null;
  const value = iso.trim();
  if (!value) return null; // wheel always carries a value; empty = not started
  const invalid = "That isn't a valid time — hours 1–12, minutes 00–59.";
  // The wheel emits 12-hour "h:MM AM/PM"; also accept 24-hour "HH:MM".
  const twelve = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(value);
  if (twelve) {
    const hour = Number(twelve[1]);
    const minute = Number(twelve[2]);
    return hour >= 1 && hour <= 12 && minute >= 0 && minute <= 59 ? null : invalid;
  }
  const twentyFour = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (twentyFour) {
    const hour = Number(twentyFour[1]);
    const minute = Number(twentyFour[2]);
    return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 ? null : invalid;
  }
  return invalid;
}
/**
 * Birth Details change flow (AC-UX-13). Display → edit → confirm (with diff) →
 * regenerating → success | failure. Copy is verbatim from AC-UX-06. The change
 * count is server-authoritative: UI decrements only on confirmed success.
 * The hosted backend performs the chart regeneration and version switch.
 */

export type BirthDetails = { birthDate: string; birthTime: string; birthPlace: string; timeUnknown: boolean };
export type BirthRegenerationOutcome =
  | { ok: true }
  | { ok: false; code: string; message: string };

type Step = "display" | "edit" | "confirm" | "regenerating" | "success" | "failure";

export function BirthDetailsChangeScreen({
  details, chart, successfulChanges, onBack, onRegenerate
}: {
  details: BirthDetails | null;
  chart?: ChartV2 | null;
  successfulChanges: number;
  onBack: () => void;
  onRegenerate: (next: BirthDetails, clientRequestId: string) => Promise<BirthRegenerationOutcome>;
}) {
  const remaining = resolveBirthChangeQuota(successfulChanges).remainingChanges;
  const [step, setStep] = useState<Step>("display");
  // PROF-003: the edit flow is a 3-step wizard (date → time → place).
  const [editStep, setEditStep] = useState<1 | 2 | 3>(1);
  const [draft, setDraft] = useState<BirthDetails>(
    details ?? { birthDate: "", birthTime: "", birthPlace: "", timeUnknown: false }
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);
  const requestIdRef = useRef<string | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };
  // Cancel any pending status-advance timers on unmount (spec: no dangling timers).
  useEffect(() => clearTimers, []);

  function updateDraft(updater: (current: BirthDetails) => BirthDetails) {
    requestIdRef.current = null;
    setFormError(null);
    setFailureMessage(null);
    setDraft(updater);
  }

  function beginEditing() {
    requestIdRef.current = null;
    setFormError(null);
    setFailureMessage(null);
    // Re-seed the draft from the saved details every time the wizard opens, so a
    // previously abandoned edit can never leak into a new session.
    setDraft(details ?? draft);
    setEditStep(1);
    setStep("edit");
  }

  function handleBack() {
    if (step === "regenerating") return;
    if (step === "display") {
      onBack();
      return;
    }
    // Within the wizard, Back steps to the previous step; from step 1 it exits
    // the wizard without committing any staged value.
    if (step === "edit" && editStep > 1) {
      setFormError(null);
      setEditStep((current) => (current === 3 ? 2 : 1));
      return;
    }
    clearTimers();
    requestIdRef.current = null;
    setStep("display");
  }

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      handleBack();
      return true;
    });
    return () => subscription.remove();
  }, [step, editStep, onBack]);

  const dirty = details
    ? draft.birthDate !== details.birthDate ||
      draft.birthTime !== details.birthTime ||
      draft.birthPlace !== details.birthPlace ||
      draft.timeUnknown !== details.timeUnknown
    : false;
  const dateError = birthDateError(draft.birthDate);
  const timeError = birthTimeError(draft.birthTime, draft.timeUnknown);
  const valid =
    draft.birthDate.trim() !== "" &&
    draft.birthPlace.trim() !== "" &&
    (draft.timeUnknown || draft.birthTime.trim() !== "") &&
    !dateError &&
    !timeError;

  async function runRegeneration() {
    const clientRequestId = requestIdRef.current ?? randomUUID();
    requestIdRef.current = clientRequestId;
    setStep("regenerating");
    setFailureMessage(null);
    // Authority rule D: the backend exposes no per-step progress, so we do NOT
    // advance the checklist on a timer (that would falsely claim completed steps).
    // The regenerating view runs an honest indeterminate loading state instead;
    // the real backend result decides the outcome.
    const outcome = await onRegenerate(draft, clientRequestId);
    // On success the parent routes to the full chart-reveal page; the success card
    // below is a fallback only for the case where no updated chart was returned.
    if (outcome.ok) {
      setStep("success");
      return;
    }

    if (outcome.code === "49001") {
      requestIdRef.current = null;
      setStep("display");
      return;
    }

    if (outcome.code === "49002") {
      requestIdRef.current = null;
      setFormError(outcome.message);
      setStep("edit");
      return;
    }

    setFailureMessage(outcome.message);
    setStep("failure");
  }

  const diffs: Array<{ label: string; from: string; to: string }> = [];
  if (details) {
    if (draft.birthDate !== details.birthDate) diffs.push({ label: "Birth date", from: details.birthDate, to: draft.birthDate });
    const oldT = details.timeUnknown ? "Time unknown" : details.birthTime;
    const newT = draft.timeUnknown ? "Time unknown" : draft.birthTime;
    if (oldT !== newT) diffs.push({ label: "Birth time", from: oldT, to: newT });
    if (draft.birthPlace !== details.birthPlace) diffs.push({ label: "Birthplace", from: details.birthPlace, to: draft.birthPlace });
  }

  return (
    <SafeAreaView edges={["top", "left", "right", "bottom"]} style={s.safe}>
      {step !== "regenerating" ? (
        <ScreenHeader
          title="Birth Details"
          onBack={handleBack}
        />
      ) : null}

      <ScrollView
        contentContainerStyle={s.content}
        contentInsetAdjustmentBehavior="never"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {step === "display" ? (
          <>
            <View style={s.card}>
              <Row label="Birth date" value={details?.birthDate ?? "—"} />
              <Row label="Birth time" value={details ? (details.timeUnknown ? "Time unknown" : details.birthTime) : "—"} />
              <Row label="Birthplace" value={details?.birthPlace ?? "—"} last />
            </View>
            <View style={[s.counterChip, remaining === 1 && s.counterChipLow, remaining === 0 && s.counterChipNone]}>
              <Text style={[s.counterText, remaining === 1 && s.counterTextLow, remaining === 0 && s.counterTextNone]}>
                {remaining} of {BIRTH_CHANGE_LIMIT} lifetime changes remaining
              </Text>
            </View>
            {remaining === 0 ? (
              <View style={s.blockedNote}>
                <Text style={s.blockedText}>
                  You have used all 3 birth-detail changes. Please contact support if you need to correct your chart again.
                </Text>
                <GhostButton label="Contact support" onPress={() => {}} style={{ marginTop: 6 }} />
              </View>
            ) : (
              <SoftButton label="Edit birth details" onPress={beginEditing} style={{ marginTop: 18 }} />
            )}

            {/* PROF-002: fill the lower half with the user's real chart wheel and
                big-three. Rising appears only for authoritative timed charts;
                unknown-time charts show Sun + Moon only (rule C). */}
            {chart ? (
              <View style={s.chartPanel}>
                <View style={s.chartWheelWrap}>
                  <NatalWheel chart={chart} size={230} />
                </View>
                <View style={s.big3Row}>
                  {bigThree(chart).map((item) => (
                    <View key={item.label} style={s.big3Card}>
                      <Text style={s.big3Glyph}>{item.glyph}</Text>
                      <Text style={s.big3Label}>{item.label}</Text>
                      <Text style={s.big3Value}>{item.value}</Text>
                    </View>
                  ))}
                </View>
                {chart.precision !== "full" ? (
                  <Text style={s.big3Note}>Your birth time is unknown, so Lumis hides Rising, houses, and the Ascendant.</Text>
                ) : null}
              </View>
            ) : null}
          </>
        ) : null}

        {step === "edit" ? (
          <View style={s.wizard}>
            <Text style={s.eyebrow}>✦ STEP {editStep} · 3</Text>
            <ProgressDots active={editStep} />

            {formError ? (
              <Text accessibilityLiveRegion="assertive" accessibilityRole="alert" style={s.formError}>
                {formError}
              </Text>
            ) : null}

            {editStep === 1 ? (
              <>
                <Text style={s.wizardTitle}>When were you born?</Text>
                <Text style={s.editIntro}>
                  {remaining} of {BIRTH_CHANGE_LIMIT} lifetime changes remaining. Saving will regenerate your chart.
                </Text>
                {/* PROF-003 (RULE 1): inline Month/Day/Year wheel on frosted glass.
                    The staged value is read from the snapped wheel, so any field can
                    change (no 8am/first-item lock). */}
                {/* ONB-005: no maximumDate clamp — a future selection is preserved
                    and surfaced as a truthful error, never silently reset to today. */}
                <FrostedCard style={s.wheelPanel} radius={20}>
                  <WheelPicker
                    mode="date"
                    value={parseDate(draft.birthDate)}
                    onChange={(selected) => updateDraft((current) => ({ ...current, birthDate: formatDate(new Date(selected.getTime())) }))}
                  />
                  <WheelCaps caps={["MONTH", "DAY", "YEAR"]} />
                </FrostedCard>
                {dateError ? (
                  <View style={s.validationBanner}>
                    <Text style={s.validationText}>
                      <Text style={s.validationBold}>Please check this. </Text>{dateError}
                    </Text>
                  </View>
                ) : null}
                <BrandPrimaryButton
                  label="Continue"
                  onPress={() => setEditStep(2)}
                  disabled={!draft.birthDate.trim() || Boolean(dateError)}
                  icon={<ArrowRight color="#1A1206" size={19} />}
                  style={s.wizardCta}
                />
              </>
            ) : editStep === 2 ? (
              <>
                <Text style={s.wizardTitle}>What time were you born?</Text>
                <Text style={s.editIntro}>
                  Your birth time positions the Ascendant, MC, houses, and planet-house placements.
                </Text>
                {!draft.timeUnknown ? (
                  <FrostedCard style={s.wheelPanel} radius={20}>
                    <WheelPicker
                      mode="time"
                      value={parseBirthTimePickerValue(draft.birthTime)}
                      onChange={(selected) => updateDraft((current) => ({ ...current, birthTime: formatBirthTimePickerValue(new Date(selected.getTime())) }))}
                    />
                    <WheelCaps caps={["HOUR", "MIN", "AM / PM"]} />
                  </FrostedCard>
                ) : null}
                <FrostedCard style={s.toggleRow} radius={radii.md}>
                  <Text style={s.fieldLabel}>I don't know my birth time</Text>
                  <Switch
                    accessibilityLabel="I don't know my birth time"
                    accessibilityRole="switch"
                    accessibilityState={{ checked: draft.timeUnknown }}
                    value={draft.timeUnknown}
                    onValueChange={(v) => updateDraft((current) => ({ ...current, timeUnknown: v }))}
                    trackColor={{ false: "rgba(255,255,255,0.12)", true: "rgba(215,185,120,0.6)" }}
                    thumbColor={colors.ice}
                  />
                </FrostedCard>
                {draft.timeUnknown ? (
                  <Text style={s.toggleNote}>Without a birth time, Lumis will not use ASC, MC, houses, or planet-house placements.</Text>
                ) : null}
                {timeError ? (
                  <View style={s.validationBanner}>
                    <Text style={s.validationText}>
                      <Text style={s.validationBold}>Please check this. </Text>{timeError}
                    </Text>
                  </View>
                ) : null}
                <BrandPrimaryButton
                  label="Continue"
                  onPress={() => {
                    // Commit the wheel's shown value even if the user never scrolled
                    // (the displayed time IS the staged time) — never a silent reset.
                    if (!draft.timeUnknown && !draft.birthTime.trim()) {
                      updateDraft((current) => ({ ...current, birthTime: formatBirthTimePickerValue(parseBirthTimePickerValue(current.birthTime)) }));
                    }
                    setEditStep(3);
                  }}
                  disabled={Boolean(timeError)}
                  icon={<ArrowRight color="#1A1206" size={19} />}
                  style={s.wizardCta}
                />
              </>
            ) : (
              <>
                <Text style={s.wizardTitle}>Where were you born?</Text>
                <Text style={s.editIntro}>
                  A confirmed change regenerates your chart while keeping your Past Reflections saved.
                </Text>
                <Field label="Birthplace" value={draft.birthPlace} onChange={(v) => updateDraft((current) => ({ ...current, birthPlace: v }))} placeholder="Search city, e.g. Hong Kong" />
                {/* ONB-005 place: closed adapter boundary. No live geolocation
                    provider is invented here; the seam in services/birthPlaceAdapter
                    stays "unconfigured" until the website API contract is supplied. */}
                {resolveBirthPlace(draft.birthPlace).status === "unconfigured" && draft.birthPlace.trim() !== "" ? (
                  <View style={s.placeAdapterNote}>
                    <Text style={s.placeAdapterText}>
                      Birthplace look-up will connect to the Lumis website's location service, which isn't wired into this build yet. For now the name you enter is used as-is — geocoded confirmation is added once that API is connected.
                    </Text>
                  </View>
                ) : null}
                <BrandPrimaryButton
                  label="Save & regenerate chart"
                  onPress={() => setStep("confirm")}
                  disabled={!dirty || !valid}
                  style={s.wizardCta}
                />
                {!dirty ? <Text style={s.hintNote}>Change a value to continue.</Text> : null}
              </>
            )}
          </View>
        ) : null}

        {step === "success" ? (
          <View style={s.centered}>
            <LineMotif name="wheel" size={72} />
            <Text style={s.successTitle}>Your chart has been updated.</Text>
            <Text style={s.successBody}>
              Lumis will use this new chart for future guidance. Your past reflections are still saved.
            </Text>
            <BrandButton label="Continue to Lumis" onPress={onBack} style={{ alignSelf: "stretch", marginTop: 22 }} />
            <GhostButton label="View updated chart" onPress={onBack} style={{ marginTop: 8 }} />
          </View>
        ) : null}

        {step === "failure" ? (
          <View style={s.centered}>
            <RetryCard
              title="We couldn't update your chart just now."
              sub={failureMessage ?? "Your previous chart is still active, and this change has not been counted."}
              onRetry={runRegeneration}
              secondaryLabel="Back"
              onSecondary={() => { requestIdRef.current = null; setFailureMessage(null); setStep("edit"); }}
            />
          </View>
        ) : null}
      </ScrollView>

      {/* confirm modal */}
      <Modal transparent visible={step === "confirm"} animationType="fade" onRequestClose={() => setStep("edit")}>
        <View style={s.scrim}>
          <View
            accessibilityLabel="Confirm birth details regeneration"
            accessibilityViewIsModal
            style={s.modal}
          >
            <LineMotif name="wheel" size={48} />
            <Text style={s.modalTitle}>Regenerate your chart?</Text>
            <Text style={s.modalBody}>
              Changing your birth details will regenerate your chart and Lumis profile. Your past reflections will stay
              saved, but future guidance will use your new chart. You can change birth details up to 3 times in total (a lifetime limit).
            </Text>
            {diffs.length > 0 ? (
              <View style={s.diffBox}>
                {diffs.map((d) => (
                  <Text key={d.label} style={s.diffLine}>
                    <Text style={s.diffLabel}>{d.label} </Text>
                    <Text style={s.diffFrom}>{d.from}</Text>
                    <Text style={s.diffArrow}> → </Text>
                    <Text style={s.diffTo}>{d.to}</Text>
                  </Text>
                ))}
              </View>
            ) : null}
            <Text style={s.modalCount}>{remaining} lifetime changes remaining</Text>
            <BrandButton label="Regenerate my chart" onPress={runRegeneration} style={{ alignSelf: "stretch", marginTop: 16 }} />
            <GhostButton label="Cancel" onPress={() => setStep("edit")} style={{ marginTop: 6 }} />
          </View>
        </View>
      </Modal>

      {/* Regenerating — PROF-005 dedicated decorative loader (symbolic rotating
          ring, no real natal wheel, no emoji glyphs). Presentation is truthful:
          no timer-driven step completion; the backend outcome decides the exit. */}
      {step === "regenerating" ? (
        // PROF-005 reuses the CHART-002 GeneratingView (Founder-approved) — the
        // same counter-clockwise chart-wheel loop as first-time generation, no
        // forked animation, no step counter, backend-authoritative exit.
        <View style={s.regenOverlay}>
          <GeneratingView
            activeStep={0}
            indeterminate
            steps={[]}
            eyebrow="UPDATING YOUR SKY…"
            title="Regenerating your chart…"
            subtitle="This can take a moment. We'll show your updated chart as soon as it's ready."
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[s.summaryRow, !last && s.summaryDivider]}>
      <Text style={s.summaryLabel}>{label}</Text>
      <Text style={s.summaryValue}>{value}</Text>
    </View>
  );
}

/** PROF-003 wizard progress indicator (3 dots; the active step is a gold pill). */
function ProgressDots({ active }: { active: 1 | 2 | 3 }) {
  return (
    <View style={s.dotsRow} accessibilityLabel={`Step ${active} of 3`}>
      {[1, 2, 3].map((n) => (
        <View key={n} style={[s.dot, n === active ? s.dotOn : n < active ? s.dotDone : s.dotOff]} />
      ))}
    </View>
  );
}

/** 3-column caption row beneath a wheel (e.g. MONTH · DAY · YEAR). */
function WheelCaps({ caps }: { caps: string[] }) {
  return (
    <View style={s.wheelCaps}>
      {caps.map((cap) => (
        <Text key={cap} style={s.wheelCap}>{cap}</Text>
      ))}
    </View>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <View style={{ marginTop: 14 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={s.input}
      />
    </View>
  );
}

const s = StyleSheet.create({
  safe: { backgroundColor: "transparent", flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 40 },
  eyebrow: { color: "#E9B083", fontSize: 11, fontWeight: "700", letterSpacing: 1.4, marginBottom: 6 },
  editTitle: { color: colors.ice, fontFamily: "Newsreader-Medium", fontSize: 30, lineHeight: 36 },
  editIntro: { color: colors.textSoft, fontSize: 13.5, lineHeight: 20, marginTop: 8, maxWidth: 350 },
  editCountRow: { alignSelf: "flex-start", backgroundColor: "rgba(201,169,110,0.10)", borderColor: "rgba(215,185,120,0.34)", borderRadius: 999, borderWidth: 1, marginBottom: 6, marginTop: 14, paddingHorizontal: 11, paddingVertical: 5 },
  editCount: { color: colors.goldLight, fontSize: 11.5, fontWeight: "700" },
  pickerField: { backgroundColor: "rgba(58,80,118,0.42)", borderColor: colors.line, borderRadius: radii.md, borderWidth: 1, marginTop: 14, paddingHorizontal: 14, paddingVertical: 12 },
  pickerValueRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  pickerValue: { color: colors.ice, fontSize: 16 },
  pickerChevron: { color: colors.muted, fontSize: 20 },
  pickerScrim: { flex: 1 },
  pickerSheet: { backgroundColor: "rgba(22,35,55,0.99)", borderTopColor: colors.line, borderTopWidth: 1, paddingBottom: 30 },
  pickerBar: { alignItems: "center", borderBottomColor: colors.line, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 18, paddingVertical: 12 },
  pickerTitle: { color: colors.ice, fontFamily: "Newsreader-Medium", fontSize: 16 },
  pickerCancel: { color: colors.muted, fontSize: 15, fontWeight: "600" },
  pickerDone: { color: colors.accent, fontSize: 15, fontWeight: "700" },
  wheelCaps: { flexDirection: "row", paddingHorizontal: 8, paddingTop: 6 },
  wheelCap: { color: colors.muted, flex: 1, fontSize: 9.5, fontWeight: "700", letterSpacing: 1, textAlign: "center" },
  card: { backgroundColor: "rgba(58,80,118,0.42)", borderColor: colors.line, borderRadius: radii.lg, borderWidth: 1, paddingHorizontal: 16 },
  summaryRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingVertical: 14 },
  summaryDivider: { borderBottomColor: colors.line, borderBottomWidth: StyleSheet.hairlineWidth },
  summaryLabel: { color: colors.muted, fontSize: 13 },
  summaryValue: { color: colors.ice, fontSize: 14 },
  counterChip: { alignSelf: "flex-start", borderColor: "rgba(201,169,110,0.5)", borderRadius: 999, borderWidth: 1, marginTop: 16, paddingHorizontal: 12, paddingVertical: 5 },
  counterChipLow: { borderColor: "rgba(139,147,212,0.5)" },
  counterChipNone: { borderColor: colors.line },
  counterText: { color: colors.goldLight, fontSize: 12, fontWeight: "600" },
  counterTextLow: { color: "#C4C9F2" },
  counterTextNone: { color: colors.muted },
  blockedNote: { backgroundColor: "rgba(58,80,118,0.42)", borderColor: colors.line, borderRadius: radii.md, borderWidth: 1, marginTop: 16, padding: 14 },
  blockedText: { color: colors.textSoft, fontSize: 13, lineHeight: 19 },
  chartPanel: { alignItems: "center", backgroundColor: "rgba(58,80,118,0.24)", borderColor: colors.line, borderRadius: radii.lg, borderWidth: 1, marginTop: 24, paddingHorizontal: 12, paddingTop: 18, paddingBottom: 16 },
  chartWheelWrap: { alignItems: "center" },
  big3Row: { flexDirection: "row", gap: 10, marginTop: 14, width: "100%" },
  big3Card: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.045)", borderColor: colors.line, borderRadius: radii.md, borderWidth: 1, flex: 1, paddingVertical: 12 },
  big3Glyph: { color: colors.gold, fontFamily: "Newsreader-Medium", fontSize: 20 },
  big3Label: { color: colors.muted, fontSize: 10, fontWeight: "700", letterSpacing: 1, marginTop: 6, textTransform: "uppercase" },
  big3Value: { color: colors.ice, fontSize: 12.5, fontWeight: "600", marginTop: 3, textAlign: "center" },
  big3Note: { color: colors.muted, fontSize: 11.5, lineHeight: 17, marginTop: 12, textAlign: "center" },
  fieldLabel: { color: colors.muted, fontSize: 12, fontWeight: "600", marginBottom: 6 },
  input: { backgroundColor: "rgba(255,255,255,0.045)", borderColor: colors.line, borderRadius: radii.md, borderWidth: 1, color: colors.ice, fontSize: 15, minHeight: 50, paddingHorizontal: 14 },
  // Fill/blur/border provided by FrostedCard (RULE 1).
  // Item 2 (founder return): vertically centre the switch against the label.
  toggleRow: { alignItems: "center", backgroundColor: "transparent", flexDirection: "row", justifyContent: "space-between", marginTop: 16, minHeight: 56, paddingHorizontal: 14, paddingVertical: 10 },
  wizard: { gap: 0 },
  wizardTitle: { color: colors.ice, fontFamily: "Newsreader-Medium", fontSize: 28, fontWeight: "500", lineHeight: 34, marginTop: 4 },
  wizardCta: { marginTop: 24 },
  // Item 2 (founder return): extra vertical padding so the wheel's top/bottom
  // faded rows don't clip against the frosted card's rounded border.
  wheelPanel: { alignItems: "stretch", marginTop: 18, paddingHorizontal: 10, paddingVertical: 18 },
  dotsRow: { flexDirection: "row", gap: 7, marginBottom: 16, marginTop: 4 },
  dot: { borderRadius: 3, height: 6 },
  dotOn: { backgroundColor: colors.accent, width: 22 },
  dotDone: { backgroundColor: "rgba(215,185,120,0.55)", width: 6 },
  dotOff: { backgroundColor: "rgba(255,255,255,0.16)", width: 6 },
  toggleNote: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 8 },
  accuracyNote: { backgroundColor: "rgba(201,169,110,0.08)", borderColor: "rgba(215,185,120,0.22)", borderRadius: radii.md, borderWidth: 1, marginTop: 12, padding: 14 },
  accuracyNoteTitle: { color: colors.goldLight, fontFamily: "Newsreader-Medium", fontSize: 14 },
  accuracyNoteBody: { color: colors.textSoft, fontSize: 12, lineHeight: 18, marginTop: 5 },
  formError: { color: "#FFB4A8", fontSize: 12.5, lineHeight: 18, marginTop: 12 },
  hintNote: { color: colors.muted, fontSize: 12, marginTop: 10, textAlign: "center" },
  // ONB-005 validation banner (bold "Please check this." prefix).
  validationBanner: { backgroundColor: "rgba(227,142,124,0.1)", borderColor: "rgba(227,142,124,0.34)", borderRadius: 12, borderWidth: 1, marginTop: 14, paddingHorizontal: 14, paddingVertical: 12 },
  validationText: { color: colors.ice, fontSize: 13, lineHeight: 19 },
  validationBold: { color: "#E38E7C", fontWeight: "700" },
  placeAdapterNote: { backgroundColor: "rgba(201,169,110,0.08)", borderColor: "rgba(215,185,120,0.22)", borderRadius: radii.md, borderWidth: 1, marginTop: 12, padding: 14 },
  placeAdapterText: { color: colors.textSoft, fontSize: 12.5, lineHeight: 18 },
  centered: { alignItems: "center", paddingTop: 24 },
  successTitle: { color: colors.ice, fontFamily: "Newsreader-Medium", fontSize: 21, marginTop: 14, textAlign: "center" },
  successBody: { color: colors.textSoft, fontSize: 14, lineHeight: 21, marginTop: 8, maxWidth: 320, textAlign: "center" },
  scrim: { alignItems: "center", backgroundColor: "rgba(4,10,20,0.65)", flex: 1, justifyContent: "center", padding: 26 },
  modal: { alignItems: "center", backgroundColor: "rgba(30,44,70,0.98)", borderColor: colors.line, borderRadius: 24, borderWidth: 1, padding: 24, width: "100%" },
  modalTitle: { color: colors.ice, fontFamily: "Newsreader-Medium", fontSize: 20, marginTop: 8 },
  modalBody: { color: colors.textSoft, fontSize: 13.5, lineHeight: 20, marginTop: 10, textAlign: "center" },
  diffBox: { alignSelf: "stretch", backgroundColor: "rgba(201,169,110,0.09)", borderColor: "rgba(180,134,63,0.28)", borderRadius: radii.md, borderWidth: 1, gap: 6, marginTop: 14, padding: 12 },
  diffLine: { fontSize: 13 },
  diffLabel: { color: colors.muted, fontWeight: "700" },
  diffFrom: { color: colors.muted, textDecorationLine: "line-through" },
  diffArrow: { color: colors.muted },
  diffTo: { color: colors.ice, fontWeight: "600" },
  modalCount: { color: colors.muted, fontSize: 12, marginTop: 14 },
  regenOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "transparent" },
  regenWheel: { alignItems: "center", height: 150, justifyContent: "center", marginBottom: 24, width: 150 },
  regenEyebrow: { color: "#E9B083", fontSize: 11, fontWeight: "700", letterSpacing: 1.6 },
  regenTitle: { color: colors.ice, fontFamily: "Newsreader-Medium", fontSize: 26, marginTop: 8, textAlign: "center" },
  regenSteps: { alignSelf: "stretch", gap: 18, marginTop: 34 },
  regenStepRow: { alignItems: "center", flexDirection: "row", gap: 14 },
  regenDot: { alignItems: "center", borderColor: colors.line, borderRadius: 15, borderWidth: 1, height: 30, justifyContent: "center", width: 30 },
  regenDotActive: { borderColor: "rgba(215,185,120,0.6)" },
  regenDotDone: { backgroundColor: colors.gold, borderColor: colors.gold },
  regenCheck: { color: colors.navy950, fontSize: 15, fontWeight: "700" },
  regenNum: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  regenStepText: { color: colors.muted, flex: 1, fontSize: 15 },
  regenStepTextActive: { color: colors.ice }
});
