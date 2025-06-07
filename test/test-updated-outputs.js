const { validateBookStructure } = require('./parser.test.js');
const fs = require('fs');
const path = require('path');

/**
 * Test the updated output files to verify they have relative image paths
 */

function testUpdatedOutput(bookName, outputFile) {
    console.log(`\n🧪 Testing updated ${bookName}...`);

    try {
        // Load the data
        if (!fs.existsSync(outputFile)) {
            throw new Error(`File not found: ${outputFile}`);
        }

        const data = JSON.parse(fs.readFileSync(outputFile, 'utf8'));

        // Validate structure
        validateBookStructure(data);

        // Test basic info
        console.log(`📖 Title: "${data.book.title}"`);
        console.log(`👤 Author: ${data.book.author}`);
        console.log(`📚 Chapters: ${data.chapters.length}`);
        console.log(`📝 Words: ${data.book.totalWords.toLocaleString()}`);

        // Test image paths specifically
        const imageChunks = data.chapters.flatMap(ch =>
            ch.content.chunks.filter(chunk => chunk.type === 'image')
        );

        console.log(`🖼️  Total images: ${imageChunks.length}`);

        if (imageChunks.length > 0) {
            const relativePathCount = imageChunks.filter(chunk =>
                chunk.imageUrl.startsWith('./images/')
            ).length;

            const absolutePathCount = imageChunks.filter(chunk =>
                chunk.imageUrl.startsWith('/images/')
            ).length;

            console.log(`✅ Relative paths: ${relativePathCount}`);
            console.log(`❌ Absolute paths: ${absolutePathCount}`);

            if (absolutePathCount > 0) {
                throw new Error(`Found ${absolutePathCount} images with absolute paths`);
            }

            if (relativePathCount === imageChunks.length) {
                console.log('🎉 All image paths are relative!');
            }

            // Show a few examples
            console.log('📄 Example image URLs:');
            imageChunks.slice(0, 3).forEach(chunk => {
                console.log(`   ${chunk.imageUrl}`);
            });
        }

        console.log(`✅ ${bookName}: PASSED`);
        return true;

    } catch (error) {
        console.error(`❌ ${bookName}: FAILED - ${error.message}`);
        return false;
    }
}

function runUpdatedTests() {
    console.log('🚀 Testing Updated Output Files (Relative Paths)\n');

    const tests = [
        {
            name: 'Transformers',
            file: '../files/Transformers/output-updated.json'
        },
        {
            name: 'How Emotions Are Made',
            file: '../files/How Emotions Are Made/output-updated.json'
        }
    ];

    let passed = 0;
    const total = tests.length;

    for (const test of tests) {
        const filePath = path.resolve(__dirname, test.file);
        if (testUpdatedOutput(test.name, filePath)) {
            passed++;
        }
    }

    console.log(`\n🎯 Tests Passed: ${passed}/${total}`);

    if (passed === total) {
        console.log('🎉 ALL UPDATED FILES PASSED! Relative paths working correctly.');
    } else {
        console.log('💥 SOME TESTS FAILED!');
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    runUpdatedTests();
}

module.exports = { testUpdatedOutput, runUpdatedTests }; 