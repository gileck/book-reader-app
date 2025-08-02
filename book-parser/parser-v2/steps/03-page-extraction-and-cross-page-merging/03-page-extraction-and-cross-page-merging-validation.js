/**
 * Validation functions for Step 3: Page Extraction and Cross-Page Merging
 */

/**
 * Check if a character is a sentence terminator
 * @param {string} char - Character to check
 * @returns {boolean} - True if character is a sentence terminator
 */
function isSentenceTerminator(char) {
    return ['.', '!', '?'].includes(char);
}

/**
 * Check if content ends with a sentence terminator
 * @param {string} content - Content to check
 * @returns {boolean} - True if content ends with sentence terminator
 */
function endsWithSentenceTerminator(content) {
    const trimmed = content.trim();

    if (trimmed.length === 0) {
        return false;
    }

    // Check if it ends with sentence terminator
    const lastChar = trimmed[trimmed.length - 1];
    if (!isSentenceTerminator(lastChar)) {
        return false;
    }

    // If it ends with a period, check if it's an initial (single capital letter followed by period)
    // if (lastChar === '.') {
    //     // Check if it's an initial like "J." or "H." at the end
    //     if (/\b[A-Z]\.$/.test(trimmed)) {
    //         return false;
    //     }
    // }

    return true;
}

/**
 * Validate page extraction and cross-page merging results
 * @param {Object} output - Output from execute function
 * @returns {boolean} - True if validation passes
 */
function validate(output) {
    const chapters = output.chapters;

    if (!chapters || chapters.length === 0) {
        console.error('❌ Page extraction validation failed: No chapters found');
        return false;
    }

    let totalPages = 0;

    // Check that each chapter has pages
    for (let i = 0; i < chapters.length; i++) {
        const chapter = chapters[i];

        if (!chapter.pages || !Array.isArray(chapter.pages) || chapter.pages.length === 0) {
            console.error(`❌ Page extraction validation failed: Chapter ${i + 1} "${chapter.title}" has no pages`);
            return false;
        }

        // Check each page has required fields
        for (let j = 0; j < chapter.pages.length; j++) {
            const page = chapter.pages[j];

            if (!page.content || typeof page.content !== 'string') {
                console.error(`❌ Page extraction validation failed: Chapter ${i + 1} page ${j + 1} has no content`);
                return false;
            }

            if (typeof page.pageNumber !== 'number' || page.pageNumber < 0) {
                console.error(`❌ Page extraction validation failed: Chapter ${i + 1} page ${j + 1} has invalid page number: ${page.pageNumber}`);
                return false;
            }

            if (typeof page.wordCount !== 'number' || page.wordCount < 0) {
                console.error(`❌ Page extraction validation failed: Chapter ${i + 1} page ${j + 1} has invalid word count: ${page.wordCount}`);
                return false;
            }

            // Skip sentence terminator validation for Appendix chapters
            if (!(chapter.title && chapter.title.toLowerCase().includes('appendix'))) {
                // Check that page content ends with a sentence terminator
                // Exception: allow headers/section titles that don't end with punctuation
                const lastLine = page.content.trim().split('\n').pop().trim();
                const looksLikeHeader = lastLine.length <= 50 && lastLine.split(' ').length <= 8 &&
                    (/^[A-Z]/.test(lastLine) || /^\d+\s+[A-Z]/.test(lastLine)) &&
                    !lastLine.includes('.');

                if (!endsWithSentenceTerminator(page.content) && !looksLikeHeader) {
                    console.error(`❌ Page extraction validation failed: Chapter ${i + 1} "${chapter.title}" page ${page.pageNumber} content does not end with a sentence terminator. Content ends with: "${page.content.trim().slice(-50)}"`);
                    return false;
                }
            }
        }

        // Skip detailed page validation for Appendix chapters
        if (chapter.title && chapter.title.toLowerCase().includes('appendix')) {
            // Skip page range validation for appendix chapters
            totalPages += chapter.pages.length;
            continue;
        }

        // Check that all pages from pageNumberStart to pageNumberEnd exist and are sorted
        if (typeof chapter.pageNumberStart !== 'number' || typeof chapter.pageNumberEnd !== 'number') {
            console.error(`❌ Page extraction validation failed: Chapter ${i + 1} "${chapter.title}" missing pageNumberStart or pageNumberEnd`);
            return false;
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
                console.error(`❌ Page extraction validation failed: Chapter ${i + 1} "${chapter.title}" has unexpected page ${page.pageNumber} (not in range ${chapter.pageNumberStart}-${chapter.pageNumberEnd})`);
                return false;
            }
            expectedPages.delete(page.pageNumber);
        }

        // Check if any expected pages are missing
        if (expectedPages.size > 0) {
            const missingPages = Array.from(expectedPages).sort((a, b) => a - b);
            console.error(`❌ Page extraction validation failed: Chapter ${i + 1} "${chapter.title}" missing pages: ${missingPages.join(', ')}`);
            return false;
        }

        // Check that pages are sorted
        for (let j = 1; j < actualPageNumbers.length; j++) {
            if (actualPageNumbers[j] <= actualPageNumbers[j - 1]) {
                console.error(`❌ Page extraction validation failed: Chapter ${i + 1} "${chapter.title}" pages not sorted correctly. Page ${actualPageNumbers[j]} should come after ${actualPageNumbers[j - 1]}`);
                return false;
            }
        }

        totalPages += chapter.pages.length;
    }

    // Check that we have reasonable number of pages
    if (totalPages < 10) {
        console.error(`❌ Page extraction validation failed: Too few pages extracted (${totalPages}, expected at least 10)`);
        return false;
    }

    return true;
}

module.exports = {
    validate,
    endsWithSentenceTerminator,
    isSentenceTerminator
}; 