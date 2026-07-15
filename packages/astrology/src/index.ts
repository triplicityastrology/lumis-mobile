export type { ChartWorkerBirthData, SignedChartWorkerRequest } from "./chart-worker-contract";
export { CHART_WORKER_CONTRACT } from "./chart-worker-contract";

export type ProfileChartDraft = {
  display_name: string;
  birth_date: string;
  birth_time: string | null;
  time_unknown: boolean;
  place_name: string;
};

export function buildProfileChartDraft(input: {
  name: string;
  birthDate: string;
  birthTime: string;
  timeUnknown?: boolean;
  birthPlace: string;
}): ProfileChartDraft {
  return {
    display_name: input.name.trim(),
    birth_date: input.birthDate.trim(),
    birth_time: input.timeUnknown ? null : input.birthTime.trim(),
    time_unknown: input.timeUnknown ?? false,
    place_name: input.birthPlace.trim()
  };
}

export {
  decideProfilePreflight,
  type ProfilePreflightDecision,
  type ProfilePreflightState
} from "./profile-preflight";
export { sanitizeChartForClient } from "./chart-sanitizer";
export { allowsFixtureFallbackForEnvironment } from "./chart-worker-config";
