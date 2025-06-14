# Database Schema

This document defines the MongoDB database schema for the Book Reader App.

## Collections Overview

The database consists of the following collections:
- `users` - User accounts and authentication
- `books` - Book metadata and content structure
- `chapters` - Individual book chapters with text content
- `bookmarks` - User bookmarks with custom names and positions
- `readingProgress` - User reading progress and history
- `userSettings` - User preferences and configuration
- `readingLogs` - Detailed reading activity logs

## Collection Schemas

### 1. Users Collection

```typescript
interface User {
  _id: ObjectId;
  username: string;         // Indexed, Unique
  email?: string;           // Indexed, Unique (when provided)
  password_hash: string;
  createdAt: Date;
  updatedAt: Date;
  profilePicture?: string;
}
```

**Indexes:**
- `username` (unique)
- `email` (unique, sparse)

### 2. Books Collection

```typescript
interface Book {
  _id: ObjectId;
  title: string;            // Indexed
  author?: string;
  description?: string;
  coverImage?: string;      // URL or base64
  totalChapters: number;
  totalWords: number;
  language: string;         // Default: 'en-US'
  imageBaseURL?: string;    // Relative path to book images folder (e.g., "/Transformer/images/")
  chapterStartNumber?: number; // Starting chapter number (0 or 1), default: 1
  createdAt: Date;
  updatedAt: Date;
  isPublic: boolean;        // Whether book is publicly available
  uploadedBy?: ObjectId;    // Reference to user who uploaded
}
```

**Indexes:**
- `title` (text index for search)
- `author` (text index for search)
- `isPublic`
- `uploadedBy`

### 3. Chapters Collection

```typescript
interface Chapter {
  _id: ObjectId;
  bookId: ObjectId;         // Reference to Book
  chapterNumber: number;    // 1-based chapter numbering
  title: string;
  content: ChapterContent;
  wordCount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface ChapterContent {
  chunks: TextChunk[];      // Text split into TTS-optimized chunks
}

interface TextChunk {
  index: number;            // 0-based chunk index within chapter
  text: string;             // Plain text content (5-15 words optimal)
  wordCount: number;
  type: 'text' | 'image';   // Support for embedded images
  pageNumber?: number;      // PDF page number for positioning (NEW)
  imageName?: string;       // Image filename (if type is 'image'), combined with S3_BASE + book.imageBaseURL
  imageAlt?: string;        // Alt text for images
}
```

**Indexes:**
- `bookId + chapterNumber` (compound, unique)
- `bookId`

### 4. Bookmarks Collection

```typescript
interface Bookmark {
  _id: ObjectId;
  userId: ObjectId;         // Reference to User
  bookId: ObjectId;         // Reference to Book
  chapterNumber: number;    // Chapter position
  chunkIndex: number;       // Chunk position within chapter
  customName?: string;      // User-provided bookmark name
  previewText: string;      // First 100 characters for context
  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes:**
- `userId + bookId` (compound)
- `userId + bookId + chapterNumber + chunkIndex` (compound, unique) // Prevent duplicates
- `userId`

### 5. Reading Progress Collection

```typescript
interface ReadingProgress {
  _id: ObjectId;
  userId: ObjectId;         // Reference to User
  bookId: ObjectId;         // Reference to Book
  currentChapter: number;   // Last read chapter
  currentChunk: number;     // Last read chunk within chapter
  lastReadAt: Date;
  updatedAt: Date;
}
```

**Indexes:**
- `userId + bookId` (compound, unique)
- `userId`
- `lastReadAt`

### 6. User Settings Collection

```typescript
interface UserSettings {
  _id: ObjectId;
  userId: ObjectId;         // Reference to User
  
  // Audio Settings
  playbackSpeed: number;    // 0.5x to 2.0x, default: 1.0
  voiceId: string;          // Google TTS voice ID, default: 'en-US-Neural2-A'
  wordTimingOffset: number; // Milliseconds adjustment, default: 0
  
  // Visual Settings
  theme: 'light' | 'dark';  // Default: 'light'
  highlightColor: string;   // Hex color for word highlighting, default: '#ffeb3b'
  sentenceHighlightColor: string; // Hex color for sentence highlighting, default: '#e3f2fd'
  fontSize: number;         // Font size multiplier, default: 1.0
  lineHeight: number;       // Line height multiplier, default: 1.5
  fontFamily: string;       // Font family selection
  
  // Reading Preferences
  autoAdvance: boolean;     // Auto-advance to next chapter, default: true
  chunkSize: number;        // Preferred words per chunk, default: 10
  
  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes:**
- `userId` (unique)

### 7. Reading Logs Collection

```typescript
interface ReadingLog {
  _id: ObjectId;
  userId: ObjectId;         // Reference to User
  bookId: ObjectId;         // Reference to Book
  chapterNumber: number;    // Chapter being read
  chunkIndex: number;       // Chunk position within chapter
  chunkText: string;        // Text content of the chunk
  timestamp: Date;          // When this chunk was read
}
```

**Indexes:**
- `userId + timestamp` (compound)
- `bookId + timestamp` (compound)
- `userId`

## Data Relationships

```
User (1) ──> (N) Bookmarks
User (1) ──> (N) ReadingProgress  
User (1) ──> (1) UserSettings
User (1) ──> (N) Books (uploadedBy)
User (1) ──> (N) ReadingLogs

Book (1) ──> (N) Chapters
Book (1) ──> (N) Bookmarks
Book (1) ──> (N) ReadingProgress
Book (1) ──> (N) ReadingLogs

Chapter (1) ──> (N) Bookmarks (via chapterNumber)
Chapter (1) ──> (N) ReadingProgress (via currentChapter)
Chapter (1) ──> (N) ReadingLogs (via chapterNumber)
```

## Storage Considerations

### Size Estimates
- **Books**: ~1KB per book (metadata only)
- **Chapters**: Variable (10KB-1MB+ depending on content length)
- **Bookmarks**: ~200 bytes per bookmark
- **ReadingProgress**: ~500 bytes per user-book combination
- **UserSettings**: ~300 bytes per user
- **ReadingLogs**: ~150 bytes per reading activity entry

### Performance Optimizations
- Use compound indexes for common query patterns
- Implement TTL on audio cache to prevent storage bloat
- Consider GridFS for very large chapter content
- Use aggregation pipelines for complex reading statistics
- Implement proper sharding strategy for user-based collections

### Data Validation
- Enforce referential integrity through application logic
- Validate chunk indices are sequential and within bounds
- Ensure bookmark positions exist in referenced chapters
- Validate audio settings are within acceptable ranges

## Migration Strategy

1. **Phase 1**: Create basic collections (users, books, chapters)
2. **Phase 2**: Add reading features (bookmarks, progress)
3. **Phase 3**: Add user preferences (settings)
4. **Phase 4**: Add audio caching optimization

## Image URL Construction

Images use a three-part URL construction system for maximum flexibility:

1. **Vercel Blob Base Path** (hardcoded in app): `https://zdllzsw6qffmlxhs.public.blob.vercel-storage.com/books`
2. **Book Image Path** (stored in DB): `/The-Daily-Stoic/images/`
3. **Image Filename** (stored in chunk): `page-005-image-1.jpg`

**Full URL**: `VERCEL_BLOB_BASE_PATH + book.imageBaseURL + chunk.imageName`
**Example**: `https://zdllzsw6qffmlxhs.public.blob.vercel-storage.com/books/The-Daily-Stoic/images/page-005-image-1.jpg`

This design allows easy migration of the entire image storage system by changing only the hardcoded base path.

## Book Upload Process

The complete book upload workflow consists of:

### 1. Parse Book Content
```bash
# From book-parser/parser/ directory
node parse-pdf-book-generic.js "/path/to/book.pdf" "/path/to/config.json" "/path/to/output.json"
```

### 2. Upload Book Content to MongoDB
```bash
# From book-parser/upload-book/ directory  
node upload-parsed-book.js "/path/to/book/folder/" [--force]
```

### 3. Upload Images to Vercel Blob
```bash
# From book-parser/upload-book/ directory
node upload-images-to-vercel-blob.js "/path/to/book/folder/" "Book Title"
```

### Required Environment Variables
```bash
MONGODB_URI=mongodb://localhost:27017/book-reader-app
BLOB_READ_WRITE_TOKEN=vercel_blob_token_here
```

### Book Folder Structure
```
book-folder/
├── book.pdf          # Original PDF file
├── config.json       # Book configuration (metadata + chapter definitions)
├── output.json       # Generated by parser (book + chapters data)
└── images/           # Generated by parser
    └── Book-Title/
        ├── page-001-image-1.jpg
        ├── page-005-image-1.jpg
        └── ...
```

### Database Updates After Upload
- **Books collection**: Record created with `imageBaseURL` field
- **Chapters collection**: Records created with text chunks and image references
- **Image chunks**: Use `imageName` field (filename only) for Vercel Blob integration

This schema supports all features outlined in the Product Definition Document while maintaining flexibility for future enhancements. 