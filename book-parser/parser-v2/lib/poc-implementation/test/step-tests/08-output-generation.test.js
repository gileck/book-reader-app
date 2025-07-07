/**
 * Tests for Step 8: Output Generation
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

const outputGeneration = require('../../steps/08-output-generation');
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
const { sampleRawText, sampleChunks } = require('../fixtures/sample-data');

describe('Step 8: Output Generation', () => {
    let mockConfig;
    let mockPipelineState;
    let mockFs;
    
    test('should generate output successfully', async () => {
        mockConfig = createMockConfig();
        mockPipelineState = createMockPipelineState({ 
            rawText: sampleRawText,
            chunks: sampleChunks,
            pages: [
                { pageNumber: 1, chunkIds: ['chunk-1-1'], startPosition: 0, endPosition: 500 },
                { pageNumber: 2, chunkIds: ['chunk-2-1'], startPosition: 501, endPosition: 1000 }
            ]
        });
        mockFs = mockWriteFileSync();
        
        try {
            const result = await outputGeneration.execute(mockPipelineState, mockConfig);
            
            // Verify result structure
            verifyStepOutput(result, ['metadata'], 'Output Generation');
            
            // Test metadata
            assertMetadataProperties(result.metadata, ['outputGenerationStatus'], 'Output generation metadata');
            
            // Since this is a skeleton implementation, test that it doesn't crash
            assert(result.metadata.outputGenerationStatus === 'skeleton_implementation', 
                'Should indicate skeleton implementation status');
            
        } finally {
            mockFs.restore();
            cleanupTempDir(mockConfig.OUTPUT_DIR);
        }
    });
    
    test('should handle missing prerequisites gracefully', async () => {
        mockConfig = createMockConfig();
        mockPipelineState = createMockPipelineState(); // No chunks
        mockFs = mockWriteFileSync();
        
        try {
            await assert.rejects(
                outputGeneration.execute(mockPipelineState, mockConfig),
                /Step 6 \(chunking algorithm\) must be completed first/,
                'Should throw error when prerequisites are missing'
            );
        } finally {
            mockFs.restore();
            cleanupTempDir(mockConfig.OUTPUT_DIR);
        }
    });
    
    test('should preserve pipeline state when generating output', async () => {
        mockConfig = createMockConfig();
        mockPipelineState = createMockPipelineState({ 
            rawText: sampleRawText,
            chunks: sampleChunks,
            pages: [
                { pageNumber: 1, chunkIds: ['chunk-1-1'], startPosition: 0, endPosition: 500 }
            ]
        });
        mockFs = mockWriteFileSync();
        
        try {
            const result = await outputGeneration.execute(mockPipelineState, mockConfig);
            
            // Test that original data is preserved
            assert.strictEqual(result.rawText || pipelineState.rawText, sampleRawText, 
                'Raw text should be preserved');
            assert.deepStrictEqual(result.chunks || pipelineState.chunks, sampleChunks, 
                'Chunks should be preserved');
            
            // Test that chunk content starts correctly (as requested by user)
            const chunks = result.chunks || pipelineState.chunks;
            const firstChunk = chunks[0];
            assertStartsWith(firstChunk.content, 'Modern development has evolved significantly', 
                'First chunk content should be preserved');
            
        } finally {
            mockFs.restore();
            cleanupTempDir(mockConfig.OUTPUT_DIR);
        }
    });
    
    test('should handle empty chunks array', async () => {
        mockConfig = createMockConfig();
        mockPipelineState = createMockPipelineState({ 
            rawText: sampleRawText,
            chunks: [],
            pages: []
        });
        mockFs = mockWriteFileSync();
        
        try {
            const result = await outputGeneration.execute(mockPipelineState, mockConfig);
            
            // Should handle empty chunks without crashing
            assert(result.metadata, 'Should return metadata even with empty chunks');
            
        } finally {
            mockFs.restore();
            cleanupTempDir(mockConfig.OUTPUT_DIR);
        }
    });
    
    test('should log available data for debugging', async () => {
        mockConfig = createMockConfig();
        mockPipelineState = createMockPipelineState({ 
            rawText: sampleRawText,
            chunks: sampleChunks,
            pages: [
                { pageNumber: 1, chunkIds: ['chunk-1-1'], startPosition: 0, endPosition: 500 },
                { pageNumber: 2, chunkIds: ['chunk-2-1'], startPosition: 501, endPosition: 1000 }
            ]
        });
        mockFs = mockWriteFileSync();
        
        try {
            const result = await outputGeneration.execute(mockPipelineState, mockConfig);
            
            // Test that the skeleton implementation processes the data
            const chunks = result.chunks || pipelineState.chunks;
            const pages = result.pages || pipelineState.pages;
            
            assertNotEmpty(chunks, 'Should have chunks available');
            assertNotEmpty(pages, 'Should have pages available');
            
            // Test data integrity
            assert.strictEqual(chunks.length, sampleChunks.length, 
                'Should preserve chunk count');
            assert.strictEqual(pages.length, 2, 
                'Should preserve page count');
            
        } finally {
            mockFs.restore();
            cleanupTempDir(mockConfig.OUTPUT_DIR);
        }
    });
    
    test('should handle partial pipeline state', async () => {
        mockConfig = createMockConfig();
        mockPipelineState = createMockPipelineState({ 
            rawText: sampleRawText,
            chunks: sampleChunks,
            // Missing pages
        });
        mockFs = mockWriteFileSync();
        
        try {
            const result = await outputGeneration.execute(mockPipelineState, mockConfig);
            
            // Should handle partial state gracefully
            assert(result.metadata, 'Should return metadata even with partial state');
            
            // Test that chunks are still available
            const chunks = result.chunks || pipelineState.chunks;
            assertNotEmpty(chunks, 'Should have chunks available');
            
            // Test first chunk content
            const firstChunk = chunks[0];
            assertStartsWith(firstChunk.content, 'Modern development has evolved significantly', 
                'First chunk should start with expected content');
            
        } finally {
            mockFs.restore();
            cleanupTempDir(mockConfig.OUTPUT_DIR);
        }
    });
    
    test('should maintain data types correctly', async () => {
        mockConfig = createMockConfig();
        mockPipelineState = createMockPipelineState({ 
            rawText: sampleRawText,
            chunks: sampleChunks,
            pages: [
                { pageNumber: 1, chunkIds: ['chunk-1-1'], startPosition: 0, endPosition: 500 }
            ]
        });
        mockFs = mockWriteFileSync();
        
        try {
            const result = await outputGeneration.execute(mockPipelineState, mockConfig);
            
            // Test data types are preserved
            const chunks = result.chunks || pipelineState.chunks;
            for (const chunk of chunks) {
                assert(typeof chunk.id === 'string', 'Chunk ID should be string');
                assert(typeof chunk.content === 'string', 'Chunk content should be string');
                assert(typeof chunk.wordCount === 'number', 'Chunk word count should be number');
                assert(typeof chunk.chapterNumber === 'number', 'Chunk chapter number should be number');
            }
            
            // Test metadata structure
            assert(typeof result.metadata === 'object', 'Metadata should be object');
            assert(typeof result.metadata.outputGenerationStatus === 'string', 
                'Output generation status should be string');
            
        } finally {
            mockFs.restore();
            cleanupTempDir(mockConfig.OUTPUT_DIR);
        }
    });
}); 