const fs = require('fs');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

/**
 * Extract table of contents from PDF using bookmarks or text parsing
 * @param {string} pdfPath - Path to PDF file  
 * @returns {Object|null} Object containing source and chapters: { source: string, chapters: Array } or null if no TOC found
 */
async function extractTOCFromPdf(pdfPath) {
    try {
        const data = new Uint8Array(fs.readFileSync(pdfPath));
        const doc = await pdfjsLib.getDocument(data).promise;

    

        // Check for PDF bookmarks/outlines first
        const outline = await doc.getOutline();
        if (outline && outline.length > 0) {

            const chapters = await extractBookmarks(outline, doc);
            return {
                source: 'pdf_bookmarks',
                chapters: chapters
            };
        }

        // If no bookmarks, search for TOC pages

        const tocPages = [];
        const searchTerms = ['contents', 'table of contents', 'index'];

        // Search first 20 pages for TOC
        const pagesToSearch = Math.min(20, doc.numPages);

        for (let i = 1; i <= pagesToSearch; i++) {
            const page = await doc.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ').toLowerCase();

            // Check if page contains TOC indicators
            const hasTOC = searchTerms.some(term => pageText.includes(term));
            if (hasTOC) {
                tocPages.push({
                    pageNum: i,
                    textItems: textContent.items
                });
            }
        }

        if (tocPages.length === 0) {
            return null;
        }

        // Parse TOC structure from found pages
        const allChapters = [];

        for (const tocPage of tocPages) {
            const tocEntries = parseTOCEntries(tocPage.textItems);
            allChapters.push(...tocEntries);
        }

        return {
            source: 'text_parsing',
            chapters: allChapters
        };

    } catch (error) {
        console.error('Error extracting TOC:', error);
        return null;
    }
}

/**
 * Extract chapters from PDF bookmarks/outline
 * @param {Array} outline - PDF outline array
 * @param {Object} doc - PDF document object
 * @param {number} level - Nesting level (default: 0)
 * @returns {Array} Array of chapter objects
 */
async function extractBookmarks(outline, doc, level = 0) {
    const chapters = [];

    for (const item of outline) {
        // Skip non-chapter items like "Contents"
        if (item.title.toLowerCase() === 'contents') {
            continue;
        }

        const chapter = parseChapterFromBookmark(item.title);
        if (chapter) {
            // Try to get page number from destination
            if (item.dest) {
                try {
                    const pageNum = await getPageNumberFromDest(item.dest, doc);
                    chapter.startingPage = pageNum;
                } catch (error) {
                    // Skip pages where we can't get page numbers
                }
            }
            chapters.push(chapter);
        }

        if (item.items && item.items.length > 0) {
            const subChapters = await extractBookmarks(item.items, doc, level + 1);
            chapters.push(...subChapters);
        }
    }

    return chapters;
}

/**
 * Get page number from PDF destination reference
 * @param {Array} dest - PDF destination array
 * @param {Object} doc - PDF document object
 * @returns {number|null} Page number (1-based) or null if not found
 */
async function getPageNumberFromDest(dest, doc) {
    try {
        // dest is usually an array where the first element contains page reference
        if (Array.isArray(dest) && dest.length > 0) {
            const pageRef = dest[0];
            if (pageRef && typeof pageRef === 'object' && pageRef.num !== undefined) {
                // Get page index from reference
                const pageIndex = await doc.getPageIndex(pageRef);
                return pageIndex + 1; // Convert 0-based to 1-based page number
            }
        }
    } catch (error) {
        throw new Error(`Failed to resolve page reference: ${error.message}`);
    }
    return null;
}

/**
 * Parse chapter information from bookmark title
 * @param {string} title - Bookmark title
 * @returns {Object|null} Chapter object or null if not a chapter
 */
function parseChapterFromBookmark(title) {
    // Remove leading/trailing whitespace
    title = title.trim();

    // Pattern for numbered chapters: "1. Title" or "1 Title"
    const numberedChapterMatch = title.match(/^(\d+)\.?\s+(.+)$/);
    if (numberedChapterMatch) {
        return {
            chapterNumber: parseInt(numberedChapterMatch[1]),
            chapterTitle: numberedChapterMatch[2].trim(),
            startingPage: null, // Will be filled if we can extract from dest
            originalTitle: title
        };
    }

    // Pattern for word-numbered chapters: "Chapter One:", "Chapter Two:", etc.
    const wordNumberedChapterMatch = title.match(/^Chapter\s+(One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|Thirteen|Fourteen|Fifteen|Sixteen|Seventeen|Eighteen|Nineteen|Twenty)[:]\s*(.+)$/i);
    if (wordNumberedChapterMatch) {
        const wordToNumber = {
            'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
            'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
            'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
            'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20
        };
        const chapterNum = wordToNumber[wordNumberedChapterMatch[1].toLowerCase()];
        return {
            chapterNumber: chapterNum,
            chapterTitle: title, // Keep full title
            startingPage: null,
            originalTitle: title
        };
    }

    // Pattern for introduction or other special chapters
    if (title.toLowerCase().includes('introduction')) {
        return {
            chapterNumber: 0, // or null for Introduction
            chapterTitle: title,
            startingPage: null,
            originalTitle: title
        };
    }

    // Pattern for appendices: "Appendix 1", "Appendix A", etc.
    const appendixMatch = title.match(/^Appendix\s+([A-Z0-9]+)/i);
    if (appendixMatch) {
        return {
            chapterNumber: `Appendix ${appendixMatch[1]}`,
            chapterTitle: title,
            startingPage: null,
            originalTitle: title
        };
    }

    // Pattern for epilogue
    if (title.toLowerCase().includes('epilogue')) {
        return {
            chapterNumber: 'Epilogue',
            chapterTitle: title,
            startingPage: null,
            originalTitle: title
        };
    }

    // Other sections (Acknowledgments, Bibliography, Notes, Index)
    const otherSections = ['acknowledgments', 'bibliography', 'notes', 'index'];
    if (otherSections.some(section => title.toLowerCase().includes(section))) {
        return {
            chapterNumber: null,
            chapterTitle: title,
            startingPage: null,
            originalTitle: title
        };
    }

    // Generic fallback: return any remaining title as a potential chapter
    return {
        chapterNumber: null,
        chapterTitle: title,
        startingPage: null,
        originalTitle: title
    };
}

/**
 * Parse TOC entries from text items
 * @param {Array} textItems - Array of PDF text items
 * @returns {Array} Array of TOC entry objects
 */
function parseTOCEntries(textItems) {
    const entries = [];
    let currentLine = '';
    let currentY = null;

    // Group text items by line (same Y coordinate)
    const lines = [];

    for (const item of textItems) {
        const y = Math.round(item.transform[5]); // Y coordinate

        if (currentY === null || Math.abs(y - currentY) > 5) {
            // New line
            if (currentLine.trim()) {
                lines.push({
                    text: currentLine.trim(),
                    y: currentY
                });
            }
            currentLine = item.str;
            currentY = y;
        } else {
            // Same line
            currentLine += item.str;
        }
    }

    // Add last line
    if (currentLine.trim()) {
        lines.push({
            text: currentLine.trim(),
            y: currentY
        });
    }

    // Parse each line for TOC patterns
    for (const line of lines) {
        const tocEntry = parseTOCLine(line.text);
        if (tocEntry) {
            entries.push(tocEntry);
        }
    }

    return entries;
}

/**
 * Parse a single TOC line for chapter information
 * @param {string} text - Line text to parse
 * @returns {Object|null} TOC entry object or null if not a TOC entry
 */
function parseTOCLine(text) {
    // Skip common non-TOC text
    const skipPatterns = [
        /^contents?$/i,
        /^table of contents$/i,
        /^page$/i,
        /^chapter$/i
    ];

    if (skipPatterns.some(pattern => pattern.test(text.trim()))) {
        return null;
    }

    // Look for patterns like:
    // "1. The Search for Emotion's "Fingerprints" 1"
    // "Introduction: The Two-Thousand-Year-Old Assumption ix"
    // "Appendix A: Brain Basics 302"

    const patterns = [
        // Numbered chapter: "1. Title 25" or "1 Title 25"
        /^(\d+)\.?\s+(.+?)\s+(\d+)$/,
        // Introduction or special chapters: "Introduction: Title ix" or "Introduction: Title 25"
        /^(Introduction[:\s]*.*?)\s+([ivx]+|\d+)$/i,
        // Appendix: "Appendix A: Title 302"
        /^(Appendix\s+[A-Z][:\s]*.*?)\s+(\d+)$/i,
        // Other sections: "Acknowledgments 293", "Bibliography 321"
        /^([A-Za-z\s]+)\s+(\d+)$/
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            const titlePart = match[1].trim();
            const pagePart = match[2];

            // Parse chapter number and title
            let chapterNumber = null;
            let chapterTitle = titlePart;

            // Extract chapter number if it's a numbered chapter
            const numberedMatch = titlePart.match(/^(\d+)\.?\s*(.*)$/);
            if (numberedMatch) {
                chapterNumber = parseInt(numberedMatch[1]);
                chapterTitle = numberedMatch[2].trim();
            } else if (titlePart.toLowerCase().includes('introduction')) {
                chapterNumber = 0;
            } else if (titlePart.toLowerCase().includes('appendix')) {
                const appendixMatch = titlePart.match(/appendix\s+([A-Z])/i);
                if (appendixMatch) {
                    chapterNumber = `Appendix ${appendixMatch[1]}`;
                }
            }

            return {
                chapterNumber: chapterNumber,
                chapterTitle: chapterTitle,
                startingPage: isNaN(parseInt(pagePart)) ? pagePart : parseInt(pagePart),
                originalText: text
            };
        }
    }

    return null;
}

module.exports = {
    extractTOCFromPdf,
    extractBookmarks,
    getPageNumberFromDest,
    parseChapterFromBookmark,
    parseTOCEntries,
    parseTOCLine
}; 