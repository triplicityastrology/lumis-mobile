import { readFile } from "node:fs/promises";

const artifact = JSON.parse(
  await readFile(new URL("../packages/astrology/src/official-website-golden-cases.json", import.meta.url), "utf8")
);
const workerBaseUrl = requireEnvironment("CHART_WORKER_URL").replace(/\/$/, "");
const signingSecret = requireEnvironment("CHART_WORKER_SIGNING_SECRET");
const workerUrl = `${workerBaseUrl}${process.env.CHART_WORKER_ENDPOINT ?? "/mobile/natal-chart"}`;
const signOrder = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"
];
const results = [];

for (const goldenCase of artifact.cases) {
  const requestId = `golden-${goldenCase.id}-${crypto.randomUUID()}`;
  const payload = {
    user_id: "00000000-0000-4000-8000-000000000001",
    calculation_version: "mobile_natal_v1",
    request_id: requestId,
    requested_at: new Date().toISOString(),
    client: { source: "lumis_mobile_supabase", environment: "staging" },
    audit: {
      source: "mobile_app",
      product: "Lumis",
      flow: "onboarding_chart_generation",
      plan: "starter",
      chart_type: "natal"
    },
    birth_data: goldenCase.input
  };
  const response = await invokeSigned(payload);

  if (response.status !== 200) {
    throw new Error(`${goldenCase.id}: signed Worker returned HTTP ${response.status}: ${JSON.stringify(response.body)}`);
  }

  const issues = compareCase(goldenCase, response.body?.chart_v2);
  if (issues.length > 0) {
    throw new Error(`${goldenCase.id} failed:\n- ${issues.join("\n- ")}`);
  }

  results.push({
    id: goldenCase.id,
    sessionId: goldenCase.reference.sessionId,
    pointCount: response.body.chart_v2.planets.length,
    houseCount: response.body.chart_v2.houses.length,
    status: "passed"
  });
}

console.log(JSON.stringify({ ok: true, workerUrl, source: artifact.source, cases: results }, null, 2));

function compareCase(goldenCase, actual) {
  const issues = [];
  if (!actual) return ["Worker response has no chart_v2."];
  if (actual.precision !== goldenCase.expected.precision) {
    issues.push(`precision: expected ${goldenCase.expected.precision}, received ${actual.precision}`);
  }

  for (const expected of goldenCase.expected.points) {
    const point = actual.planets?.find((candidate) => candidate.key === expected.key);
    if (!point) {
      issues.push(`${expected.key}: missing`);
      continue;
    }
    if (point.sign !== expected.sign) issues.push(`${expected.key}: expected sign ${expected.sign}, received ${point.sign}`);
    if (point.house !== expected.house) issues.push(`${expected.key}: expected house ${expected.house}, received ${point.house ?? "none"}`);
    if (!Number.isFinite(point.absoluteLongitude)) {
      issues.push(`${expected.key}: missing absolute longitude`);
    } else if (angularDistance(point.absoluteLongitude, expected.absoluteLongitude) > expected.toleranceDegrees) {
      issues.push(
        `${expected.key}: expected ${expected.absoluteLongitude}deg ±${expected.toleranceDegrees}, received ${point.absoluteLongitude}deg`
      );
    }
  }

  if (actual.houses?.length !== goldenCase.expected.houses.length) {
    issues.push(`houses: expected ${goldenCase.expected.houses.length}, received ${actual.houses?.length ?? 0}`);
  }
  for (const expected of goldenCase.expected.houses) {
    const house = actual.houses?.find((candidate) => candidate.no === expected.no);
    if (!house) {
      issues.push(`house ${expected.no}: missing`);
      continue;
    }
    if (house.sign !== expected.sign) issues.push(`house ${expected.no}: expected sign ${expected.sign}, received ${house.sign}`);
    const longitude = absoluteLongitude(house.sign, house.cuspDegree);
    if (longitude == null || angularDistance(longitude, expected.absoluteLongitude) > expected.toleranceDegrees) {
      issues.push(
        `house ${expected.no}: expected ${expected.absoluteLongitude}deg ±${expected.toleranceDegrees}, received ${longitude ?? "invalid"}deg`
      );
    }
  }
  return issues;
}

async function invokeSigned(body) {
  const rawBody = JSON.stringify(body);
  const timestamp = String(Date.now());
  const signature = await sign(`${timestamp}.${rawBody}`, signingSecret);
  const response = await fetch(workerUrl, {
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
  return `sha256=${Array.from(new Uint8Array(signature)).map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function absoluteLongitude(sign, degree) {
  const index = signOrder.indexOf(sign);
  return index < 0 ? null : index * 30 + Number(degree);
}

function angularDistance(left, right) {
  const distance = Math.abs(Number(left) - Number(right)) % 360;
  return Math.min(distance, 360 - distance);
}

function requireEnvironment(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for live golden chart comparison.`);
  return value;
}
