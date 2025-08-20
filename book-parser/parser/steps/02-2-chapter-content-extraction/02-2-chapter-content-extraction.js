/**
 * Step 2.2: Chapter Content Extraction
 * 
 * Extracts chapter content and page ranges based on metadata from step 2.1.
 * This step takes chapter metadata and extracts content based on page boundaries.
 * 
 * Process:
 * 1. Take chapter metadata from step 2.1
 * 2. Calculate pageNumberStart and pageNumberEnd for each chapter
 * 3. Extract content for each chapter based on page ranges
 * 
 * Expected Input:
 * - pipelineState: { rawText: "extracted text...", chapterMetadata: [...] }
 * - config: { OUTPUT_DIR: path, DEBUG_DIR: path, ... }
 * 
 * Expected Output:
 * - { chapters: [{ title, chapterNumber, pageNumberStart, pageNumberEnd, content }] }
 */

const fs = require('fs');
const path = require('path');

/**
 * Execute chapter content extraction step
 * @param {Object} pipelineState - Current pipeline state
 * @param {Object} config - Configuration object
 * @returns {Object} - Updated state with chapter content
 */
async function execute(pipelineState, config) {
    // Validate prerequisites
    if (!pipelineState.rawText) {
        throw new Error('Step 1 (text extraction) must be completed first');
    }
    
    if (!pipelineState.chapterMetadata || pipelineState.chapterMetadata.length === 0) {
        throw new Error('Step 2.1 (chapter detection) must be completed first');
    }
    
    try {
        const startTime = Date.now();
        
        // Sort chapters by starting page number first
        const sortedChapters = [...pipelineState.chapterMetadata].sort((a, b) => a.startingPage - b.startingPage);
        
        // Extract content for each chapter
        const chapters = [];
        for (let i = 0; i < sortedChapters.length; i++) {
            const metadata = sortedChapters[i];
            
            // Processing chapter
            
            // Calculate page range for extraction
            const pageNumberStart = metadata.startingPage;
            const pageNumberEnd = getChapterEndPage(metadata, sortedChapters, i, pipelineState.rawText);
            
            // Extract chapter content based on page numbers
            const content = extractChapterContentByPages(
                pipelineState.rawText, 
                pageNumberStart, // Page markers now start from 0, matching book page numbers
                pageNumberEnd
            );
            
            // Calculate word count
            const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
            
            // Create simplified chapter object
            chapters.push({
                title: metadata.title,
                chapterNumber: metadata.chapterNumber,
                pageNumberStart: pageNumberStart,
                pageNumberEnd: pageNumberEnd,
                content: content,
                wordCount: wordCount
            });
            
            // Chapter processed
        }
        
        // Filter out chapters with content under 10,000 characters (likely not real chapters)
        const originalChapterCount = chapters.length;
        const filteredChapters = chapters.filter(ch => {
            const isRealChapter = ch.content.length >= 10000;
            if (!isRealChapter) {
                // console.log(`📝 Filtering out short chapter: "${ch.title}" (${ch.content.length} characters)`);
            }
            return isRealChapter;
        });

        // Generate extraction statistics
        const extractionStats = {
            totalChapters: filteredChapters.length,
            originalChapterCount: originalChapterCount,
            filteredChapterCount: originalChapterCount - filteredChapters.length,
            totalPages: filteredChapters.reduce((sum, ch) => sum + (ch.pageNumberEnd - ch.pageNumberStart + 1), 0),
            averagePagesPerChapter: filteredChapters.length > 0 ? 
                filteredChapters.reduce((sum, ch) => sum + (ch.pageNumberEnd - ch.pageNumberStart + 1), 0) / filteredChapters.length : 0,
            totalCharacters: filteredChapters.reduce((sum, ch) => sum + ch.content.length, 0),
            averageCharactersPerChapter: filteredChapters.length > 0 ? 
                filteredChapters.reduce((sum, ch) => sum + ch.content.length, 0) / filteredChapters.length : 0
        };
        
        const processingTime = Date.now() - startTime;
        
        // Save debug output
        const debugOutput = {
            processingTime,
            extractionStats,
            filteredChapters: filteredChapters.map(ch => ({
                title: ch.title,
                chapterNumber: ch.chapterNumber,
                pageNumberStart: ch.pageNumberStart,
                pageNumberEnd: ch.pageNumberEnd,
                contentLength: ch.content.length
            })),
            originalChapters: chapters.map(ch => ({
                title: ch.title,
                chapterNumber: ch.chapterNumber,
                pageNumberStart: ch.pageNumberStart,
                pageNumberEnd: ch.pageNumberEnd,
                contentLength: ch.content.length,
                filtered: ch.content.length < 10000
            }))
        };
        
        const debugFile = path.join(config.DEBUG_DIR, 'step-02-2-chapter-content-extraction.json');
        fs.writeFileSync(debugFile, JSON.stringify(debugOutput, null, 2));
        
        // Chapter content extraction completed
        
        return {
            chapters: filteredChapters,
            metadata: {
                ...pipelineState.metadata,
                chapterContentExtraction: {
                    ...extractionStats,
                    processingTime,
                    extractionMethod: 'page_based_content_extraction_with_filtering'
                }
            }
        };
        
    } catch (error) {
        console.error('❌ Chapter content extraction failed:', error.message);
        throw error;
    }
}

/**
 * Find the last page number in the document
 * @param {string} rawText - Full text content
 * @returns {number} - Last page number (0-based)
 */
function findLastPageNumber(rawText) {
    // Find all page markers in the text
    const pageMarkers = rawText.match(/---\s*PAGE\s+(\d+)\s*---/g);
    if (!pageMarkers || pageMarkers.length === 0) {
        return 316; // Default fallback (0-based, so 317 pages total)
    }
    
    // Extract page numbers and find the maximum
    const pageNumbers = pageMarkers.map(marker => {
        const match = marker.match(/---\s*PAGE\s+(\d+)\s*---/);
        return match ? parseInt(match[1]) : 0;
    });
    
    return Math.max(...pageNumbers);
}

/**
 * Get the end page for a chapter
 * @param {Object} currentChapter - Current chapter metadata
 * @param {Array} allChapters - All chapter metadata (sorted by page number)
 * @param {number} currentIndex - Current chapter index
 * @param {string} rawText - Full text content (for finding last page)
 * @returns {number} - End page number
 */
function getChapterEndPage(currentChapter, allChapters, currentIndex, rawText) {
    // If this is the last chapter, find the actual last page in the document
    if (currentIndex === allChapters.length - 1) {
        return findLastPageNumber(rawText);
    }
    
    // Otherwise, end at the page before the next chapter starts
    const nextChapter = allChapters[currentIndex + 1];
    return nextChapter.startingPage - 1;
}

/**
 * Extract chapter content based on page numbers
 * @param {string} rawText - Full text content
 * @param {number} pageNumberStart - Starting page number (0-based page numbers)
 * @param {number} pageNumberEnd - Ending page number (0-based page numbers)
 * @returns {string} - Extracted content
 */
function extractChapterContentByPages(rawText, pageNumberStart, pageNumberEnd) {
    // Find the start position of the starting page
    const startPageMarker = `--- PAGE ${pageNumberStart} ---`;
    const startPos = rawText.indexOf(startPageMarker);
    
    if (startPos === -1) {
        console.warn(`Warning: Could not find start page marker for page ${pageNumberStart}`);
        return '';
    }
    
    // Find the end position of the ending page
    const endPageMarker = `--- END PAGE ${pageNumberEnd} ---`;
    let endPos = rawText.indexOf(endPageMarker, startPos);
    
    if (endPos === -1) {
        // If we can't find the end page marker, try to find the next page marker
        const nextPageMarker = `--- PAGE ${pageNumberEnd + 1} ---`;
        endPos = rawText.indexOf(nextPageMarker, startPos);
        
        if (endPos === -1) {
            // If still can't find it, extract to the end of the text
            endPos = rawText.length;
        }
    } else {
        // Include the end page marker
        endPos += endPageMarker.length;
    }
    
    // Extract and return the content
    return rawText.substring(startPos, endPos).trim();
}

const { validate } = require('./02-2-chapter-content-extraction-validation');

module.exports = { execute, validate }; 