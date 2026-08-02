import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  BackHandler,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, spacing } from "../../src/theme/tokens";
import type {
  WorkbenchCapabilities,
  WorkbenchSessionPort,
} from "./stagingWorkbenchPort";
import { resolveWorkbenchProgress } from "./workbenchProgress";
import { resolveWorkbenchRecovery } from "./workbenchRecovery";
import {
  createWorkbenchSingleFlight,
  resolveWorkbenchBackAction,
} from "./workbenchDeviceSafety";
import {
  advanceSinglePhoneJourney,
  createSinglePhoneJourney,
} from "./singlePhoneJourney";
import type { JourneyConfirmationSource } from "./singlePhoneJourney";
import type { WorkbenchProgressName } from "./workbenchProgress";
import {
  buildSelectableWorkbenchSummary,
  createWorkbenchEvidenceSummary,
  listWorkbenchEvidence,
  recordConfirmedWorkbenchEvidence,
  recordConfirmedCodeCopy,
} from "./workbenchEvidenceSummary";

type SessionView =
  | { status: "loading" }
  | { status: "signed_out" }
  | { status: "signed_in"; capabilities: WorkbenchCapabilities }
  | { status: "error" };

export function CareCircleStagingSessionGate({
  children,
  sessionPort,
}: {
  children: (
    capabilities: WorkbenchCapabilities,
    journeyPort: {
      onEvidenceState(input: {
        accountRole: "caree" | "carer";
        evidenceName: WorkbenchProgressName;
        confirmationSource: JourneyConfirmationSource;
      }): void;
      onCodeCopied(): void;
    }
  ) => ReactNode;
  sessionPort: WorkbenchSessionPort;
}) {
  const sessionFlight = useRef(createWorkbenchSingleFlight()).current;
  const [session, setSession] = useState<SessionView>({ status: "loading" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [sessionEpoch, setSessionEpoch] = useState(0);
  const [flow, setFlow] = useState(() => ({
    journey: createSinglePhoneJourney(),
    evidence: createWorkbenchEvidenceSummary(),
  }));
  const [summaryVisible, setSummaryVisible] = useState(false);
  const [testPanelVisible, setTestPanelVisible] = useState(false);
  const signedOutProgress = resolveWorkbenchProgress({ authenticated: false });

  useEffect(() => {
    void refreshSession();
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        const action = resolveWorkbenchBackAction({
          busy: sessionFlight.isActive(),
          hasTransientInput: email.length > 0 || password.length > 0,
        });
        if (action === "block_busy") return true;
        if (action === "clear_transient_input") {
          setEmail("");
          setPassword("");
          return true;
        }
        return false;
      }
    );
    return () => subscription.remove();
  }, [email, password, sessionFlight]);

  async function refreshSession() {
    if (!sessionFlight.enter()) return;
    setSession({ status: "loading" });
    setNotice(null);
    try {
      const result = await sessionPort.readSession();
      setSession(
        result.authenticated
          ? { status: "signed_in", capabilities: result.capabilities }
          : { status: "signed_out" }
      );
    } catch {
      const recovery = resolveWorkbenchRecovery({ kind: "session_check" });
      setSession({ status: "error" });
      setNotice(recovery.message);
    } finally {
      sessionFlight.leave();
    }
  }

  async function signIn() {
    if (!sessionFlight.enter()) return;
    const transientPassword = password;
    setPassword("");
    setBusy(true);
    setNotice(null);
    try {
      await sessionPort.signIn({ email, password: transientPassword });
      setEmail("");
      const result = await sessionPort.readSession();
      setSession(
        result.authenticated
          ? { status: "signed_in", capabilities: result.capabilities }
          : { status: "signed_out" }
      );
      if (result.authenticated) setSessionEpoch((value) => value + 1);
    } catch {
      const recovery = resolveWorkbenchRecovery({ kind: "sign_in" });
      setSession({ status: "signed_out" });
      setNotice(recovery.message);
    } finally {
      sessionFlight.leave();
      setBusy(false);
    }
  }

  async function signOut() {
    if (!sessionFlight.enter()) return;
    setBusy(true);
    setNotice(null);
    try {
      await sessionPort.signOut();
      setSession({ status: "signed_out" });
      setEmail("");
      setPassword("");
      setSessionEpoch((value) => value + 1);
    } catch {
      setNotice(
        "Sign-out failed. The current staging session remains active."
      );
    } finally {
      sessionFlight.leave();
      setBusy(false);
    }
  }

  if (session.status === "signed_in") {
    return (
      <View style={styles.signedIn}>
        <View key={sessionEpoch} style={styles.workbench}>
          {children(session.capabilities, {
            onEvidenceState(input) {
              setFlow((current) => ({
                journey: advanceSinglePhoneJourney(current.journey, input),
                evidence: recordConfirmedWorkbenchEvidence(current.evidence, {
                  journeyStage: current.journey.stage,
                  ...input,
                }),
              }));
            },
            onCodeCopied() {
              setFlow((current) => ({
                ...current,
                evidence: recordConfirmedCodeCopy(current.evidence),
              }));
            },
          })}
        </View>
        <Pressable
          accessibilityLabel="Open staging Care Circle test controls"
          accessibilityRole="button"
          onPress={() => setTestPanelVisible(true)}
          style={styles.testPill}
        >
          <Text style={styles.testPillText}>
            FOUNDER TEST · {session.capabilities.accountRole.toUpperCase()}
          </Text>
        </Pressable>
        <Modal
          animationType="fade"
          onRequestClose={() => setTestPanelVisible(false)}
          transparent
          visible={testPanelVisible}
        >
          <View style={styles.scrim}>
            <View style={styles.testPanel}>
              <Text accessibilityRole="header" style={styles.testPanelTitle}>
                Founder test controls
              </Text>
              <Text style={styles.sessionMeta}>
                Current: {flow.journey.label}
              </Text>
              <Text style={styles.sessionMeta}>
                Next: {flow.journey.nextLabel}
              </Text>
              {notice ? (
                <Text accessibilityLiveRegion="assertive" style={styles.signedInNotice}>
                  {notice}
                </Text>
              ) : null}
              <EvidenceSummary
                buildMarker={process.env.EXPO_PUBLIC_LUMIS_SOURCE_COMMIT}
                evidence={flow.evidence}
                onReset={() => {
                  setSummaryVisible(false);
                  setFlow({
                    journey: createSinglePhoneJourney(),
                    evidence: createWorkbenchEvidenceSummary(),
                  });
                }}
                onTogglePreview={() => setSummaryVisible((value) => !value)}
                summaryVisible={summaryVisible}
              />
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => void signOut()}
                style={[styles.secondary, busy && styles.disabled]}
              >
                <Text style={styles.secondaryText}>
                  {busy ? "Signing out..." : "Switch account"}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => setTestPanelVisible(false)}
                style={styles.secondary}
              >
                <Text style={styles.secondaryText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.safe}
      >
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="never"
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.eyebrow}>DISPOSABLE STAGING SIGN-IN</Text>
        <Text style={styles.title}>Disposable account sign-in</Text>
        <Text style={styles.body}>
          Use only a disposable staging account created for Care Circle
          validation. This creates a real staging session, not a demo account.
        </Text>

        {session.status === "signed_out" ? (
          <View
            accessibilityLabel={`Care Circle test progress: ${signedOutProgress.label}. ${signedOutProgress.guidance}`}
            style={styles.progress}
          >
            <Text style={styles.progressTitle}>{signedOutProgress.label}</Text>
            <Text style={styles.progressText}>{signedOutProgress.guidance}</Text>
            <Text style={styles.progressEvidence}>
              Evidence state: {signedOutProgress.evidenceName}
            </Text>
          </View>
        ) : null}

        {notice ? (
          <Text accessibilityLiveRegion="assertive" style={styles.notice}>
            {notice}
          </Text>
        ) : null}

        {session.status === "loading" ? (
          <Text accessibilityLiveRegion="polite" style={styles.body}>
            Checking the staging session...
          </Text>
        ) : session.status === "error" ? (
          <Pressable
            accessibilityLabel="Retry staging session check"
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void refreshSession()}
            style={[styles.action, busy && styles.disabled]}
          >
            <Text style={styles.actionText}>Retry session check</Text>
          </Pressable>
        ) : (
          <>
            <TextInput
              accessibilityLabel="Disposable staging email"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              editable={!busy}
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="Disposable staging email"
              placeholderTextColor={colors.muted}
              style={styles.input}
              value={email}
            />
            <TextInput
              accessibilityLabel="Disposable staging password"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!busy}
              onChangeText={setPassword}
              placeholder="Disposable staging password"
              placeholderTextColor={colors.muted}
              secureTextEntry
              style={styles.input}
              value={password}
            />
            <Pressable
              accessibilityLabel="Sign in to staging"
              accessibilityRole="button"
              accessibilityState={{ disabled: busy || !email.trim() || !password }}
              disabled={busy || !email.trim() || !password}
              onPress={() => void signIn()}
              style={[
                styles.action,
                (busy || !email.trim() || !password) && styles.disabled,
              ]}
            >
              <Text style={styles.actionText}>
                {busy ? "Signing in..." : "Sign in to staging"}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => void refreshSession()}
              style={[styles.secondary, busy && styles.disabled]}
            >
              <Text style={styles.secondaryText}>Check existing session</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function EvidenceSummary({
  buildMarker,
  evidence,
  onReset,
  onTogglePreview,
  summaryVisible,
}: {
  buildMarker: string | undefined;
  evidence: ReturnType<typeof createWorkbenchEvidenceSummary>;
  onReset: () => void;
  onTogglePreview: () => void;
  summaryVisible: boolean;
}) {
  const items = listWorkbenchEvidence(evidence);
  const confirmed = items.filter((item) => item.confirmed).length;
  const selectableSummary = buildSelectableWorkbenchSummary({
    buildMarker,
    evidence,
  });
  return (
    <View
      accessibilityLabel={`Founder evidence summary. ${confirmed} of ${items.length} checks confirmed.`}
      style={styles.evidenceSummary}
    >
      <View style={styles.evidenceHeader}>
        <View style={styles.sessionCopy}>
          <Text style={styles.evidenceTitle}>Founder evidence summary</Text>
          <Text style={styles.sessionMeta}>
            Confirmed participant-safe outcomes only
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Reset Care Circle evidence"
          accessibilityRole="button"
          onPress={onReset}
          style={styles.resetEvidence}
        >
          <Text style={styles.secondaryText}>Reset Evidence</Text>
        </Pressable>
      </View>
      {items.map((item) => (
        <Text
          accessibilityLabel={`${item.label}: ${item.confirmed ? "confirmed" : "not confirmed"}`}
          key={item.name}
          style={item.confirmed ? styles.evidenceConfirmed : styles.evidencePending}
        >
          {item.confirmed ? "Confirmed" : "Not confirmed"} · {item.label}
        </Text>
      ))}
      <Pressable
        accessibilityLabel={summaryVisible ? "Hide selectable test summary" : "Preview selectable test summary"}
        accessibilityRole="button"
        onPress={onTogglePreview}
        style={styles.previewEvidence}
      >
        <Text style={styles.secondaryText}>
          {summaryVisible ? "Hide Summary" : "Preview Test Summary"}
        </Text>
      </Pressable>
      {summaryVisible ? (
        <View style={styles.summaryPreview}>
          <Text style={styles.sessionMeta}>
            Select this closed, redacted summary to copy it manually.
          </Text>
          <Text accessibilityLabel="Selectable redacted Care Circle test summary" selectable style={styles.summaryText}>
            {selectableSummary}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy950 },
  signedIn: { flex: 1, backgroundColor: colors.navy950 },
  testPill: {
    backgroundColor: "rgba(10,35,47,0.94)",
    borderColor: colors.gold,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    position: "absolute",
    right: spacing.md,
    top: 58,
    zIndex: 20,
  },
  testPillText: { color: colors.goldLight, fontSize: 10, fontWeight: "800" },
  scrim: {
    alignItems: "center",
    backgroundColor: "rgba(2,10,18,0.7)",
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg,
  },
  testPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.gold,
    borderRadius: 18,
    borderWidth: 1,
    gap: spacing.sm,
    maxHeight: "88%",
    maxWidth: 420,
    padding: spacing.lg,
    width: "100%",
  },
  testPanelTitle: { color: colors.goldLight, fontSize: 18, fontWeight: "800" },
  sessionBar: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.surface,
  },
  sessionCopy: { flex: 1 },
  sessionTitle: { color: colors.ice, fontSize: 13, fontWeight: "700" },
  sessionMeta: { color: colors.muted, fontSize: 11, marginTop: 3 },
  journeyTitle: { color: colors.gold, fontSize: 12, fontWeight: "700", marginTop: 6 },
  journeyNext: { color: colors.textSoft, fontSize: 11, fontWeight: "700", marginTop: 4 },
  signOut: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  signedInNotice: {
    color: colors.warn,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
  },
  evidenceSummary: {
    backgroundColor: colors.surface,
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  evidenceHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  evidenceTitle: { color: colors.ice, fontSize: 13, fontWeight: "700" },
  evidenceConfirmed: { color: colors.good, fontSize: 11, lineHeight: 18 },
  evidencePending: { color: colors.muted, fontSize: 11, lineHeight: 18 },
  resetEvidence: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
  },
  previewEvidence: {
    alignSelf: "flex-start",
    justifyContent: "center",
    minHeight: 44,
    marginTop: spacing.xs,
  },
  summaryPreview: {
    backgroundColor: colors.navy950,
    borderColor: colors.line,
    borderWidth: 1,
    marginTop: spacing.xs,
    padding: spacing.sm,
  },
  summaryText: {
    color: colors.textSoft,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
    fontSize: 11,
    lineHeight: 17,
    marginTop: spacing.xs,
  },
  workbench: { flex: 1 },
  content: {
    flexGrow: 1,
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    justifyContent: "center",
    padding: spacing.lg,
    gap: 12,
  },
  eyebrow: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  title: { color: colors.ice, fontSize: 26, fontWeight: "700" },
  body: { color: colors.textSoft, fontSize: 14, lineHeight: 20 },
  progress: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    padding: 12,
  },
  progressTitle: { color: colors.ice, fontSize: 15, fontWeight: "800" },
  progressText: { color: colors.textSoft, fontSize: 12, lineHeight: 18 },
  progressEvidence: { color: colors.muted, fontSize: 10 },
  notice: { color: colors.warn, fontSize: 14, lineHeight: 20 },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    color: colors.ice,
    paddingHorizontal: 12,
  },
  action: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: colors.gold,
  },
  actionText: { color: colors.navy950, fontWeight: "800" },
  secondary: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { color: colors.textSoft, fontWeight: "700" },
  disabled: { opacity: 0.45 },
});
