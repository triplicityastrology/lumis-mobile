import Check from "lucide-react-native/icons/check";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppText } from "../components/AppText";
import { GlassCard, SafetyNote, ScreenHeader, SoftButton } from "../components/states/StateKit";
import { ink } from "../theme/typography";

/**
 * SUP-001 — Contact support (unavailable). A reserved destination for any future
 * support link. Signed-off Codex handoff: honestly states support isn't open in
 * this build; nothing pretends to be a working contact button.
 */
const COVERAGE = [
  "Account access and sign-in",
  "Chart or profile issues",
  "Bugs or unexpected behaviour"
];

export function ContactSupportScreen({ onBack }: { onBack: () => void }) {
  return (
    <SafeAreaView edges={["top", "left", "right", "bottom"]} style={styles.safe}>
      <ScreenHeader title="Contact support" onBack={onBack} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <AppText variant="screenTitle" style={styles.title}>Support isn’t available in this build.</AppText>
        <AppText variant="bodyLarge" style={styles.lead}>
          We haven’t opened a support channel yet. If something’s urgent, this screen will connect you when it’s ready.
        </AppText>

        <GlassCard style={styles.card}>
          <AppText variant="fieldLabel" style={styles.cardLabel}>What support will cover</AppText>
          {COVERAGE.map((item) => (
            <View key={item} style={styles.row}>
              <View style={styles.tick}>
                <Check color={ink.gold} size={14} strokeWidth={2.4} />
              </View>
              <AppText variant="body" style={styles.rowText}>{item}</AppText>
            </View>
          ))}
        </GlassCard>

        <SafetyNote text="Once a channel is wired, you’ll see one clear contact action here. Nothing pretends to be a working button in the meantime." />
      </ScrollView>

      <View style={styles.footer}>
        <SoftButton label="Back to Profile" onPress={onBack} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: "transparent", flex: 1 },
  content: { paddingHorizontal: 24, paddingBottom: 24, gap: 14 },
  title: { marginTop: 6 },
  lead: {},
  card: { gap: 12, marginTop: 6 },
  cardLabel: { marginBottom: 2 },
  row: { alignItems: "center", flexDirection: "row", gap: 12 },
  tick: { alignItems: "center", backgroundColor: "rgba(26,53,80,0.60)", borderRadius: 10, height: 30, justifyContent: "center", width: 30 },
  rowText: { flex: 1, color: ink.strong },
  footer: { paddingHorizontal: 20, paddingBottom: 8, paddingTop: 12 }
});
