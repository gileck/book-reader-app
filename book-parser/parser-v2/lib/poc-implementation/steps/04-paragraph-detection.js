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
 * - Output: array of chapters, each chapter has array of chunks (paragraph or header)
 * - Each chunk has type, pageNumber, content, and links (if any)
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

/**
 * Execute paragraph and header detection step
 * @param {Object} pipelineState - Current pipeline state
 * @param {Object} config - Configuration object
 * @returns {Object} - Updated pipeline state with chunk structure
 */
async function execute(pipelineState, config) {
    console.log('📄 Starting paragraph and header detection (Step 4)...');
    
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
        
        console.log(`📚 Processing ${pipelineState.chapters.length} chapters...`);
        
        for (const chapter of pipelineState.chapters) {
            console.log(`  📖 Processing chapter: ${chapter.title} (${chapter.pages.length} pages)`);
            
            // Process each page to detect chunks (paragraphs and headers)
            const chapterChunks = detectChunksInChapter(chapter, chapter.chapterNumber);
            
            // Apply size optimization for paragraphs only
            const optimizedChunks = optimizeChunkSizes(chapterChunks);
            
            // Assign sequential chunk IDs after optimization
            for (let i = 0; i < optimizedChunks.length; i++) {
                optimizedChunks[i].chunkId = `${chapter.chapterNumber}_${i + 1}`;
            }
            
            // Count chunk types
            const paragraphCount = optimizedChunks.filter(c => c.type === 'paragraph').length;
            const headerCount = optimizedChunks.filter(c => c.type === 'header').length;
            const chunkLinksCount = optimizedChunks.reduce((sum, c) => sum + (c.links ? c.links.length : 0), 0);
            
            totalChunks += optimizedChunks.length;
            totalParagraphs += paragraphCount;
            totalHeaders += headerCount;
            totalLinksExtracted += chunkLinksCount;
            
            console.log(`    ✅ Created ${optimizedChunks.length} chunks (${paragraphCount} paragraphs, ${headerCount} headers)`);
            

            
            chaptersWithChunks.push({
                title: chapter.title,
                chapterNumber: chapter.chapterNumber,
                pageNumberStart: chapter.pageNumberStart,
                pageNumberEnd: chapter.pageNumberEnd,
                chunks: optimizedChunks
            });
        }
        
        const endTime = Date.now();
        const processingTime = endTime - startTime;
        
        console.log(`✅ Paragraph and header detection completed in ${processingTime}ms`);
        console.log(`📊 Total chunks: ${totalChunks} (${totalParagraphs} paragraphs, ${totalHeaders} headers)`);
        console.log(`🔗 Total links extracted: ${totalLinksExtracted}`);
        
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
 * @returns {Array} - Array of chunks with type, content, pageNumber, links
 */
function detectChunksInChapter(chapter, chapterNumber) {
    const chunks = [];
    
    for (const page of chapter.pages) {
        const pageChunks = detectChunksInPage(page, chapterNumber, 0); // Pass 0 as placeholder
        chunks.push(...pageChunks);
    }
    
    return chunks;
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
    const lines = page.content.split('\n');
    
    let currentParagraph = '';
    let currentParagraphStartIndex = 0;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Skip empty lines
        if (!line) {
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
        } else {
            // Add line to current paragraph
            if (currentParagraph) {
                currentParagraph += '\n' + line;
            } else {
                currentParagraph = line;
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
                
                // NEW REQUIREMENT: Paragraphs MUST end with a newline after the sentence terminator
                // Check if there's actually a line break structure that indicates a paragraph boundary
                // Only end paragraph if:
                // 1. We're at the end of the page, OR
                // 2. There's an empty line between current line and next content, OR  
                // 3. Next line is a header
                const hasEmptyLineBetween = nextContentIndex > i + 1; // Gap indicates empty line(s)
                
                if (nextContentIndex === -1 || // End of page
                    hasEmptyLineBetween || // Empty line(s) between current and next content
                    isHeader(lines[nextContentIndex], nextContentIndex, lines)) { // Next line is header
                    
                    // End current paragraph
                    chunks.push(createParagraphChunk(currentParagraph.trim(), page, ''));
                    currentParagraph = '';
                    currentParagraphStartIndex = nextContentIndex;
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
 * Check if a line is a header using the 6-rule system
 * @param {string} line - Line to check
 * @param {number} lineIndex - Index of the line
 * @param {Array} allLines - All lines in the page
 * @returns {boolean} - True if line is a header
 */
function isHeader(line, lineIndex, allLines) {
    // Rule 1: Length - 2-5 words only
    const words = line.trim().split(/\s+/);
    if (words.length < 2 || words.length > 5) {
        return false;
    }
    
    // Rule 2: No Punctuation - Does not end with sentence punctuation
    if (/[.!?]$/.test(line.trim())) {
        return false;
    }
    
    // Rule 3: Capitalization: Starts with a capital letter
    if (!/^[A-Z]/.test(line.trim())) {
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
    if (nextLine !== -1 && !/^[A-Z]/.test(allLines[nextLine].trim())) {
        return false;
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
        pageNumber: page.pageNumber,
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
function createHeaderChunk(content, page, chunkId) {
    return {
        chunkId: chunkId,
        type: 'header',
        content: content,
        pageNumber: page.pageNumber,
        wordCount: getWordCount(content),
        sentenceCount: 1, // Headers are always one "sentence"
        links: [] // Headers typically don't contain links
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
        
        // Headers are never optimized
        if (chunk.type === 'header') {
            optimized.push(chunk);
            continue;
        }
        
        // For paragraphs, apply size optimization
        if (chunk.wordCount < 100) {
            // Try to merge with next paragraph chunk
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
    

    
    return optimized;
}

/**
 * Try to merge current paragraph with next paragraph chunk
 * @param {Array} chunks - All chunks
 * @param {number} currentIndex - Current chunk index
 * @returns {Object|null} - Merged chunk info or null if no merge possible
 */
function tryMergeWithNextParagraph(chunks, currentIndex) {
    // Look for next paragraph chunk (skip headers)
    for (let i = currentIndex + 1; i < chunks.length; i++) {
        const nextChunk = chunks[i];
        
        if (nextChunk.type === 'header') {
            // If there's a header between paragraphs, don't merge across it
            // Headers indicate natural section boundaries
            break;
        }
        
        if (nextChunk.type === 'paragraph') {
            const currentChunk = chunks[currentIndex];
            
            // Don't merge paragraphs from different pages unless they're consecutive
            // This prevents merging content that was separated by headers at page boundaries
            if (currentChunk.pageNumber !== nextChunk.pageNumber) {
                const pageDifference = nextChunk.pageNumber - currentChunk.pageNumber;
                if (pageDifference > 1) {
                    break; // Don't merge across non-consecutive pages
                }
            }
            
            const combinedWordCount = currentChunk.wordCount + nextChunk.wordCount;
            
            // Only merge if combined size is reasonable
            if (combinedWordCount <= 300) {
                return {
                    merged: {
                        chunkId: currentChunk.chunkId, // Keep original chunkId without suffix
                        type: 'paragraph',
                        content: currentChunk.content + '\n' + nextChunk.content,
                        pageNumber: currentChunk.pageNumber,
                        wordCount: combinedWordCount,
                        sentenceCount: currentChunk.sentenceCount + nextChunk.sentenceCount,
                        links: [...(currentChunk.links || []), ...(nextChunk.links || [])]
                    },
                    nextIndex: i
                };
            }
        }
        
        break; // Only check the next paragraph chunk
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
            chunks.push({
                chunkId: chunk.chunkId,
                type: 'paragraph',
                content: currentContent.trim(),
                pageNumber: chunk.pageNumber,
                wordCount: currentWordCount,
                sentenceCount: currentSentenceCount,
                links: (chunk.links || []).filter(link => currentContent.trim().includes(link.text))
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
        chunks.push({
            chunkId: chunk.chunkId,
            type: 'paragraph',
            content: currentContent.trim(),
            pageNumber: chunk.pageNumber,
            wordCount: getWordCount(currentContent),
            sentenceCount: currentSentenceCount,
            links: (chunk.links || []).filter(link => currentContent.trim().includes(link.text))
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
    const sentences = text.split(/(?<=[.!?])\s+/);
    return sentences.filter(s => s.trim().length > 0);
}

/**
 * Get word count of text
 * @param {string} text - Text to count
 * @returns {number} - Word count
 */
function getWordCount(text) {
    return text.trim().split(/\s+/).length;
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
    }
    
    return true;
}

/**
 * Check if line ends with initials
 * @param {string} line - Line to check
 * @returns {boolean} - True if line ends with initials
 */
function endsWithInitials(line) {
    if (!line) return false;
    const trimmed = line.trim();
    return /\b[A-Z]\.$/.test(trimmed);
}

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
        if (isSourceTextInContent(link.sourceText, content)) {
            foundLinks.push({
                text: link.sourceText,
                targetPageNumber: link.targetPageNumber,
                targetText: link.targetText,
                linkId: link.linkId,
                role: link.role
            });
        }
    }
    
    return removeDuplicateLinks(foundLinks);
}

/**
 * Check if source text is in content
 * @param {string} sourceText - Source text to find
 * @param {string} content - Content to search in
 * @returns {boolean} - True if source text is found
 */
function isSourceTextInContent(sourceText, content) {
    // Direct match
    if (content.includes(sourceText)) {
        return true;
    }
    
    // Flexible footnote matching
    if (/^\d+$/.test(sourceText)) {
        const patterns = [
            new RegExp(`\\b${sourceText}\\b`),
            new RegExp(`${sourceText}\\s*[.,;]`),
            new RegExp(`\\s${sourceText}\\s*$`)
        ];
    
        return patterns.some(pattern => pattern.test(content));
    }
    
    return false;
}

/**
 * Remove duplicate links
 * @param {Array} links - Links array
 * @returns {Array} - Deduplicated links
 */
function removeDuplicateLinks(links) {
    const seen = new Set();
    return links.filter(link => {
        const key = `${link.text}-${link.targetPageNumber}`;
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
        chapters: chapters.map(chapter => ({
            chapterNumber: chapter.chapterNumber,
            title: chapter.title,
            chunkCount: chapter.chunks.length,
            paragraphCount: chapter.chunks.filter(c => c.type === 'paragraph').length,
            headerCount: chapter.chunks.filter(c => c.type === 'header').length,
            chunks: chapter.chunks.map(chunk => ({
                type: chunk.type,
                content: chunk.content.substring(0, 200) + (chunk.content.length > 200 ? '...' : ''),
                pageNumber: chunk.pageNumber,
                wordCount: chunk.wordCount,
                sentenceCount: chunk.sentenceCount,
                linkCount: chunk.links ? chunk.links.length : 0
            }))
        }))
    };
    
    const debugPath = path.join(debugDir, 'step-04-paragraph-and-header-detection.json');
    await fs.promises.writeFile(debugPath, JSON.stringify(debugOutput, null, 2));
}

module.exports = { execute }; 