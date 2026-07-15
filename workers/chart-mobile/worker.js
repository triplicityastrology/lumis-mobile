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
        city: "",
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
    providerChart?.data?.houses ??
    providerChart?.houses ??
    providerChart?.chart?.houses;

  if (!Array.isArray(candidate)) {
    return [];
  }

  return candidate
    .map((house, index) => ({
      no: Number(house.no ?? house.number ?? index + 1),
      sign: String(house.sign ?? house.sign_name ?? ""),
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
    sign: String(point.sign ?? point.sign_name ?? point.zodiac_sign ?? ""),
    degree: Number(point.degree ?? point.position ?? point.normDegree ?? point.full_degree ?? 0),
    house: point.house == null ? undefined : Number(point.house),
    retrograde: point.retrograde ?? point.is_retrograde,
    absoluteLongitude:
      point.absoluteLongitude == null && point.full_degree == null
        ? undefined
        : Number(point.absoluteLongitude ?? point.full_degree)
  };
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

async function recordMobileChartAttempt(_env, _body, _chartV2) {
  // TODO: wire mobile-specific Google Sheets row and Salesforce Case values.
  // Keep this non-blocking through ctx.waitUntil, matching the website Worker pattern.
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
