import apiClient from '@/client/utils/apiClient';
import { CacheResult } from '@/common/cache/types';
import {
    API_CREATE_BOOK,
    API_GET_BOOK,
    API_GET_BOOKS,
    API_UPDATE_BOOK,
    API_SEARCH_BOOKS,
    API_DELETE_BOOK,
    API_UPLOAD_COVER_IMAGE
} from './index';
import {
    CreateBookPayload,
    CreateBookResponse,
    GetBookPayload,
    GetBookResponse,
    GetBooksPayload,
    GetBooksResponse,
    UpdateBookPayload,
    UpdateBookResponse,
    SearchBooksPayload,
    SearchBooksResponse,
    DeleteBookPayload,
    DeleteBookResponse,
    UploadCoverImagePayload,
    UploadCoverImageResponse
} from './types';

export async function createBook(payload: CreateBookPayload): Promise<CacheResult<CreateBookResponse>> {
    return apiClient.call(API_CREATE_BOOK, payload);
}

export async function getBook(payload: GetBookPayload): Promise<CacheResult<GetBookResponse>> {
    return apiClient.call(API_GET_BOOK, payload);
}

export async function getBooks(payload: GetBooksPayload = {}): Promise<CacheResult<GetBooksResponse>> {
    return apiClient.call(API_GET_BOOKS, payload);
}

export async function updateBook(
    bookId: string,
    payload: UpdateBookPayload
): Promise<CacheResult<UpdateBookResponse>> {
    return apiClient.call(API_UPDATE_BOOK, { ...payload, bookId });
}

export async function searchBooks(payload: SearchBooksPayload): Promise<CacheResult<SearchBooksResponse>> {
    return apiClient.call(API_SEARCH_BOOKS, payload);
}

export async function deleteBook(payload: DeleteBookPayload): Promise<CacheResult<DeleteBookResponse>> {
    return apiClient.call(API_DELETE_BOOK, payload);
}

export async function uploadCoverImage(
    bookId: string,
    payload: UploadCoverImagePayload
): Promise<CacheResult<UploadCoverImageResponse>> {
    return apiClient.call(API_UPLOAD_COVER_IMAGE, { ...payload, bookId });
} 