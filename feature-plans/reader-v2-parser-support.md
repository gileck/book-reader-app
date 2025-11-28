# Reader v2 Parser Support Feature Plan

## 1. **High-Level Solution**

Implement comprehensive support for Parser v2's sentence-level chunking with `paragraphIndex` in the Reader component, replacing the current v1 implementation entirely. The core strategy involves updating all rendering, navigation, and interaction systems to work with sentence chunks that are dynamically grouped by `paragraphIndex` to recreate visual paragraphs. Navigation and audio systems will operate at the sentence level for enhanced granularity while maintaining a paragraph-based reading experience. All features will be enhanced with improved precision for bookmarking, highlighting, and AI context extraction.

**User Flow**: User opens any book (all will use Parser v2) → Sentences are grouped into visual paragraphs → User reads with enhanced sentence-level precision for highlighting, bookmarking, and AI interactions → All features work with improved granularity and accuracy.

## 2. **Implementation Details**

### **2.1 Data Structure Updates**

**Target Files:**
- `src/apis/books/types.ts`
- `src/apis/chapters/types.ts`

**Changes:**
1. **Update TypeScript interfaces** for Parser v2 fields:
```typescript
// src/apis/books/types.ts
interface Book {
  // ... existing fields
  parserVersion: number; // Always 2
}

// src/apis/chapters/types.ts
interface TextChunk {
  // ... existing fields
  sentenceCount: number;
  paragraphIndex?: number; // Groups sentences into paragraphs (undefined for headers/images)
}
```

### **2.2 Content Rendering with Paragraph Grouping**

**Target Files:**
- `src/client/routes/Reader/components/ReaderContent.tsx`
- `src/client/routes/Reader/components/ChunkRenderer.tsx` (new)
- `src/client/routes/Reader/hooks/useParagraphGrouping.ts` (new)

**Changes:**
1. **Create paragraph grouping hook**:
```typescript
// src/client/routes/Reader/hooks/useParagraphGrouping.ts
export const useParagraphGrouping = (chunks: TextChunk[]) => {
  return useMemo(() => {
    const paragraphGroups: TextChunk[][] = [];
    let currentGroup: TextChunk[] = [];
    let currentParagraphIndex: number | null = null;
    
    chunks.forEach(chunk => {
      if (chunk.type === 'text' && chunk.paragraphIndex !== undefined) {
        if (chunk.paragraphIndex !== currentParagraphIndex) {
          if (currentGroup.length > 0) paragraphGroups.push(currentGroup);
          currentGroup = [chunk];
          currentParagraphIndex = chunk.paragraphIndex;
        } else {
          currentGroup.push(chunk);
        }
      } else {
        // Headers and images are standalone
        if (currentGroup.length > 0) paragraphGroups.push(currentGroup);
        paragraphGroups.push([chunk]);
        currentGroup = [];
        currentParagraphIndex = null;
      }
    });
    
    if (currentGroup.length > 0) paragraphGroups.push(currentGroup);
    return paragraphGroups;
  }, [chunks]);
};
```

2. **Create specialized chunk renderer**:
```typescript
// src/client/routes/Reader/components/ChunkRenderer.tsx
interface ChunkRendererProps {
  paragraphGroups: TextChunk[][];
  // ... other existing props
}

export const ChunkRenderer: React.FC<ChunkRendererProps> = ({
  paragraphGroups,
  // ... other props
}) => {
  return (
    <>
      {paragraphGroups.map((group, groupIndex) => {
        if (group.length === 1 && group[0].type !== 'text') {
          // Render header or image
          return renderSingleChunk(group[0], groupIndex);
        } else {
          // Render paragraph (group of sentences)
          return (
            <div key={groupIndex} className="paragraph-group">
              {group.map((chunk, chunkIndex) => 
                renderSentenceChunk(chunk, groupIndex, chunkIndex)
              )}
            </div>
          );
        }
      })}
    </>
  );
};
```

### **2.3 Enhanced Chunk Navigation & Audio**

**Target Files:**
- `src/client/routes/Reader/hooks/useChunkMapping.ts`
- `src/client/routes/Reader/hooks/useReader.ts`
- `src/components/AudioControls.tsx`

**Changes:**
1. **Update chunk mapping for sentence-level navigation**:
```typescript
// src/client/routes/Reader/hooks/useChunkMapping.ts
export const useChunkMapping = (chapter, audio, navigation) => {
  // Enhanced mapping logic for sentence chunks
  const getChunkFromWordIndex = useCallback((wordIndex: number) => {
    // Precise sentence-level targeting
    return findSentenceChunkByWordIndex(wordIndex, sentences);
  }, [sentences]);
  
  // ... rest of implementation
};
```

2. **Update AudioControls for sentence chunk display**:
```typescript
// src/components/AudioControls.tsx
const getChunkDisplayText = (currentChunk: number, totalChunks: number) => {
  return `Sentence ${currentChunk} of ${totalChunks}`;
};
```

### **2.4 Bookmarking System Enhancement**

**Target Files:**
- `src/apis/bookmarks/types.ts`
- `src/client/routes/Reader/hooks/useBookmarks.ts`

**Changes:**
1. **Update bookmark interface for sentence precision**:
```typescript
// src/apis/bookmarks/types.ts
interface Bookmark {
  // ... existing fields
  paragraphIndex: number; // Paragraph containing the bookmarked sentence
  sentenceIndex: number;  // Position within paragraph
  chunkIndex: number;     // Sentence chunk index for precise navigation
}
```

2. **Enhanced bookmark creation with paragraph context**:
```typescript
// src/client/routes/Reader/hooks/useBookmarks.ts
const createBookmark = useCallback((chunkIndex: number, chunk: TextChunk) => {
  return {
    // ... existing bookmark fields
    chunkIndex,
    paragraphIndex: chunk.paragraphIndex || 0,
    sentenceIndex: calculateSentenceIndexInParagraph(chunkIndex, chapter),
    text: chunk.text.substring(0, 100) // Preview text
  };
}, [chapter]);
```

### **2.5 Book Q&A Context Enhancement**

**Target Files:**
- `src/client/routes/Reader/hooks/useContentContext.ts`
- `src/client/routes/Reader/hooks/useBookQA.ts`

**Changes:**
1. **Enhanced context gathering with paragraph awareness**:
```typescript
// src/client/routes/Reader/hooks/useContentContext.ts
const getLastSentences = useCallback((contextCount: number) => {
  if (!chapter || sentences.length === 0) return '';
  
  // Group sentences by paragraph for better context
  const currentChunk = sentences[currentSentenceIndex];
  const currentParagraphIndex = currentChunk?.paragraphIndex;
  
  // Get sentences from current and previous paragraphs
  return getSentencesWithParagraphContext(
    sentences, 
    currentSentenceIndex, 
    contextCount,
    currentParagraphIndex
  );
}, [chapter, sentences, currentSentenceIndex]);
```

### **2.6 Scroll & Position Handling**

**Target Files:**
- `src/client/routes/Reader/hooks/useScrollHandling.ts`
- `src/client/routes/Reader/components/ReaderContent.tsx`

**Changes:**
1. **Enhanced scroll-to-sentence with paragraph context**:
```typescript
// src/client/routes/Reader/hooks/useScrollHandling.ts
const scrollToSentenceChunk = useCallback((chunkIndex: number, paragraphIndex?: number) => {
  // Scroll to specific sentence within paragraph
  const sentenceElement = document.querySelector(
    `[data-paragraph-index="${paragraphIndex}"][data-chunk-index="${chunkIndex}"]`
  );
  if (sentenceElement) {
    sentenceElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } else {
    // Fallback to chunk index if paragraph targeting fails
    const fallbackElement = document.querySelector(`[data-chunk-index="${chunkIndex}"]`);
    fallbackElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}, []);
```

## 3. **Implementation Phases**

### **Phase 1: Foundation & Data Layer (Week 1)**
- **Objectives**: Update data structures and create paragraph grouping foundation
- Add TypeScript interfaces for v2 fields
- Create paragraph grouping hook
- Update APIs to handle v2 data structure

### **Phase 2: Content Rendering (Week 2)**
- **Objectives**: Implement visual paragraph grouping for sentence chunks
- Create ChunkRenderer component with paragraph grouping
- Update ReaderContent to use new renderer
- Implement proper spacing and styling for grouped sentences

### **Phase 3: Navigation & Audio (Week 3)**
- **Objectives**: Enhance navigation and audio controls for sentence-level precision
- Update useChunkMapping for sentence-level targeting
- Modify AudioControls for sentence chunk display
- Implement enhanced scroll-to-chunk functionality
- Update progress calculation for v2 books

### **Phase 4: Bookmarking & Persistence (Week 4)**
- **Objectives**: Enhance bookmarking system with sentence-level precision
- Update bookmark data structure and APIs
- Implement enhanced bookmark creation with paragraph context
- Update bookmark navigation for sentence precision
- Test bookmark accuracy and performance

### **Phase 5: AI Integration & Context (Week 5)**
- **Objectives**: Enhance Book Q&A with paragraph-aware context
- Update content context gathering with paragraph awareness
- Implement enhanced context for AI queries
- Enhance context display and selection
- Test AI response accuracy with improved context

### **Phase 6: Polish & Optimization (Week 6)**
- **Objectives**: Performance optimization and user experience polish
- Optimize rendering performance for increased chunk count
- Implement caching for paragraph grouping
- Add loading states for sentence-level operations
- Comprehensive testing and performance validation

## 4. **Potential Issues & Open Questions**

### **Technical Challenges**
- **Performance Impact**: Rendering 1,657 sentence chunks vs fewer paragraph chunks may impact performance
- **Memory Usage**: Increased chunk count and paragraph grouping calculations
- **Scroll Position Accuracy**: Maintaining precise scroll positions with sentence-level granularity
- **Bookmark Migration**: Ensuring accurate mapping of old bookmarks to new sentence structure

### **Dependencies**
- **Data Structure Changes**: Existing application assumes paragraph-level chunks
- **User Experience**: Users are accustomed to current chunk navigation patterns
- **Performance Requirements**: Need to handle 1,600+ sentence chunks efficiently

### **Implementation Decisions**
1. **Performance Threshold**: Acceptable to render 1,600+ chunks without special optimizations
2. **Fallback Behavior**: Show error message indicating what data is missing
3. **User Experience**: No need to communicate enhanced precision to users
4. **Analytics Impact**: Leave reading analytics unchanged
5. **Caching Strategy**: No special caching needed for paragraph grouping

### **Risks**
- **Performance Risk**: App might become slow with high chunk counts
- **Memory Usage**: Increased memory consumption with more chunks
- **UX Complexity**: More granular navigation might overwhelm some users
- **Development Complexity**: Sentence-level precision adds implementation complexity

## 5. **Task List**

### **Phase 1: Foundation & Data Layer**
- [ ] Task 1: Update TypeScript interfaces in `src/apis/books/types.ts` and `src/apis/chapters/types.ts`
- [ ] Task 2: Create `useParagraphGrouping` hook for sentence grouping logic
- [ ] Task 3: Update book and chapter APIs to handle v2 data fields
- [ ] Task 4: Add unit tests for paragraph grouping logic

### **Phase 2: Content Rendering**
- [ ] Task 5: Create `ChunkRenderer` component with paragraph grouping support
- [ ] Task 6: Update `ReaderContent` to use new renderer
- [ ] Task 7: Implement proper CSS styling for sentence groups and paragraphs
- [ ] Task 8: Add data attributes for sentence and paragraph targeting
- [ ] Task 9: Test rendering accuracy and visual paragraph grouping

### **Phase 3: Navigation & Audio**
- [ ] Task 10: Update `useChunkMapping` for sentence-level navigation
- [ ] Task 11: Modify `AudioControls` component for sentence chunk display
- [ ] Task 12: Implement enhanced `useScrollHandling` for sentence precision
- [ ] Task 13: Update progress calculation logic for sentence chunks
- [ ] Task 14: Test navigation accuracy and performance

### **Phase 4: Bookmarking & Persistence**
- [ ] Task 15: Update bookmark TypeScript interfaces and APIs
- [ ] Task 16: Implement enhanced bookmark creation with paragraph context
- [ ] Task 17: Update bookmark navigation for sentence precision
- [ ] Task 18: Add comprehensive bookmark accuracy tests

### **Phase 5: AI Integration & Context**
- [ ] Task 19: Update `useContentContext` for paragraph-aware context gathering
- [ ] Task 20: Enhance `useBookQA` with improved context logic
- [ ] Task 21: Implement paragraph boundary awareness in context selection
- [ ] Task 22: Update AI context display components
- [ ] Task 23: Test AI response accuracy with enhanced context

### **Phase 6: Polish & Optimization**
- [ ] Task 24: Implement performance optimizations for high chunk counts
- [ ] Task 25: Add caching mechanisms for paragraph grouping
- [ ] Task 26: Implement loading states for sentence-level operations
- [ ] Task 27: Add comprehensive error handling and fallback behavior
- [ ] Task 28: Conduct thorough testing and performance validation

### **Documentation & Deployment**
- [ ] Task 29: Update component documentation for sentence-level features
- [ ] Task 30: Add feature flags for gradual rollout
- [ ] Task 31: Prepare rollback strategy and monitoring
- [ ] Task 32: Deploy with comprehensive monitoring and analytics

**Instructions for Implementation:**
- Mark tasks as `[✅]` when completed during implementation
- Update this task list in the feature plan file as progress is made
- Use this checklist to track overall progress and ensure nothing is missed
- Each task should represent a meaningful unit of work that can be completed independently
- Review and update the plan as new requirements or challenges emerge during implementation 