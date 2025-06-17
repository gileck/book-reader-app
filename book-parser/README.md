# Book Parser

A comprehensive PDF book parsing library that extracts text, images, and chapter structure from PDF files with advanced TOC extraction and intelligent text processing.

## Features

### Core Features
- **Automatic TOC Extraction**: Extracts chapters from PDF bookmarks/outline automatically
- **Text Extraction**: Page-aware text extraction with intelligent sentence merging across pages
- **Image Extraction**: Embedded image extraction with precise page correlation using `pdfimages`
- **Chapter Detection**: Automatic chapter detection with fallback to pattern-based detection
- **Smart Text Processing**: Enhanced text cleaning with abbreviation handling and chapter heading removal

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
                        "pageNumber": 5
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
        "totalChunks": 2515,
        "averageWordsPerChapter": 5000,
        "averageChunksPerChapter": 252
    },
    "chapters": [
        {
            "chapterNumber": 1,
            "chapterName": "Chapter Title",
            "wordCount": 3500,
            "textChunks": 175,
            "imageChunks": 2,
            "totalChunks": 177,
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

### Parser Summary Statistics
Automatically displays processing results:
```
📊 PARSER SUMMARY:
================================================================================
📖 Book: "Book Title" by Author Name  
📚 Total Chapters: 10
📝 Total Words: 50,000
🧩 Total Chunks: 2,515 (2,500 text + 15 images)
================================================================================
📚 CHAPTER BREAKDOWN:
 1. Introduction                       3500w  175c   2i
 2. Chapter 1: First Steps             5200w  260c   1i
 3. Chapter 2: Advanced Topics         4800w  240c   3i
================================================================================
```

For complete upload instructions and troubleshooting, see [BOOK_UPLOAD_GUIDE.md](BOOK_UPLOAD_GUIDE.md). 