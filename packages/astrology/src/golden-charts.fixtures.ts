import { GOLDEN_CHART_CASES } from "./golden-charts";

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

      if (hasHouseAssertion || hasAscendantAssertion) {
        throw new Error(
          `${goldenCase.id}: unknown birth time case must not assert houses or Ascendant.`
        );
      }
    }

    if (goldenCase.status === "ready" && goldenCase.expected.points.length === 0) {
      throw new Error(`${goldenCase.id}: ready golden chart case must include expected points.`);
    }
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

assertGoldenChartFixtures();
