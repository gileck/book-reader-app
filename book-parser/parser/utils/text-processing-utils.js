/**
 * Common Text Processing Utilities
 * 
 * Shared functions for text processing across parser steps to avoid code duplication
 * and ensure consistent behavior for sentence detection, abbreviation handling, etc.
 */

/**
 * Comprehensive list of common abbreviations that end with periods
 * but should not be treated as sentence terminators
 */
const COMMON_ABBREVIATIONS = [
    // Titles and honorifics
    'Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.', 'Sr.', 'Jr.',
    
    // Academic and professional degrees
    'Ph.D.', 'M.D.', 'B.A.', 'M.A.', 'B.S.', 'M.S.', 'J.D.',
    
    // Geographic and organizational
    'St.', 'Ave.', 'Blvd.', 'Rd.', 'Inc.', 'Corp.', 'Ltd.', 'Co.',
    'U.S.', 'U.K.', 'U.S.A.', 'U.K.',
    
    // Publishing and media
    'Sec.', 'Vol.', 'No.', 'Ed.', 'pp.',
    
    // Time and dates
    'Jan.', 'Feb.', 'Mar.', 'Apr.', 'Jun.', 'Jul.', 'Aug.', 'Sep.', 'Sept.', 'Oct.', 'Nov.', 'Dec.',
    'Mon.', 'Tue.', 'Wed.', 'Thu.', 'Fri.', 'Sat.', 'Sun.',
    
    // Common Latin and other abbreviations
    'vs.', 'etc.', 'i.e.', 'e.g.', 'cf.', 'et al.', 'ibid.',
    
    // Organizational abbreviations (including the missing P.U.)
    'P.U.', 'A.I.', 'I.T.', 'R.D.', 'Q.A.', 'H.R.'
];

/**
 * Check if a line ends with an abbreviation (not a sentence terminator)
 * @param {string} line - Line to check
 * @returns {boolean} - True if line ends with an abbreviation
 */
function endsWithAbbreviation(line) {
    const trimmed = line.trim();
    
    // Check against comprehensive abbreviation list
    return COMMON_ABBREVIATIONS.some(abbr => trimmed.endsWith(abbr));
}

/**
 * Check if a line ends with a sentence terminator (. ! ?)
 * BUT NOT if it ends with an abbreviation or single letter initial
 * @param {string} line - Line to check
 * @returns {boolean} - True if line ends with a sentence terminator
 */
function endsWithSentenceTerminator(line) {
    const trimmed = line.trim();

    // Must end with sentence terminator
    if (!/[.!?]$/.test(trimmed)) {
        return false;
    }

    // If it ends with a period, check for special cases
    if (trimmed.endsWith('.')) {
        // Check if it's a single capital letter initial like "J." or "H."
        if (/\b[A-Z]\.$/.test(trimmed)) {
            return false;
        }

        // Check if it ends with a known abbreviation
        if (endsWithAbbreviation(trimmed)) {
            return false;
        }
    }

    return true;
}

/**
 * Create abbreviation protection map for text processing
 * Used to temporarily replace abbreviations during sentence splitting
 * @returns {Map} - Map of abbreviations to protection tokens
 */
function getAbbreviationProtectionMap() {
    const map = new Map();
    
    COMMON_ABBREVIATIONS.forEach((abbr, index) => {
        // Create unique tokens that won't conflict with text
        const token = `<ABBR${index}>`;
        map.set(abbr, token);
    });
    
    return map;
}

/**
 * Protect abbreviations in text by replacing them with tokens
 * @param {string} text - Text to protect
 * @returns {Object} - {protectedText: string, protectionMap: Map}
 */
function protectAbbreviations(text) {
    const protectionMap = getAbbreviationProtectionMap();
    let protectedText = text;
    
    for (const [abbr, token] of protectionMap.entries()) {
        // Escape periods for regex
        const escapedAbbr = abbr.replace(/\./g, '\\.');
        protectedText = protectedText.replace(new RegExp(escapedAbbr, 'g'), token);
    }
    
    return { protectedText, protectionMap };
}

/**
 * Restore abbreviations in text by replacing tokens back with original abbreviations
 * @param {string} protectedText - Text with protection tokens
 * @param {Map} protectionMap - Map of abbreviations to tokens
 * @returns {string} - Text with abbreviations restored
 */
function restoreAbbreviations(protectedText, protectionMap) {
    let restoredText = protectedText;
    
    for (const [abbr, token] of protectionMap.entries()) {
        restoredText = restoredText.replace(new RegExp(token, 'g'), abbr);
    }
    
    return restoredText;
}

// ============================================================================
// WORD AND SENTENCE COUNTING UTILITIES
// ============================================================================

/**
 * Count words in text (whitespace-separated words)
 * @param {string} text - Text to count words in
 * @returns {number} - Number of words
 */
function countWords(text) {
    if (!text || typeof text !== 'string') return 0;
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Alias for countWords for backward compatibility
 * @param {string} text - Text to count words in
 * @returns {number} - Number of words
 */
function getWordCount(text) {
    return countWords(text);
}

/**
 * Count sentences in text (based on sentence terminators)
 * @param {string} text - Text to count sentences in
 * @returns {number} - Number of sentences
 */
function getSentenceCount(text) {
    return (text.match(/[.!?]/g) || []).length;
}

/**
 * Check if a character is a sentence terminator
 * @param {string} char - Character to check
 * @returns {boolean} - True if character is . ! or ?
 */
function isSentenceTerminator(char) {
    return ['.', '!', '?'].includes(char);
}

// ============================================================================
// TEXT VALIDATION UTILITIES
// ============================================================================

/**
 * Check if text ends with initials (single capital letter followed by period)
 * @param {string} text - Text to check
 * @returns {boolean} - True if text ends with initials
 */
function endsWithInitials(text) {
    if (!text) return false;
    const trimmed = text.trim();
    return /\b[A-Z]\.$/.test(trimmed);
}

/**
 * Check if text ends with a common single-letter word (like "vitamin E", "point A", etc.)
 * @param {string} text - Text to check
 * @returns {boolean} - True if ends with common single-letter word
 */
function endsWithCommonSingleLetterWord(text) {
    if (!text) return false;
    const trimmed = text.trim();

    // Common patterns where single letters are valid endings
    const commonPatterns = [
        // Scientific/academic terms
        /\bvitamin [a-zA-Z]\.?$/i,      // vitamin E, vitamin C, etc.
        /\btype [a-zA-Z]\.?$/i,         // type A, type B, etc.
        /\bpoint [a-zA-Z]\.?$/i,        // point A, point B, etc.
        /\bfigure [a-zA-Z]\.?$/i,       // figure A, figure B, etc.
        /\bappendix [a-zA-Z]\.?$/i,     // appendix A, appendix B, etc.
        /\bsection [a-zA-Z]\.?$/i,      // section A, section B, etc.
        /\bpart [a-zA-Z]\.?$/i,         // part A, part B, etc.
        /\boption [a-zA-Z]\.?$/i,       // option A, option B, etc.
        /\bclass [a-zA-Z]\.?$/i,        // class A, class B, etc.
        /\bgrade [a-zA-Z]\.?$/i,        // grade A, grade B, etc.
        /\bmodel [a-zA-Z]\.?$/i,        // model A, model B, etc.
        /\bphase [a-zA-Z]\.?$/i,        // phase A, phase B, etc.

        // Items in lists/categories
        /\bitem [a-zA-Z]\.?$/i,         // item A, item B, etc.
        /\bstep [a-zA-Z]\.?$/i,         // step A, step B, etc.
        /\btask [a-zA-Z]\.?$/i,         // task A, task B, etc.
        /\bscenario [a-zA-Z]\.?$/i,     // scenario A, scenario B, etc.
        /\bexample [a-zA-Z]\.?$/i,      // example A, example B, etc.

        // Plans and schedules
        /\bplan [a-zA-Z]\.?$/i,         // plan A, plan B, etc.
        /\bschema [a-zA-Z]\.?$/i,       // schema A, schema B, etc.
        /\bcase [a-zA-Z]\.?$/i,         // case A, case B, etc.

        // Sizes and categories
        /\bsize [a-zA-Z]\.?$/i,         // size A, size B, etc.
        /\bcategory [a-zA-Z]\.?$/i,     // category A, category B, etc.
        /\blevel [a-zA-Z]\.?$/i,        // level A, level B, etc.

        // Character and person names (common in stories/books)
        /\b[A-Z][a-z]+ [A-Z]\.$/,           // "Wally B.", "André W.", etc.
        /\b[A-Z]\. [A-Z][a-z]+$/,           // "J. Smith", "A. Wilson", etc.
        
        // Generic patterns - be more specific to avoid false positives
        /\b(?:vitamin|type|point|figure|appendix|section|part|option|class|grade|model|phase|item|step|task|scenario|example|plan|schema|case|size|category|level) [a-zA-Z]\.?$/i
    ];

    return commonPatterns.some(pattern => pattern.test(trimmed));
}

/**
 * Validate word lengths in text and return analysis
 * @param {string} text - Text to analyze
 * @returns {Object} - Analysis object with word length statistics
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
    const sortedSuspiciousWords = suspiciousWords.sort((a, b) => b.length - a.length);

    return {
        totalWords: words.length,
        longWords: longWords.length,
        veryLongWords: veryLongWords.length,
        suspiciousWords: suspiciousWords.length,
        longestWord,
        longestWordLength: longestWord.length,
        sortedSuspiciousWords: sortedSuspiciousWords.slice(0, 10) // Top 10 longest
    };
}

// ============================================================================
// TEXT SPLITTING UTILITIES
// ============================================================================

/**
 * Split text into sentences with basic abbreviation protection
 * (Simpler version for steps that don't need complex logic)
 * @param {string} text - Text to split
 * @returns {Array} - Array of sentences
 */
function splitIntoSentencesBasic(text) {
    // Split on sentence terminators, keeping the punctuation
    // But avoid splitting after common abbreviations and multi-initials
    const sentences = text.split(/(?<=[.!?])(?<!\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|i\.e|e\.g)\.)(?<!(?:\b(?:[A-Z]\.)){2,})\s+/);
    return sentences.filter(s => s.trim().length > 0);
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    // Abbreviation handling (existing)
    COMMON_ABBREVIATIONS,
    endsWithAbbreviation,
    endsWithSentenceTerminator,
    getAbbreviationProtectionMap,
    protectAbbreviations,
    restoreAbbreviations,
    
    // Word and sentence counting
    countWords,
    getWordCount,
    getSentenceCount,
    isSentenceTerminator,
    
    // Text validation
    endsWithInitials,
    endsWithCommonSingleLetterWord,
    validateWordLengths,
    
    // Text splitting
    splitIntoSentencesBasic
};
