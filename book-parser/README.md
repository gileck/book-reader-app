# Book Parser

A comprehensive PDF book parsing library that extracts text, images, and chapter structure from PDF files with advanced TOC extraction and intelligent text processing.

## Features

### Core Features
- **Automatic TOC Extraction**: Extracts chapters from PDF bookmarks/outline automatically
- **Text Extraction**: Page-aware text extraction with intelligent sentence merging across pages
- **Image Extraction**: Embedded image extraction with precise page correlation using `pdfimages`
- **Chapter Detection**: Automatic chapter detection with fallback to pattern-based detection
- **Smart Text Processing**: Enhanced text cleaning with abbreviation handling and chapter heading removal
- **Internal PDF Link Extraction**: Extracts clickable internal links (footnotes, cross-references) from PDF annotations with high-precision target chunk resolution

### Link Extraction & Navigation
- **Internal Link Detection**: Automatically extracts clickable internal PDF links (footnotes, citations, cross-references)
- **Target Chunk Resolution**: Maps links to specific text chunks using coordinate-based matching (97%+ accuracy)
- **Navigation References**: Provides direct chunk-to-chunk references (`targetChunkIndex`) for UI navigation
- **Link Target Marking**: Destination chunks marked with `isTargetLink: true` for UI highlighting
- **Multi-method Resolution**: Uses coordinate matching, pattern matching, text search, and page fallback for robust link resolution
- **High Confidence Matching**: Achieves 97%+ high-confidence resolution using PDF coordinate data

### Text Processing Enhancements
- **Sentence Merging**: Automatically merges sentences split across page boundaries for better TTS quality
- **Abbreviation Handling**: Recognizes common abbreviations (Ph.D., M.D., U.S., etc.) to prevent incorrect sentence splitting
- **Chapter Heading Cleanup**: Removes chapter headings from the beginning of chapter text
- **Spaced Letter Fix**: Fixes PDF artifacts like "O   nce upon a time" → "Once upon a time"
- **Page Number Cleaning**: Removes spurious page numbers from extracted text

### Advanced Features
- **Parser Summary**: Automatically generates detailed parsing statistics and chapter previews
- **Multi-format Support**: Text, image, and header chunk types
- **Page-Aware Processing**: Maintains page correlation throughout the extraction process
- **Debug Mode**: Comprehensive debug output for troubleshooting

## Directory Structure

```
book-parser/
├── parser/
│   └── parse-pdf-book-generic.js        # Main parser with all features
├── upload-book/
│   ├── upload-parsed-book.js             # Upload content to MongoDB
│   ├── upload-images-to-vercel-blob.js   # Upload images to Vercel Blob
│   └── upload-images-to-s3.js            # Upload images to AWS S3
├── test/
│   └── parser.test.js                   # Test suite
├── README.md                            # This file
└── BOOK_UPLOAD_GUIDE.md                 # Complete upload guide
```

## Usage

### Basic Parsing (Recommended)

Uses automatic TOC extraction from PDF bookmarks:

```bash
cd book-parser/parser/

# Parse PDF with automatic TOC extraction
node parse-pdf-book-generic.js /path/to/book.pdf

# Parse with custom output filename
node parse-pdf-book-generic.js /path/to/book.pdf output.json

# Enable debug mode for troubleshooting
node parse-pdf-book-generic.js /path/to/book.pdf --debug
```

### Advanced Parsing with Configuration

For PDFs without TOC or custom chapter detection:

```bash
# Use custom configuration file
node parse-pdf-book-generic.js /path/to/book.pdf /path/to/config.json

# With custom output and debug
node parse-pdf-book-generic.js /path/to/book.pdf /path/to/config.json output.json --debug
```

## Configuration File Format (Optional)

Most books don't need a config file as the parser uses automatic TOC extraction. Use a config file only when:
- PDF has no bookmarks/outline
- Custom chapter detection patterns are needed
- Specific metadata needs to be set

```json
{
    "metadata": {
        "title": "Book Title",
        "author": "Author Name"
    },
    "chapterNames": [
        "Introduction: The Beginning",
        "Chapter 1: First Steps",
        "Chapter 2: Advanced Topics"
    ],
    "chapterPatterns": [
        "^chapter\\s+(\\d+|one|two|three|four|five|six|seven|eight|nine|ten)\\b",
        "^(\\d+)\\.\\s+([A-Za-z][a-zA-Z\\s]{8,40})$"
    ],
    "excludePatterns": [
        "^(appendix|bibliography|index|notes|references)$"
    ]
}
```

## Output Files

The parser generates multiple output files:

### 1. Main Output (`output.json`)
```json
{
    "book": {
        "title": "Book Title",
        "author": "Author Name",
        "totalChapters": 10,
        "totalWords": 50000,
        "coverImage": "page-001-image-1.jpg",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "chapters": [
        {
            "chapterNumber": 1,
            "title": "Chapter Title",
            "content": {
                "chunks": [
                    {
                        "index": 0,
                        "text": "Chapter content with clean formatting...",
                        "type": "text",
                        "wordCount": 150,
                        "pageNumber": 5,
                        "isTargetLink": true,
                        "links": [
                            {
                                "text": "footnote reference.1",
                                "destinationPage": 25,
                                "destinationChapter": "Chapter Title",
                                "isValid": true,
                                "hasValidDestination": true,
                                "targetChunkIndex": 123,
                                "resolution": {
                                    "method": "coordinates",
                                    "confidence": "high"
                                }
                            }
                        ]
                    },
                    {
                        "index": 1,
                        "text": "",
                        "type": "image", 
                        "wordCount": 0,
                        "pageNumber": 6,
                        "imageName": "page-006-image-1.jpg",
                        "imageAlt": "Figure 1 (Page 6)"
                    }
                ]
            },
            "wordCount": 3500,
            "startingPage": 5,
            "endingPage": 12
        }
    ],
    "metadata": {
        "parsedAt": "2024-01-01T00:00:00.000Z",
        "totalChapters": 10,
        "totalWords": 50000,
        "avgWordsPerChapter": 5000,
        "hasImages": true,
        "totalImages": 15,
        "imagesFolderPath": "./images/Book-Title"
    }
}
```

### 2. Parser Summary (`parser-summary.json`)
Automatically generated alongside the main output:

```json
{
    "bookInfo": {
        "title": "Book Title",
        "author": "Author Name", 
        "parsedAt": "2024-01-01T00:00:00.000Z"
    },
    "overview": {
        "totalChapters": 10,
        "totalWords": 50000,
        "totalTextChunks": 2500,
        "totalImageChunks": 15,
        "totalHeaderChunks": 50,
        "totalChunks": 2565,
        "totalChunksWithLinks": 45,
        "totalLinks": 180,
        "averageWordsPerChapter": 5000,
        "averageChunksPerChapter": 257,
        "averageLinksPerChapter": 18
    },
    "chapters": [
        {
            "chapterNumber": 1,
            "chapterName": "Chapter Title",
            "wordCount": 3500,
            "textChunks": 175,
            "imageChunks": 2,
            "headerChunks": 5,
            "chunksWithLinks": 8,
            "totalLinks": 25,
            "totalChunks": 182,
            "pageRanges": "From 5 to 12",
            "numberOfPages": 8,
            "previewText": "Chapter content preview showing first 5 text chunks combined..."
        }
    ]
}
```

### 3. Images Folder
```
images/
└── Book-Title/
    ├── page-001-image-1.jpg
    ├── page-006-image-1.jpg
    └── page-012-image-1.jpg
```

### 4. Debug Files (when using `--debug`)
```
debug/
├── 1-pdfData-text.txt          # Raw extracted text
├── 2-raw-bookMetadata.json     # Detected metadata
├── 3-raw-chapters.json         # Detected chapters
├── 4-raw-pdfjsDocument.json    # PDF document info
├── 5-raw-outline.json          # PDF bookmarks/outline
└── tocData.json                # Table of contents data
```

## Text Processing Features

### Smart Sentence Merging
Automatically merges sentences split across page boundaries:
```
Page 10: "The discovery was made by scientists at the"
Page 11: "University of Cambridge in 2023."
Result: "The discovery was made by scientists at the University of Cambridge in 2023."
```

### Abbreviation Recognition
Handles common abbreviations to prevent incorrect sentence splitting:
- Academic: Ph.D., M.D., B.A., M.S., Prof.
- Geographic: U.S., U.K., St., Ave.
- General: Inc., Co., Corp., Ltd., etc., vs., i.e., e.g.

### Chapter Heading Cleanup
Removes various chapter heading patterns from content:
- "1 DISCOVERING THE NANOCOSM" → removed
- "INTRODUCTION LIFE ITSELF" → removed  
- "Chapter 5: Advanced Topics" → removed

### Spaced Letter Correction
Fixes PDF formatting artifacts:
- "O   nce upon a time" → "Once upon a time"
- "T   he discovery" → "The discovery"

## Chunk Types

- **text**: Regular text content with intelligent processing
- **image**: Embedded images with page correlation and alt text
- **header**: Chapter titles and headings

## Link Extraction and Resolution

The parser automatically extracts internal PDF links (footnotes, citations, cross-references) and resolves them to specific target chunks with high precision.

### Link Resolution Methods

The parser uses a multi-tiered resolution strategy for maximum accuracy:

1. **Coordinate-based (High Confidence)**: Uses PDF coordinate data to precisely match links to chunks
   - Achieves 97%+ accuracy
   - Most reliable method for footnotes and citations

2. **Pattern-based (Medium Confidence)**: Uses regex patterns to match link text with chunk content
   - Fallback when coordinates are unavailable
   - Good for structured references

3. **Text Search (Low Confidence)**: Searches for exact text matches within target pages
   - Additional fallback method
   - Useful for simple text references

4. **Page Fallback (Very Low Confidence)**: Maps to first chunk on the destination page
   - Last resort when other methods fail
   - Provides basic navigation capability

### Link Object Structure

Each extracted link contains:

```json
{
    "text": "footnote reference.1",           // Link text from PDF
    "destinationPage": 25,            // Target page number
    "destinationChapter": "Chapter Title", // Target chapter name
    "isValid": true,                  // Link validation status
    "hasValidDestination": true,      // Destination page exists
    "targetChunkIndex": 123,          // Direct reference to target chunk
    "resolution": {
        "method": "coordinates",      // Resolution method used
        "confidence": "high"          // Confidence level
    }
}
```

### Target Chunk Marking

Chunks that are link destinations are automatically marked:

```json
{
    "index": 123,
    "text": "Footnote content here...",
    "type": "text",
    "isTargetLink": true,             // Indicates this chunk is a link target
    "pageNumber": 25
}
```

This enables UI features like:
- Highlighting destination chunks
- Building navigation indexes
- Creating back-reference systems

### Link Statistics

The parser provides detailed link resolution statistics:

```
🎯 Resolved 2,190/2,214 links to target chunks
🎯 Marked 406 chunks as link targets

Link Resolution Quality:
- Coordinate-based (high confidence): 2,154 links (97.3%)
- Page fallback (very low confidence): 36 links (1.6%)  
- Pattern-based (medium confidence): 0 links
- Text search (low confidence): 0 links
- Not found: 24 links (1.1%)
```

## Images

Images are extracted using `pdfimages` and correlated with correct page numbers:

**File Structure:**
```
book-folder/
├── book.pdf
├── output.json
├── parser-summary.json
└── images/
    └── Book-Title/
        ├── page-001-image-1.jpg    # Page 1, Image 1
        ├── page-006-image-1.jpg    # Page 6, Image 1
        └── page-012-image-1.jpg    # Page 12, Image 1
```

**Naming Convention:**
- `page-{pageNumber:3-digits}-image-{imageIndex}.jpg`
- Page numbers are zero-padded to 3 digits for proper sorting

## Complete Book Upload Workflow

For uploading books to the database with images:

```bash
# 1. Parse PDF
cd book-parser/parser/
node parse-pdf-book-generic.js /path/to/book.pdf

# 2. Review parser summary
cat /path/to/parser-summary.json

# 3. Upload to database
cd ../upload-book/
node upload-parsed-book.js /path/to/book/folder/

# 4. Upload images to cloud storage
node upload-images-to-vercel-blob.js /path/to/book/folder/ "Exact Book Title"
```

## Testing

Run the test suite:

```bash
node test/parser.test.js
```

The test suite validates:
- Book structure integrity
- Chapter detection accuracy
- Image extraction and correlation
- Text processing enhancements
- Parser summary generation

## Dependencies

- `fs` - File system operations
- `path` - Path utilities  
- `pdf-parse` - PDF text extraction
- `pdfjs-dist` - PDF.js for advanced PDF operations and TOC extraction
- `child_process` - For executing `pdfimages` command
- `mongodb` - Database operations (in upload scripts)

## Requirements

- **Node.js** (v14 or higher)
- **pdfimages** command-line tool (from poppler-utils):
  ```bash
  # Install on macOS
  brew install poppler
  
  # Install on Ubuntu/Debian
  sudo apt-get install poppler-utils
  ```

## Error Handling

The parser includes comprehensive error handling for:
- Missing PDF files
- Invalid configuration files
- PDF parsing errors
- Image extraction failures
- File system operations
- TOC extraction issues

## Performance

- Processes large PDFs efficiently (tested with 400+ page books)
- Memory-conscious chunk processing
- Parallel image extraction where possible
- Progress logging for long operations
- Optimized sentence merging algorithms

## Advanced Features

### Debug Mode
Enable with `--debug` flag to generate detailed debugging information:
- Raw PDF text output
- Chapter detection analysis
- Image extraction details
- TOC parsing results
- Link extraction and resolution details

### Link Extraction Analysis
When processing PDFs with internal links, the parser provides detailed analysis:
- Link discovery per page
- Resolution method effectiveness
- Target chunk mapping accuracy
- Validation statistics

### Parser Summary Statistics
Automatically displays processing results:
```
📊 PARSER SUMMARY:
================================================================================
📖 Book: "Book Title" by Author Name  
📚 Total Chapters: 10
📝 Total Words: 50,000
🧩 Total Chunks: 2,565 (2,500 text + 15 images + 50 headers)
🔗 Total Links: 180 in 45 chunks
================================================================================
📚 CHAPTER BREAKDOWN:
 1. Introduction                       3500w  175c   2i   5h   25l
 2. Chapter 1: First Steps             5200w  260c   1i   3h   18l
 3. Chapter 2: Advanced Topics         4800w  240c   3i   4h   22l
================================================================================
```

For complete upload instructions and troubleshooting, see [BOOK_UPLOAD_GUIDE.md](BOOK_UPLOAD_GUIDE.md). 