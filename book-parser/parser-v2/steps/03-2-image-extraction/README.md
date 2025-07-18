# Step 3-2: Image Extraction

## Overview

This step extracts embedded images from the PDF file and maps them to their corresponding pages. It takes the output from Step 3-1 (link detection) and adds an `images` array to each page containing the images found on that specific page.

## Input

- **chapters[]** with **pages[]** from Step 3-1
- Each page should have:
  - `pageNumber`: Number (0-based)
  - `content`: String
  - `links`: Array (from step 3-1)

## Process

1. **Image Detection**: Uses PDF.js to analyze the PDF and detect which pages contain images
2. **Image Extraction**: Uses the `pdfimages` command-line tool to extract actual image files from the PDF
3. **Image Mapping**: Correlates extracted images with their source pages
4. **Page Assignment**: Adds an `images` array to each page with the images found on that page

## Output

- **chapters[]** with **pages[]** containing an additional **images[]** array
- Each page will have an `images` array (empty if no images on that page)
- Each image object contains:
  - `imageName`: String - filename of the extracted image
  - `imageAlt`: String - alt text for the image (e.g., "Figure 1 (Page 5)")
  - `extracted`: Boolean - whether the image was successfully extracted
  - `placeholder`: Boolean - whether this is a placeholder (detection only, not extracted)
  - `originalName`: String - original filename from pdfimages extraction

## Image Storage

- Images are saved to `{OUTPUT_DIR}/images/` directory
- Image filenames follow the pattern: `page-XXX-image-Y.jpg`
  - `XXX`: Zero-padded page number (1-based)
  - `Y`: Image index on that page (1-based)

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
- All pages have an `images` array (even if empty)
- Image objects have required properties with correct types
- Metadata matches actual image counts
- Processing metadata is properly recorded

## Example Output Structure

```javascript
{
  chapters: [
    {
      title: "Chapter 1",
      pages: [
        {
          pageNumber: 0,
          content: "Page content...",
          links: [...], // from step 3-1
          images: [
            {
              imageName: "page-001-image-1.jpg",
              imageAlt: "Figure 1 (Page 1)",
              extracted: true,
              placeholder: false,
              originalName: "image-000.jpg"
            }
          ]
        }
      ]
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