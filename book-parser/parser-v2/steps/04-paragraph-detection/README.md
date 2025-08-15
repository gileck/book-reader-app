# Step 4: Paragraph Detection

## Overview

This step detects both paragraph boundaries and headers in the page content, creating a unified chunk structure. It implements advanced paragraph optimization with two-pass merging and strict header detection using a 6-rule validation system.

## Requirements

### Input Requirements
- **Pipeline State**: Must include `chapters` with content from Step 3 and `links` from Step 3.1
- **Content**: Clean chapter content with proper sentence boundaries; may contain `[[IMG ...]]` markers
- **Link Information**: Links with chapter-local selectors to associate with paragraph content

### Output Requirements
- **Unified Chunks**: Single output format with paragraphs, headers, and images
- **Chunk Types**: Each chunk must be classified as "paragraph", "header", or "image"
- **Image Handling**: Convert each `[[IMG ...]]` marker into an `image` chunk at that position; image chunks are excluded from word/sentence validations; downstream set `paragraphIndex: null`
- **Content Quality**: Paragraphs 80-300 words (target, flexible 20-500 absolute); headers 1-5 words (standard), 2–12 words (numbered headers), up to 20 words for ALL-CAPS blocks
- **Link Integration**: Links mapped using chapter-local selectors to enclosing text chunk(s)
- **Content Standards**: All text chunks start with capital letters or valid punctuation

### Quality Standards
- Minimum 5 chunks total across all chapters
- Paragraph and header chunk types must be present; image chunks present when markers exist
- Paragraphs: 80-300 words target (flexible 20-500 absolute) with proper sentence structure
- Headers: 1-5 words (standard), 2–12 words (numbered), up to 20 words (ALL-CAPS blocks); standalone lines, proper capitalization
- Links accurately associated with chunk content

## Implementation

### Technical Approach

The step uses **advanced paragraph optimization** with intelligent header detection:

#### 1. 6-Rule Header Detection System (with Numbered and ALL-CAPS support)
All rules must be satisfied for header classification:

1. **Length**: 2-5 words only (Numbered headers allow 2–12 words)
2. **No Punctuation**: Does not end with sentence punctuation (., !, ?)
3. **Capitalization**: Starts with a capital letter
4. **Line Structure**: Appears as standalone line
5. **Context - Previous**: Previous line ends with sentence-ending punctuation
6. **Context - Next**: Next line starts with a capital letter (or starts a list: bullet "•" or numbered "1. ")

ALL-CAPS headers are supported:
- Blocks such as:
  - "BREATHE LIGHT, SLOW, AND DEEP—THE EXERCISES"
  - "SECTION TWO: EXERCISES TO STOP SYMPTOMS OF\nASTHMA, ANXIETY, STRESS, RACING MIND, AND PANIC\nDISORDER"
- Criteria: multi-line allowed, mostly-uppercase letters (≈90%+), allowed punctuation (, – — :), no terminal sentence punctuation.

Numbered headers are supported:
- Patterns like `#11. Breath Hold Activation`, `#13. Breathing Recovery, Walking`, `#16. Three Exercises to Help Stop a Panic Attack`
- Optional `#`, number + `.` or `)`, followed by 2–12 mostly-capitalized words, no terminal punctuation

#### 2. Advanced Paragraph Optimization
- **Two-Pass Merging System**: Handles existing and newly created small paragraphs
- **Intelligent Neighbor Selection**: Prefers merging with previous paragraph, falls back to next
- **Boundary Respect**: Prevents merging across headers and page boundaries; images are ignored as boundaries so adjacent paragraphs can merge across images
- **Link Re-validation**: Re-validates links during merging operations

#### 3. Enhanced Link Integration
- **Strict Footnote Validation**: Uses precise footnote pattern matching
- **Link Association**: Associates links with chunks where they appear
- **Validation During Merging**: Re-validates links when paragraphs are combined

### Processing Steps

```javascript
1. Initial chunk detection:
   - Split content into potential chunks
   - Apply 6-rule header detection
   - Detect `[[IMG ...]]` markers and create image chunks at those positions
   - Create initial paragraph, header, and image chunks

2. First-pass optimization:
   - Identify small paragraphs (< 20 words)
   - Attempt merging with neighboring paragraphs
   - Respect header boundaries and page constraints

3. Large paragraph splitting:
   - Split paragraphs exceeding 300 words
   - Create new chunks with proper boundaries
   - Maintain content integrity during splitting

4. Second-pass optimization:
   - Process small paragraphs created during splitting
   - Apply same merging logic as first pass
   - Ensure all paragraphs meet size requirements

5. Link integration:
   - Associate links with text chunks overlapping the selector ranges
   - Use strict footnote pattern matching
   - Re-validate links after paragraph merging
```

### Key Features

- **6-Rule Header Detection**: Comprehensive validation system for accurate header identification
- **Two-Pass Optimization**: Eliminates all small paragraph validation errors
- **Enhanced Link Validation**: Strict footnote patterns prevent false matches
- **Smart Cross-Page Logic**: Preserves content structure across page boundaries
- **Production-Quality Output**: Zero validation errors with comprehensive optimization

## Validation

### Validation Rules

The validation module (`04-paragraph-detection-validation.js`) implements:

#### 1. Chunk Count Validation
- **Rule**: Must have more than 5 chunks total
- **Purpose**: Ensure sufficient content structure for meaningful processing

#### 2. Chunk Type Validation
- **Rule**: Must contain both "paragraph" and "header" chunk types
- **Purpose**: Verify complete content structure detection

#### 3. Content Format Validation
- **Rule**: All chunks must start with capital letters or valid punctuation/symbols
- **Headers**: Must start with capital letters
- **Paragraphs**: Can start with capitals, numbers, quotes, math symbols, etc.
- **Purpose**: Ensure proper paragraph formatting standards

#### 4. Word Count Validation
- **Paragraphs**: 20-300 words for proper book content
- **Headers**: 1-5 words for concise section titles
- **Special Handling**: Provides neighbor information for small paragraph debugging
- **Purpose**: Ensure content chunks are appropriately sized

#### 5. Link Text Validation
- **Rule**: All link text must be present in associated chunk content
- **Footnote Validation**: Uses strict footnote pattern matching
- **Purpose**: Ensure accurate link-content associations

#### 6. Content Quality Validation
- **Rule**: Paragraphs should not end with initials (unless common patterns)
- **Exception**: Allows common single-letter endings (vitamin E, point A, etc.)
- **Purpose**: Detect and prevent improper paragraph boundaries

### Helper Functions

#### `countWords(text)`
Accurate word counting using whitespace splitting:
- Handles various whitespace types
- Filters empty strings for accurate counts
- Used throughout validation for size checking

#### `findPreviousParagraph(chunks, currentIndex)` / `findNextParagraph(chunks, currentIndex)`
Navigation functions for paragraph optimization:
- Skip headers to find actual paragraph neighbors
- Used in merging logic and validation debugging
- Provide context for small paragraph analysis

#### `isSourceTextInContent(sourceText, content)`
Enhanced link text validation:
- **Footnote Numbers**: Uses strict footnote pattern matching
- **Non-numeric Text**: Uses direct string matching
- Prevents false footnote matches (e.g., "1948" containing "8")

#### `isFootnoteInContent(footnoteNumber, content)`
Strict footnote pattern matching:
- **Patterns**: `. 8 For`, `9 Mitchell`, `(8)`, `[8]`, `8.`
- **Anti-patterns**: Prevents matching within larger numbers
- **Precision**: Ensures production-quality link associations

### Validation Success Criteria

- ✅ Sufficient chunk count with both types present
- ✅ Proper word count ranges for all chunk types
- ✅ Correct content formatting and capitalization
- ✅ Accurate link-content associations
- ✅ Zero small paragraph validation errors
- ✅ Production-ready content structure

## Usage

### Basic Usage
```javascript
const paragraphDetection = require('./04-paragraph-detection');

const result = await paragraphDetection.execute(pipelineState, config);
const isValid = paragraphDetection.validate(result);
```

### Expected Input Structure
```javascript
{
  chapters: [
    {
      title: "Introduction",
      content: "Paragraphs...\n\n[[IMG id=image-001 index=12 alt=\"Figure 1\"]]\n\nMore content..."
    }
  ],
  links: [
    {
      linkId: "link_001",
      role: "source",
      text: "1",
      anchor: { chapterId: 0, selector: { start: 1205, end: 1206 } }
    }
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
      chunks: [
        {
          chunkId: "chunk_001",
          type: "paragraph",
          content: "This is a paragraph with substantial content that meets the word count requirements...",
          wordCount: 45,
          links: [
            {
              linkId: "link_001",
              text: "1",
              anchor: { chapterId: 0, selector: { start: 1205, end: 1206 } }
            }
          ]
        },
        {
          chunkId: "chunk_002", 
          type: "header",
          content: "Section Header",
          wordCount: 2,
          links: []
        },
        {
          chunkId: "chunk_003",
          type: "image",
          content: "Figure 1",
          imageId: "image-001",
          imageAlt: "Figure 1"
        }
      ]
    }
  ]
}
```

## Dependencies

- **Node.js built-ins**: No external dependencies for core functionality
- Uses validation module for helper functions and validation logic

## Advanced Features

### Two-Pass Optimization System
1. **First Pass**: Handles existing small paragraphs with neighbor merging
2. **Large Paragraph Splitting**: Creates new chunks from oversized paragraphs  
3. **Second Pass**: Processes small paragraphs created during splitting
4. **Result**: Zero small paragraph validation errors

### Enhanced Link Validation
- **Strict Footnote Patterns**: Prevents false matches in production
- **Merge-Time Re-validation**: Links validated when paragraphs are combined
- **Production Quality**: All link-paragraph associations are verified

### Header Detection Mastery
- **6-Rule System**: Comprehensive validation prevents false header detection
- **Context Analysis**: Uses surrounding content for accurate classification
- **Edge Case Handling**: Properly handles cross-page headers and special formatting

## Debug Output

The step generates comprehensive debug information:
- Paragraph optimization decisions and neighbor analysis
- Header detection rule evaluation results
- Link association and validation details
- Two-pass optimization statistics and results

## Error Handling

- **Chunk Creation Failures**: Robust error handling for content parsing issues
- **Link Association Errors**: Safe handling of invalid link-content associations
- **Optimization Failures**: Graceful handling when merging cannot resolve size issues
- **Validation Errors**: Detailed error reporting with neighbor context for debugging

## Quality Assurance

### Content Structure Integrity
- Ensures unified output format maintains content relationships
- Validates header-paragraph boundaries are properly detected
- Confirms optimization doesn't damage content structure

### Production Readiness
- **Zero Small Paragraphs**: Advanced optimization eliminates all size validation errors
- **Enhanced Link Quality**: Strict footnote validation ensures production-quality associations
- **Complete Validation**: Comprehensive checks ensure output meets all requirements

## Performance Considerations

- **Efficient Processing**: Optimized algorithms for large documents with many chunks
- **Memory Management**: Processes chunks incrementally to manage memory usage
- **Scalable Architecture**: Handles books with thousands of paragraphs efficiently

### Processing Intelligence
```javascript
Examples of intelligent processing:
✅ Small paragraph + neighbor → merged paragraph (20+ words)
✅ "Pulling hydrogen" → correctly detected as header
✅ Footnote "8" in content → accurate link association
❌ "1948" containing "8" → not matched as footnote
``` 