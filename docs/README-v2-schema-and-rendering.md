# Parser v2 Schema and Rendering Flow

## Overview

This document describes the enhanced schema and rendering architecture introduced with Parser v2, which adds support for mixed content types (text, headers, images), advanced link detection, and a sophisticated client-side rendering system.

## Table of Contents

1. [Schema Evolution](#schema-evolution)
2. [Database Schema](#database-schema)
3. [Upload Process](#upload-process)
4. [Client-Side Rendering Architecture](#client-side-rendering-architecture)
5. [Component Structure](#component-structure)
6. [Navigation System](#navigation-system)
7. [Audio Integration](#audio-integration)
8. [Compatibility](#compatibility)
9. [Usage Examples](#usage-examples)

## Schema Evolution

### Parser v1 → Parser v2 Enhancements

| Feature | Parser v1 | Parser v2 |
|---------|-----------|-----------|
| **Chunk Types** | `text`, `image` | `text`, `header`, `image` |
| **Link Detection** | None | Advanced PDF annotation links |
| **Image Handling** | Basic filename references | Full metadata with captions |
| **Content Structure** | Flat text chunks | Semantic content organization |
| **Cross-References** | None | Clickable footnotes and page refs |
| **Parser Version** | Implicit (1) | Explicit (`parserVersion: 2`) |

### Key v2 Features

- **Enhanced Chunk Types**: Separate headers from text for better typography
- **Advanced Link Detection**: PDF annotation extraction with coordinate mapping
- **Rich Image Support**: Inline images with captions and alt text
- **Cross-Reference Navigation**: Clickable links between chapters and pages
- **Footnote Support**: Automatic footnote detection and navigation
- **Backward Compatibility**: v1 books continue to work seamlessly

## Database Schema

### Book Interface (Enhanced)

```typescript
interface Book {
  _id: ObjectId;
  title: string;
  author?: string;
  description?: string;
  coverImage?: string;
  totalChapters: number;
  totalWords: number;
  language: string;
  imageBaseURL?: string;           // Relative path for Vercel Blob
  chapterStartNumber?: number;
  parserVersion?: number;          // 🆕 1 (v1) or 2 (v2)
  createdAt: Date;
  updatedAt: Date;
  isPublic: boolean;
  uploadedBy?: ObjectId;
}
```

### Enhanced Chunk Schema

```typescript
interface TextChunk {
  index: number;
  text: string;
  wordCount: number;
  type: 'text' | 'header' | 'image';    // 🆕 Enhanced type system
  pageNumber?: number;
  sentenceCount?: number;               // 🆕 Parser v2 field
  imageName?: string;                   // For image chunks
  imageAlt?: string;                    // For image chunks
  links?: ChunkLink[];                  // 🆕 Advanced link detection
}

interface ChunkLink {
  text: string;                         // Link text as it appears
  targetPageNumber?: number;            // PDF page target
  targetText?: string;                  // Target content context
  linkId: string;                       // Unique identifier
  role: 'source' | 'target';            // Link relationship
  targetChunk?: number;                 // Target chunk index
  chapterNumber?: number;               // Cross-chapter links
}
```

### Image URL Construction

Images use a three-part URL system:

```typescript
const imageUrl = VERCEL_BLOB_BASE_PATH + book.imageBaseURL + chunk.imageName;
// Example:
// https://zdllzsw6qffmlxhs.public.blob.vercel-storage.com/books/Transformers/images/page-015-image-1.jpg
```

## Upload Process

### Parser v2 Output Format

Parser v2 produces a flat chunk structure:

```json
{
  "rawText": "Complete extracted PDF text...",
  "chunks": [
    {
      "chunkId": "1_0",
      "type": "text",
      "content": "This is the opening paragraph...",
      "pageNumber": 15,
      "wordCount": 87,
      "sentenceCount": 4,
      "links": [
        {
          "text": "see chapter 3",
          "targetPageNumber": 45,
          "linkId": "link_15_001",
          "role": "source"
        }
      ]
    },
    {
      "chunkId": "1_1", 
      "type": "header",
      "content": "Introduction to Transformers",
      "pageNumber": 15,
      "wordCount": 3,
      "sentenceCount": 0
    },
    {
      "chunkId": "1_2",
      "type": "image", 
      "imageName": "page-015-image-1.jpg",
      "imageAlt": "Figure 1.1: Transformer Architecture",
      "pageNumber": 15,
      "extracted": true
    }
  ]
}
```

### Conversion Process

The `upload-book-v2.js` script converts flat structure to database format:

```javascript
// Extract chapter number from chunkId: "1_0" → chapter 1
const chapterNumber = parseInt(chunk.chunkId.split('_')[0]);

// Convert v2 chunk to database format
const convertedChunk = {
    index: chapter.content.chunks.length,
    text: chunk.content || (chunk.type === 'image' ? chunk.imageAlt || '' : ''),
    wordCount: chunk.wordCount || 0,
    type: chunk.type || 'text',
    ...(chunk.pageNumber !== undefined && { pageNumber: chunk.pageNumber }),
    ...(chunk.sentenceCount !== undefined && { sentenceCount: chunk.sentenceCount }),
    ...(chunk.links && chunk.links.length > 0 && { links: chunk.links }),
    ...(chunk.imageName && { imageName: chunk.imageName }),
    ...(chunk.imageAlt && { imageAlt: chunk.imageAlt })
};
```

### Upload Command

```bash
# Upload book content and images
node upload-book-v2.js /path/to/book-folder/ --upload-images

# Skip images (content only)  
node upload-book-v2.js /path/to/book-folder/ --skip-images
```

## Client-Side Rendering Architecture

### Design Principles

1. **Audio for Text Only**: Headers and images are visual-only; only text chunks support audio
2. **Mixed Content Navigation**: Users navigate visually through all content types
3. **Link Interactivity**: All chunk types support clickable cross-references
4. **Enhanced Experience**: Headers provide structure, images display inline with captions

### Component Hierarchy

```
Reader.tsx
├── ReaderContent.tsx (Main coordinator)
│   ├── HeaderChunk.tsx (Typography headers)
│   ├── ImageChunk.tsx (Inline images with captions)
│   ├── TextChunk.tsx (Enhanced text with links)
│   │   └── EnhancedText.tsx (Link detection & styling)
│   └── useEnhancedNavigation.ts (Link navigation)
└── AudioControls.tsx (Text chunks only)
```

### Chunk Index Mapping

The Reader maintains separate mappings for visual and audio navigation:

```typescript
const chunkIndexMapping = useMemo(() => {
    if (!chapter) return { absoluteToText: new Map(), textToAbsolute: new Map(), textChunks: [] };

    // Filter chunks for audio (text only)
    const textChunks = chapter.content.chunks.filter(c =>
        (c.type === 'text') || (!c.type) // v1 compatibility
    );

    const absoluteToText = new Map<number, number>();
    const textToAbsolute = new Map<number, number>();

    let textChunkIndex = 0;
    chapter.content.chunks.forEach((chunk, absoluteIndex) => {
        if ((chunk.type === 'text') || (!chunk.type)) {
            absoluteToText.set(absoluteIndex, textChunkIndex);
            textToAbsolute.set(textChunkIndex, absoluteIndex);
            textChunkIndex++;
        }
    });

    return { absoluteToText, textToAbsolute, textChunks };
}, [chapter]);
```

## Component Structure

### HeaderChunk Component

Renders semantic headers with responsive typography:

```tsx
export const HeaderChunk: React.FC<HeaderChunkProps> = ({ chunk, level = 2 }) => {
    const headerLevel = Math.min(determineHeaderLevel(chunk.text, level), 6);
    const variant = `h${headerLevel}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

    return (
        <Typography
            variant={variant}
            sx={{
                mt: headerLevel <= 2 ? 4 : 3,
                mb: headerLevel <= 2 ? 3 : 2,
                fontWeight: headerLevel <= 3 ? 'bold' : 'medium',
                color: 'primary.main'
            }}
        >
            {chunk.text}
        </Typography>
    );
};
```

### ImageChunk Component

Displays images with loading states and captions:

```tsx
export const ImageChunk: React.FC<ImageChunkProps> = ({ chunk, book }) => {
    const imageUrl = chunk.imageName && book.imageBaseURL
        ? `${VERCEL_BLOB_IMAGES_BASE_PATH}${book.imageBaseURL}${chunk.imageName}`
        : null;

    return (
        <Box sx={{ my: 3, textAlign: 'center' }}>
            <img
                src={imageUrl}
                alt={chunk.imageAlt || `Book image from page ${chunk.pageNumber}`}
                style={{ maxWidth: '100%', height: 'auto', borderRadius: '8px' }}
                onLoad={handleImageLoad}
                onError={handleImageError}
            />
            {chunk.imageAlt && (
                <Typography variant="caption" sx={{ mt: 1, fontStyle: 'italic' }}>
                    {chunk.imageAlt}
                </Typography>
            )}
        </Box>
    );
};
```

### TextChunk Component

Enhanced text rendering with link support:

```tsx
export const TextChunk: React.FC<TextChunkProps> = ({ chunk, handleLinkClick, ...props }) => {
    return (
        <Box sx={{ mb: 2, lineHeight: 1.6 }}>
            <EnhancedText
                chunk={chunk}
                onLinkClick={handleLinkClick}
                {...props}
            />
        </Box>
    );
};
```

### EnhancedText Component

Sophisticated link detection and click handling:

```tsx
export const EnhancedText: React.FC<EnhancedTextProps> = ({ chunk, onLinkClick }) => {
    // Process text with links to make them clickable
    const processTextWithLinks = (): string => {
        let processedText = chunk.text;
        const links = chunk.links || [];

        links.forEach(link => {
            const linkType = getLinkType(link); // footnote, cross-reference, page-reference
            const escapedText = escapeRegExp(link.text);
            const linkRegex = new RegExp(`\\b${escapedText}\\b`, 'g');
            
            const replacement = `<span class="clickable-link ${linkType}" data-link-id="${link.linkId}">${link.text}</span>`;
            processedText = processedText.replace(linkRegex, replacement);
        });

        return processedText;
    };

    return (
        <div
            dangerouslySetInnerHTML={{ __html: processTextWithLinks() }}
            onClick={handleLinkClick}
        />
    );
};
```

## Navigation System

### Enhanced Navigation Hook

The `useEnhancedNavigation` hook handles complex link navigation scenarios:

```typescript
export const useEnhancedNavigation = ({ chapter, onNavigateToChapter, onNavigateToChunk }) => {
    const handleLinkNavigation = useCallback(async (link: ChunkLink) => {
        // Case 1: Cross-chapter reference with specific chunk
        if (link.chapterNumber !== undefined && link.targetChunk !== undefined) {
            if (link.chapterNumber === currentChapterNumber) {
                const textChunkIndex = findTextChunkIndex(link.targetChunk);
                onNavigateToChunk(textChunkIndex);
            } else {
                onNavigateToBookmark(link.chapterNumber, link.targetChunk);
            }
            return;
        }

        // Case 2: Page reference within current chapter
        if (link.targetPageNumber !== undefined) {
            const targetChunk = findChunkByPage(link.targetPageNumber);
            if (targetChunk) {
                const textChunkIndex = findTextChunkIndex(targetChunk.index);
                onNavigateToChunk(textChunkIndex);
            }
            return;
        }

        // Case 3: Chapter reference without specific chunk
        if (link.chapterNumber !== undefined) {
            onNavigateToChapter(link.chapterNumber);
            return;
        }
    }, [/* dependencies */]);

    return { handleLinkNavigation };
};
```

### Link Resolution Service

The `LinkResolver` service provides fallback strategies for link resolution:

```typescript
export class LinkResolver {
    static async resolveLink(link: ChunkLink, currentBook: Book, currentChapter: Chapter): Promise<NavigationTarget | null> {
        // Direct chapter and chunk reference (most reliable)
        if (link.chapterNumber !== undefined && link.targetChunk !== undefined) {
            return { chapterNumber: link.chapterNumber, chunkIndex: link.targetChunk, success: true };
        }

        // Page reference - search current chapter first, then nearby chapters
        if (link.targetPageNumber !== undefined) {
            return await this.resolvePageReference(link.targetPageNumber, currentBook, currentChapter);
        }

        // Text-based reference (fallback)
        if (link.targetText) {
            return await this.resolveTextReference(link.targetText, currentBook, currentChapter);
        }

        return null;
    }
}
```

### Link Styling

Links are styled based on their type and role:

```css
.clickable-link.footnote {
    color: #1976d2;
    text-decoration: underline;
    text-decoration-style: dotted;
    font-size: 0.9em;
    font-weight: 500;
}

.clickable-link.cross-reference {
    color: #9c27b0;
    font-weight: bold;
    text-decoration: underline;
}

.clickable-link.page-reference {
    color: #0288d1;
    font-style: italic;
    text-decoration: underline;
    text-decoration-style: dashed;
}
```

## Audio Integration

### Audio-Visual Separation

The audio system only tracks text chunks, while visual navigation includes all chunk types:

```typescript
const handleSentenceClick = useMemo(() => {
    return (chunkIndex: number) => {
        const textChunkIndex = chunkIndexMapping.absoluteToText.get(chunkIndex);
        if (textChunkIndex === undefined) {
            // This is a non-text chunk (header or image) - no audio action
            console.log(`Chunk ${chunkIndex} is not a text chunk, skipping audio navigation`);
            return;
        }

        // Set audio position for text chunks only
        navigation.setCurrentChunkIndex(textChunkIndex);
    };
}, [chunkIndexMapping, navigation]);
```

### Audio Controls

Audio controls display progress based on text chunks only:

- **Total chunks**: Count of text chunks (excludes headers/images)
- **Current position**: Text chunk index in filtered array
- **Progress calculation**: Based on text content only

## Compatibility

### Backward Compatibility (v1 → v2)

The system gracefully handles both parser versions:

```typescript
// v1 compatibility in chunk type detection
const chunkType = chunk.type || 'text'; // Default to text for v1

// v1 compatibility in chunk filtering  
const textChunks = chapter.content.chunks.filter(c =>
    (c.type === 'text') || (!c.type) // v1 chunks have no type field
);

// v1 compatibility in book detection
const isV2Book = book.parserVersion === 2;
```

### Migration Strategy

- **Existing v1 books**: Continue to work with basic text/image chunks
- **New v2 books**: Automatically get enhanced features (headers, links, enhanced images)
- **Mixed environment**: Both versions coexist seamlessly
- **Future upgrades**: v1 books can be re-parsed with v2 for enhanced features

### Feature Detection

Components detect available features based on parser version:

```typescript
const hasAdvancedFeatures = book.parserVersion === 2;
const hasLinkSupport = hasAdvancedFeatures && chunk.links?.length > 0;
const hasHeaderSupport = hasAdvancedFeatures && chunk.type === 'header';
```

## Usage Examples

### Basic Reading Experience

```tsx
// v1 book: Simple text chunks with basic images
<TextChunk chunk={textChunk} />
<ImageChunk chunk={imageChunk} book={book} />

// v2 book: Enhanced content with headers and links
<HeaderChunk chunk={headerChunk} level={2} />
<TextChunk chunk={textChunk} handleLinkClick={handleLinkNavigation} />
<ImageChunk chunk={imageChunk} book={book} /> // Enhanced with captions
```

### Link Navigation

```tsx
// Click a footnote
<span className="clickable-link footnote" onClick={() => handleLinkClick(footnoteLink)}>
  8
</span>

// Click a cross-reference
<span className="clickable-link cross-reference" onClick={() => handleLinkClick(crossRefLink)}>
  see chapter 3
</span>

// Click a page reference  
<span className="clickable-link page-reference" onClick={() => handleLinkClick(pageRefLink)}>
  page 156
</span>
```

### Upload Process

```bash
# Parse book with v2 parser
cd book-parser/parser-v2
node main-poc.js /path/to/book.pdf

# Upload to database with images
node upload-book-v2.js /path/to/book-folder/ --upload-images

# Result: Enhanced book with headers, images, and links
```

## Development Guidelines

### Adding New Chunk Types

1. **Database**: Add type to `TextChunk.type` union
2. **Upload**: Handle new type in conversion logic
3. **Client**: Create new chunk component
4. **Rendering**: Add case to `renderChunk()` function
5. **Navigation**: Update audio mapping if needed

### Adding New Link Types

1. **Schema**: Extend `ChunkLink` interface
2. **Parser**: Generate links in v2 parser
3. **Detection**: Add pattern to `getLinkType()`
4. **Styling**: Add CSS classes for new type
5. **Navigation**: Handle in `handleLinkNavigation()`

### Testing Strategy

- **Schema validation**: Verify upload script produces correct database format
- **Component testing**: Test each chunk type individually
- **Navigation testing**: Verify link resolution and navigation
- **Compatibility testing**: Ensure v1 books still work
- **Audio integration**: Verify text-only audio tracking

## Architecture Benefits

1. **Semantic Content**: Proper separation of headers, text, and images
2. **Enhanced Navigation**: Clickable cross-references and footnotes
3. **Rich Media**: Inline images with captions and proper loading states
4. **Audio Compatibility**: Smart audio tracking for text content only
5. **Backward Compatibility**: Seamless v1/v2 coexistence
6. **Extensible Design**: Easy to add new chunk types and link patterns
7. **Performance**: Efficient rendering with proper component separation
8. **User Experience**: Professional typography and interactive content

---

**Last Updated**: January 2025  
**Schema Version**: v2  
**Client Implementation**: Complete  
**Status**: ✅ Production Ready 