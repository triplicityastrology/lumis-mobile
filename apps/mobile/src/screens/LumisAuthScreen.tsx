import Check from "lucide-react-native/icons/check";
import ChevronLeft from "lucide-react-native/icons/chevron-left";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import LockKeyhole from "lucide-react-native/icons/lock-keyhole";
import Mail from "lucide-react-native/icons/mail";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import type { AppLanguagePreference } from "@lumis/shared";

import { MagicLinkSentScreen } from "../components/AuthSystemKit";
import { LanguageToggle } from "../components/AuthWelcomeKit";
import { FlowScreen, flowStyles } from "../components/FlowScreen";
import { getAuthStatus, sendMagicLink, type AuthStatus } from "../services/auth";
import { safeUserErrorMessage } from "../services/userFacingErrors";
import { ink, type } from "../theme/typography";
import { colors, radii } from "../theme/tokens";

/* Simple provider marks. Real Apple/Google brand assets are required for
 * production; these placeholders exist only so the approved buttons render while
 * provider auth is not wired (pressing them is truthful about that). */
function AppleGlyph({ color = "#000" }: { color?: string }) {
  return (
    <Svg width={18} height={20} viewBox="0 0 24 26" accessibilityElementsHidden importantForAccessibility="no">
      <Path
        d="M17.5 13.6c0-2.6 2.1-3.9 2.2-3.9-1.2-1.8-3.1-2-3.8-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.3-.9-1.7 0-3.3 1-4.2 2.5-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8 1.5 0 2 .8 3.3.8 1.4 0 2.3-1.3 3.1-2.5.6-.9.9-1.4 1.4-2.4-3.6-1.4-3.9-4.4-3.9-4.1Z"
        fill={color}
      />
      <Path d="M15.2 4.9c.7-.9 1.2-2.1 1.1-3.3-1 0-2.3.7-3 1.6-.7.8-1.3 2-1.1 3.2 1.1.1 2.3-.6 3-1.5Z" fill={color} />
    </Svg>
  );
}
function GoogleGlyph() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      <Path d="M21.6 12.2c0-.7-.1-1.3-.2-1.9H12v3.7h5.4c-.2 1.2-.9 2.3-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3Z" fill="#4285F4" />
      <Path d="M12 22c2.7 0 5-.9 6.6-2.5l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.7-5.6-4.1H3.1v2.6C4.7 19.9 8.1 22 12 22Z" fill="#34A853" />
      <Path d="M6.4 13.9c-.2-.6-.3-1.2-.3-1.9s.1-1.3.3-1.9V7.5H3.1C2.4 8.9 2 10.4 2 12s.4 3.1 1.1 4.5l3.3-2.6Z" fill="#FBBC05" />
      <Path d="M12 6c1.5 0 2.8.5 3.8 1.5l2.8-2.8C16.9 3.1 14.7 2 12 2 8.1 2 4.7 4.1 3.1 7.5l3.3 2.6C7.2 7.7 9.4 6 12 6Z" fill="#EA4335" />
    </Svg>
  );
}

export function LumisAuthScreen({
  authError,
  authNotice,
  authStatus,
  appLanguage,
  onSetLanguage,
  onAccountStatusRefreshed,
  onBack,
  onClearAuthError,
  onRequestLogout
}: {
  authError: string;
  authNotice: string;
  authStatus: AuthStatus | null;
  appLanguage?: AppLanguagePreference | null;
  onSetLanguage?: (next: AppLanguagePreference) => void;
  onAccountStatusRefreshed: (status: AuthStatus) => Promise<void>;
  onBack: () => void;
  onClearAuthError: () => void;
  onContinueLocal: () => void;
  onRequestLogout: () => void;
}) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sentToEmail, setSentToEmail] = useState<string | null>(null);
  // AUTH-001 is the provider-selection screen; "Continue with email" opens the
  // magic-link email step in place.
  const [mode, setMode] = useState<"providers" | "email">("providers");

  async function refreshAccount(messageText: string) {
    const status = await getAuthStatus();
    await onAccountStatusRefreshed(status);
    setMessage(messageText);
  }

  async function sendLink() {
    const cleanedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }
    setIsSubmitting(true);
    setError("");
    setMessage("");
    onClearAuthError();
    try {
      await sendMagicLink(cleanedEmail);
      setSentToEmail(cleanedEmail);
    } catch (caught) {
      setError(safeUserErrorMessage(caught, "auth_send"));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function resendLink() {
    if (!sentToEmail) return;
    await sendMagicLink(sentToEmail);
  }

  // Truthful: provider auth is not wired in this build. Do not fabricate success.
  function providerUnavailable(provider: "Apple" | "Google") {
    Alert.alert(
      `${provider} sign-in`,
      `${provider} sign-in isn't available in this build yet. Use “Continue with email” to save your space.`
    );
  }

  if (sentToEmail) {
    return (
      <MagicLinkSentScreen
        email={sentToEmail}
        errorMessage={authError}
        onResend={resendLink}
        onChangeEmail={() => {
          setSentToEmail(null);
          setMessage("");
          onClearAuthError();
        }}
      />
    );
  }

  // Signed-in account view (account management — not the AUTH-001 sign-up screen).
  if (authStatus?.user) {
    return (
      <FlowScreen edges={["bottom"]} badge="SECURE ACCOUNT" body="Your active chart and Past Reflections are restored on this account." eyebrow="PRIVATE BY DESIGN" onBack={onBack} title="Your Lumis account">
        <View style={styles.accountCard}>
          <View style={styles.check}><Check color={colors.navy950} size={18} strokeWidth={3} /></View>
          <View style={styles.flex}>
            <Text style={styles.accountLabel}>SIGNED IN</Text>
            <Text style={styles.accountEmail}>{authStatus.user.email}</Text>
          </View>
        </View>
        {authNotice || message ? (
          <View accessibilityLiveRegion="polite" accessibilityRole="text" style={flowStyles.success}>
            <Text style={flowStyles.successTitle}>Account update</Text>
            <Text style={flowStyles.message}>{message || authNotice}</Text>
          </View>
        ) : null}
        <Pressable style={flowStyles.primaryButton} onPress={onRequestLogout} accessibilityRole="button" accessibilityLabel="Log out">
          <Text style={flowStyles.primaryButtonText}>Log out</Text>
        </Pressable>
        <Pressable style={flowStyles.secondaryButton} onPress={() => refreshAccount("Account reloaded.")} accessibilityRole="button">
          <Text style={flowStyles.secondaryButtonText}>Reload account</Text>
        </Pressable>
      </FlowScreen>
    );
  }

  // Email step (magic link) — reached from "Continue with email".
  if (mode === "email") {
    return (
      <FlowScreen edges={["bottom"]} badge="PRIVATE BY DESIGN" body="We'll email you a secure sign-in link. No password is needed." eyebrow="CONTINUE WITH EMAIL" onBack={() => { setMode("providers"); setError(""); }} title="Sign in with email">
        <View style={flowStyles.field}>
          <Text style={flowStyles.fieldLabel}>EMAIL ADDRESS</Text>
          <View style={styles.emailField}>
            <Mail color={colors.muted} size={18} />
            <TextInput
              accessibilityLabel="Email address"
              style={styles.emailInput}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              onSubmitEditing={() => void sendLink()}
              returnKeyType="send"
              textContentType="emailAddress"
            />
          </View>
        </View>
        <View style={flowStyles.note}>
          <LockKeyhole color={colors.gold} size={17} />
          <Text style={flowStyles.noteText}>Your birth chart and reflections remain linked to your private account.</Text>
        </View>
        {error || authError ? (
          <View style={flowStyles.error} accessibilityRole="alert" accessibilityLiveRegion="assertive">
            <Text style={flowStyles.errorText}>{error || authError}</Text>
          </View>
        ) : null}
        <Pressable style={[flowStyles.primaryButton, isSubmitting && flowStyles.disabled]} disabled={isSubmitting} onPress={sendLink} accessibilityRole="button" accessibilityLabel="Send secure link">
          <Text style={flowStyles.primaryButtonText}>{isSubmitting ? "Please wait..." : "Send secure link"}</Text>
          <ChevronRight color={colors.navy950} size={19} />
        </Pressable>
      </FlowScreen>
    );
  }

  // AUTH-001 — provider selection. App.tsx owns the persistent top/left/right
  // inset for screen === "auth"; this screen owns only the bottom inset (single
  // top-safe-area owner — no double header offset on notched iPhones).
  return (
    <SafeAreaView edges={["bottom"]} style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" style={styles.backButton} hitSlop={8}>
          <ChevronLeft color={colors.ice} size={20} />
        </Pressable>
        <LanguageToggle value={appLanguage ?? "en"} onChange={(next) => onSetLanguage?.(next)} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>✦ CREATE YOUR ACCOUNT</Text>
        <Text style={styles.title}>Create your safe space.</Text>
        <Text style={styles.sub}>One account to sync your charts and private reflections.</Text>

        <View style={styles.providers}>
          {/* Apple — white pill, black text (Apple HIG; not the gold gradient). */}
          <Pressable onPress={() => providerUnavailable("Apple")} accessibilityRole="button" accessibilityLabel="Continue with Apple" style={styles.appleButton}>
            <AppleGlyph color="#000" />
            <Text style={styles.appleLabel}>Continue with Apple</Text>
          </Pressable>
          {/* Google — glass surface (brand rules; not the gold gradient). */}
          <Pressable onPress={() => providerUnavailable("Google")} accessibilityRole="button" accessibilityLabel="Continue with Google" style={styles.glassButton}>
            <GoogleGlyph />
            <Text style={styles.glassLabel}>Continue with Google</Text>
          </Pressable>

          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>or</Text>
            <View style={styles.orLine} />
          </View>

          {/* Email — glass; opens the magic-link step. Fully working. */}
          <Pressable onPress={() => { setMode("email"); setError(""); }} accessibilityRole="button" accessibilityLabel="Continue with email" style={styles.glassButton}>
            <Mail color="#F0F4F8" size={18} />
            <Text style={styles.glassLabel}>Continue with email</Text>
          </Pressable>
        </View>

        <View style={styles.privacyCard}>
          <LockKeyhole color="#E5C06B" size={17} />
          <Text style={styles.privacyText}>Your birth data and conversations stay strictly private. You can delete your space anytime.</Text>
        </View>

        <Text style={styles.legal}>By continuing you agree to our <Text style={styles.legalLink}>Terms</Text> and <Text style={styles.legalLink}>Privacy Policy</Text>.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const GLASS = "rgba(58,80,118,0.42)";
const GLASS_LINE = "rgba(255,255,255,0.14)";

const styles = StyleSheet.create({
  safe: { backgroundColor: "transparent", flex: 1 },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 22, paddingVertical: 8 },
  backButton: { alignItems: "center", backgroundColor: GLASS, borderColor: GLASS_LINE, borderRadius: 20, borderWidth: 1, height: 40, justifyContent: "center", width: 40 },
  content: { paddingBottom: 28, paddingHorizontal: 26, paddingTop: 18 },
  eyebrow: { color: "#E9B083", fontSize: 11, fontWeight: "700", letterSpacing: 1.5, marginBottom: 12, textTransform: "uppercase" },
  title: { ...type.screenTitle, marginBottom: 10 },
  sub: { ...type.bodyLarge, marginBottom: 26, maxWidth: 340 },
  providers: { gap: 12 },
  appleButton: { alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 999, flexDirection: "row", gap: 10, justifyContent: "center", minHeight: 56 },
  appleLabel: { color: "#000000", fontFamily: type.buttonLabel.fontFamily, fontSize: 15.5, fontWeight: "700" },
  glassButton: { alignItems: "center", backgroundColor: GLASS, borderColor: GLASS_LINE, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 10, justifyContent: "center", minHeight: 56 },
  glassLabel: { color: "#F0F4F8", fontFamily: type.buttonLabel.fontFamily, fontSize: 15.5, fontWeight: "700" },
  orRow: { alignItems: "center", flexDirection: "row", gap: 12, paddingVertical: 2 },
  orLine: { backgroundColor: GLASS_LINE, flex: 1, height: 1 },
  orText: { color: ink.muted, fontSize: 12 },
  privacyCard: { alignItems: "flex-start", backgroundColor: GLASS, borderColor: GLASS_LINE, borderRadius: 18, borderWidth: 1, flexDirection: "row", gap: 11, marginTop: 22, paddingHorizontal: 16, paddingVertical: 14 },
  privacyText: { ...type.bodySmall, color: ink.soft, flex: 1, lineHeight: 18 },
  legal: { color: ink.muted, fontSize: 12, lineHeight: 18, marginTop: 20, textAlign: "center" },
  legalLink: { color: colors.periwinkle },
  accountCard: { alignItems: "center", backgroundColor: GLASS, borderColor: colors.line, borderRadius: radii.md, borderWidth: 1, flexDirection: "row", gap: 12, minHeight: 70, padding: 14 },
  check: { alignItems: "center", backgroundColor: colors.good, borderRadius: 18, height: 36, justifyContent: "center", width: 36 },
  flex: { flex: 1, minWidth: 0 },
  accountLabel: { color: colors.good, fontSize: 9, fontWeight: "700", letterSpacing: 1.3 },
  accountEmail: { color: colors.ice, fontSize: 13.5, marginTop: 4 },
  emailField: { alignItems: "center", backgroundColor: GLASS, borderColor: colors.line, borderRadius: radii.md, borderWidth: 1, flexDirection: "row", gap: 10, minHeight: 52, paddingHorizontal: 15 },
  emailInput: { color: colors.ice, flex: 1, fontSize: 15.5, minWidth: 0, outlineStyle: "none" } as never
});
