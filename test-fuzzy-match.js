function normalizeText(text) {
    return text
        .replace(/\s+/g, ' ')           // Multiple spaces → single space
        .replace(/[""]/g, '"')          // Smart quotes → straight quotes (U+201C, U+201D)
        .replace(/['']/g, "'")          // Smart apostrophes → straight (U+2018, U+2019)
        .replace(/[""]/g, '"')          // Additional smart quotes (U+2033, U+2036)
        .replace(/\\/g, '')             // Remove escape characters from config
        .replace(/\s+(ix|xi{1,3}|[0-9]+)\s*$/i, '') // Remove page numbers at end
        .trim();
}

function fuzzyMatch(pdfLine, configTitle) {
    const normalizedLine = normalizeText(pdfLine);
    const normalizedTitle = normalizeText(configTitle);

    console.log(`Testing: "${pdfLine}" vs "${configTitle}"`);
    console.log(`Normalized: "${normalizedLine}" vs "${normalizedTitle}"`);

    // Check exact match after normalization
    if (normalizedLine === normalizedTitle) {
        console.log('✅ Exact match after normalization');
        return true;
    }

    // Check if line starts with the title (handles joined content)
    if (normalizedLine.startsWith(normalizedTitle)) {
        console.log('✅ Starts with match');
        return true;
    }

    // Check if title is contained in line (handles split lines)
    if (normalizedLine.includes(normalizedTitle) && normalizedTitle.length > 10) {
        console.log('✅ Contains match');
        return true;
    }

    // Handle split titles: check if line ends with most of the title
    if (normalizedTitle.length > 10) {
        for (let skip = 1; skip <= 3; skip++) {
            const partialTitle = normalizedTitle.substring(skip);
            if (partialTitle.length > 8 && normalizedLine === partialTitle) {
                console.log(`✅ Partial match (skip ${skip}): "${partialTitle}"`);
                return true;
            }
            if (partialTitle.length > 8 && normalizedLine.startsWith(partialTitle)) {
                console.log(`✅ Partial starts with (skip ${skip}): "${partialTitle}"`);
                return true;
            }
        }
    }

    console.log('❌ No match');
    return false;
}

// Test cases
console.log('=== Testing Fingerprints Chapter ===');

// From the raw PDF text (line 795)
const pdfLine1 = 'The Search for Emotion\'s "Fingerprints"';
const configTitle = 'The Search for Emotion\'s "Fingerprints"';

fuzzyMatch(pdfLine1, configTitle);

console.log('\n=== Testing with config escapes ===');
const configTitleEscaped = 'The Search for Emotion\'s \\"Fingerprints\\"';
fuzzyMatch(pdfLine1, configTitleEscaped);

console.log('\n=== Testing split title ===');
const pdfLineSplit = 'e Search for Emotion\'s "Fingerprints"';  // Missing "Th"
fuzzyMatch(pdfLineSplit, configTitle); 