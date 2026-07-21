import { useState } from "react";
import {
  Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View
} from "react-native";
import Svg, { Rect } from "react-native-svg";

import { colors, radii, spacing } from "../../theme/tokens";
import { CelestialBackground } from "../../components/CelestialBackground";
import {
  BrandButton, GhostButton, LineMotif, QuietEmptyState, SafetyNote, ScreenHeader, SoftButton
} from "../../components/states/StateKit";

/**
 * Care Circle UI-only flow (AC-UX-11). Full interactive journey on mock data:
 * dual-role home, add-carer (QR → scan → confirm), pending/active/removed,
 * check-in prompt, remove/leave. All relationship/QR/schedule behavior is
 * Backend later; gentle-check-in tone only (no emergency/rescue language).
 */

const SAFETY = "Care Circle is for gentle check-ins only. It cannot guarantee push delivery, urgent response, or emergency support.";
const MAX_CARERS = 5;

type Carer = { id: string; name: string; status: "Active" | "Pending" };
type Caree = { id: string; name: string; lastStatus: string };

type View_ =
  | { v: "home" }
  | { v: "qr" }
  | { v: "scan" }
  | { v: "confirm"; carerName: string };

export function CareCircleScreen({ onBack, eligible = true }: { onBack: () => void; eligible?: boolean }) {
  const [view, setView] = useState<View_>({ v: "home" });
  const [carers, setCarers] = useState<Carer[]>([
    { id: "c1", name: "Mei (sister)", status: "Active" }
  ]);
  const [carees] = useState<Caree[]>([{ id: "e1", name: "Alex", lastStatus: "OK · 2h ago" }]);
  const [paused, setPaused] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [scanError, setScanError] = useState<"" | "invalid" | "expired">("");
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<Carer | null>(null);

  function simulateScan(code?: string) {
    if (code && code.toUpperCase() !== "LUMIS123") {
      setScanError("invalid");
      return;
    }
    setScanError("");
    setView({ v: "confirm", carerName: "Jordan" });
  }
  function sendRequest(name: string) {
    setCarers((prev) => [...prev, { id: `c${Date.now()}`, name, status: "Pending" }]);
    setView({ v: "home" });
  }

  if (!eligible) {
    return (
      <Shell title="Care Circle" onBack={onBack}>
        <QuietEmptyState
          motif="hands"
          title="Care Circle is a paid feature."
          sub="Care Circle is available with paid Lumis plans."
          ctaLabel="View plans"
          onCta={onBack}
        />
      </Shell>
    );
  }

  if (view.v === "qr") {
    return (
      <Shell title="My carer QR" onBack={() => setView({ v: "home" })}>
        <View style={s.qrCard}>
          <QrPlaceholder />
          <Text style={s.qrName}>Ruby</Text>
          <View style={s.expiryChip}><Text style={s.expiryText}>Expires in 4:59</Text></View>
        </View>
        <Text style={s.explain}>
          Let a trusted Lumis user scan this to request adding you as their carer. You'll still need to accept.
        </Text>
        <GhostButton label="Refresh code" onPress={() => {}} style={{ marginTop: 6 }} />
        <SafetyNote text={SAFETY} />
      </Shell>
    );
  }

  if (view.v === "scan") {
    return (
      <Shell title="Add a carer" onBack={() => { setView({ v: "home" }); setScanError(""); }}>
        <View style={s.viewfinder}>
          <ViewfinderMask />
          <Text style={s.viewfinderHint}>Point at your carer's QR code</Text>
        </View>
        {scanError === "invalid" ? (
          <Text style={s.scanErr}>This code isn't valid. Ask them to refresh it.</Text>
        ) : scanError === "expired" ? (
          <Text style={s.scanErr}>This code has expired.</Text>
        ) : null}
        <Text style={s.explainSmall}>Camera not available in preview — enter the code or simulate a scan.</Text>
        <View style={s.manualRow}>
          <TextInput
            autoCapitalize="characters"
            onChangeText={setManualCode}
            placeholder="Enter code"
            placeholderTextColor={colors.muted}
            style={s.manualInput}
            value={manualCode}
          />
          <SoftButton label="Submit" onPress={() => simulateScan(manualCode)} />
        </View>
        <BrandButton label="Simulate scan (LUMIS123)" onPress={() => simulateScan("LUMIS123")} style={{ marginTop: 12 }} />
      </Shell>
    );
  }

  if (view.v === "confirm") {
    return (
      <Shell title="Confirm carer" onBack={() => setView({ v: "scan" })}>
        <View style={s.confirmHero}>
          <View style={s.avatar}><Text style={s.avatarText}>{view.carerName[0]}</Text></View>
          <Text style={s.confirmName}>{view.carerName}</Text>
        </View>
        <View style={s.permCard}>
          <Text style={s.permHead}>They will</Text>
          <Text style={s.permItem}>· receive gentle check-in notices</Text>
          <Text style={s.permItem}>· see your check-in status</Text>
          <Text style={[s.permHead, { marginTop: 12 }]}>They won't</Text>
          <Text style={s.permItem}>· see your chats, readings, birth details, credits, or billing</Text>
        </View>
        <BrandButton label="Send request" onPress={() => sendRequest(view.carerName)} style={{ marginTop: 18 }} />
        <GhostButton label="Cancel" onPress={() => setView({ v: "scan" })} style={{ marginTop: 8 }} />
      </Shell>
    );
  }

  // home
  const canAdd = carers.length < MAX_CARERS;
  return (
    <Shell title="Care Circle" onBack={onBack} emblem>
      {/* caree section */}
      <Text style={s.sectionLabel}>Your check-ins</Text>
      <View style={s.card}>
        <View style={s.scheduleRow}>
          <View style={s.scheduleChip}><Text style={s.scheduleChipText}>{paused ? "Paused" : "Every 2 days"}</Text></View>
          <Text style={s.scheduleNext}>{paused ? "Check-ins paused" : "Next check-in: tomorrow, 10:00"}</Text>
        </View>

        {carers.length === 0 ? (
          <QuietEmptyState
            motif="hands"
            title="No carers yet."
            sub="Add someone you trust to receive gentle notices."
            ctaLabel="Add a carer"
            onCta={() => setView({ v: "scan" })}
          />
        ) : (
          <View style={{ gap: 8, marginTop: 12 }}>
            {carers.map((c) => (
              <View key={c.id} style={s.carerRow}>
                <View style={s.avatarSm}><Text style={s.avatarSmText}>{c.name[0]}</Text></View>
                <Text style={s.carerName}>{c.name}</Text>
                <View style={[s.statusChip, c.status === "Active" && s.statusChipActive]}>
                  <Text style={s.statusChipText}>{c.status === "Pending" ? "Waiting to accept" : "Active"}</Text>
                </View>
                <Pressable onPress={() => setRemoveTarget(c)} hitSlop={6}><Text style={s.rowLeave}>Remove</Text></Pressable>
              </View>
            ))}
          </View>
        )}

        <View style={s.actionRow}>
          <SoftButton
            label={canAdd ? "Add a carer" : "Limit reached (5)"}
            onPress={() => canAdd && setView({ v: "scan" })}
            disabled={!canAdd}
            style={{ flex: 1 }}
          />
          <SoftButton label={paused ? "Resume" : "Pause"} onPress={() => setPaused((p) => !p)} style={{ flex: 1 }} />
        </View>
        <GhostButton label="Preview a check-in" onPress={() => setCheckinOpen(true)} style={{ marginTop: 4 }} />
      </View>

      {/* carer section */}
      <Text style={[s.sectionLabel, { marginTop: 24 }]}>People you care for</Text>
      <View style={s.card}>
        {carees.length === 0 ? (
          <QuietEmptyState
            motif="hands"
            title="You're not caring for anyone yet."
            sub="Share your QR when someone wants to add you."
            ctaLabel="Show my carer QR"
            onCta={() => setView({ v: "qr" })}
          />
        ) : (
          <View style={{ gap: 8 }}>
            {carees.map((e) => (
              <View key={e.id} style={s.carerRow}>
                <View style={s.avatarSm}><Text style={s.avatarSmText}>{e.name[0]}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.carerName}>{e.name}</Text>
                  <Text style={s.careeStatus}>{e.lastStatus}</Text>
                </View>
                <Pressable hitSlop={6}><Text style={s.rowLeave}>Leave</Text></Pressable>
              </View>
            ))}
            <SoftButton label="Show my carer QR" onPress={() => setView({ v: "qr" })} style={{ marginTop: 8 }} />
          </View>
        )}
      </View>

      <SafetyNote text={SAFETY} />

      {/* check-in prompt */}
      <Modal transparent visible={checkinOpen} animationType="fade" onRequestClose={() => setCheckinOpen(false)}>
        <View style={s.modalScrim}>
          <View style={s.checkinCard}>
            <LineMotif name="hands" size={52} />
            <Text style={s.checkinTitle}>A gentle check-in</Text>
            <Text style={s.checkinBody}>Just checking in. How are you today?</Text>
            <BrandButton label="I'm OK" onPress={() => setCheckinOpen(false)} style={{ alignSelf: "stretch", marginTop: 16 }} />
            <SoftButton label="I need help" onPress={() => setCheckinOpen(false)} style={{ alignSelf: "stretch", marginTop: 10 }} />
            <Text style={s.checkinFoot}>If this is urgent, contact local emergency services directly.</Text>
          </View>
        </View>
      </Modal>

      {/* remove confirm */}
      <Modal transparent visible={!!removeTarget} animationType="fade" onRequestClose={() => setRemoveTarget(null)}>
        <View style={s.modalScrim}>
          <View style={s.confirmDialog}>
            <Text style={s.dialogTitle}>End this Care Circle link?</Text>
            <Text style={s.dialogBody}>They'll be notified and will stop receiving notices about you.</Text>
            <Pressable
              style={s.endBtn}
              onPress={() => { setCarers((prev) => prev.filter((c) => c.id !== removeTarget?.id)); setRemoveTarget(null); }}
            >
              <Text style={s.endBtnText}>End link</Text>
            </Pressable>
            <GhostButton label="Cancel" onPress={() => setRemoveTarget(null)} style={{ marginTop: 6 }} />
          </View>
        </View>
      </Modal>
    </Shell>
  );
}

function Shell({ title, onBack, emblem, children }: { title: string; onBack: () => void; emblem?: boolean; children: React.ReactNode }) {
  return (
    <SafeAreaView style={s.safe}>
      <CelestialBackground variant="care" />
      <ScreenHeader title={title} onBack={onBack} />
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {emblem ? (
          <View style={s.emblemWrap}>
            <View style={s.emblem}><LineMotif name="hands" size={30} /></View>
          </View>
        ) : null}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

function QrPlaceholder() {
  const cells = 9;
  const rng = (i: number, j: number) => (i * 3 + j * 7 + i * j) % 3 !== 0;
  return (
    <Svg width={148} height={148} viewBox="0 0 9 9">
      {Array.from({ length: cells }).map((_, i) =>
        Array.from({ length: cells }).map((__, j) =>
          rng(i, j) ? <Rect key={`${i}-${j}`} x={i + 0.08} y={j + 0.08} width={0.84} height={0.84} rx={0.12} fill="#E8DCC0" /> : null
        )
      )}
    </Svg>
  );
}

function ViewfinderMask() {
  return (
    <Svg width={200} height={200} viewBox="0 0 200 200">
      <Rect x={2} y={2} width={196} height={196} rx={24} stroke="rgba(215,185,120,0.5)" strokeWidth={2} fill="none" strokeDasharray="40 118" />
    </Svg>
  );
}

const s = StyleSheet.create({
  safe: { backgroundColor: "#081C22", flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 40 },
  emblemWrap: { alignItems: "center", marginBottom: 18 },
  emblem: { alignItems: "center", backgroundColor: "rgba(201,169,110,0.18)", borderColor: "rgba(215,185,120,0.5)", borderRadius: 24, borderWidth: 1, height: 48, justifyContent: "center", width: 48 },
  sectionLabel: { color: colors.muted, fontSize: 11.5, fontWeight: "700", letterSpacing: 0.8, marginBottom: 10, textTransform: "uppercase" },
  card: { backgroundColor: "rgba(58,80,118,0.42)", borderColor: colors.line, borderRadius: radii.lg, borderWidth: 1, padding: 16 },
  scheduleRow: { alignItems: "center", flexDirection: "row", gap: 10 },
  scheduleChip: { backgroundColor: "rgba(201,169,110,0.14)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  scheduleChipText: { color: colors.goldLight, fontSize: 12, fontWeight: "700" },
  scheduleNext: { color: colors.textSoft, flex: 1, fontSize: 12 },
  carerRow: { alignItems: "center", flexDirection: "row", gap: 10 },
  avatarSm: { alignItems: "center", backgroundColor: "rgba(139,147,212,0.24)", borderRadius: 15, height: 30, justifyContent: "center", width: 30 },
  avatarSmText: { color: colors.ice, fontSize: 13, fontWeight: "700" },
  carerName: { color: colors.ice, fontSize: 14 },
  careeStatus: { color: colors.muted, fontSize: 11.5, marginTop: 2 },
  statusChip: { backgroundColor: "rgba(139,147,212,0.16)", borderRadius: 999, marginLeft: "auto", paddingHorizontal: 9, paddingVertical: 3 },
  statusChipActive: { backgroundColor: "rgba(134,200,166,0.16)" },
  statusChipText: { color: colors.textSoft, fontSize: 10.5, fontWeight: "600" },
  rowLeave: { color: colors.muted, fontSize: 12, fontWeight: "600", marginLeft: 6 },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  qrCard: { alignItems: "center", alignSelf: "center", backgroundColor: "rgba(58,80,118,0.42)", borderColor: "rgba(215,185,120,0.55)", borderRadius: 22, borderWidth: 1.5, gap: 12, marginTop: 8, padding: 24 },
  qrName: { color: colors.ice, fontFamily: "Georgia", fontSize: 17 },
  expiryChip: { backgroundColor: "rgba(201,169,110,0.16)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  expiryText: { color: colors.goldLight, fontSize: 11.5, fontWeight: "600" },
  explain: { color: colors.textSoft, fontSize: 13, lineHeight: 19, marginTop: 16, textAlign: "center" },
  explainSmall: { color: colors.muted, fontSize: 11.5, marginTop: 14, textAlign: "center" },
  viewfinder: { alignItems: "center", alignSelf: "center", justifyContent: "center", marginTop: 12, position: "relative" },
  viewfinderHint: { color: colors.textSoft, fontSize: 12.5, position: "absolute" },
  scanErr: { color: "#E9B083", fontSize: 12.5, marginTop: 12, textAlign: "center" },
  manualRow: { alignItems: "center", flexDirection: "row", gap: 10, marginTop: 12 },
  manualInput: { backgroundColor: "rgba(255,255,255,0.045)", borderColor: colors.line, borderRadius: radii.md, borderWidth: 1, color: colors.ice, flex: 1, fontSize: 14, letterSpacing: 2, minHeight: 46, paddingHorizontal: 14 },
  confirmHero: { alignItems: "center", gap: 10, marginTop: 12 },
  avatar: { alignItems: "center", backgroundColor: "rgba(139,147,212,0.24)", borderRadius: 28, height: 56, justifyContent: "center", width: 56 },
  avatarText: { color: colors.ice, fontFamily: "Georgia", fontSize: 22 },
  confirmName: { color: colors.ice, fontFamily: "Georgia", fontSize: 20 },
  permCard: { backgroundColor: "rgba(58,80,118,0.42)", borderColor: colors.line, borderRadius: radii.lg, borderWidth: 1, marginTop: 18, padding: 16 },
  permHead: { color: colors.gold, fontSize: 12, fontWeight: "700", letterSpacing: 0.5 },
  permItem: { color: colors.textSoft, fontSize: 13, lineHeight: 20, marginTop: 4 },
  modalScrim: { alignItems: "center", backgroundColor: "rgba(4,10,20,0.6)", flex: 1, justifyContent: "center", padding: 28 },
  checkinCard: { alignItems: "center", backgroundColor: "rgba(30,44,70,0.98)", borderColor: colors.line, borderRadius: 24, borderWidth: 1, gap: 6, padding: 24, width: "100%" },
  checkinTitle: { color: colors.ice, fontFamily: "Georgia", fontSize: 20, marginTop: 6 },
  checkinBody: { color: colors.textSoft, fontSize: 14, textAlign: "center" },
  checkinFoot: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 14, textAlign: "center" },
  confirmDialog: { backgroundColor: "rgba(30,44,70,0.98)", borderColor: colors.line, borderRadius: 22, borderWidth: 1, padding: 22, width: "100%" },
  dialogTitle: { color: colors.ice, fontFamily: "Georgia", fontSize: 18, textAlign: "center" },
  dialogBody: { color: colors.textSoft, fontSize: 13, lineHeight: 19, marginTop: 8, textAlign: "center" },
  endBtn: { alignItems: "center", borderColor: "rgba(139,147,212,0.5)", borderRadius: 15, borderWidth: 1, justifyContent: "center", marginTop: 18, minHeight: 48 },
  endBtnText: { color: "#C4C9F2", fontSize: 14.5, fontWeight: "700" }
});
