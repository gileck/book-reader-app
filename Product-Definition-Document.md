# Ebook Reader with Natural Voice Reader - Product Definition Document

## Table of Contents
1. [Overview](#overview)
2. [Core Features](#core-features)
3. [Technical Architecture](#technical-architecture)
4. [Implementation Details](#implementation-details)

---

## Overview

The Ebook Reader is a web-based application that combines traditional text reading with synchronized audio narration. The application provides word-level highlighting synchronized with natural voice text-to-speech, creating an immersive reading experience similar to audiobooks but with visual text tracking.

### Key Objectives
- Provide seamless text-to-speech with precise word-level synchronization
- Support progressive chapter-based reading with bookmark functionality
- Maintain high performance with large texts through optimized rendering
- Offer customizable reading experience (themes, speeds, voices)

---

## Core Features

### 1. Text-to-Speech with Word-Level Synchronization
**Description**: Real-time highlighting of individual words as they are spoken by the TTS engine.

**User Experience**: 
- Text displays in a clean, readable format with the current sentence highlighted in light blue
- As audio plays, individual words are highlighted in bright yellow, creating a "karaoke effect"
- Users can double-click any word to jump directly to that position in the audio
- Visual feedback is immediate and smooth, with subtle transitions between word highlights

**User Flow**:
1. User clicks play button in audio control bar
2. Audio begins playing with visual highlighting automatically synchronized
3. Current sentence gets subtle background highlight for context
4. Individual words get bright highlight as they're spoken
5. User can pause/resume at any time, with highlighting immediately stopping/resuming

**How it works**: 
The system embeds SSML timing markers before each word in the text, then sends this marked-up text to Google Cloud Text-to-Speech API. The API returns both the audio file and precise timepoint data indicating when each word marker is reached during speech. During playback, the system continuously monitors audio current time and maps it to word indices, applying visual highlights in real-time. This creates seamless synchronization between spoken words and visual text highlighting.

### 2. Progressive Audio Loading
**Description**: Efficient audio management that pre-loads current and next audio chunks to minimize waiting time.

**User Experience**:
- Instantaneous playback when user clicks play - no waiting for audio generation
- Seamless transitions between sentences/paragraphs with no gaps or delays
- Loading indicators appear only when necessary (poor network conditions)
- Audio quality remains consistent throughout the reading session

**User Flow**:
1. User opens chapter or navigates to new section
2. Current sentence audio loads immediately in background
3. Next sentence begins loading automatically
4. User experiences smooth, uninterrupted playback
5. System intelligently preloads ahead based on reading speed

**How it works**:
Text is automatically divided into optimal chunks based on sentence boundaries and word count (5-15 words per chunk). The system maintains an intelligent cache that always keeps the current chunk loaded, preloads the next chunk, and begins loading subsequent chunks when current audio reaches 50% completion. LRU cache eviction removes old chunks when memory limits are reached, while duplicate request prevention ensures efficient network usage.

### 3. Windowed Text Rendering
**Description**: Performance optimization that only renders visible text portions for large documents.

**User Experience**:
- Smooth scrolling through long chapters without lag or freezing
- Instant response to navigation commands (chapter jumps, bookmark selection)
- Content appears seamlessly as user scrolls up/down
- No visual indication of the underlying performance optimization

**User Flow**:
1. User scrolls through text naturally
2. Content loads dynamically above/below current view
3. User can jump to any chapter or bookmark instantly
4. Large books (100,000+ words) feel as responsive as short articles
5. Audio navigation automatically scrolls to current position

**How it works**:
The system uses virtual scrolling to render only chunks within a dynamic window around the current reading position (typically 10 chunks above and below). Intersection Observer API monitors invisible trigger elements at the top and bottom of the rendered content, automatically expanding the visible range when users scroll near boundaries. When audio navigation jumps to distant positions, the system immediately updates the visible range and smoothly scrolls to the target location.

### 4. Bookmarking System
**Description**: Users can save reading positions and add custom bookmark names.

**User Experience**:
- One-click bookmarking via dedicated bookmark button in audio controls
- Visual bookmark icons appear next to bookmarked sentences
- Dropdown menu for quick navigation between all bookmarks
- Custom bookmark names with preview text for easy identification

**User Flow**:
1. User finds interesting passage while reading/listening
2. Clicks bookmark button in audio control bar
3. Optional: Provides custom name for bookmark (defaults to "Bookmark #")
4. Bookmark icon appears next to the sentence
5. User can later access bookmark dropdown to jump to any saved position
6. Clicking bookmark again removes it (toggle behavior)

**How it works**:
Bookmarks capture precise reading positions using chapter index and chunk index coordinates, along with preview text and custom names. Data is stored in the database with automatic validation and error handling. The system prevents duplicate bookmarks at the same position, provides sorted bookmark lists for navigation, and includes import/export functionality for backup and sharing.

### 5. Speed Controls & Voice Selection
**Description**: Customizable playback speed and voice selection with real-time audio cache management.

**User Experience**:
- Speed control button shows current playback rate (e.g., "1.2x")
- Voice selection from variety of natural-sounding options
- Real-time adjustment without interrupting current playback
- Fine-tuning controls for word timing synchronization

**User Flow**:
1. User clicks speed button in audio controls
2. Modal opens with speed slider and voice options
3. Changes take effect immediately for current audio
4. User can fine-tune word synchronization with offset slider
5. Settings persist across sessions and chapters

**How it works**:
Playback speed adjustments are applied directly to HTML5 Audio elements without regenerating audio content. Voice changes trigger complete audio cache invalidation since different voices have different timing characteristics. Word timing offset provides fine-tuning by adding/subtracting milliseconds from the synchronization algorithm. All settings persist across sessions and automatically apply to newly loaded content.

### 6. Reading History & Progress Tracking
**Description**: Automatic tracking of reading progress with session persistence.

**User Experience**:
- Progress bar shows completion percentage for current chapter
- "X of Y sentences" counter provides granular progress feedback
- Automatic resume from last position when reopening app
- Visual indication of previously read content

**User Flow**:
1. User begins reading session
2. Progress automatically tracked as they advance through content
3. User closes app or navigates away
4. Upon return, app automatically resumes from exact last position
5. Progress metrics update in real-time during reading

**How it works**:
The system automatically tracks reading position changes and updates the database with current chapter and chunk indices. Progress metrics are calculated in real-time based on current position relative to total content. On app initialization, the system reads saved position data and automatically navigates to the last reading location, including proper audio and visual state restoration.

### 7. Audio Player Component
**Description**: Comprehensive audio control interface with playback controls, progress tracking, and settings access.

**User Experience**:
- Fixed audio control bar at bottom of screen (dark themed for contrast)
- Large, prominent play/pause button in center for primary action
- Intuitive left-to-right flow: chapter nav → chunk nav → play → chunk nav → settings
- Real-time progress bar showing completion percentage and position
- One-click access to speed, voice, and bookmark controls

**User Flow**:
1. User sees audio controls immediately upon opening any chapter
2. Can start playback with single click on central play button
3. Progress bar updates in real-time showing current position
4. Previous/Next buttons navigate between sentences (chunks)
5. Double-arrow buttons navigate between chapters
6. Speed button (showing current rate like "1.2x") opens speed/voice settings
7. Bookmark button toggles bookmark for current position
8. Settings gear provides appearance and advanced options

**Audio Control Layout**:
```
[◀◀] [◀] [▶] [▶] [1.2x] [⚙] [🔖]
Chapter Progress Text Speed Settings Bookmark
 Prev   Sentence    Next   Controls
```

**Key Controls**:
- **Play/Pause**: Large central button, primary user action
- **Previous/Next Sentence**: Navigate between audio chunks within chapter
- **Previous/Next Chapter**: Jump between book chapters
- **Speed Control**: Shows current rate, opens speed/voice modal
- **Settings**: Access to themes, appearance, advanced options
- **Bookmark**: One-click bookmark toggle with visual feedback
- **Progress Bar**: Linear progress with chapter completion percentage
- **Chapter Info**: Current chapter name and position display

**How it works**:
The audio player uses fixed positioning at the bottom of the viewport with a dark theme for visual contrast. HTML5 Audio API handles playback control while timeupdate events drive real-time progress bar updates. Control buttons trigger different navigation actions (sentence vs chapter level), and settings access opens modal dialogs with immediate preview of changes. The interface adapts responsively across device sizes with appropriate touch targets and keyboard shortcuts.

### 8. Theme System & Appearance Settings
**Description**: Customizable visual themes with dark/light modes and highlight color options.

**User Experience**:
- Clean, distraction-free reading interface
- Dark mode for comfortable night reading
- Customizable highlight colors for personal preference
- Separate theming for content area vs. app controls

**User Flow**:
1. User accesses settings via gear icon in audio controls
2. Settings modal provides theme options and customization
3. Changes apply immediately to demonstrate effect
4. User can adjust highlight colors, fonts, and spacing
5. Preferences save automatically and apply to all chapters

**How it works**:
The theme system uses a centralized theme provider that manages separate styling contexts for the app shell (audio controls) and content area (reading text). Theme changes trigger immediate re-rendering with new color schemes and typography settings. User preferences are stored in localStorage and automatically applied on app initialization. The system supports both light and dark modes with customizable highlight colors for word and sentence highlighting.

## UI Layout & Structure

### Main Interface Layout
The application uses a **split-screen layout** optimized for focused reading:

**Top Section (74% of screen height)**:
- Clean, scrollable text area with ample white space
- Current chapter title displayed at top
- Chapter navigation arrows for easy browsing
- Text rendered in readable typography with proper line spacing

**Bottom Section (26% of screen height)**:
- Fixed audio control bar with dark background for contrast
- Central play/pause button with surrounding navigation controls
- Progress indicator and chapter information
- Settings and bookmark access buttons

### Audio Control Bar Components
**Left Side**: Chapter navigation (previous/next chapter buttons)
**Center**: Main playback controls (previous/play/pause/next sentence)  
**Right Side**: Speed controls (showing current rate), settings, and bookmark toggle

**Detailed Control Layout**:
- **Chapter Navigation**: Double-arrow buttons for previous/next chapter
- **Sentence Navigation**: Single-arrow buttons for previous/next sentence
- **Central Play Button**: Large, prominent play/pause toggle (green accent)
- **Speed Display**: Button showing current playback rate (e.g., "1.2x")
- **Settings Access**: Gear icon for themes and appearance options
- **Bookmark Toggle**: Bookmark icon (highlighted when current position is bookmarked)

### Modal Interfaces
- **Settings Modal**: Theme selection, appearance customization, advanced options
- **Speed Control Modal**: 
  - Playback speed slider (0.5x to 2.0x)
  - Voice selection dropdown with preview
  - Word timing offset adjustment
  - Real-time preview of changes
- **Bookmark Modal**: 
  - Custom bookmark naming input
  - Bookmark list with navigation
  - Preview text for each bookmark
  - Delete/edit bookmark options

### Responsive Design
- **Mobile**: Single column with larger touch targets
- **Tablet**: Optimized for landscape reading
- **Desktop**: Maintains fixed proportions with keyboard shortcuts

### Visual Design Principles
- **Minimalist**: Clean interface that doesn't distract from content
- **High Contrast**: Ensures readability in all lighting conditions
- **Accessible**: Screen reader compatible with proper focus management
- **Performance**: Smooth animations and immediate response to user actions

---

## Technical Architecture

### Frontend Framework
- **React** with functional components and hooks
- **Material-UI** for consistent component library
- **Context API** for global state management

### Backend Services
- **Node.js/Express** API server
- **Google Cloud Text-to-Speech** for audio generation
- **RESTful API** design for client-server communication

### Data Storage
- **JSON files** for book content (chapters, images)
- **Base64 encoding** for audio data transmission


### Key Libraries & APIs
- `@google-cloud/text-to-speech` for TTS generation
- `@mui/material` for UI components
- `react` for frontend framework
- `lodash` for utility functions

---

## Implementation Details

### 1. Text-to-Speech Pipeline

The TTS pipeline is the foundation that enables precise word-level synchronization. It works by embedding timing markers directly into the speech synthesis process, then extracting timing data for each word.

#### SSML Generation
**Purpose**: Transform plain text into SSML markup with embedded timing markers that Google TTS can track.

**How it works**: Split text into individual words and insert `<mark>` tags before each word within SSML `<speak>` tags. Each mark gets a unique identifier combining the word and its index (e.g., "Hello-0", "world-1"). This allows the TTS service to report precise timing when each word marker is reached during speech synthesis.

**Example transformation**:
- Input: `"Hello world how are you"`  
- Output: `"<speak> <mark name="Hello-0"/> Hello <mark name="world-1"/> world <mark name="how-2"/> how <mark name="are-3"/> are <mark name="you-4"/> you</speak>"`

**Critical considerations**:
- Mark names must be unique within each audio chunk
- Index order must match the order words appear in the DOM
- Empty words (from multiple spaces) should be filtered out

#### TTS API Integration
**Purpose**: Generate audio with precise timing data for each word marker.

**How it works**:
```javascript
async function synthesizeSpeechWithTiming(text, voiceId) {
    const client = new textToSpeech.TextToSpeechClient();
    
    const request = {
        // Enable timepoint generation for SSML marks
        enableTimePointing: ['SSML_MARK'],
        input: {
            ssml: generateSSMLWithMarks(text)
        },
        voice: {
            languageCode: 'en-US',
            name: voiceId // e.g., 'en-US-Neural2-A', 'en-US-Neural2-F'
        },
        audioConfig: { 
            audioEncoding: 'MP3' // Compressed for web delivery
        },
    };

    const [response] = await client.synthesizeSpeech(request);
    
    return {
        audioContent: response.audioContent.toString('base64'),
        timepoints: response.timepoints // Array of {markName, timeSeconds}
    };
}
```

**Critical configuration**:
- **enableTimePointing: ['SSML_MARK']**: This tells Google TTS to track when each `<mark>` is reached during synthesis
- **Voice selection**: Different voices have different timing characteristics
- **MP3 encoding**: Balances quality vs. file size for web delivery
- **Base64 encoding**: Enables direct embedding in HTML5 audio elements

**Timepoints data structure**:
```javascript
// Example timepoints array returned by Google TTS
[
    { markName: "Hello-0", timeSeconds: 0.1 },
    { markName: "world-1", timeSeconds: 0.6 },
    { markName: "how-2", timeSeconds: 1.1 },
    { markName: "are-3", timeSeconds: 1.4 },
    { markName: "you-4", timeSeconds: 1.8 }
]
```

**Error handling considerations**:
- Network timeouts for large text chunks
- Invalid SSML markup handling
- API quota limits and rate limiting
- Fallback for unsupported voices



### 2. Word Highlighting Synchronization

This is the most complex part of the application - synchronizing audio playback time with visual word highlighting in real-time. The system must handle timing offsets, edge cases, and provide smooth visual feedback.

#### Real-time Audio Tracking
**Purpose**: Convert audio playback time into DOM word indices for precise highlighting.

**How it works**:
```javascript
const handleTimeUpdate = () => {
    // Safety check - ensure timepoints data exists
    if (timepoints.length === 0) return;
    
    // Apply user-configurable timing offset for fine-tuning
    const currentTime = audio.currentTime + wordSpeedOffset;
    
    // Edge case: Audio hasn't reached first word yet
    if (currentTime < timepoints[0].timeSeconds) {
        setCurrentWordIndex(0);
        return;
    }
    
    // Binary search alternative: Linear search for current timepoint window
    // This approach is chosen for simplicity and debugging clarity
    for (let i = 0; i < timepoints.length; i++) {
        const currentTimepoint = timepoints[i].timeSeconds;
        const nextTimepoint = timepoints[i + 1]?.timeSeconds;
        
        // Check if current time falls within this word's timepoint window
        if (currentTime >= currentTimepoint &&
            (i === timepoints.length - 1 || currentTime < nextTimepoint)) {
            setCurrentWordIndex(i);
            break;
        }
    }
};

// Attach to HTML5 audio element - fires ~4 times per second
audio.addEventListener('timeupdate', handleTimeUpdate);
```

**Key algorithmic decisions**:
1. **Linear Search vs Binary Search**: Linear search chosen for debugging clarity, though binary search would be more efficient for very long texts
2. **Timepoint Windows**: Each word "owns" the time from its mark to the next mark
3. **Edge Case Handling**: Special handling for before-first-word and after-last-word scenarios
4. **User Timing Offset**: `wordSpeedOffset` allows users to fine-tune sync if TTS timing feels off

**Performance considerations**:
- `timeupdate` events fire frequently (240 times per minute)
- Algorithm must complete in < 4ms to maintain 60fps UI
- State updates trigger React re-renders, so minimizing unnecessary updates is crucial

**Synchronization challenges**:
- Different browsers may have slightly different audio timing
- Network latency can affect initial audio loading
- User-initiated seeking requires immediate timepoint recalculation
- Playback speed changes affect timing relationships

#### Visual Highlighting Logic
**Purpose**: Apply different visual styles based on reading state and current position.

**How it works**:
```javascript
function calculateWordStyle(chunkIndex, wordIndex, currentChunkIndex, currentWordIndex, isPlaying) {
    // Only highlight words in the currently active chunk/sentence
    if (currentChunkIndex === chunkIndex) {
        
        // Tier 1: Active word highlighting (highest priority)
        if (isPlaying && currentWordIndex === wordIndex) {
            return {
                backgroundColor: '#ffeb3b', // Bright yellow for active word
                fontWeight: 'bold',
                transition: 'background-color 0.1s ease', // Smooth transitions
                borderRadius: '3px',
                padding: '0 2px'
            };
        }
        
        // Tier 2: Current sentence highlighting (lower priority)
        return {
            backgroundColor: '#e3f2fd', // Light blue for sentence context
            borderRadius: '3px',
            padding: '0 2px'
        };
    }
    
    // Default: No highlighting for inactive sentences
    return {
        backgroundColor: 'transparent'
    };
}

// Usage in React component rendering
const renderWord = (word, wordIndex, chunkIndex) => (
    <span
        key={wordIndex}
        style={calculateWordStyle(chunkIndex, wordIndex, currentChunkIndex, currentWordIndex, isPlaying)}
        onDoubleClick={() => handleWordClick(chunkIndex)} // Allow manual navigation
    >
        {word}{' '}
    </span>
);
```

**Multi-tier highlighting system**:
1. **Active Word** (Tier 1): Bright highlight for currently spoken word
2. **Active Sentence** (Tier 2): Subtle background for current sentence context
3. **Inactive Content** (Tier 3): No highlighting for other content

**Visual design considerations**:
- **Accessibility**: High contrast ratios for word highlighting
- **Performance**: CSS transitions smooth but not too slow
- **User Experience**: Visual feedback should feel immediate and natural
- **Theme Support**: Colors should work in both light and dark modes

**State coordination complexity**:
The highlighting system must coordinate multiple pieces of state:
- `currentChunkIndex`: Which sentence is currently active
- `currentWordIndex`: Which word within that sentence is being spoken
- `isPlaying`: Whether audio is currently playing
- Theme settings for color choices
- User preferences for highlight intensity

**Critical Implementation Details**:

**Word Index Extraction**:
```javascript
// Extract word index from timepoint mark name "Hello-0" -> 0
const extractWordIndex = (markName) => {
    const parts = markName.split('-');
    return parseInt(parts[parts.length - 1]);
};

// Map timepoints to word indices during chunk loading
const processTimepoints = (timepoints) => {
    return timepoints.map(tp => ({
        wordIndex: extractWordIndex(tp.markName),
        timeSeconds: tp.timeSeconds
    })).sort((a, b) => a.wordIndex - b.wordIndex);
};
```

**Audio Event Handling**:
```javascript
useEffect(() => {
    if (!audio || !timepoints) return;
    
    const handleTimeUpdate = () => { /* implementation above */ };
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleSeeked = () => handleTimeUpdate(); // Immediate update on seeking
    
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('seeked', handleSeeked);
    
    return () => {
        audio.removeEventListener('timeupdate', handleTimeUpdate);
        audio.removeEventListener('play', handlePlay);
        audio.removeEventListener('pause', handlePause);
        audio.removeEventListener('seeked', handleSeeked);
    };
}, [audio, timepoints, wordSpeedOffset]);
```

**Word Click Navigation**:
```javascript
const handleWordClick = (chunkIndex, wordIndex) => {
    if (!audio || !timepoints) return;
    
    // Find the timepoint for this word
    const targetTimepoint = timepoints.find(tp => 
        extractWordIndex(tp.markName) === wordIndex
    );
    
    if (targetTimepoint) {
        // Jump audio to this position
        audio.currentTime = targetTimepoint.timeSeconds;
        setCurrentWordIndex(wordIndex);
    }
};
```

### 3. Text Chunking Algorithm

Text chunking is critical for both performance and user experience. Chunks must be sized appropriately for TTS processing while maintaining natural reading flow and keeping memory usage reasonable.

#### Sentence Splitting Logic
**Purpose**: Break text into manageable chunks that feel natural to read and listen to, while optimizing for TTS processing time and memory usage.

**How it works**: Use regex to split text on sentence-ending punctuation (.!?), then accumulate sentences in a buffer until reaching minimum word count (default: 5 words). This prevents overly short audio clips while respecting natural sentence boundaries. Images are handled as separate chunks with special rendering.

**Optimal chunk sizing**:
- **Too Small**: Choppy audio, excessive API calls, poor TTS flow
- **Too Large**: Long TTS generation times, memory bloat, less granular navigation  
- **Sweet Spot**: 5-15 words per chunk balances all factors

### 4. Progressive Audio Loading

Progressive loading is essential for responsive user experience. Users shouldn't wait for entire book audio generation, but should also never encounter loading delays during normal reading flow.

#### Cache Management Strategy
**Purpose**: Maintain smooth playback by keeping relevant audio in memory while preventing memory bloat and minimizing user waiting time.

**How it works**: Maintain a React state-based cache that stores current and adjacent audio chunks as HTML5 Audio objects. Implement intelligent preloading during audio playback - when current audio reaches 50% completion, start loading the next chunk; at 80% completion, preload the chunk after next. Use LRU eviction to remove oldest chunks when cache exceeds size limits (~20 chunks). Track loading states to prevent duplicate API requests.

**Key caching strategies**:
1. **Current + Next**: Always keep current and next chunk loaded for seamless playback
2. **Real-time Preloading**: Start loading next chunk when current audio reaches 50% completion  
3. **Aggressive Preloading**: Load chunk after next when current audio reaches 80% completion
4. **LRU Eviction**: Remove oldest chunks when cache size limit reached
5. **Voice Change Handling**: Clear entire cache since different voices have different timing
6. **Memory Management**: Clean up audio resources when evicting chunks

### 5. Windowed Text Rendering

Windowed rendering is crucial for handling large books (50,000+ words) without freezing the browser. Only visible content is rendered to the DOM, with additional content loaded as users scroll.

#### Virtual Scrolling Implementation
**Purpose**: Maintain smooth scrolling and responsiveness even with very large documents by only rendering content near the viewport.

**How it works**: Render only a window of chunks around the current reading position (default: 10 chunks above and below). Use Intersection Observer API with invisible trigger elements at the top and bottom of the visible content to detect when users scroll near the boundaries. When triggers become visible, expand the render window in that direction. Automatically adjust the visible range when audio navigation jumps to distant positions.

**Key windowing concepts**:
1. **Window Size**: Number of chunks to render around current position (default: 10 chunks)
2. **Trigger Elements**: Invisible elements that trigger content loading when scrolled into view  
3. **Intersection Observer**: Efficient way to detect when triggers become visible
4. **Dynamic Range**: Visible range expands as user scrolls, contracts when navigating via audio

### 6. Bookmark Management

Simple CRUD operations for saving and managing reading positions.

**Key bookmark features**:
1. **Precise Positioning**: Chapter + chunk index for exact location
2. **Custom Naming**: User-provided names for easy identification
3. **Preview Text**: First 100 characters for context
4. **Duplicate Prevention**: Avoid multiple bookmarks at same position
5. **Sorted Display**: Bookmarks ordered by position in book
6. **Import/Export**: Backup and sharing functionality

**Data persistence strategy**:
- **Data Validation**: Verify bookmark structure on load
- **Error Handling**: Graceful degradation when storage fails
- **Future Enhancement**: Server sync for cross-device bookmarks


---




This document provides comprehensive specifications for implementing a feature-complete ebook reader with synchronized text-to-speech capabilities. 