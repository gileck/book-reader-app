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

The step processes each chapter sequentially using page-based text extraction:

#### 1. Content Boundary Calculation
- Uses chapter `startingPage` from Step 2.1
- Calculates `pageNumberEnd` based on next chapter start or document end
- Handles the last chapter (extends to last page in document)

#### 2. Text Extraction
- Extracts content between page markers (`--- PAGE X ---` and `--- END PAGE Y ---`)
- Preserves original text formatting and structure including page markers
- Maintains character-level accuracy

#### 3. Content Filtering
- Filters out chapters with less than 10,000 characters (likely not real chapters, e.g., preface, acknowledgments)
- **Exception**: Introduction chapters are always included regardless of length
- Ensures only substantial chapters are included

#### 4. Content Processing
- Trims whitespace from extracted content
- Calculates accurate word counts
- Validates content quality and length

#### 5. Metadata Generation
- Creates chapter objects with content and metadata
- Adds page range information (`pageNumberStart`, `pageNumberEnd`)
- Adds processing statistics

### Processing Steps

```javascript
1. Sort chapters by starting page number
2. For each chapter in chapterMetadata:
   - Get pageNumberStart from chapter metadata (startingPage)
   - Calculate pageNumberEnd (next chapter's startingPage - 1, or last page in document)
   - Extract text content between page markers
   
3. Filter chapters:
   - Remove chapters with less than 10,000 characters
   - Exception: Introduction chapters are always kept regardless of length
   - These are typically non-chapter sections (preface, acknowledgments, etc.)
   
4. Process extracted content:
   - Trim unnecessary whitespace
   - Calculate word count using proper word boundary detection
   - Validate content meets minimum requirements
   
5. Create chapter objects:
   - Combine original metadata with extracted content
   - Add page range (pageNumberStart, pageNumberEnd)
   - Add word count and content length statistics
```

### Key Features

- **Page-Based Extraction**: Uses page markers for accurate chapter boundaries
- **Flexible Boundary Handling**: Properly handles first, middle, and last chapters
- **Smart Chapter Filtering**: Removes short chapters (< 10,000 characters) that are likely not real content chapters, with exception for introduction chapters
- **Content Quality Assurance**: Validates extracted content meets standards
- **Word Count Accuracy**: Uses robust word counting algorithms
- **Metadata Preservation**: Maintains all original chapter information and adds page ranges

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
- **Rule**: Each chapter must have at least 100 characters (after 10,000 character pre-filtering)
- **Purpose**: Ensure substantial content was extracted (not just headers/metadata)
- **Note**: The step pre-filters chapters with < 10,000 characters before validation

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
    rawText: "Complete document text with page markers...",
    chapterMetadata: [
        {
            title: "Introduction",
            chapterNumber: 0,
            startingPage: 15,
            endPage: 42
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
            content: "--- PAGE 15 ---\nThis chapter introduces the main concepts...\n--- END PAGE 42 ---",
            wordCount: 2450
        },
        {
            title: "The Science of Transformation", 
            chapterNumber: 1,
            pageNumberStart: 43,
            pageNumberEnd: 78,
            content: "--- PAGE 43 ---\nIn this chapter, we explore the scientific basis...\n--- END PAGE 78 ---",
            wordCount: 3200
        }
        // ... more chapters (only chapters with ≥10,000 characters)
    ],
    metadata: {
        chapterContentExtraction: {
            totalChapters: 15,
            originalChapterCount: 18,
            filteredChapterCount: 3,
            totalPages: 297,
            averagePagesPerChapter: 19.8,
            extractionMethod: "page_based_content_extraction_with_filtering"
        }
    }
}
```

## Dependencies

- **Node.js built-ins**: No external dependencies required
- Uses standard JavaScript string manipulation and regex patterns

## Content Extraction Strategy

### Boundary Detection
- **Start Page**: Uses `startingPage` from chapter metadata
- **End Page**: Next chapter's `startingPage - 1`, or last page in document
- **Page Markers**: Uses `--- PAGE X ---` and `--- END PAGE Y ---` markers
- **Overlap Handling**: Ensures no content gaps or overlaps

### Chapter Filtering
- **Minimum Length**: 10,000 characters
- **Purpose**: Removes short sections like preface, acknowledgments, dedication, etc.
- **Timing**: Applied after extraction, before validation

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