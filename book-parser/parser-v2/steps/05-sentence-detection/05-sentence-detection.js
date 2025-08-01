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
    console.log('🔤 Converting paragraphs to sentences with paragraph indexing...');

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

    console.log(`✅ Sentence detection completed:`);
    console.log(`   📊 Total chunks: ${totalChunks}`);
    console.log(`   🔤 Total sentences: ${totalSentences}`);
    console.log(`   📝 Total headers: ${totalHeaders}`);
    console.log(`   🖼️  Total images: ${totalImages}`);
    console.log(`   🔗 Total links: ${totalLinksExtracted}`);

    return {
        ...pipelineState,
        chapters: processedChapters,
        'step-5': {
            totalChunks,
            totalSentences,
            totalHeaders,
            totalImages,
            totalLinksExtracted,
            statistics: stats
        }
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
            const sentences = createSentenceChunks(chunk.content, chunk.pageNumber, chunk.links || [], paragraphIndex);
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
 * @param {number} pageNumber - Page number
 * @param {Array} pageLinks - Links from the page
 * @param {number} paragraphIndex - Index of the paragraph
 * @returns {Array} - Array of sentence chunks
 */
function createSentenceChunks(paragraphContent, pageNumber, pageLinks, paragraphIndex) {
    const sentences = splitIntoSentences(paragraphContent);
    const chunks = [];
    const paragraphLinks = extractLinksFromContent(paragraphContent, pageLinks);

    for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i].trim();
        if (!sentence) continue;

        // Clean sentence content by removing newlines and normalizing whitespace
        const cleanSentence = sentence.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

        // Find links that belong to this specific sentence
        const sentenceLinks = paragraphLinks.filter(link =>
            isSourceTextInContent(link.text, cleanSentence)
        );

        chunks.push({
            chunkId: '', // Will be assigned later
            type: 'text',
            content: cleanSentence,
            pageNumber: pageNumber,
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
    const MIN_WORDS = 50;
    const MAX_WORDS = 200;

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];

        // Headers and images are never combined
        if (chunk.type === 'header' || chunk.type === 'image') {
            optimized.push(chunk);
            continue;
        }

        // For text chunks, check if they need combining
        if (chunk.type === 'text' && chunk.wordCount < MIN_WORDS) {
            // Try to combine with next text chunks from the same paragraph
            const combinedChunk = tryMergeWithNextSentences(chunks, i, MIN_WORDS, MAX_WORDS);
            if (combinedChunk) {
                optimized.push(combinedChunk.merged);
                i = combinedChunk.nextIndex; // Skip to after the merged chunks
            } else {
                // Try combining with previous text chunk from same paragraph if next merge failed
                const mergedWithPrevious = tryMergeWithPreviousSentence(optimized, chunk, MIN_WORDS, MAX_WORDS);
                if (mergedWithPrevious) {
                    // Replace the last optimized chunk with the merged version
                    optimized[optimized.length - 1] = mergedWithPrevious;
                } else {
                    // Can't merge, keep as is (validation will catch this)
                    optimized.push(chunk);
                }
            }
        } else {
            optimized.push(chunk);
        }
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

            // Don't merge if it would exceed max words
            if (newWordCount > maxWords) {
                break;
            }

            // Don't merge chunks from different pages unless they're consecutive
            if (currentChunk.pageNumber !== nextChunk.pageNumber) {
                const pageDifference = nextChunk.pageNumber - currentChunk.pageNumber;
                if (pageDifference > 1) {
                    break;
                }
            }

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

    // Only return merged chunk if we actually merged with something and meet minimum
    if (lastMergedIndex > currentIndex && combinedWordCount >= minWords) {
        // Re-validate links against merged content
        const validLinks = combinedLinks.filter(link =>
            isSourceTextInContent(link.text, combinedContent)
        );

        return {
            merged: {
                chunkId: currentChunk.chunkId,
                type: 'text',
                content: combinedContent,
                pageNumber: currentChunk.pageNumber,
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

            // Don't merge chunks from different pages unless they're consecutive
            if (previousChunk.pageNumber !== currentChunk.pageNumber) {
                const pageDifference = currentChunk.pageNumber - previousChunk.pageNumber;
                if (pageDifference > 1) {
                    break;
                }
            }

            const mergedContent = previousChunk.content + ' ' + currentChunk.content;
            const allPotentialLinks = [...(previousChunk.links || []), ...(currentChunk.links || [])];
            const validLinks = allPotentialLinks.filter(link =>
                isSourceTextInContent(link.text, mergedContent)
            );

            return {
                chunkId: previousChunk.chunkId,
                type: 'text',
                content: mergedContent,
                pageNumber: previousChunk.pageNumber,
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
 * Split text into sentences, handling footnotes properly
 * @param {string} text - Text to split
 * @returns {Array} - Array of sentences
 */
function splitIntoSentences(text) {
    // Simple but reliable sentence splitting that preserves sentence integrity
    const sentences = [];

    // Split on sentence terminators followed by whitespace and capital letter or end of text
    // This preserves the terminator with the sentence and avoids creating fragments
    const sentenceRegex = /([.!?]+)\s+(?=[A-Z]|$)/g;

    let lastIndex = 0;
    let match;

    while ((match = sentenceRegex.exec(text)) !== null) {
        // Extract sentence from lastIndex to end of current match
        const sentence = text.substring(lastIndex, match.index + match[1].length).trim();
        if (sentence) {
            sentences.push(sentence);
        }
        lastIndex = match.index + match[0].length;
    }

    // Add any remaining content as the last sentence
    const remaining = text.substring(lastIndex).trim();
    if (remaining) {
        sentences.push(remaining);
    }

    return sentences.filter(s => s.length > 0);
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

module.exports = {
    execute
}; 