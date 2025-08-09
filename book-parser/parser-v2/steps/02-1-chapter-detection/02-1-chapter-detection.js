/**
 * Step 2.1: Chapter Detection
 * 
 * Detects chapter boundaries from Table of Contents (TOC).
 * This step identifies chapters and their metadata: names, page ranges, and text positions.
 * 
 * Hybrid approach combining PDF bookmark extraction with text-based analysis:
 * 1. Primary: Extract TOC from PDF bookmarks/outline
 * 2. Fallback: Text-based TOC analysis
 * 3. Pattern-based validation for content boundaries
 * 4. Generate chapter metadata with positions
 * 
 * Expected Input:
 * - pipelineState: { rawText: "extracted text...", ... }
 * - config: { INPUT_PDF: path, OUTPUT_DIR: path, DEBUG_DIR: path, ... }
 * 
 * Expected Output:
 * - { chapterMetadata: [{ title, chapterNumber, startingPage, endPage, confidence, detectionSource }] }
 */

const fs = require('fs');
const path = require('path');

// Try to import pdfjs-dist for PDF bookmark extraction
let pdfjsLib = null;
try {
    pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
} catch (error) {
    // pdfjs-dist not available, using text-based analysis only
}

/**
 * Execute chapter detection step
 * @param {Object} pipelineState - Current pipeline state
 * @param {Object} config - Configuration object
 * @returns {Object} - Updated state with chapter metadata
 */
async function execute(pipelineState, config) {
    // Validate prerequisites
    if (!pipelineState.rawText) {
        throw new Error('Step 1 (text extraction) must be completed first');
    }

    try {
        const startTime = Date.now();

        // Step 1: Try PDF bookmark extraction
        let tocAnalysis = null;
        let tocSource = 'none';
        let bookmarkAnalysis = null; // keep raw bookmark analysis for debug output

        if (pdfjsLib && config.INPUT_PDF && fs.existsSync(config.INPUT_PDF)) {
            bookmarkAnalysis = await extractTOCFromPdf(config.INPUT_PDF);
            tocAnalysis = bookmarkAnalysis;
            if (tocAnalysis && tocAnalysis.chapters.length > 0) {
                tocSource = tocAnalysis.source;
            }
            // Write dedicated bookmarks debug file for inspection regardless of fallback
            try {
                const bookmarksDebug = {
                    pdfBookmarksAvailable: pdfjsLib !== null,
                    inputPdf: config.INPUT_PDF,
                    tocFound: !!(bookmarkAnalysis && bookmarkAnalysis.chapters && bookmarkAnalysis.chapters.length > 0),
                    totalBookmarks: bookmarkAnalysis ? bookmarkAnalysis.totalBookmarks : 0,
                    outlineTitles: bookmarkAnalysis ? (bookmarkAnalysis.outlineTitles || []) : [],
                    extractedChapters: bookmarkAnalysis ? (bookmarkAnalysis.chapters || []) : []
                };
                const bookmarksDebugFile = path.join(config.DEBUG_DIR, 'step-02-1-bookmarks.json');
                fs.writeFileSync(bookmarksDebugFile, JSON.stringify(bookmarksDebug, null, 2));
            } catch (debugWriteError) {
                // ignore debug write errors
            }
        }

        // Step 2: Fallback to text-based TOC analysis
        if (!tocAnalysis || tocAnalysis.chapters.length === 0) {
            tocAnalysis = {
                source: 'text_parsing',
                chapters: analyzeTableOfContents(pipelineState.rawText).tocEntries
            };
            tocSource = 'text_parsing';
        }

        // Step 3: Pattern-based detection for content boundaries
        const patternAnalysis = detectChaptersPattern(pipelineState.rawText);

        // Step 4: Generate chapter metadata
        const { chapterMetadata, pageOffset } = await generateChapterMetadata(
            pipelineState.rawText,
            tocAnalysis,
            patternAnalysis
        );

        // Generate statistics
        const detectionStats = {
            chaptersDetected: chapterMetadata.length,
            tocSource: tocSource,
            tocEntriesFound: tocAnalysis ? tocAnalysis.chapters.length : 0,
            patternMatches: patternAnalysis.validatedChapters.length,
            averageDetectionConfidence: chapterMetadata.length > 0 ?
                chapterMetadata.reduce((sum, ch) => sum + ch.confidence, 0) / chapterMetadata.length : 0,
            pageOffset: pageOffset
        };

        const processingTime = Date.now() - startTime;

        // Save debug output
        const debugOutput = {
            processingTime,
            detectionStats,
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
            chapterMetadata: chapterMetadata.map(ch => ({
                title: ch.title,
                chapterNumber: ch.chapterNumber,
                startingPage: ch.startingPage,
                endPage: ch.endPage,
                detectionSource: ch.detectionSource,
                confidence: ch.confidence
            }))
        };

        const debugFile = path.join(config.DEBUG_DIR, 'step-02-1-chapter-detection.json');
        fs.writeFileSync(debugFile, JSON.stringify(debugOutput, null, 2));

        // Chapter detection completed

        return {
            chapterMetadata: chapterMetadata,
            metadata: {
                ...pipelineState.metadata,
                chapterDetection: {
                    ...detectionStats,
                    processingTime,
                    detectionMethod: 'hybrid_v1_toc_detection'
                }
            }
        };

    } catch (error) {
        console.error('❌ Chapter detection failed:', error.message);
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

    // First, find all chapter positions
    const chapterPositions = [];

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
            chapterPositions.push({
                index: i,
                title: chapterTitle,
                chapterNumber: chapterNumber,
                startingPage: startingPage,
                confidence: position.confidence,
                detectionSource: tocSource
            });
        }
    }

    // Sort chapters by their starting page number
    chapterPositions.sort((a, b) => a.startingPage - b.startingPage);

    // Now assign end pages based on the sorted order
    for (let i = 0; i < chapterPositions.length; i++) {
        const chapter = chapterPositions[i];

        chapterMetadata.push({
            title: chapter.title,
            chapterNumber: chapter.chapterNumber,
            startingPage: chapter.startingPage, // Page numbers now already start from 0
            endPage: i < chapterPositions.length - 1 ? chapterPositions[i + 1].startingPage - 1 : null,
            confidence: chapter.confidence,
            detectionSource: chapter.detectionSource
        });
    }

    // Detect page number offset
    const pageOffset = hasPageMarkers ? detectPageNumberOffset(lines, chapterMetadata) : 0;

    return { chapterMetadata, pageOffset };
}

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

    // TOC analysis complete
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
    // Find where TOC ends and actual content begins
    const startSearchPosition = findTOCEndPosition(rawText);
    const searchText = rawText.substring(startSearchPosition);

    // Look for page markers that might indicate chapter starts
    const lines = searchText.split('\n');
    const candidates = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Look for page markers first to establish context
        const pageMarkerMatch = line.match(/^---\s*PAGE\s+(\d+)\s*---$/);
        if (pageMarkerMatch) {
            const pageNum = parseInt(pageMarkerMatch[1]);

            // Look in the next few lines after page marker for chapter title
            for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
                const nextLine = lines[j].trim();

                // Skip empty lines and page end markers
                if (!nextLine || nextLine.match(/^---\s*END\s+PAGE/)) {
                    continue;
                }

                // Check if this line matches our chapter title
                if (isChapterTitleMatch(nextLine, chapterTitle, chapterNumber)) {
                    const linePosition = lines.slice(0, j).join('\n').length;
                    const absolutePosition = startSearchPosition + linePosition;

                    // Additional validation: make sure this looks like a chapter header, not TOC
                    const isValidChapterStart = validateChapterStart(nextLine, lines, j, pageNum, chapterTitle);

                    if (isValidChapterStart) {
                        candidates.push({
                            position: absolutePosition,
                            pageNumber: pageNum,
                            matchedText: nextLine,
                            confidence: calculateMatchConfidence(nextLine, chapterTitle, chapterNumber, pageNum)
                        });
                    }
                }
            }
        }
    }

    // If we found candidates, return the best one
    if (candidates.length > 0) {
        // Sort by confidence, then by position (prefer earlier)
        candidates.sort((a, b) => {
            if (Math.abs(a.confidence - b.confidence) < 0.1) {
                return a.position - b.position; // Prefer earlier position
            }
            return b.confidence - a.confidence; // Prefer higher confidence
        });

        const best = candidates[0];
        return {
            startPosition: best.position,
            confidence: best.confidence,
            matchedPattern: 'page_marker_context',
            matchedText: best.matchedText,
            pageNumber: best.pageNumber
        };
    }

    return null;
}

/**
 * Check if a line matches the chapter title
 * @param {string} line - Line to check
 * @param {string} chapterTitle - Expected chapter title
 * @param {number} chapterNumber - Chapter number
 * @returns {boolean} - True if match
 */
function isChapterTitleMatch(line, chapterTitle, chapterNumber) {
    // Normalize both strings for comparison
    const normalizedLine = line.toLowerCase().replace(/[^\w\s]/g, '').trim();
    const normalizedTitle = chapterTitle.toLowerCase().replace(/[^\w\s]/g, '').trim();

    // Direct match
    if (normalizedLine === normalizedTitle) {
        return true;
    }

    // Check for chapter number + title combinations
    const chapterPatterns = [
        `${chapterNumber} ${normalizedTitle}`,
        `chapter ${chapterNumber} ${normalizedTitle}`,
        normalizedTitle // Just the title
    ];

    for (const pattern of chapterPatterns) {
        if (normalizedLine === pattern.replace(/[^\w\s]/g, '').trim()) {
            return true;
        }
    }

    // Check if line contains most of the title words
    const titleWords = normalizedTitle.split(/\s+/).filter(w => w.length > 2);
    const lineWords = normalizedLine.split(/\s+/);

    if (titleWords.length >= 2) {
        const matchedWords = titleWords.filter(word => lineWords.some(lw => lw.includes(word) || word.includes(lw)));
        if (matchedWords.length >= Math.min(3, titleWords.length)) {
            return true;
        }
    }

    return false;
}

/**
 * Validate that this is actually a chapter start, not just a TOC entry
 * @param {string} line - The matched line
 * @param {Array} lines - All lines
 * @param {number} lineIndex - Index of the matched line
 * @param {number} pageNumber - Page number
 * @param {string} chapterTitle - Expected chapter title
 * @returns {boolean} - True if this looks like a real chapter start
 */
// validateChapterStart function is now imported from validation module

/**
 * Calculate confidence score for a chapter title match
 * @param {string} line - Matched line
 * @param {string} chapterTitle - Expected title
 * @param {number} chapterNumber - Chapter number
 * @param {number} pageNumber - Page number where found
 * @returns {number} - Confidence score 0-1
 */
function calculateMatchConfidence(line, chapterTitle, chapterNumber, pageNumber) {
    let confidence = 0.5;

    // Exact match gets high confidence
    if (line.toLowerCase().trim() === chapterTitle.toLowerCase().trim()) {
        confidence = 0.95;
    }

    // Contains chapter number
    if (line.includes(chapterNumber.toString())) {
        confidence += 0.1;
    }

    // Reasonable page number (not too early, not too late)
    if (pageNumber >= 8 && pageNumber <= 300) {
        confidence += 0.1;
    }

    // Shorter lines are more likely to be chapter titles
    if (line.length < 100) {
        confidence += 0.1;
    }

    // All caps or title case suggests header
    if (line === line.toUpperCase() || line.match(/^[A-Z][a-z]+(\s+[A-Z][a-z]+)*$/)) {
        confidence += 0.1;
    }

    return Math.min(1.0, confidence);
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
        const outlineTitles = Array.isArray(outline) ? outline.map(b => b && typeof b.title === 'string' ? b.title : '').filter(Boolean) : [];

        return {
            source: 'pdf_bookmarks',
            chapters: chapters,
            totalBookmarks: outline.length,
            outlineTitles: outlineTitles
        };
    } catch (error) {
        // PDF bookmark extraction failed
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
            return pageIndex; // Return 0-based page numbers to align with page markers
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

    // Handle spelled-out chapter numbers (e.g., "Chapter One: Title")
    const numberWordsMap = {
        one: 1,
        two: 2,
        three: 3,
        four: 4,
        five: 5,
        six: 6,
        seven: 7,
        eight: 8,
        nine: 9,
        ten: 10,
        eleven: 11,
        twelve: 12,
        thirteen: 13,
        fourteen: 14,
        fifteen: 15,
        sixteen: 16,
        seventeen: 17,
        eighteen: 18,
        nineteen: 19,
        twenty: 20
    };
    const spelledMatch = title.match(/^Chapter\s+([A-Za-z-]+)\s*:?\s*(.+)$/i);
    if (spelledMatch) {
        const word = spelledMatch[1].toLowerCase();
        const num = numberWordsMap[word];
        if (num) {
            return {
                number: num,
                title: spelledMatch[2].trim()
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

// validateChapterSequence function is now imported from validation module

// validate function is now imported from validation module

const { validate, validateChapterStart, validateChapterSequence } = require('./02-1-chapter-detection-validation');

module.exports = { execute, validate }; 