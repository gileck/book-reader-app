import apiClient from '@/client/utils/apiClient';
import { CacheResult } from '@/common/cache/types';
import { API_BOOK_CONTENT_CHAT } from './index';
import { BookContentChatRequest, BookContentChatResponse } from './types';

export async function askBookContentQuestion(payload: BookContentChatRequest): Promise<CacheResult<BookContentChatResponse>> {
    return apiClient.call(API_BOOK_CONTENT_CHAT, payload);
} 