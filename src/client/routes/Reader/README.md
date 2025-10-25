# Reader Architecture Documentation

## Overview

The Reader is a sentence-based audio book player with real-time highlighting, supporting both **Full Mode** (shows entire chapter with scrolling) and **Focus Mode** (shows one sentence at a time). The implementation uses a simplified one-to-one index mapping where **sentence indices equal chunk indices**, eliminating the need for complex index translation.

## Table of Contents

1. [Core Principles](#core-principles)
2. [Architecture Overview](#architecture-overview)
3. [Simplified Index System](#simplified-index-system)
4. [Audio Playback System](#audio-playback-system)
5. [Highlighting Systems](#highlighting-systems)
6. [Component Structure](#component-structure)
7. [Data Flow](#data-flow)
8. [Key Features](#key-features)
9. [Usage Examples](#usage-examples)
10. [Performance Optimizations](#performance-optimizations)
11. [Troubleshooting](#troubleshooting)
12. [Migration from Old System](#migration-from-old-system)

## Core Principles

### 1. Sentence Index = Chunk Index
The most important architectural decision: sentence indices directly correspond to chunk indices in the chapter. No filtering, no mapping, no translation.

```typescript
// ✅ SIMPLIFIED (Current Implementation)
const sentences = chapter?.content?.chunks || [];  // ALL chunks
const currentChunkIndex = sentenceAudio.currentSentenceIndex;  // Direct match!

// ❌ OLD (Complex Implementation)
const sentences = chunks.filter(c => c.type === 'text');  // Filtered array
const currentChunkIndex = sentenceToChunkIndex(sentenceIndex);  // Mapping required
```

### 2. Headers and Text Are Playable
Headers and text chunks both generate TTS audio and can be played. Only images are skipped.

```typescript
// ✅ Playable chunks
if (chunk.type === 'text' || chunk.type === 'header') {
    // Generate TTS and play
    await generateTts({ text: chunk.text, ... });
}

// ❌ Skip only images
if (chunk.type === 'image' || !chunk.text?.trim()) {
    // Auto-advance to next playable chunk
    return;
}
```

### 3. Unified Audio Controller
Both Full and Focus modes use the same `useSentenceAudioController` hook with the same index system.

### 4. DOM-Based Word Highlighting
Word-level highlighting uses direct DOM manipulation for performance, while sentence-level highlighting uses React's declarative rendering.

## Architecture Overview

### Data Loader Pattern (v3.0)

The Reader uses a **data loader pattern** that separates data fetching from UI rendering, eliminating race conditions and ensuring the audio controller starts at the correct position.

```mermaid
graph TB
    A[Reader.tsx<br/>Orchestrator] --> B[ReaderDataLoader.tsx<br/>Data Layer]
    B --> C[useReaderData Hook]
    C --> D[Parallel Fetch:<br/>Book + Progress]
    D --> E[Sequential Fetch:<br/>Chapter]
    E --> F{Data Ready?}
    F -->|Loading| G[Loading Spinner]
    F -->|Error| H[Error Display]
    F -->|Success| I[ReaderUI.tsx<br/>Pure UI + Audio]
    
    I --> J[useReaderState Hook]
    J --> K[useSentenceAudioController<br/>initialized with position]
    J --> L[useUserSettings]
    J --> M[useBookmarks]
    J --> N[useReadingProgress]
    J --> O[useReadingLogs]
    
    I --> P{Mode?}
    P -->|Full| Q[ReaderContent]
    P -->|Focus| R[FocusReader]
    P -->|QA| S[BookQA Panel]
    
    style B fill:#90EE90
    style C fill:#FFD700
    style I fill:#87CEEB
    style J fill:#FFA07A
```

**Key Components:**

1. **Reader.tsx** - Simple orchestrator that renders `ReaderDataLoader`
2. **ReaderDataLoader.tsx** - Manages loading states and delegates to `ReaderUI`
3. **useReaderData.ts** - Fetches all initial data (book, chapter, reading progress) in parallel
4. **ReaderUI.tsx** - Pure UI component that receives pre-loaded data as props
5. **useReaderState.ts** - Manages runtime state (navigation, audio, settings) with pre-loaded data

**Benefits:**

- ✅ No race conditions - Data loads before UI renders
- ✅ Audio controller initialized with correct position immediately
- ✅ Faster initial load - Parallel fetching of book + progress
- ✅ Cleaner separation - Data layer vs UI layer
- ✅ Easier testing - Can test data loading and UI independently
- ✅ No complex sync effects - Single direction data flow

**Data Flow:**

```typescript
// 1. Data Loader fetches everything
useReaderData() → { book, chapter, currentChapterNumber, currentChunkIndex }

// 2. ReaderUI receives loaded data
<ReaderUI 
  initialBook={book}
  initialChapter={chapter}
  initialChapterNumber={chapterNumber}
  initialChunkIndex={chunkIndex}  // ← Position already determined
/>

// 3. Audio controller starts at correct position
useSentenceAudioController(
  chapter,
  voice,
  provider,
  speed,
  ttsEnabled,
  initialChunkIndex,  // ← No sync needed!
  ...
)
```

### Legacy Architecture (Deprecated)

The old `useReader` hook combined data fetching and runtime state, leading to complex sync effects. It has been split into `useReaderData` and `useReaderState` for better separation of concerns.

### Component Hierarchy

```mermaid
graph TB
    A[Reader.tsx] --> B[ReaderDataLoader.tsx]
    B --> C[useReaderData Hook]
    B --> D[ReaderUI.tsx]
    D --> E[useReaderState Hook]
    E --> F[useSentenceAudioController]
    E --> G[useUserSettings]
    E --> H[useBookmarks]
    E --> I[useReadingProgress]
    E --> J[useReadingLogs]
    
    F --> K[Audio Playback]
    F --> L[Word Highlighting]
    
    J --> M[Reading Sessions DB]
    
    D --> N{Mode?}
    N -->|Full| O[ReaderContent]
    N -->|Focus| P[FocusReader]
    
    O --> Q[ChunkRenderer]
    Q --> R[TextChunk]
    Q --> S[HeaderChunk]
    Q --> T[ImageChunk]
    
    R --> U[EnhancedText]
    U --> V[Word Elements with data-attributes]
    
    L --> V
    
    style F fill:#90EE90
    style L fill:#FFD700
    style R fill:#87CEEB
    style J fill:#FFA07A
```

## Simplified Index System

### How It Works

**Chapter Structure:**
```typescript
chapter.content.chunks = [
    { index: 0, type: 'header', text: 'Chapter Title' },
    { index: 1, type: 'text', text: 'First paragraph...' },
    { index: 2, type: 'text', text: 'Second paragraph...' },
    { index: 3, type: 'image', imageName: 'figure1.jpg' },
    { index: 4, type: 'text', text: 'Third paragraph...' },
    // ...
]
```

**Sentence Array (No Filtering!):**
```typescript
// useSentenceAudioController.ts
const sentences = chapter?.content?.chunks || [];  // ALL chunks!

// Sentence index 0 = Chunk index 0 (header)
// Sentence index 1 = Chunk index 1 (text)
// Sentence index 2 = Chunk index 2 (text)
// Sentence index 3 = Chunk index 3 (image)
// Sentence index 4 = Chunk index 4 (text)
```

**Benefits:**
- ✅ No mapping function needed
- ✅ Direct array access: `sentences[chunkIndex]`
- ✅ Simple debugging: indices match everywhere
- ✅ Cleaner code: 40+ lines removed

### How Different Chunk Types Are Handled

**TTS Generation:**
```typescript
const loadSentence = async (index: number) => {
    const chunk = sentences[index];
    
    // Skip only images - generate TTS for both text and headers
    if (chunk.type === 'image' || !chunk.text?.trim()) {
        return;  // No TTS generated
    }
    
    // Generate TTS for text and header chunks
    await generateTts({ text: chunk.text, ... });
};
```

**Playback:**
```typescript
const play = async () => {
    const chunk = sentences[currentSentenceIndex];
    
    // Auto-advance past images only
    if (chunk.type === 'image' || !chunk.text?.trim()) {
        const nextPlayableIndex = sentences.findIndex(
            (c, i) => i > currentSentenceIndex && 
            (c.type === 'text' || c.type === 'header') && 
            c.text?.trim()
        );
        if (nextPlayableIndex !== -1) {
            goToSentence(nextPlayableIndex);
            setTimeout(() => play(), 50);
        }
        return;
    }
    
    // Play text or header chunk normally
    await loadSentence(currentSentenceIndex);
    // ...
};
```

**Navigation:**
```typescript
/**
 * Core navigation helper that handles audio state transitions consistently.
 * Stops current audio, navigates to new index, and resumes playback if needed.
 */
const navigateToSentenceIndex = (newIndex: number) => {
    const { intendedPlay } = stateRef.current;
    const clamped = Math.max(0, Math.min(sentences.length - 1, newIndex));

    // Stop current audio if playing
    const audio = audioRef.current;
    if (audio) {
        audio.pause();
        update({ isPlaying: false });
    }

    // Update to new sentence
    const newState = { currentSentenceIndex: clamped, currentWordIndex: 0 };
    update(newState);

    // CRITICAL: Update stateRef immediately so play() sees the new index
    stateRef.current = { ...stateRef.current, ...newState };

    // If audio was playing, start playing the new chunk
    if (intendedPlay) {
        setTimeout(() => void play(), 50);
    }
};

const goToSentence = (index: number) => {
    navigateToSentenceIndex(index);
};

const nextSentence = () => {
    const { currentSentenceIndex } = stateRef.current;
    // Find next playable chunk (text or header)
    const nextPlayableIndex = sentences.findIndex(
        (c, i) => i > currentSentenceIndex && 
        (c.type === 'text' || c.type === 'header') && 
        c.text?.trim()
    );
    if (nextPlayableIndex !== -1) {
        navigateToSentenceIndex(nextPlayableIndex);
    }
};

const prevSentence = () => {
    const { currentSentenceIndex } = stateRef.current;
    // Find previous playable chunk (text or header)
    let foundIndex = -1;
    for (let i = currentSentenceIndex - 1; i >= 0; i--) {
        const chunk = sentences[i];
        if (chunk && (chunk.type === 'text' || chunk.type === 'header') && chunk.text?.trim()) {
            foundIndex = i;
            break;
        }
    }
    
    if (foundIndex !== -1) {
        navigateToSentenceIndex(foundIndex);
    }
};
```

## Audio Playback System

### useSentenceAudioController Hook

The central hook managing all audio playback:

```typescript
export function useSentenceAudioController(
    chapter: ChapterClient | null,
    selectedVoice: string,
    selectedProvider: TtsProvider,
    playbackSpeed: number,
    ttsEnabled: boolean,
    initialSentenceIndex: number | null,
    initialWordIndex: number | null,
    highlightMode: 'word' | 'line' | 'off',
    wordTimingOffset: number = 0
): SentenceAudioApi
```

**Key Features:**
- Manages audio state (playing, current index, loading state)
- Generates TTS on-demand with caching
- Applies word timing offset for highlight synchronization
- Tracks word timing for word-level highlighting
- Handles auto-advance at sentence end
- Pre-loads adjacent sentences with priority loading
- Provides visual feedback when loading current sentence

### Audio State

```typescript
interface SentenceAudioState {
    currentSentenceIndex: number;       // Current chunk index (sentence index = chunk index!)
    currentWordIndex: number;           // Current word within sentence
    isPlaying: boolean;                 // Playback state
    intendedPlay: boolean;              // User wants continuous play
    isCurrentSentenceLoading: boolean;  // Loading state for current sentence only
    ttsError: string | null;            // Error message
    ttsServiceAvailable: boolean;       // TTS service status
}

interface SentenceAudioApi {
    sentences: TextChunkClient[];
    currentSentenceIndex: number;
    currentWordIndex: number;
    isPlaying: boolean;
    isCurrentSentenceLoading: boolean;  // Exposed for UI loading indicators
    play: () => void;
    pause: () => void;
    nextSentence: () => void;
    prevSentence: () => void;
    goToSentence: (index: number) => void;
    handleWordClick: (sentenceIndex: number, wordIndex: number) => void;
    preload: (sentenceIndex: number) => void | Promise<void>;
    retryFailed: (sentenceIndex: number) => void;
    ttsError: string | null;
    ttsServiceAvailable: boolean;
}
```

### TTS Generation & Caching

```typescript
// Cache structure: { [chunkIndex]: { src: string, timepoints: Array } }
const cacheRef = useRef<Record<number, {
    src: string;
    timepoints: Array<{ time: number; wordIndex: number }>;
}>>({});

const loadSentence = async (index: number, isCurrentSentence: boolean = false) => {
    // Check if already cached
    if (cacheRef.current[index]) {
        // Clear loading state if this is current sentence
        if (isCurrentSentence) {
            update({ isCurrentSentenceLoading: false });
        }
        return;
    }
    
    // Skip non-playable chunks
    if (chunk.type === 'image' || !chunk.text?.trim()) return;
    
    // Mark as loading if this is the current sentence
    if (isCurrentSentence) {
        update({ isCurrentSentenceLoading: true });
    }
    
    try {
        // Generate TTS with word timing
        const result = await generateTts({
            text: chunk.text,
            provider: selectedProvider,
            voiceId: selectedVoice
        });
        
        // Cache audio + word timings
        cacheRef.current[index] = {
            src: `data:audio/mp3;base64,${result.audioContent}`,
            timepoints: result.timepoints.map((tp, i) => ({
                time: tp.timeSeconds,
                wordIndex: i
            }))
        };
    } finally {
        // Clear loading state if this was the current sentence
        if (isCurrentSentence) {
            update({ isCurrentSentenceLoading: false });
        }
    }
};
```

### Playback Flow

```mermaid
graph TB
    A[User Clicks Play] --> B{Current Chunk Type?}
    B -->|Text| C[Load TTS if needed]
    B -->|Header/Image| D[Find Next Text Chunk]
    D --> E[Update Index]
    E --> C
    C --> F[Play Audio]
    F --> G[Track Word Position via timeupdate]
    G --> H{Highlight Mode?}
    H -->|Word| I[Update Word Highlight]
    H -->|Line/Off| J[No Word Highlight]
    I --> K{Audio Ended?}
    J --> K
    K -->|Yes, Continue| L[Auto-Advance to Next]
    K -->|No| G
    L --> B
```

## Highlighting Systems

### Two Independent Systems

1. **Sentence Highlighting**: React-based, highlights entire sentence with background color
2. **Word Highlighting**: DOM-based, highlights individual word during playback

Both respect the `highlightMode` setting: `'word'`, `'line'`, or `'off'`.

### Sentence Highlighting (React-Based)

Simple conditional className application:

```typescript
// TextChunk.tsx
<div
    style={{
        backgroundColor: currentChunkIndex === chunkIndex 
            ? 'var(--sentence-highlight-color, transparent)' 
            : 'transparent'
    }}
    data-chunk-index={chunkIndex}
>
    {/* Content */}
</div>
```

**How it works:**
1. `currentChunkIndex` comes from audio controller
2. Each text chunk knows its own `chunkIndex`
3. When they match → apply sentence highlight color
4. React re-renders automatically when `currentChunkIndex` changes

### Word Highlighting (DOM-Based)

Direct DOM manipulation for performance:

```typescript
// WordHighlightingAPI.ts
export const WordHighlightingAPI = {
    highlightWord: (chunkIndex: number, wordIndex: number) => {
        const element = document.querySelector(
            `[data-word-id="chunk-${chunkIndex}-word-${wordIndex}"]`
        );
        if (element) {
            element.classList.add('highlight-word');
        }
    },
    
    unhighlightWord: (chunkIndex: number, wordIndex: number) => {
        const element = document.querySelector(
            `[data-word-id="chunk-${chunkIndex}-word-${wordIndex}"]`
        );
        if (element) {
            element.classList.remove('highlight-word');
        }
    }
};
```

**Word Elements:**
```typescript
// EnhancedText.tsx
<span
    data-chunk-index={chunkIndex}
    data-word-index={wordIndex}
    data-word-id={`chunk-${chunkIndex}-word-${wordIndex}`}
>
    {word}
</span>
```

**Highlight Update:**
```typescript
// useSentenceAudioController.ts
useEffect(() => {
    if (highlightMode !== 'word') return;
    if (!state.isPlaying) return;
    
    // Remove previous highlight
    if (previous) {
        WordHighlightingAPI.unhighlightWord(
            previous.sentenceIndex,  // = chunk index!
            previous.wordIndex
        );
    }
    
    // Add new highlight (no mapping needed!)
    WordHighlightingAPI.highlightWord(
        currentSentenceIndex,  // = chunk index!
        currentWordIndex
    );
}, [state.isPlaying, state.currentSentenceIndex, state.currentWordIndex]);
```

**CSS:**
```css
.highlight-word {
    background-color: var(--word-highlight-color, transparent);
    border-radius: 3px;
    box-shadow: 0 2px 3px rgba(0, 0, 0, 0.1);
    transition: all 0.2s ease;
}
```

## Component Structure

### Reader.tsx (Main Component)

The root component that orchestrates everything:

```typescript
export const Reader = () => {
    const { settings: appSettings } = useSettings();
    const {
        book,
        chapter,
        loading,
        audio,
        settings,
        bookmarks,
        navigation,
        progress,
        sentenceAudio
    } = useReader();
    
    const isFocusMode = appSettings.readingMode === 'focus';
    
    return (
        <UserThemeProvider {...settings}>
            {/* Mode Toggle */}
            <ToggleButtonGroup value={isFocusMode ? 'focus' : 'full'}>
                <ToggleButton value="full">Full</ToggleButton>
                <ToggleButton value="focus">Focus</ToggleButton>
            </ToggleButtonGroup>
            
            {/* Content */}
            {isFocusMode ? (
                <FocusReader controller={sentenceAudio.controller} />
            ) : (
                <ReaderContent
                    chapter={chapter}
                    currentChunkIndex={audio.currentChunkIndex}
                    {...props}
                />
            )}
            
            {/* Audio Controls */}
            <AudioControls
                onPlay={sentenceAudio.controller.play}
                onPause={sentenceAudio.controller.pause}
                onNext={sentenceAudio.controller.nextSentence}
                onPrev={sentenceAudio.controller.prevSentence}
                {...controlProps}
            />
        </UserThemeProvider>
    );
};
```

### useReader Hook

Central state management hook:

```typescript
export const useReader = () => {
    // Load book and chapter data
    const [state, setState] = useState<ReaderState>({
        book: null,
        chapter: null,
        currentChapterNumber: null,
        currentChunkIndex: null,
        loading: true,
        error: null
    });
    
    // Initialize audio controller (simplified - no mapping!)
    const sentenceAudio = useSentenceAudioController(
        state.chapter,
        userSettings.selectedVoice,
        userSettings.selectedProvider,
        userSettings.playbackSpeed,
        userSettings.ttsEnabled,
        state.currentChunkIndex ?? 0,
        0,
        userSettings.highlightMode,
        userSettings.wordSpeedOffset
    );
    
    // Create audio playback adapter
    const audioPlayback = {
        currentChunkIndex: sentenceAudio.currentSentenceIndex,  // Direct!
        currentWordIndex: sentenceAudio.currentWordIndex,
        isPlaying: sentenceAudio.isPlaying,
        // ...
    };
    
    return {
        book: state.book,
        chapter: state.chapter,
        audio: audioPlayback,
        settings: userSettings,
        sentenceAudio,
        // ...
    };
};
```

### ReaderContent (Full Mode)

Renders the entire chapter with scrolling:

```typescript
export const ReaderContent = ({
    chapter,
    currentChunkIndex,
    ...props
}) => {
    // Group chunks by paragraph
    const paragraphGroups = useParagraphGrouping(chapter.content.chunks);
    
    return (
        <Box>
            <ChunkRenderer
                paragraphGroups={paragraphGroups}
                currentChunkIndex={currentChunkIndex}
                {...props}
            />
        </Box>
    );
};
```

### ChunkRenderer

Renders different chunk types:

```typescript
export const ChunkRenderer = ({
    paragraphGroups,
    currentChunkIndex,
    ...props
}) => {
    const renderChunk = (chunk: TextChunkClient) => {
        switch (chunk.type) {
            case 'header':
                return <HeaderChunk chunk={chunk} chunkIndex={chunk.index} />;
            
            case 'image':
                return <ImageChunk chunk={chunk} chunkIndex={chunk.index} />;
            
            case 'text':
            default:
                return (
                    <TextChunk
                        chunk={chunk}
                        chunkIndex={chunk.index}  // Original chunk index!
                        currentChunkIndex={currentChunkIndex}
                        {...props}
                    />
                );
        }
    };
    
    return (
        <>
            {paragraphGroups.map(group => (
                <Box key={group.paragraphIndex}>
                    {group.chunks.map(chunk => renderChunk(chunk))}
                </Box>
            ))}
        </>
    );
};
```

### TextChunk Component

Renders individual text chunk with highlighting:

```typescript
export const TextChunk = ({
    chunk,
    chunkIndex,
    currentChunkIndex,
    handleLinkClick
}) => {
    const isHighlighted = currentChunkIndex === chunkIndex;
    
    return (
        <div
            style={{
                backgroundColor: isHighlighted 
                    ? 'var(--sentence-highlight-color, transparent)' 
                    : 'transparent'
            }}
            id={`text-chunk-${chunkIndex}`}
            data-chunk-index={chunkIndex}
            data-paragraph-index={chunk.paragraphIndex}
        >
            <EnhancedText
                chunk={chunk}
                chunkIndex={chunkIndex}
                onLinkClick={handleLinkClick}
            />
        </div>
    );
};
```

### EnhancedText Component

Renders words with data attributes for highlighting:

```typescript
export const EnhancedText = ({ chunk, chunkIndex }) => {
    const renderTextWithHighlighting = (text: string) => {
        const words = text.split(/\s+/);
        return (
            <>
                {words.map((word, wordIndex) => (
                    <span
                        key={wordIndex}
                        data-chunk-index={chunkIndex}
                        data-word-index={wordIndex}
                        data-word-id={`chunk-${chunkIndex}-word-${wordIndex}`}
                    >
                        {word}
                    </span>
                ))}
            </>
        );
    };
    
    return <span>{renderTextWithHighlighting(chunk.text)}</span>;
};
```

### FocusReader (Focus Mode)

Shows one sentence at a time in large text with special header styling:

```typescript
export const FocusReader = ({ controller, highlightMode }) => {
    const currentChunk = controller.sentences[controller.currentSentenceIndex];
    const isHeader = currentChunk?.type === 'header';
    const currentWords = currentChunk?.text.split(/\s+/) || [];
    
    return (
        <Box>
            {/* Current sentence/header display */}
            <Box
                sx={{
                    ...(isHeader && {
                        mx: -2,
                        px: 2,
                        py: 3,
                        backgroundColor: '#d3d3d3',  // Light gray in light mode
                        '@media (prefers-color-scheme: dark)': {
                            backgroundColor: '#333333'  // Dark gray in dark mode
                        },
                        borderTop: '2px solid var(--color-separator)',
                        borderBottom: '2px solid var(--color-separator)'
                    })
                }}
            >
                <Typography
                    variant={isHeader ? "h2" : "h4"}
                    sx={{
                        fontSize: isHeader ? `${fontSize * 2.2}rem` : `${fontSize * 1.5}rem`,
                        fontWeight: isHeader ? 800 : 700,
                        textAlign: 'center',
                        color: textColor,  // Uses user's theme color
                        letterSpacing: isHeader ? '-0.01em' : 'normal',
                        textTransform: isHeader ? 'uppercase' : 'none'
                    }}
                >
                    {currentWords.map((word, i) => (
                        <span
                            key={i}
                            className={
                                highlightMode === 'word' && 
                                controller.isPlaying && 
                                i === controller.currentWordIndex
                                    ? 'highlight-word'
                                    : ''
                            }
                            data-word-index={i}
                        >
                            {word}{' '}
                        </span>
                    ))}
                </Typography>
            </Box>
        </Box>
    );
};
```

**Focus Mode Features:**
- ✅ **Headers rendered distinctly** - Gray background, uppercase, larger font
- ✅ **Headers play with TTS** - Both text and headers are read aloud
- ✅ **User theme colors** - Text uses customizable theme colors
- ✅ **Word highlighting** - Works for both headers and text
- ✅ **Previous/Next preview** - Shows adjacent chunks with styling

## Data Flow

### Playback Flow

```mermaid
sequenceDiagram
    participant User
    participant AudioControls
    participant SentenceAudio
    participant TTS
    participant DOM
    participant React
    
    User->>AudioControls: Click Play
    AudioControls->>SentenceAudio: play()
    SentenceAudio->>SentenceAudio: Check chunk type
    
    alt Non-Text Chunk
        SentenceAudio->>SentenceAudio: Find next text chunk
        SentenceAudio->>SentenceAudio: Update index
    end
    
    SentenceAudio->>TTS: Generate audio if not cached
    TTS-->>SentenceAudio: Audio + word timings
    SentenceAudio->>SentenceAudio: Cache result
    SentenceAudio->>SentenceAudio: Start audio playback
    
    loop Every 10ms (timeupdate event)
        SentenceAudio->>SentenceAudio: Get current time
        SentenceAudio->>SentenceAudio: Calculate word index
        
        alt Highlight Mode = Word
            SentenceAudio->>DOM: Update word highlight
        end
        
        SentenceAudio->>React: Update state (chunk index)
        React->>React: Re-render with sentence highlight
    end
    
    SentenceAudio->>SentenceAudio: Audio ended
    
    alt Intended Play
        SentenceAudio->>SentenceAudio: Auto-advance to next
        SentenceAudio->>SentenceAudio: play() next sentence
    end
```

### State Update Flow

```mermaid
graph LR
    A[Audio Event] --> B[useSentenceAudioController]
    B --> C[Update State]
    C --> D{Index Changed?}
    D -->|Yes| E[useReader receives update]
    D -->|No| F[Skip update]
    E --> G[audioPlayback object updated]
    G --> H[Reader.tsx re-renders]
    H --> I[TextChunk receives new currentChunkIndex]
    I --> J[Sentence highlight updates]
    
    B --> K{Word Index Changed?}
    K -->|Yes| L[WordHighlightingAPI.highlightWord]
    K -->|No| M[No action]
    L --> N[DOM updated directly]
    
    style B fill:#90EE90
    style L fill:#FFD700
    style J fill:#87CEEB
```

## Key Features

### 1. Dual Mode Support

**Full Mode:**
- Shows entire chapter
- Scrollable content
- Sentence highlighting follows audio
- "Scroll to current" FAB when out of view

**Focus Mode:**
- One sentence at a time
- Large, centered text
- Minimal distractions
- Previous/Next sentence preview

### 2. Real-Time Highlighting

**Word-Level (DOM-based):**
- Updates every 10ms during playback
- No React re-renders
- Smooth, performant
- Configurable color

**Sentence-Level (React-based):**
- Updates when sentence changes
- Automatic with React
- Configurable background color

### 3. Automatic Progress Tracking

- Saves current position (chapter + chunk)
- **Syncs on every sentence change** - Both modes track progress
- Tracks reading time and sessions
- Syncs with server (debounced)
- **Restores position on reload** - Always starts at saved position
- **Position initialization fix** - Controller sync prevents race conditions

**Implementation:**
```typescript
// Sync state.currentChunkIndex with audio controller
// Prevent controller from overwriting initial loaded position
const hasInitialized = useRef(false);

useEffect(() => {
    // On first load, initialize controller with loaded position
    if (!hasInitialized.current && state.currentChunkIndex !== null && !state.loading) {
        hasInitialized.current = true;
        if (state.currentChunkIndex !== 0 && state.currentChunkIndex !== sentenceAudio.currentSentenceIndex) {
            sentenceAudio.goToSentence(state.currentChunkIndex);
        }
        prevSentenceIndexRef.current = state.currentChunkIndex;
        return;
    }
    
    // After initialization, sync controller changes back to state
    if (hasInitialized.current && sentenceAudio.currentSentenceIndex !== prevSentenceIndexRef.current) {
        prevSentenceIndexRef.current = sentenceAudio.currentSentenceIndex;
        setCurrentChunkIndex(sentenceAudio.currentSentenceIndex);
    }
}, [sentenceAudio.currentSentenceIndex, setCurrentChunkIndex, state.currentChunkIndex, state.loading, sentenceAudio]);

// useReadingProgress tracks currentChunkIndex and saves automatically
```

**Position Restoration Fix (v2.1):**
- ✅ **Race condition eliminated** - One-time initialization prevents controller from resetting position
- ✅ **Bidirectional sync** - State → Controller on load, Controller → State during playback
- ✅ **No infinite loops** - Proper guards with `hasInitialized` ref
- ✅ **Works in both modes** - Full and Focus modes restore correctly

### 4. Reading Session Logging

The `useReadingLogs` hook automatically tracks and logs every chunk played during a reading session:

**Key Features:**
- **Automatic logging** - Logs each text/header chunk when audio plays
- **User-specific** - Uses authenticated user ID from `useAuth()`
- **Direct index mapping** - Uses `sentenceAudio.currentSentenceIndex` directly (no filtering)
- **Smart filtering** - Only logs text and header chunks, skips images
- **Session grouping** - Server groups logs into reading sessions (5-minute gaps)

**Implementation:**
```typescript
// In useReader hook
useReadingLogs({
    userId: user?.id || '',
    bookId,
    chapter: state.chapter,
    currentChunkIndex: sentenceAudio.currentSentenceIndex,  // Direct from audio controller
    isPlaying: audioPlayback.isPlaying
});

// In useReadingLogs hook
const logChunk = async (chunkIndex: number) => {
    // Get all chunks (chunkIndex refers to position in full array)
    const allChunks = chapter.content.chunks;
    const chunk = allChunks[chunkIndex];
    
    // Only log text and header chunks (skip images and empty chunks)
    if (chunk.type === 'image' || !chunk.text?.trim()) return;
    
    await createReadingLog({
        userId,
        bookId,
        chapterNumber: chapter.chapterNumber,
        chunkIndex,
        chunkText: chunk.text
    });
};
```

**Reading History:**
- View all reading sessions at `/reading-history`
- Sessions grouped by date
- Shows book, chapter, duration, and chunks read
- Click to resume from any logged position

**Important:** The hook uses the actual playing position (`sentenceAudio.currentSentenceIndex`) to avoid render cycle delays and index mismatches.

### 5. Bookmarks

- Quick-add with audio controls
- Jump to bookmarked position
- Persists across sessions
- Chapter + chunk index stored

### 6. Offline Support

**Online-First Strategy:**
- When **online**: Always fetches fresh data from network (no stale cache issues)
- When **offline**: Falls back to cached chapters (offline reading)
- Cache is only used when network is unavailable

**Implementation:**
```typescript
const loadChapterPreferOffline = useCallback(async (
    bookIdParam: string,
    chapterNumber: number
): Promise<{ chapter: ChapterClient | null; fromLocal: boolean }> => {
    // When online, always fetch fresh data from network
    if (isOnline()) {
        const chapterResult = await getChapterByNumber({ bookId: bookIdParam, chapterNumber });
        return { chapter: chapterResult.data?.chapter || null, fromLocal: false };
    }
    
    // When offline, use cached chapter
    const localRec = await offlineDB.getChapterByBookAndNumber(bookIdParam, chapterNumber);
    if (localRec) {
        return { chapter: buildChapterFromLocal(localRec), fromLocal: true };
    }
    
    // Offline but no cached chapter available
    return { chapter: null, fromLocal: false };
}, [buildChapterFromLocal]);
```

**Offline Management:**
- Download chapters for offline reading via download UI
- Clear offline data: `await window.indexedDB.deleteDatabase('offline-reader-db')`
- Better error messages distinguish between offline unavailable vs not found

**Benefits:**
- ✅ **Always fresh when online** - No stale cache issues
- ✅ **Works offline** - Can read downloaded chapters without internet
- ✅ **Correct position restoration** - No conflicts between cached and server data
- ✅ **Clear error messages** - Users know when they need internet vs cached chapter is missing

### 7. Theme Customization

- Font size, family, line height
- Text color (per-mode: light/dark)
- Word highlight color (per-mode: light/dark)
- Sentence highlight color (per-mode: light/dark)
- Light/Dark theme
- **Highlight Mode** (`'word'` | `'line'` | `'off'`) - Persisted per user

**Highlight Mode Persistence:**
```typescript
// Saved to user settings in database
interface UserSettings {
    highlightMode?: 'word' | 'line' | 'off';
    // ... other settings
}

// Updated via Theme & Appearance modal
const handleHighlightModeChange = async (mode: 'word' | 'line' | 'off') => {
    updateState({ highlightMode: mode });
    await updateUserSettings({ 
        userId, 
        settings: { highlightMode: mode } 
    });
};
```

### 8. Speed Control

- Playback speed (0.5x - 2.0x)
- Voice selection (multiple providers)
- TTS provider selection
- **Word timing offset adjustment** (-500ms to +500ms)

**Word Timing Offset:**
The word timing offset allows users to adjust when word/line highlighting occurs relative to the audio:
- **Positive offset** (e.g., +100ms): Highlights advance 100ms earlier than the audio
- **Negative offset** (e.g., -100ms): Highlights advance 100ms later than the audio
- Applied in `handleTimeUpdate` by adjusting `audio.currentTime` before comparing with timepoints
- Works for both **word** and **line** highlighting modes in Full and Focus readers
- **Reactive**: Changes apply immediately during playback without needing to restart

```typescript
// In useSentenceAudioController
useEffect(() => {
    const audio = audioRef.current;
    
    const handleTimeUpdate = () => {
        const currentTime = audio.currentTime;
        // Apply offset (convert ms to seconds)
        // Positive = highlight earlier, negative = highlight later
        const adjustedTime = currentTime + (wordTimingOffset / 1000);
        
        // Find current word based on adjusted time
        let newWordIndex = 0;
        for (let i = 0; i < timepoints.length; i++) {
            if (adjustedTime >= timepoints[i].time) {
                newWordIndex = timepoints[i].wordIndex;
            } else {
                break;
            }
        }
        // Update state triggers both word and line highlights
        setState(prev => ({ ...prev, currentWordIndex: newWordIndex }));
    };
    
    audio.addEventListener('timeupdate', handleTimeUpdate);
    return () => audio.removeEventListener('timeupdate', handleTimeUpdate);
    
    // IMPORTANT: wordTimingOffset in dependency array ensures
    // the event listener updates when offset changes
}, [wordTimingOffset, ...otherDeps]);
```

**Implementation Note:** The `wordTimingOffset` parameter must be included in the `useEffect` dependency array to ensure the event listener is recreated when the offset changes, preventing stale closure issues.

### 9. Smart Audio Navigation

**Next/Prev Button Behavior:**
- **Stops current audio** immediately
- **Navigates** to next/previous playable chunk
- **Auto-resumes playback** if audio was playing before navigation
- **Maintains state** if audio was paused

**Refactored Architecture (v2.0):**
All navigation methods (`goToSentence`, `nextSentence`, `prevSentence`) now use a shared helper function to ensure consistent behavior and eliminate code duplication.

```typescript
/**
 * Core navigation helper that handles all audio state transitions.
 * Prevents race conditions by immediately updating stateRef.
 */
const navigateToSentenceIndex = (newIndex: number) => {
    const { intendedPlay } = stateRef.current;
    
    // Stop current audio
    const audio = audioRef.current;
    if (audio) {
        audio.pause();
        update({ isPlaying: false });
    }
    
    // Update state
    const newState = { currentSentenceIndex: newIndex, currentWordIndex: 0 };
    update(newState);
    
    // CRITICAL: Update stateRef immediately to prevent race conditions
    stateRef.current = { ...stateRef.current, ...newState };
    
    // Resume if was playing
    if (intendedPlay) {
        setTimeout(() => play(), 50);
    }
};

// All navigation methods delegate to the shared helper
const goToSentence = (index: number) => navigateToSentenceIndex(index);
const nextSentence = () => {
    const nextIndex = findNextPlayableChunk();
    if (nextIndex !== -1) navigateToSentenceIndex(nextIndex);
};
const prevSentence = () => {
    const prevIndex = findPreviousPlayableChunk();
    if (prevIndex !== -1) navigateToSentenceIndex(prevIndex);
};
```

**Benefits of Refactoring:**
- ✅ **Single source of truth** - One function handles all audio transitions
- ✅ **Race condition fix** - Immediate `stateRef` update prevents stale reads
- ✅ **Consistency** - All navigation methods behave identically
- ✅ **Maintainability** - Changes to navigation logic only need to be made once
- ✅ **Reduced code** - Eliminated ~80 lines of duplicate code

## Usage Examples

### Basic Playback

```typescript
// Get audio controller from useReader
const { sentenceAudio } = useReader();

// Play current sentence
sentenceAudio.controller.play();

// Pause
sentenceAudio.controller.pause();

// Next sentence (finds next text chunk automatically)
sentenceAudio.controller.nextSentence();

// Previous sentence (finds previous text chunk)
sentenceAudio.controller.prevSentence();

// Jump to specific chunk
sentenceAudio.controller.goToSentence(42);  // Chunk index 42
```

### Highlighting Control

```typescript
// Set highlight mode
updateSettings({ highlightMode: 'word' });  // or 'line' or 'off'

// Customize colors
updateSettings({
    highlightColor: '#ffeb3b',           // Word highlight
    sentenceHighlightColor: '#e3f2fd'    // Sentence highlight
});
```

### Navigation

```typescript
// Change chapter
navigation.setCurrentChapterNumber(5);

// Jump to bookmark
navigation.handleNavigateToBookmark(chapterNumber, chunkIndex);

// Previous/Next chapter
navigation.handlePreviousChapter();
navigation.handleNextChapter();
```

## Performance Optimizations

### 1. TTS Caching
```typescript
// Cache structure prevents re-generation
const cacheRef = useRef<Record<number, { src: string; timepoints: Array }>({});

// Check cache before generating
if (cacheRef.current[index]) {
    // Use cached audio
    return;
}
```

### 2. Smart TTS Pre-fetching with Priority Loading

**TTS Toggle Handling:**
```typescript
// Detect when TTS is toggled from OFF to ON
const prevTtsEnabledRef = useRef(ttsEnabled);

useEffect(() => {
    // Reset flag when TTS is toggled on (from false to true)
    if (ttsEnabled && !prevTtsEnabledRef.current) {
        hasInitiallyLoadedRef.current = false;
    }
    prevTtsEnabledRef.current = ttsEnabled;
    
    // ... prefetching logic runs with reset flag
}, [ttsEnabled, state.currentSentenceIndex]);
```

**Priority Loading Strategy:**
```typescript
// When TTS is enabled or page loads: Priority + Background approach
if (!hasInitiallyLoadedRef.current && sentences.length > 0 && ttsEnabled) {
    // PRIORITY: Load current + next sentence first (parallel)
    const currentLoad = loadSentence(currentSentenceIndex, true);
    const nextLoad = currentSentenceIndex + 1 < sentences.length 
        ? loadSentence(currentSentenceIndex + 1) 
        : Promise.resolve();
    
    hasInitiallyLoadedRef.current = true;
    
    // BACKGROUND: After priority loads complete, prefetch +2 and +3
    void Promise.all([currentLoad, nextLoad]).then(() => {
        const furtherIndexes = [
            currentSentenceIndex + 2,
            currentSentenceIndex + 3
        ].filter(i => i >= 0 && i < sentences.length);
        furtherIndexes.forEach(i => void loadSentence(i));
    });
}
```

**Rolling Window Strategy:**
```typescript
// When moving between sentences: maintain 3-sentence lookahead
else if (hasInitiallyLoadedRef.current && ttsEnabled) {
    // Load current if not cached (with loading state)
    const isCached = !!cacheRef.current[currentSentenceIndex];
    if (!isCached) {
        void loadSentence(currentSentenceIndex, true);
    }
    
    // Prefetch +3 ahead (rolling window)
    const nextIndex = currentSentenceIndex + 3;
    if (nextIndex < sentences.length) {
        void loadSentence(nextIndex);
    }
    
    // Also prefetch previous for backward navigation
    const prevIndex = currentSentenceIndex - 1;
    if (prevIndex >= 0) {
        void loadSentence(prevIndex);
    }
}
```

**Loading State Tracking:**
```typescript
const loadSentence = async (index: number, isCurrentSentence: boolean = false) => {
    // Check if already cached
    if (cacheRef.current[index]) {
        if (isCurrentSentence) {
            update({ isCurrentSentenceLoading: false });
        }
        return;
    }
    
    // Mark as loading if this is the current sentence
    if (isCurrentSentence) {
        update({ isCurrentSentenceLoading: true });
    }
    
    try {
        // Generate TTS...
        const result = await generateTts({ text, provider, voiceId });
        cacheRef.current[index] = { src, timepoints };
    } finally {
        // Clear loading state
        if (isCurrentSentence) {
            update({ isCurrentSentenceLoading: false });
        }
    }
};
```

**Visual Loading Indicator:**
The AudioControls component displays a circular progress spinner around the play button when loading:
```typescript
// In AudioControls.tsx
{isCurrentChunkLoading && (
    <CircularProgress
        size={72}
        thickness={2}
        sx={{
            color: '#4caf50',
            position: 'absolute',
            // Centered over play button
        }}
    />
)}
```

**Benefits:**
- ⚡ **Fastest time-to-play** - current sentence loads first (priority)
- 🎯 **Smart prioritization** - most critical audio loads before others
- 🔄 **Background prefetching** - next sentences load seamlessly after
- 📊 **Loading feedback** - visual spinner shows when current sentence is loading
- ✅ **TTS toggle aware** - prefetches immediately when TTS is enabled
- 🎵 **Smooth playback** - 3-sentence buffer maintains seamless transitions
- 🔀 **Navigation ready** - uncached sentences load with visual feedback

### 3. DOM-Based Word Highlighting
```typescript
// No React re-renders for word updates
useEffect(() => {
    // Direct DOM manipulation
    WordHighlightingAPI.highlightWord(chunkIndex, wordIndex);
}, [state.currentWordIndex]);
```

### 4. Efficient Chunk Rendering
```typescript
// Only re-renders when currentChunkIndex changes
const isHighlighted = currentChunkIndex === chunkIndex;
```

### 5. Ref-Based State Tracking
```typescript
// Avoid stale closures in intervals
const stateRef = useRef(state);
useEffect(() => { stateRef.current = state; }, [state]);

// Use in async callbacks
const currentState = stateRef.current;
```

---

## Troubleshooting

### Reader Not Starting at Saved Position

**Symptom:** Reader always starts at beginning of chapter instead of last reading position (both Full and Focus modes).

**Root Causes Fixed in v2.1:**

1. **Race Condition**: Audio controller initialized at index 0, then overwrote the loaded position
2. **Stale Offline Cache**: Cached chapter had fewer chunks than server, causing position to be clamped incorrectly

**Solutions Applied:**

**Fix 1: Position Initialization (Lines 321-342 in `useReader.ts`)**
```typescript
const hasInitialized = useRef(false);

useEffect(() => {
    // One-time initialization: Set controller to loaded position
    if (!hasInitialized.current && state.currentChunkIndex !== null && !state.loading) {
        hasInitialized.current = true;
        if (state.currentChunkIndex !== 0) {
            sentenceAudio.goToSentence(state.currentChunkIndex);
        }
        prevSentenceIndexRef.current = state.currentChunkIndex;
        return; // Prevent sync on first run
    }
    
    // After initialization: Sync controller changes to state
    if (hasInitialized.current && sentenceAudio.currentSentenceIndex !== prevSentenceIndexRef.current) {
        prevSentenceIndexRef.current = sentenceAudio.currentSentenceIndex;
        setCurrentChunkIndex(sentenceAudio.currentSentenceIndex);
    }
}, [sentenceAudio.currentSentenceIndex, setCurrentChunkIndex, state.currentChunkIndex, state.loading]);
```

**Fix 2: Online-First Data Loading (Lines 69-87 in `useReader.ts`)**
```typescript
// When online, always fetch fresh data (no stale cache)
if (isOnline()) {
    const chapterResult = await getChapterByNumber({ bookId, chapterNumber });
    return { chapter: chapterResult.data?.chapter || null, fromLocal: false };
}

// Only use offline cache when actually offline
const localRec = await offlineDB.getChapterByBookAndNumber(bookId, chapterNumber);
if (localRec) {
    return { chapter: buildChapterFromLocal(localRec), fromLocal: true };
}
```

**Expected Behavior:**
- ✅ Reader loads data → Initializes controller at saved position → Displays UI
- ✅ No "jump" from 0 to saved position
- ✅ Works in both Full and Focus modes
- ✅ Fresh data when online prevents stale cache issues

**If Still Not Working:**
1. Clear offline data: `await window.indexedDB.deleteDatabase('offline-reader-db')`
2. Check console for loading logs
3. Verify reading progress is being saved (check Network tab for API calls)

### Audio Error Handling

**How Error Handling Works:**

The audio system implements smart error filtering and recovery:

1. **Expected Browser Errors (Filtered):**
   - "interrupted" errors when changing audio source
   - "AbortError" when rapidly switching between chunks
   - These are logged to console.debug but NOT shown to users

2. **Real TTS Errors (Displayed):**
   - TTS generation failures
   - Network errors
   - Service unavailability
   - Invalid voice/provider configuration

**Error UX Behavior:**
```typescript
// In useSentenceAudioController.ts
try {
    await audio.play();
    // Auto-clear errors on successful playback
    update({ isPlaying: true, intendedPlay: true, ttsError: null });
} catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Playback failed';
    
    // Filter expected browser errors
    const isExpectedBrowserError = errorMessage.includes('interrupted') || 
                                    errorMessage.includes('AbortError');
    
    if (!isExpectedBrowserError) {
        // Only report unexpected errors to the user
        update({ ttsError: errorMessage, isPlaying: false });
    }
}
```

**User Control During Errors:**
- ✅ **Pause button is NEVER disabled** - users can always stop playing audio
- ✅ **Play button is only disabled for real errors** - not for expected browser events
- ✅ **Errors are dismissible** - users can click X to clear error messages
- ✅ **Errors auto-clear** - successful playback automatically clears previous errors

**Common Error Messages:**

| Error | Cause | User Action |
|-------|-------|-------------|
| "Audio service is currently unavailable" | TTS provider down or API key invalid | Check settings, verify provider configuration |
| "Audio unavailable: TTS failed" | TTS generation error | Retry, check network connection |
| No error shown | Expected browser interruption (filtered) | None needed - audio continues normally |

### Word Timing Offset Not Working

**Symptom:** Changing the Word Timing Adjustment slider doesn't affect highlight timing.

**Cause:** Missing dependency in `useEffect` causes stale closure - event listener uses old offset value.

**Solution:** Ensure `wordTimingOffset` is in the dependency array:
```typescript
useEffect(() => {
    // ... handleTimeUpdate uses wordTimingOffset
    audio.addEventListener('timeupdate', handleTimeUpdate);
    return () => audio.removeEventListener('timeupdate', handleTimeUpdate);
}, [sentences.length, goToSentence, play, wordTimingOffset]); // ← Must include wordTimingOffset
```

**Expected Behavior:** Offset changes apply immediately during playback without restart.

### Highlights Out of Sync with Audio

**Possible Causes:**
1. **TTS provider timing issues** - Different providers have different timing accuracy
2. **Playback speed** - Higher speeds may amplify timing inaccuracies
3. **Word boundary detection** - Some words may have incorrect timing from TTS

**Solution:** Use Word Timing Adjustment to manually calibrate:
- If highlights lag behind: Use positive offset (+50ms to +200ms)
- If highlights jump ahead: Use negative offset (-50ms to -200ms)
- Adjust in 25ms increments while playing to find optimal value

### Line Highlighting Position Not Updating

**Symptom:** In Focus Mode with line highlighting, the highlight bar doesn't move or moves to wrong position.

**Cause:** The line position calculation in `FocusReader` depends on `currentWordIndex` from `useSentenceAudioController`.

**Check:**
1. Verify `ttsEnabled` is true (line highlighting disabled when TTS off)
2. Ensure `highlightMode === 'line'`
3. Check that words have `data-word-index` attributes
4. Verify `currentWordIndex` is updating (check React DevTools)

**Debug:**
```typescript
// In FocusReader.tsx, add console log to track updates
useEffect(() => {
    console.log('Line position update:', { currentWordIndex, linePos });
}, [currentWordIndex, linePos]);
```

### Audio Not Playing After Navigation

**Symptom:** Audio stops after using Next/Prev buttons and doesn't resume, or continues playing the old sentence.

**Common Causes:**

1. **Race Condition (Fixed in v2.0):** The `stateRef.current` was not updated immediately, causing `play()` to read stale index values.

**Solution:** Use the refactored navigation system that immediately updates `stateRef`:
```typescript
const navigateToSentenceIndex = (newIndex: number) => {
    // ... pause audio, update state ...
    
    // CRITICAL: Update stateRef immediately
    stateRef.current = { ...stateRef.current, ...newState };
    
    // Now play() will see the correct index
    if (intendedPlay) {
        setTimeout(() => void play(), 50);
    }
};
```

2. **`intendedPlay` flag not set correctly:** 

**Expected Behavior:**
- If audio was playing: Next/Prev should stop current audio and start playing new chunk
- If audio was paused: Next/Prev should navigate but stay paused

**Debug:**
```typescript
// In useSentenceAudioController.ts
console.log('Navigation:', { 
    intendedPlay: stateRef.current.intendedPlay,
    currentSentenceIndex: stateRef.current.currentSentenceIndex,
    newIndex 
});
```

**Note:** As of v2.0, all navigation methods use the shared `navigateToSentenceIndex` helper which properly handles audio state transitions and prevents race conditions.

---

## Migration from Old System

If you're familiar with the old implementation:

### What Changed

**Before:**
```typescript
// Filtered array
const sentences = chunks.filter(c => c.type === 'text');
// Mapping function needed
const chunkIndex = sentenceToChunkIndex(sentenceIndex);
// Complex index translation
```

**After:**
```typescript
// All chunks
const sentences = chapter?.content?.chunks || [];
// Direct mapping
const chunkIndex = sentenceIndex;  // They're the same!
// No translation needed
```

### Benefits

- ✅ **40+ lines of code removed**
- ✅ **No `sentenceToChunkIndex` function**
- ✅ **Simpler debugging** (indices match everywhere)
- ✅ **Easier to understand**
- ✅ **Same functionality**

---

**For more details on highlighting systems, see:**
- [Highlighting Systems Documentation](../../../docs/highlighting-systems.md)

**Related Components:**
- `AudioControls.tsx` - Playback controls UI
- `ThemeModal.tsx` - Theme customization
- `SpeedControlModal.tsx` - Speed and voice settings


