## 1. High-Level Solution

Implement a cache policy that always writes successful API responses to the client cache but only serves cached data when either: (a) Offline Mode is enabled in Settings, or (b) a global Stale-While-Revalidate (SWR) toggle is ON. Add two app-wide settings toggles (Offline Mode, Serve Stale While Revalidate) to the Settings screen and persist them in the Settings Context. Refactor the API client to be initialized with a settings getter so it can dynamically decide whether to return cached data or fetch fresh data. Initialize the API client after Settings are available and before the rest of the app runs.

User flow (end-to-end): The user can toggle Offline Mode and SWR in Settings. When making API requests, the client always caches new successful responses. If Offline Mode is ON, cached responses are used (and the network is not relied upon). If SWR is ON, cached data is served immediately (when present) while a background refresh runs. If both are OFF, the client bypasses reading from cache but still writes the fresh response to cache for later offline/SWR usage.

## 2. Implementation Details

### 2.1 Settings: Add Offline Mode and Global SWR Toggles

- **Target file(s)**:
  - `src/client/settings/types.ts`
  - `src/client/settings/SettingsContext.tsx`
  - `src/client/routes/Settings/Settings.tsx`

- **Description**:
  - Extend `Settings` with `offlineMode: boolean` and `staleWhileRevalidate: boolean`.
  - Set defaults in `defaultSettings` (both default to `false`).
  - Ensure values are persisted to `localStorage` via the existing `SettingsContext` logic.
  - Add two `Switch` controls in Settings UI to toggle these values.

- **Code snippets / examples**:

```ts
// src/client/settings/types.ts (edits)
export interface Settings {
  aiModel: string;
  contextSentencesCount: number;
  librarySortBy: 'title' | 'progress' | 'lastRead';
  theme: 'light' | 'dark';
  offlineMode: boolean;                // NEW
  staleWhileRevalidate: boolean;       // NEW
}

export const defaultSettings: Settings = {
  aiModel: '',
  contextSentencesCount: 3,
  librarySortBy: 'title',
  theme: 'light',
  offlineMode: false,                  // NEW
  staleWhileRevalidate: false          // NEW
};
```

```tsx
// src/client/routes/Settings/Settings.tsx (add two switches under "Cache Management")
<Divider sx={{ my: 3 }} />
<Typography variant="h6" gutterBottom>Cache Behavior</Typography>
<FormControl fullWidth sx={{ mt: 2 }}>
  <FormControlLabel
    control={<Switch checked={settings.offlineMode} onChange={(e) => updateSettings({ offlineMode: e.target.checked })} />}
    label="Offline Mode"
  />
  <FormControlLabel
    control={<Switch checked={settings.staleWhileRevalidate} onChange={(e) => updateSettings({ staleWhileRevalidate: e.target.checked })} />}
    label="Serve Stale While Revalidate"
  />
  <Typography variant="body2" color="text.secondary">
    When SWR is ON, cached data will be served immediately when available while a background refresh runs.
  </Typography>
  <Typography variant="body2" color="text.secondary">
    Offline Mode forces using cache and avoids relying on network.
  </Typography>
  
</FormControl>
```

### 2.2 API Client: Initialize With Settings Context and Enforce New Policy

- **Target file(s)**:
  - `src/client/utils/apiClient.ts` (refactor)
  - `src/pages/_app.tsx` (initialize immediately after settings)
  - Optionally: `src/client/context/ApiClientInitializer.tsx` (small helper component)

- **Description**:
  - Add an initialization API to `apiClient` so it can read the latest settings on every call without passing settings manually around. The simplest approach is to inject a `getSettings` function during app startup and store it in the module.
  - Adjust `call` logic:
    - Always go through `withCache` so successful results are written to cache.
    - Compute `withCache` options based on settings:
      - If `offlineMode` is true: attempt to serve from cache via `staleWhileRevalidate: true`; network failures should surface as stale cache if present, otherwise error.
      - Else if `staleWhileRevalidate` is true: set `staleWhileRevalidate: true` so cache may be served and background revalidation runs.
      - Else (both OFF): set `bypassCache: true` and `staleWhileRevalidate: false` to skip reading from cache but still write fresh responses to cache.

- **Code snippets / examples**:

```ts
// src/client/utils/apiClient.ts (key edits)
import { CacheResult } from "@/common/cache/types";
import { createCache } from "@/common/cache";
import { localStorageCacheProvider } from "./localStorageCache";
import type { Settings } from "@/client/settings/types";

const clientCache = createCache(localStorageCacheProvider);

// Injected settings getter (initialized from _app once SettingsProvider is ready)
let getSettingsRef: (() => Settings) | null = null;
export function initializeApiClient(getSettings: () => Settings) {
  getSettingsRef = getSettings;
}

function getSettingsSafe(): Settings | null {
  try {
    return getSettingsRef ? getSettingsRef() : null;
  } catch {
    return null;
  }
}

export const apiClient = {
  call: async <ResponseType, Params = Record<string, string | number | boolean | undefined | null>>(
    name: string,
    params?: Params,
    options?: ApiOptions
  ): Promise<CacheResult<ResponseType>> => {
    const settings = getSettingsSafe();

    const apiCall = async (): Promise<ResponseType> => {
      const response = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, params, options: { ...options, disableCache: false } }),
      });
      if (response.status !== 200) {
        throw new Error(`Failed to call ${name}: HTTP ${response.status} ${response.statusText}`);
      }
      const result = await response.json();
      if (result?.data && typeof result.data === 'object' && 'error' in result.data && result.data.error != null) {
        throw new Error(`Failed to call ${name}: ${result.data.error}`);
      }
      return result.data;
    };

    // Decide cache behavior based on settings
    const offlineMode = settings?.offlineMode === true;
    const globalSWR = settings?.staleWhileRevalidate === true;

    // Always use cache layer so successful responses are written to cache
    return clientCache.withCache(apiCall, { key: name, params: params || {} }, {
      // When both settings are OFF: do not read cache, but write fresh result
      bypassCache: !offlineMode && !globalSWR,
      // Only enable SWR path when offline mode or global SWR is ON
      staleWhileRevalidate: offlineMode || globalSWR,
      // Never disable cache; we always want to write
      disableCache: false,
      ttl: options?.ttl,
      maxStaleAge: options?.maxStaleAge,
      isDataValidForCache: options?.isDataValidForCache,
    });
  }
};

export type ApiOptions = {
  disableCache?: boolean;   // Kept for compatibility; initialize forces caching
  bypassCache?: boolean;    // Per-call override, still respected if explicitly passed
  useClientCache?: boolean; // Optional legacy flag; not needed once global policy is in place
  ttl?: number;
  maxStaleAge?: number;
  staleWhileRevalidate?: boolean; // Per-call override, still respected if explicitly passed
  isDataValidForCache?: <T>(data: T) => boolean;
};
```

```tsx
// src/pages/_app.tsx (initialize the API client right after SettingsProvider is ready)
import { useSettings } from "@/client/settings/SettingsContext";
import { initializeApiClient } from "@/client/utils/apiClient";

function ApiClientInitializer() {
  const { settings } = useSettings();
  // Re-initialize on settings changes to always reflect latest toggles
  useEffect(() => {
    initializeApiClient(() => settings);
  }, [settings]);
  return null;
}

// In App component JSX, inside <SettingsProvider> but before the rest of the app
<SettingsProvider>
  <ApiClientInitializer />
  {/* rest of providers and app */}
</SettingsProvider>
```

### 2.3 Notes on Error Handling and Offline Behavior

- If `offlineMode` is true, `staleWhileRevalidate` is enabled to prefer cached reads. If cache is missing, the call will fetch and write on first success when network is available; if the network fails, no data is returned unless a prior cache exists.
- We do not hard-check `navigator.onLine`. Offline Mode is a user setting that controls behavior regardless of actual connectivity.
- Service worker and existing fetch error handling are not changed, but will naturally benefit from cached data when SWR or Offline Mode are ON.

### 2.4 Compliance and Consistency

- API modules are unchanged and continue to return `CacheResult<ResponseType>`.
- Client strictly consumes API names from `index.ts` per guidelines.
- TypeScript types are not duplicated; new fields live only in `src/client/settings/types.ts`.
- Final verification with `yarn checks` must pass with 0 errors.

### 2.5 Step-by-Step Sequence

1) Update `src/client/settings/types.ts` to add `offlineMode` and `staleWhileRevalidate` with defaults.
2) Ensure `src/client/settings/SettingsContext.tsx` persists and exposes the new fields (existing logic should suffice).
3) Add toggles to `src/client/routes/Settings/Settings.tsx` under a "Cache Behavior" section.
4) Refactor `src/client/utils/apiClient.ts`:
   - Add `initializeApiClient(getSettings)` and store the getter.
   - Compute cache options based on settings as specified.
   - Always call `withCache` so results are written to cache.
5) Initialize the client in `src/pages/_app.tsx` with a lightweight `ApiClientInitializer` that calls `initializeApiClient(() => settings)` and renders `null`.
6) Run `yarn checks` and fix any TypeScript or lint issues.
7) Manual QA: toggle settings and verify expected behaviors across key screens (library, reader, bookmarks).

## 3. Implementation Phases

- Phase 1: Settings model updates
  - Objective: Add `offlineMode` and `staleWhileRevalidate` to settings and persist them.

- Phase 2: API client refactor
  - Objective: Introduce initialization hook and implement new cache-return policy.

- Phase 3: App initialization wiring
  - Objective: Initialize API client after settings are ready and before main app code runs.

- Phase 4: Settings UI
  - Objective: Add toggles to allow users to control Offline Mode and SWR.

- Phase 5: Verification and cleanup
  - Objective: Ensure all API calls still behave correctly and pass project checks.

## 4. Potential Issues & Open Questions

- Risk: Early module imports might call `apiClient` before initialization. Mitigation: The initialization component mounts within `SettingsProvider` and runs on first render; if any API calls happen even earlier, consider defaulting `getSettingsSafe()` to read from `localStorage` or render the initializer before other providers. Current app structure mounts routes after providers, so risk is low.
- Risk: SSR (if any) and window access. The client-only initializer should run only in the browser; ensure no server import paths rely on `initializeApiClient`.
- Dependency: None beyond current Settings and Cache modules.
- Open Question: Should Offline Mode also hard-block network calls or only prefer cache? Current plan prefers cache and does not artificially fail requests; if required, we can add a guard to skip network entirely.

## 5. Task List

- [ ] Task 1: Extend `Settings` with `offlineMode` and `staleWhileRevalidate`
- [ ] Task 2: Persist and expose new settings in `SettingsContext`
- [ ] Task 3: Add toggles to `Settings` route (UI)
- [ ] Task 4: Add `initializeApiClient(getSettings)` to `apiClient`
- [ ] Task 5: Implement new cache-return policy in `apiClient`
- [ ] Task 6: Initialize API client in `_app.tsx` before main app code
- [ ] Task 7: Verify all API modules still return `CacheResult` and no type leaks
- [ ] Task 8: Run `yarn checks` and fix any lint/TS issues
- [ ] Task 9: Update this plan file, marking completed items as [✅]

Notes:
- Mark tasks as [✅] when completed during implementation.
- Keep this checklist updated to track progress and ensure nothing is missed.



