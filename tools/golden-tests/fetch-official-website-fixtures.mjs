import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const ENDPOINT = "https://api.triplicityastrology.com/get-chart";
const OUTPUT = resolve("packages/astrology/src/official-website-golden-cases.json");
const SIGN_NAMES = {
  Ari: "Aries", Tau: "Taurus", Gem: "Gemini", Can: "Cancer",
  Leo: "Leo", Vir: "Virgo", Lib: "Libra", Sco: "Scorpio",
  Sag: "Sagittarius", Cap: "Capricorn", Aqu: "Aquarius", Pis: "Pisces"
};
const POINT_KEYS = {
  Sun: "sun", Moon: "moon", Mercury: "mercury", Venus: "venus",
  Mars: "mars", Jupiter: "jupiter", Saturn: "saturn", Uranus: "uranus",
  Neptune: "neptune", Pluto: "pluto", Chiron: "chiron", True_Node: "true_node",
  Ascendant: "ascendant", Medium_Coeli: "medium_coeli"
};
const CASES = [
  {
    id: "official_hong_kong_full_time",
    label: "Official website Hong Kong full-time chart",
    sessionId: "TRI-BOOK-TEST-TRI-20260622-9986",
    expectedInput: { birthDate: "1986-09-27", birthTime: "06:30" },
    notes: "Official Triplicity website Worker/KV chart. Tropical, Placidus, apparent geocentric."
  },
  {
    id: "official_malaysia_full_time",
    label: "Official website Malaysia full-time chart",
    sessionId: "TRI-BOOK-TRI-20260630-4884",
    expectedInput: { birthDate: "1978-10-04", birthTime: "20:00" },
    notes: "Official Triplicity website Worker/KV chart. Tropical, Placidus, apparent geocentric."
  },
  {
    id: "official_shenzhen_full_time",
    label: "Official website Shenzhen full-time chart",
    sessionId: "TRI-MP8H8JK0-DUT7",
    expectedInput: { birthDate: "1986-09-28", birthTime: "00:30" },
    notes:
      "Uses chartData.subject_data as authority: Asia/Shanghai and calculated coordinates 22.5733235, 114.0575822. inputData has a blank timezone and slightly different coordinates."
  }
];

const cases = [];

for (const definition of CASES) {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: definition.sessionId })
  });

  if (!response.ok) {
    throw new Error(`${definition.id}: official Worker returned HTTP ${response.status}.`);
  }

  const raw = await response.json();
  cases.push(toSanitizedCase(definition, raw));
}

const artifact = {
  schemaVersion: 1,
  source: ENDPOINT,
  retrievedOn: "2026-07-22",
  assumptions: {
    zodiac: "Tropical",
    houseSystem: "Placidus",
    perspective: "Apparent Geocentric"
  },
  tolerances: {
    planetAbsoluteLongitude: 0.1,
    angleAbsoluteLongitude: 0.2,
    houseCuspAbsoluteLongitude: 0.2
  },
  cases
};

assertNoPrivateSourceFields(artifact);
await mkdir(dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
console.log(`Wrote ${cases.length} sanitized official golden cases to ${OUTPUT}`);

function toSanitizedCase(definition, raw) {
  const subject = raw?.chartData?.subject_data;
  const chartData = raw?.chartData?.chart_data;
  const points = chartData?.planetary_positions;
  const houses = chartData?.house_cusps;

  if (!subject || !Array.isArray(points) || !Array.isArray(houses)) {
    throw new Error(`${definition.id}: official response is missing chart calculation data.`);
  }
  if (subject.zodiac_type !== "Tropic" || subject.houses_system_identifier !== "P") {
    throw new Error(`${definition.id}: official calculation assumptions changed.`);
  }

  const birthDate = [subject.year, subject.month, subject.day]
    .map((part, index) => index === 0 ? String(part).padStart(4, "0") : String(part).padStart(2, "0"))
    .join("-");
  const birthTime = `${String(subject.hour).padStart(2, "0")}:${String(subject.minute).padStart(2, "0")}`;

  if (birthDate !== definition.expectedInput.birthDate || birthTime !== definition.expectedInput.birthTime) {
    throw new Error(`${definition.id}: official birth input no longer matches the approved case.`);
  }

  const expectedPoints = points
    .filter((point) => POINT_KEYS[point.name])
    .map((point) => ({
      key: POINT_KEYS[point.name],
      sign: requireSign(point.sign, definition.id),
      degree: requireNumber(point.degree, `${definition.id}:${point.name}:degree`),
      absoluteLongitude: requireNumber(point.absolute_longitude, `${definition.id}:${point.name}:longitude`),
      house: requireNumber(point.house, `${definition.id}:${point.name}:house`),
      toleranceDegrees: point.name === "Ascendant" || point.name === "Medium_Coeli" ? 0.2 : 0.1
    }));

  if (expectedPoints.length !== 14 || houses.length !== 12) {
    throw new Error(`${definition.id}: expected 14 supported points and 12 houses.`);
  }

  return {
    id: definition.id,
    label: definition.label,
    status: "ready",
    reference: { kind: "official_website_worker", sessionId: definition.sessionId },
    notes: definition.notes,
    input: {
      name: `Golden ${definition.id}`,
      birth_date: birthDate,
      birth_time: birthTime,
      time_unknown: false,
      place_name: String(subject.city),
      country_code: String(subject.nation),
      lat: requireNumber(subject.lat, `${definition.id}:lat`),
      lng: requireNumber(subject.lng, `${definition.id}:lng`),
      tz_str: String(subject.tz_str)
    },
    expected: {
      precision: "full",
      points: expectedPoints,
      houses: houses.map((house) => ({
        no: requireNumber(house.house, `${definition.id}:house-number`),
        sign: requireSign(house.sign, definition.id),
        cuspDegree: requireNumber(house.degree, `${definition.id}:house-degree`),
        absoluteLongitude: requireNumber(house.absolute_longitude, `${definition.id}:house-longitude`),
        toleranceDegrees: 0.2
      }))
    }
  };
}

function requireSign(value, caseId) {
  const sign = SIGN_NAMES[value];
  if (!sign) throw new Error(`${caseId}: unsupported sign ${String(value)}.`);
  return sign;
}

function requireNumber(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${field} is not numeric.`);
  return number;
}

function assertNoPrivateSourceFields(value, path = "root") {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (["email", "phone", "paid_tier", "marketing_consent"].includes(key.toLowerCase())) {
      throw new Error(`Private source field survived fixture sanitization at ${path}.${key}.`);
    }
    assertNoPrivateSourceFields(child, `${path}.${key}`);
  }
}
