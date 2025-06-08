const fs = require('fs');
const path = require('path');
const { parser } = require('../parser/parse-pdf-book-generic');

/**
 * Test suite for PDF book parsing with images
 */

/**
 * Load expected results from config file
 */
function loadExpectedResults(configPath) {
    if (!fs.existsSync(configPath)) {
        throw new Error(`Config file not found: ${configPath}`);
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    // Support both chapterNames (legacy) and chapters.expectedTitles (new format)
    let expectedTitles = [];
    if (config.chapterNames) {
        expectedTitles = config.chapterNames;
    } else if (config.chapters?.expectedTitles) {
        expectedTitles = config.chapters.expectedTitles;
    }

    const expectedResults = {
        title: config.metadata?.title,
        author: config.metadata?.author,
        expectedChapters: expectedTitles.length,
        expectedChapterTitles: expectedTitles
    };

    return expectedResults;
}

function loadBookData(filePath) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function validateBookStructure(data) {
    console.log('🔍 Validating book structure...');

    if (!data.book) {
        throw new Error('Missing book metadata');
    }

    if (!data.chapters || !Array.isArray(data.chapters)) {
        throw new Error('Missing or invalid chapters array');
    }

    if (!data.book.title || !data.book.author) {
        throw new Error('Missing required book metadata (title or author)');
    }

    for (let i = 0; i < data.chapters.length; i++) {
        const chapter = data.chapters[i];
        if (!chapter.title || !chapter.content || !chapter.content.chunks) {
            throw new Error(`Invalid chapter structure at index ${i}`);
        }

        for (const chunk of chapter.content.chunks) {
            if (!['text', 'image', 'header'].includes(chunk.type)) {
                throw new Error(`Invalid chunk type: ${chunk.type}`);
            }

            if (chunk.type === 'image' && !chunk.imageName) {
                throw new Error(`Image chunk missing imageName`);
            }
        }
    }

    console.log('✅ Book structure validation passed');
}

function validateChapterContent(chapters) {
    console.log('🔍 Validating chapter content...');

    if (chapters.length === 0) {
        throw new Error('No chapters found');
    }

    for (let i = 0; i < chapters.length; i++) {
        const chapter = chapters[i];

        if (!chapter.wordCount || chapter.wordCount <= 0) {
            throw new Error(`Chapter "${chapter.title}" has no content (wordCount: ${chapter.wordCount || 0})`);
        }

        if (!chapter.content.chunks || chapter.content.chunks.length === 0) {
            throw new Error(`Chapter "${chapter.title}" has empty chunks array`);
        }

        const textChunks = chapter.content.chunks.filter(chunk => chunk.type === 'text');
        if (textChunks.length === 0) {
            throw new Error(`Chapter "${chapter.title}" has no text content`);
        }

        console.log(`✅ Chapter "${chapter.title}": ${chapter.wordCount} words, ${chapter.content.chunks.length} chunks`);
    }

    console.log('✅ Chapter content validation passed');
}

function validateImages(data) {
    const imageChunks = data.chapters.flatMap(ch =>
        ch.content.chunks.filter(chunk => chunk.type === 'image')
    );

    if (imageChunks.length > 0) {
        if (!data.metadata || !data.metadata.imagesFolderPath) {
            throw new Error(`Missing imagesFolderPath in metadata`);
        }

        if (!data.metadata.imagesFolderPath.startsWith('./images/')) {
            throw new Error(`imagesFolderPath is not relative: ${data.metadata.imagesFolderPath}`);
        }

        const missingImageName = imageChunks.filter(chunk => !chunk.imageName);
        if (missingImageName.length > 0) {
            throw new Error(`Found ${missingImageName.length} image chunks without imageName`);
        }

        console.log('✅ Images validation passed');
    }

    return imageChunks.length;
}

function validateBook(bookName, outputFile) {
    console.log(`\n🧪 Testing ${bookName}...`);

    const data = loadBookData(outputFile);

    validateBookStructure(data);

    console.log(`📖 Title: "${data.book.title}"`);
    console.log(`👤 Author: ${data.book.author}`);
    console.log(`📚 Chapters: ${data.chapters.length}`);

    validateChapterContent(data.chapters);

    const totalImages = validateImages(data);
    console.log(`🖼️  Images: ${totalImages}`);
    console.log(`📝 Words: ${data.book.totalWords.toLocaleString()}`);

    console.log(`✅ ${bookName}: PASSED`);

    return {
        bookName,
        actualChapters: data.chapters.length,
        totalImages,
        totalWords: data.book.totalWords,
        passed: true
    };
}

async function testParser(bookFolderPath) {
    console.log(`\n🚀 Testing parser with: ${path.basename(bookFolderPath)}`);

    try {
        const { book, chapters } = await parser(bookFolderPath);

        console.log('✅ Parser completed successfully');
        console.log(`📖 Title: "${book.title}"`);
        console.log(`👤 Author: ${book.author}`);
        console.log(`📚 Chapters: ${chapters.length}`);
        console.log(`📝 Words: ${book.totalWords.toLocaleString()}`);

        const totalImages = chapters.reduce((sum, ch) =>
            sum + ch.content.chunks.filter(chunk => chunk.type === 'image').length, 0);
        console.log(`🖼️  Images: ${totalImages}`);

        return { book, chapters };
    } catch (error) {
        console.error('❌ Parser failed:', error.message);
        throw error;
    }
}

function runTests() {
    console.log('🚀 Running Book Parsing Tests\n');

    const testFiles = [
        {
            name: 'Transformers',
            outputFile: path.resolve(__dirname, '../../files/Transformers/output.json')
        },
        {
            name: 'How Emotions Are Made',
            outputFile: path.resolve(__dirname, '../../files/How Emotions Are Made/output.json')
        }
    ];

    const results = [];
    const errors = [];

    for (const test of testFiles) {
        try {
            if (fs.existsSync(test.outputFile)) {
                const result = validateBook(test.name, test.outputFile);
                results.push(result);
            } else {
                console.log(`⚠️  Skipping ${test.name} - output file not found`);
            }
        } catch (error) {
            console.error(`❌ ${test.name}: FAILED - ${error.message}`);
            errors.push({ bookName: test.name, error: error.message });
        }
    }

    console.log('\n📋 SUMMARY');
    console.log('='.repeat(50));

    results.forEach(result => {
        console.log(`${result.bookName}: ✅ PASSED`);
        console.log(`  Chapters: ${result.actualChapters}`);
        console.log(`  Images: ${result.totalImages}`);
        console.log(`  Words: ${result.totalWords.toLocaleString()}`);
        console.log('');
    });

    if (errors.length > 0) {
        console.log('❌ FAILED TESTS:');
        errors.forEach(error => {
            console.log(`  ${error.bookName}: ${error.error}`);
        });
        console.log('');
    }

    const passedTests = results.length;
    const totalTests = results.length + errors.length;

    console.log(`🎯 Tests Passed: ${passedTests}/${totalTests}`);

    if (errors.length > 0) {
        console.log('💥 TESTS FAILED!');
        process.exit(1);
    } else if (passedTests === 0) {
        console.log('⚠️  No tests were run - check file paths');
    } else {
        console.log('🎉 ALL TESTS PASSED!');
    }
}

function showHelp() {
    console.log(`
📚 Book Parser Test Suite

Usage: node parser.test.js [command]

Commands:
  test            Run validation tests (DEFAULT)
  help            Show this help message

Examples:
  node parser.test.js         # Run tests
  node parser.test.js test    # Run tests
  node parser.test.js help    # Show help
`);
}

if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0];

    if (command === 'help' || command === '--help') {
        showHelp();
        process.exit(0);
    }

    try {
        runTests();
    } catch (error) {
        console.error('❌ Test execution failed:', error.message);
        process.exit(1);
    }
}

module.exports = {
    validateBook,
    validateBookStructure,
    validateChapterContent,
    testParser,
    runTests
}; 