# Architecture

## Current milestone

The production unit is an offline-installable web application. PDF and image bytes stay in browser memory. Output is written to a new Blob, verified, and downloaded separately. IndexedDB stores non-content operation history.

```text
React UI
  -> typed tool dispatcher
  -> PDF/image engines
  -> output verification
  -> explicit download

Local metadata
  -> IndexedDB history

Optional future sync
  -> backend interface
  -> dedicated Supabase project
```

## Processing engines

- `pdf-lib`: structural page operations and PDF output.
- `pdfjs-dist`: PDF rendering and page preview.
- Canvas: local image encoding and target-size optimization.
- JSZip: multi-file output archives.

Merge, split, rotate, and extract preserve PDF page objects. Target-size PDF compression intentionally rasterizes because a reliable browser-only object-stream optimizer cannot guarantee target size across arbitrary input PDFs. The UI and README disclose this limitation.

## Platform evolution

The current PWA is installable on desktop and Android browsers. A future native desktop shell should call a native shared engine for advanced editing, OCR, digital-signature validation, and large-file streaming. The web interface must not claim these native capabilities until they exist.
