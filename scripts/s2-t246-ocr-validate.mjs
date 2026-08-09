import { readFileSync } from "node:fs";

const [sourceSha, state] = process.argv.slice(2);
const control = JSON.parse(readFileSync("config/s2-t246-dice-exact-evidence.json", "utf8"));
const expected = control.states.find(({ id }) => id === state);
if (!expected) stop("UNKNOWN_STATE");

let text = "";
for await (const chunk of process.stdin) text += chunk;
const normalized = normalize(text);
if (normalized.length < 80) stop("BLANK_OR_UNREADABLE_FRAME");
if (!normalized.includes(normalize(`BUILD ${sourceSha}`))) stop("BUILD_MARKER_MISMATCH");
if (!normalized.includes(normalize(`STATE ${state}`))) stop("STATE_MARKER_MISMATCH");
if (!normalized.includes(normalize(expected.visible_evidence))) stop("PRODUCT_STATE_MISMATCH");
if (control.forbidden_frames.some((phrase) => normalized.includes(normalize(phrase)))) stop("FORBIDDEN_FRAME");
process.stdout.write("S2_T246_VISIBLE_STATE_VERIFIED\n");

function normalize(value) {
  return value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

function stop(code) {
  process.stderr.write(`STOP_S2_T246_${code}\n`);
  process.exit(1);
}
