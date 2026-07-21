import { useMemo, useState } from "react";
import {
  Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View
} from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { colors, radii, spacing } from "../../theme/tokens";
import { CelestialBackground } from "../../components/CelestialBackground";
import {
  GhostButton, QuietEmptyState, RetryCard, ScreenHeader, SkeletonRow, SoftButton
} from "../../components/states/StateKit";

/**
 * Notification Center (AC-UX-10). Real, interactive states: loading → error →
 * empty → populated; carer requests with accept/decline/resolved lifecycle;
 * read-only Care Circle notices; system rows; mark-all-read; grouping.
 * Backend later wires real delivery/read/resolved; UI ships on mock data.
 */

export type NotifType =
  | "carer_request" | "missed_checkin" | "need_help" | "care_active" | "care_removed"
  | "push_permission" | "system";

export type NotifItem = {
  id: string;
  type: NotifType;
  title: string;
  context?: string;
  time: string;
  ageDays: number;
  unread: boolean;
  action?: "accept_decline" | "deeplink";
  resolved?: "accepted" | "declined";
};

const MOCK: NotifItem[] = [
  { id: "n1", type: "carer_request", title: "Ruby wants to add you as a carer.",
    context: "You'll receive gentle check-in notices if they miss a check-in. You can accept or decline.",
    time: "Just now", ageDays: 0, unread: true, action: "accept_decline" },
  { id: "n2", type: "missed_checkin", title: "Ruby hasn't responded to the latest check-in.",
    context: "You may want to reach out directly.", time: "2h ago", ageDays: 0, unread: true },
  { id: "n4", type: "care_active", title: "You're now connected as a carer for Alex.",
    time: "3 days ago", ageDays: 3, unread: false },
  { id: "n5", type: "push_permission", title: "Notifications are off.",
    context: "Turn them on so Care Circle notices can reach you.", time: "Last week", ageDays: 7, unread: false, action: "deeplink" }
];

type DemoMode = "loading" | "error" | "empty" | "populated";

function NotifIcon({ type, size = 16 }: { type: NotifType; size?: number }) {
  const warm = type === "need_help" || type === "missed_checkin";
  const stroke = warm ? "#E9B083" : colors.gold;
  const c = { stroke, strokeWidth: 1.5, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const glyph: Record<NotifType, React.ReactNode> = {
    carer_request: <Path d="M4 13c1-1.6 3-2 4.5-1M4 13c0 2.4 2.4 4 4.8 4M20 13c-1-1.6-3-2-4.5-1M20 13c0 2.4-2.4 4-4.8 4" {...c} />,
    missed_checkin: <><Circle cx="12" cy="12" r="7.5" {...c} /><Path d="M12 8v4.5l3 1.5" {...c} /></>,
    need_help: <><Circle cx="12" cy="12" r="7.5" {...c} /><Path d="M12 8v5M12 16h.01" {...c} /></>,
    care_active: <><Circle cx="12" cy="12" r="7.5" {...c} /><Path d="M8.5 12.2l2.4 2.3 4.6-5" {...c} /></>,
    care_removed: <><Circle cx="12" cy="12" r="7.5" {...c} /><Path d="M9 12h6" {...c} /></>,
    push_permission: <><Path d="M7 10a5 5 0 0 1 10 0c0 4 1.5 5 2 6H5c.5-1 2-2 2-6Z" {...c} /><Path d="M10.5 19a1.6 1.6 0 0 0 3 0" {...c} /></>,
    system: <><Circle cx="12" cy="12" r="7.5" {...c} /><Path d="M12 8v5M12 16h.01" {...c} /></>
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      {glyph[type]}
    </Svg>
  );
}

function Row({
  item, onAccept, onDecline, onDeeplink
}: { item: NotifItem; onAccept: () => void; onDecline: () => void; onDeeplink: () => void }) {
  const warm = item.type === "need_help" || item.type === "missed_checkin";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.title} ${item.context ?? ""} ${item.time}`}
      onPress={item.action === "deeplink" ? onDeeplink : undefined}
      style={[s.row, item.unread && s.rowUnread]}
    >
      {item.unread ? <View style={s.unreadDot} /> : null}
      <View style={[s.iconChip, warm && s.iconChipWarm]}>
        <NotifIcon type={item.type} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitle}>{item.title}</Text>
        {item.context ? <Text style={s.rowCtx}>{item.context}</Text> : null}
        <Text style={s.rowTime}>{item.time}</Text>
        {item.action === "accept_decline" ? (
          item.resolved ? (
            <Text style={s.resolved}>{item.resolved === "accepted" ? "Request accepted" : "Request declined"}</Text>
          ) : (
            <View style={s.actionRow}>
              <Pressable onPress={onAccept} hitSlop={6}><Text style={s.accept}>Accept</Text></Pressable>
              <Pressable onPress={onDecline} hitSlop={6}><Text style={s.decline}>Decline</Text></Pressable>
            </View>
          )
        ) : null}
      </View>
    </Pressable>
  );
}

export function NotificationCenterScreen({
  onBack
}: { onBack: () => void }) {
  const [demo, setDemo] = useState<DemoMode>("populated");
  const [items, setItems] = useState<NotifItem[]>(MOCK);

  const unreadCount = items.filter((i) => i.unread).length;
  const groups = useMemo(() => {
    const fresh = items.filter((i) => i.ageDays < 2);
    const earlier = items.filter((i) => i.ageDays >= 2);
    return { fresh, earlier };
  }, [items]);

  function resolve(id: string, kind: "accepted" | "declined") {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, resolved: kind, unread: false } : i)));
  }
  function markAllRead() {
    setItems((prev) => prev.map((i) => ({ ...i, unread: false })));
  }
  function deeplink(_item: NotifItem) {}

  return (
    <SafeAreaView style={s.safe}>
      <CelestialBackground />
      <ScreenHeader
        title="Notifications"
        onBack={onBack}
        right={unreadCount > 0 ? <View style={s.badge}><Text style={s.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text></View> : undefined}
      />

      {/* demo switcher — dev only; shows each designed state. Remove when backend wires real data. */}
      <View style={s.demoBar}>
        {(["populated", "empty", "loading", "error"] as DemoMode[]).map((m) => (
          <Pressable key={m} onPress={() => setDemo(m)} style={[s.demoChip, demo === m && s.demoChipOn]}>
            <Text style={[s.demoChipText, demo === m && s.demoChipTextOn]}>{m}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {demo === "loading" ? (
          <View style={s.list}>{[0, 1, 2].map((i) => <SkeletonRow key={i} />)}</View>
        ) : demo === "error" ? (
          <RetryCard
            title="We couldn't load your notices."
            sub="Check your connection and try again."
            onRetry={() => setDemo("populated")}
          />
        ) : demo === "empty" ? (
          <QuietEmptyState
            motif="bell"
            title="You're all caught up."
            sub="New notices from Care Circle and your account will appear here."
          />
        ) : (
          <>
            {unreadCount > 0 ? (
              <SoftButton label="Mark all as read" onPress={markAllRead} style={{ marginBottom: 14 }} />
            ) : null}
            {groups.fresh.length > 0 ? (
              <>
                <Text style={s.groupLabel}>New</Text>
                <View style={s.list}>
                  {groups.fresh.map((i) => (
                    <Row key={i.id} item={i} onAccept={() => resolve(i.id, "accepted")} onDecline={() => resolve(i.id, "declined")} onDeeplink={() => deeplink(i)} />
                  ))}
                </View>
              </>
            ) : null}
            {groups.earlier.length > 0 ? (
              <>
                <Text style={s.groupLabel}>Earlier</Text>
                <View style={s.list}>
                  {groups.earlier.map((i) => (
                    <Row key={i.id} item={i} onAccept={() => resolve(i.id, "accepted")} onDecline={() => resolve(i.id, "declined")} onDeeplink={() => deeplink(i)} />
                  ))}
                </View>
              </>
            ) : null}
            <GhostButton label="Notifications reach you across Chat, Insights, Dice, and Profile." onPress={() => {}} style={{ marginTop: 8 }} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { backgroundColor: colors.navy950, flex: 1 },
  badge: { alignItems: "center", backgroundColor: colors.gold, borderRadius: 11, height: 22, justifyContent: "center", minWidth: 22, paddingHorizontal: 6 },
  badgeText: { color: colors.navy950, fontSize: 11, fontWeight: "700" },
  demoBar: { flexDirection: "row", gap: 6, paddingBottom: 8, paddingHorizontal: spacing.lg },
  demoChip: { backgroundColor: "rgba(255,255,255,0.04)", borderColor: colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  demoChipOn: { backgroundColor: "rgba(215,185,120,0.16)", borderColor: "rgba(215,185,120,0.4)" },
  demoChipText: { color: colors.muted, fontSize: 10.5, fontWeight: "600" },
  demoChipTextOn: { color: colors.goldLight },
  content: { padding: spacing.lg, paddingTop: 6 },
  groupLabel: { color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 0.8, marginBottom: 8, marginTop: 6, textTransform: "uppercase" },
  list: { backgroundColor: "rgba(58,80,118,0.28)", borderColor: colors.line, borderRadius: radii.lg, borderWidth: 1, overflow: "hidden" },
  row: { alignItems: "flex-start", flexDirection: "row", gap: 12, paddingHorizontal: 14, paddingVertical: 14 },
  rowUnread: { backgroundColor: "rgba(215,185,120,0.05)" },
  unreadDot: { backgroundColor: colors.gold, borderRadius: 2, height: 32, left: 0, position: "absolute", top: 14, width: 3 },
  iconChip: { alignItems: "center", backgroundColor: "rgba(201,169,110,0.12)", borderRadius: 16, height: 32, justifyContent: "center", width: 32 },
  iconChipWarm: { backgroundColor: "rgba(233,176,131,0.14)" },
  rowTitle: { color: colors.ice, fontSize: 13.5, lineHeight: 19 },
  rowCtx: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 3 },
  rowTime: { color: colors.muted, fontSize: 10.5, marginTop: 5 },
  actionRow: { flexDirection: "row", gap: 18, marginTop: 10 },
  accept: { color: colors.gold, fontSize: 13, fontWeight: "700" },
  decline: { color: colors.muted, fontSize: 13, fontWeight: "600" },
  resolved: { color: colors.muted, fontSize: 12, fontStyle: "italic", marginTop: 8 }
});
