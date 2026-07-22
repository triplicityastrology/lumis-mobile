import type { ChartPlanetKey, ChartV2 } from "@lumis/shared";

import type { ChartWorkerBirthData } from "./index";
import officialWebsiteGoldenArtifact from "./official-website-golden-cases.json";

export type GoldenChartStatus = "pending_reference" | "ready";

export type GoldenChartExpectedPoint = {
  key: ChartPlanetKey;
  sign: string;
  degree: number;
  absoluteLongitude: number;
  house?: number;
  toleranceDegrees: number;
};

export type GoldenChartExpectedHouse = {
  no: number;
  sign: string;
  cuspDegree: number;
  absoluteLongitude: number;
  toleranceDegrees: number;
};

export type GoldenChartCase = {
  id: string;
  label: string;
  status: GoldenChartStatus;
  notes: string;
  reference?: { kind: "official_website_worker"; sessionId: string };
  input: ChartWorkerBirthData;
  expected: {
    precision: ChartV2["precision"];
    points: GoldenChartExpectedPoint[];
    houses: GoldenChartExpectedHouse[];
  };
};

export type GoldenChartComparisonIssue = {
  caseId: string;
  message: string;
};

export type GoldenChartComparisonResult = {
  caseId: string;
  passed: boolean;
  issues: GoldenChartComparisonIssue[];
};

const officialWebsiteCases = officialWebsiteGoldenArtifact.cases as unknown as GoldenChartCase[];

export const GOLDEN_CHART_CASES: GoldenChartCase[] = [
  ...officialWebsiteCases,
  {
    id: "hk_unknown_time_precision",
    label: "Hong Kong unknown birth time precision case",
    status: "pending_reference",
    notes:
      "Expected points must exclude reliable Ascendant/house assertions because birth time is unknown.",
    input: {
      name: "Golden HK Unknown Time",
      birth_date: "1986-02-20",
      birth_time: null,
      time_unknown: true,
      place_name: "Hong Kong",
      country_code: "HK",
      lat: 22.3193,
      lng: 114.1694,
      tz_str: "Asia/Hong_Kong"
    },
    expected: {
      precision: "no_birth_time",
      points: [],
      houses: []
    }
  }
];

export function compareGoldenChartCase(
  goldenCase: GoldenChartCase,
  actualChart: ChartV2
): GoldenChartComparisonResult {
  const issues: GoldenChartComparisonIssue[] = [];

  if (goldenCase.status !== "ready") {
    issues.push({
      caseId: goldenCase.id,
      message: "Golden chart case is pending trusted reference values."
    });
  }

  if (actualChart.precision !== goldenCase.expected.precision) {
    issues.push({
      caseId: goldenCase.id,
      message: `Expected precision ${goldenCase.expected.precision}, received ${actualChart.precision}.`
    });
  }

  if (goldenCase.input.time_unknown) {
    addUnknownTimeShapeIssues(goldenCase, actualChart, issues);
  }

  for (const expectedPoint of goldenCase.expected.points) {
    const actualPoint = actualChart.planets.find((planet) => planet.key === expectedPoint.key);

    if (!actualPoint) {
      issues.push({
        caseId: goldenCase.id,
        message: `Missing point ${expectedPoint.key}.`
      });
      continue;
    }

    if (actualPoint.sign !== expectedPoint.sign) {
      issues.push({
        caseId: goldenCase.id,
        message: `${expectedPoint.key}: expected sign ${expectedPoint.sign}, received ${actualPoint.sign}.`
      });
    }

    if (Math.abs(actualPoint.degree - expectedPoint.degree) > expectedPoint.toleranceDegrees) {
      issues.push({
        caseId: goldenCase.id,
        message: `${expectedPoint.key}: expected ${expectedPoint.degree}deg ±${expectedPoint.toleranceDegrees}, received ${actualPoint.degree}deg.`
      });
    }

    if (actualPoint.absoluteLongitude == null) {
      issues.push({
        caseId: goldenCase.id,
        message: `${expectedPoint.key}: missing absolute longitude.`
      });
    } else if (angularDistance(actualPoint.absoluteLongitude, expectedPoint.absoluteLongitude) > expectedPoint.toleranceDegrees) {
      issues.push({
        caseId: goldenCase.id,
        message: `${expectedPoint.key}: expected absolute longitude ${expectedPoint.absoluteLongitude}deg ±${expectedPoint.toleranceDegrees}, received ${actualPoint.absoluteLongitude}deg.`
      });
    }

    if (expectedPoint.house != null && actualPoint.house !== expectedPoint.house) {
      issues.push({
        caseId: goldenCase.id,
        message: `${expectedPoint.key}: expected house ${expectedPoint.house}, received ${actualPoint.house ?? "none"}.`
      });
    }
  }

  if (actualChart.houses.length !== goldenCase.expected.houses.length) {
    issues.push({
      caseId: goldenCase.id,
      message: `Expected ${goldenCase.expected.houses.length} houses, received ${actualChart.houses.length}.`
    });
  }

  for (const expectedHouse of goldenCase.expected.houses) {
    const actualHouse = actualChart.houses.find((house) => house.no === expectedHouse.no);

    if (!actualHouse) {
      issues.push({ caseId: goldenCase.id, message: `Missing house cusp ${expectedHouse.no}.` });
      continue;
    }
    if (actualHouse.sign !== expectedHouse.sign) {
      issues.push({
        caseId: goldenCase.id,
        message: `House ${expectedHouse.no}: expected sign ${expectedHouse.sign}, received ${actualHouse.sign}.`
      });
    }
    const actualAbsoluteLongitude = absoluteLongitudeForSignDegree(actualHouse.sign, actualHouse.cuspDegree);
    if (actualAbsoluteLongitude == null) {
      issues.push({ caseId: goldenCase.id, message: `House ${expectedHouse.no}: unsupported sign ${actualHouse.sign}.` });
    } else if (angularDistance(actualAbsoluteLongitude, expectedHouse.absoluteLongitude) > expectedHouse.toleranceDegrees) {
      issues.push({
        caseId: goldenCase.id,
        message: `House ${expectedHouse.no}: expected cusp ${expectedHouse.absoluteLongitude}deg ±${expectedHouse.toleranceDegrees}, received ${actualAbsoluteLongitude}deg.`
      });
    }
  }

  return {
    caseId: goldenCase.id,
    passed: issues.length === 0,
    issues
  };
}

const SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"
];

function absoluteLongitudeForSignDegree(sign: string, degree: number): number | null {
  const signIndex = SIGNS.indexOf(sign);
  return signIndex < 0 ? null : signIndex * 30 + degree;
}

function angularDistance(left: number, right: number): number {
  const distance = Math.abs(left - right) % 360;
  return Math.min(distance, 360 - distance);
}

function addUnknownTimeShapeIssues(
  goldenCase: GoldenChartCase,
  actualChart: ChartV2,
  issues: GoldenChartComparisonIssue[]
): void {
  if (actualChart.angles.ascendant) {
    issues.push({
      caseId: goldenCase.id,
      message: "Unknown birth time chart must not include an Ascendant angle."
    });
  }

  if (actualChart.angles.mediumCoeli) {
    issues.push({
      caseId: goldenCase.id,
      message: "Unknown birth time chart must not include an MC angle."
    });
  }

  if (actualChart.houses.length > 0) {
    issues.push({
      caseId: goldenCase.id,
      message: "Unknown birth time chart must not include houses."
    });
  }

  for (const planet of actualChart.planets) {
    if (planet.key === "ascendant") {
      issues.push({
        caseId: goldenCase.id,
        message: "Unknown birth time chart must not include Ascendant as a chart point."
      });
    }

    if (planet.key === "medium_coeli") {
      issues.push({
        caseId: goldenCase.id,
        message: "Unknown birth time chart must not include MC as a chart point."
      });
    }

    if (planet.house != null) {
      issues.push({
        caseId: goldenCase.id,
        message: `Unknown birth time chart must not include house placement for ${planet.key}.`
      });
    }
  }
}
