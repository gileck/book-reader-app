# Step 3-2: Image Extraction

## Overview

This step extracts embedded images from the PDF file and emits inline image markers into chapter content to preserve original placement without relying on pages. It takes the output from Step 3-1 (link detection) and augments chapters with `[[IMG ...]]` markers that are later converted to image chunks.

## Input

- **chapters[]** with accessible text (chapter-level content or chunk content) from Step 3-1
- Original PDF for image detection/extraction

## Process

1. **Page Number Detection**: Uses `pdfimages -list` to get accurate page numbers for each image in the PDF
   - This provides the authoritative source for which page each image belongs to
   - More reliable than PDF.js detection order, which can misalign images across pages
2. **Image Extraction**: Uses `pdfimages -all` to extract actual image files from the PDF
3. **Caption-Anchored Positioning**: For each image, searches its page for standalone figure captions
   - Looks for lines containing only "Figure N" (not embedded in sentences)
   - If found, places the image marker immediately after the caption line
   - If not found, falls back to placing at the bottom of the page
4. **Marker Insertion**: Inserts inline markers into chapter content to mark image positions
   - **Critical**: Images are processed in **reverse order** (last page first) to prevent offset corruption
   - When inserting text at position N, all positions > N shift, but positions < N remain valid
   - Reverse processing ensures all future insertions use uncorrupted position offsets

## Output

- **chapters[]** with chapter content containing inline image markers
- Marker format (grammar):
  - `[[IMG id=<string> index=<int> alt="<string>"]]`
  - `id`: stable image identifier (e.g., filename or UUID)
  - `index`: flow order index within the chapter (stable ordering fallback)
  - `alt`: optional alt/caption text when available
- Marker insertion rules:
  - **Primary**: Placed immediately after standalone figure captions (e.g., "Figure 1" on its own line)
  - **Fallback**: Placed at the bottom of the page if no caption is found
  - Uses accurate page numbers from `pdfimages -list` output
- Extracted images are saved to disk with filenames reflecting their actual page numbers

## Image Storage

- Images are saved to `{OUTPUT_DIR}/images/` directory
- Image filenames follow the pattern: `image-<pageNum>-<imageIndex>.jpg`
  - Example: `image-022-9.jpg` = 9th image extracted, from page 22 (1-indexed)
  - Page numbers are 1-indexed in filenames for human readability
  - Internally, page numbers are 0-indexed for consistency with PDF.js

## Dependencies

- **pdfimages**: Command-line tool from poppler-utils package (primary dependency)
  - Used for both page number detection (`-list`) and image extraction (`-all`)
  - Install on macOS: `brew install poppler`
  - Install on Ubuntu: `sudo apt-get install poppler-utils`
- **pdfjs-dist**: For PDF text content extraction (used for caption detection)

## Error Handling

- If `pdfimages` extraction fails, falls back to placeholders based on PDF.js detection
- Skips pages with PDF parsing errors
- Creates placeholder entries for images that can't be extracted

## Validation

The validation checks:
- All inserted `[[IMG ...]]` markers conform to the grammar and have unique `id`
- Every marker corresponds to an extracted (or placeholder) image on disk
- No markers remain unresolved after Step 4 conversion to `image` chunks
- Processing metadata is properly recorded (counts, timings)

## Example Output Structure

```javascript
{
  chapters: [
    {
      title: "Chapter 1",
      content: "... paragraph text ...\n[[IMG id=image-001 index=12 alt=\"Figure 1\"]]\nNext paragraph ..."
    }
  ],
  metadata: {
    imageExtraction: {
      totalImages: 5,
      totalExtractedImages: 5,
      imagesFolderPath: "./images",
      processingTime: 1250,
      extractionTime: "2024-01-15T10:30:00.000Z"
    }
  }
}
```

## Technical Notes

### Image Page Number Mismatch Bug Fix (October 2025)

**Issue**: Images were appearing far from their original locations in the book, sometimes in completely different chapters. For example, the "angry woman" image (Figure 1) from Chapter 1 was appearing in Chapter 3.

**Root Cause**: The original implementation used PDF.js to detect images and assumed they would be in the same order as `pdfimages` extraction. However, PDFs can store images on different pages than where they're visually displayed, causing a mismatch:
- PDF.js detected an image on page 34
- `pdfimages` extracted that same image from page 22
- The code incorrectly assigned it to page 34

**Solution**: Use `pdfimages -list` as the authoritative source for page numbers:
```javascript
// Get accurate page numbers from pdfimages
const listOutput = execSync(`pdfimages -list "${pdfPath}"`, { encoding: 'utf-8' });
const imagePageNumbers = parseListOutput(listOutput);

// Use these page numbers directly (not PDF.js detection order)
for (let i = 0; i < extractedFiles.length; i++) {
    const actualPageNumber = imagePageNumbers[i].pageNumber;
    // ... use actualPageNumber for placement
}
```

**Additional Improvement**: Caption-anchored placement
- Scans each page for standalone figure captions (e.g., "Figure 1" on its own line)
- Places image markers immediately after captions when found
- Falls back to bottom-of-page placement if no caption exists

**Result**: Images now appear in their correct chapters, near their original captions.

### Reverse-Order Processing Bug Fix (October 2025)

**Issue**: When multiple images appeared on consecutive pages, the marker insertion was creating malformed bracket structures:
```
❌ BEFORE: [ [[IMG...]] [IMG...]] ]
```

**Root Cause**: After inserting the first marker, `chapterContent` string grows and all positions shift. The `pageOffsets` map was never updated, causing subsequent insertions to use corrupted positions.

**Solution**: Process images in reverse order (last page first):
```javascript
// Pre-assign indices
chapterImages.forEach((info, idx) => { info.chapterIndex = idx; });

// Process in reverse
for (let i = chapterImages.length - 1; i >= 0; i--) {
    const info = chapterImages[i];
    // Insert using info.chapterIndex
}
```

**Why it works**: When inserting at position N, all positions < N remain valid. Reverse processing ensures all future insertions use uncorrupted offsets.

**Result**: Correctly formatted individual markers:
```
✅ AFTER: [[IMG id=image-090-1 index=0 alt="Figure 36"]]
         [[IMG id=image-091-1 index=1 alt="Figure 37"]]
```