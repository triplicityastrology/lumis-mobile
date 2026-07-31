import type { ChartV2 } from "@lumis/shared";

import { sanitizeChartForClient } from "./chart-sanitizer";
import {
  NATAL_CHART_PROJECTION_VERSION,
  attachNatalChartProjection,
  readNatalChartProjection,
  type NatalChartLifecycleFailureCode,
} from "./natal-chart-lifecycle";

async function main(): Promise<void> {
  const timedChart = buildTimedChart("2026-07-30T12:00:00.000Z", 14);
  const timed = await attachNatalChartProjection(timedChart, false);
  truthy(timed.ok, "timed chart enters accepted lifecycle");
  if (!timed.ok) return;

  equal(timed.value.natalProjection.schemaVersion, NATAL_CHART_PROJECTION_VERSION, "projection version");
  equal(timed.value.natalProjection.scope, "natal", "natal-only projection");
  equal(timed.value.natalProjection.capabilities.houses, true, "timed house capability");
  equal(timed.value.natalProjection.provenance.sourceSnapshotFingerprint.length, 64, "snapshot fingerprint");
  const derivedSouth = timed.value.natalProjection.placements.find((point) => point.key === "south_node");
  equal(derivedSouth?.derived, true, "South Node is marked derived");
  equal(derivedSouth?.absoluteLongitude, 25, "South Node is North Node plus 180 degrees");

  const restored = sanitizeChartForClient(timed.value, false);
  truthy(readNatalChartProjection(restored.natalProjection, "full"), "validated projection restores");
  doesNotMatch(
    JSON.stringify(restored.natalProjection),
    /email|birth_date|coordinates|rawProviderResponse|solar.return|transit|timing|vertex|dice/i,
    "projection excludes private and prohibited scopes"
  );

  await expectFailure(
    { ...timedChart, solar_return: { annual_theme: "excluded" } },
    false,
    "NATAL_LIFECYCLE_OUT_OF_SCOPE"
  );
  await expectFailure(
    {
      ...timedChart,
      planets: timedChart.planets.map((planet) =>
        planet.key === "moon" ? { ...planet, absoluteLongitude: undefined } : planet
      ),
    },
    false,
    "NATAL_LIFECYCLE_ABSOLUTE_LONGITUDE_REQUIRED"
  );
  await expectFailure(
    {
      ...timedChart,
      planets: timedChart.planets.map((planet) =>
        planet.key === "south_node" ? { ...planet, absoluteLongitude: 30 } : planet
      ),
    },
    false,
    "NATAL_LIFECYCLE_SOUTH_NODE_MISMATCH"
  );

  const noTime = await attachNatalChartProjection(buildNoTimeChart(), true);
  truthy(noTime.ok, "no-time chart enters accepted lifecycle");
  if (noTime.ok) {
    const projection = noTime.value.natalProjection;
    equal(projection.capabilities.houses, false, "no-time houses suppressed");
    equal(projection.capabilities.angles, false, "no-time angles suppressed");
    equal(projection.placements.some((point) => point.key === "moon"), false, "noon Moon excluded without endpoints");
    equal(projection.placements.some((point) => /ascendant|coeli/.test(point.key)), false, "no-time angles absent");
    equal(projection.engineOutput.facts.some((fact) => /house|ruler/.test(fact.canonicalKey)), false, "no timed facts surface");
  }

  const newer = await attachNatalChartProjection(buildTimedChart("2026-07-31T12:00:00.000Z", 16), false);
  truthy(newer.ok, "new chart version projects");
  if (newer.ok) {
    equal(
      timed.value.natalProjection.provenance.sourceCalculatedAt,
      "2026-07-30T12:00:00.000Z",
      "historical source timestamp remains immutable"
    );
    notEqual(
      timed.value.natalProjection.provenance.sourceSnapshotFingerprint,
      newer.value.natalProjection.provenance.sourceSnapshotFingerprint,
      "new source snapshot receives distinct provenance"
    );
  }

  const contaminated = sanitizeChartForClient(
    { ...timed.value, natalProjection: { ...timed.value.natalProjection, scope: "transit" } },
    false
  );
  equal(contaminated.natalProjection, undefined, "invalid persisted projection cannot restore");

  console.log("natal chart lifecycle integration fixtures passed");
}

function buildTimedChart(calculatedAt: string, sunLongitude: number): ChartV2 {
  const ascendant = point("ascendant", 191, 1);
  const mediumCoeli = point("medium_coeli", 101, 10);
  return {
    version: "chart_v2",
    precision: "full",
    source: "triplicity_cloudflare_worker",
    calculatedAt,
    planets: [
      point("sun", sunLongitude, 10),
      point("moon", 82, 9),
      point("mercury", 34, 7),
      point("true_node", 205, 2),
      point("south_node", 25, 8),
      ascendant,
      mediumCoeli,
    ],
    houses: Array.from({ length: 12 }, (_value, index) => {
      const longitude = (191 + index * 30) % 360;
      return {
        no: index + 1,
        sign: zodiacSign(longitude),
        cuspDegree: longitude % 30,
      };
    }),
    angles: { ascendant: { ...ascendant }, mediumCoeli: { ...mediumCoeli } },
  };
}

function buildNoTimeChart(): ChartV2 {
  return {
    version: "chart_v2",
    precision: "no_birth_time",
    source: "triplicity_cloudflare_worker",
    calculatedAt: "2026-07-30T12:00:00.000Z",
    planets: [
      point("sun", 14),
      point("moon", 82),
      point("true_node", 205),
      point("south_node", 25),
    ],
    houses: [],
    angles: {},
  };
}

function point(key: ChartV2["planets"][number]["key"], longitude: number, house?: number) {
  return {
    key,
    label: key,
    sign: zodiacSign(longitude),
    degree: longitude % 30,
    absoluteLongitude: longitude,
    ...(house ? { house } : {}),
  };
}

function zodiacSign(longitude: number): string {
  return ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"][Math.floor(longitude / 30)] ?? "Aries";
}

async function expectFailure(input: unknown, timeUnknown: boolean, code: NatalChartLifecycleFailureCode): Promise<void> {
  const result = await attachNatalChartProjection(input, timeUnknown);
  equal(result.ok, false, `${code} fails closed`);
  if (!result.ok) {
    equal(result.error.code, code, `${code} stable code`);
    equal(Object.keys(result.error).sort().join(","), "code,reason", `${code} non-echoing shape`);
  }
}

function equal(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) throw new Error(`${label}: assertion failed`);
}

function notEqual(actual: unknown, expected: unknown, label: string): void {
  if (actual === expected) throw new Error(`${label}: assertion failed`);
}

function truthy(value: unknown, label: string): void {
  if (!value) throw new Error(`${label}: assertion failed`);
}

function doesNotMatch(value: string, pattern: RegExp, label: string): void {
  if (pattern.test(value)) throw new Error(`${label}: prohibited output`);
}

void main();
