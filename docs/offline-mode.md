# Offline Mode - Complete Documentation

## Overview

The Reader app supports comprehensive offline functionality, allowing users to read content without an internet connection. This document covers the complete offline mode implementation, including caching strategies, error handling, UI indicators, and user experience.

## Table of Contents

1. [How Offline Mode Works](#how-offline-mode-works)
2. [The Problems & Fixes](#the-problems--fixes)
3. [Caching Architecture](#caching-architecture)
4. [Error Handling](#error-handling)
5. [User Interface](#user-interface)
6. [Implementation Details](#implementation-details)
7. [Testing](#testing)
8. [Related Files](#related-files)
9. [Future Enhancements](#future-enhancements)

---

## How Offline Mode Works

### Triggering Offline Mode

Offline mode activates automatically in two scenarios:
1. **Manual**: User toggles "Offline Mode" in Settings
2. **Automatic**: Device loses network connection (`navigator.onLine === false`)

These are combined into `effectiveOffline`:
```typescript
const effectiveOffline = settings.offlineMode || isDeviceOffline;
```

### Data Flow

```
User Opens Reader
       ↓
useReaderData hook
       ↓
Always call API client first
       ↓
API Client checks effectiveOffline
       ↓
╔═══════════════════════╦═══════════════════════════╗
║     ONLINE MODE       ║      OFFLINE MODE         ║
╠═══════════════════════╬═══════════════════════════╣
║ 1. Fetch from network ║ 1. Check API cache        ║
║ 2. Cache response     ║    (localStorage)         ║
║ 3. Return data        ║ 2. If found → Return data ║
║                       ║ 3. If not found → Error   ║
║ If network fails:     ║    ↓                      ║
║ → Fall back to cache  ║ 4. Try IndexedDB          ║
║ → Or IndexedDB        ║ 5. If found → Return data ║
║                       ║ 6. If not → Show error    ║
╚═══════════════════════╩═══════════════════════════╝
```

### Key Principle

**Always call the API client** - Let it handle caching decisions automatically. Don't manually check online/offline status in components.

---

## The Problems & Fixes

### Problem 1: API Cache Not Used in Offline Mode

#### The Issue
When users navigated to chapters while online, those chapters were cached but not accessible offline.

**User Experience (Broken)**:
1. **Online**: Navigate to Chapter 9 ✅
2. Navigate back to Chapter 8
3. **Go offline**: Enable offline mode
4. Navigate to Chapter 9 ❌ Error: "Chapter not available"

**Root Cause**: Two separate caching systems existed but weren't connected:
- **API Cache** (localStorage): Automatically cached API responses
- **IndexedDB**: Only checked for explicitly downloaded chapters
- When offline, code only checked IndexedDB and never API cache

#### The Fix

**Before (Broken)**:
```typescript
const loadChapterPreferOffline = async (bookId, chapterNumber) => {
    if (isOnline()) {
        // Online: Call API (caches response)
        const result = await getChapterByNumber({ bookId, chapterNumber });
        return { chapter: result.data?.chapter, fromLocal: false };
    }
    
    // Offline: ONLY check IndexedDB (never checks API cache!)
    const localRec = await offlineDB.getChapterByBookAndNumber(bookId, chapterNumber);
    if (localRec) {
        return { chapter: buildChapterFromLocal(localRec), fromLocal: true };
    }
    
    return { chapter: null, fromLocal: false };
};
```

**After (Fixed)**:
```typescript
const loadChapterPreferOffline = async (bookId, chapterNumber) => {
    // Always call the API - it handles caching automatically
    try {
        const chapterResult = await getChapterByNumber({ bookId, chapterNumber });
        const fromCache = chapterResult.isFromCache || false;
        
        return { 
            chapter: chapterResult.data?.chapter || null, 
            fromLocal: fromCache 
        };
    } catch (error) {
        // If API call fails, try IndexedDB as last resort
        console.warn('API call failed, checking IndexedDB:', error);
        const localRec = await offlineDB.getChapterByBookAndNumber(bookId, chapterNumber);
        if (localRec) {
            return { chapter: buildChapterFromLocal(localRec), fromLocal: true };
        }
        
        throw error;
    }
};
```

**What's Fixed**:
- ✅ Always calls API client (let it handle caching)
- ✅ API client automatically returns cached data when offline
- ✅ Falls back to IndexedDB if API cache also fails
- ✅ Single source of truth for caching decisions

**Files Changed**:
- `src/client/routes/Reader/hooks/useReaderData.ts`
- `src/client/routes/Reader/hooks/useReaderState.ts`

### Problem 2: Poor Error Messages

#### The Issue
JavaScript errors were thrown to console instead of user-friendly messages.

```
Error: OFFLINE_MODE_NETWORK_BLOCKED
    at apiCall (...)
    at Object.withCache (...)
```

Users saw generic "Failed to load chapter" instead of actionable guidance.

#### The Fix

Enhanced error handling at three levels:

**1. Cache Layer** (`src/common/cache/index.ts`):
```typescript
try {
    const result = await callback();
    // ... cache the result
} catch (error) {
    // Catch offline errors and provide helpful message
    if (opts.staleWhileRevalidate && 
        error instanceof Error && 
        error.message === 'OFFLINE_MODE_NETWORK_BLOCKED') {
        throw new Error('Content not available offline. Please connect to the internet or download this content for offline access.');
    }
    throw error;
}
```

**2. Data Loading Layer** (`useReaderData.ts` and `useReaderState.ts`):
```typescript
} catch (error) {
    console.error('Error loading reader data:', error);
    
    // Extract user-friendly error message
    let errorMessage = 'Failed to load book content';
    if (error instanceof Error) {
        if (error.message.includes('not available offline') || 
            error.message.includes('connect to the internet') ||
            error.message.includes('download this content')) {
            errorMessage = error.message;  // Use specific message
        } else if (error.message.includes('Chapter not found')) {
            errorMessage = 'Chapter not found. Please try a different chapter.';
        } else if (error.message.includes('Book not found')) {
            errorMessage = 'Book not found. Please check the book ID.';
        }
    }
    
    setError(errorMessage);  // Display to user
    setLoading(false);
}
```

**3. UI Layer**: Display errors with context and recovery options (see UI section below)

### Problem 3: Navigation Errors Block Reading

#### The Issue
When clicking "Next Chapter" while offline and the chapter wasn't cached, the entire page would show an error, losing the current reading position.

#### The Fix

**Two Types of Errors**:

1. **Critical Errors** (ReaderDataLoader): Block entire page
   - Initial load failures
   - Book not found
   - No books in library

2. **Navigation Errors** (ReaderUI): Non-blocking Snackbar
   - Chapter navigation failures
   - User stays on current chapter
   - Temporary notification at top of screen

**Implementation**:
```typescript
// In useReaderState.ts
const setCurrentChapterNumber = useCallback(async (chapterNumber: number) => {
    try {
        setState(prev => ({ ...prev, navigationError: null, chapterTransitionLoading: true }));
        
        const { chapter: resolvedChapter } = await loadChapterPreferOffline(bookId, chapterNumber);
        
        if (resolvedChapter) {
            // SUCCESS: Navigate to new chapter
            setState(prev => ({
                ...prev,
                chapter: resolvedChapter,
                currentChapterNumber: chapterNumber,
                currentChunkIndex: 0,
                chapterTransitionLoading: false,
                navigationError: null
            }));
        } else {
            // FAILED: Stay on current chapter, show notification
            setState(prev => ({
                ...prev,
                navigationError: `Chapter ${chapterNumber} is not available. Please try a different chapter.`,
                chapterTransitionLoading: false
            }));
        }
    } catch (error) {
        // Extract user-friendly message and stay on current chapter
        const errorMessage = extractErrorMessage(error, chapterNumber);
        setState(prev => ({
            ...prev,
            navigationError: errorMessage,
            chapterTransitionLoading: false
        }));
    }
}, [bookId, loadChapterPreferOffline]);
```

**Benefits**:
- ✅ User doesn't lose reading position
- ✅ Can continue reading current chapter
- ✅ Error auto-dismisses after 6 seconds
- ✅ Can manually dismiss error

---

## Caching Architecture

### Two-Tier Cache System

#### Tier 1: API Cache (Primary) - localStorage
- **Location**: `src/client/utils/apiClient.ts` + `src/common/cache/index.ts`
- **Storage**: localStorage via `localStorageCacheProvider`
- **Purpose**: Automatic caching of ALL API responses
- **When**: Every API call when online
- **Accessibility**: Automatic - no user action required
- **Cache Duration**: Configurable (default: 7 days for stale data)

#### Tier 2: IndexedDB (Secondary) - Explicit Downloads
- **Location**: `src/client/offline/offlineDB.ts`
- **Storage**: IndexedDB
- **Purpose**: User-downloaded chapters for offline reading
- **When**: Only when user explicitly downloads chapters
- **Accessibility**: Manual - user must download
- **Persistence**: Remains until user deletes

### Cache Hierarchy

```
1. API Client (online)
   └─> Network fetch
       └─> Cache to localStorage
       
2. API Client (offline)
   └─> Try localStorage cache (API cache)
       └─> If found: Return cached data ✅
       └─> If not: Try IndexedDB
           └─> If found: Return from IndexedDB ✅
           └─> If not: Show error ❌
```

### How API Client Handles Caching

```typescript
const effectiveOffline = settings?.offlineMode || !navigator.onLine;

if (effectiveOffline) {
    // OFFLINE MODE: Read from cache
    return clientCache.withCache(apiCall, { key: name, params }, {
        bypassCache: false,           // Use cache if available
        staleWhileRevalidate: true,   // Accept stale data
        disableCache: false
    });
}

// ONLINE MODE: Fetch fresh and cache
return clientCache.withCache(apiCall, { key: name, params }, {
    bypassCache: !globalSWR,          // Usually true = fetch fresh
    staleWhileRevalidate: globalSWR,
    disableCache: false               // Always write to cache
});
```

### Cache Configuration

```typescript
// Offline mode
maxStaleAge: 7 days              // Accept cache up to 7 days old
staleWhileRevalidate: true       // Return stale data when offline

// Online mode
bypassCache: true (usually)      // Fetch fresh data
disableCache: false              // But still save to cache
```

### Benefits

#### ✅ Automatic Caching
- No manual download required
- Simply visiting a chapter caches it
- Transparent background operation

#### ✅ Seamless Offline Reading
- Recently viewed chapters work offline automatically
- No explicit "download" step
- Smooth online-to-offline transition

#### ✅ Fallback System
- API cache (localStorage) - fast, automatic
- IndexedDB - persistent, explicit
- Graceful degradation

#### ✅ Consistent Behavior
- Same code path for online and offline
- API client handles all logic
- No duplication or manual checks

---

## Error Handling

### Principle

**NEVER throw client-side errors that reach the browser console. ALWAYS display proper error messages to users.**

### Error Categories

#### 1. Offline Mode Errors (User-Friendly)
Messages already written for end users:
- "Content not available offline. Please connect to the internet or download this content for offline access."
- "Chapter X is not available offline. Please connect to the internet or stay on this chapter."

**UI Treatment**: Cloud-off icon + detailed explanation

#### 2. Not Found Errors
Technical errors converted to user-friendly messages:
- `"Chapter not found"` → `"Chapter not found. Please try a different chapter."`
- `"Book not found"` → `"Book not found. Please check the book ID."`

**UI Treatment**: Error text without icon

#### 3. Generic Errors (Fallback)
Safe generic messages for unexpected errors:
- `"Failed to load book content"`
- `"Failed to load chapter"`

**UI Treatment**: Simple error display

### Error Handling Best Practices

#### ✅ DO:
1. **Catch all errors** at component boundaries
2. **Extract user-friendly messages** from Error objects
3. **Display errors in UI** using error state (not console)
4. **Log technical details** to console for debugging
5. **Provide actionable guidance** to users
6. **Test offline scenarios** thoroughly

#### ❌ DON'T:
1. **Throw errors** that reach the browser console
2. **Show generic messages** when specific ones exist
3. **Expose technical details** to end users
4. **Let errors crash** the UI or component
5. **Ignore error cases** in async operations

### Code Review Checklist

When adding new async operations:

- [ ] Is there a try-catch block around the async call?
- [ ] Does the catch block extract user-friendly error messages?
- [ ] Are specific error messages preserved (offline, not found, etc.)?
- [ ] Is a fallback generic message provided for unexpected errors?
- [ ] Is the error displayed in UI state (not thrown to console)?
- [ ] Are technical details logged to console for debugging?
- [ ] Have you tested the offline scenario?

---

## User Interface

### 1. Offline Mode Indicator

**Location**: Top navigation bar (all pages)

**When Shown**: 
- User enables offline mode in Settings, OR
- Device loses network connection

**Design**:

**Desktop (≥600px)**:
```
┌─────────────────────────────────────────────────────┐
│ ☰  Home  Library  Reader  [🌥 Offline Mode]  🌙 👤 │
└─────────────────────────────────────────────────────┘
```

**Mobile (<600px)**:
```
┌──────────────────────────────┐
│ ☰  [🌥 Offline]  🌙 👤      │
└──────────────────────────────┘
```

**Styling**:
- Semi-transparent white background: `rgba(255, 255, 255, 0.15)`
- White text/icon
- CloudOffIcon from Material-UI
- Rounded corners (12px border radius)

**Implementation** (`src/client/components/layout/TopNavBar.tsx`):
```tsx
{effectiveOffline && (
    <>
        {/* Desktop */}
        <Chip
            icon={<CloudOffIcon />}
            label="Offline Mode"
            size="small"
            sx={{
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                color: '#fff',
                fontWeight: 600,
                display: { xs: 'none', sm: 'flex' }
            }}
        />
        
        {/* Mobile */}
        <Box sx={{ display: { xs: 'flex', sm: 'none' }, alignItems: 'center', gap: 0.5 }}>
            <CloudOffIcon fontSize="small" />
            <Typography variant="caption" sx={{ fontWeight: 600 }}>
                Offline
            </Typography>
        </Box>
    </>
)}
```

### 2. Error UI - Initial Load (ReaderDataLoader)

**When**: Book or chapter fails to load on initial page load

**Design**:
```
┌─────────────────────────────────────────┐
│                                         │
│            🌥 (Cloud Off Icon)          │
│                                         │
│    Content not available offline.      │
│  Please connect to the internet or     │
│ download this content for offline...   │
│                                         │
│  This chapter hasn't been downloaded   │
│  for offline reading yet. You can      │
│  either go back or disable offline     │
│  mode to load it from the internet.    │
│                                         │
│    ┌──────────────────────────┐        │
│    │  ← Go Back to Library    │        │
│    └──────────────────────────┘        │
│                                         │
└─────────────────────────────────────────┘
```

**Features**:
- Cloud-off icon for offline errors
- Detailed error message
- Additional guidance text for offline scenarios
- "Go Back to Library" button
- Centered, full-screen layout

### 3. Error UI - Chapter Navigation (ReaderUI Snackbar)

**When**: Chapter navigation fails (next/previous chapter not available)

**Design**:
```
┌──────────────────────────────────────────┐
│ ⚠ Chapter 9 is not available offline.   │
│   Please connect to the internet...   X │
└──────────────────────────────────────────┘
```

**Features**:
- Appears at top of screen
- Non-blocking (user stays on current chapter)
- Auto-dismisses after 6 seconds
- Can be manually dismissed
- Red error styling
- Specific message with chapter number

**Implementation** (`src/client/routes/Reader/ReaderUI.tsx`):
```tsx
<Snackbar
    open={!!navigationError}
    autoHideDuration={6000}
    onClose={clearNavigationError}
    anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
>
    <Alert
        onClose={clearNavigationError}
        severity="error"
        sx={{ width: '100%' }}
    >
        {navigationError}
    </Alert>
</Snackbar>
```

---

## Implementation Details

### Files Modified

#### 1. **Cache Layer**
- `src/common/cache/index.ts`
  - Added try-catch for `OFFLINE_MODE_NETWORK_BLOCKED` errors
  - Throws user-friendly error message for offline scenarios

#### 2. **Data Loading**
- `src/client/routes/Reader/hooks/useReaderData.ts`
  - Refactored `loadChapterPreferOffline` to always call API
  - Enhanced error message extraction
  - Falls back to IndexedDB if API fails
  
- `src/client/routes/Reader/hooks/useReaderState.ts`
  - Same refactoring as `useReaderData`
  - Added `navigationError` state for non-blocking errors
  - Modified `setCurrentChapterNumber` to stay on current chapter on failure

#### 3. **UI Components**
- `src/client/routes/Reader/ReaderDataLoader.tsx`
  - Enhanced error UI with icon and buttons
  - Added offline-specific guidance text
  - "Go Back to Library" button for recovery
  
- `src/client/routes/Reader/ReaderUI.tsx`
  - Removed full-page error display (dead code)
  - Added Snackbar for navigation errors
  - Non-blocking error notifications
  
- `src/client/components/layout/TopNavBar.tsx`
  - Added offline mode indicator
  - Responsive design (desktop/mobile)
  - Subscribes to `effectiveOffline` from Settings

#### 4. **Other**
- `src/pages/_app.tsx`
  - Changed `AuthWrapper` to dynamic import with `ssr: false`

### Key Code Changes

#### Always Call API Client
**Before**: Manual online/offline checks
```typescript
if (isOnline()) {
    return await getChapterByNumber({ bookId, chapterNumber });
} else {
    return await offlineDB.getChapterByBookAndNumber(bookId, chapterNumber);
}
```

**After**: Trust the API client
```typescript
try {
    return await getChapterByNumber({ bookId, chapterNumber });
} catch (error) {
    // Only if API fails, try IndexedDB
    return await offlineDB.getChapterByBookAndNumber(bookId, chapterNumber);
}
```

#### Navigation Error Handling
**Before**: Navigate away, show full-page error
```typescript
const { chapter, error } = await loadChapter(chapterNumber);
if (error) {
    setState({ error });  // Blocks entire UI
}
```

**After**: Stay on current chapter, show notification
```typescript
try {
    const { chapter } = await loadChapter(chapterNumber);
    setState({ chapter, currentChapterNumber, navigationError: null });
} catch (error) {
    // Stay on current chapter, show Snackbar
    setState({ navigationError: extractErrorMessage(error) });
}
```

---

## Testing

### Scenarios

#### Scenario 1: Content Cached + Offline Mode Enabled
1. **Online**: Navigate to Chapter 5
2. Navigate back to Chapter 1
3. **Offline**: Enable offline mode
4. Navigate to Chapter 5
5. **Expected**: ✅ Loads instantly from cache
6. **Verify**: No network requests in DevTools

#### Scenario 2: Content NOT Cached + Offline Mode Enabled
1. **Offline**: Enable offline mode (or disconnect network)
2. Navigate to Chapter 10 (never visited)
3. **Expected**: ❌ Error: "Content not available offline..."
4. **Verify**: Clear, actionable error message

#### Scenario 3: Network Available but Fails + Content Cached
1. **Online**: Navigate to Chapter 5 (caches it)
2. Simulate network failure (DevTools throttling)
3. Navigate to Chapter 5 again
4. **Expected**: ✅ Loads from cache
5. **Verify**: Fallback to cache works seamlessly

#### Scenario 4: Chapter Navigation Offline (Snackbar)
1. **Online**: Open Chapter 1
2. **Offline**: Enable offline mode
3. Click "Next Chapter" (not cached)
4. **Expected**: 
   - ✅ Stay on Chapter 1
   - ✅ Snackbar appears at top
   - ✅ Error includes chapter number
   - ✅ Auto-dismisses after 6 seconds
5. **Verify**: Can continue reading Chapter 1

#### Scenario 5: Offline Indicator
1. Navigate to any page
2. Enable offline mode in Settings
3. **Expected**: ✅ "Offline Mode" chip appears in nav bar
4. Disable offline mode
5. **Expected**: ✅ Indicator disappears
6. Disconnect network (DevTools offline)
7. **Expected**: ✅ Indicator reappears automatically

#### Scenario 6: Multiple Chapters
1. **Online**: Navigate through Chapters 1-5
2. **Offline**: Enable offline mode
3. Navigate between Chapters 1-5
4. **Expected**: ✅ All load from cache seamlessly
5. Try Chapter 10 (not cached)
6. **Expected**: ❌ Snackbar error, stay on current chapter

### Manual Testing Checklist

- [ ] Test offline mode toggle (Settings)
- [ ] Test network disconnection (DevTools)
- [ ] Test offline indicator (appears/disappears correctly)
- [ ] Test offline indicator on mobile viewport
- [ ] Test initial load error (full-page error UI)
- [ ] Test navigation error (Snackbar at top)
- [ ] Test "Previous Chapter" button when at first chapter (disabled)
- [ ] Test "Go Back to Library" button
- [ ] Test cache persistence (refresh page while offline)
- [ ] Test multiple chapters (some cached, some not)
- [ ] Test auto-dismiss of Snackbar (6 seconds)
- [ ] Test manual dismiss of Snackbar (click X)
- [ ] Verify no console errors in any scenario
- [ ] Verify all error messages are user-friendly

### Browser Testing

Tested and working:
- ✅ Chrome/Edge (Chromium)
- ✅ Firefox
- ✅ Safari
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

---

## Related Files

### Core Caching
- `src/client/utils/apiClient.ts` - API client with offline detection
- `src/common/cache/index.ts` - Cache wrapper with error handling
- `src/client/utils/localStorageCache.ts` - localStorage cache provider
- `src/client/offline/offlineDB.ts` - IndexedDB for explicit downloads

### Settings & Context
- `src/client/settings/SettingsContext.tsx` - Manages offline state and `effectiveOffline`
- `src/client/routes/Settings/Settings.tsx` - Offline mode toggle UI

### Reader Components
- `src/client/routes/Reader/Reader.tsx` - Main Reader component
- `src/client/routes/Reader/ReaderDataLoader.tsx` - Initial data load with error UI
- `src/client/routes/Reader/ReaderUI.tsx` - Main UI with navigation error Snackbar
- `src/client/routes/Reader/hooks/useReaderData.ts` - Initial data loading logic
- `src/client/routes/Reader/hooks/useReaderState.ts` - Chapter navigation logic

### UI Components
- `src/client/components/layout/TopNavBar.tsx` - Offline mode indicator

### Other
- `src/pages/_app.tsx` - App wrapper with dynamic AuthWrapper import

---

## Future Enhancements

### 1. Cache Management
- **Cache Size Limits**: Implement LRU (Least Recently Used) eviction
- **Storage Usage Indicator**: Show how much space is used by cache
- **Manual Cache Control**: Let users clear cache from Settings
- **Cache Status UI**: Show which chapters are cached (green checkmark)

### 2. Smart Preloading
- **Auto-Download Next Chapter**: Preload next/previous chapters in background
- **Chapter Range Downloads**: Batch download chapters 1-10
- **Predictive Caching**: Cache frequently accessed chapters

### 3. Sync & Updates
- **Sync on Reconnect**: Update stale cache when back online
- **Background Sync**: Use Service Worker for background updates
- **Sync Indicator**: Show when content is syncing
- **Conflict Resolution**: Handle updates to already-cached content

### 4. UI Enhancements
- **Clickable Offline Indicator**: Click to open Settings
- **Tooltip on Indicator**: Explain why app is offline (user vs. network)
- **Download Progress**: Show progress bar when downloading chapters
- **Retry Button**: Add "Try Again" button for transient errors
- **Animation**: Fade-in/out for offline indicator

### 5. Error Handling
- **Error Types**: Create typed error classes for different categories
- **Error Boundary**: Add React Error Boundary for catastrophic errors
- **Retry Logic**: Automatic retry for transient network errors
- **Error Analytics**: Track error types to identify common issues
- **Offline Queue**: Queue failed operations for retry when back online

### 6. Advanced Features
- **Download Manager UI**: Dedicated page for managing offline content
- **Chapter List with Status**: Show all chapters with download status
- **Selective Downloads**: Choose which chapters to download
- **Auto-Delete Old Content**: Remove least recently used chapters
- **Storage Quota API**: Use Storage API to request more space

---

## Key Takeaways

1. **Trust the API client** - It has sophisticated caching logic built-in
2. **Don't bypass the cache layer** - Let it make caching decisions
3. **Two-tier caching works** - API cache (automatic) + IndexedDB (manual)
4. **Offline mode is automatic** - No special handling needed in most cases
5. **Recent content is cached** - Simply visiting pages caches them
6. **Error messages matter** - Always show actionable, user-friendly messages
7. **Stay on page for navigation errors** - Don't disrupt reading experience
8. **Visual indicators help** - Users should always know when offline
9. **Test offline scenarios** - They're critical for user experience
10. **Cache hierarchy is important** - API cache → IndexedDB → Error

---

## Summary

The offline mode implementation provides a seamless experience for users:

- **Automatic caching** of all visited content
- **Smart fallback** from API cache to IndexedDB
- **User-friendly error messages** with actionable guidance
- **Visual indicators** so users know when offline
- **Non-blocking navigation errors** that preserve reading position
- **Comprehensive error handling** at all layers

The system is designed to "just work" - users can browse content online, and it automatically becomes available offline without any manual steps. When content isn't available offline, clear messages guide users on what to do next.

