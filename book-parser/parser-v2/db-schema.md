# Database Schema for Parser v2

This document defines the MongoDB database schema changes and additions for books processed with Parser v2.

## Parser v2 Overview

Parser v2 introduces significant improvements to the book parsing and database storage:

- **Flat chunk structure** → Chapter-based organization during upload
- **Enhanced chunk types**: `text`, `header`, `image` (vs original `text`, `image`)
- **Parser version tracking** with `parserVersion` field
- **Advanced link detection** with PDF annotation support
- **Clean schema** focused on essential user data

## Schema Changes from Parser v1

### Books Collection Updates

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
  imageBaseURL?: string;
  chapterStartNumber?: number;
  
  // NEW: Parser version tracking
  parserVersion?: number;           // 1 (original) or 2 (new parser)
  
  createdAt: Date;
  updatedAt: Date;
  isPublic: boolean;
  uploadedBy?: ObjectId;
}
```

### Chapters Collection Updates

```typescript
interface Chapter {
  _id: ObjectId;
  bookId: ObjectId;
  chapterNumber: number;
  title: string;
  content: ChapterContent;
  wordCount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface ChapterContent {
  chunks: TextChunk[];
}

// Enhanced TextChunk interface for parser v2
interface TextChunk {
  index: number;
  text: string;
  wordCount: number;
  
  // UPDATED: Enhanced type system
  type: 'text' | 'header' | 'image';    // Added 'header' type
  
  pageNumber?: number;
  
  // NEW: Sentence count (parser v2)
  sentenceCount?: number;
  
  // Image properties (type: 'image')
  imageName?: string;
  imageAlt?: string;
  
  // NEW: Advanced link detection (parser v2)
  links?: ChunkLink[];
}

// NEW: Advanced link structure
interface ChunkLink {
  text: string;                    // Link text as it appears in content
  targetPageNumber?: number;       // PDF page number target
  targetText?: string;             // Target content context
  linkId: string;                  // Unique link identifier
  role: 'source' | 'target';       // Link role in relationship
  targetChunk?: number;            // Target chunk index (if resolved)
  chapterNumber?: number;          // Target chapter (if cross-chapter link)
}
```

## Parser v2 Input Format

Parser v2 produces a flat chunk structure that gets converted to chapters during upload:

```json
{
  "rawText": "Complete extracted PDF text...",
  "chunks": [
    {
      "chunkId": "1_0",
      "type": "text", 
      "content": "This is the opening paragraph of chapter 1...",
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
      "sentenceCount": 0,
      "links": []
    },
    {
      "chunkId": "1_2", 
      "type": "image",
      "imageName": "page-015-image-1.jpg",
      "imageAlt": "Figure 1.1: Transformer Architecture",
      "pageNumber": 15,
      "extracted": true,
      "placeholder": false
    }
  ]
}
```

## Conversion Process

The upload script (`upload-book-v2.js`) converts the flat structure to database format:

### 1. Chapter Extraction
```javascript
// Extract chapter number from chunkId: "1_0" → chapter 1
const chapterNumber = parseInt(chunk.chunkId.split('_')[0]);
```

### 2. Chunk Conversion
```javascript
// Convert parser v2 chunk to database format
const convertedChunk = {
  index: chapterChunks.length,
  text: chunk.content || '',
  wordCount: chunk.wordCount || 0,
  type: chunk.type || 'text',
  pageNumber: chunk.pageNumber,
  sentenceCount: chunk.sentenceCount,
  links: chunk.links,
  imageName: chunk.imageName,
  imageAlt: chunk.imageAlt
};
```

### 3. Metadata Integration
```javascript
const bookMetadata = {
  title: extractedTitle,
  author: 'Unknown Author',
  parserVersion: 2
};
```

## Chunk Type Comparison

| Type | Parser v1 | Parser v2 | Description |
|------|-----------|-----------|-------------|
| `text` | ✅ Basic text chunks | ✅ Enhanced with links & sentences | Main content paragraphs |
| `header` | ❌ Mixed with text | ✅ Separate type | Section headers and titles |
| `image` | ✅ Basic image refs | ✅ Enhanced metadata | Images with extraction info |

## Link Detection Features

Parser v2 introduces sophisticated link detection:

### PDF Annotation Links
- Extracts actual PDF internal links
- Maps coordinates to target pages
- Resolves cross-references between chapters

### Footnote References
- Detects footnote patterns: `1`, `(8)`, `[12]`
- Strict pattern matching to avoid false positives
- Links footnotes to their references

### Cross-Chapter References
- "see chapter 3" → Links to chapter 3
- "page 156" → Links to specific page
- Maintains link relationships during chunk conversion

## Image Handling Improvements

### Parser v2 Image Chunks
```json
{
  "chunkId": "2_5",
  "type": "image",
  "imageName": "page-042-image-2.jpg",
  "imageAlt": "Figure 2.3: Attention Mechanism",
  "pageNumber": 42,
  "extracted": true,
  "placeholder": false,
  "originalName": "image-041.jpg"
}
```

### Database Storage
- Images are separate chunks (not embedded in text)
- `imageName` contains only filename
- Combined with `book.imageBaseURL` for full path
- Upload controlled by `--upload-images` flag

## Migration Considerations

### Existing Books (Parser v1)
- `parserVersion` field missing → defaults to 1
- Chunk types limited to 'text', 'image'
- No link detection

### New Books (Parser v2)
- `parserVersion: 2` explicitly set
- Enhanced chunk types with headers
- Advanced link detection and resolution

### Compatibility
Both parser versions produce compatible database records:
- Same basic book/chapter/chunk structure
- Parser v2 adds optional fields
- Existing queries continue to work
- Enhanced features available for v2 books

## Upload Command Comparison

```bash
# Original parser upload (auto-uploads images)
node upload-parsed-book.js /path/to/book-folder/

# Parser v2 upload (explicit image control)
node upload-book-v2.js /path/to/book-folder/                    # No images
node upload-book-v2.js /path/to/book-folder/ --upload-images    # With images
node upload-book-v2.js /path/to/book-folder/ --skip-images      # Explicit skip
```

## Query Examples

### Find Parser v2 Books
```javascript
db.books.find({ parserVersion: 2 });
```

### Find Books with Link Detection
```javascript
db.chapters.find({ 
  "content.chunks.links": { $exists: true, $ne: [] } 
}).distinct("bookId");
```

### Find Chapters with Headers
```javascript
db.chapters.find({ 
  "content.chunks.type": "header" 
});
```

### Find Chunks with Links
```javascript
db.chapters.find({ 
  "content.chunks.links": { $exists: true, $ne: [] } 
});
```

This schema maintains backward compatibility while enabling advanced features for parser v2 processed books. 