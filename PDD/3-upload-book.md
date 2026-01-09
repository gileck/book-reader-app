# 3. Upload Book

## Purpose

The Upload Book page enables users to add new PDF books to their library by uploading files or providing URLs. The system automatically parses PDFs to extract chapters, validates the structure, and prepares books for reading with a preview-before-finalize workflow.

## Design/Layout

**Page Structure:**
- Two-panel layout:
  - Left panel: Upload form and recent uploads list
  - Right panel: Preview pane (appears when content ready)

**Upload Form:**
- Tab toggle: "File Upload" | "URL Upload"
- **File Upload mode:**
  - Large drag-and-drop zone with dashed border
  - Cloud upload icon
  - "Drag and drop PDF file here or click to browse"
  - File size limit display: "Maximum size: 100MB"
- **URL Upload mode:**
  - Text input field with URL icon
  - Placeholder: "Enter PDF URL (e.g., https://example.com/book.pdf)"
  - "Upload" button (disabled until valid URL entered)

**Recent Uploads List:**
- Scrollable list of upload cards, each showing:
  - Filename
  - Status badge (Uploading, Parsing, Awaiting Approval, Success, Failed)
  - Progress bar (for uploading/parsing states)
  - Action buttons based on status
  - Timestamp

**Upload Status States:**

1. **Uploading:**
   - Blue progress bar (0-100%)
   - Animated upload icon
   - "Uploading... 47%" text
   - "Cancel" button

2. **Parsing:**
   - Step-by-step progress display:
     - "Extracting text..." (animated spinner)
     - "Detecting chapters..." (animated spinner)
     - "Validating structure..." (animated spinner)
   - Overall progress: "Step 2 of 3"
   - Cannot be cancelled (too late)

3. **Awaiting Approval:**
   - Warning badge (orange/yellow)
   - "Validation issues found" message
   - Issue count: "12 validation errors"
   - Action buttons:
     - "View Issues" (opens validation dialog)
     - "Approve Anyway"
     - "Restart Upload"

4. **Success:**
   - Green checkmark badge
   - "Ready to preview" message
   - "Preview" button (prominent, green)
   - "Add to Library" button

5. **Failed:**
   - Red X badge
   - Error message (e.g., "Failed to extract text - corrupted PDF")
   - Action buttons:
     - "View Details"
     - "Retry"
     - "Delete"

**Preview Dialog:**
- Modal overlay (full-screen on mobile, 80% width on desktop)
- Three tabs:
  1. **Chapters Tab:**
     - List of detected chapters with numbers and titles
     - Page ranges per chapter
     - Total chapter count
  2. **Metadata Tab:**
     - Detected book title
     - Detected author (if found)
     - Total pages
     - File size
     - Upload date
  3. **Sample Content Tab:**
     - First few paragraphs of Chapter 1
     - Formatting preview
     - Image detection indicator
- Bottom action bar:
  - "Back" button (left)
  - "Finalize & Add to Library" button (right, prominent)

**Validation Dialog:**
- List of issues with severity icons:
  - Red X: Critical (e.g., "No chapters detected")
  - Yellow !: Warning (e.g., "Chapter 5 has only 3 sentences")
  - Blue i: Info (e.g., "Some pages have no text")
- Each issue shows:
  - Severity level
  - Description
  - Affected chapter/page numbers
- Options at bottom:
  - "Continue with Issues" (adds anyway)
  - "Cancel Upload"

## User Interactions

**Uploading via File:**
1. User lands on Upload Book page
2. User drags PDF file onto drop zone
3. Drop zone highlights with accent color border
4. User releases file
5. Upload card appears in recent list with progress bar
6. Progress bar fills as file uploads (real-time updates)
7. Status changes to "Parsing" when upload completes
8. Step indicators show parsing progress
9. Status changes to "Success" or "Awaiting Approval" when done

**Uploading via URL:**
1. User switches to "URL Upload" tab
2. User pastes URL into input field
3. Input validates URL format (shows red border if invalid)
4. "Upload" button enables
5. User clicks "Upload"
6. Upload card appears with "Downloading from URL" status
7. Download progress shows (if supported by server)
8. Continues to parsing step automatically

**Handling Validation Errors:**
1. Upload finishes with "Awaiting Approval" status
2. User clicks "View Issues"
3. Validation dialog opens
4. User reviews 12 errors:
   - 2 critical: "Chapter 8 and 15 have no content"
   - 7 warnings: "Chapters with < 10 sentences"
   - 3 info: "Images could not be extracted"
5. User decides issues are acceptable
6. User clicks "Continue with Issues"
7. Confirmation prompt: "Are you sure? Book may not read properly."
8. User confirms
9. Status changes to "Success"
10. Preview button appears

**Previewing Before Finalization:**
1. User clicks "Preview" on successful upload
2. Preview modal opens showing Chapters tab
3. User reviews detected chapters (24 chapters found)
4. User switches to Sample Content tab
5. Reads first few paragraphs to verify extraction quality
6. Formatting looks good, text is readable
7. User switches to Metadata tab
8. Sees detected title and author are correct
9. User clicks "Finalize & Add to Library"
10. Modal shows "Adding to library..." spinner
11. Success message appears
12. User redirected to Book Library page
13. New book appears in library with 0% progress

**Managing Upload Failures:**
1. Upload fails with error: "Could not extract text from PDF"
2. User clicks "View Details"
3. Detailed error modal shows:
   - Error code: ERR_PDF_ENCRYPTED
   - Message: "This PDF is password protected"
   - Suggestion: "Please remove password protection and retry"
4. User clicks "Delete" to remove failed upload
5. Card fades out
6. User uploads corrected file

**Monitoring Multiple Uploads:**
1. User uploads 3 books simultaneously
2. All three appear in recent uploads list
3. Each shows independent progress
4. First completes parsing (Success)
5. Second still parsing at "Detecting chapters..."
6. Third still uploading at 65%
7. User can preview/finalize first while others continue

**Real-Time Updates (Server-Sent Events):**
- Parsing progress updates push automatically every 2-3 seconds
- No manual refresh needed
- Live step updates: "Extracting text" → "Detecting chapters" → "Validating"
- Error notifications push immediately when failures occur

---

## Chapter Detection Algorithm

### Detection Strategy

The system uses a **4-step hybrid approach** to detect chapters:

**1. PDF Bookmark Extraction (Primary Method)**
- Extracts table of contents from PDF outlines/bookmarks
- Recursively traverses bookmark tree structure
- **Filters out structural bookmarks:** Cover, Title Page, Contents, Copyright, Dedication, Acknowledgments, Photo Insert
- Most reliable when PDF has embedded TOC

**2. Text-Based TOC Analysis (Fallback)**
- Triggered when PDF bookmarks missing or <2 chapters found
- Scans first 150 lines for table of contents entries
- Pattern matching: `(\d+)\s+(.+?)\s+(\d+)$` (chapter number, title, page number)
- Validates TOC position (typically pages 3-15)

**3. Pattern-Based Detection (Fallback)**
- Detects from text patterns:
  - Numbered chapters: "Chapter 1", "CHAPTER ONE", "1. Introduction"
  - Section headers with ALL-CAPS or Title Case
  - Dotted numbers: "1.1 Overview"
- Validates sequence continuity (no gaps beyond ±2 chapters)

**4. Page Marker Analysis**
- Uses `--- PAGE XXX ---` markers inserted during text extraction
- Maps chapters to page ranges
- Finds TOC end position (where content starts, typically pages 8-15)

### Chapter Numbering

- **Sequential numbering:** Chapters assigned 0, 1, 2, 3... (0-based)
- **No gaps allowed:** Sequence must be continuous
- **Sorted by page:** Chapters ordered by starting page before numbering
- **Minimum requirement:** Must detect >1 chapter (single-chapter books rejected)

### Sentence Splitting

After chapters are detected, text is split into sentences using a sophisticated algorithm.

> **📘 Complete Algorithm:** See [CORE-CONCEPTS.md § Sentence Splitting Algorithm](CORE-CONCEPTS.md#2-sentence-splitting-algorithm) for:
> - List of 50+ protected abbreviations
> - Edge case handling (decimals, ellipses, lists, quotes)
> - Token-based protection mechanism
> - Full implementation details

**Key Features:**
- Protects 50+ common abbreviations (Dr., Mrs., U.S.A., etc.)
- Handles decimal numbers (3.14, 1.2) without splitting
- Preserves ellipses (... or …) within sentences
- Protects numbered/lettered lists (1. 2. 3. or A. B. C.)
- Handles parenthetical statements correctly
- Preserves quotes and dialogue formatting

**Small Sentence Merging:**
- Sentences with < 12 words are merged with adjacent sentences in same paragraph
- Resulting chunks have 12-200 words
- Original sentence count tracked in `sentenceCount` field
- Improves storage efficiency and TTS playback quality

### Confidence Scoring

Each detected chapter gets a confidence score (0.0-1.0) based on:
- **Exact title match:** +0.95 confidence
- **Contains chapter number:** +0.1
- **Reasonable page range:** (pages 8-300) +0.1
- **Short title:** (<100 characters) +0.1
- **Title case or ALL-CAPS:** +0.1

Chapters with confidence <0.5 may trigger validation warnings.

---

## Validation Rules

### Critical Errors (Block Upload)

These errors stop the upload process and require fixing:

**Chapter Detection:**
- ❌ Must detect >1 chapter (single-chapter books not supported)
- ❌ Duplicate chapter numbers found
- ❌ Gap in chapter sequence (e.g., chapters 0,1,2,4 - missing 3)
- ❌ No chapters detected at all

**Text Extraction:**
- ❌ Less than 1,000 characters extracted (likely parsing failure)
- ❌ Character count mismatch between steps
- ❌ Invalid PDF or corrupted file

**Content Structure:**
- ❌ Chapters array has <5 chunks total
- ❌ Missing required metadata (title, author)

### Warning Errors (Can Approve)

These can be overridden with "Approve Anyway":

**Paragraph Validation:**
- ⚠️ Paragraph word count <20 or >500 words
- ⚠️ Header doesn't start with capital letter
- ⚠️ Very short paragraphs (<3 sentences)

**Sentence Validation:**
- ⚠️ Text chunk doesn't end with sentence terminator (. ! ?)
  - **Exceptions allowed:** Ellipses, quotes, footnotes, bullet lists, image markers
- ⚠️ Missing or invalid paragraph indices
- ⚠️ Paragraph indices not sequential

**Content Quality:**
- ⚠️ Some pages have no text (blank pages)
- ⚠️ Images could not be extracted
- ⚠️ Chapters with very few sentences (<10)

### Validation Override Options

**User can:**
1. **Approve Anyway** - Continue despite warnings
2. **Skip Specific Errors** - Suppress certain validation checks
3. **View Details** - See full error breakdown with line numbers
4. **Restart Upload** - Try different PDF file

**Automatic Skip:**
- If >80% of validation errors are suppressed → Auto-pass validation
- Useful for known-issue PDFs (e.g., scanned documents)

---

## Data Model

### Book Structure in Database

```
Book {
  _id: ObjectId,
  userId: ObjectId,
  title: string,
  author: string,
  totalChapters: number,
  totalWords: number,
  language: string,
  coverImage: string,  // URL to Vercel Blob
  parserVersion: 1 | 2,
  createdAt: Date,
  updatedAt: Date
}
```

### Chapter Structure

```
Chapter {
  _id: ObjectId,
  bookId: ObjectId,
  chapterNumber: number,  // 0-based
  title: string,
  content: {
    chunks: TextChunk[]  // Array of all content
  },
  wordCount: number,
  createdAt: Date,
  updatedAt: Date
}
```

### Chunk Types

**Text Chunk:**
```
{
  index: number,  // 0-based position in chapter
  type: 'text',
  text: string,  // Plain text content
  wordCount: number,
  pageNumber: number,  // Original PDF page
  sentenceCount: number,  // Approximate sentences
  paragraphIndex: number  // Paragraph grouping
}
```

**Header Chunk:**
```
{
  index: number,
  type: 'header',
  text: string,  // Section title
  wordCount: number,
  pageNumber: number
}
```

**Image Chunk:**
```
{
  index: number,
  type: 'image',
  imageName: string,  // Filename in storage
  imageAlt: string,  // Alt text
  pageNumber: number,
  paragraphIndex: null  // Images don't belong to paragraphs
}
```

### Chunk Indexing

- Each chapter has a **flat array** of chunks
- Index starts at 0 for first chunk
- **No nesting** - all chunks at same level
- Mixed types in sequence: text, header, image, text, text, image...

**Example sequence:**
```
[
  { index: 0, type: 'text', text: "Introduction paragraph." },
  { index: 1, type: 'header', text: "Section One" },
  { index: 2, type: 'text', text: "Content of section one." },
  { index: 3, type: 'image', imageName: "figure-1.jpg" },
  { index: 4, type: 'text', text: "Explanation of figure." }
]
```

---

[← Back to Book Library](2-book-library.md) | [Main README](README.md) | [Next: Reader Page →](4-reader/README.md)
