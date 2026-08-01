export const TWO_ACCOUNT_PROJECT_REF = "bmqhwofmdgebpcihjlnb";
export const AUTH_DISCOVERY_PAGE_SIZE = 200;
export const AUTH_DISCOVERY_MAX_PAGES = 100;

export function expectedSyntheticEmail(runId, role) {
  validateRunId(runId);
  if (role !== "caree" && role !== "carer") throw new Error("STOP_S2_T75_ROLE_INVALID");
  return `lumis.s2t75.${role}.${runId}@example.com`;
}

export function validateSetupInput(input) {
  validateRunId(input.runId);
  stopUnless(input.projectRef === TWO_ACCOUNT_PROJECT_REF, "WRONG_PROJECT");
  stopUnless(input.careeEmail === expectedSyntheticEmail(input.runId, "caree"), "CAREE_EMAIL_INVALID");
  stopUnless(input.carerEmail === expectedSyntheticEmail(input.runId, "carer"), "CARER_EMAIL_INVALID");
  stopUnless(input.careeEmail !== input.carerEmail, "ACCOUNT_COLLISION");
  stopUnless(isPassword(input.careePassword), "CAREE_PASSWORD_INVALID");
  stopUnless(isPassword(input.carerPassword), "CARER_PASSWORD_INVALID");
  stopUnless(input.careePassword !== input.carerPassword, "PASSWORD_REUSE_FORBIDDEN");
  return { ok: true };
}

export function validateRunId(runId) {
  stopUnless(/^s2t75-[0-9]{8}t[0-9]{6}z-[a-f0-9]{8}$/.test(runId), "RUN_ID_INVALID");
}

export async function discoverExactRunUsers(fetchPage, runId, options = {}) {
  validateRunId(runId);
  const pageSize = options.pageSize ?? AUTH_DISCOVERY_PAGE_SIZE;
  const maxPages = options.maxPages ?? AUTH_DISCOVERY_MAX_PAGES;
  stopUnless(Number.isInteger(pageSize) && pageSize > 0 && pageSize <= 1000, "AUTH_PAGE_SIZE_INVALID");
  stopUnless(Number.isInteger(maxPages) && maxPages > 0, "AUTH_PAGE_LIMIT_INVALID");

  const seenIds = new Set();
  const matches = [];
  let expectedTotal;
  let expectedLastPage;
  let page = 1;

  while (page <= maxPages) {
    const result = await fetchPage(page, pageSize);
    stopUnless(result && Array.isArray(result.users), "AUTH_PAGE_INVALID");
    stopUnless(Number.isInteger(result.total) && result.total >= 0, "AUTH_TOTAL_MISSING");
    stopUnless(Number.isInteger(result.lastPage) && result.lastPage >= 0, "AUTH_LAST_PAGE_MISSING");
    stopUnless(result.lastPage <= maxPages, "AUTH_PAGINATION_UNBOUNDED");

    expectedTotal ??= result.total;
    expectedLastPage ??= result.lastPage;
    stopUnless(result.total === expectedTotal, "AUTH_TOTAL_CHANGED");
    stopUnless(result.lastPage === expectedLastPage, "AUTH_LAST_PAGE_CHANGED");
    stopUnless(page <= Math.max(expectedLastPage, 1), "AUTH_PAGE_SEQUENCE_INVALID");

    for (const user of result.users) {
      stopUnless(user && typeof user.id === "string" && user.id.length > 0, "AUTH_USER_SHAPE_INVALID");
      stopUnless(!seenIds.has(user.id), "AUTH_PAGE_DUPLICATE");
      seenIds.add(user.id);
      if (
        user.user_metadata?.s2_evidence_suite === "s2t75" &&
        user.user_metadata?.s2_evidence_run_id === runId
      ) {
        matches.push(user);
      }
    }

    if (page === Math.max(expectedLastPage, 1)) break;
    stopUnless(result.users.length === pageSize, "AUTH_PAGE_INCOMPLETE");
    page += 1;
  }

  stopUnless(page === Math.max(expectedLastPage ?? 0, 1), "AUTH_PAGINATION_INCOMPLETE");
  stopUnless(seenIds.size === expectedTotal, "AUTH_SNAPSHOT_INCOMPLETE");
  return matches;
}

export function validateExactRunPair(users) {
  stopUnless(Array.isArray(users) && users.length === 2, "RUN_PAIR_INCOMPLETE");
  const roles = users.map((user) => user.user_metadata?.s2_evidence_role).sort();
  stopUnless(roles[0] === "caree" && roles[1] === "carer", "RUN_PAIR_INVALID");
  stopUnless(new Set(users.map((user) => user.id)).size === 2, "RUN_PAIR_DUPLICATE");
  return users;
}

function isPassword(value) {
  return typeof value === "string" && value.length >= 20 && value.length <= 128;
}

function stopUnless(condition, code) {
  if (!condition) throw new Error(`STOP_S2_T75_${code}`);
}
