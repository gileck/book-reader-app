# IndexedDB API Documentation

## Overview

The Book Reader App uses a **generic, type-safe IndexedDB manager** for all client-side persistent storage needs. This provides a unified API for features like TTS caching, offline reading, and future client-side storage requirements.

## Architecture

### Two-Layer Design

```
┌─────────────────────────────────────────┐
│   Application Code                      │
│   (Settings, TTS Cache, Offline, etc.)  │
└───────────────┬─────────────────────────┘
                │
┌───────────────▼─────────────────────────┐
│   Business Logic Layer                  │
│   offlineDB.ts                          │
│   - Type-safe wrappers                  │
│   - Domain-specific operations          │
│   - FIFO eviction, book tracking, etc.  │
└───────────────┬─────────────────────────┘
                │
┌───────────────▼─────────────────────────┐
│   Generic IndexedDB Manager             │
│   indexedDBManager.ts                   │
│   - CRUD operations                     │
│   - Store configuration                 │
│   - Transaction handling                │
└─────────────────────────────────────────┘
```

**Files:**
- `src/client/offline/indexedDBManager.ts` - Generic database manager
- `src/client/offline/offlineDB.ts` - Business logic layer with store-specific operations

## Generic IndexedDB Manager

### Configuration

Define stores using a simple configuration object:

```typescript
import { createIndexedDBManager } from '@/client/offline/indexedDBManager';

const dbManager = createIndexedDBManager({
    dbName: 'offline-reader-db',
    version: 2,
    stores: [
        {
            name: 'tts-cache',
            keyPath: 'cacheKey'
        },
        {
            name: 'chapters',
            keyPath: 'chapterId',
            indexes: [
                { name: 'byBook', keyPath: 'bookId', unique: false }
            ]
        },
        {
            name: 'bookmarks',
            keyPath: 'id',
            indexes: [
                { name: 'byBookAndChapter', keyPath: ['bookId', 'chapterId'] }
            ]
        }
    ]
});
```

### Core Operations

#### Get Single Record

```typescript
const record = await dbManager.get<TtsCacheRecord>('tts-cache', cacheKey);
if (record) {
    console.log('Found cached audio:', record.audioContent);
}
```

#### Get All Records

```typescript
const allChapters = await dbManager.getAll<OfflineChapterRecord>('chapters');
console.log(`${allChapters.length} chapters downloaded`);
```

#### Query by Index

```typescript
const bookChapters = await dbManager.getByIndex<OfflineChapterRecord>(
    'chapters',
    'byBook',
    'book-id-123'
);
```

#### Insert or Update

```typescript
await dbManager.put('tts-cache', {
    cacheKey: 'abc123',
    audioContent: 'base64...',
    timepoints: [...],
    createdAt: Date.now()
});
```

#### Delete Record

```typescript
await dbManager.delete('tts-cache', cacheKey);
```

#### Clear Store

```typescript
await dbManager.clear('tts-cache');
```

#### Count Records

```typescript
const count = await dbManager.count('tts-cache');
console.log(`${count} cached audio files`);
```

#### Custom Transactions

For complex operations needing multiple store operations:

```typescript
await dbManager.transaction('tts-cache', 'readwrite', async (store) => {
    // Get all entries
    const getAllReq = store.getAll();
    const entries = await new Promise((resolve) => {
        getAllReq.onsuccess = () => resolve(getAllReq.result);
    });
    
    // Apply custom logic
    const toDelete = entries.slice(0, 5);
    toDelete.forEach(entry => store.delete(entry.cacheKey));
    
    return Promise.resolve();
});
```

## Current Stores

### 1. TTS Cache (`tts-cache`)

**Purpose:** Cache last 10 TTS audio responses for instant playback

**Schema:**
```typescript
interface TtsCacheRecord {
    cacheKey: string;              // hash(text + voiceId + provider)
    audioContent: string;          // base64 audio
    timepoints: TTSTimepoint[];    // word timing data
    createdAt: number;             // timestamp for FIFO ordering
}
```

**Eviction:** FIFO (First In, First Out) - oldest entries removed when limit exceeded

**Usage:**
```typescript
// Check cache
const cached = await offlineDB.getTtsCache(cacheKey);

// Save to cache
await offlineDB.putTtsCache({
    cacheKey,
    audioContent,
    timepoints,
    createdAt: Date.now()
});

// Get stats
const stats = await offlineDB.getTtsCacheStats();
console.log(`${stats.count} files, ${stats.sizeBytes} bytes`);

// Clear cache
await offlineDB.clearTtsCache();
```

**See also:** `src/client/tts/ttsCache.ts` for transparent caching wrapper

### 2. Offline Chapters (`chapters`)

**Purpose:** Store downloaded book chapters for offline reading

**Schema:**
```typescript
interface OfflineChapterRecord {
    chapterId: string;
    bookId: string;
    title: string;
    chapterNumber: number;
    content: unknown;              // ChapterContentClient
    assets: string[];
    contentVersion?: string;
    downloadedAt: string;          // ISO date
}
```

**Indexes:**
- `byBook` - Query all chapters for a specific book

**Usage:**
```typescript
// Save chapter
await offlineDB.putChapter(chapterRecord);

// Get specific chapter
const chapter = await offlineDB.getChapter('chapter-id-123');

// Get chapter by book and number
const chapter = await offlineDB.getChapterByBookAndNumber('book-id', 5);

// Delete chapter
await offlineDB.deleteChapter('book-id', 'chapter-id');
```

### 3. Offline Books (`books`)

**Purpose:** Track which books have downloaded chapters

**Schema:**
```typescript
interface OfflineBookRecord {
    bookId: string;
    title?: string;
    coverUrl?: string;
    downloadedChapterIds: string[];
}
```

**Usage:**
```typescript
// Get book info
const book = await offlineDB.getBook('book-id-123');

// List downloaded chapters
const chapterIds = await offlineDB.listDownloadedChapters('book-id-123');
```

## Adding a New Store

### Step 1: Add Store Configuration

Edit `src/client/offline/offlineDB.ts`:

```typescript
const dbManager = createIndexedDBManager({
    dbName: 'offline-reader-db',
    version: 3, // Increment version!
    stores: [
        // ... existing stores ...
        {
            name: 'reading-history',
            keyPath: 'id',
            indexes: [
                { name: 'byDate', keyPath: 'timestamp' },
                { name: 'byBook', keyPath: 'bookId' }
            ]
        }
    ]
});
```

### Step 2: Define TypeScript Interface

```typescript
export interface ReadingHistoryRecord {
    id: string;
    bookId: string;
    chapterId: string;
    timestamp: number;
    progress: number;
}
```

### Step 3: Add Business Logic Functions

```typescript
export const offlineDB = {
    // ... existing functions ...
    
    async addReadingHistory(record: ReadingHistoryRecord): Promise<void> {
        await dbManager.put('reading-history', record);
    },
    
    async getReadingHistory(limit: number = 50): Promise<ReadingHistoryRecord[]> {
        const allHistory = await dbManager.getAll<ReadingHistoryRecord>('reading-history');
        return allHistory
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);
    },
    
    async getBookReadingHistory(bookId: string): Promise<ReadingHistoryRecord[]> {
        return dbManager.getByIndex<ReadingHistoryRecord>(
            'reading-history',
            'byBook',
            bookId
        );
    }
};
```

### Step 4: Use in Application

```typescript
import { offlineDB } from '@/client/offline/offlineDB';

// Save reading progress
await offlineDB.addReadingHistory({
    id: crypto.randomUUID(),
    bookId: 'book-123',
    chapterId: 'chapter-5',
    timestamp: Date.now(),
    progress: 0.45
});

// Get recent history
const history = await offlineDB.getReadingHistory(10);
```

## Best Practices

### 1. Type Safety

Always use TypeScript interfaces and generics:

```typescript
// ✅ Good - Type-safe
const record = await dbManager.get<TtsCacheRecord>('tts-cache', key);

// ❌ Bad - No type checking
const record = await dbManager.get('tts-cache', key);
```

### 2. Error Handling

IndexedDB operations can fail - always handle errors:

```typescript
try {
    const cached = await offlineDB.getTtsCache(cacheKey);
    if (cached) {
        return cached;
    }
} catch (error) {
    console.error('Cache read failed:', error);
    // Fall back to API call
}
```

### 3. Batch Operations

Use transactions for related operations:

```typescript
// ✅ Good - Single transaction
await dbManager.transaction('chapters', 'readwrite', async (store) => {
    store.put(chapter1);
    store.put(chapter2);
    store.put(chapter3);
});

// ❌ Bad - Multiple transactions (slower)
await dbManager.put('chapters', chapter1);
await dbManager.put('chapters', chapter2);
await dbManager.put('chapters', chapter3);
```

### 4. Business Logic in offlineDB

Keep domain-specific logic in `offlineDB.ts`, not in components:

```typescript
// ✅ Good - Logic in offlineDB
async putTtsCache(record: TtsCacheRecord): Promise<void> {
    // FIFO eviction logic here
    const allEntries = await dbManager.getAll('tts-cache');
    if (allEntries.length > TTS_CACHE_LIMIT) {
        // Delete oldest...
    }
    await dbManager.put('tts-cache', record);
}

// ❌ Bad - Logic in component
const entries = await dbManager.getAll('tts-cache');
if (entries.length > 5) {
    // Eviction logic in component...
}
```

### 5. Graceful Degradation

IndexedDB may not be available (private browsing, old browsers):

```typescript
export async function generateTtsWithCache(payload) {
    // Try cache first
    try {
        const cached = await offlineDB.getTtsCache(key);
        if (cached) return cached;
    } catch (err) {
        console.warn('Cache unavailable, continuing without it');
        // Continue to API call
    }
    
    // Fall back to API
    return await generateTts(payload);
}
```

## Performance Considerations

### 1. Cache Size Limits

Keep cached data reasonable:
- **TTS Cache:** 10 entries (~0.7-1.5 MB typical)
- **Offline Chapters:** User-controlled, show storage usage
- **Reading History:** Limit to recent N entries

### 2. Indexed Queries

Use indexes for common query patterns:

```typescript
// ✅ Fast - Uses index
const chapters = await dbManager.getByIndex('chapters', 'byBook', bookId);

// ❌ Slow - Full scan
const all = await dbManager.getAll('chapters');
const filtered = all.filter(c => c.bookId === bookId);
```

### 3. Avoid Blocking Main Thread

IndexedDB operations are asynchronous - don't block:

```typescript
// ✅ Good - Non-blocking
void offlineDB.putTtsCache(record).catch(console.error);

// ❌ Bad - Blocking
await offlineDB.putTtsCache(record); // Delays UI
```

## Troubleshooting

### Store Not Found Error

**Error:** `DOMException: The object store does not exist`

**Cause:** Store not added to configuration or version not incremented

**Fix:**
1. Add store to `stores` array in configuration
2. Increment `version` number
3. Clear browser data and reload (IndexedDB schema is cached)

### Version Upgrade Not Triggering

**Cause:** Browser caching old database version

**Fix:**
```javascript
// In browser console
indexedDB.deleteDatabase('offline-reader-db');
// Then reload page
```

### Quota Exceeded Error

**Error:** `QuotaExceededError`

**Cause:** Too much data stored in IndexedDB

**Fix:**
1. Implement eviction policies (like TTS cache FIFO)
2. Show storage usage in settings
3. Allow users to clear cached data

### Transaction Inactive Error

**Error:** `InvalidStateError: Transaction is inactive`

**Cause:** Trying to use store after transaction completes

**Fix:** Keep all operations within transaction callback:

```typescript
await dbManager.transaction('chapters', 'readwrite', async (store) => {
    // ✅ All operations inside callback
    store.put(record1);
    store.put(record2);
});
```

## Testing

### Manual Testing in Browser

Open DevTools → Application → IndexedDB:

```javascript
// In browser console

// Check TTS cache
const db = await indexedDB.databases();
console.log('Databases:', db);

// Inspect store
const req = indexedDB.open('offline-reader-db', 2);
req.onsuccess = () => {
    const db = req.result;
    const tx = db.transaction('tts-cache', 'readonly');
    const store = tx.objectStore('tts-cache');
    const getAll = store.getAll();
    getAll.onsuccess = () => {
        console.log('TTS Cache:', getAll.result);
    };
};
```

### Unit Testing

```typescript
import { createIndexedDBManager } from '@/client/offline/indexedDBManager';

describe('IndexedDB Manager', () => {
    let dbManager: IndexedDBManager;
    
    beforeEach(() => {
        dbManager = createIndexedDBManager({
            dbName: 'test-db',
            version: 1,
            stores: [{ name: 'test-store', keyPath: 'id' }]
        });
    });
    
    afterEach(async () => {
        await dbManager.clear('test-store');
    });
    
    it('should store and retrieve records', async () => {
        await dbManager.put('test-store', { id: '1', data: 'test' });
        const record = await dbManager.get('test-store', '1');
        expect(record.data).toBe('test');
    });
});
```

## Migration Guide

### From Direct IndexedDB to Generic Manager

**Before:**
```typescript
const request = indexedDB.open('my-db', 1);
request.onupgradeneeded = () => {
    const db = request.result;
    db.createObjectStore('my-store', { keyPath: 'id' });
};
// ... complex transaction code ...
```

**After:**
```typescript
const dbManager = createIndexedDBManager({
    dbName: 'my-db',
    version: 1,
    stores: [{ name: 'my-store', keyPath: 'id' }]
});

await dbManager.put('my-store', record);
const result = await dbManager.get('my-store', id);
```

## Related Documentation

- **[Settings UI](../src/client/routes/Settings/Settings.tsx)** - Cache management interface
- **[TTS Cache Wrapper](../src/client/tts/ttsCache.ts)** - Transparent caching implementation
- **[Offline Manager](../src/client/offline/offlineManager.ts)** - Offline reading features

---

**Last Updated:** 2025-01-01  
**API Version:** 2.0  
**Database Version:** 2

