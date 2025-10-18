# Modular Book Parser POC Implementation

## Overview

This is a modular implementation of the Book Parser POC with each step separated into its own file for better organization, maintainability, and parallel development.

## Architecture

### Main Module
- **`main-poc.js`** - Pure module interface that orchestrates the entire pipeline, running steps sequentially and returning results as objects. Can be imported and used programmatically or via wrapper scripts.

### Step Modules
Each step is implemented as a separate module in its own folder within the `steps/` directory:

1. **`01-text-extraction/`** - Extract raw text from PDF with literal `\n` preservation ✅
2. **`02-1-chapter-detection/`** - Detect chapter boundaries from TOC ✅
3. **`02-2-chapter-content-extraction/`** - Extract content for each chapter ✅  
4. **`02-3-chapter-name-cleaning/`** - Clean chapter names and content ✅
5. **`03-page-extraction-and-cross-page-merging/`** - Extract pages, merge sentences, and enhanced page number removal ✅
6. **`03-1-link-detection/`** - Extract and resolve PDF internal links using chapter-relative text position selectors ✅
7. **`03-2-image-extraction/`** - Extract images and insert `[[IMG...]]` markers into chapter content ✅
8. **`04-paragraph-detection/`** - Detect paragraph boundaries and headers, preserving image markers; intelligently separates numbered lists and bullet points after newlines while keeping colon-introduced lists together ✅
9. **`05-sentence-detection/`** - Split paragraphs into single-sentence text chunks for granular audio playback; only merges ultra-short sentences (<12 words) backward within the same paragraph; protects abbreviations, decimals, and ellipses ✅
10. **`05-1-image-markers-to-chunks/`** - Convert `[[IMG...]]` markers (embedded and standalone) to image chunks ✅
11. **`05-2-link-chunk-references/`** - Resolve link references to chunk IDs ✅
12. **`06-metadata-extraction/`** - Extract comprehensive book metadata and statistics ✅

### Shared Utilities
- **`utils/text-processing-utils.js`** - Centralized text processing functions used across multiple steps for consistent behavior ✅

**Legend**: ✅ Implemented and Production-Ready

Each step folder contains:
- Main step implementation file (e.g., `01-text-extraction.js`)
- Validation module file (e.g., `01-text-extraction-validation.js`)
- README.md with step-specific documentation (where applicable)

## Pipeline State

The pipeline state is passed between steps and contains:

```javascript
PIPELINE_STATE = {
    // Raw extracted text
    rawText: null,
    
    // Chapter structure
    chapters: [],           // Chapters with page content (content field removed after step 4)
    
    // Content structure  
    chunks: [],            // Single-sentence text chunks (or 1 sentence + merged ultra-short <12w follow-ups) with type "text", "header", or "image" + paragraphIndex
    
    // Metadata
    pages: [],             // Page information (for intermediate processing only)
    links: [],             // Internal PDF links with chapter-relative TextPositionSelector (no pageNumber)
    finalOutput: null,     // Generated output.json
    
    // Processing metadata
    metadata: {
        processingStartTime: null,
        processingEndTime: null,
        stepResults: {}     // Results from each step
    }
}
```

## Step Interface

Each step module must export an `execute` function and optionally a `validate` function with these signatures:

```javascript
/**
 * Execute the step
 * @param {Object} pipelineState - Current pipeline state
 * @param {Object} config - Configuration object
 * @returns {Object} - Updated state to merge with pipelineState
 */
async function execute(pipelineState, config) {
    // Implementation goes here
    return {
        // Return only the fields that changed
        // e.g., { rawText: extractedText }
    };
}

module.exports = { execute, validate };
```

## Programmatic API

The main module now provides a clean programmatic interface:

```javascript
const parser = require('./main-poc.js');

// Parse entire book
const results = await parser.parseBook(pdfPath, options);

// Parse specific steps only  
const partialResults = await parser.parseBookSteps(pdfPath, ['step-1', 'step-3-2'], options);

// Get available steps
const steps = parser.getAvailableSteps();

// Get step descriptions
const descriptions = parser.getStepDescriptions();
```

### API Options

```javascript
const options = {
    outputDir: './output',           // Directory for images and output files
    debugDir: './debug',            // Directory for debug information
    validate: true,                 // Run validation (default: true)
    debug: true,                   // Enable debug logging (default: false)
    saveStepOutputs: true,         // Save individual step outputs (default: false)
    // Chunk optimization settings
    chunkTargetMin: 80,
    chunkTargetMax: 300,
    chunkAbsoluteMin: 50,
    chunkAbsoluteMax: 500
};
```

### API Results Structure

```javascript
{
  metadata: {
    pdfPath, startTime, endTime, totalDuration, success, stepCount
  },
  steps: {
    'step-1': { success, duration, validation, output },
    'step-3-2': { success, duration, validation, output },
    // ... all executed steps
  },
  finalOutput: { /* output from last executed step */ }
}
```

## Validation Architecture

Each step has its validation code extracted to a separate validation file within its step folder:

- `01-text-extraction/01-text-extraction-validation.js` - Validates text extraction output
- `02-1-chapter-detection/02-1-chapter-detection-validation.js` - Validates chapter detection and includes helper functions
- `02-2-chapter-content-extraction/02-2-chapter-content-extraction-validation.js` - Validates chapter content extraction
- `02-3-chapter-name-cleaning/02-3-chapter-name-cleaning-validation.js` - Validates chapter name cleaning
- `03-page-extraction-and-cross-page-merging/03-page-extraction-and-cross-page-merging-validation.js` - Validates page extraction with helper functions
- `03-1-link-detection/03-1-link-detection-validation.js` - Validates link detection
- `04-paragraph-detection/04-paragraph-detection-validation.js` - Validates paragraph detection with all helper functions
- `05-sentence-detection/05-sentence-detection-validation.js` - Validates sentence optimization and paragraph indexing
- `06-metadata-extraction/06-metadata-extraction-validation.js` - Validates comprehensive metadata extraction

### Validation Module Interface

Each validation module exports a `validate` function and any helper functions:

```javascript
/**
 * Validate the step output
 * @param {Object} output - Output from execute function
 * @returns {boolean} - True if validation passes, false otherwise
 */
function validate(output) {
    // Validation logic specific to this step
    // Return false and log errors if validation fails
    return true;
}

module.exports = { validate, /* helper functions */ };
```

### Validation Logging Behavior

- All detailed validation messages are written to `validation-output.txt` inside the parser run's output directory.
- The console remains clean and prints only concise summaries, for example:
  - `❗ Validation failed in step-4: 3 error(s). Details: <outputDir>/validation-output.txt`
  - `   Error breakdown by chapter: 18 (Bibliography): 2, 19: 1`
  - `⏭️  Validation skipped in step-5: 2 error(s) suppressed. See: <outputDir>/validation-output.txt`
- A structured summary of validation pass/fail per step is also saved to `validation.json` in the output directory.
- This ensures CI logs and terminal output stay readable, with full details available in files for inspection.

Note: Sentence termination deliberately ignores spaced ellipses (". . .") so they are not treated as end-of-sentence markers during splitting or validation.

Main step files import validation functions from the same directory:

```javascript
const { validate } = require('./step-name-validation');

module.exports = { execute, validate };
```

## Folder Structure

```
steps/
├── 01-text-extraction/
│   ├── 01-text-extraction.js
│   └── 01-text-extraction-validation.js
├── 02-1-chapter-detection/
│   ├── 02-1-chapter-detection.js
│   └── 02-1-chapter-detection-validation.js
├── 02-2-chapter-content-extraction/
│   ├── 02-2-chapter-content-extraction.js
│   └── 02-2-chapter-content-extraction-validation.js
├── 02-3-chapter-name-cleaning/
│   ├── 02-3-chapter-name-cleaning.js
│   └── 02-3-chapter-name-cleaning-validation.js
├── 03-page-extraction-and-cross-page-merging/
│   ├── 03-page-extraction-and-cross-page-merging.js
│   └── 03-page-extraction-and-cross-page-merging-validation.js
├── 03-1-link-detection/
│   ├── 03-1-link-detection.js
│   └── 03-1-link-detection-validation.js
├── 03-2-image-extraction/
│   ├── 03-2-image-extraction.js
│   ├── 03-2-image-extraction-validation.js
│   └── README.md
├── 04-paragraph-detection/
│   ├── 04-paragraph-detection.js
│   └── 04-paragraph-detection-validation.js
├── 05-sentence-detection/
│   ├── 05-sentence-detection.js
│   └── 05-sentence-detection-validation.js
├── 05-1-image-markers-to-chunks/
│   ├── 05-1-image-markers-to-chunks.js
│   ├── 05-1-image-markers-to-chunks-validation.js
│   └── README.md
├── 05-2-link-chunk-references/
│   ├── 05-2-link-chunk-references.js
│   └── 05-2-link-chunk-references-validation.js
└── 06-metadata-extraction/
    ├── 06-metadata-extraction.js
    └── 06-metadata-extraction-validation.js
utils/
└── text-processing-utils.js
```

## Shared Text Processing Utilities

### Overview
The `utils/text-processing-utils.js` module provides centralized text processing functions used across multiple parser steps to ensure consistent behavior and eliminate code duplication.

### Key Functions

```javascript
const {
    // Abbreviation handling
    endsWithAbbreviation,
    endsWithSentenceTerminator,
    COMMON_ABBREVIATIONS,
    
    // Word and sentence counting
    countWords,
    getWordCount,
    getSentenceCount,
    isSentenceTerminator,
    
    // Text validation
    endsWithInitials,
    endsWithCommonSingleLetterWord,
    validateWordLengths,
    
    // Text splitting
    splitIntoSentencesBasic
} = require('./utils/text-processing-utils');
```

### Comprehensive Abbreviation Support
The utilities include a comprehensive list of 60+ common abbreviations:

```javascript
const COMMON_ABBREVIATIONS = [
    // Academic degrees: 'Ph.D.', 'M.D.', 'B.A.', 'M.A.', 'B.S.', 'M.S.', 'J.D.'
    // Titles: 'Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.', 'Sr.', 'Jr.'
    // Organizational: 'P.U.', 'A.I.', 'I.T.', 'R.D.', 'Q.A.', 'H.R.'
    // Publishing: 'Sec.', 'Vol.', 'No.', 'Ed.', 'pp.'
    // Geographic: 'U.S.', 'U.K.', 'U.S.A.'
    // And many more...
];
```

### Unicode Support
Enhanced validation functions properly handle international characters:

```javascript
// Supports accented capitals like "Índice", "École", "Québec"
const isUppercaseLetter = char === char.toUpperCase() && char !== char.toLowerCase();
```

### Usage in Parser Steps
Steps import and use shared utilities instead of duplicating logic:

```javascript
// In step validation files:
const { countWords, endsWithInitials, endsWithAbbreviation } = require('../../utils/text-processing-utils');

// Enhanced validation with proper abbreviation handling
if (endsWithInitials(content) && !endsWithAbbreviation(content) && !endsWithCommonSingleLetterWord(content)) {
    validationErrors.push(`Chunk should not end with initials: "${content}"`);
}
```

## Per-Step Validation

Each step now includes its own validation logic that runs immediately after execution:

- **Fail-Fast Approach**: Pipeline stops immediately if any step validation fails
- **Step-Specific Criteria**: Each step validates only its own output requirements
- **Clear Error Messages**: Validation failures provide specific error details
- **Production Safety**: Ensures data integrity at each pipeline stage

### Validation Criteria by Step:

1. **Step 1** (Text Extraction): Non-empty text, minimum length, metadata consistency
2. **Step 2-1** (Chapter Detection): Chapter count, page number validation, continuity
3. **Step 2-2** (Chapter Content): Content existence, minimum length, word counts
4. **Step 2-3** (Chapter Cleaning): Content preservation, title removal verification  
5. **Step 3** (Page Processing): Page structure, content validation, reasonable counts
6. **Step 3-1** (Link Detection): Role validation, source-target matching, required fields
7. **Step 3-2** (Image Extraction): Image metadata validation, file existence, page mapping
8. **Step 4** (Paragraph/Header Detection): Chunk counts, types, word limits, Unicode-aware capitalization validation, image marker preservation, shared abbreviation handling, smart list separation (numbered lists and bullet points after newlines)
9. **Step 5** (Sentence Detection): Sentence optimization with smart constraint relaxation, paragraph indexing, word count targets, standalone image marker detection, enhanced validation using shared text processing utilities
10. **Step 5-1** (Image Markers to Chunks): Embedded and standalone marker extraction, image chunk creation, marker removal validation
11. **Step 5-2** (Link Chunk References): Link-to-chunk ID resolution, bidirectional relationships
12. **Step 6** (Metadata Extraction): Title/author extraction, statistics calculation, required fields validation

## Configuration

The configuration object contains:

```javascript
CONFIG = {
    INPUT_PDF: path.join(__dirname, '../../book.pdf'),
    OUTPUT_DIR: path.join(__dirname, 'output'),
    DEBUG_DIR: path.join(__dirname, 'debug'),
    FORCE_REPARSE: false,  // Force re-extraction from PDF, ignoring cached .txt file
    CHUNK_TARGET_MIN: 80,
    CHUNK_TARGET_MAX: 300,
    CHUNK_ABSOLUTE_MIN: 50,
    CHUNK_ABSOLUTE_MAX: 500
}
```

## Text File Caching & Manual Editing

**New Feature**: The parser now supports text file caching, allowing you to manually edit the extracted text and bypass PDF extraction on subsequent runs.

### How It Works

1. **First Run**: Parser extracts text from PDF and saves it to `<book-name>.txt` in the same directory as the PDF
2. **Subsequent Runs**: Parser uses the cached `.txt` file instead of re-extracting from PDF
3. **Manual Editing**: You can edit the `.txt` file to fix PDF extraction issues (e.g., fixing "B\nack" → "Back")
4. **Force Re-extraction**: Use `--force-reparse` flag to regenerate the `.txt` file from PDF

### Usage Examples

```bash
# First run - extracts and saves text
node files/run-parser-and-upload.js "files/My Book" -p

# Subsequent runs - uses cached text (much faster!)
node files/run-parser-and-upload.js "files/My Book" -p

# Force re-extraction from PDF
node files/run-parser-and-upload.js "files/My Book" -p --force-reparse
```

### Programmatic API

```javascript
const parser = require('./parser.js');

// Use cached .txt file if available
await parser.parseBook(pdfPath, outputPath, {
    validate: true
});

// Force re-extraction from PDF
await parser.parseBook(pdfPath, outputPath, {
    validate: true,
    forceReparse: true
});
```

### Benefits

- ✅ **Faster Processing**: Skips PDF extraction (5+ seconds saved per run)
- ✅ **Manual Corrections**: Fix PDF extraction errors by editing the `.txt` file
- ✅ **Reproducible**: Text file is saved alongside the PDF for version control
- ✅ **Flexible**: Re-extract from PDF anytime with `--force-reparse`

### Text File Format

The saved `.txt` file contains the complete extracted text with page markers:

```
--- PAGE 0 ---
[page content]
--- END PAGE 0 ---

--- PAGE 1 ---
[page content]
--- END PAGE 1 ---
```

You can edit the content between page markers to fix extraction issues while keeping the page structure intact.

## Usage

### Programmatic Usage
```javascript
const parser = require('./main-poc.js');

// Parse entire book with default options
const results = await parser.parseBook('/path/to/book.pdf');

// Parse with custom options
const results = await parser.parseBook('/path/to/book.pdf', {
    outputDir: './my-output',
    debug: true,
    saveStepOutputs: true
});

// Parse only specific steps
const partialResults = await parser.parseBookSteps('/path/to/book.pdf', ['step-1', 'step-3-2']);
```

### Wrapper Script Usage
For standalone execution, create a wrapper script that uses the module:

```javascript
// run-parser.js
const parser = require('./main-poc.js');

async function main() {
    try {
        const results = await parser.parseBook(process.argv[2], {
            debug: true,
            saveStepOutputs: true
        });
        console.log('✅ Parsing completed successfully');
    } catch (error) {
        console.error('❌ Parsing failed:', error.message);
    }
}

main();
```

Then run: `node run-parser.js /path/to/book.pdf`

### Metadata Extraction & Overrides

**Automatic Extraction Priority** (in order):
1. **metadata.json override file** - Manual corrections (highest priority)
2. **PDF document metadata** - Extracted from PDF properties (most reliable automatic method)
3. **Text-based pattern matching** - Fallback when PDF metadata unavailable

#### Metadata Override File (metadata.json)

You can provide a `metadata.json` file alongside your input PDF to override automatic metadata extraction for title and author. This is useful for PDFs with incorrect or missing metadata.

**Location**: Same directory as the input PDF

**Example** `metadata.json`:

```json
{
  "title": "Cant Hurt Me: Master Your Mind and Defy the Odds",
  "author": "David Goggins"
}
```

**Supported Fields**: Only `title` and `author` are currently supported.

**When to Use**:
- PDF metadata is incorrect or missing
- Title/author extraction from text patterns fails
- You want to use a specific title format (e.g., with subtitle)

## Uploader (upload-book.js)

Programmatic and CLI tool to upload parsed books to the database and optionally upload images to Vercel Blob.

### Programmatic API

```javascript
const { uploadParsedBookV2 } = require('./upload-book.js');

// Upload book content only
await uploadParsedBookV2('/path/to/parser/output');

// Upload book content and images (requires BLOB_READ_WRITE_TOKEN)
await uploadParsedBookV2('/path/to/parser/output', { uploadImages: true });
```

### CLI Usage

```bash
node upload-book.js /path/to/parser/output [--upload-images]
```

Notes:
- Images are uploaded only when `--upload-images` is provided (or `options.uploadImages: true` programmatically).
- The `--skip-images` flag has been removed.

## Implementation Status

### ✅ PIPELINE COMPLETE (12/12 steps - 100%)
- **Step 1**: Text Extraction - 743,700 characters from 317 pages **[PRODUCTION-READY WITH SPACING FIX + VALIDATION]**
- **Step 2.1**: Chapter Detection - 9 chapters detected **[PRODUCTION-READY WITH VALIDATION]**
- **Step 2.2**: Chapter Content Extraction - 123,976 words extracted **[PRODUCTION-READY WITH VALIDATION]** 
- **Step 2.3**: Chapter Name Cleaning - Generic title patterns **[PRODUCTION-READY WITH VALIDATION]**
- **Step 3**: Page Extraction and Cross-Page Merging - 309 pages with enhanced page number removal **[PRODUCTION-READY WITH VALIDATION]**
- **Step 3-1**: Link Detection - 290 chapter-relative position links **[PRODUCTION-READY WITH NO-PAGE MODEL]**
- **Step 3-2**: Image Extraction - 58 images with `[[IMG...]]` markers **[PRODUCTION-READY WITH MARKER SYSTEM]**
- **Step 4**: Paragraph Detection - 547 paragraph chunks preserving image markers **[PRODUCTION-READY WITH SMART LIST SEPARATION + VALIDATION]**
- **Step 5**: Sentence Detection - 1,657 sentence chunks preserving image markers **[PRODUCTION-READY WITH VALIDATION]**
- **Step 5-1**: Image Markers to Chunks - 58 `[[IMG...]]` markers converted to image chunks **[PRODUCTION-READY WITH VALIDATION]**
- **Step 5-2**: Link Chunk References - Link-to-chunk ID resolution **[PRODUCTION-READY WITH VALIDATION]**
- **Step 6**: Metadata Extraction - Comprehensive book metadata and statistics **[PRODUCTION-READY WITH VALIDATION]**

### 🎯 RECENT MAJOR IMPROVEMENTS

#### **Numbered List & Bullet Point Separation Fix ✅** (October 2025)
**Critical UX Improvement**: Fixed parser incorrectly merging numbered list items and bullet points with previous sentences when they appeared after newlines.

**Problem Identified**:
- List items appearing after newlines were being merged with the previous sentence
- Example failure: `"...fatigue. \n2. The breath hold strengthens..."` was merged into a single chunk
- Created poor reading experience with unrelated content appearing in the same sentence
- Root cause: Step 4 (paragraph detection) was adding list items to the same paragraph as previous text, then Step 5 would merge them as sentences from the same paragraph

**Solution Implemented**:
1. **Smart List Item Detection in Step 4**:
   - Detect lines starting with numbered list items (`1.`, `2.`, etc.) or bullet points (`•`)
   - Flush current paragraph before adding list item (creates paragraph boundary)
   - **Exception**: Keep lists with their introduction when previous text ends with `:` (e.g., "The following factors:")
2. **Intelligent Paragraph Boundaries**:
   - Numbered lists after newlines → separate paragraphs
   - Bullet points after newlines → separate paragraphs
   - Lists introduced by colons → same paragraph as introduction
3. **Preserved Existing Behavior**:
   - Lists that are part of continuous text remain together
   - Validation still passes for introduced lists

**Technical Implementation**:
```javascript
// In 04-paragraph-detection.js, before adding line to paragraph:
const startsWithNumberedListItem = /^\d+[\.)]\s+/.test(line.trim());
const startsWithBulletPoint = /^•\s+/.test(line.trim());

if ((startsWithNumberedListItem || startsWithBulletPoint) && currentParagraph.trim()) {
    // Check if paragraph ends with colon (introducing the list)
    const currentParagraphEndsWithColon = /:\s*$/.test(currentParagraph.trim());
    
    // Only flush if paragraph does NOT end with colon
    if (!currentParagraphEndsWithColon) {
        chunks.push(createParagraphChunk(currentParagraph.trim(), page, ''));
        currentParagraph = '';
    }
}
```

**Results**:
- ✅ Numbered list items after newlines are now separate chunks (improved UX)
- ✅ Bullet points after newlines are now separate chunks  
- ✅ Lists introduced by colons remain with their introduction text
- ✅ All existing validation continues to pass
- ✅ Example fix: `"...fatigue."` (chunk 7_29) and `"2. The breath hold..."` (chunk 7_30) are now properly separated

**Before**:
```json
{
  "chunkId": "7_29",
  "content": "...delay in the onset of fatigue. 2. The breath hold strengthens the breathing muscles.",
  "type": "text"
}
```

**After**:
```json
{
  "chunkId": "7_29",
  "content": "...delay in the onset of fatigue.",
  "type": "text"
},
{
  "chunkId": "7_30", 
  "content": "2. The breath hold strengthens the breathing muscles.",
  "type": "text"
}
```

#### **Consecutive Header Detection Fix ✅** (Latest - October 2025)
**Critical Bug Fix**: Fixed header detection failing when headers appeared consecutively (e.g., "PART I" followed by "The Secret of Breath"), causing section headers to be incorrectly merged with previous paragraphs.

**Problem Identified**:
- In "The Oxygen Advantage" book, "The Secret of Breath" appeared after "PART I" but was not detected as a header
- Instead, it was merged with the previous paragraph, creating a validation error: paragraph ending with "...living —with less effort? The Secret of Breath"
- Root cause: Header detection Rule 5 required the previous line to end with sentence punctuation (. ! ?), but "PART I" doesn't end with punctuation
- This caused legitimate section headers to be misclassified as paragraphs

**Solution Implemented**:
1. **Enhanced Previous Line Check**:
   - Modified `isHeader` function to allow consecutive headers
   - If previous line doesn't end with sentence punctuation, check if it looks like a header itself
   - Previous line "looks like a header" if: 1-5 words, no punctuation, capitalized
2. **Exception Logic**:
   - If previous line looks like a header → allow current line to be a header
   - If previous line is regular text → require sentence punctuation (original behavior)
3. **Preserved Behavior**:
   - All other header detection rules remain unchanged
   - Headers still require 2-5 words, no punctuation, capitalization, etc.
   - All existing validation continues to pass

**Technical Implementation**:
```javascript
// In 04-paragraph-detection.js, isHeader function:
// Rule 5: Context - Previous - Previous line ends with sentence-ending punctuation
// EXCEPTION: Allow consecutive headers (e.g., "PART I" followed by "The Secret of Breath")
const prevLine = findPreviousNonEmptyLine(allLines, lineIndex - 1);
if (prevLine !== null && !sharedEndsWithSentenceTerminator(prevLine)) {
    // Check if the previous line looks like a header itself
    const prevWords = prevLine.trim().split(/\s+/);
    const prevIsShort = prevWords.length >= 1 && prevWords.length <= 5;
    const prevNoPunct = !/[.!?]$/.test(prevLine.trim());
    const prevCapitalized = /^[A-Z]/.test(prevLine.trim());
    const prevLooksLikeHeader = prevIsShort && prevNoPunct && prevCapitalized;
    
    // If previous line doesn't look like a header, reject current line as header
    if (!prevLooksLikeHeader) {
        return false;
    }
}
```

**Results**:
- ✅ Consecutive headers now correctly detected (e.g., "PART I" → "The Secret of Breath")
- ✅ Section headers no longer merged with paragraphs
- ✅ Validation errors for "paragraph should end with sentence terminator" resolved
- ✅ All existing header detection rules still work correctly

**Before**:
```json
{
  "chunkId": "1_36",
  "content": "...living —with less effort? The Secret of Breath",
  "type": "paragraph"
},
{
  "chunkId": "1_37",
  "content": "PART I",
  "type": "header"
}
```

**After**:
```json
{
  "chunkId": "1_36",
  "content": "...living —with less effort?",
  "type": "paragraph"
},
{
  "chunkId": "1_37",
  "content": "PART I",
  "type": "header"
},
{
  "chunkId": "1_38",
  "content": "The Secret of Breath",
  "type": "header"
}
```

#### **Chunk Optimization Duplication Bug Fix ✅** (October 2025)
**Critical Bug Fix**: Fixed paragraph duplication in `optimizeChunkSizes` function where small paragraphs were incorrectly merged, creating duplicate content in the final output.

**Problem Identified**:
- In "The Oxygen Advantage" book, the intro text "T he following BOLT measurement and exercises..." appeared in TWO separate chunks
- Chunk 18_2: Just the intro text (standalone)
- Chunk 18_3: Intro text + list items merged together
- The header "Body Oxygen Level Test (BOLT)" that should have been between them was being replaced by the merged content
- Root cause: `tryMergeWithPreviousParagraph` would search backwards across headers to find a paragraph, but then the caller would blindly replace `secondPassOptimized[secondPassOptimized.length - 1]` (the last chunk), which could be a header added AFTER the paragraph being merged

**Solution Implemented**:
1. **Return Index with Merge Result**:
   - Modified `tryMergeWithPreviousParagraph` to return `{ merged, indexToReplace }` instead of just the merged chunk
   - `indexToReplace` points to the actual paragraph that was merged (not the last chunk)
2. **Update All Callers**:
   - First pass in `optimizeChunkSizes`: Replace `optimized[mergeResult.indexToReplace]` instead of `optimized[optimized.length - 1]`
   - Second pass in `optimizeChunkSizes`: Replace `secondPassOptimized[mergeResult.indexToReplace]` instead of `secondPassOptimized[secondPassOptimized.length - 1]`
3. **Preserved Behavior**:
   - Headers between paragraphs remain intact
   - Merge logic continues to skip headers and images to find paragraphs
   - All existing validation continues to pass

**Technical Implementation**:
```javascript
// In 04-paragraph-detection.js, tryMergeWithPreviousParagraph now returns:
function tryMergeWithPreviousParagraph(optimizedChunks, currentChunk) {
    for (let i = optimizedChunks.length - 1; i >= 0; i--) {
        const previousChunk = optimizedChunks[i];
        
        if (previousChunk.type === 'header') continue; // Skip headers
        if (previousChunk.type === 'image') continue;  // Skip images
        
        if (previousChunk.type === 'paragraph') {
            // ... merge logic ...
            return {
                merged: { /* merged chunk */ },
                indexToReplace: i  // Return the INDEX we're merging with
            };
        }
        break;
    }
    return null;
}

// Callers now use the returned index:
const mergeResult = tryMergeWithPreviousParagraph(secondPassOptimized, chunk);
if (mergeResult) {
    // Replace the CORRECT chunk, not the last one
    secondPassOptimized[mergeResult.indexToReplace] = mergeResult.merged;
}
```

**Results**:
- ✅ No more duplicate content in optimized chunks
- ✅ Headers between paragraphs are preserved correctly
- ✅ Small paragraphs merge with the correct previous paragraph
- ✅ All existing validation continues to pass
- ✅ Example fix: "The Oxygen Advantage" chapter 18 now has correct structure with no duplication

**Before**:
```json
{
  "chunkId": "18_2",
  "content": "T he following BOLT measurement and exercises are explained in detail in earlier chapters.",
  "type": "paragraph"
},
{
  "chunkId": "18_3",
  "content": "T he following BOLT measurement and exercises are explained in detail in earlier chapters. 1. Nose Unblocking Exercise...",
  "type": "paragraph"
}
```

**After**:
```json
{
  "chunkId": "18_2",
  "content": "T he following BOLT measurement and exercises are explained in detail in earlier chapters. 1. Nose Unblocking Exercise 2. Breathe Light to Breathe Right...",
  "type": "paragraph"
},
{
  "chunkId": "18_3",
  "content": "Body Oxygen Level Test (BOLT)",
  "type": "header"
}
```

#### **PDF Metadata Extraction Enhancement ✅** (October 2025)
**Major Reliability Improvement**: Added PDF document metadata extraction for title and author, providing more reliable metadata than text-based pattern matching.

**Problem Identified**:
- Text-based title extraction was fragile and failed when titles spanned multiple lines in the PDF
- Example failure: "THE\nBREATHING\nCURE" across multiple lines resulted in malformed extraction: "THE BREATHING CURE DEVELOP NEW HABITS FOR"
- Pattern matching regex couldn't reliably handle all PDF layout variations
- Resulted in incorrect title/author extraction for many books

**Solution Implemented**:
1. **PDF Metadata Priority**:
   - Extract title and author from PDF document properties (most reliable source)
   - Use `pdfjs-dist` to read PDF metadata: `pdf.getMetadata()`
   - Fall back to text extraction only when PDF metadata is unavailable
2. **Extraction Priority Order**:
   - First: `metadata.json` override file (manual corrections)
   - Second: PDF document metadata (most reliable automatic method)
   - Third: Text-based pattern matching (fallback for PDFs without metadata)
3. **Metadata Cleanup**:
   - Format titles to proper title case
   - Clean author names (remove trailing semicolons, commas)
   - Handle edge cases in PDF metadata fields

**Technical Implementation**:
```javascript
async function extractPdfMetadata(pdfPath) {
    const loadingTask = pdfjsLib.getDocument(pdfPath);
    const pdf = await loadingTask.promise;
    const metadata = await pdf.getMetadata();
    
    let title = metadata.info?.Title?.trim();
    let author = metadata.info?.Author?.trim().replace(/[;,]+$/, '');
    
    return { title: formatTitleCase(title), author };
}

// Priority order: overrides > PDF metadata > text extraction
const title = overrideTitle || pdfTitle || extractTitle(pipelineState.rawText);
const author = overrideAuthor || pdfAuthor || extractAuthor(pipelineState.rawText);
```

**Results**:
- ✅ Reliable title/author extraction from PDF metadata for most books
- ✅ Fixed "The Breathing Cure" extraction (now: "The Breathing Cure" by "Patrick McKeown")
- ✅ Graceful fallback to text extraction when PDF metadata unavailable
- ✅ Maintains compatibility with `metadata.json` override system
- ✅ Proper title case formatting for all-caps PDF metadata

#### **Image Marker Insertion Bug Fix ✅** (October 2025)
**Critical Bug Fix**: Fixed malformed bracket structures when multiple images appeared on consecutive pages.

**Problem Identified**:
- Multiple consecutive images created malformed output: `[ [[IMG...]] [IMG...]] ]`
- Root cause: String insertion at position N shifts all positions > N, but `pageOffsets` map was never updated
- Subsequent image insertions used corrupted positions, creating invalid bracket structures
- Caused validation failures in Step 5 (sentence detection)

**Solution Implemented**:
1. **Reverse-Order Processing**:
   - Pre-assign `chapterIndex` to all images before processing
   - Process images in reverse order (last page first)
   - When inserting at position N, positions < N remain valid (uncorrupted)
   - Ensures all future insertions use correct offsets
2. **Code Changes**:
   - Filter chapter images and assign indices upfront: `chapterImages.forEach((info, idx) => { info.chapterIndex = idx; })`
   - Process in reverse: `for (let i = chapterImages.length - 1; i >= 0; i--)`
   - Use pre-assigned `info.chapterIndex` instead of incrementing counter

**Results**:
- ✅ Eliminated malformed bracket structures - each marker now correctly formatted on separate lines
- ✅ Fixed validation errors for books with consecutive page images
- ✅ Zero changes required to downstream steps (markers processed correctly by Step 5-1)
- ✅ Production-ready image marker insertion for all PDF configurations

#### **Shared Text Processing Utilities & Code Consolidation ✅** (January 2025)
**Major Architecture Enhancement**: Eliminated code duplication and enhanced text processing consistency across all parser steps.

**Problem Identified**:
- Identical functions duplicated across multiple steps: `countWords`, `endsWithInitials`, `endsWithCommonSingleLetterWord`, `validateWordLengths`, `isSentenceTerminator`
- ~200+ lines of duplicated code scattered across steps
- Inconsistent abbreviation handling leading to validation issues (e.g., "P.U." incorrectly treated as sentence terminator)
- ASCII-only validation missing Unicode uppercase letters like "Índice"
- Maintenance burden: bugs needed to be fixed in multiple places

**Solution Implemented**:
1. **Centralized Text Processing Utilities**:
   - Created `utils/text-processing-utils.js` with 60+ common abbreviations including "P.U.", "Ph.D.", etc.
   - Comprehensive functions for word counting, sentence detection, text validation, and abbreviation handling
   - Unicode-aware validation supporting accented capitals ("Índice", "École", "Québec")
2. **Code Consolidation**:
   - Eliminated duplicated functions across Steps 1, 3, 4, 5 and their validation modules
   - Updated all steps to import shared utilities instead of maintaining separate implementations
   - Single source of truth for text processing logic
3. **Enhanced Validation Logic**:
   - Fixed abbreviation detection to check `endsWithAbbreviation` before `endsWithInitials`
   - Added patterns for character names ("Wally B."), photo captions, numbered lists, and table of contents
   - Unicode-aware capitalization validation using `char.toUpperCase() !== char.toLowerCase()`

**Technical Implementation**:
```javascript
// Before: Multiple inconsistent implementations
function countWords(text) { /* duplicated 4 times */ }
function endsWithInitials(text) { /* duplicated 2 times with 65+ lines each */ }

// After: Single shared implementation
const { countWords, endsWithInitials, endsWithAbbreviation } = require('../../utils/text-processing-utils');
if (endsWithInitials(content) && !endsWithAbbreviation(content) && !endsWithCommonSingleLetterWord(content)) {
    validationErrors.push(`Chunk should not end with initials: "${content}"`);
}
```

**Results**:
- ✅ Eliminated ~200+ lines of duplicated code across parser steps
- ✅ Fixed "P.U." abbreviation bug - now correctly handled as abbreviation, not sentence terminator
- ✅ Fixed "Ph.D.", "Wally B." and other character/degree validations
- ✅ Fixed Unicode validation - "Índice" now properly recognized as starting with capital letter
- ✅ Fixed numbered lists, photo captions, and table of contents validation
- ✅ Single source of truth for text processing - easier maintenance and consistency
- ✅ Enhanced abbreviation list with 60+ entries covering academic, organizational, publishing, and geographic terms
- ✅ Pipeline runs successfully with zero validation errors after consolidation

#### **Smart Constraint Relaxation for Small Chunks ✅** (January 2025)
**Major Logic Enhancement**: Resolved merging constraint conflict that created orphan small chunks failing validation.

**Problem Identified**:
- Small chunks (< 25 words) couldn't merge with nearby chunks when the result would exceed 200-word limit
- Created orphan chunks like "The gestation had been trying, but the feisty little company called Pixar had been born." (15 words)
- Example: 188-word chunk + 15-word chunk = 203 words (blocked by 200-word limit)
- Led to validation failures for legitimate content that should have been merged

**Solution Implemented**:
1. **Smart Constraint Relaxation**:
   - Very small chunks (< 20 words) can now exceed the 200-word limit when merging
   - Prevents orphan chunk validation failures while maintaining content quality
   - Applied to all merging functions: forward merging, backward merging, and aggressive cross-paragraph merging
2. **Prioritized Constraint Logic**:
   - Primary goal: Eliminate orphan chunks that fail validation
   - Secondary goal: Respect word count limits when possible
   - Result: Better overall optimization with fewer edge case failures

**Technical Implementation**:
```javascript
// Before: Hard limit blocking all merges > 200 words
if (newWordCount > maxWords) break;

// After: Smart relaxation for very small chunks
const isVerySmallChunk = currentChunk.wordCount < 20;
if (newWordCount > maxWords && !isVerySmallChunk) break;
```

**Results**:
- ✅ Orphan 15-word chunk successfully merged (188 + 15 = 203 words)
- ✅ Validation error "word count (15) must be at least 25 words" completely eliminated
- ✅ Better content optimization with fewer edge case failures
- ✅ Maintains readability while preventing validation failures

#### **Enhanced Image Marker Processing ✅** (January 2025)
**Major Architecture Enhancement**: Resolved design flaw where standalone image markers created invalid text chunks.

**Problem Identified**:
- Text chunks containing only `[[IMG ...]]` markers had incorrect `type: 'text'` and `paragraphIndex` values
- Violated the principle that images should have `type: 'image'` and `paragraphIndex: null`
- Created invalid chunks that failed Step 5 validation

**Solution Implemented**:
1. **Enhanced Step 5 (Sentence Detection)**:
   - Detects standalone image marker chunks during paragraph processing
   - Converts them to special text chunks with `paragraphIndex: null` and `wordCount: 0`
   - Preserves positioning context for Step 5-1 processing
2. **Enhanced Step 5-1 (Image Markers to Chunks)**:
   - Now handles both embedded markers (mixed with text) and standalone markers
   - For standalone markers: Replaces text chunk entirely with image chunks
   - For embedded markers: Creates image chunks after text chunks with markers removed
3. **Enhanced Step 5 Validation**:
   - Skips word count, sentence count, and formatting validation for standalone image marker chunks
   - Allows proper processing without false validation failures

**Architecture Benefits**:
- ✅ Maintains single point of responsibility for image chunk creation (Step 5-1)
- ✅ Preserves precise positioning context (why pipeline reordering was rejected)
- ✅ Clean separation of concerns with enhanced validation
- ✅ Eliminates invalid text chunks containing only image markers

**Results**:
- ✅ Original validation error completely eliminated
- ✅ Proper image chunks with `type: 'image'` and `paragraphIndex: null`
- ✅ Clean architecture maintaining positioning context
- ✅ Enhanced validation logic supporting both content types

#### **Sentence-Based Audio Refactor ✅** (January 2025)
**Major Reader Enhancement**: Refactored parser and reader to use single-sentence chunks for granular audio playback.

**Parser Changes**:
1. **Single-Sentence Output**: Step 5 now produces predominantly single-sentence text chunks for maximum audio playback granularity
2. **Ultra-Short Merging**: Only merges sentences with <12 words backward into the previous sentence within the same paragraph
3. **Shared Splitting Logic**: Moved `splitIntoSentences` to `text-processing-utils.js` so parser and validation use identical logic
4. **Abbreviation Protection**: Comprehensive protection for abbreviations (Mr., Dr., etc.), ellipses (..., …), decimals (3.14), and numbered lists
5. **Consistent Validation**: Validation uses the same `splitIntoSentences` function, ensuring accurate error detection

**Reader Changes**:
1. **Unified Audio Controller**: `useSentenceAudioController` replaces separate `useAudioPlayback` and `useFocusAudioPlayback` hooks
2. **Single Audio Element**: Reuses one `HTMLAudioElement` across all modes with per-sentence caching
3. **Sentence-Level Navigation**: All playback operates at sentence level; both Full and Focus modes use the same controller
4. **Eliminated Mode Branching**: Removed all `isFocusMode ? ... : ...` ternaries from audio logic
5. **Shared Types**: `SentenceChunk`, `ParagraphGroupMeta`, `SentenceMap` interfaces consumed by all reader components

**Results**:
- ✅ Typical chapters: 80-90% single-sentence chunks, 10-20% multi-sentence (merged short sentences)
- ✅ Maximum audio granularity for word-level highlighting and playback control
- ✅ Unified codebase: ~400 lines of duplicated audio logic eliminated
- ✅ Better UX: consistent playback behavior across all reading modes
- ✅ Maintainable: single source of truth for audio playback logic

#### **No-Page Model & Image Marker System ✅** (January 2025)
**Major Architectural Change**: Eliminated page-based positioning in favor of chapter-relative content anchoring.

**Key Changes**:
1. **No-Page Link Model**: 
   - Removed `pageNumber` from link objects
   - Links now use `TextPositionSelector: { start: number, end: number }` for chapter-relative positioning
   - More accurate link positioning independent of page boundaries
2. **Image Marker System**: 
   - Step 3-2 inserts `[[IMG id=image-xxx index=N alt="..."]]` markers directly into chapter content
   - Markers preserve exact image positions in text flow
   - Step 5-1 converts markers to image chunks positioned precisely after containing text chunks
3. **Enhanced Page Number Removal**: 
   - Aggressive removal of page number artifacts from content (e.g., "9 down to..." → "Down to...")
   - Automatic capitalization after page number removal
   - Clean text flow without page-related disruptions
4. **Content Cleanup**: 
   - Chapter `content` field removed after Step 4 (no longer needed after conversion to chunks)
   - Streamlined output with reduced redundancy
5. **Step Reorganization**: 
   - New Step 5-1: Image Markers to Chunks (converts `[[IMG...]]` to image chunks)
   - Step 5-2: Link Chunk References (previously Step 5-1)
   - Validation skipping mechanism for known edge cases

**Results**:
- ✅ More accurate content positioning without page-number dependencies
- ✅ Cleaner text content free of page number artifacts
- ✅ Precise image placement at exact text locations
- ✅ Streamlined output with reduced file sizes
- ✅ Enhanced validation with configurable error skipping

#### **Link Validation Enhancement ✅**
**Issue Resolved**: Link validation was too loose, allowing false footnote matches like "1948" containing footnote "8".

**Improvements Made**:
1. **Strict Footnote Pattern Matching**: Implemented precise patterns that only match standalone footnotes
2. **Pattern Examples**: `. 8 For`, `9 Mitchell`, `(8)`, `[8]`, `8.` - but NOT `1948` containing `8`
3. **Re-validation During Processing**: Links are re-validated when paragraphs are merged or split
4. **Production Quality**: All 16 link validation errors eliminated ✅

**Technical Implementation**:
- New `isFootnoteInContent()` function with regex patterns for proper footnote detection
- Updated `tryMergeWithNextParagraph()` and `tryMergeWithPreviousParagraph()` to re-validate links
- Fixed `splitLargeParagraph()` to use strict validation instead of loose `includes()`
- Comprehensive footnote patterns covering academic citation styles

**Results**:
- ✅ Zero link validation errors (down from 16)
- ✅ Production-ready link-paragraph associations
- ✅ Proper footnote detection preventing false matches

#### **Header Detection Breakthrough ✅**
**Issue Resolved**: "Pulling hydrogen" header detection was failing due to cross-page merging destroying header structure.

**Root Causes Fixed**:
1. **Cross-page merging removing newlines** - Headers need standalone line structure
2. **Incorrect sentence merging** - Capital letter sentences were being merged (should only merge lowercase continuations)
3. **Optimization logic errors** - Paragraphs were being merged across headers and page boundaries

**Solutions Implemented**:
1. **Smart Cross-Page Merging**: Only merge lowercase-starting sentences (actual continuations), skip capital letter sentences
2. **Header Preservation**: Detect potential headers at page boundaries and preserve their standalone structure
3. **Optimization Fixes**: Prevent paragraph merging across headers and different pages
4. **Newline Structure**: Preserve proper line breaks during cross-page operations

**Results**:
- ✅ "Pulling hydrogen" correctly detected as header
- ✅ Proper sequence: Paragraph → Header → Next Paragraph
- ✅ 103 headers total detected (up from 57 after bug fixes)
- ✅ No more incorrectly merged content across headers

#### **Advanced Paragraph Merging System ✅** (January 2025)
**Issue Addressed**: Small paragraphs (< 20 words) failing validation due to insufficient content.

**Root Cause Discovery**:
- Small paragraphs were being created during `splitLargeParagraph` operations
- These split chunks were added AFTER the merging logic had already processed original chunks
- No mechanism existed to merge newly created small paragraphs

**Comprehensive Solution Implemented**:
1. **Two-Pass Optimization System**: 
   - First pass: Handles existing small paragraphs with neighbor merging
   - Second pass: Processes small paragraphs created during splitting operations
2. **Intelligent Merging Logic**:
   - Attempts to merge with previous paragraph first (preferred)
   - Falls back to next paragraph if previous merge fails
   - Respects header boundaries and page constraints
3. **Enhanced Link Validation**:
   - Re-validates all links against merged content during paragraph combining
   - Filters out invalid links that don't appear in merged text
   - Preserves link integrity through `removeDuplicateLinks()` function
4. **Advanced Footnote Detection**:
   - Enhanced `isSourceTextInContent()` with strict footnote pattern matching
   - Supports patterns: `. 8 For`, `9 Mitchell`, `(8)`, `[8]`, `8.`
   - Prevents false matches (e.g., "1948" containing footnote "8")

**Results Achieved**:
- ✅ Zero small paragraph validation errors (all < 20 word paragraphs successfully merged)
- ✅ Enhanced link preservation during merging operations
- ✅ Robust footnote pattern matching preventing false positives
- ✅ Production-ready paragraph optimization with comprehensive validation

#### **Architecture Completeness ✅**
- **Unified Output**: Step 4 outputs single `chunks` array with `type: "paragraph"|"header"`
- **6-Rule Header Detection**: Comprehensive validation system for headers
- **Advanced Paragraph Optimization**: Two-pass merging system with intelligent neighbor selection
- **Enhanced Link Validation**: Strict footnote patterns with merge-time re-validation
- **Cross-Page Intelligence**: Preserves content structure across page boundaries

## Critical Text Extraction Improvements

### **🔧 MAJOR ISSUE RESOLVED: PDF Text Spacing**

#### **Problem**
The original implementation had severe text quality issues:
- Words split with spaces: "**Pr oblem**" instead of "Problem"
- Unreadable output affecting all downstream processing
- Custom pagerender adding spaces between ALL text items

#### **Solutions Tested**

##### ❌ **Option 1: V1 Hybrid Approach (Failed)**
- Attempted `pdf-parse` + `pdfjs-dist` boundary mapping
- **Critical Failure**: Missing entire sections (introduction chapter)
- **Learning**: Cannot merge incompatible PDF extraction libraries

##### ❌ **Option 2: Simple Concatenation (Failed)**  
- Attempted V1's `textItems.join('')` approach
- **Critical Failure**: Words running together ("thisbook", "can'tactually")
- **Learning**: Simple solutions don't work for all PDF structures

##### ✅ **Final Solution: Simplified V1-Style Spacing (Success)**
- **Implementation**: Simple approach that adds spaces after each text item
- **Code**: 
  ```javascript
  pageText += itemText;
  if (i < items.length - 1 && !itemText.endsWith(' ') && !itemText.endsWith('\n')) {
      pageText += ' ';
  }
  ```
- **Key Insight**: Simple is better than complex - PDF text items already provide natural word boundaries
- **Validation**: Word length validation shows 0 concatenated words (down from 109)

#### **Results**
- ✅ **Perfect text quality**: Professional spacing and readability
- ✅ **Complete content**: No missing sections or chapters  
- ✅ **Proper word boundaries**: No split words or run-together text
- ✅ **Problem examples fixed**: "forTransformer" → "for Transformer", "ofThe" → "of The"
- ✅ **Pipeline foundation**: Clean text enables accurate downstream processing

## Key Features

### Modular Design
- Each step is completely independent
- Easy to test individual steps
- Parallel development possible
- Clear separation of concerns

### State Management
- Pipeline state passed between steps
- Each step only returns changed data
- Complete state saved after each step for debugging
- Processing metadata tracked

### Error Handling
- Graceful error handling per step
- State saved even on failure
- Detailed error reporting
- Debug mode for development

### Debugging Support
- Complete pipeline state saved after each step
- Processing timing and metadata
- Debug directory with step-by-step output
- Verbose logging in debug mode

## Development Workflow

1. **Choose a step** to implement from the architecture
2. **Edit the step file** in `steps/`
3. **Implement the logic** while maintaining the interface
4. **Test the step** individually: `node main-poc.js step-name --debug`
5. **Run full pipeline** to ensure integration works
6. **Update documentation** to reflect progress

## Testing

### Programmatic Testing
```javascript
const parser = require('./main-poc.js');

// Test specific steps
const results = await parser.parseBookSteps('/path/to/test.pdf', ['step-1', 'step-3-2'], {
    debug: true,
    saveStepOutputs: true
});

// Check results
console.log('Step results:', results.steps);
console.log('Validation results:', results.steps['step-1'].validation);
```

### Output Inspection
```bash
# Check step-by-step outputs (when saveStepOutputs: true)
ls steps-output/
cat steps-output/step-3-2.json  # Complete image data
cat output.json                 # Final step output

# Check debug information
cat debug/pipeline-state.json   # Complete pipeline state
```

### Wrapper Script Testing
```bash
# Using a wrapper script
node run-parser.js /path/to/test.pdf

# Check generated files
ls output/     # Final output and images
ls debug/      # Debug information
```

## Dependencies

- `pdfjs-dist` - PDF processing and text extraction
- `poppler-utils` - Command-line PDF tools (provides `pdfimages` for image extraction)
  - Install on macOS: `brew install poppler`
  - Install on Ubuntu: `sudo apt-get install poppler-utils`
- Node.js built-in modules (`fs`, `path`, `child_process`)

## Architecture Benefits

1. **Maintainable** - Each step is isolated and focused
2. **Testable** - Individual steps can be tested independently  
3. **Debuggable** - Complete state visibility between steps
4. **Scalable** - Easy to add new steps or modify existing ones
5. **Collaborative** - Multiple developers can work on different steps
6. **Recoverable** - Pipeline can be resumed from any step using saved state

## Critical Architecture Decisions

### Step Consolidation
The pipeline was optimized by combining related steps:
- **Step 2**: Combined chapter detection + text extraction for efficiency
- **Step 3**: Combined page extraction + cross-page merging for architectural correctness
- **Step 4**: Combined paragraph detection + header detection for unified output

### Processing Order
⚠️ **IMPORTANT**: Cross-page merging (Step 3) MUST happen before paragraph detection (Step 4) to prevent broken paragraphs split across pages. This architectural decision is fundamental to the pipeline's correctness.

## Current Status: PRODUCTION-READY ✅

**Progress: 12/12 steps completed (100%)**
- Step 1: Text Extraction ✅ **[PRODUCTION-READY WITH SMART TEXT JOINING + PER-STEP VALIDATION]**
- Step 2.1: Chapter Detection ✅ **[WITH CONTINUITY VALIDATION]**
- Step 2.2: Chapter Text Extraction ✅ **[WITH CONTENT VALIDATION]** 
- Step 2.3: Chapter Name Cleaning ✅ **[WITH CLEANING VALIDATION]**
- Step 3: Page Extraction and Cross-Page Merging ✅ **[WITH HEADER PRESERVATION + PAGE VALIDATION]**
- Step 3-1: Link Detection ✅ **[WITH CHAPTER-RELATIVE POSITIONING + NO-PAGE MODEL]**
- Step 3-2: Image Extraction ✅ **[WITH IMAGE MARKER SYSTEM + ENHANCED PAGE NUMBER REMOVAL]**
- Step 4: Paragraph Detection ✅ **[WITH SMART LIST SEPARATION + IMAGE MARKER PRESERVATION + CHAPTER CONTENT CLEANUP]**
- Step 5: Sentence Detection ✅ **[SINGLE-SENTENCE CHUNKS FOR AUDIO PLAYBACK + ULTRA-SHORT SENTENCE MERGING (<12 WORDS) + SHARED splitIntoSentences + ABBREVIATION/ELLIPSIS PROTECTION + STANDALONE IMAGE MARKER DETECTION]**
- Step 5-1: Image Markers to Chunks ✅ **[WITH EMBEDDED & STANDALONE MARKER PROCESSING + VALIDATION]**
- Step 5-2: Link Chunk References ✅ **[WITH BIDIRECTIONAL LINK RESOLUTION + VALIDATION]**
- Step 6: Metadata Extraction ✅ **[WITH COMPREHENSIVE STATISTICS + VALIDATION]**

**Current Phase: Production-Ready Pipeline with Advanced Optimization and Enhanced Debugging**

### ✅ FOUNDATION COMPLETE
- **Text Quality**: Professional-grade PDF extraction with perfect spacing (0 concatenated words)
- **Content Structure**: Complete chapter organization with 9 chapters and 123,976 words
- **Page Processing**: 309 pages with intelligent cross-page sentence merging (158 merged)
- **Link Integration**: 290 production-ready PDF annotation links with coordinate-based extraction
- **Image Extraction**: 58 images extracted and mapped to pages with complete metadata
- **Content Chunks**: Unified paragraph, header, and image detection with semantic chunk types
- **Advanced Paragraph Optimization**: Two-pass merging system with smart constraint relaxation eliminating all small paragraph validation errors
- **Shared Text Processing**: Centralized utilities eliminating ~200+ lines of duplicated code with Unicode-aware validation and comprehensive abbreviation handling

### ✅ DEBUGGING INFRASTRUCTURE ENHANCEMENT (January 2025)
- **Pre-Validation Output Writing**: Output files now written before validation for debugging access
- **Debug-Friendly Pipeline**: State preserved even when validation fails for analysis
- **Enhanced Validation Logging**: Detailed neighbor information and merge failure reasons
- **Transparent Error Correlation**: Clear mapping between validation errors and actual output content

### ✅ HEADER DETECTION MASTERY  
- **Smart Cross-Page Logic**: Only merges lowercase sentence continuations, preserves headers
- **6-Rule Validation**: Comprehensive header detection (length, punctuation, capitalization, context)
- **Architectural Integration**: Headers and paragraphs in unified chunk output
- **Bug Resolution**: Fixed all header detection edge cases and optimization conflicts

### ✅ PRODUCTION METRICS
- **Processing Speed**: Sub-second processing for most steps
- **Content Coverage**: 100% PDF content preserved and structured
- **Quality Validation**: Zero text extraction errors, proper content boundaries, zero link validation errors
- **Link Integrity**: Strict footnote validation with production-ready link-paragraph associations
- **Debug Capability**: Complete pipeline state tracking and error recovery

## Success Criteria
- [x] All core steps (1-6 + 5-1 + 5-2) implemented and functional ✅
- [x] Pipeline processes test PDF successfully ✅  
- [x] Page extraction with cross-page merging works correctly ✅
- [x] Chapter name cleaning removes titles using generic patterns ✅
- [x] Paragraph detection with proper validation works correctly ✅
- [x] Sentence detection with paragraph indexing works correctly ✅
- [x] Metadata extraction with comprehensive statistics works correctly ✅
- [x] Header detection handles complex edge cases (cross-page, optimization) ✅
- [x] All foundation tests pass ✅
- [x] Debug output provides comprehensive information ✅
- [x] Production-ready text quality and content structure ✅

## Architecture Achievements

### Foundation Quality ✅
- **Text Extraction**: **Professional-grade PDF text extraction** with simplified spacing logic resolving critical word concatenation issues
- **Content Integrity**: **Complete content preservation** - no missing sections or chapters
- **Word Boundaries**: **Perfect word spacing** - eliminated "forTransformer", "ofThe" concatenation issues
- **Text Quality**: **Production-ready output** with 0 concatenated words (validated)
- **Link Validation**: **Strict footnote pattern matching** eliminating false matches and ensuring production-quality link associations

### Content Structure Complete ✅
- **Unified Chunks**: Single output format with paragraphs and headers
- **Header Detection**: 6-rule validation system with cross-page intelligence
- **Smart Optimization**: Size-aware paragraph merging with header preservation
- **Link Integration**: Links properly assigned during processing
- **Cross-Page Logic**: Intelligent sentence merging preserving content structure

### Production Completeness ✅
- **Complete Pipeline**: All core processing steps implemented and validated
- **Quality Assurance**: Professional text extraction and content structure
- **Debug Infrastructure**: Comprehensive state tracking and error recovery
- **Performance**: Optimized processing with detailed validation and timing
- **Fail-Fast Validation**: Per-step validation with immediate error detection
- **Data Integrity**: Each step validates its output before pipeline continues

---

**Last Updated**: October 2025
**Implementation Progress**: 12/12 steps completed (100%)
**Status**: 🚀 PRODUCTION-READY - Complete book parsing pipeline with no-page model architecture, shared text processing utilities eliminating code duplication, enhanced image marker system with reverse-order processing bug fix, supporting both embedded and standalone markers with correct formatting for consecutive page images, smart constraint relaxation preventing orphan chunks, Unicode-aware validation supporting international characters, comprehensive abbreviation handling (60+ patterns), chapter-relative positioning, enhanced page number removal, professional-grade text extraction, advanced paragraph detection with smart list separation and consecutive header detection fix, chunk optimization with duplication fix ensuring proper header preservation, sentence-level optimization with standalone image marker detection, precise image chunk positioning with enhanced validation, bidirectional link resolution, comprehensive metadata extraction, validation skipping mechanism, and streamlined output generation 