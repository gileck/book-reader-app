import apiClient from '@/client/utils/apiClient';
import { CacheResult } from '@/common/cache/types';
import { API_BOOK_CONTENT_CHAT, API_BOOK_CONTENT_CHAT_ESTIMATE_COST } from './index';
import { BookContentChatRequest, BookContentChatResponse, BookContentChatCostEstimateRequest, BookContentChatCostEstimateResponse } from './types';

export async function askBookContentQuestion(payload: BookContentChatRequest): Promise<CacheResult<BookContentChatResponse>> {
    return apiClient.call(API_BOOK_CONTENT_CHAT, payload);
}

export async function estimateBookContentQuestionCost(payload: BookContentChatCostEstimateRequest): Promise<CacheResult<BookContentChatCostEstimateResponse>> {
    return apiClient.call(API_BOOK_CONTENT_CHAT_ESTIMATE_COST, payload);
} 