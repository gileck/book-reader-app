# 4. Reader Page

## Overview

The Reader Page is the core of the application where users spend most of their time. It provides five distinct reading modes that can be switched seamlessly, along with comprehensive text-to-speech capabilities, AI-powered features, and extensive customization options.

## Reading Modes

The Reader offers five specialized modes, each optimized for different reading styles and needs:

1. **[Full Reading Mode](4.2-full-reading-mode.md)** - Traditional continuous reading with multiple paragraphs visible
2. **[Focus Reading Mode](4.3-focus-reading-mode.md)** - Distraction-free single-sentence view
3. **[Q&A Chat Mode](4.4-qa-chat-mode.md)** - AI-powered conversation about the book
4. **[Search Mode](4.5-search-mode.md)** - Find text across current chapter or entire book
5. **[Overview Mode](4.6-overview-mode.md)** - AI-generated chapter summaries

## Core Features

- **[Text-to-Speech System](4.7-text-to-speech.md)** - Professional narration with word-level highlighting
- **[Audio Controls](4.8-audio-controls.md)** - Comprehensive playback and navigation controls
- **[Translation Feature](4.9-translation.md)** - Instant translation into 16 languages
- **[Bookmarks](4.10-bookmarks.md)** - Save and navigate to important passages
- **[Navigation & Progress](4.11-navigation-progress.md)** - Track position and progress
- **[Customization](4.12-customization.md)** - Extensive theme and typography options

## Design Philosophy

The Reader features an Apple Books-inspired design with:
- Warm, sepia-toned color palette optimized for long reading sessions
- Clean, minimalist interface that fades away during reading
- Smooth transitions between modes
- Responsive design for desktop, tablet, and mobile
- Touch-optimized controls for mobile devices

## Mode Switching

Users can switch between modes instantly via a floating tab navigation bar without losing their reading position. The selected mode is saved per user and persists across sessions.

---

## State Sharing Across Modes - Technical Details

### Shared State Architecture

The Reader uses a centralized state management system where all 5 reading modes share the same underlying reading position and chapter data. This ensures seamless mode switching without data loss or re-fetching.

**Shared State Variables:**
```
ReaderState {
  // Position
  currentChapter: number,        // 0-based chapter index
  currentChunk: number,          // 0-based chunk index

  // Chapter Data
  chapterContent: Chunk[],       // Array of all chunks in current chapter
  chapterMetadata: {
    chapterNumber: number,
    title: string,
    wordCount: number,
    chunkCount: number
  },

  // Book Data
  bookId: string,
  bookTitle: string,
  bookAuthor: string,
  totalChapters: number,

  // Reading State
  isPlaying: boolean,            // TTS playback state
  selectedMode: string,          // Current mode ("full", "focus", etc.)
  highlightedWord: number,       // Word index for TTS highlighting

  // UI State
  customizations: {
    fontSize: number,
    lineHeight: number,
    theme: string,
    bionicReading: boolean
  }
}
```

### Mode-Specific State

**Each mode maintains its own UI-specific state:**
```
Full Mode:
- scrollPosition: number       // Y-offset in scroll container
- autoScrollActive: boolean
- autoScrollSpeed: number

Focus Mode:
- fontScale: number            // Dynamic scaling factor
- showContext: boolean         // Show prev/next sentences

Q&A Chat Mode:
- messages: ChatMessage[]      // Conversation history
- contextSentenceCount: number // Context size
- answerSettings: object       // Length, level, style

Search Mode:
- searchQuery: string
- searchScope: "chapter" | "book"
- searchResults: SearchResult[]

Overview Mode:
- activeTab: "generate" | "library" | "view"
- selectedOverview: ObjectId | null
- generationSettings: object
```

### Position Synchronization

**How Position Updates Across Modes:**
```
Algorithm:
1. User navigates in Mode A (e.g., clicks next sentence in Full mode)
2. Update shared state: currentChunk++
3. Trigger position save to database (debounced)
4. All modes react to position change:
   - Full mode: Scroll to new position
   - Focus mode: Update displayed sentence
   - Q&A mode: Update context if using "current" setting
   - Search mode: Highlight if match exists at position
   - Overview mode: No action (not position-dependent)
5. Reading progress updated globally
```

**Example Scenario:**
```
User in Full Mode at Chunk 50:
- Scrolled to paragraph containing chunk 50
- TTS playing chunk 50
- Word highlighting active

User switches to Focus Mode:
- Focus mode reads currentChunk from shared state (50)
- Displays sentence at chunk 50 in large centered text
- TTS continues playing without interruption
- Word highlighting continues
- NO re-fetch of chapter data (already in memory)

User switches back to Full Mode:
- Automatically scrolls to chunk 50
- Same paragraph visible
- Reading continues seamlessly
```

### Chapter Data Sharing

**Single Chapter Load:**
```
When chapter loads:
1. Fetch chapter content from API once
2. Store in shared state
3. All modes use same chapterContent array
4. No duplicate API calls
5. Cached until chapter changes

Memory footprint:
- Single chapter = ~50-200 KB depending on length
- Shared across all 5 modes
- Not duplicated per mode
```

**Chunk to Sentence Conversion:**
```
Sentences computed at runtime:
1. Filter chapterContent to text chunks only
2. For each text chunk:
   - Split text by sentence boundaries
   - Create flat sentence array
3. Cache sentence array in state
4. All modes reference same sentence array

Result:
- Consistent sentence numbering across modes
- Same "sentence 45" in Full, Focus, Q&A, Search
- Translation references align across modes
```

### TTS State Sharing

**Audio Playback Unified:**
```
TTS state shared across modes:
- Same audio element instance
- Playing chunk tracked globally
- Word highlighting synchronized
- Speed setting applies to all modes
- Voice selection persistent

User can:
- Start TTS in Full mode
- Switch to Focus mode mid-sentence
- Audio continues without interruption
- Highlighting updates in new mode
```

**Playback Control Flow:**
```
User clicks Play in Mode A:
1. Update isPlaying = true
2. Start audio playback
3. Begin word highlighting
4. All modes see isPlaying state
5. Audio controls show "Playing" state
6. Mode A-specific highlighting activates

User switches to Mode B:
7. isPlaying remains true
8. Audio element unchanged
9. Mode B activates its highlighting style
10. No audio interruption
11. Playback position maintained
```

### Customization State Sharing

**Theme and Typography:**
```
Customizations apply globally:
- Font size affects Full and Focus modes
- Line height affects Full mode
- Bionic reading affects both reading modes
- Theme colors affect all 5 modes
- Background color unified

Changes propagate:
1. User adjusts font size in Full mode
2. Update shared customizations state
3. Focus mode automatically re-renders with new size
4. Save to database (persists across sessions)
5. All modes use updated settings
```

**Mode-Specific Overrides:**
```
Some settings have mode-specific behavior:
- Focus mode: Font scaling formula applies
- Full mode: Uses base font size directly
- Both modes share user's base fontSize setting
- Focus mode applies additional scaling on top
```

### Bookmark State Synchronization

**Bookmarks Across Modes:**
```
Bookmark created in any mode:
1. User bookmarks chunk 42
2. Bookmark saved to database
3. Shared bookmark list updated
4. Bookmark indicators appear:
   - Full mode: Star icon next to sentence
   - Focus mode: Star icon in UI (not inline)
   - All other modes: Star button filled
5. Bookmark dropdown shows same list in all modes
```

**Navigation to Bookmark:**
```
User clicks bookmark from any mode:
1. Update currentChunk = bookmark.chunkIndex
2. Update currentChapter if different chapter
3. Switch to last used reading mode (Full or Focus)
4. Scroll/position to bookmarked chunk
5. Brief highlight animation
6. TTS can resume from there if desired
```

### Translation State Sharing

**Translations Persist Across Modes:**
```
Translation state per chunk:
- translations: { [chunkIndex]: translatedText }
- translationLanguages: { [chunkIndex]: languageCode }

User translates sentence in Full mode:
1. Translation stored in shared state
2. Chunk 50 now has translation
3. Switch to Focus mode:
   - Same chunk shows translation if toggled
   - Translation preserved
4. Switch back to Full mode:
   - Translation still displayed
   - Toggle state maintained per chunk
```

### State Persistence

**What Persists to Database:**
```
On mode switch or position change (debounced 2s):
1. Save reading position:
   - currentChapter
   - currentChunk
2. Save mode preference:
   - selectedMode
3. Save customizations (if changed):
   - fontSize, lineHeight, theme, etc.
4. Do NOT save:
   - Scroll position (mode-specific)
   - Chat messages (ephemeral)
   - Search query (ephemeral)
   - Cached chapter content (reload on return)
```

**On Page Reload:**
```
1. Fetch last saved position
2. Load chapter content
3. Restore mode preference
4. Apply customizations
5. Scroll/position to saved chunk
6. Mode-specific state starts fresh:
   - Chat history empty
   - Search results cleared
   - Scroll position recalculated
```

### Performance Optimization

**Shared Data Benefits:**
```
Memory:
- Single chapter load = 100 KB
- Shared across 5 modes
- Alternative: 5 × 100 KB = 500 KB (wasteful)
- Savings: 80% reduction

API Calls:
- Chapter fetch: 1 call per chapter
- Shared across modes
- Alternative: 1 call per mode switch = excessive
- Reduces server load significantly

Rendering:
- Chapter content parsed once
- Sentence splitting computed once
- Cached and reused
- Mode switches are instant (<50ms)
```

**State Update Optimization:**
```
- Debounced position saves (2 seconds)
- Prevents excessive database writes
- Batches rapid navigation (user scrolling)
- Single database update per pause

Example:
- User scrolls through 20 chunks in 3 seconds
- Without debouncing: 20 database writes
- With debouncing: 1 database write
- Reduces database load by 95%
```

### Edge Cases

**Concurrent Mode Switches:**
```
User rapidly switches modes:
1. Full → Focus → Q&A in 1 second
2. Each mode reads shared currentChunk
3. No race conditions (synchronous state updates)
4. Final mode displays correct position
5. TTS continues playing without interruption
```

**Chapter Change During Mode Switch:**
```
1. User switches mode while chapter loading
2. Loading state shared across modes
3. New mode shows loading spinner
4. Chapter loads once
5. Both modes receive new content simultaneously
6. Position restored in new mode
```

**TTS Playing During Mode Switch:**
```
1. Audio playing in Full mode
2. User switches to Focus mode mid-word
3. Audio element unchanged (shared instance)
4. Word highlighting switches style:
   - Full mode: Inline yellow background
   - Focus mode: Entire sentence highlighted
5. Playback uninterrupted
6. User hears no audio gap
```

---

## Sub-Sections

- [4.1 Reading Modes Overview](4.1-reading-modes-overview.md)
- [4.2 Full Reading Mode](4.2-full-reading-mode.md)
- [4.3 Focus Reading Mode](4.3-focus-reading-mode.md)
- [4.4 Q&A Chat Mode](4.4-qa-chat-mode.md)
- [4.5 Search Mode](4.5-search-mode.md)
- [4.6 Overview Mode](4.6-overview-mode.md)
- [4.7 Text-to-Speech System](4.7-text-to-speech.md)
- [4.8 Audio Controls](4.8-audio-controls.md)
- [4.9 Translation Feature](4.9-translation.md)
- [4.10 Bookmarks](4.10-bookmarks.md)
- [4.11 Navigation & Progress](4.11-navigation-progress.md)
- [4.12 Customization](4.12-customization.md)

---

[← Back to Upload Book](../3-upload-book.md) | [Main README](../README.md) | [Next: Reading Modes Overview →](4.1-reading-modes-overview.md)
