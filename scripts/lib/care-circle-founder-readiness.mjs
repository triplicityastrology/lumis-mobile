export const CARE_CIRCLE_READINESS_ACTIONS = Object.freeze({
  migration0037AuthorizationNeeded: "MIGRATION_0037_AUTHORIZATION_NEEDED",
  customSecretNeeded: "CUSTOM_SECRET_NEEDED",
  patDeploymentNeeded: "PAT_DEPLOYMENT_NEEDED",
  functionHealthNeeded: "FUNCTION_HEALTH_NEEDED",
  qaKeyNeeded: "QA_KEY_NEEDED",
  mobileLaunchNeeded: "MOBILE_LAUNCH_NEEDED",
  mobileReady: "MOBILE_READY",
});

export function resolveCareCircleFounderReadiness(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) stop("STATE_INVALID");
  const allowed = [
    "migration0037Parity",
    "customSecret",
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

  oneOf(input.migration0037Parity, ["recorded", "not_recorded"], "MIGRATION_STATE_INVALID");
  oneOf(input.customSecret, ["verified", "not_recorded"], "SECRET_STATE_INVALID");
  oneOf(input.functionDeployment, ["verified", "not_recorded"], "DEPLOYMENT_STATE_INVALID");
  oneOf(input.functionHealth, ["passed", "not_run"], "HEALTH_STATE_INVALID");
  oneOf(input.bootstrap, ["source_ready", "accounts_ready"], "BOOTSTRAP_STATE_INVALID");
  oneOf(input.launcher, ["source_ready", "mobile_ready"], "LAUNCHER_STATE_INVALID");
  oneOf(input.evidenceCleanup, ["source_ready"], "EVIDENCE_STATE_INVALID");

  let nextAction = CARE_CIRCLE_READINESS_ACTIONS.mobileReady;
  if (input.migration0037Parity !== "recorded") {
    nextAction = CARE_CIRCLE_READINESS_ACTIONS.migration0037AuthorizationNeeded;
  } else if (input.customSecret !== "verified") {
    nextAction = CARE_CIRCLE_READINESS_ACTIONS.customSecretNeeded;
  } else if (input.functionDeployment !== "verified") {
    nextAction = CARE_CIRCLE_READINESS_ACTIONS.patDeploymentNeeded;
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
