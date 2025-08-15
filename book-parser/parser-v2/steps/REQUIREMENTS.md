- **Step 1: Text Extraction**
  - **Inputs**: Valid PDF path; initial pipeline state (e.g., `rawText` unset); configured output/debug directories.
  - **Outputs**: `rawText` containing all readable text; preserved literal `\n` markers; accurate page boundary accounting; extraction metadata (character count, page count, timings); debug data.
  - **Quality**: No concatenated or split words; ≥ 1000 characters; metadata character count matches actual text; professional-grade spacing/readability.
  - **Validation success**: Non-empty `rawText`; length ≥ 1000; metadata/text length consistency; minimal suspicious long-word occurrences.

- **Step 2.1: Chapter Detection**
  - **Inputs**: `rawText` from Step 1; original PDF (for bookmarks); configuration paths.
  - **Outputs**: `chapterMetadata[]` with `title`, `chapterNumber`, `startingPage`, optional `endPage`, `position`, `confidence`, and `detectionSource`.
  - **Quality**: ≥ 2 chapters; page numbers valid and within document range; titles non-empty and meaningful; numbering sequential/reasonable.
  - **Validation success**: Required fields present; `startingPage` positive/valid; logical chapter sequence.

- **Step 2.2: Chapter Content Extraction**
  - **Inputs**: `rawText` and `chapterMetadata` (with position info) from Step 2.1.
  - **Outputs**: `chapters[]` with extracted `content`, `wordCount`, and preserved chapter metadata; clean, readable text.
  - **Quality**: Each chapter content ≥ 100 characters and ≥ 10 words; clean boundaries between chapters; accurate word counts.
  - **Validation success**: At least one chapter with non-empty string content; per-chapter length ≥ 100 and words ≥ 10.

- **Step 2.3: Chapter Name Cleaning**
  - **Inputs**: `chapters[]` from Step 2.2 with `content` and known `title`.
  - **Outputs**: Cleaned chapter `content` with titles/metadata removed; substantial content retained (≥ 50 characters).
  - **Quality**: Effective removal of common title patterns; no over-cleaning; content integrity preserved.
  - **Validation success**: Chapters still exist; each content is a valid string and ≥ 50 characters; warnings allowed for suspected uncleaned titles.

- **Step 3: Page Extraction and Cross-Page Merging**
  - NOTE: If the pipeline removes page semantics, retain sentence continuity logic conceptually, but page-number-based validations are no longer applicable.
  - **Inputs**: Cleaned `chapters[]` from Step 2.3.
  - **Outputs**: If pages are still materialized, each page has `content` and `wordCount`; otherwise, ensure sentence continuity across former page boundaries.
  - **Quality**: Sentences end with terminators (., !, ?) with documented exceptions (headers/titles, bullet list endings, last content segment).
  - **Validation success**: Content sequences are continuous; sentence boundaries are respected with exceptions.

- **Step 3.1: Link Detection**
  - **Inputs**: Chapters with accessible chapter text; original PDF for internal link data.
  - **Outputs**: `links[]` with `linkId`, `role` (source|target), `text`, and `anchor` containing `chapterId` and `selector: { start, end }` (TextPositionSelector). Optional `chunkId` + `intraChunk` when available.
  - **Quality**: Roles valid; required fields present; source links should have corresponding targets; selector ranges valid and map to link text.
  - **Validation success**: Roles present; `anchor.selector` valid (`0 ≤ start < end ≤ chapterTextLength`); source–target relationships established; orphaned targets permitted as warnings.

- **Step 3.2: Image Extraction**
  - **Inputs**: Chapters with accessible text; original PDF for image detection/extraction.
  - **Outputs**: Chapter content augmented with inline image markers: `[[IMG id=<string> index=<int> alt="<string>"]]`. Images saved to disk as before.
  - **Quality**: Markers inserted at positions reflecting original flow; unique ids; optional alt text when available.
  - **Validation success**: All markers conform to grammar; every marker corresponds to an image on disk (or placeholder); processing metadata recorded.

- **Step 4: Paragraph Detection**
  - **Inputs**: Chapters with content from Step 3 and `links[]` from Step 3.1; content may include `[[IMG ...]]` markers.
  - **Outputs**: Unified `chunks[]` per chapter with `type` in {"paragraph", "header", "image"}; image markers converted to `image` chunks; links integrated into relevant text chunks.
  - **Quality**: ≥ 5 chunks overall; paragraph and header types present; image chunks present when markers exist; paragraphs target 80–300 words (absolute 20–500); headers: standard 1–5 words, numbered 2–12, ALL-CAPS blocks up to ~20 words; accurate link–content association.
  - **Validation success**: Chunk count > 5 and required types present; content format rules met; word count ranges respected per type; link text present in associated text chunk; no stray image markers remain in text.

- **Step 5: Sentence Detection and Combination**
  - **Inputs**: Chapters with `chunks[]` (types: paragraph/header/image) from Step 4.
  - **Outputs**: Sentence-level `chunks` of type `text` with `paragraphIndex`; headers/images preserved with `paragraphIndex: null`; combined text chunks meet 50–200 word target without crossing paragraph boundaries or moving images.
  - **Quality**: Clean text (no newlines, normalized whitespace); sentence boundaries preserved; links preserved and valid after combination; paragraph indexes sequential per chapter.
  - **Validation success**: Text chunks: type `text`, start with capital or valid symbol, 50–200 words, sentenceCount ≥ 1, valid links; headers/images: correct word counts and `paragraphIndex: null`; paragraph indexes start at 1, sequential, no gaps, at least one paragraph exists.

- **Step 5.1: Link Chunk References**
  - **Inputs**: Chapters from Step 5 with sentence chunks; links include `linkId`, `role`, `text`, `targetPageNumber`, and `targetText`.
  - **Outputs**: Source links gain `targetChunkId`; target links gain `sourceChunkId`; all original link fields preserved; references point to existing chunks.
  - **Quality**: Chunk references valid and consistent with link IDs; bidirectional relationships when both sides exist.
  - **Validation success**: All added chunk IDs reference existing chunks; ≥ 50% links resolved to chunk references; link ID consistency between source–target pairs; unresolved references reported in stats.

- **Step 6: Metadata Extraction**
  - **Inputs**: Finalized `chapters[]` with `chunks[]`; `rawText` for pattern analysis.
  - **Outputs**: `metadata` object including title, author, language; publication info (publisher, year, ISBN, edition when available); statistics (totals for chapters/words/sentences/paragraphs/images/links; averages); structure flags (TOC, index, images, links); processing info (extraction timestamp, parser version); `chapterTitles[]` aligned with chapter count.
  - **Quality**: Counts and averages internally consistent; presence flags align with actual content; reasonable value ranges (e.g., publication year).
  - **Validation success**: Required fields present (`title`, `author`, `language`, `totalChapters`, `totalWords`, `extractedAt`, `parserVersion`); correct data types; relationships consistent (e.g., `chapterTitles.length === totalChapters`); formats valid (ISO datetime, ISBN), and year within a reasonable range.


