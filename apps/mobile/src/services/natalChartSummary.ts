import { readNatalChartProjection, type NatalChartProjectionPlacement } from "@lumis/astrology";
import type { ChartV2 } from "@lumis/shared";

export const MOBILE_NATAL_SUMMARY_VERSION = "mobile_natal_summary_v1" as const;

export type MobileNatalChartSummary = {
  schemaVersion: typeof MOBILE_NATAL_SUMMARY_VERSION;
  scope: "natal";
  precision: ChartV2["precision"];
  placements: NatalChartProjectionPlacement[];
  factCount: number;
  aspectCount: number;
  provenance: {
    sourceChartContract: "chart_v2";
    engineOutputVersion: "natal_engine_output_v1";
    projectionRule: "recompute_from_immutable_chart_snapshot";
  };
};

export function buildMobileNatalChartSummary(
  chart: ChartV2
): MobileNatalChartSummary | null {
  const projection = readNatalChartProjection(chart.natalProjection, chart.precision);
  if (!projection) return null;

  return {
    schemaVersion: MOBILE_NATAL_SUMMARY_VERSION,
    scope: "natal",
    precision: projection.precision,
    placements: projection.placements.map((placement) => ({ ...placement })),
    factCount: projection.engineOutput.facts.filter((fact) => fact.applicable).length,
    aspectCount: projection.engineOutput.aspects.filter((aspect) => aspect.applicable).length,
    provenance: {
      sourceChartContract: "chart_v2",
      engineOutputVersion: "natal_engine_output_v1",
      projectionRule: "recompute_from_immutable_chart_snapshot",
    },
  };
}
