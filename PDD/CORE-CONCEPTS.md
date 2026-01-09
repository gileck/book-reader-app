# Core Concepts - Critical Implementation Details

This document explains fundamental concepts that are essential for understanding how the e-book reader works. These are **product-specific** to this application and affect every feature.

---

## 1. Chunks vs Sentences: The Data Model

### What is a Chunk?

A **chunk** is the fundamental atomic unit of content storage in the database. Every piece of content (text, images, headers) is stored as a chunk.

**Critical Understanding:**
- **Chunks are what's stored in the database**
- **Sentences are computed at runtime from chunks**
- **NOT all chunks are sentences** (images, headers)
- **NOT all sentences are chunks** (small sentences get merged)

### Chunk Types

There are **3 types** of chunks:

```typescript
type ChunkType = 'text' | 'image' | 'header';
```

**1. Text Chunks:**
- Contains book content (sentences/paragraphs)
- **Can contain 1 or MORE sentences** (see merging below)
- Word count: 12-200 words
- Has `sentenceCount` field tracking how many original sentences were merged
- Has `paragraphIndex` for grouping

**2. Header Chunks:**
- Chapter/section titles
- Treated like text for navigation/TTS purposes
- Variable word count

**3. Image Chunks:**
- Book images, diagrams, figures
- Contains filename and alt text
- Word count: 0
- Skipped during TTS playback

### The Relationship: 1 Chunk ≠ 1 Sentence

**Key Rule:** Small sentences (< 12 words) are **merged** with adjacent sentences during parsing.

**Example:**

Original text:
```
"Hello." "How are you?" "I am fine, thank you very much for asking."
```

Parsed as chunks:
```javascript
[
  {
    index: 0,
    type: 'text',
    text: "Hello. How are you?",  // ← 2 sentences merged
    wordCount: 5,
    sentenceCount: 2  // ← Tracks original count
  },
  {
    index: 1,
    type: 'text',
    text: "I am fine, thank you very much for asking.",
    wordCount: 10,
    sentenceCount: 1
  }
]
```

**Why Merging?**
- Prevents too many tiny chunks (inefficient storage)
- Improves TTS playback (avoids very short audio clips)
- Maintains reasonable chunk sizes (12-200 words)

### Position Tracking: ChunkIndex vs SentenceIndex

**Database/Navigation:**
- Uses `chunkIndex` (0-based position in chunks array)
- Bookmarks reference: `{ chapterNumber, chunkIndex }`
- Progress tracking: `{ currentChapter, currentChunk }`
- All persistent data uses **chunkIndex**

**Runtime/UI:**
- Chunks are "exploded" into sentences at runtime
- `SentenceMap` maintains mapping: `chunkIndexToSentenceIndex[]`
- TTS word highlighting uses sentence-level granularity
- Focus mode displays sentence-by-sentence

**Example Mapping:**

```javascript
// Database chunks
chunks = [
  { index: 0, text: "A. B.", sentenceCount: 2 },  // Merged
  { index: 1, text: "C.", sentenceCount: 1 }
]

// Runtime sentence map
sentenceMap = {
  sentences: [
    { sentenceId: "5_0", text: "A.", chunkIndex: 0 },
    { sentenceId: "5_1", text: "B.", chunkIndex: 0 },
    { sentenceId: "5_2", text: "C.", chunkIndex: 1 }
  ],
  chunkIndexToSentenceIndex: [0, 2]  // Chunk 0 → sentence 0, Chunk 1 → sentence 2
}
```

### Complete Chunk Structure

```typescript
interface TextChunkClient {
    index: number;                   // Array position (PRIMARY IDENTIFIER)
    text: string;                    // Content (or 'content' in database)
    wordCount: number;               // 12-200 for text, 0 for images
    type: 'text' | 'image' | 'header';
    pageNumber?: number;             // Original PDF page
    sentenceCount?: number;          // How many sentences merged (1+)
    paragraphIndex?: number;         // Paragraph grouping (1, 2, 3...)
    imageName?: string;              // Filename (images only)
    imageAlt?: string;               // Alt text (images only)
    links?: ChunkLink[];             // Hyperlinks within content
}
```

### Why This Matters

**For Developers:**
- When you see `currentChunk` in code → it's a database position
- When you see `currentSentenceIndex` → it's runtime UI position
- Bookmarks store `chunkIndex`, not sentence index
- Progress uses `chunkIndex`, not sentence index
- TTS plays chunks but highlights sentences

**For Features:**
- **Navigation:** Always uses chunkIndex
- **Bookmarks:** References chunkIndex
- **TTS Playback:** Plays chunks (which may contain multiple sentences)
- **Word Highlighting:** Uses sentence-level granularity within chunks
- **Focus Mode:** Displays sentence-by-sentence but navigates by chunk
- **Translation:** Translates chunks (may include multiple sentences)

---

## 2. Sentence Splitting Algorithm

When parsing PDFs, text is split into sentences using a sophisticated algorithm that protects against false positives.

### Protected Abbreviations (50+)

The algorithm protects **50+ common abbreviations** to prevent incorrect splitting:

**Categories:**
1. **Titles/Honorifics:** Mr., Mrs., Ms., Dr., Prof., Sr., Jr.
2. **Academic Degrees:** Ph.D., M.D., B.A., M.A., B.S., M.S., J.D.
3. **Geographic:** St., Ave., Blvd., Rd., U.S., U.K., U.S.A.
4. **Publishing:** Sec., Vol., No., Ed., pp.
5. **Months:** Jan., Feb., Mar., Apr., Jun., Jul., Aug., Sep., Sept., Oct., Nov., Dec.
6. **Days:** Mon., Tue., Wed., Thu., Fri., Sat., Sun.
7. **Time:** a.m., A.M., p.m., P.M.
8. **Latin:** vs., etc., i.e., e.g., cf., et al., ibid.
9. **Scientific:** E. coli, S. aureus, C. difficile, vitamin A., etc.

### Edge Cases Handled

**1. Abbreviations:**
```
Input:  "Dr. Smith went to St. Louis."
Output: ["Dr. Smith went to St. Louis."]  // 1 sentence, not 3
```

**2. Decimal Numbers:**
```
Input:  "The price is $3.50. That's cheap."
Output: ["The price is $3.50.", "That's cheap."]  // 2 sentences
```

**3. Ellipses:**
```
Input:  "Wait... what happened?"
Output: ["Wait... what happened?"]  // 1 sentence
```

**4. Numbered Lists:**
```
Input:  "Steps: 1. Open. 2. Read. 3. Close."
Output: ["Steps: 1. Open. 2. Read. 3. Close."]  // 1 sentence (list preserved)
```

**5. Parenthetical Statements:**
```
Input:  "The question (should I go?) was difficult."
Output: ["The question (should I go?) was difficult."]  // 1 sentence
```

### How It Works

**Token-Based Protection:**
1. Replace all abbreviations with unique tokens: `<ABBR0>`, `<ABBR1>`, etc.
2. Replace decimal numbers with tokens: `<DEC_0>`, `<DEC_1>`, etc.
3. Replace ellipses with tokens: `<ELLIPSIS_0>`, etc.
4. Replace numbered/lettered lists: `<LISTNUM>`, `<LETTERLIST>`
5. Protect parenthetical content: `<PAREN_0>`, etc.
6. Split on sentence terminators (`.!?`)
7. Restore all tokens to original text

**Implementation:** `/book-parser/utils/text-processing-utils.js` (lines 412-470)

---

## 3. TTS Playability Rules

Not all chunk types can be played with Text-to-Speech.

### Playability Matrix

| Chunk Type | Playable? | Behavior |
|------------|-----------|----------|
| `'text'` | ✅ YES | Fully playable with word-level highlighting |
| `'header'` | ✅ YES | Treated identically to text chunks |
| `'image'` | ❌ NO | **Auto-skipped** during playback |

### Auto-Skip Behavior

**When TTS encounters an image chunk:**
1. Image chunk is automatically skipped
2. Playback advances to next text or header chunk
3. No alt text is played (images are visual-only)
4. User is not notified (seamless skip)

**Next/Previous Buttons:**
- Clicking "Next Sentence" auto-skips images to next playable (text/header)
- Clicking "Previous Sentence" auto-skips images to previous playable
- Buttons are disabled if no playable chunk exists in that direction

### Auto-Play Logic

When a sentence finishes playing:
```
Audio ends → handleEnded() fires
  ↓
If user was playing → navigate to next chunk
  ↓
If next chunk is IMAGE → auto-skip to next TEXT/HEADER
  ↓
Play that chunk (seamless continuation)
```

**Key Point:** Users never have to manually skip images. The system handles it automatically.

### Empty Chunks

Chunks with no text (`!chunk.text?.trim()`) are also skipped, preventing playback of blank content.

**Implementation:** `/src/client/routes/Reader/hooks/useSentenceAudioController.ts` (lines 132-133, 175-179)

---

## 4. Reading Mode State Sharing

All 5 reading modes share the same underlying state. This enables **seamless mode switching** without losing your place.

### Shared State (Global)

**These variables are shared across ALL modes:**
```typescript
- currentChapter: number           // Which chapter
- currentChunk: number             // Which chunk within chapter
- chapterContent: Chunk[]          // Entire chapter loaded once
- isPlaying: boolean               // TTS playback state
- selectedMode: string             // Current mode
- customizations: object           // Theme, font, etc.
```

### Mode-Specific State (Local)

**Each mode maintains its own UI state:**
```typescript
Full Mode:
  - scrollPosition: number
  - autoScrollActive: boolean

Focus Mode:
  - fontScale: number
  - showContext: boolean

Q&A Chat:
  - messages: ChatMessage[]
  - contextSentenceCount: number

Search:
  - searchQuery: string
  - searchResults: SearchResult[]

Overview:
  - activeTab: string
  - selectedOverview: ObjectId
```

### Mode Switching Example

**User in Full Mode at chunk 50:**
- Scrolled to paragraph containing chunk 50
- TTS playing chunk 50
- Word highlighting active

**User switches to Focus Mode:**
- Focus mode reads `currentChunk` from shared state (50)
- Displays sentence at chunk 50 in large centered text
- TTS continues playing **without interruption**
- Word highlighting continues in Focus Mode style
- **NO re-fetch** of chapter data (already in memory)

**User switches back to Full Mode:**
- Automatically scrolls to chunk 50
- Same paragraph visible
- Reading continues seamlessly

### TTS Continuity

**Audio playback is unified:**
- Same audio element instance across all modes
- Playing chunk tracked globally
- Speed setting applies to all modes
- Voice selection persistent
- **Mode switches do NOT interrupt audio**

### What Persists to Database

On mode switch or position change (debounced 2 seconds):
- ✅ Reading position (currentChapter, currentChunk)
- ✅ Mode preference (selectedMode)
- ✅ Customizations (if changed)
- ❌ Scroll position (mode-specific, not saved)
- ❌ Chat messages (ephemeral)
- ❌ Search results (ephemeral)

**Implementation:** `/src/client/routes/Reader/hooks/useReaderState.ts`

---

## 5. Q&A Context Selection

When using Q&A Chat mode, the AI receives context from the book to answer questions accurately.

### Context Options

User can select how many sentences of context to include:
- **1 sentence** (minimal)
- **5 sentences** (brief)
- **10 sentences** (default, recommended)
- **20 sentences** (extended)
- **50 sentences** (comprehensive)
- **ALL sentences** (entire chapter)

### Which Sentences Are Selected?

**Formula:** Last N sentences **before** the current sentence (not including current)

**Algorithm:**
```javascript
contextCount = 10;  // User selected 10
startIndex = max(0, currentSentenceIndex - contextCount);
endIndex = currentSentenceIndex;  // Current NOT included
contextSentences = sentences.slice(startIndex, endIndex);
```

**Example:**
```
Current sentence: 45
Context count: 10

startIndex = max(0, 45 - 10) = 35
endIndex = 45

Returns: sentences[35:45] = sentences 35, 36, 37, 38, 39, 40, 41, 42, 43, 44
         (10 sentences BEFORE current)
```

### "ALL" Context

When user selects "ALL":
- Context count becomes **999** (magic value)
- `startIndex = max(0, currentSentenceIndex - 999)` → equals 0
- Captures all sentences from chapter start to current position
- Does NOT include future sentences (only past context)

### Important Notes

- Current sentence is sent separately in the prompt (not in context)
- Context does NOT include sentences after current position
- Context is chapter-scoped (does not cross chapter boundaries)
- Larger context = higher API cost (more tokens)

**Implementation:** `/src/client/routes/Reader/ReaderUI.tsx` (lines 141-148)

---

## 6. Bookmark Navigation

When user clicks a bookmark, specific behavior ensures consistent navigation.

### Navigation Behavior

**Reading Mode:**
- **Does NOT change mode** - stays in current mode (Full/Focus/Q&A/etc.)
- Bookmark works across all modes

**TTS Playback:**
- **Always PAUSED** when navigating to bookmark
- User must manually click Play to resume audio

**Scroll Behavior:**
- Scrolls to exact chunk (not paragraph)
- Uses `scrollIntoView()` with smooth animation
- Centers chunk vertically on screen (`block: 'center'`)

**Highlight Animation:**
- Chunk background color changes to highlight color
- CSS transition animates the change (0.3s ease)
- Highlight fades out when navigating away

### Same Chapter Navigation

```
User clicks bookmark in current chapter:
  ↓
1. Pause TTS
2. Update currentChunk to bookmark.chunkIndex
3. Scroll to chunk (smooth animation)
4. Highlight chunk (0.3s fade-in)
5. User manually clicks Play if desired
```

### Different Chapter Navigation

```
User clicks bookmark in different chapter:
  ↓
1. Pause TTS
2. Show loading spinner
3. Load new chapter (async)
4. Update currentChapter and currentChunk
5. Render new chapter content
6. Scroll to chunk (smooth animation)
7. Highlight chunk (0.3s fade-in)
8. User manually clicks Play if desired
```

### Key Points

- Bookmarks reference `{chapterNumber, chunkIndex}` (not sentence index)
- Works across all reading modes without switching
- Always pauses audio (never auto-plays)
- Smooth scroll + highlight animation for visual feedback
- Offline chapters supported (tries offline first, falls back to online)

**Implementation:** `/src/client/routes/Reader/hooks/useReaderState.ts` (lines 232-243)

---

## 7. Chapter Completion

What happens when user reaches the end of a chapter.

### Auto-Advance?

**NO** - There is no automatic chapter advancement.

When TTS reaches the last sentence:
- Audio finishes and stops
- Playback does NOT advance to next chapter
- User must manually click "Next Chapter" button

**Code check:**
```typescript
// Only advances if NOT at last sentence
if (intendedPlay && currentIndex < sentences.length - 1) {
    goToSentence(currentIndex + 1);
}
// When at last sentence, condition fails → no advance
```

### Completion Messages

**NO explicit "Chapter Complete" modal or toast.**

**What actually happens:**
- TTS playback stops silently
- `isPlaying` state becomes `false`
- UI remains as-is with last sentence visible
- No dialog, modal, or notification appears

### Full Mode Behavior

At chapter end:
- Last sentence visible in reader
- Progress bar shows 100% chapter completion
- Sentence counter: "X of X sentences"
- "Next Chapter" button enabled (if next chapter exists)
- User must click "Next Chapter" to continue

### Focus Mode Behavior

At chapter end:
- Last sentence displayed in large centered text
- Next section shows **"End of Paragraph"** indicator with decorative lines
- No "Next sentence" preview (there isn't one)
- Audio stops after last sentence plays
- User clicks "Next Chapter" button to continue

### Manual Navigation Required

User has two options to advance:
1. Click "Next Chapter" button in audio controls
2. Open chapter selector and pick next chapter
3. If at last chapter: "Next Chapter" button is disabled

### Key Points

- No auto-advance between chapters
- No completion modal/message
- Focus Mode shows "End of Paragraph" indicator
- Manual navigation required via buttons
- Reading progress auto-saved before navigation
- Works identically in Full and Focus modes

**Implementation:** `/src/client/routes/Reader/hooks/useSentenceAudioController.ts` (lines 598-600)

---

[← Back to Main README](README.md)
