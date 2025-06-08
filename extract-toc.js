const fs = require('fs');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

async function extractTOC() {
    const pdfPath = './files/How Emotions Are Made/book.pdf';
    const outputPath = './toc-output.json';

    try {
        // Load the PDF
        const data = new Uint8Array(fs.readFileSync(pdfPath));
        const doc = await pdfjsLib.getDocument(data).promise;

        console.log(`PDF has ${doc.numPages} pages`);

        // Check for PDF bookmarks/outlines first
        const outline = await doc.getOutline();
        if (outline && outline.length > 0) {
            console.log('\nFound PDF bookmarks/outline:');
            const chapters = await extractBookmarks(outline, doc);
            fs.writeFileSync(outputPath, JSON.stringify({
                source: 'pdf_bookmarks',
                chapters: chapters
            }, null, 2));
            console.log(`Chapters extracted and saved to ${outputPath}`);
            return;
        }

        // If no bookmarks, search for TOC pages
        console.log('\nNo PDF bookmarks found, searching for TOC pages...');

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
                console.log(`Found potential TOC on page ${i}`);
                tocPages.push({
                    pageNum: i,
                    textItems: textContent.items
                });
            }
        }

        if (tocPages.length === 0) {
            console.log('No TOC pages found');
            return;
        }

        // Parse TOC structure from found pages
        const parsedTOC = [];

        for (const tocPage of tocPages) {
            console.log(`\nParsing TOC from page ${tocPage.pageNum}:`);

            const tocEntries = parseTOCEntries(tocPage.textItems);
            parsedTOC.push({
                pageNum: tocPage.pageNum,
                entries: tocEntries
            });
        }

        // Flatten all entries from all pages into a single chapters array
        const allChapters = [];
        for (const tocPage of parsedTOC) {
            allChapters.push(...tocPage.entries);
        }

        // Save results
        fs.writeFileSync(outputPath, JSON.stringify({
            source: 'text_parsing',
            chapters: allChapters
        }, null, 2));
        console.log(`\nChapters extracted and saved to ${outputPath}`);

    } catch (error) {
        console.error('Error:', error);
    }
}

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
                    console.log(`Could not get page number for "${item.title}": ${error.message}`);
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

function parseChapterFromBookmark(title) {
    // Remove leading/trailing whitespace
    title = title.trim();

    // Pattern for numbered chapters: "1 The Search for Emotion's "Fingerprints""
    const numberedChapterMatch = title.match(/^(\d+)\s+(.+)$/);
    if (numberedChapterMatch) {
        return {
            chapterNumber: parseInt(numberedChapterMatch[1]),
            chapterTitle: numberedChapterMatch[2].trim(),
            startingPage: null, // Will be filled if we can extract from dest
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

    // Pattern for appendices: "Appendix A", "Appendix B", etc.
    const appendixMatch = title.match(/^Appendix\s+([A-Z])/i);
    if (appendixMatch) {
        return {
            chapterNumber: `Appendix ${appendixMatch[1]}`,
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

    return null;
}

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

extractTOC(); 