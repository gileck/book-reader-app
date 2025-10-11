# Step 5: Sentence Detection (Phase 1: Sentence-Level Output)

## Overview

Step 5 converts paragraph chunks from Step 4 into individual sentences with paragraph indexing. In Phase 1, we keep sentence-level chunks and only merge ultra‑short sentences (< 10 words) backward within the same paragraph to avoid tiny fragments.

## Requirements

### Input
- Takes processed chapters from Step 4 with chunks (types: 'paragraph', 'header')
- Each paragraph chunk contains multiple sentences and may contain `[[IMG ...]]` markers
- Headers are preserved as-is

### Output
- Array of chapters with sentence chunks (type: 'text') and preserved headers
- Each text chunk has `paragraphIndex` field indicating which paragraph it belongs to
- Headers have `paragraphIndex: null`
- Image markers preserved in text content for Step 5-1 processing
- Optional backward merge for ultra‑short sentences (< 10 words) within the same paragraph

## Technical Approach

### 1. Paragraph to Sentence Conversion
- Split each paragraph chunk into individual sentences
- Add sequential `paragraphIndex` (1, 2, 3, etc.) to sentences from each paragraph
- Clean sentence content (remove newlines, normalize whitespace)
- Extract links that exist within each sentence

### 2. Minimal Combination (Phase 1)
- Only merge ultra‑short sentences (< 10 words) backward within same paragraph
- No forward or cross‑paragraph merging
- Preserve sentence count and link associations

### 3. Paragraph Boundary Preservation
- `paragraphIndex` ensures sentences can be grouped back into paragraphs
- Headers have `paragraphIndex: null` (don't belong to paragraphs)
- Image markers are preserved in text content for Step 5-1 processing
- Combination logic respects paragraph boundaries

## Processing Steps

1. **Iterate through chapters** from Step 4 output
2. **For each paragraph chunk:**
   - Increment paragraph index
   - Split paragraph content into sentences
   - Create sentence chunks with `paragraphIndex`
   - Clean and validate sentence content
   - Extract relevant links for each sentence
3. **For headers:** Preserve as-is with `paragraphIndex: null`
4. **Minimal combination:**
   - Merge ultra‑short sentences (< 10 words) backward within same paragraph
   - No forward or cross‑paragraph merges
5. **Assign sequential chunk IDs** after optimization
6. **Generate statistics** and return processed chapters

## Key Features

### Paragraph Index System
- Sequential numbering: 1, 2, 3, etc.
- All sentences from first paragraph get `paragraphIndex: 1`
- All sentences from second paragraph get `paragraphIndex: 2`
- Enables easy paragraph reconstruction during rendering

### Sentence Combination Logic (Phase 1)
- **Target**: Sentence-level chunks (no 50–200 global target)
- **Boundary Respect**: Never combine across different `paragraphIndex`
- **Backward Merge Only**: Ultra‑short sentences < 10 words
- **Link Preservation**: Re-validate links after combination

### Content Cleanliness
- Remove newline characters from sentence content
- Normalize whitespace (multiple spaces → single space)
- Preserve sentence terminators and punctuation

## Validation

### Sentence Chunk Requirements
- **Type**: Must be 'text'
- **Content**: Clean text, no newlines, starts with capital letter or valid symbol
- **Word Count**: ≥ 1 word (no strict min/max in Phase 1)
- **Sentence Count**: ≥1
- **Paragraph Index**: Positive integer (1, 2, 3, etc.)
- **Links**: All link text must exist in chunk content

### Header/Image Requirements  
- **Headers**: 1-5 words, `paragraphIndex: null`
- **Images**: 0 words, `paragraphIndex: null`, required image fields

### Paragraph Index Validation
- Sequential numbering starting from 1
- No gaps in sequence
- At least one paragraph must exist

## Helper Functions

### Core Processing
- `convertParagraphsToSentences()` - Main conversion logic
- `createSentenceChunks()` - Split paragraph into sentences with indexing
- `combineSmallSentences()` - Optimize sentence sizes within boundaries

### Sentence Combination
- `tryMergeWithNextSentences()` - Merge with following sentences (same paragraph)
- `tryMergeWithPreviousSentence()` - Merge with previous sentence (same paragraph)
- `splitIntoSentences()` - Reliable sentence boundary detection

### Utilities
- `extractLinksFromContent()` - Find relevant links
- `removeDuplicateLinks()` - Deduplicate link arrays
- `generateChunkStats()` - Generate processing statistics

## Validation Success Criteria

✅ **All chunks have valid types** (text, header, image)  
✅ **Text chunks meet word count requirements** (50-200 words)  
✅ **Paragraph indexes are sequential** starting from 1  
✅ **Headers and images have null paragraph index**  
✅ **Content is clean** (no newlines, proper formatting)  
✅ **Links are valid** (all link text found in content)  
✅ **Sentence boundaries preserved** during combination  

## Usage

```javascript
const step5 = require('./05-sentence-detection');

// Input: chapters with paragraph chunks from step 4
const result = step5.execute(pipelineState);

// Output: chapters with sentence chunks + paragraph indexing
const sentenceChunks = result.chapters[0].chunks;
console.log(sentenceChunks[0].paragraphIndex); // 1, 2, 3, etc.
```

## Example Output Structure

```json
{
  "chunkId": "0_1",
  "type": "text", 
  "content": "From space it looks grey and crystalline, obliterating the blue-green colours of the living Earth. It is criss-crossed by irregular patterns and convergent striations.",
  "paragraphIndex": 1,
  "wordCount": 57,
  "sentenceCount": 2,
  "links": []
}
```

## Advanced Features

### Smart Sentence Splitting
- Handles footnotes and abbreviations correctly
- Preserves sentence terminators with sentences
- Avoids creating lowercase fragments

### Link Distribution
- Links extracted from original paragraphs
- Distributed to sentences containing the link text
- Re-validated after sentence combination

### Statistics Generation
- Tracks total sentences, paragraphs, headers, images
- Word count distributions and averages
- Paragraph index coverage validation

## Debug Output

The step generates detailed statistics including:
- Total chunks created and their types
- Paragraph index distribution
- Word count statistics for combined sentences
- Link extraction and validation results

## Error Handling

- **Invalid Input**: Validates input from step 4
- **Malformed Content**: Handles edge cases in sentence splitting
- **Link Validation**: Ensures all links are preserved correctly
- **Boundary Violations**: Prevents invalid cross-paragraph combinations

## Quality Assurance

### Content Integrity
- No content loss during paragraph→sentence conversion
- All links preserved and properly distributed
- Sentence boundaries maintained during combination

### Performance Considerations
- Efficient sentence splitting algorithms
- Optimized link validation for large texts
- Memory-conscious chunk processing

## Processing Intelligence

The step includes sophisticated logic for:
- **Natural sentence boundaries** using regex patterns
- **Academic text handling** (footnotes, abbreviations, citations)
- **Multi-page content** with proper boundary respect
- **Link text matching** with footnote number detection 