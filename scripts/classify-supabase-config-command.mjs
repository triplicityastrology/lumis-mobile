import { readFileSync } from "node:fs";

const status = Number(process.argv[2]);
const input = readFileSync(0, "utf8").slice(0, 131_072);

if (!Number.isInteger(status) || status <= 0) {
  process.stdout.write("CONFIG_RESPONSE_UNSAFE\n");
} else if (/\b(?:401|unauthorized|invalid access token|authentication required)\b/iu.test(input)) {
  process.stdout.write("CONFIG_AUTH_FAILED\n");
} else if (/\b(?:403|forbidden|permission denied|insufficient permissions?)\b/iu.test(input)) {
  process.stdout.write("CONFIG_PERMISSION_FAILED\n");
} else if (/\b(?:network|timeout|timed out|connection|dns|econn|enotfound)\b/iu.test(input)) {
  process.stdout.write("CONFIG_NETWORK_FAILED\n");
} else if (/\b(?:command not found|unknown command|unknown option|executable|enoent)\b/iu.test(input)) {
  process.stdout.write("CONFIG_CLI_FAILED\n");
} else {
  process.stdout.write("CONFIG_RESPONSE_UNSAFE\n");
}
