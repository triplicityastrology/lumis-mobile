# Staging Magic-Link QA Helper

This terminal-only helper is for the Lumis staging project. It uses Supabase
Admin `generateLink` to create one test link without using the built-in email
sender. It does not change Auth settings, send email, or alter production.

The link is a real, one-time authentication credential. The helper sends it
directly to the local macOS clipboard and never prints or stores it.

## Before Running

- Run only from the Lumis staging repository.
- Use a disposable staging test account and an inbox you control.
- Use the dedicated staging admin/service-role secret. Never use a production
  key or place this value in `.env`, Expo variables, source files, screenshots,
  notes, or shell history.
- Start Expo Go first. Build the redirect from the active Expo URL:
  `exp://<device-reachable-host>:<port>/--/auth/callback`.
- A tunnel host such as an Expo development host is accepted. `localhost` and
  `127.0.0.1` are rejected because an iPhone cannot return through the Mac's
  local loopback address.
- A development build may use `lumis://auth/callback`.

## Safe Dry Run

This validates the staging project, test email, and callback shape. It does not
ask for an admin key and makes no network request.

```zsh
(
cd "/Users/rubyku/Documents/Mobile App/lumis-mobile-s1t04-work"
IFS= read -r -s "LUMIS_STAGING_QA_EMAIL?Enter the staging test email, then press Return: "
echo
IFS= read -r "LUMIS_STAGING_QA_REDIRECT_URL?Paste the Expo callback URL, then press Return: "
export LUMIS_STAGING_QA_EMAIL
export LUMIS_STAGING_QA_REDIRECT_URL
PATH="/Users/rubyku/.local/node22/bin:$PATH" "/Users/rubyku/.local/node22/bin/pnpm" staging:magic-link -- --project-ref bmqhwofmdgebpcihjlnb --dry-run
unset LUMIS_STAGING_QA_EMAIL
unset LUMIS_STAGING_QA_REDIRECT_URL
)
```

## Generate One Staging Link

Do not run this until the current authentication repair is approved.

```zsh
(
cd "/Users/rubyku/Documents/Mobile App/lumis-mobile-s1t04-work"
IFS= read -r -s "LUMIS_STAGING_QA_EMAIL?Enter the staging test email, then press Return: "
echo
IFS= read -r "LUMIS_STAGING_QA_REDIRECT_URL?Paste the Expo callback URL, then press Return: "
IFS= read -r -s "SUPABASE_SERVICE_ROLE_KEY?Paste the dedicated staging admin key, then press Return: "
echo
export LUMIS_STAGING_QA_EMAIL
export LUMIS_STAGING_QA_REDIRECT_URL
export SUPABASE_SERVICE_ROLE_KEY
PATH="/Users/rubyku/.local/node22/bin:$PATH" "/Users/rubyku/.local/node22/bin/pnpm" staging:magic-link -- --project-ref bmqhwofmdgebpcihjlnb
unset LUMIS_STAGING_QA_EMAIL
unset LUMIS_STAGING_QA_REDIRECT_URL
unset SUPABASE_SERVICE_ROLE_KEY
)
```

When the success message appears, the one-time link is on the Mac clipboard.
Use Universal Clipboard or another private local handoff to paste it into the
test iPhone browser. Do not paste it into chat, issue trackers, screenshots, or
shared notes.

The link works once. Generate a new link for another test. This helper does not
disable normal verification, create a demo account, or bypass Supabase.

## Cleanup

After the test:

1. Clear the clipboard:

   ```zsh
   printf '' | pbcopy
   ```

2. Close the private browser tab containing the used link.
3. Sign out through Lumis when the test requires it.
4. Remove disposable staging users later through the approved hosted-QA cleanup
   process. The helper itself creates no database records beyond normal
   Supabase authentication activity.

If any guard fails, the helper exits without generating or revealing a link.
