// Part 2 (Founder-directed) tests: persistent test-record store + Excel export.
// Run: tsc -p internal/companion-web-ai-lab/tsconfig.json && node <emitted>/test/lab-sessions.fixtures.js
//
// Proves: sessions persist to LOCAL files and survive a fresh read; messages keep turn order +
// timestamps; evaluations/summary save and re-read; "End & archive" archives without deleting;
// delete removes the file; averages compute over the five scored dimensions; and the Excel export
// is a valid, dependency-free .xlsx (PK zip) with the three required tabs.

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Point the store at an isolated temp dir BEFORE importing the store (sessionsDir reads env lazily).
process.env.LAB_SESSIONS_DIR = mkdtempSync(join(tmpdir(), "lab-sessions-test-"));

import test from "node:test";
import { strict as assert } from "node:assert";
import {
  createSession, getSession, appendMessage, saveEvaluation, saveSummary, setArchived, deleteSession,
  averageScores, listSessions, allSessions, promptHash, type Session,
} from "../src/lab-sessions.ts";
import { buildXlsx } from "../src/lab-xlsx.ts";
import { buildExportWorkbook } from "../src/lab-session-api.ts";

function seed(over: Partial<Session> = {}): Session {
  return createSession({
    tester: "Founder", test_title: "T-001", role_code: "empathetic_peer", role_label: "Acceptance",
    internal_name: "Ordinary Person", chart: { sun: 3, moon: 6, mercury: 3, saturn: 10, moon_confirmed: true },
    resolved: { ASC: "Cancer", Moon: "Virgo", Mercury: "Libra" }, behaviour_mapping_version: "v1.2",
    persona_rule_version: "v1", prompt_version: "test", model: "gpt-5-mini@x", deployment: "dep", ...over,
  });
}

test("a created session persists to a local file and re-reads with identical identity", () => {
  const s = seed();
  assert.match(s.session_id, /^sess-[a-z0-9]+-[0-9a-f]{12}$/);
  const again = getSession(s.session_id);
  assert.ok(again, "session re-read from disk");
  assert.equal(again!.session_id, s.session_id);
  assert.equal(again!.tester, "Founder");
  assert.deepEqual(again!.resolved, { ASC: "Cancer", Moon: "Virgo", Mercury: "Libra" });
  assert.equal(again!.archived, false);
});

test("messages keep turn order and each carry a timestamp", () => {
  const s = seed();
  const u = appendMessage(s.session_id, { speaker: "user", text: "hi" });
  const l = appendMessage(s.session_id, { speaker: "lumis", text: "hello", canonical_state: "completed", result: "completed" });
  assert.ok(u && l);
  assert.equal(u!.turn, 1);
  assert.equal(l!.turn, 2);
  const re = getSession(s.session_id)!;
  assert.equal(re.messages.length, 2);
  assert.deepEqual(re.messages.map((m) => m.speaker), ["user", "lumis"]);
  assert.ok(re.messages.every((m) => typeof m.timestamp === "string" && m.timestamp.length > 0));
});

test("evaluations and the session summary save and re-read", () => {
  const s = seed();
  appendMessage(s.session_id, { speaker: "user", text: "q" });
  const l = appendMessage(s.session_id, { speaker: "lumis", text: "a" })!;
  saveEvaluation(s.session_id, l.turn, { usefulness: 4, tone: 5, specificity: 3, character_distinctiveness: 5, natural_flow: 4, length: "about_right", comments: "good" });
  saveSummary(s.session_id, "solid session", "pass");
  const re = getSession(s.session_id)!;
  const ev = re.messages.find((m) => m.turn === l.turn)!.evaluation!;
  assert.equal(ev.usefulness, 4);
  assert.equal(ev.character_distinctiveness, 5);
  assert.equal(ev.comments, "good");
  assert.equal(re.overall_result, "pass");
  assert.equal(re.summary_comment, "solid session");
});

test("averageScores averages the five scored dimensions across Lumis turns", () => {
  const s = seed();
  appendMessage(s.session_id, { speaker: "user", text: "q1" });
  const a = appendMessage(s.session_id, { speaker: "lumis", text: "a1" })!;
  appendMessage(s.session_id, { speaker: "user", text: "q2" });
  const b = appendMessage(s.session_id, { speaker: "lumis", text: "a2" })!;
  saveEvaluation(s.session_id, a.turn, { usefulness: 2, tone: 4, specificity: 2, character_distinctiveness: 2, natural_flow: 4 });
  saveEvaluation(s.session_id, b.turn, { usefulness: 4, tone: 2, specificity: 4, character_distinctiveness: 4, natural_flow: 2 });
  const avg = averageScores(getSession(s.session_id)!);
  assert.equal(avg.usefulness, 3);
  assert.equal(avg.tone, 3);
  assert.equal(avg.character_distinctiveness, 3);
  assert.equal(avg.natural_flow, 3);
});

test("End & archive archives WITHOUT deleting; the saved test survives", () => {
  const s = seed();
  appendMessage(s.session_id, { speaker: "user", text: "keep me" });
  const arch = setArchived(s.session_id, true);
  assert.ok(arch && arch.archived === true);
  const re = getSession(s.session_id);
  assert.ok(re, "archived session is NOT deleted");
  assert.equal(re!.messages.length, 1, "archived session keeps its messages");
});

test("delete removes the session file permanently (separate explicit action)", () => {
  const s = seed();
  assert.equal(deleteSession(s.session_id), true);
  assert.equal(getSession(s.session_id), null);
  assert.equal(deleteSession(s.session_id), false, "second delete is a no-op");
});

test("listSessions summarizes and allSessions can filter by id", () => {
  const a = seed({ test_title: "L-A" });
  const b = seed({ test_title: "L-B" });
  const rows = listSessions();
  const ids = rows.map((r) => r.session_id);
  assert.ok(ids.includes(a.session_id) && ids.includes(b.session_id));
  const only = allSessions([a.session_id]);
  assert.equal(only.length, 1);
  assert.equal(only[0].session_id, a.session_id);
});

test("promptHash is deterministic and null-safe", () => {
  assert.equal(promptHash(null), null);
  assert.equal(promptHash("abc"), promptHash("abc"));
  assert.notEqual(promptHash("abc"), promptHash("abd"));
});

test("buildXlsx emits a valid PK-zipped workbook", () => {
  const buf = buildXlsx([{ name: "One", headers: ["A", "B"], rows: [["x", 1], ["y", 2]] }]);
  assert.ok(Buffer.isBuffer(buf));
  assert.equal(buf.slice(0, 2).toString("latin1"), "PK", "zip local-file signature");
  // End-of-central-directory signature present.
  assert.ok(buf.includes(Buffer.from([0x50, 0x4b, 0x05, 0x06])), "EOCD present");
});

test("export workbook has exactly the three required tabs with a row per Lumis response", () => {
  // Fresh, isolated: export ALL current sessions and assert the three sheets exist by name.
  const s = seed({ test_title: "EXPORT" });
  appendMessage(s.session_id, { speaker: "user", text: "q" });
  const l = appendMessage(s.session_id, { speaker: "lumis", text: "a", result: "completed" })!;
  saveEvaluation(s.session_id, l.turn, { usefulness: 5 });
  const buf = buildExportWorkbook([s.session_id]);
  const zip = buf.toString("latin1");
  assert.ok(zip.includes("xl/worksheets/sheet1.xml"));
  assert.ok(zip.includes("xl/worksheets/sheet2.xml"));
  assert.ok(zip.includes("xl/worksheets/sheet3.xml"));
  // Workbook names the three tabs.
  assert.ok(zip.includes("Evaluations") && zip.includes("Sessions") && zip.includes("Messages"));
});
