import type { ChapterClient } from '@/apis/chapters/types';
import type { SearchResultItem } from '@/apis/search/types';

/**
 * Search current chapter for a query (client-side)
 * Returns all chunks that contain the query string
 */
export function searchChapter(
    chapter: ChapterClient,
    query: string
): SearchResultItem[] {
    if (!query.trim()) return [];
    
    const lowerQuery = query.toLowerCase();
    const results: SearchResultItem[] = [];
    
    for (const chunk of chapter.content.chunks) {
        if ((chunk.type === 'text' || chunk.type === 'header') && 
            chunk.text.toLowerCase().includes(lowerQuery)) {
            results.push({
                chunkIndex: chunk.index,
                text: chunk.text,
                type: chunk.type,
                chapterNumber: chapter.chapterNumber,
                chapterTitle: chapter.title
            });
        }
    }
    
    return results;
}

/**
 * Extract a snippet of text around the query match
 * Shows context before and after the match
 */
export function extractSnippet(
    text: string,
    query: string,
    contextLength: number = 100
): string {
    if (!query.trim()) return text.slice(0, contextLength * 2) + '...';
    
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const matchIndex = lowerText.indexOf(lowerQuery);
    
    if (matchIndex === -1) {
        // No match found, return start of text
        return text.slice(0, contextLength * 2) + '...';
    }
    
    // Calculate start and end positions
    const start = Math.max(0, matchIndex - contextLength);
    const end = Math.min(text.length, matchIndex + query.length + contextLength);
    
    // Add ellipsis if needed
    const prefix = start > 0 ? '...' : '';
    const suffix = end < text.length ? '...' : '';
    
    return prefix + text.slice(start, end) + suffix;
}

/**
 * Split text into parts, highlighting the query matches
 * Returns an array of {text, isMatch} objects
 */
export function highlightMatches(
    text: string,
    query: string
): Array<{ text: string; isMatch: boolean }> {
    if (!query.trim()) {
        return [{ text, isMatch: false }];
    }
    
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const parts: Array<{ text: string; isMatch: boolean }> = [];
    
    let lastIndex = 0;
    let matchIndex = lowerText.indexOf(lowerQuery, lastIndex);
    
    while (matchIndex !== -1) {
        // Add text before match
        if (matchIndex > lastIndex) {
            parts.push({
                text: text.slice(lastIndex, matchIndex),
                isMatch: false
            });
        }
        
        // Add matched text
        parts.push({
            text: text.slice(matchIndex, matchIndex + query.length),
            isMatch: true
        });
        
        lastIndex = matchIndex + query.length;
        matchIndex = lowerText.indexOf(lowerQuery, lastIndex);
    }
    
    // Add remaining text
    if (lastIndex < text.length) {
        parts.push({
            text: text.slice(lastIndex),
            isMatch: false
        });
    }
    
    return parts;
}

