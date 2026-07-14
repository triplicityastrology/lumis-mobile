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

const MOBILE_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, X-Lumis-Signature-Version, X-Lumis-Timestamp, X-Lumis-Signature, X-Lumis-Request-Id, X-Lumis-User-Id"
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: MOBILE_CORS_HEADERS });
    }

    if (url.pathname === "/mobile/natal-chart" && request.method === "POST") {
      return handleMobileNatalChart(request, env, ctx);
    }

    return json({ error: "Not found" }, 404);
  }
};

async function handleMobileNatalChart(request, env, ctx) {
  const rawBody = await request.text();

  try {
    await verifyMobileSignature(request, env, rawBody);

    const body = JSON.parse(rawBody);
    validateMobilePayload(body);

    const astroPayload = buildAstrologyApiPayload(body.birth_data);
    const astroResp = await fetch("https://api.astrology-api.io/api/v3/charts/natal", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.ASTRO_API_KEY}`
      },
      body: JSON.stringify(astroPayload)
    });
    const astroText = await astroResp.text();

    if (!astroResp.ok) {
      return json(
        {
          error: "ASTROLOGY_API_FAILED",
          status: astroResp.status,
          message: astroText.slice(0, 500)
        },
        502
      );
    }

    const providerChart = JSON.parse(astroText);
    const chartV2 = buildChartV2({
      providerChart,
      timeUnknown: body.birth_data.time_unknown
    });

    ctx.waitUntil(recordMobileChartAttempt(env, body, chartV2).catch(() => undefined));

    return json({
      request_id: body.request_id,
      chart_v2: chartV2
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mobile chart generation failed.";
    const status = message === "Unauthorized" ? 401 : 400;

    return json({ error: message }, status);
  }
}

async function verifyMobileSignature(request, env, rawBody) {
  const signingSecret = env.CHART_WORKER_SIGNING_SECRET;

  if (!signingSecret) {
    throw new Error("CHART_WORKER_SIGNING_SECRET is not configured.");
  }

  if (request.headers.get("X-Lumis-Signature-Version") !== "v1") {
    throw new Error("Unauthorized");
  }

  const timestamp = request.headers.get("X-Lumis-Timestamp");
  const signature = request.headers.get("X-Lumis-Signature");

  if (!timestamp || !signature) {
    throw new Error("Unauthorized");
  }

  const ageMs = Math.abs(Date.now() - Number(timestamp));

  if (!Number.isFinite(ageMs) || ageMs > 5 * 60 * 1000) {
    throw new Error("Unauthorized");
  }

  const expectedSignature = await sign(`${timestamp}.${rawBody}`, signingSecret);

  if (!constantTimeEqual(signature, expectedSignature)) {
    throw new Error("Unauthorized");
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

function validateMobilePayload(body) {
  const birthData = body?.birth_data;

  if (body?.calculation_version !== "mobile_natal_v1") {
    throw new Error("Unsupported calculation_version.");
  }

  if (!body?.user_id || !body?.request_id || !birthData) {
    throw new Error("Missing mobile chart request fields.");
  }

  if (
    !birthData.birth_date ||
    !birthData.place_name ||
    !birthData.country_code ||
    !birthData.tz_str ||
    !Number.isFinite(Number(birthData.lat)) ||
    !Number.isFinite(Number(birthData.lng))
  ) {
    throw new Error("Missing resolved birth place fields.");
  }

  if (!birthData.time_unknown && !birthData.birth_time) {
    throw new Error("birth_time is required unless time_unknown=true.");
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
    },
    rawProviderResponse: providerChart
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

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...MOBILE_CORS_HEADERS,
      "Content-Type": "application/json"
    }
  });
}
