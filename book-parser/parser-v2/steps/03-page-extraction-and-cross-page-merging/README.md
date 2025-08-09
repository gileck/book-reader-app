# Step 3: Page Extraction and Cross-Page Merging

## Overview

This step transforms chapter content into a page-based structure and merges sentences that are split across page boundaries. It creates clean page content where sentences broken by page breaks are intelligently reconstructed. The step handles real-world book formatting such as bullet lists near page boundaries (no cross-page list merging), image-only pages, numeric citations, and trailing quotes/attributions.

## Requirements

### Input Requirements
- **Pipeline State**: Must include `chapters` array from Step 2.3 with cleaned content
- **Chapter Content**: Clean chapter content from previous steps
- **Page Information**: Page boundaries and numbering from original text

### Output Requirements
- **Page Structure**: Each chapter divided into individual pages with metadata
- **Complete Sentences**: Sentences split across pages must be merged
- **List Continuation Support**: Bullet list items that continue on the next page must be merged with the preceding list
- **Content Validation**: Pages should end with proper sentence terminators, with documented exceptions
- **Page Numbering**: Accurate page numbers for each page
- **Word Counts**: Accurate word count for each page
- **Figure-Only Pages**: Pages that contain no text (e.g., image-only) are included as placeholders to keep page numbering contiguous

### Quality Standards
- Pages should end with sentence terminators (., !, ?) with exceptions for headers/titles, bullet list endings, and the last content page of the book
- Minimum 10 pages extracted for substantial documents
- Cross-page sentence merging preserves content structure
- Page number sequences are valid and continuous, including placeholders for figure-only pages

## Implementation

### Technical Approach

The step uses intelligent page boundary detection and cross-page sentence merging:

#### 1. Page Boundary Detection
- Identifies page breaks using PDF page markers
- Extracts page-specific content with proper boundaries
- Maintains accurate page numbering throughout

#### 2. Cross-Page Sentence Merging
- **Smart Continuation Detection**: Merges when the previous page ends mid-sentence. Looks ahead up to 400 characters on the next page to find sentence completion.
- **Terminator Without Paragraph Break**: If a page ends with a terminator but has no paragraph break, looks ahead up to 200 characters to confirm continuation.
- **Capital Letter Preservation**: Skips capital letter sentences (likely new sentences)
- **Header Protection**: Preserves standalone header structure at page boundaries
- **List Merging Between Pages: Disabled**: Cross-page list merging is currently disabled to avoid over-merging across section boundaries. Lists remain on their respective pages.
- **Numeric Citations**: During sentence-completion detection and validation, numeric citations immediately following a period (e.g., `. 24 `) are skipped before deciding on sentence completion.
- **Quote Handling**: Trailing closing quotes after sentence terminators are ignored for validation.
- **Author Attributions**: Trailing author attributions (e.g., `—Name, Location`) are tolerated during validation.

#### 3. Content Quality Assurance
- Validates pages end with sentence terminators
- Handles headers and section titles that don't end with punctuation
- Accepts pages ending with a bullet list item as valid
- Accepts the last content page of the book even if it lacks a sentence terminator
- Ensures cross-page merging doesn't damage content structure

### Processing Steps

```javascript
1. For each chapter:
   - Extract page boundaries from content
   - Create individual page objects with metadata
   - Calculate page number ranges and word counts
   
2. Cross-page sentence merging:
   - Identify sentences split across page boundaries
   - Apply smart merging using a two-pass lookahead (400 chars for incomplete sentences, 200 chars for terminator-without-break)
   - Skip numeric citations and trailing quotes when deciding sentence completion
   - Preserve header structure and capital letter sentences
   - List merging across pages is disabled; lists remain on their original pages
   - Maintain proper line breaks and formatting
   
3. Content validation:
   - Verify pages end with sentence terminators
   - Handle exceptions for headers and appendices
   - Ensure page sequences are complete and valid
```

### Key Features

- **Smart Cross-Page Merging**: Robust sentence merging across page boundaries with numeric citation and quote awareness
- **No Cross-Page List Merging**: Lists are not merged across pages to avoid over-merging; list endings remain page-local
- **Figure-Only Page Placeholders**: Keeps page numbering contiguous by including pages that contain only figures/images, marked with `isFigureOnly`
- **Header Preservation**: Detects and preserves potential headers at page boundaries
- **Content Structure Integrity**: Prevents merging across headers and different contexts
- **Exception Handling**: Special handling for appendix chapters, headers, list endings, and last content page
- **Sentence Terminator Validation**: Ensures proper sentence boundaries with realistic exceptions

## Validation

### Validation Rules

The validation module (`03-page-extraction-and-cross-page-merging-validation.js`) implements:

#### 1. Chapter Page Structure Validation
- **Rule**: Each chapter must have pages array with page objects
- **Purpose**: Ensure page extraction was successful

#### 2. Page Content Validation
- **Rule**: Each page must have valid page number and word count. Text pages should have non-empty content.
- **Figure-Only Pages**: Pages with no text content are accepted if they are image-only; they are emitted with `isFigureOnly: true` to preserve numbering.
- **Purpose**: Verify complete page extraction with proper metadata while preserving contiguous page sequences

#### 3. Sentence Terminator Validation
- **Rule**: Pages should end with sentence terminators (., !, ?)
- **Exceptions**:
  - Headers and section titles that don't end with punctuation
  - Pages ending with bullet list items (treated as valid end)
  - The last content page of the book may end without a terminator
  - Trailing numeric citations and closing quotes are ignored when checking the last character
- **Special Case**: Appendix chapters have relaxed validation
- **Purpose**: Ensure proper sentence boundaries and content completeness

#### 4. Page Sequence Validation
- **Rule**: Page numbers must be sequential and within expected ranges
- **Purpose**: Verify page extraction accuracy and completeness

#### 5. Content Volume Validation
- **Rule**: Must extract minimum 10 pages total
- **Purpose**: Ensure substantial document processing

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
- ✅ Pages contain valid content with proper metadata
- ✅ Page sequences are complete and accurate (including figure-only placeholders)
- ✅ Sentence boundaries are properly maintained
- ✅ Cross-page merging preserves content integrity

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
            chapterNumber: 1,
            pages: [
                {
                    pageNumber: 15,
                    content: "This is the content of page 15 with complete sentences.",
                    wordCount: 245
                },
                {
                    pageNumber: 16, 
                    content: "This is page 16 content with cross-page merging applied.",
                    wordCount: 267
                }
            ],
            pageNumberStart: 15,
            pageNumberEnd: 42,
            wordCount: 2450
        }
        // ... more chapters
    ]
}
```

## Dependencies

- **Node.js built-ins**: No external dependencies required
- Uses standard JavaScript string manipulation and regex patterns

## Cross-Page Merging Strategy

### Smart Continuation Detection
- **Lowercase Sentences**: Merges sentences starting with lowercase (continuations)
- **Capital Letter Preservation**: Preserves sentences starting with capitals (new sentences)
- **Header Protection**: Maintains standalone structure for potential headers

### Simplified Bullet List Merging Rules
- **When previous page ends with a bullet**:
  - If the first non-empty next line is not a bullet and the last bullet does not end with a terminator, treat contiguous non-bullet lines as wrapped continuation until reaching a terminator. Then, continue only if the next non-empty line is a bullet; otherwise stop.
  - If the next page starts with bullets, merge contiguous bullet items from the top. For each bullet, include its wrapped lines until a terminator. Stop when the next non-empty line is not a bullet.
- **Stops at explicit breaks**: A blank line ends list merging (EOLs preserved from Step 1).
- **Valid page end**: The last bullet item is a valid page ending; no extra punctuation required.

### Content Structure Preservation
- **Line Break Maintenance**: Preserves proper line structure during merging
- **Header Detection**: Identifies and preserves headers at page boundaries
- **Context Awareness**: Prevents merging across different content types

### Processing Intelligence
```javascript
Examples of smart merging:
✅ "end of page sentence con-" + "tinues on next page" → merged
❌ "End of page." + "Capital sentence" → not merged  
✅ "lowercase continuation" → merged with previous
❌ "Standalone Header" → preserved as header
```

## Debug Output

The step generates comprehensive debug information:
- Page extraction boundaries and statistics
- Cross-page merging decisions and results (including list continuation handling)
- Sentence terminator validation results
- Figure-only page detection
- Processing timing and performance metrics

## Error Handling

- **Page Boundary Detection**: Robust handling of various page break formats
- **Content Validation**: Aggregates and reports all validation errors across all chapters/pages (does not stop at first error)
- **Cross-Page Merging**: Safe merging that preserves content integrity
- **Exception Cases**: Proper handling of appendices and special content

## Quality Assurance

### Content Integrity
- Ensures cross-page merging doesn't damage content structure
- Validates sentence boundaries are properly maintained
- Confirms page extraction preserves all content

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