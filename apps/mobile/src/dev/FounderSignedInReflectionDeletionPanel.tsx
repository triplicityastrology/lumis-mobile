import { randomUUID } from "expo-crypto";
import RefreshCw from "lucide-react-native/icons/refresh-cw";
import Trash2 from "lucide-react-native/icons/trash-2";
import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { loadSupabaseAccountState, type RestoredReflectionThread } from "../services/accountState";
import { deleteOwnedReflection } from "../services/reflections";
import { getSupabaseClient } from "../services/supabase";
import { colors, radii, spacing } from "../theme/tokens";
import { resolveReflectionFounderTestBoundary } from "./reflectionFounderTestBoundary";

type Role = "owner" | "cross_owner";
type SessionState = "signed_out" | "loading" | "ready" | "error";
type Target = { id: string; requestId: string };

export function FounderSignedInReflectionDeletionPanel() {
  const boundary = resolveReflectionFounderTestBoundary({
    enabledFlag: process.env.EXPO_PUBLIC_REFLECTION_FOUNDER_TEST,
    deploymentReady: process.env.EXPO_PUBLIC_REFLECTION_0036_READY,
    isDevelopment: __DEV__,
    migrationSha256: process.env.EXPO_PUBLIC_REFLECTION_0036_SHA256,
    remoteMigrationVersion: process.env.EXPO_PUBLIC_REFLECTION_REMOTE_VERSION,
    projectRef: process.env.EXPO_PUBLIC_SUPABASE_PROJECT_REF,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
  });
  const [role, setRole] = useState<Role>("owner");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [session, setSession] = useState<SessionState>("signed_out");
  const [target, setTarget] = useState<Target | null>(null);
  const [targetAvailable, setTargetAvailable] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [failure, setFailure] = useState(false);
  const [crossDenied, setCrossDenied] = useState(false);
  const [ownerDeleted, setOwnerDeleted] = useState(false);

  if (!boundary.enabled) return <Notice title="Signed-in test Not Ready" body={safeBoundaryMessage(boundary.code)} />;

  async function signIn() {
    const supabase = getSupabaseClient();
    if (!supabase || !email.trim() || !password) return;
    const transient = password;
    setPassword("");
    setSession("loading");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: transient });
    setEmail("");
    if (error) { setSession("signed_out"); return; }
    await refresh();
  }

  async function refresh() {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setSession("loading");
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) { setSession("signed_out"); return; }
      const account = await loadSupabaseAccountState(data.session.user.id);
      const fixture = account.reflectionThreads.find(isTaggedTarget);
      setTargetAvailable(Boolean(fixture));
      if (role === "owner" && fixture && !target) setTarget({ id: fixture.id, requestId: randomUUID() });
      setSession("ready");
    } catch { setSession("error"); }
  }

  async function switchAccount(nextRole: Role) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setSession("loading");
    const { error } = await supabase.auth.signOut();
    setEmail(""); setPassword(""); setDialogOpen(false); setFailure(false); setTargetAvailable(false);
    if (!error) setRole(nextRole);
    setSession(error ? "error" : "signed_out");
  }

  async function submitDeletion() {
    if (!target || session !== "ready") return;
    setSession("loading");
    const result = await deleteOwnedReflection({ threadId: target.id, clientRequestId: target.requestId });
    if (role === "cross_owner") {
      const denied = !result.ok && (result.code === "NOT_FOUND" || result.code === "AUTH_REQUIRED");
      setCrossDenied(denied); setFailure(!denied); setDialogOpen(false); setSession("ready"); return;
    }
    if (result.ok) {
      setOwnerDeleted(true); setFailure(false); setDialogOpen(false); setTargetAvailable(false); setSession("ready"); return;
    }
    setFailure(true); setDialogOpen(true); setSession("ready");
  }

  return <View style={styles.section}>
    <Text style={styles.eyebrow}>REAL SIGNED-IN STAGING MODE</Text>
    <Text style={styles.body}>Only an S2-T111 tagged disposable target is eligible. No ordinary reflection can be selected.</Text>
    <View style={styles.roleRow}>{(["owner", "cross_owner"] as const).map((item) => <Pressable accessibilityRole="radio" accessibilityState={{ selected: role === item }} key={item} onPress={() => void switchAccount(item)} style={[styles.role, role === item && styles.active]}><Text style={styles.buttonText}>{item === "owner" ? "Owner" : "Cross-owner"}</Text></Pressable>)}</View>
    {session === "signed_out" ? <View style={styles.form}><TextInput accessibilityLabel="Disposable reflection test email" autoCapitalize="none" keyboardType="email-address" onChangeText={setEmail} placeholder="Disposable email" placeholderTextColor={colors.muted} style={styles.input} value={email} /><TextInput accessibilityLabel="Disposable reflection test password" onChangeText={setPassword} placeholder="Password" placeholderTextColor={colors.muted} secureTextEntry style={styles.input} value={password} /><Pressable accessibilityRole="button" onPress={() => void signIn()} style={styles.primary}><Text style={styles.primaryText}>Sign in</Text></Pressable></View> : null}
    {session === "loading" ? <View style={styles.loading}><ActivityIndicator color={colors.gold} /><Text style={styles.body}>Confirming backend outcome...</Text></View> : null}
    {session === "error" ? <Notice title="Staging read unavailable" body="No deletion or evidence was claimed. Retry or switch accounts." /> : null}
    {session === "ready" ? <View style={styles.evidence}>
      <Evidence label="Tagged owner target ready" confirmed={Boolean(target)} />
      <Evidence label="Cross-owner deletion denied" confirmed={crossDenied} />
      <Evidence label="Owner confirmation and deletion" confirmed={ownerDeleted} />
      <Evidence label="Fixture/account cleanup" confirmed={false} />
      <Text style={styles.body}>{role === "owner" ? targetAvailable ? "The tagged disposable target is ready for owner confirmation." : ownerDeleted ? "The target disappeared only after confirmed backend success." : "No eligible tagged target is visible." : "Use the retained opaque target to verify cross-owner denial; no target details are displayed."}</Text>
      <Pressable accessibilityRole="button" onPress={() => void refresh()} style={styles.secondary}><RefreshCw color={colors.ice} size={17} /><Text style={styles.buttonText}>Refresh projections</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={!target} onPress={() => setDialogOpen(true)} style={[styles.danger, !target && styles.disabled]}><Trash2 color={colors.goldLight} size={17} /><Text style={styles.buttonText}>{role === "owner" ? "Delete tagged target" : "Verify cross-owner denial"}</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => void switchAccount(role === "owner" ? "cross_owner" : "owner")} style={styles.secondary}><Text style={styles.buttonText}>Switch to {role === "owner" ? "cross-owner" : "owner"}</Text></Pressable>
    </View> : null}
    <Modal animationType="fade" onRequestClose={() => { setDialogOpen(false); setFailure(false); }} transparent visible={dialogOpen}><View style={styles.overlay}><View accessibilityViewIsModal style={styles.dialog}><Text style={styles.dialogTitle}>{role === "owner" ? "Delete tagged disposable reflection?" : "Verify cross-owner denial?"}</Text><Text style={styles.body}>Only the opaque tagged test target is used. No identifier or content is shown.</Text>{failure ? <Text accessibilityLiveRegion="assertive" style={styles.error}>The operation was not confirmed. The target remains. Retry with the same request or cancel.</Text> : null}<View style={styles.roleRow}><Pressable accessibilityRole="button" onPress={() => { setDialogOpen(false); setFailure(false); }} style={styles.secondary}><Text style={styles.buttonText}>Cancel</Text></Pressable><Pressable accessibilityRole="button" onPress={() => void submitDeletion()} style={styles.primary}><Text style={styles.primaryText}>{failure ? "Retry" : "Confirm"}</Text></Pressable></View></View></View></Modal>
  </View>;
}

function isTaggedTarget(thread: RestoredReflectionThread) { return /^S2T111 target s2t111-[0-9]{8}t[0-9]{6}z-[a-f0-9]{8}$/.test(thread.title); }
function Evidence({ label, confirmed }: { label: string; confirmed: boolean }) { return <View style={styles.evidenceRow}><Text style={styles.body}>{label}</Text><Text style={styles.status}>{confirmed ? "Confirmed" : "Pending"}</Text></View>; }
function Notice({ title, body }: { title: string; body: string }) { return <View style={styles.notice}><Text style={styles.dialogTitle}>{title}</Text><Text accessibilityLiveRegion="polite" style={styles.body}>{body}</Text></View>; }
function safeBoundaryMessage(code: string) { return code.includes("STAGING") ? "The configured project does not match approved staging." : code.includes("DEPLOYMENT") || code.includes("PARITY") || code.includes("CHECKSUM") ? "Migration 0036 deployment parity is not confirmed for this bundle." : "The development-only signed-in deletion route is disabled."; }

const styles = StyleSheet.create({ section: { gap: spacing.md }, eyebrow: { color: colors.goldLight, fontSize: 12, fontWeight: "800" }, body: { color: colors.textSoft, flex: 1, fontSize: 14, lineHeight: 21 }, roleRow: { flexDirection: "row", gap: spacing.sm }, role: { alignItems: "center", borderColor: colors.line, borderRadius: radii.sm, borderWidth: 1, flex: 1, justifyContent: "center", minHeight: 46 }, active: { borderColor: colors.gold, borderWidth: 2 }, buttonText: { color: colors.ice, fontWeight: "700" }, form: { gap: spacing.sm }, input: { backgroundColor: colors.navy900, borderColor: colors.line, borderRadius: radii.sm, borderWidth: 1, color: colors.ice, minHeight: 50, paddingHorizontal: spacing.md }, primary: { alignItems: "center", backgroundColor: colors.gold, borderRadius: radii.sm, flex: 1, justifyContent: "center", minHeight: 48, paddingHorizontal: spacing.md }, primaryText: { color: colors.navy950, fontWeight: "800" }, secondary: { alignItems: "center", borderColor: colors.line, borderRadius: radii.sm, borderWidth: 1, flex: 1, flexDirection: "row", gap: spacing.sm, justifyContent: "center", minHeight: 48, paddingHorizontal: spacing.md }, danger: { alignItems: "center", borderColor: colors.goldLight, borderRadius: radii.sm, borderWidth: 1, flexDirection: "row", gap: spacing.sm, justifyContent: "center", minHeight: 48 }, disabled: { opacity: 0.45 }, loading: { alignItems: "center", flexDirection: "row", gap: spacing.sm }, evidence: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radii.sm, borderWidth: 1, gap: spacing.sm, padding: spacing.md }, evidenceRow: { alignItems: "center", borderBottomColor: colors.lineSoft, borderBottomWidth: 1, flexDirection: "row", minHeight: 42 }, status: { color: colors.goldLight, fontSize: 12, fontWeight: "800" }, overlay: { alignItems: "center", backgroundColor: "rgba(3, 10, 20, 0.8)", flex: 1, justifyContent: "center", padding: spacing.lg }, dialog: { backgroundColor: colors.navy900, borderColor: colors.line, borderRadius: radii.sm, borderWidth: 1, gap: spacing.md, maxWidth: 420, padding: spacing.lg, width: "100%" }, dialogTitle: { color: colors.ice, fontSize: 18, fontWeight: "800" }, error: { color: colors.goldLight, fontSize: 14, lineHeight: 21 }, notice: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radii.sm, borderWidth: 1, gap: spacing.sm, padding: spacing.md } });
