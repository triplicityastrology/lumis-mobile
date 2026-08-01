import type { ReactElement, ReactNode } from "react";
import { Children, cloneElement, isValidElement, useState } from "react";
import Bell from "lucide-react-native/icons/bell";
import CalendarDays from "lucide-react-native/icons/calendar-days";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import Clock3 from "lucide-react-native/icons/clock-3";
import Compass from "lucide-react-native/icons/compass";
import Headphones from "lucide-react-native/icons/headphones";
import LogOut from "lucide-react-native/icons/log-out";
import MapPin from "lucide-react-native/icons/map-pin";
import ShieldCheck from "lucide-react-native/icons/shield-check";
import Trash2 from "lucide-react-native/icons/trash-2";
import UserRound from "lucide-react-native/icons/user-round";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { PersonaStyleKey } from "@lumis/shared";

import { FrostedCard } from "../components/FrostedCard";
import { UnavailablePill } from "../components/states/StateKit";
import { LumisPersonaAvatar } from "../components/LumisPersonaAvatar";
import { MainTabBar, type MainTab } from "../components/MainTabBar";
import { colors, spacing } from "../theme/tokens";

export function LumisProfileScreen({
  birthDate,
  birthPlace,
  birthTime,
  email,
  mainFocus,
  name,
  personaAvatarKey,
  personaName,
  personaStyle,
  timeUnknown,
  onAccount,
  onBirthDetails,
  onCareCircle,
  onNotifications,
  onPersona,
  onSelectTab,
  onRequestLogout
}: {
  birthDate: string;
  birthPlace: string;
  birthTime: string;
  email?: string;
  mainFocus: string | null;
  name: string;
  personaAvatarKey: string;
  personaName: string;
  personaStyle: PersonaStyleKey;
  timeUnknown: boolean;
  onAccount: () => void;
  onBirthDetails: () => void;
  onCareCircle: () => void;
  onNotifications: () => void;
  onPersona: () => void;
  onSelectTab: (tab: MainTab) => void;
  /** Requests the app-owned, authoritative sign-out confirmation flow. */
  onRequestLogout?: () => void;
}) {
  const [notice, setNotice] = useState("");
  const showPendingNotice = (label: string) => setNotice(`${label} will be connected after its security review is complete.`);

  return (
    <View style={styles.safe}>
      <View style={styles.frame}>
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
          <Pressable style={styles.iconButton} onPress={onNotifications} accessibilityLabel="Notifications">
            <Bell color={colors.ice} size={19} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          contentInsetAdjustmentBehavior="never"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{name.trim().slice(0, 1).toUpperCase() || "L"}</Text></View>
            <View style={styles.heroCopy}>
              <Text style={styles.name}>{name}</Text>
              {email ? (
                <View style={styles.heroBadge}>
                  <Text style={styles.heroBadgeText}>Private account</Text>
                </View>
              ) : null}
            </View>
          </View>

          <ProfileSection label="YOUR CHART">
            <ProfileRow icon={<CalendarDays color={colors.accent} size={17} />} label="Birth date" value={birthDate} onPress={onBirthDetails} />
            <ProfileRow icon={<Clock3 color={colors.accent} size={17} />} label="Birth time" value={timeUnknown ? "Unknown" : birthTime} onPress={onBirthDetails} />
            <ProfileRow icon={<MapPin color={colors.accent} size={17} />} label="Birthplace" value={birthPlace} onPress={onBirthDetails} />
          </ProfileSection>

          <ProfileSection label="LUMIS PERSONA">
            <View style={styles.personaRow}>
              <View style={styles.personaAvatar}>
                <LumisPersonaAvatar avatarKey={personaAvatarKey} size={46} />
              </View>
              <View style={styles.rowCopy}><Text style={styles.rowLabel}>{personaName}</Text><Text style={styles.rowValue}>{formatPersona(personaStyle)}</Text></View>
              <Pressable style={styles.changeButton} onPress={onPersona}><Text style={styles.changeText}>Change</Text></Pressable>
            </View>
            <ProfileRow icon={<Compass color={colors.accent} size={17} />} label="Main focus" value={formatMainFocus(mainFocus)} showChevron={false} />
          </ProfileSection>

          <ProfileSection label="CARE CIRCLE" note="Preview only. Check-ins and carer links are not active yet.">
            <ProfileRow
              icon={<Bell color={colors.accent} size={17} />}
              label="Care Circle preview"
              value="Not active yet"
              onPress={onCareCircle}
            />
          </ProfileSection>

          <ProfileSection label="PRIVACY & SUPPORT">
            <ProfileRow icon={<Bell color={colors.accent} size={17} />} label="Notifications" onPress={onNotifications} />
            <ProfileRow icon={<ShieldCheck color={colors.accent} size={17} />} label="Data Sanctuary & Support" onPress={() => setNotice("Your birth data and reflections remain linked to your private account.")} />
            <ProfileRow icon={<Headphones color={colors.accent} size={17} />} label="Contact support" onPress={() => showPendingNotice("Contact support")} />
            <ProfileRow danger icon={<Trash2 color={colors.warnSolid} size={17} />} label="Delete account" unavailable onPress={() => showPendingNotice("Account deletion")} />
          </ProfileSection>

          {notice ? <Pressable onPress={() => setNotice("")} style={styles.notice}><Text style={styles.noticeText}>{notice}</Text><Text style={styles.noticeDismiss}>Dismiss</Text></Pressable> : null}

          <Pressable style={styles.accountButton} onPress={onAccount} accessibilityRole="button">
            <UserRound color={colors.textSoft} size={18} />
            <View><Text style={styles.accountButtonText}>{email ? "Manage sign-in" : "Save this profile"}</Text>{email ? <Text style={styles.accountEmail}>{email}</Text> : null}</View>
          </Pressable>

          {/* S1-C01: obvious, confirmed Log out for signed-in users. Only shown once
              the real handler is wired in (never a navigation-only fake). */}
          {email && onRequestLogout ? (
            <Pressable
              style={styles.logoutButton}
              onPress={onRequestLogout}
              accessibilityRole="button"
              accessibilityLabel="Log out of Lumis"
            >
              <LogOut color={colors.warnSolid} size={18} />
              <Text style={styles.logoutButtonText}>Log out</Text>
            </Pressable>
          ) : null}

          <Text style={styles.disclaimer}>Lumis offers reflective AI and astrology-based guidance. It is not a replacement for professional medical, legal, financial, or mental-health advice.</Text>
        </ScrollView>

        <MainTabBar active="profile" onSelect={onSelectTab} />
      </View>

    </View>
  );
}

function ProfileSection({ children, label, note }: { children: ReactNode; label: string; note?: string }) {
  // SPEC PROF-001: the between-row hairline must not appear on the first child.
  // Drop the top border on the first ProfileRow of the group (inline non-row
  // children, e.g. the persona row, already omit it).
  const items = Children.toArray(children);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {/* PROF-001 (RULE 1): each group is genuine frosted glass; rows stay
          transparent inside, and overflow:hidden clips the sky at the corners. */}
      <FrostedCard style={styles.rows} radius={18}>
        {items.map((child, index) =>
          index === 0 && isValidElement(child) && child.type === ProfileRow
            ? cloneElement(child as ReactElement<ProfileRowProps>, { first: true })
            : child
        )}
      </FrostedCard>
      {note ? <Text style={styles.sectionNote}>{note}</Text> : null}
    </View>
  );
}

type ProfileRowProps = {
  danger?: boolean;
  first?: boolean;
  icon: ReactNode;
  label: string;
  onPress?: () => void;
  showChevron?: boolean;
  value?: string;
  unavailable?: boolean;
};

function ProfileRow({
  danger = false,
  first = false,
  icon,
  label,
  onPress,
  showChevron = true,
  value,
  unavailable = false
}: ProfileRowProps) {
  return (
    <Pressable
      accessibilityLabel={value ? `${label}: ${value}` : label}
      accessibilityRole={onPress ? "button" : "text"}
      accessibilityHint={unavailable ? "Currently unavailable" : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={[styles.row, first && styles.rowFirst]}
    >
      <View style={[styles.rowIcon, danger && styles.rowIconDanger]}>{icon}</View>
      <View style={styles.rowCopy}><Text style={[styles.rowLabel, danger && styles.dangerText, unavailable && styles.rowLabelMuted]}>{label}</Text></View>
      {unavailable ? (
        <UnavailablePill />
      ) : (
        <>
          {value ? <Text numberOfLines={2} style={[styles.rowTrailing, danger && styles.dangerText]}>{value}</Text> : null}
          {showChevron && onPress ? <ChevronRight color={danger ? colors.warnSolid : colors.muted} size={17} /> : null}
        </>
      )}
    </Pressable>
  );
}

function formatPersona(value: PersonaStyleKey) {
  return value === "spark" ? "Spark" : value === "awareness" ? "Awareness" : "Acceptance";
}

function formatMainFocus(value: string | null) {
  if (!value?.trim()) return "Not set";
  return value
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const styles = StyleSheet.create({
  safe: { backgroundColor: "transparent", flex: 1 },
  frame: { alignSelf: "center", flex: 1, maxWidth: 480, width: "100%" },
  header: { alignItems: "center", borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", minHeight: 64, paddingHorizontal: spacing.lg },
  title: { color: colors.ice, fontFamily: "Georgia", fontSize: 23 },
  iconButton: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 20, borderWidth: 1, height: 40, justifyContent: "center", width: 40 },
  content: { gap: 20, padding: spacing.lg, paddingBottom: 32 },
  hero: { alignItems: "center", flexDirection: "row", gap: 13, paddingVertical: 5 },
  avatar: { alignItems: "center", backgroundColor: colors.gold, borderRadius: 28, height: 56, justifyContent: "center", width: 56 },
  avatarText: { color: colors.navy950, fontFamily: "Georgia", fontSize: 25 },
  heroCopy: { flex: 1, minWidth: 0, gap: 7 },
  name: { color: colors.ice, fontFamily: "Georgia", fontSize: 24 },
  heroBadge: { alignSelf: "flex-start", backgroundColor: colors.accentFill, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 },
  heroBadgeText: { color: colors.accent, fontSize: 11.5, fontWeight: "600" },
  section: { gap: 7 },
  sectionLabel: { color: colors.muted, fontSize: 9, fontWeight: "700", letterSpacing: 1.4 },
  sectionNote: { color: colors.muted, fontSize: 10, lineHeight: 15, paddingHorizontal: 3 },
  rows: { backgroundColor: "transparent" },
  row: { alignItems: "center", backgroundColor: "transparent", borderTopColor: colors.lineSoft, borderTopWidth: 1, flexDirection: "row", gap: 12, minHeight: 58, paddingHorizontal: 14 },
  rowFirst: { borderTopWidth: 0 },
  rowIcon: { alignItems: "center", backgroundColor: "rgba(26,53,80,0.60)", borderRadius: 9, height: 30, justifyContent: "center", width: 30 },
  rowIconDanger: { backgroundColor: "rgba(227,142,124,0.14)" },
  rowCopy: { flex: 1, minWidth: 0 },
  rowLabel: { color: colors.ice, fontSize: 13, fontWeight: "600" },
  rowLabelMuted: { color: colors.muted },
  rowValue: { color: colors.muted, fontSize: 10.5, marginTop: 3 },
  rowTrailing: { color: colors.textSoft, flexShrink: 1, fontSize: 11.5, lineHeight: 16, maxWidth: "48%", textAlign: "right" },
  dangerText: { color: colors.warnSolid },
  personaRow: { alignItems: "center", flexDirection: "row", gap: 11, minHeight: 70, paddingHorizontal: 13 },
  personaAvatar: { alignItems: "center", borderRadius: 23, height: 46, justifyContent: "center", width: 46 },
  changeButton: { backgroundColor: colors.periwinkleFill, borderColor: colors.line, borderRadius: 8, borderWidth: 1, minHeight: 38, paddingHorizontal: 13, justifyContent: "center" },
  changeText: { color: colors.ice, fontSize: 11.5, fontWeight: "700" },
  notice: { backgroundColor: colors.periwinkleFill, borderColor: colors.line, borderRadius: 8, borderWidth: 1, padding: 13 },
  noticeText: { color: colors.textSoft, fontSize: 11.5, lineHeight: 17 },
  noticeDismiss: { color: colors.gold, fontSize: 10.5, fontWeight: "700", marginTop: 7 },
  accountButton: { alignItems: "center", alignSelf: "center", flexDirection: "row", gap: 9, minHeight: 48 },
  accountButtonText: { color: colors.textSoft, fontSize: 12.5, fontWeight: "700" },
  accountEmail: { color: colors.muted, fontSize: 9.5, marginTop: 2, maxWidth: 260 },
  // Destructive: stays warn-tinted (translucent navy fill + warn border), never gold.
  logoutButton: { alignItems: "center", alignSelf: "center", backgroundColor: "rgba(22,39,61,0.55)", borderColor: colors.warnSolid, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 8, marginTop: 6, minHeight: 46, paddingHorizontal: 22 },
  logoutButtonText: { color: colors.warnSolid, fontSize: 13.5, fontWeight: "700" },
  disclaimer: { color: colors.muted, fontSize: 9.5, lineHeight: 15, textAlign: "center" }
});
