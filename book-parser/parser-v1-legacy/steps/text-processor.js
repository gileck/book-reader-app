const fs = require('fs');
const path = require('path');

/**
 * Simple text chunking function that splits text into chunks of specified word count
 * @param {string} text - Text to chunk
 * @param {number} minWords - Minimum words per chunk
 * @param {number} maxWords - Maximum words per chunk
 * @returns {Array} Array of text chunks
 */
function chunkText(text, minWords = 5, maxWords = 15) {
    if (!text || text.trim().length === 0) {
        return [];
    }

    const words = text.trim().split(/\s+/);
    const chunks = [];
    let currentChunk = [];

    for (let i = 0; i < words.length; i++) {
        currentChunk.push(words[i]);

        // Create chunk if we've reached maxWords or we're at the end
        if (currentChunk.length >= maxWords || i === words.length - 1) {
            // Only add chunk if it meets minimum word requirement or it's the last chunk
            if (currentChunk.length >= minWords || i === words.length - 1) {
                chunks.push(currentChunk.join(' '));
                currentChunk = [];
            }
        }
    }

    // Add any remaining words as the final chunk
    if (currentChunk.length > 0) {
        chunks.push(currentChunk.join(' '));
    }

    return chunks;
}

/**
 * Remove header patterns and page numbers from text
 * @param {string} text - Text to clean
 * @param {number} pageNumber - Current page number
 * @returns {string} Cleaned text
 */
function cleanPageNumbers(text, pageNumber = null) {
    if (!text) return '';

    // Remove page numbers at start/end of lines
    let cleaned = text.replace(/^\s*\d+\s*$/gm, '');

    // If we know the page number, remove it specifically
    if (pageNumber) {
        const pageRegex = new RegExp(`^\s*${pageNumber}\s*$`, 'gm');
        cleaned = cleaned.replace(pageRegex, '');
    }

    // Remove running headers (repeated text patterns)
    cleaned = cleaned.replace(/^(.{1,50})\n\\1$/gm, '$1');

    return cleaned.trim();
}

/**
 * Clean chapter heading text
 * @param {string} text - Text to clean
 * @param {string} chapterTitle - Expected chapter title
 * @param {number} chapterNumber - Chapter number
 * @returns {string} Cleaned text
 */
function cleanChapterHeading(text, chapterTitle, chapterNumber) {
    if (!text) return '';

    let cleaned = text.trim();

    // Remove chapter number patterns
    cleaned = cleaned.replace(/^(CHAPTER|Chapter|Ch\\.?)\s*\d+[:\\.\s]*/i, '');
    cleaned = cleaned.replace(/^\d+[:\\.\s]+/, '');

    // Remove extra whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    return cleaned;
}

/**
 * Fix text where first letter is separated by space (like "T he" -> "The")
 * @param {string} text - Text to fix
 * @returns {string} Fixed text
 */
function fixSpacedFirstLetter(text) {
    return text.replace(/\b([A-Z])\s+([a-z])/g, '$1$2');
}

/**
 * Normalize text by removing extra whitespace and fixing common OCR issues
 * @param {string} text - Text to normalize
 * @returns {string} Normalized text
 */
function normalizeText(text) {
    if (!text) return '';

    let normalized = text
        .replace(/\s+/g, ' ')  // Multiple spaces to single space
        .replace(/\n\s*\n/g, '\n')  // Multiple newlines to single
        .trim();

    // Fix common OCR spacing issues
    normalized = fixSpacedFirstLetter(normalized);

    return normalized;
}

/**
 * Fuzzy match between PDF text and configuration title
 * @param {string} pdfLine - Line from PDF
 * @param {string} configTitle - Title from configuration
 * @returns {boolean} Whether they match
 */
function fuzzyMatch(pdfLine, configTitle) {
    if (!pdfLine || !configTitle) return false;

    // Normalize both strings
    const normalize = (str) => str
        .toLowerCase()
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    const normalizedPdf = normalize(pdfLine);
    const normalizedConfig = normalize(configTitle);

    // Check for exact match
    if (normalizedPdf === normalizedConfig) return true;

    // Check if one contains the other
    if (normalizedPdf.includes(normalizedConfig) || normalizedConfig.includes(normalizedPdf)) {
        return true;
    }

    // Check word overlap
    const pdfWords = normalizedPdf.split(' ');
    const configWords = normalizedConfig.split(' ');

    let matchedWords = 0;
    for (const word of configWords) {
        if (pdfWords.includes(word)) {
            matchedWords++;
        }
    }

    // Consider it a match if more than 60% of words match
    return matchedWords / configWords.length > 0.6;
}

/**
 * Combine text items while preserving structure and handling debug output
 * @param {Array} textItems - Array of text items from PDF
 * @param {string} debugFolderPath - Path to debug folder (optional)
 * @param {string} rawPageText - Raw page text for debugging (optional)
 * @returns {string} Combined text
 */
function combineTextItemsPreservingStructure(textItems, debugFolderPath = null, rawPageText = null) {
    if (!textItems || textItems.length === 0) return '';

    const combined = textItems.map(item => {
        if (typeof item === 'string') return item;
        return item.str || item.text || '';
    }).join(' ');

    // Fix common PDF extraction issues
    let fixed = normalizeText(combined);

    // Fix spaced-out words (common PDF OCR issue)
    fixed = fixed.replace(/I\s+NTRODUCTION/g, 'INTRODUCTION');
    fixed = fixed.replace(/E\s+PILOGUE/g, 'EPILOGUE');
    fixed = fixed.replace(/C\s+ONCLUSION/g, 'CONCLUSION');
    fixed = fixed.replace(/A\s+PPENDIX/g, 'APPENDIX');
    fixed = fixed.replace(/B\s+IBLIOGRAPHY/g, 'BIBLIOGRAPHY');
    fixed = fixed.replace(/R\s+EFERENCES/g, 'REFERENCES');
    fixed = fixed.replace(/I\s+NDEX/g, 'INDEX');

    // Fix other common spacing issues in headers
    fixed = fixed.replace(/([A-Z])\s+([a-z]{2,})/g, '$1$2');

    return fixed;
}

/**
 * Process raw text into paragraphs
 * @param {string} rawText - Raw text to process
 * @param {string} debugFolderPath - Path to debug folder (optional)
 * @returns {Array} Array of paragraph objects
 */
function processRawTextIntoParagraphs(rawText, debugFolderPath = null) {
    if (!rawText) return [];

    const lines = rawText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    return processLinesIntoParagraphs(lines, debugFolderPath);
}

/**
 * Extract raw text from text items
 * @param {Array} textItems - Array of text items
 * @returns {string} Raw text
 */
function extractRawTextFromItems(textItems) {
    if (!textItems || textItems.length === 0) return '';

    return textItems.map(item => {
        if (typeof item === 'string') return item;
        return item.str || item.text || '';
    }).join('\n');
}

/**
 * Process lines into paragraph objects
 * @param {Array} lines - Array of text lines
 * @param {string} debugFolderPath - Path to debug folder (optional)
 * @returns {Array} Array of paragraph objects
 */
function processLinesIntoParagraphs(lines, debugFolderPath = null) {
    if (!lines || lines.length === 0) return [];

    const paragraphs = [];
    let currentParagraph = '';
    let currentType = 'text';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Check if this line looks like a header
        const isHeader = isLikelyHeading(line, lines[i + 1], lines[i - 1]);

        if (isHeader && currentParagraph) {
            // Finish current paragraph
            paragraphs.push({
                text: currentParagraph.trim(),
                type: currentType
            });
            currentParagraph = '';
        }

        if (isHeader) {
            // Add header as its own paragraph
            paragraphs.push({
                text: line,
                type: 'header'
            });
            currentType = 'text';
        } else {
            // Add to current paragraph
            if (currentParagraph) currentParagraph += ' ';
            currentParagraph += line;
            currentType = 'text';
        }
    }

    // Add final paragraph
    if (currentParagraph) {
        paragraphs.push({
            text: currentParagraph.trim(),
            type: currentType
        });
    }

    return paragraphs;
}

/**
 * Smart merge paragraphs that are too short
 * @param {Array} paragraphs - Array of paragraph objects
 * @param {number} minWords - Minimum words per paragraph
 * @returns {Array} Merged paragraphs
 */
function smartMergeParagraphs(paragraphs, minWords = 8) {
    if (!paragraphs || paragraphs.length <= 1) return paragraphs;

    const result = [];
    let currentParagraph = null;

    for (let i = 0; i < paragraphs.length; i++) {
        const paragraph = paragraphs[i];
        const wordCount = paragraph.text.split(/\s+/).length;

        if (paragraph.type === 'header') {
            // Headers are always kept separate
            if (currentParagraph) {
                result.push(currentParagraph);
                currentParagraph = null;
            }
            result.push(paragraph);
        } else if (wordCount < minWords && currentParagraph && currentParagraph.type === 'text') {
            // Merge with previous paragraph if both are text and current is too short
            currentParagraph.text += ' ' + paragraph.text;
        } else {
            // Start new paragraph
            if (currentParagraph) {
                result.push(currentParagraph);
            }
            currentParagraph = { ...paragraph };
        }
    }

    // Add final paragraph
    if (currentParagraph) {
        result.push(currentParagraph);
    }

    return result;
}

/**
 * Preserve headings in page text by marking them with special tokens
 * @param {string} pageText - Text from current page
 * @param {string} nextPageText - Text from next page (for context)
 * @param {Array} knownChapterTitles - Array of known chapter titles from TOC
 * @returns {string} Text with headings marked
 */
function preserveHeadingsInPageText(pageText, nextPageText = '', knownChapterTitles = []) {
    if (!pageText) return '';

    // Simply return the text as-is, header detection will happen during chunking
    return pageText;
}



/**
 * Check if text ends with an abbreviation
 * @param {string} text - Text to check
 * @returns {boolean} Whether text ends with abbreviation
 */
function endsWithAbbreviation(text) {
    if (!text) return false;

    const abbreviations = [
        'Dr', 'Mr', 'Mrs', 'Ms', 'Prof', 'Inc', 'Ltd', 'Corp', 'Co',
        'vs', 'etc', 'i.e', 'e.g', 'cf', 'St', 'Ave', 'Blvd'
    ];

    const lastWord = text.trim().split(/\s+/).pop();
    if (!lastWord) return false;

    const cleanWord = lastWord.replace(/[.,!?;:]$/, '');
    return abbreviations.includes(cleanWord);
}

/**
 * Check if two text chunks should be merged based on sentence boundaries
 * @param {string} firstText - First text chunk
 * @param {string} secondText - Second text chunk
 * @param {string} firstType - Type of first chunk
 * @param {string} secondType - Type of second chunk
 * @returns {boolean} Whether chunks should be merged
 */
function shouldMergeSentence(firstText, secondText, firstType = 'text', secondType = 'text') {
    if (!firstText || !secondText) return false;
    if (firstType !== secondType) return false; // Don't merge different types

    const firstTrimmed = firstText.trim();
    const secondTrimmed = secondText.trim();

    // Don't merge if first chunk ends with sentence-ending punctuation
    if (/[.!?]$/.test(firstTrimmed)) return false;

    // Don't merge if second chunk starts with capital letter (likely new sentence)
    if (/^[A-Z]/.test(secondTrimmed)) return false;

    // Check if first chunk ends with abbreviation
    if (endsWithAbbreviation(firstTrimmed)) return false;

    return hasBrokenSentenceBoundary(firstText, secondText);
}

/**
 * Create chunks from text with paragraph structure
 * @param {string} text - Text to chunk (may contain heading markers)
 * @param {number} minWords - Minimum words per chunk
 * @param {number} maxWords - Maximum words per chunk
 * @param {number} pageNumber - Page number for context
 * @returns {Array} Array of chunk objects
 */
function chunkTextWithParagraphs(text, minWords = 5, maxWords = 15, pageNumber = 1) {
    if (!text || text.trim().length === 0) {
        return [];
    }

    const paragraphs = [];
    const lines = text.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .filter(line => !/^\d+$/.test(line)); // Remove standalone page numbers

    // Process lines and look for header markers
    for (let i = 0; i < lines.length; i++) {
        const currentLine = lines[i];

        // Check if line contains header markers
        if (currentLine.includes('⟨⟨HEADER⟩⟩')) {
            // Extract header text from markers
            const headerMatch = currentLine.match(/⟨⟨HEADER⟩⟩([^⟨]+)⟨⟨\/HEADER⟩⟩/);
            if (headerMatch) {
                const headerText = headerMatch[1].trim();
                console.log(`FOUND MARKED HEADER: "${headerText}"`);
                paragraphs.push({
                    text: headerText,
                    type: 'header'
                });

                // Handle any remaining text on the same line
                const remainingText = currentLine.replace(/⟨⟨HEADER⟩⟩[^⟨]+⟨⟨\/HEADER⟩⟩/, '').trim();
                if (remainingText) {
                    paragraphs.push({
                        text: remainingText,
                        type: 'text'
                    });
                }
            } else {
                // Fallback if marker format is unexpected
                paragraphs.push({
                    text: currentLine,
                    type: 'text'
                });
            }
        } else {
            paragraphs.push({
                text: currentLine,
                type: 'text'
            });
        }
    }

    // Merge short text paragraphs
    const mergedParagraphs = smartMergeParagraphs(paragraphs, minWords);

    // Convert paragraphs to paragraph objects with chunks
    const paragraphsWithChunks = [];
    let globalChunkIndex = 0;

    for (let i = 0; i < mergedParagraphs.length; i++) {
        const paragraph = mergedParagraphs[i];

        if (paragraph.type === 'header') {
            // Headers become single-chunk paragraphs
            const headerChunk = {
                id: `chunk_${globalChunkIndex}`,
                index: globalChunkIndex,
                text: paragraph.text,
                wordCount: paragraph.text.split(/\s+/).length,
                type: 'header',
                level: determineHeaderLevel(paragraph.text, paragraph.text),
                pageNumber: pageNumber
            };

            paragraphsWithChunks.push({
                id: `paragraph_${i}`,
                type: 'header',
                pageNumber: pageNumber,
                chunks: [headerChunk]
            });

            globalChunkIndex++;
        } else {
            // Text paragraphs may be split into multiple chunks
            const textChunks = createChunksFromText(paragraph.text, minWords, maxWords, globalChunkIndex, 'text');

            // Update chunk IDs and page numbers
            textChunks.forEach(chunk => {
                chunk.id = `chunk_${chunk.index}`;
                chunk.pageNumber = pageNumber;
            });

            paragraphsWithChunks.push({
                id: `paragraph_${i}`,
                type: 'text',
                pageNumber: pageNumber,
                chunks: textChunks
            });

            globalChunkIndex += textChunks.length;
        }
    }

    return paragraphsWithChunks;
}

/**
 * Determine header level based on text content
 * @param {string} headerText - Header text
 * @param {string} originalLine - Original line from document
 * @returns {number} Header level (1-6)
 */
function determineHeaderLevel(headerText, originalLine) {
    if (!headerText) return 2;

    // Chapter titles are typically h1
    if (/^(CHAPTER|Chapter|Ch\\.?)\s*\d+/i.test(headerText)) {
        return 1;
    }

    // Numbered sections
    if (/^\d+\\./.test(headerText)) {
        return 2;
    }

    // Subsections (like 1.1, 2.3, etc.)
    if (/^\d+\\.\d+/.test(headerText)) {
        return 3;
    }

    return 2; // Most section headers are h2
}

/**
 * Create chunks from text while preserving sentence structure and respecting line breaks
 * @param {string} text - Text to chunk (may contain ⟨⟨LINE_BREAK⟩⟩ markers)
 * @param {number} minWords - Minimum words per chunk
 * @param {number} maxWords - Maximum words per chunk  
 * @param {number} startingGlobalIndex - Starting global chunk index
 * @param {string} chunkType - Type of chunks to create ('text' or 'header')
 * @returns {Array} Array of chunk objects
 */
function createChunksFromText(text, minWords, maxWords, startingGlobalIndex, chunkType = 'text') {
    if (!text || text.trim().length === 0) {
        return [];
    }

    // Split by LINE_BREAK markers to get natural paragraph segments
    const segments = text.split(' ⟨⟨LINE_BREAK⟩⟩ ').filter(seg => seg.trim().length > 0);

    const chunks = [];
    let chunkIndex = 0;
    let currentChunk = '';
    let currentWords = [];

    for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex++) {
        const segment = segments[segmentIndex].trim();

        // Split segment into sentences
        const sentences = [];
        let currentSentence = '';
        const words = segment.split(/\s+/);

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
            const isLastSegment = segmentIndex === segments.length - 1;
            const hasEnoughWords = currentWords.length >= minWords;

            // Create chunk if:
            // 1. We have enough words AND it's the end of a segment (natural paragraph break)
            // 2. OR we've reached maxWords
            // 3. OR it's the very last chunk
            if ((hasEnoughWords && isLastSentenceInSegment) ||
                currentWords.length >= maxWords ||
                (isLastSegment && sentenceIndex === sentences.length - 1)) {

                chunks.push({
                    index: startingGlobalIndex + chunkIndex,
                    text: currentChunk.trim(),
                    wordCount: currentWords.length,
                    type: chunkType
                });

                chunkIndex++;
                currentChunk = '';
                currentWords = [];
            }
        }
    }

    // Add any remaining text as final chunk
    if (currentChunk.trim()) {
        chunks.push({
            index: startingGlobalIndex + chunkIndex,
            text: currentChunk.trim(),
            wordCount: currentWords.length,
            type: chunkType
        });
    }

    return chunks;
}

/**
 * Smart merging logic for chunks: merge short chunks with neighboring chunks, but NEVER break sentences
 * @param {Array} chunks - Array of chunk objects
 * @param {number} minWords - Minimum words for a chunk to be considered complete (default: 8)
 * @returns {Array} Array of merged chunks
 */
function smartMergeChunks(chunks, minWords = 8) {
    if (chunks.length <= 1) return chunks;

    const result = [...chunks];

    // First pass: Fix obvious sentence splits
    for (let i = 0; i < result.length - 1; i++) {
        const currentChunk = result[i];
        const nextChunk = result[i + 1];

        if (hasBrokenSentenceBoundary(currentChunk.text, nextChunk.text)) {
            // Merge these chunks to fix the broken sentence
            currentChunk.text = currentChunk.text + ' ' + nextChunk.text;
            currentChunk.wordCount = currentChunk.wordCount + nextChunk.wordCount;
            result.splice(i + 1, 1);
            i--; // Recheck this position
        }
    }

    // Second pass: Merge short chunks if possible without breaking sentences
    let i = 0;
    while (i < result.length) {
        const currentChunk = result[i];
        const currentWords = currentChunk.wordCount;

        // If current chunk is too short, try to merge with neighbors
        if (currentWords < minWords) {
            const prevChunk = i > 0 ? result[i - 1] : null;
            const nextChunk = i < result.length - 1 ? result[i + 1] : null;

            const prevWords = prevChunk ? prevChunk.wordCount : Infinity;
            const nextWords = nextChunk ? nextChunk.wordCount : Infinity;

            // Try to merge with the shorter neighbor, but only if it won't break sentences
            if (prevChunk && prevWords <= nextWords && !hasBrokenSentenceBoundary(prevChunk.text, currentChunk.text)) {
                // Merge with previous
                prevChunk.text = prevChunk.text + ' ' + currentChunk.text;
                prevChunk.wordCount = prevWords + currentWords;
                result.splice(i, 1);
                i--; // Check the merged chunk again
            } else if (nextChunk && !hasBrokenSentenceBoundary(currentChunk.text, nextChunk.text)) {
                // Merge with next
                currentChunk.text = currentChunk.text + ' ' + nextChunk.text;
                currentChunk.wordCount = currentWords + nextWords;
                result.splice(i + 1, 1);
                // Don't increment i, check the merged chunk again
            } else {
                // Can't merge without breaking sentences, move on
                i++;
            }
        } else {
            i++;
        }
    }

    return result;
}

/**
 * Check if there's a broken sentence boundary between two chunks
 * @param {string} firstText - Text of the first chunk
 * @param {string} secondText - Text of the second chunk
 * @returns {boolean} True if there's a broken sentence boundary
 */
function hasBrokenSentenceBoundary(firstText, secondText) {
    if (!firstText || !secondText) return false;

    const firstTrimmed = firstText.trim();
    const secondTrimmed = secondText.trim();

    if (!firstTrimmed || !secondTrimmed) return false;

    // Get the last few words of first chunk and first few words of second chunk
    const firstWords = firstTrimmed.split(/\s+/);
    const secondWords = secondTrimmed.split(/\s+/);

    const lastWord = firstWords[firstWords.length - 1];
    const firstWordOfSecond = secondWords[0];

    // Remove punctuation from last word for analysis
    const lastWordClean = lastWord.replace(/[.,!?;:()\\[\\]{}'"]/g, '');

    // PATTERN 1: Subject + verb continuation (like "We" + "can") 
    const subjects = /^(I|We|You|He|She|It|They|This|That|These|Those|There|Here)$/i;
    const commonVerbs = /^(can|could|will|would|should|shall|may|might|must|do|does|did|have|has|had|are|is|was|were|am|be|been|being|go|went|see|saw|get|got|make|made|take|took|give|gave|know|knew|think|thought|feel|felt|look|looked|seem|seemed|become|became|find|found|want|wanted|need|needed|try|tried|work|worked|live|lived|use|used|say|said|tell|told)$/i;

    if (subjects.test(lastWordClean) && commonVerbs.test(firstWordOfSecond)) {
        return true;
    }

    // PATTERN 2: Article + noun (like "the" + "book")
    const articles = /^(a|an|the)$/i;
    const nounStarters = /^[A-Za-z]/; // Any word can potentially be a noun

    if (articles.test(lastWordClean) && nounStarters.test(firstWordOfSecond)) {
        return true;
    }

    // PATTERN 3: Preposition + object (like "in" + "the")
    const prepositions = /^(in|on|at|by|for|with|without|to|from|of|about|over|under|through|during|before|after|since|until|between|among|against|within|throughout|beneath|above|below|across|around|behind|beside|beyond|inside|outside|toward|towards)$/i;

    if (prepositions.test(lastWordClean)) {
        return true;
    }

    // PATTERN 4: Incomplete phrases that don't end with punctuation
    if (!/[.!?]$/.test(firstTrimmed) && /^[a-z]/.test(firstWordOfSecond)) {
        // First chunk doesn't end with punctuation and second starts with lowercase
        return true;
    }

    return false;
}

/**
 * Mark headers in page text before cross-page merging
 * @param {string} pageText - Text from a single page
 * @returns {string} Text with headers marked
 */
function markHeadersInText(pageText) {
    if (!pageText) return pageText;

    const lines = pageText.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .filter(line => !/^\d+$/.test(line)); // Remove standalone page numbers



    const processedLines = [];

    for (let i = 0; i < lines.length; i++) {
        const currentLine = lines[i];
        const previousLine = i > 0 ? lines[i - 1] : null;
        const nextLine = i < lines.length - 1 ? lines[i + 1] : null;

        if (isHeader(currentLine, previousLine, nextLine, lines, i)) {
            // Mark header with special markers
            console.log(`MARKING HEADER: "${currentLine}"`);
            processedLines.push(`⟨⟨HEADER⟩⟩${currentLine}⟨⟨/HEADER⟩⟩`);
        } else {
            processedLines.push(currentLine);
        }
    }

    return processedLines.join('\n');
}

/**
 * Check if text is a header based on the 6 rules from headers-task.md
 * @param {string} currentLine - Current line to check
 * @param {string} previousLine - Previous line for context
 * @param {string} nextLine - Next line for context
 * @returns {boolean} Whether text is a header
 */
function isHeader(currentLine, previousLine, nextLine, allLines, currentIndex) {
    if (!currentLine) return false;

    const trimmed = currentLine.trim();
    const words = trimmed.split(/\s+/);

    // Rule 1: 2-5 words
    if (words.length < 2 || words.length > 5) return false;

    // Rule 2: No sentence ending
    if (/[.!?]$/.test(trimmed)) return false;

    // Rule 3: Starts with capital
    if (!/^[A-Z]/.test(trimmed)) return false;

    // Rule 5: Previous line ends with punctuation
    if (!previousLine || !/[.!?]$/.test(previousLine.trim())) return false;

    // Rule 6: Next line starts with capital (skip page numbers)
    let effectiveNextLine = nextLine;
    if (allLines && currentIndex !== undefined) {
        // Look ahead to find the first non-page-number line
        for (let i = currentIndex + 1; i < allLines.length; i++) {
            const candidateLine = allLines[i].trim();
            // Skip empty lines and page numbers (standalone numbers)
            if (candidateLine && !/^\d+$/.test(candidateLine)) {
                effectiveNextLine = candidateLine;
                break;
            }
        }
    }

    if (!effectiveNextLine || !/^[A-Z]/.test(effectiveNextLine.trim())) return false;

    return true;
}

module.exports = {
    chunkText,
    cleanPageNumbers,
    cleanChapterHeading,
    normalizeText,
    fuzzyMatch,
    combineTextItemsPreservingStructure,
    processRawTextIntoParagraphs,
    extractRawTextFromItems,
    processLinesIntoParagraphs,
    smartMergeParagraphs,
    preserveHeadingsInPageText,
    endsWithAbbreviation,
    shouldMergeSentence,
    chunkTextWithParagraphs,
    determineHeaderLevel,
    createChunksFromText,
    smartMergeChunks,
    hasBrokenSentenceBoundary,
    isHeader,
    markHeadersInText
};
