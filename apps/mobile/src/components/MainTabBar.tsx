import Compass from "lucide-react-native/icons/compass";
import Dices from "lucide-react-native/icons/dices";
import MessageCircle from "lucide-react-native/icons/message-circle";
import UserRound from "lucide-react-native/icons/user-round";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "../theme/tokens";

export type MainTab = "chat" | "insights" | "dice" | "profile";

export function MainTabBar({
  active,
  onSelect
}: {
  active: MainTab;
  onSelect: (tab: MainTab) => void;
}) {
  const tabs = [
    { id: "chat" as const, label: "Talk", Icon: MessageCircle },
    { id: "insights" as const, label: "Insights", Icon: Compass },
    { id: "dice" as const, label: "Dice", Icon: Dices },
    { id: "profile" as const, label: "You", Icon: UserRound }
  ];

  return (
    <View style={styles.tabs} accessibilityRole="tablist">
      {tabs.map(({ id, label, Icon }) => {
        const selected = id === active;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={id}
            onPress={() => onSelect(id)}
            style={styles.tab}
          >
            <Icon color={selected ? colors.gold : colors.muted} size={22} strokeWidth={selected ? 2 : 1.6} />
            <Text style={[styles.tabLabel, selected && styles.tabLabelActive]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: {
    backgroundColor: "rgba(6,16,28,0.96)",
    borderTopColor: colors.line,
    borderTopWidth: 1,
    flexDirection: "row",
    minHeight: 72,
    paddingBottom: 7,
    paddingTop: 8
  },
  tab: {
    alignItems: "center",
    flex: 1,
    gap: 4,
    justifyContent: "center",
    minWidth: 0
  },
  tabLabel: {
    color: colors.muted,
    fontSize: 10.5,
    fontWeight: "600"
  },
  tabLabelActive: {
    color: colors.gold
  }
});
