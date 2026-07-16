import type { ReactNode } from "react";
import { useState } from "react";
import {
  Bell,
  CalendarDays,
  ChevronRight,
  Clock3,
  Compass,
  Download,
  Headphones,
  LogOut,
  MapPin,
  QrCode,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
  Users
} from "lucide-react-native";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Switch, Text, View } from "react-native";

import type { PersonaStyleKey } from "@lumis/shared";

import { CelestialBackground } from "../components/CelestialBackground";
import { MainTabBar, type MainTab } from "../components/MainTabBar";
import { colors, spacing } from "../theme/tokens";

export function LumisProfileScreen({
  birthDate,
  birthPlace,
  birthTime,
  email,
  name,
  personaStyle,
  remainingCredits,
  timeUnknown,
  onAccount,
  onBirthDetails,
  onCareCircle,
  onNotifications,
  onPersona,
  onPlans,
  onSelectTab
}: {
  birthDate: string;
  birthPlace: string;
  birthTime: string;
  email?: string;
  name: string;
  personaStyle: PersonaStyleKey;
  remainingCredits: number;
  timeUnknown: boolean;
  onAccount: () => void;
  onBirthDetails: () => void;
  onCareCircle: () => void;
  onNotifications: () => void;
  onPersona: () => void;
  onPlans: () => void;
  onSelectTab: (tab: MainTab) => void;
}) {
  const [checkInEnabled, setCheckInEnabled] = useState(false);
  const [notice, setNotice] = useState("");
  const showPendingNotice = (label: string) => setNotice(`${label} will be connected after its security review is complete.`);

  return (
    <SafeAreaView style={styles.safe}>
      <CelestialBackground />
      <View style={styles.frame}>
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
          <Pressable style={styles.iconButton} onPress={onNotifications} accessibilityLabel="Notifications">
            <Bell color={colors.ice} size={19} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{name.trim().slice(0, 1).toUpperCase() || "L"}</Text></View>
            <View style={styles.heroCopy}>
              <Text style={styles.name}>{name}</Text>
              <View style={styles.memberBadge}><Sparkles color={colors.gold} size={12} /><Text style={styles.memberText}>Starter member</Text></View>
            </View>
          </View>

          <ProfileSection label="YOUR CHART">
            <ProfileRow icon={<CalendarDays color={colors.periwinkle} size={17} />} label="Birth date" value={birthDate} onPress={onBirthDetails} />
            <ProfileRow icon={<Clock3 color={colors.periwinkle} size={17} />} label="Birth time" value={timeUnknown ? "Unknown" : birthTime} onPress={onBirthDetails} />
            <ProfileRow icon={<MapPin color={colors.periwinkle} size={17} />} label="Birthplace" value={birthPlace} onPress={onBirthDetails} />
          </ProfileSection>

          <ProfileSection label="LUMIS PERSONA">
            <View style={styles.personaRow}>
              <View style={styles.personaAvatar}><Sparkles color={colors.ice} size={19} /></View>
              <View style={styles.rowCopy}><Text style={styles.rowLabel}>Lumis</Text><Text style={styles.rowValue}>{formatPersona(personaStyle)}</Text></View>
              <Pressable style={styles.changeButton} onPress={onPersona}><Text style={styles.changeText}>Change</Text></Pressable>
            </View>
            <ProfileRow icon={<Compass color={colors.periwinkle} size={17} />} label="Main focus" value="Personal growth" showChevron={false} />
          </ProfileSection>

          <ProfileSection label="PLAN">
            <ProfileRow icon={<Sparkles color={colors.gold} size={17} />} label="Plan" value="Starter" onPress={onPlans} />
            <ProfileRow icon={<UserRound color={colors.gold} size={17} />} label="Credit balance" value={`${remainingCredits} credits`} onPress={onPlans} />
          </ProfileSection>

          <ProfileSection label="CARE CIRCLE" note="Preview only. Check-ins and carer links are not active yet.">
            <View style={styles.switchRow}>
              <View style={styles.rowIcon}><Bell color={colors.periwinkle} size={17} /></View>
              <Text style={styles.switchLabel}>Enable check-in reminders</Text>
              <Switch
                accessibilityLabel="Enable check-in reminders"
                onValueChange={setCheckInEnabled}
                thumbColor={checkInEnabled ? colors.ice : colors.muted}
                trackColor={{ false: colors.line, true: colors.gold }}
                value={checkInEnabled}
              />
            </View>
            <ProfileRow icon={<Clock3 color={colors.periwinkle} size={17} />} label="Check-in frequency" value="Every 3 days" onPress={checkInEnabled ? onCareCircle : undefined} showChevron={checkInEnabled} />
            <ProfileRow icon={<UserRound color={colors.periwinkle} size={17} />} label="Emergency contact" value="Not set" onPress={onCareCircle} />
            <ProfileRow icon={<QrCode color={colors.periwinkle} size={17} />} label="My carer QR code" onPress={onCareCircle} />
            <ProfileRow icon={<QrCode color={colors.periwinkle} size={17} />} label="Add a carer" onPress={onCareCircle} />
            <ProfileRow icon={<Users color={colors.periwinkle} size={17} />} label="Manage linked Care Circle" onPress={onCareCircle} />
          </ProfileSection>

          <ProfileSection label="PRIVACY & SUPPORT">
            <ProfileRow icon={<Bell color={colors.periwinkle} size={17} />} label="Notifications" onPress={onNotifications} />
            <ProfileRow icon={<ShieldCheck color={colors.periwinkle} size={17} />} label="Data Sanctuary & Support" onPress={() => setNotice("Your birth data and reflections remain linked to your private account.")} />
            <ProfileRow icon={<Headphones color={colors.periwinkle} size={17} />} label="Contact support" onPress={() => showPendingNotice("Contact support")} />
            <ProfileRow icon={<Download color={colors.periwinkle} size={17} />} label="Export my data" onPress={() => showPendingNotice("Data export")} />
            <ProfileRow danger icon={<Trash2 color={colors.warn} size={17} />} label="Delete account" onPress={() => showPendingNotice("Account deletion")} />
          </ProfileSection>

          {notice ? <Pressable onPress={() => setNotice("")} style={styles.notice}><Text style={styles.noticeText}>{notice}</Text><Text style={styles.noticeDismiss}>Dismiss</Text></Pressable> : null}

          <Pressable style={styles.accountButton} onPress={onAccount}>
            <LogOut color={colors.textSoft} size={18} />
            <View><Text style={styles.accountButtonText}>{email ? "Manage sign-in" : "Save this profile"}</Text>{email ? <Text style={styles.accountEmail}>{email}</Text> : null}</View>
          </Pressable>

          <Text style={styles.disclaimer}>Lumis offers reflective AI and astrology-based guidance. It is not a replacement for professional medical, legal, financial, or mental-health advice.</Text>
        </ScrollView>

        <MainTabBar active="profile" onSelect={onSelectTab} />
      </View>
    </SafeAreaView>
  );
}

function ProfileSection({ children, label, note }: { children: ReactNode; label: string; note?: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.rows}>{children}</View>
      {note ? <Text style={styles.sectionNote}>{note}</Text> : null}
    </View>
  );
}

function ProfileRow({
  danger = false,
  icon,
  label,
  onPress,
  showChevron = true,
  value
}: {
  danger?: boolean;
  icon: ReactNode;
  label: string;
  onPress?: () => void;
  showChevron?: boolean;
  value?: string;
}) {
  return (
    <Pressable disabled={!onPress} onPress={onPress} style={styles.row}>
      <View style={[styles.rowIcon, danger && styles.rowIconDanger]}>{icon}</View>
      <View style={styles.rowCopy}><Text style={[styles.rowLabel, danger && styles.dangerText]}>{label}</Text></View>
      {value ? <Text numberOfLines={1} style={[styles.rowTrailing, danger && styles.dangerText]}>{value}</Text> : null}
      {showChevron && onPress ? <ChevronRight color={danger ? colors.warn : colors.muted} size={17} /> : null}
    </Pressable>
  );
}

function formatPersona(value: PersonaStyleKey) {
  return value === "spark" ? "Spark" : value === "awareness" ? "Awareness" : "Acceptance";
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.navy950, flex: 1 },
  frame: { alignSelf: "center", flex: 1, maxWidth: 480, width: "100%" },
  header: { alignItems: "center", borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", minHeight: 64, paddingHorizontal: spacing.lg },
  title: { color: colors.ice, fontFamily: "Georgia", fontSize: 23 },
  iconButton: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 20, borderWidth: 1, height: 40, justifyContent: "center", width: 40 },
  content: { gap: 20, padding: spacing.lg, paddingBottom: 32 },
  hero: { alignItems: "center", flexDirection: "row", gap: 13, paddingVertical: 5 },
  avatar: { alignItems: "center", backgroundColor: colors.gold, borderRadius: 28, height: 56, justifyContent: "center", width: 56 },
  avatarText: { color: colors.navy950, fontFamily: "Georgia", fontSize: 25 },
  heroCopy: { flex: 1, minWidth: 0 },
  name: { color: colors.ice, fontFamily: "Georgia", fontSize: 23 },
  memberBadge: { alignItems: "center", alignSelf: "flex-start", backgroundColor: "rgba(201,169,110,0.12)", borderRadius: 10, flexDirection: "row", gap: 5, marginTop: 5, paddingHorizontal: 8, paddingVertical: 4 },
  memberText: { color: colors.goldLight, fontSize: 10.5 },
  section: { gap: 7 },
  sectionLabel: { color: colors.muted, fontSize: 9, fontWeight: "700", letterSpacing: 1.4 },
  sectionNote: { color: colors.muted, fontSize: 10, lineHeight: 15, paddingHorizontal: 3 },
  rows: { backgroundColor: "rgba(21,41,67,0.9)", borderColor: colors.line, borderRadius: 8, borderWidth: 1, overflow: "hidden" },
  row: { alignItems: "center", borderTopColor: colors.lineSoft, borderTopWidth: 1, flexDirection: "row", gap: 10, minHeight: 58, paddingHorizontal: 13 },
  rowIcon: { alignItems: "center", backgroundColor: colors.periwinkleFill, borderRadius: 8, height: 32, justifyContent: "center", width: 32 },
  rowIconDanger: { backgroundColor: "rgba(211,107,93,0.12)" },
  rowCopy: { flex: 1, minWidth: 0 },
  rowLabel: { color: colors.ice, fontSize: 13, fontWeight: "600" },
  rowValue: { color: colors.muted, fontSize: 10.5, marginTop: 3 },
  rowTrailing: { color: colors.textSoft, flexShrink: 1, fontSize: 11.5, maxWidth: "45%", textAlign: "right" },
  dangerText: { color: colors.warn },
  personaRow: { alignItems: "center", flexDirection: "row", gap: 11, minHeight: 70, paddingHorizontal: 13 },
  personaAvatar: { alignItems: "center", backgroundColor: colors.periwinkle, borderRadius: 23, height: 46, justifyContent: "center", width: 46 },
  changeButton: { backgroundColor: colors.periwinkleFill, borderColor: colors.line, borderRadius: 8, borderWidth: 1, minHeight: 38, paddingHorizontal: 13, justifyContent: "center" },
  changeText: { color: colors.ice, fontSize: 11.5, fontWeight: "700" },
  switchRow: { alignItems: "center", flexDirection: "row", gap: 10, minHeight: 58, paddingHorizontal: 13 },
  switchLabel: { color: colors.ice, flex: 1, fontSize: 13, fontWeight: "600" },
  notice: { backgroundColor: colors.periwinkleFill, borderColor: colors.line, borderRadius: 8, borderWidth: 1, padding: 13 },
  noticeText: { color: colors.textSoft, fontSize: 11.5, lineHeight: 17 },
  noticeDismiss: { color: colors.gold, fontSize: 10.5, fontWeight: "700", marginTop: 7 },
  accountButton: { alignItems: "center", alignSelf: "center", flexDirection: "row", gap: 9, minHeight: 48 },
  accountButtonText: { color: colors.textSoft, fontSize: 12.5, fontWeight: "700" },
  accountEmail: { color: colors.muted, fontSize: 9.5, marginTop: 2, maxWidth: 260 },
  disclaimer: { color: colors.muted, fontSize: 9.5, lineHeight: 15, textAlign: "center" }
});
