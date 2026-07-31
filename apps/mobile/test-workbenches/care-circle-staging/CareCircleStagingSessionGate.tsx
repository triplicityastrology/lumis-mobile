import { useEffect, useState, type ReactNode } from "react";
import {
  Pressable,
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
  const [session, setSession] = useState<SessionView>({ status: "loading" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void refreshSession();
  }, []);

  async function refreshSession() {
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
      setSession({ status: "error" });
      setNotice(
        "The disposable staging session could not be checked. Try again."
      );
    }
  }

  async function signIn() {
    const transientPassword = password;
    setPassword("");
    setBusy(true);
    setNotice(null);
    try {
      await sessionPort.signIn({ email, password: transientPassword });
      setEmail("");
      await refreshSession();
    } catch {
      setSession({ status: "signed_out" });
      setNotice(
        "Sign-in failed. Check the disposable staging account and try again."
      );
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
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
      <View style={styles.content}>
        <Text style={styles.eyebrow}>STAGING TEST WORKBENCH</Text>
        <Text style={styles.title}>Disposable account sign-in</Text>
        <Text style={styles.body}>
          Use only a disposable staging account created for Care Circle
          validation. This creates a real staging session, not a demo account.
        </Text>

        {notice ? (
          <Text accessibilityLiveRegion="assertive" style={styles.notice}>
            {notice}
          </Text>
        ) : null}

        {session.status === "loading" ? (
          <Text accessibilityLiveRegion="polite" style={styles.body}>
            Checking the staging session...
          </Text>
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
              accessibilityRole="button"
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
      </View>
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
    flex: 1,
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
