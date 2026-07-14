import type { ChartV2 } from "@lumis/shared";

import { allowsFixtureFallbackForEnvironment } from "./chart-worker-config";
import { sanitizeChartForClient } from "./chart-sanitizer";
import { decideProfilePreflight } from "./profile-preflight";

export function assertProfileOnboardingFixtures(): void {
  assertPreflightDecisions();
  assertProfileFlowSimulation();
  assertConcurrentRecoverySimulation();
  assertFixtureFallbackEnvironments();
  assertChartSanitizer();
}

function assertPreflightDecisions(): void {
  const cases = [
    {
      name: "complete profile with Starter",
      state: { hasBirthData: true, hasProfile: true, hasStarterGrant: true },
      expected: "already_complete"
    },
    {
      name: "legacy profile missing Starter",
      state: { hasBirthData: true, hasProfile: true, hasStarterGrant: false },
      expected: "repair_missing_starter"
    },
    {
      name: "no complete profile",
      state: { hasBirthData: true, hasProfile: false, hasStarterGrant: false },
      expected: "generate_new_profile"
    },
    {
      name: "new account",
      state: { hasBirthData: false, hasProfile: false, hasStarterGrant: false },
      expected: "generate_new_profile"
    }
  ] as const;

  for (const testCase of cases) {
    const actual = decideProfilePreflight(testCase.state);

    if (actual !== testCase.expected) {
      throw new Error(`${testCase.name}: expected ${testCase.expected}, received ${actual}.`);
    }
  }
}

function assertProfileFlowSimulation(): void {
  const savedBirthDate = "1986-02-20";
  const savedChartMarker = "saved-chart";
  const savedDisplayName = "Saved Ruby";
  const incomingBirthDate = "1999-09-09";
  const incomingChartMarker = "new-worker-chart";
  const incomingDisplayName = "Incoming Ruby";

  const completeResult = simulateProfileFlow({
    state: { hasBirthData: true, hasProfile: true, hasStarterGrant: true },
    savedBirthDate,
    savedChartMarker,
    savedDisplayName,
    incomingBirthDate,
    incomingChartMarker,
    incomingDisplayName
  });

  if (completeResult.status !== "PROFILE_ALREADY_EXISTS" || completeResult.workerCallCount !== 0) {
    throw new Error("Complete profile with Starter must return PROFILE_ALREADY_EXISTS with zero Worker calls.");
  }

  const recoveryResult = simulateProfileFlow({
    state: { hasBirthData: true, hasProfile: true, hasStarterGrant: false },
    savedBirthDate,
    savedChartMarker,
    savedDisplayName,
    incomingBirthDate,
    incomingChartMarker,
    incomingDisplayName
  });

  if (recoveryResult.status !== "profile_repaired" || recoveryResult.workerCallCount !== 0) {
    throw new Error("Legacy profile without Starter must repair with zero Worker calls.");
  }

  if (
    recoveryResult.birthDateUsed !== savedBirthDate ||
    recoveryResult.chartMarkerUsed !== savedChartMarker ||
    recoveryResult.displayNameUsed !== savedDisplayName ||
    recoveryResult.returnedWorkerContract
  ) {
    throw new Error(
      "Legacy profile recovery must preserve existing display name, birth details, chart, and omit Worker contract."
    );
  }

  const newProfileResult = simulateProfileFlow({
    state: { hasBirthData: false, hasProfile: false, hasStarterGrant: false },
    savedBirthDate,
    savedChartMarker,
    savedDisplayName,
    incomingBirthDate,
    incomingChartMarker,
    incomingDisplayName
  });

  if (newProfileResult.status !== "profile_persisted" || newProfileResult.workerCallCount !== 1) {
    throw new Error("New profile onboarding must continue to Worker generation.");
  }
}

function simulateProfileFlow(input: {
  state: {
    hasBirthData: boolean;
    hasProfile: boolean;
    hasStarterGrant: boolean;
  };
  savedBirthDate: string;
  savedChartMarker: string;
  savedDisplayName: string;
  incomingBirthDate: string;
  incomingChartMarker: string;
  incomingDisplayName: string;
}): {
  status: "PROFILE_ALREADY_EXISTS" | "profile_repaired" | "profile_persisted";
  workerCallCount: number;
  birthDateUsed: string | null;
  chartMarkerUsed: string | null;
  displayNameUsed: string | null;
  returnedWorkerContract: boolean;
} {
  const decision = decideProfilePreflight(input.state);

  if (decision === "already_complete") {
    return {
      status: "PROFILE_ALREADY_EXISTS",
      workerCallCount: 0,
      birthDateUsed: null,
      chartMarkerUsed: null,
      displayNameUsed: null,
      returnedWorkerContract: false
    };
  }

  if (decision === "repair_missing_starter") {
    return {
      status: "profile_repaired",
      workerCallCount: 0,
      birthDateUsed: input.savedBirthDate,
      chartMarkerUsed: input.savedChartMarker,
      displayNameUsed: input.savedDisplayName,
      returnedWorkerContract: false
    };
  }

  return {
    status: "profile_persisted",
    workerCallCount: 1,
    birthDateUsed: input.incomingBirthDate,
    chartMarkerUsed: input.incomingChartMarker,
    displayNameUsed: input.incomingDisplayName,
    returnedWorkerContract: true
  };
}

function assertConcurrentRecoverySimulation(): void {
  const starterGrants = new Set<string>();
  const activeHistoryVersions = new Set<string>();
  const userId = "legacy-user";

  repairLegacyProfileOnce({ userId, starterGrants, activeHistoryVersions });
  repairLegacyProfileOnce({ userId, starterGrants, activeHistoryVersions });

  if (starterGrants.size !== 1) {
    throw new Error("Concurrent legacy recovery must not create duplicate Starter grants.");
  }

  if (activeHistoryVersions.size !== 1) {
    throw new Error("Concurrent legacy recovery must not create duplicate active history rows.");
  }
}

function repairLegacyProfileOnce(input: {
  userId: string;
  starterGrants: Set<string>;
  activeHistoryVersions: Set<string>;
}): void {
  input.starterGrants.add(`${input.userId}:starter_onboarding`);
  input.activeHistoryVersions.add(`${input.userId}:1`);
}

function assertFixtureFallbackEnvironments(): void {
  const allowedEnvironments = ["local", "dev", "development", "test", "staging"];

  for (const environment of allowedEnvironments) {
    if (!allowsFixtureFallbackForEnvironment(environment)) {
      throw new Error(`${environment}: expected fixture fallback to be allowed.`);
    }
  }

  const blockedEnvironments = [undefined, null, "", "production", "prod", "live"];

  for (const environment of blockedEnvironments) {
    if (allowsFixtureFallbackForEnvironment(environment)) {
      throw new Error(`${environment ?? "undefined"}: expected fixture fallback to fail closed.`);
    }
  }
}

function assertChartSanitizer(): void {
  const chart: ChartV2 = {
    version: "chart_v2",
    precision: "full",
    source: "triplicity_cloudflare_worker",
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
        degree: 6,
        house: 1
      },
      {
        key: "medium_coeli",
        label: "MC",
        sign: "Taurus",
        degree: 4,
        house: 10
      }
    ],
    houses: [
      {
        no: 1,
        sign: "Leo",
        cuspDegree: 6
      }
    ],
    angles: {
      ascendant: {
        key: "ascendant",
        label: "Ascendant",
        sign: "Leo",
        degree: 6
      },
      mediumCoeli: {
        key: "medium_coeli",
        label: "MC",
        sign: "Taurus",
        degree: 4
      }
    },
    rawProviderResponse: {
      privateProviderPayload: true
    }
  };

  const fullTimeChart = sanitizeChartForClient(chart, false);

  if ("rawProviderResponse" in fullTimeChart) {
    throw new Error("Full-time client chart must not expose rawProviderResponse.");
  }

  if (!fullTimeChart.planets.some((planet) => planet.key === "ascendant")) {
    throw new Error("Full-time client chart should retain Ascendant.");
  }

  const unknownTimeChart = sanitizeChartForClient(chart, true);

  if ("rawProviderResponse" in unknownTimeChart) {
    throw new Error("Unknown-time client chart must not expose rawProviderResponse.");
  }

  if (unknownTimeChart.precision !== "no_birth_time") {
    throw new Error("Unknown-time client chart must use no_birth_time precision.");
  }

  if (unknownTimeChart.houses.length > 0) {
    throw new Error("Unknown-time client chart must omit houses.");
  }

  if (unknownTimeChart.angles.ascendant || unknownTimeChart.angles.mediumCoeli) {
    throw new Error("Unknown-time client chart must omit Ascendant and MC angles.");
  }

  if (
    unknownTimeChart.planets.some(
      (planet) => planet.key === "ascendant" || planet.key === "medium_coeli"
    )
  ) {
    throw new Error("Unknown-time client chart must omit Ascendant and MC points.");
  }

  if (unknownTimeChart.planets.some((planet) => planet.house != null)) {
    throw new Error("Unknown-time client chart must omit planet house placements.");
  }
}

assertProfileOnboardingFixtures();
