import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { renderContactSheet, validateCaptureBuffers, validateHumanVerdict } from "./lib/care-circle-native-capture-intake.mjs";

const ROOT = process.cwd();
const CAPTURE_ROOT = resolve(ROOT, ".lumis-local/s2-t150-care-circle-native-captures");
const OUTPUT_ROOT = resolve(ROOT, ".lumis-local/s2-t150-care-circle-native-evidence");
const CONTROL = JSON.parse(readFileSync("supabase/tests/s2-t150-care-circle-native-capture-states.json", "utf8"));
const REFERENCES = [
  { label: "Signed-off Care Circle", path: "/Users/rubyku/Desktop/Screenshot 2026-08-02 at 4.55.44 PM.png" },
  { label: "Signed-off My check-in code", path: "/Users/rubyku/Desktop/Screenshot 2026-08-02 at 4.55.58 PM.png" },
  { label: "Rejected baseline", path: "/Users/rubyku/Downloads/IMG_09C62ED557DA-1.jpeg" },
];

try {
  if (process.argv.length !== 2) stop("ARGUMENTS_INVALID");
  if (!existsSync(CAPTURE_ROOT) || readdirSync(CAPTURE_ROOT).length === 0) {
    process.stdout.write(`WAITING_FOR_FOUNDER_NATIVE_CAPTURES\ncapture_folder=${CAPTURE_ROOT}\nexpected_count=13 filesystem_writes=0\n`);
    process.exit(0);
  }
  const actualNames = readdirSync(CAPTURE_ROOT).sort();
  const expectedNames = CONTROL.captures.map(({ file }) => file).sort();
  if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) stop("UNEXPECTED_OR_MISSING_FILES");
  for (const reference of REFERENCES) if (!existsSync(reference.path)) stop("COMPARISON_REFERENCE_MISSING");
  const ordered = CONTROL.captures.map(({ file }) => ({ file, buffer: readFileSync(resolve(CAPTURE_ROOT, file)) }));
  const captures = validateCaptureBuffers(ordered, CONTROL);
  const references = REFERENCES.map((reference) => ({ ...reference, sha256: createHash("sha256").update(readFileSync(reference.path)).digest("hex") }));
  const humanVerdict = validateHumanVerdict({ status: "pending" });
  const manifest = {
    schema: "s2_t154_care_circle_device_capture_material_v1",
    capture_kind: "founder_submitted_device_capture_material",
    native_capture_proven: false,
    requires_human_device_verification: true,
    human_verdict: humanVerdict,
    visual_similarity_assessed: false,
    captures,
    comparison_references: references,
  };
  mkdirSync(OUTPUT_ROOT, { recursive: true, mode: 0o700 });
  writeFileSync(resolve(OUTPUT_ROOT, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", { mode: 0o600 });
  writeFileSync(resolve(OUTPUT_ROOT, "contact-sheet.html"), renderContactSheet(captures, CAPTURE_ROOT, references, humanVerdict), { mode: 0o600 });
  process.stdout.write(`S2_T154_FOUNDER_CAPTURE_MATERIAL_READY\ncapture_count=13 native_capture_proven=false human_verdict=pending visual_similarity_assessed=false\noutput_folder=${OUTPUT_ROOT}\n`);
} catch (error) {
  const code = error instanceof Error && /^STOP_S2_T150_[A-Z0-9_]+$/u.test(error.message) ? error.message : "STOP_S2_T150_INTAKE_FAILED";
  process.stderr.write(`${code}\n`); process.exitCode = 1;
}

function stop(code) { throw new Error(`STOP_S2_T150_${code}`); }
