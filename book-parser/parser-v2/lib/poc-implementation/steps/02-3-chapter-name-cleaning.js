/**
 * Step 2.3: Chapter Name Cleaning
 * 
 * Cleans chapter names from the beginning of chapter content.
 * This step removes chapter numbers and titles that appear at the start
 * of chapter content, leaving only the actual chapter text.
 * 
 * Process:
 * 1. Take chapters from step 2.2
 * 2. For each chapter, clean the content by removing:
 *    - Chapter number (if present)
 *    - Chapter title in uppercase
 *    - Extra whitespace and line breaks
 * 3. Keep the rest of the content intact
 * 
 * Expected Input:
 * - pipelineState: { chapters: [{ title, chapterNumber, pageNumberStart, pageNumberEnd, content }] }
 * - config: { OUTPUT_DIR: path, DEBUG_DIR: path, ... }
 * 
 * Expected Output:
 * - { chapters: [{ title, chapterNumber, pageNumberStart, pageNumberEnd, content }] }
 */

const fs = require('fs');
const path = require('path');

/**
 * Execute chapter name cleaning step
 * @param {Object} pipelineState - Current pipeline state
 * @param {Object} config - Configuration object
 * @returns {Object} - Updated state with cleaned chapter content
 */
async function execute(pipelineState, config) {
    
    // Validate prerequisites
    if (!pipelineState.chapters || pipelineState.chapters.length === 0) {
        throw new Error('Step 2.2 (chapter content extraction) must be completed first');
    }
    
    try {
        const startTime = Date.now();
        
        // Clean content for each chapter
        const cleanedChapters = [];
        let totalCharactersRemoved = 0;
        
        for (const chapter of pipelineState.chapters) {
            
            const originalLength = chapter.content.length;
            const cleanedContent = cleanChapterContent(chapter.title, chapter.chapterNumber, chapter.content);
            const charactersRemoved = originalLength - cleanedContent.length;
            totalCharactersRemoved += charactersRemoved;
            
            // Create cleaned chapter object
            cleanedChapters.push({
                title: chapter.title,
                chapterNumber: chapter.chapterNumber,
                pageNumberStart: chapter.pageNumberStart,
                pageNumberEnd: chapter.pageNumberEnd,
                content: cleanedContent
            });
            
            // Chapter content cleaned
        }
        
        // Generate cleaning statistics
        const cleaningStats = {
            totalChapters: cleanedChapters.length,
            totalCharactersRemoved,
            averageCharactersRemovedPerChapter: cleanedChapters.length > 0 ? 
                totalCharactersRemoved / cleanedChapters.length : 0,
            totalCharactersAfterCleaning: cleanedChapters.reduce((sum, ch) => sum + ch.content.length, 0),
            cleaningEfficiency: cleanedChapters.length > 0 ? 
                (totalCharactersRemoved / cleanedChapters.reduce((sum, ch) => sum + ch.content.length + (ch.originalLength || 0), 0)) * 100 : 0
        };
        
        const processingTime = Date.now() - startTime;
        
        // Save debug output
        const debugOutput = {
            processingTime,
            cleaningStats,
            chapters: cleanedChapters.map(ch => ({
                title: ch.title,
                chapterNumber: ch.chapterNumber,
                pageNumberStart: ch.pageNumberStart,
                pageNumberEnd: ch.pageNumberEnd,
                contentLength: ch.content.length,
                cleanedPreview: ch.content.substring(0, 200) + '...'
            }))
        };
        
        const debugFile = path.join(config.DEBUG_DIR, 'step-02-3-chapter-name-cleaning.json');
        fs.writeFileSync(debugFile, JSON.stringify(debugOutput, null, 2));
        
        // Chapter name cleaning completed
        
        return {
            chapters: cleanedChapters,
            metadata: {
                ...pipelineState.metadata,
                chapterNameCleaning: {
                    ...cleaningStats,
                    processingTime,
                    cleaningMethod: 'pattern_based_title_removal'
                }
            }
        };
        
    } catch (error) {
        console.error('❌ Chapter name cleaning failed:', error.message);
        throw error;
    }
}

/**
 * Clean chapter content by removing chapter number and title
 * @param {string} title - Chapter title
 * @param {number} chapterNumber - Chapter number
 * @param {string} content - Original chapter content
 * @returns {string} - Cleaned content
 */
function cleanChapterContent(title, chapterNumber, content) {
    // Start with the original content
    let cleanedContent = content;
    
    // Find the first page marker to work with content after it
    const pageMarkerMatch = content.match(/--- PAGE \d+ ---\n/);
    if (!pageMarkerMatch) {
        return cleanedContent; // No page marker found, return as-is
    }
    
    const pageMarkerEnd = pageMarkerMatch.index + pageMarkerMatch[0].length;
    const afterPageMarker = content.substring(pageMarkerEnd);
    const beforePageMarker = content.substring(0, pageMarkerEnd);
    
    // Create patterns to match chapter titles
    const patterns = createCleaningPatterns(title, chapterNumber);
    
    // Try to clean the content using the patterns
    let cleanedAfterPageMarker = afterPageMarker;
    let cleaned = false;
    
    for (const pattern of patterns) {
        const match = cleanedAfterPageMarker.match(pattern.regex);
        if (match) {
            // Remove the matched content
            cleanedAfterPageMarker = cleanedAfterPageMarker.replace(pattern.regex, '');
            cleaned = true;
            break;
        }
    }
    
    if (!cleaned) {
        // No cleaning pattern matched
    }
    
    // Reconstruct the full content
    cleanedContent = beforePageMarker + cleanedAfterPageMarker;
    
    return cleanedContent;
}

/**
 * Create cleaning patterns for a chapter
 * @param {string} title - Chapter title
 * @param {number} chapterNumber - Chapter number
 * @returns {Array} - Array of cleaning patterns
 */
function createCleaningPatterns(title, chapterNumber) {
    const patterns = [];
    
    // Normalize title for pattern matching
    const normalizedTitle = title.replace(/[^a-zA-Z0-9\s]/g, '').toUpperCase();
    
    // Handle special case for "Introduction" - match any text after it
    if (title.toLowerCase().includes('introduction')) {
        patterns.push({
            description: 'Introduction pattern (generic)',
            regex: /^I\s*NTRODUCTION\s*\n\s*[A-Z\s]+\s*\n/
        });
    }
    
    // Handle numbered chapters with title
    if (chapterNumber && chapterNumber > 0) {
        // Pattern: "1 \nDISCOVERING THE NANOCOSM \n" - but make title part generic
        patterns.push({
            description: `Numbered chapter pattern (${chapterNumber})`,
            regex: new RegExp(`^${chapterNumber}\\s*\\n\\s*[A-Z\\s]+\\s*\\n`, 'i')
        });
    }
    
    // Generic pattern for any uppercase title (but be more specific to avoid false positives)
    if (normalizedTitle) {
        // Match titles that are all uppercase with reasonable length
        patterns.push({
            description: 'Generic uppercase title pattern',
            regex: /^[A-Z\s]{3,50}\s*\n/
        });
    }
    
    // Generic pattern for appendix titles
    if (title.toLowerCase().includes('appendix')) {
        patterns.push({
            description: 'Generic appendix pattern',
            regex: /^A\s*PPENDIX\s*\d*\s*\n\s*[A-Z\s]+\s*\n/
        });
    }
    
    return patterns;
}

/**
 * Validate chapter name cleaning results
 * @param {Object} output - Output from execute function
 * @returns {boolean} - True if validation passes
 */
function validate(output) {
    const chapters = output.chapters;
    
    if (!chapters || chapters.length === 0) {
        console.error('❌ Chapter name cleaning validation failed: No chapters found');
        return false;
    }
    
    // Check that each chapter still has content after cleaning
    for (let i = 0; i < chapters.length; i++) {
        const chapter = chapters[i];
        
        if (!chapter.content || typeof chapter.content !== 'string') {
            console.error(`❌ Chapter name cleaning validation failed: Chapter ${i + 1} "${chapter.title}" has no content after cleaning`);
            return false;
        }
        
        // Check that content is still substantial after cleaning
        if (chapter.content.length < 50) {
            console.error(`❌ Chapter name cleaning validation failed: Chapter ${i + 1} "${chapter.title}" content too short after cleaning (${chapter.content.length} characters)`);
            return false;
        }
        
        // Check that content doesn't start with chapter titles (basic cleaning check)
        const contentStart = chapter.content.substring(0, 100).toUpperCase();
        const suspiciousPatterns = [
            /^I\s*NTRODUCTION\s*\n/,
            /^\d+\s*\n/,
            /^A\s*PPENDIX/,
            /^[A-Z\s]{10,}\s*\n/
        ];
        
        const hasUncleanedTitle = suspiciousPatterns.some(pattern => pattern.test(contentStart));
        if (hasUncleanedTitle) {
            console.warn(`⚠️  Chapter ${i + 1} "${chapter.title}" may still contain uncleaned title at start: "${contentStart.substring(0, 50)}..."`);
        }
    }
    
    return true;
}

module.exports = {
    execute,
    validate
}; 