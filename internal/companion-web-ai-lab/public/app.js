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
let sessionId = null;  // server-side persisted session
let selectedTurn = null; // Lumis turn currently being evaluated
let saveTimer = null;
let summaryTimer = null;

function setSaveState(t) { const s = $("save-state"); if (s) s.textContent = t || ""; }
async function api(path, body) {
  const opt = body === undefined ? {} : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
  return fetch(path, opt).then((r) => r.json());
}

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
function appendBubble(role, text, turn) {
  const b = el("div", { class: "bubble " + (role === "user" ? "user" : "assistant") }, el("b", { text: role === "user" ? "You" : "Lumis" }), " " + text);
  if (role === "assistant" && turn != null) {
    b.dataset.turn = String(turn);
    b.title = "Click to evaluate this reply";
    b.style.cursor = "pointer";
    b.addEventListener("click", () => selectMessage(turn));
  }
  $("conversation").append(b); $("conversation").scrollTop = $("conversation").scrollHeight;
  return b;
}

// Ensure a persisted session exists for the current chart + role (creates one if needed).
async function ensureSession() {
  if (sessionId) return sessionId;
  const langSel = $("language").value;
  const j = await api("/api/lab/session/new", {
    role_code: $("role").value, chart: chart(), app_language_preference: langSel === "auto" ? null : langSel,
    tester: $("tester").value.trim(), test_title: $("test-title").value.trim(),
  });
  if (j && j.session) { sessionId = j.session.session_id; reflectSession(j.session); }
  return sessionId;
}
function reflectSession(s) {
  $("session-label").textContent = s ? `(session ${s.session_id.slice(0, 18)}… · saved)` : "(no saved session yet)";
  if (s) { $("overall-result").value = s.overall_result || "not_yet_reviewed"; $("summary-comment").value = s.summary_comment || ""; }
}

async function send() {
  const message = $("message").value.trim();
  if (!message) return;
  await ensureSession();
  const priorContext = conversation.slice(-MAX_CONTEXT);
  appendBubble("user", message); $("message").value = "";
  const langSel = $("language").value;
  const req = {
    schema_version: REQUEST_SCHEMA, role_code: $("role").value, chart: chart(),
    message, app_language_preference: langSel === "auto" ? null : langSel, context: priorContext,
    session_id: sessionId,
  };
  $("loading").hidden = false; $("send").disabled = true;
  let body;
  try { body = await fetch("/api/lab/conversation", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(req) }).then((r) => r.json()); }
  catch (e) { body = { canonical_state: "technical_error", result: "technical_error", error_code: "LAB_NETWORK_ERROR" }; }
  finally { $("loading").hidden = true; $("send").disabled = false; }
  const reply = body.assistant_message || `(${body.result || "no response"}${body.error_code ? " · " + body.error_code : ""})`;
  appendBubble("assistant", reply, body.lumis_turn);
  conversation.push({ role: "user", text: message });
  conversation.push({ role: "assistant", text: reply });
  if (body.lumis_turn != null) { setSaveState("saved ✓"); selectMessage(body.lumis_turn); }
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

  const pg = group("4 · Persona — Character Voice", line("selected role", `${t.selected_role.current_label} (${t.selected_role.code})`));
  if (body.voice_card && Array.isArray(body.voice_card.rows)) {
    const vt = el("table");
    vt.append(el("tr", {}, el("th", { text: "Factor · Sign" }), el("th", { text: "Mapping (v)" }), el("th", { text: "Behaviour instruction" })));
    for (const r of body.voice_card.rows) vt.append(el("tr", {},
      el("td", {}, el("b", { text: `${r.factor} ${r.sign}` })),
      el("td", { class: "small", text: `${r.mapping_id} (${r.version})` }),
      el("td", { class: "small", text: r.instruction })));
    pg.append(vt);
  } else if (Array.isArray(t.chart_composition_summary)) {
    for (const s of t.chart_composition_summary) pg.append(line("·", s));
  }
  box.append(pg);

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

  if (Array.isArray(body.persona_blocks) && body.persona_blocks.length) {
    const g = group("7 · Assembled prompt — by block (what produced each part)");
    for (const blk of body.persona_blocks) {
      g.append(el("div", { class: "small", style: "color:var(--gold);margin-top:6px" }, blk.name));
      g.append(el("pre", { text: blk.text }));
    }
    box.append(g);
  } else if (body.generative_prompt_preview) {
    const g = group("7 · Assembled prompt actually sent"); g.append(el("pre", { text: body.generative_prompt_preview })); box.append(g);
  }
}

// ---------- Part 2: evaluation + sessions ----------
const SCORES = [
  ["usefulness", "Usefulness"], ["tone", "Tone"], ["specificity", "Specificity"],
  ["character_distinctiveness", "Character distinctiveness"], ["natural_flow", "Natural conversational flow"],
];
let currentEval = {};

function selectMessage(turn) {
  selectedTurn = turn;
  document.querySelectorAll(".bubble.assistant").forEach((b) => b.classList.toggle("sel", Number(b.dataset.turn) === turn));
  $("eval-target").textContent = `— turn ${turn}`;
  currentEval = {};
  renderEvalPanel();
}

function scoreRow(key, label) {
  const wrap = el("div", { class: "line" }, el("span", { class: "k", text: label }));
  const btns = el("span");
  for (let n = 1; n <= 5; n++) {
    const b = el("button", { class: "scorebtn" + (currentEval[key] === n ? " on" : ""), type: "button", text: String(n) });
    b.addEventListener("click", () => { currentEval[key] = n; renderEvalPanel(); scheduleEvalSave(); });
    btns.append(b);
  }
  wrap.append(btns); return wrap;
}

function renderEvalPanel() {
  const box = $("eval-panel"); box.className = "eval"; box.innerHTML = "";
  if (selectedTurn == null) { box.className = "eval muted"; box.textContent = "Select a Lumis reply to score it."; return; }
  for (const [key, label] of SCORES) box.append(scoreRow(key, label));
  const lenWrap = el("div", { class: "line" }, el("span", { class: "k", text: "Length" }));
  const lenSel = el("span");
  for (const [v, lbl] of [["too_short", "Too short"], ["about_right", "About right"], ["too_long", "Too long"]]) {
    const b = el("button", { class: "scorebtn" + (currentEval.length === v ? " on" : ""), type: "button", text: lbl });
    b.addEventListener("click", () => { currentEval.length = v; renderEvalPanel(); scheduleEvalSave(); });
    lenSel.append(b);
  }
  lenWrap.append(lenSel); box.append(lenWrap);
  const ta = el("textarea", { rows: "2", placeholder: "Comments…" }); ta.value = currentEval.comments || "";
  ta.addEventListener("input", () => { currentEval.comments = ta.value; scheduleEvalSave(); });
  box.append(ta);
}

function scheduleEvalSave() {
  setSaveState("saving…");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    if (!sessionId || selectedTurn == null) return;
    await api("/api/lab/session/evaluate", { session_id: sessionId, turn: selectedTurn, evaluation: currentEval });
    setSaveState("saved ✓");
  }, 500);
}

async function saveSummary() {
  if (!sessionId) return;
  setSaveState("saving…");
  await api("/api/lab/session/summary", { session_id: sessionId, summary_comment: $("summary-comment").value, overall_result: $("overall-result").value });
  setSaveState("saved ✓");
}

function newConversation() {
  conversation = []; sessionId = null; selectedTurn = null; currentEval = {};
  $("conversation").innerHTML = ""; $("message-details").className = "trace muted"; $("message-details").textContent = "—";
  $("eval-panel").className = "eval muted"; $("eval-panel").textContent = "Select a Lumis reply to score it.";
  $("eval-target").textContent = "— click a Lumis reply above";
  $("overall-result").value = "not_yet_reviewed"; $("summary-comment").value = "";
  reflectSession(null); setSaveState("");
}
async function endAndArchive() {
  if (sessionId) { await api("/api/lab/session/archive", { session_id: sessionId, archived: true }); setSaveState("archived ✓"); }
  newConversation();
}
async function deleteCurrent() {
  if (!sessionId) { newConversation(); return; }
  if (!confirm("Permanently delete this saved session and its scores? This cannot be undone.")) return;
  await api("/api/lab/session/delete", { session_id: sessionId });
  newConversation();
}

// ----- Saved sessions browser -----
let sessionRows = [];
async function loadSessions() {
  const j = await api("/api/lab/sessions");
  sessionRows = (j && j.sessions) || [];
  renderSessionList();
}
function renderSessionList() {
  const box = $("session-list"); box.className = "trace"; box.innerHTML = "";
  const q = ($("session-search").value || "").toLowerCase();
  const filt = $("session-filter").value;
  const rows = sessionRows.filter((s) => {
    if (filt === "archived" ? !s.archived : (filt && s.overall_result !== filt)) return false;
    if (!q) return true;
    return [s.tester, s.test_title, s.role_label, s.session_id].join(" ").toLowerCase().includes(q);
  });
  if (!rows.length) { box.className = "trace muted"; box.textContent = "No sessions."; return; }
  const t = el("table");
  t.append(el("tr", {}, el("th", { text: "✓" }), el("th", { text: "Date" }), el("th", { text: "Test" }), el("th", { text: "Tester" }), el("th", { text: "Role" }), el("th", { text: "Msgs" }), el("th", { text: "Result" }), el("th", { text: "" })));
  for (const s of rows) {
    const cb = el("input", { type: "checkbox", value: s.session_id, class: "sess-cb" });
    const open = el("button", { class: "chip", type: "button", text: "open" });
    open.addEventListener("click", () => openSession(s.session_id));
    t.append(el("tr", {},
      el("td", {}, cb), el("td", { class: "small", text: s.created_at.slice(0, 16).replace("T", " ") }),
      el("td", { text: s.test_title || "—" }), el("td", { class: "small", text: s.tester || "—" }),
      el("td", { class: "small", text: s.role_label }), el("td", { class: "small", text: String(s.lumis_count) }),
      el("td", {}, el("span", { class: "badge " + RESULT_BADGE(s), text: (s.archived ? "archived · " : "") + s.overall_result.replace(/_/g, " ") })),
      el("td", {}, open)));
  }
  box.append(t);
}
function RESULT_BADGE(s) { return s.overall_result === "pass" ? "b-completed" : s.overall_result === "fail" ? "b-safety" : s.overall_result === "needs_improvement" ? "b-oos" : "b-unavailable"; }

function closeSessionDetail() {
  const box = $("session-detail"); box.className = "trace muted"; box.innerHTML = "";
  box.textContent = "Open a session from the list to review its messages, scores, and reproducibility metadata.";
}

async function openSession(id) {
  const j = await api("/api/lab/session?id=" + encodeURIComponent(id));
  const s = j && j.session; const box = $("session-detail"); box.className = "trace"; box.innerHTML = "";
  if (!s) { box.textContent = "not found"; return; }
  // Header: title + saved indicator + Close (so the detail can be dismissed and never traps the list).
  const saved = el("span", { class: "small", id: "detail-saved" });
  const closeBtn = el("button", { class: "btn-secondary", type: "button", text: "✕ Close" });
  closeBtn.addEventListener("click", closeSessionDetail);
  box.append(el("div", { class: "row", style: "justify-content:space-between;align-items:center" },
    el("b", { text: s.test_title || s.session_id }), el("div", { class: "row", style: "gap:8px;margin:0" }, saved, closeBtn)));
  const flash = (t) => { const n = $("detail-saved"); if (n) n.textContent = t; };

  box.append(group("Session",
    line("id", s.session_id), line("tester", s.tester || "—"), line("test", s.test_title || "—"),
    line("role", `${s.role_label} (${s.role_code})`), line("chart", s.chart ? `Sun ${s.chart.sun} Moon ${s.chart.moon} Mercury ${s.chart.mercury} Saturn ${s.chart.saturn}` : "—"),
    line("resolved", Object.entries(s.resolved).map(([k, v]) => `${k}:${v}`).join(" · ")),
    line("versions", `persona ${s.persona_rule_version} · mapping ${s.behaviour_mapping_version} · prompt ${s.prompt_version}`),
    line("model", `${s.model} @ ${s.deployment}`), line("overall", s.overall_result)));

  // Editable session summary comment (saves; preserves the overall result).
  const summaryTa = el("textarea", { rows: "2", placeholder: "Session summary comment…" }); summaryTa.value = s.summary_comment || "";
  let sTimer; summaryTa.addEventListener("input", () => {
    flash("saving…"); clearTimeout(sTimer);
    sTimer = setTimeout(async () => { await api("/api/lab/session/summary", { session_id: s.session_id, summary_comment: summaryTa.value, overall_result: s.overall_result }); flash("saved ✓"); }, 600);
  });
  box.append(group("Session summary comment (editable)", summaryTa));

  const mg = group("Messages + scores (comments editable)");
  for (const m of s.messages) {
    const who = m.speaker === "user" ? "You" : "Lumis";
    mg.append(el("div", { class: "line" }, el("span", { class: "k", text: `${m.turn} · ${who}` }), el("span", { class: "v", text: m.text.slice(0, 200) })));
    if (m.speaker === "lumis") {
      const e = m.evaluation || {};
      const parts = SCORES.filter(([k]) => e[k] != null).map(([k, l]) => `${l}:${e[k]}`).concat(e.length ? [`Length:${e.length}`] : []);
      if (parts.length) mg.append(el("div", { class: "small", style: "padding-left:12px;color:var(--ok)", text: parts.join(" · ") }));
      const ta = el("textarea", { rows: "2", placeholder: `Comment on turn ${m.turn}…` }); ta.value = e.comments || "";
      let tTimer; ta.addEventListener("input", () => {
        flash("saving…"); clearTimeout(tTimer);
        tTimer = setTimeout(async () => { await api("/api/lab/session/evaluate", { session_id: s.session_id, turn: m.turn, evaluation: { comments: ta.value } }); flash("saved ✓"); }, 600);
      });
      mg.append(el("div", { style: "padding-left:12px" }, ta));
    }
  }
  box.append(mg);
}

function selectedSessionIds() { return Array.from(document.querySelectorAll(".sess-cb")).filter((c) => c.checked).map((c) => c.value); }
function exportSessions(ids) {
  const q = ids && ids.length ? "?ids=" + encodeURIComponent(ids.join(",")) : "";
  window.open("/api/lab/export.xlsx" + q, "_blank");
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

function switchTab(name) {
  document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  $("tab-companion").classList.toggle("hidden", name !== "companion");
  $("tab-regression").classList.toggle("hidden", name !== "regression");
  $("tab-sessions").classList.toggle("hidden", name !== "sessions");
  if (name === "sessions") loadSessions();
}

$("calculate").addEventListener("click", calculate);
$("send").addEventListener("click", send);
$("message").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } });
$("new-conversation").addEventListener("click", newConversation);
$("clear-session").addEventListener("click", endAndArchive);
$("delete-session").addEventListener("click", deleteCurrent);
$("overall-result").addEventListener("change", saveSummary);
$("summary-comment").addEventListener("input", () => { clearTimeout(summaryTimer); summaryTimer = setTimeout(saveSummary, 600); });
$("run-regression").addEventListener("click", runRegression);
$("refresh-sessions").addEventListener("click", loadSessions);
$("export-all").addEventListener("click", () => exportSessions(null));
$("export-selected").addEventListener("click", () => { const ids = selectedSessionIds(); if (ids.length) exportSessions(ids); else alert("Tick one or more sessions to export."); });
$("session-search").addEventListener("input", renderSessionList);
$("session-filter").addEventListener("change", renderSessionList);
document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => switchTab(b.dataset.tab)));

loadConfig().catch(() => { $("ai-state").textContent = "config error"; });
