import {
  APP_LANGUAGE_STATE_MACHINE_VERSION,
  LANGUAGE_OPTION_ACCESSIBILITY,
  createAppLanguageJourneyState,
  languageAnnouncementForState,
  reduceAppLanguageJourney,
  resolveJourneyFixedTemplateLanguage,
  resolveJourneyUiLanguage,
  type AppLanguageJourneyEvent,
  type LanguageAccountBoundary,
} from "./app-language-state-machine";

const validAccount: LanguageAccountBoundary = Object.freeze({
  authentication: "signed_in",
  chart: "valid",
  onboarding: "completed",
});

let firstLaunch = createAppLanguageJourneyState({
  accountBoundary: validAccount,
  firstLaunchComplete: false,
});
equal(firstLaunch.version, APP_LANGUAGE_STATE_MACHINE_VERSION, "state version");
equal(firstLaunch.phase, "first_launch_required", "first launch requires choice");
equal(
  languageAnnouncementForState(firstLaunch),
  "Choose your app language.",
  "first-launch accessibility announcement"
);
firstLaunch = reduceAppLanguageJourney(firstLaunch, {
  type: "SELECT_FIRST_LAUNCH_LANGUAGE",
  language: "zh-Hant",
});
equal(firstLaunch.phase, "ready", "first launch selection resolves gate");
equal(firstLaunch.localPreference, "zh-Hant", "local choice is provisional");
equal(firstLaunch.savedPreference, null, "local choice is not falsely saved");
equal(
  resolveJourneyUiLanguage(firstLaunch),
  "zh-Hant",
  "local choice controls local UI"
);
equal(
  resolveJourneyFixedTemplateLanguage(firstLaunch, "Explain my chart"),
  "en",
  "unsaved preference leaves request-language fallback available"
);
const unsupportedSelection = reduceAppLanguageJourney(firstLaunch, {
  type: "SELECT_PROFILE_LANGUAGE",
  language: "fr" as "en",
});
equal(
  unsupportedSelection,
  firstLaunch,
  "unsupported language leaves state unchanged"
);

let restored = reduceAppLanguageJourney(firstLaunch, {
  type: "LOAD_SAVED_PREFERENCE_STARTED",
});
restored = reduceAppLanguageJourney(restored, {
  type: "LOAD_SAVED_PREFERENCE_SUCCEEDED",
  language: "en",
});
equal(restored.savedPreference, "en", "saved preference restored");
equal(resolveJourneyUiLanguage(restored), "en", "saved preference wins for UI");
equal(
  resolveJourneyFixedTemplateLanguage(restored, "可以解讀我的太陽回歸嗎？"),
  "en",
  "saved preference wins over Chinese request"
);

let profileChange = reduceAppLanguageJourney(restored, {
  type: "SELECT_PROFILE_LANGUAGE",
  language: "zh-Hant",
});
equal(profileChange.savedPreference, "en", "selection does not claim save");
equal(profileChange.pendingPreference, "zh-Hant", "Profile selection is pending");
profileChange = reduceAppLanguageJourney(profileChange, {
  type: "SAVE_PREFERENCE_STARTED",
});
equal(profileChange.persistence, "saving", "save begins explicitly");
profileChange = reduceAppLanguageJourney(profileChange, {
  type: "SAVE_PREFERENCE_SUCCEEDED",
  language: "zh-Hant",
});
equal(profileChange.savedPreference, "zh-Hant", "successful save becomes authority");
equal(profileChange.pendingPreference, null, "successful save clears pending");

let mismatchedSave = reduceAppLanguageJourney(restored, {
  type: "SELECT_PROFILE_LANGUAGE",
  language: "zh-Hant",
});
mismatchedSave = reduceAppLanguageJourney(mismatchedSave, {
  type: "SAVE_PREFERENCE_STARTED",
});
const beforeMismatch = mismatchedSave;
mismatchedSave = reduceAppLanguageJourney(mismatchedSave, {
  type: "SAVE_PREFERENCE_SUCCEEDED",
  language: "en",
});
equal(
  mismatchedSave,
  beforeMismatch,
  "mismatched save result cannot change authority"
);

let offline = reduceAppLanguageJourney(restored, {
  type: "SELECT_PROFILE_LANGUAGE",
  language: "zh-Hant",
});
offline = reduceAppLanguageJourney(offline, {
  type: "SAVE_PREFERENCE_STARTED",
});
offline = reduceAppLanguageJourney(offline, {
  type: "SAVE_PREFERENCE_FAILED",
  reason: "offline",
});
equal(offline.phase, "offline", "offline state represented");
equal(offline.savedPreference, "en", "offline failure preserves saved authority");
equal(offline.pendingPreference, "zh-Hant", "offline choice remains retryable");
equal(
  languageAnnouncementForState(offline),
  "You are offline. Your language was not saved.",
  "offline failure is truthful"
);

const unavailable = reduceAppLanguageJourney(offline, {
  type: "SAVE_PREFERENCE_FAILED",
  reason: "migration_unavailable",
});
equal(
  unavailable.persistence,
  "migration_unavailable",
  "missing migration is not a saved state"
);
equal(unavailable.savedPreference, "en", "missing migration preserves authority");
equal(
  languageAnnouncementForState(unavailable),
  "Language saving is not available in this build.",
  "migration-unavailable announcement"
);

const temporary = reduceAppLanguageJourney(offline, {
  type: "SAVE_PREFERENCE_FAILED",
  reason: "temporary",
});
equal(temporary.phase, "save_failed", "temporary save failure represented");
equal(temporary.savedPreference, "en", "temporary failure preserves saved value");

const events: AppLanguageJourneyEvent[] = [
  { type: "SELECT_FIRST_LAUNCH_LANGUAGE", language: "en" },
  { type: "LOAD_SAVED_PREFERENCE_STARTED" },
  { type: "LOAD_SAVED_PREFERENCE_SUCCEEDED", language: "zh-Hant" },
  { type: "LOAD_SAVED_PREFERENCE_FAILED", reason: "temporary" },
  { type: "SELECT_PROFILE_LANGUAGE", language: "en" },
  { type: "SAVE_PREFERENCE_STARTED" },
  { type: "SAVE_PREFERENCE_FAILED", reason: "offline" },
  { type: "NETWORK_BECAME_AVAILABLE" },
  { type: "NETWORK_BECAME_OFFLINE" },
];
let preserved = createAppLanguageJourneyState({
  accountBoundary: validAccount,
  firstLaunchComplete: true,
  savedPreference: "en",
});
for (const event of events) {
  const priorBoundary = preserved.accountBoundary;
  preserved = reduceAppLanguageJourney(preserved, event);
  equal(
    preserved.accountBoundary,
    priorBoundary,
    `${event.type} preserves account boundary reference`
  );
  deepEqual(
    preserved.accountBoundary,
    validAccount,
    `${event.type} preserves valid account/chart/onboarding state`
  );
}

equal(LANGUAGE_OPTION_ACCESSIBILITY.en.role, "radio", "English radio role");
equal(
  LANGUAGE_OPTION_ACCESSIBILITY["zh-Hant"].role,
  "radio",
  "Traditional Chinese radio role"
);
truthy(LANGUAGE_OPTION_ACCESSIBILITY.en.hint, "English accessibility hint");
truthy(
  LANGUAGE_OPTION_ACCESSIBILITY["zh-Hant"].hint,
  "Traditional Chinese accessibility hint"
);

const deterministicA = createAppLanguageJourneyState({
  accountBoundary: validAccount,
  firstLaunchComplete: true,
  savedPreference: "zh-Hant",
});
const deterministicB = createAppLanguageJourneyState({
  accountBoundary: validAccount,
  firstLaunchComplete: true,
  savedPreference: "zh-Hant",
});
equal(
  JSON.stringify(deterministicA),
  JSON.stringify(deterministicB),
  "same input creates byte-stable state"
);

console.log("pure app-language preference state-machine fixtures passed");

function equal(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: assertion failed`);
  }
}

function deepEqual(actual: unknown, expected: unknown, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: assertion failed`);
  }
}

function truthy(value: unknown, label: string): void {
  if (!value) {
    throw new Error(`${label}: assertion failed`);
  }
}
