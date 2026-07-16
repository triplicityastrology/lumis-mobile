import { Bell, Dices, MessageCircle } from "lucide-react-native";
import { useState } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { CelestialBackground } from "../components/CelestialBackground";
import { MainTabBar, type MainTab } from "../components/MainTabBar";
import { colors, radii, spacing } from "../theme/tokens";

const PLANETS = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"];
const SIGNS = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"];
const HOUSES = Array.from({ length: 12 }, (_, index) => `House ${index + 1}`);

export function LumisDiceScreen({
  onNotifications,
  onReflect,
  onSelectTab
}: {
  onNotifications: () => void;
  onReflect: () => void;
  onSelectTab: (tab: MainTab) => void;
}) {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<[string, string, string] | null>(null);

  function roll() {
    setResult([pick(PLANETS), pick(SIGNS), pick(HOUSES)]);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <CelestialBackground />
      <View style={styles.frame}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>ASTROLOGY DICE</Text>
            <Text style={styles.title}>Ask, roll, reflect.</Text>
          </View>
          <Pressable style={styles.iconButton} onPress={onNotifications} accessibilityLabel="Notifications">
            <Bell color={colors.ice} size={19} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>
            Hold one question in mind. The three symbols offer a direction for reflection, not a fixed prediction.
          </Text>
          <TextInput
            multiline
            onChangeText={setQuestion}
            placeholder="What would you like clarity on?"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={question}
          />

          <View style={styles.diceRow}>
            {(result ?? ["Planet", "Sign", "House"]).map((value, index) => (
              <View key={`${value}-${index}`} style={[styles.die, result && styles.dieRolled]}>
                <Text style={styles.dieIndex}>{index + 1}</Text>
                <Text adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={2} style={styles.dieValue}>
                  {value}
                </Text>
              </View>
            ))}
          </View>

          <Pressable
            disabled={!question.trim()}
            onPress={roll}
            style={[styles.rollButton, !question.trim() && styles.disabled]}
          >
            <Dices color={colors.navy950} size={21} />
            <Text style={styles.rollText}>{result ? "Roll again" : "Roll the dice"}</Text>
          </Pressable>

          {result ? (
            <View style={styles.resultCard}>
              <Text style={styles.resultLabel}>YOUR REFLECTION</Text>
              <Text style={styles.resultTitle}>{result.join(" · ")}</Text>
              <Text style={styles.resultBody}>
                Notice where the energy of {result[0]} wants expression through {result[1]}, especially around {result[2].toLowerCase()} themes.
              </Text>
              <Pressable style={styles.reflectButton} onPress={onReflect}>
                <MessageCircle color={colors.gold} size={18} />
                <Text style={styles.reflectText}>Reflect with Lumis</Text>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>

        <MainTabBar active="dice" onSelect={onSelectTab} />
      </View>
    </SafeAreaView>
  );
}

function pick(values: string[]) {
  return values[Math.floor(Math.random() * values.length)];
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.navy950, flex: 1 },
  frame: { alignSelf: "center", flex: 1, maxWidth: 480, width: "100%" },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", minHeight: 76, paddingHorizontal: spacing.lg },
  eyebrow: { color: colors.gold, fontSize: 9.5, fontWeight: "700", letterSpacing: 1.6 },
  title: { color: colors.ice, fontFamily: "Georgia", fontSize: 24, marginTop: 4 },
  iconButton: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 20, borderWidth: 1, height: 40, justifyContent: "center", width: 40 },
  content: { gap: spacing.md, padding: spacing.lg, paddingBottom: 32 },
  intro: { color: colors.textSoft, fontSize: 14, lineHeight: 21 },
  input: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radii.md, borderWidth: 1, color: colors.ice, minHeight: 94, outlineStyle: "none", padding: 14, textAlignVertical: "top" } as never,
  diceRow: { flexDirection: "row", gap: 10, justifyContent: "center", marginVertical: 8 },
  die: { alignItems: "center", aspectRatio: 1, backgroundColor: "rgba(21,41,67,0.86)", borderColor: colors.line, borderRadius: radii.md, borderWidth: 1, flex: 1, justifyContent: "center", maxWidth: 108, minWidth: 0, padding: 8 },
  dieRolled: { borderColor: "rgba(201,169,110,0.55)" },
  dieIndex: { color: colors.muted, fontSize: 9, marginBottom: 8 },
  dieValue: { color: colors.goldLight, fontFamily: "Georgia", fontSize: 16, textAlign: "center" },
  rollButton: { alignItems: "center", backgroundColor: colors.gold, borderRadius: radii.md, flexDirection: "row", gap: 9, justifyContent: "center", minHeight: 54 },
  rollText: { color: colors.navy950, fontSize: 15, fontWeight: "700" },
  disabled: { opacity: 0.45 },
  resultCard: { backgroundColor: "rgba(21,41,67,0.9)", borderColor: colors.line, borderRadius: radii.lg, borderWidth: 1, padding: 17 },
  resultLabel: { color: colors.gold, fontSize: 9.5, fontWeight: "700", letterSpacing: 1.4 },
  resultTitle: { color: colors.ice, fontFamily: "Georgia", fontSize: 21, lineHeight: 28, marginTop: 10 },
  resultBody: { color: colors.textSoft, fontSize: 13.5, lineHeight: 21, marginTop: 8 },
  reflectButton: { alignItems: "center", flexDirection: "row", gap: 8, marginTop: 16, minHeight: 42 },
  reflectText: { color: colors.gold, fontSize: 13.5, fontWeight: "700" }
});
