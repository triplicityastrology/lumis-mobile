export const colors = {
  navy950: "#06101C",
  navy900: "#0B1930",
  navy800: "#152943",
  surface: "#16273D",
  surfaceRaised: "#1A3550",
  // Exact founder rework-pack navy tokens (SPEC.md, 1/8/2026). Added alongside
  // the existing palette so the six reworked screens can reference the precise
  // design values without shifting unrelated screens.
  surface3: "#13233A", // --surface-3: note / empty-state boxes
  accent: "#D7B978", // --accent: primary gold (icons, active, CTAs)
  accentBright: "#C9A96E", // --accent-bright: brighter gold gradient stop
  accentFill: "rgba(215,185,120,0.14)", // --accent-fill: soft gold chip/pill bg
  goodSolid: "#7BC784", // --good: "chart is active" green
  warnSolid: "#E38E7C", // --warn: danger / log-out warning
  cream: "#F7F0E3",
  gold: "#C9A96E",
  goldLight: "#E8DCC0",
  goldFill: "rgba(201,169,110,0.14)",
  periwinkle: "#8B93D4",
  periwinkleFill: "rgba(139,147,212,0.16)",
  ice: "#F0F4F8",
  textSoft: "#C4CEDB",
  muted: "#8A9BB0",
  good: "#86C8A6",
  warn: "#E0997F",
  line: "rgba(255,255,255,0.09)",
  lineSoft: "rgba(255,255,255,0.05)"
} as const;

export const radii = {
  sm: 8,
  md: 14,
  lg: 18,
  pill: 999
} as const;

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 20,
  xl: 28
} as const;
