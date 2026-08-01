import ArrowLeft from "lucide-react-native/icons/arrow-left";
import RefreshCw from "lucide-react-native/icons/refresh-cw";
import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { loadSupabaseAccountState, type SupabaseAccountState } from "../services/accountState";
import { getSupabaseClient } from "../services/supabase";
import { colors, radii, spacing } from "../theme/tokens";
import { resolveProfileFounderTestBoundary } from "./profileFounderTestBoundary";

type ExpectedMode = "timed" | "no_time";
type LoadState = { status: "idle" | "loading" | "signed_out" | "error" } | { status: "loaded"; account: SupabaseAccountState };

export function FounderProfileTestPanel({ onBack }: { onBack: () => void }) {
  const boundary = resolveProfileFounderTestBoundary({
    enabledFlag: process.env.EXPO_PUBLIC_PROFILE_FOUNDER_TEST,
    deploymentReady: process.env.EXPO_PUBLIC_PROFILE_STAGING_DEPLOYMENT_READY,
    functionSha256: process.env.EXPO_PUBLIC_PROFILE_FUNCTION_SHA256,
    functionVersion: process.env.EXPO_PUBLIC_PROFILE_FUNCTION_VERSION,
    isDevelopment: __DEV__,
    projectRef: process.env.EXPO_PUBLIC_SUPABASE_PROJECT_REF,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
  });
  const [expectedMode, setExpectedMode] = useState<ExpectedMode>("timed");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<LoadState>({ status: "idle" });
  const [historyObserved, setHistoryObserved] = useState(false);
  const [rlsObserved, setRlsObserved] = useState(false);

  useEffect(() => {
    if (boundary.enabled) void reload();
  }, [boundary.enabled]);

  async function reload() {
    const supabase = getSupabaseClient();
    if (!supabase || !boundary.enabled) return;
    setState({ status: "loading" });
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        setState({ status: "signed_out" });
        return;
      }
      const account = await loadSupabaseAccountState(data.session.user.id);
      setState({ status: "loaded", account });
    } catch {
      setState({ status: "error" });
    }
  }

  async function signIn() {
    const supabase = getSupabaseClient();
    if (!supabase || !email.trim() || !password) return;
    const transientPassword = password;
    setPassword("");
    setState({ status: "loading" });
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: transientPassword });
    setEmail("");
    if (error) {
      setState({ status: "signed_out" });
      return;
    }
    setHistoryObserved(false);
    setRlsObserved(false);
    await reload();
  }

  async function switchAccount() {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setState({ status: "loading" });
    const { error } = await supabase.auth.signOut();
    setEmail("");
    setPassword("");
    setHistoryObserved(false);
    setRlsObserved(false);
    setState({ status: error ? "error" : "signed_out" });
  }

  if (!boundary.enabled) {
    return <Shell onBack={onBack} title="Profile staging test"><Notice title="Not Ready" body={safeBoundaryMessage(boundary.code)} /></Shell>;
  }

  const account = state.status === "loaded" ? state.account : null;
  const observedMode = account?.status === "loaded" ? (account.profileData?.timeUnknown ? "no_time" : "timed") : null;
  const modeMatches = observedMode === expectedMode;

  return (
    <Shell onBack={onBack} title="Profile staging test">
      <Text style={styles.note}>Real disposable staging accounts only · Profile function v{boundary.functionVersion}</Text>
      <ModeSelector value={expectedMode} onChange={(value) => { setExpectedMode(value); setHistoryObserved(false); setRlsObserved(false); }} />
      {state.status === "signed_out" || state.status === "idle" ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign in to the selected disposable account</Text>
          <TextInput accessibilityLabel="Disposable Profile test email" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" onChangeText={setEmail} placeholder="Disposable email" placeholderTextColor={colors.muted} style={styles.input} value={email} />
          <TextInput accessibilityLabel="Disposable Profile test password" onChangeText={setPassword} placeholder="Password" placeholderTextColor={colors.muted} secureTextEntry style={styles.input} value={password} />
          <Pressable accessibilityRole="button" onPress={() => void signIn()} style={styles.primary}><Text style={styles.primaryText}>Sign in and restore</Text></Pressable>
        </View>
      ) : null}
      {state.status === "loading" ? <View style={styles.loading}><ActivityIndicator color={colors.gold} /><Text style={styles.body}>Restoring the real account...</Text></View> : null}
      {state.status === "error" ? <Notice title="Restore unavailable" body="No evidence was recorded. Retry the authoritative account read or switch accounts." /> : null}
      {account ? (
        <View style={styles.card}>
          <Evidence label="Real account restored" status={account.status === "loaded" ? "confirmed" : "pending"} />
          <Evidence label="Timed/no-time mode matches" status={modeMatches ? "confirmed" : "failed"} />
          <Evidence label="Chart restoration" status={account.status === "loaded" && account.chartProfile ? "confirmed" : "pending"} />
          <Evidence label="PROF-2 historical chart preserved" status={historyObserved ? "confirmed" : "pending"} />
          <Evidence label="Owner read / cross-user denial" status={rlsObserved ? "confirmed" : "pending"} />
          <Text style={styles.body}>{account.status === "empty" ? "Confirmed empty account: complete ordinary onboarding before recording chart evidence." : modeMatches ? expectedMode === "timed" ? "Timed chart restored. Verify houses, ASC and MC in the ordinary chart screen." : "No-time chart restored. Verify houses, ASC and MC remain absent." : "The restored account does not match the selected test role."}</Text>
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: historyObserved }} onPress={() => setHistoryObserved((value) => !value)} style={styles.secondary}><Text style={styles.secondaryText}>Record observed PROF-2 history check</Text></Pressable>
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: rlsObserved }} onPress={() => setRlsObserved((value) => !value)} style={styles.secondary}><Text style={styles.secondaryText}>Record approved RLS evidence check</Text></Pressable>
        </View>
      ) : null}
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" onPress={() => void reload()} style={styles.secondary}><RefreshCw color={colors.ice} size={17} /><Text style={styles.secondaryText}>Reload authoritative state</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => void switchAccount()} style={styles.secondary}><Text style={styles.secondaryText}>Switch account</Text></Pressable>
      </View>
    </Shell>
  );
}

function Shell({ children, onBack, title }: { children: ReactNode; onBack: () => void; title: string }) {
  return <SafeAreaView style={styles.safe}><KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.safe}><View style={styles.header}><Pressable accessibilityLabel="Back to Founder Test Hub" accessibilityRole="button" onPress={onBack} style={styles.back}><ArrowLeft color={colors.ice} size={20} /></Pressable><Text accessibilityRole="header" style={styles.title}>{title}</Text><View style={styles.spacer} /></View><ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="never" keyboardShouldPersistTaps="handled">{children}</ScrollView></KeyboardAvoidingView></SafeAreaView>;
}
function ModeSelector({ value, onChange }: { value: ExpectedMode; onChange(value: ExpectedMode): void }) { return <View accessibilityRole="radiogroup" style={styles.modeRow}>{(["timed", "no_time"] as const).map((mode) => <Pressable accessibilityRole="radio" accessibilityState={{ selected: value === mode }} key={mode} onPress={() => onChange(mode)} style={[styles.mode, value === mode && styles.modeActive]}><Text style={styles.secondaryText}>{mode === "timed" ? "Timed account" : "Unknown-time account"}</Text></Pressable>)}</View>; }
function Evidence({ label, status }: { label: string; status: "confirmed" | "pending" | "failed" }) { return <View style={styles.evidence}><Text style={styles.body}>{label}</Text><Text accessibilityLabel={`${label}: ${status}`} style={[styles.status, status === "failed" && styles.failed]}>{status === "confirmed" ? "Confirmed" : status === "failed" ? "Mismatch" : "Pending"}</Text></View>; }
function Notice({ title, body }: { title: string; body: string }) { return <View style={styles.card}><Text style={styles.cardTitle}>{title}</Text><Text accessibilityLiveRegion="polite" style={styles.body}>{body}</Text></View>; }
function safeBoundaryMessage(code: string) { return code === "PROFILE_TEST_DEPLOYMENT_REQUIRED" ? "The reviewed Profile function deployment has not been confirmed for this bundle." : code.includes("STAGING") ? "The configured project does not match the approved staging project." : code.includes("FUNCTION") ? "The reviewed Profile function version or checksum is not confirmed." : "This development-only Profile test route is disabled."; }

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.navy950, flex: 1 }, header: { alignItems: "center", borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", minHeight: 64, paddingHorizontal: spacing.lg }, back: { alignItems: "center", height: 44, justifyContent: "center", width: 44 }, title: { color: colors.ice, flex: 1, fontSize: 19, fontWeight: "800", textAlign: "center" }, spacer: { width: 44 }, content: { gap: spacing.md, padding: spacing.lg }, note: { color: colors.goldLight, fontSize: 13, lineHeight: 20 }, card: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radii.sm, borderWidth: 1, gap: spacing.md, padding: spacing.md }, cardTitle: { color: colors.ice, fontSize: 17, fontWeight: "800" }, body: { color: colors.textSoft, flex: 1, fontSize: 14, lineHeight: 21 }, input: { backgroundColor: colors.navy900, borderColor: colors.line, borderRadius: radii.sm, borderWidth: 1, color: colors.ice, minHeight: 50, paddingHorizontal: spacing.md }, primary: { alignItems: "center", backgroundColor: colors.gold, borderRadius: radii.sm, justifyContent: "center", minHeight: 50 }, primaryText: { color: colors.navy950, fontWeight: "800" }, secondary: { alignItems: "center", borderColor: colors.line, borderRadius: radii.sm, borderWidth: 1, flexDirection: "row", gap: spacing.sm, justifyContent: "center", minHeight: 48, paddingHorizontal: spacing.md }, secondaryText: { color: colors.ice, fontWeight: "700" }, loading: { alignItems: "center", flexDirection: "row", gap: spacing.sm }, modeRow: { flexDirection: "row", gap: spacing.sm }, mode: { alignItems: "center", borderColor: colors.line, borderRadius: radii.sm, borderWidth: 1, flex: 1, justifyContent: "center", minHeight: 48 }, modeActive: { borderColor: colors.gold, borderWidth: 2 }, evidence: { alignItems: "center", borderBottomColor: colors.lineSoft, borderBottomWidth: 1, flexDirection: "row", gap: spacing.sm, minHeight: 44 }, status: { color: colors.goldLight, fontSize: 12, fontWeight: "800" }, failed: { color: colors.warnSolid }, actions: { gap: spacing.sm },
});
