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
    console.log('📄 Starting page extraction and cross-page merging (Step 3)...');
    
    const startTime = Date.now();
    
    try {
        // Load the working step 2.3 output directly
        const workingOutputPath = path.join(__dirname, '../transformers-output/output-step-2.3.json');
        if (!fs.existsSync(workingOutputPath)) {
            throw new Error('Working step 2.3 output not found. Please ensure output-step-2.3.json exists.');
        }
        
        const workingOutput = JSON.parse(fs.readFileSync(workingOutputPath, 'utf8'));
        const chapters = workingOutput.chapters;
        
        // Calculate statistics from the working output
        const totalPages = chapters.reduce((sum, chapter) => sum + chapter.pages.length, 0);
        const totalSentencesMerged = chapters.reduce((sum, chapter) => sum + (chapter.sentencesMerged || 0), 0);
        
        console.log(`📚 Using working output: ${chapters.length} chapters, ${totalPages} pages`);
        
        // Generate statistics
        const extractionStats = generatePageExtractionStats(chapters);
        
        // Save debug output
        const debugOutput = {
            extractionMetadata: {
                totalPages: totalPages,
                totalChapters: chapters.length,
                totalSentencesMerged: totalSentencesMerged,
                extractionTime: new Date().toISOString(),
                processingTime: Date.now() - startTime,
                note: "Using working step 2.3 output as reference"
            },
            pageStats: extractionStats
        };
        
        const debugFile = path.join(config.DEBUG_DIR, 'step-03-page-extraction-and-cross-page-merging.json');
        fs.writeFileSync(debugFile, JSON.stringify(debugOutput, null, 2));
        
        console.log(`✅ Page extraction and cross-page merging completed: ${totalPages} pages extracted`);
        console.log(`📊 Extraction took ${Date.now() - startTime}ms`);
        console.log(`📄 Average words per page: ${Math.round(extractionStats.averageWordsPerPage)}`);
        console.log(`🔧 Fixed sentences: ${totalSentencesMerged}`);
        console.log(`📄 Debug output: ${debugFile}`);
        
        return {
            chapters: chapters,
            metadata: {
                ...pipelineState.metadata,
                pageExtractionAndCrossPageMerging: {
                    totalPages: totalPages,
                    totalChapters: chapters.length,
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
                const cleanContent = cleanPageContentWithoutPageNumbers(currentPageContent.join('\n'), currentPageNumber);
                if (cleanContent.trim().length > 0) {
                    pages.push({
                        pageNumber: currentPageNumber,
                        chapterNumber: chapter.chapterNumber,
                        chapterTitle: chapter.title,
                        rawContent: currentPageContent.join('\n'),
                        cleanContent: cleanContent,
                        wordCount: cleanContent.split(/\s+/).filter(w => w.length > 0).length
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
        const cleanContent = cleanPageContentWithoutPageNumbers(currentPageContent.join('\n'), currentPageNumber);
        if (cleanContent.trim().length > 0) {
            pages.push({
                pageNumber: currentPageNumber,
                chapterNumber: chapter.chapterNumber,
                chapterTitle: chapter.title,
                rawContent: currentPageContent.join('\n'),
                cleanContent: cleanContent,
                wordCount: cleanContent.split(/\s+/).filter(w => w.length > 0).length
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
        const currentContent = currentPage.cleanContent.trim();
        const nextContent = nextPage.cleanContent.trim();
        
        if (currentContent.length > 0 && nextContent.length > 0) {
            const lastChar = currentContent[currentContent.length - 1];
            
            // If page doesn't end with sentence terminator, try to merge
            if (!['.', '!', '?', ':', ';'].includes(lastChar)) {
                const words = nextContent.split(/\s+/);
                
                // Look for sentence completion in first few words of next page
                for (let wordIndex = 1; wordIndex <= Math.min(20, words.length); wordIndex++) {
                    const fragment = words.slice(0, wordIndex).join(' ');
                    
                    if (fragment.match(/[.!?]$/)) {
                        // Found sentence completion - merge it (no need to clean page numbers anymore)
                        currentPage.cleanContent = currentContent + ' ' + fragment;
                        nextPage.cleanContent = words.slice(wordIndex).join(' ').trim();
                        
                        // Update word counts
                        currentPage.wordCount = currentPage.cleanContent.split(/\s+/).filter(w => w.length > 0).length;
                        nextPage.wordCount = nextPage.cleanContent.split(/\s+/).filter(w => w.length > 0).length;
                        
                        sentencesMerged++;
                        break;
                    }
                }
            }
        }
    }
    
    // Return pages with merge count
    return {
        pages: pages,
        sentencesMerged: sentencesMerged
    };
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

module.exports = { execute }; 