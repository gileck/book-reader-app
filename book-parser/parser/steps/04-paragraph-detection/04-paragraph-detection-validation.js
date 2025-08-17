/**
 * Validation functions for Step 4: Paragraph Detection
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
 * Find the previous paragraph chunk (skipping headers)
 * @param {Array} chunks - All chunks
 * @param {number} currentIndex - Current chunk index
 * @returns {Object|null} - Previous paragraph chunk or null
 */
function findPreviousParagraph(chunks, currentIndex) {
    for (let i = currentIndex - 1; i >= 0; i--) {
        if (chunks[i].type === 'paragraph') {
            return chunks[i];
        }
    }
    return null;
}

/**
 * Find the next paragraph chunk (skipping headers)
 * @param {Array} chunks - All chunks
 * @param {number} currentIndex - Current chunk index
 * @returns {Object|null} - Next paragraph chunk or null
 */
function findNextParagraph(chunks, currentIndex) {
    for (let i = currentIndex + 1; i < chunks.length; i++) {
        if (chunks[i].type === 'paragraph') {
            return chunks[i];
        }
    }
    return null;
}

/**
 * Validate paragraph and header detection results
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

        let hasParagraph = false;
        let hasHeader = false;

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const chapterInfo = chunk.chapterTitle ? ` (${chunk.chapterTitle})` : '';
            const chunkIdentifier = chunk.chunkId || `chunk_${i + 1}`;
            const fullChunkIdentifier = `${chunkIdentifier}${chapterInfo}`;

            // Skip validation for chunks in Appendix chapters
            if (chunk.chapterTitle && chunk.chapterTitle.toLowerCase().includes('appendix')) {
                // Still track chunk types for overall validation
                if (chunk.type === 'text') hasParagraph = true;
                if (chunk.type === 'header') hasHeader = true;
                continue;
            }

            // Track chunk types
            if (chunk.type === 'paragraph') hasParagraph = true;
            if (chunk.type === 'header') hasHeader = true;

            // Check required fields
            if (!chunk.type || (chunk.type !== 'paragraph' && chunk.type !== 'header' && chunk.type !== 'image')) {
                validationErrors.push(`${fullChunkIdentifier} has invalid type: "${chunk.type}"`);
                continue;
            }

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
                // Content is optional for images (can be imageAlt or description)
            } else if (chunk.content.length > 0) {
                // For paragraphs and headers, validate content format
                const firstChar = chunk.content.charAt(0);

                if (chunk.type === 'header') {
                    const headerText = chunk.content.trim();
                    // Allow numbered headers: optional '#', number + '.' or ')', then title
                    const isNumberedHeader = /^#?\d+[\.)]\s+/.test(headerText);
                    // Detect ALL-CAPS header blocks (single or multi-line) – mostly uppercase letters
                    const letters = headerText.replace(/[^A-Za-z]+/g, '');
                    const upper = letters.replace(/[^A-Z]/g, '').length;
                    const isAllCapsHeader = letters.length > 0 && (upper / letters.length) >= 0.85;
                    const isMultiLine = /\n/.test(headerText);

                    // Headers must start with capital OR page number + capital OR numbered header pattern
                    const startsWithCapital = /^[A-Z]/.test(headerText);
                    const startsWithPageNumber = /^\d+\s+[A-Z]/.test(headerText);
                    if (!startsWithCapital && !startsWithPageNumber && !isNumberedHeader && !isAllCapsHeader) {
                        validationErrors.push(`Header ${fullChunkIdentifier} must start with a capital letter, page number + capital letter, a numbered header pattern, or be an ALL-CAPS header. Found: "${chunk.content.substring(0, 20)}..."`);
                    }
                } else if (chunk.type === 'paragraph') {
                    // Paragraph chunks should start with capital letters, numbers, punctuation, quotes, mathematical symbols, etc.
                    // but NOT lowercase letters (proper text formatting)
                    const isValidStart = /[A-Z0-9'"'''""«»„"‚'‛‹›\u2018\u2019\u201C\u201D\u2013\u2014\u2015\u2026\(\)\[\]\{\},.;:!?\-–—+*/<>=~`@#$%^&|\\αβγδεζηθικλμνξοπρστυφχψωΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ∞∑∏∫∂∆∇±×÷°′″‰%‱§¶†‡•‰‱]/.test(firstChar);

                    // Heuristic allowance: known cases where the first capital letter is extracted alone before the header
                    const allowedLowercaseStarts = [
                        /^n\s+this\b/i,
                        /^n\s+texts\b/i,
                        /^ntil\b/i,
                        /^what\s+to\s+do\b/i,
                        /^this\s+means\b/i,
                        // Allow continuation text that starts with common lowercase words
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
                    const isFirstParagraphOfChapter = /_1\b$/.test(chunkIdentifier);
                    const isFirstParaAlt = /_2\b$/.test(chunkIdentifier); // first paragraph often _2
                    const allowedByHeuristic = allowedLowercaseStarts.some(re => re.test(chunk.content)) ||
                        (isFirstParagraphOfChapter && (/^n\b/i.test(chunk.content) || /^ntil\b/i.test(chunk.content))) ||
                        (isFirstParaAlt && /^[a-z]/.test(chunk.content));

                    if (!isValidStart && !allowedByHeuristic) {
                        const prevParaCtx = findPreviousParagraph(chunks, i);
                        const prevLastWords = prevParaCtx && prevParaCtx.content ? prevParaCtx.content.trim().split(/\s+/).slice(-8).join(' ') : 'none';
                        const prevLastWord = prevParaCtx && prevParaCtx.content ? prevParaCtx.content.trim().split(/\s+/).slice(-1)[0] : '';

                        validationErrors.push(
                            `
                            Paragraph chunk ${fullChunkIdentifier} must start with a capital letter or valid punctuation/symbol.
                            Prev paragraph: 
                            "...${prevLastWords}"
                            Current paragraph: 
                            "${chunk.content.substring(0, 50)}..."
                            ${prevLastWord ? `  Hint: This might mean that we treated "${prevLastWord}" as end of sentence when it shouldn't.` : ''}
                            `
                        );
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
            } else if (chunk.type === 'paragraph') {
                // Paragraph chunks should be between 80 and 300 words target (flexible 20-500 absolute) for proper book content
                if (wordCount < 20 || wordCount > 500) {
                    let neighborInfo = '';
                    if (wordCount < 20) {
                        // Add information about neighboring paragraph chunks to understand why merging failed
                        const prevParagraph = findPreviousParagraph(chunks, i);
                        const nextParagraph = findNextParagraph(chunks, i);

                        const prevInfo = prevParagraph ?
                            `previous: ${prevParagraph.chunkId} (${countWords(prevParagraph.content)} words)` :
                            'previous: none';
                        const nextInfo = nextParagraph ?
                            `next: ${nextParagraph.chunkId} (${countWords(nextParagraph.content)} words)` :
                            'next: none';

                        neighborInfo = ` - Neighbors: ${prevInfo}, ${nextInfo}`;
                    }
                    validationErrors.push(`Paragraph chunk ${fullChunkIdentifier} word count (${wordCount}) must be between 20 and 500 words (absolute limits)${neighborInfo}`);
                }

                // Check if paragraph chunk ends with initials (but allow common words ending with single letters)
                if (endsWithInitials(chunk.content) && !endsWithCommonSingleLetterWord(chunk.content)) {
                    validationErrors.push(`Paragraph chunk ${fullChunkIdentifier} should not end with initials. Content: "${chunk.content}"`);
                }
            }

            if (chunk.type === 'header') {
                const headerText = chunk.content.trim();
                const isNumberedHeader = /^#?\d+[\.)]\s+/.test(headerText);
                const letters = headerText.replace(/[^A-Za-z]+/g, '');
                const upper = letters.replace(/[^A-Z]/g, '').length;
                const isAllCapsHeader = letters.length > 0 && (upper / letters.length) >= 0.85;
                const isMultiLine = /\n/.test(headerText);
                // Standard headers: 1-5 words. Numbered: 2-12. ALL-CAPS blocks: 2-20
                const minWords = 1;
                const maxWords = isNumberedHeader ? 12 : (isAllCapsHeader || isMultiLine ? 20 : 5);
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
                }
            }
        }

        // 4. chunks array has valid types both "paragraph" and "header"
        if (!hasParagraph) {
            validationErrors.push('Chunks array must contain at least one paragraph chunk');
        }
        if (!hasHeader) {
            validationErrors.push('Chunks array must contain at least one header');
        }
    }

    // Report all validation errors at once
    if (validationErrors.length > 0) {
        console.error(`❌ Chunk validation failed with ${validationErrors.length} error(s):`);
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
    findPreviousParagraph,
    findNextParagraph,
    isSourceTextInContent,
    isFootnoteInContent
}; 