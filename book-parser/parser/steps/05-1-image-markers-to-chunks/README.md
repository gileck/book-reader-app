# Step 5-1: Image Markers to Chunks

## Overview

Step 5-1 converts `[[IMG ...]]` markers found in text chunks into dedicated image chunks. This step processes the output from Step 5 (sentence detection) and ensures that all image markers are properly converted to image chunks positioned after the text chunks that contain them.

## Requirements

### Input
- Takes processed chapters from Step 5 with text chunks that may contain `[[IMG ...]]` markers
- Each text chunk has been properly split and optimized for word count
- Headers and other chunk types are preserved as-is

### Output
- Array of chapters with all image markers converted to image chunks
- Text chunks have markers removed from their content
- Image chunks are positioned immediately after the text chunks that contained them
- All chunk IDs are reassigned sequentially

## Processing Steps

### 1. Marker Detection and Extraction
- Scan all text chunks for `[[IMG id=<id> index=<index> alt="<alt>"]]` markers
- Extract marker information (id, index, alt text)
- Remove markers from text content and clean up whitespace

### 2. Image Chunk Creation
- Create dedicated image chunks for each marker found
- Set appropriate properties:
  - `type: 'image'`
  - `imageName: '<id>.jpg'`
  - `imageAlt: <alt text>`
  - `wordCount: 0`
  - `sentenceCount: 0`
  - `paragraphIndex: null`

### 3. Chunk Positioning
- Insert image chunks immediately after the text chunks that contained them
- Maintain order of multiple images from the same text chunk
- Preserve relative positioning of all other chunks

### 4. ID Reassignment
- Assign sequential chunk IDs to all chunks: `<chapterNumber>_<index>`
- Ensure no duplicate IDs within a chapter

## Validation

### Requirements
- **No remaining markers**: No text chunks should contain `[[IMG ...]]` markers
- **Image chunks present**: At least 1 image chunk must be created
- **Proper image chunk format**: All image chunks have required fields
- **Clean text content**: Text chunks have markers properly removed
- **Unique chunk IDs**: No duplicate chunk IDs within chapters

### Error Conditions
- Text chunks still containing image markers
- Missing required fields in image chunks
- No image chunks created when markers were present
- Duplicate or missing chunk IDs

## Technical Notes

### Marker Format
```
[[IMG id=<image-id> index=<number> alt="<alt-text>"]]
```

### Example Transformation
**Before** (Step 5 output):
```json
{
  "type": "text",
  "content": "This is some text. [[IMG id=image-001 index=0 alt=\"Figure 1\"]] More text here.",
  "chunkId": "1_5"
}
```

**After** (Step 5-1 output):
```json
[
  {
    "type": "text", 
    "content": "This is some text. More text here.",
    "chunkId": "1_5"
  },
  {
    "type": "image",
    "content": "Figure 1",
    "imageName": "image-001.jpg",
    "imageAlt": "Figure 1",
    "wordCount": 0,
    "sentenceCount": 0,
    "paragraphIndex": null,
    "chunkId": "1_6"
  }
]
```

## Dependencies

- Input from Step 5 (sentence detection)
- No external dependencies
- Uses regex for marker detection and extraction
