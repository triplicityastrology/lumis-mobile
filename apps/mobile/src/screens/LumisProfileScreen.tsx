import { Bell, ChevronRight, LogOut, UserRound } from "lucide-react-native";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";

import type { PersonaStyleKey } from "@lumis/shared";

import { CelestialBackground } from "../components/CelestialBackground";
import { MainTabBar, type MainTab } from "../components/MainTabBar";
import { colors, radii, spacing } from "../theme/tokens";

export function LumisProfileScreen({
  email,
  name,
  personaStyle,
  remainingCredits,
  onAccount,
  onBirthDetails,
  onNotifications,
  onPersona,
  onPlans,
  onSelectTab
}: {
  email?: string;
  name: string;
  personaStyle: PersonaStyleKey;
  remainingCredits: number;
  onAccount: () => void;
  onBirthDetails: () => void;
  onNotifications: () => void;
  onPersona: () => void;
  onPlans: () => void;
  onSelectTab: (tab: MainTab) => void;
}) {
  return (
    <SafeAreaView style={styles.safe}>
      <CelestialBackground />
      <View style={styles.frame}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>YOUR SPACE</Text>
            <Text style={styles.title}>Profile</Text>
          </View>
          <Pressable style={styles.iconButton} onPress={onNotifications} accessibilityLabel="Notifications">
            <Bell color={colors.ice} size={19} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.hero}>
            <View style={styles.avatar}><UserRound color={colors.navy950} size={28} /></View>
            <View style={styles.heroCopy}>
              <Text style={styles.name}>{name}</Text>
              <Text numberOfLines={1} style={styles.email}>{email ?? "Local Lumis profile"}</Text>
            </View>
          </View>

          <View style={styles.balanceCard}>
            <View>
              <Text style={styles.balanceLabel}>AVAILABLE CREDITS</Text>
              <Text style={styles.balanceValue}>{remainingCredits}</Text>
            </View>
            <Pressable style={styles.planButton} onPress={onPlans}>
              <Text style={styles.planButtonText}>Plans & access</Text>
              <ChevronRight color={colors.navy950} size={17} />
            </Pressable>
          </View>

          <View style={styles.rows}>
            <ProfileRow label="Lumis Persona" value={formatPersona(personaStyle)} onPress={onPersona} />
            <ProfileRow label="Birth details" value="Review or regenerate" onPress={onBirthDetails} />
            <ProfileRow label="Notifications" value="Care and account alerts" onPress={onNotifications} />
            <ProfileRow label="Account & sign-in" value={email ? "Signed in" : "Local only"} onPress={onAccount} />
          </View>

          <Pressable style={styles.accountButton} onPress={onAccount}>
            <LogOut color={colors.textSoft} size={18} />
            <Text style={styles.accountButtonText}>{email ? "Manage sign-in" : "Save this profile"}</Text>
          </Pressable>
        </ScrollView>

        <MainTabBar active="profile" onSelect={onSelectTab} />
      </View>
    </SafeAreaView>
  );
}

function ProfileRow({ label, onPress, value }: { label: string; onPress: () => void; value: string }) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <View style={styles.rowCopy}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
      <ChevronRight color={colors.muted} size={18} />
    </Pressable>
  );
}

function formatPersona(value: PersonaStyleKey) {
  return value === "spark" ? "Spark" : value === "awareness" ? "Awareness" : "Acceptance";
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.navy950, flex: 1 },
  frame: { alignSelf: "center", flex: 1, maxWidth: 480, width: "100%" },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", minHeight: 76, paddingHorizontal: spacing.lg },
  eyebrow: { color: colors.gold, fontSize: 9.5, fontWeight: "700", letterSpacing: 1.6 },
  title: { color: colors.ice, fontFamily: "Georgia", fontSize: 26, marginTop: 3 },
  iconButton: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 20, borderWidth: 1, height: 40, justifyContent: "center", width: 40 },
  content: { gap: spacing.md, padding: spacing.lg, paddingBottom: 32 },
  hero: { alignItems: "center", backgroundColor: "rgba(21,41,67,0.88)", borderColor: colors.line, borderRadius: radii.lg, borderWidth: 1, flexDirection: "row", gap: 13, padding: 16 },
  avatar: { alignItems: "center", backgroundColor: colors.gold, borderRadius: 25, height: 50, justifyContent: "center", width: 50 },
  heroCopy: { flex: 1, minWidth: 0 },
  name: { color: colors.ice, fontFamily: "Georgia", fontSize: 23 },
  email: { color: colors.textSoft, fontSize: 12, marginTop: 4 },
  balanceCard: { alignItems: "center", backgroundColor: "rgba(201,169,110,0.14)", borderColor: "rgba(201,169,110,0.35)", borderRadius: radii.lg, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", padding: 16 },
  balanceLabel: { color: colors.goldLight, fontSize: 9, fontWeight: "700", letterSpacing: 1.3 },
  balanceValue: { color: colors.ice, fontFamily: "Georgia", fontSize: 30, marginTop: 3 },
  planButton: { alignItems: "center", backgroundColor: colors.gold, borderRadius: radii.md, flexDirection: "row", gap: 4, minHeight: 42, paddingHorizontal: 12 },
  planButtonText: { color: colors.navy950, fontSize: 12, fontWeight: "700" },
  rows: { backgroundColor: "rgba(21,41,67,0.9)", borderColor: colors.line, borderRadius: radii.lg, borderWidth: 1, overflow: "hidden" },
  row: { alignItems: "center", borderTopColor: colors.lineSoft, borderTopWidth: 1, flexDirection: "row", minHeight: 67, paddingHorizontal: 15 },
  rowCopy: { flex: 1, minWidth: 0 },
  rowLabel: { color: colors.ice, fontSize: 14, fontWeight: "700" },
  rowValue: { color: colors.muted, fontSize: 11.5, marginTop: 3 },
  accountButton: { alignItems: "center", alignSelf: "center", flexDirection: "row", gap: 8, minHeight: 44 },
  accountButtonText: { color: colors.textSoft, fontSize: 13, fontWeight: "600" }
});
