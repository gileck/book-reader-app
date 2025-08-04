# Highlighting Systems Documentation

## Overview

This document describes both highlighting systems used in the application:
1. **Word Highlighting**: DOM-based system for real-time word highlighting during audio playback
2. **Sentence Highlighting**: React-based system for current sentence highlighting

Both systems are user-configurable through the theme panel and designed for optimal performance and user experience.

## Table of Contents

1. [Word Highlighting System](#word-highlighting-system)
   - [Architecture Overview](#word-architecture-overview)
   - [WordHighlightingAPI](#wordhighlightingapi)
   - [CSS Implementation](#word-css-implementation)
   - [Performance Optimizations](#word-performance-optimizations)
2. [Sentence Highlighting System](#sentence-highlighting-system)
   - [Architecture Overview](#sentence-architecture-overview)
   - [React Implementation](#sentence-react-implementation)
   - [CSS Implementation](#sentence-css-implementation)
3. [Theme Panel Integration](#theme-panel-integration)
   - [User Configuration Flow](#user-configuration-flow)
   - [Color Management](#color-management)
4. [Integration Points](#integration-points)
5. [Migration from Legacy System](#migration-from-legacy-system)
6. [Usage Examples](#usage-examples)
7. [Troubleshooting](#troubleshooting)

# Word Highlighting System

## Word Architecture Overview

### Design Principles

The word highlighting system follows these core principles:

- **DOM-First**: Direct DOM manipulation instead of React state updates
- **Performance-Optimized**: Minimal CPU usage with intelligent interval control
- **Decoupled**: Independent of React rendering for highlighting updates
- **Simple**: Single CSS class with smooth transitions
- **Accessible**: Maintains semantic HTML structure
- **User-Configurable**: Colors configurable through theme panel

### System Flow

```mermaid
graph TB
    A[Audio Playback] --> B[useAudioPlayback Hook]
    B --> C{Is Playing?}
    C -->|Yes| D[Start 100ms Interval]
    C -->|No| E[Stop Interval]
    D --> F[WordHighlightingAPI]
    F --> G[Direct DOM Updates]
    G --> H[CSS Transitions]
    
    I[React Components] --> J[Data Attributes]
    J --> K[DOM Elements]
    K --> F
```

## Core Components

### 1. WordHighlightingAPI

Central API for all highlighting operations:

```typescript
const WordHighlightingAPI = {
    // Color management - now supports both highlighting systems
    setWordHighlightColor: (color: string) => void,
    setSentenceHighlightColor: (color: string) => void,
    
    // Word highlighting
    highlightWord: (chunkIndex: number, wordIndex: number) => void,
    unhighlightWord: (chunkIndex: number, wordIndex: number) => void,
    
    // Utility functions
    clearAllHighlights: () => void,
    highlightSentence: (chunkIndex: number, startWordIndex: number, endWordIndex: number) => void,
    wordExists: (chunkIndex: number, wordIndex: number) => boolean
};
```

### 2. Data Attributes System

Each word element includes targeting attributes:

```html
<span 
    data-chunk-index="0"
    data-word-index="5" 
    data-word-id="chunk-0-word-5"
    style="cursor: pointer;"
>
    word
</span>
```

### 3. Interval-Based Updates

Performance-optimized highlighting loop:

```typescript
useEffect(() => {
    if (state.isPlaying) {
        highlightIntervalRef.current = setInterval(() => {
            // Check for position changes
            if (previousHighlightRef.current?.chunkIndex !== currentChunk ||
                previousHighlightRef.current?.wordIndex !== currentWord) {
                
                // Update highlighting
                WordHighlightingAPI.unhighlightWord(/* previous */);
                WordHighlightingAPI.highlightWord(/* current */);
            }
        }, 100); // 100ms intervals
    }
    
    return () => clearInterval(highlightIntervalRef.current);
}, [state.isPlaying, state.currentChunkIndex, state.currentWordIndex]);
```

## WordHighlightingAPI

### setWordHighlightColor(color: string)

Sets the global word highlight color using CSS custom properties.

```typescript
WordHighlightingAPI.setWordHighlightColor('#ffeb3b');
// Sets --word-highlight-color CSS variable globally
```

### setSentenceHighlightColor(color: string)

Sets the global sentence highlight color using CSS custom properties.

```typescript
WordHighlightingAPI.setSentenceHighlightColor('#e3f2fd');
// Sets --sentence-highlight-color CSS variable globally
```

### highlightWord(chunkIndex: number, wordIndex: number)

Adds highlighting to a specific word element.

```typescript
WordHighlightingAPI.highlightWord(0, 5);
// Adds 'highlight-word' class to chunk-0-word-5
```

**Implementation:**
```typescript
highlightWord: (chunkIndex: number, wordIndex: number) => {
    const wordElement = document.querySelector(`[data-word-id="chunk-${chunkIndex}-word-${wordIndex}"]`);
    if (wordElement) {
        wordElement.classList.add('highlight-word');
    }
}
```

### unhighlightWord(chunkIndex: number, wordIndex: number)

Removes highlighting from a specific word element.

```typescript
WordHighlightingAPI.unhighlightWord(0, 4);
// Removes 'highlight-word' class from chunk-0-word-4
```

### clearAllHighlights()

Removes highlighting from all words on the page.

```typescript
WordHighlightingAPI.clearAllHighlights();
// Removes 'highlight-word' class from all elements
```

### highlightSentence(chunkIndex, startWordIndex, endWordIndex)

Highlights a range of words (used for sentence highlighting).

```typescript
WordHighlightingAPI.highlightSentence(0, 10, 25);
// Highlights words 10-25 in chunk 0
```

### wordExists(chunkIndex: number, wordIndex: number): boolean

Checks if a word element exists in the DOM before highlighting.

```typescript
if (WordHighlightingAPI.wordExists(0, 5)) {
    WordHighlightingAPI.highlightWord(0, 5);
}
```

## Word CSS Implementation

### Highlight Class

Simple, performant CSS rule with smooth transitions:

```css
.highlight-word {
    background-color: var(--word-highlight-color, transparent);
    color: inherit;
    border-radius: 3px;
    box-shadow: 0 2px 3px rgba(0, 0, 0, 0.1);
    transition: all 0.2s ease;
}
```

### CSS Custom Properties

Dynamic color management through CSS variables:

```css
:root {
    --word-highlight-color: transparent; /* Default - no highlighting */
}

/* Color can be changed dynamically */
document.documentElement.style.setProperty('--word-highlight-color', '#ffeb3b');
```

### Performance Benefits

- **GPU Acceleration**: CSS transitions use hardware acceleration
- **Minimal Reflow**: Only background color and padding changes
- **Smooth Animation**: 0.2s ease transition prevents jarring updates
- **Low CPU Usage**: No JavaScript animation loops

## Word Performance Optimizations

### 1. Interval Control

- **Smart Start/Stop**: Interval only runs when audio is playing
- **100ms Updates**: Optimal balance between responsiveness and CPU usage
- **Change Detection**: Only updates DOM when word position changes

```typescript
// Only start highlighting when playing
if (state.isPlaying) {
    setInterval(() => {
        // Only update if position changed
        if (hasPositionChanged()) {
            updateHighlighting();
        }
    }, 100);
}
```

### 2. DOM Efficiency

- **Targeted Queries**: Precise CSS selectors avoid broad DOM searches
- **Existence Checks**: Verify elements exist before manipulation
- **Minimal Operations**: Single class add/remove per update

```typescript
// Efficient targeting
const selector = `[data-word-id="chunk-${chunkIndex}-word-${wordIndex}"]`;
const element = document.querySelector(selector);
```

### 3. Memory Management

- **Ref-Based Tracking**: Use React refs to persist state without re-renders
- **Cleanup on Unmount**: Proper interval cleanup prevents memory leaks
- **Efficient Comparisons**: Object reference comparisons for change detection

```typescript
const previousHighlightRef = useRef<{chunkIndex: number; wordIndex: number} | null>(null);

// Cleanup on unmount
useEffect(() => {
    return () => {
        if (highlightIntervalRef.current) {
            clearInterval(highlightIntervalRef.current);
        }
        WordHighlightingAPI.clearAllHighlights();
    };
}, []);
```

# Sentence Highlighting System

## Sentence Architecture Overview

### Design Principles

The sentence highlighting system follows these core principles:

- **React-First**: Uses React's declarative rendering system
- **Simple**: Direct CSS class application in JSX
- **Readable**: Easy to understand and maintain
- **User-Configurable**: Colors configurable through theme panel
- **Performant**: Minimal overhead with React's built-in optimizations

### System Flow

```mermaid
graph TB
    A[Audio Playback] --> B[currentChunkIndex State]
    B --> C[React Component Rendering]
    C --> D{currentChunkIndex === chunkIndex?}
    D -->|Yes| E[Apply 'current-sentence' class]
    D -->|No| F[No highlighting class]
    E --> G[CSS Background Styling]
    F --> G
    
    H[Theme Panel] --> I[User Settings]
    I --> J[CSS Custom Property]
    J --> G
```

## Sentence React Implementation

### JSX-Based Highlighting

Sentence highlighting is achieved through simple conditional class application:

```typescript
<Box
    sx={{
        lineHeight: 1.6,
        fontSize: '1rem'
    }}
    className={currentChunkIndex === chunkIndex ? 'current-sentence' : ''}
    id={`text-chunk-${chunkIndex}`}
    data-chunk-index={chunkIndex}
    data-paragraph-index={chunk.paragraphIndex}
>
    <EnhancedText
        chunk={chunk}
        chunkIndex={chunkIndex}
        onLinkClick={handleLinkClick}
    />
</Box>
```

### Component Implementation

Example in `TextChunk.tsx`:

```typescript
interface TextChunkProps {
    chunk: TextChunkClient;
    chunkIndex: number;
    currentChunkIndex: number; // Added for sentence highlighting
    handleLinkClick: (link: ChunkLink) => void;
}

export const TextChunk: React.FC<TextChunkProps> = ({
    chunk,
    chunkIndex,
    currentChunkIndex,
    handleLinkClick
}) => {
    return (
        <Box
            className={currentChunkIndex === chunkIndex ? 'current-sentence' : ''}
        >
            {/* Content */}
        </Box>
    );
};
```

## Sentence CSS Implementation

### Highlight Class

Simple CSS rule for sentence background highlighting:

```css
.current-sentence {
    background-color: var(--sentence-highlight-color, transparent);
    border-radius: 6px;
    padding: 8px 12px;
    margin: 2px 0;
    border-left: 3px solid var(--sentence-highlight-border, #007AFF);
    transition: all 0.3s ease;
}
```

### CSS Custom Properties

Dynamic color management:

```css
:root {
    --sentence-highlight-color: transparent; /* Default - no highlighting */
    --sentence-highlight-border: #007AFF; /* Default border color */
}

/* Color can be changed dynamically */
document.documentElement.style.setProperty('--sentence-highlight-color', '#e3f2fd');
```

### Performance Benefits

- **React Optimized**: Leverages React's built-in reconciliation
- **Simple Logic**: Single boolean condition for class application
- **CSS Transitions**: Smooth visual feedback with hardware acceleration
- **Minimal Overhead**: No additional JavaScript processing required

# Theme Panel Integration

## User Configuration Flow

Both highlighting systems are fully configurable through the theme panel interface:

```mermaid
graph TB
    A[User Opens Theme Panel] --> B[ThemeModal.tsx]
    B --> C[Color Picker for Word Highlighting]
    B --> D[Color Picker for Sentence Highlighting]
    C --> E[handleHighlightColorChange]
    D --> F[handleSentenceHighlightColorChange]
    E --> G[useUserSettings.ts]
    F --> G
    G --> H[updateUserSettings API]
    H --> I[Database Storage]
    G --> J[Local State Update]
    J --> K[CSS Custom Properties]
    K --> L[Visual Update]
```

## Color Management

### Theme Panel UI

The `ThemeModal.tsx` component provides user-friendly color configuration:

```typescript
// Word Highlight Color Section
<Typography variant="h6" gutterBottom>
    Word Highlight Color
</Typography>
<Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
    Color used to highlight the currently playing word
</Typography>

// Preset colors for quick selection
<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
    {presetColors.map((color) => (
        <Paper
            key={color}
            sx={{
                width: 40,
                height: 40,
                backgroundColor: color,
                cursor: 'pointer',
                border: localHighlightColor === color ? '3px solid #000' : '1px solid #ccc'
            }}
            onClick={() => handleHighlightColorChange(color)}
        />
    ))}
</Box>

// Custom color picker
<TextField
    label="Custom Color"
    type="color"
    value={localHighlightColor}
    onChange={(e) => handleHighlightColorChange(e.target.value)}
/>
```

### Settings Persistence

The `useUserSettings.ts` hook manages color persistence:

```typescript
const handleHighlightColorChange = useCallback(async (highlightColor: string) => {
    updateState({ highlightColor });

    try {
        await updateUserSettings({
            userId,
            settings: { highlightColor }
        });
    } catch (error) {
        console.error('Error updating highlight color:', error);
    }
}, [userId, updateState]);

const handleSentenceHighlightColorChange = useCallback(async (sentenceHighlightColor: string) => {
    updateState({ sentenceHighlightColor });

    try {
        await updateUserSettings({
            userId,
            settings: { sentenceHighlightColor }
        });
    } catch (error) {
        console.error('Error updating sentence highlight color:', error);
    }
}, [userId, updateState]);
```

### Color Application

Colors are applied to both systems through the WordHighlightingAPI:

```typescript
// In useAudioPlayback.ts
useEffect(() => {
    // Set colors on mount and when they change
    if (highlightColor) {
        WordHighlightingAPI.setWordHighlightColor(highlightColor);
    }
    if (sentenceHighlightColor) {
        WordHighlightingAPI.setSentenceHighlightColor(sentenceHighlightColor);
    }
}, [/* dependencies include both color values */]);
```

### Default Values

Both systems use transparent defaults to avoid interference:

```typescript
// In server/database/collections/userSettings/types.ts
export const DEFAULT_USER_SETTINGS = {
    highlightColor: '#ffeb3b',              // Word highlighting default
    sentenceHighlightColor: '#e3f2fd',      // Sentence highlighting default
    // ... other settings
};
```

## Integration Points

### 1. EnhancedText Component

Renders words with necessary data attributes:

```typescript
<span
    data-chunk-index={chunkIndex}
    data-word-index={wordIndex}
    data-word-id={`chunk-${chunkIndex}-word-${wordIndex}`}
    style={{ cursor: 'pointer' }}
>
    {word}
</span>
```

### 2. useAudioPlayback Hook

Manages the highlighting lifecycle:

```typescript
export const useAudioPlayback = () => {
    // WordHighlightingAPI initialization
    // Interval management
    // Color updates
    // Cleanup handlers
    
    return {
        // Audio controls
        // Sentence highlighting (still React-based)
        // No word highlighting functions (DOM-based now)
    };
};
```

### 3. Audio State Integration

Highlighting responds to audio playback state:

```typescript
// Highlights track current audio position
currentChunkIndex: state.currentChunkIndex,
currentWordIndex: state.currentWordIndex,
isPlaying: state.isPlaying
```

## Migration from Legacy System

### What Was Removed

1. **React-Based Word Highlighting**:
   - `getWordStyle()` functions
   - `getWordClassName()` functions
   - Complex CSS generation and injection
   - React state-driven updates

2. **Strategy Pattern Files**:
   - `WordHighlightingStrategy.ts`
   - `SentenceHighlightingStrategy.ts`
   - `highlighting/index.ts`
   - `highlighting/types.ts`
   - `useHighlighting.ts` hook

3. **Performance Optimizations**:
   - Legacy chunk mapping optimizations
   - React-based word prop threading
   - Complex animation CSS generation

### Migration Benefits

| Aspect | Legacy System | New DOM System |
|--------|---------------|----------------|
| **Performance** | React re-renders for each word | Direct DOM updates, no re-renders |
| **CPU Usage** | High (continuous React updates) | Low (smart interval control) |
| **Complexity** | 200+ lines across multiple files | Single API, minimal code |
| **Maintainability** | Multiple systems, prop threading | One system, direct manipulation |
| **Bundle Size** | Larger (multiple strategies) | Smaller (single implementation) |

### Compatibility

- **Sentence Highlighting**: Still uses React-based system (unchanged)
- **Audio Controls**: All audio functionality preserved
- **User Experience**: Identical visual behavior
- **Existing Books**: No changes required

## Usage Examples

### Basic Word Highlighting

```typescript
// Highlight a specific word
WordHighlightingAPI.highlightWord(0, 5);

// Change word highlight color
WordHighlightingAPI.setWordHighlightColor('#4caf50');

// Change sentence highlight color
WordHighlightingAPI.setSentenceHighlightColor('#e8f5e8');

// Remove highlighting
WordHighlightingAPI.unhighlightWord(0, 5);
```

### Basic Sentence Highlighting

```typescript
// In React component
const TextChunk = ({ chunkIndex, currentChunkIndex, chunk }) => {
    return (
        <Box
            className={currentChunkIndex === chunkIndex ? 'current-sentence' : ''}
        >
            {chunk.text}
        </Box>
    );
};

// Setting sentence color via theme panel
const handleSentenceColorChange = (color: string) => {
    WordHighlightingAPI.setSentenceHighlightColor(color);
    // Color is automatically saved to user settings
};
```

### Integration in Components

```typescript
const MyComponent = () => {
    useEffect(() => {
        // Set initial colors for both highlighting systems
        WordHighlightingAPI.setWordHighlightColor('#fff3e0');
        WordHighlightingAPI.setSentenceHighlightColor('#e3f2fd');
        
        // Cleanup on unmount
        return () => {
            WordHighlightingAPI.clearAllHighlights();
        };
    }, []);
    
    return (
        <div>
            {/* Word highlighting with data attributes */}
            <span 
                data-chunk-index={0}
                data-word-index={5}
                data-word-id="chunk-0-word-5"
            >
                word
            </span>
            
            {/* Sentence highlighting with conditional class */}
            <Box
                className={isCurrentSentence ? 'current-sentence' : ''}
            >
                This is a complete sentence.
            </Box>
        </div>
    );
};
```

### Custom Highlighting Logic

```typescript
const highlightSequence = async (words: Array<{chunk: number, word: number}>) => {
    for (const {chunk, word} of words) {
        if (WordHighlightingAPI.wordExists(chunk, word)) {
            WordHighlightingAPI.highlightWord(chunk, word);
            await new Promise(resolve => setTimeout(resolve, 500));
            WordHighlightingAPI.unhighlightWord(chunk, word);
        }
    }
};
```

## Troubleshooting

### Common Issues

1. **Words Not Highlighting**
   - Check if `data-word-id` attributes are present
   - Verify WordHighlightingAPI is called with correct indices
   - Ensure elements exist in DOM when highlighting

2. **Performance Issues**
   - Confirm interval only runs when `isPlaying` is true
   - Check for memory leaks (intervals not cleared)
   - Verify efficient DOM queries

3. **Word Styling Issues**
   - Check CSS custom property `--word-highlight-color` is set
   - Verify `.highlight-word` class is not overridden
   - Ensure transitions are working correctly

4. **Sentence Styling Issues**
   - Check CSS custom property `--sentence-highlight-color` is set
   - Verify `.current-sentence` class is not overridden
   - Ensure `currentChunkIndex` prop is being passed correctly
   - Check conditional className logic in React components

### Debug Tools

```typescript
// Word Highlighting Debug
// Check if word exists
console.log(WordHighlightingAPI.wordExists(0, 5));

// Verify element selection
const element = document.querySelector('[data-word-id="chunk-0-word-5"]');
console.log(element);

// Check current word highlight color
const wordColor = getComputedStyle(document.documentElement)
    .getPropertyValue('--word-highlight-color');
console.log('Current word highlight color:', wordColor);

// Sentence Highlighting Debug
// Check current sentence highlight color
const sentenceColor = getComputedStyle(document.documentElement)
    .getPropertyValue('--sentence-highlight-color');
console.log('Current sentence highlight color:', sentenceColor);

// Verify sentence elements
const sentenceElements = document.querySelectorAll('.current-sentence');
console.log('Currently highlighted sentences:', sentenceElements);

// Check if sentence is properly highlighted
const checkSentenceHighlight = (chunkIndex: number) => {
    const element = document.querySelector(`[data-chunk-index="${chunkIndex}"]`);
    const hasClass = element?.classList.contains('current-sentence');
    console.log(`Chunk ${chunkIndex} highlighted:`, hasClass);
};
```

### Performance Monitoring

```typescript
// Monitor highlighting updates
let updateCount = 0;
const originalHighlight = WordHighlightingAPI.highlightWord;
WordHighlightingAPI.highlightWord = (chunk, word) => {
    updateCount++;
    console.log(`Highlight update #${updateCount}: chunk=${chunk}, word=${word}`);
    originalHighlight(chunk, word);
};
```

## Future Enhancements

### Word Highlighting Improvements

1. **Batch Operations**: Highlight multiple words in single DOM operation
2. **Intersection Observer**: Only highlight visible words for better performance
3. **Web Workers**: Move highlighting logic to background thread
4. **CSS Animations**: Replace transitions with keyframe animations for complex effects

### Sentence Highlighting Improvements

1. **Smooth Scrolling**: Auto-scroll to current sentence
2. **Context Preview**: Show surrounding sentences for better context
3. **Progressive Enhancement**: Add word-level highlighting within sentences
4. **Reading Analytics**: Track reading speed and comprehension metrics

### Theme Panel Enhancements

1. **Color Themes**: Pre-defined color schemes for different reading modes
2. **Accessibility Options**: High contrast and colorblind-friendly palettes
3. **Dynamic Theming**: Automatic color adjustment based on content
4. **Export/Import**: Save and share custom theme configurations

### API Extensions

```typescript
// Future WordHighlightingAPI additions
WordHighlightingAPI.highlightWords(words: Array<{chunk: number, word: number}>);
WordHighlightingAPI.setHighlightStyle(style: Partial<CSSStyleDeclaration>);
WordHighlightingAPI.onHighlightChange(callback: (chunk: number, word: number) => void);

// Future SentenceHighlightingAPI (if needed)
SentenceHighlightingAPI.highlightSentenceRange(startChunk: number, endChunk: number);
SentenceHighlightingAPI.setSentenceStyle(style: Partial<CSSStyleDeclaration>);
SentenceHighlightingAPI.onSentenceChange(callback: (chunkIndex: number) => void);
```

---

*This document reflects the current state of both highlighting systems as of the latest refactoring. The systems are fully integrated with the theme panel for user customization.*

**Implementation References:**
- **Word Highlighting**: `src/client/routes/Reader/hooks/useAudioPlayback.ts`
- **Sentence Highlighting**: `src/client/routes/Reader/components/chunks/TextChunk.tsx`
- **Theme Panel**: `src/client/components/ThemeModal.tsx`
- **Settings Management**: `src/client/routes/Reader/hooks/useUserSettings.ts`