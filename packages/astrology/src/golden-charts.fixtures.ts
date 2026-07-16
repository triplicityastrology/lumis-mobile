import { compareGoldenChartCase, GOLDEN_CHART_CASES } from "./golden-charts";
import { buildSafeAiChartContext } from "./chart-sanitizer";
import { buildSafeChatChartContext } from "./chat-chart-context";
import type { ChartV2 } from "@lumis/shared";

export function assertGoldenChartFixtures(): void {
  if (GOLDEN_CHART_CASES.length < 4) {
    throw new Error("Expected at least four golden chart cases.");
  }

  const hasUnknownTimeCase = GOLDEN_CHART_CASES.some((goldenCase) => goldenCase.input.time_unknown);
  const hasFullTimeCase = GOLDEN_CHART_CASES.some((goldenCase) => !goldenCase.input.time_unknown);

  if (!hasUnknownTimeCase) {
    throw new Error("Expected at least one unknown birth time golden chart case.");
  }

  if (!hasFullTimeCase) {
    throw new Error("Expected at least one full birth time golden chart case.");
  }

  for (const goldenCase of GOLDEN_CHART_CASES) {
    assertRequiredInput(goldenCase.id, goldenCase.input);

    if (goldenCase.input.time_unknown && goldenCase.input.birth_time !== null) {
      throw new Error(`${goldenCase.id}: unknown birth time case must use birth_time=null.`);
    }

    if (!goldenCase.input.time_unknown && !goldenCase.input.birth_time) {
      throw new Error(`${goldenCase.id}: full birth time case must include birth_time.`);
    }

    if (goldenCase.input.time_unknown) {
      const hasHouseAssertion = goldenCase.expected.points.some((point) => point.house != null);
      const hasAscendantAssertion = goldenCase.expected.points.some((point) => point.key === "ascendant");
      const hasMediumCoeliAssertion = goldenCase.expected.points.some(
        (point) => point.key === "medium_coeli"
      );

      if (hasHouseAssertion || hasAscendantAssertion || hasMediumCoeliAssertion) {
        throw new Error(
          `${goldenCase.id}: unknown birth time case must not assert houses, Ascendant, or MC.`
        );
      }
    }

    if (goldenCase.status === "ready" && goldenCase.expected.points.length === 0) {
      throw new Error(`${goldenCase.id}: ready golden chart case must include expected points.`);
    }
  }

  assertUnknownTimeWorkerShapeGuard();
  assertUnknownTimeAiContextGuard();
}

function assertUnknownTimeAiContextGuard(): void {
  const unsafeChart: ChartV2 = {
    version: "chart_v2",
    precision: "no_birth_time",
    source: "fixture",
    calculatedAt: "2026-07-14T00:00:00.000Z",
    planets: [
      { key: "sun", label: "Sun", sign: "Pisces", degree: 1, house: 7 },
      { key: "ascendant", label: "Ascendant", sign: "Leo", degree: 1 },
      { key: "medium_coeli", label: "MC", sign: "Taurus", degree: 1 }
    ],
    houses: [{ no: 1, sign: "Leo", cuspDegree: 1 }],
    angles: {
      ascendant: { key: "ascendant", label: "Ascendant", sign: "Leo", degree: 1 },
      mediumCoeli: { key: "medium_coeli", label: "MC", sign: "Taurus", degree: 1 }
    }
  };
  const safeContext = buildSafeAiChartContext(unsafeChart);
  const chatContext = buildSafeChatChartContext(unsafeChart);

  if (safeContext.houses.length > 0 || Object.keys(safeContext.angles).length > 0) {
    throw new Error("Unknown-time AI context must not include houses, Ascendant, or MC angles.");
  }

  if (safeContext.planets.some((planet) =>
    planet.house != null || planet.key === "ascendant" || planet.key === "medium_coeli"
  )) {
    throw new Error("Unknown-time AI context must not include timed points or house placements.");
  }

  if (chatContext.rising != null || chatContext.precision !== "no_birth_time") {
    throw new Error("Unknown-time production chat context must not expose a rising sign.");
  }
}

function assertRequiredInput(caseId: string, input: {
  birth_date: string;
  place_name: string;
  country_code: string;
  lat: number;
  lng: number;
  tz_str: string;
}) {
  if (!input.birth_date || !input.place_name || !input.country_code || !input.tz_str) {
    throw new Error(`${caseId}: missing required birth data fields.`);
  }

  if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng)) {
    throw new Error(`${caseId}: lat/lng must be finite numbers.`);
  }
}

function assertUnknownTimeWorkerShapeGuard(): void {
  const unknownTimeCase = GOLDEN_CHART_CASES.find((goldenCase) => goldenCase.input.time_unknown);

  if (!unknownTimeCase) {
    throw new Error("Expected an unknown birth time case for Worker shape guard validation.");
  }

  const invalidUnknownTimeChart: ChartV2 = {
    version: "chart_v2",
    precision: "no_birth_time",
    source: "fixture",
    calculatedAt: "2026-07-14T00:00:00.000Z",
    planets: [
      {
        key: "sun",
        label: "Sun",
        sign: "Pisces",
        degree: 1,
        house: 7
      },
      {
        key: "ascendant",
        label: "Ascendant",
        sign: "Leo",
        degree: 1
      },
      {
        key: "medium_coeli",
        label: "MC",
        sign: "Taurus",
        degree: 1
      }
    ],
    houses: [
      {
        no: 1,
        sign: "Leo",
        cuspDegree: 1
      }
    ],
    angles: {
      ascendant: {
        key: "ascendant",
        label: "Ascendant",
        sign: "Leo",
        degree: 1
      },
      mediumCoeli: {
        key: "medium_coeli",
        label: "MC",
        sign: "Taurus",
        degree: 1
      }
    }
  };

  const result = compareGoldenChartCase(unknownTimeCase, invalidUnknownTimeChart);
  const messages = result.issues.map((issue) => issue.message);

  assertIssueIncludes(messages, "Ascendant angle");
  assertIssueIncludes(messages, "MC angle");
  assertIssueIncludes(messages, "must not include houses");
  assertIssueIncludes(messages, "Ascendant as a chart point");
  assertIssueIncludes(messages, "MC as a chart point");
  assertIssueIncludes(messages, "house placement for sun");
}

function assertIssueIncludes(messages: string[], expectedText: string): void {
  if (!messages.some((message) => message.includes(expectedText))) {
    throw new Error(`Expected unknown-time Worker shape issue containing "${expectedText}".`);
  }
}

assertGoldenChartFixtures();
