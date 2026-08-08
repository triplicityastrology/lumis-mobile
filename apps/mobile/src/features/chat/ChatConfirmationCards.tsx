import { LinearGradient } from "expo-linear-gradient";
import { type ReactNode, useState } from "react";
import { type LayoutChangeEvent, PixelRatio, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import {
  BRAND_GOLD_END,
  BRAND_GOLD_GRADIENT,
  BRAND_GOLD_LOCATIONS,
  BRAND_GOLD_START
} from "../../components/BrandPrimaryButton";
import { ink, type } from "../../theme/typography";

/**
 * Batch 2 — Chat bubble states (TALK-003 / TALK-005 / TALK-006 / TALK-007).
 *
 * Presentational only. These render inside the Lumis AI bubble; the confirm /
 * retry actions call back into the chat flow. No backend intent-detection,
 * provider, scheduling, or billing is activated here — the cards are the
 * signed-off visual authority, driven by state the chat already owns.
 *
 * The small "primary" split button reuses the single shared sunrise gradient
 * (never a solid-gold rectangle) at a compact size; the soft button is the
 * secondary hairline pill.
 */

const WARN = "#E38E7C";
const GOLD = "#D7B978";
const CARD_BG = "rgba(20,32,50,0.72)";
const CARD_LINE = "rgba(215,185,120,0.34)";
const SUB_BG = "rgba(58,80,118,0.24)";
const LINE_SOFT = "rgba(255,255,255,0.08)";

function RefreshGlyph({ size = 13, color = ink.onGold }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      <Path
        d="M4 12a8 8 0 0 1 13.7-5.6L20 8M20 3v5h-5M20 12a8 8 0 0 1-13.7 5.6L4 16M4 21v-5h5"
        stroke={color}
        strokeWidth={1.7}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function InfoGlyph({ size = 14, color = GOLD }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={1.6} fill="none" />
      <Path d="M12 11v5M12 8h.01" stroke={color} strokeWidth={1.7} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function SmallPrimaryButton({
  label,
  onPress,
  icon,
  busy = false,
  disabled = false,
  fullWidth = false
}: {
  label: string;
  onPress: () => void;
  icon?: ReactNode;
  busy?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy, disabled: disabled || busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={[s.smallBtnWrap, fullWidth && s.btnFull, (disabled || busy) && s.dim]}
    >
      <LinearGradient
        colors={BRAND_GOLD_GRADIENT}
        locations={BRAND_GOLD_LOCATIONS}
        start={BRAND_GOLD_START}
        end={BRAND_GOLD_END}
        style={s.smallBtnFill}
      >
        {icon}
        <Text style={s.smallBtnLabel}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

export function SmallSoftButton({
  label,
  onPress,
  disabled = false,
  fullWidth = false
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  fullWidth?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[s.smallSoftBtn, fullWidth && s.btnFull, disabled && s.dim]}
    >
      <Text style={s.smallSoftLabel}>{label}</Text>
    </Pressable>
  );
}

/** TALK-003 — the failed-reply state, rendered as a warn-tinted AI bubble body. */
export function ChatFailedReply({
  onRetry,
  onNewTopic,
  retrying = false
}: {
  onRetry: () => void;
  onNewTopic: () => void;
  retrying?: boolean;
}) {
  return (
    <View accessibilityLabel="Lumis couldn't reply" style={s.failedBubble}>
      <View style={s.failedTag}>
        <InfoGlyph size={12} color={WARN} />
        <Text style={s.failedTagText}>Lumis couldn't reply</Text>
      </View>
      <Text style={s.failedBody}>
        Something got in the way of Lumis's reply. Your message is still here — nothing was charged.
      </Text>
      <View style={s.retryActions}>
        <SmallSoftButton label="New topic" onPress={onNewTopic} disabled={retrying} />
        <SmallPrimaryButton
          label="Retry"
          onPress={onRetry}
          busy={retrying}
          icon={<RefreshGlyph size={13} />}
        />
      </View>
    </View>
  );
}

export type ConfirmRow = { key: string; value: string };

/**
 * TALK-005 / TALK-006 / TALK-007 — the confirmation card inside an AI bubble.
 * `rows` renders the key/value list (timing / comparison); `body` renders the
 * paragraph variant (dice hand-off). Both actions are supplied by the caller.
 */
export function ChatConfirmCard({
  eyebrow,
  eyebrowIcon,
  heading,
  rows,
  body,
  caveat,
  softLabel,
  primaryLabel,
  primaryIcon,
  onSoft,
  onPrimary,
  busy = false
}: {
  eyebrow: string;
  eyebrowIcon?: ReactNode;
  heading: string;
  rows?: ConfirmRow[];
  body?: string;
  caveat?: string;
  softLabel: string;
  primaryLabel: string;
  primaryIcon?: ReactNode;
  onSoft: () => void;
  onPrimary: () => void;
  busy?: boolean;
}) {
  // Stack the split-button pair vertically (full-width) when the card is narrow
  // or Dynamic Type is enlarged, so labels like "Confirm comparison" never break
  // mid-word. Measured from the actions row; side-by-side only when it's wide.
  const [stackActions, setStackActions] = useState(true);
  function onActionsLayout(event: LayoutChangeEvent) {
    const width = event.nativeEvent.layout.width;
    setStackActions(width < 300 || PixelRatio.getFontScale() > 1.15);
  }
  return (
    <View style={s.confirmCard}>
      <View style={s.confirmEyebrowRow}>
        {eyebrowIcon ?? <InfoGlyph size={12} color={GOLD} />}
        <Text style={s.confirmEyebrow}>{eyebrow}</Text>
      </View>
      <Text style={s.confirmHeading}>{heading}</Text>
      {rows && rows.length > 0 ? (
        <View>
          {rows.map((row, index) => (
            <View key={row.key} style={[s.confirmRow, index === rows.length - 1 && s.confirmRowLast]}>
              <Text style={s.confirmRowKey}>{row.key}</Text>
              <Text style={s.confirmRowValue}>{row.value}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {body ? <Text style={s.confirmBody}>{body}</Text> : null}
      {caveat ? (
        <View style={s.confirmCaveat}>
          <InfoGlyph size={14} color={GOLD} />
          <Text style={s.confirmCaveatText}>{caveat}</Text>
        </View>
      ) : null}
      {/* DOM order soft→primary: row keeps soft-left/primary-right; when stacked,
          column-reverse lifts the primary action to the top. */}
      <View
        onLayout={onActionsLayout}
        style={[s.confirmActions, stackActions && s.confirmActionsStacked]}
      >
        <View style={stackActions ? s.confirmActionFull : s.confirmActionFlex}>
          <SmallSoftButton label={softLabel} onPress={onSoft} disabled={busy} fullWidth />
        </View>
        <View style={stackActions ? s.confirmActionFull : s.confirmActionFlex}>
          <SmallPrimaryButton label={primaryLabel} onPress={onPrimary} busy={busy} icon={primaryIcon} fullWidth />
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  dim: { opacity: 0.5 },
  // Small split-pair buttons.
  smallBtnWrap: { borderRadius: 12, overflow: "hidden" },
  smallBtnFill: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  smallBtnLabel: { ...type.buttonLabelSmall },
  smallSoftBtn: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  smallSoftLabel: { ...type.buttonLabelSmall, color: ink.strong },
  // TALK-003 failed bubble.
  failedBubble: {
    backgroundColor: "rgba(20,32,50,0.72)",
    borderColor: "rgba(227,142,124,0.4)",
    borderRadius: 18,
    borderWidth: 1,
    maxWidth: "86%",
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  failedTag: { alignItems: "center", flexDirection: "row", gap: 6, marginBottom: 5 },
  failedTagText: { color: WARN, fontFamily: type.statusLabel.fontFamily, fontSize: 11.5, fontWeight: "600" },
  failedBody: { ...type.body, color: ink.strong },
  retryActions: { flexDirection: "row", gap: 8, marginTop: 12 },
  // TALK-005/006/007 confirmation card.
  confirmCard: {
    alignSelf: "stretch",
    backgroundColor: CARD_BG,
    borderColor: CARD_LINE,
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 10,
    padding: 16
  },
  confirmEyebrowRow: { alignItems: "center", flexDirection: "row", gap: 6, marginBottom: 8 },
  confirmEyebrow: {
    color: GOLD,
    fontFamily: type.eyebrow.fontFamily,
    fontSize: 9.5,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase"
  },
  confirmHeading: { ...type.cardHeading, fontSize: 16, lineHeight: 21, marginBottom: 12 },
  confirmRow: {
    borderBottomColor: LINE_SOFT,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 14,
    justifyContent: "space-between",
    paddingVertical: 9
  },
  confirmRowLast: { borderBottomWidth: 0 },
  confirmRowKey: { color: ink.muted, fontFamily: type.body.fontFamily, fontSize: 13.5 },
  confirmRowValue: {
    color: ink.strong,
    flexShrink: 1,
    fontFamily: type.body.fontFamily,
    fontSize: 13.5,
    fontWeight: "500",
    textAlign: "right"
  },
  confirmBody: { ...type.body, color: ink.soft, fontSize: 13, marginBottom: 4 },
  confirmCaveat: {
    alignItems: "flex-start",
    backgroundColor: SUB_BG,
    borderColor: LINE_SOFT,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  confirmCaveatText: { ...type.bodySmall, color: ink.soft, flex: 1, lineHeight: 18 },
  confirmActions: { flexDirection: "row", gap: 10, marginTop: 14 },
  confirmActionsStacked: { flexDirection: "column-reverse" },
  confirmActionFlex: { flex: 1 },
  confirmActionFull: { width: "100%" },
  btnFull: { width: "100%" }
});
