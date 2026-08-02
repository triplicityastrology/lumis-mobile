import {
  createInactiveCareCircleClient,
  type CareCircleClientInput,
  type CareCircleClientPort,
} from "./inactiveCareCircleClient";

const REQUEST_ID = "10000000-0000-4000-8000-000000000001";
const RELATIONSHIP_ID = "20000000-0000-4000-8000-000000000002";
const CODE_ID = "30000000-0000-4000-8000-000000000003";
const RAW_PAIRING_CODE = "2468";

void runFixtures();

async function runFixtures(): Promise<void> {
  const idle = mockPort({ ok: true });
  createInactiveCareCircleClient(idle.port);
  equal(idle.calls(), 0, "construction performs no automatic action");

  const create = await run(
    { action: "create_pairing_code", clientRequestId: REQUEST_ID },
    {
      ok: true,
      status: "active",
      code_id: CODE_ID,
      expires_at: "2030-01-01T01:00:00.000Z",
      pairing_code: RAW_PAIRING_CODE,
    }
  );
  equal(
    create.ok && create.code,
    "CARE_CIRCLE_PAIRING_CODE_READY",
    "create succeeds"
  );

  const pending = await run(
    {
      action: "submit_pairing_code",
      clientRequestId: REQUEST_ID,
      pairingCode: RAW_PAIRING_CODE,
    },
    {
      ok: true,
      status: "pending_caree_acceptance",
      relationship_id: RELATIONSHIP_ID,
      pairing_code: RAW_PAIRING_CODE,
    }
  );
  equal(
    pending.ok && pending.code,
    "CARE_CIRCLE_PENDING_CAREE_ACCEPTANCE",
    "pairing remains pending"
  );
  excludes(JSON.stringify(pending), RAW_PAIRING_CODE, "submit output redacted");

  const replay = await run(
    {
      action: "accept_relationship",
      clientRequestId: REQUEST_ID,
      relationshipId: RELATIONSHIP_ID,
    },
    {
      ok: true,
      status: "active",
      idempotent: true,
      relationship_id: RELATIONSHIP_ID,
    }
  );
  equal(replay.ok && replay.replayed, true, "replay is projected");

  for (const [label, backendCode, expected] of [
    ["expiry", "48004", "CARE_CIRCLE_PAIRING_CODE_INVALID"],
    ["capacity", "48012", "CARE_CIRCLE_REQUEST_CONFLICT"],
    ["conflict", "48012", "CARE_CIRCLE_REQUEST_CONFLICT"],
    ["unauthenticated", "AUTH_REQUIRED", "CARE_CIRCLE_AUTH_REQUIRED"],
  ] as const) {
    const result = await run(
      {
        action: "submit_pairing_code",
        clientRequestId: REQUEST_ID,
        pairingCode: RAW_PAIRING_CODE,
      },
      {
        error: {
          code: backendCode,
          message: `private ${RAW_PAIRING_CODE}`,
          actual: RAW_PAIRING_CODE,
        },
      }
    );
    equal(!result.ok && result.code, expected, `${label} safe code`);
    excludes(JSON.stringify(result), RAW_PAIRING_CODE, `${label} redacted`);
  }

  const thrown = await createInactiveCareCircleClient({
    async execute() {
      throw new Error(`transport ${RAW_PAIRING_CODE}`);
    },
  }).execute({
    action: "submit_pairing_code",
    clientRequestId: REQUEST_ID,
    pairingCode: RAW_PAIRING_CODE,
  });
  equal(
    !thrown.ok && thrown.code,
    "CARE_CIRCLE_UNAVAILABLE",
    "transport failure is safe"
  );
  excludes(JSON.stringify(thrown), RAW_PAIRING_CODE, "throw is redacted");

  const invalid = await run(
    {
      action: "submit_pairing_code",
      clientRequestId: REQUEST_ID,
      pairingCode: "private-invalid-code",
    },
    { ok: true },
    0
  );
  equal(
    !invalid.ok && invalid.code,
    "CARE_CIRCLE_INPUT_INVALID",
    "invalid input does not reach port"
  );

  console.log("inactive Care Circle mobile client fixtures passed");
}

async function run(
  input: CareCircleClientInput,
  response: unknown,
  expectedCalls = 1
) {
  const mock = mockPort(response);
  const result = await createInactiveCareCircleClient(mock.port).execute(input);
  equal(mock.calls(), expectedCalls, "injected port call count");
  return result;
}

function mockPort(response: unknown): {
  calls: () => number;
  port: CareCircleClientPort;
} {
  let callCount = 0;
  return {
    calls: () => callCount,
    port: {
      async execute() {
        callCount += 1;
        return response;
      },
    },
  };
}

function equal(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) throw new Error(`${label}: assertion failed`);
}

function excludes(value: string, secret: string, label: string): void {
  if (value.includes(secret)) throw new Error(`${label}: prohibited output`);
}
