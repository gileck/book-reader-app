/**
 * Test script for Step 5.1: Link Chunk References
 * 
 * This script tests the functionality of adding targetChunkId and sourceChunkId to links.
 */

const step51 = require('./05-1-link-chunk-references');
const validation = require('./05-1-link-chunk-references-validation');

/**
 * Create test data with sample chunks and links
 */
function createTestData() {
    return {
        chapters: [
            {
                chapterNumber: 0,
                title: "Test Chapter",
                chunks: [
                    {
                        chunkId: "0_1",
                        type: "text",
                        content: "This is the first sentence with a reference. 1 Here is more text.",
                        pageNumber: 10,
                        paragraphIndex: 1,
                        wordCount: 13,
                        sentenceCount: 2,
                        links: [
                            {
                                text: "1",
                                targetPageNumber: 25,
                                targetText: "1",
                                linkId: "link_10_1",
                                role: "source"
                            }
                        ]
                    },
                    {
                        chunkId: "0_2",
                        type: "text",
                        content: "This is another sentence without links.",
                        pageNumber: 15,
                        paragraphIndex: 2,
                        wordCount: 7,
                        sentenceCount: 1,
                        links: []
                    },
                    {
                        chunkId: "0_3",
                        type: "text",
                        content: "1 This is the target of the footnote reference.",
                        pageNumber: 25,
                        paragraphIndex: 3,
                        wordCount: 9,
                        sentenceCount: 1,
                        links: [
                            {
                                text: "1",
                                targetPageNumber: 25,
                                targetText: "1",
                                linkId: "link_10_1",
                                role: "target"
                            }
                        ]
                    },
                    {
                        chunkId: "0_4",
                        type: "header",
                        content: "Test Header",
                        pageNumber: 30,
                        paragraphIndex: null,
                        wordCount: 2,
                        sentenceCount: 0,
                        links: []
                    }
                ]
            }
        ]
    };
}

/**
 * Run the test
 */
function runTest() {
    console.log('🧪 Testing Step 5.1: Link Chunk References');
    console.log('==========================================');

    try {
        // Create test data
        const testData = createTestData();
        console.log('✅ Test data created');

        // Run step 5.1
        const result = step51.execute(testData);
        console.log('✅ Step 5.1 executed successfully');

        // Validate the result
        const isValid = validation.validate(result);

        if (isValid) {
            console.log('✅ Validation passed');
        } else {
            console.log('❌ Validation failed');
            return false;
        }

        // Check specific results
        const sourceLink = result.chapters[0].chunks[0].links[0];
        const targetLink = result.chapters[0].chunks[2].links[0];

        console.log('\n📊 Test Results:');
        console.log('================');

        console.log(`Source link (${sourceLink.role}):`);
        console.log(`  - linkId: ${sourceLink.linkId}`);
        console.log(`  - text: ${sourceLink.text}`);
        console.log(`  - targetChunkId: ${sourceLink.targetChunkId || 'NOT SET'}`);

        console.log(`Target link (${targetLink.role}):`);
        console.log(`  - linkId: ${targetLink.linkId}`);
        console.log(`  - text: ${targetLink.text}`);
        console.log(`  - sourceChunkId: ${targetLink.sourceChunkId || 'NOT SET'}`);

        // Verify expected results
        let testPassed = true;

        if (sourceLink.targetChunkId !== '0_3') {
            console.log(`❌ Expected source link targetChunkId to be '0_3', got: ${sourceLink.targetChunkId}`);
            testPassed = false;
        }

        if (targetLink.sourceChunkId !== '0_1') {
            console.log(`❌ Expected target link sourceChunkId to be '0_1', got: ${targetLink.sourceChunkId}`);
            testPassed = false;
        }

        if (testPassed) {
            console.log('\n🎉 All tests passed! Step 5.1 is working correctly.');
            return true;
        } else {
            console.log('\n💥 Some tests failed.');
            return false;
        }

    } catch (error) {
        console.error('❌ Test failed with error:', error.message);
        console.error(error.stack);
        return false;
    }
}

// Run the test if this script is executed directly
if (require.main === module) {
    const success = runTest();
    process.exit(success ? 0 : 1);
}

module.exports = {
    runTest,
    createTestData
};