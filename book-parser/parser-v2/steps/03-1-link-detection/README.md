# Step 3.1: Link Detection

## Overview

This step extracts and resolves PDF internal links using coordinate-based target extraction with cross-page support. It identifies source links (like footnote references) and their corresponding target destinations within the document.

## Requirements

### Input Requirements
- **Pipeline State**: Must include `chapters` with accessible text content (no page dependency)
- **PDF File**: Original PDF for coordinate-based link extraction
- **Chapter Text**: Text to match and anchor link text within

### Output Requirements
- **Link Extraction**: Identify all internal PDF links with source and target information
- **Role Classification**: Classify links as "source" or "target" based on their function
- **Anchoring (no pages)**: For each link, provide a chapter-local selector
  - `anchor.chapterId`: chapter index/id
  - `anchor.selector`: `{ start: number, end: number }` (TextPositionSelector, 0-based, end exclusive)
  - Optional (if chunk mapping is available): `anchor.chunkId` and `anchor.intraChunk` `{ start, end }`
- **Source-Target Matching**: Match source links with their corresponding targets
- **Text Association**: Associate link text using the selector range within chapter content

### Quality Standards
- Links must have valid roles ("source" or "target")
- All links must have required fields (`linkId`, `role`, `anchor.selector`)
- Source links should have matching target links
- Selector ranges must be valid and accurately map to the link text

## Implementation

### Technical Approach

The step uses **pdfjs-dist** for coordinate-based link extraction:

#### 1. PDF Annotation Processing
- Loads PDF document and extracts all internal link annotations
- Processes link coordinates and destination information
- Handles various link types and annotation formats

#### 2. Link Role Classification
- **Source Links**: Links that reference other locations (footnotes, citations, cross-references)
- **Target Links**: Destination locations that sources point to
- Uses coordinate analysis and destination types for classification

#### 3. Coordinate-Based Target Extraction
- Extracts precise target coordinates from PDF annotations
- Handles cross-page link relationships
- Supports various PDF coordinate systems and transformations

#### 4. Text Extraction and Association
- Extracts visible text at link coordinates
- Associates link text with page content
- Handles edge cases where links span multiple text elements

### Processing Steps

```javascript
1. Load PDF and extract all annotations:
   - Get all internal link annotations from PDF
   - Extract source coordinates and destination information
   - Process annotation metadata and properties

2. Classify link roles:
   - Analyze destination types and coordinate patterns
   - Classify as source (outgoing) or target (incoming) links
   - Handle bidirectional link relationships

3. Extract link text:
   - Use coordinates to extract visible text at link location
   - Handle multi-element text spans
   - Associate text with corresponding page content

4. Generate link objects:
   - Create comprehensive link metadata
   - Include coordinate information and text content
   - Assign unique link IDs for source-target matching
```

### Key Features

- **Coordinate-Based Extraction**: Uses precise PDF coordinates for accurate link detection
- **Cross-Page Support**: Handles links that span multiple pages
- **Role Classification**: Automatically determines link direction and purpose
- **Text Association**: Accurately extracts and associates link text with content
- **Flexible PDF Support**: Works with various PDF annotation formats

## Validation

### Validation Rules

The validation module (`03-1-link-detection-validation.js`) implements:

#### 1. Link Role Validation
- **Rule**: All links must have valid roles ("source" or "target")
- **Purpose**: Ensure proper link classification for processing

#### 2. Required Fields Validation
- **Rule**: All links must have `linkId`, `role`, and `anchor.selector` with `start < end`
- **Purpose**: Ensure complete link metadata for downstream processing

#### 3. Source-Target Matching Validation
- **Rule**: Each source link should have a corresponding target link
- **Purpose**: Verify link relationships are complete and valid

#### 4. Selector Validation
- **Rule**: `0 ≤ start < end ≤ chapterTextLength`; substring(chapterText, start, end) must match detected link text where applicable
- **Purpose**: Ensure link anchors reference valid positions in chapter content

#### 5. Orphaned Link Detection
- **Rule**: Warn about target links without matching sources
- **Action**: Warning (not failure) for informational purposes
- **Purpose**: Quality assurance and completeness checking

### Validation Success Criteria

- ✅ All links have valid roles and required fields
- ✅ Selector ranges are valid within chapter text
- ✅ Source-target relationships are properly established
- ✅ Link extraction is complete and accurate

## Usage

### Basic Usage
```javascript
const linkDetection = require('./03-1-link-detection');

const result = await linkDetection.execute(pipelineState, config);
const isValid = linkDetection.validate(result);
```

### Expected Input Structure
```javascript
{
  chapters: [
    {
      title: "Introduction",
      content: "Text with footnote reference 1 and citation..." // chapter-level text available for anchoring
    }
  ]
}
```

### Expected Output Structure
```javascript
{
  links: [
    {
      linkId: "link_001",
      role: "source",
      text: "1",
      anchor: {
        chapterId: 0,
        selector: { start: 1205, end: 1206 },
        // optional when chunk mapping exists:
        // chunkId: "0_145",
        // intraChunk: { start: 84, end: 85 }
      }
    },
    {
      linkId: "link_001",
      role: "target",
      text: "Reference material for footnote 1",
      anchor: {
        chapterId: 0,
        selector: { start: 10452, end: 10480 }
      }
    }
  ]
}
```

## Dependencies

- **pdfjs-dist**: PDF annotation and coordinate extraction
- **fs**: File system operations for debug output
- **path**: Path utilities for file handling

## Link Classification Strategy

### Source Link Detection
- **Footnote References**: Numeric or symbolic references in text
- **Citations**: Author-year or numbered citation formats
- **Cross-References**: "See Chapter X" or "Figure Y" references
- **Hyperlinks**: Internal document links

### Target Link Detection
- **Footnote Destinations**: Footnotes/endnotes sections within chapter content
- **Bibliography Entries**: Reference list items
- **Figure/Table Captions**: Referenced visual elements
- **Chapter/Section Headers**: Navigation targets

### Coordinate and Selector Processing
- **PDF Annotation Coordinates**: Used internally for extraction; not emitted in output
- **Text Boundary Detection**: Produces chapter-local start/end offsets
- **Multi-Element Spans**: Handles links spanning multiple text elements

## Debug Output

The step generates detailed debug information:
- Complete link annotation data from PDF
- Coordinate extraction and text association results
- Role classification decisions and reasoning
- Source-target matching results and statistics

## Error Handling

- **PDF Access Errors**: Graceful handling when PDF cannot be processed
- **Annotation Extraction Failures**: Robust error handling for malformed annotations
- **Coordinate Processing Errors**: Safe handling of invalid coordinates
- **Text Extraction Issues**: Fallback strategies for text association problems

## Quality Assurance

### Link Accuracy
- Validates extracted links point to correct destinations
- Ensures link text is accurately captured
- Verifies coordinate-based extraction is precise

### Completeness Checking
- Reports statistics on link extraction coverage
- Identifies potential missing links or incomplete relationships
- Provides quality metrics for manual review

## Performance Considerations

- **Efficient PDF Processing**: Optimized annotation extraction algorithms
- **Memory Management**: Processes links incrementally for large documents
- **Coordinate Caching**: Caches coordinate calculations for performance

## Advanced Features

### Cross-Chapter/Section Link Support
- Handles links that reference content in other chapters/sections
- Maintains accurate selector-based associations without page numbers
- Supports complex document navigation structures

### Multiple Link Types
- **Internal Links**: Within-document navigation
- **Footnote Links**: Academic and reference footnotes
- **Citation Links**: Bibliography and reference connections
- **Cross-Reference Links**: Chapter, figure, and table references

### Text Association Intelligence
- **Precise Text Extraction**: Uses coordinates for accurate text capture
- **Context Awareness**: Considers surrounding text for better association
- **Multi-Format Support**: Handles various text formatting and styles 