import type { ChartV2 } from "@lumis/shared";

import { buildSafeAiChartContext } from "./chart-sanitizer";

export type SafeChatChartContext = {
  precision: string;
  sun?: string;
  moon?: string;
  rising?: string;
};

export function buildSafeChatChartContext(chart: ChartV2 | null): SafeChatChartContext {
  if (!chart) {
    return { precision: "unknown" };
  }

  const safeChart = buildSafeAiChartContext(chart);
  const sun = safeChart.planets.find((planet) => planet.key === "sun");
  const moon = safeChart.planets.find((planet) => planet.key === "moon");
  const ascendant = safeChart.angles.ascendant;

  return {
    precision: safeChart.precision,
    sun: sun?.sign,
    moon: moon?.sign,
    rising: ascendant?.sign
  };
}
