/**
 * Step 6: Metadata Extraction
 * 
 * Extract comprehensive book metadata from the parsed content including title, author,
 * publication information, and calculated statistics.
 * 
 * Process:
 * 1. Extract title from text patterns and chapter content
 * 2. Extract author information from text patterns
 * 3. Detect language and publication details
 * 4. Calculate book statistics (word count, chapter count, etc.)
 * 5. Create comprehensive metadata object
 * 
 * Input: Pipeline state with chapters and raw text
 * Output: Updated pipeline state with comprehensive metadata object
 */

const fs = require('fs');
const path = require('path');

/**
 * Execute metadata extraction step
 * @param {Object} pipelineState - Current pipeline state
 * @param {Object} config - Configuration object
 * @returns {Object} - Updated pipeline state with metadata
 */
async function execute(pipelineState, config) {
    const startTime = Date.now();

    try {
        // Validate prerequisites
        if (!pipelineState.chapters || pipelineState.chapters.length === 0) {
            throw new Error('Step 5 (sentence detection) must be completed first. No chapters found in pipeline state.');
        }

        if (!pipelineState.rawText) {
            throw new Error('Raw text is required for metadata extraction. Ensure step 1 (text extraction) was completed.');
        }

        // Extract title
        const title = extractTitle(pipelineState.rawText, pipelineState.chapters);

        // Extract author
        const author = extractAuthor(pipelineState.rawText);

        // Extract publication info
        const publicationInfo = extractPublicationInfo(pipelineState.rawText);

        // Calculate statistics
        const statistics = calculateStatistics(pipelineState.chapters);

        // Detect language
        const language = detectLanguage(pipelineState.rawText);

        // Create comprehensive metadata object
        const metadata = {
            // Basic book information
            title: title,
            author: author,
            language: language,

            // Publication information
            publisher: publicationInfo.publisher,
            publicationYear: publicationInfo.year,
            isbn: publicationInfo.isbn,
            edition: publicationInfo.edition,

            // Book statistics
            totalChapters: statistics.totalChapters,
            totalWords: statistics.totalWords,
            totalSentences: statistics.totalSentences,
            totalParagraphs: statistics.totalParagraphs,
            totalImages: statistics.totalImages,
            totalLinks: statistics.totalLinks,
            averageWordsPerChapter: statistics.averageWordsPerChapter,
            averageWordsPerParagraph: statistics.averageWordsPerParagraph,

            // Processing metadata
            extractedAt: new Date().toISOString(),
            parserVersion: 2,

            // Content structure
            chapterTitles: statistics.chapterTitles,
            hasTableOfContents: detectTableOfContents(pipelineState.rawText),
            hasIndex: detectIndex(pipelineState.rawText),
            hasImages: statistics.totalImages > 0,
            hasLinks: statistics.totalLinks > 0
        };

        // Save debug information
        const debugInfo = {
            titleCandidates: extractTitleCandidates(pipelineState.rawText),
            authorCandidates: extractAuthorCandidates(pipelineState.rawText),
            publicationMatches: publicationInfo.matches || [],
            languageConfidence: detectLanguageConfidence(pipelineState.rawText),
            processingTime: Date.now() - startTime
        };

        if (config.DEBUG_DIR) {
            const debugFile = path.join(config.DEBUG_DIR, 'step-05-metadata-extraction.json');
            fs.writeFileSync(debugFile, JSON.stringify(debugInfo, null, 2));
        }



        return {
            ...pipelineState,
            metadata: metadata,
            debug: {
                ...pipelineState.debug,
                metadataExtraction: debugInfo
            }
        };

    } catch (error) {
        console.error('❌ Metadata extraction failed:', error.message);
        throw error;
    }
}

/**
 * Extract book title from text and chapters
 */
function extractTitle(rawText, chapters) {
    // Look for title patterns in order of preference
    const titleCandidates = extractTitleCandidates(rawText);

    if (titleCandidates.length > 0) {
        return titleCandidates[0].text;
    }

    // Fallback to first chapter title if it looks like a book title
    if (chapters.length > 0 && chapters[0].title) {
        const firstTitle = chapters[0].title;
        if (!firstTitle.toLowerCase().includes('chapter') &&
            !firstTitle.toLowerCase().includes('introduction') &&
            firstTitle.length > 5) {
            return firstTitle;
        }
    }

    return 'Unknown Title';
}

/**
 * Extract title candidates with confidence scores
 */
function extractTitleCandidates(rawText) {
    const candidates = [];

    // Split into pages for analysis
    const pages = rawText.split(/--- PAGE \d+ ---/);
    const firstPages = pages.slice(0, 10).join('\n'); // First 10 pages

    // Pattern 1: Title page patterns (high confidence)
    const titlePagePatterns = [
        /^([A-Z][A-Z\s:]{10,80})\s*$/gm, // All caps titles
        /(?:^|\n)([A-Z][^.\n]{15,80})\s*\n\s*(?:by\s+|author|written)/im, // Title followed by author
        /(?:^|\n)([A-Z][^.\n]{10,60})\s*\n\s*(?:The|A)\s+(?:complete|definitive|essential)/im // Title with subtitle
    ];

    titlePagePatterns.forEach((pattern, index) => {
        let match;
        while ((match = pattern.exec(firstPages)) !== null) {
            const title = match[1].trim();
            if (isValidTitle(title)) {
                candidates.push({
                    text: title,
                    confidence: 0.9 - (index * 0.1),
                    source: 'title_page_pattern',
                    pattern: index
                });
            }
        }
    });

    // Pattern 2: Copyright page patterns (medium confidence)
    const copyrightPatterns = [
        /©[^,\n]*?(\d{4})[^,\n]*?([A-Z][^.\n]{10,60})/g,
        /Copyright[^,\n]*?(\d{4})[^,\n]*?([A-Z][^.\n]{10,60})/g
    ];

    copyrightPatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(firstPages)) !== null) {
            const title = match[2].trim();
            if (isValidTitle(title)) {
                candidates.push({
                    text: title,
                    confidence: 0.7,
                    source: 'copyright_page',
                    year: match[1]
                });
            }
        }
    });

    // Sort by confidence and remove duplicates
    const uniqueCandidates = [];
    const seen = new Set();

    candidates.sort((a, b) => b.confidence - a.confidence);

    for (const candidate of candidates) {
        const normalized = candidate.text.toLowerCase().replace(/\s+/g, ' ').trim();
        if (!seen.has(normalized) && normalized.length > 5) {
            seen.add(normalized);
            uniqueCandidates.push(candidate);
        }
    }

    return uniqueCandidates.slice(0, 5); // Top 5 candidates
}

/**
 * Validate if a string looks like a valid book title
 */
function isValidTitle(title) {
    if (!title || title.length < 3 || title.length > 100) return false;

    // Filter out common non-title patterns
    const excludePatterns = [
        /^\d+$/, // Just numbers
        /^page\s+\d+/i,
        /^chapter\s+\d+/i,
        /^table\s+of\s+contents/i,
        /^index$/i,
        /^bibliography$/i,
        /^references$/i,
        /^appendix/i,
        /^www\./i,
        /^http/i,
        /^\s*$/ // Empty or whitespace
    ];

    return !excludePatterns.some(pattern => pattern.test(title));
}

/**
 * Extract author information
 */
function extractAuthor(rawText) {
    const authorCandidates = extractAuthorCandidates(rawText);

    if (authorCandidates.length > 0) {
        return authorCandidates[0].text;
    }

    return 'Unknown Author';
}

/**
 * Extract author candidates
 */
function extractAuthorCandidates(rawText) {
    const candidates = [];
    const firstPages = rawText.split(/--- PAGE \d+ ---/).slice(0, 10).join('\n');

    // Pattern 1: Copyright page author (HIGHEST PRIORITY)
    const copyrightPatterns = [
        /copyright[^,\n]*?©[^,\n]*?([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi,
        /©[^,\n]*?(\d{4})[^,\n]*?([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi,
        /the\s+right\s+of\s+([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+to\s+be\s+identified\s+as\s+the\s+author/gi
    ];

    copyrightPatterns.forEach((pattern, index) => {
        let match;
        while ((match = pattern.exec(firstPages)) !== null) {
            const author = match[match.length - 1].trim(); // Get the last capture group
            if (isValidAuthor(author)) {
                candidates.push({
                    text: author,
                    confidence: 0.95 - (index * 0.05), // Very high confidence for copyright
                    source: 'copyright'
                });
            }
        }
    });

    // Pattern 2: Author name in all caps (MEDIUM-HIGH PRIORITY)
    const allCapsPattern = /(?:^|\n)\s*([A-Z]{2,}\s+[A-Z]{2,}(?:\s+[A-Z]{2,})?)\s*(?:\n|$)/gm;
    let match;
    while ((match = allCapsPattern.exec(firstPages)) !== null) {
        const author = match[1].trim();
        if (isValidAuthor(author) && !isInPraiseContext(firstPages, match.index)) {
            candidates.push({
                text: toTitleCase(author),
                confidence: 0.8,
                source: 'all_caps'
            });
        }
    }

    // Pattern 3: "by Author Name" patterns (MEDIUM PRIORITY)
    const byPatterns = [
        /(?:^|\n)\s*(?:by|author|written\s+by)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]*)*(?:\s+[A-Z][a-z]+)*)/gim
    ];

    byPatterns.forEach((pattern, index) => {
        let match;
        while ((match = pattern.exec(firstPages)) !== null) {
            const author = match[1].trim();
            if (isValidAuthor(author) && !isInPraiseContext(firstPages, match.index)) {
                candidates.push({
                    text: author,
                    confidence: 0.7 - (index * 0.1),
                    source: 'by_pattern'
                });
            }
        }
    });

    // Remove duplicates and sort by confidence
    const uniqueCandidates = [];
    const seen = new Set();

    candidates.sort((a, b) => b.confidence - a.confidence);

    for (const candidate of candidates) {
        const normalized = candidate.text.toLowerCase();
        if (!seen.has(normalized)) {
            seen.add(normalized);
            uniqueCandidates.push(candidate);
        }
    }

    return uniqueCandidates.slice(0, 3);
}

/**
 * Validate if a string looks like a valid author name
 */
function isValidAuthor(author) {
    if (!author || author.length < 3 || author.length > 50) return false;

    // Must have at least first and last name
    const words = author.trim().split(/\s+/);
    if (words.length < 2) return false;

    // Filter out common non-author patterns
    const excludePatterns = [
        /^the\s/i,
        /^chapter\s/i,
        /^page\s/i,
        /^copyright/i,
        /^all\s+rights/i,
        /^published/i,
        /^\d/
    ];

    return !excludePatterns.some(pattern => pattern.test(author));
}

/**
 * Extract publication information
 */
function extractPublicationInfo(rawText) {
    const firstPages = rawText.split(/--- PAGE \d+ ---/).slice(0, 10).join('\n');

    const info = {
        publisher: null,
        year: null,
        isbn: null,
        edition: null,
        matches: []
    };

    // Extract publisher
    const publisherPattern = /(?:published\s+by|publisher:?)\s+([A-Z][^.\n]{5,40})/gi;
    let match = publisherPattern.exec(firstPages);
    if (match) {
        info.publisher = match[1].trim();
        info.matches.push({ type: 'publisher', text: match[0] });
    }

    // Extract year
    const yearPattern = /(?:copyright|©|published)\s*(?:in\s*)?(\d{4})/gi;
    match = yearPattern.exec(firstPages);
    if (match) {
        info.year = parseInt(match[1]);
        info.matches.push({ type: 'year', text: match[0] });
    }

    // Extract ISBN
    const isbnPattern = /ISBN[:\s]*([0-9\-X]{10,17})/gi;
    match = isbnPattern.exec(firstPages);
    if (match) {
        info.isbn = match[1].replace(/\-/g, '');
        info.matches.push({ type: 'isbn', text: match[0] });
    }

    // Extract edition
    const editionPattern = /(\d+)(?:st|nd|rd|th)\s+edition/gi;
    match = editionPattern.exec(firstPages);
    if (match) {
        info.edition = parseInt(match[1]);
        info.matches.push({ type: 'edition', text: match[0] });
    }

    return info;
}

/**
 * Calculate book statistics from chapters
 */
function calculateStatistics(chapters) {
    let totalWords = 0;
    let totalSentences = 0;
    let totalImages = 0;
    let totalLinks = 0;
    const chapterTitles = [];
    const uniqueParagraphIndexes = new Set();

    chapters.forEach(chapter => {
        chapterTitles.push(chapter.title);

        if (chapter.chunks) {
            chapter.chunks.forEach(chunk => {
                totalWords += chunk.wordCount || 0;
                totalSentences += chunk.sentenceCount || 0;

                if (chunk.type === 'text' && chunk.paragraphIndex) {
                    // Count unique paragraph indexes to get true paragraph count
                    uniqueParagraphIndexes.add(`${chapter.chapterNumber}_${chunk.paragraphIndex}`);
                } else if (chunk.type === 'image') {
                    totalImages++;
                }

                if (chunk.links && Array.isArray(chunk.links)) {
                    totalLinks += chunk.links.length;
                }
            });
        }
    });

    const totalParagraphs = uniqueParagraphIndexes.size;

    return {
        totalChapters: chapters.length,
        totalWords,
        totalSentences,
        totalParagraphs,
        totalImages,
        totalLinks,
        averageWordsPerChapter: chapters.length > 0 ? Math.round(totalWords / chapters.length) : 0,
        averageWordsPerParagraph: totalParagraphs > 0 ? Math.round(totalWords / totalParagraphs) : 0,
        chapterTitles
    };
}

/**
 * Detect document language
 */
function detectLanguage(rawText) {
    // Simple language detection based on common words
    const sample = rawText.substring(0, 5000).toLowerCase();

    const englishWords = ['the', 'and', 'that', 'have', 'for', 'not', 'with', 'you', 'this', 'but'];
    const englishCount = englishWords.reduce((count, word) => {
        return count + (sample.match(new RegExp(`\\b${word}\\b`, 'g')) || []).length;
    }, 0);

    // For now, default to English. Could be extended for other languages
    return englishCount > 10 ? 'en' : 'unknown';
}

/**
 * Detect language with confidence score
 */
function detectLanguageConfidence(rawText) {
    const sample = rawText.substring(0, 5000).toLowerCase();
    const englishWords = ['the', 'and', 'that', 'have', 'for', 'not', 'with', 'you', 'this', 'but'];
    const totalWords = sample.split(/\s+/).length;
    const englishMatches = englishWords.reduce((count, word) => {
        return count + (sample.match(new RegExp(`\\b${word}\\b`, 'g')) || []).length;
    }, 0);

    return {
        language: 'en',
        confidence: Math.min(englishMatches / totalWords * 10, 1),
        matches: englishMatches,
        totalWords
    };
}

/**
 * Detect if document has table of contents
 */
function detectTableOfContents(rawText) {
    const tocPatterns = [
        /table\s+of\s+contents/i,
        /contents\s*\n(?:\s*\n)*(?:\s*chapter|.*\.{3,})/i
    ];

    return tocPatterns.some(pattern => pattern.test(rawText));
}

/**
 * Detect if document has an index
 */
function detectIndex(rawText) {
    const indexPatterns = [
        /\bindex\s*\n(?:\s*\n)*\s*[A-Z]/i,
        /\bindex\s*$.*\n.*\n.*\d+/im
    ];

    return indexPatterns.some(pattern => pattern.test(rawText));
}

/**
 * Validate the metadata extraction results
 * @param {Object} result - The result from execute()
 * @returns {boolean} - True if validation passes
 */
function validate(result) {
    try {
        // Check that metadata object exists
        if (!result.metadata || typeof result.metadata !== 'object') {
            console.error('❌ Metadata object missing or invalid');
            return false;
        }

        const metadata = result.metadata;

        // Check required fields
        const requiredFields = ['title', 'author', 'language', 'totalChapters', 'totalWords', 'extractedAt'];
        for (const field of requiredFields) {
            if (!(field in metadata)) {
                console.error(`❌ Required metadata field missing: ${field}`);
                return false;
            }
        }

        // Validate data types
        if (typeof metadata.title !== 'string' || metadata.title.length === 0) {
            console.error('❌ Invalid title in metadata');
            return false;
        }

        if (typeof metadata.author !== 'string' || metadata.author.length === 0) {
            console.error('❌ Invalid author in metadata');
            return false;
        }

        if (typeof metadata.totalChapters !== 'number' || metadata.totalChapters < 0) {
            console.error('❌ Invalid totalChapters in metadata');
            return false;
        }

        if (typeof metadata.totalWords !== 'number' || metadata.totalWords < 0) {
            console.error('❌ Invalid totalWords in metadata');
            return false;
        }



        return true;

    } catch (error) {
        console.error('❌ Metadata extraction validation error:', error.message);
        return false;
    }
}

/**
 * Check if a name appears in a praise/quote context
 */
function isInPraiseContext(text, position) {
    // Get context around the position
    const contextStart = Math.max(0, position - 200);
    const contextEnd = Math.min(text.length, position + 200);
    const context = text.substring(contextStart, contextEnd).toLowerCase();

    // Check for praise/quote indicators
    const praiseIndicators = [
        'praise for',
        'reviews',
        'what they\'re saying',
        'acclaim for',
        'advance praise',
        'early praise',
        'quotes',
        'testimonials',
        'author of',
        'i would like to thank',
        'acknowledgments',
        'acknowledgements'
    ];

    return praiseIndicators.some(indicator => context.includes(indicator));
}

/**
 * Convert all caps text to title case
 */
function toTitleCase(str) {
    return str.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
}

module.exports = {
    execute,
    validate
}; 