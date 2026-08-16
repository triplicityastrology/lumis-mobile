// Loopback-only binding smoke (finding 2). Plain ESM (not TS-compiled) so it can use the real
// node:child_process / node:http / node:os without expanding the Lab's minimal TS shims.
//
// Proves the server binds to 127.0.0.1 ONLY: reachable on loopback, and — when the host has a
// non-loopback IPv4 — NOT reachable on that address (connection refused). Runs offline (no Azure
// key, no identity receipt): zero provider calls.

import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..", "..", "..");
const SERVER = path.join(ROOT, ".tmp/companion-web-ai-lab/internal/companion-web-ai-lab/src/server.js");
const PUBLIC_DIR = path.join(ROOT, "internal/companion-web-ai-lab/public");
const PORT = 8500 + (process.pid % 300);

function getStatus(host, port, timeoutMs = 1500) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host, port, path: "/api/lab/config", timeout: timeoutMs }, (res) => {
      res.resume();
      resolve(res.statusCode);
    });
    req.on("timeout", () => { req.destroy(new Error("ETIMEDOUT")); });
    req.on("error", reject);
  });
}

test("server binds to 127.0.0.1 only (loopback reachable; non-loopback refused)", async () => {
  const child = spawn(process.execPath, [SERVER], {
    env: { ...process.env, LAB_PORT: String(PORT), LAB_PUBLIC_DIR: PUBLIC_DIR, LUMIS_CHAT_AI_ENABLED: "", LUMIS_CHAT_AZURE_API_KEY: "", LAB_IDENTITY_RECEIPT_PATH: "" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let banner = "";
  const ready = new Promise((resolve, reject) => {
    child.stdout.on("data", (d) => { banner += String(d); if (banner.includes(`http://127.0.0.1:${PORT}`)) resolve(); });
    child.on("exit", (code) => reject(new Error(`server exited early (${code})`)));
    setTimeout(() => reject(new Error("server did not start in time")), 8000);
  });

  try {
    await ready;
    assert.match(banner, /http:\/\/127\.0\.0\.1:/, "startup banner advertises the loopback host");

    // Loopback reachable.
    assert.equal(await getStatus("127.0.0.1", PORT), 200, "reachable on 127.0.0.1");

    // Non-loopback (if the host has one) must be REFUSED — proving the bind is loopback-only.
    const lan = Object.values(os.networkInterfaces()).flat().find((i) => i && i.family === "IPv4" && !i.internal);
    if (lan) {
      let refused = false;
      try { await getStatus(lan.address, PORT, 1200); }
      catch { refused = true; }
      assert.equal(refused, true, `must NOT be reachable on non-loopback ${lan.address}`);
    }
  } finally {
    child.kill("SIGKILL");
  }
});
