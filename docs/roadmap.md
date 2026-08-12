# Roadmap

## Milestone 1 — Local workstation core

Working PWA, PDF preview, page operations, conversion, target compression, verification, local history, CI, and offline build.

## Milestone 2 — Scalable local workstation

Categorized 20-tool library, real sequential merge flow, additional page/edit/inspect operations, bundled English/Hindi/Assamese OCR, basic signature-integrity inspection, and local account/device settings.

## Milestone 3 — Dedicated account infrastructure

Create an isolated Supabase project, apply and test RLS migration, add email setup flow, account approval, TOTP MFA, device sessions, feedback, and diagnostics metadata.

## Milestone 4 — Native desktop core

Add a signed desktop shell, streaming large-file pipeline, searchable OCR for English/Hindi/Assamese, certificate-based signature validation, password/security tools, and batch workflows.

The implementation boundary and release gates are defined in `native-desktop-plan.md`. No desktop-only capability is advertised as working before those gates pass.

## Milestone 5 — Android and controlled sync

Package an Android client, add file/share integrations, implement explicit metadata sync, and keep document-content sync off by default.
