/**
 * Tests for Step 2.1: Chapter Detection
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

const chapterDetection = require('../../steps/02-1-chapter-detection');
const { 
    assertStartsWith, 
    assertNotEmpty, 
    assertInRange,
    assertMetadataProperties,
    createMockConfig, 
    createMockPipelineState,
    verifyStepOutput,
    mockWriteFileSync,
    cleanupTempDir
} = require('../helpers/test-helpers');
const { sampleRawText, sampleChapterMetadata, sampleChapterDetectionOutput } = require('../fixtures/transformers-data');

describe('Step 2.1: Chapter Detection', () => {
    let mockConfig;
    let mockPipelineState;
    let mockFs;
    
    test('should detect chapters from text successfully', async () => {
        mockConfig = createMockConfig();
        mockPipelineState = createMockPipelineState({ rawText: sampleRawText });
        mockFs = mockWriteFileSync();
        
        try {
            const result = await chapterDetection.execute(mockPipelineState, mockConfig);
            
            // Verify result structure
            verifyStepOutput(result, ['chapterMetadata', 'metadata'], 'Chapter Detection');
            
            // Test chapter metadata
            assertNotEmpty(result.chapterMetadata, 'Should detect at least one chapter');
            assertInRange(result.chapterMetadata.length, 1, 10, 'Should detect reasonable number of chapters');
            
            // Test first chapter content (as requested by user)
            const firstChapter = result.chapterMetadata[0];
            assertStartsWith(firstChapter.title, 'Introduction: Life itself', 'First chapter should start with expected title');
            
            // Test chapter structure
            for (const chapter of result.chapterMetadata) {
                assert(typeof chapter.title === 'string', 'Chapter should have title');
                assert(typeof chapter.chapterNumber === 'number', 'Chapter should have number');
                assert(typeof chapter.startPosition === 'number', 'Chapter should have start position');
                assert(typeof chapter.confidence === 'number', 'Chapter should have confidence');
                assert(typeof chapter.detectionSource === 'string', 'Chapter should have detection source');
                
                // Test confidence range
                assertInRange(chapter.confidence, 0, 1, 'Confidence should be between 0 and 1');
            }
            
            // Test metadata
            assertMetadataProperties(result.metadata, ['chapterDetection'], 'Chapter detection metadata');
            assertMetadataProperties(result.metadata.chapterDetection, ['chaptersDetected', 'tocSource'], 'Chapter detection stats');
            
            // Test debug files were created
            assert(mockFs.wasFileWritten(mockConfig.DEBUG_DIR + '/step-02-1-chapter-detection.json'), 'Debug JSON file should be written');
            
        } finally {
            mockFs.restore();
            cleanupTempDir(mockConfig.OUTPUT_DIR);
        }
    });
    
    test('should handle missing rawText gracefully', async () => {
        mockConfig = createMockConfig();
        mockPipelineState = createMockPipelineState(); // No rawText
        mockFs = mockWriteFileSync();
        
        try {
            await assert.rejects(
                chapterDetection.execute(mockPipelineState, mockConfig),
                /Step 1 \(text extraction\) must be completed first/,
                'Should throw error when rawText is missing'
            );
        } finally {
            mockFs.restore();
            cleanupTempDir(mockConfig.OUTPUT_DIR);
        }
    });
    
    test('should detect chapters from Table of Contents', async () => {
        mockConfig = createMockConfig();
        mockPipelineState = createMockPipelineState({ rawText: sampleRawText });
        mockFs = mockWriteFileSync();
        
        try {
            const result = await chapterDetection.execute(mockPipelineState, mockConfig);
            
            // Should detect chapters from TOC
            assertNotEmpty(result.chapterMetadata, 'Should detect chapters from TOC');
            
            // Check that chapters are detected in order
            for (let i = 0; i < result.chapterMetadata.length - 1; i++) {
                const currentChapter = result.chapterMetadata[i];
                const nextChapter = result.chapterMetadata[i + 1];
                
                assert(currentChapter.chapterNumber <= nextChapter.chapterNumber, 
                    `Chapters should be in order: ${currentChapter.chapterNumber} vs ${nextChapter.chapterNumber}`);
            }
            
            // Test that detection source is recorded
            const detectionSources = result.chapterMetadata.map(ch => ch.detectionSource);
            assert(detectionSources.every(source => typeof source === 'string'), 'All chapters should have detection source');
            
        } finally {
            mockFs.restore();
            cleanupTempDir(mockConfig.OUTPUT_DIR);
        }
    });
    
    test('should assign reasonable start positions', async () => {
        mockConfig = createMockConfig();
        mockPipelineState = createMockPipelineState({ rawText: sampleRawText });
        mockFs = mockWriteFileSync();
        
        try {
            const result = await chapterDetection.execute(mockPipelineState, mockConfig);
            
            // Test start positions are reasonable
            for (const chapter of result.chapterMetadata) {
                assertInRange(chapter.startPosition, 0, sampleRawText.length, 
                    `Chapter ${chapter.chapterNumber} start position should be within text bounds`);
                
                if (chapter.endPosition) {
                    assertInRange(chapter.endPosition, chapter.startPosition, sampleRawText.length,
                        `Chapter ${chapter.chapterNumber} end position should be after start position`);
                }
            }
            
        } finally {
            mockFs.restore();
            cleanupTempDir(mockConfig.OUTPUT_DIR);
        }
    });
    
    test('should detect chapter titles correctly', async () => {
        mockConfig = createMockConfig();
        mockPipelineState = createMockPipelineState({ rawText: sampleRawText });
        mockFs = mockWriteFileSync();
        
        try {
            const result = await chapterDetection.execute(mockPipelineState, mockConfig);
            
            // Test specific chapter titles from our sample data
            const chapterTitles = result.chapterMetadata.map(ch => ch.title);
            
            // Test that we detect the main chapters (content assertion as requested)
            const expectedChapters = [
                'Introduction: Life itself',
                'Discovering the nanocosm',
                'The path of carbon'
            ];
            
            for (const expectedTitle of expectedChapters) {
                const foundChapter = chapterTitles.find(title => title.includes(expectedTitle));
                assert(foundChapter, `Should detect chapter: ${expectedTitle}`);
            }
            
            // Test that chapter titles start with expected content
            const introChapter = result.chapterMetadata.find(ch => ch.title.includes('Introduction'));
            if (introChapter) {
                assertStartsWith(introChapter.title, 'Introduction: Life itself', 
                    'Introduction chapter title should start correctly');
            }
            
        } finally {
            mockFs.restore();
            cleanupTempDir(mockConfig.OUTPUT_DIR);
        }
    });
    
    test('should calculate average confidence correctly', async () => {
        mockConfig = createMockConfig();
        mockPipelineState = createMockPipelineState({ rawText: sampleRawText });
        mockFs = mockWriteFileSync();
        
        try {
            const result = await chapterDetection.execute(mockPipelineState, mockConfig);
            
            // Test confidence calculation
            const avgConfidence = result.metadata.chapterDetection.averageDetectionConfidence;
            assertInRange(avgConfidence, 0, 1, 'Average confidence should be between 0 and 1');
            
            // Test that individual confidences are reasonable
            for (const chapter of result.chapterMetadata) {
                assertInRange(chapter.confidence, 0.3, 1.0, 
                    `Chapter ${chapter.chapterNumber} should have reasonable confidence`);
            }
            
        } finally {
            mockFs.restore();
            cleanupTempDir(mockConfig.OUTPUT_DIR);
        }
    });
}); 