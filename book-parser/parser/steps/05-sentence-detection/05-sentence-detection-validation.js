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
    // Footnote patterns that should match ONLY actual footnotes:
    // ". 8 For" (period, space, number, space - classic footnote pattern)
    // ".8 For" (period, number, space - no space after period)  
    // "9 Mitchell" (start of content, number, space - footnote at beginning)
    // "(8)" (parentheses around number)
    // "[8]" (brackets around number)
    // "8." (number followed by period)

    // IMPORTANT: Avoid matching regular numbers in text like "2 per cent"

    const patterns = [
        // Pattern 1: Period followed by optional space, then number, then space
        // This matches ". 2 The" but NOT "Barely 2 per"
        new RegExp(`\\.\\s*${footnoteNumber}(?=\\s)`),

        // Pattern 2: Start of content, number followed by space and capital letter
        // This matches "2 The" at start but NOT "2 per cent" in middle
        new RegExp(`^${footnoteNumber}(?=\\s+[A-Z])`),

        // Pattern 3: Number in parentheses
        new RegExp(`\\(${footnoteNumber}\\)`),

        // Pattern 4: Number in square brackets
        new RegExp(`\\[${footnoteNumber}\\]`),

        // Pattern 5: Number followed by period at word boundary
        new RegExp(`\\b${footnoteNumber}\\.(?!\\s*per|\\s*percent)`),

        // Pattern 6: End of sentence with footnote (period, space, number at end)
        new RegExp(`\\.\\s+${footnoteNumber}\\s*$`)
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
                    const headerText = chunk.content.trim();
                    // Allow numbered headers and ALL-CAPS blocks (align with Step 4)
                    const isNumberedHeader = /^#?\d+[\.)]\s+/.test(headerText);
                    const letters = headerText.replace(/[^A-Za-z]+/g, '');
                    const upper = letters.replace(/[^A-Z]/g, '').length;
                    const isAllCapsHeader = letters.length > 0 && (upper / letters.length) >= 0.85;
                    const startsWithCapital = /^[A-Z]/.test(headerText);
                    const startsWithPageNumber = /^\d+\s+[A-Z]/.test(headerText);
                    if (!startsWithCapital && !startsWithPageNumber && !isNumberedHeader && !isAllCapsHeader) {
                        validationErrors.push(`Header ${fullChunkIdentifier} must start with a capital letter, page number + capital letter, a numbered header pattern, or be an ALL-CAPS header. Found: "${chunk.content.substring(0, 20)}..."`);
                    }
                    // Headers should have paragraphIndex: null
                    if (chunk.paragraphIndex !== null) {
                        validationErrors.push(`Header ${fullChunkIdentifier} should have paragraphIndex: null`);
                    }
                } else if (chunk.type === 'text') {
                    // Sentence chunks should start with capital letters, numbers, punctuation, quotes, mathematical symbols, etc.
                    // but NOT lowercase letters (proper text formatting)
                    const isValidStart = /[A-Z0-9'"'''""«»„"‚'‛‹›\u2018\u2019\u201C\u201D\u2013\u2014\u2015\u2026\(\)\[\]\{\},.;:!?\-–—+*/<>=~`@#$%^&|\\αβγδεζηθικλμνξοπρστυφχψωΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ∞∑∏∫∂∆∇±×÷°′″‰%‱§¶†‡•‰‱]/.test(firstChar);
                    // Allow first sentence of a chapter/section to start lowercase (orphan-letter artifact)
                    const isFirstSentenceOfChapter = /_(1|2)\b$/.test(chunkIdentifier);
                    // Or if previous non-image chunk is a header
                    let prevIsHeader = false;
                    for (let k = i - 1; k >= 0; k--) {
                        const prev = chunks[k];
                        if (!prev) break;
                        if (prev.type === 'image') continue;
                        if (prev.type === 'header') prevIsHeader = true;
                        break;
                    }
                    // Additional allowance: continuation text that legitimately starts with lowercase words  
                    const allowedLowercaseStarts = [
                        /^will\s+regenerate/i,
                        /^but\s+nothing\s+is\s+set/i,
                        /^and\s+/i,
                        /^but\s+/i,
                        /^or\s+/i,
                        /^so\s+/i,
                        /^for\s+/i,
                        /^in\s+/i,
                        /^on\s+/i,
                        /^at\s+/i,
                        /^to\s+/i,
                        /^of\s+/i,
                        /^with\s+/i,
                        /^from\s+/i,
                        /^by\s+/i,
                        /^as\s+/i,
                        /^if\s+/i,
                        /^when\s+/i,
                        /^where\s+/i,
                        /^while\s+/i,
                        /^since\s+/i,
                        /^until\s+/i,
                        /^unless\s+/i,
                        /^because\s+/i,
                        /^although\s+/i,
                        /^though\s+/i,
                        /^however\s+/i,
                        /^therefore\s+/i,
                        /^nonetheless\s+/i,
                        /^nevertheless\s+/i,
                        /^furthermore\s+/i,
                        /^moreover\s+/i,
                        /^consequently\s+/i,
                        /^accordingly\s+/i,
                        /^thus\s+/i,
                        /^hence\s+/i,
                        /^indeed\s+/i,
                        /^meanwhile\s+/i,
                        /^otherwise\s+/i,
                        /^instead\s+/i,
                        /^rather\s+/i,
                        /^than\s+/i,
                        /^then\s+/i,
                        /^now\s+/i,
                        /^here\s+/i,
                        /^there\s+/i,
                        /^this\s+/i,
                        /^that\s+/i,
                        /^these\s+/i,
                        /^those\s+/i,
                        /^they\s+/i,
                        /^we\s+/i,
                        /^you\s+/i,
                        /^it\s+/i,
                        /^he\s+/i,
                        /^she\s+/i
                    ];
                    const allowedByHeuristic = (isFirstSentenceOfChapter || prevIsHeader) && /^[a-z]/.test(chunk.content) ||
                        allowedLowercaseStarts.some(re => re.test(chunk.content));
                    if (!isValidStart && !allowedByHeuristic) {
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
                // BALANCED enforcement: Minimum 25 words, maximum 200 words for optimal processing
                if (wordCount < 25) {
                    validationErrors.push(`Text chunk ${fullChunkIdentifier} word count (${wordCount}) must be at least 25 words. Content: "${chunk.content.substring(0, 100)}..."`);
                } else if (wordCount > 200) {
                    validationErrors.push(`Text chunk ${fullChunkIdentifier} word count (${wordCount}) exceeds maximum of 200 words. Content: "${chunk.content.substring(0, 100)}..."`);
                }

                // Check if text chunk has reasonable sentence count (1 or more)
                if (chunk.sentenceCount < 1) {
                    validationErrors.push(`Text chunk ${fullChunkIdentifier} should have at least 1 sentence, found: ${chunk.sentenceCount}`);
                }

                // Check if text chunk ends with proper sentence terminator (allow realistic exceptions)
                let trimmed = chunk.content.trim();
                const endsWithEOS = /[.!?]$/.test(trimmed);
                const endsWithFootnote = /\.[\s\u00A0]*\d+$/.test(trimmed); // period + optional space + digits
                const endsWithQuoteFootnote = /[\u201D"']\s*\d+$/.test(trimmed); // closing quote followed by digits
                const endsWithClosingQuote = /[\u201D"']$/.test(trimmed); // smart/straight quote at end
                const endsWithAuthorAttribution = /[.!?]\s*[\u2014-]\s*[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,3}\s*$/.test(trimmed); // . —Name
                const isBulletListIntro = /:\s*(?:•|\u2022)/.test(trimmed); // colon followed by bullet
                const startsWithBullet = /^(?:•|\u2022)\s+\S/.test(trimmed);
                // Accept numeric citation ranges like ". 4–9"
                const endsWithRefRange = /\.[\s\u00A0]*\d+[\s\u2013\-]\d+\s*$/.test(trimmed);
                // Accept comma-separated numeric refs like "99,100"
                const endsWithRefList = /(\d+\s*,\s*)+\d+\s*$/.test(trimmed);
                // Accept resource listings (domains/available at)
                const domainMatches = (trimmed.match(/\b[a-z0-9.-]+\.(com|org|net|io|co)\b/gi) || []).length;
                const looksLikeResourceList = domainMatches >= 1 || /Available at\s+https?:\/\//i.test(trimmed) || /can be (found|purchased|ordered) at/i.test(trimmed) || /Downloadable app/i.test(trimmed);
                // Accept closing bracket if EOS before bracket
                let bracketHasEOS = false;
                if (/[)\]]$/.test(trimmed)) {
                    const withoutBracket = trimmed.replace(/[)\]]+\s*$/, '');
                    bracketHasEOS = /[.!?]\s*$/.test(withoutBracket);
                }
                // Accept image markers as valid endings (will be processed in step 5-1)
                const endsWithImageMarker = /\[\[IMG\s+id=[^\s]+\s+index=\d+\s+alt="[^"]*"\]\]\s*$/.test(trimmed);
                // Accept numbered lists as valid content that doesn't need sentence terminators
                const endsWithNumberedList = /\d+\.\s+[^\n]*$/.test(trimmed) && /\d+\.\s+[^\n]*\n\d+\.\s+/.test(trimmed);
                // Check for ellipsis inside incomplete quotes (e.g., "he wrote, 'there is only one prime cause ...")
                // This detects opening quote + content + ellipsis without proper closing quote
                const hasIncompleteQuoteWithEllipsis = /[\u2018\u2019\u201C\u201D"'`'][^'\u2019\u201D"]*\.{3}\s*$/.test(trimmed);

                if (wordCount > 3 && !(endsWithEOS || endsWithFootnote || endsWithQuoteFootnote || endsWithClosingQuote || endsWithAuthorAttribution || isBulletListIntro || startsWithBullet || endsWithRefRange || endsWithRefList || looksLikeResourceList || bracketHasEOS || endsWithImageMarker || endsWithNumberedList || hasIncompleteQuoteWithEllipsis) && !endsWithCommonSingleLetterWord(trimmed)) {
                    validationErrors.push(`Text chunk ${fullChunkIdentifier} should end with sentence terminator. Content: "${chunk.content}"`);
                }

                // Check that text content contains no newline characters
                // EXCEPT for numbered lists which preserve formatting newlines
                const hasNumberedList = /\d+\.\s+[^\n]*\n\d+\.\s+/.test(chunk.content);
                if (chunk.content.includes('\n') && !hasNumberedList) {
                    validationErrors.push(`Text chunk ${fullChunkIdentifier} should not contain newline characters. Content: "${chunk.content}"`);
                }
            }

            if (chunk.type === 'header') {
                const headerText = chunk.content.trim();
                const isNumberedHeader = /^#?\d+[\.)]\s+/.test(headerText);
                const letters = headerText.replace(/[^A-Za-z]+/g, '');
                const upper = letters.replace(/[^A-Z]/g, '').length;
                const isAllCapsHeader = letters.length > 0 && (upper / letters.length) >= 0.85;
                const minWords = 1;
                const maxWords = isNumberedHeader ? 12 : (isAllCapsHeader ? 20 : 5);
                if (wordCount < minWords || wordCount > maxWords) {
                    validationErrors.push(`Header ${fullChunkIdentifier} word count (${wordCount}) must be between ${minWords} and ${maxWords} words. Content: "${chunk.content}"`);
                }
            }

            // 5. link text validation - ensure all link text is actually present in chunk content
            if (chunk.links && chunk.links.length > 0) {
                for (const link of chunk.links) {
                    if (!isSourceTextInContent(link.text, chunk.content)) {
                        validationErrors.push(`Link text "${link.text}" not found in ${fullChunkIdentifier} content`);
                    }

                    // 6. chunk reference validation (added by step 5.1)
                    if (link.targetChunkId && (typeof link.targetChunkId !== 'string' || !link.targetChunkId.includes('_'))) {
                        validationErrors.push(`Link in ${fullChunkIdentifier} has invalid targetChunkId format: ${link.targetChunkId}`);
                    }

                    if (link.sourceChunkId && (typeof link.sourceChunkId !== 'string' || !link.sourceChunkId.includes('_'))) {
                        validationErrors.push(`Link in ${fullChunkIdentifier} has invalid sourceChunkId format: ${link.sourceChunkId}`);
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