# Document Power Toolkit

A local-first, installable PDF and image workstation. Milestone 2 performs real processing in the browser; selected documents are not uploaded.

## Working features — Milestone 2 / v0.2.1

- PDF preview with page navigation
- Merge PDFs
- Independent visual preview and page navigation for every uploaded Merge PDF
- Split PDF into one file per page
- Rotate every page without rasterizing
- Extract selected pages
- Images to PDF
- PDF pages to PNG archive
- PDF compression toward an exact maximum size with safety margin and quality floor
- Image compression toward an exact maximum size
- Output verification and local operation history
- Offline-installable PWA
- Delete, reorder, duplicate, and append blank pages
- All-page thumbnail selection for extract, delete, and duplicate operations
- Watermark and page numbering
- Standard metadata cleanup and PDF inspection report
- PDF text extraction
- Exact image resizing and format conversion
- Local OCR with bundled English, Hindi, and Assamese models
- Basic embedded-signature ByteRange and trailing-change inspection
- Searchable, categorized 20-tool library
- Local profile, account ID, device ID, privacy, and release-channel settings

## Run

```bash
npm ci
npm run dev
```

Open the printed local URL. Production verification:

```bash
npm run check
npm test
npm run test:ocr
npm run build
npm run test:browser
```

## Privacy and compression behavior

All enabled tools work locally. PDF target-size compression reconstructs pages from local raster renders, so searchable text and vector data are flattened in that mode. Structural page tools preserve PDF page objects. If a requested compression target would violate the selected quality floor, the app returns the smallest safe result and marks maximum-size verification as failed.

Basic signature inspection does not yet establish cryptographic validity, certificate-chain trust, revocation status, or trusted roots. It detects embedded signature markers, validates ByteRange boundaries, calculates the signed-content SHA-256, and identifies unsigned trailing bytes without producing a fake green tick.

## External resources

No existing Supabase or GitHub resource is assumed to belong to this project until its identity is verified. See `docs/project-status.md` for the current deployment and external-resource state.

## Production architecture

- GitHub: source, CI/builds, Releases, deployment trigger.
- Cloudflare: production Web/PWA hosting.
- Supabase: Auth and backend control-plane metadata.
- Documents remain local by default and are not silently uploaded.

