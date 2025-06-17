import { ApiHandlers, ApiHandlerContext } from "./types";
import * as chat from "./chat/server";
import * as clearCache from "./settings/clearCache/server";
import * as auth from "./auth/server";
import { booksApiHandlers } from "./books/server";
import { chaptersApiHandlers } from "./chapters/server";
import { ttsApiHandlers } from "./tts/server";
import { bookmarksApiHandlers } from "./bookmarks/server";
import { readingProgressApis } from "./readingProgress/server";
import { readingLogsApis } from "./readingLogs/server";
import * as userSettings from "./userSettings/server";
import { API_GET_USER_SETTINGS, API_UPDATE_USER_SETTINGS } from "./userSettings/index";
import * as bookContentChat from "./bookContentChat/server";
import { API_BOOK_CONTENT_CHAT, API_BOOK_CONTENT_CHAT_ESTIMATE_COST } from "./bookContentChat/index";
import { ttsUsageApiHandlers } from './ttsUsage/server';

// Convert API handlers to typed format
const typedBooksApiHandlers = Object.entries(booksApiHandlers).reduce(
  (acc, [key, handler]) => {
    acc[key] = {
      process: handler.process as (params: unknown, context: ApiHandlerContext) => Promise<unknown>,
    };
    return acc;
  },
  {} as ApiHandlers
);

const typedChaptersApiHandlers = Object.entries(chaptersApiHandlers).reduce(
  (acc, [key, handler]) => {
    acc[key] = {
      process: handler.process as (params: unknown, context: ApiHandlerContext) => Promise<unknown>,
    };
    return acc;
  },
  {} as ApiHandlers
);

const typedTtsApiHandlers = Object.entries(ttsApiHandlers).reduce(
  (acc, [key, handler]) => {
    acc[key] = {
      process: handler.process as (params: unknown, context: ApiHandlerContext) => Promise<unknown>,
    };
    return acc;
  },
  {} as ApiHandlers
);

const typedBookmarksApiHandlers = Object.entries(bookmarksApiHandlers).reduce(
  (acc, [key, handler]) => {
    acc[key] = {
      process: handler.process as (params: unknown, context: ApiHandlerContext) => Promise<unknown>,
    };
    return acc;
  },
  {} as ApiHandlers
);

const typedReadingProgressApiHandlers = Object.entries(readingProgressApis).reduce(
  (acc, [key, handler]) => {
    acc[key] = {
      process: handler as (params: unknown, context: ApiHandlerContext) => Promise<unknown>,
    };
    return acc;
  },
  {} as ApiHandlers
);

const typedReadingLogsApiHandlers = Object.entries(readingLogsApis).reduce(
  (acc, [key, handler]) => {
    acc[key] = {
      process: handler as (params: unknown, context: ApiHandlerContext) => Promise<unknown>,
    };
    return acc;
  },
  {} as ApiHandlers
);

const typedTtsUsageApiHandlers = Object.entries(ttsUsageApiHandlers).reduce(
  (acc, [key, handler]) => {
    acc[key] = {
      process: handler.process as (params: unknown, context: ApiHandlerContext) => Promise<unknown>,
    };
    return acc;
  },
  {} as ApiHandlers
);

export const apiHandlers: ApiHandlers = {
  [chat.name]: { process: chat.process as (params: unknown, context: ApiHandlerContext) => Promise<unknown> },
  [clearCache.name]: { process: clearCache.process as (params: unknown, context: ApiHandlerContext) => Promise<unknown> },
  [auth.login]: { process: auth.loginUser as (params: unknown, context: ApiHandlerContext) => Promise<unknown> },
  [auth.register]: { process: auth.registerUser as (params: unknown, context: ApiHandlerContext) => Promise<unknown> },
  [auth.me]: { process: auth.getCurrentUser as (params: unknown, context: ApiHandlerContext) => Promise<unknown> },
  [auth.logout]: { process: auth.logoutUser as (params: unknown, context: ApiHandlerContext) => Promise<unknown> },
  [auth.updateProfile]: { process: auth.updateUserProfile as (params: unknown, context: ApiHandlerContext) => Promise<unknown> },
  [API_GET_USER_SETTINGS]: { process: userSettings.getUserSettings as (params: unknown, context: ApiHandlerContext) => Promise<unknown> },
  [API_UPDATE_USER_SETTINGS]: { process: userSettings.updateUserSettings as (params: unknown, context: ApiHandlerContext) => Promise<unknown> },
  [API_BOOK_CONTENT_CHAT]: { process: bookContentChat.process as (params: unknown, context: ApiHandlerContext) => Promise<unknown> },
  [API_BOOK_CONTENT_CHAT_ESTIMATE_COST]: { process: bookContentChat.estimateCost as (params: unknown, context: ApiHandlerContext) => Promise<unknown> },
  ...typedBooksApiHandlers,
  ...typedChaptersApiHandlers,
  ...typedTtsApiHandlers,
  ...typedBookmarksApiHandlers,
  ...typedReadingProgressApiHandlers,
  ...typedReadingLogsApiHandlers,
  ...typedTtsUsageApiHandlers,
};


