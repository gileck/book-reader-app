const fs = require('fs');
const path = require('path');

/**
 * Test script to validate book parsing results
 */

// Expected results for each book
const expectedResults = {
    'Transformers': {
        title: "Transformer: the deep chemistry of life and death",
        author: "Nick Lane",
        expectedChapters: 11,
        expectedChapterTitles: [
            "LIFE ITSELF",
            "DISCOVERING THE NANOCOSM",
            "THE PATH OF CARBON",
            "FROM GASES TO LIFE",
            "REVOLUTIONS",
            "TO THE DARK SIDE",
            "THE FLUX CAPACITOR",
            "EPILOGUE",
            "ENVOI",
            "RED PROTEIN MECHANICS",
            "THE KREBS LINE"
        ]
    },
    'How Emotions Are Made': {
        title: "How Emotions are Made: The Secret Life of the Brain",
        author: "Lisa Feldman Barrett",
        expectedChapters: 14,
        expectedChapterTitles: [
            "Introduction: The Two-Thousand-Year-Old Assumption",
            "The Search for Emotion's \"Fingerprints\"",
            "Emotions Are Constructed",
            "The Myth of Universal Emotions",
            "The Origin of Feeling",
            "Concepts, Goals, and Words",
            "How the Brain Makes Emotions",
            "Emotions as Social Reality",
            "A New View of Human Nature",
            "Mastering Your Emotions",
            "Emotion and Illness",
            "Emotion and the Law",
            "Is a Growling Dog Angry?",
            "From Brain to Mind: The New Frontier"
        ]
    }
};

function loadBookData(filePath) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return data;
}

function validateBook(bookName, outputFile) {
    console.log(`\n🧪 Testing ${bookName}...`);

    const expected = expectedResults[bookName];
    const data = loadBookData(outputFile);

    // Test basic metadata
    console.log(`📖 Title: "${data.book.title}"`);
    console.log(`👤 Author: ${data.book.author}`);

    // Test chapter count
    const actualChapters = data.chapters.length;
    console.log(`📚 Chapters: ${actualChapters}/${expected.expectedChapters}`);

    if (actualChapters === expected.expectedChapters) {
        console.log(`✅ Perfect chapter count!`);
    } else {
        console.log(`⚠️  Chapter count mismatch (expected ${expected.expectedChapters}, got ${actualChapters})`);
    }

    // Test chapter titles
    const actualTitles = data.chapters.map(ch => ch.title);
    const foundTitles = [];
    const missingTitles = [];

    for (const expectedTitle of expected.expectedChapterTitles) {
        if (actualTitles.includes(expectedTitle)) {
            foundTitles.push(expectedTitle);
        } else {
            missingTitles.push(expectedTitle);
        }
    }

    console.log(`✅ Found ${foundTitles.length} expected chapters`);
    if (missingTitles.length > 0) {
        console.log(`❌ Missing ${missingTitles.length} chapters:`);
        missingTitles.forEach(title => {
            console.log(`   - "${title}"`);
        });
    }

    // Test images
    const totalImages = data.chapters.reduce((sum, ch) =>
        sum + ch.content.chunks.filter(chunk => chunk.type === 'image').length, 0);
    console.log(`🖼️  Images: ${totalImages}`);

    // Test word count
    console.log(`📝 Words: ${data.book.totalWords.toLocaleString()}`);

    // Calculate success rate
    const successRate = (foundTitles.length / expected.expectedChapters * 100).toFixed(1);
    console.log(`📊 Success Rate: ${successRate}%`);

    return {
        bookName,
        actualChapters,
        expectedChapters: expected.expectedChapters,
        foundTitles: foundTitles.length,
        missingTitles: missingTitles.length,
        successRate: parseFloat(successRate),
        totalImages,
        totalWords: data.book.totalWords
    };
}

function runTests() {
    console.log('🚀 Running Book Parsing Validation Tests\n');

    const results = [];

    try {
        // Test Transformers
        const transformersResult = validateBook(
            'Transformers',
            'files/Transformers/output-new.json'
        );
        results.push(transformersResult);

        // Test How Emotions Are Made
        const emotionsResult = validateBook(
            'How Emotions Are Made',
            'files/How Emotions Are Made/output-new.json'
        );
        results.push(emotionsResult);

        // Summary
        console.log('\n📋 SUMMARY');
        console.log('='.repeat(50));

        results.forEach(result => {
            console.log(`${result.bookName}:`);
            console.log(`  Chapters: ${result.actualChapters}/${result.expectedChapters} (${result.successRate}%)`);
            console.log(`  Images: ${result.totalImages}`);
            console.log(`  Words: ${result.totalWords.toLocaleString()}`);
            console.log('');
        });

        const overallSuccess = results.reduce((sum, r) => sum + r.successRate, 0) / results.length;
        console.log(`🎯 Overall Success Rate: ${overallSuccess.toFixed(1)}%`);

        if (overallSuccess > 90) {
            console.log('🎉 EXCELLENT! Auto-detection working great!');
        } else if (overallSuccess > 75) {
            console.log('👍 GOOD! Auto-detection working well with minor issues.');
        } else {
            console.log('⚠️  NEEDS IMPROVEMENT! Auto-detection has significant issues.');
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    }
}

// Run tests if called directly
if (require.main === module) {
    runTests();
}

module.exports = { validateBook, runTests }; 