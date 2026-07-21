-- MANUAL STAGING ACTIVATION ONLY.
-- Run after EXTERNAL_SYNC_ENABLED, staging Salesforce/Google credentials, and
-- EXTERNAL_SYNC_CRON_SECRET have passed QA. Do not put the secret in this file.
-- The authenticated HTTP schedule should be created from the Supabase Dashboard
-- using the Edge Function scheduler so its secret remains in Vault.

-- Hourly request:
--   Function: external-sync-retry
--   Schedule: 0 * * * *
--   Method: POST
--   Body: {}
--   Header from Vault: X-Lumis-Cron-Secret

-- Daily report is already database-local via migration 0021. Do not create a
-- second daily Edge invocation unless operations deliberately replaces it.
