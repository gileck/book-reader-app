# Corrupted PDF Detection and Improved Error Messages

## Overview

Enhanced the book parser to detect corrupted or unreadable PDFs early in the pipeline and provide clear, actionable error messages to users.

## Changes Made

### 1. Early Detection in Step-1 (Text Extraction)

**File:** `book-parser/parser/steps/01-text-extraction/01-text-extraction.js`

**Added:**
- Calculation of pages with actual content vs empty pages
- Extraction quality assessment (excellent/good/fair/poor/failed)
- Early warning when >90% of pages are empty (corruption threshold)
- Warning when >50% of pages are empty (quality issues)

**Metrics Tracked:**
```javascript
{
  pagesWithContent: 1309,        // Pages with >50 characters
  emptyPages: 14,                // Pages with <50 characters
  emptyPagePercentage: 1.1,      // Percentage of empty pages
  extractionQuality: "excellent" // excellent/good/fair/poor/failed
}
```

**Error Message Example (Corrupted PDF):**
```
⚠️  WARNING: PDF appears to be corrupted or unreadable!

   Extraction Results:
   - Total pages: 1323
   - Pages with content: 10 (0.8%)
   - Empty pages: 1313 (99.2%)
   - Average words per page: 9
   
   This PDF has 99.2% empty pages, which strongly suggests:
   
   1. 🔴 PDF is corrupted (compression stream errors)
   2. 🔴 PDF contains only scanned images (requires OCR)
   3. 🔴 PDF uses non-standard encoding that cannot be extracted
   
   Recommended Actions:
   - Try opening the PDF in a viewer and check if you can select/copy text
   - If text is selectable, the PDF may be corrupted - try re-downloading or repairing it
   - If text is NOT selectable, the PDF contains only images and requires OCR processing
   - Try converting the PDF using Adobe Acrobat or another tool and re-saving it
```

### 2. Enhanced Step-2-1 Validation (Chapter Detection)

**File:** `book-parser/parser/steps/02-1-chapter-detection/02-1-chapter-detection-validation.js`

**Added:**
- Context-aware error messages that check extraction quality
- Detailed diagnostic information when chapter detection fails
- Specific troubleshooting steps based on extraction metrics

**Error Message Example (Poor Extraction Quality):**
```
❌ Chapter detection failed: No chapters found (0 chapters detected)

   This appears to be caused by poor text extraction quality:
   - Average words per page: 9
   - Pages with content: 10/1323
   - Extraction quality: failed
   - Empty pages: 99.2%
   
   📋 Likely causes:
   
   1. 🔴 PDF is corrupted (compression stream errors)
      → Try re-downloading the PDF or repairing it with Adobe Acrobat
      
   2. 🔴 PDF contains only scanned images (no text layer)
      → This requires OCR processing to extract text
      
   3. 🔴 PDF uses non-standard encoding
      → Try converting/re-saving the PDF in a different tool
      
   💡 Quick check: Open the PDF and try to select/copy text
      - If you CAN select text → PDF is likely corrupted
      - If you CANNOT select text → PDF needs OCR processing
```

### 3. Pipeline Integration

**File:** `book-parser/parser/parser.js`

**Updated:**
- Validation functions now receive `pipelineState` as second parameter
- Allows validation functions to access extraction metadata for context-aware messages
- Backwards compatible (validation functions can work with or without pipelineState)

## Extraction Quality Levels

| Quality | Content Pages | Empty % | Description |
|---------|--------------|---------|-------------|
| **excellent** | >90% | <10% | High-quality extraction, ready for processing |
| **good** | 70-90% | 10-30% | Good extraction with minor issues |
| **fair** | 50-70% | 30-50% | Acceptable but may have quality problems |
| **poor** | 10-50% | 50-90% | Significant extraction issues, may fail |
| **failed** | <10% | >90% | Extraction failed, PDF likely corrupted |

## Detection Thresholds

### Error Threshold (Stops Pipeline)
- **Trigger:** Less than 10% of pages have content
- **Action:** Throws error with detailed troubleshooting guide
- **Reason:** 90%+ empty pages indicates PDF is unusable

### Warning Threshold (Continues)
- **Trigger:** Less than 50% of pages have content  
- **Action:** Logs warning but continues processing
- **Reason:** May still be processable but user should be aware

## Testing

### Before Changes
```bash
# With corrupted PDF
❌ Chapter validation failed: Chapters array must have more than 1 chapter. Found: 0
```
- Generic error message
- No indication of root cause
- User confused about what went wrong

### After Changes
```bash
# With corrupted PDF
⚠️  WARNING: PDF appears to be corrupted or unreadable!
   [Detailed extraction metrics]
   [Specific troubleshooting steps]
   [Quick diagnostic test]

❌ PDF extraction failed: 99.2% of pages are empty...
```
- Clear identification of the problem
- Detailed metrics showing extraction quality
- Actionable steps to fix the issue
- Quick diagnostic test (can you select text?)

### With Fixed PDF
```bash
✓ step-1 completed (3357ms) [validated]
   - Extraction quality: excellent
   - Pages with content: 1309/1323 (98.9%)
```
- No errors thrown
- Quality metrics visible in debug output
- Parser proceeds successfully

## Benefits

1. **Early Detection:** Identifies corrupted PDFs before wasting time on later steps
2. **Clear Diagnostics:** Shows exact extraction metrics (content pages, empty pages, quality level)
3. **Actionable Guidance:** Provides specific troubleshooting steps based on symptoms
4. **Time Savings:** Fails fast with clear error instead of confusing later-stage failures
5. **Better UX:** Users understand what went wrong and how to fix it

## Future Enhancements

Potential improvements for even better error handling:

1. **PDF Validation Check:** Verify PDF structure before extraction
2. **OCR Detection:** Automatically detect image-only PDFs and suggest OCR tools
3. **Repair Suggestions:** Provide specific repair tool recommendations
4. **Sample Page Analysis:** Show which pages extracted successfully vs failed
5. **Compression Error Details:** Parse and explain specific PDF.js errors

