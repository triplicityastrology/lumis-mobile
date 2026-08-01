# Founder current-build Expo handoff

From the active Lumis repository, run:

```bash
cd "/Users/rubyku/Documents/Mobile App/lumis-mobile-s1t04-work"
PATH="/Users/rubyku/.local/node22/bin:$PATH" pnpm start:normal-expo
```

Before scanning the new QR code, confirm Terminal prints one
`LUMIS_CURRENT_BUILD` line with `app=normal` and `tracked_tree=clean`. Keep that
Terminal open while testing. In Expo Go, use the QR code from this run only;
do not reopen a previous project from Recents. Stop Metro with Control+C in the
same Terminal.

The launcher uses tunnel mode, clears Metro's cache, and refuses to stop or
replace a process already using port 8081. To select the other approved port,
run the same command with `LUMIS_EXPO_PORT=8082` before `pnpm`.
