"use strict";
// Founder Companion Web AI Lab — browser client.
// Sends the controlled chart context + latest message + a BOUNDED rolling conversation context to
// the server. Conversation is held only in this browser session; New/Clear remove it. The browser
// never contacts Azure directly and never handles credentials.

const $ = (id) => document.getElementById(id);
const REQUEST_SCHEMA = "companion_web_ai_lab_request_v1";
let CONFIG = null;
let MAX_CONTEXT = 12;
let conversation = []; // [{ role: "user"|"assistant", text }]

const CLASS_BADGE = {
  safe_to_proceed: "b-completed", crisis_safety: "b-safety", out_of_scope: "b-oos",
  professional_boundary: "b-oos", horoscope_request: "b-handoff", unavailable: "b-unavailable",
};

function el(tag, attrs, ...kids) {
  const n = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v; else if (k === "text") n.textContent = v; else n.setAttribute(k, v);
  }
  for (const kid of kids) if (kid != null) n.append(kid);
  return n;
}

async function loadConfig() {
  const cfg = await fetch("/api/lab/config").then((r) => r.json());
  CONFIG = cfg; MAX_CONTEXT = cfg.max_context_turns || 12;
  const role = $("role"); role.innerHTML = "";
  for (const r of cfg.roles) role.append(el("option", { value: r.code, text: `${r.current_label} — ${r.internal_name}` }));
  updateRoleHint(cfg.roles); role.addEventListener("change", () => updateRoleHint(cfg.roles));
  for (const id of ["sun", "moon", "mercury", "saturn"]) {
    const sel = $(id); sel.innerHTML = "";
    for (const s of cfg.signs) sel.append(el("option", { value: String(s.number), text: `${s.number} · ${s.name}` }));
  }
  $("sun").value = "3"; $("moon").value = "6"; $("mercury").value = "3"; $("saturn").value = "10";
  const lang = $("language"); lang.innerHTML = "";
  for (const l of cfg.languages) lang.append(el("option", { value: l.value, text: l.label }));

  const aiPill = $("ai-state");
  aiPill.textContent = cfg.ai_enabled ? "provider: READY (staging)" : "provider: not ready (0 calls)";
  aiPill.className = "pill " + (cfg.ai_enabled ? "pill-on" : "pill-off");
  const idp = $("identity-pill");
  idp.textContent = `identity: ${cfg.identity.identity_verified ? "verified" : "unverified"}`;
  idp.className = "pill " + (cfg.identity.identity_verified ? "pill-on" : "pill-off");
  idp.title = cfg.identity.identity_verified ? `${cfg.identity.scope}` : `${cfg.identity.reason || ""}`;
  $("model-pill").textContent = `model: ${cfg.model_identity.model} @ ${cfg.model_identity.deployment}`;
  $("send-note").textContent = cfg.ai_enabled
    ? `Free text reaches the staging Azure Companion (${cfg.scope}). Rolling context ≤ ${MAX_CONTEXT} turns.`
    : `Provider not ready (${cfg.kill_switch_engaged ? "kill switch LUMIS_AI_ENABLED=false" : (cfg.identity.reason || "identity/config")}). Routing + Chart Composition still shown; no AI call.`;

  const rf = $("reg-fixture"); rf.innerHTML = "";
  for (const f of cfg.regression_fixtures) rf.append(el("option", { value: f.id, text: `${f.language} · ${f.slug}` }));
}

function updateRoleHint(roles) {
  const r = roles.find((x) => x.code === $("role").value);
  $("role-hint").textContent = r ? `code: ${r.code} · historical: ${r.historical_label} (evidence only)` : "";
}
function chart() {
  return { sun: Number($("sun").value), moon: Number($("moon").value), mercury: Number($("mercury").value), saturn: Number($("saturn").value), moon_confirmed: $("moon-confirmed").checked };
}
function appendBubble(role, text) {
  const b = el("div", { class: "bubble " + (role === "user" ? "user" : "assistant") }, el("b", { text: role === "user" ? "You" : "Lumis" }), " " + text);
  $("conversation").append(b); $("conversation").scrollTop = $("conversation").scrollHeight;
}

async function send() {
  const message = $("message").value.trim();
  if (!message) return;
  const priorContext = conversation.slice(-MAX_CONTEXT);
  appendBubble("user", message); $("message").value = "";
  const langSel = $("language").value;
  const req = {
    schema_version: REQUEST_SCHEMA, role_code: $("role").value, chart: chart(),
    message, app_language_preference: langSel === "auto" ? null : langSel, context: priorContext,
  };
  $("loading").hidden = false; $("send").disabled = true;
  let body;
  try { body = await fetch("/api/lab/conversation", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(req) }).then((r) => r.json()); }
  catch (e) { body = { canonical_state: "technical_error", result: "technical_error", error_code: "LAB_NETWORK_ERROR" }; }
  finally { $("loading").hidden = true; $("send").disabled = false; }
  const reply = body.assistant_message || `(${body.result || "no response"}${body.error_code ? " · " + body.error_code : ""})`;
  appendBubble("assistant", reply);
  conversation.push({ role: "user", text: message });
  conversation.push({ role: "assistant", text: reply });
  if (body.chart_composition) renderComposition(body.chart_composition);
  renderDetails(body);
}

function renderComposition(c) {
  const box = $("composition"); box.className = "composition"; box.innerHTML = "";
  box.append(el("div", {}, el("b", { text: `${c.role.current_label} ` }), el("span", { class: "small", text: `(${c.role.code})` })));
  if (!c.available) { box.append(el("p", { class: "b-error badge", text: `chart unavailable: ${c.error_code}` })); return; }
  // Your 4 inputs, and whether this role uses each one.
  if (Array.isArray(c.provided_placements)) {
    box.append(el("div", { class: "small", text: "Your chart → used by this role?" }));
    const pt = el("table");
    pt.append(el("tr", {}, el("th", { text: "Placement" }), el("th", { text: "Your sign" }), el("th", { text: "Used?" })));
    for (const p of c.provided_placements) {
      pt.append(el("tr", {}, el("td", { text: p.placement }), el("td", { text: p.sign }),
        el("td", { class: p.consumed ? "tag used" : "tag unused", text: p.consumed ? "✓ used" : "— not used" })));
    }
    box.append(pt);
  }
  // Derived Companion factors (ASC + the placements this role blends).
  box.append(el("div", { class: "small", text: `Companion (derived) · ASC fixed: ${c.fixed_asc.sign}` }));
  const t = el("table");
  t.append(el("tr", {}, el("th", { text: "Factor" }), el("th", { text: "Resolved" }), el("th", { text: "Derivation" })));
  for (const f of c.factors) t.append(el("tr", {}, el("td", { text: f.factor }), el("td", { text: f.sign }), el("td", { class: "small", text: f.note })));
  box.append(t);
}

function renderPrompt(box, prompt, state) {
  box.className = "trace"; box.innerHTML = "";
  if (prompt) { box.append(el("pre", { text: prompt })); }
  else { box.append(el("div", { class: "small", text: `No assembled prompt for this route (state: ${state || "—"}). The persona prompt is built only for normal-chat routes; safety/scope/handoff routes use fixed copy.` })); }
}

async function calculate() {
  const langSel = $("language").value;
  const req = { schema_version: REQUEST_SCHEMA, role_code: $("role").value, chart: chart(), app_language_preference: langSel === "auto" ? null : langSel };
  $("loading").hidden = false; $("calculate").disabled = true;
  let body;
  try { body = await fetch("/api/lab/compose", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(req) }).then((r) => r.json()); }
  catch (e) { body = { error_code: "LAB_NETWORK_ERROR" }; }
  finally { $("loading").hidden = true; $("calculate").disabled = false; }
  if (body.chart_composition) renderComposition(body.chart_composition);
  else { $("composition").className = "composition"; $("composition").textContent = `cannot derive: ${body.error_code || "error"}`; }
  renderKB($("compose-kb"), body.knowledge_bank);
  renderPrompt($("compose-prompt"), body.generative_prompt_preview, body.canonical_state);
}

function line(k, v) { return el("div", { class: "line" }, el("span", { class: "k", text: k }), el("span", { class: "v", text: String(v) })); }
function group(title, ...lines) { const g = el("div", { class: "group" }, el("h3", { text: title })); for (const l of lines) if (l) g.append(l); return g; }

// Knowledge Bank facts (controlled natal grounding, planet-in-sign).
function renderKB(box, kb) {
  box.className = "trace"; box.innerHTML = "";
  if (!kb || (!kb.facts || !kb.facts.length) && (!kb.suppressed || !kb.suppressed.length)) {
    box.append(el("div", { class: "small", text: "No natal facts for this route (grounding is retrieved only for normal-chat routes)." })); return;
  }
  if (kb.facts && kb.facts.length) {
    const t = el("table");
    t.append(el("tr", {}, el("th", { text: "Planet · Sign" }), el("th", { text: "What → How" })));
    for (const f of kb.facts) {
      t.append(el("tr", {},
        el("td", {}, el("b", { text: `${f.planet_name} in ${f.sign_name}` })),
        el("td", { class: "small", text: `${f.what} → ${f.how}` })));
    }
    box.append(t);
  }
  if (kb.suppressed && kb.suppressed.length) {
    for (const s of kb.suppressed) box.append(el("div", { class: "small b-error badge", text: `suppressed: ${s.planet} — ${s.reason}` }));
  }
}

// Full "thinking process" pipeline so the Founder can verify the logic end to end.
function renderDetails(body, target) {
  const box = target || $("message-details"); box.className = "trace"; box.innerHTML = "";
  const pc = body.product_classification || { class: "unavailable", label: body.result || "—" };
  box.append(el("div", { class: "row" }, el("span", { class: "badge " + (CLASS_BADGE[pc.class] || "b-error"), text: pc.label }), el("span", { class: "small", text: `state: ${body.canonical_state}` })));
  const t = body.decision_trace;
  if (!t) { if (body.error_code) box.append(el("div", { class: "small", text: `error: ${body.error_code}` })); return; }

  box.append(group("1 · Language",
    line("detected", `${t.detected_language} (${t.language_source})`),
    t.request_text_language ? line("request-text script", t.request_text_language) : null));

  box.append(group("2 · Routing & classification",
    line("base route", t.deterministic_classification.base_route),
    line("canonical state", t.deterministic_classification.canonical_state),
    line("product class", `${pc.label} (${pc.class})`),
    line("safe to proceed", `${t.safe_to_proceed.value} — ${t.safe_to_proceed.reason}`),
    line("crisis/safety", `${t.crisis_safety_result.triggered}${t.crisis_safety_result.level ? " · " + t.crisis_safety_result.level : ""}`),
    line("out of scope", `${t.out_of_scope_result.triggered}${t.out_of_scope_result.kind ? " · " + t.out_of_scope_result.kind : ""}`),
    line("handoff", `${t.routing_handoff.kind}${t.routing_handoff.requires_explicit_confirmation ? " (needs confirm)" : ""}`),
    line("knowledge-bank scope", `${t.knowledge_bank.in_scope} — ${t.knowledge_bank.note}`)));

  const kbg = group("3 · Knowledge Bank (the person's natal facts)");
  const kbBox = el("div"); renderKB(kbBox, body.knowledge_bank); kbg.append(kbBox); box.append(kbg);

  box.append(group("4 · Persona (Companion character)",
    line("selected role", `${t.selected_role.current_label} (${t.selected_role.code})`),
    ...(Array.isArray(t.chart_composition_summary) ? t.chart_composition_summary.map((s) => line("·", s)) : [])));

  box.append(group("5 · Provider",
    line("authorized", String(body.provider_authorized)),
    line("reason", body.provider_authorization_reason || "—"),
    body.provider_disposition ? line("disposition", body.provider_disposition) : null,
    line("attempts", body.provider_attempts),
    line("units", body.units_charged), line("persist", body.persistence)));

  box.append(group("6 · Model / prompt versions",
    line("deployment", t.model_identity.deployment),
    line("model", `${t.model_identity.model} (${t.model_identity.model_version})`),
    line("persona pipeline", t.prompt_system_version.persona_prompt_pipeline),
    line("persona rule / mapping", `${t.prompt_system_version.persona_rule} / ${t.prompt_system_version.persona_mapping}`),
    line("template registry", t.prompt_system_version.fixed_template_registry),
    line("no chain-of-thought", t.no_hidden_chain_of_thought),
    line("latency", `${t.latency.total_ms}ms (${t.latency.duration_bucket})`)));

  if (body.generative_prompt_preview) { const g = group("7 · Assembled prompt actually sent"); g.append(el("pre", { text: body.generative_prompt_preview })); box.append(g); }
}

async function runRegression() {
  const fixture_id = $("reg-fixture").value;
  $("loading").hidden = false; $("run-regression").disabled = true;
  let body;
  try { body = await fetch("/api/lab/regression", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ schema_version: "companion_web_ai_lab_regression_request_v1", fixture_id }) }).then((r) => r.json()); }
  catch (e) { body = { result: "technical_error", error_code: "LAB_NETWORK_ERROR" }; }
  finally { $("loading").hidden = true; $("run-regression").disabled = false; }
  const box = $("reg-result"); box.className = "trace"; box.innerHTML = "";
  box.append(el("div", {}, el("b", { text: `${fixture_id} ` }), el("span", { class: "small", text: `→ ${body.result}` })));
  if (body.assistant_message) box.append(el("pre", { text: body.assistant_message }));
  renderDetails(body, el("div"));
  const details = el("div"); renderDetails(body, details); box.append(details);
}

function newConversation() { conversation = []; $("conversation").innerHTML = ""; $("message-details").className = "trace muted"; $("message-details").textContent = "—"; }
function switchTab(name) {
  document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  $("tab-companion").classList.toggle("hidden", name !== "companion");
  $("tab-regression").classList.toggle("hidden", name !== "regression");
}

$("calculate").addEventListener("click", calculate);
$("send").addEventListener("click", send);
$("message").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } });
$("new-conversation").addEventListener("click", newConversation);
$("clear-session").addEventListener("click", newConversation);
$("run-regression").addEventListener("click", runRegression);
document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => switchTab(b.dataset.tab)));

loadConfig().catch(() => { $("ai-state").textContent = "config error"; });
