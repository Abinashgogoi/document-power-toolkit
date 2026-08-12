# Milestone 3 — Supabase integration status

Target Supabase project: `document power toolkit` (`pwzwvrlcjxgkblawtrkb`)

## Completed
- Dedicated project identity verified; ESHANTVA Studio remains isolated.
- Core tables deployed: profiles, devices, operation_history, diagnostics, feedback, feature_flags, admin_audit_log.
- RLS enabled on all exposed tables.
- New-auth-user profile trigger deployed.
- Protected profile/device fields guarded at database level.
- Admin changes to account state, device trust, feedback status, and feature flags are audit-triggered.
- Realtime publication enabled only for profiles, devices, and feature_flags.
- Supabase security advisor reports zero findings after hardening.
- Frontend integration source layer added under `src/backend/supabase/`.
- Local profile now carries a separate UUID cloud device identity while preserving the existing human-readable local device ID.
- Account drawer source updated for sign-up, sign-in, sign-out, cloud status, device identity, and approved-only metadata sync toggles.
- Operation history source prepared to sync safe metadata only after approval and explicit user opt-in.
- Dedicated `.env.local` created for local integration testing; it is excluded by `.gitignore`.

## Pending
- Resolve/install pinned `@supabase/supabase-js` and regenerate `package-lock.json`.
- Run TypeScript, unit, OCR, build, and browser smoke gates with the real SDK installed.
- Perform a real sign-up/sign-in test against Supabase Auth.
- Bootstrap the first approved super-admin after a real account exists.
- Verify pending -> approved Realtime transition end-to-end.
- Verify device registration/trust transition end-to-end.
- Add offline retry queue for cloud history/diagnostic metadata.
- Connect diagnostics opt-in to actual safe error reporting.
- Add feedback submission UI and verify status workflow.
- Synchronize repository migration files exactly with remote migration history before GitHub push.

## Current blocker
The execution sandbox cannot resolve external npm hosts and its system npm registry is malformed (`https:///`). The source integration is prepared, but dependency/lockfile installation and runtime build verification must not be claimed complete until package resolution is available.
