/**
 * Step 2: Chapter Detection and Text Extraction
 * 
 * Combined step that detects chapter boundaries and extracts their content.
 * This step identifies chapters AND extracts their cleaned text content.
 * 
 * Hybrid approach combining PDF bookmark extraction with text-based analysis:
 * 1. Primary: Extract TOC from PDF bookmarks/outline
 * 2. Fallback: Text-based TOC analysis
 * 3. Pattern-based validation for content boundaries
 * 4. Extract and clean chapter content
 * 5. Generate content statistics and quality metrics
 * 
 * Expected Input:
 * - pipelineState: { rawText: "extracted text...", ... }
 * - config: { INPUT_PDF: path, OUTPUT_DIR: path, DEBUG_DIR: path, ... }
 * 
 * Expected Output:
 * - { chapters: [{ ...metadata, content, cleanedContent, contentStats, extractionQuality }] }
 */

const fs = require('fs');
const path = require('path');

// Try to import pdfjs-dist for PDF bookmark extraction
let pdfjsLib = null;
try {
    pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
} catch (error) {
    console.log('📋 pdfjs-dist not available, using text-based analysis only');
}

/**
 * Execute chapter detection and text extraction step
 * @param {Object} pipelineState - Current pipeline state
 * @param {Object} config - Configuration object
 * @returns {Object} - Updated state with chapter metadata and content
 */
async function execute(pipelineState, config) {
    console.log('📚 Starting chapter detection and text extraction (Step 2)...');
    
    // Validate prerequisites
    if (!pipelineState.rawText) {
        throw new Error('Step 1 (text extraction) must be completed first');
    }
    
    try {
        const startTime = Date.now();
        const lines = pipelineState.rawText.split('\n');
        
        // PHASE 1: Chapter Detection
        console.log('🔍 Phase 1: Detecting chapters...');
        
        // Step 1: Try PDF bookmark extraction
        let tocAnalysis = null;
        let tocSource = 'none';
        
        if (pdfjsLib && config.INPUT_PDF && fs.existsSync(config.INPUT_PDF)) {
            console.log('📋 Extracting TOC from PDF bookmarks...');
            tocAnalysis = await extractTOCFromPdf(config.INPUT_PDF);
            if (tocAnalysis && tocAnalysis.chapters.length > 0) {
                tocSource = tocAnalysis.source;
                console.log(`✅ Found ${tocAnalysis.chapters.length} chapters from ${tocSource}`);
            }
        }
        
        // Step 2: Fallback to text-based TOC analysis
        if (!tocAnalysis || tocAnalysis.chapters.length === 0) {
            console.log('📋 Fallback: Analyzing Table of Contents from text...');
            tocAnalysis = {
                source: 'text_parsing',
                chapters: analyzeTableOfContents(pipelineState.rawText).tocEntries
            };
            tocSource = 'text_parsing';
        }
        
        // Step 3: Pattern-based detection for content boundaries
        console.log('🔍 Detecting chapter patterns in content...');
        const patternAnalysis = detectChaptersPattern(pipelineState.rawText);
        
        // Step 4: Generate chapter metadata
        console.log('📝 Generating chapter metadata...');
        const { chapterMetadata, pageOffset } = await generateChapterMetadata(
            pipelineState.rawText, 
            tocAnalysis, 
            patternAnalysis
        );
        
        // PHASE 2: Text Extraction
        console.log('📝 Phase 2: Extracting chapter content...');
        console.log(`📚 Extracting content for ${chapterMetadata.length} chapters...`);
        
        // Extract content for each chapter
        const chapters = [];
        for (let i = 0; i < chapterMetadata.length; i++) {
            const metadata = chapterMetadata[i];
            
            console.log(`  📖 Processing: ${metadata.title}`);
            
            // Extract chapter text with comprehensive processing
            const chapterExtraction = extractChapterText(
                pipelineState.rawText, 
                metadata.startPosition, 
                metadata.endPosition, 
                metadata.title
            );
            
            if (chapterExtraction.isValid) {
                // Combine metadata with extracted content
                chapters.push({
                    // Original metadata from detection
                    ...metadata,
                    
                    // New content from extraction
                    content: chapterExtraction.content,
                    cleanedContent: chapterExtraction.cleanedContent,
                    contentStats: chapterExtraction.stats,
                    extractionQuality: chapterExtraction.quality,
                    
                    // Enhanced metadata
                    contentStartPosition: chapterExtraction.contentStartPosition,
                    pageRange: extractPageRange(chapterExtraction.content)
                });
                
                console.log(`    ✅ ${chapterExtraction.stats.cleanedWords} words, quality: ${chapterExtraction.quality.score.toFixed(2)}`);
            } else {
                console.log(`    ⚠️  Chapter failed validation: ${chapterExtraction.quality.issues.join(', ')}`);
            }
        }
        
        // Generate combined statistics
        const detectionStats = {
            chaptersDetected: chapterMetadata.length,
            tocSource: tocSource,
            tocEntriesFound: tocAnalysis ? tocAnalysis.chapters.length : 0,
            patternMatches: patternAnalysis.validatedChapters.length,
            averageDetectionConfidence: chapterMetadata.length > 0 ? 
                chapterMetadata.reduce((sum, ch) => sum + ch.confidence, 0) / chapterMetadata.length : 0,
            pageOffset: pageOffset
        };
        
        const extractionStats = {
            totalChapters: chapters.length,
            totalWords: chapters.reduce((sum, ch) => sum + ch.contentStats.cleanedWords, 0),
            averageWordsPerChapter: chapters.length > 0 ? 
                chapters.reduce((sum, ch) => sum + ch.contentStats.cleanedWords, 0) / chapters.length : 0,
            averageQualityScore: chapters.length > 0 ? 
                chapters.reduce((sum, ch) => sum + ch.extractionQuality.score, 0) / chapters.length : 0,
            validChapters: chapters.filter(ch => ch.extractionQuality.isValid).length,
            chaptersWithIssues: chapters.filter(ch => ch.extractionQuality.issues.length > 0).length,
        };
        
        const processingTime = Date.now() - startTime;
        
        // Save debug output
        const debugOutput = {
            processingTime,
            detectionStats,
            extractionStats,
            tocAnalysis: {
                source: tocSource,
                tocFound: tocAnalysis && tocAnalysis.chapters.length > 0,
                tocEntries: tocAnalysis ? tocAnalysis.chapters : [],
                pdfBookmarksAvailable: pdfjsLib !== null
            },
            patternAnalysis: {
                potentialChapters: patternAnalysis.potentialChapters.length,
                validatedChapters: patternAnalysis.validatedChapters.length,
                highConfidenceMatches: patternAnalysis.validatedChapters.filter(ch => ch.confidence > 0.8).length
            },
            chapters: chapters.map(ch => ({
                title: ch.title,
                chapterNumber: ch.chapterNumber,
                startPosition: ch.startPosition,
                contentStartPosition: ch.contentStartPosition,
                endPosition: ch.endPosition,
                rawContentLength: ch.content.length,
                cleanedContentLength: ch.cleanedContent.length,
                contentStats: ch.contentStats,
                pageRange: ch.pageRange,
                detectionSource: ch.detectionSource,
                confidence: ch.confidence,
                startingPage: ch.startingPage,
                extractionQuality: ch.extractionQuality
            }))
        };
        
        const debugFile = path.join(config.DEBUG_DIR, 'step-02-chapter-detection-and-text-extraction.json');
        fs.writeFileSync(debugFile, JSON.stringify(debugOutput, null, 2));
        
        console.log(`✅ Chapter detection and text extraction completed: ${chapters.length} chapters processed`);
        console.log(`📊 Processing took ${processingTime}ms`);
        console.log(`📚 Total words extracted: ${extractionStats.totalWords.toLocaleString()}`);
        console.log(`⭐ Average quality score: ${extractionStats.averageQualityScore.toFixed(2)}`);
        console.log(`✅ Valid chapters: ${extractionStats.validChapters}/${extractionStats.totalChapters}`);
        
        return {
            chapters: chapters,
            metadata: {
                ...pipelineState.metadata,
                chapterDetectionAndTextExtraction: {
                    ...detectionStats,
                    ...extractionStats,
                    processingTime,
                    detectionMethod: 'hybrid_v1_poc2_with_extraction'
                }
            }
        };
        
    } catch (error) {
        console.error('❌ Chapter detection and text extraction failed:', error.message);
        throw error;
    }
}

/**
 * Generate chapter metadata without content extraction
 * @param {string} rawText - Raw text content
 * @param {Object} tocAnalysis - TOC analysis results
 * @param {Object} patternAnalysis - Pattern analysis results
 * @returns {Object} - { chapterMetadata, pageOffset }
 */
async function generateChapterMetadata(rawText, tocAnalysis, patternAnalysis) {
    const chapterMetadata = [];
    const lines = rawText.split('\n');

    // Use TOC as authoritative source for chapter list
    let authoritative = [];
    let tocSource = 'pattern';

    if (tocAnalysis && tocAnalysis.chapters && tocAnalysis.chapters.length > 0) {
        authoritative = tocAnalysis.chapters;
        tocSource = tocAnalysis.source;
    } else if (tocAnalysis && tocAnalysis.tocEntries && tocAnalysis.tocEntries.length > 0) {
        authoritative = tocAnalysis.tocEntries;
        tocSource = 'text_parsing';
    } else {
        authoritative = patternAnalysis.validatedChapters;
        tocSource = 'pattern';
    }

    // Check if we have page markers in text
    const hasPageMarkers = rawText.includes('--- PAGE');
    
    for (let i = 0; i < authoritative.length; i++) {
        const tocEntry = authoritative[i];
        
        // Handle different field names between formats
        let chapterTitle, chapterNumber, startingPage;
        
        if (tocEntry.chapterTitle !== undefined) {
            chapterTitle = tocEntry.chapterTitle;
            chapterNumber = tocEntry.chapterNumber;
            startingPage = tocEntry.startingPage;
        } else {
            chapterTitle = tocEntry.title;
            chapterNumber = tocEntry.chapterNumber;
            startingPage = tocEntry.startingPage;
        }
        
        // Find text position for this chapter
        const position = findChapterContentPosition(rawText, chapterTitle, chapterNumber);
        
        if (position) {
            // Find end position
            let endPosition = rawText.length - 1;
            if (i < authoritative.length - 1) {
                const nextChapter = authoritative[i + 1];
                const nextTitle = nextChapter.chapterTitle || nextChapter.title;
                const nextNumber = nextChapter.chapterNumber;
                const nextPosition = findChapterContentPosition(rawText, nextTitle, nextNumber);
                if (nextPosition) {
                    endPosition = nextPosition.startPosition - 1;
                }
            }
            
            chapterMetadata.push({
                title: chapterTitle,
                chapterNumber: chapterNumber,
                startPosition: position.startPosition,
                endPosition: endPosition,
                startingPage: startingPage,
                confidence: position.confidence,
                detectionSource: tocSource
            });
        }
    }
    
    // Detect page number offset
    const pageOffset = hasPageMarkers ? detectPageNumberOffset(lines, chapterMetadata) : 0;
    
    return { chapterMetadata, pageOffset };
}

/**
 * Extract and process chapter text with comprehensive cleaning and validation
 * @param {string} rawText - Full text content
 * @param {number} startPosition - Chapter start character position
 * @param {number} endPosition - Chapter end character position
 * @param {string} chapterTitle - Chapter title for validation
 * @returns {Object} - Extraction results with content and metadata
 */
function extractChapterText(rawText, startPosition, endPosition, chapterTitle) {
    // Extract raw chapter content
    const rawContent = rawText.substring(startPosition, endPosition + 1);
    
    // For page-based processing, we need to preserve page markers
    // Look backward from startPosition to find the page marker
    let contentStartPosition = startPosition;
    
    // Look backward up to 1000 characters to find the page marker
    const searchStart = Math.max(0, startPosition - 1000);
    const searchText = rawText.substring(searchStart, startPosition);
    
    const pageMarkerMatch = searchText.match(/---\s*PAGE\s+\d+\s*---[^\n]*\n?/g);
    if (pageMarkerMatch) {
        const lastPageMarker = pageMarkerMatch[pageMarkerMatch.length - 1];
        const markerPosition = searchText.lastIndexOf(lastPageMarker);
        if (markerPosition >= 0) {
            contentStartPosition = searchStart + markerPosition;
        }
    }
    
    // Extract content preserving page markers
    const contentOnly = rawText.substring(contentStartPosition, endPosition + 1);
    
    // Clean and process content (but preserve page markers)
    const cleanedContent = cleanChapterContentPreservingPageMarkers(contentOnly);
    
    // Generate content statistics
    const stats = generateContentStats(rawContent, cleanedContent);
    
    // Validate content quality
    const quality = validateChapterContent(cleanedContent, chapterTitle, stats);
    
    return {
        content: contentOnly.trim(),
        cleanedContent: cleanedContent.trim(),
        stats: stats,
        quality: quality,
        isValid: quality.isValid,
        contentStartPosition: contentStartPosition
    };
}

/**
 * Clean chapter content while preserving page markers
 * @param {string} content - Raw chapter content
 * @returns {string} - Cleaned content with page markers preserved
 */
function cleanChapterContentPreservingPageMarkers(content) {
    const lines = content.split('\n');
    const cleanedLines = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();
        
        // Preserve page markers
        if (trimmedLine.match(/^---\s*PAGE\s+\d+\s*---$/)) {
            cleanedLines.push(line);
            continue;
        }
        
        // Preserve end page markers
        if (trimmedLine.match(/^---\s*END\s+PAGE\s+\d+\s*---$/)) {
            cleanedLines.push(line);
            continue;
        }
        
        // Remove headers and footers
        if (isHeaderOrFooter(trimmedLine, i, lines)) {
            continue;
        }
        
        // Remove standalone page numbers
        if (isPageNumber(trimmedLine)) {
            continue;
        }
        
        // Clean the line
        const cleanedLine = cleanLine(trimmedLine);
        
        if (cleanedLine.length > 0) {
            cleanedLines.push(cleanedLine);
        } else if (trimmedLine.length === 0) {
            // Preserve paragraph breaks
            cleanedLines.push('');
        }
    }
    
    return cleanedLines.join('\n');
}

/**
 * Check if a line is a header or footer
 * @param {string} line - Line to check
 * @param {number} index - Line index
 * @param {Array} allLines - All lines
 * @returns {boolean} - True if header/footer
 */
function isHeaderOrFooter(line, index, allLines) {
    const lineUpper = line.toUpperCase();
    
    // Common headers/footers
    if (lineUpper.match(/^(TRANSFORMERS?|NICK\s+LANE|LIFE\s+AND\s+DEATH)$/)) {
        return true;
    }
    
    // Short lines at beginning/end that are all caps
    if ((index < 3 || index >= allLines.length - 3) && 
        line.length < 50 && 
        line === lineUpper && 
        line.match(/^[A-Z\s]+$/)) {
        return true;
    }
    
    return false;
}

/**
 * Check if a line is just a page number
 * @param {string} line - Line to check
 * @returns {boolean} - True if page number
 */
function isPageNumber(line) {
    return line.match(/^\d+$/) && parseInt(line) > 0 && parseInt(line) < 1000;
}

/**
 * Clean a line by removing extra whitespace and formatting
 * @param {string} line - Line to clean
 * @returns {string} - Cleaned line
 */
function cleanLine(line) {
    // Only replace spaces and tabs, preserve newlines
    return line.replace(/[ \t]+/g, ' ').trim();
}

/**
 * Generate content statistics
 * @param {string} rawContent - Raw content
 * @param {string} cleanedContent - Cleaned content
 * @returns {Object} - Content statistics
 */
function generateContentStats(rawContent, cleanedContent) {
    const rawWords = rawContent.split(/\s+/).filter(w => w.length > 0);
    const cleanedWords = cleanedContent.split(/\s+/).filter(w => w.length > 0);
    
    return {
        rawCharacters: rawContent.length,
        cleanedCharacters: cleanedContent.length,
        rawWords: rawWords.length,
        cleanedWords: cleanedWords.length,
        rawLines: rawContent.split('\n').length,
        cleanedLines: cleanedContent.split('\n').length,
        compressionRatio: rawContent.length > 0 ? cleanedContent.length / rawContent.length : 0
    };
}

/**
 * Validate chapter content quality
 * @param {string} content - Chapter content
 * @param {string} chapterTitle - Chapter title
 * @param {Object} stats - Content statistics
 * @returns {Object} - Quality assessment
 */
function validateChapterContent(content, chapterTitle, stats) {
    const issues = [];
    let score = 1.0;
    
    // Check minimum word count
    if (stats.cleanedWords < 50) {
        issues.push('very_short_content');
        score -= 0.3;
    }
    
    // Check if content is mostly page markers
    const pageMarkerCount = (content.match(/---\s*PAGE\s+\d+\s*---/g) || []).length;
    if (pageMarkerCount > stats.cleanedLines * 0.1) {
        issues.push('too_many_page_markers');
        score -= 0.2;
    }
    
    // Check compression ratio
    if (stats.compressionRatio < 0.3) {
        issues.push('excessive_cleaning');
        score -= 0.1;
    }
    
    return {
        score: Math.max(0, score),
        isValid: score >= 0.5,
        issues: issues
    };
}

/**
 * Extract page range from content
 * @param {string} content - Chapter content
 * @returns {Object} - Page range
 */
function extractPageRange(content) {
    const pageMarkers = content.match(/---\s*PAGE\s+(\d+)\s*---/g);
    if (!pageMarkers || pageMarkers.length === 0) {
        return null;
    }
    
    const pageNumbers = pageMarkers.map(marker => {
        const match = marker.match(/---\s*PAGE\s+(\d+)\s*---/);
        return match ? parseInt(match[1]) : null;
    }).filter(num => num !== null);
    
    if (pageNumbers.length === 0) {
        return null;
    }
    
    return {
        startPage: Math.min(...pageNumbers),
        endPage: Math.max(...pageNumbers),
        totalPages: pageNumbers.length
    };
}

// === CHAPTER DETECTION FUNCTIONS ===

/**
 * Find where the Table of Contents ends and actual content begins
 * @param {string} rawText - Full text to search
 * @returns {number} - Position where content starts after TOC
 */
function findTOCEndPosition(rawText) {
    const lines = rawText.split('\n');
    let tocEndPosition = 0;
    
    // Look for patterns that indicate end of TOC:
    // 1. Look for "Introduction" or first chapter starting
    // 2. Look for page markers that seem to be in content area
    // 3. Look for bibliography/references section to avoid
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Skip if we're still in the very beginning (first few thousand characters)
        const currentPosition = lines.slice(0, i).join('\n').length;
        if (currentPosition < 5000) {
            continue;
        }
        
        // Look for Introduction chapter (often first real content)
        if (line.match(/^Introduction:\s*Life\s+itself/i)) {
            tocEndPosition = currentPosition;
            break;
        }
        
        // Look for page markers that indicate content area (around page 8-15)
        const pageMatch = line.match(/^---\s*PAGE\s+(\d+)\s*---$/);
        if (pageMatch) {
            const pageNum = parseInt(pageMatch[1]);
            if (pageNum >= 8 && pageNum <= 15) {
                // We're likely in the content area now
                tocEndPosition = currentPosition;
                break;
            }
        }
        
        // Look for patterns that suggest we're past TOC
        if (line.match(/^(Chapter\s+\d+|1\s+|Introduction|Preface)/i) && currentPosition > 10000) {
            // Check if this looks like actual chapter content, not just TOC entry
            const nextFewLines = lines.slice(i + 1, i + 5).join('\n');
            if (nextFewLines.length > 100) { // Has substantial content following
                tocEndPosition = currentPosition;
                break;
            }
        }
    }
    
    // If we couldn't find a clear TOC end, use a conservative estimate
    if (tocEndPosition === 0) {
        tocEndPosition = Math.min(25000, Math.floor(rawText.length * 0.1));
    }
    
    console.log(`📖 TOC ends at position: ${tocEndPosition} (${Math.round(tocEndPosition/1000)}k chars)`);
    return tocEndPosition;
}

/**
 * Find chapter content position in text using character positions
 * @param {string} rawText - Full text content
 * @param {string} chapterTitle - Chapter title
 * @param {number} chapterNumber - Chapter number
 * @returns {Object|null} - Position info or null
 */
function findChapterContentPosition(rawText, chapterTitle, chapterNumber) {
    // Create more flexible search patterns
    const titleWords = chapterTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').split(/\s+/);
    const titleCore = titleWords.slice(0, 3).join('\\s+'); // First 3 words
    
    const searchPatterns = [
        // Chapter number + title (exact)
        new RegExp(`^(chapter\\s+)?${chapterNumber}[\\s\\-:]+${chapterTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'img'),
        // Just chapter number (for cases like "1" or "Chapter 1")
        new RegExp(`^(chapter\\s+)?${chapterNumber}\\s*$`, 'img'),
        // Title only (flexible)
        new RegExp(`^${titleCore}`, 'img'),
        // Full title (flexible spacing)
        new RegExp(chapterTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'), 'img')
    ];
    
    // Find where TOC ends and actual content begins
    const startSearchPosition = findTOCEndPosition(rawText);
    const searchText = rawText.substring(startSearchPosition);
    
    for (const pattern of searchPatterns) {
        const matches = [...searchText.matchAll(pattern)];
        
        for (const match of matches) {
            const matchPosition = startSearchPosition + match.index;
            const matchedText = match[0];
            
            // Get surrounding context to validate
            const contextStart = Math.max(0, matchPosition - 200);
            const contextEnd = Math.min(rawText.length, matchPosition + matchedText.length + 200);
            const context = rawText.substring(contextStart, contextEnd);
            
            // Check if it's a standalone header (surrounded by newlines)
            const beforeMatch = rawText.substring(Math.max(0, matchPosition - 20), matchPosition);
            const afterMatch = rawText.substring(matchPosition + matchedText.length, Math.min(rawText.length, matchPosition + matchedText.length + 20));
            
            const isStandalone = beforeMatch.includes('\n') && afterMatch.includes('\n');
            const isPageMarker = matchedText.includes('PAGE') && matchedText.includes('---');
            
            if (isStandalone && !isPageMarker) {
                return {
                    startPosition: matchPosition,
                    confidence: 0.9,
                    matchedPattern: pattern.source,
                    matchedText: matchedText
                };
            }
        }
    }
    
    return null;
}

/**
 * Detect page number offset between markers and book pages
 * @param {Array} lines - All text lines
 * @param {Array} chapterMetadata - Chapter metadata
 * @returns {number} - Page offset
 */
function detectPageNumberOffset(lines, chapterMetadata) {
    // Look for first page marker and compare with first chapter's starting page
    for (let i = 0; i < Math.min(1000, lines.length); i++) {
        const pageMarkerMatch = lines[i].match(/^---\s*PAGE\s+(\d+)\s*---$/);
        if (pageMarkerMatch) {
            const markerPageNumber = parseInt(pageMarkerMatch[1]);
            
            // Find a chapter that starts near this position
            for (const chapter of chapterMetadata) {
                if (Math.abs(chapter.startPosition - i) < 50 && chapter.startingPage) {
                    return chapter.startingPage - markerPageNumber;
                }
            }
        }
    }
    
    return 0;
}

// === PDF EXTRACTION FUNCTIONS ===

/**
 * Extract TOC from PDF bookmarks
 * @param {string} pdfPath - Path to PDF file
 * @returns {Object|null} - TOC analysis or null
 */
async function extractTOCFromPdf(pdfPath) {
    try {
        const pdfBuffer = fs.readFileSync(pdfPath);
        const pdf = await pdfjsLib.getDocument({
            data: pdfBuffer,
            verbosity: 0
        }).promise;
        
        const outline = await pdf.getOutline();
        if (!outline || outline.length === 0) {
            return null;
        }
        
        const chapters = await extractBookmarks(outline, pdf);
        
        return {
            source: 'pdf_bookmarks',
            chapters: chapters,
            totalBookmarks: outline.length
        };
    } catch (error) {
        console.log('⚠️  PDF bookmark extraction failed:', error.message);
        return null;
    }
}

/**
 * Extract bookmarks from PDF outline
 * @param {Array} outline - PDF outline
 * @param {Object} doc - PDF document
 * @param {number} level - Bookmark level
 * @returns {Array} - Chapter list
 */
async function extractBookmarks(outline, doc, level = 0) {
    const chapters = [];
    
    for (const bookmark of outline) {
        if (level === 0) { // Only process top-level bookmarks as chapters
            const chapterInfo = parseChapterFromBookmark(bookmark.title);
            if (chapterInfo) {
                const pageNumber = await getPageNumberFromDest(bookmark.dest, doc);
                chapters.push({
                    chapterTitle: chapterInfo.title,
                    chapterNumber: chapterInfo.number,
                    startingPage: pageNumber,
                    bookmarkTitle: bookmark.title
                });
            }
        }
        
        // Process sub-bookmarks
        if (bookmark.items && bookmark.items.length > 0) {
            const subChapters = await extractBookmarks(bookmark.items, doc, level + 1);
            chapters.push(...subChapters);
        }
    }
    
    return chapters;
}

/**
 * Get page number from PDF destination
 * @param {*} dest - PDF destination
 * @param {Object} doc - PDF document
 * @returns {number} - Page number
 */
async function getPageNumberFromDest(dest, doc) {
    try {
        if (Array.isArray(dest) && dest.length > 0) {
            const pageRef = dest[0];
            const pageIndex = await doc.getPageIndex(pageRef);
            return pageIndex + 1;
        }
        return null;
    } catch (error) {
        return null;
    }
}

/**
 * Parse chapter information from bookmark title
 * @param {string} title - Bookmark title
 * @returns {Object|null} - Chapter info or null
 */
function parseChapterFromBookmark(title) {
    const patterns = [
        /^(\d+)\s+(.+)$/,
        /^Chapter\s+(\d+)\s*:\s*(.+)$/i,
        /^(\d+)\.\s*(.+)$/
    ];
    
    for (const pattern of patterns) {
        const match = title.match(pattern);
        if (match) {
            return {
                number: parseInt(match[1]),
                title: match[2].trim()
            };
        }
    }
    
    // Handle special chapters
    if (title.match(/^(Introduction|Preface|Epilogue|Appendix)/i)) {
        return {
            number: title.match(/^Introduction/i) ? 0 : 99,
            title: title.trim()
        };
    }
    
    return null;
}

// === TEXT-BASED TOC ANALYSIS ===

/**
 * Analyze table of contents from text
 * @param {string} text - Raw text
 * @returns {Object} - TOC analysis
 */
function analyzeTableOfContents(text) {
    const lines = text.split('\n');
    const tocEntries = [];
    
    // Look for TOC in first 150 lines
    for (let i = 0; i < Math.min(150, lines.length); i++) {
        const line = lines[i].trim();
        if (line.length > 0) {
            const tocEntry = parseTOCLine(line);
            if (tocEntry) {
                tocEntries.push(tocEntry);
            }
        }
    }
    
    return {
        tocEntries: tocEntries,
        source: 'text_parsing'
    };
}

/**
 * Parse a single TOC line
 * @param {string} line - Line to parse
 * @returns {Object|null} - TOC entry or null
 */
function parseTOCLine(line) {
    const patterns = [
        /^(\d+)\s+(.+?)\s+(\d+)$/,
        /^(\d+)\.\s*(.+?)\s+(\d+)$/,
        /^Chapter\s+(\d+)\s*:\s*(.+?)\s+(\d+)$/i
    ];
    
    for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match) {
            return {
                chapterNumber: parseInt(match[1]),
                title: match[2].trim(),
                startingPage: parseInt(match[3])
            };
        }
    }
    
    return null;
}

// === PATTERN-BASED DETECTION ===

/**
 * Detect chapters using pattern matching
 * @param {string} text - Raw text
 * @returns {Object} - Pattern analysis
 */
function detectChaptersPattern(text) {
    const lines = text.split('\n');
    const potentialChapters = [];
    
    const patterns = [
        /^(\d+)\s+(.+)$/,
        /^Chapter\s+(\d+)\s*:\s*(.+)$/i,
        /^(\d+)\.\s*(.+)$/
    ];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        for (const pattern of patterns) {
            const match = line.match(pattern);
            if (match) {
                const chapterNumber = extractChapterNumber(match);
                const title = extractChapterTitle(match, line);
                const confidence = calculatePatternConfidence(line, pattern, lines, i);
                
                if (confidence > 0.5) {
                    potentialChapters.push({
                        chapterNumber: chapterNumber,
                        title: title,
                        line: i,
                        confidence: confidence,
                        pattern: pattern.source
                    });
                }
            }
        }
    }
    
    // Validate chapter sequence
    const validatedChapters = validateChapterSequence(potentialChapters);
    
    return {
        potentialChapters: potentialChapters,
        validatedChapters: validatedChapters
    };
}

/**
 * Extract chapter number from pattern match
 * @param {Array} match - Regex match
 * @returns {number} - Chapter number
 */
function extractChapterNumber(match) {
    return parseInt(match[1]);
}

/**
 * Extract chapter title from pattern match
 * @param {Array} match - Regex match
 * @param {string} line - Original line
 * @returns {string} - Chapter title
 */
function extractChapterTitle(match, line) {
    return match[2] ? match[2].trim() : line.trim();
}

/**
 * Calculate pattern confidence
 * @param {string} line - Line text
 * @param {RegExp} pattern - Pattern used
 * @param {Array} lines - All lines
 * @param {number} index - Line index
 * @returns {number} - Confidence score
 */
function calculatePatternConfidence(line, pattern, lines, index) {
    let confidence = 0.6;
    
    // Higher confidence for standalone lines
    if (index > 0 && index < lines.length - 1) {
        const prevLine = lines[index - 1].trim();
        const nextLine = lines[index + 1].trim();
        
        if (prevLine.length === 0 && nextLine.length === 0) {
            confidence += 0.2;
        }
    }
    
    // Higher confidence for shorter, cleaner titles
    if (line.length < 100 && !line.includes('.') && !line.includes(',')) {
        confidence += 0.1;
    }
    
    return Math.min(1.0, confidence);
}

/**
 * Validate chapter sequence
 * @param {Array} potentialChapters - Potential chapters
 * @returns {Array} - Validated chapters
 */
function validateChapterSequence(potentialChapters) {
    // Sort by chapter number
    const sorted = potentialChapters.sort((a, b) => a.chapterNumber - b.chapterNumber);
    
    // Keep chapters with reasonable sequence
    const validated = [];
    let expectedNumber = 1;
    
    for (const chapter of sorted) {
        if (chapter.chapterNumber <= expectedNumber + 2) {
            validated.push(chapter);
            expectedNumber = chapter.chapterNumber + 1;
        }
    }
    
    return validated;
}

module.exports = { execute }; 