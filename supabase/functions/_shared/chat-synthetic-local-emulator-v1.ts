import {
  CHAT_SYNTHETIC_FALLBACK,
  CHAT_SYNTHETIC_SAFETY_REDIRECT,
  ChatSyntheticRun,
  type ChatSyntheticResponse,
  type ProviderResult,
  type SyntheticLanguage
} from "./chat-synthetic-gateway-v1.ts";
import { getChatSyntheticFixture } from "./chat-synthetic-registry-v1.ts";
import { CHAT_SYNTHETIC_API_ROUTE_FAMILY, CHAT_SYNTHETIC_MICROSOFT_DEPLOYMENT_NAMES } from "./chat-synthetic-integrated-authorization-v1.ts";

export const CHAT_SYNTHETIC_LOCAL_EMULATOR_VERSION = "chat_synthetic_local_emulator_v1" as const;

export type LocalEmulatorSurface = "companion" | "ordinary_chat_projection";
export type LocalEmulatorScenario =
  | "completed"
  | "safety"
  | "filter_block"
  | "filter_partial"
  | "malformed"
  | "retry_then_success"
  | "timeout"
  | "idempotent_replay"
  | "concurrent_duplicate";

export type LocalEmulatorInput = Readonly<{
  fixture_id: string;
  idempotency_key: string;
  run_id: string;
  surface: LocalEmulatorSurface;
  scenario: LocalEmulatorScenario;
}>;

type NormalChatProjection = Readonly<{
  schema_version: "normal_chat_mobile_response_v1";
  request_id: string;
  client_turn_id: string;
  result: "completed" | "duplicate" | "fixed_fallback" | "safety_rejected" | "technical_error";
  thread_id?: string;
  assistant_message?: string;
  error_code?: string;
  persistence: "committed" | "not_committed";
  idempotency_outcome: "committed" | "replayed" | "not_committed";
  units_charged: 0;
  atomic_outcome?: Readonly<{
    user_message: "committed" | "replayed";
    assistant_message: "committed" | "replayed";
    unit_ledger: "committed" | "replayed";
    idempotency_outcome: "committed" | "replayed";
  }>;
}>;

export type LocalEmulatorResult = Readonly<{
  schema_version: typeof CHAT_SYNTHETIC_LOCAL_EMULATOR_VERSION;
  surface: LocalEmulatorSurface;
  scenario: LocalEmulatorScenario;
  language: SyntheticLanguage;
  network_allowed: false;
  projection_only: true;
  effects: Readonly<{ persistence_writes: 0; units_charged: 0; raw_logs: 0 }>;
  microsoft_deployment_names: typeof CHAT_SYNTHETIC_MICROSOFT_DEPLOYMENT_NAMES;
  api_route_family: typeof CHAT_SYNTHETIC_API_ROUTE_FAMILY;
  provider_calls: number;
  responses: readonly (ChatSyntheticResponse | NormalChatProjection)[];
}>;

const INPUT_KEYS = ["fixture_id", "idempotency_key", "run_id", "surface", "scenario"];
const SURFACES: readonly LocalEmulatorSurface[] = ["companion", "ordinary_chat_projection"];
const SCENARIOS: readonly LocalEmulatorScenario[] = [
  "completed", "safety", "filter_block", "filter_partial", "malformed",
  "retry_then_success", "timeout", "idempotent_replay", "concurrent_duplicate"
];
const CLIENT_TURN_ID = "123e4567-e89b-42d3-a456-426614174000";
const THREAD_ID = "89abcdef-0123-4567-89ab-0123456789ab";

export async function runLocalChatEmulator(raw: unknown): Promise<LocalEmulatorResult> {
  const input = parseInput(raw);
  const fixture = getChatSyntheticFixture(input.fixture_id)!;
  if ((input.scenario === "safety") !== (fixture.expectedClass === "safety")) {
    throw new Error("CHAT_LOCAL_EMULATOR_SCENARIO_FIXTURE_MISMATCH");
  }

  let calls = 0;
  let release: ((value: ProviderResult) => void) | undefined;
  const scripted = scriptedResults(input.scenario, fixture.language);
  const run = new ChatSyntheticRun({
    aiEnabled: true,
    nowMs: () => 1_000,
    recordMetadata() {},
    adapter: {
      async complete() {
        calls += 1;
        if (input.scenario === "concurrent_duplicate") {
          return new Promise<ProviderResult>((resolve) => { release = resolve; });
        }
        return scripted[Math.min(calls - 1, scripted.length - 1)];
      }
    }
  });
  const request = { fixture_id: input.fixture_id, idempotency_key: input.idempotency_key, run_id: input.run_id };
  let responses: ChatSyntheticResponse[];
  if (input.scenario === "concurrent_duplicate") {
    const first = run.handle(request);
    const second = run.handle(request);
    await Promise.resolve();
    release?.({ kind: "completed", assistantMessage: localMessage(fixture.language) });
    responses = await Promise.all([first, second]);
  } else if (input.scenario === "idempotent_replay") {
    responses = [await run.handle(request), await run.handle(request)];
  } else {
    responses = [await run.handle(request)];
  }

  return Object.freeze({
    schema_version: CHAT_SYNTHETIC_LOCAL_EMULATOR_VERSION,
    surface: input.surface,
    scenario: input.scenario,
    language: fixture.language,
    network_allowed: false,
    projection_only: true,
    effects: Object.freeze({ persistence_writes: 0, units_charged: 0, raw_logs: 0 }),
    microsoft_deployment_names: CHAT_SYNTHETIC_MICROSOFT_DEPLOYMENT_NAMES,
    api_route_family: CHAT_SYNTHETIC_API_ROUTE_FAMILY,
    provider_calls: calls,
    responses: Object.freeze(input.surface === "companion" ? responses : responses.map(projectT240Response))
  });
}

function parseInput(value: unknown): LocalEmulatorInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("CHAT_LOCAL_EMULATOR_INVALID_INPUT");
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== INPUT_KEYS.length || keys.some((key) => !INPUT_KEYS.includes(key))) throw new Error("CHAT_LOCAL_EMULATOR_INVALID_INPUT");
  if (
    typeof record.fixture_id !== "string" || !getChatSyntheticFixture(record.fixture_id) ||
    typeof record.idempotency_key !== "string" || typeof record.run_id !== "string" ||
    !SURFACES.includes(record.surface as LocalEmulatorSurface) || !SCENARIOS.includes(record.scenario as LocalEmulatorScenario)
  ) throw new Error("CHAT_LOCAL_EMULATOR_INVALID_INPUT");
  return record as LocalEmulatorInput;
}

function scriptedResults(scenario: LocalEmulatorScenario, language: SyntheticLanguage): ProviderResult[] {
  switch (scenario) {
    case "completed":
    case "idempotent_replay":
      return [{ kind: "completed", assistantMessage: localMessage(language) }];
    case "filter_block": return [{ kind: "content_filter_block" }];
    case "filter_partial": return [{ kind: "content_filter_partial" }];
    case "malformed": return [{ kind: "malformed" }];
    case "retry_then_success": return [{ kind: "timeout" }, { kind: "completed", assistantMessage: localMessage(language) }];
    case "timeout": return [{ kind: "timeout" }, { kind: "timeout" }];
    case "safety":
    case "concurrent_duplicate": return [{ kind: "completed", assistantMessage: localMessage(language) }];
  }
}

function localMessage(language: SyntheticLanguage): string {
  return language === "en"
    ? "Notice what feels most grounded, then choose one small step that remains yours."
    : "先留意甚麼讓你感到最踏實，再選擇一個仍由你決定的小步驟。";
}

function projectT240Response(response: ChatSyntheticResponse): NormalChatProjection {
  const common = {
    schema_version: "normal_chat_mobile_response_v1" as const,
    request_id: `local_${response.fixture_id}`,
    client_turn_id: CLIENT_TURN_ID,
    units_charged: 0 as const
  };
  if (response.result === "completed" || response.result === "duplicate") {
    const state = response.result === "completed" ? "committed" as const : "replayed" as const;
    return {
      ...common,
      result: response.result,
      thread_id: THREAD_ID,
      assistant_message: response.assistant_message!,
      persistence: "committed",
      idempotency_outcome: state,
      atomic_outcome: { user_message: state, assistant_message: state, unit_ledger: state, idempotency_outcome: state }
    };
  }
  if (response.result === "fixed_fallback") {
    return { ...common, result: response.result, assistant_message: CHAT_SYNTHETIC_FALLBACK, error_code: "NORMAL_CHAT_PROVIDER_UNAVAILABLE", persistence: "not_committed", idempotency_outcome: "not_committed" };
  }
  if (response.result === "safety_rejected") {
    return { ...common, result: response.result, assistant_message: CHAT_SYNTHETIC_SAFETY_REDIRECT, error_code: "NORMAL_CHAT_SAFETY_REDIRECT", persistence: "not_committed", idempotency_outcome: "not_committed" };
  }
  return { ...common, result: "technical_error", error_code: mapTechnicalError(response.error_code), persistence: "not_committed", idempotency_outcome: "not_committed" };
}

function mapTechnicalError(code: string | undefined): string {
  if (code === "CHAT_SYNTHETIC_MALFORMED") return "NORMAL_CHAT_PROVIDER_MALFORMED";
  return "NORMAL_CHAT_TECHNICAL_ERROR";
}
