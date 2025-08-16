# Step 6: Metadata Extraction

## Overview

The Metadata Extraction step analyzes the parsed book content to extract comprehensive metadata including title, author, publication information, and statistical data about the book's content structure.

## Process

### 1. Title Extraction
- **Title Page Patterns**: Searches for all-caps titles and title-author combinations
- **Copyright Page Analysis**: Extracts titles from copyright notices
- **Chapter Analysis**: Falls back to first chapter title if it looks like a book title
- **Confidence Scoring**: Ranks title candidates by extraction confidence

### 2. Author Extraction  
- **"By Author" Patterns**: Searches for explicit author attributions
- **Copyright Analysis**: Extracts author names from copyright notices
- **Name Validation**: Filters out non-name patterns and validates proper names

### 3. Publication Information
- **Publisher**: Extracts from "Published by" patterns
- **Publication Year**: Finds year from copyright notices
- **ISBN**: Locates and validates ISBN numbers
- **Edition**: Detects edition information

### 4. Statistical Analysis
- **Content Counts**: Words, sentences, paragraphs, images, links
- **Chapter Analysis**: Chapter count and titles
- **Averages**: Words per chapter and paragraph
- **Structure Detection**: Table of contents, index presence

### 5. Language Detection
- **Pattern Matching**: Analyzes common English words frequency
- **Confidence Scoring**: Provides language detection confidence

## Input Requirements

```javascript
{
  chapters: [
    {
      title: "Chapter Title",
      chunks: [
        {
          type: "paragraph|image|header",
          content: "text content",
          wordCount: 100,
          sentenceCount: 5,
          links: [],
          imageName: "image.jpg" // for image chunks
        }
      ]
    }
  ],
  rawText: "complete extracted text from PDF"
}
```

## Output Format

```javascript
{
  // ... existing pipeline state
  metadata: {
    // Basic Information
    title: "Book Title",
    author: "Author Name",
    language: "en",
    
    // Publication Information
    publisher: "Publisher Name",
    publicationYear: 2022,
    isbn: "1234567890",
    edition: 1,
    
    // Statistics
    totalChapters: 10,
    totalWords: 85000,
    totalSentences: 4250,
    totalParagraphs: 850,
    totalImages: 25,
    totalLinks: 15,
    averageWordsPerChapter: 8500,
    averageWordsPerParagraph: 100,
    
    // Structure Information
    chapterTitles: ["Chapter 1", "Chapter 2", ...],
    hasTableOfContents: true,
    hasIndex: true,
    hasImages: true,
    hasLinks: true,
    
    // Processing Information
    extractedAt: "2024-01-01T12:00:00.000Z",
    parserVersion: 2
  }
}
```

## Title Extraction Patterns

### High Confidence Patterns
1. **All Caps Titles**: `^([A-Z][A-Z\s:]{10,80})\s*$`
2. **Title + Author**: `([A-Z][^.\n]{15,80})\s*\n\s*(?:by\s+|author)`
3. **Title + Subtitle**: `([A-Z][^.\n]{10,60})\s*\n\s*(?:The|A)\s+(?:complete|definitive)`

### Medium Confidence Patterns
1. **Copyright Pages**: `©[^,\n]*?(\d{4})[^,\n]*?([A-Z][^.\n]{10,60})`

### Fallback
- First chapter title (if not generic like "Introduction" or "Chapter 1")

## Author Extraction Patterns

### Primary Patterns
1. **Explicit Attribution**: `(?:by|author|written\s+by)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]*)*)`
2. **Name Lines**: `([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*\n`
3. **Copyright Attribution**: `copyright[^,\n]*?(?:\d{4})[^,\n]*?([A-Z][a-z]+\s+[A-Z][a-z]+)`

### Validation Rules
- Must have at least first and last name (2+ words)
- Excludes common non-name patterns
- Length between 3-50 characters

## Statistical Calculations

### Word Counts
- Aggregated from all text and paragraph chunks
- Excludes image alt-text from main count

### Structure Analysis
- **Paragraphs**: Count of paragraph-type chunks
- **Images**: Count of image-type chunks  
- **Links**: Sum of all link arrays in chunks
- **Sentences**: Sum of sentence counts from all chunks

### Averages
- **Words per Chapter**: `totalWords / totalChapters`
- **Words per Paragraph**: `totalWords / totalParagraphs`

## Validation

The validation checks:

### Required Fields
- `title`, `author`, `language`, `totalChapters`, `totalWords`, `extractedAt`, `parserVersion`

### Data Type Validation
- **Strings**: Non-empty for title, author, language, extractedAt
- **Numbers**: Non-negative for all count fields
- **Booleans**: For has* flags
- **Arrays**: For chapterTitles

### Relationship Validation
- Chapter titles count matches totalChapters
- hasImages/hasLinks consistency with counts
- Average calculations accuracy

### Format Validation
- ISO date format for extractedAt
- Valid ISBN format if present
- Reasonable publication year range

## Error Handling

### Common Issues
1. **No Title Found**: Falls back to "Unknown Title"
2. **No Author Found**: Falls back to "Unknown Author"  
3. **Missing Publication Info**: Fields remain null
4. **Invalid Chapters**: Throws error if chapters missing

### Debug Output
When `DEBUG_DIR` is configured, saves detailed extraction information:
- Title candidates with confidence scores
- Author candidates and sources
- Publication information matches
- Language detection details

## Performance Considerations

- **Text Analysis**: Limited to first 10 pages for metadata extraction
- **Pattern Matching**: Optimized regex patterns for efficiency  
- **Memory Usage**: Processes chapters sequentially for statistics

## Usage in Pipeline

This step should run after paragraph detection (step 4) as it requires:
- Complete chapter structure with chunks
- Raw text for pattern analysis
- Finalized content for accurate statistics

The metadata object created by this step is used by the parser's output generation to create the simplified metadata structure in the final output.json file. 