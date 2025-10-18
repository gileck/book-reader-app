# Step 3: Page Extraction and Cross-Page Merging

## Overview

This step transforms chapter content into a page-based structure and performs enhanced page number removal. It extracts individual pages from chapters, removes page numbers and headers/footers, and creates both page-level and chapter-level concatenated content. 

**Important**: Cross-page sentence merging is currently **DISABLED** in the implementation. Pages are extracted and cleaned independently, and chapter-level content is created by intelligently joining page segments (continuing sentences when appropriate, starting new paragraphs otherwise).

## Key Features

### Enhanced Page Number Removal
- **Comprehensive Cleaning**: Removes page numbers from the beginning of content (e.g., "9 down to..." → "Down to...")
- **Multiple Patterns**: Handles page numbers after newlines ("\n10 regulatory" → "\nRegulatory")
- **Automatic Capitalization**: Capitalizes first letter after page number removal when needed
- **Clean Text Flow**: Eliminates page number artifacts that disrupt text readability

## Requirements

### Input Requirements
- **Pipeline State**: Must include `chapters` array from Step 2.3 with cleaned content
- **Chapter Content**: Clean chapter content from previous steps
- **Page Information**: Page boundaries and numbering from original text (if still materialized)

### Output Requirements
- **Clean Page Content**: Individual pages with page numbers, headers, and footers removed
- **Chapter-Level Concatenated Content**: Intelligently joined page content forming chapter text
- **Proper Capitalization**: Automatic capitalization after page number removal
- **Content Validation**: Pages and chapter content have valid structure
- **Word Counts**: Accurate word count for each page
- **Figure-Only Pages**: Include placeholders to keep page numbering contiguous

### Quality Standards
- Page content is clean without page number, header, and footer artifacts
- Chapter-level concatenated content flows naturally
- Proper capitalization after page number removal
- Page number sequences are valid and continuous, including placeholders for figure-only pages
- Word counts are accurate for all pages

## Implementation

### Technical Approach

The step uses page boundary detection, content cleaning, and intelligent chapter-level concatenation:

#### 1. Page Boundary Detection and Extraction
- Identifies page breaks using page markers (`--- PAGE X ---` and `--- END PAGE X ---`)
- Extracts page-specific content with proper boundaries
- Maintains accurate page numbering throughout
- Detects figure-only pages (pages with no text content after cleaning)

#### 2. Page Content Cleaning
- **Page Number Removal**: Removes page numbers from headers and footers
- **Header/Footer Removal**: Removes running headers (e.g., book title, author name)
- **Automatic Capitalization**: Capitalizes first letter after page number removal
- **Spaced Number Handling**: Detects and removes spaced page numbers (e.g., "1 1" for 11)

#### 3. Chapter-Level Content Concatenation
- **Cross-Page Merging: DISABLED**: Individual page merging logic is currently disabled
- **Intelligent Joining**: When creating chapter-level content, joins pages intelligently:
  - Continues sentences when previous segment doesn't end with terminator and next starts lowercase
  - Starts new paragraphs otherwise
  - Removes standalone page number artifacts from concatenated text
- **Clean Content Flow**: Produces readable chapter-level text without page marker artifacts

#### 4. Content Quality Assurance
- Validates page extraction completeness
- Ensures figure-only pages are properly marked
- Verifies page sequences are continuous
- Maintains word count accuracy

### Processing Steps

```javascript
1. For each chapter:
   - Extract pages using page markers (--- PAGE X ---, --- END PAGE X ---)
   - Clean each page: remove page numbers, headers, footers
   - Detect figure-only pages (empty after cleaning)
   - Calculate word counts for each page
   
2. Create chapter-level concatenated content:
   - Remove page numbers from each page segment
   - Join pages intelligently:
     * If previous doesn't end with terminator and next starts lowercase → continue sentence
     * Otherwise → start new paragraph
   - Remove standalone page number artifacts from final text
   
3. Content validation:
   - Verify page structure is complete
   - Ensure page sequences are continuous
   - Validate word counts are accurate
```

### Key Features

- **Page-Based Extraction**: Extracts individual pages from chapter content using page markers
- **Comprehensive Cleaning**: Removes page numbers, headers, and footers from page content
- **Figure-Only Page Detection**: Identifies and marks pages with only images/figures
- **Automatic Capitalization**: Fixes capitalization after page number removal
- **Smart Chapter Concatenation**: Creates readable chapter-level text by intelligently joining pages
- **Page Number Artifact Removal**: Cleans up standalone page numbers in concatenated text
- **Cross-Page Merging: DISABLED**: Individual page cross-page merging is currently disabled

## Validation

### Validation Rules

The validation module (`03-page-extraction-and-cross-page-merging-validation.js`) implements:

#### 1. Page/Segment Structure Validation
- **Rule**: If pages are retained, each chapter must have a `pages[]` array with page objects; if not, ensure continuity markers across former page breaks are honored
- **Purpose**: Ensure extraction is complete

#### 2. Content Validation
- **Rule**: Each page/segment must have valid word count; text segments should have non-empty content
- **Figure-Only Pages**: If pages exist, image-only pages are accepted with `isFigureOnly: true`
- **Purpose**: Verify complete extraction with proper metadata

#### 3. Sentence Terminator Validation
- **Rule**: Segments should end with sentence terminators (., !, ?)
- **Exceptions**: headers/titles, bullet list endings, last content segment; ignore trailing numeric citations/closing quotes
- **Special Case**: Appendix chapters have relaxed validation
- **Purpose**: Ensure proper sentence boundaries and completeness

#### 4. Sequence Validation (if pages retained)
- **Rule**: Page numbers must be sequential and within expected ranges
- **Purpose**: Verify extraction accuracy and completeness

#### 5. Content Volume Validation
- **Rule**: Ensure substantial document processing (e.g., ≥ 10 pages when pages are present)
- **Purpose**: Guard against trivial outputs

### Helper Functions

#### `endsWithSentenceTerminator(content)`
Validates that content ends with proper sentence punctuation:
- Checks for sentence terminators: `.`, `!`, `?`
- Ignores trailing closing quotes, numeric citations (e.g., `. 24`), and author attributions (e.g., `—Name, Location`)
- Used for page content quality validation

#### `isSentenceTerminator(char)`
Identifies valid sentence termination characters:
- Returns true for period, exclamation mark, question mark
- Used by sentence terminator validation logic

### Validation Success Criteria

- ✅ All chapters have proper page structure
- ✅ Pages contain valid content with proper metadata (or are marked as figure-only)
- ✅ Page sequences are complete and accurate (including figure-only placeholders)
- ✅ Word counts are accurate
- ✅ Chapter-level concatenated content flows naturally

## Usage

### Basic Usage
```javascript
const pageExtraction = require('./03-page-extraction-and-cross-page-merging');

const result = await pageExtraction.execute(pipelineState, config);
const isValid = pageExtraction.validate(result);
```

### Expected Input Structure
```javascript
{
    chapters: [
        {
            title: "Introduction",
            chapterNumber: 1,
            content: "Chapter content with page breaks...",
            wordCount: 2450
        }
        // ... more chapters
    ]
}
```

### Expected Output Structure
```javascript
{
    chapters: [
        {
            title: "Introduction",
            chapterNumber: 0,
            pageNumberStart: 15,
            pageNumberEnd: 42,
            pages: [
                {
                    pageNumber: 15,
                    content: "This is the cleaned content of page 15.",
                    rawContent: "15\nThis is the cleaned content of page 15.", // For debugging
                    wordCount: 245,
                    isFigureOnly: false
                },
                {
                    pageNumber: 16, 
                    content: "This is page 16 content.",
                    rawContent: "16\nThis is page 16 content.",
                    wordCount: 267,
                    isFigureOnly: false
                },
                {
                    pageNumber: 17,
                    content: "",
                    rawContent: "[Image: Figure 2.3]",
                    wordCount: 0,
                    isFigureOnly: true
                }
            ],
            content: "This is the cleaned content of page 15.\n\nThis is page 16 content.", // Concatenated chapter content
            sentencesMerged: 0 // Cross-page merging is disabled
        }
        // ... more chapters
    ],
    metadata: {
        pageExtractionAndCrossPageMerging: {
            totalPages: 297,
            totalChapters: 15,
            averageWordsPerPage: 245,
            sentencesMerged: 0,
            processingTime: 1250
        }
    }
}
```

## Dependencies

- **Node.js built-ins**: No external dependencies required
- Uses standard JavaScript string manipulation and regex patterns

## Page Cleaning Strategy

### Page Number Removal
- **Pattern Detection**: Identifies page numbers in headers and footers
- **Spaced Number Handling**: Detects "1 1" format (should be "11")
- **Context-Aware Removal**: Only removes numbers matching expected page positions
- **Automatic Capitalization**: Fixes text capitalization after number removal

### Header and Footer Removal
- **Running Headers**: Removes repeated book titles and author names
- **Position-Based Detection**: Checks first/last 3 lines of each page
- **Conservative Approach**: Only removes clear header/footer patterns

### Chapter-Level Concatenation
- **Intelligent Joining**: Analyzes sentence terminators and capitalization
  - Previous ends mid-sentence + next starts lowercase → continue sentence
  - Otherwise → start new paragraph
- **Artifact Removal**: Cleans up standalone page numbers in joined text
- **Clean Flow**: Produces readable text without page marker disruptions

## Debug Output

The step generates comprehensive debug information:
- Page extraction boundaries and statistics
- Individual page content with raw content for comparison
- Figure-only page detection results
- Word count calculations per page
- Processing timing and performance metrics

## Error Handling

- **Page Boundary Detection**: Robust handling of various page break formats
- **Content Validation**: Aggregates and reports all validation errors across all chapters/pages (does not stop at first error)
- **Cross-Page Merging**: Safe merging that preserves content integrity
- **Exception Cases**: Proper handling of appendices and special content

## Quality Assurance

### Content Integrity
- Ensures page cleaning doesn't damage content
- Validates page extraction preserves all content
- Confirms chapter-level concatenation is readable

### Processing Accuracy
- Verifies page numbers are accurate and sequential
- Ensures word counts are calculated correctly
- Validates content quality meets standards

## Performance Considerations

- **Efficient Page Processing**: Optimized algorithms for large documents
- **Memory Management**: Processes pages incrementally to manage memory usage
- **Scalable Architecture**: Handles books with hundreds of pages efficiently

## Advanced Features

### Header Detection and Preservation
- Identifies potential headers at page boundaries
- Preserves header structure during cross-page operations
- Prevents incorrect merging of headers with content

### Appendix Handling
- Special validation rules for appendix chapters
- Relaxed sentence terminator requirements
- Appropriate handling of reference material formatting 