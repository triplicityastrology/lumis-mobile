import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { CustomerDiceRitualRoute } from "../features/dice/CustomerDiceRitualRoute";
import { colors } from "../theme/tokens";

export function FounderLiveMobileDiceRoute() {
  const [note, setNote] = useState("Live gateway candidate");
  const build = process.env.EXPO_PUBLIC_LUMIS_SOURCE_COMMIT ?? "unavailable";

  return (
    <View style={styles.root}>
      <View accessibilityLabel={`Founder Dice build ${build}`} style={styles.evidenceStrip}>
        <Text numberOfLines={1} style={styles.evidenceText}>{note} · {build}</Text>
      </View>
      <View style={styles.productPixels}>
        <CustomerDiceRitualRoute
          onBack={() => undefined}
          onNotifications={() => undefined}
          onReflect={() => setNote("Reflect in Chat selected explicitly")}
          onSelectTab={() => undefined}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.navy950, flex: 1 },
  evidenceStrip: { backgroundColor: "#071422", minHeight: 24, paddingHorizontal: 10, paddingVertical: 4 },
  evidenceText: { color: colors.muted, fontSize: 10, letterSpacing: 0 },
  productPixels: { flex: 1, minHeight: 0 },
});
