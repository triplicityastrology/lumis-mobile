#!/usr/bin/env node
// Staging-only, operator-run content-filter diagnostic (redaction-only).
//
// Sends EXACTLY ONE controlled request — the same role/chart and "hi" from the Founder screenshot — to
// the staging provider and prints ONLY the redacted, closed content-filter summary plus whether the
// request completed or was blocked. It reuses the Lab's own assembly (no drift, no new server surface),
// never persists/exports/telemeters, and serves nothing to a browser. The server-side Azure key is read
// from the environment and is never printed.
//
// Prereq — compile the Lab once (emits to .tmp/companion-web-ai-lab):
//   bash internal/companion-web-ai-lab/scripts/test-companion-web-ai-lab.sh
//   # or: ./node_modules/.bin/tsc -p internal/companion-web-ai-lab/tsconfig.json
//
// Run one diagnostic against staging (server-side only; key never leaves your machine):
//   LUMIS_CHAT_AI_ENABLED=true LUMIS_CHAT_AZURE_API_KEY=<staging key> \
//     node internal/companion-web-ai-lab/scripts/diagnose-content-filter.mjs
//
// Optional overrides (default to the screenshot session):
//   ROLE=empathetic_peer SUN=3 MOON=6 MERCURY=3 SATURN=10 MOON_CONFIRMED=1 MSG="hi"

import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const OUT = path.join(ROOT, ".tmp/companion-web-ai-lab/internal/companion-web-ai-lab/src");
const load = async (file) => {
  const ns = await import(pathToFileURL(path.join(OUT, file)).href);
  return ns.default ?? ns;
};

const env = process.env;
// Enable the redaction-only diagnostic attachment for THIS process only.
env.LUMIS_LAB_FILTER_DIAGNOSTIC = "1";

let engine, provider, kb;
try {
  engine = await load("lab-engine.js");
  provider = await load("lab-provider.js");
  kb = await load("lab-knowledge-bank.js");
} catch (error) {
  console.error("Could not load compiled Lab modules. Build first:\n  bash internal/companion-web-ai-lab/scripts/test-companion-web-ai-lab.sh");
  console.error(String(error && error.message ? error.message : error));
  process.exit(1);
}

const request = {
  schema_version: "companion_web_ai_lab_request_v1",
  role_code: env.ROLE || "empathetic_peer",
  chart: {
    sun: Number(env.SUN ?? 3),
    moon: Number(env.MOON ?? 6),
    mercury: Number(env.MERCURY ?? 3),
    saturn: Number(env.SATURN ?? 10),
    moon_confirmed: env.MOON_CONFIRMED !== "0",
  },
  message: env.MSG || "hi",
  app_language_preference: null,
  context: [],
};

const validated = engine.validateLabRequest(request);
if (!validated.ok) {
  console.error("invalid diagnostic request:", validated.error_code);
  process.exit(2);
}
const plan = engine.planLabTurn(validated.request);
if (!plan.generative) {
  console.log(JSON.stringify({ note: "non-generative route — no provider call", canonical_state: plan.canonicalState }, null, 2));
  process.exit(0);
}

const grounding = kb.buildKnowledgeGrounding(kb.retrieveNatalFacts(validated.request.chart));
const assembly = provider.assemblePersona(
  plan.personaPromptPayload,
  validated.request.message,
  plan.language,
  validated.request.context,
  plan.composition,
  grounding,
  validated.request.chart,
);

const runtime = provider.resolveProviderRuntime(env);
if (!runtime.aiEnabled) {
  console.error("provider disabled:", runtime.code, "(set LUMIS_CHAT_AI_ENABLED=true and LUMIS_CHAT_AZURE_API_KEY, and any identity gate the server requires)");
  process.exit(3);
}

const outcome = await provider.runGenerative(runtime, assembly.prompt, plan.language);

// Redacted result only: no prompt, message, model output, key, header, url, or request id.
console.log(JSON.stringify({
  role_code: validated.request.role_code,
  completed: outcome.kind === "completed",
  blocked: outcome.kind === "safety_rejected" && outcome.code === "LAB_CONTENT_FILTER",
  provider_disposition: outcome.providerDisposition ?? null,
  content_filter: outcome.contentFilterDiagnostic ?? null,
}, null, 2));
