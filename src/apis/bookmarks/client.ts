import apiClient from '@/client/utils/apiClient';
import { CacheResult } from '@/common/cache/types';
import {
    API_CREATE_BOOKMARK,
    API_GET_BOOKMARKS_BY_BOOK,
    API_GET_USER_BOOKMARKS,
    API_UPDATE_BOOKMARK,
    API_DELETE_BOOKMARK,
    API_TOGGLE_BOOKMARK
} from './index';
import type {
    CreateBookmarkPayload,
    CreateBookmarkResponse,
    GetBookmarksByBookPayload,
    GetBookmarksByBookResponse,
    GetUserBookmarksPayload,
    GetUserBookmarksResponse,
    UpdateBookmarkPayload,
    UpdateBookmarkResponse,
    DeleteBookmarkPayload,
    DeleteBookmarkResponse,
    ToggleBookmarkPayload,
    ToggleBookmarkResponse
} from './types';

export async function createBookmark(payload: CreateBookmarkPayload): Promise<CacheResult<CreateBookmarkResponse>> {
    return apiClient.call(API_CREATE_BOOKMARK, payload);
}

export async function getBookmarksByBook(payload: GetBookmarksByBookPayload): Promise<CacheResult<GetBookmarksByBookResponse>> {
    return apiClient.call(API_GET_BOOKMARKS_BY_BOOK, payload);
}

export async function getUserBookmarks(payload: GetUserBookmarksPayload): Promise<CacheResult<GetUserBookmarksResponse>> {
    return apiClient.call(API_GET_USER_BOOKMARKS, payload);
}

export async function updateBookmark(bookmarkId: string, payload: UpdateBookmarkPayload): Promise<CacheResult<UpdateBookmarkResponse>> {
    return apiClient.call(API_UPDATE_BOOKMARK, { bookmarkId, ...payload });
}

export async function deleteBookmark(payload: DeleteBookmarkPayload): Promise<CacheResult<DeleteBookmarkResponse>> {
    return apiClient.call(API_DELETE_BOOKMARK, payload);
}

export async function toggleBookmark(payload: ToggleBookmarkPayload): Promise<CacheResult<ToggleBookmarkResponse>> {
    return apiClient.call(API_TOGGLE_BOOKMARK, payload);
} 