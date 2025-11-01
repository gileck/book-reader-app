# Application Loading Flow

This document describes the complete loading sequence of the book reader application, from initial page load to fully interactive UI. Understanding this flow is critical for debugging loading issues, adding new initialization steps, or optimizing startup performance.

## Table of Contents
- [High-Level Overview](#high-level-overview)
- [Detailed Loading Sequence](#detailed-loading-sequence)
- [Critical Dependencies](#critical-dependencies)
- [Component-Specific Loading](#component-specific-loading)
- [Error States](#error-states)
- [Performance Considerations](#performance-considerations)
- [Troubleshooting](#troubleshooting)

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Next.js Page Load                                        │
│    - HTML rendered (SSR)                                    │
│    - JavaScript bundle loads                                │
│    - React hydration begins                                 │
└────────────────┬────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Provider Initialization (Sequential, Order Matters!)     │
│    ┌─────────────────────────────────────────────────┐     │
│    │ AuthProvider                                    │     │
│    │ - Initialize auth state from cookies/storage   │     │
│    │ - Check if user is authenticated               │     │
│    │ - Set user object if logged in                 │     │
│    └──────────────┬──────────────────────────────────┘     │
│                   ↓                                         │
│    ┌─────────────────────────────────────────────────┐     │
│    │ SettingsProvider (depends on AuthProvider)      │     │
│    │ - Load app settings from localStorage          │     │
│    │ - IF authenticated:                             │     │
│    │   → API call: getUserSettings(userId)          │     │
│    │   → Wait for response                           │     │
│    │   → Set userSettings & userSettingsLoaded=true │     │
│    │ - IF not authenticated:                         │     │
│    │   → Use defaultUserSettings                     │     │
│    │   → Set userSettingsLoaded=true                │     │
│    └──────────────┬──────────────────────────────────┘     │
│                   ↓                                         │
│    ┌─────────────────────────────────────────────────┐     │
│    │ ApiClientInitializer (depends on Settings)      │     │
│    │ - Configure API client with settings           │     │
│    │ - Set offline mode, cache strategy, etc.       │     │
│    └──────────────┬──────────────────────────────────┘     │
│                   ↓                                         │
│    ┌─────────────────────────────────────────────────┐     │
│    │ AppThemeProvider (depends on Settings)          │     │
│    │ - Apply theme from settings                     │     │
│    │ - Setup Material-UI theme                       │     │
│    │ - Apply CSS custom properties                   │     │
│    └──────────────┬──────────────────────────────────┘     │
│                   ↓                                         │
│    ┌─────────────────────────────────────────────────┐     │
│    │ AuthWrapper (depends on Auth)                   │     │
│    │ - Check authentication for protected routes     │     │
│    │ - Redirect to login if needed                   │     │
│    └──────────────┬──────────────────────────────────┘     │
│                   ↓                                         │
│    ┌─────────────────────────────────────────────────┐     │
│    │ RouterProvider                                   │     │
│    │ - Initialize client-side routing                │     │
│    │ - Match current URL to route component          │     │
│    └──────────────┬──────────────────────────────────┘     │
└───────────────────┼─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Layout Rendering                                         │
│    - TopNavBar mounts                                       │
│    - DrawerMenu mounts                                      │
│    - Main container ready                                   │
└────────────────┬────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Route Component Loads (varies by route)                  │
│    - See "Component-Specific Loading" section              │
└─────────────────────────────────────────────────────────────┘
```

## Detailed Loading Sequence

### Phase 1: Next.js Bootstrap (0-500ms)

**File:** `src/pages/_app.tsx`

```typescript
// 1.1 Initial render (SSR or client)
export default function App() {
    // 1.2 Register service worker (async, non-blocking)
    useEffect(() => {
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js');
        }
    }, []);
    
    // 1.3 Render provider tree
    return (/* Provider hierarchy */);
}
```

**What Happens:**
1. Next.js loads HTML and JavaScript bundles
2. React hydration attaches event listeners
3. Service worker registration begins (background)
4. Provider tree starts initializing

**Blocking:** None - HTML is already visible  
**Async Operations:** Service worker registration

---

### Phase 2: AuthProvider Initialization (0-100ms)

**File:** `src/client/context/AuthContext.tsx`

```typescript
export const AuthProvider = ({ children }) => {
    // 2.1 Initialize auth state from storage/cookies
    const [user, setUser] = useState<User | null>(() => {
        // Check localStorage or cookies for existing session
        return getStoredUser();
    });
    
    // 2.2 Set authentication status
    const [isAuthenticated, setIsAuthenticated] = useState(!!user);
    
    // 2.3 Provider ready - passes user to children
    return (
        <AuthContext.Provider value={{ user, isAuthenticated, ... }}>
            {children}
        </AuthContext.Provider>
    );
};
```

**What Happens:**
1. Read authentication data from localStorage/cookies (synchronous)
2. Determine if user is authenticated
3. Make auth state available to child providers

**Blocking:** Synchronous - must complete before children render  
**Dependencies:** None  
**Provides:** `user`, `isAuthenticated`, `login()`, `logout()`

**Critical Point ⚠️:** All subsequent providers depend on this completing first

---

### Phase 3: SettingsProvider Initialization (0-300ms)

**File:** `src/client/settings/SettingsContext.tsx`

```typescript
export const SettingsProvider = ({ children }) => {
    const { user, isAuthenticated } = useAuth(); // Depends on AuthProvider!
    
    // 3.1 Load app settings from localStorage (synchronous)
    const [settings, setSettings] = useState(() => {
        const saved = localStorage.getItem('appSettings');
        return saved ? JSON.parse(saved) : defaultSettings;
    });
    
    // 3.2 Initialize user settings state
    const [userSettings, setUserSettings] = useState(null);
    const [userSettingsLoaded, setUserSettingsLoaded] = useState(false);
    
    // 3.3 Load user settings when auth is ready
    useEffect(() => {
        const loadUserSettings = async () => {
            if (!isAuthenticated || !user?.id) {
                // Not logged in - use defaults
                setUserSettings(defaultUserSettings);
                setUserSettingsLoaded(true);
                return;
            }
            
            // 3.4 API call to load user settings (asynchronous!)
            try {
                const result = await getUserSettings({ userId: user.id });
                setUserSettings(result.data.userSettings);
            } catch (error) {
                setUserSettings(defaultUserSettings); // Fallback
            } finally {
                setUserSettingsLoaded(true); // ← CRITICAL FLAG
            }
        };
        
        loadUserSettings();
    }, [isAuthenticated, user?.id]);
    
    // 3.5 Provider renders (but userSettings might not be loaded yet!)
    return (
        <SettingsContext.Provider value={{
            settings,
            userSettings,
            userSettingsLoaded, // ← Components MUST check this!
            ...
        }}>
            {children}
        </SettingsContext.Provider>
    );
};
```

**What Happens:**
1. **Synchronous:** Load app settings from localStorage
2. **Synchronous:** Initialize user settings state as `null`
3. **Asynchronous:** API call to load user settings (if authenticated)
4. **Important:** Provider renders immediately, but `userSettingsLoaded` is `false`
5. **Later:** When API completes, `userSettingsLoaded` becomes `true`

**Blocking:** Provider itself is non-blocking  
**Async Operations:** `getUserSettings()` API call  
**Dependencies:** AuthProvider (needs `user.id`)  
**Provides:** `settings`, `userSettings`, `userSettingsLoaded`, `updateSettings()`, `updateUserSettings()`

**Critical Point ⚠️:** Components that need user settings MUST wait for `userSettingsLoaded` flag!

---

### Phase 4: ApiClientInitializer (Depends on Settings)

**File:** `src/pages/_app.tsx`

```typescript
function ApiClientInitializer() {
    const { settings } = useSettings(); // Depends on SettingsProvider
    
    useEffect(() => {
        // 4.1 Configure API client with current settings
        initializeApiClient(() => settings);
    }, [settings]);
    
    return null; // Doesn't render anything
}
```

**What Happens:**
1. Read settings from SettingsContext
2. Configure API client (offline mode, cache strategy, etc.)
3. Re-configure whenever settings change

**Blocking:** Non-blocking (no UI)  
**Dependencies:** SettingsProvider

---

### Phase 5: AppThemeProvider (Depends on Settings)

**File:** `src/client/components/ThemeProvider.tsx`

```typescript
export const AppThemeProvider = ({ children }) => {
    const { settings } = useSettings(); // Depends on SettingsProvider
    
    // 5.1 Create Material-UI theme based on settings
    const theme = createTheme({
        palette: {
            mode: settings.theme, // 'light' or 'dark'
        },
    });
    
    // 5.2 Apply theme
    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            {children}
        </ThemeProvider>
    );
};
```

**What Happens:**
1. Read theme preference from settings
2. Create Material-UI theme object
3. Apply CSS baseline and theme to all children

**Blocking:** Synchronous - must complete before children render  
**Dependencies:** SettingsProvider

---

### Phase 6: Layout Components Mount

**File:** `src/client/components/Layout.tsx`

```typescript
export const Layout = ({ children }) => {
    // 6.1 TopNavBar mounts
    <TopNavBar />
    
    // 6.2 DrawerMenu mounts
    <DrawerMenu />
    
    // 6.3 Main content container ready
    <Container>
        {children} // ← Route component will render here
    </Container>
};
```

**What Happens:**
1. Navigation bar renders at top
2. Mobile drawer menu initializes
3. Main content container ready for route component

**Blocking:** Non-blocking (render as they mount)  
**Dependencies:** AppThemeProvider (for styling)

---

### Phase 7: Route Component Loads (Varies by Route)

See [Component-Specific Loading](#component-specific-loading) section below.

---

## Critical Dependencies

### Dependency Chain

```
AuthProvider (Level 1 - No dependencies)
    ↓
SettingsProvider (Level 2 - Depends on Auth)
    ↓
    ├─→ ApiClientInitializer (Level 3)
    ├─→ AppThemeProvider (Level 3)
    └─→ All Route Components (Level 4)
```

### What Each Provider Needs

| Provider | Depends On | Provides | Async Operations |
|----------|-----------|----------|------------------|
| **AuthProvider** | None | `user`, `isAuthenticated` | None (reads from storage) |
| **SettingsProvider** | AuthProvider | `settings`, `userSettings`, `userSettingsLoaded` | `getUserSettings()` API call |
| **ApiClientInitializer** | SettingsProvider | (No context, just configuration) | None |
| **AppThemeProvider** | SettingsProvider | Material-UI theme | None |
| **Route Components** | All above | (Varies) | Varies by route |

### Critical Synchronization Points

#### 1. Provider Order in `_app.tsx`

**MUST BE THIS ORDER:**
```tsx
<AuthProvider>           {/* Level 1 */}
  <SettingsProvider>     {/* Level 2 - needs Auth */}
    <ApiClientInitializer />
    <AppThemeProvider>   {/* Level 3 - needs Settings */}
      <AuthWrapper>
        <RouterProvider>
          <Layout>
            {/* Route Components */}
          </Layout>
        </RouterProvider>
      </AuthWrapper>
    </AppThemeProvider>
  </SettingsProvider>
</AuthProvider>
```

**If order is wrong:**
- SettingsProvider before AuthProvider → ❌ "useAuth must be used within AuthProvider" error
- Components before SettingsProvider → ❌ Cannot read settings

#### 2. User Settings Loading Flag

Components that depend on user settings MUST check `userSettingsLoaded`:

```typescript
// ❌ WRONG - Settings might be null
const MyComponent = () => {
    const { userSettings } = useSettings();
    const voice = userSettings.selectedVoice; // Crash if null!
};

// ✅ CORRECT - Wait for settings
const MyComponent = () => {
    const { userSettings, userSettingsLoaded } = useSettings();
    
    if (!userSettingsLoaded) {
        return <Loading />;
    }
    
    const voice = userSettings.selectedVoice; // Safe!
};
```

**Why this matters:**
- SettingsProvider renders immediately, but API call is async
- Components must wait for `userSettingsLoaded` flag
- Critical for TTS preloading (needs correct voice)

---

## Component-Specific Loading

### Library Page (Home) - Fast Load

**Route:** `/`  
**Component:** `src/client/routes/Library/Library.tsx`

```
Library Component Mount
    ↓
Display loading skeleton
    ↓
useEffect: Load books
    ├─ Check cache first
    ├─ API: getBooks() if needed
    └─ Update state
    ↓
Render book grid
```

**Dependencies:**
- ✅ AuthProvider (to check user)
- ✅ SettingsProvider (for sort preference)
- ❌ Does NOT need userSettingsLoaded

**Load Time:** ~100-500ms (cached) or ~500-1500ms (network)

---

### Reader Page - Complex Multi-Stage Load

**Route:** `/reader?bookId=X&chapter=Y`  
**Component:** `src/client/routes/Reader/ReaderDataLoader.tsx`

This is the most complex loading sequence in the app:

```
┌─────────────────────────────────────────────────────────┐
│ Stage 1: ReaderDataLoader Mounts                        │
└───────────────┬─────────────────────────────────────────┘
                ↓
┌─────────────────────────────────────────────────────────┐
│ Stage 2: useReaderData Hook                             │
│   - Parse URL query params (bookId, chapter)            │
│   - API: getBook(bookId)                                │
│   - API: getChapter(bookId, chapterNumber)              │
│   - Load progress from database                         │
└───────────────┬─────────────────────────────────────────┘
                ↓
┌─────────────────────────────────────────────────────────┐
│ Stage 3: Check User Settings Loaded                     │
│   const { userSettingsLoaded } = useSettings();         │
│                                                          │
│   if (!userSettingsLoaded) {                            │
│       return <Loading message="Loading settings..." />  │
│   }                                                      │
│                                                          │
│   ⚠️ CRITICAL GATE: Prevents rendering until settings   │
│      are loaded to avoid TTS with undefined voice       │
└───────────────┬─────────────────────────────────────────┘
                ↓
┌─────────────────────────────────────────────────────────┐
│ Stage 4: ReaderUI Renders                               │
│   - useReaderState hook initializes                     │
│   - useUserSettings() gets settings from Context        │
│   - useSentenceAudioController initializes              │
│   - Chapter content parsed into sentences               │
└───────────────┬─────────────────────────────────────────┘
                ↓
┌─────────────────────────────────────────────────────────┐
│ Stage 5: TTS Preloading (Background with IndexedDB Cache) │
│   - Check IndexedDB cache first (instant)               │
│   - Current sentence TTS generated (cache miss = API)   │
│   - Next 2-3 sentences preloaded (with caching)         │
│   - Uses userSettings.selectedVoice (MUST be loaded!)   │
│   - All responses saved to IndexedDB (FIFO, limit 5)    │
└───────────────┬─────────────────────────────────────────┘
                ↓
┌─────────────────────────────────────────────────────────┐
│ Stage 6: Interactive UI Ready                           │
│   - User can scroll, highlight, navigate               │
│   - Audio can be played (instant if cached)            │
│   - Settings can be changed                             │
└─────────────────────────────────────────────────────────┘
```

**Critical Loading Gate:**

```typescript
// src/client/routes/Reader/ReaderDataLoader.tsx
export const ReaderDataLoader = () => {
    const { data, loading, error } = useReaderData();
    const { userSettingsLoaded } = useSettings();
    
    // GATE 1: Wait for book data
    if (loading) {
        return <Loading message="Loading book..." />;
    }
    
    // GATE 2: Wait for user settings
    if (!userSettingsLoaded) {
        return <Loading message="Loading settings..." />; // ⚠️ CRITICAL
    }
    
    // GATE 3: Check for errors
    if (error) {
        return <Error message={error} />;
    }
    
    // All gates passed - safe to render
    return <ReaderUI data={data} />;
};
```

**Why Two Separate Loading States:**

1. **Book data** (loading) - typically 200-800ms
2. **User settings** (userSettingsLoaded) - typically 100-300ms

These run in parallel, but both must complete before rendering ReaderUI.

**Dependencies:**
- ✅ AuthProvider (user must be logged in)
- ✅ SettingsProvider (must be mounted)
- ✅ **userSettingsLoaded = true** (CRITICAL for TTS)
- ✅ Book and chapter data loaded

**Load Time:** ~300-1500ms (varies by network and data size)

**What Happens if Settings Not Loaded:**

```typescript
// ❌ BAD: ReaderUI renders before settings loaded
<ReaderUI />
  ↓
useSentenceAudioController(
    chapter,
    userSettings.selectedVoice,  // ← undefined!
    ...
)
  ↓
TTS preload with undefined voice
  ↓
Server uses default voice (wrong!)
  ↓
User plays audio and hears wrong voice
  ↓
User changes voice
  ↓
Cache cleared, reloads with correct voice
```

---

## Error States

### Authentication Error

```
User tries to access protected route
    ↓
AuthWrapper checks isAuthenticated
    ↓
if (!isAuthenticated) {
    redirect to /login
}
```

### Settings Load Error

```
SettingsProvider tries to load user settings
    ↓
API call fails (network error, server down, etc.)
    ↓
Catch error, log to console
    ↓
Fallback to defaultUserSettings
    ↓
Set userSettingsLoaded = true
    ↓
App continues with defaults
```

### Book Load Error

```
ReaderDataLoader tries to load book
    ↓
API call fails or returns 404
    ↓
Set error state
    ↓
Display error message to user
    ↓
Show "Return to Library" button
```

### TTS Error

```
User clicks play
    ↓
useSentenceAudioController tries to generate TTS
    ↓
API fails (rate limit, invalid voice, etc.)
    ↓
Display error notification
    ↓
User can retry or change voice
```

---

## Performance Considerations

### Parallel Loading Opportunities

**Currently Parallel:**
1. Service worker registration (background)
2. Book data fetch + user settings fetch (both async, run simultaneously)

**Sequential (Could Be Optimized):**
1. Auth check → Settings load (depends on auth)
2. Settings load → TTS preload (depends on voice selection)

### Optimization Strategies

#### 1. Prefetch User Settings

Instead of waiting for settings load on first Reader visit, prefetch during idle time:

```typescript
// In Library component, prefetch settings
useEffect(() => {
    if (isAuthenticated && !userSettingsLoaded) {
        // Trigger settings load early
        void getUserSettings({ userId: user.id });
    }
}, [isAuthenticated, user?.id, userSettingsLoaded]);
```

#### 2. Cache Book Metadata

Store recently accessed books in localStorage for instant display:

```typescript
// Show cached version immediately, refresh in background
const cachedBook = localStorage.getItem(`book_${bookId}`);
if (cachedBook) {
    setBook(JSON.parse(cachedBook)); // Instant display
}
// Then fetch fresh data
const freshBook = await getBook(bookId);
```

#### 3. Service Worker Caching

Already implemented - service worker caches:
- Static assets (JS, CSS)
- API responses (with cache-first strategy)
- Chapter content for offline reading

#### 4. IndexedDB TTS Caching (Implemented)

**Status:** ✅ Fully implemented

The app now caches TTS audio responses in IndexedDB for instant playback:

```typescript
// Transparent caching wrapper
await generateTtsWithCache(payload);
  ↓
Check IndexedDB → Cache hit? (instant) : API call → Save to cache
```

**Benefits:**
- **Instant audio playback** for recently played sentences (0ms vs 200-500ms)
- **Reduced API costs** (fewer TTS API calls)
- **Better UX** on page refresh (immediate audio availability)
- **Automatic cache warming** via preloading

**Implementation:**
- Last 10 TTS responses cached (FIFO eviction)
- Cache key: `hash(text + voiceId + provider)`
- Transparent wrapper: `src/client/tts/ttsCache.ts`
- Generic IndexedDB manager: `src/client/offline/indexedDBManager.ts`
- Settings UI for monitoring/clearing cache

**See:** [IndexedDB API Documentation](./indexeddb-api.md) for complete details.

### Measured Timings (Typical)

| Phase | Cold Start | Cached | Critical Path |
|-------|-----------|--------|---------------|
| Next.js Bootstrap | 200-500ms | 100-200ms | ✅ Yes |
| AuthProvider Init | 10-50ms | 10-50ms | ✅ Yes |
| SettingsProvider Init | 50-100ms | 50-100ms | ✅ Yes |
| User Settings API | 200-500ms | 50-100ms | ✅ Yes (if authenticated) |
| Theme Application | 10-30ms | 10-30ms | ✅ Yes |
| Layout Render | 50-100ms | 30-50ms | ✅ Yes |
| **Total to Interactive (Library)** | **520-1280ms** | **250-530ms** | - |
| Book Data Load | 300-800ms | 100-300ms | ✅ Yes (Reader) |
| **Total to Interactive (Reader)** | **820-2080ms** | **350-830ms** | - |

---

## Troubleshooting

### App Stuck on Loading Screen

**Symptom:** Loading spinner never disappears

**Possible Causes:**
1. User settings API never completes
   - Check network tab for getUserSettings call
   - Check for CORS errors
   - Check server logs

2. Component waiting for flag that never becomes true
   - Check if `userSettingsLoaded` is stuck on `false`
   - Check console for errors in SettingsProvider

3. Routing issue
   - Check if URL is valid
   - Check if route is registered

**Debug Steps:**
```typescript
// Add to SettingsProvider
useEffect(() => {
    console.log('Settings loading state:', {
        isAuthenticated,
        userId: user?.id,
        userSettingsLoaded,
        userSettings
    });
}, [isAuthenticated, user?.id, userSettingsLoaded, userSettings]);
```

### Wrong Voice Used for TTS

**Symptom:** Audio plays with default voice instead of selected voice

**Cause:** TTS preloaded before user settings loaded

**Debug Steps:**
1. Check if ReaderDataLoader has loading gate:
   ```typescript
   if (!userSettingsLoaded) return <Loading />;
   ```

2. Check network tab - is getUserSettings called before generateTts?

3. Add logging to useSentenceAudioController:
   ```typescript
   console.log('TTS using voice:', selectedVoice);
   ```

**Fix:** Ensure loading gate exists in ReaderDataLoader

### "useAuth must be used within AuthProvider" Error

**Symptom:** App crashes with context error

**Cause:** Provider hierarchy is wrong

**Fix:** Ensure AuthProvider wraps SettingsProvider in `_app.tsx`

```tsx
// ✅ Correct
<AuthProvider>
  <SettingsProvider>
    ...
  </SettingsProvider>
</AuthProvider>

// ❌ Wrong
<SettingsProvider>
  <AuthProvider>
    ...
  </AuthProvider>
</SettingsProvider>
```

### Slow Initial Load

**Symptom:** App takes >3 seconds to become interactive

**Debug Steps:**
1. Check network tab waterfall - which requests are slow?
2. Check bundle size - is it too large?
3. Check if service worker is registered
4. Check if API responses are cached

**Optimization:**
- Enable service worker caching
- Implement prefetching for user settings
- Add loading skeletons for perceived performance

---

## Related Documentation

- [Settings Architecture](../src/client/settings/README.md) - Detailed settings system documentation
- [Reader Component](../src/client/routes/Reader/README.md) - Reader-specific loading and error handling
- [API Guidelines](../.cursor/rules/client-server-communications.mdc) - API structure and caching

---

## Monitoring Checklist

When monitoring app startup in production:

- [ ] Time to First Byte (TTFB) < 500ms
- [ ] First Contentful Paint (FCP) < 1.5s
- [ ] Time to Interactive (TTI) < 3.5s
- [ ] getUserSettings API < 500ms
- [ ] No errors in console during startup
- [ ] Service worker registration successful
- [ ] Theme applied without flash
- [ ] Protected routes redirect properly
- [ ] TTS uses correct voice on first play

---

**Last Updated:** 2025-01-01  
**Maintainer:** Development Team

