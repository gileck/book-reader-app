# Step 1: Text Extraction

## Overview

This step extracts raw text from PDF files using a page-by-page extraction approach with improved text joining to resolve spacing issues that commonly occur in PDF text extraction. It also preserves explicit paragraph breaks by honoring empty text items that include end-of-line markers from PDF.js.

## Requirements

### Input Requirements
- **PDF File**: Valid PDF file accessible at the configured path
- **Pipeline State**: Empty initial state (`{ rawText: null, ... }`)
- **Configuration**: Must include `INPUT_PDF` path and output directories

### Output Requirements
- **Complete Text Extraction**: Extract all readable text from the PDF
- **Proper Spacing**: No word concatenation or split words
- **Character Preservation**: Preserve literal `\n` characters (not convert to actual newlines)
- **Page Accuracy**: Handle multi-page PDFs with accurate page boundaries
- **Metadata Generation**: Provide character count and extraction statistics
- **Debug Output**: Generate validation data for quality checking

### Quality Standards
- Zero concatenated words (validated through word length analysis)
- Minimum 1000 characters for substantial content
- Character count consistency between metadata and actual text
- Professional-grade text quality suitable for further processing

## Implementation

### Technical Approach

The step uses **pdfjs-dist** library for PDF processing with a custom page-by-page extraction strategy:

1. **PDF Loading**: Load PDF document using pdfjs-dist
2. **Page-by-Page Processing**: Process each page individually to maintain accurate boundaries
3. **Text Item Extraction**: Extract individual text items from each page
4. **Smart Text Joining**: Apply improved spacing logic to prevent word concatenation
5. **Quality Validation**: Perform word length analysis to detect text quality issues
6. **Text Caching**: Saves extracted text to `.txt` file for future runs to avoid re-parsing

### Key Features

- **Text File Caching**: Automatically saves extracted text to a `.txt` file (same name as PDF) and uses cached version in subsequent runs
- **Force Reparse Option**: Set `config.FORCE_REPARSE = true` to force re-extraction from PDF even if `.txt` file exists
- **Position-Based Text Ordering**: Sorts text items by their visual position (Y-coordinate then X-coordinate) to ensure correct reading order, preventing issues where bullets appear out of order from their list items
- **Bullet Point Merging**: Automatically detects standalone bullets or numbered markers on separate lines and merges them with their corresponding text, fixing PDF extraction issues where bullets are separated from list items (e.g., `•\nYoga mat` → `• Yoga mat`)
- **🎯 CRITICAL: Position-Based Smart Spacing**: Uses PDF positioning data (X-coordinates and widths) to intelligently determine spacing between text items:
  - **Calculates physical gaps** between consecutive text items using their position and width from PDF.js transform data
  - **Ligature Detection**: Automatically handles font ligatures (fi, fl, ff, ffi, ffl) without pattern matching by detecting when items are physically touching (gap ≤ 1.0 units)
  - **Word Preservation**: Only adds spaces between items that are physically separated (gap > 1.0 units)
  - **Universal Solution**: Works for ANY ligature or typography, not just specific patterns
  - **Examples**: 
    - `"fi" + "nd"` with gap=0.00 → `"find"` (no space added) ✅
    - `"hello" + "world"` with gap=4.50 → `"hello world"` (space added) ✅
- **Paragraph Break Preservation**: Treats empty items with `hasEOL: true` as explicit blank lines, preserving paragraph boundaries and list breaks
- **Standalone Page Number Removal**: Removes standalone page numbers from the beginning of each page
- **Complete Content Coverage**: Ensures no sections or chapters are missing
- **Robust Error Handling**: Graceful fallback mechanisms for different PDF structures and missing dependencies

### Processing Steps

```javascript
1. Check if .txt file exists (same name as PDF but with .txt extension)
   - If exists and FORCE_REPARSE is false, load cached text and return
   - If FORCE_REPARSE is true, delete existing .txt file and proceed
2. Load PDF document from configured path
3. For each page:
   - Extract text items array
   - **CRITICAL: Sort items by visual position** (Y-coordinate desc, then X-coordinate asc)
     * Ensures correct reading order, preventing bullets from appearing out of sequence
     * Handles PDFs where file structure order differs from visual layout
   - For each item:
     - If `item.str` is empty (`""`) and `item.hasEOL === true`, append a newline to preserve a blank line (paragraph break)
     - Otherwise, append the text
     - If `item.hasEOL === true`, append newline
     - If `item.hasEOL === false`, determine spacing:
       * **🎯 POSITION-BASED SPACING (CRITICAL)**:
         1. Extract position data from PDF.js transform matrix:
            - currentX = item.transform[4] (X position)
            - currentWidth = item.width
            - currentEndX = currentX + currentWidth (where item ends)
         2. Get next item's position: nextX = nextItem.transform[4]
         3. Calculate physical gap: gap = nextX - currentEndX
         4. Apply spacing threshold:
            - If gap > 1.0 units → items are separated → ADD SPACE
            - If gap ≤ 1.0 units → items are touching (ligature) → NO SPACE
         5. This automatically handles ALL ligatures (fi, fl, ff, ffi, ffl, etc.)
       * Example: "fi" (ends at 277.06) + "nd" (starts at 277.06) = gap 0.00 → "find" ✅
   - **Merge standalone bullets with text**: Detect lines containing only bullet markers (•, -, *, numbered) and merge with the following line
   - Remove standalone page numbers from the beginning of each page
   - Accumulate page text with proper boundaries
4. Generate extraction metadata
5. Validate text quality using word length analysis
6. Save extracted text to .txt file for future use
7. Save debug information for troubleshooting
```

## Validation

### Validation Rules

The validation module (`01-text-extraction-validation.js`) implements the following checks:

#### 1. Text Existence Validation
- **Rule**: `rawText` must exist and be a non-empty string
- **Purpose**: Ensure text extraction was successful

#### 2. Content Length Validation  
- **Rule**: Text must be at least 1000 characters
- **Purpose**: Ensure substantial content was extracted (not just metadata/headers)

#### 3. Metadata Consistency Validation
- **Rule**: Character count in metadata must match actual text length
- **Purpose**: Verify extraction accuracy and metadata reliability

#### 4. Word Length Analysis
- **Rule**: Analyze word length distribution to detect concatenation issues
- **Metrics**: 
  - Long words (>20 characters) - may indicate concatenation
  - Very long words (>30 characters) - likely concatenation errors
  - Suspicious words (>50 characters) - definite concatenation issues
- **Purpose**: Ensure professional text quality

### Helper Functions

#### `validateWordLengths(text)`
Performs comprehensive word length analysis:
- Extracts all alphanumeric word sequences
- Categorizes words by length thresholds
- Identifies suspicious concatenated words
- Calculates average word length statistics
- Returns detailed analysis for quality assessment

### Validation Success Criteria

- ✅ Text exists and is substantial (≥1000 characters)
- ✅ Metadata is consistent and complete
- ✅ Zero or minimal suspicious word concatenations
- ✅ Professional-grade text spacing and readability

## Usage

### Basic Usage
```javascript
const textExtraction = require('./01-text-extraction');

const result = await textExtraction.execute(pipelineState, config);
const isValid = textExtraction.validate(result);
```

### Configuration Example
```javascript
const config = {
    INPUT_PDF: '/path/to/book.pdf',
    OUTPUT_DIR: '/path/to/output',
    DEBUG_DIR: '/path/to/debug',
    FORCE_REPARSE: false  // Set to true to force re-extraction from PDF
};
```

### Expected Output Structure
```javascript
{
    rawText: "Complete extracted text content...",
    rawTextContentItems: [...],  // Raw PDF.js textContent.items for debugging
    metadata: {
        textExtraction: {
            characterCount: 743700,
            pageCount: 317,
            lineCount: 12345,
            wordCount: 85000,
            literalNewlineCount: 234,
            extractionTime: "2024-01-15T10:30:00Z",
            averageWordsPerPage: 268,
            extractionMethod: "page_by_page_fixed",  // or "cached-txt-file" or "text-file-load"
            source: "cached-txt-file",  // Only present when using cached .txt file
            txtFilePath: "/path/to/book.txt",  // Only present when using cached .txt file
            totalTextContentItems: 15678
        }
    }
}
```

## Dependencies

- **pdfjs-dist**: PDF processing and text extraction
- **fs**: File system operations for debug output
- **path**: Path utilities for file handling

## Debug Output

The step generates debug files for quality assurance:
- `step-01-text-extraction.json`: Complete extraction metadata
- Word length analysis with suspicious word identification
- Processing timing and performance metrics

## Error Handling

- **PDF Load Errors**: Clear error messages for invalid/corrupted PDFs
- **Text Extraction Failures**: Graceful handling of extraction issues
- **Validation Failures**: Detailed error reporting for quality issues
- **File System Errors**: Proper error handling for debug file operations 