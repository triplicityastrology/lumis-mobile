import type { ChartPlanetKey, ChartV2 } from "@lumis/shared";

import type { ChartWorkerBirthData } from "./index";

export type GoldenChartStatus = "pending_reference" | "ready";

export type GoldenChartExpectedPoint = {
  key: ChartPlanetKey;
  sign: string;
  degree: number;
  house?: number;
  toleranceDegrees: number;
};

export type GoldenChartCase = {
  id: string;
  label: string;
  status: GoldenChartStatus;
  notes: string;
  input: ChartWorkerBirthData;
  expected: {
    precision: ChartV2["precision"];
    points: GoldenChartExpectedPoint[];
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

export const GOLDEN_CHART_CASES: GoldenChartCase[] = [
  {
    id: "hk_full_time_founder_smoke",
    label: "Hong Kong full birth time smoke case",
    status: "pending_reference",
    notes:
      "Fill expected points from a trusted chart source before using this case as a QA gate.",
    input: {
      name: "Golden HK Full Time",
      birth_date: "1986-02-20",
      birth_time: "16:55",
      time_unknown: false,
      place_name: "Hong Kong",
      country_code: "HK",
      lat: 22.3193,
      lng: 114.1694,
      tz_str: "Asia/Hong_Kong"
    },
    expected: {
      precision: "full",
      points: []
    }
  },
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
      points: []
    }
  },
  {
    id: "london_dst_full_time",
    label: "London daylight-saving full birth time case",
    status: "pending_reference",
    notes:
      "Use this to catch timezone/DST regressions after trusted expected positions are entered.",
    input: {
      name: "Golden London DST",
      birth_date: "1990-07-15",
      birth_time: "12:30",
      time_unknown: false,
      place_name: "London, UK",
      country_code: "GB",
      lat: 51.5074,
      lng: -0.1278,
      tz_str: "Europe/London"
    },
    expected: {
      precision: "full",
      points: []
    }
  },
  {
    id: "new_york_dst_full_time",
    label: "New York daylight-saving full birth time case",
    status: "pending_reference",
    notes:
      "Use this to catch western-longitude and DST regressions after trusted expected positions are entered.",
    input: {
      name: "Golden New York DST",
      birth_date: "1990-07-15",
      birth_time: "12:30",
      time_unknown: false,
      place_name: "New York, US",
      country_code: "US",
      lat: 40.7128,
      lng: -74.006,
      tz_str: "America/New_York"
    },
    expected: {
      precision: "full",
      points: []
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

    if (expectedPoint.house != null && actualPoint.house !== expectedPoint.house) {
      issues.push({
        caseId: goldenCase.id,
        message: `${expectedPoint.key}: expected house ${expectedPoint.house}, received ${actualPoint.house ?? "none"}.`
      });
    }
  }

  return {
    caseId: goldenCase.id,
    passed: issues.length === 0,
    issues
  };
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
