import { readFileSync } from "node:fs";

try {
  const required = parseRequired(process.argv.slice(2));
  const input = JSON.parse(readFileSync(0, "utf8").slice(0, 131_072));
  if (!Array.isArray(input)) throw new Error("INVALID_SHAPE");
  const present = new Set(
    input.map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        throw new Error("INVALID_SHAPE");
      }
      const name = item.name;
      if (typeof name !== "string" || !/^[A-Z][A-Z0-9_]*$/.test(name)) {
        throw new Error("INVALID_NAME");
      }
      return name;
    })
  );
  if (required.some((name) => !present.has(name))) stop("MISSING_REQUIRED_NAME");
  process.stdout.write("CONFIGURATION_NAMES_CONFIRMED\n");
} catch (error) {
  if (error instanceof Error && error.message === "MISSING_REQUIRED_NAME") {
    process.stderr.write("MISSING_REQUIRED_NAME\n");
  } else {
    process.stderr.write("UNSAFE_RESPONSE\n");
  }
  process.exitCode = 1;
}

function parseRequired(args) {
  if (args.length !== 2 || args[0] !== "--required") {
    throw new Error("INVALID_ARGUMENTS");
  }
  const names = args[1].split(",");
  if (
    names.length === 0 ||
    new Set(names).size !== names.length ||
    names.some((name) => !/^[A-Z][A-Z0-9_]*$/.test(name))
  ) {
    throw new Error("INVALID_ARGUMENTS");
  }
  return names;
}

function stop(code) {
  throw new Error(code);
}
