## Offline Reading Mode (Per-Chapter) — Feature Plan

> **Note:** This app now uses a **generic IndexedDB manager** (`indexedDBManager.ts`) that provides
> type-safe CRUD operations for all IndexedDB stores. The implementation described below should
> use this generic API. See [IndexedDB API Documentation](../docs/indexeddb-api.md) for details.

### Goal
Enable users to download and read individual chapters offline (no TTS) while ensuring the app reliably loads and functions without network connectivity.

### Non‑Goals
- TTS downloads or offline TTS playback.
- Offline creation/sync of server state (bookmarks/notes/history). We will read-only when offline and optionally add queued sync later.

### UX Overview
- Per‑book settings: allow downloading/removing chapters and viewing storage usage.
- Chapter list shows actionable status: Download, Downloading (progress), Downloaded, Update available, Failed.
- Reader route:
  - If chapter is downloaded or device is offline → load from local storage immediately.
  - If online and not downloaded → fetch via network; fallback to local copy if available.
  - Show a small "Offline" badge when rendering a local copy; "Update available" when server version is newer.
- Global setting: total storage usage, clear all downloads.

### Architecture Overview
**Storage choice**
- Use IndexedDB for chapter content and metadata (**Generic manager already implemented**).
- Use Service Worker Cache Storage for assets (images/fonts/css) and app shell resources.

**Generic IndexedDB Manager (Already Implemented)**
- All IndexedDB operations use the generic `indexedDBManager.ts` API
- Store configuration is centralized in `offlineDB.ts`
- Business logic separated from database operations
- Type-safe CRUD operations for all stores
- See [IndexedDB API docs](../docs/indexeddb-api.md) for usage examples

**Service Worker (Workbox recommended)**
- Precache app shell (HTML, JS bundles, CSS, fonts, icons) so the app opens offline.
- Runtime caching strategies:
  - App shell routes: cache‑first (precache) with versioned manifest.
  - Chapter assets (images referenced by content): stale‑while‑revalidate with long maxAge.
  - Optional: network‑first for chapter API when online, fallback to IndexedDB when offline.
- Offline fallback page for unknown routes.

**Data model (IndexedDB)**
```ts
// Store: chapters
{
  chapterId: string,
  bookId: string,
  title: string,
  content: { type: 'html' | 'blocks', payload: string | any },
  assets: string[], // URLs referenced by the chapter
  contentVersion: string, // or updatedAt (ISO string)
  downloadedAt: string, // ISO date
}

// Store: books
{
  bookId: string,
  title: string,
  coverUrl?: string,
  downloadedChapterIds: string[],
}

// Store: settings (optional, per book)
{
  bookId: string,
  preferredOffline: boolean,
}
```

**Download Manager**
- App API:
  - `downloadChapter(chapterId)`
  - `removeChapter(chapterId)`
  - `isChapterDownloaded(chapterId)`
  - `getDownloadedChapters(bookId)`
  - `getStorageUsage()`
- Flow (downloadChapter):
  1. Fetch chapter via existing Chapters API.
  2. Persist structured content to IndexedDB.
  3. Parse asset URLs from content and request the SW to `cache.addAll(urls)`.
  4. Emit progress to UI; mark completion or error.

**Versioning & refresh**
- Store `contentVersion` (or `updatedAt`) with each chapter.
- When online, compare versions and refresh local copy in background if newer.

**Auth & user scope**
- Cache/DB is user-scoped. On logout, purge user data (IndexedDB + relevant caches).

### Minimal API Requirements
- Ensure Chapters API response includes `contentVersion` (or `updatedAt`).
- If not already present, include an `assets` list or make sure assets can be deterministically extracted from content.

### Error Handling & Quotas
- Estimate chapter size; detect quota errors and display actionable messages.
- Allow selective removal of chapters to free space.
- Optional LRU eviction policy for oldest/least accessed chapters.

### Phased Tasks (MVP → Enhancements)

#### Phase 1 — MVP (Reading core)
- [ ] Service Worker: precache app shell; runtime caching for chapter assets; offline fallback.
- [ ] IndexedDB layer: stores for chapters/books; CRUD helpers.
- [ ] Offline Manager: `downloadChapter`, `removeChapter`, `isChapterDownloaded`, `getDownloadedChapters`, `getStorageUsage`.
- [ ] Reader route: load from IndexedDB when offline or when chapter downloaded; fallback behavior.
- [ ] Per‑book UI: chapter list actions (Download/Remove), basic progress, status badges.
- [ ] Logout flow: purge user offline data.
- [ ] Basic tests: offline load in DevTools; verify chapter renders offline including images.

#### Phase 2 — Quality & Maintenance
- [ ] Versioning: detect “Update available” and background refresh of downloaded chapters.
- [ ] Storage usage UI: per‑book and global, with clear‑all.
- [ ] Background/Periodic Sync (when supported) to refresh versions.
- [ ] Resilient error states (quota exceeded, partial downloads, retries).
- [ ] Telemetry: download success/failure, space usage, eviction counts.

### Acceptance Criteria (MVP)
- App opens and navigates to Reader route while offline (precached shell).
- A user can download specific chapters and read them offline.
- Downloaded chapter text and inline images render offline.
- Reader indicates when displaying offline content.
- Removing a chapter frees storage and updates UI.
- Logging out clears offline data for that user.

### Testing Plan
- Simulate offline: verify app shell and Reader render.
- Unit tests for IndexedDB layer and Offline Manager flows.
- Manual test on Safari/iOS and Chrome/Android (quota and SW behavior differences).
- Optional E2E: download chapter → go offline → open Reader → verify content and assets.

### Rollout
- Behind a feature flag for initial release.
- Gradual enablement and monitoring; provide a recovery path to clear caches if needed.

---

### Working Task List (for quick reference)
- [ ] SW precache + runtime caching for assets
- [ ] IndexedDB schema + helpers
- [ ] Offline Manager (download/remove/query)
- [ ] Reader offline load path
- [ ] Per‑book offline UI (download/remove/progress)
- [ ] Logout purge
- [ ] Versioning refresh (update available)
- [ ] Storage usage UI
- [ ] Background sync (optional)
- [ ] Telemetry + error handling




