export const ROUTE_CREDITS = [
  { route: "casual", label: "Chat reply", credits: 1, modelClass: "small" },
  { route: "knowledge", label: "Astrology knowledge", credits: 1, modelClass: "small" },
  { route: "dice", label: "Dice reading", credits: 3, modelClass: "large" },
  { route: "astro_deep", label: "Deep chart reading", credits: 5, modelClass: "large" },
  { route: "astro_timing", label: "Transit / timing / Solar Return", credits: 5, modelClass: "large" },
  { route: "out_of_scope", label: "Out-of-scope redirect", credits: 0, modelClass: "none" },
  { route: "safety", label: "Safety response", credits: 0, modelClass: "none" }
] as const;

export type ChatRoute = (typeof ROUTE_CREDITS)[number]["route"];

