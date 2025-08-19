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
    countWords,
    endsWithInitials
} = require('./05-sentence-detection-validation');

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
            // Increment paragraph index for each paragraph
            paragraphIndex++;

            // Split paragraph into sentences and add paragraphIndex
            const sentences = createSentenceChunks(chunk.content, chunk.links || [], paragraphIndex);
            sentenceChunks.push(...sentences);

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
        // BUT preserve newlines that are part of numbered list formatting
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
    const MIN_WORDS = 25;  // Reduced from 50 to 25 for better practical results
    const MAX_WORDS = 200;

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];

        // Headers and images are never combined
        if (chunk.type === 'header' || chunk.type === 'image') {
            optimized.push(chunk);
            continue;
        }

        // For text chunks, aggressively combine if they're below target
        if (chunk.type === 'text' && chunk.wordCount < MIN_WORDS) {
            // PHASE 1: Try same-paragraph combinations
            const combinedChunk = tryMergeWithNextSentences(chunks, i, MIN_WORDS, MAX_WORDS);
            if (combinedChunk) {
                let merged = combinedChunk.merged;
                let lastIndex = combinedChunk.nextIndex;

                // If still below MIN_WORDS, extend forward across paragraphs conservatively
                if (merged.wordCount < MIN_WORDS) {
                    const forwardAggressive = (base, startIdx) => {
                        let combinedContent = base.content;
                        let combinedWordCount = base.wordCount;
                        let combinedSentenceCount = base.sentenceCount;
                        let combinedLinks = [...(base.links || [])];
                        let cursor = startIdx + 1;

                        for (let j = cursor; j < chunks.length; j++) {
                            const nextChunk = chunks[j];
                            if (nextChunk.type === 'header' || nextChunk.type === 'image') break;
                            if (nextChunk.type !== 'text') break;
                            const newWordCount = combinedWordCount + nextChunk.wordCount;
                            if (newWordCount > MAX_WORDS) break;
                            // Page semantics removed: no page-gap constraint
                            combinedContent += ' ' + nextChunk.content;
                            combinedWordCount = newWordCount;
                            combinedSentenceCount += nextChunk.sentenceCount || 1;
                            combinedLinks.push(...(nextChunk.links || []));
                            lastIndex = j;
                            if (combinedWordCount >= MIN_WORDS) break;
                        }

                        const validLinks = removeDuplicateLinks(combinedLinks);
                        return {
                            merged: {
                                type: 'text',
                                content: combinedContent,

                                paragraphIndex: base.paragraphIndex,
                                wordCount: combinedWordCount,
                                sentenceCount: combinedSentenceCount,
                                links: validLinks
                            },
                            lastIndex
                        };
                    };

                    const extended = forwardAggressive(merged, lastIndex);
                    merged = extended.merged;
                    lastIndex = extended.lastIndex;

                    // If still short, try merging with previous optimized text chunk
                    if (merged.wordCount < MIN_WORDS) {
                        // Merge with previous optimized text chunk if possible
                        if (optimized.length > 0) {
                            const lastOptimized = optimized[optimized.length - 1];
                            if (lastOptimized.type === 'text') {
                                const combinedWordCount = lastOptimized.wordCount + merged.wordCount;
                                if (combinedWordCount <= MAX_WORDS) {
                                    const newContent = lastOptimized.content + ' ' + merged.content;
                                    const newLinks = removeDuplicateLinks([...(lastOptimized.links || []), ...(merged.links || [])]);
                                    optimized[optimized.length - 1] = {
                                        type: 'text',
                                        content: newContent,

                                        paragraphIndex: lastOptimized.paragraphIndex,
                                        wordCount: combinedWordCount,
                                        sentenceCount: lastOptimized.sentenceCount + merged.sentenceCount,
                                        links: newLinks
                                    };
                                    i = lastIndex;
                                    continue;
                                }
                            }
                        }
                    }
                }

                optimized.push(merged);
                i = lastIndex; // Skip to after the merged chunks
            } else {
                const mergedWithPrevious = tryMergeWithPreviousSentence(optimized, chunk, MIN_WORDS, MAX_WORDS);
                if (mergedWithPrevious) {
                    optimized[optimized.length - 1] = mergedWithPrevious;
                } else {
                    // PHASE 2: AGGRESSIVE - Try cross-paragraph combinations
                    const aggressiveMerge = tryAggressiveMergeAcrossParagraphs(chunks, i, optimized, MIN_WORDS, MAX_WORDS);
                    if (aggressiveMerge) {
                        if (aggressiveMerge.mergeWithPrevious) {
                            optimized[optimized.length - 1] = aggressiveMerge.merged;
                        } else {
                            optimized.push(aggressiveMerge.merged);
                            i = aggressiveMerge.nextIndex;
                        }
                    } else {
                        // Last resort: keep as is (will fail validation)
                        optimized.push(chunk);
                    }
                }
            }
        } else {
            optimized.push(chunk);
        }
    }

    // POST-PROCESSING: Fix paragraph index gaps created by aggressive merging
    return fixParagraphIndexSequence(optimized);
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

            // Don't merge if it would exceed max words
            if (newWordCount > maxWords) {
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

            // Don't merge if it would exceed max words
            if (combinedWordCount > maxWords) {
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

/**
 * Clean sentence content while preserving important formatting
 * @param {string} sentence - Raw sentence content
 * @returns {string} - Cleaned sentence content
 */
function cleanSentenceContent(sentence) {
    // Detect if this contains a numbered list by looking for multiple numbered items
    const numberedItemPattern = /\d+\.\s+[^.\n]+/g;
    const numberedItems = sentence.match(numberedItemPattern);
    
    if (numberedItems && numberedItems.length > 1) {
        // This appears to be a numbered list - preserve newlines between items
        // Replace only runs of multiple newlines and clean up spacing
        return sentence
            .replace(/\n{3,}/g, '\n\n')  // Collapse multiple newlines to max 2
            .replace(/[ \t]+/g, ' ')     // Normalize spaces and tabs
            .replace(/\n[ \t]+/g, '\n')  // Remove spaces after newlines
            .replace(/[ \t]+\n/g, '\n')  // Remove spaces before newlines
            .trim();
    } else {
        // Regular sentence - remove newlines and normalize whitespace
        return sentence.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    }
}

/**
 * Split text into sentences, handling footnotes properly
 * @param {string} text - Text to split
 * @returns {Array} - Array of sentences
 */
function splitIntoSentences(text) {
    // Simple but reliable sentence splitting that preserves sentence integrity
    const sentences = [];

    // Temporarily protect common abbreviations that end with a period
    const ABBR_MAP = new Map([
        ['Mr.', 'Mr<ABBR>'], ['Mrs.', 'Mrs<ABBR>'], ['Ms.', 'Ms<ABBR>'], ['Dr.', 'Dr<ABBR>'], ['Prof.', 'Prof<ABBR>'],
        ['Sr.', 'Sr<ABBR>'], ['Jr.', 'Jr<ABBR>'], ['St.', 'St<ABBR>'], ['vs.', 'vs<ABBR>'], ['etc.', 'etc<ABBR>'],
        ['i.e.', 'i<ABBR>e<ABBR>'], ['e.g.', 'e<ABBR>g<ABBR>']
    ]);
    let protectedText = text;
    for (const [abbr, token] of ABBR_MAP.entries()) {
        protectedText = protectedText.replace(new RegExp(abbr.replace('.', '\\.'), 'g'), token);
    }

    // Protect numbered list items to prevent splitting within lists
    // Pattern: number + period + space + text (e.g., "1. Item text 2. Next item")
    protectedText = protectedText.replace(/(\d+)\.\s+/g, '$1<LISTNUM> ');

    // Split on sentence terminators followed by whitespace and capital letter or end of text
    // This preserves the terminator with the sentence and avoids creating fragments
    const sentenceRegex = /([.!?]+)\s+(?=[A-Z]|$)/g;

    let lastIndex = 0;
    let match;

    while ((match = sentenceRegex.exec(protectedText)) !== null) {
        // Extract sentence from lastIndex to end of current match
        const sentence = protectedText.substring(lastIndex, match.index + match[1].length).trim();
        if (sentence) {
            sentences.push(sentence);
        }
        lastIndex = match.index + match[0].length;
    }

    // Add any remaining content as the last sentence
    const remaining = protectedText.substring(lastIndex).trim();
    if (remaining) {
        sentences.push(remaining);
    }

    // Restore abbreviations and list numbers
    const restored = sentences.map(s => {
        let out = s;
        for (const [abbr, token] of ABBR_MAP.entries()) {
            out = out.replace(new RegExp(token, 'g'), abbr);
        }
        // Restore numbered list items
        out = out.replace(/(\d+)<LISTNUM>/g, '$1.');
        return out;
    });

    return restored.filter(s => s.length > 0);
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