/**
 * Step 4: Sentence Detection and Paragraph Separation
 * 
 * Detect paragraph boundaries and split them into individual sentences.
 * Create sentence chunks and paragraph separator chunks.
 * 
 * Requirements:
 * - Detect paragraph boundaries using existing logic
 * - Split each paragraph into individual sentences
 * - Create sentence chunks (type: 'text') for each sentence
 * - Insert paragraph separator chunks (type: 'paragraphSeparator') between paragraphs
 * - Process clean page content from step 3
 * - Extract links that exist within sentence content
 * - Output: array of chapters, each chapter has array of chunks (sentence, header, or paragraphSeparator)
 * - Each chunk has type, pageNumber, content, and links (if any)
 * 
 * Header Detection Rules (ALL must be satisfied):
 * 1. Length: 2-5 words only
 * 2. No Punctuation: Does not end with sentence punctuation (., !, ?)
 * 3. Capitalization: Starts with a capital letter
 * 4. Line Structure: Appears as standalone line
 * 5. Context - Previous: Previous line ends with sentence-ending punctuation
 * 6. Context - Next: Next line starts with a capital letter
 * 
 * Expected Input:
 * - pipelineState: { chapters: [...] with pages[].content and pages[].links, ... }
 * - config: { OUTPUT_DIR: path, DEBUG_DIR: path, ... }
 * 
 * Expected Output:
 * - { chapters: [{ title, chapterNumber, chunks: [{ type, pageNumber, content, links, wordCount }] }] }
 */

const fs = require('fs');
const path = require('path');

/**
 * Execute paragraph and header detection step
 * @param {Object} pipelineState - Current pipeline state
 * @param {Object} config - Configuration object
 * @returns {Object} - Updated pipeline state with chunk structure
 */
async function execute(pipelineState, config) {

    // Validate prerequisites
    if (!pipelineState.chapters || pipelineState.chapters.length === 0) {
        throw new Error('Step 3 (page extraction) must be completed first');
    }

    const startTime = Date.now();

    try {
        const chaptersWithChunks = [];
        let totalChunks = 0;
        let totalParagraphs = 0;
        let totalHeaders = 0;
        let totalLinksExtracted = 0;


        for (const chapter of pipelineState.chapters) {

            // Process each page to detect chunks (sentences, headers, and paragraph separators)
            const chapterChunks = detectChunksInChapter(chapter, chapter.chapterNumber);

            // Combine small sentence chunks to meet minimum word count requirements
            const optimizedChunks = combineSmallSentenceChunks(chapterChunks);

            // Assign sequential chunk IDs after optimization
            for (let i = 0; i < optimizedChunks.length; i++) {
                optimizedChunks[i].chunkId = `${chapter.chapterNumber}_${i + 1}`;
            }

            // Count chunk types
            const sentenceCount = optimizedChunks.filter(c => c.type === 'text').length;
            const headerCount = optimizedChunks.filter(c => c.type === 'header').length;
            const imageCount = optimizedChunks.filter(c => c.type === 'image').length;
            const separatorCount = optimizedChunks.filter(c => c.type === 'paragraphSeparator').length;
            const chunkLinksCount = optimizedChunks.reduce((sum, c) => sum + (c.links ? c.links.length : 0), 0);

            totalChunks += optimizedChunks.length;
            totalParagraphs += sentenceCount; // For compatibility, counting sentences as "paragraphs"
            totalHeaders += headerCount;
            totalLinksExtracted += chunkLinksCount;




            chaptersWithChunks.push({
                title: chapter.title,
                chapterNumber: chapter.chapterNumber,
                pageNumberStart: chapter.pageNumberStart,
                pageNumberEnd: chapter.pageNumberEnd,
                chunks: optimizedChunks
            });
        }

        const endTime = Date.now();
        const processingTime = endTime - startTime;


        // Generate comprehensive statistics
        const stats = generateChunkStats(chaptersWithChunks);

        // Save debug output
        if (config.DEBUG_DIR) {
            await saveDebugOutput(config.DEBUG_DIR, chaptersWithChunks, stats, processingTime);
        }

        return {
            chapters: chaptersWithChunks,
            metadata: {
                ...pipelineState.metadata,
                stepResults: {
                    ...pipelineState.metadata.stepResults,
                    'step-4': {
                        totalChunks,
                        totalParagraphs,
                        totalHeaders,
                        totalLinksExtracted,
                        processingTime,
                        stats
                    }
                }
            }
        };

    } catch (error) {
        console.error('❌ Error in paragraph and header detection:', error);
        throw error;
    }
}

/**
 * Detect chunks (paragraphs and headers) in a chapter
 * @param {Object} chapter - Chapter with pages
 * @returns {Array} - Array of chunks with type, content, pageNumber, links
 */
function detectChunksInChapter(chapter, chapterNumber) {
    const chunks = [];

    for (const page of chapter.pages) {
        // First, add all text chunks (paragraphs and headers)
        const pageChunks = detectChunksInPage(page, chapterNumber, 0); // Pass 0 as placeholder
        chunks.push(...pageChunks);

        // Then, add image chunks at the end of the page if there are any images
        if (page.images && page.images.length > 0) {
            for (const image of page.images) {
                const imageChunk = createImageChunk(image, page, '');
                chunks.push(imageChunk);
            }
        }
    }

    return chunks;
}

/**
 * Generate a short prefix for chunk IDs based on chapter title
 * @param {string} title - Chapter title
 * @returns {string} - Short prefix for chunk IDs
 */
function generateChapterPrefix(title) {
    // Take first few meaningful words and make them lowercase
    const words = title.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '') // Remove special characters
        .split(/\s+/)
        .filter(word => word.length > 2) // Filter out short words like "a", "of", "the"
        .slice(0, 2); // Take first 2 meaningful words

    if (words.length === 0) {
        return 'chapter';
    }

    return words.join('_');
}

/**
 * Detect chunks (sentences, headers, and paragraph separators) in a single page
 * @param {Object} page - Page with content and links
 * @param {number} chapterNumber - Chapter number for chunk IDs
 * @param {number} startChunkCounter - Starting counter for chunk IDs
 * @returns {Array} - Array of chunks detected in this page
 */
function detectChunksInPage(page, chapterNumber, startChunkCounter) {
    const chunks = [];
    const lines = page.content.split('\n');

    let currentParagraph = '';
    let currentParagraphStartIndex = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Skip empty lines
        if (!line) {
            continue;
        }

        // Check if current line is a header
        if (isHeader(line, i, lines)) {
            // If we have accumulated paragraph content, process it into sentences first
            if (currentParagraph.trim()) {
                const sentenceChunks = createSentenceChunks(currentParagraph.trim(), page, '');
                chunks.push(...sentenceChunks);

                // Add paragraph separator after the paragraph (before the header)
                chunks.push(createParagraphSeparatorChunk(page, ''));
                currentParagraph = '';
            }

            // Create header chunk
            chunks.push(createHeaderChunk(line, page, ''));
            currentParagraphStartIndex = i + 1;
        } else {
            // Add line to current paragraph
            if (currentParagraph) {
                currentParagraph += '\n' + line;
            } else {
                currentParagraph = line;
            }

            // Check if paragraph ends (sentence terminator followed by potential new paragraph)
            if (endsWithSentenceTerminator(line)) {
                // Look ahead to see if next non-empty line starts a new paragraph or is a header
                const nextContentIndex = findNextNonEmptyLine(lines, i + 1);

                // Special case: if current line ends with initials and next line starts with a capital letter
                // that could be continuing the same sentence (like another name), don't split
                if (nextContentIndex !== -1 && endsWithInitials(line) &&
                    /^[A-Z]/.test(lines[nextContentIndex].trim())) {
                    continue; // Don't split, continue building the paragraph
                }

                // Enhanced paragraph boundary detection
                // End paragraph if:
                // 1. We're at the end of the page, OR
                // 2. There's an empty line between current line and next content, OR  
                // 3. Next line is a header, OR
                // 4. Current sentence indicates a natural paragraph break
                const hasEmptyLineBetween = nextContentIndex > i + 1; // Gap indicates empty line(s)
                const isNaturalParagraphBreak = isNaturalParagraphBoundary(line, nextContentIndex !== -1 ? lines[nextContentIndex] : null);

                if (nextContentIndex === -1 || // End of page
                    hasEmptyLineBetween || // Empty line(s) between current and next content
                    (nextContentIndex !== -1 && isHeader(lines[nextContentIndex], nextContentIndex, lines)) || // Next line is header
                    isNaturalParagraphBreak) { // Natural semantic paragraph break

                    // End current paragraph - convert to sentence chunks
                    const sentenceChunks = createSentenceChunks(currentParagraph.trim(), page, '');
                    chunks.push(...sentenceChunks);

                    // Add paragraph separator after the paragraph (if not at end of page)
                    if (nextContentIndex !== -1) {
                        chunks.push(createParagraphSeparatorChunk(page, ''));
                    }

                    currentParagraph = '';
                    currentParagraphStartIndex = nextContentIndex;
                }
                // If next line immediately follows (no empty line) and starts with capital letter,
                // treat it as continuing the same paragraph unless it's a natural break
            }
        }
    }

    // Handle any remaining paragraph content
    if (currentParagraph.trim()) {
        const sentenceChunks = createSentenceChunks(currentParagraph.trim(), page, '');
        chunks.push(...sentenceChunks);
    }

    return chunks;
}

/**
 * Check if a line is a header using the 6-rule system
 * @param {string} line - Line to check
 * @param {number} lineIndex - Index of the line
 * @param {Array} allLines - All lines in the page
 * @returns {boolean} - True if line is a header
 */
function isHeader(line, lineIndex, allLines) {
    // Rule 1: Length - 2-5 words only
    const words = line.trim().split(/\s+/);
    if (words.length < 2 || words.length > 5) {
        return false;
    }

    // Rule 2: No Punctuation - Does not end with sentence punctuation
    if (/[.!?]$/.test(line.trim())) {
        return false;
    }

    // Rule 3: Capitalization: Starts with a capital letter
    if (!/^[A-Z]/.test(line.trim())) {
        return false;
    }

    // Rule 4: Line Structure - Appears as standalone line (already handled by line splitting)

    // Rule 5: Context - Previous - Previous line ends with sentence-ending punctuation
    const prevLine = findPreviousNonEmptyLine(allLines, lineIndex - 1);
    if (prevLine !== null && !endsWithSentenceTerminator(prevLine)) {
        return false;
    }

    // Rule 6: Context - Next - Next line starts with a capital letter
    const nextLine = findNextNonEmptyLine(allLines, lineIndex + 1);
    if (nextLine !== -1 && !/^[A-Z]/.test(allLines[nextLine].trim())) {
        return false;
    }

    return true;
}

/**
 * Find the previous non-empty line
 * @param {Array} lines - All lines
 * @param {number} startIndex - Index to start searching backwards from
 * @returns {string|null} - Previous non-empty line or null if none found
 */
function findPreviousNonEmptyLine(lines, startIndex) {
    for (let i = startIndex; i >= 0; i--) {
        const line = lines[i].trim();
        if (line) {
            return line;
        }
    }
    return null;
}

/**
 * Find the next non-empty line
 * @param {Array} lines - All lines
 * @param {number} startIndex - Index to start searching from
 * @returns {number} - Index of next non-empty line or -1 if none found
 */
function findNextNonEmptyLine(lines, startIndex) {
    for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line) {
            return i;
        }
    }
    return -1;
}

/**
 * Create sentence chunks from paragraph content
 * @param {string} paragraphContent - Full paragraph content
 * @param {Object} page - Page object with pageNumber and links
 * @param {string} baseChunkId - Base chunk ID for numbering
 * @returns {Array} - Array of sentence chunks
 */
function createSentenceChunks(paragraphContent, page, baseChunkId) {
    const sentences = splitIntoSentences(paragraphContent);
    const chunks = [];
    const paragraphLinks = extractLinksFromContent(paragraphContent, page.links || []);

    for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i].trim();
        if (!sentence) continue;

        // Clean sentence content by removing newlines and normalizing whitespace
        const cleanSentence = sentence.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

        // Find links that belong to this specific sentence (check against cleaned content)
        const sentenceLinks = paragraphLinks.filter(link =>
            isSourceTextInContent(link.text, cleanSentence)
        );

        chunks.push({
            chunkId: baseChunkId,
            type: 'text',
            content: cleanSentence,
            pageNumber: page.pageNumber,
            wordCount: getWordCount(cleanSentence),
            sentenceCount: 1, // Each chunk is exactly one sentence
            links: sentenceLinks
        });
    }

    return chunks;
}

/**
 * Create a paragraph separator chunk
 * @param {Object} page - Page object with pageNumber
 * @param {string} chunkId - Chunk ID
 * @returns {Object} - Paragraph separator chunk
 */
function createParagraphSeparatorChunk(page, chunkId) {
    return {
        chunkId: chunkId,
        type: 'paragraphSeparator',
        content: '', // Empty content for separators
        pageNumber: page.pageNumber,
        wordCount: 0,
        sentenceCount: 0,
        links: []
    };
}

/**
 * Create a header chunk
 * @param {string} content - Header content
 * @param {Object} page - Page object with pageNumber
 * @returns {Object} - Header chunk
 */
function createHeaderChunk(content, page, chunkId) {
    return {
        chunkId: chunkId,
        type: 'header',
        content: content,
        pageNumber: page.pageNumber,
        wordCount: getWordCount(content),
        sentenceCount: 1, // Headers are always one "sentence"
        links: [] // Headers typically don't contain links
    };
}

/**
 * Create an image chunk
 * @param {Object} image - Image object with imageName, imageAlt, etc.
 * @param {Object} page - Page object with pageNumber
 * @param {string} chunkId - Chunk ID
 * @returns {Object} - Image chunk
 */
function createImageChunk(image, page, chunkId) {
    return {
        chunkId: chunkId,
        type: 'image',
        content: image.imageAlt || `Image: ${image.imageName}`,
        pageNumber: page.pageNumber,
        wordCount: 0, // Images don't have words
        sentenceCount: 0, // Images don't have sentences
        links: [],
        imageName: image.imageName,
        imageAlt: image.imageAlt,
        extracted: image.extracted,
        placeholder: image.placeholder,
        originalName: image.originalName
    };
}

/**
 * Combine small sentence chunks to meet minimum word count requirements
 * @param {Array} chunks - Array of chunks (sentences, headers, separators)
 * @returns {Array} - Optimized chunks with combined sentences
 */
function combineSmallSentenceChunks(chunks) {
    const optimized = [];
    const MIN_WORDS = 50;
    const MAX_WORDS = 200;

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];

        // Headers, images, and separators are never combined
        if (chunk.type === 'header' || chunk.type === 'image' || chunk.type === 'paragraphSeparator') {
            optimized.push(chunk);
            continue;
        }

        // For text chunks, check if they need combining
        if (chunk.type === 'text' && chunk.wordCount < MIN_WORDS) {
            // Try to combine with next text chunks
            const combinedChunk = tryMergeWithNextSentences(chunks, i, MIN_WORDS, MAX_WORDS);
            if (combinedChunk) {
                optimized.push(combinedChunk.merged);
                i = combinedChunk.nextIndex; // Skip to after the merged chunks
            } else {
                // Try combining with previous text chunk if next merge failed
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
 * Try to merge current sentence with following sentence chunks
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

    // Look for next text chunks to merge (skip headers and separators)
    for (let i = currentIndex + 1; i < chunks.length; i++) {
        const nextChunk = chunks[i];

        // Stop if we hit a paragraph separator (don't merge across paragraph boundaries)
        if (nextChunk.type === 'paragraphSeparator') {
            break;
        }

        // Skip headers and images
        if (nextChunk.type === 'header' || nextChunk.type === 'image') {
            continue;
        }

        // Try merging with this text chunk
        if (nextChunk.type === 'text') {
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
 * Try to merge current small sentence with previous text chunk
 * @param {Array} optimizedChunks - Already processed chunks
 * @param {Object} currentChunk - Current small chunk to merge
 * @param {number} minWords - Minimum word count target
 * @param {number} maxWords - Maximum word count limit
 * @returns {Object|null} - Merged chunk or null if no merge possible
 */
function tryMergeWithPreviousSentence(optimizedChunks, currentChunk, minWords, maxWords) {
    // Look backwards for the last text chunk (skip headers and separators)
    for (let i = optimizedChunks.length - 1; i >= 0; i--) {
        const previousChunk = optimizedChunks[i];

        // Skip headers, images, and separators
        if (previousChunk.type === 'header' || previousChunk.type === 'image' || previousChunk.type === 'paragraphSeparator') {
            continue;
        }

        if (previousChunk.type === 'text') {
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
                wordCount: combinedWordCount,
                sentenceCount: previousChunk.sentenceCount + currentChunk.sentenceCount,
                links: removeDuplicateLinks(validLinks)
            };
        }

        break; // Only check the most recent text chunk
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

// Removed shouldSplitSentence function - using simpler regex-based approach

/**
 * Get word count of text
 * @param {string} text - Text to count
 * @returns {number} - Word count
 */
function getWordCount(text) {
    if (!text || typeof text !== 'string') return 0;
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Get sentence count of text
 * @param {string} text - Text to count
 * @returns {number} - Sentence count
 */
function getSentenceCount(text) {
    return (text.match(/[.!?]/g) || []).length;
}

/**
 * Check if line ends with sentence terminator
 * @param {string} line - Line to check
 * @returns {boolean} - True if line ends with sentence terminator
 */
function endsWithSentenceTerminator(line) {
    const trimmed = line.trim();

    // Check if it ends with sentence terminator
    if (!/[.!?]$/.test(trimmed)) {
        return false;
    }

    // If it ends with a period, check if it's an initial (single capital letter followed by period)
    if (trimmed.endsWith('.')) {
        // Check if it's an initial like "J." or "H." at the end
        if (/\b[A-Z]\.$/.test(trimmed)) {
            return false;
        }
    }

    return true;
}

// endsWithInitials function is now imported from validation module

/**
 * Check if this represents a natural paragraph boundary
 * @param {string} currentLine - Current line ending with sentence terminator
 * @param {string} nextLine - Next line (or null if end of content)
 * @returns {boolean} - True if this should be a paragraph break
 */
function isNaturalParagraphBoundary(currentLine, nextLine) {
    if (!currentLine || !nextLine) return false;

    const currentTrimmed = currentLine.trim();
    const nextTrimmed = nextLine.trim();

    // Patterns that typically end paragraphs
    const paragraphEnders = [
        // Rhetorical questions often end paragraphs
        /\?$/,
        // Short, emphatic statements
        /^.{1,50}[.!]$/,
        // Transition words/phrases that start new paragraphs
    ];

    // Patterns that typically start new paragraphs
    const paragraphStarters = [
        // Transition words and phrases
        /^(But|However|Nevertheless|Meanwhile|Furthermore|Moreover|Therefore|Thus|Hence|Consequently|In contrast|On the other hand|For example|For instance|In addition|Finally|Firstly|Secondly|Similarly|Likewise)/,
        // Temporal transitions
        /^(Now|Then|Later|Earlier|Previously|Subsequently|Meanwhile|Today|Yesterday|Tomorrow)/,
        // Logical transitions
        /^(Yet|Still|Even so|Despite|Although|While|Whereas)/,
        // Topic shifts
        /^(The|This|That|These|Those|Such|Another|Other|Some|Many|Few|Several|Most|All)/,
        // Direct address or questions
        /^(You|We|I|What|Why|How|When|Where|Who)/,
        // Numbers or lists
        /^(\d+\.|First|Second|Third|Fourth|Fifth)/
    ];

    // Check if current line has paragraph-ending characteristics
    const currentEndsNaturally = paragraphEnders.some(pattern => pattern.test(currentTrimmed));

    // Check if next line starts a new topic/thought
    const nextStartsNaturally = paragraphStarters.some(pattern => pattern.test(nextTrimmed));

    // Specific patterns for academic/scientific text
    // Short questions often end paragraphs
    if (/^.{5,50}\?$/.test(currentTrimmed)) {
        return true;
    }

    // Very short emphatic statements (like "Dead." "No." "Yes.")
    if (/^[A-Z][a-z]{0,10}[.!]$/.test(currentTrimmed)) {
        return true;
    }

    // Topic transitions
    if (nextStartsNaturally && currentTrimmed.length > 30) {
        return true;
    }

    // Dialogue or quotes often indicate paragraph breaks
    if (/["']$/.test(currentTrimmed) && /^[A-Z]/.test(nextTrimmed)) {
        return true;
    }

    return false;
}

/**
 * Check if line starts a new paragraph
 * @param {string} line - Line to check
 * @returns {boolean} - True if line starts new paragraph
 */
function startsNewParagraph(line) {
    return /^[A-Z]/.test(line.trim());
}

/**
 * Extract links from content
 * @param {string} content - Content to search for links
 * @param {Array} pageLinks - Available links from the page
 * @returns {Array} - Links found in content
 */
function extractLinksFromContent(content, pageLinks) {
    if (!pageLinks || pageLinks.length === 0) {
        return [];
    }

    const foundLinks = [];

    for (const link of pageLinks) {
        if (isSourceTextInContent(link.sourceText, content)) {
            foundLinks.push({
                text: link.sourceText,
                targetPageNumber: link.targetPageNumber,
                targetText: link.targetText,
                linkId: link.linkId,
                role: link.role
            });
        }
    }

    return removeDuplicateLinks(foundLinks);
}

// isSourceTextInContent function is now imported from validation module

// isFootnoteInContent function is now imported from validation module

/**
 * Remove duplicate links
 * @param {Array} links - Links array
 * @returns {Array} - Deduplicated links
 */
function removeDuplicateLinks(links) {
    const seen = new Set();
    return links.filter(link => {
        const key = `${link.text}-${link.targetPageNumber}`;
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}

/**
 * Generate comprehensive chunk statistics
 * @param {Array} chapters - Chapters with chunks
 * @returns {Object} - Statistics
 */
function generateChunkStats(chapters) {
    let totalChunks = 0;
    let totalSentences = 0;
    let totalHeaders = 0;
    let totalSeparators = 0;
    let totalWords = 0;
    let totalLinks = 0;

    const sentenceWordCounts = [];
    const headerWordCounts = [];

    for (const chapter of chapters) {
        for (const chunk of chapter.chunks) {
            totalChunks++;
            totalWords += chunk.wordCount;
            totalLinks += chunk.links ? chunk.links.length : 0;

            if (chunk.type === 'text') {
                totalSentences++;
                sentenceWordCounts.push(chunk.wordCount);
            } else if (chunk.type === 'header') {
                totalHeaders++;
                headerWordCounts.push(chunk.wordCount);
            } else if (chunk.type === 'paragraphSeparator') {
                totalSeparators++;
            }
        }
    }

    return {
        totalChunks,
        totalSentences,
        totalHeaders,
        totalSeparators,
        totalWords,
        totalLinks,
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
            averageWords: headerWordCounts.length > 0 ? headerWordCounts.reduce((a, b) => a + b, 0) / headerWordCounts.length : 0,
            minWords: headerWordCounts.length > 0 ? Math.min(...headerWordCounts) : 0,
            maxWords: headerWordCounts.length > 0 ? Math.max(...headerWordCounts) : 0
        }
    };
}

/**
 * Save debug output
 * @param {string} debugDir - Debug directory path
 * @param {Array} chapters - Chapters with chunks
 * @param {Object} stats - Processing statistics
 * @param {number} processingTime - Processing time in ms
 */
async function saveDebugOutput(debugDir, chapters, stats, processingTime) {
    const debugOutput = {
        timestamp: new Date().toISOString(),
        processingTime: `${processingTime}ms`,
        summary: {
            totalChapters: chapters.length,
            totalChunks: stats.totalChunks,
            totalSentences: stats.totalSentences,
            totalHeaders: stats.totalHeaders,
            totalSeparators: stats.totalSeparators,
            totalWords: stats.totalWords,
            totalLinks: stats.totalLinks
        },
        statistics: stats,
        chapters: chapters.map(chapter => ({
            chapterNumber: chapter.chapterNumber,
            title: chapter.title,
            chunkCount: chapter.chunks.length,
            sentenceCount: chapter.chunks.filter(c => c.type === 'text').length,
            headerCount: chapter.chunks.filter(c => c.type === 'header').length,
            separatorCount: chapter.chunks.filter(c => c.type === 'paragraphSeparator').length,
            chunks: chapter.chunks.map(chunk => ({
                type: chunk.type,
                content: chunk.content.substring(0, 200) + (chunk.content.length > 200 ? '...' : ''),
                pageNumber: chunk.pageNumber,
                wordCount: chunk.wordCount,
                sentenceCount: chunk.sentenceCount,
                linkCount: chunk.links ? chunk.links.length : 0
            }))
        }))
    };

    const debugPath = path.join(debugDir, 'step-04-paragraph-and-header-detection.json');
    await fs.promises.writeFile(debugPath, JSON.stringify(debugOutput, null, 2));
}

// countWords function is now imported from validation module

// endsWithInitials function is now imported from validation module

// endsWithCommonSingleLetterWord function is now imported from validation module

// findPreviousParagraph function is now imported from validation module

// findNextParagraph function is now imported from validation module

const { validate, countWords, endsWithInitials, endsWithCommonSingleLetterWord, findPreviousParagraph, findNextParagraph, isSourceTextInContent } = require('./04-paragraph-detection-validation');

module.exports = { execute, validate }; 