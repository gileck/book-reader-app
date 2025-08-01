/**
 * Validation functions for Step 5: Sentence Detection and Combination
 */

/**
 * Check if a footnote number appears as a standalone footnote in content
 * @param {string} footnoteNumber - The footnote number to find
 * @param {string} content - Content to search in
 * @returns {boolean} - True if footnote is found as standalone reference
 */
function isFootnoteInContent(footnoteNumber, content) {
    // Footnote patterns that should match:
    // ". 8 For" (period, space, number, space/punctuation)
    // ".8 For" (period, number, space/punctuation)  
    // " 8 For" (space, number, space/punctuation)
    // "9 Mitchell" (start of content, number, space/punctuation)
    // "(8)" (parentheses around number)
    // "[8]" (brackets around number)

    const patterns = [
        // Period followed by optional space, then number, then space or punctuation
        new RegExp(`\\.\\s*${footnoteNumber}(?=\\s|[.,;:!?)]|$)`),

        // Space followed by number, then space or punctuation  
        new RegExp(`\\s${footnoteNumber}(?=\\s|[.,;:!?)]|$)`),

        // Start of content, number, then space or punctuation
        new RegExp(`^${footnoteNumber}(?=\\s|[.,;:!?)])`),

        // Number in parentheses
        new RegExp(`\\(${footnoteNumber}\\)`),

        // Number in square brackets
        new RegExp(`\\[${footnoteNumber}\\]`),

        // Number followed by period (like "8.")
        new RegExp(`\\b${footnoteNumber}\\.`)
    ];

    return patterns.some(pattern => pattern.test(content));
}

/**
 * Check if source text (link text) is present in content
 * @param {string} sourceText - Text to find
 * @param {string} content - Content to search in
 * @returns {boolean} - True if source text is found in content
 */
function isSourceTextInContent(sourceText, content) {
    // For footnote numbers, use strict footnote pattern matching
    if (/^\d+$/.test(sourceText)) {
        return isFootnoteInContent(sourceText, content);
    }

    // For non-numeric link text, use direct match
    return content.includes(sourceText);
}

/**
 * Count words in text
 * @param {string} text - Text to count words in
 * @returns {number} - Number of words
 */
function countWords(text) {
    if (!text || typeof text !== 'string') return 0;
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Check if text ends with initials (single capital letter followed by period)
 * @param {string} text - Text to check
 * @returns {boolean} - True if text ends with initials
 */
function endsWithInitials(text) {
    if (!text) return false;
    const trimmed = text.trim();
    return /\b[A-Z]\.$/.test(trimmed);
}

/**
 * Check if text ends with a common single-letter word (like "vitamin E", "point A", etc.)
 * @param {string} text - Text to check
 * @returns {boolean} - True if ends with common single-letter word
 */
function endsWithCommonSingleLetterWord(text) {
    if (!text) return false;
    const trimmed = text.trim();

    // Common patterns where single letters are valid endings
    const commonPatterns = [
        // Scientific/academic terms
        /\bvitamin [a-zA-Z]\.?$/i,      // vitamin E, vitamin C, etc.
        /\btype [a-zA-Z]\.?$/i,         // type A, type B, etc.
        /\bpoint [a-zA-Z]\.?$/i,        // point A, point B, etc.
        /\bfigure [a-zA-Z]\.?$/i,       // figure A, figure B, etc.
        /\bappendix [a-zA-Z]\.?$/i,     // appendix A, appendix B, etc.
        /\bsection [a-zA-Z]\.?$/i,      // section A, section B, etc.
        /\bpart [a-zA-Z]\.?$/i,         // part A, part B, etc.
        /\boption [a-zA-Z]\.?$/i,       // option A, option B, etc.
        /\bclass [a-zA-Z]\.?$/i,        // class A, class B, etc.
        /\bgrade [a-zA-Z]\.?$/i,        // grade A, grade B, etc.
        /\bmodel [a-zA-Z]\.?$/i,        // model A, model B, etc.
        /\bphase [a-zA-Z]\.?$/i,        // phase A, phase B, etc.

        // Names and initials (common pattern in academic writing)
        /\b[A-Z]\.\s*[A-Z]\.$/,        // R. E., J. D., etc.
        /\b[A-Z][a-z]+\s+[A-Z]\.$/,    // Smith J., Jones R., etc.
        /\b[A-Z]\.\s*[A-Z][a-z]+$/,    // R. Smith, J. Jones, etc.

        // Chemical/molecular notation
        /\b[A-Z][0-9]*[a-zA-Z]?\.?$/,  // H2O, CO2, etc.

        // Common abbreviations that might end paragraphs
        /\betc\.$/i,                   // etc.
        /\bi\.e\.$/i,                  // i.e.
        /\be\.g\.$/i                   // e.g.
    ];

    return commonPatterns.some(pattern => pattern.test(trimmed));
}

/**
 * Validate sentence detection results
 * @param {Object} output - Output from execute function
 * @returns {boolean} - True if validation passes
 */
function validate(output) {
    const validationErrors = [];

    // Extract chunks from all chapters and add chapter title to each chunk
    const allChunks = [];
    if (output.chapters) {
        for (const chapter of output.chapters) {
            if (chapter.chunks) {
                // Add chapter title to each chunk for validation
                const chunksWithChapterTitle = chapter.chunks.map(chunk => ({
                    ...chunk,
                    chapterTitle: chapter.title
                }));
                allChunks.push(...chunksWithChapterTitle);
            }
        }
    }

    // 1. chunks array has more than 5 items
    if (!allChunks || allChunks.length <= 5) {
        validationErrors.push(`Chunks array must have more than 5 items. Found: ${allChunks?.length || 0}`);
    }

    if (allChunks && allChunks.length > 0) {
        const chunks = allChunks;

        let hasSentence = false;
        let hasHeader = false;
        let paragraphIndexes = new Set();

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const chapterInfo = chunk.chapterTitle ? ` (${chunk.chapterTitle})` : '';
            const chunkIdentifier = chunk.chunkId || `chunk_${i + 1}`;
            const fullChunkIdentifier = `${chunkIdentifier}${chapterInfo}`;

            // Skip validation for chunks in Appendix chapters
            if (chunk.chapterTitle && chunk.chapterTitle.toLowerCase().includes('appendix')) {
                // Still track chunk types for overall validation
                if (chunk.type === 'text') hasSentence = true;
                if (chunk.type === 'header') hasHeader = true;
                continue;
            }

            // Track chunk types and paragraph indexes
            if (chunk.type === 'text') {
                hasSentence = true;
                if (chunk.paragraphIndex) {
                    paragraphIndexes.add(chunk.paragraphIndex);
                }
            }
            if (chunk.type === 'header') hasHeader = true;

            // Check required fields
            if (!chunk.type || (chunk.type !== 'text' && chunk.type !== 'header' && chunk.type !== 'image')) {
                validationErrors.push(`${fullChunkIdentifier} has invalid type: "${chunk.type}"`);
                continue;
            }

            // Content validation
            if (!chunk.content || typeof chunk.content !== 'string') {
                validationErrors.push(`${fullChunkIdentifier} has no content`);
                continue;
            }

            // 2. validation for different chunk types
            if (chunk.type === 'image') {
                // Image chunks have specific validation requirements
                if (!chunk.imageName || typeof chunk.imageName !== 'string') {
                    validationErrors.push(`Image ${fullChunkIdentifier} must have imageName`);
                }
                if (!chunk.imageAlt || typeof chunk.imageAlt !== 'string') {
                    validationErrors.push(`Image ${fullChunkIdentifier} must have imageAlt`);
                }
                if (typeof chunk.extracted !== 'boolean') {
                    validationErrors.push(`Image ${fullChunkIdentifier} must have extracted boolean flag`);
                }
                // paragraphIndex should be null for images
                if (chunk.paragraphIndex !== null) {
                    validationErrors.push(`Image ${fullChunkIdentifier} should have paragraphIndex: null`);
                }
            } else if (chunk.content.length > 0) {
                // For sentences and headers, validate content format
                const firstChar = chunk.content.charAt(0);

                if (chunk.type === 'header') {
                    // Headers must start with a capital letter
                    if (firstChar !== firstChar.toUpperCase() || !/[A-Z]/.test(firstChar)) {
                        validationErrors.push(`Header ${fullChunkIdentifier} must start with a capital letter. Found: "${chunk.content.substring(0, 20)}..."`);
                    }
                    // Headers should have paragraphIndex: null
                    if (chunk.paragraphIndex !== null) {
                        validationErrors.push(`Header ${fullChunkIdentifier} should have paragraphIndex: null`);
                    }
                } else if (chunk.type === 'text') {
                    // Sentence chunks should start with capital letters, numbers, punctuation, quotes, mathematical symbols, etc.
                    // but NOT lowercase letters (proper text formatting)
                    const isValidStart = /[A-Z0-9'"'''""«»„"‚'‛‹›\u2018\u2019\u201C\u201D\u2013\u2014\u2015\u2026\(\)\[\]\{\},.;:!?\-–—+*/<>=~`@#$%^&|\\αβγδεζηθικλμνξοπρστυφχψωΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ∞∑∏∫∂∆∇±×÷°′″‰%‱§¶†‡•‰‱]/.test(firstChar);
                    if (!isValidStart) {
                        validationErrors.push(`Sentence chunk ${fullChunkIdentifier} must start with a capital letter or valid punctuation/symbol. Found: "${chunk.content.substring(0, 20)}..."`);
                    }

                    // Sentence chunks must have a valid paragraphIndex
                    if (!chunk.paragraphIndex || typeof chunk.paragraphIndex !== 'number' || chunk.paragraphIndex < 1) {
                        validationErrors.push(`Sentence chunk ${fullChunkIdentifier} must have a valid paragraphIndex (positive number). Found: ${chunk.paragraphIndex}`);
                    }
                }
            }

            // 3. word count validation
            const wordCount = countWords(chunk.content);

            if (chunk.type === 'image') {
                // Images should have 0 word count
                if (chunk.wordCount !== 0) {
                    validationErrors.push(`Image ${fullChunkIdentifier} should have wordCount of 0, found: ${chunk.wordCount}`);
                }
                if (chunk.sentenceCount !== 0) {
                    validationErrors.push(`Image ${fullChunkIdentifier} should have sentenceCount of 0, found: ${chunk.sentenceCount}`);
                }
            } else if (chunk.type === 'text') {
                // Text chunks are combined sentences that must meet minimum word count requirements
                // Minimum 50 words, maximum 200 words for optimal processing
                if (wordCount < 50) {
                    validationErrors.push(`Text chunk ${fullChunkIdentifier} word count (${wordCount}) must be at least 50 words. Content: "${chunk.content.substring(0, 100)}..."`);
                } else if (wordCount > 200) {
                    validationErrors.push(`Text chunk ${fullChunkIdentifier} word count (${wordCount}) exceeds maximum of 200 words. Content: "${chunk.content.substring(0, 100)}..."`);
                }

                // Check if text chunk has reasonable sentence count (1 or more)
                if (chunk.sentenceCount < 1) {
                    validationErrors.push(`Text chunk ${fullChunkIdentifier} should have at least 1 sentence, found: ${chunk.sentenceCount}`);
                }

                // Check if text chunk ends with proper sentence terminator (but allow exceptions for fragments, lists, etc.)
                if (wordCount > 3 && !/[.!?]$/.test(chunk.content.trim()) && !endsWithCommonSingleLetterWord(chunk.content)) {
                    validationErrors.push(`Text chunk ${fullChunkIdentifier} should end with sentence terminator. Content: "${chunk.content}"`);
                }

                // Check that text content contains no newline characters
                if (chunk.content.includes('\n')) {
                    validationErrors.push(`Text chunk ${fullChunkIdentifier} should not contain newline characters. Content: "${chunk.content}"`);
                }
            }

            if (chunk.type === 'header') {
                // all headers are between 1 and 5 words
                if (wordCount < 1 || wordCount > 5) {
                    validationErrors.push(`Header ${fullChunkIdentifier} word count (${wordCount}) must be between 1 and 5 words. Content: "${chunk.content}"`);
                }
            }

            // 5. link text validation - ensure all link text is actually present in chunk content
            if (chunk.links && chunk.links.length > 0) {
                for (const link of chunk.links) {
                    if (!isSourceTextInContent(link.text, chunk.content)) {
                        validationErrors.push(`Link text "${link.text}" not found in ${fullChunkIdentifier} content`);
                    }
                }
            }
        }

        // 4. chunks array has valid types: "text" and "header"
        if (!hasSentence) {
            validationErrors.push('Chunks array must contain at least one sentence chunk (type: text)');
        }
        if (!hasHeader) {
            validationErrors.push('Chunks array must contain at least one header chunk');
        }

        // Validate paragraph indexing
        if (paragraphIndexes.size === 0) {
            validationErrors.push('Must have at least one paragraph with valid paragraphIndex');
        } else {
            // Check for sequential paragraph indexes starting from 1
            const sortedIndexes = Array.from(paragraphIndexes).sort((a, b) => a - b);
            for (let i = 0; i < sortedIndexes.length; i++) {
                if (sortedIndexes[i] !== i + 1) {
                    validationErrors.push(`Paragraph indexes should be sequential starting from 1. Found gap at index ${i + 1}, got ${sortedIndexes[i]}`);
                    break;
                }
            }
        }
    }

    // Report all validation errors at once
    if (validationErrors.length > 0) {
        console.error(`❌ Sentence chunk validation failed with ${validationErrors.length} error(s):`);
        validationErrors.forEach((error, index) => {
            console.error(`  ${index + 1}. ${error}`);
        });
        return false;
    }

    return true;
}

module.exports = {
    validate,
    countWords,
    endsWithInitials,
    endsWithCommonSingleLetterWord,
    isSourceTextInContent,
    isFootnoteInContent
}; 