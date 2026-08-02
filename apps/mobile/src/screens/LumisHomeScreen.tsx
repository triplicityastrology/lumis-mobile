import Bell from "lucide-react-native/icons/bell";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import Compass from "lucide-react-native/icons/compass";
import History from "lucide-react-native/icons/history";
import LogIn from "lucide-react-native/icons/log-in";
import MessageCircle from "lucide-react-native/icons/message-circle";
import RefreshCw from "lucide-react-native/icons/refresh-cw";
import UserRound from "lucide-react-native/icons/user-round";
import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { ChartV2 } from "@lumis/shared";

import { LinearGradient } from "expo-linear-gradient";

import { FrostedCard } from "../components/FrostedCard";
import { MainTabBar } from "../components/MainTabBar";
import { MiniChartWheel } from "../components/MiniChartWheel";
import { NatalWheel } from "../components/NatalWheel";
import { colors, radii, spacing } from "../theme/tokens";

type LumisHomeScreenProps = {
  accountLoadStatus: "idle" | "loading" | "loaded" | "empty" | "error";
  accountLoadMessage: string;
  chart: ChartV2 | null;
  reflectionCount: number;
  email?: string;
  isAuthenticated: boolean;
  name?: string;
  onAccount: () => void;
  onCreateChart: () => void;
  onDice: () => void;
  onInsights: () => void;
  onNotifications: () => void;
  onOpenChat: () => void;
  onOpenProfile: () => void;
  onPastReflections: () => void;
  onReload: () => void;
};

export function LumisHomeScreen(props: LumisHomeScreenProps) {
  if (!props.chart || !props.name) {
    return <WelcomeState {...props} />;
  }

  const sun = findPoint(props.chart, "sun");
  const moon = findPoint(props.chart, "moon");
  // Rising is shown ONLY for a full-precision (timed) chart. A no_birth_time
  // chart with stale/malformed Ascendant data must still show Sun + Moon only.
  const rising = props.chart.precision === "full" ? findPoint(props.chart, "ascendant") : undefined;

  return (
    <SafeAreaView edges={[]} style={styles.safe}>
      <View style={styles.appFrame}>
        <View style={styles.header}>
          <View style={styles.identityRow}>
            <Text style={styles.brand}>Lumis</Text>
            <Text style={styles.online}>Your chart is active</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable style={styles.iconButton} onPress={props.onNotifications} accessibilityLabel="Notifications">
              <Bell color={colors.ice} size={19} strokeWidth={1.7} />
              {/* Inert preview badge: signals the notifications preview has sample
                  content — no live unread count is claimed. */}
              <View style={styles.notifBadge} />
            </Pressable>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.homeContent}
          contentInsetAdjustmentBehavior="never"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.greetingBlock}>
            <Text style={styles.eyebrow}>✦ YOUR INNER UNIVERSE</Text>
            <Text style={styles.greeting}>Welcome back, {props.name}.</Text>
            <Text style={styles.greetingBody}>What would you like to understand today?</Text>
          </View>

          <Pressable onPress={props.onInsights}>
            {/* HOME-002 (RULE 1): genuine frosted glass — sky hints through. */}
            <FrostedCard style={styles.chartCard} radius={radii.lg}>
              <View style={styles.chartWheelWrap}>
                {/* HOME-002: real data-driven wheel (not the decorative placeholder). */}
                <NatalWheel chart={props.chart} size={92} />
              </View>
              <View style={styles.chartCardBody}>
                <Text style={styles.chartLabel}>YOUR BIRTH CHART</Text>
                <View style={styles.placementRow}>
                  <Placement glyph={"☉︎"} value={sun?.sign ?? "Sun"} />
                  <Placement glyph={"☽︎"} value={moon?.sign ?? "Moon"} />
                  {rising ? <Placement glyph="ASC" value={rising.sign} compact /> : null}
                </View>
                <Text style={styles.chartNote}>
                  {props.chart.precision === "full"
                    ? "Birth time confirmed · Houses and angles included"
                    : "Unknown birth time · Timed placements are hidden"}
                </Text>
              </View>
              <ChevronRight color={colors.muted} size={19} />
            </FrostedCard>
          </Pressable>

          <Pressable style={styles.primaryAction} onPress={props.onOpenChat}>
            {/* HOME-002 (RULE 2): "Talk with Lumis" gold gradient (#C9A96E→#D7B978→#E5C58A). */}
            <LinearGradient
              colors={["#E5C06B", "#E9B083", "#E89B92"]}
              end={{ x: 1, y: 0.35 }}
              locations={[0, 0.55, 1]}
              start={{ x: 0, y: 0 }}
              style={styles.primaryActionGradient}
            >
              <View style={styles.primaryIcon}>
                <MessageCircle color={colors.navy950} size={21} />
              </View>
              <View style={styles.actionCopy}>
                <Text style={styles.primaryActionTitle}>Talk with Lumis</Text>
                <Text style={styles.primaryActionBody}>A private reflection shaped by your chart</Text>
              </View>
              <ChevronRight color={colors.navy950} size={20} />
            </LinearGradient>
          </Pressable>

          <Pressable onPress={props.onPastReflections}>
            {/* HOME-002 (RULE 1): secondary CTA is a frosted card, not solid navy. */}
            <FrostedCard style={styles.reflectionCard} radius={radii.lg}>
              <View style={styles.secondaryIcon}>
                <History color={colors.periwinkle} size={20} />
              </View>
              <View style={styles.actionCopy}>
                <Text style={styles.reflectionTitle}>Past Reflections</Text>
                <Text style={styles.reflectionBody}>
                  {props.reflectionCount > 0
                    ? `${props.reflectionCount} saved conversation${props.reflectionCount === 1 ? "" : "s"}`
                    : "Your saved conversations will appear here"}
                </Text>
              </View>
              <ChevronRight color={colors.muted} size={19} />
            </FrostedCard>
          </Pressable>

          <View style={styles.statusLine}>
            <View style={[styles.statusDot, props.accountLoadStatus === "error" && styles.statusDotError]} />
            <Text style={[styles.statusText, props.accountLoadStatus !== "loaded" && styles.statusTextMuted]}>
              {props.accountLoadStatus === "loaded"
                ? "Your chart and reflections are saved to your account."
                : props.accountLoadMessage || "Your account is ready."}
            </Text>
            <Pressable onPress={props.onReload} accessibilityLabel="Reload account">
              <RefreshCw color={colors.muted} size={16} />
            </Pressable>
          </View>
        </ScrollView>

        <MainTabBar
          active="chat"
          onSelect={(tab) => {
            if (tab === "chat") props.onOpenChat();
            if (tab === "insights") props.onInsights();
            if (tab === "dice") props.onDice();
            if (tab === "profile") props.onOpenProfile();
          }}
        />
      </View>
    </SafeAreaView>
  );
}

function WelcomeState(props: LumisHomeScreenProps) {
  const isLoading = props.accountLoadStatus === "loading";
  const canCreateChart = props.isAuthenticated && props.accountLoadStatus === "empty";
  const restoreFailed = props.isAuthenticated && props.accountLoadStatus === "error";
  const primaryLabel = isLoading
    ? "Loading your account..."
    : restoreFailed
      ? "Retry account restore"
      : canCreateChart
        ? "Create my chart"
        : "Get started";
  const primaryAction = restoreFailed
    ? props.onReload
    : canCreateChart
      ? props.onCreateChart
      : props.onAccount;

  return (
    <SafeAreaView edges={["bottom"]} style={styles.safe}>
      <View style={styles.appFrame}>
        <View style={styles.welcomeHeader}>
          <View style={styles.markRow}>
            <MiniChartWheel size={34} />
            <Text style={styles.brand}>Lumis</Text>
          </View>
          <Pressable
            style={styles.signInButton}
            onPress={props.onAccount}
            accessibilityRole="button"
            accessibilityLabel={props.isAuthenticated ? "Open account" : "Sign in"}
          >
            <LogIn color={colors.ice} size={17} />
            <Text style={styles.signInText}>{props.isAuthenticated ? "Account" : "Sign in"}</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.welcomeContent}
          contentInsetAdjustmentBehavior="never"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.halo}>
            <MiniChartWheel size={148} />
          </View>
          <Text style={styles.eyebrow}>✦ MEET YOUR INNER UNIVERSE</Text>
          <Text style={styles.welcomeTitle}>A private space shaped by your birth chart.</Text>
          <Text style={styles.welcomeBody}>
            Lumis helps you reflect, notice patterns, and meet life with a little more clarity.
          </Text>

          <View style={styles.promiseList}>
            <Promise icon={<MessageCircle color={colors.gold} size={20} />} title="Personal conversation" body="Guidance grounded in your chart and your questions." />
            <Promise icon={<Compass color={colors.periwinkle} size={20} />} title="A clearer inner compass" body="Gentle prompts for timing, patterns, and growth." />
            <Promise icon={<UserRound color={colors.good} size={20} />} title="Private by design" body="Your account and chart stay behind secure sign-in." />
          </View>

          {props.accountLoadMessage ? (
            <View style={styles.welcomeStatus}>
              <View style={[styles.statusDot, props.accountLoadStatus === "error" && styles.statusDotError]} />
              <Text style={styles.welcomeStatusText}>{props.accountLoadMessage}</Text>
            </View>
          ) : null}

          <Pressable
            style={[styles.welcomePrimaryWrap, isLoading && styles.disabled]}
            disabled={isLoading}
            onPress={primaryAction}
            accessibilityRole="button"
            accessibilityLabel={primaryLabel}
          >
            <LinearGradient
              colors={["#E5C06B", "#E9B083", "#E89B92"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0.4 }}
              style={styles.welcomePrimary}
            >
              <Text style={styles.welcomePrimaryText}>{primaryLabel}</Text>
              <ChevronRight color="#3A2218" size={20} />
            </LinearGradient>
          </Pressable>
          <Pressable
            style={styles.welcomeSecondary}
            onPress={restoreFailed ? props.onAccount : canCreateChart ? props.onCreateChart : props.onAccount}
            accessibilityRole="button"
            accessibilityLabel={
              restoreFailed
                ? "Back to account"
                : canCreateChart
                ? "Continue chart onboarding"
                : "I already have an account"
            }
          >
            <Text style={styles.welcomeSecondaryText}>
              {restoreFailed
                ? "Back to account"
                : canCreateChart
                  ? "No chart yet? Continue onboarding"
                  : "I already have an account"}
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function Promise({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <View style={styles.promiseRow}>
      <View style={styles.promiseIcon}>{icon}</View>
      <View style={styles.promiseCopy}>
        <Text style={styles.promiseTitle}>{title}</Text>
        <Text style={styles.promiseBody}>{body}</Text>
      </View>
    </View>
  );
}

function Placement({ glyph, value, compact = false }: { glyph: string; value: string; compact?: boolean }) {
  return (
    <View style={styles.placement}>
      <Text style={[styles.placementGlyph, compact && styles.compactGlyph]}>{glyph}</Text>
      <Text style={styles.placementText}>{value}</Text>
    </View>
  );
}

function findPoint(chart: ChartV2, key: string) {
  return chart.planets.find((point) => point.key === key);
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "transparent" },
  appFrame: { flex: 1, width: "100%", maxWidth: 480, alignSelf: "center", backgroundColor: "transparent" },
  header: { minHeight: 68, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.line },
  identityRow: { flexDirection: "row", alignItems: "center", gap: 13, flex: 1, minWidth: 0 },
  brand: { color: colors.ice, fontFamily: "Newsreader-Medium", fontSize: 24, fontWeight: "500" },
  online: { color: colors.textSoft, fontSize: 12.5, lineHeight: 17, flexShrink: 1 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 9 },
  iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  notifBadge: { position: "absolute", top: 6, right: 7, width: 9, height: 9, borderRadius: 5, backgroundColor: "#E38E7C", borderWidth: 1.5, borderColor: colors.surface },
  homeContent: { padding: spacing.lg, paddingBottom: 30, gap: spacing.md },
  greetingBlock: { paddingTop: spacing.md, paddingBottom: spacing.sm },
  eyebrow: { color: colors.accent, fontSize: 10, fontWeight: "700", letterSpacing: 1.8, marginBottom: 11 },
  greeting: { color: colors.ice, fontFamily: "Newsreader-Medium", fontSize: 29, lineHeight: 35 },
  greetingBody: { color: colors.textSoft, fontSize: 14, lineHeight: 21, marginTop: 7 },
  chartCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  chartWheelWrap: { width: 92, height: 92, borderRadius: 46, overflow: "hidden" },
  chartCardBody: { flex: 1, minWidth: 0 },
  chartLabel: { color: colors.muted, fontSize: 9, fontWeight: "700", letterSpacing: 1.4, marginBottom: 9 },
  placementRow: { flexDirection: "column", gap: 6 },
  placement: { flexDirection: "row", alignItems: "center", gap: 7 },
  placementGlyph: { color: colors.accent, fontFamily: "Newsreader-Medium", fontSize: 15, width: 18, textAlign: "center" },
  compactGlyph: { fontSize: 9, fontWeight: "700" },
  placementText: { color: colors.ice, fontSize: 14, fontWeight: "600" },
  chartNote: { color: colors.muted, fontSize: 10.5, lineHeight: 15, marginTop: 8 },
  primaryAction: { borderRadius: radii.lg, minHeight: 78, overflow: "hidden" },
  primaryActionGradient: { alignItems: "center", flexDirection: "row", gap: 13, minHeight: 78, padding: 15, width: "100%" },
  primaryIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(13,27,46,0.10)" },
  actionCopy: { flex: 1, minWidth: 0 },
  primaryActionTitle: { color: colors.navy950, fontSize: 16, fontWeight: "700" },
  primaryActionBody: { color: colors.navy800, fontSize: 11.5, lineHeight: 17, marginTop: 3 },
  reflectionCard: { minHeight: 74, flexDirection: "row", alignItems: "center", gap: 13, padding: 15 },
  secondaryIcon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(26,53,80,0.60)" },
  reflectionTitle: { color: colors.ice, fontSize: 15, fontWeight: "700" },
  reflectionBody: { color: colors.muted, fontSize: 11.5, lineHeight: 17, marginTop: 3 },
  statusLine: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 5, paddingTop: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.goodSolid },
  statusDotError: { backgroundColor: colors.warnSolid },
  statusText: { flex: 1, color: colors.goodSolid, fontSize: 12 },
  statusTextMuted: { color: colors.muted },
  welcomeHeader: { minHeight: 68, paddingHorizontal: spacing.lg, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  markRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  signInButton: { height: 40, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 13, borderRadius: 20, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  signInText: { color: colors.ice, fontSize: 12.5, fontWeight: "600" },
  welcomeContent: { flexGrow: 1, paddingHorizontal: 26, paddingTop: 18, paddingBottom: 34 },
  halo: { alignSelf: "center", width: 176, height: 176, borderRadius: 88, alignItems: "center", justifyContent: "center", marginBottom: 20, backgroundColor: colors.periwinkleFill },
  welcomeTitle: { color: colors.ice, fontFamily: "Newsreader-Medium", fontSize: 32, lineHeight: 38, maxWidth: 390 },
  welcomeBody: { color: colors.textSoft, fontSize: 14.5, lineHeight: 22, marginTop: 12 },
  promiseList: { marginTop: 25, gap: 15 },
  promiseRow: { flexDirection: "row", gap: 13, alignItems: "center" },
  promiseIcon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  promiseCopy: { flex: 1 },
  promiseTitle: { color: colors.ice, fontSize: 14, fontWeight: "700" },
  promiseBody: { color: colors.muted, fontSize: 11.5, lineHeight: 17, marginTop: 2 },
  welcomeStatus: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 20, padding: 12, borderRadius: radii.md, backgroundColor: colors.surface },
  welcomeStatusText: { flex: 1, color: colors.textSoft, fontSize: 11.5, lineHeight: 17 },
  welcomePrimaryWrap: { marginTop: 22, borderRadius: radii.md, shadowColor: "#E9B083", shadowOffset: { height: 10, width: 0 }, shadowOpacity: 0.4, shadowRadius: 16 },
  welcomePrimary: { minHeight: 54, borderRadius: radii.md, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 },
  welcomePrimaryText: { color: "#3A2218", fontSize: 15, fontWeight: "700" },
  welcomeSecondary: { minHeight: 44, alignItems: "center", justifyContent: "center", marginTop: 5 },
  welcomeSecondaryText: { color: colors.textSoft, fontSize: 12.5, fontWeight: "600" },
  disabled: { opacity: 0.55 }
});
