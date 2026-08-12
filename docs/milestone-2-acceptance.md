# Milestone 2 acceptance gates

Milestone 2 is releasable only when every mandatory command exits successfully and the evidence below agrees with the UI.

| Area | Required evidence | Failure rule |
| --- | --- | --- |
| Merge selection | Two PDFs selected in separate picker actions remain present in input order | Any earlier file disappearing blocks release |
| Input previews | Every uploaded PDF/image has its own visual preview; multipage Merge inputs can be paged independently | A filename-only list or missing later-file preview blocks release |
| Page tools | Extract/delete/duplicate show all page thumbnails and thumbnail clicks update the page selection | Text-only page selection blocks release |
| Merge output | Reopened output page count equals the sum of all inputs | Count mismatch or unreadable output blocks release |
| Structural PDF tools | Unit fixtures reopen outputs and verify the expected page count/order | A generated file alone is not a pass |
| Split | Every generated one-page PDF reopens before the ZIP is reported verified | Any unreadable page file blocks verification |
| OCR | Bundled model recognizes the committed fixture with non-empty expected text | Model download/copy or recognition failure blocks release |
| Signatures | Unsigned, malformed, or trust-unknown documents are never labeled cryptographically valid | A green validity claim without chain verification blocks release |
| Profile | Local account ID, device ID, privacy mode, and release channel are visible and persistent | The UI must not imply a cloud account or admin backend exists |
| Scale | 20 tools are searchable and grouped; category counts match the catalog | Tool overflow or hidden unreachable tools blocks release |
| Browser | Production build opens all 20 routes and completes separate-selection merge/image, conversion, text, resize, compression, OCR, signature-warning, and profile flows in real Chromium | DOM-only tests are insufficient |
| Offline assets | App shell, OCR models, worker, and WASM are included in the production service-worker precache | Missing OCR runtime assets blocks offline claim |

Commands: `npm run check`, `npm test`, `npm run test:ocr`, `npm run build`, and `npm run test:browser`.
