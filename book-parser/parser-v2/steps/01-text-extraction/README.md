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

### Key Features

- **Simplified Spacing Logic**: Adds spaces after each text item unless it already ends with space/newline
- **Paragraph Break Preservation**: Treats empty items with `hasEOL: true` as explicit blank lines, preserving paragraph boundaries and list breaks
- **Word Boundary Preservation**: Prevents common PDF extraction issues like "forTransformer" → "for Transformer"
- **Complete Content Coverage**: Ensures no sections or chapters are missing
- **Robust Error Handling**: Graceful fallback mechanisms for different PDF structures

### Processing Steps

```javascript
1. Load PDF document from configured path
2. For each page:
   - Extract text items array
   - For each item:
     - If `item.str` is empty (`""`) and `item.hasEOL === true`, append a newline to preserve a blank line (paragraph break)
     - Otherwise, append the text and add either a newline (when `hasEOL` is true) or a space (for flow)
   - Accumulate page text with proper boundaries
3. Generate extraction metadata
4. Validate text quality using word length analysis
5. Save debug information for troubleshooting
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
    DEBUG_DIR: '/path/to/debug'
};
```

### Expected Output Structure
```javascript
{
    rawText: "Complete extracted text content...",
    metadata: {
        textExtraction: {
            characterCount: 743700,
            pageCount: 317,
            extractionTime: "2024-01-15T10:30:00Z",
            wordAnalysis: {
                totalWords: 85000,
                averageWordLength: 5.2,
                suspiciousWords: []
            }
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