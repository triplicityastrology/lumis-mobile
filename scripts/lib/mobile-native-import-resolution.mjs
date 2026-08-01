import { createRequire } from "node:module";
import path from "node:path";

const IMPORT_PATTERN = /(?:from\s*|import\s*\(|require\s*\()\s*["']([^"']+)["']/g;

export function collectBareModuleSpecifiers(source) {
  const specifiers = new Set();
  for (const match of source.matchAll(IMPORT_PATTERN)) {
    const specifier = match[1];
    if (!specifier.startsWith(".") && !specifier.startsWith("/")) {
      specifiers.add(specifier);
    }
  }
  return [...specifiers].sort();
}

export function validateMobileModuleSpecifiers({ source, mobileRoot }) {
  const requireFromMobile = createRequire(path.join(mobileRoot, "package.json"));
  const unresolved = [];
  for (const specifier of collectBareModuleSpecifiers(source)) {
    try {
      requireFromMobile.resolve(specifier);
    } catch {
      unresolved.push(specifier);
    }
  }
  return { ok: unresolved.length === 0, unresolvedCount: unresolved.length, unresolved };
}
