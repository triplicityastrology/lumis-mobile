import {
  createInactiveNotificationDeviceClient,
  type NotificationDeviceClientInput,
  type NotificationDeviceClientPort,
} from "./inactiveNotificationDeviceClient";

type RegistrationInput = Extract<
  NotificationDeviceClientInput,
  { action: "register" | "rotate" }
>;

const REQUEST_ID = "40000000-0000-4000-8000-000000000004";
const INSTALLATION_ID = "50000000-0000-4000-8000-000000000005";
const ENDPOINT_ID = "60000000-0000-4000-8000-000000000006";
const RAW_TOKEN = "ExponentPushToken[private-fixture-token]";

void runFixtures();

async function runFixtures(): Promise<void> {
  const idle = mockPort({ ok: true });
  createInactiveNotificationDeviceClient(idle.port);
  equal(idle.calls(), 0, "construction is inert");

  for (const action of ["register", "rotate"] as const) {
    const result = await run(
      registration(action),
      {
        ok: true,
        endpoint_id: ENDPOINT_ID,
        idempotent: action === "rotate",
        provider_token: RAW_TOKEN,
        registry: [
          { notification_type: "care_circle_check_in", enabled: false },
          { notification_type: "care_circle_reminder", enabled: false },
        ],
      }
    );
    equal(
      result.ok && result.code,
      action === "register"
        ? "NOTIFICATION_DEVICE_REGISTERED"
        : "NOTIFICATION_DEVICE_ROTATED",
      `${action} success`
    );
    if (result.ok) {
      equal(
        result.registry.every((entry) => entry.enabled === false),
        true,
        `${action} registry remains disabled`
      );
      if (action === "rotate") {
        equal(result.replayed, true, "idempotent replay retained");
      }
    }
    excludes(JSON.stringify(result), RAW_TOKEN, `${action} token redacted`);
  }

  for (const action of [
    "unregister_on_logout",
    "revoke_permission",
    "invalidate_provider_token",
  ] as const) {
    const result = await run(
      { action, clientRequestId: REQUEST_ID, installationId: INSTALLATION_ID },
      { ok: true, idempotent: action === "unregister_on_logout" }
    );
    equal(
      result.ok && result.code,
      "NOTIFICATION_DEVICE_REMOVED",
      `${action} removes device`
    );
  }

  const invalidType = await run(
    {
      ...registration("register"),
      notificationTypes: ["marketing"],
    },
    { ok: true },
    0
  );
  equal(
    !invalidType.ok && invalidType.code,
    "NOTIFICATION_TYPE_REJECTED",
    "unapproved type rejected"
  );

  const invalidToken = await run(
    { ...registration("register"), deviceToken: "bad" },
    { ok: true },
    0
  );
  equal(
    !invalidToken.ok && invalidToken.code,
    "NOTIFICATION_DEVICE_INPUT_INVALID",
    "invalid token rejected"
  );

  const unsafeRegistry = await run(
    registration("register"),
    {
      ok: true,
      endpoint_id: ENDPOINT_ID,
      registry: [
        { notification_type: "care_circle_check_in", enabled: true },
      ],
    }
  );
  equal(
    !unsafeRegistry.ok && unsafeRegistry.code,
    "NOTIFICATION_DEVICE_UNAVAILABLE",
    "enabled registry rejected"
  );

  for (const [backendCode, expected] of [
    ["AUTH_REQUIRED", "NOTIFICATION_AUTH_REQUIRED"],
    ["23505", "NOTIFICATION_REQUEST_CONFLICT"],
  ] as const) {
    const result = await run(registration("register"), {
      error: {
        code: backendCode,
        message: `private ${RAW_TOKEN}`,
        payload: { provider_token: RAW_TOKEN },
      },
    });
    equal(!result.ok && result.code, expected, `${backendCode} safe code`);
    excludes(JSON.stringify(result), RAW_TOKEN, `${backendCode} redacted`);
  }

  const thrown = await createInactiveNotificationDeviceClient({
    async execute() {
      throw new Error(`transport ${RAW_TOKEN}`);
    },
  }).execute(registration("register"));
  equal(
    !thrown.ok && thrown.code,
    "NOTIFICATION_DEVICE_UNAVAILABLE",
    "transport failure safe"
  );
  excludes(JSON.stringify(thrown), RAW_TOKEN, "throw token redacted");

  console.log("inactive notification device client fixtures passed");
}

function registration(
  action: "register" | "rotate"
): RegistrationInput {
  return {
    action,
    clientRequestId: REQUEST_ID,
    installationId: INSTALLATION_ID,
    platform: "ios",
    provider: "expo",
    deviceToken: RAW_TOKEN,
    permissionStatus: "granted",
    notificationTypes: [
      "care_circle_check_in",
      "care_circle_reminder",
    ],
  };
}

async function run(
  input: NotificationDeviceClientInput,
  response: unknown,
  expectedCalls = 1
) {
  const mock = mockPort(response);
  const result = await createInactiveNotificationDeviceClient(
    mock.port
  ).execute(input);
  equal(mock.calls(), expectedCalls, "injected port call count");
  return result;
}

function mockPort(response: unknown): {
  calls: () => number;
  port: NotificationDeviceClientPort;
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
