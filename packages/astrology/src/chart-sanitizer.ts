import type { ChartV2 } from "@lumis/shared";

export function sanitizeChartForClient(chart: ChartV2, timeUnknown: boolean): ChartV2 {
  const { rawProviderResponse: _rawProviderResponse, ...chartWithoutRawProvider } = chart;

  if (!timeUnknown) {
    return chartWithoutRawProvider;
  }

  return {
    ...chartWithoutRawProvider,
    precision: "no_birth_time",
    planets: chartWithoutRawProvider.planets
      .filter((planet) => planet.key !== "ascendant" && planet.key !== "medium_coeli")
      .map((planet) => {
        const { house: _house, ...planetWithoutHouse } = planet;
        return planetWithoutHouse;
      }),
    houses: [],
    angles: {}
  };
}
