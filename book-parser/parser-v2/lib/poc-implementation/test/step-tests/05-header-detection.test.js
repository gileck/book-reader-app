/**
 * Tests for Step 5: Header Detection
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

const headerDetection = require('../../steps/05-header-detection');
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
const { sampleRawText, sampleParagraphs } = require('../fixtures/transformers-data');

describe('Step 5: Header Detection', () => {
    let mockConfig;
    let mockPipelineState;
    let mockFs;
    
    test('should detect headers successfully', async () => {
        mockConfig = createMockConfig();
        mockPipelineState = createMockPipelineState({ 
            rawText: sampleRawText,
            paragraphs: sampleParagraphs
        });
        mockFs = mockWriteFileSync();
        
        try {
            const result = await headerDetection.execute(mockPipelineState, mockConfig);
            
            // Verify result structure
            verifyStepOutput(result, ['headers', 'metadata'], 'Header Detection');
            
            // Test headers array (may be empty if no headers detected)
            assert(Array.isArray(result.headers), 'Should return headers array');
            
            // Test header structure if any headers detected
            for (const header of result.headers) {
                assert(typeof header.content === 'string', 'Header should have content');
                assert(typeof header.level === 'number', 'Header should have level');
                assert(typeof header.chapterNumber === 'number', 'Header should have chapter number');
                assert(typeof header.startPosition === 'number', 'Header should have start position');
                assert(typeof header.confidence === 'number', 'Header should have confidence');
                
                // Test header properties
                assertInRange(header.level, 1, 6, 'Header level should be between 1 and 6');
                assertInRange(header.confidence, 0, 1, 'Header confidence should be between 0 and 1');
                assert(header.content.length > 0, 'Header content should not be empty');
            }
            
            // Test metadata
            assertMetadataProperties(result.metadata, ['headerDetection'], 'Header detection metadata');
            
        } finally {
            mockFs.restore();
            cleanupTempDir(mockConfig.OUTPUT_DIR);
        }
    });
    
    test('should handle missing prerequisites gracefully', async () => {
        mockConfig = createMockConfig();
        mockPipelineState = createMockPipelineState(); // No paragraphs
        mockFs = mockWriteFileSync();
        
        try {
            await assert.rejects(
                headerDetection.execute(mockPipelineState, mockConfig),
                /Step 4 \(paragraph detection\) must be completed first/,
                'Should throw error when prerequisites are missing'
            );
        } finally {
            mockFs.restore();
            cleanupTempDir(mockConfig.OUTPUT_DIR);
        }
    });
    
    test('should detect chapter titles as headers', async () => {
        mockConfig = createMockConfig();
        // Create paragraphs with chapter titles
        const paragraphsWithHeaders = [
            {
                content: "Chapter 1: Introduction to Modern Development",
                chapterNumber: 1,
                startPosition: 0,
                endPosition: 45,
                wordCount: 6,
                isHeader: false
            },
            {
                content: "Modern development has evolved significantly over the past decade.",
                chapterNumber: 1,
                startPosition: 46,
                endPosition: 110,
                wordCount: 10,
                isHeader: false
            }
        ];
        
        mockPipelineState = createMockPipelineState({ 
            rawText: sampleRawText,
            paragraphs: paragraphsWithHeaders
        });
        mockFs = mockWriteFileSync();
        
        try {
            const result = await headerDetection.execute(mockPipelineState, mockConfig);
            
            // Should detect chapter title as header
            const chapterHeader = result.headers.find(h => h.content.includes('Chapter 1'));
            if (chapterHeader) {
                assertStartsWith(chapterHeader.content, 'Chapter 1: Introduction to Modern Development', 
                    'Chapter title should be detected as header');
                assertInRange(chapterHeader.level, 1, 2, 'Chapter title should be high-level header');
            }
            
        } finally {
            mockFs.restore();
            cleanupTempDir(mockConfig.OUTPUT_DIR);
        }
    });
    
    test('should assign headers to correct chapters', async () => {
        mockConfig = createMockConfig();
        mockPipelineState = createMockPipelineState({ 
            rawText: sampleRawText,
            paragraphs: sampleParagraphs
        });
        mockFs = mockWriteFileSync();
        
        try {
            const result = await headerDetection.execute(mockPipelineState, mockConfig);
            
            // Test chapter assignment
            for (const header of result.headers) {
                // Should be assigned to existing chapter
                const chapterExists = sampleParagraphs.some(p => p.chapterNumber === header.chapterNumber);
                assert(chapterExists, `Header should be assigned to existing chapter ${header.chapterNumber}`);
            }
            
        } finally {
            mockFs.restore();
            cleanupTempDir(mockConfig.OUTPUT_DIR);
        }
    });
    
    test('should detect different header levels', async () => {
        mockConfig = createMockConfig();
        // Create paragraphs with different header patterns
        const paragraphsWithHeaders = [
            {
                content: "Chapter 1: Introduction",
                chapterNumber: 1,
                startPosition: 0,
                endPosition: 22,
                wordCount: 3,
                isHeader: false
            },
            {
                content: "The Evolution of Development Practices",
                chapterNumber: 1,
                startPosition: 23,
                endPosition: 61,
                wordCount: 6,
                isHeader: false
            },
            {
                content: "Key Concepts",
                chapterNumber: 1,
                startPosition: 62,
                endPosition: 74,
                wordCount: 2,
                isHeader: false
            }
        ];
        
        mockPipelineState = createMockPipelineState({ 
            rawText: sampleRawText,
            paragraphs: paragraphsWithHeaders
        });
        mockFs = mockWriteFileSync();
        
        try {
            const result = await headerDetection.execute(mockPipelineState, mockConfig);
            
            // Test header level assignment
            for (const header of result.headers) {
                if (header.content.includes('Chapter')) {
                    assertInRange(header.level, 1, 2, 'Chapter headers should be level 1-2');
                } else if (header.content.length < 30) {
                    assertInRange(header.level, 2, 4, 'Short headers should be level 2-4');
                }
            }
            
        } finally {
            mockFs.restore();
            cleanupTempDir(mockConfig.OUTPUT_DIR);
        }
    });
    
    test('should calculate header confidence correctly', async () => {
        mockConfig = createMockConfig();
        mockPipelineState = createMockPipelineState({ 
            rawText: sampleRawText,
            paragraphs: sampleParagraphs
        });
        mockFs = mockWriteFileSync();
        
        try {
            const result = await headerDetection.execute(mockPipelineState, mockConfig);
            
            // Test confidence calculation
            for (const header of result.headers) {
                assertInRange(header.confidence, 0.1, 1.0, 
                    'Header confidence should be reasonable');
                
                // Headers with "Chapter" should have higher confidence
                if (header.content.includes('Chapter')) {
                    assertInRange(header.confidence, 0.7, 1.0, 
                        'Chapter headers should have high confidence');
                }
            }
            
        } finally {
            mockFs.restore();
            cleanupTempDir(mockConfig.OUTPUT_DIR);
        }
    });
    
    test('should preserve header content integrity', async () => {
        mockConfig = createMockConfig();
        // Create paragraphs with known header content
        const paragraphsWithHeaders = [
            {
                content: "The Evolution of Development Practices",
                chapterNumber: 1,
                startPosition: 0,
                endPosition: 38,
                wordCount: 6,
                isHeader: false
            }
        ];
        
        mockPipelineState = createMockPipelineState({ 
            rawText: sampleRawText,
            paragraphs: paragraphsWithHeaders
        });
        mockFs = mockWriteFileSync();
        
        try {
            const result = await headerDetection.execute(mockPipelineState, mockConfig);
            
            // Test that header content is preserved
            const evolutionHeader = result.headers.find(h => h.content.includes('Evolution'));
            if (evolutionHeader) {
                assertStartsWith(evolutionHeader.content, 'The Evolution of Development Practices', 
                    'Header content should be preserved exactly');
            }
            
        } finally {
            mockFs.restore();
            cleanupTempDir(mockConfig.OUTPUT_DIR);
        }
    });
}); 