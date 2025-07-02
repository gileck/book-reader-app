# PDF Book Parser

A modular PDF book parser that extracts structured content from PDF books, including chapters, images, links, and table of contents. The parser breaks down complex PDF processing into focused, maintainable modules.

## Overview

The parser processes PDF books through 9 main steps:

1. **PDF Content Parsing** - Extract basic text and metadata from PDF
2. **Book Metadata Extraction** - Extract book title, author, and page count
3. **Image Extraction** - Extract embedded images from PDF pages
4. **Link Extraction** - Extract internal links and references
5. **Chapter Detection** - Detect and organize chapters from content
6. **Text Chunking** - Process chapter content into manageable text chunks
7. **Page-Aware Processing** - Associate chunks with links and images with chapters
8. **Link Resolution** - Resolve links to target chunks
9. **Link Validation** - Validate link destinations and accuracy

## Architecture

The parser is organized into focused modules within a structured directory layout:

```
book-parser/parser/
├── index.js                     # Main orchestrator with comprehensive debug output
├── README.md                    # This documentation
└── steps/                       # Processing modules directory
    ├── config-loader.js         # Configuration loading
    ├── metadata-extractor.js    # Book metadata extraction
    ├── image-extractor.js       # Image extraction from PDF
    ├── link-extractor.js        # Internal link extraction
    ├── toc-extractor.js         # Table of contents extraction
    ├── chapter-detector.js      # Chapter detection logic
    ├── text-processor.js        # Text processing and chunking
    ├── chunk-processor.js       # Page-aware chunk processing
    ├── link-resolver.js         # Link resolution and validation
    ├── data-formatter.js        # Database format conversion
    ├── file-utils.js            # File I/O operations
    └── pdf-preprocessor.js      # PDF preprocessing utilities
```

**Main Orchestrator:** `index.js` contains the complete orchestration logic with comprehensive debug output - it imports and calls functions from the `steps/` modules while generating detailed debug files for each processing step.

**Processing Modules:** Each module in the `steps/` directory handles a specific processing step with clear input/output contracts and comprehensive documentation.

**Debug Output:** The parser generates detailed debug files for each step, saved to a `debug/` folder in the same directory as the input PDF.

### Processing Flow
```
index.js (Main Orchestrator)
├── steps/config-loader.js          (Step 1: Configuration)
├── steps/metadata-extractor.js     (Step 2: Book Metadata) 
├── steps/image-extractor.js        (Step 3: Image Extraction)
├── steps/link-extractor.js         (Step 4: Link Extraction)
├── steps/chapter-detector.js       (Step 5: Chapter Detection)
├── steps/text-processor.js         (Step 6: Text Chunking)
├── steps/chunk-processor.js        (Step 7: Page-Aware Processing)
├── steps/link-resolver.js          (Step 8: Link Resolution)
└── steps/link-resolver.js          (Step 9: Link Validation)
```

**Enhanced Debugging:** Each step generates comprehensive debug output saved as JSON files, making it easy to trace processing and troubleshoot issues.

## Quick Start

```bash
# Basic usage with defaults
node index.js book.pdf

# With custom configuration
node index.js book.pdf config.json

# With custom output path
node index.js book.pdf config.json output.json

# Debug mode (generates detailed debug files for each step)
node index.js book.pdf config.json output.json --debug
```

---



## Step 1: Configuration Loading

**File:** `steps/config-loader.js`

**Purpose:** Load and validate parsing configuration, providing defaults when needed.

### Input/Output Example

**Input:**
```json
// config.json (optional)
{
  "chapterNames": ["Introduction", "Methods", "Results"],
  "chapterPatterns": ["^chapter\\s+(\\d+)\\b"],
  "metadata": {
    "title": "My Research Book",
    "author": "Dr. Smith"
  }
}
```

**Output:**
```javascript
{
  chapterNames: ["Introduction", "Methods", "Results"],
  chapterPatterns: [
    "^chapter\\s+(\\d+|one|two|three)\\b",
    "^(\\d+)\\.\\s+([A-Za-z][a-zA-Z\\s]{8,40})$"
  ],
  excludePatterns: ["^(appendix|bibliography)$"],
  skipFrontMatter: true,
  metadata: { title: "My Research Book", author: "Dr. Smith" }
}
```

### Key Functions

```javascript
// Load configuration with fallback to defaults
function loadBookConfig(configPath) {
    if (!configPath || !fs.existsSync(configPath)) {
        return getDefaultConfig();
    }
    
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return {
        ...getDefaultConfig(),
        ...config,
        metadata: { ...getDefaultConfig().metadata, ...(config.metadata || {}) }
    };
}
```

---

## Step 2: Metadata Extraction

**File:** `steps/metadata-extractor.js`

**Purpose:** Extract book metadata from parsed PDF data and configuration.

**Input/Output Example:**
```javascript
// Input
const pdfData = { info: { Title: "Sample Book", Author: "John Doe" }, numpages: 200 };
const filename = "sample.pdf";
const config = { metadata: { title: "Custom Title" } };

// Output
const metadata = extractBookMetadata(pdfData, filename, config);
// Returns: { title: "Custom Title", author: "John Doe", pageCount: 200, ... }
```

**Key Functions:**
```javascript
/**
 * Extract book metadata from PDF data and configuration
 * @param {Object} pdfData - Parsed PDF data from pdf-parse
 * @param {string} filename - Original PDF filename
 * @param {Object} config - Book configuration object
 * @returns {Object} Book metadata object
 */
function extractBookMetadata(pdfData, filename, config) {
    const info = pdfData.info || {};
    const title = config.metadata?.title || info.Title || filename.replace(/\.pdf$/i, '');
    const author = config.metadata?.author || info.Author || 'Unknown';
    
    return { title, author, creationDate: info.CreationDate, pageCount: pdfData.numpages, filename };
}
```

---

## Step 3: Image Extraction

**File:** `steps/image-extractor.js`

**Purpose:** Extract embedded images from PDF and save them to organized folders.

### Input/Output Example

**Input:**
- PDF file: `research-book.pdf`
- Book title: `"Advanced Research Methods"`
- Book folder: `/path/to/Advanced-Research-Methods/`

**Output:**
```javascript
{
  images: [
    {
      pageNumber: 15,
      imageName: "page-015-image-1.jpg",
      imageAlt: "Figure 1 (Page 15)",
      originalName: "image-000.jpg",
      extracted: true
    },
    {
      pageNumber: 23,
      imageName: "page-023-image-1.jpg", 
      imageAlt: "Figure 2 (Page 23)",
      originalName: "image-001.jpg",
      extracted: true
    }
  ],
  imagesFolderPath: "/path/to/Advanced-Research-Methods/images/Advanced-Research-Methods/"
}
```

### Key Functions

```javascript
// Main extraction function
async function extractImages(pdfPath, bookTitle, bookFolderPath) {
    console.log('🖼️  Extracting embedded images from PDF...');
    
    // Create organized directory structure
    const imagesDir = path.join(bookFolderPath, 'images', bookTitle.replace(/[^a-zA-Z0-9]/g, '-'));
    
    // Scan pages for image locations using PDF.js
    const pdf = await pdfjsLib.getDocument(pdfBuffer).promise;
    const pageImageMap = [];
    
    // Extract images using pdfimages command-line tool
    execSync(`pdfimages -all "${pdfPath}" "${tempPrefix}"`);
    
    // Correlate extracted files with page locations
    return { images, imagesFolderPath: imagesDir };
}
```

---

## Step 4: Link Extraction

**File:** `steps/link-extractor.js`

**Purpose:** Extract internal links, footnotes, and cross-references from PDF.

### Input/Output Example

**Input:**
- PDF with internal links and annotations

**Output:**
```javascript
[
  {
    text: "see page 45",
    pageNumber: 12,
    targetPage: 45,
    coordinates: { x: 150, y: 200 },
    navigationType: "page_reference",
    searchPattern: "research methodology",
    linkType: "internal"
  },
  {
    text: "¹",
    pageNumber: 23,
    targetPage: 156,
    coordinates: { x: 89, y: 300 },
    navigationType: "footnote",
    searchPattern: "¹.*important.*study",
    linkType: "footnote"
  }
]
```

### Key Functions

```javascript
// Main link extraction function
async function extractInternalLinks(pdfPath) {
    console.log('🔗 Extracting internal links...');
    
    const pdf = await pdfjsLib.getDocument(fs.readFileSync(pdfPath)).promise;
    const links = [];
    
    // Process each page for annotations and links
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const annotations = await page.getAnnotations();
        
        for (const annotation of annotations) {
            if (annotation.subtype === 'Link' && annotation.dest) {
                const link = await processLinkAnnotation(annotation, page, pdf);
                if (link) links.push(link);
            }
        }
    }
    
    return validateLinkDestinations(links);
}

// Generate smart search patterns for footnotes
function generateSearchPattern(linkText) {
    if (/^[\d+]+$/.test(linkText)) {
        // Footnote number - create pattern to find footnote text
        return `^${escapeRegExp(linkText)}[\\s\\.:]+(.{10,100})`;
    } else if (linkText.toLowerCase().includes('page')) {
        // Page reference - extract topic context
        return extractTopicFromContext(linkText);
    }
    
    return escapeRegExp(linkText);
}
```

---

## Step 5: Chapter Detection

**File:** `steps/chapter-detector.js`

**Purpose:** Detect chapters using TOC data or pattern-based text analysis.

### Input/Output Example

**Input:**
```javascript
// Text content and TOC data
{
  text: "Chapter 1: Introduction\n\nThis is the introduction...\n\nChapter 2: Methods\n\nThe methodology section...",
  tocChapters: [
    { title: "Introduction", pageNumber: 1, chapterNumber: 1 },
    { title: "Methods", pageNumber: 15, chapterNumber: 2 }
  ]
}
```

**Output:**
```javascript
[
  {
    number: 1,
    title: "Introduction", 
    content: "This is the introduction...",
    startPageNumber: 1,
    endPageNumber: 14,
    chunks: [
      {
        text: "This is the introduction...",
        pageNumber: 1,
        type: "text"
      }
    ]
  },
  {
    number: 2,
    title: "Methods",
    content: "The methodology section...",
    startPageNumber: 15,
    endPageNumber: 30,  
    chunks: [
      {
        text: "The methodology section...",
        pageNumber: 15,
        type: "text"
      }
    ]
  }
]
```

### Key Functions

```javascript
// Main chapter detection with multiple strategies
async function detectChapters(text, config, pdfPath = null) {
    console.log('📖 Detecting chapters...');
    
    // Strategy 1: Use TOC data if available
    if (pdfPath) {
        const tocChapters = await extractTOCFromPdf(pdfPath);
        if (tocChapters.length > 0) {
            return await extractChapterContentFromTOC(tocChapters, text, pdfPath, config);
        }
    }
    
    // Strategy 2: Pattern-based detection
    return detectChaptersFromText(text, config);
}

// Extract chapter content using TOC boundaries
async function extractChapterContentFromTOC(tocChapters, fullText, pdfPath, config) {
    const chapters = [];
    
    for (let i = 0; i < tocChapters.length; i++) {
        const chapter = tocChapters[i];
        const nextChapter = tocChapters[i + 1];
        
        // Determine chapter boundaries
        const startPattern = new RegExp(escapeRegExp(chapter.title), 'i');
        const endPattern = nextChapter ? new RegExp(escapeRegExp(nextChapter.title), 'i') : null;
        
        const content = extractContentBetweenPatterns(fullText, startPattern, endPattern);
        const chunks = chunkText(content);
        
        chapters.push({
            number: chapter.chapterNumber,
            title: chapter.title,
            content: content,
            chunks: chunks
        });
    }
    
    return chapters;
}
```

---

## Step 6: Text Processing

**File:** `steps/text-processor.js`

**Purpose:** Process raw PDF text into clean, structured chunks with intelligent paragraph boundary detection and proper sentence handling.

### Recent Improvements (2024)

**🔧 Fixed Sentence Splitting Issues:**
- **Problem**: Sentences were being improperly split mid-sentence (e.g., "Yet" ending one chunk, "at night they light up..." starting the next)
- **Solution**: Completely rewrote `createChunksFromText` function to respect natural paragraph boundaries and never break sentences

**🔧 Paragraph Boundary Detection:**
- **Respects LINE_BREAK Markers**: Algorithm now splits text by `⟨⟨LINE_BREAK⟩⟩` markers to identify natural paragraph segments
- **Natural Chunking**: Creates chunks at the end of paragraph segments when they have sufficient words (80-300 words)
- **Sentence Integrity**: Never breaks sentences across chunks - processes complete sentences within their paragraph context

### Input/Output Example

**Input:**
```text
"Chapter 1: Introduction ⟨⟨LINE_BREAK⟩⟩ This is the first paragraph of the introduction. It contains important information about the research methodology. The paragraph continues with more detailed explanations. ⟨⟨LINE_BREAK⟩⟩ The second paragraph begins a new topic. It discusses different aspects of the research approach."
```

**Output:**
```javascript
[
  {
    index: 0,
    text: "This is the first paragraph of the introduction. It contains important information about the research methodology. The paragraph continues with more detailed explanations.",
    wordCount: 85,
    type: "text",
    pageNumber: 1
  },
  {
    index: 1,
    text: "The second paragraph begins a new topic. It discusses different aspects of the research approach.",
    wordCount: 92,
    type: "text", 
    pageNumber: 1
  }
]
```

### Key Functions

```javascript
// Advanced text chunking that respects paragraph boundaries and sentence integrity
function createChunksFromText(text, minWords, maxWords, startingGlobalIndex) {
    if (!text || text.trim().length === 0) return [];

    // Split by LINE_BREAK markers to get natural paragraph segments
    const segments = text.split(' ⟨⟨LINE_BREAK⟩⟩ ').filter(seg => seg.trim().length > 0);
    
    const chunks = [];
    let chunkIndex = 0;
    let currentChunk = '';
    let currentWords = [];

    for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex++) {
        const segment = segments[segmentIndex].trim();
        
        // Split segment into sentences using intelligent sentence detection
        const sentences = splitIntoSentences(segment);

        // Process sentences in this segment
        for (let sentenceIndex = 0; sentenceIndex < sentences.length; sentenceIndex++) {
            const sentence = sentences[sentenceIndex];
            const sentenceWords = sentence.split(/\s+/).filter(w => w.length > 0);

            // Add sentence to current chunk
            if (currentChunk) currentChunk += ' ';
            currentChunk += sentence;
            currentWords = currentWords.concat(sentenceWords);

            // Check if we should create a chunk
            const isLastSentenceInSegment = sentenceIndex === sentences.length - 1;
            const hasEnoughWords = currentWords.length >= minWords;

            // Create chunk if:
            // 1. We have enough words AND it's the end of a segment (natural paragraph break)
            // 2. OR we've reached maxWords
            // 3. OR it's the very last chunk
            if ((hasEnoughWords && isLastSentenceInSegment) || 
                currentWords.length >= maxWords || 
                (segmentIndex === segments.length - 1 && sentenceIndex === sentences.length - 1)) {
                
                chunks.push({
                    index: startingGlobalIndex + chunkIndex,
                    text: currentChunk.trim(),
                    wordCount: currentWords.length,
                    type: 'text'
                });

                chunkIndex++;
                currentChunk = '';
                currentWords = [];
            }
        }
    }

    return chunks;
}

// Intelligent sentence splitting that handles abbreviations and edge cases
function splitIntoSentences(text) {
    const sentences = [];
    let currentSentence = '';
    const words = text.split(/\s+/);

    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        currentSentence += (currentSentence ? ' ' : '') + word;

        // Check if this word ends a sentence
        if (/[.!?]+$/.test(word)) {
            const nextWord = words[i + 1];
            const isAbbreviation = endsWithAbbreviation(currentSentence);
            const nextIsLowercase = nextWord && /^[a-z]/.test(nextWord);

            if (!isAbbreviation || !nextIsLowercase) {
                sentences.push(currentSentence.trim());
                currentSentence = '';
            }
        }
    }

    // Add any remaining text as a sentence
    if (currentSentence.trim()) {
        sentences.push(currentSentence.trim());
    }

    return sentences;
}

// Clean common PDF artifacts
function cleanPageNumbers(text, pageNumber = null) {
    return text
        .replace(/^\s*\d+\s*$/gm, '') // Remove standalone page numbers
        .replace(/^\s*Page\s+\d+\s*$/gm, '') // Remove "Page N"
        .trim();
}
```

### Chunk Size Management

- **Target Range**: 80-300 words per chunk
- **Natural Boundaries**: Respects paragraph breaks marked by `⟨⟨LINE_BREAK⟩⟩`
- **Sentence Integrity**: Never splits sentences across chunks
- **Flexible Sizing**: Allows chunks to exceed maxWords if needed to preserve sentence boundaries

### Debug Output

The text processor generates comprehensive debug files:
- `smart-paragraph-debug.txt` - Paragraph detection analysis
- `text-processing-debug.txt` - Sentence splitting details
- `chunk-processing-debug.txt` - Final chunk creation process

---

## Step 7: Page-Aware Processing

**File:** `steps/chunk-processor.js`

**Purpose:** Create page-aware chunks with associated links and add images to chapters.

---

## Step 8: Link Resolution

**File:** `steps/link-resolver.js`

**Purpose:** Resolve extracted links to specific text chunks using coordinates and content matching.

### Input/Output Example

**Input:**
- PDF with bookmarks or TOC page text

**Output:**
```javascript
[
  {
    title: "Introduction",
    pageNumber: 1,
    level: 1,
    chapterNumber: 1
  },
  {
    title: "Literature Review", 
    pageNumber: 15,
    level: 1,
    chapterNumber: 2
  },
  {
    title: "Research Design",
    pageNumber: 15,
    level: 2,
    chapterNumber: null
  },
  {
    title: "Methodology",
    pageNumber: 35,
    level: 1, 
    chapterNumber: 3
  }
]
```

### Key Functions

```javascript
// Main TOC extraction with fallback methods
async function extractTOCFromPdf(pdfPath) {
    console.log('📑 Extracting table of contents...');
    
    const pdf = await pdfjsLib.getDocument(fs.readFileSync(pdfPath)).promise;
    
    // Method 1: Try PDF bookmarks/outline
    if (pdf.outline && pdf.outline.length > 0) {
        return await extractBookmarks(pdf.outline, pdf);
    }
    
    // Method 2: Parse TOC from text content
    const tocChapters = await parseTOCFromText(pdf);
    return tocChapters;
}

// Parse chapter information from bookmark titles
function parseChapterFromBookmark(title) {
    const patterns = [
        /^chapter\s+(\d+):?\s*(.+)/i,
        /^(\d+)\.\s+(.+)/,
        /^([ivx]+)\.\s+(.+)/i
    ];
    
    for (const pattern of patterns) {
        const match = title.match(pattern);
        if (match) {
            return {
                number: parseInt(match[1]) || match[1],
                title: match[2].trim()
            };
        }
    }
    return { number: null, title: title.trim() };
}
```

---

## Step 6: Chapter Detection

**File:** `chapter-detector.js`

**Purpose:** Detect chapters using TOC data or pattern-based text analysis.

### Input/Output Example

**Input:**
```javascript
// Text content and TOC data
{
  text: "Chapter 1: Introduction\n\nThis is the introduction...\n\nChapter 2: Methods\n\nThe methodology section...",
  tocChapters: [
    { title: "Introduction", pageNumber: 1, chapterNumber: 1 },
    { title: "Methods", pageNumber: 15, chapterNumber: 2 }
  ]
}
```

**Output:**
```javascript
[
  {
    number: 1,
    title: "Introduction", 
    content: "This is the introduction...",
    startPageNumber: 1,
    endPageNumber: 14,
    chunks: [
      {
        text: "This is the introduction...",
        pageNumber: 1,
        type: "text"
      }
    ]
  },
  {
    number: 2,
    title: "Methods",
    content: "The methodology section...",
    startPageNumber: 15,
    endPageNumber: 30,  
    chunks: [
      {
        text: "The methodology section...",
        pageNumber: 15,
        type: "text"
      }
    ]
  }
]
```

### Key Functions

```javascript
// Main chapter detection with multiple strategies
async function detectChapters(text, config, pdfPath = null) {
    console.log('📖 Detecting chapters...');
    
    // Strategy 1: Use TOC data if available
    if (pdfPath) {
        const tocChapters = await extractTOCFromPdf(pdfPath);
        if (tocChapters.length > 0) {
            return await extractChapterContentFromTOC(tocChapters, text, pdfPath, config);
        }
    }
    
    // Strategy 2: Pattern-based detection
    return detectChaptersFromText(text, config);
}

// Extract chapter content using TOC boundaries
async function extractChapterContentFromTOC(tocChapters, fullText, pdfPath, config) {
    const chapters = [];
    
    for (let i = 0; i < tocChapters.length; i++) {
        const chapter = tocChapters[i];
        const nextChapter = tocChapters[i + 1];
        
        // Determine chapter boundaries
        const startPattern = new RegExp(escapeRegExp(chapter.title), 'i');
        const endPattern = nextChapter ? new RegExp(escapeRegExp(nextChapter.title), 'i') : null;
        
        const content = extractContentBetweenPatterns(fullText, startPattern, endPattern);
        const chunks = chunkText(content);
        
        chapters.push({
            number: chapter.chapterNumber,
            title: chapter.title,
            content: content,
            chunks: chunks
        });
    }
    
    return chapters;
}
```

---

## Step 7: Link Extraction

**File:** `link-extractor.js`

**Purpose:** Extract internal links, footnotes, and cross-references from PDF.

### Input/Output Example

**Input:**
- PDF with internal links and annotations

**Output:**
```javascript
[
  {
    text: "see page 45",
    pageNumber: 12,
    targetPage: 45,
    coordinates: { x: 150, y: 200 },
    navigationType: "page_reference",
    searchPattern: "research methodology",
    linkType: "internal"
  },
  {
    text: "¹",
    pageNumber: 23,
    targetPage: 156,
    coordinates: { x: 89, y: 300 },
    navigationType: "footnote",
    searchPattern: "¹.*important.*study",
    linkType: "footnote"
  }
]
```

### Key Functions

```javascript
// Main link extraction function
async function extractInternalLinks(pdfPath) {
    console.log('🔗 Extracting internal links...');
    
    const pdf = await pdfjsLib.getDocument(fs.readFileSync(pdfPath)).promise;
    const links = [];
    
    // Process each page for annotations and links
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const annotations = await page.getAnnotations();
        
        for (const annotation of annotations) {
            if (annotation.subtype === 'Link' && annotation.dest) {
                const link = await processLinkAnnotation(annotation, page, pdf);
                if (link) links.push(link);
            }
        }
    }
    
    return validateLinkDestinations(links);
}

// Generate smart search patterns for footnotes
function generateSearchPattern(linkText) {
    if (/^[\d+]+$/.test(linkText)) {
        // Footnote number - create pattern to find footnote text
        return `^${escapeRegExp(linkText)}[\\s\\.:]+(.{10,100})`;
    } else if (linkText.toLowerCase().includes('page')) {
        // Page reference - extract topic context
        return extractTopicFromContext(linkText);
    }
    
    return escapeRegExp(linkText);
}
```

---

## Step 8: Link Resolution

**File:** `link-resolver.js`

**Purpose:** Resolve extracted links to specific text chunks using coordinates and content matching. Returns simplified link objects containing only essential navigation data.

### Input/Output Example

**Input:**
```javascript
// Links and chunks from previous steps
{
  links: [
    {
      linkText: "see methodology",
      pageNumber: 12,
      destinationPage: 45,
      destinationCoordinates: { x: 72, y: 400, zoom: 0 },
      navigationType: "coordinate"
    }
  ],
  chunks: [
    {
      index: 156,
      chapterNumber: 3,
      text: "The research methodology involves...",
      pageNumber: 45
    }
  ]
}
```

**Output:**
```javascript
[
  {
    text: "see methodology",
    targetChunk: 156,
    chapterNumber: 3
  }
]
```

### Key Functions

```javascript
// Main link resolution function - returns simplified links
function resolveLinksToTargetChunks(links, allChunks) {
    const enhancedLinks = [];
    const targetChunkIds = new Set();

    for (const link of links) {
        const destinationInfo = findDestinationChunk(link, allChunks);

        if (destinationInfo) {
            // Create simplified link with only essential data
            const enhancedLink = {
                text: link.linkText || link.text,
                targetChunk: destinationInfo.chunk.index,
                chapterNumber: destinationInfo.chunk.chapterNumber
            };

            enhancedLinks.push(enhancedLink);
            targetChunkIds.add(destinationInfo.chunk.index);
        }
        // Skip links without valid target chunks
    }

    // Mark target chunks with targetLink property
    allChunks.forEach(chunk => {
        if (targetChunkIds.has(chunk.index)) {
            chunk.targetLink = true;
        }
    });

    return enhancedLinks;
}

// Multi-strategy chunk finding with coordinate, pattern, and text search
function findDestinationChunk(link, chunks) {
    const destinationChunks = chunks.filter(chunk => chunk.pageNumber === link.destinationPage);

    if (destinationChunks.length === 0) {
        return null;
    }

    // Method 1: Use coordinates if available
    if (link.destinationCoordinates) {
        const { x, y } = link.destinationCoordinates;
        const coordMatches = findChunksByCoordinates(destinationChunks, x, y);

        if (coordMatches.length > 0) {
            return {
                chunk: coordMatches[0],
                method: 'coordinates',
                confidence: 'high'
            };
        }
    }

    // Method 2: Use search pattern
    if (link.navigation && link.navigation.searchPattern) {
        const pattern = new RegExp(link.navigation.searchPattern, 'i');

        for (const chunk of destinationChunks) {
            if (pattern.test(chunk.text)) {
                return {
                    chunk,
                    method: 'pattern',
                    confidence: 'medium'
                };
            }
        }
    }

    // Method 3: Simple text search
    for (const chunk of destinationChunks) {
        if (chunk.text.includes(link.text)) {
            return {
                chunk,
                method: 'text_search',
                confidence: 'low'
            };
        }
    }

    // Method 4: Return first chunk on page as fallback
    return {
        chunk: destinationChunks[0],
        method: 'page_fallback',
        confidence: 'very_low'
    };
}
```

---

## Step 9: Link Validation

**File:** `link-resolver.js`

**Purpose:** Validate resolved links to ensure they point to valid destination chunks. Returns only successfully resolved links with clean structure.

**Input/Output Example:**
```javascript
// Input - resolved links from Step 8
const resolvedLinks = [
  {
    text: "see methodology",
    targetChunk: 156,
    chapterNumber: 3
  },
  {
    text: "invalid link",
    targetChunk: null,
    chapterNumber: null
  }
];

// Output - only valid links are returned
const validLinks = [
  {
    text: "see methodology", 
    targetChunk: 156,
    chapterNumber: 3
  }
];
// Invalid links are filtered out during validation
```

**Key Functions:**
```javascript
/**
 * Create page-aware chunks with associated links and add images to chapters
 * @param {Array} chapters - Array of chapter objects with chunks
 * @param {Array} images - Array of extracted images with page numbers
 * @param {Array} links - Array of extracted links with page numbers
 * @returns {Array} All chunks with associated links (images added to parent chapters)
 */
function createPageAwareChunksWithImages(chapters, images, links = []) {
    const allChunks = [];
    let chunkId = 1;
    
    chapters.forEach(chapter => {
        // Map chapter page properties from chapter detection
        if (!chapter.startPageNumber && chapter.startingPage) {
            chapter.startPageNumber = chapter.startingPage;
        }
        if (!chapter.endPageNumber && chapter.endingPage) {
            chapter.endPageNumber = chapter.endingPage;
        }
        
        // Add images to chapter based on page range
        chapter.images = [];
        if (chapter.startPageNumber && chapter.endPageNumber) {
            for (let pageNum = chapter.startPageNumber; pageNum <= chapter.endPageNumber; pageNum++) {
                const pageImages = images.filter(img => img.pageNumber === pageNum);
                pageImages.forEach(img => {
                    chapter.images.push({
                        imageName: img.imageName,
                        pageNumber: img.pageNumber
                    });
                });
            }
        }
        
        // Calculate page numbers for chunks based on their position in the chapter
        const chapterPageRange = chapter.endPageNumber - chapter.startPageNumber + 1;
        const chunksPerPage = Math.ceil(chapter.chunks.length / chapterPageRange);
        
        // Process chunks and assign page numbers
        chapter.chunks.forEach((chunk, index) => {
            chunk.id = chunkId++;
            chunk.chapterNumber = chapter.number;
            chunk.chapterTitle = chapter.title;
            chunk.links = [];
            
            // Assign page number based on chunk position within chapter
            if (!chunk.pageNumber) {
                const pageIndex = Math.floor(index / chunksPerPage);
                chunk.pageNumber = chapter.startPageNumber + Math.min(pageIndex, chapterPageRange - 1);
            }
            
            // Associate links with chunks by page number
            if (chunk.pageNumber) {
                const pageLinks = links.filter(link => link.pageNumber === chunk.pageNumber);
                chunk.links = pageLinks.map(link => ({
                    text: link.text,
                    targetPage: link.targetPage,
                    navigationType: link.navigationType,
                    searchPattern: link.searchPattern
                }));
            }
            
            allChunks.push(chunk);
        });
    });
    
    return allChunks;
}
```

### Step 10: Data Formatting

**File:** `steps/data-formatter.js`

**Purpose:** Convert parsed chapters to database-ready format with proper structure and metadata. Images are included at the chapter level.

**Input/Output Example:**
```javascript
// Input
const chapters = [{ 
    number: 1, title: "Introduction", content: "...", chunks: [...],
    images: [{ imageName: "page-005-image-1.jpg", pageNumber: 5 }]
}];

// Output
const dbChapters = convertChaptersToDbFormat(chapters);
// Returns: Array with { number, title, startPageNumber, endPageNumber, chunkCount, wordCount, images, chunks }
```

**Key Functions:**
```javascript
/**
 * Convert chapters to database format with proper structure and metadata
 * @param {Array} chapters - Array of chapter objects from parsing
 * @returns {Array} Chapters formatted for database storage
 */
function convertChaptersToDbFormat(chapters) {
    return chapters.map(chapter => ({
        number: chapter.number,
        title: chapter.title,
        startPageNumber: chapter.startPageNumber,
        endPageNumber: chapter.endPageNumber,
        chunkCount: chapter.chunks ? chapter.chunks.length : 0,
        wordCount: chapter.content ? chapter.content.split(/\s+/).length : 0,
        images: chapter.images || [], // Chapter-level images with imageName and pageNumber
        chunks: chapter.chunks?.map(chunk => ({ 
            id: chunk.id, 
            text: chunk.text, 
            pageNumber: chunk.pageNumber,
            type: chunk.type || 'text',
            coordinates: chunk.coordinates,
            links: chunk.links || [] // Only links, no images in chunks
        }))
    }));
}
```

### Step 11: File Operations

**File:** `steps/file-utils.js`

**Purpose:** Handle file I/O operations for saving parsed book data and generating summaries.

**Input/Output Example:**
```javascript
// Save output file
saveToFile(book, chapters, 'output.json', '/path/to/images');

// Generate summary
generateParserSummary(book, chapters, 'summary.json');
```

**Key Functions:**
```javascript
/**
 * Save parsed book data to output file
 * @param {Object} book - Book metadata object
 * @param {Array} chapters - Array of parsed chapters
 * @param {string} outputPath - Path to save the output file
 * @param {string} imagesFolderPath - Path to the images folder
 */
function saveToFile(book, chapters, outputPath, imagesFolderPath) {
    const output = { book, chapters, metadata: { parsingDate: new Date().toISOString() } };
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
}

/**
 * Generate and save parser summary with processing statistics
 * @param {Object} book - Book metadata object
 * @param {Array} chapters - Array of parsed chapters
 * @param {string} summaryPath - Path to save the summary file
 */
function generateParserSummary(book, chapters, summaryPath) {
    const summary = {
        book: { title: book.title, author: book.author, pageCount: book.pageCount },
        processing: { totalChapters: chapters.length, totalWords: ..., totalImages: ... },
        chapters: chapters.map(ch => ({ number: ch.number, title: ch.title, wordCount: ch.wordCount }))
    };
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
}
```

---

## Main Orchestrator

**File:** `index.js`

**Purpose:** Coordinate all parsing steps, produce final structured output, and generate comprehensive debug files for each step.

### Complete Processing Flow

**Enhanced Orchestration:** The main file imports functions from the `steps/` modules and coordinates their execution while generating detailed debug output for each step.

```javascript
async function parsePdfBook(pdfPath, configPath, debugMode = false) {
    const startTime = Date.now();
    const config = loadBookConfig(configPath);

    // Create debug folder for step-by-step output
    const debugFolder = path.join(path.dirname(pdfPath), 'debug');
    
    // Step 1: Parse PDF content
    const pdfData = await pdfParse(fs.readFileSync(pdfPath));
    // Debug: Save step1-pdf-data.json
    
    // Step 2: Extract book metadata (steps/metadata-extractor.js)
    const book = extractBookMetadata(pdfData, path.basename(pdfPath), config);
    // Debug: Save step2-book-metadata.json
    
    // Step 3: Extract images (steps/image-extractor.js)
    const { images, imagesFolderPath } = await extractImages(pdfPath, book.title, bookFolderPath);
    // Debug: Save step3-extracted-images.json
    
    // Step 4: Extract internal links (steps/link-extractor.js)
    const links = await extractInternalLinks(pdfPath);
    // Debug: Save step4-extracted-links.json
    
    // Step 5: Detect chapters (steps/chapter-detector.js)
    const chapters = await detectChapters(pdfData.text, config, pdfPath);
    // Debug: Save step5-detected-chapters.json
    
    // Step 6: Process chapters into chunks (steps/text-processor.js)
    chapters.forEach(chapter => {
        if (Array.isArray(chapter.content)) {
            const contentText = chapter.content.join(' ');
            chapter.chunks = chunkText(contentText, 5, 15);
            chapter.content = contentText;
        } else {
            chapter.chunks = chunkText(chapter.content, 5, 15);
        }
    });
    // Debug: Save step6-chapters-with-chunks.json
    
    // Step 7: Create page-aware chunks (steps/chunk-processor.js)
    const allChunks = createPageAwareChunksWithImages(chapters, images, links);
    // Debug: Save step7-page-aware-chunks.json
    
    // Step 8: Resolve links to target chunks (steps/link-resolver.js)
    const resolvedLinks = resolveLinksToTargetChunks(links, allChunks);
    // Debug: Save step8-resolved-links.json
    
    // Step 9: Validate link destinations (steps/link-resolver.js)
    const validLinks = validateLinkDestinations(resolvedLinks, chapters);
    // Debug: Save step9-validated-links.json
    
    return {
        book,
        chapters: convertChaptersToDbFormat(chapters),
        images,
        links: validLinks,
        processingTime: Date.now() - startTime,
        imagesFolderPath
    };
}

// Main execution with file operations (steps/file-utils.js)
async function main() {
    const result = await parsePdfBook(pdfPath, configPath, debugMode);
    saveToFile(result.book, result.chapters, outputPath, result.imagesFolderPath, result.links);
    generateParserSummary(result.book, result.chapters, summaryPath);
}
```

---

## Output Format

The parser produces a comprehensive JSON structure:

```javascript
{
  "book": {
    "title": "Advanced Research Methods",
    "author": "Dr. Smith", 
    "pageCount": 245,
    "filename": "research-book.pdf"
  },
  "chapters": [
    {
      "number": 1,
      "title": "Introduction",
      "startPageNumber": 1,
      "endPageNumber": 14,
      "wordCount": 2543,
      "chunkCount": 45,
      "images": [
        {
          "imageName": "page-005-image-1.jpg",
          "pageNumber": 5
        },
        {
          "imageName": "page-012-image-1.jpg",
          "pageNumber": 12
        }
      ],
      "chunks": [
        {
          "id": 1,
          "text": "This is the first chunk of text...", 
          "pageNumber": 1,
          "type": "text",
          "coordinates": { "x": 72, "y": 720, "width": 450, "height": 12 },
          "links": [
            {
              "text": "see methodology",
              "targetChunk": 156,
              "chapterNumber": 3
            }
          ]
        }
      ]
    }
  ],
  "images": [...],
  "links": [...],
  "metadata": {
    "parsingDate": "2024-01-15T10:30:00.000Z",
    "imagesFolderPath": "/path/to/images/"
  }
}
```

### Key Structure Changes

**Simplified Links:** Links now contain only essential navigation data - `text`, `targetChunk`, and `chapterNumber`. All other fields (coordinates, navigation type, validation flags, etc.) have been removed for a clean, focused structure.

**Target Chunk Navigation:** Links use a single navigation type via `targetChunk` index. Target chunks are marked with `targetLink: true` property internally for identification.

**Images at Chapter Level:** Images are now organized at the chapter level instead of individual chunks. Each chapter contains an `images` array with all images that appear within the chapter's page range.

**Simplified Chunks:** Chunks no longer contain image arrays, making the structure cleaner and avoiding duplication where multiple chunks on the same page would have identical image arrays.

**Page-Based Image Association:** Images are associated with chapters based on their page numbers falling within the chapter's `startPageNumber` to `endPageNumber` range.

**Automatic Page Number Assignment:** Chunks automatically receive page numbers based on their position within the chapter. The algorithm distributes chunks evenly across the chapter's page range:

```javascript
// Example: Chapter with 100 chunks spanning pages 10-14 (5 pages)
const chunksPerPage = Math.ceil(100 / 5); // 20 chunks per page
// Chunks 0-19 → Page 10
// Chunks 20-39 → Page 11  
// Chunks 40-59 → Page 12
// Chunks 60-79 → Page 13
// Chunks 80-99 → Page 14
```

This ensures every chunk has a valid page number for link resolution and navigation purposes.

---

## Error Handling & Debugging

The parser includes comprehensive error handling and detailed debug output:

```javascript
// Enable debug mode for detailed step-by-step logging
node index.js book.pdf config.json output.json --debug

// Debug files are automatically generated in the debug/ folder:
// - step1-pdf-data.json          - Raw PDF parsing results
// - step2-book-metadata.json     - Extracted book metadata  
// - step3-extracted-images.json  - Image extraction results
// - step4-extracted-links.json   - Link extraction results
// - step5-detected-chapters.json - Chapter detection results
// - step6-chapters-with-chunks.json - Text chunking results
// - step7-page-aware-chunks.json - Page-aware chunk processing
// - step8-resolved-links.json    - Link resolution results
// - step9-validated-links.json   - Final validated links

// Common error scenarios handled:
// - Missing or corrupted PDF files
// - Invalid configuration files  
// - Missing external dependencies (pdfimages)
// - Memory issues with large PDFs
// - Coordinate resolution failures
// - Missing TOC or bookmark data
// - Array vs string content handling in chapters
```

---

## Dependencies

- **pdf-parse**: Basic PDF text extraction
- **pdfjs-dist**: Advanced PDF processing (bookmarks, annotations, coordinates)
- **pdfimages**: External tool for image extraction (from poppler-utils)
- **Node.js built-ins**: fs, path, child_process

---

## Performance Considerations

- **Large PDFs**: The parser can handle PDFs up to several hundred pages
- **Memory Usage**: Peak memory usage is typically 2-3x the PDF file size
- **Processing Time**: ~1-5 seconds per page depending on complexity
- **Image Extraction**: Adds ~50% to processing time but provides rich media content
- **Parallel Processing**: Some steps (like page processing) could be parallelized for better performance

---

## Customization & Extension

Each module in the `steps/` directory is designed for easy customization:

1. **Add new text patterns** in `steps/text-processor.js`
2. **Customize chapter detection** in `steps/chapter-detector.js` 
3. **Extend link types** in `steps/link-extractor.js`
4. **Add new resolution strategies** in `steps/link-resolver.js`
5. **Custom image processing** in `steps/image-extractor.js`
6. **Modify debug output** in `index.js` orchestrator

The organized directory structure makes it easy to:
- Swap out individual processing modules without affecting other components
- Add new processing steps by creating new modules in the `steps/` directory
- Extend the orchestrator in `index.js` to include additional steps
- Customize debug output for specific troubleshooting needs

All modules maintain clear input/output contracts, making the entire pipeline modular and extensible. 