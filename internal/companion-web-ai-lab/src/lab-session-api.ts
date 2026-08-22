// Session API + Excel export handlers (Part 2). Pure functions over lab-sessions + lab-xlsx, kept
// out of server.ts. Founder-directed local test record-keeping (synthetic charts only).

import {
  createSession, getSession, listSessions, allSessions, appendMessage, saveEvaluation, saveSummary,
  setArchived, deleteSession, averageScores, promptHash,
  type Session, type Evaluation, type OverallResult, type SessionMessage,
} from "./lab-sessions.ts";
import { buildXlsx, type Sheet } from "./lab-xlsx.ts";
import { validateLabRequest, planLabTurn } from "./lab-engine.ts";
import { buildVoiceCard, BEHAVIOUR_MAPPING_VERSION } from "./lab-persona-voice.ts";
import { LAB_ROLES, CHAT_AZURE_DEPLOYMENT, CHAT_AZURE_MODEL, CHAT_AZURE_MODEL_VERSION } from "./lab-constants.ts";
import { LAB_PROMPT_VERSION } from "./lab-identity.ts";

type Json = Record<string, unknown>;
const asObj = (raw: unknown): Json => (raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Json : {});
const str = (v: unknown): string => (typeof v === "string" ? v : "");

// ---- Create a session, deriving persona composition + versions from the chart + role ----
export function handleSessionNew(raw: unknown): { status: number; body: unknown } {
  const r = asObj(raw);
  const probe = { schema_version: "companion_web_ai_lab_request_v1", role_code: r.role_code, chart: r.chart, message: "(session start)", app_language_preference: r.app_language_preference ?? null, context: [] };
  const v = validateLabRequest(probe);
  if (!v.ok) return { status: 400, body: { error_code: v.error_code, detail: v.detail } };
  const plan = planLabTurn(v.request);
  const roleMeta = LAB_ROLES.find((x) => x.code === v.request.role_code)!;
  const comp = plan.composition;
  const resolved: Record<string, string> = {};
  if (comp.available) for (const f of comp.factors) resolved[f.factor] = f.sign;
  const voice = buildVoiceCard(comp, roleMeta.currentLabel, roleMeta.code);
  const session = createSession({
    tester: str(r.tester), test_title: str(r.test_title),
    role_code: roleMeta.code, role_label: roleMeta.currentLabel, internal_name: roleMeta.internalName, historical_label: roleMeta.historicalLabel,
    chart: v.request.chart,
    resolved,
    source_factors: comp.available ? comp.factors.map((f) => `${f.factor}: ${f.sign} — ${f.note}`) : [`chart unavailable: ${comp.error_code}`],
    persona_rule_version: comp.rule_versions?.persona ?? "v1",
    behaviour_mapping_version: BEHAVIOUR_MAPPING_VERSION,
    language: "",
    model: `${CHAT_AZURE_MODEL}@${CHAT_AZURE_MODEL_VERSION}`,
    deployment: CHAT_AZURE_DEPLOYMENT,
    prompt_version: LAB_PROMPT_VERSION,
  });
  return { status: 200, body: { session, mapping_ids: voice ? voice.rows.map((x) => x.mapping_id) : [] } };
}

// ---- Persist one conversation turn (user + lumis) from the response body ----
export function persistTurn(sessionId: string, labReq: Json, body: Json): { user_turn: number; lumis_turn: number } | null {
  if (!getSession(sessionId)) return null;
  const u = appendMessage(sessionId, { speaker: "user", text: str(labReq.message) });
  const trace = asObj(body.decision_trace);
  const pc = asObj(body.product_classification);
  const voice = asObj(body.voice_card);
  const mappingIds = Array.isArray(voice.rows) ? (voice.rows as Json[]).map((x) => str(x.mapping_id)) : [];
  const snapshot = typeof body.generative_prompt_preview === "string" ? body.generative_prompt_preview : null;
  const lumisMsg: Omit<SessionMessage, "turn" | "timestamp"> = {
    speaker: "lumis",
    text: str(body.assistant_message),
    canonical_state: str(body.canonical_state),
    result: str(body.result),
    product_class: str(pc.class),
    safe_to_proceed: !!(asObj(trace.safe_to_proceed).value),
    provider_authorized: !!body.provider_authorized,
    provider_disposition: (body.provider_disposition as string) ?? null,
    units_charged: typeof body.units_charged === "number" ? body.units_charged : 0,
    latency_ms: typeof asObj(trace.latency).total_ms === "number" ? asObj(trace.latency).total_ms as number : undefined,
    error_code: (body.error_code as string) ?? null,
    language: str(body.language),
    situation_parameters: null,
    mapping_ids: mappingIds,
    prompt_snapshot: snapshot,
    prompt_hash: promptHash(snapshot),
  };
  const l = appendMessage(sessionId, lumisMsg);
  return { user_turn: u ? u.turn : -1, lumis_turn: l ? l.turn : -1 };
}

export function handleEvaluate(raw: unknown): { status: number; body: unknown } {
  const r = asObj(raw);
  const id = str(r.session_id); const turn = Number(r.turn);
  const ev = asObj(r.evaluation) as Evaluation;
  const s = saveEvaluation(id, turn, ev);
  return s ? { status: 200, body: { ok: true, session: s } } : { status: 404, body: { error_code: "LAB_SESSION_OR_TURN_NOT_FOUND" } };
}

export function handleSummary(raw: unknown): { status: number; body: unknown } {
  const r = asObj(raw);
  const valid: OverallResult[] = ["pass", "needs_improvement", "fail", "not_yet_reviewed"];
  const overall = valid.includes(r.overall_result as OverallResult) ? r.overall_result as OverallResult : "not_yet_reviewed";
  const s = saveSummary(str(r.session_id), str(r.summary_comment), overall);
  return s ? { status: 200, body: { ok: true, session: s } } : { status: 404, body: { error_code: "LAB_SESSION_NOT_FOUND" } };
}

export function handleArchive(raw: unknown): { status: number; body: unknown } {
  const r = asObj(raw);
  const s = setArchived(str(r.session_id), r.archived !== false);
  return s ? { status: 200, body: { ok: true, session: s } } : { status: 404, body: { error_code: "LAB_SESSION_NOT_FOUND" } };
}

export function handleDelete(raw: unknown): { status: number; body: unknown } {
  const r = asObj(raw);
  const ok = deleteSession(str(r.session_id));
  return ok ? { status: 200, body: { ok: true } } : { status: 404, body: { error_code: "LAB_SESSION_NOT_FOUND" } };
}

export function handleList(): { status: number; body: unknown } {
  return { status: 200, body: { sessions: listSessions() } };
}
export function handleGet(id: string): { status: number; body: unknown } {
  const s = getSession(id);
  return s ? { status: 200, body: { session: s } } : { status: 404, body: { error_code: "LAB_SESSION_NOT_FOUND" } };
}

// ---- Excel export: 3 tabs (Evaluations, Sessions, Messages) ----
export function buildExportWorkbook(ids?: string[]): Buffer {
  const sessions = allSessions(ids && ids.length ? ids : undefined);
  return buildXlsx([evaluationsSheet(sessions), sessionsSheet(sessions), messagesSheet(sessions)]);
}

function precedingUserText(s: Session, lumisTurn: number): string {
  const idx = s.messages.findIndex((m) => m.turn === lumisTurn);
  for (let i = idx - 1; i >= 0; i--) if (s.messages[i].speaker === "user") return s.messages[i].text;
  return "";
}
const num = (v: unknown): number | string => (typeof v === "number" ? v : "");

function evaluationsSheet(sessions: Session[]): Sheet {
  const headers = [
    "Test", "Date", "Session ID", "Turn Number", "Question / User Message", "Lumis Result", "Comments",
    "Usefulness 1-5", "Tone 1-5", "Specificity 1-5", "Character Distinctiveness 1-5", "Natural Conversational Flow 1-5",
    "Length", "Overall Result", "Role", "Prompt Version", "Model",
    "Customer Sun", "Customer Moon", "Customer Mercury", "Customer Saturn", "Resolved Lumis Factors",
  ];
  const rows: Array<Array<string | number>> = [];
  for (const s of sessions) {
    const resolvedStr = Object.entries(s.resolved).map(([k, v]) => `${k}:${v}`).join(", ");
    for (const m of s.messages) {
      if (m.speaker !== "lumis") continue;
      const e = m.evaluation ?? {};
      rows.push([
        s.test_title, s.created_at.slice(0, 10), s.session_id, m.turn, precedingUserText(s, m.turn), m.text, str(e.comments),
        num(e.usefulness), num(e.tone), num(e.specificity), num(e.character_distinctiveness), num(e.natural_flow),
        e.length ?? "", s.overall_result, s.role_label, s.prompt_version, s.model,
        s.chart ? s.chart.sun : "", s.chart ? s.chart.moon : "", s.chart ? s.chart.mercury : "", s.chart ? s.chart.saturn : "", resolvedStr,
      ]);
    }
  }
  return { name: "Evaluations", headers, rows };
}

function sessionsSheet(sessions: Session[]): Sheet {
  const headers = [
    "Session ID", "Created", "Updated", "Tester", "Test", "Role Code", "Role Label", "Internal Name",
    "Customer Sun", "Customer Moon", "Customer Mercury", "Customer Saturn", "Moon Confirmed",
    "Resolved Lumis Factors", "Persona Rule Version", "Behaviour Mapping Version", "Prompt Version", "Model", "Deployment",
    "Language", "Overall Result", "Archived", "Summary Comment", "Messages",
    "Avg Usefulness", "Avg Tone", "Avg Specificity", "Avg Character Distinctiveness", "Avg Natural Flow",
  ];
  const rows: Array<Array<string | number>> = [];
  for (const s of sessions) {
    const a = averageScores(s);
    rows.push([
      s.session_id, s.created_at, s.updated_at, s.tester, s.test_title, s.role_code, s.role_label, s.internal_name,
      s.chart ? s.chart.sun : "", s.chart ? s.chart.moon : "", s.chart ? s.chart.mercury : "", s.chart ? s.chart.saturn : "",
      s.chart ? (s.chart.moon_confirmed ? "yes" : "no") : "",
      Object.entries(s.resolved).map(([k, v]) => `${k}:${v}`).join(", "), s.persona_rule_version, s.behaviour_mapping_version, s.prompt_version, s.model, s.deployment,
      s.language, s.overall_result, s.archived ? "yes" : "no", s.summary_comment, s.messages.length,
      num(a.usefulness), num(a.tone), num(a.specificity), num(a.character_distinctiveness), num(a.natural_flow),
    ]);
  }
  return { name: "Sessions", headers, rows };
}

function messagesSheet(sessions: Session[]): Sheet {
  const headers = [
    "Session ID", "Turn Number", "Timestamp", "Speaker", "Message Text",
    "Canonical State", "Result", "Product Class", "Safe To Proceed", "Provider Disposition",
    "Language", "Latency ms", "Mapping IDs", "Prompt Hash", "Prompt Snapshot",
  ];
  const rows: Array<Array<string | number>> = [];
  for (const s of sessions) {
    for (const m of s.messages) {
      rows.push([
        s.session_id, m.turn, m.timestamp, m.speaker, m.text,
        m.canonical_state ?? "", m.result ?? "", m.product_class ?? "", m.safe_to_proceed === undefined ? "" : (m.safe_to_proceed ? "yes" : "no"),
        m.provider_disposition ?? "", m.language ?? "", num(m.latency_ms), (m.mapping_ids ?? []).join(", "),
        m.prompt_hash ?? "", m.prompt_snapshot ?? "",
      ]);
    }
  }
  return { name: "Messages", headers, rows };
}
