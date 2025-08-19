/**
 * Step 4: Paragraph and Header Detection
 * 
 * Detect both paragraph boundaries and headers in the page content from step 3.
 * This step creates a unified chunk structure with both paragraph and header chunks.
 * 
 * Requirements:
 * - Headers must satisfy 6-rule detection system
 * - Paragraphs cannot include headers - they end before headers and start after
 * - Process clean page content from step 3
 * - Extract links that exist within paragraph content
 * - Output: array of chapters, each chapter has array of chunks (paragraph, header, image)
 * - Each chunk has type, content, and links (if any)
 * 
 * Header Detection Rules (ALL must be satisfied):
 * 1. Length: 2-5 words only
 * 2. No Punctuation: Does not end with sentence punctuation (., !, ?)
 * 3. Capitalization: Starts with a capital letter
 * 4. Line Structure: Appears as standalone line
 * 5. Context - Previous: Previous line ends with sentence-ending punctuation
 * 6. Context - Next: Next line starts with a capital letter
 * 
 * Expected Input:
 * - pipelineState: { chapters: [...] with pages[].content and pages[].links, ... }
 * - config: { OUTPUT_DIR: path, DEBUG_DIR: path, ... }
 * 
 * Expected Output:
 * - { chapters: [{ title, chapterNumber, chunks: [{ type, pageNumber, content, links, wordCount }] }] }
 */

const fs = require('fs');
const path = require('path');

// Debug: capture detailed paragraph boundary decisions
let debugBoundaryEvents = [];

/**
 * Execute paragraph and header detection step
 * @param {Object} pipelineState - Current pipeline state
 * @param {Object} config - Configuration object
 * @returns {Object} - Updated pipeline state with chunk structure
 */
async function execute(pipelineState, config) {

    // Validate prerequisites
    if (!pipelineState.chapters || pipelineState.chapters.length === 0) {
        throw new Error('Step 3 (page extraction) must be completed first');
    }

    const startTime = Date.now();

    try {
        const chaptersWithChunks = [];
        let totalChunks = 0;
        let totalParagraphs = 0;
        let totalHeaders = 0;
        let totalLinksExtracted = 0;


        for (const chapter of pipelineState.chapters) {

            // Process each page to detect chunks (paragraphs and headers)
            let chapterChunks = detectChunksInChapter(chapter, chapter.chapterNumber);

            // Merge paragraphs that were split across page boundaries (no page semantics now)
            chapterChunks = mergeSplitParagraphsAcrossPageBoundaries(chapterChunks);

            // Apply size optimization for paragraphs only
            const optimizedChunks = optimizeChunkSizes(chapterChunks);

            // Assign sequential chunk IDs after optimization
            for (let i = 0; i < optimizedChunks.length; i++) {
                optimizedChunks[i].chunkId = `${chapter.chapterNumber}_${i + 1}`;
            }

            // Heuristic: promote very first small paragraph to header when it looks like a header
            if (optimizedChunks.length > 0) {
                const first = optimizedChunks[0];
                if (first.type === 'paragraph') {
                    const text = (first.content || '').trim();
                    const wordCount = getWordCount(text);
                    const endsWithPunct = /[.!?]$/.test(text);
                    if (wordCount > 0 && wordCount <= 5 && !endsWithPunct) {
                        first.type = 'header';
                        first.sentenceCount = 1;
                        first.links = [];
                    }
                }
            }

            // Count chunk types
            const paragraphCount = optimizedChunks.filter(c => c.type === 'paragraph').length;
            const headerCount = optimizedChunks.filter(c => c.type === 'header').length;
            const imageCount = optimizedChunks.filter(c => c.type === 'image').length;
            const chunkLinksCount = optimizedChunks.reduce((sum, c) => sum + (c.links ? c.links.length : 0), 0);

            totalChunks += optimizedChunks.length;
            totalParagraphs += paragraphCount;
            totalHeaders += headerCount;
            totalLinksExtracted += chunkLinksCount;




            chaptersWithChunks.push({
                title: chapter.title,
                chapterNumber: chapter.chapterNumber,
                pageNumberStart: chapter.pageNumberStart,
                pageNumberEnd: chapter.pageNumberEnd,
                // content removed - no longer needed after conversion to chunks
                chunks: optimizedChunks
            });
        }

        const endTime = Date.now();
        const processingTime = endTime - startTime;


        // Generate comprehensive statistics
        const stats = generateChunkStats(chaptersWithChunks);

        // Save debug output
        if (config.DEBUG_DIR) {
            await saveDebugOutput(config.DEBUG_DIR, chaptersWithChunks, stats, processingTime);
        }

        return {
            chapters: chaptersWithChunks,
            metadata: {
                ...pipelineState.metadata,
                stepResults: {
                    ...pipelineState.metadata.stepResults,
                    'step-4': {
                        totalChunks,
                        totalParagraphs,
                        totalHeaders,
                        totalLinksExtracted,
                        processingTime,
                        stats
                    }
                }
            }
        };

    } catch (error) {
        console.error('❌ Error in paragraph and header detection:', error);
        throw error;
    }
}

/**
 * Detect chunks (paragraphs and headers) in a chapter
 * @param {Object} chapter - Chapter with pages
 * @returns {Array} - Array of chunks with type, content, links
 */
function detectChunksInChapter(chapter, chapterNumber) {
    // If chapter-level concatenated content exists, prefer that to avoid page boundary artifacts
    if (chapter.content && typeof chapter.content === 'string' && chapter.content.trim().length > 0) {
        const aggregatedLinks = aggregateChapterLinks(chapter);
        const pseudoPage = {
            pageNumber: chapter.pageNumberStart,
            content: chapter.content,
            rawContent: chapter.content,
            links: aggregatedLinks
        };
        return detectChunksInPage(pseudoPage, chapterNumber, 0);
    }

    // Fallback to per-page processing
    const chunks = [];
    let pendingOrphanLetter = null;

    for (const page of chapter.pages) {
        const pageChunks = detectChunksInPage(page, chapterNumber, 0);
        if (pendingOrphanLetter) {
            for (let idx = 0; idx < pageChunks.length; idx++) {
                if (pageChunks[idx].type === 'paragraph') {
                    if (/^[a-z]/.test(pageChunks[idx].content)) {
                        pageChunks[idx].content = pendingOrphanLetter + pageChunks[idx].content;
                        pageChunks[idx].wordCount = getWordCount(pageChunks[idx].content);
                    }
                    break;
                }
            }
            pendingOrphanLetter = null;
        }
        chunks.push(...pageChunks);
        const raw = (page.rawContent && typeof page.rawContent === 'string') ? page.rawContent : page.content;
        if (raw) {
            const rawLines = raw.split('\n').map(l => (l || '').trim());
            for (let k = rawLines.length - 1; k >= 0; k--) {
                const t = rawLines[k];
                if (t.length === 0) continue;
                if (/^[A-Z]$/.test(t)) {
                    pendingOrphanLetter = t;
                }
                break;
            }
        }
    }

    return chunks;
}

/**
 * Merge adjacent paragraph chunks that look like mid-sentence splits caused by former page boundaries
 * Heuristic: If previous paragraph does not end with sentence terminator and next paragraph starts lowercase,
 * merge them. Headers/images are boundaries.
 */
function mergeSplitParagraphsAcrossPageBoundaries(chunks) {
    if (!Array.isArray(chunks) || chunks.length === 0) return chunks;
    const merged = [];
    for (let i = 0; i < chunks.length; i++) {
        const curr = chunks[i];
        if (curr.type !== 'paragraph') {
            merged.push(curr);
            continue;
        }
        // Try to merge with subsequent paragraph if mid-sentence
        let current = { ...curr };
        let j = i + 1;
        const skippedImages = []; // Collect images between paragraphs
        while (j < chunks.length) {
            const next = chunks[j];
            if (!next) break;
            if (next.type === 'header') break;
            if (next.type === 'image') {
                // Collect image chunks between paragraphs for later insertion
                skippedImages.push(next);
                j++;
                continue;
            }
            if (next.type !== 'paragraph') break;

            const currentText = (current.content || '').trim();
            const endsWithHardTerminator = /[.!?]["'”’)]?$/.test(currentText);
            // Treat common abbreviations/initials at the end as NOT a hard sentence terminator
            const endsWithSingleInitial = /\b[A-Z]\.$/.test(currentText);
            const endsWithMultiInitials = /(?:\b(?:[A-Z]\.)){2,}$/.test(currentText);
            const endsWithAbbreviation = /\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|i\.e|e\.g|U\.S|U\.K|E\.coli|H\.pylori)\.$/.test(currentText);
            const currEndsWithTerminator = endsWithHardTerminator && !(endsWithSingleInitial || endsWithMultiInitials || endsWithAbbreviation);
            const nextText = (next.content || '').trim();
            const nextStartsLower = /^[a-z]/.test(nextText);
            const nextLooksLikeHeader = isHeader(nextText, 0, [nextText]);
            const nextStartsList = /^•\s+\S/.test(nextText) || /^\d+[\.)]\s+/.test(nextText);
            if (!currEndsWithTerminator && !nextLooksLikeHeader && !nextStartsList) {

                // Merge next into current
                const newContent = (current.content || '').replace(/\s+$/, '') + ' ' + (next.content || '').replace(/^\s+/, '');
                current = {
                    ...current,
                    content: newContent,
                    wordCount: getWordCount(newContent),
                    sentenceCount: getSentenceCount(newContent),
                    links: removeDuplicateLinks([...(current.links || []), ...(next.links || [])])
                };
                j++;
                continue;
            }
            break;
        }
        // Add any skipped images before the merged paragraph
        merged.push(...skippedImages);
        merged.push(current);
        i = j - 1 >= i ? j - 1 : i;
    }
    return merged;
}

/**
 * Generate a short prefix for chunk IDs based on chapter title
 * @param {string} title - Chapter title
 * @returns {string} - Short prefix for chunk IDs
 */
function generateChapterPrefix(title) {
    // Take first few meaningful words and make them lowercase
    const words = title.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '') // Remove special characters
        .split(/\s+/)
        .filter(word => word.length > 2) // Filter out short words like "a", "of", "the"
        .slice(0, 2); // Take first 2 meaningful words

    if (words.length === 0) {
        return 'chapter';
    }

    return words.join('_');
}

/**
 * Detect chunks (paragraphs and headers) in a single page
 * @param {Object} page - Page with content and links
 * @param {number} chapterNumber - Chapter number for chunk IDs
 * @param {number} startChunkCounter - Starting counter for chunk IDs
 * @returns {Array} - Array of chunks detected in this page
 */
function detectChunksInPage(page, chapterNumber, startChunkCounter) {
    const chunks = [];
    // Prefer rawContent when available to preserve artifacts like orphan leading letters before headers
    const baseContent = (page.rawContent && typeof page.rawContent === 'string') ? page.rawContent : page.content;
    const lines = baseContent.split('\n');

    let currentParagraph = '';
    let currentParagraphStartIndex = 0;
    // If PDF extraction moves the first capital letter to a separate line before the chapter header
    // (e.g., "I" or "U"), capture it and prepend to the first paragraph after the header.
    let orphanLeadingLetter = null;
    let headerJustEmitted = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Skip empty lines
        if (!line) {
            continue;
        }

        // Skip page-number-only lines (e.g., "27", "181" or short numeric sequences)
        const numericOnly = line.replace(/\s+/g, '');
        if (/^\d{1,4}$/.test(numericOnly)) {
            continue;
        }

        // Preserve image markers in paragraph content - they will be processed in Step 5-1
        // Don't skip them, let them be included in the paragraph content

        // Detect ALL-CAPS header blocks possibly spanning multiple lines
        const isAllCapsHeaderBlockLine = (txt) => {
            const t = (txt || '').trim();
            if (t.length < 4) return false; // avoid single letters
            // Allow letters, digits, spaces, commas, hyphens, en/em dashes, colon
            // Require majority uppercase letters when letters exist
            const letters = t.replace(/[^A-Za-z]+/g, '');
            if (letters.length === 0) return false;
            const upper = letters.replace(/[^A-Z]/g, '').length;
            const ratio = upper / letters.length;
            if (ratio < 0.9) return false;
            // Disallow sentence-ending punctuation
            if (/[.!?]$/.test(t)) return false;
            return true;
        };

        if (isAllCapsHeaderBlockLine(line)) {
            let j = i;
            const collected = [lines[j].trim()];
            j++;
            while (j < lines.length) {
                const t = (lines[j] || '').trim();
                if (t.length === 0) break;
                if (!isAllCapsHeaderBlockLine(t)) break;
                collected.push(t);
                j++;
            }
            // Flush any pending paragraph first
            if (currentParagraph.trim()) {
                chunks.push(createParagraphChunk(currentParagraph.trim(), page, ''));
                currentParagraph = '';
            }
            const headerBlock = collected.join('\n');
            chunks.push(createHeaderChunk(headerBlock, page, ''));
            i = j - 1; // advance index
            headerJustEmitted = true;
            continue;
        }

        // Detect orphan capital letter placed on its own line (commonly extracted before chapter headings)
        // Example:
        // "I"\n
        // "CHAPTER TWO"\n
        // "EXERCISES ..."\n
        // "n this chapter ..."
        // We capture the single letter and prepend it to the first paragraph line starting lowercase.
        if (/^[A-Z]\s*$/.test(line)) {
            orphanLeadingLetter = line.trim();
            continue; // skip this orphan letter line entirely
        }

        // If we captured an orphan leading letter and current line is an ALL-CAPS header-like line,
        // force-create header regardless of previous-line punctuation rule.
        const isAllCapsHeaderLine = (txt) => {
            const t = (txt || '').trim();
            if (!t) return false;
            if (/[.!?]$/.test(t)) return false;
            const words = t.split(/\s+/);
            if (words.length < 2 || words.length > 8) return false;
            // Treat as all-caps if letters are uppercase or non-letters
            return words.every(w => /^(?:[A-Z0-9'’\-]+|&|®|™)$/.test(w) && w === w.toUpperCase());
        };

        if (orphanLeadingLetter && (isAllCapsHeaderLine(line) || /^CHAPTER\b/i.test(line))) {
            // Flush any pending paragraph first
            if (currentParagraph.trim()) {
                chunks.push(createParagraphChunk(currentParagraph.trim(), page, ''));
                currentParagraph = '';
            }
            chunks.push(createHeaderChunk(line, page, ''));
            headerJustEmitted = true;
            continue;
        }

        // Check if current line is a header
        if (isHeader(line, i, lines)) {
            // If we have accumulated paragraph content, save it first
            if (currentParagraph.trim()) {
                chunks.push(createParagraphChunk(currentParagraph.trim(), page, ''));
                currentParagraph = '';
            }

            // Create header chunk
            chunks.push(createHeaderChunk(line, page, ''));
            currentParagraphStartIndex = i + 1;
            headerJustEmitted = true;
        } else {
            // Add line to current paragraph
            if (currentParagraph) {
                currentParagraph += '\n' + line;
            } else {
                // If we captured an orphan leading letter like "I" or "U" and
                // the first line of the paragraph starts with lowercase, restore the capital.
                if (orphanLeadingLetter && /^[a-z]/.test(line)) {
                    currentParagraph = orphanLeadingLetter + line;
                    orphanLeadingLetter = null;
                } else {
                    let fixedLine = line;
                    if (headerJustEmitted && /^[a-z]/.test(line)) {
                        // Heuristic: first paragraph after a chapter/header often loses first letter
                        if (/^ntil\b/i.test(line)) {
                            fixedLine = 'U' + line;
                        } else if (/^n(\b|\s|[a-z])/i.test(line)) {
                            fixedLine = 'I' + line;
                        }
                    }
                    currentParagraph = fixedLine;
                }
                headerJustEmitted = false;
            }

            // Check if paragraph ends (sentence terminator followed by potential new paragraph)
            if (endsWithSentenceTerminator(line)) {
                // Look ahead to see if next non-empty line starts a new paragraph or is a header
                const nextContentIndex = findNextNonEmptyLine(lines, i + 1);

                // Special case: if current line ends with initials and next line starts with a capital letter
                // that could be continuing the same sentence (like another name), don't split
                if (nextContentIndex !== -1 && endsWithInitials(line) &&
                    /^[A-Z]/.test(lines[nextContentIndex].trim())) {
                    continue; // Don't split, continue building the paragraph
                }

                // If line ends with an abbreviation/initials and the next line starts lowercase,
                // keep it in the same paragraph (common book layout wrap)
                const lineTrim = line.trim();
                const endIsSingleInitial = /\b[A-Z]\.$/.test(lineTrim);
                const endIsMultiInitials = /(?:\b(?:[A-Z]\.)){2,}(?:["'”’)]{1})?$/.test(lineTrim);
                const endIsAbbreviation = /\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|i\.e|e\.g)\.$/.test(lineTrim);
                const nextStartsLower = nextContentIndex !== -1 && /^[a-z]/.test((lines[nextContentIndex] || '').trim());
                if ((endIsSingleInitial || endIsMultiInitials || endIsAbbreviation) && nextStartsLower) {
                    // Continue building the paragraph instead of splitting
                    continue;
                }

                // NEW REQUIREMENT: Paragraphs MUST end with a newline after the sentence terminator
                // Check if there's actually a line break structure that indicates a paragraph boundary
                // Only end paragraph if:
                // 1. We're at the end of the page, OR
                // 2. There's an empty line between current line and next content, OR  
                // 3. Next line is a header
                const hasEmptyLineBetween = nextContentIndex > i + 1; // Gap indicates empty line(s)

                // Debug: record decision inputs for this potential boundary
                try {
                    const lineTrim = line.trim();
                    const endIsSingleInitial = /\b[A-Z]\.$/.test(lineTrim);
                    const endIsMultiInitials = /(?:\b(?:[A-Z]\.)){2,}(?:["'”’)]{1})?$/.test(lineTrim);
                    const endIsAbbreviation = /\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|i\.e|e\.g)\.$/.test(lineTrim);
                    const nextLineTrim = nextContentIndex !== -1 ? (lines[nextContentIndex] || '').trim() : '';
                    const isHeaderNext = nextContentIndex !== -1 ? isHeader(lines[nextContentIndex], nextContentIndex, lines) : false;
                    const nextStartsLowerDbg = nextLineTrim ? /^[a-z]/.test(nextLineTrim) : false;
                    debugBoundaryEvents.push({
                        pageNumber: page.pageNumber,
                        lineIndex: i,
                        lineTail: line.slice(Math.max(0, line.length - 60)),
                        endsWithTerminator: true,
                        nextContentIndex,
                        hasEmptyLineBetween,
                        nextLineHead: nextLineTrim.slice(0, 80),
                        endIsSingleInitial,
                        endIsMultiInitials,
                        endIsAbbreviation,
                        nextStartsLower: nextStartsLowerDbg,
                        isHeaderNext,
                        treatedAsBoundary: (nextContentIndex === -1) || hasEmptyLineBetween || isHeaderNext
                    });
                } catch (e) {}

                if (nextContentIndex === -1 || // End of page
                    hasEmptyLineBetween || // Empty line(s) between current and next content
                    isHeader(lines[nextContentIndex], nextContentIndex, lines)) { // Next line is header

                    // End current paragraph
                    chunks.push(createParagraphChunk(currentParagraph.trim(), page, ''));
                    currentParagraph = '';
                    currentParagraphStartIndex = nextContentIndex;
                    headerJustEmitted = false;
                }
                // If next line immediately follows (no empty line) and starts with capital letter,
                // treat it as continuing the same paragraph (like "The dice were loaded." case)
            }
        }
    }

    // Handle any remaining paragraph content
    if (currentParagraph.trim()) {
        chunks.push(createParagraphChunk(currentParagraph.trim(), page, ''));
    }

    return chunks;
}



/**
 * Check if a numbered line is part of a numbered list (vs a standalone header)
 * @param {number} lineIndex - Index of the current line
 * @param {Array} allLines - All lines in the page
 * @returns {boolean} - True if this appears to be part of a numbered list
 */
function isPartOfNumberedList(lineIndex, allLines) {
    const currentLine = allLines[lineIndex].trim();
    const currentMatch = currentLine.match(/^(\d+)[\.)]\s+/);
    if (!currentMatch) return false;
    
    const currentNumber = parseInt(currentMatch[1]);
    
    // Look for previous and next numbered items to confirm it's a list
    let foundPrevious = false;
    let foundNext = false;
    
    // Check previous lines for (currentNumber - 1)
    for (let i = lineIndex - 1; i >= 0 && i >= lineIndex - 10; i--) {
        const line = allLines[i].trim();
        if (!line) continue;
        
        const match = line.match(/^(\d+)[\.)]\s+/);
        if (match) {
            const num = parseInt(match[1]);
            if (num === currentNumber - 1) {
                foundPrevious = true;
                break;
            }
            if (num < currentNumber - 1) break; // Found an older number, stop looking
        }
    }
    
    // Check next lines for (currentNumber + 1)
    for (let i = lineIndex + 1; i < allLines.length && i <= lineIndex + 10; i++) {
        const line = allLines[i].trim();
        if (!line) continue;
        
        const match = line.match(/^(\d+)[\.)]\s+/);
        if (match) {
            const num = parseInt(match[1]);
            if (num === currentNumber + 1) {
                foundNext = true;
                break;
            }
            if (num > currentNumber + 1) break; // Found a future number, stop looking
        }
    }
    
    // Also check for the common pattern where we have item 1 without a previous item
    // (like at the start of a list) - if we find the next number, it's likely a list
    if (currentNumber === 1 && foundNext) {
        return true;
    }
    
    // If we found either previous or next sequential number, it's likely a list
    return foundPrevious || foundNext;
}

/**
 * Check if a line is a header using the 6-rule system
 * @param {string} line - Line to check
 * @param {number} lineIndex - Index of the line
 * @param {Array} allLines - All lines in the page
 * @returns {boolean} - True if line is a header
 */
function isHeader(line, lineIndex, allLines) {
    const tline = line.trim();

    // Special case: Numbered headers like "#11. Breath Hold Activation" / "13) ..."
    // Accept when pattern matches number prefix and 2-12 capitalized words follow, no terminal punctuation
    // BUT exclude list items (consecutive numbered sequences like 1., 2., 3.)
    const numberedHeaderMatch = tline.match(/^#?\d+[\.)]\s+(.+)$/);
    if (numberedHeaderMatch) {
        const title = numberedHeaderMatch[1].trim();
        if (!/[.!?]$/.test(title)) {
            const titleWords = title.split(/\s+/);
            if (titleWords.length >= 2 && titleWords.length <= 12) {
                const capCount = titleWords.filter(w => /^[A-Z]/.test(w.replace(/^["'""''(]+/, ''))).length;
                const ratio = capCount / titleWords.length;
                if (ratio >= 0.6) {
                    // Check if this appears to be part of a numbered list
                    if (isPartOfNumberedList(lineIndex, allLines)) {
                        return false; // Don't treat list items as headers
                    }
                    return true;
                }
            }
        }
    }

    // Rule 1: Length - 2-5 words only (but allow numbered headers with more words separately above)
    const words = tline.split(/\s+/);
    if (words.length < 2 || words.length > 5) {
        return false;
    }

    // Rule 2: No Punctuation - Does not end with sentence punctuation
    if (/[.!?]$/.test(tline)) {
        return false;
    }

    // Rule 3: Capitalization: Starts with a capital letter OR page number + capital letter
    if (!/^[A-Z]/.test(tline) && !/^\d+\s+[A-Z]/.test(tline)) {
        return false;
    }

    // Rule 4: Line Structure - Appears as standalone line (already handled by line splitting)

    // Rule 5: Context - Previous - Previous line ends with sentence-ending punctuation
    const prevLine = findPreviousNonEmptyLine(allLines, lineIndex - 1);
    if (prevLine !== null && !endsWithSentenceTerminator(prevLine)) {
        return false;
    }

    // Rule 6: Context - Next - Next line starts with a capital letter
    const nextLine = findNextNonEmptyLine(allLines, lineIndex + 1);
    if (nextLine !== -1) {
        const next = allLines[nextLine].trim();
        // Accept next lines that start with capital OR with list-type content (bulleted or numbered lists)
        const startsWithCapital = /^[A-Z]/.test(next);
        const startsWithBullet = /^•\s+\S/.test(next);
        const startsWithNumberedItem = /^\d+[\.)]\s+/.test(next);
        if (!startsWithCapital && !startsWithBullet && !startsWithNumberedItem) {
            return false;
        }
    }

    return true;
}

/**
 * Find the previous non-empty line
 * @param {Array} lines - All lines
 * @param {number} startIndex - Index to start searching backwards from
 * @returns {string|null} - Previous non-empty line or null if none found
 */
function findPreviousNonEmptyLine(lines, startIndex) {
    for (let i = startIndex; i >= 0; i--) {
        const line = lines[i].trim();
        if (line) {
            return line;
        }
    }
    return null;
}

/**
 * Find the next non-empty line
 * @param {Array} lines - All lines
 * @param {number} startIndex - Index to start searching from
 * @returns {number} - Index of next non-empty line or -1 if none found
 */
function findNextNonEmptyLine(lines, startIndex) {
    for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line) {
            return i;
        }
    }
    return -1;
}

/**
 * Create a paragraph chunk
 * @param {string} content - Paragraph content
 * @param {Object} page - Page object with pageNumber and links
 * @returns {Object} - Paragraph chunk
 */
function createParagraphChunk(content, page, chunkId) {
    const links = extractLinksFromContent(content, page.links || []);

    return {
        chunkId: chunkId,
        type: 'paragraph',
        content: content,
        wordCount: getWordCount(content),
        sentenceCount: getSentenceCount(content),
        links: links
    };
}

/**
 * Create a header chunk
 * @param {string} content - Header content
 * @param {Object} page - Page object with pageNumber
 * @returns {Object} - Header chunk
 */
function createHeaderChunk(content, page) {
    return {
        type: 'header',
        content: content,
        wordCount: getWordCount(content),
        sentenceCount: 1, // Headers are always one "sentence"
        links: [] // Headers typically don't contain links
    };
}

/**
 * Create an image chunk
 * @param {Object} image - Image object with imageName, imageAlt, etc.
 * @param {Object} page - Page object with pageNumber
 * @param {string} chunkId - Chunk ID
 * @returns {Object} - Image chunk
 */
function createImageChunk(image, page, chunkId) {
    return {
        chunkId: chunkId,
        type: 'image',
        content: image.imageAlt || `Image: ${image.imageName}`,
        wordCount: 0, // Images don't have words
        sentenceCount: 0, // Images don't have sentences
        links: [],
        imageName: image.imageName,
        imageAlt: image.imageAlt,
        extracted: image.extracted,
        placeholder: image.placeholder,
        originalName: image.originalName
    };
}

/**
 * Optimize chunk sizes for paragraphs (merge small, split large)
 * @param {Array} chunks - Array of chunks
 * @returns {Array} - Optimized chunks
 */
function optimizeChunkSizes(chunks) {
    const optimized = [];

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];

        // Headers and images are never optimized
        if (chunk.type === 'header' || chunk.type === 'image') {
            optimized.push(chunk);
            continue;
        }

        // For paragraphs, apply size optimization
        if (chunk.wordCount < 20) {
            // Merge very small paragraphs (< 20 words) to meet validation requirements
            const mergedChunk = tryMergeWithNextParagraph(chunks, i);
            if (mergedChunk) {
                optimized.push(mergedChunk.merged);

                // Process any headers that were skipped during merge
                for (let skipIndex = i + 1; skipIndex < mergedChunk.nextIndex; skipIndex++) {
                    if (chunks[skipIndex].type === 'header') {
                        optimized.push(chunks[skipIndex]);
                    }
                }

                i = mergedChunk.nextIndex; // Skip to the merged paragraph
            } else {
                // Try merging with previous paragraph if next merge failed
                const mergedWithPrevious = tryMergeWithPreviousParagraph(optimized, chunk);
                if (mergedWithPrevious) {
                    // Replace the last optimized chunk with the merged version
                    optimized[optimized.length - 1] = mergedWithPrevious;

                } else {

                    optimized.push(chunk);
                }
            }
        } else if (chunk.wordCount < 100) {
            // Try to merge medium-sized paragraphs for better optimization
            const mergedChunk = tryMergeWithNextParagraph(chunks, i);
            if (mergedChunk) {
                optimized.push(mergedChunk.merged);

                // Process any headers that were skipped during merge
                for (let skipIndex = i + 1; skipIndex < mergedChunk.nextIndex; skipIndex++) {
                    if (chunks[skipIndex].type === 'header') {
                        optimized.push(chunks[skipIndex]);
                    }
                }

                i = mergedChunk.nextIndex; // Skip to the merged paragraph
            } else {
                optimized.push(chunk);
            }
        } else if (chunk.wordCount > 200) {
            // Split large paragraph
            const splitChunks = splitLargeParagraph(chunk);
            optimized.push(...splitChunks);
        } else {
            optimized.push(chunk);
        }
    }

    // Second pass: merge any small paragraphs that were created during splitting
    const secondPassOptimized = [];

    for (let i = 0; i < optimized.length; i++) {
        const chunk = optimized[i];

        // Headers are never optimized
        if (chunk.type === 'header') {
            secondPassOptimized.push(chunk);
            continue;
        }

        if (chunk.type === 'paragraph' && chunk.wordCount < 20) {
            // Try to merge with previous paragraph
            const mergedWithPrevious = tryMergeWithPreviousParagraph(secondPassOptimized, chunk);
            if (mergedWithPrevious) {
                // Replace the last optimized chunk with the merged version
                secondPassOptimized[secondPassOptimized.length - 1] = mergedWithPrevious;
            } else {
                // Try to merge with next paragraph
                const mergedWithNext = tryMergeWithNextParagraph(optimized, i);
                if (mergedWithNext) {
                    secondPassOptimized.push(mergedWithNext.merged);

                    // Process any headers that were skipped during merge
                    for (let skipIndex = i + 1; skipIndex < mergedWithNext.nextIndex; skipIndex++) {
                        if (optimized[skipIndex].type === 'header') {
                            secondPassOptimized.push(optimized[skipIndex]);
                        }
                    }

                    i = mergedWithNext.nextIndex; // Skip to the merged paragraph
                } else {
                    secondPassOptimized.push(chunk);
                }
            }
        } else {
            secondPassOptimized.push(chunk);
        }
    }

    return secondPassOptimized;
}

/**
 * Try to merge current paragraph with next paragraph chunk
 * @param {Array} chunks - All chunks
 * @param {number} currentIndex - Current chunk index
 * @returns {Object|null} - Merged chunk info or null if no merge possible
 */
function tryMergeWithNextParagraph(chunks, currentIndex) {
    // Look ahead for next paragraph chunk (skip images; stop at headers)
    const currentChunk = chunks[currentIndex];
    for (let i = currentIndex + 1; i < chunks.length; i++) {
        const nextChunk = chunks[i];
        if (nextChunk.type === 'header') break; // natural boundary
        if (nextChunk.type === 'image') continue; // ignore images between
        if (nextChunk.type !== 'paragraph') break;

        // Page semantics removed: no page-based merge restriction

        const combinedWordCount = currentChunk.wordCount + nextChunk.wordCount;
        const maxCombinedSize = currentChunk.wordCount < 20 ? 400 : 300;
        if (combinedWordCount <= maxCombinedSize) {
            const mergedContent = currentChunk.content + '\n' + nextChunk.content;
            const allPotentialLinks = [...(currentChunk.links || []), ...(nextChunk.links || [])];
            const validLinks = allPotentialLinks.filter(link => isSourceTextInContent(link.text, mergedContent));
            return {
                merged: {
                    chunkId: currentChunk.chunkId,
                    type: 'paragraph',
                    content: mergedContent,
                    pageNumber: currentChunk.pageNumber,
                    wordCount: combinedWordCount,
                    sentenceCount: currentChunk.sentenceCount + nextChunk.sentenceCount,
                    links: removeDuplicateLinks(validLinks)
                },
                nextIndex: i
            };
        }
        break; // found next paragraph but cannot merge due to size
    }

    return null;
}

/**
 * Try to merge current small paragraph with previous paragraph chunk
 * @param {Array} optimizedChunks - Already processed chunks
 * @param {Object} currentChunk - Current small chunk to merge
 * @returns {Object|null} - Merged chunk or null if no merge possible
 */
function tryMergeWithPreviousParagraph(optimizedChunks, currentChunk) {
    // Look backwards for the last paragraph chunk (skip headers)
    for (let i = optimizedChunks.length - 1; i >= 0; i--) {
        const previousChunk = optimizedChunks[i];

        if (previousChunk.type === 'header') {
            // If there's a header between paragraphs, don't merge across it
            continue;
        }
        if (previousChunk.type === 'image') {
            // Ignore images between paragraphs
            continue;
        }

        if (previousChunk.type === 'paragraph') {
            // Page semantics removed: no page-based merge restriction

            const combinedWordCount = previousChunk.wordCount + currentChunk.wordCount;

            // Only merge if combined size is reasonable (more generous for very small paragraphs)
            const maxCombinedSize = currentChunk.wordCount < 20 ? 400 : 300;
            if (combinedWordCount <= maxCombinedSize) {
                const mergedContent = previousChunk.content + '\n' + currentChunk.content;
                // Get all potential links from both chunks and re-validate against merged content
                const allPotentialLinks = [...(previousChunk.links || []), ...(currentChunk.links || [])];
                const validLinks = allPotentialLinks.filter(link => isSourceTextInContent(link.text, mergedContent));

                return {
                    chunkId: previousChunk.chunkId, // Keep original chunkId
                    type: 'paragraph',
                    content: mergedContent,
                    pageNumber: previousChunk.pageNumber,
                    wordCount: combinedWordCount,
                    sentenceCount: previousChunk.sentenceCount + currentChunk.sentenceCount,
                    links: removeDuplicateLinks(validLinks)
                };
            }
        }

        break; // Only check the most recent paragraph chunk
    }

    return null;
}

/**
 * Split a large paragraph into smaller chunks
 * @param {Object} chunk - Large paragraph chunk
 * @returns {Array} - Array of smaller chunks
 */
function splitLargeParagraph(chunk) {
    const sentences = splitIntoSentences(chunk.content);
    const chunks = [];
    let currentContent = '';
    let currentSentenceCount = 0;
    let splitIndex = 1;

    for (const sentence of sentences) {
        const sentenceWordCount = getWordCount(sentence);
        const currentWordCount = getWordCount(currentContent);

        if (currentWordCount + sentenceWordCount > 200 && currentContent.trim()) {
            // Create chunk with current content
            const trimmedContent = currentContent.trim();
            chunks.push({
                chunkId: chunk.chunkId,
                type: 'paragraph',
                content: trimmedContent,
                pageNumber: chunk.pageNumber,
                wordCount: currentWordCount,
                sentenceCount: currentSentenceCount,
                links: (chunk.links || []).filter(link => isSourceTextInContent(link.text, trimmedContent))
            });

            splitIndex++;
            currentContent = sentence;
            currentSentenceCount = 1;
        } else {
            currentContent += (currentContent ? ' ' : '') + sentence;
            currentSentenceCount++;
        }
    }

    // Add remaining content
    if (currentContent.trim()) {
        const trimmedContent = currentContent.trim();
        chunks.push({
            chunkId: chunk.chunkId,
            type: 'paragraph',
            content: trimmedContent,
            pageNumber: chunk.pageNumber,
            wordCount: getWordCount(currentContent),
            sentenceCount: currentSentenceCount,
            links: (chunk.links || []).filter(link => isSourceTextInContent(link.text, trimmedContent))
        });
    }

    return chunks;
}

/**
 * Split text into sentences
 * @param {string} text - Text to split
 * @returns {Array} - Array of sentences
 */
function splitIntoSentences(text) {
    // Split on sentence terminators, keeping the punctuation
    // But avoid splitting after common abbreviations and multi-initials
    const sentences = text.split(/(?<=[.!?])(?<!\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|i\.e|e\.g)\.)(?<!(?:\b(?:[A-Z]\.)){2,})\s+/);
    return sentences.filter(s => s.trim().length > 0);
}

/**
 * Get word count of text
 * @param {string} text - Text to count
 * @returns {number} - Word count
 */
function getWordCount(text) {
    if (!text || typeof text !== 'string') return 0;
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Get sentence count of text
 * @param {string} text - Text to count
 * @returns {number} - Sentence count
 */
function getSentenceCount(text) {
    return (text.match(/[.!?]/g) || []).length;
}

/**
 * Check if line ends with sentence terminator
 * @param {string} line - Line to check
 * @returns {boolean} - True if line ends with sentence terminator
 */
function endsWithSentenceTerminator(line) {
    const trimmed = line.trim();

    // Check if it ends with sentence terminator
    if (!/[.!?]$/.test(trimmed)) {
        return false;
    }

    // If it ends with a period, check if it's an initial (single capital letter followed by period)
    if (trimmed.endsWith('.')) {
        // Check if it's an initial like "J." or "H." at the end
        if (/\b[A-Z]\.$/.test(trimmed)) {
            return false;
        }

        // Ignore common abbreviations that shouldn't end a sentence
        const abbreviationAtEnd = /\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|i\.e|e\.g)\.$/;
        if (abbreviationAtEnd.test(trimmed)) {
            return false;
        }

        // Ignore multi-initial sequences like "P.U.", "U.S.", "A.B.", "U.S.A." at the end (optionally closed by quotes or ) )
        const multiInitialTest = /(?:\b(?:[A-Z]\.)){2,}(?:["'"')]{1})?$/.test(trimmed);
        if (multiInitialTest) {
            return false;
        }
        

    }

    return true;
}

// endsWithInitials function is now imported from validation module

/**
 * Check if line starts a new paragraph
 * @param {string} line - Line to check
 * @returns {boolean} - True if line starts new paragraph
 */
function startsNewParagraph(line) {
    return /^[A-Z]/.test(line.trim());
}

/**
 * Extract links from content
 * @param {string} content - Content to search for links
 * @param {Array} pageLinks - Available links from the page
 * @returns {Array} - Links found in content
 */
function extractLinksFromContent(content, pageLinks) {
    if (!pageLinks || pageLinks.length === 0) {
        return [];
    }

    const foundLinks = [];

    for (const link of pageLinks) {
        const sourceText = link.sourceText || link.text;
        if (sourceText && isSourceTextInContent(sourceText, content)) {
            foundLinks.push({
                text: sourceText,
                linkId: link.linkId,
                role: link.role,
                anchor: link.anchor
            });
        }
    }

    return removeDuplicateLinks(foundLinks);
}

// isSourceTextInContent function is now imported from validation module

// isFootnoteInContent function is now imported from validation module

/**
 * Remove duplicate links
 * @param {Array} links - Links array
 * @returns {Array} - Deduplicated links
 */
function removeDuplicateLinks(links) {
    const seen = new Set();
    return links.filter(link => {
        const key = `${link.text}-${link.linkId}-${link.role}`;
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}

/**
 * Generate comprehensive chunk statistics
 * @param {Array} chapters - Chapters with chunks
 * @returns {Object} - Statistics
 */
function generateChunkStats(chapters) {
    let totalChunks = 0;
    let totalParagraphs = 0;
    let totalHeaders = 0;
    let totalWords = 0;
    let totalLinks = 0;

    const paragraphWordCounts = [];
    const headerWordCounts = [];

    for (const chapter of chapters) {
        for (const chunk of chapter.chunks) {
            totalChunks++;
            totalWords += chunk.wordCount;
            totalLinks += chunk.links ? chunk.links.length : 0;

            if (chunk.type === 'paragraph') {
                totalParagraphs++;
                paragraphWordCounts.push(chunk.wordCount);
            } else if (chunk.type === 'header') {
                totalHeaders++;
                headerWordCounts.push(chunk.wordCount);
            }
        }
    }

    return {
        totalChunks,
        totalParagraphs,
        totalHeaders,
        totalWords,
        totalLinks,
        paragraphStats: {
            count: totalParagraphs,
            wordCounts: paragraphWordCounts,
            averageWords: paragraphWordCounts.length > 0 ? paragraphWordCounts.reduce((a, b) => a + b, 0) / paragraphWordCounts.length : 0,
            minWords: Math.min(...paragraphWordCounts),
            maxWords: Math.max(...paragraphWordCounts)
        },
        headerStats: {
            count: totalHeaders,
            wordCounts: headerWordCounts,
            averageWords: headerWordCounts.length > 0 ? headerWordCounts.reduce((a, b) => a + b, 0) / headerWordCounts.length : 0,
            minWords: headerWordCounts.length > 0 ? Math.min(...headerWordCounts) : 0,
            maxWords: headerWordCounts.length > 0 ? Math.max(...headerWordCounts) : 0
        }
    };
}

/**
 * Save debug output
 * @param {string} debugDir - Debug directory path
 * @param {Array} chapters - Chapters with chunks
 * @param {Object} stats - Processing statistics
 * @param {number} processingTime - Processing time in ms
 */
async function saveDebugOutput(debugDir, chapters, stats, processingTime) {
    const debugOutput = {
        timestamp: new Date().toISOString(),
        processingTime: `${processingTime}ms`,
        summary: {
            totalChapters: chapters.length,
            totalChunks: stats.totalChunks,
            totalParagraphs: stats.totalParagraphs,
            totalHeaders: stats.totalHeaders,
            totalWords: stats.totalWords,
            totalLinks: stats.totalLinks
        },
        statistics: stats,
        boundaryEvents: debugBoundaryEvents.slice(-200),
        chapters: chapters.map(chapter => ({
            chapterNumber: chapter.chapterNumber,
            title: chapter.title,
            chunkCount: chapter.chunks.length,
            paragraphCount: chapter.chunks.filter(c => c.type === 'paragraph').length,
            headerCount: chapter.chunks.filter(c => c.type === 'header').length,
            chunks: chapter.chunks.map(chunk => ({
                type: chunk.type,
                content: chunk.content.substring(0, 200) + (chunk.content.length > 200 ? '...' : ''),
                wordCount: chunk.wordCount,
                sentenceCount: chunk.sentenceCount,
                linkCount: chunk.links ? chunk.links.length : 0
            }))
        }))
    };

    const debugPath = path.join(debugDir, 'step-04-paragraph-and-header-detection.json');
    await fs.promises.writeFile(debugPath, JSON.stringify(debugOutput, null, 2));
    // Reset after writing to avoid unbounded growth across runs
    debugBoundaryEvents = [];
}

// countWords function is now imported from validation module

/**
 * Aggregate links from all pages into a single array for chapter-level processing
 */
function aggregateChapterLinks(chapter) {
    if (!chapter || !Array.isArray(chapter.pages)) return [];
    const links = [];
    for (const p of chapter.pages) {
        if (p && Array.isArray(p.links)) links.push(...p.links);
    }
    return links;
}

// endsWithInitials function is now imported from validation module

// endsWithCommonSingleLetterWord function is now imported from validation module

// findPreviousParagraph function is now imported from validation module

// findNextParagraph function is now imported from validation module

const { validate, countWords, endsWithInitials, endsWithCommonSingleLetterWord, findPreviousParagraph, findNextParagraph, isSourceTextInContent } = require('./04-paragraph-detection-validation');



module.exports = { execute, validate }; 