# Security baseline

- Input files are never overwritten.
- No file contents, filenames, or paths are sent through telemetry.
- History contains tool, time, byte sizes, duration, settings, and verification outcome only.
- Output must exist and decode/open before it is marked verified.
- Processing errors leave the source untouched and do not expose a partial download.
- The service worker caches application code, not user documents.
- External resources require project-identity matching before mutation.
- Supabase clients may use only a publishable key; a service-role secret must never be bundled.
- The proposed backend schema enables RLS on every client-visible table.

Before public multi-user release: add CSP/security headers, dependency scanning, malicious-PDF stress fixtures, rate limiting, MFA enforcement for admins, signed releases, and independent authorization tests.
