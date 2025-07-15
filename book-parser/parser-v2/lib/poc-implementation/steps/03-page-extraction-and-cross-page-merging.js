const fs = require('fs');
const path = require('path');

/**
 * Step 3: Page Extraction and Cross-Page Merging
 * 
 * Takes chapter content from Step 2 and transforms it into a page-based structure.
 * Each page maintains metadata about its page number, chapter, and contains cleaned content
 * with incomplete sentences merged across page boundaries.
 * 
 * Input: chapters[] with content from Step 2
 * Output: pages[] with cleaned content and cross-page merging completed
 */

/**
 * Execute page extraction step
 * @param {Object} pipelineState - Current pipeline state
 * @param {Object} config - Configuration object
 * @returns {Object} - Updated pipeline state with pages array
 */
async function execute(pipelineState, config) {
    
    const startTime = Date.now();
    
    try {
        // Validate prerequisites - use pipeline state instead of reading files
        if (!pipelineState.chapters || pipelineState.chapters.length === 0) {
            throw new Error('Step 2.2 (chapter content extraction) must be completed first. No chapters found in pipeline state.');
        }
        
        const inputChapters = pipelineState.chapters;
        
        // Extract pages from each chapter's content
        const processedChapters = [];
        let totalPages = 0;
        let totalSentencesMerged = 0;
        const debugPages = []; // For debug output with rawContent
        
        for (const chapter of inputChapters) {
            
            // Extract pages from chapter content (includes rawContent for debug)
            const pagesWithRaw = extractPagesFromChapterWithDebug(chapter);
            
            // Create clean pages for pipeline (without rawContent)
            const pages = pagesWithRaw.map(page => ({
                pageNumber: page.pageNumber,
                content: page.content,
                wordCount: page.wordCount
            }));
            
            // Save pages with rawContent for debug
            debugPages.push(...pagesWithRaw);
            
            // Perform cross-page sentence merging
            const mergeResult = fixIncompleteSentencesWithinChapter(pages);
            const mergedPages = mergeResult.pages;
            const sentencesMerged = mergeResult.sentencesMerged;
            totalSentencesMerged += sentencesMerged;
            
            // Create processed chapter
            const processedChapter = {
                title: chapter.title,
                chapterNumber: chapter.chapterNumber,
                pageNumberStart: chapter.pageNumberStart,
                pageNumberEnd: chapter.pageNumberEnd,
                pages: mergedPages,
                sentencesMerged: sentencesMerged
            };
            
            processedChapters.push(processedChapter);
            totalPages += mergedPages.length;
            
        }
        
        // Generate statistics
        const extractionStats = generatePageExtractionStats(processedChapters);
        
        // Save debug output
        const debugOutput = {
            extractionMetadata: {
                totalPages: totalPages,
                totalChapters: processedChapters.length,
                totalSentencesMerged: totalSentencesMerged,
                extractionTime: new Date().toISOString(),
                processingTime: Date.now() - startTime,
                note: "Extracted pages from step 2.2 chapter content"
            },
            pageStats: extractionStats,
            debugPages: debugPages
        };
        
        const debugFile = path.join(config.DEBUG_DIR, 'step-03-page-extraction-and-cross-page-merging.json');
        fs.writeFileSync(debugFile, JSON.stringify(debugOutput, null, 2));
        
        
        return {
            chapters: processedChapters,
            metadata: {
                ...pipelineState.metadata,
                pageExtractionAndCrossPageMerging: {
                    totalPages: totalPages,
                    totalChapters: processedChapters.length,
                    averageWordsPerPage: extractionStats.averageWordsPerPage,
                    sentencesMerged: totalSentencesMerged,
                    extractionTime: new Date().toISOString(),
                    processingTime: Date.now() - startTime
                }
            }
        };
        
    } catch (error) {
        console.error('❌ Page extraction failed:', error.message);
        throw error;
    }
}

/**
 * Extract pages from a single chapter's content (with rawContent for debug)
 * @param {Object} chapter - Chapter object with content
 * @returns {Array} - Array of page objects with rawContent for debugging
 */
function extractPagesFromChapterWithDebug(chapter) {
    const pages = [];
    const lines = chapter.content.split('\n');
    
    let currentPageContent = [];
    let currentPageNumber = null;
    let isInPageContent = false;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Detect page start markers
        const pageStartMatch = line.match(/^---\s*PAGE\s+(\d+)\s*---$/);
        if (pageStartMatch) {
            // Save previous page if it exists
            if (currentPageNumber && currentPageContent.length > 0) {
                const content = cleanPageContentWithoutPageNumbers(currentPageContent.join('\n'), currentPageNumber);
                if (content.trim().length > 0) {
                    pages.push({
                        pageNumber: currentPageNumber,
                        content: content,
                        rawContent: currentPageContent.join('\n'), // For debug
                        wordCount: content.split(/\s+/).filter(w => w.length > 0).length
                    });
                }
            }
            
            // Start new page
            currentPageNumber = parseInt(pageStartMatch[1], 10);
            currentPageContent = [];
            isInPageContent = true;
            continue;
        }
        
        // Detect page end markers
        const pageEndMatch = line.match(/^---\s*END\s+PAGE\s+\d+\s*---$/);
        if (pageEndMatch) {
            isInPageContent = false;
            continue;
        }
        
        // Collect page content
        if (isInPageContent) {
            currentPageContent.push(line);
        }
    }
    
    // Handle last page
    if (currentPageNumber && currentPageContent.length > 0) {
        const content = cleanPageContentWithoutPageNumbers(currentPageContent.join('\n'), currentPageNumber);
        if (content.trim().length > 0) {
            pages.push({
                pageNumber: currentPageNumber,
                content: content,
                rawContent: currentPageContent.join('\n'), // For debug
                wordCount: content.split(/\s+/).filter(w => w.length > 0).length
            });
        }
    }
    
    return pages;
}

/**
 * Extract pages from a single chapter's content
 * @param {Object} chapter - Chapter object with content
 * @returns {Array} - Array of page objects
 */
function extractPagesFromChapter(chapter) {
    const pages = [];
    const lines = chapter.content.split('\n');
    
    let currentPageContent = [];
    let currentPageNumber = null;
    let isInPageContent = false;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Detect page start markers
        const pageStartMatch = line.match(/^---\s*PAGE\s+(\d+)\s*---$/);
        if (pageStartMatch) {
            // Save previous page if it exists
            if (currentPageNumber && currentPageContent.length > 0) {
                const content = cleanPageContentWithoutPageNumbers(currentPageContent.join('\n'), currentPageNumber);
                if (content.trim().length > 0) {
                    pages.push({
                        pageNumber: currentPageNumber,
                        content: content,
                        wordCount: content.split(/\s+/).filter(w => w.length > 0).length
                    });
                }
            }
            
            // Start new page
            currentPageNumber = parseInt(pageStartMatch[1], 10);
            currentPageContent = [];
            isInPageContent = true;
            continue;
        }
        
        // Detect page end markers
        const pageEndMatch = line.match(/^---\s*END\s+PAGE\s+\d+\s*---$/);
        if (pageEndMatch) {
            isInPageContent = false;
            continue;
        }
        
        // Collect page content
        if (isInPageContent) {
            currentPageContent.push(line);
        }
    }
    
    // Handle last page
    if (currentPageNumber && currentPageContent.length > 0) {
        const content = cleanPageContentWithoutPageNumbers(currentPageContent.join('\n'), currentPageNumber);
        if (content.trim().length > 0) {
            pages.push({
                pageNumber: currentPageNumber,
                content: content,
                wordCount: content.split(/\s+/).filter(w => w.length > 0).length
            });
        }
    }
    
    return pages;
}

/**
 * Clean page content by removing page numbers, headers, and footers
 * @param {string} content - Raw page content
 * @param {number} pageNumber - Page number for context
 * @returns {string} - Cleaned content
 */
function cleanPageContent(content, pageNumber) {
    let cleaned = content;
    
    // Split into lines for processing
    const lines = cleaned.split('\n');
    const cleanedLines = [];
    
    for (let i = 0; i < lines.length; i++) {
        const originalLine = lines[i];
        const trimmedLine = originalLine.trim();
        
        if (shouldRemoveLine(trimmedLine, pageNumber, i, lines.length)) {
            continue; // Skip this line
        }
        
        // Preserve original line structure for paragraph detection
        // Only trim excessive whitespace, but keep paragraph boundaries
        if (trimmedLine.length === 0) {
            // Keep empty lines as they indicate paragraph boundaries
            cleanedLines.push('');
        } else {
            // Clean the line but preserve leading/trailing space structure
            // Only replace spaces and tabs, preserve newlines
            const cleanedLine = originalLine.replace(/[ \t]+/g, ' ').trim();
            cleanedLines.push(cleanedLine);
        }
    }
    
    // Join back and clean up extra whitespace
    cleaned = cleanedLines.join('\n');
    cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n'); // Reduce multiple newlines
    cleaned = cleaned.trim();
    
    // Remove page numbers from the beginning of content
    cleaned = removePageNumberFromStart(cleaned, pageNumber);
    
    return cleaned;
}

/**
 * Clean page content by removing headers and footers (but NOT page numbers)
 * @param {string} content - Raw page content
 * @param {number} pageNumber - Page number for context
 * @returns {string} - Cleaned content (without page number removal)
 */
function cleanPageContentWithoutPageNumbers(content, pageNumber) {
    let cleaned = content;
    
    // Split into lines for processing
    const lines = cleaned.split('\n');
    const cleanedLines = [];
    
    for (let i = 0; i < lines.length; i++) {
        const originalLine = lines[i];
        const trimmedLine = originalLine.trim();
        
        if (shouldRemoveLine(trimmedLine, pageNumber, i, lines.length)) {
            continue; // Skip this line
        }
        
        // Preserve original line structure for paragraph detection
        // Only trim excessive whitespace, but keep paragraph boundaries
        if (trimmedLine.length === 0) {
            // Keep empty lines as they indicate paragraph boundaries
            cleanedLines.push('');
        } else {
            // Clean the line but preserve leading/trailing space structure
            // Only replace spaces and tabs, preserve newlines
            const cleanedLine = originalLine.replace(/[ \t]+/g, ' ').trim();
            cleanedLines.push(cleanedLine);
        }
    }
    
    // Join back and clean up extra whitespace
    cleaned = cleanedLines.join('\n');
    cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n'); // Reduce multiple newlines
    cleaned = cleaned.trim();
    
    // DON'T remove page numbers from the beginning - that's done separately now
    
    return cleaned;
}

/**
 * Determine if a line should be removed during cleaning
 * @param {string} line - Line to check
 * @param {number} pageNumber - Current page number
 * @param {number} lineIndex - Position in page
 * @param {number} totalLines - Total lines in page
 * @returns {boolean} - True if line should be removed
 */
function shouldRemoveLine(line, pageNumber, lineIndex, totalLines) {
    // Remove empty lines
    if (line.length === 0) {
        return false; // Keep empty lines for paragraph separation
    }
    
    // The book's page number is pageNumber - 1
    const bookPageNumber = pageNumber - 1;
    
    // Remove page numbers at start of page (first few lines)
    if (lineIndex < 3) {
        // Pattern: Just a page number by itself
        if (line.match(/^\d+$/) && parseInt(line) === bookPageNumber) {
            return true;
        }
        
        // Pattern: Spaced-out page number like "1 1" instead of "11" or "1 0" instead of "10"
        const spacedMatch = line.match(/^(\d)\s+(\d)$/);
        if (spacedMatch) {
            const reconstructedNumber = parseInt(spacedMatch[1] + spacedMatch[2]);
            if (reconstructedNumber === bookPageNumber || reconstructedNumber === pageNumber) {
                return true;
            }
        }
        
        // Pattern: Page number followed by ONLY title words (but NOT chapter content)
        // Be more restrictive - only remove if it's clearly a header, not actual content
        if (line.match(/^\d+\s+[A-Z][A-Z\s]{2,20}$/) && !line.match(/[.,:;!?]/)) {
            // Only remove very short all-caps headers without punctuation
            const withoutNumber = line.replace(/^\d+\s+/, '');
            if (withoutNumber.length < 25 && withoutNumber === withoutNumber.toUpperCase()) {
                return true;
            }
        }
    }
    
    // Remove footers at end of page (last few lines)
    if (lineIndex >= totalLines - 3) {
        // Pattern: Just a page number
        if (line.match(/^\d+$/) && parseInt(line) === bookPageNumber) {
            return true;
        }
        
        // Pattern: Spaced-out page number like "1 1" instead of "11" or "1 0" instead of "10"
        const spacedMatch = line.match(/^(\d)\s+(\d)$/);
        if (spacedMatch) {
            const reconstructedNumber = parseInt(spacedMatch[1] + spacedMatch[2]);
            if (reconstructedNumber === bookPageNumber || reconstructedNumber === pageNumber) {
                return true;
            }
        }
        
        // Pattern: Book title or author in footer
        if (line.match(/^(TRANSFORMERS?|NICK\s+LANE|LIFE\s+AND\s+DEATH)$/i)) {
            return true;
        }
    }
    
    // Remove running headers (anywhere in page)
    if (line.match(/^(TRANSFORMERS?|NICK\s+LANE)$/i)) {
        return true;
    }
    
    return false;
}

/**
 * Remove page number from the start of content
 * @param {string} content - Content to clean
 * @param {number} pageNumber - Expected page number
 * @returns {string} - Content with page number removed from start
 */
function removePageNumberFromStart(content, pageNumber) {
    if (!content || content.length === 0) return content;
    
    // The book's page number is pageNumber - 1
    const bookPageNumber = pageNumber - 1;
    const bookPageNumberStr = bookPageNumber.toString();
    
    // Check if content starts with the book's page number
    const trimmedContent = content.trim();
    if (trimmedContent.startsWith(bookPageNumberStr)) {
        // Remove the book's page number from the start
        let cleaned = trimmedContent.substring(bookPageNumberStr.length);
        
        // Remove any leading whitespace and newlines
        cleaned = cleaned.replace(/^\s+/, '');
        
        return cleaned;
    }
    
    // Check for spaced-out page numbers like "1 1" instead of "11"
    // Check both book page number and pipeline page number
    const pipelinePageNumberStr = pageNumber.toString();
    
    if (bookPageNumberStr.length === 2) {
        const spacedBookPageNumber = `${bookPageNumberStr[0]} ${bookPageNumberStr[1]}`;
        if (trimmedContent.startsWith(spacedBookPageNumber)) {
            // Remove the spaced-out page number from the start
            let cleaned = trimmedContent.substring(spacedBookPageNumber.length);
            
            // Remove any leading whitespace and newlines
            cleaned = cleaned.replace(/^\s+/, '');
            
            return cleaned;
        }
    }
    
    if (pipelinePageNumberStr.length === 2) {
        const spacedPipelinePageNumber = `${pipelinePageNumberStr[0]} ${pipelinePageNumberStr[1]}`;
        if (trimmedContent.startsWith(spacedPipelinePageNumber)) {
            // Remove the spaced-out page number from the start
            let cleaned = trimmedContent.substring(spacedPipelinePageNumber.length);
            
            // Remove any leading whitespace and newlines
            cleaned = cleaned.replace(/^\s+/, '');
            
            return cleaned;
        }
    }
    
    return content;
}

/**
 * Fix incomplete sentences that are split across page boundaries within a single chapter
 * @param {Array} pages - Array of page objects for a single chapter
 * @returns {Array} - Pages with fixed sentences
 */
function fixIncompleteSentencesWithinChapter(pages) {
    let sentencesMerged = 0;
    
    // Sort pages by page number
    pages.sort((a, b) => a.pageNumber - b.pageNumber);
    
    for (let i = 0; i < pages.length - 1; i++) {
        const currentPage = pages[i];
        const nextPage = pages[i + 1];
        
        // Check if current page ends with incomplete sentence
        const currentContent = currentPage.content.trim();
        const nextContent = nextPage.content.trim();
        
        if (currentContent.length > 0 && nextContent.length > 0) {
            const lastChar = currentContent[currentContent.length - 1];
            
            // Check if current page ends with a potential header first
            if (isPotentialHeader(currentContent, nextContent)) {
                // Potential header at end of current page - ensure it stays standalone
                const lastLine = getLastLine(currentContent);
                
                // Ensure the header has proper newlines around it
                if (!currentContent.endsWith('\n')) {
                    currentPage.content = currentContent + '\n';
                }
                
                // Skip merging this page - let the header remain standalone
                continue;
            }
            
            // Check if pages should be merged based on paragraph structure
            // Pages should be merged if:
            // 1. Current page doesn't end with newline (incomplete paragraph), OR
            // 2. Current page ends with sentence terminator but no paragraph break follows
            const endsWithNewline = currentContent.endsWith('\n');
            const endsWithSentenceTerminator = ['.', '!', '?', ':', ';'].includes(lastChar);
            
            let shouldMerge = false;
            let reason = '';
            
            if (!endsWithSentenceTerminator) {
                // Case 1: Incomplete sentence (existing logic)
                shouldMerge = true;
                reason = 'incomplete sentence';
            } else if (endsWithSentenceTerminator && !endsWithNewline) {
                // Case 2: Complete sentence but no paragraph break (new logic)
                // This handles cases like "job. The dice were loaded." where there's no newline after "job."
                shouldMerge = true;
                reason = 'sentence terminator without paragraph break';
            }
            

            
            if (!shouldMerge) {
                continue;
            }
            

            
            // Handle different merge scenarios
            if (!endsWithSentenceTerminator) {
                // Case 1: Incomplete sentence - need to find sentence completion
                
                // Additional check: skip if next page starts with capital (indicates new sentence)
                const nextFirstChar = nextContent.trim()[0];
                

                
                if (nextFirstChar && /[A-Z]/.test(nextFirstChar)) {
                    continue;
                }
                
                // Find sentence completion while preserving original text structure
                let fragmentEnd = -1;
                let searchPosition = 0;
                

                
                // Look for sentence completion in first part of next page
                // Track whether we're inside quotes to ignore punctuation within quotes
                let insideQuotes = false;
                let quoteChar = null;
                
                for (let charIndex = 1; charIndex <= Math.min(400, nextContent.length); charIndex++) {
                    const char = nextContent[charIndex - 1];
                    
                    // Track quote boundaries - handle both regular and smart quotes
                    if (['"', "'", '\u2018', '\u2019', '\u201C', '\u201D'].includes(char)) {
                        if (!insideQuotes) {
                            // Starting a quote
                            insideQuotes = true;
                            quoteChar = char;
                        } else if (
                            char === quoteChar || 
                            (quoteChar === '\u2018' && char === '\u2019') || // smart single quotes
                            (quoteChar === '\u201C' && char === '\u201D')    // smart double quotes
                        ) {
                            // Ending the quote
                            insideQuotes = false;
                            quoteChar = null;
                        }
                    }
                    
                    // Only check for sentence endings if we're not inside quotes
                    if (['.', '!', '?'].includes(char) && !insideQuotes) {
                        // Check if this sentence terminator is followed by a newline (true paragraph break)
                        const nextChar = nextContent[charIndex];
                        if (nextChar === '\n') {
                            // Found sentence terminator followed by newline - this is a paragraph boundary
                            // Include both the terminator and newline in the fragment
                            fragmentEnd = charIndex + 1;
                            break;
                        }
                        
                        // For periods, do additional checks to avoid abbreviations like "E. coli", "U.S.A"
                        // But only if we haven't found a newline yet (continue looking for .\n)
                        if (char === '.') {
                            // Check if this is really a sentence ending
                            if (charIndex === nextContent.length) {
                                // End of content, treat as sentence end
                                fragmentEnd = charIndex;
                                break;
                            } else if (nextContent[charIndex] === ' ' || nextContent[charIndex] === '\t') {
                                // Check if the word before the period is likely an abbreviation
                                const beforePeriod = nextContent.substring(0, charIndex - 1);
                                const lastWord = beforePeriod.split(/\s+/).pop();
                                
                                // Common abbreviations that shouldn't end sentences
                                const abbreviations = ['Dr', 'Mr', 'Mrs', 'Ms', 'Prof', 'vs', 'etc', 'i.e', 'e.g', 'U.S', 'U.K', 'E.coli', 'H.pylori'];
                                if (abbreviations.includes(lastWord)) {
                                    // This is likely an abbreviation, continue looking
                                    continue;
                                }
                                
                                // For non-abbreviations, check if next character suggests sentence ending
                                const nextNonWhitespace = nextContent.substring(charIndex).trim()[0];
                                if (nextNonWhitespace && /[A-Z]/.test(nextNonWhitespace)) {
                                    // Accept this as sentence completion for incomplete sentences
                                    fragmentEnd = charIndex;
                                    break;
                                }
                                // For non-abbreviations, continue looking for .\n rather than stopping at first .
                            }
                        }
                        // For ! or ? without newline, continue looking for the next .\n
                        // This allows sentences like "Really? Yes, absolutely.\n" to be handled correctly
                    }
                }
                

                
                if (fragmentEnd > 0) {
                    // Found sentence completion - merge the fragment
                    const fragment = nextContent.substring(0, fragmentEnd);
                    const remainderWithWhitespace = nextContent.substring(fragmentEnd);
                    const remainder = remainderWithWhitespace.trim();
                    
                    // Check if remainder should also be merged (no paragraph break)
                    const remainderStartsWithNewline = remainderWithWhitespace.startsWith('\n');
                    const shouldMergeRemainder = remainder.length > 0 && !remainderStartsWithNewline;
                    
                    if (shouldMergeRemainder) {
                        // Merge both fragment and remainder - they're part of the same paragraph
                        const needsSpace = !currentContent.endsWith('\n') && !currentContent.endsWith(' ') && 
                                          !fragment.startsWith('\n') && !fragment.startsWith(' ');
                        currentPage.content = currentContent + (needsSpace ? ' ' : '') + fragment + ' ' + remainder;
                        
                        // Remove the next page since we merged it completely
                        pages.splice(i + 1, 1);
                        
                    } else {
                        // Only merge the fragment, leave remainder as separate paragraph
                        const needsSpace = !currentContent.endsWith('\n') && !currentContent.endsWith(' ') && 
                                          !fragment.startsWith('\n') && !fragment.startsWith(' ');
                        currentPage.content = currentContent + (needsSpace ? ' ' : '') + fragment;
                        
                        // Update next page with the remainder
                        if (remainder.length > 0) {
                            nextPage.content = remainder;
                            nextPage.rawContent = remainder;
                            nextPage.wordCount = remainder.split(/\s+/).length;
                        } else {
                            // If no remainder, remove the next page
                            pages.splice(i + 1, 1);
                        }
                        
                    }
                    
                    // Update current page metadata
                    currentPage.rawContent = currentPage.content;
                    currentPage.wordCount = currentPage.content.split(/\s+/).length;
                    
                    sentencesMerged++;
                }
            } else if (endsWithSentenceTerminator && !endsWithNewline) {
                // Case 2: Complete sentence but no paragraph break - merge entire next page
                
                // Merge the entire next page content since it's part of the same paragraph
                // Use a single space only if both parts don't already have proper spacing
                const needsSpace = !currentContent.endsWith('\n') && !currentContent.endsWith(' ') && 
                                  !nextContent.startsWith('\n') && !nextContent.startsWith(' ');
                currentPage.content = currentContent + (needsSpace ? ' ' : '') + nextContent;
                
                // Update current page metadata
                currentPage.rawContent = currentPage.content;
                currentPage.wordCount = currentPage.content.split(/\s+/).length;
                
                // Remove the next page since we merged it completely
                pages.splice(i + 1, 1);
                
                sentencesMerged++;
            }
        }
    }
    
    return { pages, sentencesMerged };
}

/**
 * Check if the end of current page looks like a potential header
 * @param {string} currentContent - Content of current page
 * @param {string} nextContent - Content of next page
 * @returns {boolean} - True if it looks like a potential header
 */
function isPotentialHeader(currentContent, nextContent) {
    // Get the last line of the current page
    const lastLine = getLastLine(currentContent);
    
    // Get the first line of the next page
    const firstLine = getFirstLine(nextContent);
    
    // Quick header detection rules (simplified version of Step 4 rules)
    // Rule 1: Length - 2-5 words only
    const words = lastLine.trim().split(/\s+/);
    if (words.length < 2 || words.length > 5) {
        return false;
    }
    
    // Rule 2: No punctuation at end
    if (/[.!?]$/.test(lastLine.trim())) {
        return false;
    }
    
    // Rule 3: Starts with capital letter
    if (!/^[A-Z]/.test(lastLine.trim())) {
        return false;
    }
    
    // Rule 4: Previous line should end with sentence terminator
    const lines = currentContent.split('\n');
    if (lines.length < 2) {
        return false;
    }
    
    const previousLine = lines[lines.length - 2].trim();
    if (previousLine && !/[.!?]$/.test(previousLine)) {
        return false;
    }
    
    // Rule 5: Next line should start with capital letter
    if (firstLine && !/^[A-Z]/.test(firstLine.trim())) {
        return false;
    }
    
    return true;
}

/**
 * Get the last non-empty line from content
 * @param {string} content - Content to analyze
 * @returns {string} - Last non-empty line
 */
function getLastLine(content) {
    const lines = content.split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        if (line) {
            return line;
        }
    }
    return '';
}

/**
 * Get the first non-empty line from content
 * @param {string} content - Content to analyze
 * @returns {string} - First non-empty line
 */
function getFirstLine(content) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line) {
            return line;
        }
    }
    return '';
}

/**
 * Generate statistics about page extraction
 * @param {Array} chapters - Array of chapter objects with pages
 * @returns {Object} - Statistics object
 */
function generatePageExtractionStats(chapters) {
    const allPages = chapters.flatMap(chapter => chapter.pages);
    const totalWords = allPages.reduce((sum, page) => sum + page.wordCount, 0);
    const averageWordsPerPage = allPages.length > 0 ? totalWords / allPages.length : 0;
    
    const pagesPerChapter = {};
    let totalSentencesMerged = 0;
    
    chapters.forEach(chapter => {
        pagesPerChapter[chapter.chapterNumber] = chapter.pages.length;
        // Sum up sentences merged from each chapter
        totalSentencesMerged += chapter.sentencesMerged || 0;
    });
    
    return {
        totalPages: allPages.length,
        totalWords: totalWords,
        averageWordsPerPage: averageWordsPerPage,
        sentencesMerged: totalSentencesMerged,
        chaptersProcessed: chapters.length,
        pagesPerChapter: pagesPerChapter,
        minWordsPerPage: allPages.length > 0 ? Math.min(...allPages.map(p => p.wordCount)) : 0,
        maxWordsPerPage: allPages.length > 0 ? Math.max(...allPages.map(p => p.wordCount)) : 0
    };
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

module.exports = { execute, validate }; 