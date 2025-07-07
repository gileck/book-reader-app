/**
 * Tests for Step 7: Page Assignment
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

const pageAssignment = require('../../steps/07-page-assignment');
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

describe('Step 7: Page Assignment', () => {
    let mockConfig;
    let mockPipelineState;
    let mockFs;
    
    test('should assign pages to chunks successfully', async () => {
        mockConfig = createMockConfig();
        mockPipelineState = createMockPipelineState({ 
            rawText: sampleRawText,
            chunks: sampleChunks
        });
        mockFs = mockWriteFileSync();
        
        try {
            const result = await pageAssignment.execute(mockPipelineState, mockConfig);
            
            // Verify result structure
            verifyStepOutput(result, ['pages', 'metadata'], 'Page Assignment');
            
            // Test pages array
            assertNotEmpty(result.pages, 'Should create page assignments');
            
            // Test that chunks now have page assignments
            for (const chunk of result.chunks || sampleChunks) {
                if (chunk.pageNumbers) {
                    assert(Array.isArray(chunk.pageNumbers), 'Chunk should have pageNumbers array');
                    assertNotEmpty(chunk.pageNumbers, 'Chunk should have at least one page number');
                    
                    // Test page numbers are reasonable
                    for (const pageNum of chunk.pageNumbers) {
                        assertInRange(pageNum, 1, 1000, 'Page number should be reasonable');
                    }
                }
            }
            
            // Test first chunk content preserved (as requested by user)
            if (result.chunks) {
                const firstChunk = result.chunks[0];
                assertStartsWith(firstChunk.content, 'Modern development has evolved significantly', 
                    'First chunk content should be preserved');
            }
            
            // Test metadata
            assertMetadataProperties(result.metadata, ['pageAssignment'], 'Page assignment metadata');
            
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
                pageAssignment.execute(mockPipelineState, mockConfig),
                /Step 6 \(chunking algorithm\) must be completed first/,
                'Should throw error when prerequisites are missing'
            );
        } finally {
            mockFs.restore();
            cleanupTempDir(mockConfig.OUTPUT_DIR);
        }
    });
    
    test('should assign correct page numbers based on positions', async () => {
        mockConfig = createMockConfig();
        mockPipelineState = createMockPipelineState({ 
            rawText: sampleRawText,
            chunks: sampleChunks
        });
        mockFs = mockWriteFileSync();
        
        try {
            const result = await pageAssignment.execute(mockPipelineState, mockConfig);
            
            // Test page assignment logic
            for (const chunk of result.chunks || sampleChunks) {
                if (chunk.pageNumbers) {
                    // Page numbers should be sorted
                    const sortedPages = [...chunk.pageNumbers].sort((a, b) => a - b);
                    assert.deepStrictEqual(chunk.pageNumbers, sortedPages, 
                        `Chunk ${chunk.id} page numbers should be sorted`);
                    
                    // Should not have duplicate page numbers
                    const uniquePages = new Set(chunk.pageNumbers);
                    assert.strictEqual(chunk.pageNumbers.length, uniquePages.size, 
                        `Chunk ${chunk.id} should not have duplicate page numbers`);
                }
            }
            
        } finally {
            mockFs.restore();
            cleanupTempDir(mockConfig.OUTPUT_DIR);
        }
    });
    
    test('should create page index', async () => {
        mockConfig = createMockConfig();
        mockPipelineState = createMockPipelineState({ 
            rawText: sampleRawText,
            chunks: sampleChunks
        });
        mockFs = mockWriteFileSync();
        
        try {
            const result = await pageAssignment.execute(mockPipelineState, mockConfig);
            
            // Test pages array structure
            for (const page of result.pages) {
                assert(typeof page.pageNumber === 'number', 'Page should have page number');
                assert(Array.isArray(page.chunkIds), 'Page should have chunk IDs array');
                assert(typeof page.startPosition === 'number', 'Page should have start position');
                assert(typeof page.endPosition === 'number', 'Page should have end position');
                
                // Test page properties
                assertInRange(page.pageNumber, 1, 1000, 'Page number should be reasonable');
                assert(page.endPosition >= page.startPosition, 'End position should be >= start position');
            }
            
        } finally {
            mockFs.restore();
            cleanupTempDir(mockConfig.OUTPUT_DIR);
        }
    });
    
    test('should maintain chunk-page consistency', async () => {
        mockConfig = createMockConfig();
        mockPipelineState = createMockPipelineState({ 
            rawText: sampleRawText,
            chunks: sampleChunks
        });
        mockFs = mockWriteFileSync();
        
        try {
            const result = await pageAssignment.execute(mockPipelineState, mockConfig);
            
            // Test bidirectional consistency
            for (const chunk of result.chunks || sampleChunks) {
                if (chunk.pageNumbers) {
                    for (const pageNum of chunk.pageNumbers) {
                        // Find the page
                        const page = result.pages.find(p => p.pageNumber === pageNum);
                        assert(page, `Page ${pageNum} should exist`);
                        
                        // Page should reference this chunk
                        assert(page.chunkIds.includes(chunk.id), 
                            `Page ${pageNum} should reference chunk ${chunk.id}`);
                    }
                }
            }
            
        } finally {
            mockFs.restore();
            cleanupTempDir(mockConfig.OUTPUT_DIR);
        }
    });
    
    test('should handle chunks spanning multiple pages', async () => {
        mockConfig = createMockConfig();
        // Create chunk that spans multiple pages
        const multiPageChunks = [
            {
                id: "chunk-1-1",
                chapterNumber: 1,
                chapterTitle: "Introduction",
                content: "This is a very long chunk that spans multiple pages and should be assigned to multiple page numbers based on its position in the text.",
                wordCount: 25,
                startPosition: 850,  // Near page 3
                endPosition: 1750,   // Near page 15
                pageNumbers: [],
                paragraphIds: ["p-1-1"],
                headers: []
            }
        ];
        
        mockPipelineState = createMockPipelineState({ 
            rawText: sampleRawText,
            chunks: multiPageChunks
        });
        mockFs = mockWriteFileSync();
        
        try {
            const result = await pageAssignment.execute(mockPipelineState, mockConfig);
            
            // Test multi-page assignment
            const multiPageChunk = result.chunks ? result.chunks[0] : multiPageChunks[0];
            if (multiPageChunk.pageNumbers) {
                assert(multiPageChunk.pageNumbers.length > 1, 
                    'Multi-page chunk should be assigned to multiple pages');
                
                // Test content starts correctly
                assertStartsWith(multiPageChunk.content, 'This is a very long chunk', 
                    'Multi-page chunk content should start correctly');
            }
            
        } finally {
            mockFs.restore();
            cleanupTempDir(mockConfig.OUTPUT_DIR);
        }
    });
    
    test('should preserve chunk content integrity', async () => {
        mockConfig = createMockConfig();
        mockPipelineState = createMockPipelineState({ 
            rawText: sampleRawText,
            chunks: sampleChunks
        });
        mockFs = mockWriteFileSync();
        
        try {
            const result = await pageAssignment.execute(mockPipelineState, mockConfig);
            
            // Test that chunk content is preserved
            const resultChunks = result.chunks || sampleChunks;
            
            for (let i = 0; i < resultChunks.length; i++) {
                const originalChunk = sampleChunks[i];
                const resultChunk = resultChunks[i];
                
                // Content should be preserved exactly
                assert.strictEqual(resultChunk.content, originalChunk.content, 
                    `Chunk ${i} content should be preserved`);
                assert.strictEqual(resultChunk.wordCount, originalChunk.wordCount, 
                    `Chunk ${i} word count should be preserved`);
                assert.strictEqual(resultChunk.id, originalChunk.id, 
                    `Chunk ${i} ID should be preserved`);
            }
            
            // Test that first chunk starts correctly
            const firstChunk = resultChunks[0];
            assertStartsWith(firstChunk.content, 'Modern development has evolved significantly', 
                'First chunk should start with expected content');
            
        } finally {
            mockFs.restore();
            cleanupTempDir(mockConfig.OUTPUT_DIR);
        }
    });
    
    test('should calculate page statistics correctly', async () => {
        mockConfig = createMockConfig();
        mockPipelineState = createMockPipelineState({ 
            rawText: sampleRawText,
            chunks: sampleChunks
        });
        mockFs = mockWriteFileSync();
        
        try {
            const result = await pageAssignment.execute(mockPipelineState, mockConfig);
            
            // Test page statistics
            const totalPages = result.pages.length;
            const totalChunks = (result.chunks || sampleChunks).length;
            
            assertInRange(totalPages, 1, 100, 'Total pages should be reasonable');
            assert(totalChunks >= 1, 'Should have at least one chunk');
            
            // Test that all pages are accounted for
            const pageNumbers = result.pages.map(p => p.pageNumber);
            const uniquePageNumbers = new Set(pageNumbers);
            assert.strictEqual(pageNumbers.length, uniquePageNumbers.size, 
                'All page numbers should be unique');
            
        } finally {
            mockFs.restore();
            cleanupTempDir(mockConfig.OUTPUT_DIR);
        }
    });
}); 