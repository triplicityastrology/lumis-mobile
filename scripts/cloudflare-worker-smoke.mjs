const workerBaseUrl = requireEnvironment("CHART_WORKER_URL").replace(/\/$/, "");
const signingSecret = requireEnvironment("CHART_WORKER_SIGNING_SECRET");
const endpoint = process.env.CHART_WORKER_ENDPOINT ?? "/mobile/natal-chart";
const workerUrl = `${workerBaseUrl}${endpoint}`;
const results = [];

const fullTimeBody = buildBody({
  request_id: `worker-smoke-full-${crypto.randomUUID()}`,
  birth_time: "16:55",
  time_unknown: false
});
const fullTime = await invokeSigned(fullTimeBody);
assert(fullTime.status === 200, `Full-time request returned HTTP ${fullTime.status}.`);
assert(fullTime.body.request_id === fullTimeBody.request_id, "Worker returned the wrong request ID.");
assert(fullTime.body.chart_v2?.precision === "full", "Full-time chart precision is incorrect.");
assert(fullTime.body.chart_v2?.planets?.length > 0, "Full-time chart contains no planets.");
assert(!containsKey(fullTime.body, "rawProviderResponse"), "Worker exposed raw provider output.");
pass("Valid signed full-time request succeeds without raw provider output");

const unknownTimeBody = buildBody({
  request_id: `worker-smoke-unknown-${crypto.randomUUID()}`,
  birth_time: null,
  time_unknown: true
});
const unknownTime = await invokeSigned(unknownTimeBody);
assert(unknownTime.status === 200, `Unknown-time request returned HTTP ${unknownTime.status}.`);
const unknownChart = unknownTime.body.chart_v2;
assert(unknownChart?.precision === "no_birth_time", "Unknown-time precision is incorrect.");
assert(unknownChart?.houses?.length === 0, "Unknown-time chart contains houses.");
assert(!unknownChart?.angles?.ascendant, "Unknown-time chart contains Ascendant.");
assert(!unknownChart?.angles?.mediumCoeli, "Unknown-time chart contains MC.");
assert(
  !unknownChart?.planets?.some((planet) =>
    ["ascendant", "medium_coeli"].includes(planet.key)
  ),
  "Unknown-time chart contains Ascendant or MC points."
);
assert(
  !unknownChart?.planets?.some((planet) => planet.house != null),
  "Unknown-time chart contains planet house placements."
);
pass("Unknown-time request removes Ascendant, MC, houses, and house placements");

const badSignature = await invokeSigned(fullTimeBody, { signature: "sha256=invalid" });
assert(badSignature.status === 401, "Invalid signature was not rejected.");
assert(badSignature.body.error === "UNAUTHORIZED", "Invalid signature returned an unsafe error.");
pass("Invalid signature is rejected before provider work");

const expiredTimestamp = String(Date.now() - 6 * 60 * 1000);
const expired = await invokeSigned(fullTimeBody, { timestamp: expiredTimestamp });
assert(expired.status === 401, "Expired signature was not rejected.");
pass("Expired signature is rejected");

const missingSignature = await invokeSigned(fullTimeBody, { omitSignature: true });
assert(missingSignature.status === 401, "Missing signature was not rejected.");
pass("Missing signature is rejected");

console.log(
  JSON.stringify(
    {
      ok: true,
      worker_url: workerUrl,
      checks: results,
      chart_summaries: [summarizeChart(fullTime.body.chart_v2), summarizeChart(unknownChart)]
    },
    null,
    2
  )
);

async function invokeSigned(body, options = {}) {
  const rawBody = JSON.stringify(body);
  const timestamp = options.timestamp ?? String(Date.now());
  const signature = options.signature ?? (await sign(`${timestamp}.${rawBody}`, signingSecret));
  const headers = {
    "Content-Type": "application/json",
    "X-Lumis-Signature-Version": "v1",
    "X-Lumis-Timestamp": timestamp,
    "X-Lumis-Request-Id": body.request_id,
    "X-Lumis-User-Id": body.user_id
  };

  if (!options.omitSignature) {
    headers["X-Lumis-Signature"] = signature;
  }

  const response = await fetch(workerUrl, {
    method: "POST",
    headers,
    body: rawBody
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
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

function buildBody(overrides) {
  return {
    user_id: "00000000-0000-4000-8000-000000000001",
    calculation_version: "mobile_natal_v1",
    request_id: overrides.request_id,
    requested_at: new Date().toISOString(),
    client: {
      source: "lumis_mobile_supabase",
      environment: "staging"
    },
    audit: {
      source: "mobile_app",
      product: "Lumis",
      flow: "onboarding_chart_generation",
      email: "worker-smoke@example.invalid",
      plan: "starter",
      chart_type: "natal"
    },
    birth_data: {
      name: "Lumis Worker Smoke",
      birth_date: "1986-02-20",
      birth_time: overrides.birth_time,
      time_unknown: overrides.time_unknown,
      place_name: "Hong Kong",
      country_code: "HK",
      lat: 22.3193,
      lng: 114.1694,
      tz_str: "Asia/Hong_Kong"
    }
  };
}

function summarizeChart(chart) {
  return {
    precision: chart.precision,
    point_count: chart.planets.length,
    house_count: chart.houses.length,
    points: chart.planets.map((planet) => ({
      key: planet.key,
      sign: planet.sign,
      degree: planet.degree,
      house: planet.house ?? null
    }))
  };
}

function containsKey(value, target) {
  if (!value || typeof value !== "object") return false;
  if (Object.prototype.hasOwnProperty.call(value, target)) return true;
  return Object.values(value).some((child) => containsKey(child, target));
}

function requireEnvironment(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for the live Worker smoke test.`);
  return value;
}

function pass(message) {
  results.push(message);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
