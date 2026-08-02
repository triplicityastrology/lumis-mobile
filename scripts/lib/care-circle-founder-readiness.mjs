export const CARE_CIRCLE_READINESS_ACTIONS = Object.freeze({
  migrationParityNeeded: "MIGRATION_PARITY_NEEDED",
  patNeeded: "PAT_NEEDED",
  functionHealthNeeded: "FUNCTION_HEALTH_NEEDED",
  qaKeyNeeded: "QA_KEY_NEEDED",
  mobileLaunchNeeded: "MOBILE_LAUNCH_NEEDED",
  mobileReady: "MOBILE_READY",
});

export function resolveCareCircleFounderReadiness(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) stop("STATE_INVALID");
  const allowed = [
    "migrationsParity",
    "functionDeployment",
    "functionHealth",
    "bootstrap",
    "launcher",
    "evidenceCleanup",
  ];
  if (
    Object.keys(input).length !== allowed.length
    || Object.keys(input).some((key) => !allowed.includes(key))
  ) {
    stop("STATE_FIELDS_INVALID");
  }

  oneOf(input.migrationsParity, ["recorded", "not_recorded"], "MIGRATION_STATE_INVALID");
  oneOf(input.functionDeployment, ["verified", "not_recorded"], "DEPLOYMENT_STATE_INVALID");
  oneOf(input.functionHealth, ["passed", "not_run"], "HEALTH_STATE_INVALID");
  oneOf(input.bootstrap, ["source_ready", "accounts_ready"], "BOOTSTRAP_STATE_INVALID");
  oneOf(input.launcher, ["source_ready", "mobile_ready"], "LAUNCHER_STATE_INVALID");
  oneOf(input.evidenceCleanup, ["source_ready"], "EVIDENCE_STATE_INVALID");

  let nextAction = CARE_CIRCLE_READINESS_ACTIONS.mobileReady;
  if (input.migrationsParity !== "recorded") {
    nextAction = CARE_CIRCLE_READINESS_ACTIONS.migrationParityNeeded;
  } else if (input.functionDeployment !== "verified") {
    nextAction = CARE_CIRCLE_READINESS_ACTIONS.patNeeded;
  } else if (input.functionHealth !== "passed") {
    nextAction = CARE_CIRCLE_READINESS_ACTIONS.functionHealthNeeded;
  } else if (input.bootstrap !== "accounts_ready") {
    nextAction = CARE_CIRCLE_READINESS_ACTIONS.qaKeyNeeded;
  } else if (input.launcher !== "mobile_ready") {
    nextAction = CARE_CIRCLE_READINESS_ACTIONS.mobileLaunchNeeded;
  }

  return Object.freeze({ ...input, nextAction });
}

function oneOf(value, values, code) {
  if (!values.includes(value)) stop(code);
}

function stop(code) {
  throw new Error(`STOP_S2_T123_${code}`);
}
