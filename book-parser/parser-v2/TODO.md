# Parser v2 – No-Page Model Migration TODO

- [x] Links: Step 03-1 emits selector-based anchors (`anchor.chapterId`, `anchor.selector {start,end}`) and global `links` array
- [x] Links: Update Step 03-1 validation to require anchors and validate `start < end`
- [x] Images: Step 03-2 inserts inline image markers `[[IMG id=... index=... alt="..."]]` into chapter content; mirror into page content
- [x] Images: Save images as `image-<page>-<idx>.jpg` (no pageNumber on data)
- [x] Paragraphs: Step 04 detects markers and emits `image` chunks in place; removes page-based merge restrictions
- [x] Paragraphs: Step 04 link extraction uses `link.text` (no page targets); dedup by `text+linkId+role`
- [x] Sentences: Step 05 removes page-gap logic; no `pageNumber` on text chunks; images/headers preserved with `paragraphIndex: null`
- [x] Docs: Update READMEs for 03-1, 03-2, 04, 05, 05-1 and `REQUIREMENTS.md`
- [ ] Link refs: Step 05-1 resolve `sourceChunkId`/`targetChunkId` via selector→chunk mapping (chapter content offsets to chunk ranges)
- [ ] Sweep: Remove remaining pageNumber assumptions in any validations or debug outputs across steps (esp. 04 debug JSON)

Notes
- Step 03 page-extraction README updated to clarify behavior when pages are removed; code still supports existing page-based flow if present.
