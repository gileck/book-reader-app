# Image Placement Bug Fix - October 2025

## Problem Summary

Images were appearing far from their original locations in parsed books, sometimes in completely different chapters. For example, in "Thinking, Fast and Slow":
- The "angry woman" image (Figure 1) from Chapter 1 was appearing in Chapter 3
- Figure 9 was appearing in Chapter 3 instead of Chapter 10
- Images were consistently misplaced throughout the book

## Root Cause Analysis

### Issue 1: Page Number Mismatch

The original implementation had a fundamental flaw in how it correlated images:

1. **PDF.js detection** was used to count images per page
2. **pdfimages extraction** was used to extract the actual image files
3. The code **assumed** these would be in the same order

However, PDFs can store images on different pages than where they're visually displayed:
- PDF.js detected an image on page 34
- `pdfimages` actually extracted that same image from page 22
- The code incorrectly assigned it to page 34

### Issue 2: Generic Figure Numbering

Images were being labeled with sequential "Figure N" numbers based on extraction order, not the actual figure captions in the book. This caused:
- `image-035-1.jpg` being labeled "Figure 9" when it wasn't Figure 9
- Confusion between image files and their actual content

### Issue 3: Bottom-of-Page Placement

All images were placed at the bottom of their assigned page, regardless of where the figure caption appeared in the text flow.

## Solution Implemented

### 1. Use `pdfimages -list` for Accurate Page Numbers

```javascript
// Get accurate page numbers from pdfimages -list
const listOutput = execSync(`pdfimages -list "${pdfPath}"`, { encoding: 'utf-8' });
const imagePageNumbers = [];

// Parse the output to extract page numbers
for (const line of lines) {
    const parts = line.split(/\s+/);
    const pageNum = parseInt(parts[0]);
    const imageNum = parseInt(parts[1]);
    imagePageNumbers.push({
        imageIndex: imageNum,
        pageNumber: pageNum - 1 // Convert to 0-based
    });
}

// Use these page numbers directly (not PDF.js detection order)
for (let i = 0; i < extractedFiles.length; i++) {
    const actualPageNumber = imagePageNumbers[i].pageNumber;
    const finalFileName = `image-${String(actualPageNumber + 1).padStart(3, '0')}-${i + 1}.jpg`;
    // ... use actualPageNumber for placement
}
```

**Why this works**: `pdfimages -list` shows the authoritative page number where each image is stored in the PDF structure, which matches where the image actually appears visually.

### 2. Caption-Anchored Placement

Instead of always placing images at the bottom of pages, the new implementation:

1. **Searches for standalone figure captions** on each image's page
   ```javascript
   const lines = pageContent.split('\n');
   for (const line of lines) {
       const trimmedLine = line.trim();
       // Check if this line is ONLY a figure caption (e.g., "Figure 1")
       const figureMatch = trimmedLine.match(/^Figure\s+\d+$/i);
       if (figureMatch) {
           // Place image marker right after this caption line
           insertAt = currentPos + line.length + 1;
           break;
       }
   }
   ```

2. **Falls back to bottom-of-page** if no standalone caption is found
   ```javascript
   if (!captionFound) {
       insertAt = pageEnd; // Default: bottom of page
   }
   ```

**Why this works**: Standalone captions (e.g., "Figure 1" on its own line) are reliable anchors that indicate where the image should appear in the text flow.

### 3. Page-Based Alt Text

Instead of using incorrect figure numbers, images now use page-based alt text:
```javascript
const imageAlt = `Image from page ${actualPageNumber + 1}`;
```

This is more accurate and doesn't make false claims about which figure the image represents.

## Results

### Before the Fix
```
Chapter 2: "The Characters of the Story"
  - Chunk 2_1: "To observe your mind in automatic mode..."
  - Chunk 2_2: Header "Figure 1"
  - Chunk 2_3: (text continues)

Chapter 3: "Attention and Effort"  
  - Chunk 3_10: IMAGE image-035-1.jpg (WRONG - this is actually Figure 1!)
```

### After the Fix
```
Chapter 2: "The Characters of the Story"
  - Chunk 2_1: "To observe your mind in automatic mode..."
  - Chunk 2_2: "Figure 1 Your experience as you look at the woman's face..."
  - Chunk 2_3: IMAGE image-022-7.jpg
  - Chunk 2_4: IMAGE image-022-8.jpg
  - Chunk 2_5: IMAGE image-022-9.jpg (CORRECT - the angry woman!)
  - Chunk 2_6: "As surely and quickly as you saw..."

Chapter 10: "Answering an Easier Question"
  - Chunk 10_44: "Figure 9 As printed on the page..."
  - Chunk 10_45: IMAGE image-107-33.jpg (CORRECT - Figure 9!)
```

## Testing

Tested on "Thinking, Fast and Slow" by Daniel Kahneman:
- ✅ 109 images extracted with accurate page numbers
- ✅ Figure 1 (angry woman) now in Chapter 2, Chunk 2_5 (was in Chapter 3)
- ✅ Figure 9 now in Chapter 10, Chunk 10_45 (was in Chapter 3)
- ✅ Images with standalone captions placed immediately after captions
- ✅ Images without captions placed at bottom of page (fallback)

## Impact on Existing Books

Books parsed before this fix will have misplaced images. To fix them:

1. Re-run the parser on the PDF
2. Re-upload the parsed output to the database
3. Images will appear in their correct locations

## Files Modified

- `book-parser/parser/steps/03-2-image-extraction/03-2-image-extraction.js`
  - Added `pdfimages -list` parsing
  - Implemented caption-anchored placement
  - Removed reliance on PDF.js detection order
  
- `book-parser/parser/steps/03-2-image-extraction/README.md`
  - Updated documentation to reflect new approach
  - Added technical notes about the bug fix

- `book-parser/parser/README.md`
  - Updated Image Marker System section

## Future Improvements

Possible enhancements for even better image placement:

1. **OCR-based caption detection**: Use OCR to detect figure captions even when they're not in the text layer
2. **Spatial positioning**: Use PDF coordinate data to place images at their exact Y-position on the page
3. **Multi-line caption support**: Handle captions that span multiple lines (e.g., "Figure 1. This is a long caption...")
4. **Table/diagram detection**: Special handling for tables and diagrams that may not have "Figure N" captions

