# POC Implementation Test Suite

Comprehensive test suite for the book parser POC implementation, covering all 8 steps of the pipeline.

## Overview

This test suite validates each step of the book parsing pipeline:

1. **Step 1**: Text Extraction
2. **Step 2.1**: Chapter Detection  
3. **Step 2.2**: Chapter Content Extraction
4. **Step 3**: Page Extraction and Cross-Page Merging
5. **Step 4**: Paragraph Detection
6. **Step 5**: Header Detection
7. **Step 6**: Chunking Algorithm
8. **Step 7**: Page Assignment
9. **Step 8**: Output Generation

## Test Features

- ✅ **Content Assertion Testing**: Tests assert on the beginning of content as requested
- ✅ **Step Output Structure Validation**: Ensures each step returns expected data structure
- ✅ **Error Handling**: Tests prerequisite validation and graceful error handling
- ✅ **Data Integrity**: Verifies content preservation throughout the pipeline
- ✅ **Edge Case Handling**: Tests behavior with unusual or boundary conditions
- ✅ **Metadata Validation**: Checks statistics and processing metadata

## Usage

### Run All Tests

```bash
# Using the test runner
node run-all-tests.js

# Using npm scripts (if package.json is available)
npm test
```

### Run Individual Step Tests

```bash
# Run specific step test
npm run test:step1        # Text extraction
npm run test:step2-1      # Chapter detection
npm run test:step2-2      # Chapter content extraction
npm run test:step3        # Page extraction and merging
npm run test:step4        # Paragraph detection
npm run test:step5        # Header detection
npm run test:step6        # Chunking algorithm
npm run test:step7        # Page assignment
npm run test:step8        # Output generation

# Or run directly
node --test step-tests/01-text-extraction.test.js
```

### Watch Mode

```bash
# Run tests in watch mode
npm run test:watch
```

## Test Structure

### Fixtures

- `fixtures/sample-data.js` - Contains sample data for testing:
  - `sampleRawText` - Mock PDF text with page markers
  - `sampleChapterMetadata` - Chapter detection results
  - `sampleChapters` - Extracted chapter content
  - `sampleParagraphs` - Paragraph detection results
  - `sampleChunks` - Final chunks for testing

### Helpers

- `helpers/test-helpers.js` - Common test utilities:
  - `assertStartsWith()` - Assert content begins with expected text
  - `assertContains()` - Assert content contains expected text
  - `createMockConfig()` - Create test configuration
  - `createMockPipelineState()` - Create test pipeline state
  - `verifyStepOutput()` - Validate step result structure

### Step Tests

Each step test file follows a consistent pattern:

```javascript
describe('Step X: Step Name', () => {
    test('should execute step successfully', async () => {
        // Setup mock data
        // Execute step
        // Verify output structure
        // Assert on content beginning (as requested)
        // Test metadata
    });
    
    test('should handle missing prerequisites gracefully', async () => {
        // Test error handling
    });
    
    // Additional specific tests for the step
});
```

## Content Assertion Strategy

As requested, the tests focus on asserting the **beginning of content** rather than exact matches:

```javascript
// Example content assertions
assertStartsWith(result.rawText, '--- PAGE 1 ---\nThe Complete Guide to Modern Development');
assertStartsWith(firstChapter.content, 'Modern development has evolved significantly');
assertStartsWith(firstChunk.content, 'Modern development has evolved significantly');
```

This approach ensures:
- Tests are resilient to minor formatting changes
- Focus on meaningful content verification
- Realistic validation of content preservation

## Test Data

The test suite uses realistic sample data that mimics a development book:

- **Book Title**: "The Complete Guide to Modern Development"
- **Chapters**: Introduction, Environment Setup, Core Concepts
- **Content**: Development practices, tools, methodologies
- **Structure**: Proper page markers, TOC, paragraphs, headers

## Error Scenarios Tested

- Missing prerequisites (e.g., rawText, chapters, etc.)
- Invalid input data
- Edge cases (empty content, short paragraphs, etc.)
- File system errors
- Configuration issues

## Expected Test Results

When all tests pass, you should see:

```
🚀 Running POC Implementation Tests

✅ 01-text-extraction.test.js - PASSED
✅ 02-1-chapter-detection.test.js - PASSED
✅ 02-2-chapter-content-extraction.test.js - PASSED
✅ 03-page-extraction-and-cross-page-merging.test.js - PASSED
✅ 04-paragraph-detection.test.js - PASSED
✅ 05-header-detection.test.js - PASSED
✅ 06-chunking-algorithm.test.js - PASSED
✅ 07-page-assignment.test.js - PASSED
✅ 08-output-generation.test.js - PASSED

📊 TEST SUMMARY REPORT
Total Tests: 9
✅ Passed: 9
❌ Failed: 0
📈 Success Rate: 100%
```

## Debugging Test Failures

When tests fail:

1. **Check Prerequisites**: Ensure previous steps are working
2. **Verify Sample Data**: Confirm test data matches step expectations  
3. **Check Content Assertions**: Verify content starts with expected text
4. **Review Step Implementation**: Compare with step documentation
5. **Examine Debug Output**: Check generated debug files in temp directories

## Dependencies

- Node.js built-in `test` module (Node 18+)
- No external testing frameworks required
- Uses built-in `assert` module for assertions

## Notes

- Tests use temporary directories that are cleaned up automatically
- File system operations are mocked to avoid affecting real files
- Tests are designed to be independent and can run in any order
- Each test creates its own isolated environment 