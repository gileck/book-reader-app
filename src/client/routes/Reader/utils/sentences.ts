import type { ChapterClient, TextChunkClient, SentenceChunk, SentenceMap, ParagraphGroupMeta } from '../types';

function computeWordOffsets(text: string): number[] {
    const offsets: number[] = [];
    let idx = 0;
    for (const token of text.split(/\s+/)) {
        if (token.length === 0) continue;
        offsets.push(idx);
        idx += token.length + 1; // assume single-space join; sufficient for highlight mapping
    }
    return offsets;
}

export function groupSentencesByParagraph(sentences: SentenceChunk[]): ParagraphGroupMeta[] {
    const groups: ParagraphGroupMeta[] = [];
    let current: ParagraphGroupMeta | null = null;
    sentences.forEach((s, i) => {
        const p = s.paragraphIndex ?? -1;
        if (current && current.paragraphIndex === p) {
            // extend current group
            const last = groups[groups.length - 1] as ParagraphGroupMeta;
            last.endSentenceIndex = i;
        } else {
            // close previous
            if (current) {
                const last = groups[groups.length - 1] as ParagraphGroupMeta;
                last.endSentenceIndex = i - 1;
            }
            current = { paragraphIndex: p, startSentenceIndex: i, endSentenceIndex: i };
            groups.push(current);
        }
    });
    // ensure the last group's end index is set
    if (current && groups.length > 0) {
        const last = groups[groups.length - 1] as ParagraphGroupMeta;
        last.endSentenceIndex = Math.max(last.endSentenceIndex, sentences.length - 1);
    }
    return groups;
}

export function buildSentenceMap(chapter: ChapterClient): SentenceMap {
    const sentences: SentenceChunk[] = [];
    const chunkIndexToSentenceIndex: number[] = [];

    const chunks = chapter.content?.chunks || [];
    chunks.forEach((chunk: TextChunkClient, index: number) => {
        if (chunk.type !== 'text') return;
        const sentence: SentenceChunk = {
            sentenceId: `${chapter.chapterNumber}_${index + 1}`,
            text: chunk.text,
            wordOffsets: computeWordOffsets(chunk.text),
            paragraphIndex: chunk.paragraphIndex ?? null,
            chunkIndex: index,
            links: chunk.links
        };
        chunkIndexToSentenceIndex[index] = sentences.length;
        sentences.push(sentence);
    });

    const paragraphGroups = groupSentencesByParagraph(sentences);
    return { sentences, paragraphGroups, chunkIndexToSentenceIndex };
}


