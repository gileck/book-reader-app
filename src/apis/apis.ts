import { ApiHandlers, ApiHandlerContext } from "./types";
import * as chat from "./chat/server";
import * as clearCache from "./settings/clearCache/server";
import * as auth from "./auth/server";

export const apiHandlers: ApiHandlers = {
  [chat.name]: { process: chat.process as (params: unknown, context: ApiHandlerContext) => Promise<unknown> },
  [clearCache.name]: { process: clearCache.process as (params: unknown, context: ApiHandlerContext) => Promise<unknown> },
  [auth.login]: { process: auth.loginUser as (params: unknown, context: ApiHandlerContext) => Promise<unknown> },
  [auth.register]: { process: auth.registerUser as (params: unknown, context: ApiHandlerContext) => Promise<unknown> },
  [auth.me]: { process: auth.getCurrentUser as (params: unknown, context: ApiHandlerContext) => Promise<unknown> },
  [auth.logout]: { process: auth.logoutUser as (params: unknown, context: ApiHandlerContext) => Promise<unknown> },
  [auth.updateProfile]: { process: auth.updateUserProfile as (params: unknown, context: ApiHandlerContext) => Promise<unknown> },
};


