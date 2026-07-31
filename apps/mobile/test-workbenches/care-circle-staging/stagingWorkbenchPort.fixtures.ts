import type { SupabaseClient } from "@supabase/supabase-js";

import { createStagingWorkbenchPorts } from "./stagingWorkbenchPort";

const RELATIONSHIP_ID = "10000000-0000-4000-8000-000000000001";

void runFixtures();

async function runFixtures(): Promise<void> {
  const signedOut = createStagingWorkbenchPorts(
    fakeSupabase({ authenticated: false })
  );
  equal(
    (await signedOut.sessionPort.readSession()).authenticated,
    false,
    "signed-out session remains signed out"
  );

  const signedIn = createStagingWorkbenchPorts(
    fakeSupabase({
      authenticated: true,
      canActAsCaree: true,
      canActAsCarer: false,
      pausedUntil: "2030-01-02T00:00:00.000Z",
      relationships: [
        {
          relationship_id: RELATIONSHIP_ID,
          participant_role: "caree",
          other_display_name: "Disposable Carer",
          relationship_status: "pending_caree_acceptance",
        },
      ],
    })
  );
  const session = await signedIn.sessionPort.readSession();
  equal(session.authenticated, true, "real session is recognized");
  equal(
    session.authenticated && session.capabilities.canActAsCaree,
    true,
    "Caree capability is projected"
  );
  equal(
    session.authenticated && session.capabilities.canActAsCarer,
    false,
    "blocked Carer capability is projected"
  );
  equal(
    session.authenticated && session.capabilities.careCirclePaused,
    true,
    "pause state is projected"
  );

  const relationships =
    await signedIn.relationshipPort.listRelationships();
  equal(relationships.length, 1, "participant-safe relationship is listed");
  equal(
    relationships[0]?.status,
    "pending_caree_acceptance",
    "pending status is preserved"
  );

  const authCalls: string[] = [];
  const accountSwitch = createStagingWorkbenchPorts(
    fakeSupabase({ authenticated: false, authCalls })
  );
  await accountSwitch.sessionPort.signIn({
    email: "caree@example.invalid",
    password: "temporary-test-password",
  });
  await accountSwitch.sessionPort.signOut();
  equal(authCalls.join(","), "sign_in,sign_out", "account switching is explicit");

  const failedSignIn = createStagingWorkbenchPorts(
    fakeSupabase({ authenticated: false, signInFails: true })
  );
  let safeError = "";
  try {
    await failedSignIn.sessionPort.signIn({
      email: "carer@example.invalid",
      password: "temporary-test-password",
    });
  } catch (error) {
    safeError = error instanceof Error ? error.message : "";
  }
  equal(
    safeError,
    "CARE_CIRCLE_SIGN_IN_FAILED",
    "sign-in failure does not echo credentials"
  );
  excludes(safeError, "carer@example.invalid", "email is not echoed");
  excludes(safeError, "temporary-test-password", "password is not echoed");

  console.log("Care Circle staging workbench port fixtures passed");
}

function fakeSupabase(input: {
  authenticated: boolean;
  authCalls?: string[];
  canActAsCaree?: boolean;
  canActAsCarer?: boolean;
  pausedUntil?: string | null;
  relationships?: unknown[];
  signInFails?: boolean;
}): SupabaseClient {
  return {
    auth: {
      async getSession() {
        return input.authenticated
          ? { data: { session: { access_token: "redacted" } }, error: null }
          : { data: { session: null }, error: null };
      },
      async getUser() {
        return input.authenticated
          ? { data: { user: { id: "redacted" } }, error: null }
          : { data: { user: null }, error: null };
      },
      async signInWithPassword() {
        input.authCalls?.push("sign_in");
        return {
          data: { session: null, user: null },
          error: input.signInFails ? { message: "private transport" } : null,
        };
      },
      async signOut() {
        input.authCalls?.push("sign_out");
        return { error: null };
      },
    },
    functions: {
      async invoke() {
        return { data: { ok: true }, error: null };
      },
    },
    async rpc(name: string) {
      if (name === "resolve_care_circle_capability") {
        return {
          data: {
            can_act_as_caree: input.canActAsCaree ?? false,
            can_act_as_carer: input.canActAsCarer ?? false,
          },
          error: null,
        };
      }
      return { data: input.relationships ?? [], error: null };
    },
    from() {
      return {
        select() {
          return {
            async maybeSingle() {
              return {
                data: { paused_until: input.pausedUntil ?? null },
                error: null,
              };
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;
}

function equal(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) throw new Error(`${label}: assertion failed`);
}

function excludes(value: string, secret: string, label: string): void {
  if (value.includes(secret)) throw new Error(`${label}: prohibited output`);
}
