export const DICE_AUTHORITY_CONSUME_RPC = "consume_lumis_dice_synthetic_authority_v1" as const;

export type DiceAuthorityConsumption = Readonly<{
  run_id: string;
  gateway_package_sha256: string;
  fixture_registry_sha256: string;
  authorization_hmac_sha256: string;
  issued_at: string;
  valid_until: string;
}>;

export type DiceAuthorityConsumeResult =
  | Readonly<{ kind: "consumed"; run_id: string; consumed_at: string; retain_until: string }>
  | Readonly<{ kind: "replayed" | "denied" | "unavailable" }>;

export interface DiceAuthorityStore {
  consume(input: DiceAuthorityConsumption): Promise<DiceAuthorityConsumeResult>;
}

export interface DiceAuthorityRpcClient {
  rpc(name: typeof DICE_AUTHORITY_CONSUME_RPC, parameters: Readonly<Record<string, unknown>>): Promise<Readonly<{
    data: unknown;
    error: unknown;
  }>>;
}

export function createPostgresDiceAuthorityStore(client: DiceAuthorityRpcClient): DiceAuthorityStore {
  return Object.freeze({
    async consume(input: DiceAuthorityConsumption): Promise<DiceAuthorityConsumeResult> {
      let response: Awaited<ReturnType<DiceAuthorityRpcClient["rpc"]>>;
      try {
        response = await client.rpc(DICE_AUTHORITY_CONSUME_RPC, {
          p_run_id: input.run_id,
          p_gateway_package_sha256: input.gateway_package_sha256,
          p_fixture_registry_sha256: input.fixture_registry_sha256,
          p_authorization_hmac_sha256: input.authorization_hmac_sha256,
          p_issued_at: input.issued_at,
          p_valid_until: input.valid_until,
        });
      } catch {
        return { kind: "unavailable" };
      }
      if (response.error || !isRecord(response.data) || !hasExactKeys(response.data, ["consumed", "code", "run_id", "consumed_at", "retain_until"])) {
        return { kind: "unavailable" };
      }
      if (response.data.run_id !== input.run_id) return { kind: "unavailable" };
      if (response.data.consumed === false && response.data.code === "replayed" && response.data.consumed_at === null && response.data.retain_until === null) {
        return { kind: "replayed" };
      }
      if (response.data.consumed === false && response.data.code === "authority_invalid" && response.data.consumed_at === null && response.data.retain_until === null) {
        return { kind: "denied" };
      }
      if (response.data.consumed !== true || response.data.code !== "consumed" || typeof response.data.consumed_at !== "string" || typeof response.data.retain_until !== "string") {
        return { kind: "unavailable" };
      }
      const consumedAt = Date.parse(response.data.consumed_at);
      const retainUntil = Date.parse(response.data.retain_until);
      if (!Number.isFinite(consumedAt) || retainUntil - consumedAt !== 30 * 86_400_000) return { kind: "unavailable" };
      return Object.freeze({ kind: "consumed", run_id: input.run_id, consumed_at: response.data.consumed_at, retain_until: response.data.retain_until });
    },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const closed = [...expected].sort();
  return actual.length === closed.length && actual.every((key, index) => key === closed[index]);
}
