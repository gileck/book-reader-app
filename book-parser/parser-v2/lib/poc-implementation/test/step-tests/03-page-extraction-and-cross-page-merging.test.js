/**
 * Tests for Step 3: Page Extraction and Cross-Page Merging
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

const pageExtraction = require('../../steps/03-page-extraction-and-cross-page-merging');
const { 
    assertStartsWith, 
    assertContains,
    assertNotEmpty, 
    assertInRange,
    assertMetadataProperties,
    createMockConfig, 
    createMockPipelineState,
    verifyStepOutput,
    mockWriteFileSync,
    cleanupTempDir
} = require('../helpers/test-helpers');
const { sampleRawText, sampleChapters, samplePageExtractionOutput } = require('../fixtures/transformers-data');

describe('Step 3: Page Extraction and Cross-Page Merging', () => {
    let mockConfig;
    let mockPipelineState;
    let mockFs;
    
    test('should extract and merge pages successfully', async () => {
        mockConfig = createMockConfig();
        mockPipelineState = createMockPipelineState({ 
            rawText: sampleRawText,
            chapters: sampleChapters
        });
        mockFs = mockWriteFileSync();
        
        try {
            const result = await pageExtraction.execute(mockPipelineState, mockConfig);
            
            // Verify result structure
            verifyStepOutput(result, ['mergedChapters', 'metadata'], 'Page Extraction and Cross-Page Merging');
            
            // Test merged chapters
            assertNotEmpty(result.mergedChapters, 'Should produce merged chapters');
            assertInRange(result.mergedChapters.length, 1, 10, 'Should have reasonable number of merged chapters');
            
            // Test first merged chapter content (as requested by user)
            const firstMergedChapter = result.mergedChapters[0];
            assertStartsWith(firstMergedChapter.content, 'Modern development has evolved significantly', 
                'First merged chapter should start with expected content');
            
            // Test chapter structure
            for (const chapter of result.mergedChapters) {
                assert(typeof chapter.title === 'string', 'Merged chapter should have title');
                assert(typeof chapter.chapterNumber === 'number', 'Merged chapter should have number');
                assert(typeof chapter.content === 'string', 'Merged chapter should have content');
                assert(chapter.content.length > 0, 'Merged chapter content should not be empty');
                
                // Test that page markers are removed
                assert(!chapter.content.includes('--- PAGE'), 
                    `Merged chapter ${chapter.chapterNumber} should not contain page markers`);
                assert(!chapter.content.includes('--- END PAGE'), 
                    `Merged chapter ${chapter.chapterNumber} should not contain end page markers`);
            }
            
            // Test metadata
            assertMetadataProperties(result.metadata, ['pageExtraction'], 'Page extraction metadata');
            
        } finally {
            mockFs.restore();
            cleanupTempDir(mockConfig.OUTPUT_DIR);
        }
    });
    
    test('should handle missing prerequisites gracefully', async () => {
        mockConfig = createMockConfig();
        mockPipelineState = createMockPipelineState(); // No chapters
        mockFs = mockWriteFileSync();
        
        try {
            await assert.rejects(
                pageExtraction.execute(mockPipelineState, mockConfig),
                /Step 2 \(chapter extraction\) must be completed first/,
                'Should throw error when prerequisites are missing'
            );
        } finally {
            mockFs.restore();
            cleanupTempDir(mockConfig.OUTPUT_DIR);
        }
    });
    
    test('should merge split sentences across pages', async () => {
        mockConfig = createMockConfig();
        mockPipelineState = createMockPipelineState({ 
            rawText: sampleRawText,
            chapters: sampleChapters
        });
        mockFs = mockWriteFileSync();
        
        try {
            const result = await pageExtraction.execute(mockPipelineState, mockConfig);
            
            // Test that sentences are properly merged
            for (const chapter of result.mergedChapters) {
                // Should not have awkward sentence breaks
                assert(!chapter.content.includes('.\n\n-'), 
                    `Chapter ${chapter.chapterNumber} should not have awkward sentence breaks`);
                
                // Should have coherent paragraphs
                const paragraphs = chapter.content.split('\n\n');
                for (const paragraph of paragraphs) {
                    if (paragraph.trim().length > 0) {
                        assertInRange(paragraph.length, 10, 2000, 
                            `Paragraph in chapter ${chapter.chapterNumber} should be reasonable length`);
                    }
                }
            }
            
        } finally {
            mockFs.restore();
            cleanupTempDir(mockConfig.OUTPUT_DIR);
        }
    });
    
    test('should preserve chapter content integrity', async () => {
        mockConfig = createMockConfig();
        mockPipelineState = createMockPipelineState({ 
            rawText: sampleRawText,
            chapters: sampleChapters
        });
        mockFs = mockWriteFileSync();
        
        try {
            const result = await pageExtraction.execute(mockPipelineState, mockConfig);
            
            // Test that important content is preserved
            const introChapter = result.mergedChapters.find(ch => ch.title.includes('Introduction'));
            if (introChapter) {
                assertStartsWith(introChapter.content, 'Modern development has evolved significantly', 
                    'Introduction chapter should start with expected content');
                assertContains(introChapter.content, 'Agile methodologies', 
                    'Introduction chapter should contain agile methodologies');
                assertContains(introChapter.content, 'backbone of successful modern development', 
                    'Introduction chapter should contain conclusion text');
            }
            
        } finally {
            mockFs.restore();
            cleanupTempDir(mockConfig.OUTPUT_DIR);
        }
    });
    
    test('should clean up formatting issues', async () => {
        mockConfig = createMockConfig();
        mockPipelineState = createMockPipelineState({ 
            rawText: sampleRawText,
            chapters: sampleChapters
        });
        mockFs = mockWriteFileSync();
        
        try {
            const result = await pageExtraction.execute(mockPipelineState, mockConfig);
            
            // Test formatting improvements
            for (const chapter of result.mergedChapters) {
                // Should not have excessive whitespace
                assert(!chapter.content.includes('   '), 
                    `Chapter ${chapter.chapterNumber} should not have excessive whitespace`);
                
                // Should not start or end with whitespace
                assert.strictEqual(chapter.content.trim(), chapter.content, 
                    `Chapter ${chapter.chapterNumber} should not have leading/trailing whitespace`);
                
                // Should have proper line breaks
                assert(!chapter.content.includes('\n\n\n'), 
                    `Chapter ${chapter.chapterNumber} should not have excessive line breaks`);
            }
            
        } finally {
            mockFs.restore();
            cleanupTempDir(mockConfig.OUTPUT_DIR);
        }
    });
    
    test('should maintain chapter order and numbers', async () => {
        mockConfig = createMockConfig();
        mockPipelineState = createMockPipelineState({ 
            rawText: sampleRawText,
            chapters: sampleChapters
        });
        mockFs = mockWriteFileSync();
        
        try {
            const result = await pageExtraction.execute(mockPipelineState, mockConfig);
            
            // Test chapter ordering
            for (let i = 0; i < result.mergedChapters.length - 1; i++) {
                const currentChapter = result.mergedChapters[i];
                const nextChapter = result.mergedChapters[i + 1];
                
                assert(currentChapter.chapterNumber <= nextChapter.chapterNumber, 
                    `Chapters should be in order: ${currentChapter.chapterNumber} vs ${nextChapter.chapterNumber}`);
            }
            
            // Test that chapter numbers are preserved
            for (const originalChapter of sampleChapters) {
                const mergedChapter = result.mergedChapters.find(ch => ch.chapterNumber === originalChapter.chapterNumber);
                assert(mergedChapter, `Chapter ${originalChapter.chapterNumber} should be preserved`);
                assert.strictEqual(mergedChapter.title, originalChapter.title, 
                    `Chapter ${originalChapter.chapterNumber} title should be preserved`);
            }
            
        } finally {
            mockFs.restore();
            cleanupTempDir(mockConfig.OUTPUT_DIR);
        }
    });
}); 