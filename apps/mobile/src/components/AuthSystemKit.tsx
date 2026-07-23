import { StatusBar } from "expo-status-bar";
import ArrowRight from "lucide-react-native/icons/arrow-right";
import Bell from "lucide-react-native/icons/bell";
import Camera from "lucide-react-native/icons/camera";
import Check from "lucide-react-native/icons/check";
import Dices from "lucide-react-native/icons/dices";
import Mail from "lucide-react-native/icons/mail";
import RefreshCw from "lucide-react-native/icons/refresh-cw";
import Sparkles from "lucide-react-native/icons/sparkles";
import WifiOff from "lucide-react-native/icons/wifi-off";
import X from "lucide-react-native/icons/x";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Defs, Line, RadialGradient, Stop } from "react-native-svg";

import { colors } from "../theme/tokens";
import { CelestialBackground } from "./CelestialBackground";

/**
 * Auth & System States kit (AC-UX-13 / handoff 2026-07-23): shared building
 * blocks and screens for magic-link, session restore, offline, loading, retry,
 * and permission bridges. Every screen sits on the full animated Lumis sky;
 * "reading the sky" waits use the rotating natal-wheel loader; hero icons use
 * radial gradient emblem circles (never flat tinted circles).
 */

const INK = "#3A2218";
const EMBLEM_TONES: Record<string, [string, string]> = {
  accent: ["#F0D592", "#C9A05A"],
  good: ["#AEE4C4", "#5DA97E"],
  warn: ["#F2C39C", "#D2825F"]
};

// ---- Radial-gradient emblem circle with a dark ink glyph ----
export function SkyEmblem({
  tone = "accent",
  size = 64,
  children
}: {
  tone?: "accent" | "good" | "warn";
  size?: number;
  children: ReactNode;
}) {
  const [from, to] = EMBLEM_TONES[tone] ?? EMBLEM_TONES.accent;
  const id = `emblem-${tone}`;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={id} cx="38%" cy="30%" r="80%">
            <Stop offset="0%" stopColor={from} />
            <Stop offset="100%" stopColor={to} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
      </Svg>
      {children}
    </View>
  );
}

// ---- Large "reading the sky" loader: counter-rotating rings + wheel + glow ----
export function SkyWheelLoader({ label }: { label?: string }) {
  const [reduce, setReduce] = useState(false);
  const outer = useRef(new Animated.Value(0)).current;
  const inner = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => mounted && setReduce(v));
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (reduce) return;
    const loops = [
      Animated.loop(Animated.timing(outer, { toValue: 1, duration: 14000, easing: Easing.linear, useNativeDriver: true })),
      Animated.loop(Animated.timing(inner, { toValue: 1, duration: 22000, easing: Easing.linear, useNativeDriver: true }))
    ];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [reduce, outer, inner]);

  const outerSpin = outer.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const innerSpin = inner.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "-360deg"] });

  return (
    <View style={styles.loaderWrap}>
      <View style={styles.loaderStage}>
        <View style={styles.loaderGlow} />
        <Animated.View style={[styles.loaderRing, { transform: [{ rotate: outerSpin }] }]}>
          <Svg width={210} height={210} viewBox="0 0 210 210">
            <Circle cx="105" cy="105" r="100" fill="none" stroke="#D7A950" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="2 10" />
          </Svg>
        </Animated.View>
        <Animated.View style={[styles.loaderRing, { transform: [{ rotate: innerSpin }] }]}>
          <Svg width={168} height={168} viewBox="0 0 168 168">
            <Circle cx="84" cy="84" r="80" fill="none" stroke="#9298D5" strokeOpacity="0.4" strokeWidth="1" strokeDasharray="1 14" />
          </Svg>
        </Animated.View>
        <Svg width={132} height={132} viewBox="0 0 132 132">
          <Circle cx="66" cy="66" r="60" fill="rgba(7,19,33,0.4)" stroke="#D7A950" strokeOpacity="0.65" strokeWidth="1" />
          <Circle cx="66" cy="66" r="44" fill="none" stroke="#EDE3D4" strokeOpacity="0.35" strokeWidth="0.7" />
          <Circle cx="66" cy="66" r="26" fill="none" stroke="#9298D5" strokeOpacity="0.4" strokeWidth="0.7" />
          {Array.from({ length: 12 }).map((_, i) => {
            const a = (i * 30 - 90) * (Math.PI / 180);
            return (
              <Line
                key={i}
                x1={66 + Math.cos(a) * 26}
                y1={66 + Math.sin(a) * 26}
                x2={66 + Math.cos(a) * 60}
                y2={66 + Math.sin(a) * 60}
                stroke="#EDE3D4"
                strokeOpacity="0.25"
                strokeWidth="0.6"
              />
            );
          })}
          <Circle cx="66" cy="66" r="3" fill="#D7A950" />
        </Svg>
      </View>
      {label ? <Text style={styles.loaderLabel}>{label}</Text> : null}
    </View>
  );
}

// ---- Sky-backed shell for full-screen system states ----
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView edges={["top", "left", "right", "bottom"]} style={styles.shell}>
      <StatusBar style="light" />
      <CelestialBackground />
      <View style={styles.shellBody}>{children}</View>
    </SafeAreaView>
  );
}

function PrimaryButton({ label, icon, onPress }: { label: string; icon?: ReactNode; onPress: () => void }) {
  return (
    <Pressable style={styles.primaryBtn} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <Text style={styles.primaryBtnText}>{label}</Text>
      {icon}
    </Pressable>
  );
}

function SoftButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable style={[styles.softBtn, disabled && styles.dim]} onPress={onPress} disabled={disabled} accessibilityRole="button">
      <Text style={styles.softBtnText}>{label}</Text>
    </Pressable>
  );
}

function LinkButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.linkBtn} onPress={onPress} accessibilityRole="button">
      <Text style={styles.linkBtnText}>{label}</Text>
    </Pressable>
  );
}

// ---- AUTH-002 Magic link sent ----
export function MagicLinkSentScreen({
  email,
  onResend,
  onChangeEmail
}: {
  email: string;
  onResend: () => void;
  onChangeEmail: () => void;
}) {
  const [resent, setResent] = useState(false);
  return (
    <AuthShell>
      <View style={styles.center}>
        <SkyEmblem tone="accent"><Mail color={INK} size={26} /></SkyEmblem>
        <Text style={styles.h1}>Check your inbox.</Text>
        <Text style={styles.body}>We sent a sign-in link to</Text>
        <Text style={styles.bodyStrong}>{email}</Text>
        <Text style={styles.small}>The link expires in 15 minutes and can only be used once. If you don't see it, check spam.</Text>
        <View style={styles.spacer} />
        <SoftButton
          label={resent ? "Link resent" : "Resend link"}
          disabled={resent}
          onPress={() => {
            setResent(true);
            onResend();
          }}
        />
        <LinkButton label="Use a different email" onPress={onChangeEmail} />
      </View>
    </AuthShell>
  );
}

// ---- AUTH-003 Magic link return / restoring session ----
export function RestoringSessionScreen({
  result,
  onRetry,
  onSignOut,
  onDone
}: {
  result: "restoring" | "success" | "failed";
  onRetry: () => void;
  onSignOut: () => void;
  onDone: () => void;
}) {
  useEffect(() => {
    if (result === "success") {
      const id = setTimeout(onDone, 900);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [result, onDone]);

  return (
    <AuthShell>
      <View style={styles.centerMiddle}>
        {result === "restoring" ? (
          <>
            <SkyWheelLoader />
            <Text style={styles.eyebrow}>OPENING YOUR SKY</Text>
            <Text style={styles.h2}>Verifying your link…</Text>
            <Text style={styles.small}>Just a moment.</Text>
          </>
        ) : result === "success" ? (
          <>
            <SkyEmblem tone="good"><Check color={INK} size={28} strokeWidth={3} /></SkyEmblem>
            <Text style={styles.h2}>You're in.</Text>
          </>
        ) : (
          <>
            <SkyEmblem tone="warn"><X color={INK} size={28} strokeWidth={2.5} /></SkyEmblem>
            <Text style={styles.h2}>That link didn't work.</Text>
            <Text style={styles.body}>It may have expired or already been used. Request a new one to continue.</Text>
            <View style={styles.gap} />
            <PrimaryButton label="Send a new link" onPress={onRetry} />
            <LinkButton label="Sign out" onPress={onSignOut} />
          </>
        )}
      </View>
    </AuthShell>
  );
}

// ---- AUTH-004 Auth failure card ----
export function AuthFailureScreen({
  offline,
  onRetry,
  onOtherMethod
}: {
  offline?: boolean;
  onRetry: () => void;
  onOtherMethod: () => void;
}) {
  return (
    <AuthShell>
      <View style={styles.centerMiddle}>
        <SkyEmblem tone="warn">{offline ? <WifiOff color={INK} size={26} /> : <X color={INK} size={28} strokeWidth={2.5} />}</SkyEmblem>
        <Text style={styles.h2}>{offline ? "You're offline." : "We couldn't sign you in."}</Text>
        <Text style={styles.body}>
          {offline
            ? "Check your connection and try again."
            : "Something interrupted sign-in. Give it another try, or use a different method."}
        </Text>
        <View style={styles.gap} />
        <PrimaryButton label="Try again" onPress={onRetry} />
        {!offline ? <LinkButton label="Use a different sign-in method" onPress={onOtherMethod} /> : null}
      </View>
    </AuthShell>
  );
}

// ---- AUTH-005 Restoring Lumis space (post-auth routing) ----
export function RestoringSpaceScreen({
  result,
  onGoChat,
  onGoOnboarding,
  onRetry
}: {
  result: "loading" | "foundChart" | "noChart" | "failed";
  onGoChat: () => void;
  onGoOnboarding: () => void;
  onRetry: () => void;
}) {
  useEffect(() => {
    if (result === "foundChart") {
      const id = setTimeout(onGoChat, 900);
      return () => clearTimeout(id);
    }
    if (result === "noChart") {
      const id = setTimeout(onGoOnboarding, 900);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [result, onGoChat, onGoOnboarding]);

  return (
    <AuthShell>
      <View style={styles.centerMiddle}>
        {result === "failed" ? (
          <>
            <SkyEmblem tone="warn"><X color={INK} size={28} strokeWidth={2.5} /></SkyEmblem>
            <Text style={styles.h2}>Couldn't load your space.</Text>
            <Text style={styles.body}>Your account is signed in, but we had trouble loading your chart. Let's try again.</Text>
            <View style={styles.gap} />
            <PrimaryButton label="Retry" onPress={onRetry} />
          </>
        ) : (
          <>
            <SkyWheelLoader />
            <Text style={styles.eyebrow}>RESTORING YOUR SKY</Text>
            <Text style={styles.h2}>Restoring your Lumis space…</Text>
            <Text style={styles.small}>Finding your chart and conversations.</Text>
          </>
        )}
      </View>
    </AuthShell>
  );
}

// ---- AUTH-006 No chart found / continue setup ----
export function NoChartFoundScreen({
  onContinueSetup,
  onSignOut
}: {
  onContinueSetup: () => void;
  onSignOut: () => void;
}) {
  return (
    <AuthShell>
      <View style={styles.centerMiddle}>
        <SkyEmblem tone="accent"><Sparkles color={INK} size={26} /></SkyEmblem>
        <Text style={styles.h2}>Let's finish setting up your sky.</Text>
        <Text style={styles.body}>Your account is ready, but we don't have your birth chart yet. It only takes a minute.</Text>
        <View style={styles.gap} />
        <PrimaryButton label="Continue setup" icon={<ArrowRight color={INK} size={19} />} onPress={onContinueSetup} />
        <LinkButton label="Sign out" onPress={onSignOut} />
      </View>
    </AuthShell>
  );
}

// ---- APP-005 Global offline banner (overlay) ----
export function OfflineBanner({ state }: { state: "offline" | "reconnecting" | "online" | null }) {
  if (!state) return null;
  const map = {
    offline: { icon: <WifiOff color="#F0F4F8" size={15} />, text: "You're offline. Some things may be out of date." },
    reconnecting: { icon: <RefreshCw color="#F0F4F8" size={15} />, text: "Reconnecting…" },
    online: { icon: <Check color="#0E2A1C" size={15} strokeWidth={3} />, text: "Back online." }
  } as const;
  const m = map[state];
  return (
    <View style={[styles.offlineBanner, state === "online" && styles.offlineBannerGood]} pointerEvents="none">
      {m.icon}
      <Text style={[styles.offlineText, state === "online" && styles.offlineTextGood]}>{m.text}</Text>
    </View>
  );
}

// ---- APP-006 Generic loading skeleton ----
export function SkeletonRows({ count = 4 }: { count?: number }) {
  return (
    <View style={styles.skelWrap}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.skelRow}>
          <View style={styles.skelCircle} />
          <View style={styles.flex}>
            <View style={[styles.skelLine, { width: "62%" }]} />
            <View style={[styles.skelLine, { width: "38%", marginTop: 8 }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ---- APP-007 Generic friendly retry card ----
export function SystemRetryCard({
  title,
  body,
  onRetry,
  small
}: {
  title?: string;
  body?: string;
  onRetry: () => void;
  small?: boolean;
}) {
  return (
    <View style={[styles.retryCard, small ? styles.retryCardSmall : styles.retryCardLarge]}>
      <SkyEmblem tone="warn" size={48}><RefreshCw color={INK} size={20} /></SkyEmblem>
      <Text style={styles.retryTitle}>{title ?? "This didn't load."}</Text>
      <Text style={styles.retryBody}>{body ?? "Something went wrong on our end — nothing lost, just try again."}</Text>
      <SoftButton label="Retry" onPress={onRetry} />
    </View>
  );
}

// ---- APP-008 System permission prompt bridge ----
const PERMISSION_COPY = {
  camera: { icon: (c: string) => <Camera color={c} size={26} />, title: "Camera access", body: "Lumis needs your camera to scan a carer QR code." },
  motion: { icon: (c: string) => <Dices color={c} size={26} />, title: "Motion & orientation", body: "Lumis uses motion sensors so you can shake to roll the dice." },
  push: { icon: (c: string) => <Bell color={c} size={26} />, title: "Notifications", body: "Turn on notifications for gentle Care Circle check-ins and updates." }
} as const;

export function PermissionBridgeScreen({
  kind,
  denied,
  onAllow,
  onSkip,
  onOpenSettings
}: {
  kind: "camera" | "motion" | "push";
  denied?: boolean;
  onAllow: () => void;
  onSkip: () => void;
  onOpenSettings: () => void;
}) {
  const copy = PERMISSION_COPY[kind];
  return (
    <AuthShell>
      <View style={styles.centerMiddle}>
        <SkyEmblem tone="accent">{copy.icon(INK)}</SkyEmblem>
        <Text style={styles.h2}>{copy.title}</Text>
        <Text style={styles.body}>
          {denied ? `${copy.body} It looks like this is currently off — you can turn it on in Settings.` : copy.body}
        </Text>
        <View style={styles.gap} />
        {!denied ? (
          <>
            <PrimaryButton label={`Allow ${copy.title.toLowerCase()}`} onPress={onAllow} />
            <LinkButton label="Not now" onPress={onSkip} />
          </>
        ) : (
          <>
            <PrimaryButton label="Open Settings" onPress={onOpenSettings} />
            <LinkButton label="Continue without it" onPress={onSkip} />
          </>
        )}
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  shell: { backgroundColor: colors.navy950, flex: 1 },
  shellBody: { flex: 1, width: "100%", maxWidth: 480, alignSelf: "center" },
  center: { alignItems: "center", flex: 1, paddingHorizontal: 26, paddingTop: 30 },
  centerMiddle: { alignItems: "center", flex: 1, justifyContent: "center", paddingHorizontal: 30 },
  flex: { flex: 1 },
  spacer: { flex: 1 },
  gap: { height: 26 },
  h1: { color: colors.ice, fontFamily: "Georgia", fontSize: 30, marginTop: 20, marginBottom: 10, textAlign: "center" },
  h2: { color: colors.ice, fontFamily: "Georgia", fontSize: 23, marginTop: 20, marginBottom: 8, textAlign: "center" },
  eyebrow: { color: "#E9B083", fontSize: 10.5, fontWeight: "700", letterSpacing: 2, marginBottom: 8 },
  body: { color: colors.textSoft, fontSize: 14.5, lineHeight: 22, textAlign: "center" },
  bodyStrong: { color: colors.ice, fontSize: 14.5, fontWeight: "600", marginTop: 2, marginBottom: 20, textAlign: "center" },
  small: { color: colors.muted, fontSize: 12.5, lineHeight: 18, textAlign: "center", maxWidth: 320 },
  primaryBtn: { alignItems: "center", alignSelf: "stretch", backgroundColor: colors.gold, borderRadius: 15, flexDirection: "row", gap: 8, justifyContent: "center", minHeight: 54, marginBottom: 12 },
  primaryBtnText: { color: "#1a1206", fontSize: 15.5, fontWeight: "700" },
  softBtn: { alignItems: "center", alignSelf: "stretch", backgroundColor: colors.surfaceRaised, borderColor: colors.line, borderRadius: 15, borderWidth: 1, justifyContent: "center", minHeight: 52, marginBottom: 12 },
  softBtnText: { color: colors.ice, fontSize: 15, fontWeight: "600" },
  dim: { opacity: 0.5 },
  linkBtn: { alignItems: "center", justifyContent: "center", minHeight: 40 },
  linkBtnText: { color: colors.textSoft, fontSize: 13.5, fontWeight: "600" },
  loaderWrap: { alignItems: "center", marginBottom: 8 },
  loaderStage: { alignItems: "center", height: 210, justifyContent: "center", width: 210 },
  loaderGlow: { backgroundColor: "rgba(201,169,110,0.12)", borderRadius: 95, height: 190, position: "absolute", width: 190 },
  loaderRing: { alignItems: "center", justifyContent: "center", position: "absolute" },
  loaderLabel: { color: colors.muted, fontSize: 12.5, marginTop: 6 },
  offlineBanner: { alignItems: "center", backgroundColor: "rgba(22,39,61,0.94)", borderColor: colors.line, borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 8, left: 12, paddingHorizontal: 14, paddingVertical: 10, position: "absolute", right: 12, top: 8, zIndex: 100 },
  offlineBannerGood: { backgroundColor: "rgba(134,200,166,0.95)", borderColor: "rgba(134,200,166,0.6)" },
  offlineText: { color: colors.ice, fontSize: 12.5, fontWeight: "600" },
  offlineTextGood: { color: "#0E2A1C" },
  skelWrap: { paddingHorizontal: 20, paddingVertical: 4 },
  skelRow: { alignItems: "center", flexDirection: "row", gap: 12, marginBottom: 18 },
  skelCircle: { backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 19, height: 38, width: 38 },
  skelLine: { backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 6, height: 11 },
  retryCard: { alignItems: "center", backgroundColor: "rgba(58,80,118,0.24)", borderColor: colors.line, borderRadius: 20, borderWidth: 1, padding: 22 },
  retryCardLarge: { marginHorizontal: 20, marginVertical: 40 },
  retryCardSmall: { marginHorizontal: 20, marginVertical: 10 },
  retryTitle: { color: colors.ice, fontFamily: "Georgia", fontSize: 18, marginBottom: 6, marginTop: 14, textAlign: "center" },
  retryBody: { color: colors.muted, fontSize: 12.5, lineHeight: 18, marginBottom: 16, textAlign: "center" }
});
