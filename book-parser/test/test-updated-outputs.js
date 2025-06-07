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

        // Test image structure specifically
        const imageChunks = data.chapters.flatMap(ch =>
            ch.content.chunks.filter(chunk => chunk.type === 'image')
        );

        console.log(`🖼️  Total images: ${imageChunks.length}`);

        if (imageChunks.length > 0) {
            // Check if metadata has imagesFolderPath
            if (!data.metadata || !data.metadata.imagesFolderPath) {
                throw new Error(`Missing imagesFolderPath in metadata`);
            }

            console.log(`📁 Images folder: ${data.metadata.imagesFolderPath}`);

            // Check if imagesFolderPath is relative
            if (!data.metadata.imagesFolderPath.startsWith('./images/')) {
                throw new Error(`imagesFolderPath is not relative: ${data.metadata.imagesFolderPath}`);
            }

            // Check if all image chunks have imageName
            const validImageNames = imageChunks.filter(chunk => chunk.imageName).length;
            const invalidImageChunks = imageChunks.filter(chunk => !chunk.imageName).length;

            console.log(`✅ Valid image names: ${validImageNames}`);
            console.log(`❌ Missing image names: ${invalidImageChunks}`);

            if (invalidImageChunks > 0) {
                throw new Error(`Found ${invalidImageChunks} image chunks without imageName`);
            }

            console.log('🎉 All images have proper imageName structure!');

            // Show a few examples
            console.log('📄 Example image names:');
            imageChunks.slice(0, 3).forEach(chunk => {
                console.log(`   ${chunk.imageName}`);
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
            file: '../../files/Transformers/output.json'
        },
        {
            name: 'How Emotions Are Made',
            file: '../../files/How Emotions Are Made/output.json'
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