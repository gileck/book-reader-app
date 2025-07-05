const fs = require('fs');
const path = require('path');

/**
 * SIMPLE TEXT EXTRACTION - Use raw PDF text with preserved newlines
 * This is much simpler than Y-coordinate processing!
 */

function extractTextFromRawPDF() {
    console.log('📖 Using simple raw PDF text extraction...');

    // Read the raw PDF text file that already has newlines preserved
    const rawTextPath = path.join(__dirname, '../../../../files/Transformers/raw-pdf-text.txt');
    const rawText = fs.readFileSync(rawTextPath, 'utf8');

    console.log(`✅ Loaded raw PDF text: ${rawText.length} characters`);

    return rawText;
}

/**
 * Extract Introduction chapter from raw text
 */
function extractIntroductionFromRaw() {
    const fullText = extractTextFromRawPDF();

    // Find Introduction section
    const introStart = fullText.indexOf('INTRODUCTION');
    if (introStart === -1) {
        throw new Error('Introduction section not found');
    }

    // Find next chapter or end
    const nextChapterRegex = /(CHAPTER|Chapter)\s+\d+/;
    const nextChapterMatch = fullText.slice(introStart + 100).search(nextChapterRegex);

    let introEnd;
    if (nextChapterMatch !== -1) {
        introEnd = introStart + 100 + nextChapterMatch;
    } else {
        introEnd = introStart + 20000; // Take reasonable chunk
    }

    const introText = fullText.slice(introStart, introEnd);
    console.log(`📖 Extracted Introduction: ${introText.length} characters`);

    return introText;
}

/**
 * Simple paragraph detection using sentence boundaries in continuous text
 */
function detectParagraphsFromRaw(text) {
    console.log('🔍 Detecting paragraphs from continuous raw text...');

    // First, clean up the text
    let cleaned = text
        .replace(/^\d+\s*/gm, '') // Remove page numbers
        .replace(/^(INTRODUCTION|LIFE ITSELF|Chapter \d+).*$/gm, '') // Remove headers
        .replace(/\n+/g, ' ') // Replace all newlines with spaces
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();

    console.log(`📝 Cleaned text: ${cleaned.length} characters`);

    // Split by sentence endings followed by capital letters
    // This regex looks for: period/!/?  + space + capital letter
    const sentences = cleaned.split(/([.!?])\s+(?=[A-Z])/);

    console.log(`📝 Found ${sentences.length} sentence fragments`);

    // Recombine sentences into paragraphs
    let paragraphs = [];
    let currentParagraph = '';

    for (let i = 0; i < sentences.length; i += 2) {
        const sentence = sentences[i];
        const punctuation = sentences[i + 1] || '';

        if (!sentence) continue;

        const fullSentence = sentence.trim() + punctuation;

        // Add to current paragraph
        if (currentParagraph) {
            currentParagraph += ' ' + fullSentence;
        } else {
            currentParagraph = fullSentence;
        }

        // Check if this should end a paragraph
        // End paragraph if we have 3-8 sentences or 150-400 words
        const sentenceCount = currentParagraph.split(/[.!?]/).length - 1;
        const wordCount = currentParagraph.split(/\s+/).length;

        if (sentenceCount >= 3 && wordCount >= 150) {
            paragraphs.push(currentParagraph.trim());
            currentParagraph = '';
        } else if (sentenceCount >= 8 || wordCount >= 400) {
            // Force end if getting too long
            paragraphs.push(currentParagraph.trim());
            currentParagraph = '';
        }
    }

    // Don't forget the last paragraph
    if (currentParagraph.trim()) {
        paragraphs.push(currentParagraph.trim());
    }

    console.log(`✅ Found ${paragraphs.length} logical paragraphs using sentence-boundary detection`);

    // Validate each paragraph
    const validParagraphs = paragraphs.map((text, index) => {
        const wordCount = text.split(/\s+/).length;
        const startsWithCapital = /^[A-Z]/.test(text);
        const endsWithPunctuation = /[.!?]$/.test(text);

        return {
            id: `simple_${index + 1}`,
            text: text,
            wordCount: wordCount,
            startsWithCapital: startsWithCapital,
            endsWithPunctuation: endsWithPunctuation,
            isValid: startsWithCapital && endsWithPunctuation && wordCount >= 50 && wordCount <= 500
        };
    });

    const validCount = validParagraphs.filter(p => p.isValid).length;
    console.log(`📊 Valid paragraphs: ${validCount}/${validParagraphs.length} (${Math.round(validCount / validParagraphs.length * 100)}%)`);

    return validParagraphs;
}

/**
 * Test the simple approach
 */
function testSimpleApproach() {
    console.log('🧪 Testing simple raw text approach...\n');

    try {
        // Extract Introduction using simple method
        const introText = extractIntroductionFromRaw();

        // Detect paragraphs using simple method
        const paragraphs = detectParagraphsFromRaw(introText);

        // Show first few paragraphs
        console.log('\n📝 First 3 paragraphs:');
        paragraphs.slice(0, 3).forEach((p, i) => {
            console.log(`\nParagraph ${i + 1}:`);
            console.log(`Words: ${p.wordCount}`);
            console.log(`Valid: ${p.isValid ? '✅' : '❌'}`);
            console.log(`Text: ${p.text.substring(0, 100)}...`);
        });

        // Save results
        const outputDir = path.join(__dirname, 'output');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const results = {
            method: 'simple_raw_text',
            totalParagraphs: paragraphs.length,
            validParagraphs: paragraphs.filter(p => p.isValid).length,
            averageWordCount: Math.round(paragraphs.reduce((sum, p) => sum + p.wordCount, 0) / paragraphs.length),
            paragraphs: paragraphs
        };

        fs.writeFileSync(
            path.join(outputDir, 'simple-text-extraction-results.json'),
            JSON.stringify(results, null, 2)
        );

        console.log('\n🎉 Simple approach completed!');
        console.log(`📊 Results: ${results.validParagraphs}/${results.totalParagraphs} valid paragraphs`);
        console.log(`📝 Average: ${results.averageWordCount} words per paragraph`);

        return results;

    } catch (error) {
        console.error('❌ Error in simple approach:', error.message);
        throw error;
    }
}

// Run the test
if (require.main === module) {
    testSimpleApproach();
}

module.exports = {
    extractTextFromRawPDF,
    extractIntroductionFromRaw,
    detectParagraphsFromRaw,
    testSimpleApproach
}; 