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
  box.append(el("div", { class: "small", text: `ASC (fixed): ${c.fixed_asc.sign}` }));
  const t = el("table");
  t.append(el("tr", {}, el("th", { text: "Factor" }), el("th", { text: "Resolved" }), el("th", { text: "Derivation" })));
  for (const f of c.factors) t.append(el("tr", {}, el("td", { text: f.factor }), el("td", { text: f.sign }), el("td", { class: "small", text: f.note })));
  box.append(t);
}

function line(k, v) { return el("div", { class: "line" }, el("span", { class: "k", text: k }), el("span", { class: "v", text: String(v) })); }
function group(title, ...lines) { const g = el("div", { class: "group" }, el("h3", { text: title })); for (const l of lines) g.append(l); return g; }

function renderDetails(body, target) {
  const box = target || $("message-details"); box.className = "trace"; box.innerHTML = "";
  const pc = body.product_classification || { class: "unavailable", label: body.result || "—" };
  const head = el("div", { class: "row" }, el("span", { class: "badge " + (CLASS_BADGE[pc.class] || "b-error"), text: pc.label }), el("span", { class: "small", text: `state: ${body.canonical_state}` }));
  box.append(head);
  const t = body.decision_trace;
  if (t) {
    box.append(group("Routing",
      line("selected role", `${t.selected_role.current_label} (${t.selected_role.code})`),
      line("classification", t.deterministic_classification.canonical_state),
      line("safe to proceed", `${t.safe_to_proceed.value} — ${t.safe_to_proceed.reason}`),
      line("language", `${t.detected_language} (${t.language_source})`)));
    box.append(group("Provider",
      line("authorized", String(body.provider_authorized)),
      line("reason", body.provider_authorization_reason || "—"),
      line("attempts", body.provider_attempts),
      line("units", body.units_charged), line("persist", body.persistence)));
    box.append(group("Model / prompt",
      line("deployment", t.model_identity.deployment), line("model", `${t.model_identity.model} (${t.model_identity.model_version})`),
      line("prompt pipeline", t.prompt_system_version.persona_prompt_pipeline), line("no chain-of-thought", t.no_hidden_chain_of_thought)));
    if (body.generative_prompt_preview) { const g = group("Assembled persona prompt (would be sent)"); g.append(el("pre", { text: body.generative_prompt_preview })); box.append(g); }
  } else if (body.error_code) {
    box.append(el("div", { class: "small", text: `error: ${body.error_code}` }));
  }
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

$("send").addEventListener("click", send);
$("message").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } });
$("new-conversation").addEventListener("click", newConversation);
$("clear-session").addEventListener("click", newConversation);
$("run-regression").addEventListener("click", runRegression);
document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => switchTab(b.dataset.tab)));

loadConfig().catch(() => { $("ai-state").textContent = "config error"; });
