function normalizeText(text) {
    return text
        .replace(/\s+/g, ' ')           // Multiple spaces → single space
        .replace(/[\u201C\u201D]/g, '"') // Smart quotes → straight quotes (U+201C, U+201D)
        .replace(/[\u2018\u2019]/g, "'") // Smart apostrophes → straight (U+2018, U+2019)
        .replace(/[\u2033\u2036]/g, '"') // Additional smart quotes (U+2033, U+2036)
        .replace(/\\/g, '')             // Remove escape characters from config
        .replace(/\s+(ix|xi{1,3}|[0-9]+)\s*$/i, '') // Remove page numbers at end
        .trim();
}

// Exact text from PDF (using Unicode characters from hex dump)
const pdfText = 'The Search for Emotion\u2019s \u201cFingerprints\u201d';
const configText = 'The Search for Emotion\'s "Fingerprints"';

console.log('PDF text:', pdfText);
console.log('Config text:', configText);

console.log('PDF normalized:', normalizeText(pdfText));
console.log('Config normalized:', normalizeText(configText));

console.log('Match:', normalizeText(pdfText) === normalizeText(configText));

// Test character codes
console.log('\nPDF chars:', [...pdfText].map(c => c + ':' + c.charCodeAt(0)));
console.log('Config chars:', [...configText].map(c => c + ':' + c.charCodeAt(0)));

console.log('\nNormalized PDF chars:', [...normalizeText(pdfText)].map(c => c + ':' + c.charCodeAt(0)));
console.log('Normalized config chars:', [...normalizeText(configText)].map(c => c + ':' + c.charCodeAt(0))); 