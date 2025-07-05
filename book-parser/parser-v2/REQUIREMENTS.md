# Book Parser v2.0 - Requirements Specification

## High-Level Requirements

### Input
- **Source**: Folder path containing a `book.pdf` file
- **Format**: PDF documents only
- **Discovery**: Parser automatically locates `book.pdf` in the specified folder

### Output
The parser generates the following files in the same folder as the input:

1. **`output.json`** - Complete parsed book content with chapters, chunks, and metadata
2. **`summary.json`** - High-level statistics and chapter overview  
3. **`images/`** - Folder containing extracted images (if any)
4. **`debug/`** - Debug information folder (when debug mode enabled)

## Usage Pattern
```bash
# Input folder structure
/path/to/book-folder/
├── book.pdf          # Input file (required)

# After parsing
/path/to/book-folder/
├── book.pdf          # Original input
├── output.json       # Main output
├── summary.json      # Statistics
├── images/           # Extracted images
└── debug/            # Debug files (if --debug)
```

## Chunking Algorithm Summary

**The parser creates chunks based on paragraph boundaries with flexible word count targeting:**

1. **Detect Paragraphs**: Find text segments ending with `\n` characters from raw PDF
2. **Evaluate Size**: Check if paragraphs fit 80-300 word target range
3. **Merge Short**: Combine consecutive short paragraphs (<80 words) until reaching target range
4. **Split Long**: Divide long paragraphs (>300 words) at sentence boundaries
5. **Apply Limits**: Ensure all chunks stay within 50-500 word absolute boundaries
6. **Handle Cross-Page**: Merge paragraphs split across pages into single chunks
7. **Assign Pages**: Use starting page number for each chunk
8. **Process Headers**: Create separate header chunks that don't affect paragraph chunking

**Result**: Chunks based on natural paragraph boundaries, typically 80-300 words, but flexible for paragraph integrity.

## Functional Requirements

### FR-1: Text Processing and Chunking
**Priority**: High
**Description**: The parser must create chunks based on paragraph boundaries. Each chunk contains exactly one complete paragraph.

**Specific Requirements**:
- **Paragraph-Based Chunking**: Each chunk is based on paragraph boundaries (may contain multiple merged paragraphs or split long paragraphs)
- **Paragraph Definition**: A paragraph is a group of sentences that do not include a newline character. As long as a group of sentences are on the same line (without newline breaks), they constitute a single paragraph. Paragraphs are separated by literal newline characters (`\n`) in the raw PDF text.
- **PDF Text Extraction**: Use raw PDF text extraction to find literal `\n` characters for paragraph boundaries
- **Chunk Size**: Target 80-300 words per chunk (flexible for paragraph integrity)
- **Page Number Assignment**: Each chunk gets the page number where its first paragraph begins
- **Sentence Integrity**: No sentences may be split across chunks
- **Cross-Page Merging**: Entire paragraphs split across page boundaries must be properly merged
- **Natural Boundaries**: Chunks respect paragraph boundaries defined by literal `\n` characters

**Conflict Resolution Priority** (when requirements conflict):
1. **Cross-Page Merging**: Entire paragraphs spanning pages must be merged (highest priority)
2. **Paragraph Integrity**: Prefer complete paragraphs when possible
3. **Sentence Integrity**: Never split sentences within chunks
4. **Word Count Compliance**: 80-300 word target (flexible to maintain paragraph integrity)

**Edge Case Handling**:
- **Short Paragraphs** (< 80 words): Merge with adjacent paragraphs until reaching 80-300 word range
- **Long Paragraphs** (> 300 words): Split at sentence boundaries, each resulting chunk maintains paragraph context
- **Cross-Page Paragraphs**: Treat as single chunk with starting page number (edge case, very unlikely)
- **Multiple Short Paragraphs**: Continue merging until target range reached, maximum 500 words per chunk
- **Extremely Long Paragraphs**: Split into multiple chunks, each 80-300 words, preserve paragraph flow
- **Word Count Flexibility**: Allow chunks 50-500 words when paragraph integrity requires it (absolute limits)

**Specific Merging/Splitting Rules**:
- **Merging Limit**: Never create chunks larger than 500 words
- **Splitting Minimum**: Never create chunks smaller than 50 words
- **Cross-Page Limit**: Paragraphs spanning more than 3 pages should be split at sentence boundaries
- **Page Number Assignment**: For merged chunks, use first paragraph's page; for split chunks, use respective page numbers

**Chunk Structure Rules**:
1. **Chunk Start**: MUST begin with a capital letter (A-Z)
2. **Chunk End**: MUST end with sentence-ending punctuation (`.`, `!`, `?`, or footnote numbers)
3. **Line Ending**: MUST end with a newline character
4. **Page Number**: MUST have starting page number (where chunk begins)
5. **Complete Sentences**: Each chunk must contain only complete sentences
6. **Word Count Target**: Target 80-300 words (flexible when paragraph integrity requires it)
7. **Natural Flow**: Text must read naturally with proper paragraph breaks

### FR-2: Header Detection
**Priority**: High
**Description**: The parser must accurately identify section headers using specific rules.

**Header Definition Rules** (ALL must be satisfied):
1. **Length**: 2-5 words only
2. **No Punctuation**: Does not end with sentence punctuation (`.`, `!`, `?`)
3. **Capitalization**: Starts with a capital letter
4. **Line Structure**: Appears as standalone line
5. **Context - Previous**: Previous line ends with sentence-ending punctuation
6. **Context - Next**: Next line starts with a capital letter

**Header Processing**:
- Headers must be detected at page level BEFORE cross-page merging
- Headers must be marked as separate chunks with `type: "header"`
- Headers must be preserved with original formatting
- No false positives (regular text marked as headers)

**Header Integration with Paragraph Chunking**:
- Headers are separate chunks and do NOT count toward paragraph word count targets
- Headers do NOT affect paragraph merging/splitting decisions
- Headers maintain their own page numbers independently
- Regular paragraph chunking rules apply around headers (before/after header chunks)

### FR-3: Image Extraction
**Priority**: Medium
**Description**: Extract and organize images from PDF documents.

**Image Requirements**:
- Extract all embedded images from PDF pages
- Organize images by chapter based on page ranges
- Generate descriptive filenames with page numbers
- Images associated at chapter level, not individual chunks

**Image Structure**:
```json
{
  "imageName": "page-015-image-1.jpg",
  "pageNumber": 15,
  "imageAlt": "Figure 1 (Page 15)"
}
```

### FR-4: Page Number Extraction
**Priority**: High
**Description**: Extract and assign accurate page numbers to all chunks.

**Page Number Requirements**:
- Each chunk must have its starting page number
- Page numbers indicate where the chunk begins in the original PDF
- For cross-page chunks (sentences spanning pages), use the starting page number
- Page numbers must be accurate and sequential within chapters

**Page Number Logic**:
- **Starting Page**: Page where the chunk's first sentence begins
- **Cross-Page Handling**: If a sentence spans pages, use the page where it starts
- **Accuracy**: Page numbers must correspond to actual PDF page numbers

### FR-5: Link Resolution
**Priority**: Medium
**Description**: Extract and resolve internal links within the document.

**Link Requirements**:
- Extract internal links, footnotes, and cross-references
- Resolve links to specific target chunks
- Simplified link structure with essential navigation data only
- Mark target chunks for navigation purposes

**Link Structure**:
```json
{
  "text": "see methodology",
  "targetChunk": 156,
  "chapterNumber": 3
}
```

## Output Format Specification

### output.json Structure
```json
{
  "book": {
    "title": "Book Title",
    "author": "Author Name",
    "pageCount": 245,
    "filename": "book.pdf",
    "parsingDate": "2024-01-15T10:30:00.000Z"
  },
  "chapters": [
          {
        "number": 1,
        "title": "Chapter Title",
        "startPageNumber": 1,
        "endPageNumber": 20,
        "wordCount": 5000,
        "chunkCount": 25,
        "headerCount": 8,
        "images": [
        {
          "imageName": "page-005-image-1.jpg",
          "pageNumber": 5
        }
      ],
      "chunks": [
        {
          "index": 0,
          "text": "Complete paragraph text...",
          "wordCount": 150,
          "type": "text",
          "pageNumber": 1,
          "links": [
            {
              "text": "see chapter 3",
              "targetChunk": 45,
              "chapterNumber": 3
            }
          ]
        },
        {
          "index": 1,
          "text": "Section Header",
          "wordCount": 2,
          "type": "header",
          "pageNumber": 1,
          "links": []
        }
      ]
    }
  ]
}
```

### summary.json Structure
```json
{
  "book": {
    "title": "Book Title",
    "author": "Author Name",
    "pageCount": 245
  },
  "processing": {
    "totalChapters": 12,
    "totalChunks": 500,
    "totalWords": 75000,
    "totalImages": 25,
    "totalHeaders": 95,
    "totalLinks": 150,
    "parsingDate": "2024-01-15T10:30:00.000Z"
  },
  "chapters": [
    {
      "number": 1,
      "title": "Introduction",
      "chunkCount": 25,
      "wordCount": 5000,
      "imageCount": 3,
      "headerCount": 8,
      "linkCount": 8
    }
  ]
}
```

## Non-Functional Requirements

### NFR-1: Performance
- Processing time: ~1-5 seconds per page
- Memory usage: Maximum 3x PDF file size
- Support PDFs up to 500 pages

### NFR-2: Reliability
- Graceful handling of corrupted PDFs
- Comprehensive error reporting
- Detailed debug output when enabled
- Fallback strategies for edge cases
- Clear error messages with actionable guidance

### NFR-3: Debug Mode Requirements
**Debug Output Structure**:
- **`debug/step-1-pdf-extraction.json`**: Raw PDF text and metadata
- **`debug/step-2-paragraph-detection.json`**: Identified paragraph boundaries
- **`debug/step-3-header-detection.json`**: Detected headers with rule validation
- **`debug/step-4-chunking-process.json`**: Chunk creation with word counts
- **`debug/step-5-page-assignment.json`**: Page number assignment logic
- **`debug/step-6-cross-page-merging.json`**: Cross-page sentence merging details
- **`debug/processing-summary.txt`**: Human-readable processing summary
- **`debug/conflict-resolution.json`**: Record of requirement conflicts and resolutions

**Debug Information Requirements**:
- Step-by-step processing logs
- Conflict resolution decisions
- Edge case handling records
- Performance metrics per step
- Validation test results

### NFR-4: Quality Assurance
- Zero tolerance for cross-page paragraph splitting
- Zero tolerance for sentence splitting across chunks
- Accurate header detection with minimal false positives
- Proper cross-page paragraph merging
- Flexible word count targeting (80-300 words preferred, but not mandatory)

### NFR-5: Error Handling
**Error Categories**:
- **Fatal Errors**: Missing book.pdf, corrupted PDF, insufficient permissions
- **Processing Errors**: Unable to extract text, no paragraphs found, invalid page structure
- **Validation Errors**: Word count violations, missing headers, malformed chunks
- **Warning Conditions**: Unusual paragraph sizes, potential header detection issues

**Error Response**:
- **Fatal Errors**: Exit with error code and clear message
- **Processing Errors**: Attempt fallback strategies, continue with warnings
- **Validation Errors**: Report specifics, continue processing
- **Warning Conditions**: Log warnings, continue normal processing

**Fallback Strategies**:
- **No Paragraphs Detected**: Fall back to sentence-based chunking
- **All Paragraphs Too Short**: Merge adjacent paragraphs
- **All Paragraphs Too Long**: Split at sentence boundaries
- **No Headers Found**: Continue with text-only chunks
- **Inconsistent Newlines**: Use best-effort paragraph detection from available text structure

**Note**: *PDF text extraction inconsistencies* - requires clarification on specific scenarios expected

## CLI Interface Specification

### Basic Usage
```bash
# Parse book.pdf in current directory
node parser/index.js ./book.pdf

# Parse with debug output
node parser/index.js ./book.pdf --debug

# Parse specific folder
node parser/index.js /path/to/folder/book.pdf
```

### Expected Behavior
- Automatically detect `book.pdf` in specified folder
- Generate output files in same folder as input
- Create debug folder only when `--debug` flag used
- Exit with error code if parsing fails

## Success Criteria

### Primary Success Metrics
1. **Cross-Page Merging**: 100% of paragraphs spanning pages must be properly merged
2. **Paragraph Integrity**: Prefer complete paragraphs over arbitrary chunking
3. **Sentence Integrity**: 0% of sentences split across chunks
4. **Page Number Accuracy**: 100% of chunks must have accurate starting page numbers
5. **Header Accuracy**: All valid headers detected, minimal false positives
6. **Word Count Target**: Target 80-300 words per chunk (flexible for paragraph integrity)
7. **Output Structure**: JSON output matches specification exactly

### Validation Tests
1. **Paragraph-Based Chunking Test**: Verify every chunk is based on paragraph boundaries
2. **Word Count Test**: Verify chunks are within 50-500 words (flexible target 80-300)
3. **Sentence Boundary Test**: Verify no incomplete sentences
4. **Line Ending Test**: Verify every chunk ends with a newline character
5. **Page Number Test**: Verify every chunk has accurate starting page number
6. **Header Detection Test**: Validate against known header examples
7. **Cross-Page Test**: Verify paragraphs spanning pages are merged
8. **JSON Schema Test**: Validate output structure matches specification
9. **Edge Case Test**: Verify proper handling of short/long paragraphs
10. **Conflict Resolution Test**: Verify priority rules are followed when requirements conflict
11. **Header Integration Test**: Verify headers are separate chunks and don't affect paragraph chunking
12. **Merging/Splitting Test**: Verify merging and splitting rules are followed correctly

### Acceptance Criteria
**For each test case, the parser must:**
- **Pass Rate**: 100% compliance with all mandatory requirements
- **Cross-Page Rate**: 100% of cross-page paragraphs properly merged
- **Paragraph Integrity Rate**: Prefer complete paragraphs when possible
- **Error Rate**: < 1% false positives for header detection
- **Processing Rate**: Complete processing without fatal errors
- **Word Count Guidance**: Target 80-300 words per chunk (flexible for paragraph integrity)

**Test Data Requirements**:
- **Minimum Test Set**: 5 different PDF books with varying structures
- **Edge Case Coverage**: Books with very short/long paragraphs, minimal headers, complex formatting
- **Cross-Page Coverage**: Books with sentences spanning multiple pages
- **Header Variety**: Books with different header styles and patterns

## Quality Gates

### Mandatory Quality Checks
- **FAIL** if any chunk is not based on paragraph boundaries
- **FAIL** if any chunk is outside 50-500 word absolute limits
- **FAIL** if any sentence is split across chunks  
- **FAIL** if any chunk doesn't end with a newline character
- **FAIL** if any chunk is missing page number
- **FAIL** if cross-page paragraphs aren't properly merged
- **FAIL** if headers don't follow 6-rule definition
- **FAIL** if headers affect paragraph chunking logic
- **FAIL** if output JSON doesn't match specification

### Quality Guidelines (Flexible)
- **TARGET** 80-300 words per chunk (flexible for paragraph integrity)
- **PREFER** complete paragraphs over arbitrary word count compliance
- **MONITOR** chunks outside target range but within 50-500 limits
- **VALIDATE** merging/splitting decisions follow defined rules

### Performance Benchmarks
- Parse 100-page PDF in under 10 minutes
- Memory usage stays under 500MB for typical PDFs
- Debug output generation adds less than 50% processing time

## Implementation Constraints

### Technical Constraints
- **Node.js Compatibility**: Must work with Node.js 14+
- **Memory Limits**: Must handle PDFs up to 500 pages within 1GB RAM
- **File System**: Must work with standard file system permissions
- **Dependencies**: Minimize external dependencies, prefer built-in Node.js modules
- **Cross-Platform**: Must work on Windows, macOS, and Linux

### PDF Text Extraction Implementation
- **Primary Method**: Use raw PDF text extraction to preserve literal `\n` characters
- **Newline Detection**: Look for `\n`, `\r\n`, or `\r` characters in extracted text
- **Text Normalization**: Convert all newline variants to `\n` for consistent processing
- **Paragraph Boundary Logic**: Text ending with newline + next text starting with capital letter = paragraph boundary
- **Extraction Consistency**: Same PDF should always produce same paragraph boundaries
- **Fallback Strategy**: If no newlines found, fall back to double-space or formatting cues
- **Validation**: Debug output should show detected paragraph boundaries for verification

### Processing Constraints
- **Sequential Processing**: Process chapters in order to maintain page number accuracy
- **Incremental Output**: Generate output files only after successful processing
- **Atomic Operations**: Either complete successfully or leave no partial files
- **Resource Cleanup**: Clean up temporary files and release resources properly

### Data Integrity Constraints
- **Immutable Input**: Never modify the original PDF file
- **Consistent Output**: Same PDF must produce identical output across multiple runs
- **Validation**: All output must pass JSON schema validation
- **Encoding**: Proper UTF-8 encoding for all text content

### Security Constraints
- **Input Validation**: Validate PDF file integrity before processing
- **Path Traversal**: Prevent directory traversal attacks in file paths
- **Resource Limits**: Prevent resource exhaustion attacks
- **Error Information**: Don't expose sensitive system information in error messages

---

*This specification defines the exact input/output requirements and file structures for the Book Parser v2.0 based on the provided examples.* 