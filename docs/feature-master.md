# Feature completeness matrix

| Feature | Web/PWA | Desktop | Android | Verification | Limitation |
|---|---|---|---|---|---|
| PDF preview | Verified | PWA install | PWA install | Browser render | No annotations yet |
| Merge | Verified | PWA install | PWA install | Open + page count | Memory-bound |
| Split | Verified | PWA install | PWA install | Archive entry count | One file per page |
| Rotate | Verified | PWA install | PWA install | Open + page count | All pages together |
| Extract | Verified | PWA install | PWA install | Open + page count | Manual page selection |
| Images to PDF | Verified | PWA install | PWA install | Open + page count | A4-side size cap |
| PDF to PNG | Verified | PWA install | PWA install | Rendered-page count | 2× render scale |
| PDF target compression | Verified, limited | PWA install | PWA install | Open + pages + max size | Rasterizes pages |
| Image target compression | Verified | PWA install | PWA install | Decode + max size | PNG may output WebP |
| Local history | Verified | PWA install | PWA install | IndexedDB read/write | Metadata only |
| Delete/reorder/duplicate/blank pages | Verified | PWA install | PWA install | Open + page count/order | Browser-memory bound |
| Watermark/page numbers | Verified | PWA install | PWA install | Open + page count | Standard PDF fonts |
| Metadata clean/inspect | Verified | PWA install | PWA install | Parser + report | Standard info fields only |
| PDF to text | Verified | PWA install | PWA install | Pages + detected text | Existing text layer only |
| OCR English/Hindi/Assamese | Verified | PWA install | PWA install | Bundled-model fixture + page/text checks | Plain-text output; review confidence |
| Basic signature inspection | Limited | PWA install | PWA install | ByteRange + hash + trailing bytes | No certificate trust or CMS verification |
| Existing-text editing | Planned | Planned | Limited | — | Hidden |
| Local profile/device settings | Verified | PWA install | PWA install | IndexedDB profile | No cloud account yet |
| Accounts/admin | Backend migration ready | Planned | Planned | RLS tests pending | Dedicated backend missing |
