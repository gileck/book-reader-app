import apiClient from '@/client/utils/apiClient';
import { CacheResult } from '@/common/cache/types';
import {
    API_CREATE_CHAPTER,
    API_GET_CHAPTER,
    API_GET_CHAPTER_BY_BOOK_NUMBER,
    API_GET_CHAPTERS_BY_BOOK,
    API_UPDATE_CHAPTER,
    API_DELETE_CHAPTER
} from './index';
import {
    CreateChapterPayload,
    CreateChapterResponse,
    GetChapterPayload,
    GetChapterResponse,
    GetChapterByBookAndNumberPayload,
    GetChaptersByBookPayload,
    GetChaptersByBookResponse,
    UpdateChapterPayload,
    UpdateChapterResponse,
    DeleteChapterPayload,
    DeleteChapterResponse
} from './types';

export async function createChapter(payload: CreateChapterPayload): Promise<CacheResult<CreateChapterResponse>> {
    return apiClient.call(API_CREATE_CHAPTER, payload);
}

export async function getChapter(payload: GetChapterPayload): Promise<CacheResult<GetChapterResponse>> {
    return apiClient.call(API_GET_CHAPTER, payload);
}

export async function getChapterByNumber(payload: GetChapterByBookAndNumberPayload): Promise<CacheResult<GetChapterResponse>> {
    return apiClient.call(API_GET_CHAPTER_BY_BOOK_NUMBER, payload);
}

export async function getChaptersByBook(payload: GetChaptersByBookPayload): Promise<CacheResult<GetChaptersByBookResponse>> {
    return apiClient.call(API_GET_CHAPTERS_BY_BOOK, payload);
}

export async function updateChapter(payload: UpdateChapterPayload): Promise<CacheResult<UpdateChapterResponse>> {
    return apiClient.call(API_UPDATE_CHAPTER, payload);
}

export async function deleteChapter(payload: DeleteChapterPayload): Promise<CacheResult<DeleteChapterResponse>> {
    return apiClient.call(API_DELETE_CHAPTER, payload);
} 