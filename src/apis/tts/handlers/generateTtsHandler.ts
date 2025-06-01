import { generateTts } from '../server';
import type { GenerateTtsPayload, GenerateTtsResponse } from '../types';

export async function process(
    params: GenerateTtsPayload
): Promise<GenerateTtsResponse> {
    return await generateTts(params);
} 