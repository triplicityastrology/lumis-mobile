export type ChartPrecision = "full" | "no_birth_time";

export type ChartPlanetKey =
  | "sun"
  | "moon"
  | "mercury"
  | "venus"
  | "mars"
  | "jupiter"
  | "saturn"
  | "uranus"
  | "neptune"
  | "pluto"
  | "chiron"
  | "true_node"
  | "south_node"
  | "ascendant"
  | "medium_coeli";

export type ChartPlanet = {
  key: ChartPlanetKey;
  label: string;
  sign: string;
  degree: number;
  house?: number;
  retrograde?: boolean;
  absoluteLongitude?: number;
};

export type ChartHouse = {
  no: number;
  sign: string;
  cuspDegree: number;
};

export type ChartV2 = {
  version: "chart_v2";
  precision: ChartPrecision;
  source: "triplicity_cloudflare_worker" | "astrology_api_io" | "fixture";
  calculatedAt: string;
  planets: ChartPlanet[];
  houses: ChartHouse[];
  angles: {
    ascendant?: ChartPlanet;
    mediumCoeli?: ChartPlanet;
  };
  rawProviderResponse?: unknown;
};

