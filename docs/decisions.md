# Decision log

## DEC-001 — Local-first processing

**Status:** Accepted

Document bytes remain local unless a future user explicitly opts into a cloud-only operation. This minimizes privacy exposure and recurring infrastructure cost.

## DEC-002 — PWA as first production client

**Status:** Accepted for Milestone 1

An installable web client provides a testable working product now and can share TypeScript contracts with later desktop and Android clients. Native-only features stay out of the visible UI.

## DEC-003 — Preserve structure except in exact-target compression

**Status:** Accepted

Page operations use structural copying. Exact-target PDF compression uses controlled local raster reconstruction and therefore flattens searchable text and vectors. The limitation is disclosed before release.

## DEC-004 — Dedicated external resources only

**Status:** Accepted

The existing `ESHANTVA Studio` Supabase project is unrelated and will not be modified. GitHub, Cloudflare, and Supabase activation require resources dedicated to Document Power Toolkit.
