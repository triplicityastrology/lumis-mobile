import Svg, { Circle, Text as SvgText } from "react-native-svg";

export type PersonaAvatarOption = {
  key: string;
  label: string;
  glyph: string;
  color: string;
};

export const PERSONA_AVATARS: PersonaAvatarOption[] = [
  { key: "ceres", label: "Ceres", glyph: "C", color: "#D6AD51" },
  { key: "pallas", label: "Pallas", glyph: "◇", color: "#7D86CF" },
  { key: "juno", label: "Juno", glyph: "◎", color: "#D47D88" },
  { key: "vesta", label: "Vesta", glyph: "◊", color: "#D98148" },
  { key: "chiron", label: "Chiron", glyph: "⚷", color: "#6E9BBD" },
  { key: "psyche", label: "Psyche", glyph: "Ψ", color: "#9A79C4" },
  { key: "eros", label: "Eros", glyph: "♡", color: "#D96887" },
  { key: "iris", label: "Iris", glyph: "◒", color: "#A5A3D0" },
  { key: "hygiea", label: "Hygiea", glyph: "⌁", color: "#62A27E" },
  { key: "astraea", label: "Astraea", glyph: "★", color: "#B39255" }
];

export function LumisPersonaAvatar({ avatarKey, size }: { avatarKey: string; size: number }) {
  const avatar = PERSONA_AVATARS.find((option) => option.key === avatarKey) ?? PERSONA_AVATARS[5];

  return (
    <Svg accessibilityLabel={`${avatar.label} Persona avatar`} height={size} viewBox="0 0 64 64" width={size}>
      <Circle cx="32" cy="32" fill={avatar.color} opacity="0.96" r="30" stroke="rgba(255,255,255,0.62)" strokeWidth="1.5" />
      <Circle cx="24" cy="22" fill="rgba(255,255,255,0.22)" r="10" />
      <SvgText fill="#FFFFFF" fontSize="24" fontWeight="600" textAnchor="middle" x="32" y="40">{avatar.glyph}</SvgText>
    </Svg>
  );
}
