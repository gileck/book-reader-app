# Step 3-2: Image Extraction

## Overview

This step extracts embedded images from the PDF file and emits inline image markers into chapter content to preserve original placement without relying on pages. It takes the output from Step 3-1 (link detection) and augments chapters with `[[IMG ...]]` markers that are later converted to image chunks.

## Input

- **chapters[]** with accessible text (chapter-level content or chunk content) from Step 3-1
- Original PDF for image detection/extraction

## Process

1. **Image Detection**: Uses PDF.js to detect which regions contain images
2. **Image Extraction**: Uses the `pdfimages` command-line tool to extract actual image files from the PDF
3. **Flow Positioning**: Determines nearest text position in chapter flow for each detected image
4. **Marker Insertion**: Inserts inline markers into chapter content to mark image positions

## Output

- **chapters[]** with chapter content containing inline image markers
- Marker format (grammar):
  - `[[IMG id=<string> index=<int> alt="<string>"]]`
  - `id`: stable image identifier (e.g., filename or UUID)
  - `index`: flow order index within the chapter (stable ordering fallback)
  - `alt`: optional alt/caption text when available
- Marker insertion rules:
  - Placed immediately before or after the nearest text line according to PDF layout
  - If no nearby text, insert by flow order between adjacent textual regions
- Extracted images are saved to disk as before

## Image Storage

- Images are saved to `{OUTPUT_DIR}/images/` directory
- Image filenames follow the pattern: `image-<id>.jpg` or a deterministic mapping from extraction

## Dependencies

- **pdfjs-dist**: For PDF analysis and image detection
- **pdfimages**: Command-line tool from poppler-utils package
  - Install on macOS: `brew install poppler`
  - Install on Ubuntu: `sudo apt-get install poppler-utils`

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