export const MOBILE_DICE_REQUEST_KEYS = Object.freeze(["fixture_id", "planet_id", "sign_id", "house_id"]);

const PLANETS = new Set(["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto", "north_node", "south_node"]);
const SIGNS = new Set(["aries", "taurus", "gemini", "cancer", "leo", "virgo", "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces"]);
const HOUSES = new Set(Array.from({ length: 12 }, (_, index) => `house_${index + 1}`));

export function validateMobileDiceRelayRequest(value, fixtureIds) {
  return exactKeys(value, MOBILE_DICE_REQUEST_KEYS) && fixtureIds.has(value.fixture_id) &&
    PLANETS.has(value.planet_id) && SIGNS.has(value.sign_id) && HOUSES.has(value.house_id);
}

export function projectMobileDiceUpstream(status, payload, fixtureId) {
  if (status >= 200 && status < 300 && exactKeys(payload, ["result", "metadata"]) && record(payload.result)) {
    return Object.freeze({ status: 200, body: payload.result });
  }
  const language = fixtureId.includes("-zh-") ? "zh-Hant" : "en";
  if (payload?.error?.code === "DICE_SAFETY_REDIRECT") {
    return Object.freeze({ status: 200, body: outcome("safety_redirect", language, "Lumis can’t help with that request, but it can offer a safer, general reflection instead.") });
  }
  if (payload?.error?.code === "DICE_FIXED_FALLBACK") {
    return Object.freeze({ status: 200, body: outcome("fixed_fallback", language, "Lumis couldn’t complete that reflection just now. Please try again.") });
  }
  return Object.freeze({ status: 502, body: { error: "DICE_GATEWAY_UNAVAILABLE" } });
}

function outcome(result, language, message) {
  return { schema: "lumis_dice_mobile_result_v1", result, language, message, effects: { persistence_writes: 0, units_charged: 0 } };
}
function record(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function exactKeys(value, expected) {
  return record(value) && Object.keys(value).length === expected.length && Object.keys(value).every((key) => expected.includes(key));
}
