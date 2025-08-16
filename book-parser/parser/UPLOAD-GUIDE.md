# Parser v2 Upload Guide

This guide explains how to upload books parsed with Parser v2 to the database.

## Quick Start

```bash
# Basic upload (no images)
node upload-book-v2.js /path/to/book-folder/

# Upload with images to Vercel Blob
node upload-book-v2.js /path/to/book-folder/ --upload-images

# Explicitly skip images
node upload-book-v2.js /path/to/book-folder/ --skip-images
```

## Key Features

- **Parser v2 Support**: Handles the new flat chunk structure from parser v2
- **Version Tracking**: Automatically adds `parserVersion: 2` to book metadata
- **Image Upload Control**: Images are only uploaded when `--upload-images` flag is provided
- **Chapter Conversion**: Converts flat chunk structure to chapter-based database format
- **Update Existing**: Can update existing books with same title

## Differences from Original Parser

| Feature | Original Parser | Parser v2 |
|---------|----------------|-----------|
| Structure | Nested chapters → chunks | Flat chunks array |
| Image Handling | Mixed in text chunks | Separate image chunks |
| Upload Default | Auto-upload images | Requires `--upload-images` flag |
| Version | `parserVersion: 1` | `parserVersion: 2` |
| Chunk Types | text, image | text, header, image |

## Parser v2 Chunk Structure

Parser v2 uses a flat chunk structure with typed chunks:

```json
{
  "chunks": [
    {
      "chunkId": "1_0",
      "type": "text",
      "content": "Chapter content...",
      "pageNumber": 15,
      "wordCount": 150,
      "links": [...]
    },
    {
      "chunkId": "1_1", 
      "type": "header",
      "content": "Section Header",
      "pageNumber": 15,
      "wordCount": 2
    },
    {
      "chunkId": "1_2",
      "type": "image",
      "imageName": "page-015-image-1.jpg",
      "imageAlt": "Figure caption",
      "pageNumber": 15
    }
  ]
}
```

## Environment Variables

```bash
# Required for image upload
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token
```

## Examples

```bash
# Upload transformers book output
node upload-book-v2.js ./transformers-output/

# Upload with images from files directory
node upload-book-v2.js ../files/Transformers/ --upload-images

# Update existing book without images
node upload-book-v2.js /path/to/parsed-book/ --skip-images
``` 