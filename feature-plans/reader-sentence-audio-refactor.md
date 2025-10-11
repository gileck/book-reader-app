# Reader Sentence-Chunk Audio Refactor Plan

## Summary
- Update the parsing pipeline so chapters ship **sentence-level chunks** (with paragraph metadata) by default.
- Standardise both Full and Focus reader modes on one **sentence-based audio controller** that reuses a single `HTMLAudioElement`.
- Refresh rendering, highlighting, and controls so the only difference between reader modes is layout/presentation, not playback logic.

## Goals & Success Criteria
- **Parser emits sentences:** each text chunk in `output.json` equals exactly one sentence (no merging), carrying `paragraphIndex`, word counts, links, etc.
- **Unified controller:** both modes consume one hook/object for play/pause, navigation, preloading, errors, and word-level highlighting.
- **UI parity:** Full reader adopts sentence spans + highlighting while retaining paragraph grouping; Focus reader keeps its focused layout using the same data source.
- **OPS confidence:** playback remains performant with hundreds of sentences, TTS requests stay manageable, and regression checks pass.

## Scope
### In Scope
- Parser step 5 changes to eliminate ALL sentence merging; every text chunk = exactly one sentence for maximum audio playback granularity.
- Shared sentence metadata definitions (`SentenceChunk`, `ParagraphMeta`) consumed by client and downstream tooling.
- Consolidation of `useAudioPlayback` + `useFocusAudioPlayback` into a new `useSentenceAudioController` hook.
- Rendering updates in `ReaderContent`, `FocusReader`, and `AudioControls` to consume the new controller.
- Highlighting rewrite using sentence + word IDs shared across both layouts.

### Out of Scope (for this iteration)
- API/schema changes beyond parser output (server contracts stay untouched).
- Offline storage optimisations or compression of sentence audio; revisit after stabilising the pipeline.
- Large-scale UI redesigns beyond the sentence-level tweaks required for rendering/spacing.

## Current State Snapshot
- Parser currently recombines sentences into multi-sentence chunks (25–200 words) even though `paragraphIndex` exists.
- Full reader operates on chunk indexes, assumes chunk ≈ paragraph; focus reader reconstructs sentences locally and manages its own audio element.
- Audio controls juggle two incompatible controller interfaces, leading to widespread `isFocusMode ? … : …` ternaries.
- Highlighting diverges: DOM-based chunk selectors in full reader vs. word/line overlay logic in focus mode.

## Target Architecture
1. **Parser Output**
   - Step 5 (`05-sentence-detection`) emits sentence chunks, only merging fragments <10 words with the previous in-paragraph sentence.
   - Preserve `paragraphIndex`, `links`, `wordCount`, `sentenceCount` (still 1 for most chunks), and assign stable `chunkId`/`sentenceId`.
   - Optional: generate `paragraphMeta` map ({index, startSentence, endSentence, type}) for layout grouping.

2. **Shared Types & Utilities**
   - `SentenceChunk` interface (id, text, wordOffsets, paragraphIndex, chunkIndex).
   - Utility `groupSentencesByParagraph(sentences)` for layout spacing & navigation.

3. **Unified Audio Controller (`useSentenceAudioController`)**
   - Single `HTMLAudioElement` reused; caches base64 audio + timepoints per sentence.
   - Preloads current sentence ±N neighbours; tracks per-sentence status (`idle|pending|ready|failed`).
   - Exposes API: `play()`, `pause()`, `goToSentence(idx)`, `nextSentence()`, `prevSentence()`, `handleWordClick(sentenceIdx, wordIdx)`, `preload(sentenceIdx)`, `retryFailed(sentenceIdx)`.
   - Maintains `currentSentenceIndex`, `currentWordIndex`, `isPlaying`, `intendedPlay`, `ttsError`, `ttsServiceAvailable`.

4. **Rendering & Highlighting**
   - Full reader renders sentences as spans with `data-sentence-id` & `data-word-index`, grouped by paragraph wrappers for spacing/headings.
   - Shared highlighting helper updates spans based on controller state; optional line overlay for focus mode.

5. **Controls & Navigation**
   - `AudioControls` receives `controller` + derived metadata (currentSentence, totalSentences, progress). Eliminates per-mode branching.
   - Navigation/bookmark/progress code treat “chunk” as “sentence” transparently; grouping helpers resolve paragraph-level UI (scroll to paragraph by using `paragraphIndex`).

## Implementation Plan

### Phase 1 – Parser Update & Validation
1. **Disable Aggressive Sentence Combination**
   - Modify `combineSmallSentences` to only merge when `wordCount < 10` and previous chunk is in same paragraph and under max word threshold.
   - Ensure headers/images remain untouched; keep `paragraphIndex` intact.

2. **Update Parser Tests & Outputs**
   - Regenerate sample outputs (e.g., `files/Cant Hurt Me/output/output.json`) and review distribution of sentence lengths.
   - Adjust validation scripts to reflect new min/max thresholds.

3. **Document Parser Change**
   - Update parser README & pipeline docs: highlight new sentence-based output and short-sentence merge rule.

### Phase 2 – Shared Types & Utilities
1. **Introduce `SentenceChunk` Types**
   - Add to `src/client/routes/Reader/types.ts`; include `sentenceId`, `text`, `wordOffsets`, `paragraphIndex`, `chunkIndex`.

2. **Sentence Grouping Helpers**
   - `buildSentenceMap(chapter)` returns sentences array + paragraph grouping map + chunk->sentence index map.
   - Provide unit tests for grouping scenarios (headings, images, bullet lists).

### Phase 3 – Unified Audio Controller
1. **Implement `useSentenceAudioController`**
   - Start from focus hook: single audio element, neighbour preload, `intendedPlay` logic.
   - Add per-sentence status map and exported API described above.

2. **Support Legacy Consumers**
   - Provide optional adapters for features temporarily expecting chunk-based method names (`handleNextChunk` etc.) to ease migration.

3. **Testing**
   - Jest unit tests mocking `generateTts` for success/failure, verifying state transitions, retry logic, and preload behaviour.

### Phase 4 – Reader Integration
1. **Update `useReader`**
   - Consume parser-provided sentences directly; remove local sentence-building in focus hook.
   - Instantiate unified controller; expose controller + sentences via returned `audio` object.

2. **Bookmarks & Progress**
   - Ensure existing chunk index storage works unchanged (now equivalent to sentence index).
   - Add helper to map paragraph selection to first sentence index when needed (chapter navigator, bookmark overlay).

3. **ReaderContent Refactor**
   - Render paragraphs as containers (`<div data-paragraph>`), inside map sentences to `<span>`s with word-level spans if required.
   - Preserve headings, images, and non-text chunks using existing components.

4. **FocusReader Simplification**
   - Consume shared sentences + controller; drop redundant logic (sentence building, separate TTS state).
   - Retain focus-specific UI elements (prev/current/next sentence display, line highlight overlay) powered by shared controller state.

5. **AudioControls Refactor**
   - Replace individual props with `controller` + metadata (`unitLabel = 'sentences'`, counts, errors, etc.).
   - Remove `isFocusMode` branching in `Reader.tsx` for audio-related callbacks.

### Phase 5 – Highlighting & Cleanup
1. **Highlighting Helper**
   - Implement shared DOM updater that adds/removes classes on `[data-sentence-id][data-word-index]` spans, respecting highlight mode settings.
   - Integrate with unified controller’s `currentWordIndex` updates; support line overlays for focus mode using sentence container measurements.

2. **Remove Legacy Hooks**
   - Delete `useAudioPlayback.ts` & `useFocusAudioPlayback.ts` after migration.
   - Update any leftover imports, ensure tree-shaking clean.

3. **Docs & QA**
   - Refresh `docs/highlighting-systems.md`, `feature-plans/sentence-highlighting-mode.md` with new flow.
   - Manual QA checklist (desktop/mobile, bookmarks, theme toggles, TTS errors, offline mode).
   - Run `yarn checks` and targeted integration tests or smoke scripts.

### Phase 6 – Optimization & Hardening (post-MVP)
1. **Performance & DOM scale**
   - Viewport-driven word-span hydration using `IntersectionObserver`; only create word spans for the active sentence and near-neighbours.
   - Batch highlight DOM updates with `requestAnimationFrame`; precompute element lookups and avoid repeated selectors.

2. **Audio caching & memory**
   - Prefer Blob URLs over base64 for audio buffers; implement LRU with `maxCachedSentences` and `maxTotalBytes` caps and eviction.
   - Tune preload window (±N sentences), set `maxConcurrentPreloads`, and add per-sentence abort/backoff on repeated failures.

3. **ID stability & progress migration**
   - Define stable `sentenceId` generation (e.g., content-hash + `paragraphIndex` + ordinal) to remain consistent across parser re-runs.
   - Add a migration helper to map legacy chunk indexes to the first corresponding sentence index on first load.

4. **Mobile/iOS media behaviour**
   - Enforce user-gesture gating for play; handle audio-focus interruptions and resume semantics on iOS Safari.

5. **Observability & QA**
   - Instrument preload hit/miss, TTS error rates, retry counts, time-to-first-play, and memory samples.
   - Add E2E tests for rapid next/prev during in-flight preloads, offline/unavailable TTS fallback, and mobile Safari gesture constraints.

6. **Parser robustness**
   - Improve sentence tokenisation for abbreviations, decimals, initials, quotes, ellipses, and non‑Latin scripts; consider ICU/tokenizer configuration.

7. **Accessibility**
   - Provide keyboard navigation across sentences; ARIA roles/labels for sentence containers; maintain focus management during playback.

## Detailed Task Breakdown

| # | Task | Owner | Dependencies |
|---|------|-------|--------------|
| 1 | Adjust parser sentence combination thresholds | FE Data | none |
| 2 | Regenerate sample outputs & validate | FE Data | #1 |
| 3 | Update parser documentation | FE Data | #2 |
| 4 | Define `SentenceChunk` types & helpers | FE App | #1 |
| 5 | Implement `useSentenceAudioController` hook | FE App | #4 |
| 6 | Add controller unit tests | FE App | #5 |
| 7 | Integrate controller in `useReader` | FE App | #5 |
| 8 | Refactor `ReaderContent` rendering | FE App | #7 |
| 9 | Update highlighting system | FE App | #8 |
|10 | Simplify `FocusReader` | FE App | #7 |
|11 | Refactor `AudioControls` & wiring | FE App | #7 |
|12 | Remove legacy hooks & cleanup | FE App | #11 |
|13 | Update docs & run regression checks | FE App | #12 |

## Risks & Mitigations
- **Many more chunks per chapter**: ensure controller keeps single audio element, watch memory usage; add lazy preload window.
- **Highlighting performance**: measuring spans per word could be expensive—optimise selectors, throttle updates.
- **TTS throughput**: sentence-level granularity increases request count; reuse caching, consider batching for very short sentences.
- **Parser change ripple**: clients/scripts expecting multi-sentence chunks must be reviewed (export tools, analytics). Communicate change and provide migration guide.

## Open Questions
- Should parser expose explicit `paragraphMeta` objects (start/end sentence indexes, type) to simplify layout grouping? - not for now.
- Do we need locale-aware sentence segmentation options beyond English defaults? No.
- Should we cap total preloaded sentences to respect TTS provider quotas (per-user rate limiting)? No.

## Next Steps
1. Socialise plan with stakeholders; confirm parser change timeline.
2. Schedule parser update & sample output regeneration.
3. Kick off controller integration work once sentence-based outputs are available.


