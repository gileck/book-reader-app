import { ChunkLink, ChapterClient } from '@/apis/chapters/types';
import { BookClient } from '@/apis/books/types';
import { getChapterByNumber } from '@/apis/chapters/client';

interface NavigationTarget {
    chapterNumber: number;
    chunkIndex?: number;
    pageNumber?: number;
    targetText?: string;
    success: boolean;
    reason?: string;
}

export class LinkResolver {
    /**
     * Resolve a link to its target location
     */
    static async resolveLink(
        link: ChunkLink,
        currentBook: BookClient,
        currentChapter: ChapterClient
    ): Promise<NavigationTarget | null> {
        try {
            // Direct chapter and chunk reference (most reliable)
            if (link.chapterNumber !== undefined && link.targetChunk !== undefined) {
                return {
                    chapterNumber: link.chapterNumber,
                    chunkIndex: link.targetChunk,
                    success: true
                };
            }

            // Page reference - try current chapter first
            if (link.targetPageNumber !== undefined) {
                const pageTarget = await this.resolvePageReference(
                    link.targetPageNumber,
                    currentBook,
                    currentChapter
                );
                if (pageTarget) return pageTarget;
            }

            // Chapter reference without specific chunk
            if (link.chapterNumber !== undefined) {
                return {
                    chapterNumber: link.chapterNumber,
                    success: true
                };
            }

            // Text-based reference (fallback)
            if (link.targetText) {
                const textTarget = await this.resolveTextReference(
                    link.targetText,
                    currentBook,
                    currentChapter
                );
                if (textTarget) return textTarget;
            }

            return {
                chapterNumber: currentChapter.chapterNumber,
                success: false,
                reason: 'Unable to resolve link target'
            };

        } catch (error) {
            console.error('Error resolving link:', error);
            return null;
        }
    }

    /**
     * Resolve a page reference to a specific location
     */
    static async resolvePageReference(
        pageNumber: number,
        currentBook: BookClient,
        currentChapter: ChapterClient
    ): Promise<NavigationTarget | null> {
        // First, search in current chapter
        const currentChapterTarget = this.findPageInChapter(pageNumber, currentChapter);
        if (currentChapterTarget) {
            return {
                chapterNumber: currentChapter.chapterNumber,
                chunkIndex: currentChapterTarget.chunkIndex,
                pageNumber: pageNumber,
                success: true
            };
        }

        // If not found in current chapter, search nearby chapters
        const nearbyChapters = this.getNearbyChapterNumbers(
            currentChapter.chapterNumber,
            currentBook.totalChapters
        );

        for (const chapterNumber of nearbyChapters) {
            try {
                const chapterResult = await getChapterByNumber({
                    bookId: currentBook._id,
                    chapterNumber
                });

                if (chapterResult.data.chapter) {
                    const pageTarget = this.findPageInChapter(pageNumber, chapterResult.data.chapter);
                    if (pageTarget) {
                        return {
                            chapterNumber: chapterNumber,
                            chunkIndex: pageTarget.chunkIndex,
                            pageNumber: pageNumber,
                            success: true
                        };
                    }
                }
            } catch (error) {
                console.warn(`Failed to search chapter ${chapterNumber}:`, error);
                continue;
            }
        }

        return null;
    }

    /**
     * Resolve a text-based reference
     */
    static async resolveTextReference(
        targetText: string,
        currentBook: BookClient,
        currentChapter: ChapterClient
    ): Promise<NavigationTarget | null> {
        // First, search in current chapter
        const currentChapterTarget = this.findTextInChapter(targetText, currentChapter);
        if (currentChapterTarget) {
            return {
                chapterNumber: currentChapter.chapterNumber,
                chunkIndex: currentChapterTarget.chunkIndex,
                targetText: targetText,
                success: true
            };
        }

        // Extract chapter numbers from text if possible
        const extractedChapter = this.extractChapterNumber(targetText);
        if (extractedChapter && extractedChapter !== currentChapter.chapterNumber) {
            try {
                const chapterResult = await getChapterByNumber({
                    bookId: currentBook._id,
                    chapterNumber: extractedChapter
                });

                if (chapterResult.data.chapter) {
                    const textTarget = this.findTextInChapter(targetText, chapterResult.data.chapter);
                    if (textTarget) {
                        return {
                            chapterNumber: extractedChapter,
                            chunkIndex: textTarget.chunkIndex,
                            targetText: targetText,
                            success: true
                        };
                    }

                    // Even if specific text not found, navigate to the chapter
                    return {
                        chapterNumber: extractedChapter,
                        targetText: targetText,
                        success: true
                    };
                }
            } catch (error) {
                console.warn(`Failed to load chapter ${extractedChapter}:`, error);
            }
        }

        return null;
    }

    /**
     * Find a page number within a chapter
     */
    private static findPageInChapter(
        pageNumber: number,
        chapter: ChapterClient
    ): { chunkIndex: number } | null {
        const chunkIndex = chapter.content.chunks.findIndex(chunk =>
            chunk.pageNumber === pageNumber
        );

        return chunkIndex !== -1 ? { chunkIndex } : null;
    }

    /**
     * Find text within a chapter
     */
    private static findTextInChapter(
        searchText: string,
        chapter: ChapterClient
    ): { chunkIndex: number } | null {
        const normalizedSearch = searchText.toLowerCase().trim();

        const chunkIndex = chapter.content.chunks.findIndex(chunk =>
            chunk.text && chunk.text.toLowerCase().includes(normalizedSearch)
        );

        return chunkIndex !== -1 ? { chunkIndex } : null;
    }

    /**
     * Extract chapter number from text references
     */
    private static extractChapterNumber(text: string): number | null {
        // Common patterns for chapter references
        const patterns = [
            /chapter\s+(\d+)/i,
            /ch\.?\s*(\d+)/i,
            /section\s+(\d+)/i,
            /part\s+(\d+)/i,
            /^(\d+)\./, // "3. Introduction"
            /see\s+(\d+)/i
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                const chapterNum = parseInt(match[1], 10);
                if (!isNaN(chapterNum) && chapterNum > 0) {
                    return chapterNum;
                }
            }
        }

        return null;
    }

    /**
     * Get nearby chapter numbers for search
     */
    private static getNearbyChapterNumbers(
        currentChapter: number,
        totalChapters: number
    ): number[] {
        const nearby: number[] = [];
        const range = 3; // Search 3 chapters before and after

        // Add previous chapters
        for (let i = Math.max(1, currentChapter - range); i < currentChapter; i++) {
            nearby.push(i);
        }

        // Add following chapters
        for (let i = currentChapter + 1; i <= Math.min(totalChapters, currentChapter + range); i++) {
            nearby.push(i);
        }

        return nearby;
    }

    /**
     * Validate if a chapter number exists in the book
     */
    static isValidChapterNumber(chapterNumber: number, book: BookClient): boolean {
        return chapterNumber >= 1 && chapterNumber <= book.totalChapters;
    }

    /**
     * Create a debug-friendly string for a link
     */
    static getLinkDescription(link: ChunkLink): string {
        const parts = [];

        if (link.chapterNumber !== undefined) {
            parts.push(`Chapter ${link.chapterNumber}`);
        }

        if (link.targetPageNumber !== undefined) {
            parts.push(`Page ${link.targetPageNumber}`);
        }

        if (link.targetChunk !== undefined) {
            parts.push(`Chunk ${link.targetChunk}`);
        }

        if (link.targetText) {
            parts.push(`Text: "${link.targetText}"`);
        }

        return parts.length > 0 ? parts.join(', ') : `Link: "${link.text}"`;
    }
} 