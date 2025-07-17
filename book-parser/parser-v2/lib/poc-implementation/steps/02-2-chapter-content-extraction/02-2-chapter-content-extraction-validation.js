/**
 * Validation functions for Step 2-2: Chapter Content Extraction
 */

/**
 * Validate chapter content extraction results
 * @param {Object} output - Output from execute function
 * @returns {boolean} - True if validation passes
 */
function validate(output) {
    const chapters = output.chapters;
    
    if (!chapters || chapters.length === 0) {
        console.error('❌ Chapter content validation failed: No chapters found');
        return false;
    }
    
    // Check that each chapter has content
    for (let i = 0; i < chapters.length; i++) {
        const chapter = chapters[i];
        
        if (!chapter.content || typeof chapter.content !== 'string') {
            console.error(`❌ Chapter content validation failed: Chapter ${i + 1} "${chapter.title}" has no content`);
            return false;
        }
        
        // Check minimum content length (should have substantial content)
        if (chapter.content.length < 100) {
            console.error(`❌ Chapter content validation failed: Chapter ${i + 1} "${chapter.title}" content too short (${chapter.content.length} characters)`);
            return false;
        }
        
        // Check that wordCount exists and is reasonable
        if (!chapter.wordCount || chapter.wordCount < 10) {
            console.error(`❌ Chapter content validation failed: Chapter ${i + 1} "${chapter.title}" has invalid word count (${chapter.wordCount})`);
            return false;
        }
    }
    
    return true;
}

module.exports = {
    validate
}; 