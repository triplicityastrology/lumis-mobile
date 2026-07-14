export type ProfilePreflightState = {
  hasBirthData: boolean;
  hasProfile: boolean;
  hasStarterGrant: boolean;
};

export type ProfilePreflightDecision =
  | "already_complete"
  | "repair_missing_starter"
  | "generate_new_profile";

export function decideProfilePreflight(
  state: ProfilePreflightState
): ProfilePreflightDecision {
  if (state.hasBirthData && state.hasProfile && state.hasStarterGrant) {
    return "already_complete";
  }

  if (state.hasBirthData && state.hasProfile && !state.hasStarterGrant) {
    return "repair_missing_starter";
  }

  return "generate_new_profile";
}
