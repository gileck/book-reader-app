# Step 2.2: Chapter Content Extraction

## Overview

This step extracts the actual content for each chapter identified in Step 2.1. It takes the chapter metadata and raw text to extract clean, chapter-specific content with accurate boundaries and word counting.

## Requirements

### Input Requirements
- **Pipeline State**: Must include `rawText` from Step 1 and `chapterMetadata` from Step 2.1
- **Chapter Metadata**: Array of chapters with position information
- **Raw Text**: Complete document text for content extraction

### Output Requirements
- **Chapter Content**: Each chapter must have extracted text content
- **Content Validation**: Each chapter must have substantial content (≥100 characters)
- **Word Counting**: Accurate word count for each chapter
- **Content Quality**: Clean, readable text without metadata artifacts

### Quality Standards
- Minimum 100 characters per chapter for substantial content
- Minimum 10 words per chapter for meaningful content
- Clean content boundaries between chapters
- Accurate word count metrics for each chapter

## Implementation

### Technical Approach

The step processes each chapter sequentially using position-based text extraction:

#### 1. Content Boundary Calculation
- Uses chapter position metadata from Step 2.1
- Calculates start and end positions in the raw text
- Handles the last chapter (extends to end of document)

#### 2. Text Extraction
- Extracts content between calculated boundaries
- Preserves original text formatting and structure
- Maintains character-level accuracy

#### 3. Content Processing
- Trims whitespace from extracted content
- Calculates accurate word counts
- Validates content quality and length

#### 4. Metadata Generation
- Creates chapter objects with content and metadata
- Preserves original chapter information
- Adds processing statistics

### Processing Steps

```javascript
1. For each chapter in chapterMetadata:
   - Calculate content start position
   - Determine content end position (next chapter start or document end)
   - Extract text content between boundaries
   
2. Process extracted content:
   - Trim unnecessary whitespace
   - Calculate word count using proper word boundary detection
   - Validate content meets minimum requirements
   
3. Create chapter objects:
   - Combine original metadata with extracted content
   - Add word count and content length statistics
   - Preserve chapter numbering and titles
```

### Key Features

- **Position-Based Extraction**: Uses precise text positions for accurate boundaries
- **Flexible Boundary Handling**: Properly handles first, middle, and last chapters
- **Content Quality Assurance**: Validates extracted content meets standards
- **Word Count Accuracy**: Uses robust word counting algorithms
- **Metadata Preservation**: Maintains all original chapter information

## Validation

### Validation Rules

The validation module (`02-2-chapter-content-extraction-validation.js`) implements:

#### 1. Chapter Existence Validation
- **Rule**: Must have at least one chapter with content
- **Purpose**: Ensure extraction process was successful

#### 2. Content Presence Validation
- **Rule**: Each chapter must have non-empty string content
- **Purpose**: Verify successful content extraction for all chapters

#### 3. Content Length Validation
- **Rule**: Each chapter must have at least 100 characters
- **Purpose**: Ensure substantial content was extracted (not just headers/metadata)

#### 4. Word Count Validation
- **Rule**: Each chapter must have at least 10 words with valid word count
- **Purpose**: Verify meaningful content and accurate word counting

### Validation Success Criteria

- ✅ All chapters have extracted content
- ✅ Content length meets minimum requirements (≥100 characters)
- ✅ Word counts are reasonable and accurate (≥10 words)
- ✅ Content is clean and readable

## Usage

### Basic Usage
```javascript
const chapterContentExtraction = require('./02-2-chapter-content-extraction');

const result = await chapterContentExtraction.execute(pipelineState, config);
const isValid = chapterContentExtraction.validate(result);
```

### Expected Input Structure
```javascript
{
    rawText: "Complete document text...",
    chapterMetadata: [
        {
            title: "Introduction",
            chapterNumber: 1,
            position: 12450
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
            content: "This chapter introduces the main concepts...",
            wordCount: 2450,
            startingPage: 15,
            endPage: 42
        },
        {
            title: "The Science of Transformation", 
            chapterNumber: 2,
            content: "In this chapter, we explore the scientific basis...",
            wordCount: 3200,
            startingPage: 43,
            endPage: 78
        }
        // ... more chapters
    ]
}
```

## Dependencies

- **Node.js built-ins**: No external dependencies required
- Uses standard JavaScript string manipulation and regex patterns

## Content Extraction Strategy

### Boundary Detection
- **Start Position**: Uses chapter position from metadata
- **End Position**: Next chapter start or document end
- **Overlap Handling**: Ensures no content gaps or overlaps

### Word Counting Algorithm
- **Pattern**: `/\s+/` split with empty string filtering
- **Accuracy**: Handles various whitespace types
- **Reliability**: Consistent with standard word counting conventions

## Debug Output

The step generates debug information including:
- Content extraction boundaries for each chapter
- Word count calculations and validation results
- Content length statistics
- Processing timing data

## Error Handling

- **Missing Metadata**: Graceful handling of incomplete chapter metadata
- **Content Extraction Failures**: Clear error messages for boundary issues
- **Validation Failures**: Detailed reporting of content quality issues
- **Edge Cases**: Proper handling of single chapters and empty content

## Quality Assurance

### Content Validation
- Ensures extracted content is meaningful and substantial
- Validates word counts are accurate and reasonable
- Confirms content boundaries are clean and complete

### Error Prevention
- Handles edge cases like last chapter boundary detection
- Prevents content overlaps between chapters
- Ensures all chapters receive proper content extraction

## Performance Considerations

- **Memory Efficient**: Processes chapters sequentially to minimize memory usage
- **Fast Extraction**: Uses substring operations for optimal performance
- **Scalable**: Handles large documents with many chapters efficiently 