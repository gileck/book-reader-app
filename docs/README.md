# Book Reader App Documentation

## 📚 Table of Contents

### Core Architecture
- **[Application Loading Flow](./APP_LOADING_FLOW.md)** - Complete startup sequence from page load to interactive UI
  - Provider initialization order
  - Critical dependencies and synchronization points
  - Component-specific loading sequences
  - Performance optimization opportunities
  - Troubleshooting guide

### Settings System
- **[Settings Architecture](../src/client/settings/README.md)** - Centralized settings management
  - App settings (localStorage) vs User settings (database)
  - Loading flow and data synchronization
  - Usage examples and best practices
  - Migration notes

### Component Documentation
- **[Reader Component](../src/client/routes/Reader/README.md)** - Book reader implementation
  - Audio error handling
  - Voice change detection
  - TTS integration
  - Bug fixes and known issues

## 🚀 Quick Start

### Understanding App Initialization

1. **Read [Application Loading Flow](./APP_LOADING_FLOW.md)** first to understand:
   - How the app bootstraps
   - Provider dependency chain
   - Critical loading gates
   - Why order matters

2. **Then read [Settings Architecture](../src/client/settings/README.md)** to understand:
   - How settings are loaded and shared
   - Why user settings must be loaded before Reader renders
   - How to access and update settings

3. **For Reader-specific details**, see [Reader Component](../src/client/routes/Reader/README.md)

## 🎯 Critical Concepts

### Provider Hierarchy (MUST BE THIS ORDER!)

```tsx
<AuthProvider>              // Level 1 - Provides user auth
  <SettingsProvider>        // Level 2 - Needs auth to load user settings
    <ApiClientInitializer /> // Level 3 - Needs settings
    <AppThemeProvider>      // Level 3 - Needs settings
      <App />               // Level 4 - Everything ready
    </AppThemeProvider>
  </SettingsProvider>
</AuthProvider>
```

**Why:** Each provider depends on the ones above it. Wrong order = crashes.

### Loading Gates

Components that need user settings MUST wait:

```typescript
// ✅ CORRECT
const { userSettingsLoaded } = useSettings();

if (!userSettingsLoaded) {
  return <Loading />;
}

// Now safe to use userSettings
```

**Why:** User settings load asynchronously. Components (especially TTS) need valid settings before initializing.

### When to Read Each Doc

| Scenario | Read This |
|----------|-----------|
| Adding a new provider | [Application Loading Flow](./APP_LOADING_FLOW.md) |
| App stuck on loading screen | [Application Loading Flow](./APP_LOADING_FLOW.md) → Troubleshooting |
| Adding user preferences | [Settings Architecture](../src/client/settings/README.md) |
| Wrong voice used for TTS | [Application Loading Flow](./APP_LOADING_FLOW.md) + [Reader Component](../src/client/routes/Reader/README.md) |
| Audio errors | [Reader Component](../src/client/routes/Reader/README.md) |
| Settings not persisting | [Settings Architecture](../src/client/settings/README.md) → Troubleshooting |
| "useAuth must be used within AuthProvider" | [Application Loading Flow](./APP_LOADING_FLOW.md) → Provider Hierarchy |

## 📊 Flow Diagrams

### High-Level Startup Flow

```
Page Load
    ↓
AuthProvider (sync, ~50ms)
    ↓
SettingsProvider
    ├─ Load localStorage (sync, ~50ms)
    └─ Load user settings API (async, ~300ms)
    ↓
ApiClientInitializer + AppThemeProvider (~30ms)
    ↓
Route Component (varies by route)
    ↓
Interactive UI Ready ✓
```

### Reader Loading Flow (Most Complex)

```
ReaderDataLoader Mounts
    ↓
    ├─ Load Book Data (async, ~500ms)
    └─ Wait for userSettingsLoaded (async, ~300ms)
    ↓
Both Complete?
    Yes ↓                    No → Show Loading
ReaderUI Renders
    ↓
TTS Preloads (uses correct voice) ✓
```

## 🔧 Development Guidelines

### Adding New Providers

1. Determine dependencies - what does it need?
2. Add to correct position in provider hierarchy
3. Document in [Application Loading Flow](./APP_LOADING_FLOW.md)
4. Add to dependency chain diagram

### Adding User Settings

1. Add field to `UserSettings` interface in `src/client/settings/types.ts`
2. Add to database schema in `src/server/database/collections/userSettings/types.ts`
3. Update API types in `src/apis/userSettings/types.ts`
4. Document in [Settings Architecture](../src/client/settings/README.md)

### Debugging Loading Issues

1. Check browser console for errors
2. Check Network tab for failed API calls
3. Add debug logging:
   ```typescript
   console.log('Loading state:', {
     userSettingsLoaded,
     userSettings,
     isAuthenticated
   });
   ```
4. Refer to troubleshooting sections in docs

## 🎓 Learning Path

### For New Developers

1. **Day 1:** Read [Application Loading Flow](./APP_LOADING_FLOW.md)
   - Understand provider hierarchy
   - Learn about loading gates
   - See how components initialize

2. **Day 2:** Read [Settings Architecture](../src/client/settings/README.md)
   - Understand two types of settings
   - Learn how to access and update settings
   - See usage examples

3. **Day 3:** Read [Reader Component](../src/client/routes/Reader/README.md)
   - Understand most complex component
   - See error handling patterns
   - Learn about TTS integration

### For Bug Fixes

1. Identify the affected system (auth, settings, reader, etc.)
2. Read relevant documentation
3. Check troubleshooting section
4. Add debug logging
5. Fix and document

### For New Features

1. Determine what settings/data needed
2. Check if it affects loading sequence
3. Update relevant documentation
4. Add to troubleshooting if complex

## 📝 Documentation Standards

When updating documentation:

- ✅ Include code examples
- ✅ Explain WHY, not just WHAT
- ✅ Add troubleshooting sections
- ✅ Update diagrams if flow changes
- ✅ Link between related docs
- ✅ Include timestamps for breaking changes

## 🚨 Common Pitfalls

### 1. Wrong Provider Order
**Problem:** SettingsProvider before AuthProvider  
**Error:** "useAuth must be used within AuthProvider"  
**Fix:** See provider hierarchy above

### 2. No Loading Gate
**Problem:** Using userSettings before loaded  
**Error:** TTS with wrong voice, or crash on undefined  
**Fix:** Add `if (!userSettingsLoaded) return <Loading />;`

### 3. Direct API Calls
**Problem:** Calling getUserSettings() directly in components  
**Error:** Multiple API calls, race conditions  
**Fix:** Use `useSettings()` hook from Context

### 4. Assuming Synchronous Loading
**Problem:** Accessing userSettings immediately  
**Error:** Settings are null or undefined  
**Fix:** User settings load async - MUST check loading flag

## 🔗 External Resources

- [React Context Best Practices](https://react.dev/reference/react/useContext)
- [Next.js Data Fetching](https://nextjs.org/docs/app/building-your-application/data-fetching)
- [Material-UI Theming](https://mui.com/material-ui/customization/theming/)

## 📞 Support

### Filing Issues

When reporting loading or initialization issues, include:
- [ ] Steps to reproduce
- [ ] Browser console errors
- [ ] Network tab screenshot
- [ ] Which loading stage failed (refer to docs)
- [ ] User authentication status

### Contributing Documentation

1. Make changes to relevant doc
2. Update this index if adding new doc
3. Update "Last Updated" timestamp
4. Include code examples
5. Test all code examples

---

**Last Updated:** 2025-01-01  
**Maintained By:** Development Team

