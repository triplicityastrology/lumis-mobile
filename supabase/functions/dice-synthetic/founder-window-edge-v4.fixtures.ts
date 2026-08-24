import { createDiceSyntheticEdgeHandler } from "./edge-handler-v1.ts";

const check = (c: unknown, m: string) => { if (!c) throw new Error("FAIL: " + m); };
const environment = {
  LUMIS_DICE_AI_ENABLED: "true", LUMIS_DICE_TRAFFIC_AUTHORIZED: "true", LUMIS_DICE_AZURE_API_KEY: "synthetic-test-key",
  LUMIS_DICE_AUTHORITY_HMAC_SECRET: "synthetic-authority-secret-at-least-32-characters",
  LUMIS_DICE_DEPLOYMENT_ALIAS: "lumis-ai-chat-stg", LUMIS_DICE_MODEL: "gpt-5-mini", LUMIS_DICE_MODEL_VERSION: "2025-08-07",
  LUMIS_DICE_DEPLOYMENT_TYPE: "GlobalStandard", LUMIS_DICE_UPGRADE_POLICY: "NoAutoUpgrade", LUMIS_DICE_GUARDRAIL: "Microsoft.DefaultV2",
  LUMIS_DICE_TPM_LIMIT: "10000", LUMIS_DICE_RPM_LIMIT: "10", LUMIS_DICE_FOUNDRY_HOSTNAME: "lumis-foundry-stg-sea-20260731.services.ai.azure.com",
  LUMIS_DICE_FOUNDRY_PROTOCOL: "https", LUMIS_DICE_API_ROUTE_FAMILY: "v1", SUPABASE_URL: "https://local.invalid", SUPABASE_SERVICE_ROLE_KEY: "local-service-role",
  LUMIS_DICE_FOUNDER_WINDOW_PUBLIC_KEY_PEM: "test-public-key",
  LUMIS_DICE_FOUNDER_FREE_TEXT_ENABLED: "true",
  LUMIS_DICE_FOUNDER_FREE_TEXT_ACCESS_KEY: "founder-free-text-test-access-key-0001",
};
const judgmentResult = {
  schema: "lumis_dice_interpretation_v4", status: "completed", language: "en", question_mode: "judgment",
  planet_layer: null, sign_layer: null, house_layer: null,
  synthesis: "Taking this on is well supported: the core capability is strong and the setting favours you. Still, a strong result depends on handling the basics.",
  judgment_code: "favourable", judgment_summary: "Favourable overall, with aligned capability and environment.",
  timing_summary: null, watch_out: "Do not treat a favourable trend as a reason to skip the basics, or momentum can outrun preparation.",
  practical_step: null, suggested_followups: ["What most needs preparing first?"],
};
let modeCalls = 0;
let interpCalls = 0;
const handler = createDiceSyntheticEdgeHandler({
  environment,
  createAuthorityClient: () => { throw new Error("free text must not construct the authority store"); },
  fetchImpl: async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    const name = body?.text?.format?.name;
    if (name === "lumis_dice_mode_selection_v4") { modeCalls += 1; return new Response(JSON.stringify({ status: "completed", output_text: JSON.stringify({ selection: "judgment" }) }), { status: 200, headers: { "content-type": "application/json" } }); }
    if (name === "lumis_dice_interpretation_v4") { interpCalls += 1; check(body.max_output_tokens === 600, "interpretation uses 600 output budget"); return new Response(JSON.stringify({ status: "completed", output_text: JSON.stringify(judgmentResult) }), { status: 200, headers: { "content-type": "application/json" } }); }
    throw new Error("unexpected schema " + name);
  },
});
const headers = { "content-type": "application/json", "x-lumis-founder-free-text-access": environment.LUMIS_DICE_FOUNDER_FREE_TEXT_ACCESS_KEY, "x-lumis-dice-interpretation": "v4" };

// v4 header -> two-stage completed judgment.
{
  const res = await handler(new Request("http://local/dice-synthetic", { method: "POST", headers, body: JSON.stringify({ question: "Should I accept this promotion?", planet_id: "jupiter", sign_id: "sagittarius", house_id: "house_1" }) }));
  const b = await res.json();
  check(res.status === 200, "v4 completed status 200");
  check(b.result?.schema === "lumis_dice_interpretation_v4" && b.question_mode === "judgment", "v4 result + question_mode surfaced");
  check(b.result?.judgment_code === "favourable" && b.result?.practical_step === null, "judgment code, no practical step");
  check(b.metadata?.question_mode === "judgment" && b.metadata?.provider_calls === 2, "metadata records mode + two provider calls");
  check(modeCalls === 1 && interpCalls === 1, "exactly one mode call + one interpretation call");
  check(!/(api-key|secret|synthetic-test-key)/i.test(JSON.stringify(b)), "no credential leaks in response");
}

// v4 header + bundled question -> hard gate, no provider calls.
{
  const before = modeCalls + interpCalls;
  const res = await handler(new Request("http://local/dice-synthetic", { method: "POST", headers, body: JSON.stringify({ question: "Will I get the promotion and when will it happen?", planet_id: "jupiter", sign_id: "sagittarius", house_id: "house_1" }) }));
  const b = await res.json();
  check(res.status === 422, "bundled v4 request rejected 422");
  check(["DICE_BUNDLED_QUESTION", "DICE_ROUTE_REVIEW_REQUIRED"].includes(b.error?.code), "bundled/route-review code");
  check(b.metadata?.provider_calls === 0 && (modeCalls + interpCalls) === before, "hard gate made no provider call");
}

// No v4 header -> still the v3 path (result_v3), unchanged.
{
  const v3Result = { schema: "lumis_dice_v0_3_result_v3", language: "en", planet_layer: "Saturn centers responsibility and structure.", sign_element_layer: "Capricorn expresses this through disciplined, long-term building.", house_layer: "The 10th House places it in the visible external environment of career.", synthesis: "For this work question, Saturn's structure works through Capricorn's discipline and lands in the public tenth house of career. The picture is steady rather than dramatic, built on reliable delivery over time.", timing_or_pace: null, judgment: null, watch_out: "Treating every visible task as urgent can crowd out the slower structural work that actually moves your standing.", practical_direction: "Pick one visible responsibility and finish it to a clear standard before taking on another." };
  const v3Handler = createDiceSyntheticEdgeHandler({
    environment,
    createAuthorityClient: () => { throw new Error("free text must not construct the authority store"); },
    fetchImpl: async () => new Response(JSON.stringify({ status: "completed", output_text: JSON.stringify(v3Result) }), { status: 200, headers: { "content-type": "application/json" } }),
  });
  const res = await v3Handler(new Request("http://local/dice-synthetic", { method: "POST", headers: { "content-type": "application/json", "x-lumis-founder-free-text-access": environment.LUMIS_DICE_FOUNDER_FREE_TEXT_ACCESS_KEY }, body: JSON.stringify({ question: "What is shaping my current work situation?", planet_id: "saturn", sign_id: "capricorn", house_id: "house_10" }) }));
  const b = await res.json();
  check(res.status === 200 && b.result?.schema === "lumis_dice_v0_3_result_v3", "no header keeps the untouched v3 path");
}

console.log("Dice v4 edge integration passed: header-gated two-stage v4, bundled hard gate, v3 path untouched, no credential leak.");
