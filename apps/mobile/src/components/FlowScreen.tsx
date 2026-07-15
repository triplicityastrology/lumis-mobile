import { ChevronLeft } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";

import { colors, radii, spacing } from "../theme/tokens";

export function FlowScreen({
  badge,
  body,
  children,
  eyebrow,
  onBack,
  title
}: {
  badge: string;
  body: string;
  children: ReactNode;
  eyebrow: string;
  onBack: () => void;
  title: string;
}) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.frame}>
        <View style={styles.header}>
          <Pressable style={styles.back} onPress={onBack} accessibilityLabel="Back">
            <ChevronLeft color={colors.ice} size={21} />
          </Pressable>
          <View style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View>
        </View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.eyebrow}>✦ {eyebrow}</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
          <View style={styles.children}>{children}</View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

export const flowStyles = StyleSheet.create({
  field: { gap: 8 },
  fieldLabel: { color: colors.muted, fontSize: 9.5, fontWeight: "700", letterSpacing: 1.5 },
  input: { minHeight: 52, borderRadius: radii.md, paddingHorizontal: 15, color: colors.ice, fontSize: 15.5, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  primaryButton: { minHeight: 54, borderRadius: radii.md, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.gold },
  primaryButtonText: { color: colors.navy950, fontSize: 14.5, fontWeight: "700" },
  secondaryButton: { minHeight: 50, borderRadius: radii.md, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  secondaryButtonText: { color: colors.ice, fontSize: 13.5, fontWeight: "600" },
  note: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 13, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  noteText: { flex: 1, color: colors.textSoft, fontSize: 11.5, lineHeight: 17 },
  success: { padding: 13, borderRadius: radii.md, backgroundColor: "rgba(134,200,166,0.14)", borderWidth: 1, borderColor: "rgba(134,200,166,0.28)" },
  successTitle: { color: colors.good, fontSize: 12.5, fontWeight: "700" },
  message: { color: colors.textSoft, fontSize: 11.5, lineHeight: 17, marginTop: 4 },
  error: { padding: 13, borderRadius: radii.md, backgroundColor: "rgba(224,153,127,0.14)", borderWidth: 1, borderColor: "rgba(224,153,127,0.28)" },
  errorText: { color: colors.warn, fontSize: 11.5, lineHeight: 17 },
  disabled: { opacity: 0.5 }
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy950 },
  frame: { flex: 1, width: "100%", maxWidth: 480, alignSelf: "center", backgroundColor: colors.navy900 },
  header: { minHeight: 64, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  badge: { minHeight: 28, justifyContent: "center", paddingHorizontal: 11, borderRadius: 14, backgroundColor: colors.goldFill, borderWidth: 1, borderColor: colors.line },
  badgeText: { color: colors.gold, fontSize: 9, fontWeight: "700", letterSpacing: 1.2 },
  content: { flexGrow: 1, paddingHorizontal: 26, paddingTop: spacing.md, paddingBottom: 34 },
  eyebrow: { color: colors.gold, fontSize: 9.5, fontWeight: "700", letterSpacing: 1.7 },
  title: { color: colors.ice, fontFamily: "Georgia", fontSize: 31, lineHeight: 37, marginTop: 13 },
  body: { color: colors.textSoft, fontSize: 14, lineHeight: 21, marginTop: 10 },
  children: { marginTop: 25, gap: 13 }
});
