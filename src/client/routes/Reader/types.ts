import type { ChunkLink, ChapterClient, TextChunkClient } from '../../../apis/chapters/types';

export interface SentenceChunk {
    sentenceId: string;
    text: string;
    wordOffsets: number[];
    paragraphIndex: number | null;
    chunkIndex: number;
    links?: ChunkLink[];
}

export interface ParagraphGroupMeta {
    paragraphIndex: number;
    startSentenceIndex: number; // inclusive
    endSentenceIndex: number;   // inclusive
}

export interface SentenceMap {
    sentences: SentenceChunk[];
    paragraphGroups: ParagraphGroupMeta[];
    chunkIndexToSentenceIndex: number[]; // maps TextChunkClient.index -> sentence index
}

export type { ChapterClient, TextChunkClient };


