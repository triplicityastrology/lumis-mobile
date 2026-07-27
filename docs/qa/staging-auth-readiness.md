# Staging Auth Test Readiness

This is a staging-only readiness check. It does not generate magic links,
authenticate a user, call Supabase, or change the Auth dashboard.

Real PKCE QA must begin inside Lumis. The mobile client calls normal
`signInWithOtp`, stores its own PKCE verifier, and later exchanges the matching
callback code. An Admin-generated link cannot replace this client-originated
flow.

## Check The Staging Dashboard

Open the staging Supabase project:

1. Confirm the project reference is `bmqhwofmdgebpcihjlnb`.
2. Open **Authentication → URL Configuration**.
3. Note the current **Site URL**.
4. Note every mobile **Redirect URL** used for this test. Expected shapes are:
   - `exp://<device-reachable-host>:<port>/--/auth/callback`
   - `exps://<approved-development-host>/--/auth/callback`
   - `lumis://auth/callback` for an approved development build
5. Reject `localhost` or `127.0.0.1` Expo callbacks for physical-phone QA.
6. Open **Authentication → Email / SMTP settings**.
7. Confirm whether the project uses **Custom SMTP** or Supabase's built-in
   email provider. Do not copy SMTP passwords into Terminal or evidence.

The built-in provider has the current project testing limit of two messages per
hour. Repeated founder QA therefore requires a dedicated staging SMTP provider.

## Run The Readiness Check

The Site URL and redirect allow-list are configuration values, not credentials.
They are entered temporarily and are not echoed by the checker.

Choose `custom` only when the staging dashboard visibly confirms custom SMTP.
Otherwise choose `builtin`.

```zsh
(
cd "/Users/rubyku/Documents/Mobile App/lumis-mobile-s1t04-work"
IFS= read -r "LUMIS_STAGING_AUTH_SITE_URL?Paste the staging Auth Site URL, then press Return: "
IFS= read -r "LUMIS_STAGING_AUTH_REDIRECT_URLS?Paste the comma-separated mobile Redirect URLs, then press Return: "
IFS= read -r "LUMIS_STAGING_SMTP_MODE?Enter custom or builtin exactly as shown in the staging dashboard: "
export LUMIS_STAGING_AUTH_SITE_URL
export LUMIS_STAGING_AUTH_REDIRECT_URLS
PATH="/Users/rubyku/.local/node22/bin:$PATH" "/Users/rubyku/.local/node22/bin/pnpm" staging:auth-readiness -- --project-ref bmqhwofmdgebpcihjlnb --smtp-mode "$LUMIS_STAGING_SMTP_MODE"
unset LUMIS_STAGING_AUTH_SITE_URL
unset LUMIS_STAGING_AUTH_REDIRECT_URLS
unset LUMIS_STAGING_SMTP_MODE
)
```

The checker verifies:

- the explicit project is Lumis staging;
- `apps/mobile/.env` points to the same staging project;
- the Supabase CLI link matches staging when a local link marker exists;
- Site URL and every mobile callback have supported shapes;
- SMTP status was explicitly confirmed from the dashboard.

It prints only readiness categories and the number of callback shapes. It never
prints the URLs themselves.

## Configure Dedicated Staging SMTP Later

Once the founder selects an SMTP provider:

1. Create a sender identity dedicated to Lumis staging.
2. In the staging Supabase dashboard, open **Authentication → Email / SMTP**.
3. Enable custom SMTP and enter the provider host, port, username, password,
   sender address, and sender name directly in the dashboard.
4. Do not paste SMTP credentials into Codex, Terminal commands, `.env`, Expo
   public variables, screenshots, or QA evidence.
5. Save the staging dashboard configuration.
6. Reopen the page and confirm it reports custom SMTP without exposing the
   password.
7. Run the readiness check above with `custom`.
8. Start a fresh test from Lumis by entering the staging test email and using
   the app's normal **Send secure link** action.
9. Open the received link once and verify the real PKCE session restoration.

This runbook does not authorize production SMTP changes. Roll back an SMTP test
by disabling custom SMTP in the staging dashboard and confirming `builtin` with
the readiness checker.
