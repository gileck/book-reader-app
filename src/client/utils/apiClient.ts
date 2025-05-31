import { CacheResult } from "@/common/cache/types";
import { createCache } from "@/common/cache";
import { localStorageCacheProvider } from "./localStorageCache";

const clientCache = createCache(localStorageCacheProvider)

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
    // Client-side caching wrapper
    const apiCall = async (): Promise<ResponseType> => {
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
            disableCache: location.href.includes('localhost') ? true : options?.disableCache
          }
        }),
      });

      // Don't cache non-200 responses
      if (!response.ok) {
        throw new Error(`Failed to call ${name}: ${response.statusText}`);
      }

      const result = await response.json();

      // Don't cache responses with error fields
      if (result.error) {
        throw new Error(`Failed to call ${name}: ${result.error}`);
      }

      // Additional check: if response is not 200-299 range, throw error
      if (response.status < 200 || response.status >= 300) {
        throw new Error(`Failed to call ${name}: HTTP ${response.status}`);
      }

      // Don't cache if data is null/undefined or if result indicates an error state
      if (result.data === null || result.data === undefined) {
        throw new Error(`Failed to call ${name}: No data returned`);
      }

      return result.data;
    };

    const shouldUseClientCache = options?.useClientCache ?? true;

    // Use client-side cache if enabled
    if (shouldUseClientCache) {
      return await clientCache.withCache(
        apiCall,
        {
          key: name,
          params: params || {},
        },
        {
          bypassCache: options?.bypassCache ?? false,
          disableCache: options?.disableCache ?? false,
          staleWhileRevalidate: options?.staleWhileRevalidate ?? true,
          ttl: options?.ttl,
          maxStaleAge: options?.maxStaleAge,
        }
      );
    }

    // Fallback to direct API call
    const data = await apiCall();
    return { data, isFromCache: false };
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
};

export default apiClient;
