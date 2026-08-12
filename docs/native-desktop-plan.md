# Native desktop engine plan

## Goal

Move large-file and security-sensitive operations behind a native desktop engine without changing the web tool contracts or making unverified claims in the UI.

## Engine boundary

- Keep tool identifiers, inputs, progress events, output metadata, and verification reports shared with the PWA.
- Give the native layer streaming file handles rather than loading whole documents into browser memory.
- Write outputs to a temporary sibling file, verify them, then atomically move them to the user-selected destination.
- Never send document bytes to an external service unless a separate, explicit sync feature is enabled.

## Planned capabilities

1. Streaming merge, split, reorder, compression, and batch queues for large PDFs.
2. Searchable OCR that writes an invisible text layer for English, Hindi, and Assamese.
3. CMS signature parsing, signed-byte verification, certificate-chain building, trusted-root policy, timestamp inspection, and optional OCSP/CRL checks.
4. Password encryption/decryption, redaction that removes underlying content, forms, and annotation workflows.
5. Crash-safe jobs, pause/resume, collision-safe filenames, diagnostics export, and signed automatic updates.

## Release gates

- Golden fixtures prove that every output opens and preserves the expected page order/content.
- Signed-document fixtures cover valid, tampered, expired, untrusted, revoked, and offline-unknown states; unknown is never displayed as valid.
- Large-file tests run beyond browser-memory limits without reading the full input into RAM.
- Interrupted jobs leave originals untouched and clean up temporary files on restart.
- Installers are signed, update packages are signature-verified, and rollback is tested on each supported operating system.
- Accessibility, keyboard operation, filesystem permissions, and uninstall/data-retention behavior pass platform QA.

## Delivery sequence

1. Prototype the shared command/result contract and one streaming merge operation.
2. Add the job runner, progress/cancellation, atomic output handling, and fixture harness.
3. Move large-file page operations and batch workflows to the native engine.
4. Add searchable OCR, then certificate-based signature validation with explicit trust states.
5. Sign installers and updates, run operating-system release matrices, and expose desktop-only tools only after their gates pass.
