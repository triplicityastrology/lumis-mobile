// Companion / Normal Chat Web AI Lab — HTTP server (Node built-ins only).
//
// INTERNAL AI-TESTING INTERFACE ONLY — not the signed-off customer Chat UI.
//
// - Serves the static Lab UI.
// - Exposes POST /api/lab/message: the browser sends ONLY the controlled test context and
//   message; the server runs routing/persona/templates and (only if explicitly enabled
//   server-side) one provider call. All Azure/Supabase credentials remain server-side and are
//   never sent to the browser, logged, or included in any response.
// - Exposes GET /api/lab/config: non-secret UI config (roles, signs, ai_enabled boolean,
//   non-secret model identity). No secret value is ever returned.

import * as http from "node:http";
import { readFile } from "node:fs/promises";
import * as path from "node:path";
import { handleLabTurn, type LabTelemetry } from "./lab-turn.ts";
import {
  LAB_ROLES,
  ZODIAC_SIGNS,
  CHAT_SYNTHETIC_PROVIDER_ALIAS,
  CHAT_SYNTHETIC_SAFETY_PROFILE,
  CHAT_AZURE_APPROVED_HOSTNAME,
  CHAT_AZURE_DEPLOYMENT,
  CHAT_AZURE_MODEL,
  CHAT_AZURE_MODEL_VERSION,
} from "./lab-constants.ts";
import { FIXED_TEMPLATE_REGISTRY_VERSION } from "../../../supabase/functions/_shared/fixed-template-registry.ts";
import { handleLiveFixtureTurn, liveWindowStatus, LIVE_WINDOW_SCOPE, LIVE_WINDOW_AUTHORIZED_COMMIT, LIVE_WINDOW_PACKET_SHA } from "./lab-live-window.ts";
import { listLiveFixturesForUi } from "./lab-live-registry.ts";

const PORT = Number(process.env.LAB_PORT ?? "8410");
const PUBLIC_DIR = process.env.LAB_PUBLIC_DIR
  ? path.resolve(process.env.LAB_PUBLIC_DIR)
  : path.resolve(process.cwd(), "internal/companion-web-ai-lab/public");
const MAX_BODY_BYTES = 64 * 1024;

const STATIC: Record<string, { file: string; type: string }> = {
  "/": { file: "index.html", type: "text/html; charset=utf-8" },
  "/index.html": { file: "index.html", type: "text/html; charset=utf-8" },
  "/app.js": { file: "app.js", type: "text/javascript; charset=utf-8" },
  "/styles.css": { file: "styles.css", type: "text/css; charset=utf-8" },
};

function aiEnabledFromEnv(): boolean {
  // Same gate as the Azure adapter; reports only a boolean, never a key.
  return process.env.LUMIS_CHAT_AI_ENABLED === "true" && Boolean((process.env.LUMIS_CHAT_AZURE_API_KEY ?? "").trim());
}

// Non-secret UI configuration (single source of truth for roles/signs; no secrets).
function configPayload() {
  return {
    not_signed_off_customer_ui: true,
    roles: LAB_ROLES.map((r) => ({ code: r.code, current_label: r.currentLabel, internal_name: r.internalName, historical_label: r.historicalLabel })),
    signs: ZODIAC_SIGNS.map((name, i) => ({ number: i + 1, name })),
    languages: [
      { value: "auto", label: "Auto (deterministic from request text)" },
      { value: "en", label: "English (saved preference)" },
      { value: "zh-Hant", label: "Traditional Chinese (saved preference)" },
    ],
    ai_enabled: aiEnabledFromEnv(),
    fixed_template_registry_version: FIXED_TEMPLATE_REGISTRY_VERSION,
    // Live 12-case window (fixture-gated). Browser submits ONLY fixture_id in live mode.
    live_window: liveWindowStatus(Date.now()),
    live_fixtures: listLiveFixturesForUi(),
    live_request_schema: "companion_web_ai_lab_live_request_v1",
    free_text_is_offline_only: true,
    model_identity: {
      provider_alias: CHAT_SYNTHETIC_PROVIDER_ALIAS,
      deployment: CHAT_AZURE_DEPLOYMENT,
      model: CHAT_AZURE_MODEL,
      model_version: CHAT_AZURE_MODEL_VERSION,
      hostname: CHAT_AZURE_APPROVED_HOSTNAME,
      safety_profile: CHAT_SYNTHETIC_SAFETY_PROFILE,
    },
  };
}

function sendJson(res: http.ServerResponse, status: number, body: unknown) {
  const text = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(text);
}

function recordTelemetry(t: LabTelemetry) {
  // Content-free operational telemetry (AC-AI-01/02/03 DEC-03): no message content, no birth
  // data (chart signs), no names, no private text. Only routing/outcome metadata.
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

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const route = url.pathname;

  if (req.method === "GET" && route === "/api/lab/config") {
    return sendJson(res, 200, configPayload());
  }

  if (req.method === "GET" && route === "/api/lab/live/status") {
    return sendJson(res, 200, liveWindowStatus(Date.now()));
  }

  if (req.method === "POST" && route === "/api/lab/live") {
    const chunks: Buffer[] = [];
    let size = 0; let aborted = false;
    req.on("data", (c: Buffer) => { size += c.length; if (size > MAX_BODY_BYTES) { aborted = true; sendJson(res, 413, { error_code: "LAB_REQUEST_TOO_LARGE" }); req.destroy(); return; } chunks.push(c); });
    req.on("end", async () => {
      if (aborted) return;
      let parsed: unknown;
      try { parsed = JSON.parse(Buffer.concat(chunks).toString("utf8") || "null"); }
      catch { return sendJson(res, 400, { canonical_state: "route_unavailable", result: "route_unavailable", error_code: "LAB_LIVE_REQUEST_NOT_JSON", persistence: "not_committed", units_charged: 0, provider_attempts: 0 }); }
      try {
        const out = await handleLiveFixtureTurn(parsed, { environment: process.env, recordTelemetry });
        return sendJson(res, out.status, out.body);
      } catch {
        return sendJson(res, 500, { canonical_state: "technical_error", result: "technical_error", error_code: "LAB_LIVE_INTERNAL_ERROR", persistence: "not_committed", units_charged: 0, provider_attempts: 0 });
      }
    });
    return;
  }

  if (req.method === "POST" && route === "/api/lab/message") {
    const chunks: Buffer[] = [];
    let size = 0;
    let aborted = false;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) { aborted = true; sendJson(res, 413, { error_code: "LAB_REQUEST_TOO_LARGE" }); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", async () => {
      if (aborted) return;
      let parsed: unknown;
      try { parsed = JSON.parse(Buffer.concat(chunks).toString("utf8") || "null"); }
      catch { return sendJson(res, 400, { schema_version: "companion_web_ai_lab_response_v1", canonical_state: "technical_error", result: "technical_error", error_code: "LAB_REQUEST_NOT_JSON", persistence: "not_committed", units_charged: 0, provider_attempts: 0 }); }
      try {
        const out = await handleLabTurn(parsed, { environment: process.env, recordTelemetry });
        return sendJson(res, out.status, out.body);
      } catch (err) {
        // Never leak internal error detail/secrets to the browser.
        return sendJson(res, 500, { schema_version: "companion_web_ai_lab_response_v1", canonical_state: "technical_error", result: "technical_error", error_code: "LAB_INTERNAL_ERROR", persistence: "not_committed", units_charged: 0, provider_attempts: 0 });
      }
    });
    return;
  }

  if (req.method === "GET" && STATIC[route]) {
    return void serveStatic(res, STATIC[route]);
  }

  res.writeHead(404, { "content-type": "text/plain" });
  res.end("not found");
});

server.listen(PORT, () => {
  process.stdout.write(`Companion/Normal Chat Web AI Lab (INTERNAL — not signed-off UI) listening on http://localhost:${PORT}\n`);
  process.stdout.write(`Provider AI enabled: ${aiEnabledFromEnv()} (default-off produces zero provider calls)\n`);
  // Item 1: verify the immutable authorization receipt at startup (content-free status only).
  const w = liveWindowStatus(Date.now());
  process.stdout.write(`Live authorization receipt: ${w.receipt_authorized ? "VERIFIED" : `NOT verified (${w.authorization_reason})`} — live fixtures ${w.receipt_authorized ? "enabled" : "disabled until a valid receipt is present"}.\n`);
});
