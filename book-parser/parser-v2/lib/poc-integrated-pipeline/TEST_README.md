# POC Integrated Pipeline Test Case

This test validates that the `poc-script.js` works correctly by running the pipeline and verifying the results.

## What the Test Validates

The test performs the following validations:

1. **Text Extraction**: Verifies that text can be extracted from the PDF
2. **Chapter Detection**: Ensures chapters are properly detected and mapped
3. **All Chapters Included**: Validates that all expected chapters are found
4. **Introduction Chapter Content**: Specifically validates the Introduction chapter:
   - Starts with: "From space it looks grey and crystalline, obliterating the blue-green colours of the living Earth. It is criss-crossed by irregular patterns and convergent striations."
   - Ends with: "builds up; in effect, a car park. To understand which one requires a lot of context and subtle interpretation. There are times when it feels as if metabolomics should just be called gnomics."

## Prerequisites

1. Ensure `book.pdf` is located at `../../book.pdf` relative to this directory
2. Node.js must be installed
3. Required npm packages must be installed (`pdf-parse`, `pdfjs-dist`)

## How to Run

### Option 1: Using the Test Runner Script (Recommended)

```bash
./run-test.sh
```

### Option 2: Run Test Directly

```bash
node test-poc-script.js
```

### Option 3: Run Individual POC Script Steps

```bash
# Run all steps
node poc-script.js all

# Run specific steps
node poc-script.js text-extraction
node poc-script.js chapter-detection
```

## Test Output

The test will:
- Run the pipeline steps (text extraction and chapter detection)
- Validate all chapters are included
- Check Introduction chapter content
- Generate a test report
- Save results to `output/test-results.json`

## Expected Output

### Success Case
```
🧪 POC Script Validation Test
=============================

🚀 Running pipeline steps...
✅ Text extraction passed
✅ Chapter detection passed

📚 Validating all chapters are included...
Found 8 chapters:
   1. "Introduction: Life itself" (0)
   2. "Discovering the nanocosm" (1)
   ...
✅ Found Introduction chapter: "Introduction: Life itself"

📖 Validating Introduction chapter content...
Introduction chapter length: 45234 characters
✅ Introduction starts with expected text
✅ Introduction ends with expected text

============================================================
🧪 TEST REPORT
============================================================

📋 Test Results:
   Text Extraction: ✅ PASS
   Chapter Detection: ✅ PASS
   All Chapters Included: ✅ PASS
   Introduction Start Text: ✅ PASS
   Introduction End Text: ✅ PASS

📊 Summary: 5/5 tests passed
🎉 ALL TESTS PASSED! poc-script.js is working correctly.
```

### Failure Case
The test will show specific error messages for any failing validation and exit with code 1.

## Output Files

When the test runs, it creates:
- `output/test-results.json` - Detailed test results
- `output/step-01-text-extraction/` - Text extraction results
- `output/step-02-chapter-detection/` - Chapter detection results
- `debug/` - Debug information for troubleshooting

## Troubleshooting

1. **PDF Not Found**: Ensure `book.pdf` is in the correct location
2. **Dependencies Missing**: Run `npm install pdf-parse pdfjs-dist`
3. **Permission Errors**: Ensure scripts are executable (`chmod +x`)
4. **Content Validation Fails**: Check that the correct book PDF is being used

## File Structure

```
poc-integrated-pipeline/
├── poc-script.js           # Main pipeline script
├── test-poc-script.js      # Test validation script
├── run-test.sh             # Test runner script
├── TEST_README.md          # This file
├── output/                 # Generated output files
└── debug/                  # Debug information
```

## Integration with Development Workflow

This test can be integrated into CI/CD pipelines or used for manual validation:

```bash
# Return 0 for success, 1 for failure
./run-test.sh && echo "Pipeline working correctly" || echo "Pipeline needs attention"
``` 