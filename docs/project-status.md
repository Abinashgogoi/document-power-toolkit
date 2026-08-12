# Document Power Toolkit — Milestone 3 Status

## Production architecture
- **GitHub:** source of truth, CI/build automation, Releases for mobile/desktop artifacts, and deployment trigger.
- **Cloudflare:** production Web/PWA hosting and edge delivery.
- **Supabase:** Auth, profiles, approval state, devices, safe metadata history, diagnostics, feedback, feature flags, and admin audit.
- **Local clients:** document contents remain local by default. PDFs/images are not uploaded by default.
- **ChatGPT hosting:** not part of the production architecture; it was a temporary testing host only.

## Supabase
- Dedicated project: `document power toolkit`
- Project ref: `pwzwvrlcjxgkblawtrkb`
- Core schema deployed with RLS.
- Realtime control tables: `profiles`, `devices`, `feature_flags`.
- Security advisor: clean at the latest verification checkpoint.
- Frontend integration source is present under `src/backend/supabase/`.

## GitHub target
- Repository: `Abinashgogoi/document-power-toolkit`
- Branch: `main`
- Direct-push fallback is documented in `docs/GITHUB_DIRECT_PUSH_RUNBOOK.md`.

## Cloudflare target
- Project name: `document-power-toolkit`
- Configure production environment variables from `.env.example` after GitHub upload.

## Next verification sequence
1. Upload/import this source into the GitHub repository.
2. Let GitHub Actions install dependencies and run the full verification suite.
3. Configure Cloudflare GitHub deployment and production Vite environment variables.
4. Verify the deployed Web/PWA can sign up/sign in against the dedicated Supabase project.
5. Bootstrap the first super-admin and verify pending → approved and device trust flows.
6. Verify Realtime, offline behavior, metadata history, diagnostics, and feedback.
