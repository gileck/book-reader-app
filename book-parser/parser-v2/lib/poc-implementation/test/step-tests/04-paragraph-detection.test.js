/**
 * Tests for Step 4: Paragraph Detection
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

const paragraphDetection = require('../../steps/04-paragraph-detection');
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
const { sampleRawText, sampleChapters, sampleParagraphs, sampleParagraphOutput } = require('../fixtures/transformers-data');

describe('Step 4: Paragraph Detection', () => {
    let mockConfig;
    let mockPipelineState;
    let mockFs;
    
    test('should detect paragraphs successfully', async () => {
        mockConfig = createMockConfig();
        mockPipelineState = createMockPipelineState({ 
            rawText: sampleRawText,
            mergedChapters: sampleChapters
        });
        mockFs = mockWriteFileSync();
        
        try {
            const result = await paragraphDetection.execute(mockPipelineState, mockConfig);
            
            // Verify result structure
            verifyStepOutput(result, ['paragraphs', 'metadata'], 'Paragraph Detection');
            
            // Test paragraphs array
            assertNotEmpty(result.paragraphs, 'Should detect at least one paragraph');
            assertInRange(result.paragraphs.length, 3, 50, 'Should detect reasonable number of paragraphs');
            
            // Test first paragraph content (as requested by user)
            const firstParagraph = result.paragraphs[0];
            assertStartsWith(firstParagraph.content, 'Modern development has evolved significantly', 
                'First paragraph should start with expected content');
            
            // Test paragraph structure
            for (const paragraph of result.paragraphs) {
                assert(typeof paragraph.content === 'string', 'Paragraph should have content');
                assert(typeof paragraph.chapterNumber === 'number', 'Paragraph should have chapter number');
                assert(typeof paragraph.startPosition === 'number', 'Paragraph should have start position');
                assert(typeof paragraph.endPosition === 'number', 'Paragraph should have end position');
                assert(typeof paragraph.wordCount === 'number', 'Paragraph should have word count');
                assert(typeof paragraph.isHeader === 'boolean', 'Paragraph should have isHeader flag');
                
                // Test content is reasonable
                assert(paragraph.content.length > 0, 'Paragraph content should not be empty');
                assertInRange(paragraph.wordCount, 1, 500, 'Paragraph word count should be reasonable');
                assert(paragraph.endPosition > paragraph.startPosition, 'End position should be after start position');
            }
            
            // Test metadata
            assertMetadataProperties(result.metadata, ['paragraphDetection'], 'Paragraph detection metadata');
            
        } finally {
            mockFs.restore();
            cleanupTempDir(mockConfig.OUTPUT_DIR);
        }
    });
    
    test('should handle missing prerequisites gracefully', async () => {
        mockConfig = createMockConfig();
        mockPipelineState = createMockPipelineState(); // No mergedChapters
        mockFs = mockWriteFileSync();
        
        try {
            await assert.rejects(
                paragraphDetection.execute(mockPipelineState, mockConfig),
                /Step 3 \(page extraction\) must be completed first/,
                'Should throw error when prerequisites are missing'
            );
        } finally {
            mockFs.restore();
            cleanupTempDir(mockConfig.OUTPUT_DIR);
        }
    });
    
    test('should assign paragraphs to correct chapters', async () => {
        mockConfig = createMockConfig();
        mockPipelineState = createMockPipelineState({ 
            rawText: sampleRawText,
            mergedChapters: sampleChapters
        });
        mockFs = mockWriteFileSync();
        
        try {
            const result = await paragraphDetection.execute(mockPipelineState, mockConfig);
            
            // Test chapter assignment
            for (const paragraph of result.paragraphs) {
                // Should be assigned to existing chapter
                const chapterExists = sampleChapters.some(ch => ch.chapterNumber === paragraph.chapterNumber);
                assert(chapterExists, `Paragraph should be assigned to existing chapter ${paragraph.chapterNumber}`);
            }
            
            // Test that each chapter has at least one paragraph
            for (const chapter of sampleChapters) {
                const chapterParagraphs = result.paragraphs.filter(p => p.chapterNumber === chapter.chapterNumber);
                assertNotEmpty(chapterParagraphs, `Chapter ${chapter.chapterNumber} should have at least one paragraph`);
            }
            
        } finally {
            mockFs.restore();
            cleanupTempDir(mockConfig.OUTPUT_DIR);
        }
    });
    
    test('should detect paragraph boundaries correctly', async () => {
        mockConfig = createMockConfig();
        mockPipelineState = createMockPipelineState({ 
            rawText: sampleRawText,
            mergedChapters: sampleChapters
        });
        mockFs = mockWriteFileSync();
        
        try {
            const result = await paragraphDetection.execute(mockPipelineState, mockConfig);
            
            // Test paragraph boundaries
            for (let i = 0; i < result.paragraphs.length - 1; i++) {
                const currentParagraph = result.paragraphs[i];
                const nextParagraph = result.paragraphs[i + 1];
                
                // Paragraphs should not overlap (unless in different chapters)
                if (currentParagraph.chapterNumber === nextParagraph.chapterNumber) {
                    assert(currentParagraph.endPosition <= nextParagraph.startPosition, 
                        `Paragraphs ${i} and ${i + 1} should not overlap`);
                }
            }
            
        } finally {
            mockFs.restore();
            cleanupTempDir(mockConfig.OUTPUT_DIR);
        }
    });
    
    test('should calculate word counts correctly', async () => {
        mockConfig = createMockConfig();
        mockPipelineState = createMockPipelineState({ 
            rawText: sampleRawText,
            mergedChapters: sampleChapters
        });
        mockFs = mockWriteFileSync();
        
        try {
            const result = await paragraphDetection.execute(mockPipelineState, mockConfig);
            
            // Test word count calculation
            for (const paragraph of result.paragraphs) {
                const actualWordCount = paragraph.content.split(/\s+/).filter(word => word.length > 0).length;
                const difference = Math.abs(paragraph.wordCount - actualWordCount);
                
                // Allow some tolerance for different counting methods
                assert(difference <= 2, 
                    `Word count for paragraph should be accurate: expected ~${actualWordCount}, got ${paragraph.wordCount}`);
            }
            
        } finally {
            mockFs.restore();
            cleanupTempDir(mockConfig.OUTPUT_DIR);
        }
    });
    
    test('should preserve paragraph content integrity', async () => {
        mockConfig = createMockConfig();
        mockPipelineState = createMockPipelineState({ 
            rawText: sampleRawText,
            mergedChapters: sampleChapters
        });
        mockFs = mockWriteFileSync();
        
        try {
            const result = await paragraphDetection.execute(mockPipelineState, mockConfig);
            
            // Test that important content is preserved in paragraphs
            const allParagraphContent = result.paragraphs.map(p => p.content).join(' ');
            
            assertContains(allParagraphContent, 'Modern development has evolved significantly', 
                'Paragraphs should contain key content');
            assertContains(allParagraphContent, 'Agile methodologies', 
                'Paragraphs should contain agile methodologies');
            assertContains(allParagraphContent, 'Version control systems', 
                'Paragraphs should contain version control');
            
            // Test that paragraph content starts correctly
            const firstParagraph = result.paragraphs[0];
            assertStartsWith(firstParagraph.content, 'Modern development has evolved significantly', 
                'First paragraph should start with expected content');
            
        } finally {
            mockFs.restore();
            cleanupTempDir(mockConfig.OUTPUT_DIR);
        }
    });
}); 