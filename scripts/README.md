# Generic PDF Book Parser

A configurable system for parsing PDF books into structured chapters with TTS-optimized text chunks.

## Quick Start

### For new books with standard chapter formats:
```bash
node parse-pdf-book-generic.js your-book.pdf default output.json
```

### For books needing custom configuration:
```bash
# 1. Create a configuration interactively
node create-book-config.js

# 2. Use your custom configuration
node parse-pdf-book-generic.js your-book.pdf your-book-id output.json
```

## Features

- **Configurable chapter detection**: Support for various chapter naming patterns
- **Front matter skipping**: Automatically skip title pages, copyright, etc.
- **Back matter exclusion**: Filter out appendices, indexes, bibliographies
- **Text chunking**: Optimized for TTS with proper sentence preservation
- **Flexible metadata**: Override title/author or auto-detect from PDF

## Configuration Options

### Basic Configuration (`book-config.json`)

```json
{
  "my-book": {
    "startChapter": "Chapter 1",           // Exact title to start parsing
    "chapterPatterns": [                   // Regex patterns for chapter detection
      "^chapter\\s+(\\d+)\\b",
      "^[A-Z\\s]{8,30}$"
    ],
    "explicitChapters": [                  // Exact chapter titles (overrides patterns)
      "Introduction",
      "Chapter 1",
      "Conclusion"
    ],
    "excludePatterns": [                   // Sections to exclude
      "^(appendix|bibliography|index)$"
    ],
    "skipFrontMatter": true,               // Skip content before startChapter
    "chapterNumbering": "sequential",      // How to number chapters
    "metadata": {
      "title": "My Book Title",           // Override auto-detected title
      "author": "Author Name"             // Override auto-detected author
    }
  }
}
```

### Configuration Methods

1. **Pattern-based** (default): Uses regex patterns to detect chapters
2. **Explicit chapters**: Provide exact list of chapter titles
3. **Hybrid**: Combine patterns with explicit special chapters

## Usage Examples

### 1. Standard Academic Book
```bash
# Uses default patterns like "Chapter 1", "Introduction", etc.
node parse-pdf-book-generic.js academic-book.pdf default output.json
```

### 2. Book with Unique Chapter Titles
```bash
# First, create config with explicit chapter titles
node create-book-config.js
# Enter: book ID, chapter titles, etc.

# Then parse with your config
node parse-pdf-book-generic.js unique-book.pdf my-book-config output.json
```

### 3. Book with Mixed Patterns
Edit `book-config.json` manually:
```json
{
  "mixed-book": {
    "startChapter": "Prologue",
    "chapterPatterns": ["^chapter\\s+\\d+"],
    "explicitChapters": ["Prologue", "Epilogue"],
    "excludePatterns": ["^(notes|bibliography)$"]
  }
}
```

## Minimal Input Required

The system can work with just:

1. **Starting point**: Either a specific chapter title or auto-detection
2. **Chapter patterns**: What identifies a chapter heading

For maximum accuracy, provide:
- Exact first chapter title
- List of all chapter titles (if unique)
- Sections to exclude from parsing

## Common Patterns

### Fiction Books
```json
{
  "chapterPatterns": [
    "^chapter\\s+(\\d+|one|two|three)",
    "^(prologue|epilogue)$"
  ]
}
```

### Academic Books
```json
{
  "chapterPatterns": [
    "^(\\d+)\\.\\s+[A-Z]",
    "^(introduction|conclusion|references)$"
  ]
}
```

### All-Caps Titles
```json
{
  "chapterPatterns": ["^[A-Z\\s]{8,30}$"],
  "explicitChapters": ["INTRODUCTION", "FIRST CHAPTER", "CONCLUSION"]
}
```

## Output Format

The parser generates a JSON file with:
- Book metadata (title, author, word count)
- Chapters array with TTS-optimized chunks
- Each chunk contains text, word count, and indices

Perfect for integration with reading apps, TTS systems, and content management.

## Error Handling

- **Too many chapters detected**: Tighten patterns or use explicit chapters
- **Too few chapters detected**: Add more patterns or check start chapter
- **Missing content**: Verify front matter skipping settings
- **Wrong chapters**: Check exclude patterns aren't too broad

## CLI Help

```bash
node parse-pdf-book-generic.js --help
```

Shows all command-line options and examples. 