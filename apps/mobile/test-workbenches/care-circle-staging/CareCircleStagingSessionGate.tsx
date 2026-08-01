import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  BackHandler,
  KeyboardAvoidingView,
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

type SessionView =
  | { status: "loading" }
  | { status: "signed_out" }
  | { status: "signed_in"; capabilities: WorkbenchCapabilities }
  | { status: "error" };

export function CareCircleStagingSessionGate({
  children,
  sessionPort,
}: {
  children: (capabilities: WorkbenchCapabilities) => ReactNode;
  sessionPort: WorkbenchSessionPort;
}) {
  const sessionFlight = useRef(createWorkbenchSingleFlight()).current;
  const [session, setSession] = useState<SessionView>({ status: "loading" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
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
        <View style={styles.sessionBar}>
          <View style={styles.sessionCopy}>
            <Text style={styles.sessionTitle}>
              Authenticated disposable staging session
            </Text>
            <Text style={styles.sessionMeta}>
              Caree {session.capabilities.canActAsCaree ? "enabled" : "blocked"}
              {" · "}
              Carer {session.capabilities.canActAsCarer ? "enabled" : "blocked"}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void signOut()}
            style={[styles.signOut, busy && styles.disabled]}
          >
            <Text style={styles.secondaryText}>
              {busy ? "Signing out..." : "Switch account"}
            </Text>
          </Pressable>
        </View>
        {notice ? (
          <Text accessibilityLiveRegion="assertive" style={styles.signedInNotice}>
            {notice}
          </Text>
        ) : null}
        <View style={styles.workbench}>
          {children(session.capabilities)}
        </View>
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
        <Text style={styles.eyebrow}>STAGING TEST WORKBENCH</Text>
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy950 },
  signedIn: { flex: 1, backgroundColor: colors.navy950 },
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
