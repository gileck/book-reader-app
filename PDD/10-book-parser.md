# 10. Book Parser

## Purpose

The Book Parser is a modular PDF processing pipeline that transforms raw PDF files into structured, reader-ready content for the e-book application. It extracts text, detects chapters, identifies paragraphs and headers, processes images, resolves links, and prepares everything for optimal reading and TTS playback.

**Key Goal:** Convert unstructured PDFs into the exact data format the app needs for reading, navigation, TTS, and AI features.

---

## What It Does

The parser runs a **12-step pipeline** that progressively transforms a PDF:

### Pipeline Steps Overview

1. **Text Extraction** - Extract raw text from PDF with proper spacing
2. **Chapter Detection** - Identify chapter boundaries from table of contents
3. **Chapter Content Extraction** - Extract content for each detected chapter
4. **Chapter Name Cleaning** - Clean chapter titles and content
5. **Page Processing** - Extract pages and merge cross-page sentences
6. **Link Detection** - Extract PDF internal links (footnotes, cross-references)
7. **Image Extraction** - Extract images and insert markers
8. **Paragraph Detection** - Detect paragraphs and headers
9. **Sentence Detection** - Split into single-sentence chunks for TTS
10. **Image Marker Conversion** - Convert image markers to image chunks
11. **Link Resolution** - Resolve links to specific chunk IDs
12. **Metadata Extraction** - Extract title, author, statistics

### Key Features

**Text Quality:**
- Professional-grade spacing (no split words like "Pr oblem")
- Protected abbreviations (Dr., Ph.D., U.S.A., etc. - 50+)
- Handles decimals, ellipses, lists correctly

**Content Structure:**
- Single-sentence chunks (optimal for TTS word highlighting)
- Merges only ultra-short sentences (<12 words)
- Preserves headers, images, and paragraphs
- Smart list separation (numbered/bulleted lists)

**Metadata:**
- Extracts from PDF properties (most reliable)
- Falls back to text pattern matching
- Manual override via `metadata.json`

---

## Parser Output: The App's Input

This is the **critical section** - the parser output becomes the app's database content.

### Output Structure

The parser generates `output.json` with this exact structure:

```json
{
  "metadata": {
    "title": "The Great Gatsby",
    "author": "F. Scott Fitzgerald",
    "totalPages": 180,
    "totalWords": 47094,
    "totalChapters": 9,
    "parserVersion": 2
  },
  "chapters": [
    {
      "chapterNumber": 0,
      "title": "Chapter One",
      "content": {
        "chunks": [/* array of chunks */]
      },
      "wordCount": 5234
    }
    // ... more chapters
  ]
}
```

### Chunk Structure (The Fundamental Unit)

Every piece of content is a **chunk** with this structure:

```typescript
{
  index: number,              // 0-based position in chapter
  type: 'text' | 'image' | 'header',
  text: string,               // Content (or 'content' field)
  wordCount: number,          // 12-200 for text, 0 for images
  pageNumber?: number,        // Original PDF page
  sentenceCount?: number,     // How many sentences (1+, if merged)
  paragraphIndex?: number,    // Paragraph grouping (1, 2, 3...)
  imageName?: string,         // For image chunks
  imageAlt?: string,          // For image chunks
  links?: ChunkLink[]         // Hyperlinks within chunk
}
```

### Chunk Types Explained

#### 1. Text Chunks (`type: 'text'`)

**Primary content** - sentences from the book.

```json
{
  "index": 0,
  "type": "text",
  "text": "In my younger and more vulnerable years my father gave me some advice that I've been turning over in my mind ever since.",
  "wordCount": 28,
  "pageNumber": 1,
  "sentenceCount": 1,
  "paragraphIndex": 1,
  "links": []
}
```

**Key Characteristics:**
- **Single-sentence chunks** (optimal for TTS)
- Small sentences (<12 words) merged with adjacent sentence
- Word count: 12-200 words (enforced range)
- Contains `paragraphIndex` for grouping
- `sentenceCount` tracks original sentence count if merged

**Example of Merged Chunk:**
```json
{
  "index": 5,
  "type": "text",
  "text": "Hello. How are you?",
  "wordCount": 5,
  "sentenceCount": 2,  // ← Originally 2 separate sentences
  "paragraphIndex": 1
}
```

#### 2. Header Chunks (`type: 'header'`)

**Chapter/section titles** - treated like text for navigation.

```json
{
  "index": 1,
  "type": "header",
  "text": "The Great Gatsby",
  "wordCount": 3,
  "pageNumber": 1,
  "paragraphIndex": null  // ← Headers have no paragraph
}
```

**Key Characteristics:**
- No punctuation at end
- 2-5 words typically
- Capitalized (title case or ALL CAPS)
- Playable in TTS (not skipped)
- No `paragraphIndex`

#### 3. Image Chunks (`type: 'image'`)

**Book images, diagrams, figures.**

```json
{
  "index": 10,
  "type": "image",
  "imageName": "img_001.png",
  "imageAlt": "Figure 5.1: The Green Light",
  "pageNumber": 15,
  "wordCount": 0,
  "paragraphIndex": null  // ← Images have no paragraph
}
```

**Key Characteristics:**
- No `text` field
- References image file in storage
- `wordCount: 0`
- Auto-skipped during TTS playback
- No `paragraphIndex`

### Chunk Links Structure

Links within chunks reference other locations:

```typescript
{
  text: string,                // Link text as shown
  targetPageNumber?: number,   // PDF page reference
  targetText?: string,         // Target content
  linkId: string,              // Unique identifier
  role: 'source' | 'target',   // Link relationship
  targetChunkIndex?: number,   // Direct chunk reference
  sourceChunkIndex?: number    // Source chunk reference
}
```

**Example:**
```json
{
  "text": "8",
  "targetPageNumber": 45,
  "targetText": "8. Mitchell argues...",
  "linkId": "link_123",
  "role": "source",
  "targetChunkIndex": 234
}
```

---

## Critical Understanding: Chunks vs Sentences

> **📘 See Also:** [CORE-CONCEPTS.md § Chunks vs Sentences](CORE-CONCEPTS.md#1-chunks-vs-sentences-the-data-model)

**NOT 1:1 Relationship!**

- **Chunks** = database storage unit (what parser outputs)
- **Sentences** = runtime UI unit (what users see)
- Parser creates mostly single-sentence chunks
- Small sentences (<12 words) get merged into one chunk
- `sentenceCount` field tracks how many sentences in chunk

**Why This Matters:**
- App navigation uses `chunkIndex` (not sentence index)
- Bookmarks reference `{chapterNumber, chunkIndex}`
- Progress tracking: `{currentChapter, currentChunk}`
- TTS plays chunks but highlights sentences within chunks

---

## Example Chapter Output

Here's what one chapter looks like in `output.json`:

```json
{
  "chapterNumber": 2,
  "title": "Chapter Two",
  "content": {
    "chunks": [
      {
        "index": 0,
        "type": "text",
        "text": "About halfway between West Egg and New York the motor road hastily joins the railroad and runs beside it for a quarter of a mile, so as to shrink away from a certain desolate area of land.",
        "wordCount": 42,
        "pageNumber": 23,
        "sentenceCount": 1,
        "paragraphIndex": 1,
        "links": []
      },
      {
        "index": 1,
        "type": "text",
        "text": "This is a valley of ashes.",
        "wordCount": 6,
        "pageNumber": 23,
        "sentenceCount": 1,
        "paragraphIndex": 1,
        "links": []
      },
      {
        "index": 2,
        "type": "header",
        "text": "The Valley of Ashes",
        "wordCount": 4,
        "pageNumber": 23,
        "paragraphIndex": null
      },
      {
        "index": 3,
        "type": "image",
        "imageName": "img_005.png",
        "imageAlt": "Figure 2.1: The Valley",
        "pageNumber": 24,
        "wordCount": 0,
        "paragraphIndex": null
      },
      {
        "index": 4,
        "type": "text",
        "text": "The eyes of Doctor T. J. Eckleburg are blue and gigantic.",
        "wordCount": 12,
        "pageNumber": 24,
        "sentenceCount": 1,
        "paragraphIndex": 2,
        "links": [
          {
            "text": "5",
            "targetPageNumber": 180,
            "linkId": "link_042",
            "role": "source"
          }
        ]
      }
    ]
  },
  "wordCount": 5847
}
```

---

## How The App Uses This Output

### 1. Database Storage

**Books Collection:**
```javascript
Book {
  _id: ObjectId,
  userId: ObjectId,
  title: metadata.title,        // ← From parser
  author: metadata.author,      // ← From parser
  totalChapters: metadata.totalChapters,
  totalWords: metadata.totalWords,
  parserVersion: metadata.parserVersion
}
```

**Chapters Collection:**
```javascript
Chapter {
  _id: ObjectId,
  bookId: ObjectId,
  chapterNumber: chapters[i].chapterNumber,
  title: chapters[i].title,
  content: {
    chunks: chapters[i].content.chunks  // ← Array from parser
  },
  wordCount: chapters[i].wordCount
}
```

### 2. Reader Display

**Full Mode:**
- Renders all chunks sequentially
- Text chunks → paragraphs
- Header chunks → styled headers
- Image chunks → images

**Focus Mode:**
- Displays one sentence at a time
- Navigates by `chunkIndex`
- Computes sentences at runtime from chunks
- Word highlighting uses sentence boundaries

### 3. TTS Playback

**Audio Generation:**
- Plays text chunks and header chunks
- Skips image chunks automatically
- Word-level timing uses sentence splitting
- Chunk boundaries = audio segment boundaries

### 4. Navigation & Progress

**Position Tracking:**
```javascript
{
  currentChapter: 2,        // chapterNumber from parser
  currentChunk: 15,         // chunk.index from parser
}
```

**Progress Calculation:**
```javascript
totalWordsRead = sum(wordCount for all chunks up to currentChunk)
progress = (totalWordsRead / metadata.totalWords) × 100
```

### 5. Bookmarks

**Bookmark Storage:**
```javascript
{
  chapterNumber: 2,         // From parser output
  chunkIndex: 15,           // chunk.index from parser
  previewText: chunk.text.slice(0, 100)
}
```

### 6. Search

**Search Implementation:**
- Searches across all `chunk.text` fields
- Returns `{chapterNumber, chunkIndex}` for matches
- Navigates to chunk containing search result

---

## Parser Configuration

### Sentence Splitting

**Protected Patterns (50+ abbreviations):**
- Titles: Mr., Mrs., Ms., Dr., Prof., Sr., Jr.
- Degrees: Ph.D., M.D., B.A., M.A., B.S., M.S., J.D.
- Geographic: U.S., U.K., U.S.A., St., Ave., Blvd.
- Latin: vs., etc., i.e., e.g., cf., et al.
- Months: Jan., Feb., Mar., Apr., Jun., Jul., Aug., Sep., Oct., Nov., Dec.
- Days: Mon., Tue., Wed., Thu., Fri., Sat., Sun.
- Time: a.m., A.M., p.m., P.M.
- Scientific: E. coli, S. aureus, C. difficile

**Edge Cases Handled:**
- Decimals: "3.14" (not split)
- Ellipses: "Wait..." (not split)
- Lists: "1. First item" (not split)
- Parenthetical: "(should I go?)" (not split)

### Chunk Size Constraints

**Word Count Ranges:**
- **Minimum:** 12 words (smaller sentences merged)
- **Target:** 80-300 words
- **Maximum:** 200 words (with smart relaxation for small chunks)
- **Images/Headers:** Variable (not enforced)

### Metadata Extraction Priority

1. **metadata.json** (manual override) - Highest priority
2. **PDF properties** (most reliable automatic)
3. **Text pattern matching** (fallback)

---

## Parser Output Files

When parser completes, it generates:

### Required Files

**`output.json`** - Main output (structure above)
- Complete book structure
- All chapters with chunks
- Metadata
- **This is what gets uploaded to database**

### Image Files

**`output/images/`** directory:
- `img_001.png`, `img_002.jpg`, etc.
- Referenced by `imageName` in image chunks
- Uploaded to Vercel Blob/S3 storage

### Optional Debug Files

**`debug/pipeline-state.json`** (if debug enabled)
- Complete pipeline state
- Step-by-step outputs
- Useful for troubleshooting

---

## Integration With App

### Upload Flow

```
1. User uploads PDF
   ↓
2. Parser runs (12 steps)
   ↓
3. Generates output.json + images
   ↓
4. Upload script runs:
   - Creates Book document (metadata)
   - Creates Chapter documents (chunks array)
   - Uploads images to Vercel Blob
   ↓
5. Book appears in library
   ↓
6. User can start reading
```

### What App Expects

**Critical Requirements:**
1. ✅ Chunks MUST have sequential `index` (0, 1, 2, ...)
2. ✅ `chapterNumber` MUST be 0-based (0, 1, 2, ...)
3. ✅ Text chunks MUST have `paragraphIndex` (for grouping)
4. ✅ Images/headers MUST have `paragraphIndex: null`
5. ✅ `sentenceCount` MUST be present (tracks merging)
6. ✅ Word counts MUST be accurate (used for progress)

**Optional Fields:**
- `pageNumber` (nice for debugging)
- `links` (enables footnote navigation)
- `imageAlt` (accessibility)

---

## Key Parser Features

### 1. Single-Sentence Chunks

**Why:** Optimal for TTS word-level highlighting.

**Implementation:**
- Parser splits paragraphs into sentences
- Only merges sentences <12 words
- `sentenceCount` field tracks merging
- App can re-split for finer granularity if needed

### 2. Paragraph Indexing

**Why:** Groups sentences into logical paragraphs for display.

**Implementation:**
- `paragraphIndex` starts at 1 for each chapter
- All sentences in same paragraph share same index
- Headers and images have `paragraphIndex: null`
- Used by reader for paragraph spacing

### 3. Smart List Handling

**Why:** Keeps numbered/bulleted lists separate from paragraphs.

**Implementation:**
- Lists after newlines → separate chunks
- Lists after colons → same chunk as intro
- Example: "The factors:\n1. First" → one chunk
- Example: "Sentence.\n1. First" → two chunks

### 4. Image Positioning

**Why:** Place images at correct text locations.

**Implementation:**
- Parser inserts `[[IMG...]]` markers during extraction
- Markers converted to image chunks in Step 10
- Images appear in chunk array at exact position
- Reader displays images inline with text

### 5. Link Resolution

**Why:** Enable footnote/cross-reference navigation.

**Implementation:**
- Links extracted from PDF annotations
- Resolved to `{chapterNumber, chunkIndex}` pairs
- Stored in `chunk.links` array
- Reader makes links clickable

---

## Example: From PDF to Chunks

**PDF Content:**
```
The Great Gatsby

Chapter One

In my younger and more vulnerable years my father
gave me some advice.

"Whenever you feel like criticizing anyone," he told me,
"just remember that all the people in this world haven't
had the advantages that you've had."

[Image of Gatsby's mansion]
```

**Parser Output:**
```json
{
  "chunks": [
    {
      "index": 0,
      "type": "header",
      "text": "Chapter One",
      "wordCount": 2,
      "paragraphIndex": null
    },
    {
      "index": 1,
      "type": "text",
      "text": "In my younger and more vulnerable years my father gave me some advice.",
      "wordCount": 14,
      "sentenceCount": 1,
      "paragraphIndex": 1
    },
    {
      "index": 2,
      "type": "text",
      "text": "\"Whenever you feel like criticizing anyone,\" he told me, \"just remember that all the people in this world haven't had the advantages that you've had.\"",
      "wordCount": 29,
      "sentenceCount": 1,
      "paragraphIndex": 2
    },
    {
      "index": 3,
      "type": "image",
      "imageName": "img_001.png",
      "imageAlt": "Gatsby's mansion",
      "wordCount": 0,
      "paragraphIndex": null
    }
  ]
}
```

---

## Important Notes

### Parser Version

**`parserVersion: 2`** in metadata indicates current parser.

**Version 1 (deprecated):**
- Larger chunks (paragraphs)
- No `sentenceCount` field
- No `paragraphIndex`

**Version 2 (current):**
- Single-sentence chunks
- `sentenceCount` tracking
- `paragraphIndex` for grouping
- Better TTS support

### Chunk Index Stability

**Critical:** Chunk `index` is **permanent**.

- Once book is parsed, chunk indices don't change
- Bookmarks reference chunk index
- Progress uses chunk index
- Re-parsing book creates new indices (old bookmarks break)

**Warning:** Do NOT re-parse books that users are reading!

### Image Storage

**Images are separate from JSON:**
- `output.json` has image metadata
- Actual images in `output/images/` directory
- App uploads images to cloud storage
- `imageName` in chunk references stored image

### Link Format

**Links are resolved to chunks:**
- Parser converts PDF coordinates to chunk indices
- `targetChunkIndex` points to exact chunk
- Reader navigates to that chunk when link clicked

---

## Validation

Parser validates output at each step:

### Critical Validation

**These MUST pass or parsing fails:**
- Chapter count > 1
- All chunks have sequential index
- Text chunks have 12-200 words
- All chunks have required fields
- No duplicate chunk indices

### Warning Validation

**These can be approved by user:**
- Paragraphs with few sentences
- Some images couldn't be extracted
- Some links couldn't be resolved

**User can click "Approve Anyway"** to continue.

---

## Summary

**What Parser Does:**
Transforms unstructured PDFs → structured chunks ready for reading

**What App Gets:**
`output.json` with:
- Metadata (title, author, stats)
- Chapters array
- Each chapter has chunks array
- Each chunk is text, header, or image

**Critical Output:**
```javascript
chunks: [
  { index: 0, type: 'text', text: "...", wordCount: 42, ... },
  { index: 1, type: 'header', text: "...", wordCount: 3, ... },
  { index: 2, type: 'image', imageName: "...", wordCount: 0, ... }
]
```

**How App Uses It:**
- Stores chunks in database
- Renders chunks in reader
- Navigates by chunk index
- Tracks progress by word count
- Plays TTS using chunk text

---

[← Back to File Storage](9-file-storage.md) | [Main README](README.md)
