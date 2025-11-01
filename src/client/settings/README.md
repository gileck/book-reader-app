# Settings Architecture

This directory contains the centralized settings management system for the application, handling both app-level settings (localStorage) and user-specific settings (database).

## Overview

The settings system uses React Context to provide global access to settings across the entire application. Settings are loaded once at app startup and shared via the `SettingsContext`.

## Architecture

```
App Startup
    ↓
AuthProvider initializes
    ↓
SettingsProvider mounts
    ↓
    ├─ Load app settings from localStorage
    │  (theme, offline mode, AI model, etc.)
    │
    └─ Wait for user authentication
        ↓
        User authenticates
        ↓
        Load user settings from database (ONCE)
        ├─ TTS preferences (voice, provider, speed)
        ├─ Reading preferences (theme, colors, fonts)
        └─ Focus mode settings
        ↓
        Set userSettingsLoaded = true
        ↓
        Components can now safely access settings
```

## Two Types of Settings

### 1. App Settings (localStorage)
**Location:** `settings` in SettingsContext  
**Storage:** Browser localStorage (`appSettings` key)  
**Scope:** Device-specific, not synced across devices  
**Use case:** User preferences that don't require authentication

```typescript
interface Settings {
    aiModel: string;                    // Selected AI model for Q&A
    contextSentencesCount: number;      // Context size for AI
    librarySortBy: 'title' | 'progress' | 'lastRead';
    theme: 'light' | 'dark';            // Synced with user theme when authenticated
    offlineMode: boolean;               // Force offline mode
    staleWhileRevalidate: boolean;      // Background data refresh
    readingMode?: 'full' | 'focus';     // Current reading view
}
```

### 2. User Settings (Database)
**Location:** `userSettings` in SettingsContext  
**Storage:** MongoDB (via `userSettings` collection)  
**Scope:** User-specific, synced across devices  
**Use case:** Authenticated user preferences

```typescript
interface UserSettings {
    // Audio/TTS
    ttsEnabled: boolean;
    playbackSpeed: number;
    selectedVoice: string;              // Required, no fallback
    selectedProvider: string;            // Required, no fallback
    wordTimingOffset: number;
    
    // Visual/Theme
    theme: 'light' | 'dark';
    highlightColor: string;              // Effective color for current theme
    sentenceHighlightColor: string;      // Effective color for current theme
    fontSize: number;
    lineHeight: number;
    fontFamily: string;
    textColor: string;                   // Effective color for current theme
    
    // Per-theme colors (stored separately)
    highlightColorLight?: string;
    highlightColorDark?: string;
    sentenceHighlightColorLight?: string;
    sentenceHighlightColorDark?: string;
    textColorLight?: string;
    textColorDark?: string;
    
    // Focus Mode
    wordHighlightingEnabled?: boolean;
    highlightMode?: 'word' | 'line' | 'off';
}
```

## Usage

### Accessing Settings

```typescript
import { useSettings } from '@/client/settings/SettingsContext';

function MyComponent() {
    const { 
        settings,              // App settings (localStorage)
        updateSettings,        // Update app settings
        userSettings,          // User settings (database) - can be null!
        userSettingsLoaded,    // Boolean: are user settings loaded?
        updateUserSettings     // Update user settings
    } = useSettings();
    
    // Wait for user settings to load
    if (!userSettingsLoaded) {
        return <Loading />;
    }
    
    // Safe to access user settings now
    const voice = userSettings.selectedVoice;
}
```

### Updating Settings

#### App Settings (localStorage)
```typescript
// Update immediately (synchronous, local only)
updateSettings({ theme: 'dark' });
```

#### User Settings (database)
```typescript
// Update locally + persist to database (asynchronous)
await updateUserSettings({ 
    selectedVoice: 'en-US-Neural2-C',
    playbackSpeed: 1.2 
});
```

## Loading Flow

### 1. Initial Load (Unauthenticated User)

```typescript
// SettingsProvider loads default settings
userSettings = defaultUserSettings;
userSettingsLoaded = true;
```

### 2. User Authentication

```typescript
// When user logs in, SettingsProvider automatically loads settings
useEffect(() => {
    if (isAuthenticated && user?.id) {
        const result = await getUserSettings({ userId: user.id });
        setUserSettings(result.data.userSettings);
        setUserSettingsLoaded(true);
    }
}, [isAuthenticated, user?.id]);
```

### 3. Components Wait for Settings

Critical components (like Reader) must wait for settings before rendering:

```typescript
// ReaderDataLoader.tsx
const { userSettingsLoaded } = useSettings();

if (!userSettingsLoaded) {
    return <Loading message="Loading settings..." />;
}

// Now safe to render Reader with TTS preloading
return <ReaderUI />;
```

## Critical Implementation Details

### 1. Provider Hierarchy

**IMPORTANT:** `AuthProvider` must wrap `SettingsProvider` because settings depend on auth:

```tsx
// src/pages/_app.tsx
<AuthProvider>
  <SettingsProvider>
    <App />
  </SettingsProvider>
</AuthProvider>
```

### 2. Loading Gates

Components that need user settings (especially TTS) must wait for `userSettingsLoaded`:

```typescript
// ❌ WRONG - TTS will preload with undefined voice
const Reader = () => {
    const { userSettings } = useSettings();
    // userSettings might be null here!
    const audio = useTTS(userSettings.selectedVoice);
};

// ✅ CORRECT - Wait for settings first
const ReaderDataLoader = () => {
    const { userSettingsLoaded } = useSettings();
    
    if (!userSettingsLoaded) {
        return <Loading />;
    }
    
    return <Reader />; // Safe - settings are loaded
};
```

### 3. Required Fields

Some fields are **required** and have no fallbacks:
- `selectedVoice` - Must be provided by server
- `selectedProvider` - Must be provided by server

If these are missing, the app throws an explicit error to catch configuration issues:

```typescript
if (!s.selectedVoice) {
    throw new Error('Server returned user settings without selectedVoice');
}
```

### 4. Theme Synchronization

The user's theme preference is stored in **both** places:
- `userSettings.theme` (database, synced across devices)
- `settings.theme` (localStorage, used by app-wide theme provider)

When loading user settings, the theme is automatically synced:

```typescript
// SettingsContext.tsx
if (settings.theme !== theme) {
    updateAppSettings({ theme }); // Sync localStorage with DB
}
```

## Data Flow Diagrams

### Settings Load Flow
```
App Start
    ↓
[AuthProvider mounts]
    ↓
[SettingsProvider mounts]
    ↓
Load app settings from localStorage ✓
    ↓
userSettings = null
userSettingsLoaded = false
    ↓
[User logs in]
    ↓
useEffect triggers (isAuthenticated changed)
    ↓
API: getUserSettings({ userId })
    ↓
Process & validate response
    ↓
setUserSettings(loadedSettings) ✓
setUserSettingsLoaded(true) ✓
    ↓
[All components can now access settings]
```

### Settings Update Flow
```
Component calls updateUserSettings({ playbackSpeed: 1.5 })
    ↓
SettingsContext.updateUserSettingsHandler()
    ↓
Update local state immediately
setUserSettings(prev => ({ ...prev, playbackSpeed: 1.5 }))
    ↓
API: updateUserSettings({ userId, settings: { playbackSpeed: 1.5 }})
    ↓
Database updated ✓
    ↓
[All components see updated value immediately via Context]
```

## Error Handling

### API Failure
```typescript
try {
    const result = await getUserSettings({ userId: user.id });
    setUserSettings(result.data.userSettings);
} catch (error) {
    console.error('Error loading user settings:', error);
    // Fallback to defaults
    setUserSettings(defaultUserSettings);
} finally {
    setUserSettingsLoaded(true); // Always set to true
}
```

### Missing Critical Fields
```typescript
if (!s.selectedVoice || !s.selectedProvider) {
    throw new Error('Server configuration error');
    // This will crash the app intentionally to catch issues early
}
```

## Best Practices

### 1. ✅ DO: Use Loading Gates
```typescript
if (!userSettingsLoaded) return <Loading />;
```

### 2. ✅ DO: Batch Updates
```typescript
// Good - single API call
await updateUserSettings({
    selectedVoice: 'new-voice',
    playbackSpeed: 1.5,
    ttsEnabled: true
});
```

### 3. ❌ DON'T: Make Direct API Calls
```typescript
// Bad - bypasses Context
const result = await getUserSettings({ userId });

// Good - use Context
const { userSettings } = useSettings();
```

### 4. ❌ DON'T: Assume Settings Are Loaded
```typescript
// Bad - might crash if userSettings is null
const voice = userSettings.selectedVoice;

// Good - check first
if (userSettingsLoaded && userSettings) {
    const voice = userSettings.selectedVoice;
}
```

## Files

- **`types.ts`** - TypeScript interfaces for Settings and UserSettings
- **`SettingsContext.tsx`** - React Context provider and loading logic
- **`README.md`** - This file (architecture documentation)

## Related Files

- **`src/pages/_app.tsx`** - Provider hierarchy setup
- **`src/apis/userSettings/`** - API client/server for user settings
- **`src/client/routes/Reader/hooks/useUserSettings.ts`** - Reader-specific wrapper
- **`src/client/routes/Reader/ReaderDataLoader.tsx`** - Loading gate example

## Migration Notes

### Before (Multiple API Calls)
Each component independently loaded settings:
```typescript
// TopNavBar - loads settings
const settings = useUserSettings(userId);

// Reader - loads settings again
const settings = useUserSettings(userId);

// Result: 2+ API calls for same data
```

### After (Single API Call)
Settings loaded once in Context:
```typescript
// SettingsProvider - loads once at startup
const { userSettings } = useSettings();

// All components access same data
// Result: 1 API call, instant access everywhere
```

## Troubleshooting

### "useAuth must be used within AuthProvider"
**Problem:** SettingsProvider is wrapping AuthProvider  
**Solution:** Reorder providers in `_app.tsx` - AuthProvider must be outer

### TTS using wrong/default voice
**Problem:** TTS preloading before settings load  
**Solution:** Add loading gate in ReaderDataLoader

### Settings not persisting
**Problem:** Using `updateSettings()` for user preferences  
**Solution:** Use `updateUserSettings()` for database-backed preferences

### Settings showing stale data
**Problem:** Component using local state instead of Context  
**Solution:** Remove local settings state, use `useSettings()` hook

