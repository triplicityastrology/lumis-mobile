# S2-T96 Normal Expo Care Circle founder entry

## Boundary

The Care Circle staging test is reachable only from the development Founder Test Hub. It is absent from normal member navigation and remains blocked unless all of these are true:

- Expo is a development build.
- `EXPO_PUBLIC_CARE_CIRCLE_STAGING_WORKBENCH=1`.
- `EXPO_PUBLIC_SUPABASE_PROJECT_REF=bmqhwofmdgebpcihjlnb`.
- `EXPO_PUBLIC_SUPABASE_URL` is exactly the approved HTTPS staging origin.
- the normal staging public client key is configured;
- `EXPO_PUBLIC_CARE_CIRCLE_STAGING_DEPLOYMENT_READY=1` is set only after the reviewed inactive function deployment is verified.

If any check fails, the screen shows a safe Not Ready reason and constructs no Supabase workbench ports.

## Future launch after function deployment

From the repository root, use the existing normal Expo server:

```bash
EXPO_PUBLIC_CARE_CIRCLE_STAGING_WORKBENCH=1 \
EXPO_PUBLIC_CARE_CIRCLE_STAGING_DEPLOYMENT_READY=1 \
EXPO_PUBLIC_SUPABASE_PROJECT_REF=bmqhwofmdgebpcihjlnb \
pnpm start:normal-expo
```

Do not set the deployment-ready flag before the inactive `care-circle` function version and required configuration names are verified.

## One-iPhone disposable-account journey

1. Open **Founder tests** -> **Care Circle staging test**.
2. Sign in as the disposable Caree and create the reusable one-hour pairing code.
3. Choose **Switch account**, sign in as the disposable Carer, submit the code, and verify **Pending Caree acceptance · no authority**.
4. Switch to the Caree, refresh pending requests, and accept the Carer.
5. Switch to the Carer and refresh until the participant-safe projection confirms **Active**.
6. Switch to the Caree, pause, verify **Paused**, resume, and verify **Active**.
7. Switch to the Carer, choose **Remove myself**, and verify **Removed**.
8. Sign out and complete the approved operator cleanup. Do not claim cleanup until the separate run-scoped account and relationship counts are zero.

Only safe evidence-state names and pass/fail results may be retained. Never capture credentials or pairing material.
