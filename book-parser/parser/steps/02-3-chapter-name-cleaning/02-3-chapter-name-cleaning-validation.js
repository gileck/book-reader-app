/**
 * Validation functions for Step 2-3: Chapter Name Cleaning
 */

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
    validate
}; 