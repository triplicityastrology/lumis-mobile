const projectRef = process.env.SUPABASE_PROJECT_REF ?? "bmqhwofmdgebpcihjlnb";
const supabaseUrl = `https://${projectRef}.supabase.co`;
const anonKey = requireEnvironment("SUPABASE_ANON_KEY");
const secretKey = requireSecretKey();
const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const password = `Lumis-QA-${crypto.randomUUID()}!`;
const createdUserIds = [];

const results = [];

console.log(`Hosted QA run ID: ${runId}`);
console.log(`If this process is interrupted, run: pnpm test:staging-backend:cleanup -- ${runId}`);

try {
  await auditExistingChartVersionInvariants();
  await verifyTrustedBirthLocationResolver();
  await verifyRuntimeMonitoringAndSchedules();
  await verifyBirthDetailsChangeDeployment();

  const primary = await createConfirmedUser(`lumis.qa.primary.${runId}@example.com`, password);
  const secondary = await createConfirmedUser(`lumis.qa.secondary.${runId}@example.com`, password);
  const birthChangeUser = await createConfirmedUser(`lumis.qa.birth-change.${runId}@example.com`, password);
  createdUserIds.push(primary.id, secondary.id, birthChangeUser.id);

  const primarySession = await signIn(primary.email, password);
  const secondarySession = await signIn(secondary.email, password);
  const birthChangeSession = await signIn(birthChangeUser.email, password);
  const originalRequest = {
    display_name: "Staging QA",
    birth_date: "1986-02-20",
    birth_time: "16:55",
    time_unknown: false,
    place_name: "Hong Kong",
    country_code: "HK",
    lat: 22.3193,
    lng: 114.1694,
    tz_str: "Asia/Hong_Kong"
  };

  const firstProfile = await invokeFunction("profile", primarySession.access_token, originalRequest);
  assert(firstProfile.status === 200, `Initial profile returned HTTP ${firstProfile.status}.`);
  assert(firstProfile.body.status === "profile_persisted", "Initial profile was not persisted.");
  assert(firstProfile.body.chart_version === 1, "Initial profile did not return chart_version 1.");
  assert(firstProfile.body.ai_profile_id, "Initial profile did not return ai_profile_id.");
  assert(firstProfile.body.birth_data_history_id, "Initial profile did not return birth_data_history_id.");
  assert(!containsKey(firstProfile.body, "rawProviderResponse"), "Profile exposed raw provider output.");
  assert(
    firstProfile.body.chart?.source === "triplicity_cloudflare_worker",
    "Initial profile did not use the live signed Cloudflare Worker."
  );
  assert(firstProfile.body.chart?.planets?.length >= 10, "Live chart contains too few points.");
  assert(firstProfile.body.chart?.houses?.length === 12, "Live full-time chart does not contain 12 houses.");
  assert(firstProfile.body.chart?.angles?.ascendant, "Live full-time chart has no Ascendant.");
  assert(firstProfile.body.chart?.angles?.mediumCoeli, "Live full-time chart has no MC.");
  pass("Fresh onboarding persists a populated live Worker chart without raw provider output");

  const providerAttempts = await serviceSelect(
    "chart_provider_call_attempt_events",
    `user_id=eq.${primary.id}&select=request_id,attempt_number,observed_at&order=attempt_number.asc`
  );
  assert(providerAttempts.length >= 1, "Provider call attempt ledger did not record live chart generation.");
  assert(providerAttempts[0].attempt_number === 1, "Provider call attempt numbering did not begin at one.");
  const runtimeSnapshot = await serviceRequest("/rest/v1/rpc/runtime_health_snapshot", {
    method: "POST",
    body: {}
  });
  assert(
    Number(runtimeSnapshot.provider_calls_24h) >= providerAttempts.length,
    "Runtime health snapshot did not count observed provider attempts."
  );
  pass("Provider attempts are append-only and counted in their observed 24-hour window");

  const concurrentProviderRequestId = `qa-provider-concurrency-${runId}`;
  const providerRpc = (count) => serviceRequest("/rest/v1/rpc/record_chart_provider_call_event", {
    method: "POST",
    body: {
      p_request_id: concurrentProviderRequestId,
      p_user_id: primary.id,
      p_status: "generated",
      p_error_code: null,
      p_worker_disposition: "generated",
      p_provider_call_count: count
    }
  });
  const concurrentProviderResults = await Promise.all([providerRpc(3), providerRpc(2)]);
  assert(concurrentProviderResults.every((result) => result.ok === true), "Concurrent provider telemetry was rejected.");
  const concurrentProviderLedger = await serviceSelect(
    "chart_provider_call_events",
    `request_id=eq.${encodeURIComponent(concurrentProviderRequestId)}&select=provider_call_count`
  );
  const concurrentProviderAttempts = await serviceSelect(
    "chart_provider_call_attempt_events",
    `request_id=eq.${encodeURIComponent(concurrentProviderRequestId)}&select=attempt_number&order=attempt_number.asc`
  );
  assert(
    concurrentProviderLedger.length === 1 && concurrentProviderLedger[0].provider_call_count === 3,
    "A lower concurrent provider count overwrote the higher count."
  );
  assert(
    concurrentProviderAttempts.map((attempt) => attempt.attempt_number).join(",") === "1,2,3",
    "Concurrent provider telemetry did not append exactly three unique attempts."
  );
  pass("Concurrent cumulative provider telemetry preserves the maximum count and unique attempts");

  const billingPeriodKey = `qa:${crypto.randomUUID()}`;
  const concurrentBalanceResults = await Promise.all([
    serviceRequestResult("/rest/v1/monthly_balance", {
      method: "POST",
      prefer: "return=representation",
      body: {
        user_id: primary.id,
        period_start: "2026-07-01T00:00:01.000Z",
        period_end: "2026-08-01T00:00:00.000Z",
        billing_period_key: billingPeriodKey,
        grant_type: "subscription_period",
        allocated: 150,
        remaining: 150
      }
    }),
    serviceRequestResult("/rest/v1/monthly_balance", {
      method: "POST",
      prefer: "return=representation",
      body: {
        user_id: primary.id,
        period_start: "2026-07-01T00:00:02.000Z",
        period_end: "2026-08-01T00:00:00.000Z",
        billing_period_key: billingPeriodKey,
        grant_type: "subscription_period",
        allocated: 150,
        remaining: 150
      }
    })
  ]);
  assert(
    concurrentBalanceResults.filter((result) => result.ok).length === 1,
    "Concurrent logical-period creation did not accept exactly one balance row."
  );
  const logicalPeriodRows = await serviceSelect(
    "monthly_balance",
    `user_id=eq.${primary.id}&billing_period_key=eq.${billingPeriodKey}&select=id,allocated,remaining`
  );
  assert(logicalPeriodRows.length === 1, "Logical billing period contains duplicate rows.");
  assert(
    logicalPeriodRows[0].allocated === 150 && logicalPeriodRows[0].remaining === 150,
    "Logical-period duplicate handling preserved an accidental double grant."
  );
  pass("Concurrent balance creation permits one row and one allocation per logical provider period");

  const duplicateProfile = await invokeFunction("profile", primarySession.access_token, originalRequest);
  assert(duplicateProfile.status === 409, `Repeat onboarding returned HTTP ${duplicateProfile.status}.`);
  assert(
    duplicateProfile.body?.error?.code === "PROFILE_ALREADY_EXISTS",
    "Repeat onboarding did not return PROFILE_ALREADY_EXISTS."
  );
  const duplicateCounts = await Promise.all([
    serviceSelect("birth_data", `user_id=eq.${primary.id}&select=user_id`),
    serviceSelect("ai_profiles", `user_id=eq.${primary.id}&select=id`),
    serviceSelect("birth_data_history", `user_id=eq.${primary.id}&select=id`),
    serviceSelect("monthly_balance", `user_id=eq.${primary.id}&grant_type=eq.starter_onboarding&select=id`)
  ]);
  assert(
    duplicateCounts.every((rows) => rows.length === 1),
    "Repeat onboarding created duplicate profile data."
  );
  pass("Repeat onboarding is rejected before chart generation");

  const birthChangeInitial = await invokeFunction("profile", birthChangeSession.access_token, {
    ...originalRequest,
    display_name: "Birth Change QA"
  });
  assert(birthChangeInitial.status === 200, "Birth-change QA onboarding failed.");
  const oldReflection = await invokeFunction("chat-message", birthChangeSession.access_token, {
    message: "Keep this reflection on chart version one.",
    client_msg_id: crypto.randomUUID(),
    persona_style: "acceptance",
    force_new_thread: true
  });
  assertSuccessfulNoChargeChat(oldReflection);

  const birthChangeRequestId = crypto.randomUUID();
  const changedBirthRequest = {
    client_request_id: birthChangeRequestId,
    display_name: "Incoming name is ignored",
    birth_date: "1986-02-21",
    birth_time: "09:30",
    time_unknown: false,
    place_name: "London, UK",
    country_code: "GB",
    lat: 51.5072,
    lng: -0.1276,
    tz_str: "Spoofed/Timezone"
  };
  const providerAttemptsBeforeInvalidBirthDetails = await serviceSelect(
    "chart_provider_call_attempt_events",
    `user_id=eq.${birthChangeUser.id}&select=request_id,attempt_number`
  );
  const [invalidBirthTime, invalidUnknownTimeType] = await Promise.all([
    invokeFunction("profile/birth-details/change", birthChangeSession.access_token, {
      ...changedBirthRequest,
      client_request_id: crypto.randomUUID(),
      birth_time: "25:61"
    }),
    invokeFunction("profile/birth-details/change", birthChangeSession.access_token, {
      ...changedBirthRequest,
      client_request_id: crypto.randomUUID(),
      time_unknown: "false"
    })
  ]);
  assert(
    invalidBirthTime.status === 400 && invalidBirthTime.body?.error?.code === "49002",
    "Malformed birth time was not rejected before regeneration."
  );
  assert(
    invalidUnknownTimeType.status === 400 && invalidUnknownTimeType.body?.error?.code === "49002",
    "Non-boolean unknown-time value was not rejected before regeneration."
  );
  const providerAttemptsAfterInvalidBirthDetails = await serviceSelect(
    "chart_provider_call_attempt_events",
    `user_id=eq.${birthChangeUser.id}&select=request_id,attempt_number`
  );
  assert(
    providerAttemptsAfterInvalidBirthDetails.length === providerAttemptsBeforeInvalidBirthDetails.length,
    "Invalid birth details reached the chart provider."
  );
  pass("Malformed birth details are rejected server-side before chart generation");
  const changedBirth = await invokeFunction(
    "profile/birth-details/change",
    birthChangeSession.access_token,
    changedBirthRequest
  );
  assert(
    changedBirth.status === 200,
    `Birth-detail regeneration returned HTTP ${changedBirth.status}: ${safeError(changedBirth.body)}.`
  );
  assert(changedBirth.body.status === "birth_details_regenerated", "Birth details were not regenerated.");
  assert(changedBirth.body.chart_version === 2, "Birth-detail regeneration did not create chart version two.");
  assert(changedBirth.body.successful_change_count === 1, "Successful birth-detail change count is not one.");
  assert(changedBirth.body.remaining_changes === 2, "Remaining birth-detail changes is not two.");

  const [changedBirthRow, changedHistories, changedProfiles, oldThreadRows] = await Promise.all([
    serviceSelectOne("birth_data", birthChangeUser.id, "user_id"),
    serviceSelect(
      "birth_data_history",
      `user_id=eq.${birthChangeUser.id}&select=id,chart_version,status,ai_profile_id&order=chart_version.asc`
    ),
    serviceSelect(
      "ai_profiles",
      `user_id=eq.${birthChangeUser.id}&select=id,chart_version,is_active,chart_json&order=chart_version.asc`
    ),
    serviceSelect("chat_threads", `id=eq.${oldReflection.body.thread_id}&select=id,chart_version,status`)
  ]);
  assert(changedBirthRow.active_chart_version === 2, "birth_data did not activate chart version two.");
  assert(changedBirthRow.successful_change_count === 1, "birth_data consumed the wrong number of changes.");
  assert(changedBirthRow.place_name === "London, UK", "Canonical birthplace was not stored.");
  assert(changedBirthRow.tz_str === "Europe/London", "Client timezone spoof was not replaced server-side.");
  assert(changedHistories.length === 2, "Regeneration did not retain both chart histories.");
  assert(changedHistories[0].status === "superseded" && changedHistories[1].status === "active", "Chart history activation is incorrect.");
  assert(changedProfiles.length === 2, "Regeneration did not create a second AI profile version.");
  assert(changedProfiles[0].is_active === false && changedProfiles[1].is_active === true, "AI profile activation is incorrect.");
  assert(!containsKey(changedProfiles[1].chart_json, "rawProviderResponse"), "Regenerated profile retained raw provider output.");
  assert(oldThreadRows.length === 1 && oldThreadRows[0].chart_version === 1, "Past Reflection lost its original chart version.");
  pass("Birth-detail regeneration atomically activates version two and preserves version-one reflections");

  const providerAttemptsBeforeReplay = await serviceSelect(
    "chart_provider_call_attempt_events",
    `user_id=eq.${birthChangeUser.id}&select=request_id,attempt_number`
  );
  const replayedBirthChange = await invokeFunction(
    "profile/birth-details/change",
    birthChangeSession.access_token,
    changedBirthRequest
  );
  assert(replayedBirthChange.status === 200, "Exact birth-change replay did not return safely.");
  assert(replayedBirthChange.body.status === "birth_details_already_regenerated", "Exact birth-change replay was not idempotent.");
  const providerAttemptsAfterReplay = await serviceSelect(
    "chart_provider_call_attempt_events",
    `user_id=eq.${birthChangeUser.id}&select=request_id,attempt_number`
  );
  assert(providerAttemptsAfterReplay.length === providerAttemptsBeforeReplay.length, "Exact replay called the chart provider again.");
  pass("Exact birth-detail replay returns the committed result without another provider call");

  const reservationA = crypto.randomUUID();
  const reservationB = crypto.randomUUID();
  const reservationResults = await Promise.all([
    serviceRequest("/rest/v1/rpc/reserve_birth_details_change", {
      method: "POST",
      body: { p_user_id: birthChangeUser.id, p_request_id: reservationA, p_request_digest: "a".repeat(64) }
    }),
    serviceRequest("/rest/v1/rpc/reserve_birth_details_change", {
      method: "POST",
      body: { p_user_id: birthChangeUser.id, p_request_id: reservationB, p_request_digest: "b".repeat(64) }
    })
  ]);
  const acceptedReservation = reservationResults.find((result) => result.ok === true);
  const rejectedReservation = reservationResults.find((result) => result.ok === false);
  assert(acceptedReservation && rejectedReservation?.error_code === "49003", "Concurrent regeneration reservations were not serialized.");
  const acceptedRequestId = reservationResults[0].ok ? reservationA : reservationB;
  await serviceRequest("/rest/v1/rpc/fail_birth_details_change", {
    method: "POST",
    body: { p_user_id: birthChangeUser.id, p_request_id: acceptedRequestId, p_error_code: "QA_RELEASE" }
  });
  const countAfterFailedReservation = await serviceSelectOne("birth_data", birthChangeUser.id, "user_id");
  assert(countAfterFailedReservation.successful_change_count === 1, "Failed reservation consumed a lifetime change.");
  pass("Concurrent regeneration is serialized and failed work does not consume a change");

  const expiredRequestId = crypto.randomUUID();
  const expiredDigest = "c".repeat(64);
  const originalExpiredReservation = await serviceRequest("/rest/v1/rpc/reserve_birth_details_change", {
    method: "POST",
    body: {
      p_user_id: birthChangeUser.id,
      p_request_id: expiredRequestId,
      p_request_digest: expiredDigest
    }
  });
  assert(originalExpiredReservation.ok === true, "Expiry-recovery reservation was not created.");
  await servicePatch("birth_detail_change_requests", `request_id=eq.${expiredRequestId}`, {
    lease_expires_at: "2000-01-01T00:00:00.000Z"
  });
  const resumedExpiredReservation = await serviceRequest("/rest/v1/rpc/reserve_birth_details_change", {
    method: "POST",
    body: {
      p_user_id: birthChangeUser.id,
      p_request_id: expiredRequestId,
      p_request_digest: expiredDigest
    }
  });
  assert(resumedExpiredReservation.ok === true && resumedExpiredReservation.resumed === true, "Expired request did not resume safely.");
  assert(
    resumedExpiredReservation.worker_request_id === originalExpiredReservation.worker_request_id &&
      resumedExpiredReservation.worker_requested_at === originalExpiredReservation.worker_requested_at,
    "Expired request did not preserve its original Worker identity."
  );
  await serviceRequest("/rest/v1/rpc/fail_birth_details_change", {
    method: "POST",
    body: { p_user_id: birthChangeUser.id, p_request_id: expiredRequestId, p_error_code: "QA_RELEASE" }
  });
  pass("Expired same-request recovery preserves the original Worker request identity");

  await servicePatch("birth_data", `user_id=eq.${birthChangeUser.id}`, { successful_change_count: 3 });
  const providerAttemptsBeforeLimit = await serviceSelect(
    "chart_provider_call_attempt_events",
    `user_id=eq.${birthChangeUser.id}&select=request_id,attempt_number`
  );
  const limitedBirthChange = await invokeFunction(
    "profile/birth-details/change",
    birthChangeSession.access_token,
    { ...changedBirthRequest, client_request_id: crypto.randomUUID(), birth_date: "1986-02-22" }
  );
  assert(limitedBirthChange.status === 409 && limitedBirthChange.body?.error?.code === "49001", "Three-change limit was not enforced.");
  const providerAttemptsAfterLimit = await serviceSelect(
    "chart_provider_call_attempt_events",
    `user_id=eq.${birthChangeUser.id}&select=request_id,attempt_number`
  );
  assert(providerAttemptsAfterLimit.length === providerAttemptsBeforeLimit.length, "Limit rejection called the chart provider.");
  pass("Lifetime limit rejects before chart generation");

  const starterEntitlement = await serviceSelectOne("account_entitlements", primary.id, "user_id");
  assert(starterEntitlement.plan_tier === "starter", "Onboarding entitlement is not Starter.");
  assert(starterEntitlement.product_code === "STARTER", "Onboarding entitlement has the wrong product.");
  assert(starterEntitlement.status === "active", "Onboarding entitlement is not active.");
  const resolvedStarterPlan = await userRequest(
    primarySession.access_token,
    "/rest/v1/rpc/resolve_active_plan_tier",
    { method: "POST", body: { p_user_id: primary.id } }
  );
  assert(resolvedStarterPlan.ok && resolvedStarterPlan.body === "starter", "Active Starter plan did not resolve authoritatively.");
  pass("Onboarding creates an authoritative active Starter entitlement");

  const personaUpdate = await userRequest(
    primarySession.access_token,
    "/rest/v1/rpc/update_lumis_persona",
    {
      method: "POST",
      body: {
        p_persona_style: "awareness",
        p_buddy_name: "Nova",
        p_buddy_avatar_key: "iris",
        p_focus: "timing"
      }
    }
  );
  assert(personaUpdate.ok, "Owner could not update the Lumis Persona through the protected RPC.");
  const savedPersona = await serviceSelectOne("users", primary.id);
  assert(savedPersona.buddy_name === "Nova", "Protected Persona RPC did not save the name.");
  assert(savedPersona.buddy_avatar_key === "iris", "Protected Persona RPC did not save the avatar.");
  assert(savedPersona.focus === "timing", "Protected Persona RPC did not save the focus.");
  assert(savedPersona.persona_style === "awareness", "Protected Persona RPC did not save the style.");
  const invalidPersona = await userRequest(
    primarySession.access_token,
    "/rest/v1/rpc/update_lumis_persona",
    {
      method: "POST",
      body: {
        p_persona_style: "awareness",
        p_buddy_name: "Nova",
        p_buddy_avatar_key: "unapproved-avatar",
        p_focus: "timing"
      }
    }
  );
  assert(!invalidPersona.ok, "Protected Persona RPC accepted an unapproved avatar.");
  const directPersonaWrite = await userRequest(
    primarySession.access_token,
    `/rest/v1/users?id=eq.${primary.id}`,
    { method: "PATCH", body: { buddy_avatar_key: "ceres" }, prefer: "return=representation" }
  );
  assert(
    !directPersonaWrite.ok || directPersonaWrite.body?.length === 0,
    "Authenticated client retained broad direct user-update access."
  );
  pass("Persona RPC persists approved identity values and rejects unapproved/direct writes");

  const eventBase = new Date();
  const newestEventAt = new Date(eventBase.getTime() + 60_000).toISOString();
  const olderEventAt = eventBase.toISOString();
  const newestEvent = {
    p_provider: "revenuecat",
    p_provider_event_id: `qa-tie-a-${runId}`,
    p_user_id: primary.id,
    p_provider_customer_id: `qa-customer-${runId}`,
    p_event_type: "INITIAL_PURCHASE",
    p_entitlement_label: "prime",
    p_product_code: "PRIME_M",
    p_plan_tier: "prime",
    p_entitlement_status: "active",
    p_valid_from: eventBase.toISOString(),
    p_valid_until: new Date(eventBase.getTime() + 30 * 86_400_000).toISOString(),
    p_provider_event_at: newestEventAt,
    p_payload_digest: `sha256:new-${runId}`
  };
  const firstProviderEvent = await serviceRequest("/rest/v1/rpc/apply_entitlement_provider_event", {
    method: "POST",
    body: newestEvent
  });
  assert(firstProviderEvent.applied === true, "Newest provider event was not applied.");
  const duplicateProviderEvent = await serviceRequest("/rest/v1/rpc/apply_entitlement_provider_event", {
    method: "POST",
    body: newestEvent
  });
  assert(
    duplicateProviderEvent.duplicate === true && duplicateProviderEvent.applied === false,
    "Duplicate provider event was not an idempotent no-op."
  );
  const conflictingProviderEvent = await serviceRequestResult(
    "/rest/v1/rpc/apply_entitlement_provider_event",
    {
      method: "POST",
      body: { ...newestEvent, p_payload_digest: `sha256:conflict-${runId}` }
    }
  );
  assert(!conflictingProviderEvent.ok, "Changed payload digest was accepted as a normal duplicate.");
  assert(
    String(conflictingProviderEvent.body?.message).includes("ENTITLEMENT_EVENT_INTEGRITY_CONFLICT"),
    "Changed payload digest returned the wrong integrity error."
  );
  const equalTimeHigherIdEvent = await serviceRequest(
    "/rest/v1/rpc/apply_entitlement_provider_event",
    {
      method: "POST",
      body: {
        ...newestEvent,
        p_provider_event_id: `qa-tie-z-${runId}`,
        p_event_type: "RENEWAL",
        p_entitlement_label: "essential",
        p_product_code: "ESSENTIAL_M",
        p_plan_tier: "essential",
        p_payload_digest: `sha256:tie-z-${runId}`
      }
    }
  );
  assert(equalTimeHigherIdEvent.applied === true, "Deterministic equal-time winner was not applied.");
  const olderProviderEvent = await serviceRequest("/rest/v1/rpc/apply_entitlement_provider_event", {
    method: "POST",
    body: {
      ...newestEvent,
      p_provider_event_id: `qa-old-${runId}`,
      p_event_type: "RENEWAL",
      p_entitlement_label: "prime",
      p_product_code: "PRIME_M",
      p_plan_tier: "prime",
      p_provider_event_at: olderEventAt,
      p_payload_digest: `sha256:old-${runId}`
    }
  });
  assert(olderProviderEvent.applied === false, "Older provider replay replaced the current entitlement.");
  const currentEntitlement = await serviceSelectOne("account_entitlements", primary.id, "user_id");
  const providerEvents = await serviceSelect(
    "entitlement_provider_events",
    `user_id=eq.${primary.id}&select=provider_event_id,plan_tier&order=provider_event_at.asc`
  );
  assert(currentEntitlement.plan_tier === "essential", "Event ordering produced the wrong current plan.");
  assert(providerEvents.length === 3, `Expected three append-only provider events, found ${providerEvents.length}.`);
  pass("Provider ledger rejects digest conflicts and deterministically orders equal/stale events");

  const initialUser = await serviceSelectOne("users", primary.id);
  const initialBirth = await serviceSelectOne("birth_data", primary.id, "user_id");
  const initialProfile = await serviceSelectOne("ai_profiles", primary.id, "user_id");
  const initialChart = JSON.stringify(initialProfile.chart_json);

  await servicePatch("users", `id=eq.${primary.id}`, {
    display_name: "Saved QA Name",
    buddy_name: "Saved Lumis",
    persona_style: "spark",
    role: "spark"
  });
  await serviceDelete("monthly_balance", `user_id=eq.${primary.id}&grant_type=eq.starter_onboarding`);

  const repairRequest = {
    ...originalRequest,
    display_name: "Incoming Name Must Not Win",
    birth_date: "1999-09-09",
    birth_time: "09:09",
    place_name: "Incoming Place Must Not Win"
  };
  const repairedProfile = await invokeFunction("profile", primarySession.access_token, repairRequest);
  assert(repairedProfile.status === 200, `Legacy repair returned HTTP ${repairedProfile.status}.`);
  assert(repairedProfile.body.status === "profile_repaired", "Legacy profile was not repaired.");
  assert(!("chart_worker_contract" in repairedProfile.body), "Repair returned a Worker contract.");

  const repairedUser = await serviceSelectOne("users", primary.id);
  const repairedBirth = await serviceSelectOne("birth_data", primary.id, "user_id");
  const repairedAiProfile = await serviceSelectOne("ai_profiles", primary.id, "user_id");
  const grants = await serviceSelect(
    "monthly_balance",
    `user_id=eq.${primary.id}&grant_type=eq.starter_onboarding&select=id`
  );
  const histories = await serviceSelect(
    "birth_data_history",
    `user_id=eq.${primary.id}&status=eq.active&select=id,chart_version`
  );

  assert(repairedUser.display_name === "Saved QA Name", "Repair changed display_name.");
  assert(repairedUser.buddy_name === "Saved Lumis", "Repair changed buddy_name.");
  assert(repairedUser.persona_style === "spark", "Repair changed persona_style.");
  assert(repairedUser.role === "spark", "Repair changed role.");
  assert(repairedBirth.birth_date === initialBirth.birth_date, "Repair changed birth_date.");
  assert(repairedBirth.place_name === initialBirth.place_name, "Repair changed birthplace.");
  assert(JSON.stringify(repairedAiProfile.chart_json) === initialChart, "Repair changed the saved chart.");
  assert(grants.length === 1, `Expected one Starter grant, found ${grants.length}.`);
  assert(histories.length === 1, `Expected one active chart history, found ${histories.length}.`);
  assert(initialUser.id === repairedUser.id, "Repair changed the user identity.");
  pass("Missing-Starter repair preserves all saved user, birth, and chart data");

  const repairedHistory = await serviceSelectOne("birth_data_history", histories[0].id);
  await servicePatch("birth_data_history", `id=eq.${repairedHistory.id}`, {
    chart_json: {
      ...repairedHistory.chart_json,
      rawProviderResponse: { must_not_survive: true }
    }
  });
  const guardedHistory = await serviceSelectOne("birth_data_history", repairedHistory.id);
  assert(
    !containsKey(guardedHistory.chart_json, "rawProviderResponse"),
    "Database guard allowed rawProviderResponse into chart history."
  );
  await servicePatch("birth_data_history", `id=eq.${repairedHistory.id}`, {
    chart_json: repairedHistory.chart_json
  });
  pass("Database guard strips injected raw provider output from chart history");

  const chatOneClientId = crypto.randomUUID();
  const chatOneRequest = {
    message: "Tell me something supportive about my chart.",
    client_msg_id: chatOneClientId,
    persona_style: "spark",
    force_new_thread: true
  };
  const chatOne = await invokeFunction("chat-message", primarySession.access_token, chatOneRequest);
  assertSuccessfulNoChargeChat(chatOne);

  const replayedChatOne = await invokeFunction(
    "chat-message",
    primarySession.access_token,
    chatOneRequest
  );
  assertSuccessfulNoChargeChat(replayedChatOne);
  assert(replayedChatOne.body.duplicate === true, "Exact chat replay was not identified as a duplicate.");
  assert(replayedChatOne.body.thread_id === chatOne.body.thread_id, "Exact chat replay changed threads.");

  const changedContextReplay = await serviceRequest(
    "/rest/v1/rpc/persist_scaffold_chat_turn",
    {
      method: "POST",
      body: {
        p_user_id: primary.id,
        p_ai_profile_id: repairedAiProfile.id,
        p_chart_version: repairedAiProfile.chart_version,
        p_persona_style: "spark",
        p_route: "knowledge",
        p_title: "Changed replay context",
        p_user_message: chatOneRequest.message,
        p_assistant_message: "This must not replace the saved response.",
        p_force_new_thread: false,
        p_thread_id: chatOne.body.thread_id,
        p_client_msg_id: chatOneClientId
      }
    }
  );
  assert(changedContextReplay.ok === false, "Changed-context replay unexpectedly succeeded.");
  assert(
    changedContextReplay.error_code === "CHAT_IDEMPOTENCY_CONFLICT",
    "Changed-context replay did not return CHAT_IDEMPOTENCY_CONFLICT."
  );
  pass("Chat idempotency rejects reused IDs with changed route or thread intent");

  const chatTwo = await invokeFunction("chat-message", primarySession.access_token, {
    message: "Continue that reflection.",
    client_msg_id: crypto.randomUUID(),
    persona_style: "spark",
    force_new_thread: false
  });
  assertSuccessfulNoChargeChat(chatTwo);
  assert(chatTwo.body.thread_id === chatOne.body.thread_id, "Normal chat did not append to the thread.");

  const chatThree = await invokeFunction("chat-message", primarySession.access_token, {
    message: "Start a separate topic.",
    client_msg_id: crypto.randomUUID(),
    persona_style: "spark",
    force_new_thread: true
  });
  assertSuccessfulNoChargeChat(chatThree);
  assert(chatThree.body.thread_id !== chatOne.body.thread_id, "New topic reused the previous thread.");

  const threads = await serviceSelect("chat_threads", `user_id=eq.${primary.id}&select=id,chart_version`);
  const messages = await serviceSelect(
    "chat_messages",
    `user_id=eq.${primary.id}&select=id,thread_id,credits_cost,status`
  );
  assert(threads.length === 2, `Expected two chat threads, found ${threads.length}.`);
  assert(messages.length === 6, `Expected six chat messages, found ${messages.length}.`);
  assert(messages.every((message) => message.credits_cost === 0), "A scaffold message charged credits.");
  assert(messages.every((message) => message.status === "committed"), "A chat message was not committed.");
  pass("Chat appends, starts a new topic, suppresses exact replays, persists atomically, and charges zero credits");

  const threadCountBeforeInvalidRpc = threads.length;
  const invalidRpc = await serviceRequest("/rest/v1/rpc/persist_scaffold_chat_turn", {
    method: "POST",
    body: {
      p_user_id: primary.id,
      p_ai_profile_id: repairedAiProfile.id,
      p_chart_version: repairedAiProfile.chart_version,
      p_persona_style: "spark",
      p_route: "casual",
      p_title: "Invalid turn",
      p_user_message: "This must not persist",
      p_assistant_message: "",
      p_force_new_thread: true
    }
  });
  assert(invalidRpc.ok === false, "Invalid RPC input unexpectedly succeeded.");
  assert(invalidRpc.error_code === "CHAT_PERSISTENCE_INVALID_INPUT", "Invalid RPC returned wrong code.");
  const threadsAfterInvalidRpc = await serviceSelect("chat_threads", `user_id=eq.${primary.id}&select=id`);
  assert(threadsAfterInvalidRpc.length === threadCountBeforeInvalidRpc, "Invalid RPC left a partial thread.");
  pass("Invalid transactional chat turn leaves no partial thread");

  const crossUserRows = await Promise.all([
    userSelect(secondarySession.access_token, "birth_data", `user_id=eq.${primary.id}&select=user_id`),
    userSelect(secondarySession.access_token, "ai_profiles", `user_id=eq.${primary.id}&select=id`),
    userSelect(
      secondarySession.access_token,
      "birth_data_history",
      `user_id=eq.${primary.id}&select=id`
    )
  ]);
  assert(crossUserRows.every((rows) => rows.length === 0), "RLS exposed another user's chart data.");
  const protectedEntitlementResponse = await userRequest(
    secondarySession.access_token,
    `/rest/v1/account_entitlements?user_id=eq.${primary.id}&select=user_id`
  );
  assert(
    !protectedEntitlementResponse.ok && [401, 403].includes(protectedEntitlementResponse.status),
    "Protected entitlement storage was directly readable by an authenticated user."
  );

  const migrationReportsResponse = await userRequest(
    secondarySession.access_token,
    "/rest/v1/migration_reports?select=id&limit=1"
  );
  assert(!migrationReportsResponse.ok, "Authenticated user could read migration_reports.");

  const backendRpcResponse = await userRequest(
    secondarySession.access_token,
    "/rest/v1/rpc/complete_profile_onboarding",
    {
      method: "POST",
      body: {
        p_user_id: secondary.id,
        p_display_name: null,
        p_birth_date: "1986-02-20",
        p_birth_time: "16:55",
        p_time_unknown: false,
        p_place_name: "Hong Kong",
        p_country_code: "HK",
        p_lat: 22.3193,
        p_lng: 114.1694,
        p_tz_str: "Asia/Hong_Kong",
        p_role: null,
        p_chart_json: {},
        p_raw_chart_json: null,
        p_precision: "full",
        p_model: "unauthorized-test"
      }
    }
  );
  assert(!backendRpcResponse.ok, "Authenticated user could invoke backend-only onboarding RPC.");
  const crossUserPlanResponse = await userRequest(
    secondarySession.access_token,
    "/rest/v1/rpc/resolve_active_plan_tier",
    { method: "POST", body: { p_user_id: primary.id } }
  );
  assert(!crossUserPlanResponse.ok, "Authenticated user resolved another account's plan.");
  pass("RLS and grants block cross-user chart data, migration reports, and backend-only RPCs");

  await servicePatch("ai_profiles", `id=eq.${repairedAiProfile.id}`, { is_active: false });
  const noActiveProfileChat = await invokeFunction("chat-message", primarySession.access_token, {
    message: "This should not persist without an active chart.",
    force_new_thread: true
  });
  assert(noActiveProfileChat.status === 200, "Inactive-profile chat did not return safely.");
  assert(noActiveProfileChat.body.thread_id === null, "Inactive-profile chat persisted a thread.");
  assert(
    noActiveProfileChat.body.persistence_error === "ACTIVE_PROFILE_REQUIRED",
    "Inactive-profile chat returned the wrong safe error."
  );
  pass("Chat fails safely when no active profile exists");

  await servicePatch("ai_profiles", `id=eq.${repairedAiProfile.id}`, { is_active: true });
  const restoredSession = await signIn(primary.email, password);
  const restoredProfiles = await userSelect(
    restoredSession.access_token,
    "ai_profiles",
    `user_id=eq.${primary.id}&select=id,chart_version`
  );
  const restoredThreads = await userSelect(
    restoredSession.access_token,
    "chat_threads",
    `user_id=eq.${primary.id}&select=id,chart_version`
  );
  assert(restoredProfiles.length === 1, "Same-email sign-in could not read the saved profile.");
  assert(restoredThreads.length === 2, "Same-email sign-in could not read saved reflections.");
  pass("Same-email sign-in can reload the saved profile and Past Reflections");

  const chartExportEvents = await serviceSelect(
    "external_sync_events",
    `user_id=eq.${primary.id}&destination=eq.salesforce_case&select=event_id,idempotency_key,payload_json&order=created_at.asc`
  );
  assert(chartExportEvents.length === 1, "Expected one Salesforce chart-export event before deletion.");
  const inFlightEvent = chartExportEvents[0];
  await servicePatch("external_sync_events", `event_id=eq.${inFlightEvent.event_id}`, {
    status: "processing",
    attempt_count: 1,
    last_attempt_at: new Date().toISOString()
  });

  const [deletionRequest, lateCompletion] = await Promise.all([
    invokeFunction("account-deletion-request", restoredSession.access_token, {
      confirmation: "DELETE MY LUMIS ACCOUNT"
    }),
    new Promise((resolve) => setTimeout(resolve, 25)).then(() =>
      serviceRequest("/rest/v1/rpc/complete_external_sync_event", {
        method: "POST",
        body: {
          p_event_id: inFlightEvent.event_id,
          p_delivered: true,
          p_external_record_id: "case-created-during-deletion",
          p_error_code: null
        }
      })
    )
  ]);
  assert(deletionRequest.status === 202, `Deletion request returned HTTP ${deletionRequest.status}.`);
  assert(lateCompletion.ok === true, "Late in-flight completion was not recorded.");

  const deletionEvents = await serviceSelect(
    "external_sync_events",
    `user_id=eq.${primary.id}&payload_json->>operation=eq.account_deletion&select=destination,idempotency_key,payload_json`
  );
  assert(deletionEvents.length === 2, `Expected two deletion events, found ${deletionEvents.length}.`);
  const salesforceDeletion = deletionEvents.find((event) => event.destination === "salesforce_case");
  assert(
    salesforceDeletion?.payload_json?.salesforce_case_ids?.includes("case-created-during-deletion"),
    "Deletion cleanup omitted the late Salesforce Case ID."
  );
  assert(
    salesforceDeletion?.payload_json?.salesforce_case_subjects?.includes(
      `LUMIS-${inFlightEvent.payload_json.request_id}`
    ),
    "Deletion cleanup omitted deterministic Salesforce Case discovery."
  );
  assert(!containsKey(deletionEvents, "email_hash"), "Deletion events retained an email hash.");

  await serviceRequest("/rest/v1/external_sync_events", {
    method: "POST",
    prefer: "return=representation",
    body: {
      user_id: primary.id,
      destination: "google_sheet",
      idempotency_key: `lumis:post-deletion-export:${runId}`,
      payload_json: { operation: "chart_generation", request_id: `blocked-${runId}` }
    }
  });
  const blockedExports = await serviceSelect(
    "external_sync_events",
    `idempotency_key=eq.lumis:post-deletion-export:${runId}&select=event_id`
  );
  assert(blockedExports.length === 0, "A new chart export was accepted after deletion began.");
  pass("Deletion race captures late Case IDs, rediscovers deterministic Cases, and blocks new exports");

  const abandonedEventId = crypto.randomUUID();
  await serviceRequest("/rest/v1/external_sync_events", {
    method: "POST",
    prefer: "return=minimal",
    body: {
      event_id: abandonedEventId,
      user_id: secondary.id,
      destination: "salesforce_case",
      idempotency_key: `lumis:abandoned-claim:${runId}`,
      status: "processing",
      attempt_count: 1,
      last_attempt_at: new Date(Date.now() - 16 * 60 * 1000).toISOString(),
      payload_json: {
        operation: "chart_generation",
        request_id: `abandoned-${runId}`,
        user_id: secondary.id
      }
    }
  });
  const recentSecondarySession = await signIn(secondary.email, password);
  const abandonedDeletion = await invokeFunction(
    "account-deletion-request",
    recentSecondarySession.access_token,
    { confirmation: "DELETE MY LUMIS ACCOUNT" }
  );
  assert(abandonedDeletion.status === 202, "Abandoned-claim deletion request was rejected.");
  await serviceRequest("/rest/v1/rpc/claim_external_sync_events", {
    method: "POST",
    body: { p_limit: 20 }
  });

  const recoveredAbandoned = await serviceSelectOne("external_sync_events", abandonedEventId, "event_id");
  assert(
    recoveredAbandoned.status === "cancelled_due_to_deletion",
    `Abandoned claim remained ${recoveredAbandoned.status}.`
  );
  assert(
    recoveredAbandoned.last_error === "DELETION_STALE_CLAIM_CANCELLED",
    "Abandoned claim did not retain the bounded lease error."
  );
  const abandonedCleanupEvents = await serviceSelect(
    "external_sync_events",
    `user_id=eq.${secondary.id}&payload_json->>operation=eq.account_deletion&select=event_id`
  );
  assert(abandonedCleanupEvents.length === 2, "Abandoned claim did not queue deletion cleanup.");
  pass("Abandoned Worker claim expires after 15 minutes and queues deterministic deletion cleanup");

  const expiredClaimEventId = crypto.randomUUID();
  const expiredReplayEventId = crypto.randomUUID();
  const expiredAt = new Date(Date.now() - 60_000).toISOString();
  await serviceRequest("/rest/v1/external_sync_events", {
    method: "POST",
    prefer: "return=minimal",
    body: [
      {
        event_id: expiredClaimEventId,
        user_id: secondary.id,
        destination: "google_sheet",
        idempotency_key: `lumis:expired-claim:${runId}`,
        status: "pending",
        next_retry_at: new Date(Date.now() - 120_000).toISOString(),
        payload_expires_at: expiredAt,
        payload_json: {
          operation: "account_deletion",
          request_id: `expired-claim-${runId}`,
          email: "must-redact@example.com",
          name: "Must redact",
          paid_amount: 98,
          marketing_consent: true,
          chart_url: "https://private.example/chart",
          plan: "prime"
        }
      },
      {
        event_id: expiredReplayEventId,
        user_id: secondary.id,
        destination: "salesforce_case",
        idempotency_key: `lumis:expired-replay:${runId}`,
        status: "failed_final",
        next_retry_at: null,
        payload_expires_at: expiredAt,
        payload_json: {
          operation: "account_deletion",
          request_id: `expired-replay-${runId}`,
          email: "must-redact@example.com",
          name: "Must redact",
          paid_amount: 98,
          marketing_consent: true,
          chart_url: "https://private.example/chart",
          plan: "prime"
        }
      }
    ]
  });
  const claimedAfterExpiry = await serviceRequest("/rest/v1/rpc/claim_external_sync_events", {
    method: "POST",
    body: { p_limit: 20 }
  });
  assert(
    !claimedAfterExpiry.some((event) => event.event_id === expiredClaimEventId),
    "Expired payload was returned for delivery."
  );
  const replayAfterExpiry = await serviceRequest("/rest/v1/rpc/replay_external_sync_event", {
    method: "POST",
    body: { p_event_id: expiredReplayEventId }
  });
  assert(replayAfterExpiry.ok === false, "Expired payload was accepted for manual replay.");
  assert(replayAfterExpiry.error_code === "SYNC_PAYLOAD_EXPIRED", "Expired replay returned the wrong safe code.");
  const expiredRows = await serviceSelect(
    "external_sync_events",
    `event_id=in.(${expiredClaimEventId},${expiredReplayEventId})&select=status,last_error,payload_json,payload_redacted_at`
  );
  assert(expiredRows.length === 2, "Expired retention fixtures were not retained as operational metadata.");
  assert(
    expiredRows.every((event) =>
      event.status === "failed_final" &&
      event.last_error === "SYNC_PAYLOAD_EXPIRED" &&
      event.payload_redacted_at &&
      !event.payload_json.email &&
      !event.payload_json.name &&
      !event.payload_json.paid_amount &&
      !event.payload_json.marketing_consent &&
      !event.payload_json.chart_url &&
      !event.payload_json.plan &&
      event.payload_json.operation === "account_deletion" &&
      event.payload_json.request_id
    ),
    "Expired external-sync PII survived claim or replay."
  );
  pass("Expired external-sync payloads redact immediately and cannot be claimed or replayed");

  console.log(JSON.stringify({ ok: true, checks: results }, null, 2));
} finally {
  for (const userId of createdUserIds) {
    await cleanupUser(userId).catch((error) => {
      console.error(`Cleanup failed for disposable user ${userId}:`, safeError(error));
    });
  }
}

async function verifyTrustedBirthLocationResolver() {
  const endpoint = "/rest/v1/rpc/resolve_trusted_birth_location";
  const hongKong = await serviceRequest(endpoint, {
    method: "POST",
    body: {
      p_place_name: "Hong Kong",
      p_country_code: "HK",
      p_lat: 22.3193,
      p_lng: 114.1694
    }
  });
  assert(hongKong?.tz_str === "Asia/Hong_Kong", "Trusted resolver returned the wrong Hong Kong timezone.");

  const spoofedCountry = await serviceRequest(endpoint, {
    method: "POST",
    body: {
      p_place_name: "Hong Kong",
      p_country_code: "US",
      p_lat: 22.3193,
      p_lng: 114.1694
    }
  });
  assert(spoofedCountry == null, "Trusted resolver accepted a mismatched country.");

  const spoofedCoordinates = await serviceRequest(endpoint, {
    method: "POST",
    body: {
      p_place_name: "Hong Kong",
      p_country_code: "HK",
      p_lat: 40.7128,
      p_lng: -74.006
    }
  });
  assert(spoofedCoordinates == null, "Trusted resolver accepted mismatched coordinates.");

  const anonymous = await fetch(`${supabaseUrl}${endpoint}`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      p_place_name: "Hong Kong",
      p_country_code: "HK",
      p_lat: 22.3193,
      p_lng: 114.1694
    })
  });
  assert(!anonymous.ok, "Anonymous caller reached the trusted birthplace resolver.");
  pass("Backend-owned birthplace resolver rejects client timezone and mismatched location data");
}

async function verifyBirthDetailsChangeDeployment() {
  const result = await serviceRequestResult("/rest/v1/rpc/reserve_birth_details_change", {
    method: "POST",
    body: {
      p_user_id: crypto.randomUUID(),
      p_request_id: crypto.randomUUID(),
      p_request_digest: "0".repeat(64)
    }
  });

  assert(
    result.ok && result.body?.ok === false && result.body?.error_code === "49002",
    `Migration 0026 is not ready in staging: ${safeError(result.body)}.`
  );
  pass("Birth-detail regeneration RPCs are deployed before hosted profile testing");
}

async function verifyRuntimeMonitoringAndSchedules() {
  const scheduler = await serviceRequest("/rest/v1/rpc/runtime_scheduler_status", {
    method: "POST",
    body: {}
  });
  assert(scheduler.all_configured === true, "One or more required runtime cron jobs are missing, inactive, or mis-scheduled.");
  assert(Array.isArray(scheduler.jobs) && scheduler.jobs.length === 3, "Runtime scheduler status did not return three jobs.");
  assert(
    scheduler.jobs.every((job) => job.active === true && job.schedule === job.expected_schedule),
    "Runtime scheduler configuration differs from the expected schedule."
  );
  assert(scheduler.all_have_successful_run === true, "One or more runtime cron jobs have no successful execution evidence.");

  const health = await serviceRequest("/rest/v1/rpc/runtime_health_snapshot", {
    method: "POST",
    body: {}
  });
  for (const metric of [
    "request_failures_24h",
    "rate_limit_rejections_24h",
    "provider_calls_pending_review",
    "provider_calls_24h",
    "external_sync_failed_final",
    "open_alerts"
  ]) {
    assert(Number.isFinite(Number(health[metric])), `Runtime health metric ${metric} is missing or invalid.`);
  }

  const alertCount = await serviceRequest("/rest/v1/rpc/evaluate_runtime_alerts", {
    method: "POST",
    body: {}
  });
  assert(Number.isInteger(alertCount) && alertCount >= 0, "Runtime alert evaluation returned an invalid count.");

  const retention = await serviceRequest("/rest/v1/rpc/purge_runtime_operational_data", {
    method: "POST",
    body: {}
  });
  for (const field of ["rate_windows_deleted", "request_events_deleted", "provider_events_deleted"]) {
    assert(Number.isInteger(retention[field]) && retention[field] >= 0, `Runtime retention result ${field} is invalid.`);
  }

  const report = await serviceRequest("/rest/v1/rpc/create_external_sync_daily_report", {
    method: "POST",
    body: {}
  });
  assert(report && typeof report === "object", "External-sync daily report did not return an operational summary.");
  pass("Runtime health, alerts, retention, daily report, and all three pg_cron jobs have hosted evidence");
}

async function auditExistingChartVersionInvariants() {
  const [birthRows, profiles, histories] = await Promise.all([
    serviceSelect("birth_data", "select=user_id,active_chart_version"),
    serviceSelect(
      "ai_profiles",
      "select=id,user_id,chart_version,is_active,birth_data_history_id,chart_json"
    ),
    serviceSelect(
      "birth_data_history",
      "select=id,user_id,chart_version,status,ai_profile_id,chart_json"
    )
  ]);
  const birthByUser = new Map(birthRows.map((row) => [row.user_id, row]));
  const chartUsers = new Set(profiles.map((profile) => profile.user_id));

  for (const userId of chartUsers) {
    const userProfiles = profiles.filter((profile) => profile.user_id === userId);
    const activeProfiles = userProfiles.filter((profile) => profile.is_active === true);
    const activeHistories = histories.filter(
      (history) => history.user_id === userId && history.status === "active"
    );
    assert(activeProfiles.length === 1, "An existing chart user does not have exactly one active profile.");
    assert(activeHistories.length === 1, "An existing chart user does not have exactly one active history.");

    const activeProfile = activeProfiles[0];
    const activeHistory = activeHistories[0];
    const birth = birthByUser.get(userId);
    assert(birth, "An existing chart user has no birth_data row.");
    assert(
      activeProfile.chart_version === activeHistory.chart_version &&
        birth.active_chart_version === activeProfile.chart_version,
      "An existing chart user's active chart versions do not match."
    );
    assert(
      activeProfile.birth_data_history_id === activeHistory.id,
      "An active profile does not point to its active history."
    );
    assert(!containsKey(activeProfile.chart_json, "rawProviderResponse"), "AI profile exposes raw provider output.");
    assert(!containsKey(activeHistory.chart_json, "rawProviderResponse"), "Chart history exposes raw provider output.");
  }

  pass(`Existing chart-version invariants pass for ${chartUsers.size} staging user(s)`);
}

function pass(name) {
  results.push(name);
}

function assertSuccessfulNoChargeChat(result) {
  assert(result.status === 200, `Chat returned HTTP ${result.status}.`);
  assert(result.body.thread_id, "Chat did not return a persisted thread.");
  assert(result.body.persistence_mode === "supabase_scaffold", "Chat was not persisted in scaffold mode.");
  assert(result.body.billing_mode === "scaffold_no_charge", "Chat billing mode was not scaffold_no_charge.");
  assert(result.body.credits_charged === 0, "Chat charged credits.");
  assert(result.body.remaining_credits === null, "Chat exposed an authoritative scaffold balance.");
}

async function createConfirmedUser(email, userPassword) {
  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: serviceHeaders(),
    body: JSON.stringify({ email, password: userPassword, email_confirm: true })
  });
  const body = await response.json();
  assert(response.ok, `Unable to create disposable Auth user: ${body.message ?? response.status}.`);
  return { id: body.id, email };
}

async function signIn(email, userPassword) {
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password: userPassword })
  });
  const body = await response.json();
  assert(response.ok, `Unable to sign in disposable user: ${body.error_description ?? response.status}.`);
  return body;
}

async function invokeFunction(name, accessToken, body) {
  const response = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  return { status: response.status, body: await response.json() };
}

async function serviceSelectOne(table, id, key = "id") {
  const rows = await serviceSelect(table, `${key}=eq.${id}&select=*`);
  assert(rows.length === 1, `Expected one ${table} row, found ${rows.length}.`);
  return rows[0];
}

async function serviceSelect(table, query) {
  return serviceRequest(`/rest/v1/${table}?${query}`);
}

async function userSelect(accessToken, table, query) {
  const response = await userRequest(accessToken, `/rest/v1/${table}?${query}`);
  assert(response.ok, `User query for ${table} failed with HTTP ${response.status}.`);
  return response.body;
}

async function userRequest(accessToken, path, options = {}) {
  const response = await fetch(`${supabaseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options.prefer ? { Prefer: options.prefer } : {})
    },
    body: options.body == null ? undefined : JSON.stringify(options.body)
  });
  const text = await response.text();
  return { ok: response.ok, status: response.status, body: text ? JSON.parse(text) : null };
}

async function servicePatch(table, query, body) {
  await serviceRequest(`/rest/v1/${table}?${query}`, {
    method: "PATCH",
    body,
    prefer: "return=minimal"
  });
}

async function serviceDelete(table, query) {
  await serviceRequest(`/rest/v1/${table}?${query}`, {
    method: "DELETE",
    prefer: "return=minimal"
  });
}

async function serviceRequest(path, options = {}) {
  const result = await serviceRequestResult(path, options);
  assert(result.ok, `Service request ${path} failed with HTTP ${result.status}: ${safeError(result.body)}.`);
  return result.body;
}

async function serviceRequestResult(path, options = {}) {
  const maxClockSkewAttempts = 7;

  for (let attempt = 1; attempt <= maxClockSkewAttempts; attempt += 1) {
    const response = await fetch(`${supabaseUrl}${path}`, {
      method: options.method ?? "GET",
      headers: {
        ...serviceHeaders(),
        ...(options.prefer ? { Prefer: options.prefer } : {})
      },
      body: options.body == null ? undefined : JSON.stringify(options.body)
    });
    const text = await response.text();
    const body = text ? JSON.parse(text) : null;

    if (isFutureIssuedJwtResponse(response.status, body) && attempt < maxClockSkewAttempts) {
      console.warn(`Supabase secret-key clock propagation is pending; retrying in 5 seconds (${attempt}/${maxClockSkewAttempts - 1}).`);
      await new Promise((resolve) => setTimeout(resolve, 5_000));
      continue;
    }

    return { ok: response.ok, status: response.status, body };
  }

  throw new Error("Supabase secret-key clock propagation retry loop ended unexpectedly.");
}

function isFutureIssuedJwtResponse(status, body) {
  return status === 401 && body?.code === "PGRST303" && /JWT issued at future/i.test(String(body?.message));
}

async function cleanupUser(userId) {
  await serviceDelete("external_sync_events", `user_id=eq.${userId}`);
  await serviceDelete("account_deletion_requests", `user_id=eq.${userId}`);
  await serviceDelete("users", `id=eq.${userId}`);
  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    method: "DELETE",
    headers: serviceHeaders()
  });
  assert(response.ok, `Unable to delete disposable Auth user ${userId}.`);
}

function serviceHeaders() {
  return {
    apikey: secretKey,
    "Content-Type": "application/json"
  };
}

function requireSecretKey() {
  const value = requireEnvironment("SUPABASE_SECRET_KEY");
  if (!value.startsWith("sb_secret_")) {
    throw new Error("SUPABASE_SECRET_KEY must be a separately revocable sb_secret_ key, not a legacy service_role JWT.");
  }
  return value;
}

function containsKey(value, target) {
  if (!value || typeof value !== "object") return false;
  if (Object.prototype.hasOwnProperty.call(value, target)) return true;
  return Object.values(value).some((child) => containsKey(child, target));
}

function requireEnvironment(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for the staging backend smoke test.`);
  return value;
}

function safeError(value) {
  if (value instanceof Error) return value.message;
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
