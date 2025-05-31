import { NextApiRequest, NextApiResponse } from "next";
import { parse, serialize } from 'cookie';
import jwt from 'jsonwebtoken';
import { apiHandlers } from "./apis";
import { createCache } from "@/common/cache";
import { CacheResult } from "@/common/cache/types";
import type { ApiOptions } from "@/client/utils/apiClient";
import { AuthTokenPayload } from "./auth/types";
import { fsCacheProvider, s3CacheProvider } from "@/server/cache/providers";

// Create server-side cache instance
const cacheProvider = process.env.CACHE_PROVIDER as 'fs' | 's3' || 'fs';
const provider = cacheProvider === 's3' ? s3CacheProvider : fsCacheProvider;
const serverCache = createCache(provider);

// Constants
const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not set")
}
const COOKIE_NAME = 'auth_token';

export const processApiCall = async (
  req: NextApiRequest,
  res: NextApiResponse
): Promise<CacheResult<unknown>> => {
  const name = req.body.name as keyof typeof apiHandlers;
  const params = req.body.params;
  const options = req.body.options as ApiOptions;

  // Extract and verify JWT token from cookies
  let userId = undefined;
  const cookies = parse(req.headers.cookie || '');
  const token = cookies[COOKIE_NAME];

  if (token) {
    try {
      // Verify and decode the token
      const decoded = jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
      userId = decoded.userId;
    } catch (err) {
      // Invalid token - clear it
      console.warn('Invalid auth token:', err);
      res.setHeader('Set-Cookie', serialize(COOKIE_NAME, '', {
        path: '/',
        expires: new Date(0)
      }));
    }
  }

  // Create context with auth info and cookie helpers
  const context = {
    userId,
    getCookieValue: (name: string) => cookies[name],
    setCookie: (name: string, value: string, options: Record<string, unknown>) => {
      res.setHeader('Set-Cookie', serialize(name, value, options as Record<string, string | number | boolean>));
    },
    clearCookie: (name: string, options: Record<string, unknown>) => {
      res.setHeader('Set-Cookie', serialize(name, '', {
        ...(options as Record<string, string | number | boolean>),
        path: '/',
        expires: new Date(0)
      }));
    }
  };

  const apiHandler = apiHandlers[name];
  if (!apiHandler) {
    throw new Error(`API handler not found for name: ${name}`);
  }

  // Create a wrapped function that handles context internally
  const processWithContext = () => {
    const processFunc = apiHandler.process;

    try {
      // Now all process functions expect two parameters
      return (processFunc as (params: unknown, context: unknown) => Promise<unknown>)(params, context);
    } catch (error) {
      console.error(`Error processing API call ${name}:`, error);
      throw error;
    }
  };

  const result = await serverCache.withCache(
    processWithContext,
    {
      key: name,
      params: { ...params, userId },
    },
    {
      bypassCache: options?.bypassCache || false,
      disableCache: options?.disableCache || false
    }
  );

  return result;
};