import assert from "node:assert/strict";

const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

export function validateMobileResponse(response, schema) {
  const definition = schema.$defs.mobileResponse;
  assert(response && typeof response === "object" && !Array.isArray(response), "response must be an object");

  const allowed = new Set(Object.keys(definition.properties));
  for (const key of Object.keys(response)) assert(allowed.has(key), `unknown mobile response field: ${key}`);
  for (const key of definition.required) assert(own(response, key), `missing mobile response field: ${key}`);

  assert.equal(response.schema_version, definition.properties.schema_version.const, "schema_version drift");
  assert(new RegExp(definition.properties.request_id.pattern).test(response.request_id), "invalid request_id");
  assert(new RegExp(schema.$defs.uuidV4.pattern).test(response.client_turn_id), "invalid client_turn_id");
  assert(definition.properties.result.enum.includes(response.result), `unknown mobile response result: ${response.result}`);
  assert(definition.properties.persistence.enum.includes(response.persistence), "invalid persistence");
  assert(definition.properties.idempotency_outcome.enum.includes(response.idempotency_outcome), "invalid idempotency_outcome");
  assert(Number.isInteger(response.units_charged) && response.units_charged >= 0, "invalid units_charged");

  if (own(response, "thread_id")) assert(new RegExp(schema.$defs.uuidV4.pattern).test(response.thread_id), "invalid thread_id");
  if (own(response, "assistant_message")) assert(typeof response.assistant_message === "string" && response.assistant_message.length > 0, "invalid assistant_message");
  if (own(response, "error_code")) assert(new RegExp(definition.properties.error_code.pattern).test(response.error_code), "invalid error_code");

  const branches = Object.fromEntries(definition.oneOf.map((branch) => [branch.properties.result.const, branch]));
  const branch = branches[response.result];
  assert(branch, `result has no schema branch: ${response.result}`);
  for (const key of branch.required ?? []) assert(own(response, key), `${response.result} missing ${key}`);
  for (const [key, rule] of Object.entries(branch.properties)) {
    if (own(rule, "const")) assert.equal(response[key], rule.const, `${response.result} ${key} drift`);
  }

  if (["completed", "duplicate"].includes(response.result)) {
    assert(!own(response, "error_code"), `${response.result} cannot include error_code`);
    const atomic = response.atomic_outcome;
    assert(atomic && typeof atomic === "object" && !Array.isArray(atomic), `${response.result} missing atomic_outcome`);
    const atomicDefinition = schema.$defs.atomicOutcome;
    assert.deepEqual(Object.keys(atomic).sort(), [...atomicDefinition.required].sort(), "atomic_outcome field drift");
    const expected = response.result === "completed" ? "committed" : "replayed";
    for (const key of atomicDefinition.required) assert.equal(atomic[key], expected, `${response.result} atomic ${key} drift`);
  } else {
    assert(!own(response, "thread_id"), `${response.result} cannot include thread_id`);
    assert(!own(response, "atomic_outcome"), `${response.result} cannot include atomic_outcome`);
    assert.equal(response.persistence, "not_committed", `${response.result} must not persist`);
    assert.equal(response.idempotency_outcome, "not_committed", `${response.result} idempotency must not commit`);
    assert.equal(response.units_charged, 0, `${response.result} must charge zero units`);
  }

  if (response.result === "technical_error") assert(!own(response, "assistant_message"), "technical_error cannot include assistant_message");
  return true;
}
