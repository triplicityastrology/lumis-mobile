import { BlurView } from "expo-blur";
import Search from "lucide-react-native/icons/search";
import Trash2 from "lucide-react-native/icons/trash-2";
import X from "lucide-react-native/icons/x";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Svg, { Polygon, Text as SvgText } from "react-native-svg";

import { colors, radii, spacing } from "../../theme/tokens";
import { DIE_ORDER, FACE_SETS, type DiceFace, type DieKind } from "./constants";
import { deleteDiceThrow, listDiceThrows } from "../../services/diceThrows";

/**
 * 過往擲骰 · Past Rolls — bottom sheet per the design handoff
 * (design_handoff_dice_history): glass sheet, search, glyph-triple rows,
 * read-only detail view. Data comes from dice_throws; falls back to the
 * current session's rolls in local demo mode.
 */

const TEXT_STYLE = "︎";

export type SessionRoll = {
  question: string | null;
  planetKey: string;
  signKey: string;
  houseKey: string;
  at: number;
};

type HistoryEntry = SessionRoll & { id: string };

const FACE_BY_KEY: Record<DieKind, Map<string, DiceFace>> = {
  planet: new Map(FACE_SETS.planet.map((f) => [f.key, f])),
  sign: new Map(FACE_SETS.sign.map((f) => [f.key, f])),
  house: new Map(FACE_SETS.house.map((f) => [f.key, f]))
};

function faceFor(kind: DieKind, key: string): DiceFace {
  return FACE_BY_KEY[kind].get(key) ?? FACE_SETS[kind][0];
}

function timeAgo(at: number): string {
  const mins = Math.max(0, (Date.now() - at) / 60000);
  if (mins < 5) return "Just now";
  if (mins < 60) return `${Math.round(mins)} min ago`;
  const hours = mins / 60;
  if (hours < 24) return `${Math.round(hours)}h ago`;
  const days = hours / 24;
  if (days < 7) return `${Math.round(days)} day${Math.round(days) > 1 ? "s" : ""} ago`;
  if (days < 14) return "Last week";
  const weeks = Math.round(days / 7);
  return `${weeks} weeks ago`;
}

const FALLBACK_QUESTION = "What should I notice right now?";

function MiniOctaDie({ glyph, size = 28 }: { glyph: string; size?: number }) {
  return (
    <View style={{ height: size, width: size }}>
      <Svg height={size} viewBox="0 0 100 100" width={size}>
        <Polygon fill="#152943" points="50,2 84,16 98,50 84,84 50,98 16,84 2,50 16,16" stroke="#C9A96E" strokeWidth="4" />
        <Polygon fill="none" opacity={0.35} points="50,14 76,24 86,50 76,76 50,86 24,76 14,50 24,24" stroke="#DCC28F" strokeWidth="2" />
        <SvgText fill="#E8DCC0" fontFamily="Georgia" fontSize={40} textAnchor="middle" x={50} y={64}>
          {glyph + TEXT_STYLE}
        </SvgText>
      </Svg>
    </View>
  );
}

export function DiceHistorySheet({
  sessionRolls,
  onClose
}: {
  sessionRolls: SessionRoll[];
  onClose: () => void;
}) {
  const [remote, setRemote] = useState<HistoryEntry[] | null>(null);
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<HistoryEntry | null>(null);
  const [removedIds, setRemovedIds] = useState<string[]>([]);

  async function removeEntry(entry: HistoryEntry) {
    setRemovedIds((prev) => [...prev, entry.id]);
    // Session rolls have synthetic ids; only persisted rows hit the delete service.
    if (!entry.id.startsWith("session-")) await deleteDiceThrow(entry.id);
  }

  useEffect(() => {
    let mounted = true;
    void listDiceThrows().then((rows) => {
      if (!mounted) return;
      setRemote(
        rows.map((row) => ({
          id: row.id,
          question: row.question,
          planetKey: row.planetKey,
          signKey: row.signKey,
          houseKey: row.houseKey,
          at: Date.parse(row.createdAt)
        }))
      );
    });
    return () => {
      mounted = false;
    };
  }, []);

  const entries = useMemo<HistoryEntry[]>(() => {
    const base: HistoryEntry[] =
      remote && remote.length > 0
        ? remote
        : sessionRolls.map((roll, i) => ({ ...roll, id: `session-${i}-${roll.at}` }));
    const q = query.trim().toLowerCase();
    const visible = base.filter((e) => !removedIds.includes(e.id));
    if (!q) return visible;
    return visible.filter((e) => (e.question ?? FALLBACK_QUESTION).toLowerCase().includes(q));
  }, [remote, sessionRolls, query, removedIds]);

  return (
    <View style={styles.overlay}>
      <Pressable accessibilityLabel="Close history" onPress={onClose} style={styles.scrim} />
      <View style={styles.sheetWrap}>
        <BlurView intensity={28} tint="dark" style={styles.sheet}>
          <View style={styles.grab} />
          <View style={styles.headerRow}>
            <View style={styles.headerText}>
              <Text style={styles.title}>Past Rolls</Text>
              <Text style={styles.subtitle}>Your past questions and rolls</Text>
            </View>
            <Pressable accessibilityLabel="Close" onPress={onClose} style={styles.closeButton}>
              <X color={colors.ice} size={18} />
            </Pressable>
          </View>

          {detail ? (
            <ScrollView contentContainerStyle={styles.detailContent}>
              <Text style={styles.detailQuestion}>“{detail.question?.trim() || FALLBACK_QUESTION}”</Text>
              <View style={styles.detailChips}>
                {DIE_ORDER.map((kind) => {
                  const face = faceFor(
                    kind,
                    kind === "planet" ? detail.planetKey : kind === "sign" ? detail.signKey : detail.houseKey
                  );
                  const kindLabel = kind === "planet" ? "PLANET" : kind === "sign" ? "SIGN" : "HOUSE";
                  return (
                    <View key={kind} style={styles.detailChip}>
                      <Text style={styles.chipKind}>{kindLabel}</Text>
                      <Text style={styles.chipGlyph}>{face.glyph + TEXT_STYLE}</Text>
                      <Text style={styles.chipZh}>{face.en}</Text>
                    </View>
                  );
                })}
              </View>
              <Text style={styles.detailDate}>{timeAgo(detail.at)}</Text>
              <Text style={styles.note}>Dice are a mirror for reflection, not a verdict.</Text>
              <Pressable onPress={() => setDetail(null)} style={styles.backButton}>
                <Text style={styles.backText}>Back to rolls</Text>
              </Pressable>
            </ScrollView>
          ) : (
            <>
              <View style={styles.search}>
                <Search color={colors.muted} size={16} />
                <TextInput
                  onChangeText={setQuery}
                  placeholder="Search rolls"
                  placeholderTextColor={colors.muted}
                  style={styles.searchInput}
                  value={query}
                />
              </View>
              <ScrollView style={styles.listScroll}>
                {entries.length === 0 ? (
                  <View style={styles.empty}>
                    <Text style={styles.emptyTitle}>No rolls yet</Text>
                    <Text style={styles.emptySub}>Make your first roll and it will be waiting here.</Text>
                  </View>
                ) : (
                  <View style={styles.listCard}>
                    {entries.map((entry, index) => (
                      <View key={entry.id} style={[styles.row, index > 0 && styles.rowDivider]}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`${entry.question?.trim() || FALLBACK_QUESTION}, ${timeAgo(entry.at)}. View reading.`}
                          onPress={() => setDetail(entry)}
                          style={styles.rowMain}
                        >
                          <View style={styles.rowDice}>
                            <MiniOctaDie glyph={faceFor("planet", entry.planetKey).glyph} />
                            <MiniOctaDie glyph={faceFor("sign", entry.signKey).glyph} />
                            <MiniOctaDie glyph={faceFor("house", entry.houseKey).glyph} />
                          </View>
                          <View style={styles.rowText}>
                            <Text numberOfLines={1} style={styles.rowQuestion}>
                              {entry.question?.trim() || FALLBACK_QUESTION}
                            </Text>
                            <Text style={styles.rowDate}>{timeAgo(entry.at)}</Text>
                          </View>
                          <Text style={styles.rowCta}>View</Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Delete this roll"
                          hitSlop={8}
                          onPress={() => void removeEntry(entry)}
                          style={styles.rowDelete}
                        >
                          <Trash2 color={colors.muted} size={16} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>
            </>
          )}
        </BlurView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-end", zIndex: 30 },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(4,10,20,0.6)" },
  sheetWrap: { borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "86%", overflow: "hidden" },
  sheet: { backgroundColor: "rgba(58,80,118,0.42)", borderColor: "rgba(206,216,255,0.16)", borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, paddingBottom: spacing.lg, paddingHorizontal: spacing.lg, paddingTop: 10 },
  grab: { alignSelf: "center", backgroundColor: "rgba(206,216,255,0.3)", borderRadius: 3, height: 4, marginBottom: 12, width: 42 },
  headerRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  headerText: { flex: 1, paddingRight: 12 },
  title: { color: colors.ice, fontFamily: "Georgia", fontSize: 21 },
  subtitle: { color: "#A2B0C6", fontSize: 11.5, marginTop: 3 },
  closeButton: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.06)", borderColor: "rgba(206,216,255,0.16)", borderRadius: 18, borderWidth: 1, height: 36, justifyContent: "center", width: 36 },
  search: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.045)", borderColor: "rgba(206,216,255,0.16)", borderRadius: radii.md, borderWidth: 1, flexDirection: "row", gap: 8, marginBottom: 12, minHeight: 44, paddingHorizontal: 12 },
  searchInput: { color: colors.ice, flex: 1, fontSize: 14, padding: 0 },
  listScroll: { flexGrow: 0 },
  listCard: { borderColor: "rgba(206,216,255,0.16)", borderRadius: radii.lg, borderWidth: 1, overflow: "hidden" },
  row: { alignItems: "center", flexDirection: "row", minHeight: 64, paddingLeft: 12, paddingRight: 6 },
  rowMain: { alignItems: "center", flex: 1, flexDirection: "row", gap: 12, paddingVertical: 10 },
  rowDelete: { alignItems: "center", height: 40, justifyContent: "center", width: 36 },
  rowDivider: { borderTopColor: "rgba(206,216,255,0.12)", borderTopWidth: StyleSheet.hairlineWidth },
  rowDice: { flexDirection: "row", gap: 4 },
  rowText: { flex: 1, minWidth: 0 },
  rowQuestion: { color: colors.ice, fontSize: 13.5 },
  rowDate: { color: "#A2B0C6", fontSize: 10.5, marginTop: 3 },
  rowCta: { color: colors.gold, fontSize: 12.5, fontWeight: "600" },
  empty: { alignItems: "center", paddingVertical: 40 },
  emptyTitle: { color: colors.ice, fontFamily: "Georgia", fontSize: 16 },
  emptySub: { color: "#A2B0C6", fontSize: 12, marginTop: 6, textAlign: "center" },
  detailContent: { alignItems: "stretch", paddingBottom: 8 },
  detailQuestion: { color: "#A2B0C6", fontSize: 13, fontStyle: "italic", marginBottom: 14, textAlign: "center" },
  detailChips: { flexDirection: "row", gap: 8, justifyContent: "center" },
  detailChip: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.045)", borderColor: "rgba(206,216,255,0.16)", borderRadius: radii.md, borderWidth: 1, flex: 1, maxWidth: 112, paddingVertical: 10 },
  chipKind: { color: "#A2B0C6", fontSize: 9, fontWeight: "700", letterSpacing: 1 },
  chipGlyph: { color: colors.gold, fontFamily: "Georgia", fontSize: 34, marginTop: 2 },
  chipZh: { color: colors.ice, fontSize: 13.5, marginTop: 2 },
  chipEn: { color: "#A2B0C6", fontSize: 10.5 },
  detailDate: { color: "#A2B0C6", fontSize: 11, marginTop: 12, textAlign: "center" },
  note: { color: "#A2B0C6", fontSize: 11.5, marginTop: 8, textAlign: "center" },
  backButton: { alignItems: "center", backgroundColor: "rgba(122,134,200,0.24)", borderColor: "rgba(139,147,212,0.34)", borderRadius: 15, borderWidth: 1, marginTop: 16, minHeight: 46, justifyContent: "center" },
  backText: { color: "#EAEDFB", fontSize: 14, fontWeight: "600" }
});
