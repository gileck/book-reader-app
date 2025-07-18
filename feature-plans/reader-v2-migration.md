# Reader v2 Migration Feature Plan

This plan outlines the complete migration of the Reader component to support only Parser v2 books with enhanced features.

## **Design Decisions**

- **Audio for Text Only**: Headers and images are visual-only elements. Only text chunks have audio support.
- **Mixed Content Navigation**: Users can navigate through all content types visually, but audio controls only track text chunks.
- **Link Interactivity**: All chunk types can contain clickable links for cross-references and footnotes.

## 1. **High-Level Solution**

Replace the current Reader.tsx entirely with a v2-only implementation that supports enhanced chunk types (text, header, image), clickable cross-references and footnotes, inline image display with captions, and improved navigation. The reader will render different chunk types with appropriate styling, enable link navigation between chapters/pages, and provide a richer reading experience. Users will seamlessly navigate through books using detected PDF links and cross-references, while headers provide better content structure and images display inline with proper captions.

**User Flow**: User navigates to book → Reader detects v2 format → Renders enhanced content with headers, images, and clickable links → User can click footnotes/cross-references to jump to targets → Audio controls work only with text chunks (headers/images are visual-only).

## 2. **Implementation Details**

### Phase 1: API Updates for v2 Schema Support

#### 2.1 Update Books API
**File**: `src/apis/books/types.ts`
```typescript
// Add parserVersion field to Book interface
interface Book {
  // ... existing fields
  parserVersion?: number;
}
```

**File**: `src/apis/books/handlers/getBooks.ts`
```typescript
// Ensure parserVersion is included in the projection
const books = await booksCollection.find(
  query,
  { 
    projection: { 
      // ... existing fields
      parserVersion: 1 
    } 
  }
).toArray();
```

#### 2.2 Update Chapters API
**File**: `src/apis/chapters/types.ts`
```typescript
// Enhanced TextChunk interface for v2
interface TextChunk {
  index: number;
  text: string;
  wordCount: number;
  type: 'text' | 'header' | 'image';    // Enhanced type system
  pageNumber?: number;
  sentenceCount?: number;               // New field
  imageName?: string;
  imageAlt?: string;
  links?: ChunkLink[];                  // New field
}

// New link structure
interface ChunkLink {
  text: string;
  targetPageNumber?: number;
  targetText?: string;
  linkId: string;
  role: 'source' | 'target';
  targetChunk?: number;
  chapterNumber?: number;
}
```

**File**: `src/apis/chapters/handlers/getChapters.ts`
```typescript
// Ensure all new fields are included in the response
const chapters = await chaptersCollection.find(
  { bookId: new ObjectId(bookId) },
  {
    projection: {
      // ... existing fields
      'content.chunks.type': 1,
      'content.chunks.sentenceCount': 1,
      'content.chunks.links': 1,
      'content.chunks.imageName': 1,
      'content.chunks.imageAlt': 1
    }
  }
).toArray();
```

### Phase 2: Enhanced Chunk Rendering Components

#### 2.3 Create Enhanced Chunk Renderers
**File**: `src/client/routes/Reader/components/chunks/TextChunk.tsx`
```tsx
interface TextChunkProps {
  chunk: TextChunk;
  chunkIndex: number;
  getWordStyle: (chunkIndex: number, wordIndex: number) => React.CSSProperties;
  getWordClassName: (chunkIndex: number, wordIndex: number) => string;
  getSentenceStyle: (chunkIndex: number) => React.CSSProperties;
  getSentenceClassName: (chunkIndex: number) => string;
  handleWordClick: (chunkIndex: number, wordIndex: number) => void;
  handleSentenceClick: (chunkIndex: number) => void;
  handleLinkClick: (link: ChunkLink) => void;
}

export const TextChunk: React.FC<TextChunkProps> = ({ ... }) => {
  // Render text with enhanced link detection and styling
};
```

**File**: `src/client/routes/Reader/components/chunks/HeaderChunk.tsx`
```tsx
interface HeaderChunkProps {
  chunk: TextChunk;
  chunkIndex: number;
  level?: number; // Determined by content analysis
}

export const HeaderChunk: React.FC<HeaderChunkProps> = ({ chunk, level = 2 }) => {
  return (
    <Typography 
      variant={`h${Math.min(level + 1, 6)}`}
      sx={{ 
        mt: 3, 
        mb: 2, 
        fontWeight: 'bold',
        color: 'primary.main' 
      }}
    >
      {chunk.text}
    </Typography>
  );
};
```

**File**: `src/client/routes/Reader/components/chunks/ImageChunk.tsx`
```tsx
interface ImageChunkProps {
  chunk: TextChunk;
  book: Book;
}

export const ImageChunk: React.FC<ImageChunkProps> = ({ chunk, book }) => {
  const imageUrl = `${VERCEL_BLOB_BASE_PATH}${book.imageBaseURL}${chunk.imageName}`;
  
  return (
    <Box sx={{ my: 3, textAlign: 'center' }}>
      <img 
        src={imageUrl}
        alt={chunk.imageAlt || 'Book image'}
        style={{ maxWidth: '100%', height: 'auto' }}
      />
      {chunk.imageAlt && (
        <Typography variant="caption" sx={{ mt: 1, display: 'block', fontStyle: 'italic' }}>
          {chunk.imageAlt}
        </Typography>
      )}
    </Box>
  );
};
```

#### 2.4 Enhanced Link Detection Component
**File**: `src/client/routes/Reader/components/EnhancedText.tsx`
```tsx
interface EnhancedTextProps {
  chunk: TextChunk;
  chunkIndex: number;
  onLinkClick: (link: ChunkLink) => void;
  // ... other text rendering props
}

export const EnhancedText: React.FC<EnhancedTextProps> = ({ chunk, onLinkClick }) => {
  const renderTextWithLinks = () => {
    let text = chunk.text;
    const links = chunk.links || [];
    
    // Process links and make them clickable
    links.forEach(link => {
      const linkRegex = new RegExp(escapeRegExp(link.text), 'gi');
      text = text.replace(linkRegex, `<span class="clickable-link" data-link-id="${link.linkId}">${link.text}</span>`);
    });
    
    return (
      <div 
        dangerouslySetInnerHTML={{ __html: text }}
        onClick={(e) => handleLinkClick(e, links)}
      />
    );
  };
};
```

### Phase 3: Navigation and Link Handling

#### 2.5 Enhanced Navigation Hook
**File**: `src/client/routes/Reader/hooks/useEnhancedNavigation.ts`
```typescript
export const useEnhancedNavigation = () => {
  const handleLinkNavigation = async (link: ChunkLink) => {
    if (link.chapterNumber && link.targetChunk !== undefined) {
      // Navigate to different chapter and chunk
      await navigateToChapter(link.chapterNumber);
      await navigateToChunk(link.targetChunk);
    } else if (link.targetPageNumber) {
      // Find chunk by page number
      const targetChunk = findChunkByPage(link.targetPageNumber);
      if (targetChunk) {
        await navigateToChunk(targetChunk.index);
      }
    }
  };

  const findChunkByPage = (pageNumber: number) => {
    // Implementation to find chunk by page number
  };

  return { handleLinkNavigation };
};
```

#### 2.6 Link Resolution Service
**File**: `src/client/routes/Reader/services/linkResolver.ts`
```typescript
export class LinkResolver {
  static async resolveLink(link: ChunkLink, currentBook: Book): Promise<NavigationTarget | null> {
    // Resolve cross-references, footnotes, and page references
    if (link.targetPageNumber) {
      return await this.resolvePageReference(link.targetPageNumber, currentBook);
    }
    
    if (link.chapterNumber) {
      return await this.resolveChapterReference(link.chapterNumber, link.targetChunk);
    }
    
    return null;
  }
}
```

### Phase 4: Updated Reader Components

#### 2.7 Enhanced ReaderContent Component
**File**: `src/client/routes/Reader/components/ReaderContent.tsx`
```tsx
// Replace existing component with v2-enhanced version
export const ReaderContent: React.FC<ReaderContentProps> = ({ chapter, book, ...props }) => {
  const { handleLinkNavigation } = useEnhancedNavigation();

  const renderChunk = (chunk: TextChunk, index: number) => {
    switch (chunk.type) {
      case 'header':
        return <HeaderChunk key={index} chunk={chunk} chunkIndex={index} />;
      case 'image':
        return <ImageChunk key={index} chunk={chunk} book={book} />;
      case 'text':
      default:
        return (
          <TextChunk
            key={index}
            chunk={chunk}
            chunkIndex={index}
            handleLinkClick={handleLinkNavigation}
            {...props}
          />
        );
    }
  };

  return (
    <Box>
      {chapter.content.chunks.map(renderChunk)}
    </Box>
  );
};
```

#### 2.8 Update Main Reader Component
**File**: `src/client/routes/Reader/Reader.tsx`
```tsx
// Update to use enhanced components and v2-only logic
export const Reader = () => {
  // DESIGN DECISION: Only text chunks have audio - headers/images are visual-only
  
  const enhancedChunkIndexMapping = useMemo(() => {
    if (!chapter) return { absoluteToText: new Map(), textToAbsolute: new Map(), textChunks: [] };
    
    // Filter only text chunks for audio - headers/images are skipped
    const textChunks = chapter.content.chunks.filter(c => c.type === 'text');
    const absoluteToText = new Map<number, number>();
    const textToAbsolute = new Map<number, number>();

    let textChunkIndex = 0;
    chapter.content.chunks.forEach((chunk, absoluteIndex) => {
      if (chunk.type === 'text') {
        absoluteToText.set(absoluteIndex, textChunkIndex);
        textToAbsolute.set(textChunkIndex, absoluteIndex);
        textChunkIndex++;
      }
    });

    return { absoluteToText, textToAbsolute, textChunks };
  }, [chapter]);
};
```

### Phase 5: Constants and Configuration

#### 2.9 Add Image URL Configuration
**File**: `src/common/constants.ts`
```typescript
export const VERCEL_BLOB_BASE_PATH = 'https://zdllzsw6qffmlxhs.public.blob.vercel-storage.com/books';
```

#### 2.10 Link Styling Configuration
**File**: `src/client/routes/Reader/styles/linkStyles.ts`
```typescript
export const linkStyles = {
  footnote: {
    color: 'primary.main',
    textDecoration: 'underline',
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: 'action.hover'
    }
  },
  crossReference: {
    color: 'secondary.main',
    fontWeight: 'bold',
    cursor: 'pointer'
  }
};
```

## 3. **Implementation Phases**

### Phase 1: Foundation (API & Schema Updates)
- Update API types to include v2 fields
- Ensure database queries return new fields
- Add constants for image URLs

### Phase 2: Enhanced Rendering Components
- Create HeaderChunk component with proper typography
- Create ImageChunk component with caption support
- Create EnhancedText component with link detection
- Build TextChunk component with enhanced features

### Phase 3: Navigation & Link System
- Implement link resolution service
- Create enhanced navigation hook
- Add cross-reference and footnote navigation
- Handle page-based navigation

### Phase 4: Integration & Polish
- Update main Reader component
- Integrate enhanced components
- Update chunk index calculations
- Add proper error handling

### Phase 5: Testing & Optimization
- Test with v2 books
- Optimize performance for mixed chunk types
- Add accessibility features
- Handle edge cases

## 4. **Potential Issues & Open Questions**

### **Risks**
- **Performance Impact**: Mixed chunk types may affect rendering performance with large chapters
- **Image Loading**: Large images could impact page load times and need lazy loading
- **Link Resolution**: Complex cross-references may be slow to resolve across chapters

### **Technical Challenges**
- **Chunk Indexing**: Audio controls only work with text chunks, need to filter out headers/images for audio mapping
- **Link Accuracy**: Parser v2 links may not always resolve correctly to exact targets

### **Dependencies**
- All books must be migrated to v2 format before deployment
- Image storage must be properly configured in Vercel Blob
- Database migration needed for existing books

### **Edge Cases**
- Books with no images but image chunks
- Broken or missing image references
- Invalid cross-references that can't be resolved
- Very long chapters with many images affecting performance

## 5. **Task List**

- [ ] **Phase 1: API Foundation**
  - [ ] Update `src/apis/books/types.ts` with parserVersion field
  - [ ] Update `src/apis/chapters/types.ts` with enhanced TextChunk interface
  - [ ] Update `src/apis/books/handlers/getBooks.ts` to include parserVersion
  - [ ] Update `src/apis/chapters/handlers/getChapters.ts` to include new fields
  - [ ] Add `VERCEL_BLOB_BASE_PATH` constant to `src/common/constants.ts`

- [ ] **Phase 2: Enhanced Components**
  - [ ] Create `src/client/routes/Reader/components/chunks/HeaderChunk.tsx`
  - [ ] Create `src/client/routes/Reader/components/chunks/ImageChunk.tsx`
  - [ ] Create `src/client/routes/Reader/components/chunks/TextChunk.tsx`
  - [ ] Create `src/client/routes/Reader/components/EnhancedText.tsx`
  - [ ] Create `src/client/routes/Reader/styles/linkStyles.ts`

- [ ] **Phase 3: Navigation System**
  - [ ] Create `src/client/routes/Reader/hooks/useEnhancedNavigation.ts`
  - [ ] Create `src/client/routes/Reader/services/linkResolver.ts`
  - [ ] Implement cross-reference navigation logic
  - [ ] Implement footnote navigation logic
  - [ ] Add page-based navigation support

- [ ] **Phase 4: Reader Integration**
  - [ ] Update `src/client/routes/Reader/components/ReaderContent.tsx` for v2
  - [ ] Update `src/client/routes/Reader/Reader.tsx` for v2-only support
  - [ ] Update chunk index mapping (text-only for audio, all types for visual)
  - [ ] Integrate enhanced navigation with audio controls (text chunks only)

- [ ] **Phase 5: Testing & Polish**
  - [ ] Test with v2 books containing all chunk types
  - [ ] Add error handling for missing images
  - [ ] Add error handling for broken links
  - [ ] Optimize performance for large chapters
  - [ ] Add accessibility features for links and images
  - [ ] Update documentation for v2 features

**Instructions for Implementation:**
- Mark tasks as `[✅]` when completed during implementation
- Update this task list as progress is made
- Use this checklist to track overall progress and ensure nothing is missed
- Each task should be completed and tested before moving to the next phase
- Test thoroughly with actual v2 parser output before considering complete 