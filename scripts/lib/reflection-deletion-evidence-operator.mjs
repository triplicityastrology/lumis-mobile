export const REFLECTION_EVIDENCE_PROJECT_REF = "bmqhwofmdgebpcihjlnb";
export const REFLECTION_EVIDENCE_PAGE_SIZE = 200;
export const REFLECTION_EVIDENCE_MAX_PAGES = 100;

export function validateReflectionEvidenceRunId(runId) {
  stopUnless(/^s2t111-[0-9]{8}t[0-9]{6}z-[a-f0-9]{8}$/.test(runId), "RUN_ID_INVALID");
}

export function expectedReflectionEvidenceEmail(runId, role) {
  validateReflectionEvidenceRunId(runId);
  stopUnless(role === "owner" || role === "cross_owner", "ROLE_INVALID");
  return `lumis.s2t111.${role}.${runId}@example.com`;
}

export function validateReflectionEvidenceSetup(input) {
  validateReflectionEvidenceRunId(input.runId);
  stopUnless(input.projectRef === REFLECTION_EVIDENCE_PROJECT_REF, "WRONG_PROJECT");
  stopUnless(input.ownerEmail === expectedReflectionEvidenceEmail(input.runId, "owner"), "OWNER_EMAIL_INVALID");
  stopUnless(input.crossOwnerEmail === expectedReflectionEvidenceEmail(input.runId, "cross_owner"), "CROSS_OWNER_EMAIL_INVALID");
  stopUnless(validPassword(input.ownerPassword) && validPassword(input.crossOwnerPassword), "PASSWORD_INVALID");
  stopUnless(input.ownerPassword !== input.crossOwnerPassword, "PASSWORD_REUSE_FORBIDDEN");
}

export async function discoverReflectionEvidenceUsers(fetchPage, runId) {
  validateReflectionEvidenceRunId(runId);
  const seen = new Set();
  const matches = [];
  let expectedTotal;
  let expectedLastPage;
  for (let page = 1; page <= REFLECTION_EVIDENCE_MAX_PAGES; page += 1) {
    const result = await fetchPage(page, REFLECTION_EVIDENCE_PAGE_SIZE);
    stopUnless(result && Array.isArray(result.users), "AUTH_PAGE_INVALID");
    stopUnless(Number.isInteger(result.total) && Number.isInteger(result.lastPage), "AUTH_PAGE_METADATA_INVALID");
    expectedTotal ??= result.total;
    expectedLastPage ??= result.lastPage;
    stopUnless(result.total === expectedTotal && result.lastPage === expectedLastPage, "AUTH_PAGINATION_CHANGED");
    stopUnless(expectedLastPage <= REFLECTION_EVIDENCE_MAX_PAGES, "AUTH_PAGINATION_UNBOUNDED");
    for (const user of result.users) {
      stopUnless(typeof user?.id === "string" && !seen.has(user.id), "AUTH_USER_INVALID_OR_DUPLICATE");
      seen.add(user.id);
      if (user.user_metadata?.s2_evidence_suite === "s2t111" && user.user_metadata?.s2_evidence_run_id === runId) matches.push(user);
    }
    if (page === Math.max(expectedLastPage, 1)) break;
    stopUnless(result.users.length === REFLECTION_EVIDENCE_PAGE_SIZE, "AUTH_PAGE_INCOMPLETE");
  }
  stopUnless(seen.size === expectedTotal, "AUTH_SNAPSHOT_INCOMPLETE");
  return matches;
}

export function validateReflectionEvidencePair(users) {
  stopUnless(Array.isArray(users) && users.length === 2, "RUN_PAIR_INCOMPLETE");
  const roles = users.map((user) => user.user_metadata?.s2_evidence_role).sort();
  stopUnless(roles[0] === "cross_owner" && roles[1] === "owner", "RUN_PAIR_INVALID");
  return users;
}

function validPassword(value) { return typeof value === "string" && value.length >= 20 && value.length <= 128; }
function stopUnless(condition, code) { if (!condition) throw new Error(`STOP_S2_T111_${code}`); }
