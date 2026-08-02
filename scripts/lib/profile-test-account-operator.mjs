export const PROFILE_TEST_PROJECT_REF = "bmqhwofmdgebpcihjlnb";
export const PROFILE_TEST_PAGE_SIZE = 200;
export const PROFILE_TEST_MAX_PAGES = 100;

export function validateProfileTestRunId(runId) {
  stopUnless(/^s2t110-[0-9]{8}t[0-9]{6}z-[a-f0-9]{8}$/.test(runId), "RUN_ID_INVALID");
}

export function expectedProfileTestEmail(runId, role) {
  validateProfileTestRunId(runId);
  stopUnless(role === "timed" || role === "no_time", "ROLE_INVALID");
  return `lumis.s2t110.${role}.${runId}@example.com`;
}

export function validateProfileTestSetup(input) {
  validateProfileTestRunId(input.runId);
  stopUnless(input.projectRef === PROFILE_TEST_PROJECT_REF, "WRONG_PROJECT");
  stopUnless(input.timedEmail === expectedProfileTestEmail(input.runId, "timed"), "TIMED_EMAIL_INVALID");
  stopUnless(input.noTimeEmail === expectedProfileTestEmail(input.runId, "no_time"), "NO_TIME_EMAIL_INVALID");
  stopUnless(validPassword(input.timedPassword) && validPassword(input.noTimePassword), "PASSWORD_INVALID");
  stopUnless(input.timedPassword !== input.noTimePassword, "PASSWORD_REUSE_FORBIDDEN");
}

export async function discoverProfileTestUsers(fetchPage, runId) {
  validateProfileTestRunId(runId);
  const seen = new Set();
  const matches = [];
  let total;
  let lastPage;
  for (let page = 1; page <= PROFILE_TEST_MAX_PAGES; page += 1) {
    const result = await fetchPage(page, PROFILE_TEST_PAGE_SIZE);
    stopUnless(result && Array.isArray(result.users), "AUTH_PAGE_INVALID");
    stopUnless(Number.isInteger(result.total) && Number.isInteger(result.lastPage), "AUTH_PAGE_METADATA_INVALID");
    total ??= result.total;
    lastPage ??= result.lastPage;
    stopUnless(result.total === total && result.lastPage === lastPage, "AUTH_PAGINATION_CHANGED");
    stopUnless(lastPage <= PROFILE_TEST_MAX_PAGES, "AUTH_PAGINATION_UNBOUNDED");
    for (const user of result.users) {
      stopUnless(typeof user?.id === "string" && !seen.has(user.id), "AUTH_USER_INVALID_OR_DUPLICATE");
      seen.add(user.id);
      if (user.user_metadata?.s2_evidence_suite === "s2t110" && user.user_metadata?.s2_evidence_run_id === runId) matches.push(user);
    }
    if (page === Math.max(lastPage, 1)) break;
    stopUnless(result.users.length === PROFILE_TEST_PAGE_SIZE, "AUTH_PAGE_INCOMPLETE");
  }
  stopUnless(seen.size === total, "AUTH_SNAPSHOT_INCOMPLETE");
  return matches;
}

export function validateProfileTestPair(users) {
  stopUnless(Array.isArray(users) && users.length === 2, "RUN_PAIR_INCOMPLETE");
  const roles = users.map((user) => user.user_metadata?.s2_evidence_role).sort();
  stopUnless(roles[0] === "no_time" && roles[1] === "timed", "RUN_PAIR_INVALID");
  return users;
}

function validPassword(value) {
  return typeof value === "string" && value.length >= 20 && value.length <= 128;
}

function stopUnless(condition, code) {
  if (!condition) throw new Error(`STOP_S2_T110_${code}`);
}
