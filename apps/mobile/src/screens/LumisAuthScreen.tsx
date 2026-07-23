import Check from "lucide-react-native/icons/check";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import LockKeyhole from "lucide-react-native/icons/lock-keyhole";
import Mail from "lucide-react-native/icons/mail";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { MagicLinkSentScreen } from "../components/AuthSystemKit";
import { FlowScreen, flowStyles } from "../components/FlowScreen";
import { MiniChartWheel } from "../components/MiniChartWheel";
import { getAuthStatus, sendMagicLink, signOut, type AuthStatus } from "../services/auth";
import { colors, radii } from "../theme/tokens";

export function LumisAuthScreen({
  authError,
  authNotice,
  authStatus,
  onAccountStatusRefreshed,
  onBack,
  onClearAuthError,
  onContinueLocal,
  onSignedOut
}: {
  authError: string;
  authNotice: string;
  authStatus: AuthStatus | null;
  onAccountStatusRefreshed: (status: AuthStatus) => Promise<void>;
  onBack: () => void;
  onClearAuthError: () => void;
  onContinueLocal: () => void;
  onSignedOut: () => void;
}) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  // The "Check your inbox" screen (AUTH-002) after a magic link is sent.
  const [sentToEmail, setSentToEmail] = useState<string | null>(null);

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
      setError(caught instanceof Error ? caught.message : "Unable to send your secure link.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function resendLink() {
    if (!sentToEmail) return;
    try {
      await sendMagicLink(sentToEmail);
    } catch {
      // Resend is best-effort; the visible confirmation already shows "Link resent".
    }
  }

  async function handleSignOut() {
    setIsSubmitting(true);
    setError("");
    try {
      await signOut();
      onSignedOut();
      await refreshAccount("Signed out.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to sign out.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (sentToEmail) {
    return (
      <MagicLinkSentScreen
        email={sentToEmail}
        onResend={resendLink}
        onChangeEmail={() => {
          setSentToEmail(null);
          setMessage("");
        }}
      />
    );
  }

  return (
    <FlowScreen
      badge={authStatus?.isConfigured ? "SECURE ACCOUNT" : "PRIVATE SESSION"}
      body={authStatus?.user
        ? "Your active chart and Past Reflections can be restored on this account."
        : "We will email you a secure sign-in link. No password is needed."}
      eyebrow="PRIVATE BY DESIGN"
      onBack={onBack}
      title={authStatus?.user ? "Your Lumis account" : "Save your chart securely."}
    >
      <View style={styles.mark}><MiniChartWheel size={98} /></View>

      {authStatus?.user?.email ? (
        <View style={styles.accountCard}>
          <View style={styles.check}><Check color={colors.navy950} size={18} strokeWidth={3} /></View>
          <View style={styles.flex}>
            <Text style={styles.accountLabel}>SIGNED IN</Text>
            <Text style={styles.accountEmail}>{authStatus.user.email}</Text>
          </View>
        </View>
      ) : (
        <View style={flowStyles.field}>
          <Text style={flowStyles.fieldLabel}>EMAIL ADDRESS</Text>
          <View style={styles.emailField}>
            <Mail color={colors.muted} size={18} />
            <TextInput
              style={styles.emailInput}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>
        </View>
      )}

      <View style={flowStyles.note}>
        <LockKeyhole color={colors.gold} size={17} />
        <Text style={flowStyles.noteText}>Your birth chart and reflections remain linked to your private account.</Text>
      </View>

      {authNotice || message ? (
        <View style={flowStyles.success}>
          <Text style={flowStyles.successTitle}>Account update</Text>
          <Text style={flowStyles.message}>{message || authNotice}</Text>
        </View>
      ) : null}
      {error || authError ? <View style={flowStyles.error}><Text style={flowStyles.errorText}>{error || authError}</Text></View> : null}

      <Pressable
        style={[flowStyles.primaryButton, isSubmitting && flowStyles.disabled]}
        disabled={isSubmitting}
        onPress={authStatus?.user ? handleSignOut : sendLink}
      >
        <Text style={flowStyles.primaryButtonText}>
          {isSubmitting ? "Please wait..." : authStatus?.user ? "Sign out" : "Send secure link"}
        </Text>
        {!authStatus?.user ? <ChevronRight color={colors.navy950} size={19} /> : null}
      </Pressable>

      <Pressable style={flowStyles.secondaryButton} onPress={() => refreshAccount("Account reloaded.")}>
        <Text style={flowStyles.secondaryButtonText}>Reload account</Text>
      </Pressable>
      {!authStatus?.user ? (
        <Pressable style={styles.textButton} onPress={onContinueLocal}>
          <Text style={styles.textButtonText}>Continue without saving</Text>
        </Pressable>
      ) : null}
    </FlowScreen>
  );
}

const styles = StyleSheet.create({
  mark: { alignSelf: "center", width: 124, height: 124, borderRadius: 62, alignItems: "center", justifyContent: "center", backgroundColor: colors.periwinkleFill },
  accountCard: { minHeight: 70, flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: radii.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  check: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.good },
  flex: { flex: 1, minWidth: 0 },
  accountLabel: { color: colors.good, fontSize: 9, fontWeight: "700", letterSpacing: 1.3 },
  accountEmail: { color: colors.ice, fontSize: 13.5, marginTop: 4 },
  emailField: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 15, borderRadius: radii.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  emailInput: { flex: 1, minWidth: 0, color: colors.ice, fontSize: 15.5, outlineStyle: "none" } as never,
  textButton: { minHeight: 42, alignItems: "center", justifyContent: "center" },
  textButtonText: { color: colors.textSoft, fontSize: 12.5, fontWeight: "600" }
});
