/**
 * Tests for Step 6: Chunking Algorithm
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

const chunkingAlgorithm = require('../../steps/06-chunking-algorithm');
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
const { sampleRawText, sampleParagraphs } = require('../fixtures/sample-data');

describe('Step 6: Chunking Algorithm', () => {
    let mockConfig;
    let mockPipelineState;
    let mockFs;
    
    test('should create chunks successfully', async () => {
        mockConfig = createMockConfig();
        mockPipelineState = createMockPipelineState({ 
            rawText: sampleRawText,
            paragraphs: sampleParagraphs,
            headers: []
        });
        mockFs = mockWriteFileSync();
        
        try {
            const result = await chunkingAlgorithm.execute(mockPipelineState, mockConfig);
            
            // Verify result structure
            verifyStepOutput(result, ['chunks', 'metadata'], 'Chunking Algorithm');
            
            // Test chunks array
            assertNotEmpty(result.chunks, 'Should create at least one chunk');
            
            // Test first chunk content (as requested by user)
            const firstChunk = result.chunks[0];
            assertStartsWith(firstChunk.content, 'Modern development has evolved significantly', 
                'First chunk should start with expected content');
            
            // Test chunk structure
            for (const chunk of result.chunks) {
                assert(typeof chunk.id === 'string', 'Chunk should have ID');
                assert(typeof chunk.content === 'string', 'Chunk should have content');
                assert(typeof chunk.wordCount === 'number', 'Chunk should have word count');
                assert(typeof chunk.chapterNumber === 'number', 'Chunk should have chapter number');
                assert(typeof chunk.startPosition === 'number', 'Chunk should have start position');
                assert(typeof chunk.endPosition === 'number', 'Chunk should have end position');
                
                // Test chunk properties
                assert(chunk.content.length > 0, 'Chunk content should not be empty');
                assertInRange(chunk.wordCount, 10, 1000, 'Chunk word count should be reasonable');
                assert(chunk.endPosition > chunk.startPosition, 'End position should be after start position');
            }
            
            // Test metadata
            assertMetadataProperties(result.metadata, ['chunkingAlgorithm'], 'Chunking algorithm metadata');
            
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
                chunkingAlgorithm.execute(mockPipelineState, mockConfig),
                /Step 4 \(paragraph detection\) must be completed first/,
                'Should throw error when prerequisites are missing'
            );
        } finally {
            mockFs.restore();
            cleanupTempDir(mockConfig.OUTPUT_DIR);
        }
    });
    
    test('should respect chunk size limits', async () => {
        mockConfig = createMockConfig({
            CHUNK_TARGET_MIN: 50,
            CHUNK_TARGET_MAX: 200,
            CHUNK_ABSOLUTE_MIN: 30,
            CHUNK_ABSOLUTE_MAX: 300
        });
        mockPipelineState = createMockPipelineState({ 
            rawText: sampleRawText,
            paragraphs: sampleParagraphs,
            headers: []
        });
        mockFs = mockWriteFileSync();
        
        try {
            const result = await chunkingAlgorithm.execute(mockPipelineState, mockConfig);
            
            // Test chunk size limits
            for (const chunk of result.chunks) {
                assertInRange(chunk.wordCount, mockConfig.CHUNK_ABSOLUTE_MIN, mockConfig.CHUNK_ABSOLUTE_MAX, 
                    `Chunk ${chunk.id} should respect absolute size limits`);
            }
            
            // Most chunks should be within target range
            const targetRangeChunks = result.chunks.filter(chunk => 
                chunk.wordCount >= mockConfig.CHUNK_TARGET_MIN && 
                chunk.wordCount <= mockConfig.CHUNK_TARGET_MAX
            );
            
            const targetRangeRatio = targetRangeChunks.length / result.chunks.length;
            assert(targetRangeRatio > 0.5, 'Most chunks should be within target range');
            
        } finally {
            mockFs.restore();
            cleanupTempDir(mockConfig.OUTPUT_DIR);
        }
    });
    
    test('should assign chunks to correct chapters', async () => {
        mockConfig = createMockConfig();
        mockPipelineState = createMockPipelineState({ 
            rawText: sampleRawText,
            paragraphs: sampleParagraphs,
            headers: []
        });
        mockFs = mockWriteFileSync();
        
        try {
            const result = await chunkingAlgorithm.execute(mockPipelineState, mockConfig);
            
            // Test chapter assignment
            for (const chunk of result.chunks) {
                // Should be assigned to existing chapter
                const chapterExists = sampleParagraphs.some(p => p.chapterNumber === chunk.chapterNumber);
                assert(chapterExists, `Chunk ${chunk.id} should be assigned to existing chapter ${chunk.chapterNumber}`);
            }
            
        } finally {
            mockFs.restore();
            cleanupTempDir(mockConfig.OUTPUT_DIR);
        }
    });
    
    test('should generate unique chunk IDs', async () => {
        mockConfig = createMockConfig();
        mockPipelineState = createMockPipelineState({ 
            rawText: sampleRawText,
            paragraphs: sampleParagraphs,
            headers: []
        });
        mockFs = mockWriteFileSync();
        
        try {
            const result = await chunkingAlgorithm.execute(mockPipelineState, mockConfig);
            
            // Test chunk ID uniqueness
            const chunkIds = result.chunks.map(chunk => chunk.id);
            const uniqueIds = new Set(chunkIds);
            
            assert.strictEqual(chunkIds.length, uniqueIds.size, 'All chunk IDs should be unique');
            
            // Test ID format
            for (const chunk of result.chunks) {
                assert(chunk.id.length > 0, 'Chunk ID should not be empty');
                assert(typeof chunk.id === 'string', 'Chunk ID should be string');
            }
            
        } finally {
            mockFs.restore();
            cleanupTempDir(mockConfig.OUTPUT_DIR);
        }
    });
    
    test('should preserve content integrity in chunks', async () => {
        mockConfig = createMockConfig();
        mockPipelineState = createMockPipelineState({ 
            rawText: sampleRawText,
            paragraphs: sampleParagraphs,
            headers: []
        });
        mockFs = mockWriteFileSync();
        
        try {
            const result = await chunkingAlgorithm.execute(mockPipelineState, mockConfig);
            
            // Test that important content is preserved in chunks
            const allChunkContent = result.chunks.map(chunk => chunk.content).join(' ');
            
            assertContains(allChunkContent, 'Modern development has evolved significantly', 
                'Chunks should contain key content');
            assertContains(allChunkContent, 'Agile methodologies', 
                'Chunks should contain agile methodologies');
            
            // Test that first chunk starts correctly
            const firstChunk = result.chunks[0];
            assertStartsWith(firstChunk.content, 'Modern development has evolved significantly', 
                'First chunk should start with expected content');
            
        } finally {
            mockFs.restore();
            cleanupTempDir(mockConfig.OUTPUT_DIR);
        }
    });
    
    test('should calculate word counts correctly', async () => {
        mockConfig = createMockConfig();
        mockPipelineState = createMockPipelineState({ 
            rawText: sampleRawText,
            paragraphs: sampleParagraphs,
            headers: []
        });
        mockFs = mockWriteFileSync();
        
        try {
            const result = await chunkingAlgorithm.execute(mockPipelineState, mockConfig);
            
            // Test word count calculation
            for (const chunk of result.chunks) {
                const actualWordCount = chunk.content.split(/\s+/).filter(word => word.length > 0).length;
                const difference = Math.abs(chunk.wordCount - actualWordCount);
                
                // Allow some tolerance for different counting methods
                assert(difference <= 3, 
                    `Word count for chunk ${chunk.id} should be accurate: expected ~${actualWordCount}, got ${chunk.wordCount}`);
            }
            
        } finally {
            mockFs.restore();
            cleanupTempDir(mockConfig.OUTPUT_DIR);
        }
    });
    
    test('should handle edge cases gracefully', async () => {
        mockConfig = createMockConfig();
        // Create edge case with very short paragraphs
        const edgeCaseParagraphs = [
            {
                content: "Short.",
                chapterNumber: 1,
                startPosition: 0,
                endPosition: 6,
                wordCount: 1,
                isHeader: false
            },
            {
                content: "Another short paragraph.",
                chapterNumber: 1,
                startPosition: 7,
                endPosition: 31,
                wordCount: 3,
                isHeader: false
            }
        ];
        
        mockPipelineState = createMockPipelineState({ 
            rawText: sampleRawText,
            paragraphs: edgeCaseParagraphs,
            headers: []
        });
        mockFs = mockWriteFileSync();
        
        try {
            const result = await chunkingAlgorithm.execute(mockPipelineState, mockConfig);
            
            // Should handle edge cases without crashing
            assertNotEmpty(result.chunks, 'Should create chunks even with edge case paragraphs');
            
            // Test that chunks are still reasonable
            for (const chunk of result.chunks) {
                assert(chunk.content.length > 0, 'Chunk content should not be empty');
                assertInRange(chunk.wordCount, 1, 1000, 'Chunk word count should be reasonable');
            }
            
        } finally {
            mockFs.restore();
            cleanupTempDir(mockConfig.OUTPUT_DIR);
        }
    });
}); 