# Complete Guide: Uploading a New Book to the Database

This guide covers the complete process of parsing a PDF book and uploading it to the database with images, featuring the latest parser improvements.

## Prerequisites

### Required Software
- Node.js (v14 or higher)
- `pdfimages` command-line tool (from poppler-utils)
  ```bash
  # Install on macOS
  brew install poppler
  
  # Install on Ubuntu/Debian
  sudo apt-get install poppler-utils
  ```

### Environment Variables
Create a `.env` file in the `book-parser/` directory:
```bash
# Vercel Blob Storage
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token

# Optional: Enable debug mode
DEBUG_TEXT=/path/to/debug/output.txt
```

### MongoDB Connection
The scripts use a hardcoded MongoDB connection string. Ensure you have access to the database.

## Latest Parser Features

### Automatic Improvements (No Configuration Required)
- **TOC Extraction**: Automatically extracts chapters from PDF bookmarks/outline
- **Smart Text Processing**: Removes chapter headings, fixes spaced letters, cleans page numbers
- **Sentence Merging**: Merges sentences split across page boundaries for better TTS
- **Abbreviation Handling**: Recognizes Ph.D., M.D., U.S., etc. to prevent incorrect sentence splitting
- **Parser Summary**: Automatically generates detailed statistics and chapter previews
- **Page-Aware Processing**: Maintains precise page correlation for text and images

## Step-by-Step Process

### Step 1: Prepare Your Book Folder

**Recommended Approach** (PDF Only):
```
MyBook/
└── book.pdf          # Your PDF file (any name)
```

**Advanced Approach** (With Custom Configuration):
```
MyBook/
├── book.pdf          # Your PDF file (any name)
└── config.json       # Optional: custom book configuration
```

**Optional Config File** (`config.json`):
Only needed for PDFs without bookmarks or custom requirements:
```json
{
    "metadata": {
        "title": "The Great Book",
        "author": "Author Name"
    },
    "chapterNames": [
        "Introduction: The Beginning",
        "Chapter 1: First Steps",
        "Chapter 2: Advanced Topics",
        "Conclusion: Final Thoughts"
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

### Step 2: Parse the PDF Book

Navigate to the book parser directory and run:

```bash
cd book-parser/parser/

# Recommended: Basic parsing with automatic TOC extraction
node parse-pdf-book-generic.js /path/to/MyBook/book.pdf

# Alternative: Parse with custom output filename
node parse-pdf-book-generic.js /path/to/MyBook/book.pdf output.json

# With custom config file (only if needed)
node parse-pdf-book-generic.js /path/to/MyBook/book.pdf /path/to/MyBook/config.json

# Enable debug mode for troubleshooting
node parse-pdf-book-generic.js /path/to/MyBook/book.pdf --debug
```

**Expected Output with Latest Improvements:**
```
🚀 Starting PDF book parsing...
📁 PDF: /path/to/MyBook/book.pdf
⚙️  Config: None (using TOC extraction)
📄 Output: /path/to/MyBook/output.json
🔍 Attempting TOC extraction...
✅ Found 10 chapters via pdf_bookmarks
🖼️  Extracting embedded images from PDF...
   📊 Detected 15 images across 8 pages
   ✅ Perfect match: extracted files = detected images
✅ Processed 15 images with correct page numbers
🔗 Creating page-aware chunks with images...
📄 Using page-aware chunking for "Chapter 1"
🔗 Merged split sentence across pages 5-6
🔗 Merged split sentence across pages 8-9
✂️  Removed chapter heading "1\s+CHAPTER TITLE" from beginning of text
📸 Added 2 image(s) to page 7 of "Chapter 1"

📊 PARSER SUMMARY:
================================================================================
📖 Book: "The Great Book" by Author Name
📚 Total Chapters: 10
📝 Total Words: 45,000
🧩 Total Chunks: 2,515 (2,500 text + 15 images)
================================================================================
📚 CHAPTER BREAKDOWN:
 1. Introduction                       3500w  175c   0i
 2. Chapter 1: First Steps             5200w  260c   2i
 3. Chapter 2: Advanced Topics         4800w  240c   1i
================================================================================

✅ Book parsed and saved to file successfully!
📖 Title: "The Great Book"
👤 Author: Author Name
📚 Chapters: 10
📝 Total words: 45,000
🖼️ Total images: 15
📄 Output file: /path/to/MyBook/output.json
📊 Parser summary saved to: /path/to/MyBook/parser-summary.json
```

### Step 3: Verify Parsing Results

Check the generated files:

```bash
ls -la /path/to/MyBook/
```

**Expected Structure with Latest Updates:**
```
MyBook/
├── book.pdf
├── config.json              # If used
├── output.json              # ✅ Main parsed content
├── parser-summary.json      # ✅ NEW: Detailed statistics and previews
├── images/                  # ✅ Extracted images with page correlation
│   └── The-Great-Book/
│       ├── page-001-image-1.jpg
│       ├── page-007-image-1.jpg
│       ├── page-007-image-2.jpg
│       └── ...
└── debug/                   # 🐛 Only if --debug was used
    ├── 1-pdfData-text.txt
    ├── 2-raw-bookMetadata.json
    ├── 3-raw-chapters.json
    ├── 4-raw-pdfjsDocument.json
    ├── 5-raw-outline.json
    └── tocData.json
```

**Review Parser Summary:**
```bash
# Check the automatically generated summary
cat /path/to/MyBook/parser-summary.json
```

**New Parser Summary Features:**
- **Book Overview**: Total chapters, words, chunks, averages
- **Chapter Details**: Word count, chunk counts, page ranges, number of pages
- **Preview Text**: First 5 text chunks combined for each chapter
- **Image Statistics**: Per-chapter image counts and locations

**Verify Enhanced Text Processing:**
```bash
# Check if text improvements are working
node -e "
const data = JSON.parse(require('fs').readFileSync('/path/to/MyBook/output.json', 'utf8'));
const firstChunk = data.chapters[0].content.chunks.find(c => c.type === 'text');
console.log('✅ First text chunk (should be clean):');
console.log('   ', firstChunk.text.substring(0, 100) + '...');
console.log('✅ Includes page number:', firstChunk.pageNumber || 'No');
console.log('✅ Book:', data.book.title, 'by', data.book.author);
console.log('✅ Chapters:', data.chapters.length);
console.log('✅ Total words:', data.book.totalWords);
console.log('✅ Total images:', data.metadata.totalImages);
"
```

**Verify Images with Page Correlation:**
```bash
# Count extracted images
find /path/to/MyBook/images/ -name "*.jpg" -o -name "*.png" | wc -l

# Check image naming and page correlation
ls /path/to/MyBook/images/*/page-*.jpg | head -5

# Verify images have correct page numbers in JSON
node -e "
const data = JSON.parse(require('fs').readFileSync('/path/to/MyBook/output.json', 'utf8'));
const imageChunks = data.chapters.flatMap(ch => 
  ch.content.chunks.filter(chunk => chunk.type === 'image')
);
console.log('✅ Found', imageChunks.length, 'image chunks');
console.log('✅ Sample image chunks:');
imageChunks.slice(0, 3).forEach((chunk, i) => {
  console.log('   ', i+1, ':', chunk.imageName, 'on page', chunk.pageNumber);
});
"
```

### Step 4: Upload Book Content to Database

```bash
cd book-parser/upload-book/

# Upload the book content
node upload-parsed-book.js /path/to/MyBook/

# Or force overwrite if book already exists
node upload-parsed-book.js /path/to/MyBook/ --force
```

**Expected Output:**
```
🚀 Starting book upload...
📄 Found output file: output.json
🖼️  Found images folder with 15 image files
🔌 Connecting to MongoDB...
✅ Connected successfully!
📖 Inserting book: "The Great Book"...
   Book inserted with ID: 507f1f77bcf86cd799439011
📚 Inserting 10 chapters...
   Inserted chapters 1-10 (10/10)
✅ Book uploaded successfully!
📖 Title: "The Great Book"
👤 Author: Author Name
🆔 Book ID: 507f1f77bcf86cd799439011
📚 Chapters: 10
📝 Total words: 45,000
```

### Step 5: Upload Images to Vercel Blob

```bash
# Upload images using the exact book title from the database
node upload-images-to-vercel-blob.js /path/to/MyBook/ "The Great Book"
```

**Expected Output:**
```
🚀 Starting image upload to Vercel Blob...
📸 Found 15 image files
🔌 Connecting to MongoDB...
✅ Connected to MongoDB!
📖 Found book: "The Great Book" (ID: 507f1f77bcf86cd799439011)
☁️  Uploading images to Vercel Blob: books/The-Great-Book/images/
   📤 Uploading: page-001-image-1.jpg
   📤 Uploading: page-007-image-1.jpg
   ...
✅ Successfully uploaded 15 images to Vercel Blob
📚 Updated book with relative imageBaseURL: /The-Great-Book/images/
   📝 Updated Chapter 2 with image references
   📝 Updated Chapter 3 with image references
   ...
✅ Image upload and database update completed successfully!
📊 Summary:
   📖 Book: "The Great Book"
   📸 Images uploaded: 15
   📁 Relative path: /The-Great-Book/images/
   ☁️  Full Blob URL: https://xyz.public.blob.vercel-storage.com/books/The-Great-Book/images/
```

## Verification Steps

### 1. Verify Enhanced Parser Results

**Check Text Processing Improvements:**
```bash
# Verify clean chapter beginnings (no chapter headings)
node -e "
const data = JSON.parse(require('fs').readFileSync('/path/to/MyBook/output.json', 'utf8'));
data.chapters.forEach((ch, i) => {
  const firstTextChunk = ch.content.chunks.find(c => c.type === 'text');
  if (firstTextChunk) {
    console.log('Chapter', i+1, 'starts with:', firstTextChunk.text.substring(0, 50) + '...');
  }
});
"

# Check for sentence merging evidence
grep -c "🔗 Merged split sentence" /path/to/debug/output.log || echo "No merge log found"
```

**Review Parser Summary Statistics:**
```bash
# Display chapter breakdown with new page range information
node -e "
const summary = JSON.parse(require('fs').readFileSync('/path/to/MyBook/parser-summary.json', 'utf8'));
console.log('📊 BOOK OVERVIEW:');
console.log('Title:', summary.bookInfo.title);
console.log('Chapters:', summary.overview.totalChapters);
console.log('Words:', summary.overview.totalWords.toLocaleString());
console.log('Text Chunks:', summary.overview.totalTextChunks.toLocaleString());
console.log('Images:', summary.overview.totalImageChunks);
console.log('\\n📚 CHAPTER DETAILS:');
summary.chapters.forEach(ch => {
  console.log(' ', ch.chapterNumber + '.', ch.chapterName);
  console.log('     Pages:', ch.pageRanges, '(' + ch.numberOfPages + ' pages)');
  console.log('     Content:', ch.wordCount + 'w', ch.textChunks + 't', ch.imageChunks + 'i');
  console.log('     Preview:', ch.previewText.substring(0, 80) + '...');
  console.log('');
});
"
```

### 2. Verify Database Content

Connect to your MongoDB database and check:

```javascript
// Check book was inserted with new features
db.books.findOne({title: "The Great Book"})

// Check chapters have page-aware chunks
db.chapters.findOne(
  {bookId: ObjectId("507f1f77bcf86cd799439011")},
  {"content.chunks": {$slice: 3}}
)

// Verify image chunks have pageNumber field
db.chapters.findOne(
  {bookId: ObjectId("507f1f77bcf86cd799439011"), "content.chunks.type": "image"},
  {"content.chunks.$": 1}
)

// Count total chunks with page numbers
db.chapters.aggregate([
  {$match: {bookId: ObjectId("507f1f77bcf86cd799439011")}},
  {$unwind: "$content.chunks"},
  {$match: {"content.chunks.pageNumber": {$exists: true}}},
  {$count: "chunksWithPageNumbers"}
])
```

### 3. Verify Images in Blob Storage

Check that images are accessible:
```bash
# Test a few image URLs (replace with actual URLs from upload output)
curl -I "https://xyz.public.blob.vercel-storage.com/books/The-Great-Book/images/page-001-image-1.jpg"
curl -I "https://xyz.public.blob.vercel-storage.com/books/The-Great-Book/images/page-007-image-1.jpg"
```

### 4. Test Enhanced Reading Experience

1. Start your Book Reader App
2. Navigate to the book library
3. Find "The Great Book" in the list
4. Open the book and verify **new improvements**:
   - **Clean text**: No chapter headings at start of chapters
   - **Smooth reading**: Sentences flow naturally across pages
   - **Proper formatting**: No "O   nce upon a time" artifacts
   - **Accurate images**: Images appear on correct pages
   - **Page correlation**: Page numbers match between text and images
   - **No broken links**: All images load correctly

## Troubleshooting

### Common Issues

**1. No chapters detected despite having bookmarks:**
```bash
# Run with debug mode to see TOC extraction
node parse-pdf-book-generic.js /path/to/MyBook/book.pdf --debug

# Check the TOC data
cat /path/to/MyBook/debug/tocData.json
cat /path/to/MyBook/debug/5-raw-outline.json
```

**2. Poor text quality or formatting issues:**
```bash
# Check if text processing improvements are working
node -e "
const data = JSON.parse(require('fs').readFileSync('/path/to/MyBook/output.json', 'utf8'));
const firstChapter = data.chapters[0];
const firstTextChunk = firstChapter.content.chunks.find(c => c.type === 'text');
console.log('Chapter title:', firstChapter.title);
console.log('First text chunk:');
console.log(firstTextChunk.text.substring(0, 200));
console.log('\\nCheck for issues:');
console.log('- Starts with chapter title?', firstTextChunk.text.includes(firstChapter.title));
console.log('- Has spaced letters?', /[A-Z]\\s{2,}[a-z]/.test(firstTextChunk.text));
console.log('- Page number:', firstTextChunk.pageNumber || 'Missing');
"
```

**3. Images not extracted or incorrectly positioned:**
```bash
# Check if pdfimages is working
which pdfimages

# Test manual image extraction
pdfimages -list /path/to/MyBook/book.pdf

# Check parser image extraction log
grep "📸 Added.*image" /path/to/parser/output.log || echo "No image extraction log found"
```

**4. Parser summary not generated:**
```bash
# Check if parser-summary.json exists
ls -la /path/to/MyBook/parser-summary.json

# If missing, re-run parser
node parse-pdf-book-generic.js /path/to/MyBook/book.pdf
```

**5. Upload fails with "Book already exists":**
```bash
# Use force flag to overwrite
node upload-parsed-book.js /path/to/MyBook/ --force
```

**6. Image upload fails:**
```bash
# Check environment variables
echo $BLOB_READ_WRITE_TOKEN

# Verify book title matches exactly
node -e "
const { MongoClient } = require('mongodb');
const client = new MongoClient('your_mongodb_uri');
client.connect().then(async () => {
  const books = await client.db('book_reader_db').collection('books').find({}).toArray();
  console.log('Available books:');
  books.forEach(book => console.log(' -', book.title));
  client.close();
});
"
```

### Debug Mode Files

When using `--debug`, check these files for troubleshooting:
- `debug/1-pdfData-text.txt` - Raw extracted text
- `debug/2-raw-bookMetadata.json` - Detected metadata
- `debug/3-raw-chapters.json` - Detected chapters with page data
- `debug/4-raw-pdfjsDocument.json` - PDF document info
- `debug/5-raw-outline.json` - PDF bookmarks/outline
- `debug/tocData.json` - Table of contents extraction results

### New Debug Features

Check processing improvements:
```bash
# Look for sentence merging in logs
grep "🔗 Merged split sentence" parser-output.log

# Check chapter heading removal
grep "✂️  Removed chapter heading" parser-output.log

# Verify image correlation
grep "📸 Added.*image.*to page" parser-output.log
```

## Script Quick Reference

### Key Files and Scripts

| Script | Purpose | Location | New Features |
|--------|---------|----------|-------------|
| `parse-pdf-book-generic.js` | Parse PDF and extract images | `book-parser/parser/` | TOC extraction, text processing, parser summary |
| `upload-parsed-book.js` | Upload book content to MongoDB | `book-parser/upload-book/` | Enhanced validation |
| `upload-images-to-vercel-blob.js` | Upload images to Vercel Blob | `book-parser/upload-book/` | Page-aware image handling |

### Command Summary

```bash
# 1. Parse PDF (with automatic improvements)
cd book-parser/parser/
node parse-pdf-book-generic.js /path/to/MyBook/book.pdf

# 2. Review results
cat /path/to/MyBook/parser-summary.json

# 3. Upload content
cd ../upload-book/
node upload-parsed-book.js /path/to/MyBook/

# 4. Upload images
node upload-images-to-vercel-blob.js /path/to/MyBook/ "Exact Book Title"
```

## Success Checklist

### Parsing Phase
✅ PDF parsed successfully with automatic TOC extraction  
✅ Chapters detected with correct titles and page ranges  
✅ Images extracted with correct page correlation  
✅ Text processed with sentence merging and cleaning  
✅ `output.json` contains enhanced book and chapters data  
✅ `parser-summary.json` generated with detailed statistics  
✅ Chapter previews show clean, properly formatted text  
✅ Page ranges accurately reflect chapter boundaries  

### Upload Phase
✅ Book uploaded to MongoDB database  
✅ Chapters uploaded with page-aware text chunks  
✅ Images uploaded to Vercel Blob storage  
✅ Book record updated with `imageBaseURL`  
✅ Chapter chunks updated with `imageName` references  
✅ All images accessible via public URLs  

### Quality Verification
✅ No chapter headings at start of chapter content  
✅ Sentences flow smoothly across page boundaries  
✅ No formatting artifacts (spaced letters, page numbers)  
✅ Images display correctly at appropriate positions  
✅ Page numbers correlate between text and images  
✅ Enhanced reading experience in Book Reader App  

The book is now ready for an enhanced reading experience in your Book Reader App with all the latest improvements! 