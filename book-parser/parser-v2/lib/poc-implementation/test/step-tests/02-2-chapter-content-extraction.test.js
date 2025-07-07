/**
 * Tests for Step 2.2: Chapter Content Extraction
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

const chapterContentExtraction = require('../../steps/02-2-chapter-content-extraction');
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
const { sampleRawText, sampleChapterMetadata, sampleChapters, samplePageExtractionOutput } = require('../fixtures/transformers-data');

describe('Step 2.2: Chapter Content Extraction', () => {
    let mockConfig;
    let mockPipelineState;
    let mockFs;
    
    test('should extract chapter content successfully', async () => {
        mockConfig = createMockConfig();
        mockPipelineState = createMockPipelineState({ 
            rawText: sampleRawText,
            chapterMetadata: sampleChapterMetadata 
        });
        mockFs = mockWriteFileSync();
        
        try {
            const result = await chapterContentExtraction.execute(mockPipelineState, mockConfig);
            
            // Verify result structure
            verifyStepOutput(result, ['chapters', 'metadata'], 'Chapter Content Extraction');
            
            // Test chapters array
            assertNotEmpty(result.chapters, 'Should extract at least one chapter');
            assertInRange(result.chapters.length, 1, 10, 'Should extract reasonable number of chapters');
            
            // Test first chapter content (as requested by user)
            const firstChapter = result.chapters[0];
            assertStartsWith(firstChapter.content, 'I NTRODUCTION', 
                'First chapter content should start with expected text');
            
            // Test chapter structure
            for (const chapter of result.chapters) {
                assert(typeof chapter.title === 'string', 'Chapter should have title');
                assert(typeof chapter.chapterNumber === 'number', 'Chapter should have number');
                assert(typeof chapter.content === 'string', 'Chapter should have content');
                assert(typeof chapter.startingPage === 'number', 'Chapter should have starting page');
                
                // Test content is not empty
                assert(chapter.content.length > 0, 'Chapter content should not be empty');
                
                // Test content contains meaningful text
                assertContains(chapter.content, 'the', 'Chapter content should contain common text');
            }
            
            // Test metadata
            assertMetadataProperties(result.metadata, ['chapterContentExtraction'], 'Chapter content extraction metadata');
            
        } finally {
            mockFs.restore();
            cleanupTempDir(mockConfig.OUTPUT_DIR);
        }
    });
    
    test('should handle missing prerequisites gracefully', async () => {
        mockConfig = createMockConfig();
        mockPipelineState = createMockPipelineState(); // No rawText or chapterMetadata
        mockFs = mockWriteFileSync();
        
        try {
            await assert.rejects(
                chapterContentExtraction.execute(mockPipelineState, mockConfig),
                /Step 1 \(text extraction\) must be completed first/,
                'Should throw error when prerequisites are missing'
            );
        } finally {
            mockFs.restore();
            cleanupTempDir(mockConfig.OUTPUT_DIR);
        }
    });
    
    test('should extract content matching chapter metadata', async () => {
        mockConfig = createMockConfig();
        mockPipelineState = createMockPipelineState({ 
            rawText: sampleRawText,
            chapterMetadata: sampleChapterMetadata 
        });
        mockFs = mockWriteFileSync();
        
        try {
            const result = await chapterContentExtraction.execute(mockPipelineState, mockConfig);
            
            // Test that extracted chapters match metadata
            assert.strictEqual(result.chapters.length, sampleChapterMetadata.length, 
                'Should extract same number of chapters as metadata');
            
            // Test chapter titles match
            for (let i = 0; i < result.chapters.length; i++) {
                const chapter = result.chapters[i];
                const metadata = sampleChapterMetadata[i];
                
                assert(chapter.title.includes(metadata.title) || metadata.title.includes(chapter.title), 
                    `Chapter ${i + 1} title should match metadata`);
                assert.strictEqual(chapter.chapterNumber, metadata.chapterNumber, 
                    `Chapter ${i + 1} number should match metadata`);
            }
            
        } finally {
            mockFs.restore();
            cleanupTempDir(mockConfig.OUTPUT_DIR);
        }
    });
    
    test('should clean and format chapter content', async () => {
        mockConfig = createMockConfig();
        mockPipelineState = createMockPipelineState({ 
            rawText: sampleRawText,
            chapterMetadata: sampleChapterMetadata 
        });
        mockFs = mockWriteFileSync();
        
        try {
            const result = await chapterContentExtraction.execute(mockPipelineState, mockConfig);
            
            // Test content formatting
            for (const chapter of result.chapters) {
                // Should not contain page markers
                assert(!chapter.content.includes('--- PAGE'), 
                    `Chapter ${chapter.chapterNumber} should not contain page markers`);
                assert(!chapter.content.includes('--- END PAGE'), 
                    `Chapter ${chapter.chapterNumber} should not contain end page markers`);
                
                // Should contain paragraphs
                assert(chapter.content.includes('\n'), 
                    `Chapter ${chapter.chapterNumber} should contain line breaks`);
                
                // Should not start with whitespace
                assert(!chapter.content.startsWith(' '), 
                    `Chapter ${chapter.chapterNumber} should not start with whitespace`);
                assert(!chapter.content.startsWith('\n'), 
                    `Chapter ${chapter.chapterNumber} should not start with newline`);
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
            chapterMetadata: sampleChapterMetadata 
        });
        mockFs = mockWriteFileSync();
        
        try {
            const result = await chapterContentExtraction.execute(mockPipelineState, mockConfig);
            
            // Test that important content is preserved
            const introChapter = result.chapters.find(ch => ch.title.includes('Introduction'));
            if (introChapter) {
                assertStartsWith(introChapter.content, 'I NTRODUCTION', 
                    'Introduction chapter should start with expected content');
                assertContains(introChapter.content, 'grey and crystalline', 
                    'Introduction chapter should contain space view description');
                assertContains(introChapter.content, 'blue-green', 
                    'Introduction chapter should contain Earth color description');
            }
            
            const chapterOne = result.chapters.find(ch => ch.title.includes('nanocosm'));
            if (chapterOne) {
                assertStartsWith(chapterOne.content, '1', 
                    'First chapter should start with chapter number');
                assertContains(chapterOne.content, 'Burlington House', 
                    'First chapter should contain Burlington House');
            }
            
        } finally {
            mockFs.restore();
            cleanupTempDir(mockConfig.OUTPUT_DIR);
        }
    });
    
    test('should handle edge cases gracefully', async () => {
        mockConfig = createMockConfig();
        // Create metadata with edge case positions
        const edgeCaseMetadata = [
            {
                title: "Test Chapter",
                chapterNumber: 1,
                startPosition: 0,
                endPosition: 100,
                startingPage: 1,
                confidence: 0.9,
                detectionSource: "test"
            }
        ];
        
        mockPipelineState = createMockPipelineState({ 
            rawText: sampleRawText,
            chapterMetadata: edgeCaseMetadata
        });
        mockFs = mockWriteFileSync();
        
        try {
            const result = await chapterContentExtraction.execute(mockPipelineState, mockConfig);
            
            // Should handle edge cases without crashing
            assertNotEmpty(result.chapters, 'Should extract chapters even with edge case metadata');
            
            // Test that content is reasonable
            for (const chapter of result.chapters) {
                assertInRange(chapter.content.length, 10, 10000, 
                    `Chapter ${chapter.chapterNumber} content should be reasonable length`);
            }
            
        } finally {
            mockFs.restore();
            cleanupTempDir(mockConfig.OUTPUT_DIR);
        }
    });
}); 