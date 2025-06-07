const fs = require('fs');
const path = require('path');
const { parsePdfWithImages } = require('../src/parse-pdf-book-with-images');

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

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return data;
}

function validateBookStructure(data) {
    console.log('🔍 Validating book structure...');

    // Check required properties
    if (!data.book) {
        throw new Error('Missing book metadata');
    }

    if (!data.chapters || !Array.isArray(data.chapters)) {
        throw new Error('Missing or invalid chapters array');
    }

    if (!data.book.title || !data.book.author) {
        throw new Error('Missing required book metadata (title or author)');
    }

    // Check chapter structure
    for (let i = 0; i < data.chapters.length; i++) {
        const chapter = data.chapters[i];
        if (!chapter.title || !chapter.content || !chapter.content.chunks) {
            throw new Error(`Invalid chapter structure at index ${i}`);
        }

        // Check chunk types
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

/**
 * Comprehensive chapter validation - tests exact order, content, and completeness
 * THIS IS WHAT MAKES TESTS ACTUALLY FAIL WHEN THEY SHOULD
 */
function validateChapterSequence(actualChapters, expectedChapterTitles, bookName) {
    console.log('🔍 Validating chapter sequence and content...');

    // 1. Exact count matching
    if (actualChapters.length !== expectedChapterTitles.length) {
        throw new Error(`Chapter count mismatch: expected ${expectedChapterTitles.length}, got ${actualChapters.length}`);
    }

    // 2. Exact order and title matching
    for (let i = 0; i < expectedChapterTitles.length; i++) {
        const expectedTitle = expectedChapterTitles[i];
        const actualChapter = actualChapters[i];

        if (actualChapter.title !== expectedTitle) {
            throw new Error(`Chapter order mismatch at position ${i}: expected "${expectedTitle}", got "${actualChapter.title}"`);
        }

        console.log(`✅ Chapter ${i + 1}: "${actualChapter.title}" (position correct)`);
    }

    // 3. Content completeness validation - THIS IS THE KEY FIX
    for (let i = 0; i < actualChapters.length; i++) {
        const chapter = actualChapters[i];

        // Check wordCount > 0
        if (!chapter.wordCount || chapter.wordCount <= 0) {
            throw new Error(`Chapter "${chapter.title}" has no content (wordCount: ${chapter.wordCount || 0})`);
        }

        // Check content.chunks is not empty
        if (!chapter.content.chunks || chapter.content.chunks.length === 0) {
            throw new Error(`Chapter "${chapter.title}" has empty chunks array`);
        }

        // Check for substantial text content (at least one text chunk)
        const textChunks = chapter.content.chunks.filter(chunk => chunk.type === 'text');
        if (textChunks.length === 0) {
            throw new Error(`Chapter "${chapter.title}" has no text content (only ${chapter.content.chunks.length} non-text chunks)`);
        }

        console.log(`✅ Chapter "${chapter.title}": ${chapter.wordCount} words, ${chapter.content.chunks.length} chunks (${textChunks.length} text)`);
    }

    console.log('✅ Chapter sequence and content validation passed');
}

function validateBookAgainstConfig(outputFile, configFile) {
    console.log(`\n🧪 Validating book against config...`);
    console.log(`📄 Output: ${path.basename(outputFile)}`);
    console.log(`⚙️ Config: ${path.basename(configFile)}`);

    // Load both files
    const data = loadBookData(outputFile);
    const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));

    // Validate structure first
    validateBookStructure(data);

    // Test basic metadata
    console.log(`📖 Title: "${data.book.title}"`);
    console.log(`👤 Author: ${data.book.author}`);

    // Validate against config metadata if provided
    if (config.metadata) {
        if (config.metadata.title && data.book.title !== config.metadata.title) {
            throw new Error(`Title mismatch: expected "${config.metadata.title}", got "${data.book.title}"`);
        }
        if (config.metadata.author && data.book.author !== config.metadata.author) {
            throw new Error(`Author mismatch: expected "${config.metadata.author}", got "${data.book.author}"`);
        }
    }

    // Extract expected chapters from config
    let expectedChapterTitles = [];
    if (config.chapters && config.chapters.expectedTitles) {
        expectedChapterTitles = config.chapters.expectedTitles;
    } else {
        console.log('⚠️  No expectedTitles in config, using fallback validation');
        return validateBookFallback(data);
    }

    // Test chapter titles against config
    const actualTitles = data.chapters.map(ch => ch.title);
    const foundTitles = [];
    const missingTitles = [];

    console.log(`📚 Expected chapters from config: ${expectedChapterTitles.length}`);
    console.log(`📚 Actual chapters found: ${actualTitles.length}`);

    for (const expectedTitle of expectedChapterTitles) {
        if (actualTitles.includes(expectedTitle)) {
            foundTitles.push(expectedTitle);
            console.log(`✅ Found: "${expectedTitle}"`);
        } else {
            missingTitles.push(expectedTitle);
            console.log(`❌ Missing: "${expectedTitle}"`);
        }
    }

    // STRICT VALIDATION - Fail if any chapters are missing
    if (missingTitles.length > 0) {
        throw new Error(`Missing ${missingTitles.length} expected chapters: ${missingTitles.map(t => `"${t}"`).join(', ')}`);
    }

    // Test images
    const totalImages = data.chapters.reduce((sum, ch) =>
        sum + ch.content.chunks.filter(chunk => chunk.type === 'image').length, 0);
    console.log(`🖼️  Images: ${totalImages}`);

    // Test word count
    console.log(`📝 Words: ${data.book.totalWords.toLocaleString()}`);

    // Test images folder path (should be relative)
    const imageChunks = data.chapters.flatMap(ch =>
        ch.content.chunks.filter(chunk => chunk.type === 'image')
    );

    if (imageChunks.length > 0) {
        // Check if metadata has imagesFolderPath
        if (!data.metadata || !data.metadata.imagesFolderPath) {
            throw new Error(`Missing imagesFolderPath in metadata`);
        }

        // Check if imagesFolderPath is relative
        if (!data.metadata.imagesFolderPath.startsWith('./images/')) {
            throw new Error(`imagesFolderPath is not relative: ${data.metadata.imagesFolderPath}`);
        }

        // Check if all image chunks have imageName instead of imageUrl
        const missingImageName = imageChunks.filter(chunk => !chunk.imageName);
        if (missingImageName.length > 0) {
            throw new Error(`Found ${missingImageName.length} image chunks without imageName`);
        }

        console.log('✅ Images folder path is relative and all chunks have imageName');
    }

    console.log(`✅ All ${foundTitles.length} expected chapters found!`);
    console.log(`📊 Validation: PASSED`);

    return {
        expectedChapters: expectedChapterTitles.length,
        foundChapters: foundTitles.length,
        totalImages,
        totalWords: data.book.totalWords,
        passed: true
    };
}

function validateBookFallback(data) {
    console.log('🔄 Using fallback validation (no config expectedTitles)');

    // Basic validation without config comparison
    if (data.chapters.length === 0) {
        throw new Error('No chapters found in output');
    }

    const totalImages = data.chapters.reduce((sum, ch) =>
        sum + ch.content.chunks.filter(chunk => chunk.type === 'image').length, 0);

    console.log(`📚 Chapters: ${data.chapters.length}`);
    console.log(`🖼️  Images: ${totalImages}`);
    console.log(`📝 Words: ${data.book.totalWords.toLocaleString()}`);
    console.log(`✅ Basic validation: PASSED`);

    return {
        expectedChapters: data.chapters.length,
        foundChapters: data.chapters.length,
        totalImages,
        totalWords: data.book.totalWords,
        passed: true
    };
}

function validateBook(bookName, outputFile, configFile) {
    console.log(`\n🧪 Testing ${bookName}...`);

    const expected = loadExpectedResults(configFile);
    const data = loadBookData(outputFile);

    // Validate structure first
    validateBookStructure(data);

    // Test basic metadata
    console.log(`📖 Title: "${data.book.title}"`);
    console.log(`👤 Author: ${data.book.author}`);

    // Comprehensive chapter validation (order, content, completeness)
    console.log(`📚 Chapters: ${data.chapters.length}/${expected.expectedChapters}`);

    validateChapterSequence(data.chapters, expected.expectedChapterTitles, bookName);

    // Test images
    const totalImages = data.chapters.reduce((sum, ch) =>
        sum + ch.content.chunks.filter(chunk => chunk.type === 'image').length, 0);
    console.log(`🖼️  Images: ${totalImages}`);

    // Test word count
    console.log(`📝 Words: ${data.book.totalWords.toLocaleString()}`);

    // Test images folder path (should be relative)
    const imageChunks = data.chapters.flatMap(ch =>
        ch.content.chunks.filter(chunk => chunk.type === 'image')
    );

    if (imageChunks.length > 0) {
        // Check if metadata has imagesFolderPath
        if (!data.metadata || !data.metadata.imagesFolderPath) {
            throw new Error(`Missing imagesFolderPath in metadata`);
        }

        // Check if imagesFolderPath is relative
        if (!data.metadata.imagesFolderPath.startsWith('./images/')) {
            throw new Error(`imagesFolderPath is not relative: ${data.metadata.imagesFolderPath}`);
        }

        // Check if all image chunks have imageName instead of imageUrl
        const missingImageName = imageChunks.filter(chunk => !chunk.imageName);
        if (missingImageName.length > 0) {
            throw new Error(`Found ${missingImageName.length} image chunks without imageName`);
        }

        console.log('✅ Images folder path is relative and all chunks have imageName');
    }

    console.log(`✅ All ${expected.expectedChapters} expected chapters validated!`);
    console.log(`📊 Success Rate: 100%`);

    return {
        bookName,
        actualChapters: data.chapters.length,
        expectedChapters: expected.expectedChapters,
        foundTitles: expected.expectedChapters,
        missingTitles: 0,
        successRate: 100,
        totalImages,
        totalWords: data.book.totalWords
    };
}

async function testParser(bookFolderPath, expectedResult) {
    console.log(`\n🚀 Testing parser with: ${path.basename(bookFolderPath)}`);

    try {
        const { book, chapters } = await parsePdfWithImages(bookFolderPath);

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

function runValidationTests() {
    console.log('🚀 Running Book Parsing Validation Tests\n');

    const results = [];
    const errors = [];

    try {
        // Test pre-existing parsed files with config validation
        const testFiles = [
            {
                name: 'Transformers',
                outputFile: '../../files/Transformers/output.json',
                configFile: '../../files/Transformers/config.json'
            },
            {
                name: 'How Emotions Are Made',
                outputFile: '../../files/How Emotions Are Made/output.json',
                configFile: '../../files/How Emotions Are Made/config.json'
            }
        ];

        for (const test of testFiles) {
            const outputPath = path.resolve(__dirname, test.outputFile);
            const configPath = path.resolve(__dirname, test.configFile);

            try {
                if (fs.existsSync(outputPath)) {
                    let result;

                    // Try config-based validation first
                    if (fs.existsSync(configPath)) {
                        console.log(`\n🧪 Testing ${test.name} with config validation...`);
                        result = validateBookAgainstConfig(outputPath, configPath);
                        result.bookName = test.name;
                        result.validationType = 'config';
                    } else {
                        console.log(`\n🧪 Testing ${test.name} with fallback validation...`);
                        result = validateBook(test.name, outputPath);
                        result.validationType = 'fallback';
                    }

                    results.push(result);
                    console.log(`✅ ${test.name}: PASSED`);
                } else {
                    console.log(`⚠️  Skipping ${test.name} - output file not found`);
                }
            } catch (error) {
                console.error(`❌ ${test.name}: FAILED - ${error.message}`);
                errors.push({
                    bookName: test.name,
                    error: error.message
                });
            }
        }

        // Summary
        console.log('\n📋 SUMMARY');
        console.log('='.repeat(50));

        if (results.length > 0) {
            results.forEach(result => {
                const successIndicator = result.validationType === 'config' ? '✅ CONFIG' : '⚠️  FALLBACK';
                console.log(`${result.bookName || result.name}: ${successIndicator}`);
                console.log(`  Chapters: ${result.foundChapters}/${result.expectedChapters}`);
                console.log(`  Images: ${result.totalImages}`);
                console.log(`  Words: ${result.totalWords.toLocaleString()}`);
                console.log('');
            });
        }

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
            console.log('💥 TESTS FAILED! Some books did not meet expected chapter requirements.');
            throw new Error(`${errors.length} test(s) failed validation`);
        } else if (passedTests === 0) {
            console.log('⚠️  No tests were run - check file paths');
        } else {
            console.log('🎉 ALL TESTS PASSED! Chapter detection working correctly.');
        }

    } catch (error) {
        console.error('❌ Test suite failed:', error.message);
        process.exit(1);
    }
}

function runStrictValidationTests() {
    console.log('🚀 Running Strict Book Parsing Validation Tests\n');

    const testFiles = [
        {
            name: 'Transformers',
            outputFile: '../../files/Transformers/output.json',
            configFile: '../../files/Transformers/config.json'
        },
        {
            name: 'How Emotions Are Made',
            outputFile: '../../files/How Emotions Are Made/output.json',
            configFile: '../../files/How Emotions Are Made/config.json'
        }
    ];

    let passedTests = 0;
    const totalTests = testFiles.length;

    for (const test of testFiles) {
        const outputPath = path.resolve(__dirname, test.outputFile);
        const configPath = path.resolve(__dirname, test.configFile);

        try {
            if (fs.existsSync(outputPath) && fs.existsSync(configPath)) {
                validateBook(test.name, outputPath, configPath);
                console.log(`✅ ${test.name}: PASSED`);
                passedTests++;
            } else {
                if (!fs.existsSync(outputPath)) {
                    console.log(`⚠️  Skipping ${test.name} - output file not found`);
                }
                if (!fs.existsSync(configPath)) {
                    console.log(`⚠️  Skipping ${test.name} - config file not found`);
                }
            }
        } catch (error) {
            console.error(`❌ ${test.name}: FAILED - ${error.message}`);
        }
    }

    console.log(`\n🎯 Tests Passed: ${passedTests}/${totalTests}`);

    if (passedTests === totalTests && totalTests > 0) {
        console.log('🎉 ALL TESTS PASSED!');
    } else {
        console.log('💥 SOME TESTS FAILED!');
        process.exit(1);
    }
}

// Command line interface
function showHelp() {
    console.log(`
📚 Book Parser Test Suite

Usage: node parser.test.js [command] [options]

Commands:
  strict          Run strict validation tests (DEFAULT - comprehensive chapter validation)
  config          Run config-based validation tests with fallback (legacy mode)
  help, --help    Show this help message

Options:
  --book-folder   Path to specific book folder for single test
  --output-file   Path to specific output file for single test

Examples:
  node parser.test.js              # Runs strict validation (default)
  node parser.test.js strict       # Explicitly run strict validation  
  node parser.test.js config       # Run legacy config-based validation
  node parser.test.js config --book-folder ../files/MyBook/ --output-file ../files/MyBook/output.json

Config file format (source of truth for expected values):
{
  "metadata": {
    "title": "Book Title",
    "author": "Author Name"
  },
  "chapters": {
    "expectedTitles": [
      "Chapter 1: Title",
      "Chapter 2: Title"
    ]
  }
}

Note: Strict validation (default) ensures comprehensive chapter quality.
      Config mode provides legacy validation with fallback behavior.
      Both modes read expected values from config files as source of truth.
`);
}

// Run tests if called directly
if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0];

    if (command === 'help' || command === '--help' || args.includes('--help')) {
        showHelp();
        process.exit(0);
    }

    try {
        if (command === 'config') {
            const bookFolder = args.find((arg, i) => args[i - 1] === '--book-folder');
            const outputFile = args.find((arg, i) => args[i - 1] === '--output-file');

            if (bookFolder && outputFile) {
                const configFile = path.join(bookFolder, 'config.json');
                console.log('🧪 Running single config-based validation...');
                validateBookAgainstConfig(outputFile, configFile);
                console.log('🎉 Single test PASSED!');
            } else {
                runValidationTests();
            }
        } else if (command === 'strict') {
            runStrictValidationTests();
        } else {
            console.log('🔄 Running default validation tests (strict)...');
            runStrictValidationTests();
        }
    } catch (error) {
        console.error('❌ Test execution failed:', error.message);
        process.exit(1);
    }
}

module.exports = {
    validateBook,
    validateBookAgainstConfig,
    validateBookStructure,
    validateChapterSequence,
    runValidationTests,
    runStrictValidationTests,
    testParser,
    loadExpectedResults
}; 