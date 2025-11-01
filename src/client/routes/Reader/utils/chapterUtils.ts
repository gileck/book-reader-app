import { ChapterClient } from '../../../../apis/chapters/types';

/**
 * Extracts all text content from a chapter, excluding images
 * Used for generating chapter overviews
 */
export function extractChapterTextContent(chapter: ChapterClient): string {
    const textChunks = chapter.content.chunks
        .filter(chunk => chunk.type === 'text' || chunk.type === 'header')
        .map(chunk => chunk.text.trim())
        .filter(text => text.length > 0);

    return textChunks.join('\n\n');
}

