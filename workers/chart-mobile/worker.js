const ACTIVE_POINTS = [
  "Sun",
  "Moon",
  "Mercury",
  "Venus",
  "Mars",
  "Jupiter",
  "Saturn",
  "Uranus",
  "Neptune",
  "Pluto",
  "Chiron",
  "True_Node",
  "Ascendant",
  "Medium_Coeli"
];

const POINT_KEY_MAP = {
  Sun: "sun",
  Moon: "moon",
  Mercury: "mercury",
  Venus: "venus",
  Mars: "mars",
  Jupiter: "jupiter",
  Saturn: "saturn",
  Uranus: "uranus",
  Neptune: "neptune",
  Pluto: "pluto",
  Chiron: "chiron",
  True_Node: "true_node",
  North_Node: "true_node",
  South_Node: "south_node",
  Ascendant: "ascendant",
  Medium_Coeli: "medium_coeli",
  MC: "medium_coeli"
};

const DEFAULT_ALLOWED_ORIGIN = "https://triplicityastrology.com";

const SIGN_NAME_MAP = {
  Ari: "Aries",
  Tau: "Taurus",
  Gem: "Gemini",
  Can: "Cancer",
  Leo: "Leo",
  Vir: "Virgo",
  Lib: "Libra",
  Sco: "Scorpio",
  Sag: "Sagittarius",
  Cap: "Capricorn",
  Aqu: "Aquarius",
  Pis: "Pisces"
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: mobileCorsHeaders(env) });
    }

    if (url.pathname === "/mobile/natal-chart" && request.method === "POST") {
      return handleMobileNatalChart(request, env, ctx);
    }

    return json({ error: "Not found" }, 404, env);
  }
};

async function handleMobileNatalChart(request, env, ctx) {
  const rawBody = await request.text();
  const headerRequestId = request.headers.get("X-Lumis-Request-Id");

  try {
    await verifyMobileSignature(request, env, rawBody);

    const body = JSON.parse(rawBody);
    validateMobilePayload(body, request, env);

    if (!env.ASTRO_API_KEY) {
      throw new WorkerRequestError("WORKER_CONFIGURATION_ERROR", 503);
    }

    const astroPayload = buildAstrologyApiPayload(body.birth_data);
    const astroResp = await fetch("https://api.astrology-api.io/api/v3/charts/natal", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.ASTRO_API_KEY}`
      },
      body: JSON.stringify(astroPayload)
    });
    if (!astroResp.ok) {
      console.error("ASTROLOGY_API_FAILED", {
        request_id: body.request_id,
        provider_status: astroResp.status
      });
      throw new WorkerRequestError("ASTROLOGY_API_FAILED", 502);
    }

    let providerChart;

    try {
      providerChart = await astroResp.json();
    } catch {
      throw new WorkerRequestError("ASTROLOGY_API_INVALID_RESPONSE", 502);
    }
    const chartV2 = buildChartV2({
      providerChart,
      timeUnknown: body.birth_data.time_unknown
    });

    ctx.waitUntil(recordMobileChartAttempt(env, body, chartV2).catch(() => undefined));

    return json(
      {
        request_id: body.request_id,
        chart_v2: chartV2
      },
      200,
      env
    );
  } catch (error) {
    const workerError = normalizeWorkerError(error);

    if (workerError.status >= 500 && workerError.code !== "ASTROLOGY_API_FAILED") {
      console.error("MOBILE_CHART_WORKER_FAILED", {
        request_id: headerRequestId,
        code: workerError.code
      });
    }

    return json(
      {
        error: workerError.code,
        request_id: headerRequestId
      },
      workerError.status,
      env
    );
  }
}

async function verifyMobileSignature(request, env, rawBody) {
  const signingSecret = env.CHART_WORKER_SIGNING_SECRET;

  if (!signingSecret) {
    throw new WorkerRequestError("WORKER_CONFIGURATION_ERROR", 503);
  }

  if (request.headers.get("X-Lumis-Signature-Version") !== "v1") {
    throw new WorkerRequestError("UNAUTHORIZED", 401);
  }

  const timestamp = request.headers.get("X-Lumis-Timestamp");
  const signature = request.headers.get("X-Lumis-Signature");

  if (!timestamp || !signature) {
    throw new WorkerRequestError("UNAUTHORIZED", 401);
  }

  const ageMs = Math.abs(Date.now() - Number(timestamp));

  if (!Number.isFinite(ageMs) || ageMs > 5 * 60 * 1000) {
    throw new WorkerRequestError("UNAUTHORIZED", 401);
  }

  const expectedSignature = await sign(`${timestamp}.${rawBody}`, signingSecret);

  if (!constantTimeEqual(signature, expectedSignature)) {
    throw new WorkerRequestError("UNAUTHORIZED", 401);
  }
}

async function sign(value, signingSecret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signingSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));

  return `sha256=${bytesToHex(new Uint8Array(signature))}`;
}

function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) {
    return false;
  }

  let diff = 0;

  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }

  return diff === 0;
}

function validateMobilePayload(body, request, env) {
  const birthData = body?.birth_data;

  if (body?.calculation_version !== "mobile_natal_v1") {
    throw new WorkerRequestError("INVALID_REQUEST", 400);
  }

  if (!body?.user_id || !body?.request_id || !birthData) {
    throw new WorkerRequestError("INVALID_REQUEST", 400);
  }

  if (
    request.headers.get("X-Lumis-Request-Id") !== body.request_id ||
    request.headers.get("X-Lumis-User-Id") !== body.user_id
  ) {
    throw new WorkerRequestError("UNAUTHORIZED", 401);
  }

  if (
    body.client?.source !== "lumis_mobile_supabase" ||
    !body.client?.environment ||
    (env.LUMIS_ENV && body.client.environment !== env.LUMIS_ENV)
  ) {
    throw new WorkerRequestError("INVALID_REQUEST", 400);
  }

  if (
    body.audit?.source !== "mobile_app" ||
    body.audit?.product !== "Lumis" ||
    !["onboarding_chart_generation", "birth_details_regeneration"].includes(body.audit?.flow) ||
    body.audit?.chart_type !== "natal"
  ) {
    throw new WorkerRequestError("INVALID_REQUEST", 400);
  }

  if (
    !birthData.birth_date ||
    !birthData.place_name ||
    !birthData.country_code ||
    !birthData.tz_str ||
    !Number.isFinite(Number(birthData.lat)) ||
    !Number.isFinite(Number(birthData.lng))
  ) {
    throw new WorkerRequestError("INVALID_REQUEST", 400);
  }

  if (!birthData.time_unknown && !birthData.birth_time) {
    throw new WorkerRequestError("INVALID_REQUEST", 400);
  }
}

function buildAstrologyApiPayload(birthData) {
  const dateParts = birthData.birth_date.split("-").map(Number);
  const timeParts = birthData.time_unknown
    ? [12, 0]
    : String(birthData.birth_time).split(":").map(Number);

  return {
    subject: {
      name: birthData.name || "Lumis user",
      birth_data: {
        year: dateParts[0],
        month: dateParts[1],
        day: dateParts[2],
        hour: timeParts[0],
        minute: timeParts[1],
        second: 0,
        city: birthData.place_name,
        country_code: birthData.country_code.toUpperCase().slice(0, 2),
        lng: Number(birthData.lng),
        lat: Number(birthData.lat),
        tz_str: birthData.tz_str
      }
    },
    options: {
      house_system: "P",
      zodiac_type: "Tropic",
      active_points: ACTIVE_POINTS,
      precision: 2
    }
  };
}

function buildChartV2({ providerChart, timeUnknown }) {
  const providerPoints = findProviderPoints(providerChart);
  const planets = providerPoints
    .map(normalizeProviderPoint)
    .filter(Boolean);
  const chart = {
    version: "chart_v2",
    precision: timeUnknown ? "no_birth_time" : "full",
    source: "triplicity_cloudflare_worker",
    calculatedAt: new Date().toISOString(),
    planets,
    houses: timeUnknown ? [] : findProviderHouses(providerChart),
    angles: {
      ascendant: planets.find((planet) => planet.key === "ascendant"),
      mediumCoeli: planets.find((planet) => planet.key === "medium_coeli")
    }
  };

  return sanitizeUnknownTimeChart(chart, timeUnknown);
}

function findProviderPoints(providerChart) {
  const candidates = [
    providerChart?.chart_data?.planetary_positions,
    providerChart?.data?.points,
    providerChart?.data?.planets,
    providerChart?.points,
    providerChart?.planets,
    providerChart?.chart?.points,
    providerChart?.chart?.planets
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }

    if (candidate && typeof candidate === "object") {
      return Object.values(candidate);
    }
  }

  return [];
}

function findProviderHouses(providerChart) {
  const candidate =
    providerChart?.chart_data?.house_cusps ??
    providerChart?.data?.houses ??
    providerChart?.houses ??
    providerChart?.chart?.houses;

  if (!Array.isArray(candidate)) {
    return [];
  }

  return candidate
    .map((house, index) => ({
      no: Number(house.no ?? house.number ?? house.house ?? index + 1),
      sign: normalizeSign(house.sign ?? house.sign_name),
      cuspDegree: Number(house.cuspDegree ?? house.cusp_degree ?? house.position ?? house.degree ?? 0)
    }))
    .filter((house) => Number.isFinite(house.no) && house.sign);
}

function normalizeProviderPoint(point) {
  const providerName = String(point.name ?? point.label ?? point.id ?? point.key ?? "");
  const normalizedName = providerName.replace(/\s+/g, "_");
  const key = POINT_KEY_MAP[providerName] ?? POINT_KEY_MAP[normalizedName];

  if (!key) {
    return null;
  }

  return {
    key,
    label: labelForPoint(key),
    sign: normalizeSign(point.sign ?? point.sign_name ?? point.zodiac_sign),
    degree: Number(point.degree ?? point.position ?? point.normDegree ?? point.full_degree ?? 0),
    house: point.house == null ? undefined : Number(point.house),
    retrograde: point.retrograde ?? point.is_retrograde,
    absoluteLongitude:
      point.absoluteLongitude == null &&
      point.absolute_longitude == null &&
      point.full_degree == null
        ? undefined
        : Number(point.absoluteLongitude ?? point.absolute_longitude ?? point.full_degree)
  };
}

function normalizeSign(value) {
  const sign = String(value ?? "");

  return SIGN_NAME_MAP[sign] ?? sign;
}

function labelForPoint(key) {
  return {
    sun: "Sun",
    moon: "Moon",
    mercury: "Mercury",
    venus: "Venus",
    mars: "Mars",
    jupiter: "Jupiter",
    saturn: "Saturn",
    uranus: "Uranus",
    neptune: "Neptune",
    pluto: "Pluto",
    chiron: "Chiron",
    true_node: "True Node",
    south_node: "South Node",
    ascendant: "Ascendant",
    medium_coeli: "MC"
  }[key];
}

function sanitizeUnknownTimeChart(chart, timeUnknown) {
  if (!timeUnknown) {
    return chart;
  }

  return {
    ...chart,
    precision: "no_birth_time",
    planets: chart.planets
      .filter((planet) => planet.key !== "ascendant" && planet.key !== "medium_coeli")
      .map((planet) => {
        const { house, ...planetWithoutHouse } = planet;
        return planetWithoutHouse;
      }),
    houses: [],
    angles: {}
  };
}

async function recordMobileChartAttempt(env, body, chartV2) {
  const record = buildMobileAuditRecord(body, chartV2);
  const results = await Promise.allSettled([
    appendMobileChartToSheets(env, record),
    createMobileChartSalesforceCase(env, record)
  ]);

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(index === 0 ? "MOBILE_SHEETS_FAILED" : "MOBILE_SALESFORCE_FAILED", {
        request_id: body.request_id
      });
    }
  });
}

export function buildMobileAuditRecord(body, chartV2) {
  return {
    timestamp: new Date().toISOString(),
    request_id: body.request_id,
    user_id: body.user_id,
    email: body.audit.email || "",
    name: body.birth_data.name || "",
    birth_date: body.birth_data.birth_date,
    birth_time: body.birth_data.time_unknown ? "unknown" : body.birth_data.birth_time,
    place_name: body.birth_data.place_name,
    timezone: body.birth_data.tz_str,
    plan: body.audit.plan || "starter",
    product: "Lumis",
    source: "mobile_app",
    flow: body.audit.flow,
    chart_status: "generated",
    time_unknown: body.birth_data.time_unknown,
    chart_type: "natal",
    precision: chartV2.precision,
    point_count: chartV2.planets.length,
    house_count: chartV2.houses.length
  };
}

export function buildMobileSheetRow(record) {
  return [
    record.timestamp,
    record.request_id,
    record.user_id,
    record.email,
    record.name,
    record.birth_date,
    record.birth_time,
    record.place_name,
    record.timezone,
    record.plan,
    record.product,
    record.source,
    record.flow,
    record.chart_status,
    String(record.time_unknown),
    record.chart_type,
    record.precision,
    record.point_count,
    record.house_count
  ];
}

async function appendMobileChartToSheets(env, record) {
  if (!env.GOOGLE_MOBILE_SHEET_ID || !env.GOOGLE_SERVICE_EMAIL || !env.GOOGLE_PRIVATE_KEY) {
    return;
  }

  const token = await getGoogleToken(env);
  const sheetName = env.GOOGLE_MOBILE_SHEET_NAME || "Lumis Mobile Charts";
  const range = `${encodeURIComponent(sheetName)}!A:S`;
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${env.GOOGLE_MOBILE_SHEET_ID}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ values: [buildMobileSheetRow(record)] })
    }
  );

  if (!response.ok) {
    throw new Error("GOOGLE_SHEETS_APPEND_FAILED");
  }
}

async function getGoogleToken(env) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlJson({ alg: "RS256", typ: "JWT" });
  const claim = base64UrlJson({
    iss: env.GOOGLE_SERVICE_EMAIL,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  });
  const signingInput = `${header}.${claim}`;
  const pem = env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n");
  const pemBody = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const keyBytes = Uint8Array.from(atob(pemBody), (character) => character.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput)
  );
  const jwt = `${signingInput}.${base64UrlBytes(new Uint8Array(signature))}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    })
  });
  const payload = await response.json();

  if (!response.ok || !payload.access_token) {
    throw new Error("GOOGLE_TOKEN_FAILED");
  }

  return payload.access_token;
}

function base64UrlJson(value) {
  return base64UrlBytes(new TextEncoder().encode(JSON.stringify(value)));
}

function base64UrlBytes(bytes) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function createMobileChartSalesforceCase(env, record) {
  if (!env.SF_LOGIN_URL || !env.SF_USERNAME || !env.SF_PASSWORD) {
    return;
  }

  const { sessionId, serverUrl } = await salesforceLogin(env);
  const response = await fetch(`${serverUrl}/services/data/v59.0/sobjects/Case`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sessionId}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      Subject: `LUMIS-${record.request_id}`,
      Status: "Free",
      Type: "Auto-Gen Chart Adult",
      SuppliedEmail: record.email,
      SuppliedName: record.name,
      Customer_Birthdate__c: record.birth_date,
      Customer_BirthTime__c:
        record.birth_time === "unknown" ? null : `${record.birth_time}:00.000Z`,
      Customer_Birthplace__c: record.place_name,
      Description: [
        `Product: ${record.product}`,
        `Source: ${record.source}`,
        `Flow: ${record.flow}`,
        `Supabase user: ${record.user_id}`,
        `Plan: ${record.plan}`,
        `Chart status: ${record.chart_status}`,
        `Unknown birth time: ${record.time_unknown}`,
        `Chart type: ${record.chart_type}`,
        `Request: ${record.request_id}`
      ].join(" | ")
    })
  });

  if (!response.ok) {
    throw new Error("SALESFORCE_CASE_FAILED");
  }
}

async function salesforceLogin(env) {
  const loginBody = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="urn:partner.soap.sforce.com">
  <soapenv:Body><urn:login><urn:username>${escapeXml(env.SF_USERNAME)}</urn:username><urn:password>${escapeXml(env.SF_PASSWORD)}</urn:password></urn:login></soapenv:Body>
</soapenv:Envelope>`;
  const response = await fetch(`${env.SF_LOGIN_URL}/services/Soap/u/59.0`, {
    method: "POST",
    headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: "login" },
    body: loginBody
  });
  const responseText = await response.text();

  if (!response.ok) {
    throw new Error("SALESFORCE_LOGIN_FAILED");
  }

  const sessionId = extractXml(responseText, "sessionId");
  const serverUrl = extractXml(responseText, "serverUrl").split("/services")[0];

  if (!sessionId || !serverUrl) {
    throw new Error("SALESFORCE_LOGIN_INVALID_RESPONSE");
  }

  return { sessionId, serverUrl };
}

function extractXml(xml, tag) {
  return xml.match(new RegExp(`<${tag}>([^<]+)</${tag}>`))?.[1] || "";
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

class WorkerRequestError extends Error {
  constructor(code, status) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

function normalizeWorkerError(error) {
  if (error instanceof WorkerRequestError) {
    return error;
  }

  if (error instanceof SyntaxError) {
    return new WorkerRequestError("INVALID_REQUEST", 400);
  }

  return new WorkerRequestError("CHART_WORKER_FAILED", 500);
}

function mobileCorsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || DEFAULT_ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, X-Lumis-Signature-Version, X-Lumis-Timestamp, X-Lumis-Signature, X-Lumis-Request-Id, X-Lumis-User-Id"
  };
}

function json(body, status = 200, env = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...mobileCorsHeaders(env),
      "Content-Type": "application/json"
    }
  });
}
