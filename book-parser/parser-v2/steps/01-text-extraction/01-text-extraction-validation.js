/**
 * Validation functions for Step 1: Text Extraction
 */

/**
 * Validate word lengths to detect concatenated words or other text quality issues
 * @param {string} text - Text to analyze
 * @returns {Object} - Analysis results
 */
function validateWordLengths(text) {
    // Extract words (alphanumeric sequences)
    const words = text.match(/[a-zA-Z0-9]+/g) || [];
    
    // Categorize words by length
    const longWords = words.filter(word => word.length > 20);
    const veryLongWords = words.filter(word => word.length > 30);
    const suspiciousWords = words.filter(word => word.length > 50);
    
    // Find longest word
    const longestWord = words.reduce((longest, current) => 
        current.length > longest.length ? current : longest, ''
    );
    
    // Sort suspicious words by length (descending)
    suspiciousWords.sort((a, b) => b.length - a.length);
    
    return {
        totalWords: words.length,
        longWords: longWords,
        veryLongWords: veryLongWords,
        suspiciousWords: suspiciousWords,
        longestWord: longestWord,
        averageWordLength: words.reduce((sum, word) => sum + word.length, 0) / words.length
    };
}

/**
 * Validate text extraction results
 * @param {Object} output - Output from execute function
 * @returns {boolean} - True if validation passes
 */
function validate(output) {
    // Check if rawText exists and is not empty
    if (!output.rawText || typeof output.rawText !== 'string') {
        console.error('❌ Validation failed: rawText is missing or not a string');
        return false;
    }
    
    // Check minimum length (should have substantial content)
    if (output.rawText.length < 1000) {
        console.error(`❌ Validation failed: rawText too short (${output.rawText.length} characters, expected at least 1000)`);
        return false;
    }
    
    // Check that metadata exists
    if (!output.metadata || !output.metadata.textExtraction || !output.metadata.textExtraction.characterCount) {
        console.error('❌ Validation failed: metadata missing or incomplete');
        return false;
    }
    
    // Check character count consistency
    if (output.metadata.textExtraction.characterCount !== output.rawText.length) {
        console.error(`❌ Validation failed: character count mismatch (metadata: ${output.metadata.textExtraction.characterCount}, actual: ${output.rawText.length})`);
        return false;
    }
    
    return true;
}

module.exports = {
    validate,
    validateWordLengths
}; 