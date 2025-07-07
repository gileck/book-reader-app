/**
 * Tests for Step 1: Text Extraction
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const textExtraction = require('../../steps/01-text-extraction');
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
const { sampleRawText, sampleTextExtractionOutput } = require('../fixtures/transformers-data');

describe('Step 1: Text Extraction', () => {
    let mockConfig;
    let mockPipelineState;
    let mockFs;
    
    test('should extract text from PDF successfully', async () => {
        mockConfig = createMockConfig();
        mockPipelineState = createMockPipelineState();
        mockFs = mockWriteFileSync();
        
        try {
            // Create mock PDF file
            fs.writeFileSync(mockConfig.INPUT_PDF, 'mock pdf content');
            
            // Mock fallback text extraction by creating a pre-existing text file
            const fallbackTextFile = path.join(path.dirname(mockConfig.INPUT_PDF), 'raw-pdf-text.txt');
            fs.writeFileSync(fallbackTextFile, sampleRawText);
            
            const result = await textExtraction.execute(mockPipelineState, mockConfig);
            
            // Verify result structure
            verifyStepOutput(result, ['rawText', 'metadata'], 'Text Extraction');
            
            // Test content assertions (as requested by user)
            assertStartsWith(result.rawText, '\n--- PAGE 1 ---\n\n--- END PAGE 1 ---', 'Raw text should start with page markers');
            assertContains(result.rawText, 'TRANSFORMER', 'Raw text should contain book title');
            assertContains(result.rawText, 'NICK LANE', 'Raw text should contain author');
            assertContains(result.rawText, '--- END PAGE', 'Raw text should contain page markers');
            
            // Test metadata
            assertMetadataProperties(result.metadata, ['textExtraction'], 'Text extraction metadata');
            assertMetadataProperties(result.metadata.textExtraction, ['characterCount', 'pageCount', 'wordCount'], 'Text extraction stats');
            
            // Test character count is reasonable
            assertInRange(result.metadata.textExtraction.characterCount, 1000, 10000, 'Character count should be reasonable');
            
            // Test debug files were created
            assert(mockFs.wasFileWritten(path.join(mockConfig.DEBUG_DIR, 'step-01-text-extraction.json')), 'Debug JSON file should be written');
            assert(mockFs.wasFileWritten(path.join(mockConfig.DEBUG_DIR, 'step-01-raw-text.txt')), 'Raw text file should be written');
            
        } finally {
            mockFs.restore();
            cleanupTempDir(path.dirname(mockConfig.INPUT_PDF));
        }
    });
    
    test('should handle missing PDF file gracefully', async () => {
        mockConfig = createMockConfig();
        mockPipelineState = createMockPipelineState();
        mockFs = mockWriteFileSync();
        
        try {
            await assert.rejects(
                textExtraction.execute(mockPipelineState, mockConfig),
                /PDF file not found/,
                'Should throw error for missing PDF'
            );
        } finally {
            mockFs.restore();
            cleanupTempDir(path.dirname(mockConfig.INPUT_PDF));
        }
    });
    
    test('should use fallback text extraction when pdf-parse fails', async () => {
        mockConfig = createMockConfig();
        mockPipelineState = createMockPipelineState();
        mockFs = mockWriteFileSync();
        
        try {
            // Create mock PDF file
            fs.writeFileSync(mockConfig.INPUT_PDF, 'mock pdf content');
            
            // Create fallback text file
            const fallbackTextFile = path.join(path.dirname(mockConfig.INPUT_PDF), 'raw-pdf-text.txt');
            fs.writeFileSync(fallbackTextFile, sampleRawText);
            
            const result = await textExtraction.execute(mockPipelineState, mockConfig);
            
            // Verify fallback worked
            assertStartsWith(result.rawText, '\n--- PAGE 1 ---\n\n--- END PAGE 1 ---', 'Fallback text should start correctly');
            assertNotEmpty([result.rawText], 'Fallback should provide text');
            
        } finally {
            mockFs.restore();
            cleanupTempDir(path.dirname(mockConfig.INPUT_PDF));
        }
    });
    
    test('should calculate correct text statistics', async () => {
        mockConfig = createMockConfig();
        mockPipelineState = createMockPipelineState();
        mockFs = mockWriteFileSync();
        
        try {
            // Create mock PDF file
            fs.writeFileSync(mockConfig.INPUT_PDF, 'mock pdf content');
            
            // Create fallback text file with known content
            const knownText = "Test content with 7 words and 39 characters including spaces.";
            const fallbackTextFile = path.join(path.dirname(mockConfig.INPUT_PDF), 'raw-pdf-text.txt');
            fs.writeFileSync(fallbackTextFile, knownText);
            
            const result = await textExtraction.execute(mockPipelineState, mockConfig);
            
            // Verify statistics
            assert.strictEqual(result.metadata.textExtraction.characterCount, knownText.length, 'Character count should match');
            assert.strictEqual(result.metadata.textExtraction.wordCount, 10, 'Word count should be approximately correct');
            
        } finally {
            mockFs.restore();
            cleanupTempDir(path.dirname(mockConfig.INPUT_PDF));
        }
    });
    
    test('should preserve line structure and page markers', async () => {
        mockConfig = createMockConfig();
        mockPipelineState = createMockPipelineState();
        mockFs = mockWriteFileSync();
        
        try {
            // Create mock PDF file
            fs.writeFileSync(mockConfig.INPUT_PDF, 'mock pdf content');
            
            // Create fallback text file with page markers
            const fallbackTextFile = path.join(path.dirname(mockConfig.INPUT_PDF), 'raw-pdf-text.txt');
            fs.writeFileSync(fallbackTextFile, sampleRawText);
            
            const result = await textExtraction.execute(mockPipelineState, mockConfig);
            
            // Verify page markers are preserved
            assertContains(result.rawText, '--- PAGE 1 ---', 'Should contain page 1 marker');
            assertContains(result.rawText, '--- END PAGE 1 ---', 'Should contain end page 1 marker');
            assertContains(result.rawText, '--- PAGE 4 ---', 'Should contain page 4 marker');
            
            // Verify line structure
            const lines = result.rawText.split('\n');
            assertInRange(lines.length, 50, 200, 'Should have reasonable number of lines');
            
        } finally {
            mockFs.restore();
            cleanupTempDir(path.dirname(mockConfig.INPUT_PDF));
        }
    });
}); 