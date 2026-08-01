import { readFileSync } from "node:fs";

try {
  const { functionName, allowAbsent } = parseArgs(process.argv.slice(2));
  const input = JSON.parse(readFileSync(0, "utf8").slice(0, 131_072));
  if (!Array.isArray(input)) throw new Error("INVALID_SHAPE");
  const matches = input.filter((item) =>
    item && typeof item === "object" && !Array.isArray(item) &&
    (item.name === functionName || item.slug === functionName)
  );
  if (matches.length === 0 && allowAbsent) {
    process.stdout.write("function_status=not_previously_deployed\n");
    process.exit(0);
  }
  if (matches.length !== 1) throw new Error("FUNCTION_NOT_UNIQUE");
  const item = matches[0];
  const version = item.version;
  const status = item.status;
  const updatedAt = item.updated_at ?? item.updatedAt;
  if (!Number.isInteger(version) || version < 1) throw new Error("INVALID_VERSION");
  if (typeof status !== "string" || !/^[A-Za-z_]+$/.test(status)) {
    throw new Error("INVALID_STATUS");
  }
  if (
    typeof updatedAt !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(updatedAt)
  ) {
    throw new Error("INVALID_UPDATED_AT");
  }
  process.stdout.write(
    `function_name=${functionName}\nfunction_version=${version}\nfunction_status=${status}\nfunction_updated_at=${updatedAt}`
  );
} catch {
  process.exitCode = 1;
}

function parseArgs(args) {
  if (args.length < 2 || args[0] !== "--function") {
    throw new Error("INVALID_ARGUMENTS");
  }
  const functionName = args[1];
  const allowAbsent = args.length === 3 && args[2] === "--allow-absent";
  if (
    !/^[a-z][a-z0-9-]*$/.test(functionName) ||
    (args.length !== 2 && !allowAbsent)
  ) {
    throw new Error("INVALID_ARGUMENTS");
  }
  return { functionName, allowAbsent };
}
