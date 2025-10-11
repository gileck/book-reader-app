/**
 * Validation functions for Step 3: Page Extraction and Cross-Page Merging
 */

// Import shared text processing utilities
const { isSentenceTerminator: isSentenceTerminatorShared } = require('../../utils/text-processing-utils');

// Use shared sentence terminator function
const isSentenceTerminator = isSentenceTerminatorShared;

/**
 * Check if content ends with a sentence terminator
 * @param {string} content - Content to check
 * @returns {boolean} - True if content ends with sentence terminator
 */
function endsWithSentenceTerminator(content) {
    // Trim and remove trailing author attributions like "—Tim Anderson"
    let trimmed = content.trim();
    trimmed = trimmed.replace(/\s+[\u2014-]\s*[A-Z][A-Za-z.\-]+(?:\s+[A-Z][A-Za-z.\-]+){0,3}\s*$/, '');

    if (trimmed.length === 0) {
        return false;
    }

    // Walk backwards skipping trailing closing quotes, whitespace, and numeric citations
    const closingQuotes = ['"', '\'', '\u2019', '\u201D'];
    let i = trimmed.length - 1;
    while (i >= 0) {
        const ch = trimmed[i];
        if (/\s/.test(ch)) {
            i--;
            continue;
        }
        if (closingQuotes.includes(ch)) {
            i--;
            continue;
        }
        // Skip trailing numeric citation tokens (e.g., " 72")
        if (/\d/.test(ch)) {
            // Walk back through contiguous digits
            while (i >= 0 && /\d/.test(trimmed[i])) i--;
            // Skip whitespace between citation and previous content
            while (i >= 0 && /\s/.test(trimmed[i])) i--;
            // After skipping, check again in next loop iteration
            continue;
        }
        break;
    }

    if (i < 0) return false;

    const lastChar = trimmed[i];
    if (!isSentenceTerminator(lastChar)) {
        return false;
    }

    // Ignore spaced ellipses (". . .") as sentence terminators
    const endSlice = trimmed.slice(Math.max(0, i - 10), i + 1);
    if (/\.\s*\.\s*\.$/.test(endSlice)) {
        return false;
    }

    return true;
}

/**
 * Detect resource-like pages (Resources, References, Bibliography, Notes, Index, Bonus material)
 * These pages often contain lists, urls, or uppercase headings without terminal punctuation.
 * @param {string} content
 * @returns {boolean}
 */
function isResourceLikePage(content) {
    if (!content || typeof content !== 'string') return false;
    const lines = content.split('\n');
    let first = '';
    for (let i = 0; i < lines.length; i++) {
        const t = (lines[i] || '').trim();
        if (t.length > 0) { first = t; break; }
    }
    if (first && /^(RESOURCES|RESOURCES AND TOOLS|REFERENCES|BIBLIOGRAPHY|NOTES|INDEX)$/i.test(first)) {
        return true;
    }
    if (/BONUS\s+CHAPTERS/i.test(content)) return true;
    if (/oxygenadvantage\.com\/thebreathingcure/i.test(content)) return true;
    return false;
}

/**
 * Validate page extraction and cross-page merging results
 * @param {Object} output - Output from execute function
 * @returns {boolean} - True if validation passes
 */
function validate(output) {
    const chapters = output.chapters;
    const errors = [];

    if (!chapters || chapters.length === 0) {
        errors.push('No chapters found');
        console.error('❌ Page extraction validation failed: No chapters found');
        return false;
    }

    let totalPages = 0;
    // Determine the last page number that has actual text content (non-figure-only, non-empty)
    let lastContentPageNumber = -1;
    for (const ch of chapters || []) {
        for (const p of (ch.pages || [])) {
            const hasContent = p && p.content && typeof p.content === 'string' && p.content.trim().length > 0;
            if (!p.isFigureOnly && hasContent && typeof p.pageNumber === 'number') {
                if (p.pageNumber > lastContentPageNumber) lastContentPageNumber = p.pageNumber;
            }
        }
    }

    // Check that each chapter has pages
    for (let i = 0; i < chapters.length; i++) {
        const chapter = chapters[i];

        if (!chapter.pages || !Array.isArray(chapter.pages) || chapter.pages.length === 0) {
            const msg = `Chapter ${i + 1} "${chapter.title}" has no pages`;
            console.error(`❌ Page extraction validation failed: ${msg}`);
            errors.push(msg);
            continue;
        }

        const isResourceChapter = !!(chapter.title && /(resource|reference|bibliograph|index|notes)/i.test(chapter.title));

        // Check each page has required fields
        for (let j = 0; j < chapter.pages.length; j++) {
            const page = chapter.pages[j];
            const isLastChapter = i === chapters.length - 1;
            const isLastPageInChapter = j === chapter.pages.length - 1;
            const isLastContentPageInBook = page.pageNumber === lastContentPageNumber;

            if (page.isFigureOnly === true) {
                // Accept figure-only placeholder pages
                totalPages += 1;
                continue;
            }

            if (!page.content || typeof page.content !== 'string') {
                const msg = `Chapter ${i + 1} page ${j + 1} has no content`;
                console.error(`❌ Page extraction validation failed: ${msg}`);
                errors.push(msg);
                continue;
            }

            if (typeof page.pageNumber !== 'number' || page.pageNumber < 0) {
                const msg = `Chapter ${i + 1} page ${j + 1} has invalid page number: ${page.pageNumber}`;
                console.error(`❌ Page extraction validation failed: ${msg}`);
                errors.push(msg);
                continue;
            }

            if (typeof page.wordCount !== 'number' || page.wordCount < 0) {
                const msg = `Chapter ${i + 1} page ${j + 1} has invalid word count: ${page.wordCount}`;
                console.error(`❌ Page extraction validation failed: ${msg}`);
                errors.push(msg);
                continue;
            }

            // Skip page-end sentence terminator validation since cross-page merging is disabled
        }

        // Skip detailed page validation for Appendix or Resource chapters
        if ((chapter.title && chapter.title.toLowerCase().includes('appendix')) || isResourceChapter) {
            // Skip page range validation for appendix chapters
            totalPages += chapter.pages.length;
            continue;
        }

        // Check that all pages from pageNumberStart to pageNumberEnd exist and are sorted
        if (typeof chapter.pageNumberStart !== 'number' || typeof chapter.pageNumberEnd !== 'number') {
            const msg = `Chapter ${i + 1} "${chapter.title}" missing pageNumberStart or pageNumberEnd`;
            console.error(`❌ Page extraction validation failed: ${msg}`);
            errors.push(msg);
            // Can't validate range further for this chapter
            totalPages += chapter.pages.length;
            continue;
        }

        if (chapter.pageNumberStart > chapter.pageNumberEnd) {
            console.error(`❌ Page extraction validation failed: Chapter ${i + 1} "${chapter.title}" has pageNumberStart (${chapter.pageNumberStart}) > pageNumberEnd (${chapter.pageNumberEnd})`);
            return false;
        }

        // Create a set of expected page numbers
        const expectedPages = new Set();
        for (let pageNum = chapter.pageNumberStart; pageNum <= chapter.pageNumberEnd; pageNum++) {
            expectedPages.add(pageNum);
        }

        // Check that all pages exist and collect actual page numbers
        const actualPageNumbers = [];
        for (const page of chapter.pages) {
            actualPageNumbers.push(page.pageNumber);
            if (!expectedPages.has(page.pageNumber)) {
                const msg = `Chapter ${i + 1} "${chapter.title}" has unexpected page ${page.pageNumber} (not in range ${chapter.pageNumberStart}-${chapter.pageNumberEnd})`;
                console.error(`❌ Page extraction validation failed: ${msg}`);
                errors.push(msg);
                continue;
            }
            expectedPages.delete(page.pageNumber);
        }

        // Check if any expected pages are missing
        if (expectedPages.size > 0) {
            const missingPages = Array.from(expectedPages).sort((a, b) => a - b);
            const msg = `Chapter ${i + 1} "${chapter.title}" missing pages: ${missingPages.join(', ')}`;
            console.error(`❌ Page extraction validation failed: ${msg}`);
            errors.push(msg);
        }

        // Check that pages are sorted
        for (let j = 1; j < actualPageNumbers.length; j++) {
            if (actualPageNumbers[j] <= actualPageNumbers[j - 1]) {
                const msg = `Chapter ${i + 1} "${chapter.title}" pages not sorted correctly. Page ${actualPageNumbers[j]} should come after ${actualPageNumbers[j - 1]}`;
                console.error(`❌ Page extraction validation failed: ${msg}`);
                errors.push(msg);
            }
        }

        totalPages += chapter.pages.length;
    }

    // Check that we have reasonable number of pages
    if (totalPages < 10) {
        const msg = `Too few pages extracted (${totalPages}, expected at least 10)`;
        console.error(`❌ Page extraction validation failed: ${msg}`);
        errors.push(msg);
    }

    if (errors.length > 0) {
        console.error(`❌ Page extraction validation failed with ${errors.length} error(s).`);
        return false;
    }

    return true;
}

module.exports = {
    validate,
    endsWithSentenceTerminator,
    isSentenceTerminator
}; 