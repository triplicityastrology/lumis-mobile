import type { ChatSyntheticAuthorityStore } from "./chat-synthetic-gateway-port-v1.ts";

export const CHAT_SYNTHETIC_AUTHORITY_STORE_VERSION = "chat_synthetic_postgres_authority_store_v1" as const;
export const CHAT_SYNTHETIC_APPROVED_SUPABASE_ORIGIN = "https://bmqhwofmdgebpcihjlnb.supabase.co" as const;

type StoreConfig = Readonly<{
  supabaseOrigin: typeof CHAT_SYNTHETIC_APPROVED_SUPABASE_ORIGIN;
  serviceRoleKey: string;
}>;

export function readChatSyntheticAuthorityStoreConfig(environment: Readonly<Record<string, string | undefined>>):
  | { ok: true; config: StoreConfig }
  | { ok: false; code: "CHAT_SYNTHETIC_AUTHORITY_STORE_UNAVAILABLE" } {
  if (environment.SUPABASE_URL !== CHAT_SYNTHETIC_APPROVED_SUPABASE_ORIGIN || !environment.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, code: "CHAT_SYNTHETIC_AUTHORITY_STORE_UNAVAILABLE" };
  }
  return {
    ok: true,
    config: Object.freeze({
      supabaseOrigin: CHAT_SYNTHETIC_APPROVED_SUPABASE_ORIGIN,
      serviceRoleKey: environment.SUPABASE_SERVICE_ROLE_KEY
    })
  };
}

export function createChatSyntheticPostgresAuthorityStore(config: StoreConfig, fetchImpl: typeof fetch = fetch): ChatSyntheticAuthorityStore {
  const rpc = async <T extends string>(name: string, body: Record<string, unknown>, allowed: readonly T[]): Promise<T> => {
    const response = await fetchImpl(`${config.supabaseOrigin}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        apikey: config.serviceRoleKey,
        authorization: `Bearer ${config.serviceRoleKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error("CHAT_SYNTHETIC_AUTHORITY_STORE_UNAVAILABLE");
    const outcome = await response.json().catch(() => null) as unknown;
    if (typeof outcome !== "string" || !allowed.includes(outcome as T)) throw new Error("CHAT_SYNTHETIC_AUTHORITY_STORE_UNAVAILABLE");
    return outcome as T;
  };

  return Object.freeze({
    consumeAuthority(input) {
      return rpc("consume_chat_synthetic_authority_v1", {
        p_authority_sha256: input.authoritySha256,
        p_review_package_sha256: input.reviewPackageSha256,
        p_run_id: input.runId,
        p_dice_evidence_sha256: input.diceEvidenceSha256,
        p_gateway_source_sha256: input.gatewaySourceSha256,
        p_fixture_registry_sha256: input.fixtureRegistrySha256,
        p_valid_until: input.validUntil
      }, ["consumed", "replayed", "expired", "conflict"] as const);
    },
    async consumeFixture(input) {
      return rpc("consume_chat_synthetic_fixture_v1", {
        p_authority_sha256: input.authoritySha256,
        p_review_package_sha256: input.reviewPackageSha256,
        p_run_id: input.runId,
        p_fixture_id: input.fixtureId,
        p_idempotency_sha256: await sha256(input.idempotencyKey)
      }, ["consumed", "replayed", "expired", "conflict", "authority_missing"] as const);
    },
    closeAuthority(input) {
      return rpc("close_chat_synthetic_authority_v1", {
        p_authority_sha256: input.authoritySha256,
        p_review_package_sha256: input.reviewPackageSha256,
        p_run_id: input.runId
      }, ["closed", "already_closed", "authority_missing", "conflict"] as const);
    }
  });
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
