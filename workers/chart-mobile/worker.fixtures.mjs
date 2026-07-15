import { readFile } from "node:fs/promises";
import { webcrypto } from "node:crypto";

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto
  });
}

const workerSource = await readFile(new URL("./worker.js", import.meta.url), "utf8");
const workerModule = await import(
  `data:text/javascript;base64,${Buffer.from(workerSource, "utf8").toString("base64")}`
);
const worker = workerModule.default;
const {
  AuditDeliveryCoordinator,
  appendMobileChartToSheets,
  buildMobileAuditRecord,
  buildMobileSheetRow,
  createMobileChartSalesforceCase,
  recordMobileChartAttempt
} = workerModule;

const signingSecret = "test-chart-worker-secret";

await assertValidFullTimeRequest();
await assertUnknownTimeIsSanitized();
await assertBadSignatureIsRejected();
await assertExpiredSignatureIsRejected();
await assertMissingSignatureIsRejected();
await assertMismatchedIdentityHeadersAreRejected();
await assertMissingProviderConfigurationFailsClosed();
await assertProviderFailureIsRedacted();
assertMobileAuditContract();
await assertGoogleSheetsIntegrationContract();
await assertSalesforceIntegrationContract();
await assertAuditTimeoutIsControlled();
await assertAuditFailuresAreControlled();
await assertAuditPayloadIsRedacted();
await assertAuditDeliveryIsIdempotentUnderConcurrency();
await assertGoogleDeliveryIsIdempotentUnderConcurrency();
await assertDestinationFailuresAreIsolated();

async function assertValidFullTimeRequest() {
  const fetchCalls = [];
  const restoreFetch = mockFetch(fetchCalls);
  const body = buildRequestBody({
    birth_time: "16:55",
    time_unknown: false
  });

  try {
    const response = await worker.fetch(
      await signedRequest(body),
      buildEnv(),
      buildCtx()
    );
    const payload = await response.json();
    const astroPayload = JSON.parse(fetchCalls[0].options.body);

    assert(response.status === 200, "Expected full-time Worker response to succeed.");
    assert(payload.chart_v2.precision === "full", "Expected full-time precision.");
    assert(
      !("rawProviderResponse" in payload.chart_v2),
      "Expected chart_v2 to omit raw provider response."
    );
    assert(
      payload.chart_v2.planets.some((planet) => planet.key === "ascendant"),
      "Expected full-time chart to include Ascendant."
    );
    assert(
      payload.chart_v2.planets.some((planet) => planet.key === "medium_coeli"),
      "Expected full-time chart to include MC."
    );
    assert(payload.chart_v2.houses.length > 0, "Expected full-time chart houses.");
    assert(
      payload.chart_v2.planets.find((planet) => planet.key === "sun")?.sign === "Pisces",
      "Expected abbreviated provider signs to be normalized."
    );
    assert(
      payload.chart_v2.planets.find((planet) => planet.key === "sun")?.absoluteLongitude === 331.42,
      "Expected provider absolute_longitude to be preserved."
    );
    assert(
      payload.chart_v2.planets.some((planet) => planet.house != null),
      "Expected full-time chart planet house placements."
    );
    assert(
      astroPayload.subject.birth_data.hour === 16 && astroPayload.subject.birth_data.minute === 55,
      "Expected full-time astrology payload to use submitted time."
    );
    assert(
      astroPayload.subject.birth_data.city === "Hong Kong",
      "Expected astrology payload to pass the resolved birthplace as city."
    );
    assert(
      astroPayload.options.active_points.includes("Medium_Coeli"),
      "Expected astrology payload to request MC."
    );
  } finally {
    restoreFetch();
  }
}

async function assertUnknownTimeIsSanitized() {
  const fetchCalls = [];
  const restoreFetch = mockFetch(fetchCalls);
  const body = buildRequestBody({
    birth_time: null,
    time_unknown: true
  });

  try {
    const response = await worker.fetch(
      await signedRequest(body),
      buildEnv(),
      buildCtx()
    );
    const payload = await response.json();
    const chart = payload.chart_v2;
    const astroPayload = JSON.parse(fetchCalls[0].options.body);

    assert(response.status === 200, "Expected unknown-time Worker response to succeed.");
    assert(chart.precision === "no_birth_time", "Expected unknown-time precision.");
    assert(!("rawProviderResponse" in chart), "Expected chart_v2 to omit raw provider response.");
    assert(chart.houses.length === 0, "Expected unknown-time chart to have empty houses.");
    assert(!chart.angles.ascendant, "Expected unknown-time chart to omit Ascendant angle.");
    assert(!chart.angles.mediumCoeli, "Expected unknown-time chart to omit MC angle.");
    assert(
      !chart.planets.some((planet) => planet.key === "ascendant"),
      "Expected unknown-time chart to omit Ascendant point."
    );
    assert(
      !chart.planets.some((planet) => planet.key === "medium_coeli"),
      "Expected unknown-time chart to omit MC point."
    );
    assert(
      !chart.planets.some((planet) => planet.house != null),
      "Expected unknown-time chart to omit all planet house placements."
    );
    assert(
      astroPayload.subject.birth_data.hour === 12 && astroPayload.subject.birth_data.minute === 0,
      "Expected unknown-time provider payload to use deterministic noon fallback."
    );
  } finally {
    restoreFetch();
  }
}

async function assertBadSignatureIsRejected() {
  const fetchCalls = [];
  const restoreFetch = mockFetch(fetchCalls);
  const body = buildRequestBody({
    birth_time: "16:55",
    time_unknown: false
  });
  const request = await signedRequest(body);
  request.headers.set("X-Lumis-Signature", "sha256=bad");

  try {
    const response = await worker.fetch(request, buildEnv(), buildCtx());

    assert(response.status === 401, "Expected invalid signature to be rejected.");
    assert(fetchCalls.length === 0, "Expected invalid signature to skip astrology API call.");
  } finally {
    restoreFetch();
  }
}

async function assertExpiredSignatureIsRejected() {
  const fetchCalls = [];
  const restoreFetch = mockFetch(fetchCalls);
  const body = buildRequestBody({ birth_time: "16:55", time_unknown: false });
  const timestamp = String(Date.now() - 6 * 60 * 1000);

  try {
    const response = await worker.fetch(
      await signedRequest(body, { timestamp }),
      buildEnv(),
      buildCtx()
    );
    const payload = await response.json();

    assert(response.status === 401, "Expected expired signature to be rejected.");
    assert(payload.error === "UNAUTHORIZED", "Expected safe expired-signature error code.");
    assert(fetchCalls.length === 0, "Expected expired signature to skip provider call.");
  } finally {
    restoreFetch();
  }
}

async function assertMissingSignatureIsRejected() {
  const fetchCalls = [];
  const restoreFetch = mockFetch(fetchCalls);
  const body = buildRequestBody({ birth_time: "16:55", time_unknown: false });
  const request = await signedRequest(body);
  request.headers.delete("X-Lumis-Signature");

  try {
    const response = await worker.fetch(request, buildEnv(), buildCtx());

    assert(response.status === 401, "Expected missing signature to be rejected.");
    assert(fetchCalls.length === 0, "Expected missing signature to skip provider call.");
  } finally {
    restoreFetch();
  }
}

async function assertMismatchedIdentityHeadersAreRejected() {
  const fetchCalls = [];
  const restoreFetch = mockFetch(fetchCalls);
  const body = buildRequestBody({ birth_time: "16:55", time_unknown: false });
  const request = await signedRequest(body);
  request.headers.set("X-Lumis-User-Id", "00000000-0000-4000-8000-000000000099");

  try {
    const response = await worker.fetch(request, buildEnv(), buildCtx());

    assert(response.status === 401, "Expected mismatched identity header to be rejected.");
    assert(fetchCalls.length === 0, "Expected mismatched identity to skip provider call.");
  } finally {
    restoreFetch();
  }
}

async function assertMissingProviderConfigurationFailsClosed() {
  const fetchCalls = [];
  const restoreFetch = mockFetch(fetchCalls);
  const body = buildRequestBody({ birth_time: "16:55", time_unknown: false });

  try {
    const response = await worker.fetch(
      await signedRequest(body),
      buildEnv({ ASTRO_API_KEY: undefined }),
      buildCtx()
    );
    const payload = await response.json();

    assert(response.status === 503, "Expected missing provider key to fail closed.");
    assert(payload.error === "WORKER_CONFIGURATION_ERROR", "Expected safe configuration error.");
    assert(fetchCalls.length === 0, "Expected missing provider key to skip provider call.");
  } finally {
    restoreFetch();
  }
}

async function assertProviderFailureIsRedacted() {
  const fetchCalls = [];
  const providerDebug = "sensitive provider diagnostic must not escape";
  const restoreFetch = mockFetch(
    fetchCalls,
    async () => new Response(providerDebug, { status: 500 })
  );
  const body = buildRequestBody({ birth_time: "16:55", time_unknown: false });

  try {
    const response = await worker.fetch(
      await signedRequest(body),
      buildEnv(),
      buildCtx()
    );
    const responseText = await response.text();
    const payload = JSON.parse(responseText);

    assert(response.status === 502, "Expected provider failure to return controlled 502.");
    assert(payload.error === "ASTROLOGY_API_FAILED", "Expected safe provider failure code.");
    assert(!responseText.includes(providerDebug), "Provider diagnostics escaped to the client.");
    assert(!("message" in payload), "Provider failure returned a debug message field.");
  } finally {
    restoreFetch();
  }
}

function buildRequestBody(overrides) {
  return {
    user_id: "00000000-0000-4000-8000-000000000001",
    calculation_version: "mobile_natal_v1",
    request_id: "worker-fixture-request",
    requested_at: "2026-07-14T00:00:00.000Z",
    client: {
      source: "lumis_mobile_supabase",
      environment: "staging"
    },
    birth_data: {
      name: "Ruby",
      birth_date: "1986-02-20",
      place_name: "Hong Kong",
      country_code: "HK",
      lat: 22.3193,
      lng: 114.1694,
      tz_str: "Asia/Hong_Kong",
      ...overrides
    },
    audit: {
      source: "mobile_app",
      product: "Lumis",
      flow: "onboarding_chart_generation",
      email: "ruby@example.com",
      plan: "starter",
      chart_type: "natal"
    }
  };
}

async function signedRequest(body, options = {}) {
  const rawBody = JSON.stringify(body);
  const timestamp = options.timestamp ?? String(Date.now());
  const signature = await sign(`${timestamp}.${rawBody}`, signingSecret);

  return new Request("https://chart-worker.test/mobile/natal-chart", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Lumis-Signature-Version": "v1",
      "X-Lumis-Timestamp": timestamp,
      "X-Lumis-Signature": signature,
      "X-Lumis-Request-Id": body.request_id,
      "X-Lumis-User-Id": body.user_id
    },
    body: rawBody
  });
}

async function sign(value, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));

  return `sha256=${Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`;
}

function mockFetch(fetchCalls, responder) {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, options) => {
    fetchCalls.push({ url, options });

    if (responder) {
      return responder(url, options);
    }

    return new Response(JSON.stringify(buildProviderResponse()), {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    });
  };

  return () => {
    globalThis.fetch = originalFetch;
  };
}

function buildProviderResponse() {
  return {
    chart_data: {
      planetary_positions: [
        {
          name: "Sun",
          sign: "Pis",
          degree: 1.42,
          house: 7,
          absolute_longitude: 331.42,
          is_retrograde: false
        },
        {
          name: "Moon",
          sign: "Can",
          degree: 18.08,
          house: 11,
          absolute_longitude: 108.08,
          is_retrograde: false
        },
        {
          name: "Ascendant",
          sign: "Leo",
          degree: 6.11,
          house: 1,
          absolute_longitude: 126.11
        },
        {
          name: "Medium_Coeli",
          sign: "Tau",
          degree: 4.25,
          house: 10,
          absolute_longitude: 34.25
        }
      ],
      house_cusps: [
        {
          house: 1,
          sign: "Leo",
          degree: 6.11,
          absolute_longitude: 126.11
        },
        {
          house: 10,
          sign: "Tau",
          degree: 4.25,
          absolute_longitude: 34.25
        }
      ]
    }
  };
}

function buildEnv(overrides = {}) {
  return {
    ASTRO_API_KEY: "test-astro-key",
    CHART_WORKER_SIGNING_SECRET: signingSecret,
    LUMIS_ENV: "staging",
    ...overrides
  };
}

function buildCtx() {
  return {
    waitUntil(promise) {
      return promise;
    }
  };
}

function assertMobileAuditContract() {
  const body = buildRequestBody({ birth_time: "16:55", time_unknown: false });
  const chart = {
    precision: "full",
    planets: new Array(14).fill({}),
    houses: new Array(12).fill({})
  };
  const record = buildMobileAuditRecord(body, chart);
  const row = buildMobileSheetRow(record);

  assert(record.product === "Lumis", "Expected Lumis audit product.");
  assert(record.source === "mobile_app", "Expected mobile_app audit source.");
  assert(record.flow === "onboarding_chart_generation", "Expected onboarding audit flow.");
  assert(record.user_id === body.user_id, "Expected Supabase user id in audit record.");
  assert(record.email === "ruby@example.com", "Expected authenticated email in audit record.");
  assert(record.chart_status === "generated", "Expected generated audit status.");
  assert(row.length === 19, "Expected 19 mobile Sheet columns.");
  assert(row[14] === "false", "Expected time_unknown Sheet value.");
}

async function assertGoogleSheetsIntegrationContract() {
  const calls = [];
  const record = buildAuditRecordFixture();

  await appendMobileChartToSheets(buildGoogleEnv(), record, {
    getGoogleTokenImpl: async () => "google-token",
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return Response.json({ updates: { updatedRange: "Lumis Mobile Charts!A2:S2" } });
    }
  });

  assert(calls.length === 1, "Expected one Google Sheets append.");
  assert(
    JSON.parse(calls[0].options.body).values[0][1] === record.request_id,
    "Expected request ID in the Google Sheets row."
  );
}

async function assertSalesforceIntegrationContract() {
  const calls = [];
  const record = buildAuditRecordFixture();

  await createMobileChartSalesforceCase(buildSalesforceEnv(), record, {
    salesforceLoginImpl: async () => ({
      sessionId: "salesforce-session",
      serverUrl: "https://salesforce.example"
    }),
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return Response.json({ id: "case-1", success: true });
    }
  });

  const casePayload = JSON.parse(calls[0].options.body);
  assert(calls.length === 1, "Expected one Salesforce Case creation.");
  assert(
    casePayload.Subject === `LUMIS-${record.request_id}`,
    "Expected request ID in the Salesforce Case subject."
  );
}

async function assertAuditTimeoutIsControlled() {
  const record = buildAuditRecordFixture();
  const timeoutFetch = (_url, options) =>
    new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => {
        const error = new Error("private timeout details");
        error.name = "AbortError";
        reject(error);
      });
    });

  await assertRejectsWithCode(
    () =>
      appendMobileChartToSheets(buildGoogleEnv(), record, {
        getGoogleTokenImpl: async () => "google-token",
        fetchImpl: timeoutFetch,
        timeoutMs: 1
      }),
    "AUDIT_DESTINATION_TIMEOUT"
  );
}

async function assertAuditFailuresAreControlled() {
  const record = buildAuditRecordFixture();

  await assertRejectsWithCode(
    () =>
      appendMobileChartToSheets(buildGoogleEnv(), record, {
        getGoogleTokenImpl: async () => "google-token",
        fetchImpl: async () => Response.json({ error: "rate limited" }, { status: 429 })
      }),
    "GOOGLE_SHEETS_APPEND_FAILED"
  );
  await assertRejectsWithCode(
    () =>
      appendMobileChartToSheets(buildGoogleEnv(), record, {
        getGoogleTokenImpl: async () => "google-token",
        fetchImpl: async () => Response.json({ unexpected: true })
      }),
    "GOOGLE_SHEETS_INVALID_RESPONSE"
  );
  await assertRejectsWithCode(
    () =>
      createMobileChartSalesforceCase(buildSalesforceEnv(), record, {
        salesforceLoginImpl: async () => {
          throw new Error("SALESFORCE_LOGIN_FAILED");
        }
      }),
    "SALESFORCE_LOGIN_FAILED"
  );
  await assertRejectsWithCode(
    () =>
      createMobileChartSalesforceCase(buildSalesforceEnv(), record, {
        salesforceLoginImpl: async () => ({
          sessionId: "session",
          serverUrl: "https://salesforce.example"
        }),
        fetchImpl: async () => Response.json({ unexpected: true })
      }),
    "SALESFORCE_CASE_INVALID_RESPONSE"
  );
}

async function assertAuditPayloadIsRedacted() {
  const coordinator = new AuditDeliveryCoordinator(
    { storage: buildTransactionalStorage() },
    buildSalesforceEnv()
  );
  const record = {
    ...buildAuditRecordFixture(),
    rawProviderResponse: { secret: "must-not-survive" }
  };
  const response = await coordinator.fetch(buildCoordinatorRequest("salesforce", record));
  const responseText = await response.text();

  assert(response.status === 400, "Expected raw provider payload to be rejected.");
  assert(!responseText.includes("must-not-survive"), "Sensitive provider data escaped.");
}

async function assertAuditDeliveryIsIdempotentUnderConcurrency() {
  const originalFetch = globalThis.fetch;
  const storage = buildTransactionalStorage();
  const caseCalls = [];
  const coordinator = new AuditDeliveryCoordinator({ storage }, buildSalesforceEnv());
  const record = buildAuditRecordFixture();

  globalThis.fetch = async (url, options) => {
    if (String(url).includes("/services/Soap/")) {
      return new Response(
        "<sessionId>session</sessionId><serverUrl>https://salesforce.example/services/Soap/u/59.0</serverUrl>"
      );
    }
    caseCalls.push({ url, options });
    return Response.json({ id: "case-1", success: true });
  };

  try {
    const responses = await Promise.all([
      coordinator.fetch(buildCoordinatorRequest("salesforce", record)),
      coordinator.fetch(buildCoordinatorRequest("salesforce", record))
    ]);
    const payloads = await Promise.all(responses.map((response) => response.json()));

    assert(caseCalls.length === 1, "Concurrent retries created duplicate Salesforce Cases.");
    assert(
      payloads.some((payload) => payload.status === "duplicate_ignored"),
      "Expected a concurrent retry to be ignored."
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function assertGoogleDeliveryIsIdempotentUnderConcurrency() {
  const storage = buildTransactionalStorage();
  const appendCalls = [];
  const coordinator = new AuditDeliveryCoordinator(
    { storage },
    buildGoogleEnv(),
    {
      google: {
        getGoogleTokenImpl: async () => "google-token",
        fetchImpl: async (url, options) => {
          appendCalls.push({ url, options });
          return Response.json({ updates: { updatedRange: "Lumis Mobile Charts!A2:S2" } });
        }
      }
    }
  );
  const record = buildAuditRecordFixture();
  const responses = await Promise.all([
    coordinator.fetch(buildCoordinatorRequest("google_sheets", record)),
    coordinator.fetch(buildCoordinatorRequest("google_sheets", record))
  ]);
  const payloads = await Promise.all(responses.map((response) => response.json()));

  assert(appendCalls.length === 1, "Concurrent retries created duplicate Google Sheet rows.");
  assert(
    payloads.some((payload) => payload.status === "duplicate_ignored"),
    "Expected a concurrent Google Sheets retry to be ignored."
  );
}

async function assertDestinationFailuresAreIsolated() {
  const destinations = [];
  const env = {
    ...buildGoogleEnv(),
    ...buildSalesforceEnv(),
    AUDIT_DELIVERY_COORDINATOR: {
      idFromName(requestId) {
        return requestId;
      },
      get() {
        return {
          async fetch(_url, options) {
            const payload = JSON.parse(options.body);
            destinations.push(payload.destination);
            return payload.destination === "google_sheets"
              ? Response.json({ error: "AUDIT_DELIVERY_FAILED" }, { status: 502 })
              : Response.json({ status: "delivered" });
          }
        };
      }
    }
  };

  await recordMobileChartAttempt(env, buildRequestBody({ birth_time: "16:55", time_unknown: false }), {
    precision: "full",
    planets: [],
    houses: []
  });

  assert(destinations.length === 2, "One destination failure blocked the other destination.");
}

function buildAuditRecordFixture() {
  return buildMobileAuditRecord(
    buildRequestBody({ birth_time: "16:55", time_unknown: false }),
    { precision: "full", planets: new Array(14).fill({}), houses: new Array(12).fill({}) }
  );
}

function buildGoogleEnv() {
  return {
    GOOGLE_MOBILE_SHEET_ID: "sheet-id",
    GOOGLE_SERVICE_EMAIL: "service@example.invalid",
    GOOGLE_PRIVATE_KEY: "test-private-key"
  };
}

function buildSalesforceEnv() {
  return {
    SF_LOGIN_URL: "https://login.salesforce.example",
    SF_USERNAME: "integration@example.invalid",
    SF_PASSWORD: "test-password"
  };
}

function buildCoordinatorRequest(destination, record) {
  return new Request("https://audit-delivery.internal/deliver", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ destination, record })
  });
}

function buildTransactionalStorage() {
  const values = new Map();
  let queue = Promise.resolve();

  return {
    async transaction(callback) {
      const result = queue.then(() =>
        callback({
          get: async (key) => values.get(key),
          put: async (key, value) => values.set(key, value)
        })
      );
      queue = result.then(() => undefined, () => undefined);
      return result;
    },
    async put(key, value) {
      values.set(key, value);
    }
  };
}

async function assertRejectsWithCode(callback, expectedCode) {
  try {
    await callback();
  } catch (error) {
    assert(error.message === expectedCode, `Expected ${expectedCode}, received ${error.message}.`);
    return;
  }

  throw new Error(`Expected ${expectedCode} to be thrown.`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
