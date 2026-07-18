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
  appendDeletedAccountMarker,
  appendMobileChartToSheets,
  buildDeletedAccountMarkerRow,
  buildMobileAuditRecord,
  buildMobileSheetRow,
  createMobileChartSalesforceCase,
  isValidBirthDate,
  redactSalesforceCasesForDeletion
} = workerModule;

const signingSecret = "test-chart-worker-secret";

await assertValidFullTimeRequest();
await assertUnknownTimeIsSanitized();
await assertBadSignatureIsRejected();
await assertExpiredSignatureIsRejected();
await assertMissingSignatureIsRejected();
await assertMismatchedIdentityHeadersAreRejected();
await assertFutureBirthDateIsRejected();
assertBirthDateTimezoneBoundaries();
await assertMissingEnvironmentFailsClosed();
await assertInvalidEnvironmentFailsClosed();
await assertMissingProviderConfigurationFailsClosed();
await assertMissingChartCoordinatorFailsClosed();
await assertProviderFailureIsRedacted();
await assertProviderTimeoutIsControlled();
await assertSignedChartReplayIsIdempotent();
await assertRequestIdConflictIsRejected();
await assertSignedAdminSyncRequest();
await assertAdminSyncRejectsProviderPayload();
assertMobileAuditContract();
await assertGoogleSheetsIntegrationContract();
await assertSalesforceIntegrationContract();
await assertGoogleDeletionMarkerContract();
await assertSalesforceDeletionContract();
await assertAuditTimeoutIsControlled();
await assertAuditFailuresAreControlled();
await assertAuditPayloadIsRedacted();
await assertAuditDeliveryIsIdempotentUnderConcurrency();
await assertGoogleDeliveryIsIdempotentUnderConcurrency();
await assertDestinationLookupPreventsReplayDuplicates();
await assertFailedDeliveryCanRetrySafely();
await assertStaleProcessingDeliveryRecovers();

function assertBirthDateTimezoneBoundaries() {
  const boundary = new Date("2026-07-17T16:36:00.000Z");
  assert(isValidBirthDate("2026-07-18", boundary, "Asia/Hong_Kong"), "Expected Hong Kong local today to pass.");
  assert(!isValidBirthDate("2026-07-19", boundary, "Asia/Hong_Kong"), "Expected Hong Kong local tomorrow to fail.");
  assert(isValidBirthDate("2026-07-17", boundary, "America/New_York"), "Expected New York local today to pass.");
  assert(!isValidBirthDate("2026-07-18", boundary, "America/New_York"), "Expected New York local tomorrow to fail.");
  assert(!isValidBirthDate("2026-07-17", boundary, "Not/A_Timezone"), "Expected an invalid timezone to fail closed.");
}

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

async function assertFutureBirthDateIsRejected() {
  const fetchCalls = [];
  const restoreFetch = mockFetch(fetchCalls);
  const body = buildRequestBody({
    birth_date: "2099-01-01",
    birth_time: "16:55",
    time_unknown: false
  });

  try {
    const response = await worker.fetch(await signedRequest(body), buildEnv(), buildCtx());
    assert(response.status === 400, "Expected future birth date to be rejected.");
    assert(fetchCalls.length === 0, "Expected future birth date to skip astrology API call.");
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

async function assertMissingEnvironmentFailsClosed() {
  const fetchCalls = [];
  const restoreFetch = mockFetch(fetchCalls);
  const body = buildRequestBody({ birth_time: "16:55", time_unknown: false });

  try {
    const response = await worker.fetch(
      await signedRequest(body),
      buildEnv({ LUMIS_ENV: undefined }),
      buildCtx()
    );
    const payload = await response.json();

    assert(response.status === 503, "Expected missing LUMIS_ENV to fail closed.");
    assert(payload.error === "WORKER_CONFIGURATION_ERROR", "Expected safe environment error.");
    assert(fetchCalls.length === 0, "Expected missing environment to skip provider call.");
  } finally {
    restoreFetch();
  }
}

async function assertInvalidEnvironmentFailsClosed() {
  const fetchCalls = [];
  const restoreFetch = mockFetch(fetchCalls);
  const body = buildRequestBody({ birth_time: "16:55", time_unknown: false });

  try {
    const response = await worker.fetch(
      await signedRequest(body),
      buildEnv({ LUMIS_ENV: "unexpected" }),
      buildCtx()
    );
    assert(response.status === 503, "Expected invalid LUMIS_ENV to fail closed.");
    assert(fetchCalls.length === 0, "Expected invalid environment to skip provider call.");
  } finally {
    restoreFetch();
  }
}

async function assertMissingChartCoordinatorFailsClosed() {
  const fetchCalls = [];
  const restoreFetch = mockFetch(fetchCalls);
  const body = buildRequestBody({ birth_time: "16:55", time_unknown: false });

  try {
    const response = await worker.fetch(
      await signedRequest(body),
      buildEnv({ CHART_REQUEST_COORDINATOR: undefined }),
      buildCtx()
    );
    assert(response.status === 503, "Expected missing chart coordinator to fail closed.");
    assert(fetchCalls.length === 0, "Expected missing coordinator to skip provider call.");
  } finally {
    restoreFetch();
  }
}

async function assertProviderTimeoutIsControlled() {
  const fetchCalls = [];
  const restoreFetch = mockFetch(fetchCalls, async (_url, options) =>
    new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => {
        const error = new Error("provider timed out");
        error.name = "AbortError";
        reject(error);
      });
    })
  );
  const body = buildRequestBody({ birth_time: "16:55", time_unknown: false });

  try {
    const response = await worker.fetch(
      await signedRequest(body),
      buildEnv({ ASTRO_PROVIDER_TIMEOUT_MS: "1000" }),
      buildCtx()
    );
    const payload = await response.json();

    assert(response.status === 504, "Expected astrology provider timeout to return 504.");
    assert(payload.error === "ASTROLOGY_API_TIMEOUT", "Expected safe provider timeout code.");
    assert(fetchCalls.length === 1, "Expected exactly one timed-out provider call.");
  } finally {
    restoreFetch();
  }
}

async function assertSignedChartReplayIsIdempotent() {
  const fetchCalls = [];
  const restoreFetch = mockFetch(fetchCalls);
  const env = buildEnv();
  const body = buildRequestBody({ birth_time: "16:55", time_unknown: false });

  try {
    const first = await worker.fetch(await signedRequest(body), env, buildCtx());
    const second = await worker.fetch(await signedRequest(body), env, buildCtx());
    const firstPayload = await first.json();
    const secondPayload = await second.json();

    assert(first.status === 200 && second.status === 200, "Expected replay to return cached success.");
    assert(fetchCalls.length === 1, "Signed replay caused a second astrology provider call.");
    assert(
      JSON.stringify(firstPayload.chart_v2) === JSON.stringify(secondPayload.chart_v2),
      "Signed replay did not return the original chart."
    );
  } finally {
    restoreFetch();
  }
}

async function assertRequestIdConflictIsRejected() {
  const fetchCalls = [];
  const restoreFetch = mockFetch(fetchCalls);
  const env = buildEnv();
  const firstBody = buildRequestBody({ birth_time: "16:55", time_unknown: false });
  const changedBody = buildRequestBody({
    birth_date: "1986-02-21",
    birth_time: "16:55",
    time_unknown: false
  });

  try {
    const first = await worker.fetch(await signedRequest(firstBody), env, buildCtx());
    const second = await worker.fetch(await signedRequest(changedBody), env, buildCtx());
    const payload = await second.json();

    assert(first.status === 200, "Expected initial request to succeed.");
    assert(second.status === 409, "Expected reused request ID with changed body to conflict.");
    assert(payload.error === "CHART_REQUEST_CONFLICT", "Expected safe replay-conflict code.");
    assert(fetchCalls.length === 1, "Conflicting request caused a second provider call.");
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

async function assertSignedAdminSyncRequest() {
  const body = buildAdminSyncBody();
  const env = buildEnv({
    ...buildGoogleEnv(),
    AUDIT_DELIVERY_COORDINATOR: buildCoordinatorBindingStub({
      status: "delivered",
      external_record_id: "Lumis Mobile Charts!A2:T2"
    })
  });
  const response = await worker.fetch(await signedAdminRequest(body), env, buildCtx());
  const payload = await response.json();

  assert(response.status === 200, "Expected signed admin sync request to succeed.");
  assert(payload.status === "delivered", "Expected admin sync delivery status.");
  assert(payload.external_record_id === "Lumis Mobile Charts!A2:T2", "Expected external row reference.");
}

async function assertAdminSyncRejectsProviderPayload() {
  const body = buildAdminSyncBody();
  body.record.rawProviderResponse = { private: "provider-data" };
  const response = await worker.fetch(
    await signedAdminRequest(body),
    buildEnv({
      ...buildGoogleEnv(),
      AUDIT_DELIVERY_COORDINATOR: buildCoordinatorBindingStub({ status: "delivered" })
    }),
    buildCtx()
  );
  const responseText = await response.text();

  assert(response.status === 400, "Expected admin sync to reject provider payloads.");
  assert(!responseText.includes("provider-data"), "Admin sync leaked provider payload data.");
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

async function signedAdminRequest(body) {
  const rawBody = JSON.stringify(body);
  const timestamp = String(Date.now());
  const signature = await sign(`${timestamp}.${rawBody}`, signingSecret);

  return new Request("https://chart-worker.test/mobile/admin-sync", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Lumis-Signature-Version": "v1",
      "X-Lumis-Timestamp": timestamp,
      "X-Lumis-Signature": signature,
      "X-Lumis-Request-Id": body.idempotency_key,
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
  const env = {
    ASTRO_API_KEY: "test-astro-key",
    CHART_WORKER_SIGNING_SECRET: signingSecret,
    LUMIS_ENV: "staging",
    ...overrides
  };

  if (!Object.prototype.hasOwnProperty.call(overrides, "CHART_REQUEST_COORDINATOR")) {
    env.CHART_REQUEST_COORDINATOR = buildChartCoordinatorBinding(env);
  }

  return env;
}

function buildChartCoordinatorBinding(env) {
  const coordinators = new Map();

  return {
    idFromName(value) {
      return value;
    },
    get(id) {
      if (!coordinators.has(id)) {
        coordinators.set(
          id,
          new AuditDeliveryCoordinator({ storage: buildTransactionalStorage() }, env)
        );
      }
      const coordinator = coordinators.get(id);
      return { fetch: (url, options) => coordinator.fetch(new Request(url, options)) };
    }
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
  assert(row.length === 20, "Expected 20 mobile Sheet columns.");
  assert(row[2] === record.chart_session_id, "Expected chart session ID in the Sheet row.");
  assert(row[15] === "false", "Expected time_unknown Sheet value.");
}

async function assertGoogleSheetsIntegrationContract() {
  const calls = [];
  const record = buildAuditRecordFixture();

  await appendMobileChartToSheets(buildGoogleEnv(), record, {
    getGoogleTokenImpl: async () => "google-token",
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (options.method === "GET") return Response.json({ values: [] });
      return Response.json({ updates: { updatedRange: "Lumis Mobile Charts!A2:T2" } });
    }
  });

  assert(calls.length === 2, "Expected a Google Sheets lookup followed by one append.");
  assert(
    JSON.parse(calls[1].options.body).values[0][1] === record.request_id,
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
      if (options.method === "GET") return Response.json({ records: [] });
      return Response.json({ id: "case-1", success: true });
    }
  });

  const casePayload = JSON.parse(calls[1].options.body);
  assert(calls.length === 2, "Expected a Salesforce lookup followed by one Case creation.");
  assert(
    casePayload.Subject === `LUMIS-${record.request_id}`,
    "Expected request ID in the Salesforce Case subject."
  );
}

async function assertGoogleDeletionMarkerContract() {
  const calls = [];
  const record = buildDeletionRecordFixture();
  const markerRow = buildDeletedAccountMarkerRow(record, "2026-07-16T12:00:00.000Z");

  assert(markerRow.length === 7, "Expected seven deletion marker columns.");
  assert(markerRow[0] === record.request_id, "Expected stable idempotency key in column A.");
  assert(!markerRow.join("|").includes("@"), "Raw email must not enter the deletion marker.");
  assert(!markerRow.join("|").includes("a".repeat(64)), "Email hashes must not enter the deletion marker.");
  assert(markerRow[5] === "external_cleanup_requested", "Marker status must reflect the external cleanup stage.");

  await appendDeletedAccountMarker(buildGoogleEnv(), record, {
    getGoogleTokenImpl: async () => "google-token",
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (options.method === "GET") return Response.json({ values: [] });
      return Response.json({ updates: { updatedRange: "Deleted Accounts!A2:G2" } });
    }
  });

  assert(calls.length === 2, "Expected deletion marker lookup followed by append.");
  assert(calls[0].url.includes("Deleted%20Accounts!A:A"), "Expected separate deletion marker tab lookup.");
  assert(calls[1].options.method === "POST", "Deletion marker must be append-only.");

  const duplicateCalls = [];
  const duplicate = await appendDeletedAccountMarker(buildGoogleEnv(), record, {
    getGoogleTokenImpl: async () => "google-token",
    fetchImpl: async (url, options) => {
      duplicateCalls.push({ url, options });
      return Response.json({ values: [[record.request_id]] });
    }
  });

  assert(duplicateCalls.length === 1, "Existing deletion marker must not append again.");
  assert(duplicate.alreadyDelivered === true, "Existing deletion marker should be idempotent.");
}

async function assertSalesforceDeletionContract() {
  const calls = [];
  const record = buildDeletionRecordFixture();
  const result = await redactSalesforceCasesForDeletion(buildSalesforceEnv(), record, {
    salesforceLoginImpl: async () => ({
      sessionId: "salesforce-session",
      serverUrl: "https://salesforce.example"
    }),
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (options.method === "GET") {
        if (url.includes("next-late")) {
          return Response.json({ done: true, records: [{ Id: "case-late" }] });
        }
        if (decodeURIComponent(url).includes("LUMIS-chart-late")) {
          return Response.json({
            done: false,
            nextRecordsUrl: "/services/data/v59.0/query/next-late",
            records: []
          });
        }
        return Response.json({
          done: true,
          records: [{ Id: "case-1" }, { Id: "case-duplicate" }]
        });
      }
      return new Response(null, { status: 204 });
    }
  });

  const patchCalls = calls.filter((call) => call.options.method === "PATCH");
  assert(calls.filter((call) => call.options.method === "GET").length === 3, "Expected paginated Case discovery.");
  assert(patchCalls.length === 4, "Expected every duplicate and late-discovered Salesforce Case to be redacted.");
  const payload = JSON.parse(patchCalls[0].options.body);
  assert(payload.SuppliedEmail === null, "Salesforce deletion must clear email.");
  assert(payload.Customer_Birthdate__c === null, "Salesforce deletion must clear birth date.");
  assert(
    result.externalRecordId === "case-1,case-2,case-duplicate,case-late",
    "Expected all updated Salesforce Case references."
  );

  await assertRejectsWithCode(
    () => redactSalesforceCasesForDeletion(buildSalesforceEnv(), record, {
      salesforceLoginImpl: async () => ({
        sessionId: "salesforce-session",
        serverUrl: "https://salesforce.example"
      }),
      fetchImpl: async (_url, options) => options.method === "GET"
        ? Response.json({ done: true, records: [] })
        : Response.json({ error: "failed" }, { status: 500 })
    }),
    "SALESFORCE_DELETION_UPDATE_FAILED"
  );

  const hostileCalls = [];
  await assertRejectsWithCode(
    () => redactSalesforceCasesForDeletion(buildSalesforceEnv(), record, {
      salesforceLoginImpl: async () => ({
        sessionId: "salesforce-session",
        serverUrl: "https://salesforce.example"
      }),
      fetchImpl: async (url, options) => {
        hostileCalls.push({ url, options });
        return Response.json({
          done: false,
          nextRecordsUrl: "https://attacker.example/collect",
          records: []
        });
      }
    }),
    "SALESFORCE_DELETION_LOOKUP_INVALID_RESPONSE"
  );
  assert(hostileCalls.length === 1, "Untrusted Salesforce pagination URL must never be fetched.");
  assert(
    hostileCalls.every((call) => new URL(call.url).origin === "https://salesforce.example"),
    "Salesforce bearer token must stay on the authenticated Salesforce origin."
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
    "GOOGLE_SHEETS_LOOKUP_FAILED"
  );
  await assertRejectsWithCode(
    () =>
      appendMobileChartToSheets(buildGoogleEnv(), record, {
        getGoogleTokenImpl: async () => "google-token",
        fetchImpl: async (_url, options) =>
          options.method === "GET"
            ? Response.json({ values: [] })
            : Response.json({ unexpected: true })
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
        fetchImpl: async (_url, options) =>
          options.method === "GET"
            ? Response.json({ records: [] })
            : Response.json({ unexpected: true })
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
    if (String(url).includes("/query?")) {
      return Response.json({ records: [] });
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
      payloads.some((payload) => payload.error === "AUDIT_DELIVERY_IN_PROGRESS"),
      "Expected a concurrent retry to wait for the in-progress delivery."
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
          if (options.method === "GET") return Response.json({ values: [] });
          return Response.json({ updates: { updatedRange: "Lumis Mobile Charts!A2:T2" } });
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

  assert(appendCalls.length === 2, "Expected one Sheet lookup and one append under concurrency.");
  assert(
    payloads.some((payload) => payload.error === "AUDIT_DELIVERY_IN_PROGRESS"),
    "Expected a concurrent Google Sheets retry to wait for delivery."
  );
}

async function assertDestinationLookupPreventsReplayDuplicates() {
  const record = buildAuditRecordFixture();
  const googleCalls = [];
  const googleResult = await appendMobileChartToSheets(buildGoogleEnv(), record, {
    getGoogleTokenImpl: async () => "google-token",
    fetchImpl: async (url, options) => {
      googleCalls.push({ url, options });
      return Response.json({ values: [["header"], [record.request_id]] });
    }
  });
  const salesforceCalls = [];
  const salesforceResult = await createMobileChartSalesforceCase(buildSalesforceEnv(), record, {
    salesforceLoginImpl: async () => ({
      sessionId: "session",
      serverUrl: "https://salesforce.example"
    }),
    fetchImpl: async (url, options) => {
      salesforceCalls.push({ url, options });
      return Response.json({ records: [{ Id: "existing-case" }] });
    }
  });

  assert(googleCalls.length === 1, "Existing Sheet row should skip append.");
  assert(googleResult.alreadyDelivered, "Existing Sheet row should be treated as delivered.");
  assert(salesforceCalls.length === 1, "Existing Salesforce Case should skip create.");
  assert(salesforceResult.externalRecordId === "existing-case", "Expected existing Case ID.");
}

async function assertFailedDeliveryCanRetrySafely() {
  const storage = buildTransactionalStorage();
  let shouldFail = true;
  const calls = [];
  const coordinator = new AuditDeliveryCoordinator(
    { storage },
    buildGoogleEnv(),
    {
      google: {
        getGoogleTokenImpl: async () => "google-token",
        fetchImpl: async (_url, options) => {
          calls.push(options.method);
          if (options.method === "GET") return Response.json({ values: [] });
          if (shouldFail) return Response.json({ error: "temporary" }, { status: 503 });
          return Response.json({ updates: { updatedRange: "Lumis Mobile Charts!A3:T3" } });
        }
      }
    }
  );
  const request = () => buildCoordinatorRequest("google_sheets", buildAuditRecordFixture());
  const firstResponse = await coordinator.fetch(request());
  shouldFail = false;
  const secondResponse = await coordinator.fetch(request());
  const secondPayload = await secondResponse.json();

  assert(firstResponse.status === 502, "Expected first temporary delivery failure.");
  assert(secondResponse.status === 200, "Expected failed delivery to be retryable.");
  assert(secondPayload.status === "delivered", "Expected retry to deliver successfully.");
  assert(calls.filter((method) => method === "POST").length === 2, "Expected exactly two append attempts.");
}

async function assertStaleProcessingDeliveryRecovers() {
  const record = buildAuditRecordFixture();
  const storage = buildTransactionalStorage([
    [
      "delivery:google_sheets",
      {
        status: "processing",
        request_id: record.request_id,
        started_at: new Date(Date.now() - 16 * 60 * 1000).toISOString()
      }
    ]
  ]);
  const calls = [];
  const coordinator = new AuditDeliveryCoordinator(
    { storage },
    buildGoogleEnv(),
    {
      google: {
        getGoogleTokenImpl: async () => "google-token",
        fetchImpl: async (_url, options) => {
          calls.push(options.method);
          return Response.json({ values: [[record.request_id]] });
        }
      }
    }
  );
  const response = await coordinator.fetch(buildCoordinatorRequest("google_sheets", record));
  const payload = await response.json();

  assert(response.status === 200, "Expected stale processing delivery to recover.");
  assert(payload.status === "delivered", "Expected recovered delivery to be marked delivered.");
  assert(calls.length === 1 && calls[0] === "GET", "Recovery should find the existing row without append.");
}

function buildAuditRecordFixture() {
  return buildMobileAuditRecord(
    buildRequestBody({ birth_time: "16:55", time_unknown: false }),
    { precision: "full", planets: new Array(14).fill({}), houses: new Array(12).fill({}) }
  );
}

function buildDeletionRecordFixture() {
  return {
    operation: "account_deletion",
    deletion_request_id: "20000000-0000-4000-8000-000000000001",
    request_id: "lumis:account-deletion:20000000-0000-4000-8000-000000000001:google_sheet",
    user_id: "10000000-0000-4000-8000-000000000001",
    session_ids: [101, 102],
    deletion_requested_at: "2026-07-16T10:00:00.000Z",
    source: "mobile_app",
    salesforce_case_ids: ["case-1", "case-2"],
    salesforce_case_subjects: ["LUMIS-chart-stable", "LUMIS-chart-late"]
  };
}

function buildAdminSyncBody() {
  const record = buildAuditRecordFixture();

  return {
    event_id: "10000000-0000-4000-8000-000000000001",
    user_id: record.user_id,
    destination: "google_sheet",
    idempotency_key: "lumis:chart:1:google_sheet",
    record
  };
}

function buildCoordinatorBindingStub(payload) {
  return {
    idFromName(value) {
      return value;
    },
    get() {
      return {
        async fetch() {
          return Response.json(payload);
        }
      };
    }
  };
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

function buildTransactionalStorage(initialEntries = []) {
  const values = new Map(initialEntries);
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
