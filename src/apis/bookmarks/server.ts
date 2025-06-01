import { ApiHandlerContext } from '../types';
import {
    createBookmark as createBookmarkDb,
    findBookmarksByUserAndBook,
    findBookmarksByUser,
    updateBookmark as updateBookmarkDb,
    deleteBookmark as deleteBookmarkDb,
    findBookmarkAtPosition,
    deleteBookmarkAtPosition
} from '@/server/database/collections/bookmarks/bookmarks';
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
    ToggleBookmarkResponse,
    BookmarkClient
} from './types';
import { Bookmark } from '@/server/database/collections/bookmarks/types';
import { ObjectId } from 'mongodb';

function convertToClientBookmark(bookmark: Bookmark): BookmarkClient {
    return {
        _id: bookmark._id.toString(),
        userId: bookmark.userId.toString(),
        bookId: bookmark.bookId.toString(),
        chapterNumber: bookmark.chapterNumber,
        chunkIndex: bookmark.chunkIndex,
        customName: bookmark.customName,
        previewText: bookmark.previewText,
        createdAt: bookmark.createdAt.toISOString(),
        updatedAt: bookmark.updatedAt.toISOString()
    };
}

async function createBookmark(
    params: CreateBookmarkPayload,
    context: ApiHandlerContext
): Promise<CreateBookmarkResponse> {
    const userId = context.userId;
    if (!userId) {
        throw new Error('User must be authenticated');
    }

    const bookmark = await createBookmarkDb({
        userId: new ObjectId(userId),
        bookId: new ObjectId(params.bookId),
        chapterNumber: params.chapterNumber,
        chunkIndex: params.chunkIndex,
        customName: params.customName,
        previewText: params.previewText,
        createdAt: new Date(),
        updatedAt: new Date()
    });

    return { bookmark: convertToClientBookmark(bookmark) };
}

async function getBookmarksByBook(
    params: GetBookmarksByBookPayload,
    context: ApiHandlerContext
): Promise<GetBookmarksByBookResponse> {
    const userId = context.userId;
    if (!userId) {
        throw new Error('User must be authenticated');
    }

    const bookmarks = await findBookmarksByUserAndBook(userId, params.bookId);
    return { bookmarks: bookmarks.map(convertToClientBookmark) };
}

async function getUserBookmarks(
    params: GetUserBookmarksPayload,
    context: ApiHandlerContext
): Promise<GetUserBookmarksResponse> {
    const userId = context.userId;
    if (!userId) {
        throw new Error('User must be authenticated');
    }

    const bookmarks = await findBookmarksByUser(userId);
    return { bookmarks: bookmarks.map(convertToClientBookmark) };
}

async function updateBookmark(
    params: UpdateBookmarkPayload & { bookmarkId: string },
    context: ApiHandlerContext
): Promise<UpdateBookmarkResponse> {
    const userId = context.userId;
    if (!userId) {
        throw new Error('User must be authenticated');
    }

    const bookmark = await updateBookmarkDb(params.bookmarkId, {
        customName: params.customName,
        updatedAt: new Date()
    });

    return { bookmark: bookmark ? convertToClientBookmark(bookmark) : null };
}

async function deleteBookmark(
    params: DeleteBookmarkPayload,
    context: ApiHandlerContext
): Promise<DeleteBookmarkResponse> {
    const userId = context.userId;
    if (!userId) {
        throw new Error('User must be authenticated');
    }

    await deleteBookmarkDb(params.bookmarkId);
    return { success: true };
}

async function toggleBookmark(
    params: ToggleBookmarkPayload,
    context: ApiHandlerContext
): Promise<ToggleBookmarkResponse> {
    const userId = context.userId;
    if (!userId) {
        throw new Error('User must be authenticated');
    }

    // Check if bookmark exists at this position
    const existing = await findBookmarkAtPosition(
        userId,
        params.bookId,
        params.chapterNumber,
        params.chunkIndex
    );

    if (existing) {
        // Delete existing bookmark
        await deleteBookmarkAtPosition(
            userId,
            params.bookId,
            params.chapterNumber,
            params.chunkIndex
        );
        return {
            bookmark: null,
            action: 'deleted'
        };
    } else {
        // Create new bookmark
        const bookmark = await createBookmarkDb({
            userId: new ObjectId(userId),
            bookId: new ObjectId(params.bookId),
            chapterNumber: params.chapterNumber,
            chunkIndex: params.chunkIndex,
            customName: params.customName,
            previewText: params.previewText,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        return {
            bookmark: convertToClientBookmark(bookmark),
            action: 'created'
        };
    }
}

export const bookmarksApiHandlers = {
    [API_CREATE_BOOKMARK]: { process: createBookmark },
    [API_GET_BOOKMARKS_BY_BOOK]: { process: getBookmarksByBook },
    [API_GET_USER_BOOKMARKS]: { process: getUserBookmarks },
    [API_UPDATE_BOOKMARK]: { process: updateBookmark },
    [API_DELETE_BOOKMARK]: { process: deleteBookmark },
    [API_TOGGLE_BOOKMARK]: { process: toggleBookmark }
}; 