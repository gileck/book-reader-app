# Transformers Book Processing

This folder contains the processed "TRANSFORMER" book by Nick Lane and the scripts to work with it.

## Files

- `book.pdf` - Original PDF file
- `run-transformers.js` - Parser script that processes the book
- `upload-transformers.js` - Upload script that sends the book to the database
- `output/` - Generated output from the parser
  - `output.json` - Processed book content and metadata
  - `images/` - Extracted images from the book
  - `steps/` - Intermediate processing steps (for debugging)
  - `debug/` - Debug information from each parsing step

## Usage

### 1. Parse the Book
```bash
node run-transformers.js
```
This processes the PDF and extracts:
- Text content organized into chapters and sentences
- Images and figures
- Footnotes and links
- Metadata (title, author, word count, etc.)

### 2. Upload to Database
```bash
node upload-transformers.js
```
This uploads the processed book to the Book Reader App database:
- Book content and metadata
- Images (uploaded to Vercel Blob if configured)
- Makes the book available in the web app

Use `--force` flag to re-upload if the book already exists:
```bash
node upload-transformers.js --force
```

## Book Information

- **Title**: "TRANSFORMER"
- **Author**: Nick Lane
- **Chapters**: 10
- **Word Count**: 117,709
- **Images**: 58 figures and diagrams
- **Links**: 227 footnotes and references

## Prerequisites

For uploading, ensure your `.env` file contains:
```env
MONGODB_URI=your_mongodb_connection_string
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token  # Optional, for image uploads
```

## Processing Details

The parser uses a 6-step pipeline:
1. **Step 1**: Text extraction from PDF
2. **Step 2**: OCR processing and chapter detection  
3. **Step 3**: Page extraction and link detection
4. **Step 4**: Paragraph detection
5. **Step 5**: Sentence detection with footnote handling
6. **Step 6**: Metadata extraction

Processing takes approximately 18-20 seconds and produces a comprehensive, searchable book format optimized for the reading application.