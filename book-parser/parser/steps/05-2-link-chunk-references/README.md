# Step 5.2: Link Chunk References

## Overview

Step 5.2 enhances links by adding chunk references based on their roles using selector-based anchoring (no pages):
- For "source" role links: adds `targetChunkIndex` (the array index of the chunk containing the target text)
- For "target" role links: adds `sourceChunkIndex` (the array index of the chunk containing the source text)

This enables bidirectional navigation between linked content in the rendered book.

## Requirements

### Input
- Takes processed chapters from Step 5.1 with sentence chunks and image chunks
- Links already have `role` field ("source" or "target")
- Links have `linkId`, `text`, and `anchor` with `{ chapterId, selector: { start, end } }` (no `targetPageNumber`)

### Output
- Same structure as input with enhanced links
- Source links gain `targetChunkIndex` field (array index) pointing to target chunk
- Target links gain `sourceChunkIndex` field (array index) pointing to source chunk
- All existing link data is preserved

## Technical Approach

### 1. Chunk Mapping
- Create lookup maps for efficient chunk finding:
  - By chapter and chunkId
  - By text content (for fallback matching)
  - By selector range → chunk coverage

### 2. Link Enhancement
- **Source Links**: Find chunk covering `anchor.selector` range; for targets, find chunk containing `targetText` (using selector where available)
- **Target Links**: Find chunk with source link that references this target (by `linkId`)
- Use link ID matching to connect source and target pairs

### 3. Reference Resolution
- Use existing validation functions for text matching
- Handle footnote numbers and regular text references
- Fall back to text content matching if exact target text not found

## Processing Steps

1. **Create chunk mapping** from all chapters for efficient lookup
2. **For each chunk with links:**
   - Process each link based on its role
   - Add appropriate chunk reference field
   - Preserve all existing link data
3. **Validate references** to ensure chunk IDs exist
4. **Generate statistics** about resolution success rate

## Key Features

### Bidirectional References
- Source links point to target chunks via `targetChunkIndex` (array index)
- Target links point back to source chunks via `sourceChunkIndex` (array index)
- Enables navigation in both directions

### Smart Text Matching
- Uses existing footnote detection from step 5 validation
- Handles both exact target text matching and fallback content matching
- Preserves link text validation requirements

### Reference Validation
- Ensures all referenced chunk IDs actually exist
- Validates chunk ID format consistency
- Reports resolution success rates

## Validation

### Link Enhancement Requirements
- All original link fields must be preserved
- `targetChunkIndex` added to source links when target found
- `sourceChunkIndex` added to target links when source found
- Chunk references must point to valid array indexes

### Quality Metrics
- At least 50% of links should have chunk references resolved
- All referenced chunk IDs must exist in the output
- Link ID consistency between source and target pairs

### Statistics Tracking
- Total links processed
- Number of successful target chunk index assignments
- Number of successful source chunk index assignments
- Number of unresolved references

## Usage

```javascript
const step52 = require('./05-2-link-chunk-references');

// Input: chapters with sentence chunks and image chunks from step 5.1
const result = step52.execute(pipelineState);

// Output: enhanced links with chunk references
const enhancedLink = result.chapters[0].chunks[0].links[0];
console.log(enhancedLink.targetChunkIndex); // For source links (array index)
console.log(enhancedLink.sourceChunkIndex); // For target links (array index)
```

## Example Output Structure

### Source Link (Enhanced)
```json
{
  "text": "1",
  "linkId": "link_10_1",
  "role": "source",
  "anchor": {
    "chapterId": 0,
    "selector": { "start": 1205, "end": 1206 }
  },
  "targetChunkIndex": 120
}
```

### Target Link (Enhanced)
```json
{
  "text": "1",
  "linkId": "link_10_1", 
  "role": "target",
  "anchor": {
    "chapterId": 0,
    "selector": { "start": 10452, "end": 10480 }
  },
  "sourceChunkIndex": 14
}
```

## Advanced Features

### Link Pair Resolution
- Matches source and target links using `linkId`
- Handles cases where multiple chunks contain the same footnote
- Prioritizes exact target text matches over content fallbacks

### Cross-Chapter References
- Handles links that span across different chapters
- Maintains chunk ID uniqueness across the entire book
- Resolves references regardless of chapter boundaries

### Footnote Intelligence
- Leverages footnote detection patterns from step 5
- Handles numbered footnotes, citations, and cross-references
- Preserves academic text formatting requirements

## Error Handling

- **Missing Target Text**: Skips links with invalid target selector ranges
- **Text Not Found**: Reports unresolved references but continues processing
- **Invalid Link IDs**: Validates link ID format and existence
- **Circular References**: Prevents self-referencing chunks

## Quality Assurance

### Reference Integrity
- All chunk references point to valid, existing chunks
- Link relationships are bidirectional when both source and target exist
- No data loss from original link structure

### Performance Considerations
- Efficient chunk lookup using Map data structures
- Single-pass processing through all chapters
- Memory-conscious chunk mapping for large books

## Integration Notes

- Runs after Step 5.1 (image markers to chunks)
- Prepares links for Step 6 (metadata extraction)
- Compatible with existing link validation in Step 5
- Enhances reader navigation capabilities