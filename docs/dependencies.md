# Dependency inventory

| Dependency | Purpose | License | Exit strategy |
|---|---|---|---|
| React | User interface | MIT | Web Components or another view layer |
| Vite | Build and development server | MIT | Standard bundler migration |
| pdf-lib | Structural PDF creation/editing | MIT | Native PDF core or another permitted library |
| PDF.js (`pdfjs-dist`) | Rendering and preview | Apache-2.0 | Native renderer or alternative WASM renderer |
| JSZip | Multi-file ZIP output | MIT | Browser Compression Streams or another ZIP library |
| Lucide React | Icons | ISC | Internal SVG icon set |
| vite-plugin-pwa | Service worker and manifest | MIT | Direct Workbox configuration |
| Vitest | Automated tests | MIT | Node test runner |

Exact installed versions are locked in `package-lock.json`. CI uses `npm ci` and runs type checking, regression tests, and a production build.
