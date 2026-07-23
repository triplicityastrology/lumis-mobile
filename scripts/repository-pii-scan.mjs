import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const documentationRoot = "docs";
const goldenRoots = [
  "packages/astrology/src",
  "tools/golden-tests"
];
const allowedEmailDomains = new Set(["example.com", "example.test", "invalid"]);
const emailPattern = /[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})/gi;
const websiteSessionPattern = /\bTRI-[A-Z0-9-]{8,}\b/g;
const websiteResultUrlPattern = /triplicityastrology\.com\/chart\/result\?session=/gi;
const goldenFilePattern = /golden/i;
const forbiddenIdentityKeys = new Set([
  "email",
  "full_name",
  "customer_name",
  "display_name"
]);
const neutralFixtureNamePattern = /^(Golden|Fixture|Test|Lumis QA)\b/i;
const failures = [];

for (const file of await walk(documentationRoot)) {
  if (!file.endsWith(".md")) continue;
  const content = await readFile(file, "utf8");
  inspectEmails(file, content);
  inspectProtectedReferenceTokens(file, content);

  if (file.includes("golden-chart-official-website-fixtures")) {
    for (const [index, line] of content.split(/\r?\n/).entries()) {
      if (/^\|\s*Name\s*\|/i.test(line) || /^\|\s*Email\s*\|/i.test(line)) {
        failures.push(`${file}:${index + 1} contains a customer identity field`);
      }
    }
  }
}

for (const root of goldenRoots) {
  for (const file of await walk(root)) {
    const isGoldenPackageFile = root.startsWith("packages/") && goldenFilePattern.test(path.basename(file));
    const isGoldenToolFile = root === "tools/golden-tests";
    if (!isGoldenPackageFile && !isGoldenToolFile) continue;
    if (!/\.(json|mjs|js|ts)$/.test(file)) continue;
    const content = await readFile(file, "utf8");
    inspectEmails(file, content);
    inspectProtectedReferenceTokens(file, content);
    if (file.endsWith(".json")) inspectJsonIdentityKeys(file, JSON.parse(content));
  }
}

assert.equal(
  failures.length,
  0,
  `Repository PII scan failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`
);

console.log("repository PII scan passed");

function inspectEmails(file, content) {
  for (const match of content.matchAll(emailPattern)) {
    const domain = match[1].toLowerCase();
    if (!allowedEmailDomains.has(domain)) {
      const line = content.slice(0, match.index).split(/\r?\n/).length;
      failures.push(`${file}:${line} contains a non-placeholder email address`);
    }
  }
}

function inspectProtectedReferenceTokens(file, content) {
  for (const pattern of [websiteSessionPattern, websiteResultUrlPattern]) {
    pattern.lastIndex = 0;
    const match = pattern.exec(content);
    if (match) {
      const line = content.slice(0, match.index).split(/\r?\n/).length;
      failures.push(`${file}:${line} contains a protected website record lookup token`);
    }
  }
}

function inspectJsonIdentityKeys(file, value, location = "$") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => inspectJsonIdentityKeys(file, item, `${location}[${index}]`));
    return;
  }

  if (!value || typeof value !== "object") return;

  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase();
    if (forbiddenIdentityKeys.has(normalizedKey)) {
      failures.push(`${file}:${location}.${key} contains a forbidden identity field`);
    }
    if (
      normalizedKey === "name" &&
      (typeof child !== "string" || !neutralFixtureNamePattern.test(child))
    ) {
      failures.push(`${file}:${location}.${key} is not a neutral fixture label`);
    }
    inspectJsonIdentityKeys(file, child, `${location}.${key}`);
  }
}

async function walk(root) {
  const files = [];

  for (const entry of await readdir(root)) {
    const fullPath = path.join(root, entry);
    const metadata = await stat(fullPath);
    if (metadata.isDirectory()) files.push(...await walk(fullPath));
    else files.push(fullPath);
  }

  return files;
}
