import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useEffect, useRef, useState } from "react";
import {
  Modal, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Switch, Text, TextInput, View
} from "react-native";

import { colors, radii, spacing } from "../../theme/tokens";
import { CelestialBackground } from "../../components/CelestialBackground";
import {
  BrandButton, GhostButton, LineMotif, RetryCard, ScreenHeader, SoftButton
} from "../../components/states/StateKit";

/* ---------- date/time <-> string helpers (native pickers guarantee validity) ---------- */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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
function displayDate(iso: string): string {
  const d = parseDate(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
function parseTime(t: string): Date {
  const now = new Date(2000, 0, 1, 12, 0);
  const ampm = /(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(t);
  if (ampm) {
    let h = Number(ampm[1]) % 12;
    if (/pm/i.test(ampm[3])) h += 12;
    now.setHours(h, Number(ampm[2]));
    return now;
  }
  const h24 = /(\d{1,2}):(\d{2})/.exec(t);
  if (h24) now.setHours(Number(h24[1]), Number(h24[2]));
  return now;
}
function formatTime(d: Date): string {
  let h = d.getHours();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(d.getMinutes()).padStart(2, "0")} ${ampm}`;
}

/**
 * Birth Details change flow (AC-UX-13). Display → edit → confirm (with diff) →
 * regenerating → success | failure. Copy is verbatim from AC-UX-06. The change
 * count is server-authoritative: UI decrements only on confirmed success.
 * Backend later performs the real chart regeneration.
 */

const LIMIT = 3;

export type BirthDetails = { birthDate: string; birthTime: string; birthPlace: string; timeUnknown: boolean };

type Step = "display" | "edit" | "confirm" | "regenerating" | "success" | "failure";

export function BirthDetailsChangeScreen({
  details, successfulChanges, onBack, onRegenerate
}: {
  details: BirthDetails | null;
  successfulChanges: number;
  onBack: () => void;
  /** Performs the REAL chart/profile regeneration; resolves true on success. */
  onRegenerate: (next: BirthDetails) => Promise<boolean>;
}) {
  const remaining = Math.max(0, LIMIT - successfulChanges);
  const [step, setStep] = useState<Step>("display");
  const [draft, setDraft] = useState<BirthDetails>(
    details ?? { birthDate: "", birthTime: "", birthPlace: "", timeUnknown: false }
  );
  const [picker, setPicker] = useState<"date" | "time" | null>(null);
  const [regenStep, setRegenStep] = useState(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };
  // Cancel any pending status-advance timers on unmount (spec: no dangling timers).
  useEffect(() => clearTimers, []);

  const dirty = details
    ? draft.birthDate !== details.birthDate ||
      draft.birthTime !== details.birthTime ||
      draft.birthPlace !== details.birthPlace ||
      draft.timeUnknown !== details.timeUnknown
    : false;
  const valid = draft.birthDate.trim() !== "" && draft.birthPlace.trim() !== "" && (draft.timeUnknown || draft.birthTime.trim() !== "");

  const REGEN_STEPS = [
    "Updating your chart",
    "Regenerating your Lumis profile",
    "Preparing your new chart context"
  ];
  async function runRegeneration() {
    setStep("regenerating");
    setRegenStep(0);
    // Status steps advance for feedback; the real backend result decides the outcome.
    timersRef.current = [
      setTimeout(() => setRegenStep(1), 900),
      setTimeout(() => setRegenStep(2), 1800)
    ];
    const ok = await onRegenerate(draft);
    clearTimers();
    setStep(ok ? "success" : "failure");
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
    <SafeAreaView style={s.safe}>
      <CelestialBackground />
      <ScreenHeader
        title="Birth Details"
        onBack={
          step === "regenerating"
            ? () => {} // no back-out mid-regeneration
            : step === "display"
              ? onBack
              : () => { clearTimers(); setStep("display"); }
        }
      />

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {step === "display" ? (
          <>
            <View style={s.card}>
              <Row label="Birth date" value={details?.birthDate ?? "—"} />
              <Row label="Birth time" value={details ? (details.timeUnknown ? "Time unknown" : details.birthTime) : "—"} />
              <Row label="Birthplace" value={details?.birthPlace ?? "—"} last />
            </View>
            <View style={[s.counterChip, remaining === 1 && s.counterChipLow, remaining === 0 && s.counterChipNone]}>
              <Text style={[s.counterText, remaining === 1 && s.counterTextLow, remaining === 0 && s.counterTextNone]}>
                {remaining} of {LIMIT} changes remaining
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
              <SoftButton label="Edit birth details" onPress={() => { setDraft(details ?? draft); setStep("edit"); }} style={{ marginTop: 18 }} />
            )}
          </>
        ) : null}

        {step === "edit" ? (
          <>
            <Text style={s.eyebrow}>✦ EDIT</Text>
            <Text style={s.editTitle}>Your birth details</Text>
            <Text style={s.editSub}>{remaining} of {LIMIT} changes remaining this year.</Text>

            <PickerRow label="Birth date" value={draft.birthDate ? displayDate(draft.birthDate) : "Choose date"} onPress={() => setPicker("date")} />
            {!draft.timeUnknown ? (
              <PickerRow label="Birth time" value={draft.birthTime || "Choose time"} onPress={() => setPicker("time")} />
            ) : null}
            <View style={s.toggleRow}>
              <Text style={s.fieldLabel}>I don't know my birth time</Text>
              <Switch
                value={draft.timeUnknown}
                onValueChange={(v) => setDraft({ ...draft, timeUnknown: v })}
                trackColor={{ false: "rgba(255,255,255,0.12)", true: "rgba(215,185,120,0.6)" }}
                thumbColor={colors.ice}
              />
            </View>
            {draft.timeUnknown ? <Text style={s.toggleNote}>Some house-based insights will be hidden.</Text> : null}
            <Field label="Birthplace" value={draft.birthPlace} onChange={(v) => setDraft({ ...draft, birthPlace: v })} placeholder="Search city, e.g. Hong Kong" />

            <BrandButton label="Review change" onPress={() => setStep("confirm")} disabled={!dirty || !valid} style={{ marginTop: 22 }} />
            {!dirty ? <Text style={s.hintNote}>Change a value to continue.</Text> : null}

            {/* Native iOS calendar (date) + wheel (time) with built-in validation. */}
            {picker ? (
              Platform.OS === "ios" ? (
                <Modal transparent animationType="slide" onRequestClose={() => setPicker(null)}>
                  <Pressable style={s.pickerScrim} onPress={() => setPicker(null)} />
                  <View style={s.pickerSheet}>
                    <View style={s.pickerBar}>
                      <Text style={s.pickerTitle}>{picker === "date" ? "Birth date" : "Birth time"}</Text>
                      <Pressable onPress={() => setPicker(null)} hitSlop={8}><Text style={s.pickerDone}>Done</Text></Pressable>
                    </View>
                    <DateTimePicker
                      value={picker === "date" ? parseDate(draft.birthDate) : parseTime(draft.birthTime)}
                      mode={picker}
                      display={picker === "date" ? "inline" : "spinner"}
                      maximumDate={picker === "date" ? new Date() : undefined}
                      themeVariant="dark"
                      onChange={(_e: DateTimePickerEvent, d?: Date) => {
                        if (!d) return;
                        if (picker === "date") setDraft((p) => ({ ...p, birthDate: formatDate(d) }));
                        else setDraft((p) => ({ ...p, birthTime: formatTime(d) }));
                      }}
                    />
                  </View>
                </Modal>
              ) : (
                <DateTimePicker
                  value={picker === "date" ? parseDate(draft.birthDate) : parseTime(draft.birthTime)}
                  mode={picker}
                  display={picker === "date" ? "calendar" : "clock"}
                  maximumDate={picker === "date" ? new Date() : undefined}
                  onChange={(e: DateTimePickerEvent, d?: Date) => {
                    setPicker(null);
                    if (e.type !== "set" || !d) return;
                    if (picker === "date") setDraft((p) => ({ ...p, birthDate: formatDate(d) }));
                    else setDraft((p) => ({ ...p, birthTime: formatTime(d) }));
                  }}
                />
              )
            ) : null}
          </>
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
              sub="Your previous chart is still active, and this change has not been counted."
              onRetry={runRegeneration}
              secondaryLabel="Back"
              onSecondary={() => setStep("edit")}
            />
          </View>
        ) : null}
      </ScrollView>

      {/* confirm modal */}
      <Modal transparent visible={step === "confirm"} animationType="fade" onRequestClose={() => setStep("edit")}>
        <View style={s.scrim}>
          <View style={s.modal}>
            <LineMotif name="wheel" size={48} />
            <Text style={s.modalTitle}>Regenerate your chart?</Text>
            <Text style={s.modalBody}>
              Changing your birth details will regenerate your chart and Lumis profile. Your past reflections will stay
              saved, but future guidance will use your new chart. You can change birth details up to 3 times.
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
            <Text style={s.modalCount}>{remaining} changes remaining</Text>
            <BrandButton label="Regenerate my chart" onPress={runRegeneration} style={{ alignSelf: "stretch", marginTop: 16 }} />
            <GhostButton label="Cancel" onPress={() => setStep("edit")} style={{ marginTop: 6 }} />
          </View>
        </View>
      </Modal>

      {/* Regenerating — full Generating-page experience (matches onboarding chart
          generation), over the same sky, with the approved edit-specific copy. */}
      {step === "regenerating" ? (
        <View style={s.regenOverlay}>
          <View style={s.regenWheel}><LineMotif name="wheel" size={130} /></View>
          <Text style={s.regenEyebrow}>✦ UPDATING YOUR SKY…</Text>
          <Text style={s.regenTitle}>Regenerating your chart.</Text>
          <View style={s.regenSteps}>
            {REGEN_STEPS.map((label, i) => (
              <View key={label} style={s.regenStepRow}>
                <View style={[s.regenDot, i < regenStep && s.regenDotDone, i === regenStep && s.regenDotActive]}>
                  {i < regenStep ? <Text style={s.regenCheck}>✓</Text> : <Text style={s.regenNum}>{i + 1}</Text>}
                </View>
                <Text style={[s.regenStepText, i <= regenStep && s.regenStepTextActive]}>{label}</Text>
              </View>
            ))}
          </View>
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

function PickerRow({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={s.pickerField} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={s.pickerValueRow}>
        <Text style={s.pickerValue}>{value}</Text>
        <Text style={s.pickerChevron}>›</Text>
      </View>
    </Pressable>
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
  safe: { backgroundColor: colors.navy950, flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 40 },
  eyebrow: { color: "#E9B083", fontSize: 11, fontWeight: "700", letterSpacing: 1.4, marginBottom: 6 },
  editTitle: { color: colors.ice, fontFamily: "Georgia", fontSize: 26 },
  editSub: { color: colors.muted, fontSize: 12.5, marginBottom: 8, marginTop: 4 },
  pickerField: { backgroundColor: "rgba(58,80,118,0.42)", borderColor: colors.line, borderRadius: radii.md, borderWidth: 1, marginTop: 14, paddingHorizontal: 14, paddingVertical: 12 },
  pickerValueRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  pickerValue: { color: colors.ice, fontSize: 16 },
  pickerChevron: { color: colors.muted, fontSize: 20 },
  pickerScrim: { flex: 1 },
  pickerSheet: { backgroundColor: "rgba(22,35,55,0.99)", borderTopColor: colors.line, borderTopWidth: 1, paddingBottom: 30 },
  pickerBar: { alignItems: "center", borderBottomColor: colors.line, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 18, paddingVertical: 12 },
  pickerTitle: { color: colors.ice, fontFamily: "Georgia", fontSize: 16 },
  pickerDone: { color: colors.gold, fontSize: 15, fontWeight: "700" },
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
  fieldLabel: { color: colors.muted, fontSize: 12, fontWeight: "600", marginBottom: 6 },
  input: { backgroundColor: "rgba(255,255,255,0.045)", borderColor: colors.line, borderRadius: radii.md, borderWidth: 1, color: colors.ice, fontSize: 15, minHeight: 50, paddingHorizontal: 14 },
  toggleRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 18 },
  toggleNote: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 8 },
  hintNote: { color: colors.muted, fontSize: 12, marginTop: 10, textAlign: "center" },
  centered: { alignItems: "center", paddingTop: 24 },
  successTitle: { color: colors.ice, fontFamily: "Georgia", fontSize: 21, marginTop: 14, textAlign: "center" },
  successBody: { color: colors.textSoft, fontSize: 14, lineHeight: 21, marginTop: 8, maxWidth: 320, textAlign: "center" },
  scrim: { alignItems: "center", backgroundColor: "rgba(4,10,20,0.65)", flex: 1, justifyContent: "center", padding: 26 },
  modal: { alignItems: "center", backgroundColor: "rgba(30,44,70,0.98)", borderColor: colors.line, borderRadius: 24, borderWidth: 1, padding: 24, width: "100%" },
  modalTitle: { color: colors.ice, fontFamily: "Georgia", fontSize: 20, marginTop: 8 },
  modalBody: { color: colors.textSoft, fontSize: 13.5, lineHeight: 20, marginTop: 10, textAlign: "center" },
  diffBox: { alignSelf: "stretch", backgroundColor: "rgba(201,169,110,0.09)", borderColor: "rgba(180,134,63,0.28)", borderRadius: radii.md, borderWidth: 1, gap: 6, marginTop: 14, padding: 12 },
  diffLine: { fontSize: 13 },
  diffLabel: { color: colors.muted, fontWeight: "700" },
  diffFrom: { color: colors.muted, textDecorationLine: "line-through" },
  diffArrow: { color: colors.muted },
  diffTo: { color: colors.ice, fontWeight: "600" },
  modalCount: { color: colors.muted, fontSize: 12, marginTop: 14 },
  regenOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
  regenWheel: { alignItems: "center", height: 150, justifyContent: "center", marginBottom: 24, width: 150 },
  regenEyebrow: { color: "#E9B083", fontSize: 11, fontWeight: "700", letterSpacing: 1.6 },
  regenTitle: { color: colors.ice, fontFamily: "Georgia", fontSize: 26, marginTop: 8, textAlign: "center" },
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
