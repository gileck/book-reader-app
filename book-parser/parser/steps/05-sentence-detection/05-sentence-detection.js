/**
 * Step 5: Sentence Detection and Combination
 * 
 * Convert paragraph chunks from step 4 into individual sentences with paragraph indexing.
 * Combine small sentences to meet minimum word count requirements while preserving paragraph boundaries.
 * 
 * Requirements:
 * - Take paragraph chunks from step 4 and split them into sentences
 * - Add paragraphIndex to each sentence (1, 2, 3, etc.)
 * - Combine sentences within paragraph boundaries to meet 50-200 word target
 * - Preserve headers and image chunks as-is
 * - Clean sentence content (remove newlines, normalize whitespace)
 * - Extract links that exist within sentence content
 * - Output: array of chapters, each chapter has array of chunks (sentences, headers, images)
 * - Each sentence chunk has type: 'text', paragraphIndex, and other standard fields
 */

const fs = require('fs');
const path = require('path');

// Import validation functions
const {
    isSourceTextInContent,
    endsWithInitials
} = require('./05-sentence-detection-validation');

// Import shared text processing utilities
const {
    endsWithAbbreviation,
    endsWithSentenceTerminator,
    protectAbbreviations,
    restoreAbbreviations,
    countWords,
    splitIntoSentences // Import shared sentence splitter
} = require('../../utils/text-processing-utils');

/**
 * Execute step 5: Sentence Detection and Combination
 * @param {Object} pipelineState - State from previous steps
 * @returns {Object} - Updated pipeline state with sentence chunks
 */
function execute(pipelineState) {


    if (!pipelineState.chapters || !Array.isArray(pipelineState.chapters)) {
        throw new Error('Step 5 requires chapters array from previous steps');
    }

    const processedChapters = [];
    let totalChunks = 0;
    let totalSentences = 0;
    let totalHeaders = 0;
    let totalImages = 0;
    let totalLinksExtracted = 0;

    for (const chapter of pipelineState.chapters) {
        // Process each chapter to convert paragraphs to sentences
        const sentenceChunks = convertParagraphsToSentences(chapter);

        // Combine small sentences to meet word count requirements
        const optimizedChunks = combineSmallSentences(sentenceChunks);

        // Assign sequential chunk IDs after optimization
        optimizedChunks.forEach((chunk, index) => {
            chunk.chunkId = `${chapter.chapterNumber}_${index + 1}`;
        });

        const processedChapter = {
            ...chapter,
            chunks: optimizedChunks
        };

        processedChapters.push(processedChapter);

        // Count chunk types
        const sentenceCount = optimizedChunks.filter(c => c.type === 'text').length;
        const headerCount = optimizedChunks.filter(c => c.type === 'header').length;
        const imageCount = optimizedChunks.filter(c => c.type === 'image').length;
        const chunkLinksCount = optimizedChunks.reduce((sum, c) => sum + (c.links ? c.links.length : 0), 0);

        totalChunks += optimizedChunks.length;
        totalSentences += sentenceCount;
        totalHeaders += headerCount;
        totalImages += imageCount;
        totalLinksExtracted += chunkLinksCount;
    }

    // Generate detailed statistics
    const stats = generateChunkStats(processedChapters);



    return {
        chapters: processedChapters
    };
}

/**
 * Convert paragraph chunks to sentence chunks with paragraph indexing
 * @param {Object} chapter - Chapter with paragraph chunks from step 4
 * @returns {Array} - Array of sentence chunks with paragraphIndex
 */
function convertParagraphsToSentences(chapter) {
    if (!chapter.chunks || !Array.isArray(chapter.chunks)) {
        return [];
    }

    const sentenceChunks = [];
    let paragraphIndex = 0;

    for (const chunk of chapter.chunks) {
        if (chunk.type === 'paragraph') {
            // Check if this paragraph contains only image markers (standalone images)
            const imageMarkerRegex = /\[\[IMG\s+id=([^\s]+)\s+index=(\d+)\s+alt="([^"]*)"\]\]/g;
            const contentWithoutMarkers = chunk.content.replace(imageMarkerRegex, '').trim();

            if (contentWithoutMarkers.length === 0) {
                // This paragraph contains only image markers - keep it as-is for Step 5-1 to process
                // Convert it to a text chunk so Step 5-1 can find and extract the markers
                sentenceChunks.push({
                    ...chunk,
                    type: 'text', // Change from 'paragraph' to 'text' so Step 5-1 will process it
                    paragraphIndex: null, // Standalone images don't belong to paragraphs
                    wordCount: 0, // Will be ignored since Step 5-1 will replace with image chunks
                    sentenceCount: 0 // Will be ignored since Step 5-1 will replace with image chunks
                });
            } else {
                // Normal paragraph with text content - increment paragraph index and process
                paragraphIndex++;

                // Split paragraph into sentences and add paragraphIndex
                const sentences = createSentenceChunks(chunk.content, chunk.links || [], paragraphIndex);
                sentenceChunks.push(...sentences);
            }

        } else if (chunk.type === 'header' || chunk.type === 'image') {
            // Keep headers and images as-is (they don't belong to paragraphs)
            sentenceChunks.push({
                ...chunk,
                paragraphIndex: null // Headers and images don't belong to paragraphs
            });
        }
    }

    return sentenceChunks;
}

/**
 * Create sentence chunks from paragraph content
 * @param {string} paragraphContent - Full paragraph content
 * @param {Array} paragraphLinks - Links belonging to the paragraph
 * @param {number} paragraphIndex - Index of the paragraph
 * @returns {Array} - Array of sentence chunks
 */
function createSentenceChunks(paragraphContent, paragraphLinks, paragraphIndex) {
    const sentences = splitIntoSentences(paragraphContent);
    const chunks = [];
    const paragraphScopedLinks = extractLinksFromContent(paragraphContent, paragraphLinks);

    for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i].trim();
        if (!sentence) continue;

        // Clean sentence content by removing newlines and normalizing whitespace
        // BUT preserve newlines that come after sentence ending characters
        const cleanSentence = cleanSentenceContent(sentence);

        // Find links that belong to this specific sentence
        const sentenceLinks = paragraphScopedLinks.filter(link =>
            isSourceTextInContent(link.text, cleanSentence)
        );

        chunks.push({
            // Using array index only - no chunkId needed
            type: 'text',
            content: cleanSentence,
            paragraphIndex: paragraphIndex,
            wordCount: getWordCount(cleanSentence),
            sentenceCount: 1, // Each chunk starts as exactly one sentence
            links: sentenceLinks
        });
    }

    return chunks;
}

/**
 * Combine small sentence chunks to meet minimum word count requirements
 * @param {Array} chunks - Array of chunks (sentences, headers, images)
 * @returns {Array} - Optimized chunks with combined sentences
 */
function combineSmallSentences(chunks) {
    const optimized = [];
    const MAX_WORDS = 200;
    const MIN_WORDS = 12; // Merge sentences shorter than 12 words with previous sentence in same paragraph

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];

        // Never combine headers or images
        if (chunk.type === 'header' || chunk.type === 'image') {
            optimized.push(chunk);
            continue;
        }

        if (chunk.type === 'text') {
            // Merge sentences shorter than MIN_WORDS with the previous sentence in the same paragraph
            if (chunk.wordCount < MIN_WORDS && optimized.length > 0) {
                const previous = optimized[optimized.length - 1];
                if (previous.type === 'text' && previous.paragraphIndex === chunk.paragraphIndex) {
                    const combinedWordCount = previous.wordCount + chunk.wordCount;
                    if (combinedWordCount <= MAX_WORDS) {
                        const mergedContent = previous.content + ' ' + chunk.content;
                        const mergedLinks = removeDuplicateLinks([...(previous.links || []), ...(chunk.links || [])]);
                        optimized[optimized.length - 1] = {
                            type: 'text',
                            content: mergedContent,
                            paragraphIndex: previous.paragraphIndex,
                            wordCount: combinedWordCount,
                            sentenceCount: (previous.sentenceCount || 1) + (chunk.sentenceCount || 1),
                            links: mergedLinks
                        };
                        continue;
                    }
                }
            }

            // Default: keep sentence as-is
            optimized.push(chunk);
            continue;
        }

        // Fallback for any other chunk types
        optimized.push(chunk);
    }

    return optimized;
}

/**
 * Try to merge current sentence with following sentence chunks from the same paragraph
 * @param {Array} chunks - All chunks
 * @param {number} currentIndex - Current chunk index
 * @param {number} minWords - Minimum word count target
 * @param {number} maxWords - Maximum word count limit
 * @returns {Object|null} - Merged chunk info or null if no merge possible
 */
function tryMergeWithNextSentences(chunks, currentIndex, minWords, maxWords) {
    const currentChunk = chunks[currentIndex];
    let combinedContent = currentChunk.content;
    let combinedWordCount = currentChunk.wordCount;
    let combinedSentenceCount = currentChunk.sentenceCount;
    let combinedLinks = [...(currentChunk.links || [])];
    let lastMergedIndex = currentIndex;

    // Look for next text chunks from the same paragraph to merge
    for (let i = currentIndex + 1; i < chunks.length; i++) {
        const nextChunk = chunks[i];

        // Skip headers and images
        if (nextChunk.type === 'header' || nextChunk.type === 'image') {
            continue;
        }

        // Only merge with text chunks from the same paragraph
        if (nextChunk.type === 'text' && nextChunk.paragraphIndex === currentChunk.paragraphIndex) {
            const newWordCount = combinedWordCount + nextChunk.wordCount;

            // Don't merge if it would exceed max words, unless current chunk is very small (< 20 words)
            // Allow small orphan chunks to exceed the limit to prevent validation failures
            const isVerySmallChunk = currentChunk.wordCount < 20;
            if (newWordCount > maxWords && !isVerySmallChunk) {
                break;
            }

            // Page semantics removed: no page-gap constraint

            // Merge this chunk
            combinedContent += ' ' + nextChunk.content;
            combinedWordCount = newWordCount;
            combinedSentenceCount += nextChunk.sentenceCount;
            combinedLinks.push(...(nextChunk.links || []));
            lastMergedIndex = i;

            // Stop if we've reached the minimum word count
            if (combinedWordCount >= minWords) {
                break;
            }
        } else {
            // Hit a different paragraph or non-text chunk, stop merging
            break;
        }
    }

    // Return merged chunk if we actually merged with something, regardless of whether it meets minimum
    // (validation will catch chunks that still don't meet minimum after all possible merges)
    if (lastMergedIndex > currentIndex) {
        // Re-validate links against merged content
        const validLinks = combinedLinks.filter(link =>
            isSourceTextInContent(link.text, combinedContent)
        );

        return {
            merged: {
                // Using array index only - no chunkId needed
                type: 'text',
                content: combinedContent,

                paragraphIndex: currentChunk.paragraphIndex,
                wordCount: combinedWordCount,
                sentenceCount: combinedSentenceCount,
                links: removeDuplicateLinks(validLinks)
            },
            nextIndex: lastMergedIndex
        };
    }

    return null;
}

/**
 * Try to merge current small sentence with previous text chunk from the same paragraph
 * @param {Array} optimizedChunks - Already processed chunks
 * @param {Object} currentChunk - Current small chunk to merge
 * @param {number} minWords - Minimum word count target
 * @param {number} maxWords - Maximum word count limit
 * @returns {Object|null} - Merged chunk or null if no merge possible
 */
function tryMergeWithPreviousSentence(optimizedChunks, currentChunk, minWords, maxWords) {
    // Look backwards for the last text chunk from the same paragraph
    for (let i = optimizedChunks.length - 1; i >= 0; i--) {
        const previousChunk = optimizedChunks[i];

        // Skip headers and images
        if (previousChunk.type === 'header' || previousChunk.type === 'image') {
            continue;
        }

        if (previousChunk.type === 'text' && previousChunk.paragraphIndex === currentChunk.paragraphIndex) {
            const combinedWordCount = previousChunk.wordCount + currentChunk.wordCount;

            // Don't merge if it would exceed max words, unless current chunk is very small (< 20 words)
            // Allow small orphan chunks to exceed the limit to prevent validation failures
            const isVerySmallChunk = currentChunk.wordCount < 20;
            if (combinedWordCount > maxWords && !isVerySmallChunk) {
                break;
            }

            // Page semantics removed: no page-gap constraint

            const mergedContent = previousChunk.content + ' ' + currentChunk.content;
            const allPotentialLinks = [...(previousChunk.links || []), ...(currentChunk.links || [])];
            const validLinks = allPotentialLinks.filter(link =>
                isSourceTextInContent(link.text, mergedContent)
            );

            return {
                // Using array index only - no chunkId needed
                type: 'text',
                content: mergedContent,

                paragraphIndex: previousChunk.paragraphIndex,
                wordCount: combinedWordCount,
                sentenceCount: previousChunk.sentenceCount + currentChunk.sentenceCount,
                links: removeDuplicateLinks(validLinks)
            };
        }

        break; // Only check the most recent text chunk from same paragraph
    }

    return null;
}

/**
 * Fix paragraph index sequence after aggressive merging to ensure sequential numbering
 * @param {Array} chunks - Optimized chunks that may have paragraph index gaps
 * @returns {Array} - Chunks with fixed sequential paragraph indexes
 */
function fixParagraphIndexSequence(chunks) {
    const fixed = [];
    let currentParagraphIndex = 1;
    let lastSeenParagraphIndex = 0;

    for (const chunk of chunks) {
        if (chunk.type === 'text') {
            // If this chunk has a different paragraph index than what we've seen
            if (chunk.paragraphIndex !== lastSeenParagraphIndex) {
                lastSeenParagraphIndex = chunk.paragraphIndex;
                // Assign the next sequential index
                chunk.paragraphIndex = currentParagraphIndex;
                currentParagraphIndex++;
            } else {
                // Same paragraph as previous chunk, keep the same index
                chunk.paragraphIndex = currentParagraphIndex - 1;
            }
        }
        fixed.push(chunk);
    }

    return fixed;
}

/**
 * AGGRESSIVE: Try to merge small chunks across paragraph boundaries when necessary
 * This is used as a last resort to meet the strict 50-word minimum
 * @param {Array} chunks - All remaining chunks to process
 * @param {number} currentIndex - Index of current small chunk
 * @param {Array} optimized - Already processed chunks
 * @param {number} minWords - Minimum word count target
 * @param {number} maxWords - Maximum word count limit
 * @returns {Object|null} - Merge result or null if no merge possible
 */
function tryAggressiveMergeAcrossParagraphs(chunks, currentIndex, optimized, minWords, maxWords) {
    const currentChunk = chunks[currentIndex];

    // First try merging with the previous optimized chunk (regardless of paragraph)
    if (optimized.length > 0) {
        const lastOptimized = optimized[optimized.length - 1];
        if (lastOptimized.type === 'text') {
            const combinedWordCount = lastOptimized.wordCount + currentChunk.wordCount;

            if (combinedWordCount <= maxWords) {
                // FINAL ULTRA-AGGRESSIVE: No page gap limits for very short chunks
                const currentIsVeryShort = currentChunk.wordCount < 25; // Extra aggressive for very short
                // Page semantics removed: always allow if within max words
                return {
                    mergeWithPrevious: true,
                    merged: {
                        type: 'text',
                        content: lastOptimized.content + ' ' + currentChunk.content,

                        paragraphIndex: lastOptimized.paragraphIndex, // Keep the first paragraph's index
                        wordCount: combinedWordCount,
                        sentenceCount: lastOptimized.sentenceCount + currentChunk.sentenceCount,
                        links: removeDuplicateLinks([...(lastOptimized.links || []), ...(currentChunk.links || [])])
                    }
                };
            }
        }
    }

    // Try merging with next text chunks (regardless of paragraph)
    let combinedContent = currentChunk.content;
    let combinedWordCount = currentChunk.wordCount;
    let combinedSentenceCount = currentChunk.sentenceCount;
    let combinedLinks = [...(currentChunk.links || [])];
    let lastMergedIndex = currentIndex;

    for (let i = currentIndex + 1; i < chunks.length; i++) {
        const nextChunk = chunks[i];

        // Skip headers and images
        if (nextChunk.type === 'header' || nextChunk.type === 'image') {
            continue;
        }

        if (nextChunk.type === 'text') {
            const newWordCount = combinedWordCount + nextChunk.wordCount;

            // Don't exceed max words (but allow higher limit for very short chunks)
            const currentIsVeryShort = currentChunk.wordCount < 25;
            const maxLimit = currentIsVeryShort ? 250 : maxWords; // Higher limit for very short chunks
            if (newWordCount > maxLimit) {
                break;
            }

            // FINAL ULTRA-AGGRESSIVE: Relax page gap limit only for very short chunks
            // Page semantics removed: no page-gap constraint

            // Merge this chunk
            combinedContent += ' ' + nextChunk.content;
            combinedWordCount = newWordCount;
            combinedSentenceCount += nextChunk.sentenceCount;
            combinedLinks.push(...(nextChunk.links || []));
            lastMergedIndex = i;

            // Stop if we've reached the minimum word count
            if (combinedWordCount >= minWords) {
                break;
            }
        } else {
            // Hit a non-text chunk, stop merging
            break;
        }
    }

    // Return merged chunk if we actually merged with something
    if (lastMergedIndex > currentIndex) {
        const validLinks = combinedLinks.filter(link =>
            isSourceTextInContent(link.text, combinedContent)
        );

        return {
            mergeWithPrevious: false,
            merged: {
                type: 'text',
                content: combinedContent,

                paragraphIndex: currentChunk.paragraphIndex, // Keep the first paragraph's index
                wordCount: combinedWordCount,
                sentenceCount: combinedSentenceCount,
                links: removeDuplicateLinks(validLinks)
            },
            nextIndex: lastMergedIndex
        };
    }

    return null;
}

// Note: endsWithAbbreviation function now imported from shared utilities

/**
 * Clean sentence content while preserving newlines after sentence ending characters
 * @param {string} sentence - Raw sentence content
 * @returns {string} - Cleaned sentence content
 */
function cleanSentenceContent(sentence) {
    // Define sentence ending characters
    const sentenceEnders = /[.!?]/;

    // Split the text by newlines to process each line
    const lines = sentence.split('\n');
    const processedLines = [];

    for (let i = 0; i < lines.length; i++) {
        const currentLine = lines[i].trim();

        // Always add the current line (trimmed)
        if (currentLine) {
            processedLines.push(currentLine);
        }

        // Check if we should preserve the newline after this line
        // Preserve newline if the line ends with a sentence ending character
        // BUT NOT if it ends with an abbreviation
        if (i < lines.length - 1 && currentLine && sentenceEnders.test(currentLine.slice(-1)) && !endsWithAbbreviation(currentLine)) {
            // Keep the newline by adding an empty string marker that we'll convert back to newline
            processedLines.push('__PRESERVE_NEWLINE__');
        }
    }

    // Join lines with spaces, but preserve marked newlines
    let result = processedLines.join(' ');

    // Convert preserved newline markers back to actual newlines
    result = result.replace(/ __PRESERVE_NEWLINE__ /g, '\n');
    result = result.replace(/__PRESERVE_NEWLINE__/g, '\n');

    // Normalize whitespace (but preserve the newlines we want to keep)
    result = result.replace(/[ \t]+/g, ' ');  // Normalize spaces and tabs
    result = result.replace(/\n[ \t]+/g, '\n');  // Remove spaces after newlines
    result = result.replace(/[ \t]+\n/g, '\n');  // Remove spaces before newlines
    result = result.replace(/\n{3,}/g, '\n\n');  // Collapse multiple newlines to max 2

    return result.trim();
}

/**
 * Extract links that appear in the given content
 * @param {string} content - Content to search in
 * @param {Array} allLinks - All available links
 * @returns {Array} - Links found in content
 */
function extractLinksFromContent(content, allLinks) {
    if (!allLinks || allLinks.length === 0) return [];

    return allLinks.filter(link =>
        isSourceTextInContent(link.text, content)
    );
}

/**
 * Get word count for text
 * @param {string} text - Text to count
 * @returns {number} - Word count
 */
function getWordCount(text) {
    return countWords(text);
}

/**
 * Remove duplicate links based on text and url
 * @param {Array} links - Array of link objects
 * @returns {Array} - Deduplicated links
 */
function removeDuplicateLinks(links) {
    const seen = new Set();
    return links.filter(link => {
        const key = `${link.text}|${link.url}`;
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}

/**
 * Generate detailed statistics for chunks
 * @param {Array} chapters - Processed chapters
 * @returns {Object} - Statistics object
 */
function generateChunkStats(chapters) {
    let totalChunks = 0;
    let totalSentences = 0;
    let totalHeaders = 0;
    let totalImages = 0;
    let totalWords = 0;
    let totalLinks = 0;

    const sentenceWordCounts = [];
    const headerWordCounts = [];
    const paragraphIndexes = new Set();

    for (const chapter of chapters) {
        for (const chunk of chapter.chunks) {
            totalChunks++;
            totalWords += chunk.wordCount || 0;
            totalLinks += chunk.links ? chunk.links.length : 0;

            if (chunk.type === 'text') {
                totalSentences++;
                sentenceWordCounts.push(chunk.wordCount);
                if (chunk.paragraphIndex) {
                    paragraphIndexes.add(chunk.paragraphIndex);
                }
            } else if (chunk.type === 'header') {
                totalHeaders++;
                headerWordCounts.push(chunk.wordCount);
            } else if (chunk.type === 'image') {
                totalImages++;
            }
        }
    }

    return {
        totalChunks,
        totalSentences,
        totalHeaders,
        totalImages,
        totalWords,
        totalLinks,
        totalParagraphs: paragraphIndexes.size,
        sentenceStats: {
            count: totalSentences,
            wordCounts: sentenceWordCounts,
            averageWords: sentenceWordCounts.length > 0 ? sentenceWordCounts.reduce((a, b) => a + b, 0) / sentenceWordCounts.length : 0,
            minWords: sentenceWordCounts.length > 0 ? Math.min(...sentenceWordCounts) : 0,
            maxWords: sentenceWordCounts.length > 0 ? Math.max(...sentenceWordCounts) : 0
        },
        headerStats: {
            count: totalHeaders,
            wordCounts: headerWordCounts,
            averageWords: headerWordCounts.length > 0 ? headerWordCounts.reduce((a, b) => a + b, 0) / headerWordCounts.length : 0
        }
    };
}

// Import validation function
const { validate } = require('./05-sentence-detection-validation');

module.exports = {
    execute,
    validate
}; 