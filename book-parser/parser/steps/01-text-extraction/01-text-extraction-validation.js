/**
 * Validation functions for Step 1: Text Extraction
 */

// Import shared text processing utilities
const { validateWordLengths } = require('../../utils/text-processing-utils');

// Note: validateWordLengths function now imported from shared utilities

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