import { useMemo } from 'react';
import { TextChunkClient } from '../../../../apis/chapters/types';

export interface ParagraphGroup {
    chunks: TextChunkClient[];
    paragraphIndex?: number;
    isStandalone: boolean; // true for headers and images
}

/**
 * Groups text chunks by paragraphIndex to recreate visual paragraphs
 * while keeping headers and images as standalone elements.
 */
export const useParagraphGrouping = (chunks: TextChunkClient[]): ParagraphGroup[] => {
    return useMemo(() => {
        try {
            const paragraphGroups: ParagraphGroup[] = [];
            let currentGroup: TextChunkClient[] = [];
            let currentParagraphIndex: number | null = null;

            // Validate input
            if (!Array.isArray(chunks)) {
                console.warn('useParagraphGrouping: chunks is not an array, falling back to empty array');
                return [];
            }

            chunks.forEach((chunk, index) => {
                // Validate chunk structure
                if (!chunk || typeof chunk !== 'object') {
                    console.warn(`useParagraphGrouping: Invalid chunk at index ${index}:`, chunk);
                    return;
                }
                if (chunk.type === 'text' && chunk.paragraphIndex !== undefined) {
                    // Text chunk with paragraph index
                    if (chunk.paragraphIndex !== currentParagraphIndex) {
                        // Starting a new paragraph
                        if (currentGroup.length > 0) {
                            paragraphGroups.push({
                                chunks: currentGroup,
                                paragraphIndex: currentParagraphIndex || undefined,
                                isStandalone: false
                            });
                        }
                        currentGroup = [chunk];
                        currentParagraphIndex = chunk.paragraphIndex;
                    } else {
                        // Continue current paragraph
                        currentGroup.push(chunk);
                    }
                } else {
                    // Headers and images are standalone, or text without paragraphIndex (fallback)
                    if (currentGroup.length > 0) {
                        paragraphGroups.push({
                            chunks: currentGroup,
                            paragraphIndex: currentParagraphIndex || undefined,
                            isStandalone: false
                        });
                        currentGroup = [];
                        currentParagraphIndex = null;
                    }

                    // Add standalone element
                    paragraphGroups.push({
                        chunks: [chunk],
                        paragraphIndex: undefined,
                        isStandalone: true
                    });
                }
            });

            // Add final group if any
            if (currentGroup.length > 0) {
                paragraphGroups.push({
                    chunks: currentGroup,
                    paragraphIndex: currentParagraphIndex || undefined,
                    isStandalone: false
                });
            }

            return paragraphGroups;
        } catch (error) {
            console.error('useParagraphGrouping: Error processing chunks:', error);
            // Return a safe fallback - treat each chunk as standalone
            return chunks.map((chunk) => ({
                chunks: [chunk],
                paragraphIndex: undefined,
                isStandalone: true
            }));
        }
    }, [chunks]);
};

/**
 * Helper function to find the flat chunk index for a given paragraph group and chunk within that group
 */
export const useFlatChunkIndex = (paragraphGroups: ParagraphGroup[]) => {
    return useMemo(() => {
        const getFlatChunkIndex = (groupIndex: number, chunkIndexInGroup: number): number => {
            let flatIndex = 0;

            for (let i = 0; i < groupIndex; i++) {
                flatIndex += paragraphGroups[i].chunks.length;
            }

            return flatIndex + chunkIndexInGroup;
        };

        const getGroupAndChunkIndex = (flatIndex: number): { groupIndex: number; chunkIndexInGroup: number } | null => {
            let currentIndex = 0;

            for (let groupIndex = 0; groupIndex < paragraphGroups.length; groupIndex++) {
                const groupSize = paragraphGroups[groupIndex].chunks.length;
                if (flatIndex < currentIndex + groupSize) {
                    return {
                        groupIndex,
                        chunkIndexInGroup: flatIndex - currentIndex
                    };
                }
                currentIndex += groupSize;
            }

            return null;
        };

        return { getFlatChunkIndex, getGroupAndChunkIndex };
    }, [paragraphGroups]);
}; 