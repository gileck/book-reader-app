import { CacheResult } from "@/common/cache/types";
import { createCache } from "@/common/cache";
import { localStorageCacheProvider } from "./localStorageCache";
import type { Settings } from "@/client/settings/types";

const clientCache = createCache(localStorageCacheProvider)

// Injected settings getter (initialized from app once SettingsProvider is ready)
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
  /**
   * Make a POST request to an API endpoint
   * @param endpoint The API endpoint
   * @param body Request body
   * @param options Additional request options
   * @returns Promise with the typed response
   */
  call: async <ResponseType, Params = Record<string, string | number | boolean | undefined | null>>(
    name: string,
    params?: Params,
    options?: ApiOptions
  ): Promise<CacheResult<ResponseType>> => {
    const settings = getSettingsSafe();

    // Always wrap with cache; successful results will be cached
    const apiCall = async (): Promise<ResponseType> => {
      const isDeviceOffline = typeof navigator !== 'undefined' ? !navigator.onLine : false;
      if (settings?.offlineMode || isDeviceOffline) {
        throw new Error('OFFLINE_MODE_NETWORK_BLOCKED');
      }

      const response = await fetch('/api/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          params,
          options: {
            ...options,
            disableCache: false
          }
        }),
      });

      if (response.status !== 200) {
        throw new Error(`Failed to call ${name}: HTTP ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      if (result.data === null) {
        throw new Error(`Failed to call ${name}: No data returned`);
      }

      if (result.data && typeof result.data === 'object' && 'error' in result.data && result.data.error !== undefined && result.data.error !== null) {
        throw new Error(`Failed to call ${name}: ${result.data.error}`);
      }

      return result.data;
    };

    const effectiveOffline = (settings?.offlineMode === true) || (typeof navigator !== 'undefined' && !navigator.onLine);
    const globalSWR = settings?.staleWhileRevalidate === true;

    if (effectiveOffline) {
      return clientCache.withCache(apiCall, { key: name, params: params || {} }, {
        bypassCache: false,
        staleWhileRevalidate: true,
        disableCache: false,
        ttl: options?.ttl,
        maxStaleAge: options?.maxStaleAge,
        isDataValidForCache: options?.isDataValidForCache,
      });
    }

    return clientCache.withCache(apiCall, { key: name, params: params || {} }, {
      bypassCache: options?.bypassCache ?? !globalSWR,
      staleWhileRevalidate: options?.staleWhileRevalidate ?? globalSWR,
      disableCache: false,
      ttl: options?.ttl,
      maxStaleAge: options?.maxStaleAge,
      isDataValidForCache: options?.isDataValidForCache,
    });
  }
};

export type ApiOptions = {
  /**
   * Disable caching for this API call - will not save the result to cache
   */
  disableCache?: boolean;
  /**
   * Bypass the cache for this API call - will save the result to cache
   */
  bypassCache?: boolean;
  /**
   * Use client-side cache for this API call
   */
  useClientCache?: boolean;
  /**
   * TTL for client-side cache
   */
  ttl?: number;
  /**
   * Max stale age for client-side cache
   */
  maxStaleAge?: number;
  /**
   * Stale while revalidate for client-side cache
   */
  staleWhileRevalidate?: boolean;
  /**
   * Callback to validate if data should be cached
   */
  isDataValidForCache?: <T>(data: T) => boolean;
};

export default apiClient;
