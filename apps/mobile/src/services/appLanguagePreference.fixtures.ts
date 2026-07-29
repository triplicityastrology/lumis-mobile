import type { AppLanguagePreference } from "../../../../packages/shared/src/config/app-language";
import {
  APP_LANGUAGE_PREFERENCE_SERVICE_VERSION,
  createInactiveAppLanguagePreferenceService,
  type AppLanguagePreferenceRpcResult,
} from "./appLanguagePreference";

type MockMode =
  | "success"
  | "offline_result"
  | "unauthenticated_result"
  | "migration_unavailable"
  | "unknown_result"
  | "throw"
  | "mismatched_success";

const accountState = Object.freeze({
  authenticated: true,
  chartVersion: 4,
  persona: "acceptance",
  focus: "reflection",
  reflectionCount: 3,
  onboarding: "completed",
});
const accountSnapshot = JSON.stringify(accountState);

void runFixtures();

async function runFixtures(): Promise<void> {
const idleMock = mockPort("success");
const idleService = createInactiveAppLanguagePreferenceService(idleMock.port);
equal(
  idleService.version,
  APP_LANGUAGE_PREFERENCE_SERVICE_VERSION,
  "service version"
);
equal(idleMock.calls(), 0, "service construction performs no automatic write");

const success = await idleService.savePreference("zh-Hant");
equal(success.ok, true, "valid preference succeeds");
equal(success.code, "LANGUAGE_PREFERENCE_SAVED", "stable success code");
if (success.ok) {
  equal(success.language, "zh-Hant", "saved language returned");
  equal(success.announcement, "語言已儲存。", "safe success announcement");
}
equal(idleMock.calls(), 1, "explicit save calls update port once");

const invalidMock = mockPort("success");
const invalid = await createInactiveAppLanguagePreferenceService(
  invalidMock.port
).savePreference("fr");
equal(invalid.code, "LANGUAGE_PREFERENCE_INVALID", "invalid language code");
equal(invalidMock.calls(), 0, "invalid language never reaches update port");

const offlineMock = mockPort("success", { online: false });
const offline = await createInactiveAppLanguagePreferenceService(
  offlineMock.port
).savePreference("en");
equal(offline.code, "LANGUAGE_PREFERENCE_OFFLINE", "offline preflight code");
equal(offline.retryable, true, "offline is retryable");
equal(offlineMock.calls(), 0, "offline preflight prevents update");

const authMock = mockPort("success", { authenticated: false });
const unauthenticated = await createInactiveAppLanguagePreferenceService(
  authMock.port
).savePreference("en");
equal(
  unauthenticated.code,
  "LANGUAGE_PREFERENCE_AUTH_REQUIRED",
  "unauthenticated preflight code"
);
equal(authMock.calls(), 0, "unauthenticated preflight prevents update");

for (const [mode, code, retryable] of [
  [
    "offline_result",
    "LANGUAGE_PREFERENCE_OFFLINE",
    true,
  ],
  [
    "unauthenticated_result",
    "LANGUAGE_PREFERENCE_AUTH_REQUIRED",
    false,
  ],
  [
    "migration_unavailable",
    "LANGUAGE_PREFERENCE_MIGRATION_UNAVAILABLE",
    true,
  ],
  ["unknown_result", "LANGUAGE_PREFERENCE_SAVE_FAILED", true],
  ["throw", "LANGUAGE_PREFERENCE_SAVE_FAILED", true],
  ["mismatched_success", "LANGUAGE_PREFERENCE_SAVE_FAILED", true],
] as const) {
  const mock = mockPort(mode);
  const result = await createInactiveAppLanguagePreferenceService(
    mock.port
  ).savePreference("zh-Hant");
  equal(result.ok, false, `${mode} fails safely`);
  equal(result.code, code, `${mode} stable code`);
  equal(result.retryable, retryable, `${mode} retryability`);
  doesNotMatch(
    JSON.stringify(result),
    /raw rpc|stack|token|email|chartVersion|reflectionCount/i,
    `${mode} contains no raw/private data`
  );
}

equal(
  JSON.stringify(accountState),
  accountSnapshot,
  "service outcomes cannot reset account, chart, Persona, focus, reflections, or onboarding"
);

console.log("inactive app-language preference service fixtures passed");
}

function mockPort(
  mode: MockMode,
  options: { online?: boolean; authenticated?: boolean } = {}
) {
  let callCount = 0;
  return {
    calls: () => callCount,
    port: {
      isOnline: () => options.online ?? true,
      isAuthenticated: () => options.authenticated ?? true,
      async updateAppLanguagePreference(
        language: AppLanguagePreference
      ): Promise<AppLanguagePreferenceRpcResult> {
        callCount += 1;
        switch (mode) {
          case "success":
            return { ok: true, language };
          case "offline_result":
            return { ok: false, code: "offline" };
          case "unauthenticated_result":
            return { ok: false, code: "unauthenticated" };
          case "migration_unavailable":
            return { ok: false, code: "migration_unavailable" };
          case "unknown_result":
            return { ok: false, code: "unknown" };
          case "mismatched_success":
            return {
              ok: true,
              language: language === "en" ? "zh-Hant" : "en",
            };
          case "throw":
            throw new Error("raw rpc failure must never escape");
        }
      },
    },
  };
}

function equal(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: assertion failed`);
  }
}

function doesNotMatch(value: string, pattern: RegExp, label: string): void {
  if (pattern.test(value)) {
    throw new Error(`${label}: prohibited output`);
  }
}
