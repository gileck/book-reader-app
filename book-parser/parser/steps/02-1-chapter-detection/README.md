# Step 2.1: Chapter Detection

## Overview

This step detects chapter boundaries from Table of Contents (TOC) using a hybrid approach that combines PDF bookmark extraction with text-based analysis. It identifies chapters and generates metadata including names, page ranges, and text positions.

## Requirements

### Input Requirements
- **Pipeline State**: Must include `rawText` from Step 1
- **PDF File**: Original PDF file for bookmark extraction
- **Configuration**: PDF path and output directories

### Output Requirements
- **Chapter Metadata**: Array of chapter objects with titles, numbers, and page ranges
- **Multiple Chapters**: Must detect more than 1 chapter for valid book structure
- **Page Accuracy**: Valid page numbers that exist in the document
- **Detection Confidence**: Confidence scores for each detected chapter
- **Source Attribution**: Track whether chapters were detected from bookmarks or text analysis

### Quality Standards
- Minimum 2 chapters detected for valid book structure
- Page numbers must be valid and within document range
- Chapter titles must be non-empty and meaningful
- Sequential chapter numbering with reasonable continuity

## Implementation

### Technical Approach

The step uses a **hybrid detection strategy** for maximum reliability:

#### 1. Primary Method: PDF Bookmark Extraction
- Uses `pdfjs-dist` to extract PDF outline/bookmarks
- Provides most accurate chapter boundaries when available
- Handles nested bookmark structures
- Extracts page destinations directly from PDF metadata
- **CRITICAL: Filters out non-chapter structural bookmarks** to prevent front matter from being treated as chapters:
  - **Cover** - Book cover page
  - **Title Page** - Title page with book name/author
  - **Copyright** or **Copyright Page** - Copyright and publication info
  - **Contents** - Table of Contents
  - **Dedication**, **Acknowledgments**, **About the Author(s)** - Front/back matter
  - **Photo Insert** - Photo section between chapters
  - Uses flexible pattern matching (e.g., "copyright( page)?") to handle different PDF formats

#### 2. Fallback Method: Text-Based TOC Analysis
- Analyzes raw text for Table of Contents patterns
- Uses regex patterns to identify chapter titles and page numbers
- Handles various TOC formatting styles
- Validates chapter boundaries using content analysis

#### 3. Validation and Filtering
- **CRITICAL: TOC Detection** - Identifies where Table of Contents ends to avoid matching TOC entries instead of actual chapters
  - Uses low threshold (1500 characters) to catch early chapters like Introduction
  - Looks for page markers in content area (pages 8-15)
  - Validates substantial content follows chapter titles (>100 chars in next 5 lines)
  - Falls back to searching from beginning if TOC end unclear (safer than skipping chapters)
- Applies `validateChapterStart()` to verify real chapter beginnings vs TOC entries
- Uses `validateChapterSequence()` to ensure reasonable chapter progression
- Filters out false positives from TOC references

### Detection Process

```javascript
1. Attempt PDF bookmark extraction
   - Load PDF document
   - Extract outline/bookmark structure
   - Convert bookmark destinations to page numbers

2. Fallback to text-based detection
   - Search for TOC patterns in raw text
   - Extract chapter titles and page references
   - Validate against actual content

3. Content validation
   - Verify chapter starts contain actual content
   - Exclude TOC entries and page references
   - Confirm chapter sequence makes sense

4. Generate chapter metadata
   - Create chapter objects with all required fields
   - Calculate confidence scores
   - Add detection source attribution
```

### Key Features

- **Multi-Source Detection**: Combines bookmark and text analysis for reliability
- **False Positive Filtering**: Distinguishes between TOC entries and actual chapters
- **Confidence Scoring**: Provides reliability metrics for each detection
- **Content Validation**: Ensures detected chapters contain substantial content
- **Flexible TOC Parsing**: Handles various table of contents formats

## Validation

### Validation Rules

The validation module (`02-1-chapter-detection-validation.js`) implements:

#### 1. Chapter Count Validation
- **Rule**: Must detect more than 1 chapter
- **Purpose**: Ensure valid book structure (single-chapter documents are typically not books)

#### 2. Required Fields Validation
- **Rule**: Each chapter must have `title`, `chapterNumber`, and `startingPage`
- **Purpose**: Ensure complete metadata for downstream processing

#### 3. Page Number Validation
- **Rule**: `startingPage` must be a valid positive number
- **Purpose**: Ensure page references are meaningful and processable

#### 4. Chapter Sequence Validation
- **Rule**: Chapter numbers should follow reasonable sequence
- **Purpose**: Detect and filter out false positive detections

### Helper Functions

#### `validateChapterStart(line, lines, lineIndex, pageNumber, chapterTitle)`
Validates that a detected chapter boundary represents a real chapter start:
- **TOC Exclusion**: Filters out matches in Table of Contents sections
- **Content Verification**: Ensures substantial content follows the chapter title
- **Context Analysis**: Checks surrounding text for chapter indicators
- **Page Range Validation**: Confirms page numbers are reasonable for chapter content

#### `validateChapterSequence(potentialChapters)`
Filters chapter list for reasonable sequence continuity:
- **Sequential Validation**: Ensures chapter numbers progress logically
- **Gap Tolerance**: Allows reasonable gaps in chapter numbering
- **False Positive Removal**: Filters out obvious detection errors

### Validation Success Criteria

- ✅ Multiple chapters detected (≥2 chapters)
- ✅ All chapters have complete required metadata
- ✅ Page numbers are valid and within document range
- ✅ Chapter sequence follows logical progression
- ✅ High confidence scores for detected chapters

## Usage

### Basic Usage
```javascript
const chapterDetection = require('./02-1-chapter-detection');

const result = await chapterDetection.execute(pipelineState, config);
const isValid = chapterDetection.validate(result);
```

### Configuration Example
```javascript
const config = {
    INPUT_PDF: '/path/to/book.pdf',
    OUTPUT_DIR: '/path/to/output',
    DEBUG_DIR: '/path/to/debug'
};
```

### Expected Output Structure
```javascript
{
    chapterMetadata: [
        {
            title: "Introduction",
            chapterNumber: 1,
            startingPage: 15,
            endPage: 42,
            confidence: 0.95,
            detectionSource: "bookmarks",
            position: 12450
        },
        {
            title: "The Science of Transformation",
            chapterNumber: 2,
            startingPage: 43,
            endPage: 78,
            confidence: 0.92,
            detectionSource: "text-analysis",
            position: 28750
        }
        // ... more chapters
    ]
}
```

## Dependencies

- **pdfjs-dist**: PDF bookmark and outline extraction
- **fs**: File system operations for debug output
- **path**: Path utilities for file handling

## Detection Sources

### Bookmark Detection
- **Accuracy**: Highest - directly from PDF metadata
- **Coverage**: Limited - not all PDFs have bookmarks
- **Reliability**: Excellent when available

### Text-Based Detection
- **Accuracy**: Good - depends on TOC formatting
- **Coverage**: Universal - works with any PDF with TOC
- **Reliability**: Good with proper validation

## Debug Output

The step generates comprehensive debug information:
- Chapter detection candidates with confidence scores
- Validation results for each potential chapter
- Detection source attribution and reasoning
- Processing statistics and timing data

## Error Handling

- **PDF Access Errors**: Graceful handling when PDF cannot be loaded
- **Bookmark Extraction Failures**: Automatic fallback to text-based detection
- **TOC Parsing Errors**: Robust pattern matching with multiple fallback strategies
- **Validation Failures**: Clear error messages for debugging detection issues

## Common Use Cases

- **Academic Books**: Excellent bookmark support
- **Technical Manuals**: Strong TOC pattern recognition
- **Fiction Books**: Reliable text-based chapter detection
- **Mixed Format Documents**: Hybrid approach handles various structures 