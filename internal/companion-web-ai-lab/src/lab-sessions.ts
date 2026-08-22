// Founder-directed persistent testing sessions (Part 2).
//
// GOVERNANCE NOTE: this reverses the Lab's original "no durable raw-conversation storage" boundary,
// at explicit Founder direction, for internal test record-keeping. It stores SYNTHETIC test charts
// and Founder-entered test conversations only (never real member data), as local Founder-only JSON
// files on the dev machine. It is not a customer feature and writes nothing to Supabase/Azure/units.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, renameSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";

export type Evaluation = {
  usefulness?: number | null;
  tone?: number | null;
  specificity?: number | null;
  character_distinctiveness?: number | null;
  natural_flow?: number | null;
  length?: "too_short" | "about_right" | "too_long" | null;
  comments?: string;
  updated_at?: string;
};

export type SessionMessage = {
  turn: number;
  speaker: "user" | "lumis";
  text: string;
  timestamp: string;
  // Reproducibility metadata (Lumis turns):
  canonical_state?: string;
  result?: string;
  product_class?: string;
  safe_to_proceed?: boolean;
  provider_authorized?: boolean;
  provider_disposition?: string | null;
  units_charged?: number;
  latency_ms?: number;
  error_code?: string | null;
  language?: string;
  situation_parameters?: Record<string, string> | null;
  mapping_ids?: string[];
  prompt_snapshot?: string | null;
  prompt_hash?: string | null;
  evaluation?: Evaluation;
};

export type OverallResult = "pass" | "needs_improvement" | "fail" | "not_yet_reviewed";

export type Session = {
  schema_version: "companion_web_ai_lab_session_v1";
  session_id: string;
  created_at: string;
  updated_at: string;
  tester: string;
  test_title: string;
  role_code: string;
  role_label: string;
  internal_name: string;
  historical_label: string;
  chart: { sun: number; moon: number; mercury: number; saturn: number; moon_confirmed: boolean } | null;
  resolved: Record<string, string>;         // resolved Lumis factor -> sign
  source_factors: string[];                  // derivation notes / offsets
  persona_rule_version: string;
  behaviour_mapping_version: string;
  language: string;
  model: string;
  deployment: string;
  prompt_version: string;
  overall_result: OverallResult;
  summary_comment: string;
  archived: boolean;
  messages: SessionMessage[];
};

const SESSION_SCHEMA = "companion_web_ai_lab_session_v1" as const;

export function sessionsDir(): string {
  const d = (process.env.LAB_SESSIONS_DIR ?? "").trim() || `${process.cwd()}/.tmp/lab-sessions`;
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
  return d;
}
function sessionPath(id: string): string { return `${sessionsDir()}/${id}.json`; }
const HEX = () => Array.from({ length: 12 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
export function newSessionId(): string { return `sess-${Date.now().toString(36)}-${HEX()}`; }
const SESSION_ID_RE = /^sess-[a-z0-9]+-[0-9a-f]{12}$/;

function writeAtomic(id: string, session: Session): void {
  const p = sessionPath(id);
  const tmp = `${p}.tmp-${HEX()}`;
  writeFileSync(tmp, JSON.stringify(session, null, 2), { mode: 0o600 });
  renameSync(tmp, p);
}

export function createSession(meta: Partial<Session>): Session {
  const now = new Date().toISOString();
  const session: Session = {
    schema_version: SESSION_SCHEMA,
    session_id: newSessionId(),
    created_at: now,
    updated_at: now,
    tester: meta.tester ?? "",
    test_title: meta.test_title ?? "",
    role_code: meta.role_code ?? "",
    role_label: meta.role_label ?? "",
    internal_name: meta.internal_name ?? "",
    historical_label: meta.historical_label ?? "",
    chart: meta.chart ?? null,
    resolved: meta.resolved ?? {},
    source_factors: meta.source_factors ?? [],
    persona_rule_version: meta.persona_rule_version ?? "",
    behaviour_mapping_version: meta.behaviour_mapping_version ?? "",
    language: meta.language ?? "",
    model: meta.model ?? "",
    deployment: meta.deployment ?? "",
    prompt_version: meta.prompt_version ?? "",
    overall_result: "not_yet_reviewed",
    summary_comment: "",
    archived: false,
    messages: [],
  };
  writeAtomic(session.session_id, session);
  return session;
}

export function getSession(id: string): Session | null {
  if (!SESSION_ID_RE.test(id)) return null;
  const p = sessionPath(id);
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, "utf8")) as Session; } catch { return null; }
}

function save(session: Session): Session { session.updated_at = new Date().toISOString(); writeAtomic(session.session_id, session); return session; }

// Append a turn (user or Lumis). The server builds the Lumis metadata from the response body.
export function appendMessage(id: string, msg: Omit<SessionMessage, "turn" | "timestamp">): { session: Session; turn: number } | null {
  const session = getSession(id);
  if (!session) return null;
  const turn = session.messages.length + 1;
  session.messages.push({ ...msg, turn, timestamp: new Date().toISOString() });
  // Keep the freshest reproducibility identity on the session header when a Lumis turn carries it.
  if (msg.speaker === "lumis") {
    if (msg.language) session.language = msg.language;
  }
  save(session);
  return { session, turn };
}

export function saveEvaluation(id: string, turn: number, ev: Evaluation): Session | null {
  const session = getSession(id);
  if (!session) return null;
  const m = session.messages.find((x) => x.turn === turn && x.speaker === "lumis");
  if (!m) return null;
  m.evaluation = { ...(m.evaluation ?? {}), ...ev, updated_at: new Date().toISOString() };
  return save(session);
}

export function saveSummary(id: string, summary_comment: string, overall_result: OverallResult): Session | null {
  const session = getSession(id);
  if (!session) return null;
  session.summary_comment = summary_comment;
  session.overall_result = overall_result;
  return save(session);
}

export function setArchived(id: string, archived: boolean): Session | null {
  const session = getSession(id);
  if (!session) return null;
  session.archived = archived;
  return save(session);
}

export function deleteSession(id: string): boolean {
  if (!SESSION_ID_RE.test(id)) return false;
  const p = sessionPath(id);
  if (!existsSync(p)) return false;
  rmSync(p, { force: true });
  return true;
}

const SCORE_KEYS: Array<keyof Evaluation> = ["usefulness", "tone", "specificity", "character_distinctiveness", "natural_flow"];

export function averageScores(session: Session): Record<string, number | null> {
  const sums: Record<string, { total: number; n: number }> = {};
  for (const k of SCORE_KEYS) sums[k] = { total: 0, n: 0 };
  for (const m of session.messages) {
    if (!m.evaluation) continue;
    for (const k of SCORE_KEYS) {
      const v = m.evaluation[k];
      if (typeof v === "number") { sums[k].total += v; sums[k].n += 1; }
    }
  }
  const out: Record<string, number | null> = {};
  for (const k of SCORE_KEYS) out[k] = sums[k].n ? Math.round((sums[k].total / sums[k].n) * 10) / 10 : null;
  return out;
}

export type SessionSummaryRow = {
  session_id: string; created_at: string; updated_at: string; tester: string; test_title: string;
  role_code: string; role_label: string; model: string; prompt_version: string;
  overall_result: OverallResult; archived: boolean; message_count: number; lumis_count: number;
  averages: Record<string, number | null>;
};

export function listSessions(): SessionSummaryRow[] {
  const dir = sessionsDir();
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  const rows: SessionSummaryRow[] = [];
  for (const f of files) {
    let s: Session;
    try { s = JSON.parse(readFileSync(`${dir}/${f}`, "utf8")) as Session; } catch { continue; }
    rows.push({
      session_id: s.session_id, created_at: s.created_at, updated_at: s.updated_at, tester: s.tester,
      test_title: s.test_title, role_code: s.role_code, role_label: s.role_label, model: s.model,
      prompt_version: s.prompt_version, overall_result: s.overall_result, archived: !!s.archived,
      message_count: s.messages.length, lumis_count: s.messages.filter((m) => m.speaker === "lumis").length,
      averages: averageScores(s),
    });
  }
  rows.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
  return rows;
}

export function allSessions(ids?: string[]): Session[] {
  const dir = sessionsDir();
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  const out: Session[] = [];
  for (const f of files) {
    try {
      const s = JSON.parse(readFileSync(`${dir}/${f}`, "utf8")) as Session;
      if (!ids || ids.includes(s.session_id)) out.push(s);
    } catch { /* skip */ }
  }
  out.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  return out;
}

export function promptHash(snapshot: string | null | undefined): string | null {
  if (!snapshot) return null;
  return createHash("sha256").update(snapshot).digest("hex");
}
