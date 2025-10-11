# Sentence Highlighting Mode Feature Plan

**Status**: ✅ **IMPLEMENTED** - This feature is now part of the core reader architecture following the sentence-chunk audio refactor.

This plan outlined the implementation of sentence-level highlighting as an alternative to the current word-level highlighting system in the Reader component.

## 1. **High-Level Solution**

Implement a simple configurable highlighting system that allows users to switch between word-level and sentence-level highlighting modes. The solution uses a lightweight strategy pattern to cleanly separate word and sentence highlighting logic into distinct files. Users can toggle between modes via the theme settings modal, with their preference persisted in localStorage. In sentence mode, the entire sentence containing the current word is highlighted using the same highlight color, while audio continues to play word-by-word exactly as it currently does. Navigation controls (Previous/Next) will move sentence-by-sentence in sentence mode.

**User Flow**: User opens Reader → Accesses theme settings via audio controls → Toggles highlighting mode between "Word" and "Sentence" → Reader immediately switches highlighting behavior → Audio continues word-by-word but visual highlighting changes → Navigation moves sentence-by-sentence → Preference saved to localStorage.

## 2. **Implementation Details**

### Phase 1: Foundation - Simple Strategy Structure

#### 2.1 Create Simple Strategy Interface
**File**: `src/client/routes/Reader/highlighting/types.ts`
```typescript
export interface HighlightingStrategy {
  getWordStyle(chunkIndex: number, wordIndex: number): React.CSSProperties;
  getWordClassName(chunkIndex: number, wordIndex: number): string;
  handleWordClick(chunkIndex: number, wordIndex: number): void;
  handleNext(): void;
  handlePrevious(): void;
}

export interface HighlightingContext {
  currentChunkIndex: number;
  currentWordIndex: number;
  highlightColor: string;
  chapter: ChapterClient | null;
  onWordClick: (chunkIndex: number, wordIndex: number) => void;
  onNavigateToChunk: (chunkIndex: number) => void;
}
```

#### 2.2 Add Highlighting Mode to Settings Context
**File**: `src/client/settings/types.ts`
```typescript
export interface Settings {
  aiModel: string;
  contextSentencesCount: number;
  librarySortBy: 'title' | 'progress' | 'lastRead';
  theme: 'light' | 'dark';
  highlightingMode: 'word' | 'sentence'; // NEW FIELD
}

export const defaultSettings: Settings = {
  aiModel: '',
  contextSentencesCount: 3,
  librarySortBy: 'title',
  theme: 'light',
  highlightingMode: 'word', // DEFAULT VALUE
};
```

### Phase 2: Simple Strategy Implementations

#### 2.3 Create Word Highlighting Strategy
**File**: `src/client/routes/Reader/highlighting/WordHighlightingStrategy.ts`
```typescript
import { HighlightingStrategy, HighlightingContext } from './types';

export class WordHighlightingStrategy implements HighlightingStrategy {
  constructor(private context: HighlightingContext) {}

  getWordStyle(chunkIndex: number, wordIndex: number): React.CSSProperties {
    const { currentChunkIndex, currentWordIndex, highlightColor } = this.context;
    
    if (chunkIndex === currentChunkIndex && wordIndex === currentWordIndex) {
      return {
        backgroundColor: highlightColor,
        borderRadius: '2px',
        padding: '1px 2px'
      };
    }
    return {};
  }

  getWordClassName(chunkIndex: number, wordIndex: number): string {
    const { currentChunkIndex, currentWordIndex } = this.context;
    return chunkIndex === currentChunkIndex && wordIndex === currentWordIndex ? 'current-word' : '';
  }

  handleWordClick(chunkIndex: number, wordIndex: number): void {
    this.context.onWordClick(chunkIndex, wordIndex);
  }

  handleNext(): void {
    // Regular word-by-word navigation (existing logic)
    const { currentChunkIndex, currentWordIndex } = this.context;
    this.context.onWordClick(currentChunkIndex, currentWordIndex + 1);
  }

  handlePrevious(): void {
    // Regular word-by-word navigation (existing logic)
    const { currentChunkIndex, currentWordIndex } = this.context;
    this.context.onWordClick(currentChunkIndex, Math.max(0, currentWordIndex - 1));
  }
}
```

#### 2.4 Create Sentence Highlighting Strategy
**File**: `src/client/routes/Reader/highlighting/SentenceHighlightingStrategy.ts`
```typescript
import { HighlightingStrategy, HighlightingContext } from './types';

export class SentenceHighlightingStrategy implements HighlightingStrategy {
  constructor(private context: HighlightingContext) {}

  getWordStyle(chunkIndex: number, wordIndex: number): React.CSSProperties {
    const { currentChunkIndex, currentWordIndex, highlightColor, chapter } = this.context;
    
    if (chunkIndex !== currentChunkIndex || !chapter) return {};
    
    const sentence = this.findCurrentSentence();
    if (sentence && wordIndex >= sentence.start && wordIndex <= sentence.end) {
      return {
        backgroundColor: highlightColor,
        borderRadius: '2px',
        padding: '1px 2px'
      };
    }
    return {};
  }

  getWordClassName(chunkIndex: number, wordIndex: number): string {
    const { currentChunkIndex, currentWordIndex, chapter } = this.context;
    
    if (chunkIndex !== currentChunkIndex || !chapter) return '';
    
    const sentence = this.findCurrentSentence();
    if (sentence && wordIndex >= sentence.start && wordIndex <= sentence.end) {
      return 'current-sentence';
    }
    return '';
  }

  handleWordClick(chunkIndex: number, wordIndex: number): void {
    // Jump to sentence start
    const sentence = this.findSentenceForWord(chunkIndex, wordIndex);
    this.context.onWordClick(chunkIndex, sentence?.start || wordIndex);
  }

  handleNext(): void {
    // Navigate to next sentence
    const nextSentence = this.findNextSentence();
    if (nextSentence) {
      this.context.onWordClick(this.context.currentChunkIndex, nextSentence.start);
    }
  }

  handlePrevious(): void {
    // Navigate to previous sentence
    const prevSentence = this.findPreviousSentence();
    if (prevSentence) {
      this.context.onWordClick(this.context.currentChunkIndex, prevSentence.start);
    }
  }

  private findCurrentSentence() {
    // Simple: split chunk text on [.!?], find which sentence contains currentWordIndex
    const { chapter, currentChunkIndex, currentWordIndex } = this.context;
    if (!chapter) return null;
    
    const chunk = chapter.content.chunks[currentChunkIndex];
    if (!chunk || chunk.type !== 'text') return null;
    
    const words = chunk.text.split(/\s+/);
    const sentences = chunk.text.split(/[.!?]+/).filter(s => s.trim());
    
    let wordIndex = 0;
    for (let i = 0; i < sentences.length; i++) {
      const sentenceWordCount = sentences[i].trim().split(/\s+/).length;
      if (currentWordIndex >= wordIndex && currentWordIndex < wordIndex + sentenceWordCount) {
        return { start: wordIndex, end: wordIndex + sentenceWordCount - 1 };
      }
      wordIndex += sentenceWordCount;
    }
    return null;
  }

  private findSentenceForWord(chunkIndex: number, wordIndex: number) {
    // Similar logic but for any word position
  }

  private findNextSentence() {
    // Find next sentence boundary
  }

  private findPreviousSentence() {
    // Find previous sentence boundary
  }
}
```

#### 2.5 Create Simple Strategy Factory
**File**: `src/client/routes/Reader/highlighting/index.ts`
```typescript
import { HighlightingStrategy, HighlightingContext } from './types';
import { WordHighlightingStrategy } from './WordHighlightingStrategy';
import { SentenceHighlightingStrategy } from './SentenceHighlightingStrategy';

export const createHighlightingStrategy = (
  mode: 'word' | 'sentence',
  context: HighlightingContext
): HighlightingStrategy => {
  return mode === 'word' 
    ? new WordHighlightingStrategy(context)
    : new SentenceHighlightingStrategy(context);
};

export * from './types';
```

### Phase 3: Simple Hook Integration

#### 2.6 Create Highlighting Hook
**File**: `src/client/routes/Reader/hooks/useHighlighting.ts`
```typescript
import { useMemo } from 'react';
import { ChapterClient } from '../../../../apis/chapters/types';
import { createHighlightingStrategy, HighlightingContext } from '../highlighting';
import { useSettings } from '../../../settings/SettingsContext';

export const useHighlighting = (
  currentChunkIndex: number,
  currentWordIndex: number,
  highlightColor: string,
  chapter: ChapterClient | null,
  onWordClick: (chunkIndex: number, wordIndex: number) => void,
  onNavigateToChunk: (chunkIndex: number) => void
) => {
  const { settings, updateSettings } = useSettings();
  
  const context: HighlightingContext = useMemo(() => ({
    currentChunkIndex,
    currentWordIndex,
    highlightColor,
    chapter,
    onWordClick,
    onNavigateToChunk
  }), [currentChunkIndex, currentWordIndex, highlightColor, chapter, onWordClick, onNavigateToChunk]);

  const strategy = useMemo(() => 
    createHighlightingStrategy(settings.highlightingMode || 'word', context),
    [settings.highlightingMode, context]
  );

  const toggleMode = () => {
    const newMode = settings.highlightingMode === 'word' ? 'sentence' : 'word';
    updateSettings({ highlightingMode: newMode });
  };

  return {
    mode: settings.highlightingMode || 'word',
    getWordStyle: strategy.getWordStyle.bind(strategy),
    getWordClassName: strategy.getWordClassName.bind(strategy),
    handleWordClick: strategy.handleWordClick.bind(strategy),
    handleNext: strategy.handleNext.bind(strategy),
    handlePrevious: strategy.handlePrevious.bind(strategy),
    toggleMode
  };
};
```

### Phase 4: UI Components Integration

#### 2.7 Update Theme Modal
**File**: `src/client/components/ThemeModal.tsx`
```typescript
// Add to component props interface
interface ThemeModalProps {
  // ... existing props
  currentHighlightingMode: 'word' | 'sentence';
  onHighlightingModeChange: (mode: 'word' | 'sentence') => void;
}

// Add to modal content (after existing controls)
<FormControl fullWidth margin="normal">
  <InputLabel>Highlighting Mode</InputLabel>
  <Select
    value={currentHighlightingMode}
    onChange={(e) => onHighlightingModeChange(e.target.value as 'word' | 'sentence')}
    label="Highlighting Mode"
  >
    <MenuItem value="word">Word-by-word</MenuItem>
    <MenuItem value="sentence">Sentence-level</MenuItem>
  </Select>
  <FormHelperText>
    Choose how text is highlighted during audio playback
  </FormHelperText>
</FormControl>
```

### Phase 5: Reader Component Integration

#### 2.8 Update Reader Component
**File**: `src/client/routes/Reader/Reader.tsx`
```typescript
// Add import
import { useHighlighting } from './hooks/useHighlighting';

// Inside Reader component, replace existing highlighting functions
export const Reader = () => {
  const { book, chapter, audio, navigation, ... } = useReader();
  
  // Use highlighting hook instead of optimized functions
  const highlighting = useHighlighting(
    audio.currentChunkIndex,
    audio.currentWordIndex,
    settings.highlightColor,
    chapter,
    audio.handleWordClick,
    navigation.setCurrentChunkIndex
  );

  // Replace existing functions with highlighting strategy methods
  const getOptimizedWordStyle = highlighting.getWordStyle;
  const getOptimizedWordClassName = highlighting.getWordClassName;
  const handleOptimizedWordClick = highlighting.handleWordClick;

  // Update audio controls to use sentence navigation
  const handleNext = highlighting.mode === 'sentence' ? highlighting.handleNext : audio.handleNextChunk;
  const handlePrevious = highlighting.mode === 'sentence' ? highlighting.handlePrevious : audio.handlePreviousChunk;

  return (
    <UserThemeProvider>
      <ReaderContent
        getWordStyle={getOptimizedWordStyle}
        getWordClassName={getOptimizedWordClassName}
        handleWordClick={handleOptimizedWordClick}
        // ... other props
      />
      
      <AudioControls
        onNextChunk={handleNext}
        onPreviousChunk={handlePrevious}
        // ... other props
      />

      <ThemeModal
        // ... existing props
        currentHighlightingMode={highlighting.mode}
        onHighlightingModeChange={highlighting.toggleMode}
      />
    </UserThemeProvider>
  );
};
```

## 3. **Implementation Phases**

### **Phase 1: Foundation (Day 1)**
- Create highlighting strategy interface and types
- Add highlighting mode to localStorage settings context
- Set up simple project structure for highlighting strategies

### **Phase 2: Strategy Implementation (Day 2)**
- Implement WordHighlightingStrategy with existing logic
- Implement SentenceHighlightingStrategy with simple sentence detection
- Create simple strategy factory function
- Basic unit tests for both strategies

### **Phase 3: Hook Integration (Day 3)**
- Create useHighlighting hook that manages strategy selection
- Test hook integration with existing Reader components
- Ensure proper strategy switching and state management

### **Phase 4: UI Implementation (Day 4)**
- Add highlighting mode toggle to ThemeModal
- Update Reader component to use highlighting hook
- Update audio controls to use sentence navigation when in sentence mode
- Test UI interactions and mode switching

### **Phase 5: Testing & Polish (Day 5)**
- Test both highlighting modes with various content types
- Performance validation for sentence detection
- Cross-browser compatibility testing
- Error handling and edge cases

### **Phase 6: Final Validation (Day 6)**
- Run `yarn checks` to ensure TypeScript and linting compliance
- User acceptance testing with different books
- Code review and final optimizations
- Documentation updates

## 4. **Potential Issues & Open Questions**

### **Technical Challenges**

1. **Simple Sentence Detection Limitations**: Basic punctuation splitting may not handle complex cases perfectly
   - **Acceptable Risk**: 90% accuracy is sufficient for initial implementation
   - **Fallback**: When detection fails, highlighting falls back to word-level behavior
   - **Future Enhancement**: Can improve detection algorithm later if needed

2. **Navigation Edge Cases**: Sentence boundaries at chunk edges may cause navigation issues
   - **Solution**: Implement boundary checks when navigating between sentences
   - **Fallback**: If sentence navigation fails, fall back to chunk navigation

### **User Experience Considerations**

3. **Mode Switching During Playback**: Users switching modes mid-playback should see immediate visual changes
   - **Solution**: Strategy pattern allows instant mode switching without audio interruption
   - **Visual Feedback**: Highlighting changes immediately when mode is toggled

4. **Performance with Large Chapters**: Simple sentence detection should be fast, but may slow down with very large text chunks
   - **Mitigation**: Sentence detection happens on-demand, not precomputed
   - **Acceptable**: Brief delay for very large chapters is acceptable

### **Design Decisions (Already Resolved)**

5. **Visual Treatment**: ✅ **RESOLVED** - Use same highlight color for entire sentence
6. **Audio Progression**: ✅ **RESOLVED** - Keep existing word-by-word audio, change only visual highlighting  
7. **Click Behavior**: ✅ **RESOLVED** - Jump to beginning of clicked sentence
8. **Navigation**: ✅ **RESOLVED** - Previous/Next moves sentence-by-sentence in sentence mode

### **Low Priority Concerns**

9. **Different Book Types**: Technical books vs fiction may have different sentence patterns
   - **Approach**: Start with simple detection, gather user feedback
   - **Enhancement**: Improve detection based on real usage patterns

10. **Accessibility**: Screen readers should work the same regardless of highlighting mode
    - **Strategy**: Visual highlighting doesn't affect semantic content
    - **Validation**: Test with screen readers during implementation

## 5. **Task List**

### Foundation & Setup
- [✅] Task 1: Create simple highlighting strategy interface in `highlighting/types.ts`
- [✅] Task 2: Add `highlightingMode` field to settings context (`settings/types.ts`)
- [✅] Task 3: Set up basic highlighting directory structure

### Strategy Implementation  
- [✅] Task 4: Implement `WordHighlightingStrategy` with existing highlighting logic
- [✅] Task 5: Implement `SentenceHighlightingStrategy` with simple sentence detection
- [✅] Task 6: Create `createHighlightingStrategy` factory function
- [ ] Task 7: Basic unit tests for both highlighting strategies

### Hook Integration
- [✅] Task 8: Create `useHighlighting` hook that manages strategy selection and state
- [ ] Task 9: Test hook integration with existing Reader state and functions
- [ ] Task 10: Ensure proper strategy switching without breaking audio playback

### User Interface Updates
- [✅] Task 11: Add highlighting mode toggle to `ThemeModal` component
- [✅] Task 12: Update `Reader` component to use `useHighlighting` hook
- [✅] Task 13: Update audio controls to use sentence navigation in sentence mode
- [ ] Task 14: Test UI mode switching and ensure visual feedback works correctly

### Testing & Validation
- [ ] Task 15: Test both highlighting modes with different book content types
- [ ] Task 16: Validate sentence detection works reasonably well with typical content
- [ ] Task 17: Test navigation edge cases (sentence boundaries, chunk edges)
- [ ] Task 18: Cross-browser compatibility testing for highlighting behavior

### Final Quality Assurance
- [ ] Task 19: Run `yarn checks` to ensure TypeScript and linting compliance
- [ ] Task 20: Test accessibility with screen readers (ensure no regressions)
- [ ] Task 21: Code review focusing on simplicity and maintainability
- [ ] Task 22: User acceptance testing with real book content

**Instructions for Implementation:**
- Mark tasks as `[✅]` when completed during implementation
- Update this task list in the feature plan file as progress is made
- Use this checklist to track overall progress and ensure nothing is missed
- Each task should represent a meaningful unit of work that can be completed independently
- Always run `yarn checks` before marking UI/integration tasks as complete to ensure no TypeScript or linting errors 