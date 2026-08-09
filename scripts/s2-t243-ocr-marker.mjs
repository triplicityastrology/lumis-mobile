let text = "";
for await (const chunk of process.stdin) text += chunk;
const [expectedSha, expectedState] = process.argv.slice(2);
const lines = text.split(/\r?\n/u);
const build = normalize(lines.find((line) => /^BUILD\s+/iu.test(line))?.replace(/^BUILD\s+/iu, "") ?? "");
const state = normalize(lines.find((line) => /^STATE\s+/iu.test(line))?.replace(/^STATE\s+/iu, "") ?? "");
const expectedBuild = normalize(expectedSha);
const expectedStateMarker = normalize(expectedState);
if (build.length !== 40 || expectedBuild.length !== 40 || distance(build, expectedBuild) > 2) process.exit(2);
if (state.length !== expectedStateMarker.length || distance(state, expectedStateMarker) > 1) process.exit(3);
process.stdout.write("S2_T243_VISIBLE_MARKER_MATCH\n");

function normalize(value) {
  return value.toLowerCase().replace(/[оo]/gu, "0").replace(/[іiıl]/gu, "1").replace(/[з]/gu, "3").replace(/[^a-f0-9_]/gu, "");
}
function distance(left, right) {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const saved = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (left[i - 1] === right[j - 1] ? 0 : 1));
      previous = saved;
    }
  }
  return row[right.length];
}
