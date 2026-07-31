import type {
  ChartHouse,
  ChartPlanet,
  ChartPlanetKey,
  ChartPrecision,
  ChartV2
} from "@lumis/shared";

import { readNatalChartProjection } from "./natal-chart-lifecycle";

const PLANET_LABELS: Record<ChartPlanetKey, string> = {
  sun: "Sun",
  moon: "Moon",
  mercury: "Mercury",
  venus: "Venus",
  mars: "Mars",
  jupiter: "Jupiter",
  saturn: "Saturn",
  uranus: "Uranus",
  neptune: "Neptune",
  pluto: "Pluto",
  chiron: "Chiron",
  true_node: "True Node",
  south_node: "South Node",
  ascendant: "Ascendant",
  medium_coeli: "MC"
};
const PLANET_KEYS = new Set<ChartPlanetKey>(
  Object.keys(PLANET_LABELS) as ChartPlanetKey[]
);
const CHART_SOURCES = new Set<ChartV2["source"]>([
  "triplicity_cloudflare_worker",
  "astrology_api_io",
  "fixture"
]);
const CHART_PRECISIONS = new Set<ChartPrecision>(["full", "no_birth_time"]);

export function sanitizeChartForClient(chart: ChartV2, timeUnknown: boolean): ChartV2 {
  const input = chart as unknown as Record<string, unknown>;
  const planets = Array.isArray(input.planets)
    ? input.planets.map(sanitizePlanet).filter(isPresent)
    : [];
  const houses = Array.isArray(input.houses)
    ? input.houses.map(sanitizeHouse).filter(isPresent)
    : [];
  const angleInput = isRecord(input.angles) ? input.angles : {};
  const ascendant = sanitizePlanet(angleInput.ascendant);
  const mediumCoeli = sanitizePlanet(angleInput.mediumCoeli);
  const precision = timeUnknown
    ? "no_birth_time"
    : CHART_PRECISIONS.has(input.precision as ChartPrecision)
      ? input.precision as ChartPrecision
      : "full";
  const natalProjection = readNatalChartProjection(input.natalProjection, precision);
  const natalChart: ChartV2 = {
    version: "chart_v2",
    precision,
    source: CHART_SOURCES.has(input.source as ChartV2["source"])
      ? input.source as ChartV2["source"]
      : "triplicity_cloudflare_worker",
    calculatedAt: typeof input.calculatedAt === "string"
      ? input.calculatedAt
      : new Date(0).toISOString(),
    planets,
    houses,
    angles: {
      ...(ascendant?.key === "ascendant" ? { ascendant } : {}),
      ...(mediumCoeli?.key === "medium_coeli" ? { mediumCoeli } : {})
    },
    ...(natalProjection
      ? { natalProjection }
      : {})
  };

  if (!timeUnknown) {
    return natalChart;
  }

  return {
    ...natalChart,
    precision: "no_birth_time",
    planets: natalChart.planets
      .filter((planet) => planet.key !== "ascendant" && planet.key !== "medium_coeli")
      .map((planet) => {
        const { house: _house, ...planetWithoutHouse } = planet;
        return planetWithoutHouse;
      }),
    houses: [],
    angles: {}
  };
}

export function buildSafeAiChartContext(chart: ChartV2): ChartV2 {
  return sanitizeChartForClient(chart, chart.precision === "no_birth_time");
}

function sanitizePlanet(value: unknown): ChartPlanet | null {
  if (!isRecord(value) || !PLANET_KEYS.has(value.key as ChartPlanetKey)) {
    return null;
  }

  const key = value.key as ChartPlanetKey;
  const degree = finiteNumber(value.degree);

  if (typeof value.sign !== "string" || degree == null) {
    return null;
  }

  const house = finiteNumber(value.house);
  const absoluteLongitude = finiteNumber(value.absoluteLongitude);

  return {
    key,
    label: PLANET_LABELS[key],
    sign: value.sign,
    degree,
    ...(house == null ? {} : { house }),
    ...(typeof value.retrograde === "boolean" ? { retrograde: value.retrograde } : {}),
    ...(absoluteLongitude == null ? {} : { absoluteLongitude })
  };
}

function sanitizeHouse(value: unknown): ChartHouse | null {
  if (!isRecord(value) || typeof value.sign !== "string") {
    return null;
  }

  const no = finiteNumber(value.no);
  const cuspDegree = finiteNumber(value.cuspDegree);

  if (no == null || cuspDegree == null) {
    return null;
  }

  return {
    no,
    sign: value.sign,
    cuspDegree
  };
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isPresent<T>(value: T | null): value is T {
  return value !== null;
}
