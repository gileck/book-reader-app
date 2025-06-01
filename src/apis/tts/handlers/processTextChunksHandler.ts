import { processTextChunks } from '../server';
import type { ProcessTextChunksPayload, ProcessTextChunksResponse } from '../types';

export async function process(
    params: ProcessTextChunksPayload
): Promise<ProcessTextChunksResponse> {
    return await processTextChunks(params);
} 