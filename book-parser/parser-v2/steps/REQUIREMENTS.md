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
  - **Inputs**: Cleaned `chapters[]` from Step 2.3; page boundary/numbering information derivable from content.
  - **Outputs**: Per-chapter `pages[]` with `pageNumber`, `content`, and `wordCount`; merged sentences that were split across pages; placeholders for figure-only pages (to keep numbering contiguous).
  - **Quality**: Pages generally end with sentence terminators (., !, ?), with documented exceptions (headers/titles, bullet list endings, last content page); ≥ 10 pages total for substantial documents; page numbers valid, continuous, and inclusive of placeholders.
  - **Validation success**: Each chapter has `pages[]`; each page has valid number and word count; figure-only pages allowed with explicit flag; sentence terminator rules respected with exceptions; sequential page numbering; total pages ≥ 10.

- **Step 3.1: Link Detection**
  - **Inputs**: Chapters with `pages[]` from Step 3; original PDF for internal link data.
  - **Outputs**: `links[]` with `linkId`, `role` (source|target), `pageNumber`, associated `text`, and source/target mapping where applicable.
  - **Quality**: Roles valid; required fields present; source links should have corresponding targets; link text accurately associated with page content; page numbers valid.
  - **Validation success**: Roles present; required fields populated with valid page numbers; source–target relationships established; orphaned targets permitted as warnings.

- **Step 3.2: Image Extraction**
  - **Inputs**: Chapters with `pages[]` (and `links`) from Step 3.1; each page includes `pageNumber` and `content`.
  - **Outputs**: For each page, an `images[]` array (possibly empty); each image has `imageName`, `imageAlt`, `extracted` (boolean), `placeholder` (boolean), and `originalName`.
  - **Quality**: Image metadata present and consistent with detected/extracted images; pages without images still include an empty `images[]`.
  - **Validation success**: All pages have `images[]`; image objects include required properties; image-related counts align with metadata.

- **Step 4: Paragraph Detection**
  - **Inputs**: Chapters with `pages[]` from Step 3 and `links[]` from Step 3.1; clean page content.
  - **Outputs**: Unified `chunks[]` per chapter with `type` in {"paragraph", "header"}; links integrated into relevant chunks; all chunks start with capital letters or valid punctuation.
  - **Quality**: ≥ 5 chunks overall; both paragraph and header types present; paragraphs target 80–300 words (absolute 20–500); headers: standard 1–5 words, numbered 2–12, ALL-CAPS blocks up to ~20 words; accurate link–content association.
  - **Validation success**: Chunk count > 5 and both types present; content format rules met; word count ranges respected per type; link text present in associated chunk; paragraphs should not end with stray initials (with common-word exceptions).

- **Step 5: Sentence Detection and Combination**
  - **Inputs**: Chapters with paragraph `chunks[]` (type: paragraph/header/image) from Step 4.
  - **Outputs**: Sentence-level `chunks` of type `text` with `paragraphIndex`; headers/images preserved with `paragraphIndex: null`; combined text chunks meet 50–200 word target without crossing paragraph boundaries.
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


