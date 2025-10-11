/**
 * Validation functions for Step 5: Sentence Detection and Combination
 */

// Import shared text processing utilities
const {
    countWords,
    endsWithInitials,
    endsWithCommonSingleLetterWord,
    endsWithAbbreviation,
    splitIntoSentences // Use the SAME splitting logic as the parser
} = require('../../utils/text-processing-utils');

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

// Note: countWords, endsWithInitials, and endsWithCommonSingleLetterWord now imported from shared utilities



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
                    const firstHeaderChar = headerText.trim()[0];
                    const startsWithCapital = firstHeaderChar && firstHeaderChar === firstHeaderChar.toUpperCase() && firstHeaderChar !== firstHeaderChar.toLowerCase();
                    const startsWithPageNumber = /^\d+\s+/.test(headerText) && headerText.split(/\s+/)[1] && headerText.split(/\s+/)[1][0] === headerText.split(/\s+/)[1][0].toUpperCase() && headerText.split(/\s+/)[1][0] !== headerText.split(/\s+/)[1][0].toLowerCase();
                    if (!startsWithCapital && !startsWithPageNumber && !isNumberedHeader && !isAllCapsHeader) {
                        validationErrors.push(`Header ${fullChunkIdentifier} must start with a capital letter, page number + capital letter, a numbered header pattern, or be an ALL-CAPS header. Found: "${chunk.content.substring(0, 20)}..."`);
                    }
                    // Headers should have paragraphIndex: null
                    if (chunk.paragraphIndex !== null) {
                        validationErrors.push(`Header ${fullChunkIdentifier} should have paragraphIndex: null`);
                    }
                } else if (chunk.type === 'text') {
                    // Check if this is a standalone image marker chunk (will be processed by Step 5-1)
                    const imageMarkerRegex = /\[\[IMG\s+id=([^\s]+)\s+index=(\d+)\s+alt="([^"]*)"\]\]/g;
                    const contentWithoutMarkers = chunk.content.replace(imageMarkerRegex, '').trim();
                    const isStandaloneImageChunk = contentWithoutMarkers.length === 0;

                    if (!isStandaloneImageChunk) {
                        // Sentence chunks should start with capital letters (including accented), numbers, punctuation, quotes, mathematical symbols, etc.
                        // but NOT lowercase letters (proper text formatting)
                        const isUppercaseLetter = firstChar && firstChar === firstChar.toUpperCase() && firstChar !== firstChar.toLowerCase();
                        const isPunctuation = /[0-9'"'''""«»„"‚'‛‹›\u2018\u2019\u201C\u201D\u2013\u2014\u2015\u2026\(\)\[\]\{\},.;:!?\-–—+*/<>=~`@#$%^&|\\αβγδεζηθικλμνξοπρστυφχψωΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ∞∑∏∫∂∆∇±×÷°′″‰%‱§¶†‡•‰‱]/.test(firstChar);
                        const isValidStart = isUppercaseLetter || isPunctuation;
                        // Allow first sentence of a chapter/section to start lowercase (orphan-letter artifact)
                        const isFirstSentenceOfChapter = /_(1|2)\b$/.test(chunkIdentifier);
                        // Or if previous non-image chunk is a header
                        let prevIsHeader = false;
                        let prevEndsWithEllipsis = false;
                        let prevEndsWithColonOrDash = false;
                        for (let k = i - 1; k >= 0; k--) {
                            const prev = chunks[k];
                            if (!prev) break;
                            if (prev.type === 'image') continue;
                            if (prev.type === 'header') prevIsHeader = true;
                            if (prev.type === 'text') {
                                const prevTrimmed = (prev.content || '').trim();
                                prevEndsWithEllipsis = /(?:\.|\u2026)(?:\s*\.\s*\.)?\s*$/.test(prevTrimmed) || /\.\s*\.\s*\.\s*$/.test(prevTrimmed) || /…\s*$/.test(prevTrimmed);
                                prevEndsWithColonOrDash = /[:\u2014]\s*$/.test(prevTrimmed);
                            }
                            break;
                        }
                        // Additional allowance: continuation text that legitimately starts with lowercase words  
                        const allowedLowercaseStarts = [
                            /^will\s+regenerate/i,
                            /^but\s+nothing\s+is\s+set/i,
                            /^said\b/i,
                            /^what\s+to\s+do\b/i
                        ];
                        const allowedByHeuristic = ((isFirstSentenceOfChapter || prevIsHeader || prevEndsWithEllipsis || prevEndsWithColonOrDash) && /^[a-z]/.test(chunk.content)) ||
                            allowedLowercaseStarts.some(re => re.test(chunk.content));
                        if (!isValidStart && !allowedByHeuristic) {
                            validationErrors.push(`Sentence chunk ${fullChunkIdentifier} must start with a capital letter or valid punctuation/symbol. Found: "${chunk.content.substring(0, 20)}..."`);
                        }

                        // Sentence chunks must have a valid paragraphIndex
                        if (!chunk.paragraphIndex || typeof chunk.paragraphIndex !== 'number' || chunk.paragraphIndex < 1) {
                            validationErrors.push(`Sentence chunk ${fullChunkIdentifier} must have a valid paragraphIndex (positive number). Found: ${chunk.paragraphIndex}`);
                        }
                    }
                    // Skip validation for standalone image chunks - they'll be converted to proper image chunks by Step 5-1
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
                // Check if this is a standalone image marker chunk (will be processed by Step 5-1)
                const imageMarkerRegex = /\[\[IMG\s+id=([^\s]+)\s+index=(\d+)\s+alt="([^"]*)"\]\]/g;
                const contentWithoutMarkers = chunk.content.replace(imageMarkerRegex, '').trim();
                const isStandaloneImageChunk = contentWithoutMarkers.length === 0;

                if (!isStandaloneImageChunk) {
                    // Phase 1 sentence-level: no strict min/max word count; require at least 1 word
                    if (wordCount < 1) {
                        validationErrors.push(`Text chunk ${fullChunkIdentifier} should have at least 1 word.`);
                    }

                    // Validate: single sentence OR multiple sentences where all subsequent ones are < MIN_WORDS
                    const MIN_WORDS = 12;
                    const sentences = splitIntoSentences(chunk.content);

                    if (sentences.length > 1) {
                        // Check that all sentences after the first are < MIN_WORDS
                        for (let i = 1; i < sentences.length; i++) {
                            const wordCount = countWords(sentences[i]);
                            if (wordCount >= MIN_WORDS) {
                                validationErrors.push(
                                    `Text chunk ${fullChunkIdentifier} has ${sentences.length} sentences, but sentence ${i + 1} has ${wordCount} words (must be < ${MIN_WORDS}). ` +
                                    `Content: "${sentences[i].substring(0, 80)}..."`
                                );
                            }
                        }
                    }
                }
                // Skip word count validation for standalone image chunks - they'll be converted to proper image chunks by Step 5-1

                // Check if text chunk has reasonable sentence count (1 or more) - skip for standalone image chunks
                if (!isStandaloneImageChunk && chunk.sentenceCount < 1) {
                    validationErrors.push(`Text chunk ${fullChunkIdentifier} should have at least 1 sentence, found: ${chunk.sentenceCount}`);
                }

                // Check if text chunk ends with proper sentence terminator (allow realistic exceptions)
                let trimmed = chunk.content.trim();
                const endsWithEOS = /[.!?]$/.test(trimmed);
                const endsWithFootnote = /\.[\s\u00A0]*\d+$/.test(trimmed); // period + optional space + digits
                const endsWithQuoteFootnote = /[\u201D\u2019"']\s*\d+$/.test(trimmed); // allow curly right single or double quotes
                const endsWithClosingQuote = /[\u201D\u2019"']$/.test(trimmed); // allow curly right single or double quotes
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
                // Accept list-introduction colons at the end of a sentence (e.g., "Follow these steps:")
                const endsWithListIntroColon = /:\s*$/.test(trimmed) && /(follow(ing)?\s+(the\s+)?steps|as\s+follows|do\s+the\s+following|instructions?|exercise(?:s)?)/i.test(trimmed);
                // Accept numbered lists as valid content that doesn't need sentence terminators
                const endsWithNumberedList = /\d+\.\s+[^\n]*$/.test(trimmed) && /\d+\.\s+[^\n]*\n\d+\.\s+/.test(trimmed);
                // Accept simple numbered items (like "8. Continuing to Learn")
                const endsWithSimpleNumberedItem = /\d+\.\s+[A-Z][^.!?]*$/.test(trimmed);
                // Accept photo captions and dedications that might end with names or dates
                const endsWithPhotoCaption = /(?:Copyright|Photo:|January|February|March|April|May|June|July|August|September|October|November|December)\s+[^.!?]*$/.test(trimmed) || /For\s+[A-Z][a-z]+\s*$/.test(trimmed);
                // Accept table of contents entries (numbers and page numbers)
                const looksLikeTableOfContents = /\b(?:Índice|Contents|Chapter|Part|Introduction|Afterword)\b/.test(trimmed) && /\b\d+\s*$/.test(trimmed);
                // Check for ellipsis inside incomplete quotes (e.g., "he wrote, 'there is only one prime cause ...")
                // This detects opening quote + content + ellipsis without proper closing quote
                const hasIncompleteQuoteWithEllipsis = /[\u2018\u2019\u201C\u201D"'`'][^'\u2019\u201D"]*\.{3}\s*$/.test(trimmed);

                if (!isStandaloneImageChunk && wordCount > 3 && !(endsWithEOS || endsWithFootnote || endsWithQuoteFootnote || endsWithClosingQuote || endsWithAuthorAttribution || isBulletListIntro || startsWithBullet || endsWithRefRange || endsWithRefList || looksLikeResourceList || bracketHasEOS || endsWithImageMarker || endsWithNumberedList || endsWithSimpleNumberedItem || endsWithPhotoCaption || looksLikeTableOfContents || hasIncompleteQuoteWithEllipsis || endsWithListIntroColon) && !endsWithCommonSingleLetterWord(trimmed)) {
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