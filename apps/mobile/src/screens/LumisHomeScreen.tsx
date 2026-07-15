import {
  Bell,
  ChevronRight,
  Compass,
  Dices,
  History,
  LogIn,
  MessageCircle,
  RefreshCw,
  Sparkles,
  UserRound
} from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";

import type { ChartV2 } from "@lumis/shared";

import { MiniChartWheel } from "../components/MiniChartWheel";
import { colors, radii, spacing } from "../theme/tokens";

type HomeTab = "chat" | "insights" | "dice" | "profile";

type LumisHomeScreenProps = {
  accountLoadStatus: "idle" | "loading" | "loaded" | "empty" | "error";
  accountLoadMessage: string;
  chart: ChartV2 | null;
  reflectionCount: number;
  credits: number;
  email?: string;
  isAuthenticated: boolean;
  name?: string;
  onAccount: () => void;
  onCreateChart: () => void;
  onInsights: () => void;
  onNotifications: () => void;
  onOpenChat: () => void;
  onOpenPlans: () => void;
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
  const rising = findPoint(props.chart, "ascendant");

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.appFrame}>
        <View style={styles.header}>
          <View style={styles.identityRow}>
            <View style={styles.avatar}>
              <Sparkles color={colors.navy950} size={19} strokeWidth={1.8} />
            </View>
            <View>
              <Text style={styles.brand}>Lumis</Text>
              <Text style={styles.online}>Your chart is active</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <Pressable style={styles.iconButton} onPress={props.onNotifications} accessibilityLabel="Notifications">
              <Bell color={colors.ice} size={19} strokeWidth={1.7} />
            </Pressable>
            <Pressable style={styles.creditChip} onPress={props.onOpenPlans}>
              <Sparkles color={colors.gold} size={14} />
              <Text style={styles.creditText}>{props.credits}</Text>
            </Pressable>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.homeContent} showsVerticalScrollIndicator={false}>
          <View style={styles.greetingBlock}>
            <Text style={styles.eyebrow}>YOUR INNER UNIVERSE</Text>
            <Text style={styles.greeting}>Welcome back, {props.name}.</Text>
            <Text style={styles.greetingBody}>What would you like to understand today?</Text>
          </View>

          <Pressable style={styles.chartCard} onPress={props.onInsights}>
            <View style={styles.chartWheelWrap}>
              <MiniChartWheel size={92} />
            </View>
            <View style={styles.chartCardBody}>
              <Text style={styles.chartLabel}>YOUR BIRTH CHART</Text>
              <View style={styles.placementRow}>
                <Placement glyph="☉" value={sun?.sign ?? "Sun"} />
                <Placement glyph="☽" value={moon?.sign ?? "Moon"} />
                {rising ? <Placement glyph="ASC" value={rising.sign} compact /> : null}
              </View>
              <Text style={styles.chartNote}>
                {props.chart.precision === "full"
                  ? "Birth time confirmed · Houses and angles included"
                  : "Unknown birth time · Timed placements are hidden"}
              </Text>
            </View>
            <ChevronRight color={colors.muted} size={19} />
          </Pressable>

          <Pressable style={styles.primaryAction} onPress={props.onOpenChat}>
            <View style={styles.primaryIcon}>
              <MessageCircle color={colors.navy950} size={21} />
            </View>
            <View style={styles.actionCopy}>
              <Text style={styles.primaryActionTitle}>Talk with Lumis</Text>
              <Text style={styles.primaryActionBody}>A private reflection shaped by your chart</Text>
            </View>
            <ChevronRight color={colors.navy950} size={20} />
          </Pressable>

          <Pressable style={styles.reflectionCard} onPress={props.onPastReflections}>
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
          </Pressable>

          <View style={styles.statusLine}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>
              {props.accountLoadStatus === "loaded"
                ? "Your chart and reflections are saved to your account."
                : props.accountLoadMessage || "Your account is ready."}
            </Text>
            <Pressable onPress={props.onReload} accessibilityLabel="Reload account">
              <RefreshCw color={colors.muted} size={16} />
            </Pressable>
          </View>
        </ScrollView>

        <BottomTabs
          active="chat"
          onSelect={(tab) => {
            if (tab === "chat") props.onOpenChat();
            if (tab === "insights") props.onInsights();
            if (tab === "dice") props.onOpenPlans();
            if (tab === "profile") props.onOpenProfile();
          }}
        />
      </View>
    </SafeAreaView>
  );
}

function WelcomeState(props: LumisHomeScreenProps) {
  const isLoading = props.accountLoadStatus === "loading";

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.appFrame}>
        <View style={styles.welcomeHeader}>
          <View style={styles.markRow}>
            <MiniChartWheel size={34} />
            <Text style={styles.brand}>Lumis</Text>
          </View>
          <Pressable style={styles.signInButton} onPress={props.onAccount}>
            <LogIn color={colors.ice} size={17} />
            <Text style={styles.signInText}>{props.isAuthenticated ? "Account" : "Sign in"}</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.welcomeContent} showsVerticalScrollIndicator={false}>
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
            style={[styles.welcomePrimary, isLoading && styles.disabled]}
            disabled={isLoading}
            onPress={props.isAuthenticated ? props.onCreateChart : props.onAccount}
          >
            <Text style={styles.welcomePrimaryText}>
              {isLoading ? "Loading your account..." : props.isAuthenticated ? "Create my chart" : "Get started"}
            </Text>
            <ChevronRight color={colors.navy950} size={20} />
          </Pressable>
          <Pressable style={styles.welcomeSecondary} onPress={props.isAuthenticated ? props.onCreateChart : props.onAccount}>
            <Text style={styles.welcomeSecondaryText}>
              {props.isAuthenticated ? "No chart yet? Continue onboarding" : "I already have an account"}
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

function BottomTabs({ active, onSelect }: { active: HomeTab; onSelect: (tab: HomeTab) => void }) {
  const tabs = [
    { id: "chat" as const, label: "Talk", Icon: MessageCircle },
    { id: "insights" as const, label: "Insights", Icon: Compass },
    { id: "dice" as const, label: "Dice", Icon: Dices },
    { id: "profile" as const, label: "You", Icon: UserRound }
  ];

  return (
    <View style={styles.tabs}>
      {tabs.map(({ id, label, Icon }) => {
        const selected = id === active;
        return (
          <Pressable key={id} style={styles.tab} onPress={() => onSelect(id)}>
            <Icon color={selected ? colors.gold : colors.muted} size={22} strokeWidth={selected ? 2 : 1.6} />
            <Text style={[styles.tabLabel, selected && styles.tabLabelActive]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function findPoint(chart: ChartV2, key: string) {
  return chart.planets.find((point) => point.key === key);
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy950 },
  appFrame: { flex: 1, width: "100%", maxWidth: 480, alignSelf: "center", backgroundColor: colors.navy900 },
  header: { minHeight: 68, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.line },
  identityRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.gold },
  brand: { color: colors.ice, fontFamily: "Georgia", fontSize: 20, fontWeight: "600" },
  online: { color: colors.good, fontSize: 11, marginTop: 2 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 9 },
  iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  creditChip: { height: 40, minWidth: 58, paddingHorizontal: 12, borderRadius: 20, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  creditText: { color: colors.ice, fontSize: 13, fontWeight: "700" },
  homeContent: { padding: spacing.lg, paddingBottom: 30, gap: spacing.md },
  greetingBlock: { paddingTop: spacing.md, paddingBottom: spacing.sm },
  eyebrow: { color: colors.gold, fontSize: 10, fontWeight: "700", letterSpacing: 1.8, marginBottom: 11 },
  greeting: { color: colors.ice, fontFamily: "Georgia", fontSize: 29, lineHeight: 35 },
  greetingBody: { color: colors.textSoft, fontSize: 14, lineHeight: 21, marginTop: 7 },
  chartCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  chartWheelWrap: { width: 92, height: 92, borderRadius: 46, overflow: "hidden" },
  chartCardBody: { flex: 1, minWidth: 0 },
  chartLabel: { color: colors.muted, fontSize: 9, fontWeight: "700", letterSpacing: 1.4, marginBottom: 9 },
  placementRow: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  placement: { flexDirection: "row", alignItems: "center", gap: 3 },
  placementGlyph: { color: colors.gold, fontFamily: "Georgia", fontSize: 16 },
  compactGlyph: { fontSize: 9, fontWeight: "700" },
  placementText: { color: colors.ice, fontSize: 12, fontWeight: "600" },
  chartNote: { color: colors.muted, fontSize: 10.5, lineHeight: 15, marginTop: 8 },
  primaryAction: { minHeight: 78, flexDirection: "row", alignItems: "center", gap: 13, padding: 15, borderRadius: radii.lg, backgroundColor: colors.gold },
  primaryIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(13,27,46,0.10)" },
  actionCopy: { flex: 1, minWidth: 0 },
  primaryActionTitle: { color: colors.navy950, fontSize: 16, fontWeight: "700" },
  primaryActionBody: { color: colors.navy800, fontSize: 11.5, lineHeight: 17, marginTop: 3 },
  reflectionCard: { minHeight: 74, flexDirection: "row", alignItems: "center", gap: 13, padding: 15, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  secondaryIcon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: colors.periwinkleFill },
  reflectionTitle: { color: colors.ice, fontSize: 15, fontWeight: "700" },
  reflectionBody: { color: colors.muted, fontSize: 11.5, lineHeight: 17, marginTop: 3 },
  statusLine: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 5, paddingTop: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.good },
  statusDotError: { backgroundColor: colors.warn },
  statusText: { flex: 1, color: colors.muted, fontSize: 10.5 },
  tabs: { minHeight: 72, flexDirection: "row", paddingHorizontal: 10, paddingTop: 9, paddingBottom: 13, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.navy900 },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4 },
  tabLabel: { color: colors.muted, fontSize: 10.5, fontWeight: "600" },
  tabLabelActive: { color: colors.gold },
  welcomeHeader: { minHeight: 68, paddingHorizontal: spacing.lg, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  markRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  signInButton: { height: 40, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 13, borderRadius: 20, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  signInText: { color: colors.ice, fontSize: 12.5, fontWeight: "600" },
  welcomeContent: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 26, paddingTop: 18, paddingBottom: 34 },
  halo: { alignSelf: "center", width: 176, height: 176, borderRadius: 88, alignItems: "center", justifyContent: "center", marginBottom: 20, backgroundColor: colors.periwinkleFill },
  welcomeTitle: { color: colors.ice, fontFamily: "Georgia", fontSize: 32, lineHeight: 38, maxWidth: 390 },
  welcomeBody: { color: colors.textSoft, fontSize: 14.5, lineHeight: 22, marginTop: 12 },
  promiseList: { marginTop: 25, gap: 15 },
  promiseRow: { flexDirection: "row", gap: 13, alignItems: "center" },
  promiseIcon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  promiseCopy: { flex: 1 },
  promiseTitle: { color: colors.ice, fontSize: 14, fontWeight: "700" },
  promiseBody: { color: colors.muted, fontSize: 11.5, lineHeight: 17, marginTop: 2 },
  welcomeStatus: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 20, padding: 12, borderRadius: radii.md, backgroundColor: colors.surface },
  welcomeStatusText: { flex: 1, color: colors.textSoft, fontSize: 11.5, lineHeight: 17 },
  welcomePrimary: { minHeight: 54, marginTop: 22, borderRadius: radii.md, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, backgroundColor: colors.gold },
  welcomePrimaryText: { color: colors.navy950, fontSize: 15, fontWeight: "700" },
  welcomeSecondary: { minHeight: 44, alignItems: "center", justifyContent: "center", marginTop: 5 },
  welcomeSecondaryText: { color: colors.textSoft, fontSize: 12.5, fontWeight: "600" },
  disabled: { opacity: 0.55 }
});
