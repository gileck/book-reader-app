# Step 4: Sentence Detection, Combination, and Paragraph Separation

## Overview

This step detects paragraph boundaries, splits them into individual sentences, combines short sentences to meet minimum word requirements, and creates paragraph separator chunks. It implements advanced paragraph boundary detection and creates a unified chunk structure with optimized text chunks, headers, and paragraph separators.

## Requirements

### Input Requirements
- **Pipeline State**: Must include `chapters` with pages from Step 3 and `links` from Step 3.1
- **Page Content**: Clean page content with proper sentence boundaries
- **Link Information**: Links to associate with sentence content

### Output Requirements
- **Unified Chunks**: Single output format with text chunks, headers, and paragraph separators
- **Chunk Types**: Each chunk must be classified as "text" (combined sentences), "header", or "paragraphSeparator"
- **Content Quality**: Text chunks 50-200 words with proper sentence structure, headers 1-5 words
- **Link Integration**: Links properly assigned to text chunks where they appear
- **Content Standards**: All text chunks start with capital letters or valid punctuation

### Quality Standards
- Minimum 5 chunks total across all chapters
- All three chunk types must be present (text, header, paragraphSeparator)
- Text chunks: 50-200 words containing combined sentences with proper structure
- Headers: 1-5 words, standalone lines, proper capitalization
- Paragraph Separators: Empty content, mark boundaries between paragraphs
- Links accurately associated with text chunk content

## Implementation

### Technical Approach

The step uses **sentence-based chunking with optimization** and intelligent paragraph boundary detection:

#### 1. 6-Rule Header Detection System
All rules must be satisfied for header classification:

1. **Length**: 2-5 words only
2. **No Punctuation**: Does not end with sentence punctuation (., !, ?)
3. **Capitalization**: Starts with a capital letter
4. **Line Structure**: Appears as standalone line
5. **Context - Previous**: Previous line ends with sentence-ending punctuation
6. **Context - Next**: Next line starts with a capital letter

#### 2. Paragraph Boundary Detection
- **Line-by-Line Analysis**: Processes content line by line to identify paragraph boundaries
- **Sentence Terminator Detection**: Identifies genuine paragraph breaks vs. sentence breaks
- **Header Boundary Respect**: Ensures paragraphs end before headers and start after them
- **Empty Line Analysis**: Uses empty lines as indicators of paragraph boundaries

#### 3. Sentence Splitting and Link Distribution
- **Enhanced Sentence Splitting**: Handles footnotes, abbreviations, and initials properly
- **Link Association**: Associates links with specific sentences where they appear
- **Footnote Handling**: Preserves footnotes within their containing sentences

#### 4. Sentence Combination and Optimization
- **Minimum Word Count**: Combines sentences to ensure text chunks have at least 50 words
- **Maximum Word Count**: Limits combined chunks to 200 words for optimal processing
- **Boundary Respect**: Never merges across paragraph separators to preserve structure
- **Link Re-validation**: Re-validates links after combining sentences

### Processing Steps

```javascript
1. Paragraph boundary detection:
   - Identify paragraph boundaries using existing logic
   - Apply 6-rule header detection
   - Respect empty lines and sentence terminators

2. Sentence extraction:
   - Split each paragraph into individual sentences
   - Handle footnotes and abbreviations properly
   - Preserve sentence-ending punctuation

3. Chunk creation:
   - Create sentence chunks (type: 'text') for each sentence
   - Create header chunks (type: 'header') for headers
   - Insert paragraph separator chunks (type: 'paragraphSeparator') between paragraphs

4. Sentence combination:
   - Identify text chunks with less than 50 words
   - Combine with adjacent sentences within same paragraph
   - Respect paragraph separators and page boundaries
   - Ensure combined chunks don't exceed 200 words

5. Link distribution:
   - Associate links with text chunks containing link text
   - Use strict footnote pattern matching
   - Re-validate links after sentence combination
```

### Key Features

- **6-Rule Header Detection**: Comprehensive validation system for accurate header identification
- **Optimized Text Chunks**: Combines sentences to create 50-200 word chunks for optimal processing
- **Paragraph Separation**: Clear markers between paragraphs for document structure
- **Enhanced Link Validation**: Strict footnote patterns prevent false matches
- **Smart Sentence Splitting**: Handles footnotes, abbreviations, and initials correctly
- **Intelligent Combination**: Respects paragraph boundaries while optimizing chunk sizes

## Validation

### Validation Rules

The validation module (`04-paragraph-detection-validation.js`) implements:

#### 1. Chunk Count Validation
- **Rule**: Must have more than 5 chunks total
- **Purpose**: Ensure sufficient content structure for meaningful processing

#### 2. Chunk Type Validation
- **Rule**: Must contain "text", "header", and "paragraphSeparator" chunk types
- **Purpose**: Verify complete content structure detection

#### 3. Content Format Validation
- **Rule**: All chunks must start with capital letters or valid punctuation/symbols
- **Sentences**: Must start with capitals, numbers, quotes, math symbols, etc.
- **Headers**: Must start with capital letters
- **Separators**: Empty content allowed
- **Purpose**: Ensure proper sentence formatting standards

#### 4. Word Count Validation
- **Text Chunks**: 50-200 words for optimal processing efficiency
- **Headers**: 1-5 words for concise section titles
- **Separators**: 0 words (empty content)
- **Purpose**: Ensure content chunks are appropriately sized for downstream processing

#### 5. Link Text Validation
- **Rule**: All link text must be present in associated text chunk content
- **Footnote Validation**: Uses strict footnote pattern matching
- **Purpose**: Ensure accurate link-text chunk associations

#### 6. Text Quality Validation
- **Rule**: Text chunks should end with proper sentence terminators
- **Exception**: Allows chunks with footnotes and special punctuation
- **Purpose**: Detect and prevent improper text chunk boundaries

#### 7. Content Cleanliness Validation
- **Rule**: Text chunk content must not contain newline characters (\n)
- **Purpose**: Ensure text chunks are clean, single-line text without internal formatting
- **Implementation**: Text content is cleaned during processing to remove newlines and normalize whitespace

### Helper Functions

#### `splitIntoSentences(text)`
Enhanced sentence splitting with footnote handling:
- Handles footnotes, abbreviations, and initials properly
- Preserves sentence-ending punctuation
- Uses advanced tokenization for accurate sentence boundaries

#### `createSentenceChunks(paragraphContent, page, baseChunkId)`
Creates individual sentence chunks from paragraph content:
- Splits paragraph into sentences
- Distributes links to appropriate sentences
- Creates proper chunk structure for each sentence

#### `combineSmallSentenceChunks(chunks)`
Combines small text chunks to meet minimum word requirements:
- Identifies text chunks with less than 50 words
- Merges with adjacent text chunks within same paragraph
- Respects paragraph separators and page boundaries
- Re-validates links after combination

#### `createParagraphSeparatorChunk(page, chunkId)`
Creates paragraph separator chunks:
- Empty content to mark paragraph boundaries
- Maintains page and structural information
- Provides clear document structure markers

#### `isSourceTextInContent(sourceText, content)`
Enhanced link text validation:
- **Footnote Numbers**: Uses strict footnote pattern matching
- **Non-numeric Text**: Uses direct string matching
- Prevents false footnote matches (e.g., "1948" containing "8")

### Validation Success Criteria

- ✅ Sufficient chunk count with all types present
- ✅ Proper text chunk structure with 50-200 word limits
- ✅ Correct content formatting and capitalization
- ✅ Accurate link-text chunk associations
- ✅ Clear paragraph separation markers
- ✅ Clean text content without newlines or formatting artifacts
- ✅ Production-ready optimized chunk structure

## Usage

### Basic Usage
```javascript
const textChunkOptimization = require('./04-paragraph-detection');

const result = await textChunkOptimization.execute(pipelineState, config);
const isValid = textChunkOptimization.validate(result);
```

### Expected Input Structure
```javascript
{
    chapters: [
        {
            title: "Introduction",
            pages: [
                {
                    pageNumber: 15,
                    content: "This is the first sentence. This is the second sentence.\n\nHeader Text\n\nThis is another paragraph.",
                    wordCount: 245
                }
            ]
        }
    ],
    links: [
        {
            linkId: "link_001",
            role: "source", 
            text: "1",
            pageNumber: 15
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
                    type: "text",
                    content: "This is the first sentence. This is the second sentence with more content to meet the minimum word count requirement for text chunks in the optimized parsing system.",
                    pageNumber: 15,
                    wordCount: 52,
                    sentenceCount: 2,
                    links: [
                        {
                            linkId: "link_001",
                            text: "1", 
                            targetPageNumber: 156
                        }
                    ]
                },
                {
                    chunkId: "chunk_002",
                    type: "paragraphSeparator",
                    content: "",
                    pageNumber: 15,
                    wordCount: 0,
                    sentenceCount: 0,
                    links: []
                },
                {
                    chunkId: "chunk_003", 
                    type: "header",
                    content: "Header Text",
                    pageNumber: 15,
                    wordCount: 2,
                    sentenceCount: 1,
                    links: []
                },
                {
                    chunkId: "chunk_004",
                    type: "text",
                    content: "This is another paragraph with sufficient content to meet the minimum word count requirements. It contains multiple sentences that have been combined to create a properly sized text chunk for optimal processing efficiency.",
                    pageNumber: 15,
                    wordCount: 65,
                    sentenceCount: 2,
                    links: []
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

### Enhanced Sentence Splitting
1. **Footnote Preservation**: Footnotes remain with their containing sentences
2. **Abbreviation Handling**: Common abbreviations don't cause sentence splits
3. **Initial Detection**: Proper handling of names and initials
4. **Result**: Accurate sentence boundaries for all content types

### Paragraph Structure Preservation
- **Clear Boundaries**: Paragraph separators maintain document structure
- **Header Integration**: Headers properly integrated with sentence flow
- **Link Distribution**: Links accurately distributed to containing sentences
- **Production Quality**: All sentence-paragraph relationships are preserved

### Advanced Link Association
- **Sentence-Level Precision**: Links associated with specific sentences
- **Footnote Accuracy**: Strict footnote patterns ensure correct associations
- **Multi-Sentence Handling**: Links correctly handled across sentence boundaries

## Debug Output

The step generates comprehensive debug information:
- Sentence boundary detection decisions
- Paragraph separation placement
- Header detection rule evaluation results  
- Link-sentence association details
- Processing statistics for sentences, headers, and separators

## Error Handling

- **Sentence Creation Failures**: Robust error handling for content parsing issues
- **Link Association Errors**: Safe handling of invalid link-sentence associations
- **Boundary Detection Failures**: Graceful handling when paragraph boundaries are unclear
- **Validation Errors**: Detailed error reporting with context for debugging

## Quality Assurance

### Content Structure Integrity
- Ensures sentence-level granularity maintains content relationships
- Validates paragraph boundaries are properly marked with separators
- Confirms header-sentence boundaries are correctly detected

### Production Readiness
- **Atomic Sentence Units**: Each sentence is an independent, complete unit
- **Enhanced Link Quality**: Strict footnote validation ensures production-quality associations
- **Complete Structure**: Comprehensive sentence, header, and separator detection

## Performance Considerations

- **Efficient Processing**: Optimized algorithms for large documents with many sentences
- **Memory Management**: Processes sentences incrementally to manage memory usage
- **Scalable Architecture**: Handles books with thousands of sentences efficiently

### Processing Intelligence
```javascript
Examples of intelligent processing:
✅ Short sentences → Combined into 50+ word text chunks
✅ "Dr. Smith said..." → Proper abbreviation handling during sentence splitting
✅ "End of paragraph.\n\nNew paragraph..." → Paragraph separator preserved
✅ Footnote "8" in text → Associated with correct combined text chunk
✅ Sentence combination → Respects paragraph boundaries, never merges across separators
❌ "1948" containing "8" → Not matched as footnote
``` 