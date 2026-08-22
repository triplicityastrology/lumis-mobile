// Companion Web AI Lab — HTTP server (Node built-ins only). FOUNDER-ONLY, STAGING, INTERNAL.
//
// Not the signed-off customer Chat UI. Not a public route. No colleague access.
//
// - Main: POST /api/lab/conversation — natural, multi-turn, free-text Companion conversation. The
//   browser sends the controlled context (role + four signs) + latest message + a bounded rolling
//   conversation context. The telemetry stream stays content-free — it carries dispositions and
//   counts, never the raw text or chart signs. The conversation turn itself is NOT written to any
//   customer table, unit ledger, or member-state store.
// - Part 2 (Founder-directed): POST/GET /api/lab/session* + /api/lab/export.xlsx — a persistent,
//   server-side TEST-RECORD store for the Founder's own evaluation of synthetic charts. This
//   deliberately reverses the Lab's original "no durable raw-conversation storage" boundary at
//   Founder direction: it saves the raw test conversation, scores, comments, and reproducibility
//   metadata to a LOCAL session store (see lab-sessions.ts), separate from every customer data
//   path. It is still not customer persistence, billing, or member-state mutation.
// - Optional: POST /api/lab/regression — run one of the 12 frozen synthetic fixtures.
// - GET /api/lab/config and /api/lab/identity/status — non-secret config + executable-identity state.
//
// All Azure/Supabase credentials remain server-side. Provider access is gated by the executable-
// identity authorization (commit/tree/package) + the LUMIS_AI_ENABLED kill switch.

import * as http from "node:http";
import { readFile } from "node:fs/promises";
import * as path from "node:path";
import { handleConversationTurn } from "./lab-conversation.ts";
import { handleCompose } from "./lab-compose.ts";
import { handleRegressionFixture, listRegressionFixtures } from "./lab-regression.ts";
import {
  handleSessionNew, persistTurn, handleEvaluate, handleSummary, handleArchive, handleDelete,
  handleList, handleGet, buildExportWorkbook,
} from "./lab-session-api.ts";
import { authorizeProvider, identityStatus, killSwitchEngaged, LAB_SCOPE } from "./lab-identity.ts";
import { MAX_CONTEXT_TURNS } from "./lab-engine.ts";
import {
  LAB_ROLES, ZODIAC_SIGNS, CHAT_SYNTHETIC_PROVIDER_ALIAS, CHAT_SYNTHETIC_SAFETY_PROFILE,
  CHAT_AZURE_APPROVED_HOSTNAME, CHAT_AZURE_DEPLOYMENT, CHAT_AZURE_MODEL, CHAT_AZURE_MODEL_VERSION,
} from "./lab-constants.ts";
import { FIXED_TEMPLATE_REGISTRY_VERSION } from "../../../supabase/functions/_shared/fixed-template-registry.ts";
import type { LabTelemetry } from "./lab-turn.ts";

const PORT = Number(process.env.LAB_PORT ?? "8410");
const PUBLIC_DIR = process.env.LAB_PUBLIC_DIR
  ? path.resolve(process.env.LAB_PUBLIC_DIR)
  : path.resolve(process.cwd(), "internal/companion-web-ai-lab/public");
const MAX_BODY_BYTES = 128 * 1024;

const STATIC: Record<string, { file: string; type: string }> = {
  "/": { file: "index.html", type: "text/html; charset=utf-8" },
  "/index.html": { file: "index.html", type: "text/html; charset=utf-8" },
  "/app.js": { file: "app.js", type: "text/javascript; charset=utf-8" },
  "/styles.css": { file: "styles.css", type: "text/css; charset=utf-8" },
};

// Provider-ready = kill switch off AND executable identity verified AND server-side Azure config ok.
// authorizeProvider constructs (but never calls) the adapter, so this reports readiness without any
// Azure request.
function providerReady(): boolean {
  return authorizeProvider(process.env, fetch, Date.now).ok;
}

function configPayload() {
  const identity = identityStatus();
  return {
    not_signed_off_customer_ui: true,
    founder_only: true,
    scope: LAB_SCOPE,
    max_context_turns: MAX_CONTEXT_TURNS,
    roles: LAB_ROLES.map((r) => ({ code: r.code, current_label: r.currentLabel, internal_name: r.internalName, historical_label: r.historicalLabel })),
    signs: ZODIAC_SIGNS.map((name, i) => ({ number: i + 1, name })),
    languages: [
      { value: "auto", label: "Auto (deterministic from request text)" },
      { value: "en", label: "English (saved preference)" },
      { value: "zh-Hant", label: "Traditional Chinese (saved preference)" },
    ],
    ai_enabled: providerReady(),
    kill_switch_engaged: killSwitchEngaged(process.env),
    identity,
    regression_fixtures: listRegressionFixtures(),
    conversation_request_schema: "companion_web_ai_lab_request_v1",
    regression_request_schema: "companion_web_ai_lab_regression_request_v1",
    fixed_template_registry_version: FIXED_TEMPLATE_REGISTRY_VERSION,
    model_identity: {
      provider_alias: CHAT_SYNTHETIC_PROVIDER_ALIAS, deployment: CHAT_AZURE_DEPLOYMENT,
      model: CHAT_AZURE_MODEL, model_version: CHAT_AZURE_MODEL_VERSION,
      hostname: CHAT_AZURE_APPROVED_HOSTNAME, safety_profile: CHAT_SYNTHETIC_SAFETY_PROFILE,
    },
  };
}

function sendJson(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

function recordTelemetry(t: LabTelemetry) {
  // Content-free: never message content, birth data (chart signs), names, or conversation text.
  process.stdout.write(`[lab-telemetry] ${JSON.stringify(t)}\n`);
}

async function serveStatic(res: http.ServerResponse, entry: { file: string; type: string }) {
  try {
    const buf = await readFile(path.join(PUBLIC_DIR, entry.file));
    res.writeHead(200, { "content-type": entry.type, "cache-control": "no-store" });
    res.end(buf);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
  }
}

function readBody(req: http.IncomingMessage, res: http.ServerResponse, done: (parsed: unknown) => void) {
  const chunks: Buffer[] = [];
  let size = 0;
  let aborted = false;
  req.on("data", (c: Buffer) => {
    size += c.length;
    if (size > MAX_BODY_BYTES) { aborted = true; sendJson(res, 413, { error_code: "LAB_REQUEST_TOO_LARGE" }); req.destroy(); return; }
    chunks.push(c);
  });
  req.on("end", () => {
    if (aborted) return;
    try { done(JSON.parse(Buffer.concat(chunks).toString("utf8") || "null")); }
    catch { sendJson(res, 400, { canonical_state: "technical_error", result: "technical_error", error_code: "LAB_REQUEST_NOT_JSON", persistence: "not_committed", units_charged: 0, provider_attempts: 0 }); }
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const route = url.pathname;

  if (req.method === "GET" && route === "/api/lab/config") return sendJson(res, 200, configPayload());
  if (req.method === "GET" && route === "/api/lab/identity/status") return sendJson(res, 200, identityStatus());

  if (req.method === "POST" && route === "/api/lab/conversation") {
    return readBody(req, res, async (parsed) => {
      try {
        // Strip optional session fields before validation (the LabRequest schema is closed).
        const p = (parsed && typeof parsed === "object" ? parsed : {}) as Record<string, unknown>;
        const sessionId = typeof p.session_id === "string" ? p.session_id : null;
        const labReq = { schema_version: p.schema_version, role_code: p.role_code, chart: p.chart, message: p.message, app_language_preference: p.app_language_preference, context: p.context };
        const out = await handleConversationTurn(labReq, { environment: process.env, recordTelemetry });
        const body = out.body as Record<string, unknown>;
        if (sessionId) {
          const turns = persistTurn(sessionId, labReq as Record<string, unknown>, body);
          if (turns) { body.session_id = sessionId; body.user_turn = turns.user_turn; body.lumis_turn = turns.lumis_turn; }
        }
        sendJson(res, out.status, body);
      }
      catch { sendJson(res, 500, { canonical_state: "technical_error", result: "technical_error", error_code: "LAB_INTERNAL_ERROR", persistence: "not_committed", units_charged: 0, provider_attempts: 0 }); }
    });
  }

  // ---- Part 2: persistent testing sessions + scoring + Excel export (Founder-directed) ----
  if (req.method === "POST" && route === "/api/lab/session/new") return readBody(req, res, (p) => { const o = handleSessionNew(p); sendJson(res, o.status, o.body); });
  if (req.method === "POST" && route === "/api/lab/session/evaluate") return readBody(req, res, (p) => { const o = handleEvaluate(p); sendJson(res, o.status, o.body); });
  if (req.method === "POST" && route === "/api/lab/session/summary") return readBody(req, res, (p) => { const o = handleSummary(p); sendJson(res, o.status, o.body); });
  if (req.method === "POST" && route === "/api/lab/session/archive") return readBody(req, res, (p) => { const o = handleArchive(p); sendJson(res, o.status, o.body); });
  if (req.method === "POST" && route === "/api/lab/session/delete") return readBody(req, res, (p) => { const o = handleDelete(p); sendJson(res, o.status, o.body); });
  if (req.method === "GET" && route === "/api/lab/sessions") { const o = handleList(); return sendJson(res, o.status, o.body); }
  if (req.method === "GET" && route === "/api/lab/session") { const o = handleGet(url.searchParams.get("id") ?? ""); return sendJson(res, o.status, o.body); }
  if (req.method === "GET" && route === "/api/lab/export.xlsx") {
    try {
      const idsParam = url.searchParams.get("ids");
      const ids = idsParam ? idsParam.split(",").map((s) => s.trim()).filter(Boolean) : undefined;
      const buf = buildExportWorkbook(ids);
      res.writeHead(200, {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="lumis-companion-lab-sessions.xlsx"`,
        "cache-control": "no-store",
      });
      return void res.end(buf);
    } catch { return sendJson(res, 500, { error_code: "LAB_EXPORT_ERROR" }); }
  }

  if (req.method === "POST" && route === "/api/lab/regression") {
    return readBody(req, res, async (parsed) => {
      try { const out = await handleRegressionFixture(parsed, { environment: process.env, recordTelemetry }); sendJson(res, out.status, out.body); }
      catch { sendJson(res, 500, { canonical_state: "technical_error", result: "technical_error", error_code: "LAB_REGRESSION_INTERNAL_ERROR", persistence: "not_committed", units_charged: 0, provider_attempts: 0 }); }
    });
  }

  // Founder "Calculate": derive Chart Composition + assembled prompt for a chart+role; no provider call.
  if (req.method === "POST" && route === "/api/lab/compose") {
    return readBody(req, res, (parsed) => {
      try { const out = handleCompose(parsed); sendJson(res, out.status, out.body); }
      catch { sendJson(res, 500, { error_code: "LAB_COMPOSE_INTERNAL_ERROR" }); }
    });
  }

  if (req.method === "GET" && STATIC[route]) return void serveStatic(res, STATIC[route]);

  res.writeHead(404, { "content-type": "text/plain" });
  res.end("not found");
});

// Bind unconditionally to loopback (127.0.0.1). Founder-only/internal: never expose the Lab on a
// LAN/public host, and do NOT allow a host override from the environment.
const LOOPBACK_HOST = "127.0.0.1" as const;
server.listen(PORT, LOOPBACK_HOST, () => {
  process.stdout.write(`Companion Web AI Lab (FOUNDER-ONLY · STAGING · INTERNAL — not signed-off UI) on http://${LOOPBACK_HOST}:${PORT}\n`);
  const id = identityStatus();
  process.stdout.write(`Executable identity (${LAB_SCOPE}): ${id.identity_verified ? "VERIFIED" : `NOT verified (${id.reason})`} · worktree ${id.runtime_clean ? "clean" : "DIRTY"}.\n`);
  process.stdout.write(`Provider ready: ${providerReady()} · kill switch (LUMIS_AI_ENABLED=false) engaged: ${killSwitchEngaged(process.env)}.\n`);
});
