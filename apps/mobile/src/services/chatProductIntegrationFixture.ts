import type { ChartV2 } from "@lumis/shared";

import type { BirthProfileForm } from "./profile";

export const T341_CHAT_FIXTURE_PROFILE: BirthProfileForm = Object.freeze({
  name: "Founder",
  birthDate: "1990-01-01",
  birthTime: "12:00",
  timeUnknown: false,
  birthPlace: "Hong Kong",
});

export const T341_CHAT_FIXTURE_CHART: ChartV2 = {
  version: "chart_v2",
  precision: "full",
  source: "fixture",
  calculatedAt: "2026-08-13T00:00:00.000Z",
  planets: [
    { key: "sun", label: "Sun", sign: "Capricorn", degree: 10, house: 1 },
    { key: "moon", label: "Moon", sign: "Cancer", degree: 18, house: 7 },
  ],
  houses: [],
  angles: {
    ascendant: { key: "ascendant", label: "Ascendant", sign: "Libra", degree: 6, house: 1 },
  },
};
