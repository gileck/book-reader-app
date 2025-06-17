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

# Test Scripts

This directory contains various utility and test scripts for the book reader application.

## TTS Testing

### test-polly-timestamps.js

Tests Amazon Polly TTS service to verify that word timestamps work correctly for the highlighting feature.

**Purpose:**
- Validates that Polly's Speech Marks API returns accurate timing data
- Tests the SSML mark generation for word-level highlighting
- Verifies compatibility with our TTS adapter interface
- Generates audio and timing files for manual verification

**Setup:**
```bash
# Set AWS credentials
export AWS_ACCESS_KEY_ID="your_access_key_here"
export AWS_SECRET_ACCESS_KEY="your_secret_key_here"
export AWS_REGION="us-east-1"  # optional, defaults to us-east-1
```

**Usage:**
```bash
# Run the test
yarn test-polly

# Or directly with node
node scripts/test-polly-timestamps.js
```

**Output:**
The script creates a `test-output/` directory with:
- `test-audio.mp3` - Generated audio file
- `speech-marks.json` - Raw speech marks from Polly
- `test-summary.json` - Analysis results and timing data

**What it tests:**
1. **SSML Generation**: Verifies mark tags are properly formatted
2. **Speech Marks API**: Tests timing data extraction
3. **Audio Generation**: Confirms MP3 audio is created
4. **Timing Analysis**: Validates word-to-timestamp mapping
5. **Adapter Compatibility**: Ensures format matches our TTSResult interface

**Expected Output:**
```
🚀 Testing Amazon Polly TTS with timestamps...

📝 Test text: Hello world! This is a test of Amazon Polly speech synthesis with word timing.
🎤 Voice: Joanna
📋 Generated SSML:
<speak> <mark name="Hello-0"/> Hello <mark name="world!-1"/> world! <mark name="This-2"/> This <mark name="is-3"/> is <mark name="a-4"/> a <mark name="test-5"/> test <mark name="of-6"/> of <mark name="Amazon-7"/> Amazon <mark name="Polly-8"/> Polly <mark name="speech-9"/> speech <mark name="synthesis-10"/> synthesis <mark name="with-11"/> with <mark name="word-12"/> word <mark name="timing.-13"/> timing.</speak>

==================================================

⏱️  Step 1: Getting speech marks...
✅ Speech marks saved to: /path/to/test-output/speech-marks.json

📊 Parsing speech marks:
   Hello-0 -> 0.123s
   world!-1 -> 0.456s
   This-2 -> 0.789s
   ...

✅ Found 14 word timepoints

🔊 Step 2: Getting audio...
✅ Audio saved to: /path/to/test-output/test-audio.mp3
📏 Audio size: 45.67 KB

==================================================
📈 ANALYSIS RESULTS
==================================================
📝 Original words: 14
⏱️  Timepoints: 14
✅ Match: YES
⏰ First word at: 0.123s
⏰ Last word at: 3.456s
⏱️  Speech duration: 3.33s
🎯 Average word interval: 0.256s

📋 Word-by-word timing:
Word           Mark Name           Time (s)  Interval (s)
-------------------------------------------------------
Hello          Hello-0             0.123     0.000
world!         world!-1            0.456     0.333
This           This-2              0.789     0.333
...

🔧 Testing adapter format compatibility:
✅ Audio content (base64): 61234 characters
✅ Timepoints array: 14 items
✅ Format matches TTSResult interface

📄 Test summary saved to: /path/to/test-output/test-summary.json

🎉 Test completed successfully!

💡 Next steps:
   1. Play the generated audio file to verify quality
   2. Check that word timings align with actual speech
   3. Test with different voices and longer text
```

**Troubleshooting:**
- **AWS credentials error**: Make sure environment variables are set correctly
- **No speech marks**: Check that the voice supports neural engine
- **Timing misalignment**: Try different voices or adjust SSML formatting

## Other Scripts

### watch-checks.js
Continuously runs TypeScript and ESLint checks in watch mode.

### upload-sample-book.js
Uploads sample books to the database for testing.

### parse-pdf-book.js
Parses PDF files and extracts text content for the book reader. 