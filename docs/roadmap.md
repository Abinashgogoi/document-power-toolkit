# TANTRA Roadmap

`document-power-toolkit` remains the internal repository/project identifier. **TANTRA** is the public product name.

## Milestone 1 — Local workstation core ✅ Complete
Working PWA, PDF preview, page operations, conversion, target compression, verification, local history, CI, and offline build.

## Milestone 2 — Scalable local workstation ✅ Complete
Categorized 20-tool library, sequential merge flow, page/edit/inspect operations, bundled English/Hindi/Assamese OCR, basic signature-integrity inspection, and local account/device settings.

## Milestone 3 — Production Web/PWA & cloud control plane ✅ Complete
Dedicated Supabase project, authentication and approval, device trust, admin controls, metadata history, diagnostics, feedback, Realtime control data, Cloudflare production hosting, secure reporting RPCs, and production PWA hardening.

Real-world issues discovered after this point are handled as operational findings and product maintenance; they do not keep M3 artificially open.

## Milestone 4 — Android App & Field Distribution 🟡 Active
Build TANTRA's Android delivery layer around the existing React/Vite document engine.

Stage 1 goals:
- Capacitor-based Android architecture.
- Preserve the Web/PWA as a first-class client.
- Native Android file picker / open / share / save integration.
- Local-first document processing and explicit metadata-only cloud sync by default.
- Android app identity, adaptive icon, branded splash, lifecycle handling, and controlled updates.
- Real project versioning and milestone state surfaced in-product.
- Prepare installable field builds for a small real-user/device cohort.

The Android application must reuse the existing working tool engine rather than fork a second product.

## Milestone 5 — Field Beta, Runtime Stabilization & Continuous Product Evolution ⏳ Planned
Run TANTRA with real users and real devices while development continues in parallel.

This includes:
- diagnostics- and feedback-driven repair;
- device/network/file-size performance stabilization;
- auth, approval, revoke, update and lifecycle validation in the field;
- upgrading basic tools toward mid-level and advanced capability;
- introducing new tools;
- UX, accessibility and performance improvements;
- release → telemetry → repair → verification loops.

## Deferred / optional — Native desktop
A separate native desktop shell is not a current priority. PC/laptop users remain supported by the Web/PWA. Revisit native desktop only if offline-heavy, large-batch, filesystem, or enterprise requirements justify it.
