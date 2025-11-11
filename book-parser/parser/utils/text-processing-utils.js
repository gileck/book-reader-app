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
    
    // Time of day (case-sensitive variations)
    'a.m.', 'A.M.', 'p.m.', 'P.M.',

    // Common Latin and other abbreviations
    'vs.', 'etc.', 'i.e.', 'e.g.', 'cf.', 'et al.', 'ibid.',

    // Organizational abbreviations (including the missing P.U.)
    'P.U.', 'A.I.', 'I.T.', 'R.D.', 'Q.A.', 'H.R.',
    
    // Common scientific genus abbreviations (genus + species)
    'C. difficile', 'C. diff', 'C. di', 'L. reuteri', 'L. acidophilus', 'L. plantarum',
    'E. coli', 'S. aureus', 'B. subtilis', 'P. aeruginosa',
    // Single-letter genus abbreviations (should not be sentence endings when followed by lowercase)
    'C.', 'L.', 'E.', 'S.', 'B.', 'P.', 'A.', 'M.', 'T.', 'H.',
    
    // Common scientific compound names with single letters
    'vitamin A.', 'vitamin B.', 'vitamin C.', 'vitamin D.', 'vitamin E.', 'vitamin K.',
    'urolithin A.', 'urolithin B.', 'urolithin C.', 'urolithin D.',
    'type A.', 'type B.', 'type C.', 'type D.',
    'hepatitis A.', 'hepatitis B.', 'hepatitis C.',
    'plan A.', 'plan B.'
];

/**
 * Check if a line ends with an abbreviation (not a sentence terminator)
 * @param {string} line - Line to check
 * @returns {boolean} - True if line ends with an abbreviation
 */
function endsWithAbbreviation(line) {
    const trimmed = line.trim();
    // Allow trailing closing quotes/brackets/parentheses and commas after abbreviations
    const sanitized = trimmed
        .replace(/["'”’)}\]]+$/g, '')  // strip closing quotes and brackets
        .replace(/[,:;]+$/g, '');        // strip trailing light punctuation (not period)

    // Check against comprehensive abbreviation list
    return COMMON_ABBREVIATIONS.some(abbr => sanitized.endsWith(abbr));
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

    // Do NOT treat spaced ellipses (". . .") as sentence terminators
    // Allow trailing quotes/brackets after the pattern
    const sanitizedForEllipsis = trimmed.replace(/["'”’)}\]]+$/g, '');
    if (/\.\s*\.\s*\.$/.test(sanitizedForEllipsis)) {
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
    // Allow trailing quotes/brackets when checking ending
    const sanitized = trimmed.replace(/["'"')}\]]+$/g, '');

    // Common measurement units that look like initials but aren't
    // These should NOT be flagged as initials
    const MEASUREMENT_UNITS = [
        // Concentration and volume units
        /\b\d+\.?\d*\s*mg\/L\.?$/i,      // milligrams per liter
        /\b\d+\.?\d*\s*mcg\/L\.?$/i,     // micrograms per liter
        /\b\d+\.?\d*\s*μg\/L\.?$/i,      // micrograms per liter (Greek mu)
        /\b\d+\.?\d*\s*ng\/L\.?$/i,      // nanograms per liter
        /\b\d+\.?\d*\s*U\/L\.?$/i,       // units per liter
        /\b\d+\.?\d*\s*IU\/L\.?$/i,      // international units per liter
        /\b\d+\.?\d*\s*nmol\/L\.?$/i,    // nanomoles per liter
        /\b\d+\.?\d*\s*pmol\/L\.?$/i,    // picomoles per liter
        /\b\d+\.?\d*\s*mmol\/L\.?$/i,    // millimoles per liter
        /\b\d+\.?\d*\s*g\/L\.?$/i,       // grams per liter
        /\b\d+\.?\d*\s*mL\.?$/i,         // milliliters
        /\b\d+\.?\d*\s*dL\.?$/i,         // deciliters
        /\b\d+\.?\d*\s*μL\.?$/i,         // microliters
        // Size and distance units
        /\b\d+\.?\d*\s*nm\.?$/i,         // nanometers
        /\b\d+\.?\d*\s*μm\.?$/i,         // micrometers
        /\b\d+\.?\d*\s*mm\.?$/i,         // millimeters
        /\b\d+\.?\d*\s*cm\.?$/i,         // centimeters
        /\b\d+\.?\d*\s*m\.?$/i,          // meters (only if preceded by number)
        // Other common units
        /\b\d+\.?\d*\s*mg\.?$/i,         // milligrams
        /\b\d+\.?\d*\s*mcg\.?$/i,        // micrograms
        /\b\d+\.?\d*\s*g\.?$/i,          // grams
        /\b\d+\.?\d*\s*kg\.?$/i,         // kilograms
    ];
    
    // Check if text ends with a measurement unit
    if (MEASUREMENT_UNITS.some(pattern => pattern.test(sanitized))) {
        return false; // Not initials, it's a measurement unit
    }
    
    // Common scientific compound names that end with single letter + period
    // These should NOT be flagged as initials
    const SCIENTIFIC_COMPOUNDS = [
        /\burolithin\s+[A-Z]\.?$/i,       // urolithin A, urolithin B, etc.
        /\bvitamin\s+[A-Z]\.?$/i,         // vitamin A, vitamin B, etc.
        /\btype\s+[A-Z]\.?$/i,            // type A, type B, etc.
        /\bhepatitis\s+[A-Z]\.?$/i,       // hepatitis A, hepatitis B, etc.
        /\bplan\s+[A-Z]\.?$/i,            // plan A, plan B
        /\bpoint\s+[A-Z]\.?$/i,           // point A, point B
        /\bappendix\s+[A-Z]\.?$/i,        // appendix A, appendix B
        /\bfigure\s+[A-Z]\.?$/i,          // figure A, figure B
        /\bsection\s+[A-Z]\.?$/i,         // section A, section B
        /\bchapter\s+[A-Z]\.?$/i,         // chapter A, chapter B
        /\btable\s+[A-Z]\.?$/i,           // table A, table B
        /\bcolumn\s+[A-Z]\.?$/i,          // column A, column B
        /\boption\s+[A-Z]\.?$/i,          // option A, option B
        // Common abbreviations in biology/medicine
        /\b(?:free|total|bound)\s+[A-Z]\.?$/i,  // free T, total T, bound T (testosterone, etc.)
    ];
    
    // Check if text ends with a scientific compound name
    if (SCIENTIFIC_COMPOUNDS.some(pattern => pattern.test(sanitized))) {
        return false; // Not initials, it's a scientific compound name
    }

    // Single initial like "J."
    if (/\b[A-Z]\.$/.test(sanitized)) return true;

    // Common academic/professional degree abbreviations should behave like initials
    const DEGREE_INITIALS = ['Ph.D.', 'M.D.', 'B.A.', 'M.A.', 'B.S.', 'M.S.', 'J.D.'];
    if (DEGREE_INITIALS.some(d => sanitized.endsWith(d))) return true;

    // Multi-initials (e.g., "E. H.", "R. E.")
    if (/(?:\b[A-Z]\.\s*){2,}$/.test(sanitized)) return true;

    return false;
}

/**
 * Check if text ends with a common single-letter word (like "vitamin E", "point A", etc.)
 * @param {string} text - Text to check
 * @returns {boolean} - True if ends with common single-letter word
 */
function endsWithCommonSingleLetterWord(text) {
    if (!text) return false;
    const trimmed = text.trim();
    // Allow trailing closing quotes when checking the ending
    const sanitized = trimmed.replace(/["'\u2019\u201D]+$/, '');

    // Common patterns where single letters are valid endings
    const commonPatterns = [
        // Scientific/academic terms
        /\bvitamin\s+[a-zA-Z]\.?$/i,      // vitamin E, vitamin C, etc. (allow line breaks)
        /\btype\s+[a-zA-Z]\.?$/i,         // type A, type B, etc.
        /\bpoint\s+[a-zA-Z]\.?$/i,        // point A, point B, etc.
        /\bfigure\s+[a-zA-Z]\.?$/i,       // figure A, figure B, etc.
        /\bappendix\s+[a-zA-Z]\.?$/i,     // appendix A, appendix B, etc.
        /\bsection\s+[a-zA-Z]\.?$/i,      // section A, section B, etc.
        /\bchapter\s+[a-zA-Z]\.?$/i,      // chapter A, chapter B, etc.
        /\btable\s+[a-zA-Z]\.?$/i,        // table A, table B, etc.
        /\bbox\s+[a-zA-Z]\.?$/i,          // box A, etc.
        /\bpart\s+[a-zA-Z]\.?$/i,         // part A, part B, etc.
        /\boption\s+[a-zA-Z]\.?$/i,       // option A, option B, etc.
        /\bclass\s+[a-zA-Z]\.?$/i,        // class A, class B, etc.
        /\bgrade\s+[a-zA-Z]\.?$/i,        // grade A, grade B, etc.
        /\bmodel\s+[a-zA-Z]\.?$/i,        // model A, model B, etc.
        /\bphase\s+[a-zA-Z]\.?$/i,        // phase A, phase B, etc.

        // Radioisotopes or chemical notation like "14 C."
        /\b\d+\s*[A-Z]\.$/,

        // Respiratory complexes often referenced as "complex I." / "complex II."
        /\bcomplex\s+[IVX]+\.?$/i,

        // Scientific narration of symbols/letters/elements, e.g., "the symbol O."
        /\b(?:symbol|letter|element)\s+[A-Z]\.$/i,

        // Items in lists/categories
        /\bitem\s+[a-zA-Z]\.?$/i,         // item A, item B, etc.
        /\bstep\s+[a-zA-Z]\.?$/i,         // step A, step B, etc.
        /\btask\s+[a-zA-Z]\.?$/i,         // task A, task B, etc.
        /\bscenario\s+[a-zA-Z]\.?$/i,     // scenario A, scenario B, etc.
        /\bexample\s+[a-zA-Z]\.?$/i,      // example A, example B, etc.

        // Plans and schedules
        /\bplan\s+[a-zA-Z]\.?$/i,         // plan A, plan B, etc.
        /\bschema\s+[a-zA-Z]\.?$/i,       // schema A, schema B, etc.
        /\bcase\s+[a-zA-Z]\.?$/i,         // case A, case B, etc.

        // Sizes and categories
        /\bsize\s+[a-zA-Z]\.?$/i,         // size A, size B, etc.
        /\bcategory\s+[a-zA-Z]\.?$/i,     // category A, category B, etc.
        /\blevel\s+[a-zA-Z]\.?$/i,        // level A, level B, etc.

        // Character and person names (common in stories/books)
        /\b[A-Z][a-z]+ [A-Z]\.$/,           // "Wally B.", "André W.", etc.
        /\b[A-Z]\. [A-Z][a-z]+$/,           // "J. Smith", "A. Wilson", etc.

        // Bibliography-like endings with multiple initials, e.g., "E. H.", "R. E.", "J. N."
        /(?:\b[A-Z]\.\s*){2,}$/,

        // Generic patterns - be more specific to avoid false positives
        /\b(?:vitamin|type|point|figure|appendix|section|chapter|table|box|part|option|class|grade|model|phase|item|step|task|scenario|example|plan|schema|case|size|category|level)\s+[a-zA-Z]\.?$/i
    ];

    return commonPatterns.some(pattern => pattern.test(sanitized));
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

/**
 * Split text into sentences with comprehensive protection
 * Used by Step 5 (sentence detection) for consistent splitting in both parsing and validation
 * @param {string} text - Text to split
 * @returns {Array} - Array of sentences
 */
function splitIntoSentences(text) {
    // Produce one sentence per part by splitting on EOS punctuation while protecting abbreviations, lists, decimals, and ellipses
    const { protectedText, protectionMap } = protectAbbreviations(text);

    // Protect numbered list items
    let processedText = protectedText.replace(/(\d+)\.\s+/g, '$1<LISTNUM> ');

    // Protect single capital letter list markers (A., B., C., etc.)
    // These are common in options, lists, and multiple choice questions
    // Pattern: word boundary + single capital letter + period (+ optional space)
    processedText = processedText.replace(/\b([A-Z])\.\s*/g, '$1<LETTERLIST> ');

    // Protect ellipses (". . .", "...", "…")
    const ellipsisReplacements = [];
    processedText = processedText.replace(/(?:\.\s*\.\s*\.|\.{3}|…)/g, (match) => {
        const token = `<ELLIPSIS_${ellipsisReplacements.length}>`;
        ellipsisReplacements.push(match);
        return token;
    });

    // Protect decimals like 3.14
    const decimalReplacements = [];
    processedText = processedText.replace(/\b(\d+)\.(\d+)\b/g, (_, a, b) => {
        const token = `<DEC_${decimalReplacements.length}>`;
        decimalReplacements.push(`${a}.${b}`);
        return token;
    });

    // Protect punctuation inside parentheses and brackets
    // This prevents splitting on questions/statements that are parenthetical
    // e.g., "The question (should I invest?) was difficult" should not split
    const parentheticalReplacements = [];
    processedText = processedText.replace(/([(\[])([^()\[\]]*[.!?]+[^()\[\]]*)([\])])/g, (match, open, content, close) => {
        const token = `<PAREN_${parentheticalReplacements.length}>`;
        parentheticalReplacements.push(match);
        return token;
    });

    // Normalize whitespace (collapse layout newlines) and split on EOS punctuation
    processedText = processedText.replace(/[\t\r\n]+/g, ' ').replace(/\s{2,}/g, ' ');
    processedText = processedText.replace(/([.!?]+)(["'""')\]]*)\s+/g, '$1$2\n');

    const parts = processedText.split(/\n+/).map(p => p.trim()).filter(Boolean);

    // Restore tokens
    const restored = parts.map(s => {
        let out = s.replace(/<PAREN_(\d+)>/g, (_, idx) => parentheticalReplacements[Number(idx)] || '');
        out = out.replace(/<DEC_(\d+)>/g, (_, idx) => decimalReplacements[Number(idx)] || '');
        out = out.replace(/<ELLIPSIS_(\d+)>/g, (_, idx) => ellipsisReplacements[Number(idx)] || '…');
        out = out.replace(/(\d+)<LISTNUM>/g, '$1.');
        out = out.replace(/([A-Z])<LETTERLIST>/g, '$1.');
        out = restoreAbbreviations(out, protectionMap);
        return out;
    });

    return restored.filter(s => s.length > 0);
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
    splitIntoSentencesBasic,
    splitIntoSentences // Advanced splitting used by Step 5
};
