# TANTRA — Milestone 4 Android Architecture

Status: Stage 1 design
Version baseline: 0.3.0

## Decision
Use **Capacitor** as the Android application shell around TANTRA's existing React/Vite application.

The Web/PWA remains supported and independently deployable. Android is an additional delivery/runtime target, not a fork of the product.

## Why Capacitor
TANTRA needs more than an app-store wrapper. Planned field workflows benefit from native bridges for:
- Android document/file picker;
- receiving documents through Share/Open With;
- controlled output save/export;
- app lifecycle awareness;
- Android back behavior;
- permissions where genuinely required;
- future native integrations without rewriting the document engine.

A Trusted Web Activity remains a simpler option for a browser-hosted PWA, but it offers less room for these native workflows. Capacitor therefore provides the better long-term boundary.

## Runtime layers

### Shared product core
- React UI
- Vite build
- PDF/image/OCR/signature engines
- tool definitions and verification
- Supabase account/control-plane client
- diagnostics and feedback
- product design system

### Web/PWA client
- Hosted on Cloudflare Pages
- Installable through supported browsers
- Controlled service-worker updates
- Main PC/laptop delivery path

### Android client
- Capacitor native shell
- Android package/application identity
- native file/share/save bridges
- adaptive app icon and splash
- lifecycle/back-button integration
- release/version code suitable for Android distribution

## Data boundary
Document contents are **local by default** on both Web/PWA and Android.

Cloud services may receive explicitly designed safe metadata such as account/profile state, trusted device state, operation-history metadata when enabled, diagnostics metadata, user feedback, and feature/control-plane state.

Document bytes/content are not automatically uploaded merely because the user is using the Android build.

## Update architecture

### Web/PWA
GitHub → Cloudflare deployment updates the hosted application. The PWA uses prompt-based service-worker activation so an active working session is not intentionally reloaded without user choice.

### Android native layer
Changes to native Android code, plugins, manifest/permissions, package configuration, or other native resources require a new Android build/release.

### Shared web layer inside Android
During M4 implementation, use a controlled versioned release model first. Do not introduce arbitrary remote-code hot swapping before security, store-policy, rollback, compatibility, and active-session behavior are explicitly designed and tested.

The goal is still frequent updates. The difference is that updates remain controlled and traceable rather than silently changing code underneath an active document operation.

## Versioning
- `package.json` is the source for the TANTRA product version.
- M4 begins at **0.3.0**.
- Android additionally needs monotonically increasing native version codes.
- Future beta builds may use pre-release labels such as `0.4.0-beta.1` when appropriate.

## M4 Stage 1 acceptance
Stage 1 is complete when:
- roadmap/status correctly show M4 active;
- public product identity is TANTRA;
- visible version derives from the package version;
- mobile drawer has a proper blocking/dismissible scrim;
- Android architecture is documented;
- logo/icon/splash/sound direction is approved;
- repository is ready for Capacitor bootstrap.
