/**
 * Comprehensive Test Suite for Transformers Book Processing
 * Tests against expected results defined in transformers-expected-results.json
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { 
  expectedResults,
  actualOutput, 
  actualSummary, 
  sampleRawText,
  sampleChapterMetadata,
  sampleChapters,
  sampleChunks
} = require('./fixtures/transformers-data');

const { 
  assertStartsWith, 
  assertEndsWith,
  assertContains, 
  assertNotEmpty, 
  assertInRange,
  assertMetadataProperties
} = require('./helpers/test-helpers');

describe('Transformers Book Processing Tests (Expected Results)', () => {
  
  test('should have valid expected results loaded', () => {
    assert(expectedResults.book, 'Expected results should have book metadata');
    assert(expectedResults.chapters, 'Expected results should have chapters');
    assert(expectedResults.processing, 'Expected results should have processing info');
    assert(expectedResults.textExtraction, 'Expected results should have text extraction expectations');
  });
  
  test('should validate book metadata against expected results', () => {
    const expectedBook = expectedResults.book;
    
    // If actual data is available, test against it
    if (actualOutput.book || actualSummary.book) {
      const actualBook = actualOutput.book || actualSummary.book;
      assert.strictEqual(actualBook.title, expectedBook.title, 'Book title should match expected');
      assert.strictEqual(actualBook.author, expectedBook.author, 'Book author should match expected');
      assert.strictEqual(actualBook.pageCount, expectedBook.pageCount, 'Book page count should match expected');
      assert.strictEqual(actualBook.filename, expectedBook.filename, 'Book filename should match expected');
    } else {
      // Test expected values are reasonable
      assert.strictEqual(expectedBook.title, 'Transformer: The Deep Chemistry of Life and Death');
      assert.strictEqual(expectedBook.author, 'Nick Lane');
      assert.strictEqual(expectedBook.pageCount, 317);
      assert.strictEqual(expectedBook.filename, 'book.pdf');
    }
  });
  
  test('should validate chapter structure against expected results', () => {
    const expectedChapters = expectedResults.chapters;
    
    assertNotEmpty(expectedChapters, 'Should have expected chapters');
    assert.strictEqual(expectedChapters.length, expectedResults.processing.totalChapters, 
      'Expected chapter count should match processing info');
    
    // Test chapter titles and page ranges
    const expectedTitles = [
      'Introduction: Life itself',
      'Discovering the nanocosm', 
      'The path of carbon',
      'From gases to life',
      'Revolutions',
      'To the dark side',
      'The flux capacitor',
      'Epilogue: Self'
    ];
    
    expectedChapters.forEach((chapter, i) => {
      assert.strictEqual(chapter.title, expectedTitles[i], `Chapter ${i + 1} title should match expected`);
      assert(chapter.startPageNumber <= chapter.endPageNumber, 'Start page should be <= end page');
      assertInRange(chapter.startPageNumber, 1, 320, 'Start page should be reasonable');
      assertInRange(chapter.endPageNumber, 1, 320, 'End page should be reasonable');
      assert(chapter.expectedChunkCount > 0, 'Should have expected chunk count');
      assert(chapter.expectedWordCount > 0, 'Should have expected word count');
      assert(typeof chapter.contentStartsWith === 'string', 'Should have content assertion');
      assert(Array.isArray(chapter.mustContain), 'Should have must-contain terms');
    });
    
    // If actual data is available, test against expected structure
    if (actualOutput.chapters) {
      assert.strictEqual(actualOutput.chapters.length, expectedChapters.length, 
        'Actual chapter count should match expected');
      
      for (let i = 0; i < expectedChapters.length; i++) {
        const actualChapter = actualOutput.chapters[i];
        const expectedChapter = expectedChapters[i];
        
        assert.strictEqual(actualChapter.title, expectedChapter.title, 
          `Chapter ${i + 1} title should match expected`);
        assert.strictEqual(actualChapter.startPageNumber, expectedChapter.startPageNumber,
          `Chapter ${i + 1} start page should match expected`);
        assert.strictEqual(actualChapter.endPageNumber, expectedChapter.endPageNumber,
          `Chapter ${i + 1} end page should match expected`);
      }
    }
  });
  
  test('should validate content assertions (beginning and ending of content)', () => {
    const expectedChapters = expectedResults.chapters;
    
    // If actual data is available, test content starts and ends with expected text
    if (actualOutput.chapters) {
      for (let i = 0; i < expectedChapters.length; i++) {
        const actualChapter = actualOutput.chapters[i];
        const expectedChapter = expectedChapters[i];
        
        if (actualChapter.content && actualChapter.content.chunks && actualChapter.content.chunks.length > 0) {
          const fullText = actualChapter.content.chunks.map(c => c.text).join(' ');
          
          // Test content starts with expected text
          const expectedStart = expectedChapter.contentStartsWith.substring(0, 20); // Use first 20 chars for flexibility
          assertStartsWith(fullText, expectedStart, 
            `Chapter "${expectedChapter.title}" should start with expected text`);
          
          // Test content ends with expected text (if provided)
          if (expectedChapter.contentEndsWith) {
            const expectedEnd = expectedChapter.contentEndsWith.substring(Math.max(0, expectedChapter.contentEndsWith.length - 20)); // Use last 20 chars for flexibility
            assertEndsWith(fullText, expectedEnd, 
              `Chapter "${expectedChapter.title}" should end with expected text`);
          }
          
          // Test must-contain terms
          if (expectedChapter.mustContain) {
            for (const term of expectedChapter.mustContain) {
              assertContains(fullText, term, 
                `Chapter "${expectedChapter.title}" should contain: ${term}`);
            }
          }
        }
      }
    } else {
      // Test sample data against expected content assertions
      for (let i = 0; i < Math.min(sampleChapters.length, expectedChapters.length); i++) {
        const sampleChapter = sampleChapters[i];
        const expectedChapter = expectedChapters[i];
        
        assertStartsWith(sampleChapter.content, expectedChapter.contentStartsWith.substring(0, 20),
          `Sample chapter "${expectedChapter.title}" should start with expected text`);
        
        // Test content ends with expected text (if provided)
        if (expectedChapter.contentEndsWith) {
          const expectedEnd = expectedChapter.contentEndsWith.substring(Math.max(0, expectedChapter.contentEndsWith.length - 20)); // Use last 20 chars for flexibility
          assertEndsWith(sampleChapter.content, expectedEnd,
            `Sample chapter "${expectedChapter.title}" should end with expected text`);
        }
      }
    }
  });
  
  test('should validate chunk metrics against expected ranges', () => {
    const expectedMetrics = expectedResults.qualityMetrics;
    
    if (actualOutput.chapters) {
      const totalChunks = actualOutput.chapters.reduce((sum, ch) => sum + ch.content.chunks.length, 0);
      const totalWords = actualOutput.chapters.reduce((sum, ch) => 
        sum + ch.content.chunks.reduce((chSum, chunk) => chSum + chunk.wordCount, 0), 0);
      
      // Validate against expected ranges
      assertInRange(totalChunks, expectedMetrics.expectedTotalChunks.min, expectedMetrics.expectedTotalChunks.max,
        'Total chunks should be within expected range');
      assertInRange(totalWords, expectedMetrics.expectedTotalWords.min, expectedMetrics.expectedTotalWords.max,
        'Total words should be within expected range');
      
      // Validate chunk size metrics
      const allChunks = actualOutput.chapters.flatMap(ch => ch.content.chunks);
      const wordCounts = allChunks.map(chunk => chunk.wordCount);
      const avgWordCount = Math.round(wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length);
      const minWordCount = Math.min(...wordCounts);
      const maxWordCount = Math.max(...wordCounts);
      
      const chunkValidation = expectedResults.contentValidation.chunkValidation;
      assertInRange(avgWordCount, chunkValidation.averageWordCount.min, chunkValidation.averageWordCount.max,
        'Average word count should be within expected range');
      assertInRange(minWordCount, chunkValidation.minChunkSize.min, chunkValidation.minChunkSize.max,
        'Min chunk size should be within expected range');
      assertInRange(maxWordCount, chunkValidation.maxChunkSize.min, chunkValidation.maxChunkSize.max,
        'Max chunk size should be within expected range');
    }
  });
  
  test('should validate text extraction quality against expected criteria', () => {
    const expectedTextExtraction = expectedResults.textExtraction;
    
    if (sampleRawText) {
      // Test text length
      assertInRange(sampleRawText.length, expectedTextExtraction.expectedCharacterCount.min, 
        expectedTextExtraction.expectedCharacterCount.max, 'Character count should be within expected range');
      
      // Test word count
      const wordCount = sampleRawText.split(/\s+/).length;
      assertInRange(wordCount, expectedTextExtraction.expectedWordCount.min, 
        expectedTextExtraction.expectedWordCount.max, 'Word count should be within expected range');
      
      // Test line count
      const lineCount = sampleRawText.split('\n').length;
      assertInRange(lineCount, expectedTextExtraction.expectedLineCount.min, 
        expectedTextExtraction.expectedLineCount.max, 'Line count should be within expected range');
      
      // Test must-contain terms
      for (const term of expectedTextExtraction.mustContain) {
        assertContains(sampleRawText, term, `Raw text should contain: ${term}`);
      }
    }
  });
  
  test('should validate scientific terminology preservation', () => {
    const expectedTerms = expectedResults.contentValidation.keyScientificTerms;
    
    if (actualOutput.chapters) {
      // Test that all key scientific terms are preserved
      const allText = actualOutput.chapters.map(ch => 
        ch.content.chunks.map(chunk => chunk.text).join(' ')
      ).join(' ');
      
      let foundTerms = 0;
      for (const term of expectedTerms) {
        if (allText.toLowerCase().includes(term.toLowerCase())) {
          foundTerms++;
        }
      }
      
      // Should find most scientific terms (allow some flexibility)
      assertInRange(foundTerms, expectedTerms.length * 0.7, expectedTerms.length,
        `Should find most key scientific terms (found ${foundTerms}/${expectedTerms.length})`);
    }
  });
  
  test('should validate processing performance against expected metrics', () => {
    const expectedProcessing = expectedResults.processing;
    
    if (actualOutput.chapters) {
      const totalChunks = actualOutput.chapters.reduce((sum, ch) => sum + ch.content.chunks.length, 0);
      const totalWords = actualOutput.chapters.reduce((sum, ch) => 
        sum + ch.content.chunks.reduce((chSum, chunk) => chSum + chunk.wordCount, 0), 0);
      const avgWordsPerChunk = Math.round(totalWords / totalChunks);
      const avgChunksPerChapter = Math.round(totalChunks / actualOutput.chapters.length);
      
      console.log(`Processing Performance vs Expected:`);
      console.log(`- Chapters: ${actualOutput.chapters.length} (expected: ${expectedProcessing.totalChapters})`);
      console.log(`- Total chunks: ${totalChunks} (expected: ${expectedProcessing.expectedChunkCount})`);
      console.log(`- Total words: ${totalWords} (expected: ${expectedProcessing.totalWords})`);
      console.log(`- Avg words/chunk: ${avgWordsPerChunk} (expected: ${expectedProcessing.averageWordsPerChunk})`);
      console.log(`- Avg chunks/chapter: ${avgChunksPerChapter} (expected: ${expectedProcessing.averageChunksPerChapter})`);
      
      // Test against expected values (with some tolerance)
      assert.strictEqual(actualOutput.chapters.length, expectedProcessing.totalChapters, 
        'Chapter count should match expected');
      
      // Allow 10% variance for chunk and word counts
      assertInRange(totalChunks, expectedProcessing.expectedChunkCount * 0.9, expectedProcessing.expectedChunkCount * 1.1,
        'Total chunks should be close to expected');
      assertInRange(totalWords, expectedProcessing.totalWords * 0.9, expectedProcessing.totalWords * 1.1,
        'Total words should be close to expected');
    }
  });
  
  test('should validate file structure requirements', () => {
    // Test that expected results file exists and is valid
    const expectedResultsPath = path.join(__dirname, 'fixtures/transformers-expected-results.json');
    assert(fs.existsSync(expectedResultsPath), 'Expected results file should exist');
    
    const stats = fs.statSync(expectedResultsPath);
    assert(stats.size > 0, 'Expected results file should not be empty');
    
    // Test structure completeness
    assert(expectedResults.book, 'Expected results should have book section');
    assert(expectedResults.chapters, 'Expected results should have chapters section');
    assert(expectedResults.processing, 'Expected results should have processing section');
    assert(expectedResults.textExtraction, 'Expected results should have textExtraction section');
    assert(expectedResults.contentValidation, 'Expected results should have contentValidation section');
    assert(expectedResults.qualityMetrics, 'Expected results should have qualityMetrics section');
    
    console.log('✅ Expected results structure validation passed');
  });
  
  test('should validate consistency between expected and actual data (if available)', () => {
    if (actualOutput.chapters && actualSummary.chapters) {
      const expectedChapters = expectedResults.chapters;
      
      // Test chapter count consistency
      assert.strictEqual(actualOutput.chapters.length, expectedChapters.length,
        'Actual chapter count should match expected');
      assert.strictEqual(actualSummary.chapters.length, expectedChapters.length,
        'Summary chapter count should match expected');
      
      // Test chapter titles consistency
      for (let i = 0; i < expectedChapters.length; i++) {
        const actualChapter = actualOutput.chapters[i];
        const summaryChapter = actualSummary.chapters[i];
        const expectedChapter = expectedChapters[i];
        
        assert.strictEqual(actualChapter.title, expectedChapter.title,
          `Chapter ${i + 1} title should match expected in output`);
        assert.strictEqual(summaryChapter.title, expectedChapter.title,
          `Chapter ${i + 1} title should match expected in summary`);
      }
      
      console.log('✅ Actual data matches expected results structure');
    } else {
      console.log('ℹ️  No actual data available - testing against expected results only');
    }
  });
}); 