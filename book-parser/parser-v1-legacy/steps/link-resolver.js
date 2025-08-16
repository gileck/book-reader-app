/**
 * Resolve target chunks for all links and enhance both links and chunks
 * @param {Array} links - Array of link objects with navigation data
 * @param {Array} allChunks - Array of all text chunks with coordinates
 * @returns {Array} Array of enhanced link objects with target chunk references
 */
function resolveLinksToTargetChunks(links, allChunks) {
    const enhancedLinks = [];
    const targetChunkIds = new Set();
    const seenLinks = new Map(); // For deduplication

    for (const link of links) {
        // Create a key for deduplication based on text and destination
        const linkKey = `${link.linkText || link.text}_${link.destinationPage}_${link.destinationCoordinates?.x}_${link.destinationCoordinates?.y}`;

        // Skip if we've already processed this exact link
        if (seenLinks.has(linkKey)) {
            continue;
        }

        const destinationInfo = findDestinationChunk(link, allChunks);

        if (destinationInfo) {
            // Create simplified link with only targetChunk, text, and chapterNumber
            const enhancedLink = {
                text: link.linkText || link.text,
                targetChunk: destinationInfo.chunk.index,
                chapterNumber: destinationInfo.chunk.chapterNumber
            };

            enhancedLinks.push(enhancedLink);
            targetChunkIds.add(destinationInfo.chunk.index);
            seenLinks.set(linkKey, enhancedLink);
        }
        // Skip links without valid target chunks
    }

    // Mark target chunks
    allChunks.forEach(chunk => {
        if (targetChunkIds.has(chunk.index)) {
            chunk.targetLink = true;
        }
    });

    // Distribute links to source chunks based on page location
    distributeLinksToSourceChunks(links, allChunks, enhancedLinks);

    const resolvedCount = enhancedLinks.filter(link => link.targetChunk !== null).length;
    const targetChunkCount = targetChunkIds.size;

    return enhancedLinks;
}

/**
 * Distribute resolved links to their source chunks
 * @param {Array} originalLinks - Original extracted links
 * @param {Array} allChunks - All chunks
 * @param {Array} resolvedLinks - Resolved links to distribute
 */
function distributeLinksToSourceChunks(originalLinks, allChunks, resolvedLinks) {
    // Create a map of resolved links by their text and target
    const resolvedLinkMap = new Map();
    resolvedLinks.forEach(link => {
        const key = `${link.text}_${link.targetChunk}`;
        resolvedLinkMap.set(key, link);
    });

    // For each original link, find the best matching chunk on its source page
    originalLinks.forEach(originalLink => {
        const sourcePageChunks = allChunks.filter(chunk => chunk.pageNumber === originalLink.pageNumber);

        if (sourcePageChunks.length === 0) return;

        // Find the most relevant chunk for this link
        const relevantChunk = findMostRelevantChunk(originalLink, sourcePageChunks);

        if (relevantChunk) {
            // Find the corresponding resolved link
            const linkKey = `${originalLink.linkText || originalLink.text}_`;
            const matchingResolvedLink = resolvedLinks.find(resolved =>
                resolved.text === (originalLink.linkText || originalLink.text)
            );

            if (matchingResolvedLink && !relevantChunk.links.some(existingLink =>
                existingLink.text === matchingResolvedLink.text &&
                existingLink.targetChunk === matchingResolvedLink.targetChunk
            )) {
                relevantChunk.links.push({
                    text: matchingResolvedLink.text,
                    targetChunk: matchingResolvedLink.targetChunk,
                    chapterNumber: matchingResolvedLink.chapterNumber
                });
            }
        }
    });
}

/**
 * Find the most relevant chunk for a link on a page
 * @param {Object} link - Link object
 * @param {Array} chunks - Chunks on the same page
 * @returns {Object|null} Most relevant chunk
 */
function findMostRelevantChunk(link, chunks) {
    const linkText = link.linkText || link.text;

    // For footnote links, prioritize chunks that contain the footnote reference in the text
    if (isFootnoteLink(linkText)) {
        // Look for chunks that contain the footnote reference followed by a space or end of text
        // This handles cases like "building blocks. 1 If there is a view..."
        const footnoteInTextMatches = chunks.filter(chunk => {
            if (!chunk.text) return false;

            // Create regex pattern to match footnote at word boundary
            // Matches: "blocks. 1 If", "sentence. 1", "word 1 ", etc.
            const patterns = [
                new RegExp(`\\. ${linkText}\\s`, 'g'),  // "blocks. 1 If"
                new RegExp(`\\s${linkText}\\s`, 'g'),   // " 1 "
                new RegExp(`\\s${linkText}$`, 'g')      // " 1" at end
            ];

            return patterns.some(pattern => pattern.test(chunk.text));
        });

        if (footnoteInTextMatches.length > 0) {
            return footnoteInTextMatches[0];
        }
    }

    // If we have coordinates, find the closest chunk
    if (link.destinationCoordinates || (link.rect && link.rect.length >= 4)) {
        const coords = link.destinationCoordinates || {
            x: (link.rect[0] + link.rect[2]) / 2,
            y: (link.rect[1] + link.rect[3]) / 2
        };

        const coordMatches = findChunksByCoordinates(chunks, coords.x, coords.y, 100);
        if (coordMatches.length > 0) {
            return coordMatches[0];
        }
    }

    // If link text appears in a chunk, prefer that chunk
    const textMatches = chunks.filter(chunk =>
        chunk.text && chunk.text.includes(linkText)
    );
    if (textMatches.length > 0) {
        return textMatches[0];
    }

    // Fallback to first chunk on page
    return chunks[0];
}

/**
 * Find the destination chunk for a link using coordinates and fallback methods
 * @param {Object} link - Link object with navigation data
 * @param {Array} chunks - Array of chunks to search in
 * @returns {Object|null} Object with chunk and resolution method or null if not found
 */
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
            // Special case: For footnote links, check if coordinate match is actually a footnote
            if (isFootnoteLink(link.linkText || link.text)) {
                const coordMatch = coordMatches[0];
                // If coordinate match doesn't look like a footnote definition, try footnote pattern matching
                if (!isFootnoteDefinition(coordMatch.text, link.linkText || link.text)) {
                    const footnoteMatch = findFootnoteDefinition(destinationChunks, link.linkText || link.text);
                    if (footnoteMatch) {
                        return {
                            chunk: footnoteMatch,
                            method: 'footnote_pattern',
                            confidence: 'high'
                        };
                    }
                }
            }

            return {
                chunk: coordMatches[0],
                method: 'coordinates',
                confidence: 'high'
            };
        }
    }

    // Method 2: Footnote pattern matching for footnote links
    if (isFootnoteLink(link.linkText || link.text)) {
        const footnoteMatch = findFootnoteDefinition(destinationChunks, link.linkText || link.text);
        if (footnoteMatch) {
            return {
                chunk: footnoteMatch,
                method: 'footnote_pattern',
                confidence: 'high'
            };
        }
    }

    // Method 3: Use search pattern
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

    // Method 4: Simple text search
    for (const chunk of destinationChunks) {
        if (chunk.text.includes(link.text)) {
            return {
                chunk,
                method: 'text_search',
                confidence: 'low'
            };
        }
    }

    // Method 5: Return first chunk on page as fallback
    return {
        chunk: destinationChunks[0],
        method: 'page_fallback',
        confidence: 'very_low'
    };
}

/**
 * Check if a link text represents a footnote reference
 * @param {string} linkText - The link text to check
 * @returns {boolean} True if this looks like a footnote link
 */
function isFootnoteLink(linkText) {
    if (!linkText) return false;
    const cleanText = linkText.trim();
    // Match numbers, letters, or symbols commonly used for footnotes
    return /^[0-9a-zA-Z\*\†\‡\§\¶]{1,3}$/.test(cleanText);
}

/**
 * Check if a chunk text contains a footnote definition for the given reference
 * @param {string} chunkText - The chunk text to check
 * @param {string} footnoteRef - The footnote reference (e.g., "1", "2", etc.)
 * @returns {boolean} True if this chunk contains the footnote definition
 */
function isFootnoteDefinition(chunkText, footnoteRef) {
    if (!chunkText || !footnoteRef) return false;

    const cleanRef = footnoteRef.trim();
    // Look for footnote definition pattern: starts with the reference followed by space or punctuation
    const footnotePattern = new RegExp(`^\\s*${escapeRegExp(cleanRef)}[\\s\\.]`, 'i');
    return footnotePattern.test(chunkText);
}

/**
 * Find a footnote definition chunk for a given footnote reference
 * @param {Array} chunks - Array of chunks to search
 * @param {string} footnoteRef - The footnote reference to find
 * @returns {Object|null} Chunk containing the footnote definition or null
 */
function findFootnoteDefinition(chunks, footnoteRef) {
    if (!footnoteRef) return null;

    const cleanRef = footnoteRef.trim();

    // Look for exact footnote definition pattern
    for (const chunk of chunks) {
        if (isFootnoteDefinition(chunk.text, cleanRef)) {
            return chunk;
        }
    }

    return null;
}

/**
 * Escape special regex characters
 * @param {string} string - String to escape
 * @returns {string} Escaped string
 */
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Find text chunks that contain or are near the given coordinates
 * @param {Array} chunks - Array of chunks to search
 * @param {number} targetX - Target X coordinate
 * @param {number} targetY - Target Y coordinate
 * @param {number} tolerance - Coordinate tolerance (default: 50)
 * @returns {Array} Array of matching chunks sorted by distance
 */
function findChunksByCoordinates(chunks, targetX, targetY, tolerance = 50) {
    const matchingChunks = [];

    for (const chunk of chunks) {
        if (!chunk.coordinateBounds) continue;

        const { minX, maxX, minY, maxY } = chunk.coordinateBounds;

        // Check if coordinates are within chunk bounds (with tolerance)
        const withinX = targetX >= (minX - tolerance) && targetX <= (maxX + tolerance);
        const withinY = targetY >= (minY - tolerance) && targetY <= (maxY + tolerance);

        if (withinX && withinY) {
            // Calculate distance from center for ranking
            const distance = Math.sqrt(
                Math.pow(targetX - chunk.coordinateBounds.centerX, 2) +
                Math.pow(targetY - chunk.coordinateBounds.centerY, 2)
            );

            matchingChunks.push({
                chunk,
                distance
            });
        }
    }

    // Sort by distance (closest first)
    return matchingChunks
        .sort((a, b) => a.distance - b.distance)
        .map(item => item.chunk);
}

/**
 * Estimate coordinate bounds for a text chunk within a page
 * @param {Object} chunk - Text chunk object
 * @param {number} chunkIndex - Index of chunk within page
 * @param {number} totalChunks - Total chunks on page
 * @param {Object} pageCoordinateBounds - Page coordinate bounds
 * @returns {Object|null} Estimated coordinate bounds or null
 */
function estimateChunkCoordinates(chunk, chunkIndex, totalChunks, pageCoordinateBounds) {
    if (!pageCoordinateBounds) return null;

    const { minX, maxX, minY, maxY } = pageCoordinateBounds;

    // Estimate vertical position based on chunk position in page
    const heightPerChunk = (maxY - minY) / totalChunks;
    const estimatedMinY = minY + (chunkIndex * heightPerChunk);
    const estimatedMaxY = estimatedMinY + heightPerChunk;

    return {
        minX,
        maxX,
        minY: estimatedMinY,
        maxY: estimatedMaxY,
        centerX: (minX + maxX) / 2,
        centerY: (estimatedMinY + estimatedMaxY) / 2
    };
}

/**
 * Extract text content with coordinate information for each text item
 * @param {Object} textContent - PDF text content object
 * @returns {Object} Object with textItems, combinedText, and coordinateBounds
 */
function extractTextContentWithCoordinates(textContent, debugFolderPath = null) {
    const textItems = [];
    let allText = '';

    for (const item of textContent.items) {
        const x = item.transform[4];
        const y = item.transform[5];
        const text = item.str;

        textItems.push({
            text: text,
            x: x,
            y: y,
            width: item.width || 0,
            height: item.height || 0
        });

        allText += text;
    }

    // Save positioning data for target text
    const targetTexts = ['alive?', 'cities. We', 'spreading.', 'Yet at night', 'The structure.', 'A cell is a city'];
    const hasTargetText = targetTexts.some(target => allText.includes(target));

    if (hasTargetText) {
        try {
            const fs = require('fs');
            const path = require('path');
            const debugDir = './debug';
            if (!fs.existsSync(debugDir)) {
                fs.mkdirSync(debugDir);
            }

            const positioningData = textContent.items.map((item, index) => ({
                index: index,
                text: item.str,
                x: item.transform[4],
                y: item.transform[5],
                width: item.width || 0,
                height: item.height || 0,
                transform: item.transform,
                isTargetText: targetTexts.some(target => item.str && item.str.includes(target))
            }));

            fs.writeFileSync(
                path.join(debugDir, 'positioning-data.json'),
                JSON.stringify(positioningData, null, 2)
            );

            // Also save a summary focusing on target text
            const targetItems = positioningData.filter(item => item.isTargetText);
            const contextItems = [];

            // Add context around target items
            targetItems.forEach(targetItem => {
                const startIndex = Math.max(0, targetItem.index - 3);
                const endIndex = Math.min(positioningData.length - 1, targetItem.index + 3);

                for (let i = startIndex; i <= endIndex; i++) {
                    if (!contextItems.find(item => item.index === i)) {
                        contextItems.push(positioningData[i]);
                    }
                }
            });

            fs.writeFileSync(
                path.join(debugDir, 'target-text-positioning.json'),
                JSON.stringify(contextItems.sort((a, b) => a.index - b.index), null, 2)
            );

        } catch (error) {
            // Ignore write errors
        }
    }

    // Calculate page bounds if textItems exist
    if (textItems.length === 0) {
        return {
            textItems,
            combinedText: combineTextItemsPreservingStructure(textContent.items, debugFolderPath),
            coordinateBounds: null
        };
    }

    const combinedText = combineTextItemsPreservingStructure(textContent.items, debugFolderPath);

    // Debug specific problematic text
    if (combinedText.includes('The structure') || combinedText.includes('A cell is a city')) {
        try {
            const fs = require('fs');
            const path = require('path');
            const debugDir = './debug';
            if (!fs.existsSync(debugDir)) {
                fs.mkdirSync(debugDir);
            }

            const debugInfo = [
                'FOUND PROBLEMATIC TEXT IN extractTextContentWithCoordinates:',
                `Combined text: ${combinedText.substring(0, 500)}...`,
                `Contains line breaks: ${combinedText.includes('⟨⟨LINE_BREAK⟩⟩')}`,
                `Number of line breaks: ${(combinedText.match(/⟨⟨LINE_BREAK⟩⟩/g) || []).length}`,
                ''
            ];

            fs.appendFileSync(path.join(debugDir, 'text-processing-debug.txt'), debugInfo.join('\n') + '\n');
        } catch (error) {
            // Ignore write errors
        }
    }

    const coordinateBounds = {
        minX: Math.min(...textItems.map(item => item.x)),
        maxX: Math.max(...textItems.map(item => item.x + item.width)),
        minY: Math.min(...textItems.map(item => item.y)),
        maxY: Math.max(...textItems.map(item => item.y))
    };

    return {
        textItems,
        combinedText,
        coordinateBounds
    };
}

/**
 * Combine text items from PDF while preserving natural structure and line breaks
 * This is a simplified version - import from text-processor.js for full implementation
 * @param {Array} textItems - Array of PDF text items
 * @returns {string} Combined text with line break markers
 */
function combineTextItemsPreservingStructure(textItems, debugFolderPath = null) {
    // Extract raw text preserving reading order without coordinate-based line grouping
    if (!textItems || textItems.length === 0) return '';

    const rawText = extractRawTextFromItems(textItems);
    return processRawTextIntoParagraphs(rawText, debugFolderPath);
}

/**
 * Extract raw text from text items in reading order without coordinate-based line grouping
 * @param {Array} textItems - PDF text items
 * @returns {string} Raw text preserving natural reading flow
 */
function extractRawTextFromItems(textItems) {
    if (!textItems || textItems.length === 0) return '';

    // Sort items by Y coordinate (top to bottom) then X coordinate (left to right)
    const sortedItems = [...textItems].sort((a, b) => {
        const yDiff = Math.round(b.transform[5]) - Math.round(a.transform[5]); // Fixed: b - a for top to bottom
        if (Math.abs(yDiff) > 10) { // Different lines
            return yDiff;
        }
        // Same line, sort by X coordinate
        return a.transform[4] - b.transform[4];
    });

    // Join text items with spaces, preserving original text flow
    const textParts = [];
    let lastY = null;

    for (const item of sortedItems) {
        const currentY = Math.round(item.transform[5]);

        // Add newline if we're on a significantly different Y coordinate (new line)
        if (lastY !== null && Math.abs(currentY - lastY) > 10) {
            textParts.push('\n');
        }

        if (item.str.trim()) {
            textParts.push(item.str.trim());
        }

        lastY = currentY;
    }

    // Join text parts but preserve newlines for header detection
    const result = textParts.join(' ');
    // Replace multiple spaces with single spaces, but preserve newlines
    const processed = result.replace(/[ \t]+/g, ' ').replace(/\n +/g, '\n').replace(/ +\n/g, '\n').trim();



    return processed;
}

/**
 * Process raw PDF text into paragraphs using natural line breaks
 * @param {string} rawText - Raw PDF text with natural line breaks
 * @param {string} debugFolderPath - Path for debug output
 * @returns {string} Text with paragraph markers
 */
function processRawTextIntoParagraphs(rawText, debugFolderPath = null) {
    // Split raw text by actual newlines (preserves natural paragraph structure)
    const lines = rawText.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    return processLinesIntoParagraphs(lines, debugFolderPath);
}

/**
 * Process lines into paragraphs with proper detection logic
 * @param {Array} lines - Array of text lines
 * @param {string} debugFolderPath - Path for debug output
 * @returns {string} Text with paragraph markers
 */
function processLinesIntoParagraphs(lines, debugFolderPath = null) {

    // Smart paragraph detection: split on actual paragraph breaks, not sentence endings
    const paragraphs = [];
    let currentParagraph = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (line.length === 0) {
            // Empty line indicates paragraph break
            if (currentParagraph.trim().length > 0) {
                paragraphs.push(currentParagraph.trim());
                currentParagraph = '';
            }
            continue;
        }

        // Add line to current paragraph
        if (currentParagraph.length > 0) {
            currentParagraph += ' ';
        }
        currentParagraph += line;

        // Simple and correct paragraph detection:
        // If line ends with sentence-ending punctuation + newline = paragraph break

        // Check if this line ends with sentence-ending punctuation or footnote
        const endsWithSentenceEnd = /[.!?]$/.test(line) || /\d+$/.test(line.trim());

        // If it ends with sentence punctuation, finish the paragraph
        if (endsWithSentenceEnd) {
            paragraphs.push(currentParagraph.trim());
            currentParagraph = '';
        }
    }

    // Add any remaining text as final paragraph
    if (currentParagraph.trim().length > 0) {
        paragraphs.push(currentParagraph.trim());
    }

    // Debug: Save original paragraphs before merging
    if (paragraphs.some(p => p.includes('inorganic') || p.includes('Yet at night') || p.includes('cell is a city'))) {
        try {
            const fs = require('fs');
            const debugDir = './debug';
            if (!fs.existsSync(debugDir)) {
                fs.mkdirSync(debugDir);
            }

            const debugInfo = [
                'ORIGINAL PARAGRAPHS BEFORE MERGING (from link-resolver):',
                `Total paragraphs: ${paragraphs.length}`,
                '',
                ...paragraphs.map((para, i) => {
                    const wordCount = para.trim().split(/\s+/).length;
                    return `Paragraph ${i} (${wordCount} words): "${para.substring(0, 200)}${para.length > 200 ? '...' : ''}"`;
                }),
                ''
            ];

            fs.appendFileSync('./debug/original-paragraphs-before-merge.txt', debugInfo.join('\n') + '\n');
        } catch (error) {
            // Ignore write errors
        }
    }

    // Smart merging: merge short paragraphs with shorter neighboring paragraphs
    const mergedParagraphs = smartMergeParagraphs(paragraphs, 80);

    // Join paragraphs with line break markers
    return mergedParagraphs.join(' ⟨⟨LINE_BREAK⟩⟩ ').trim();
}

/**
 * Smart merging logic: merge short paragraphs with shorter neighboring paragraphs
 * @param {Array} paragraphs - Array of paragraph strings
 * @param {number} minWords - Minimum words for a paragraph to be considered complete (default: 8)
 * @returns {Array} Array of merged paragraphs
 */
function smartMergeParagraphs(paragraphs, minWords = 8) {
    if (paragraphs.length <= 1) return paragraphs;

    const result = [...paragraphs];
    let i = 0;

    while (i < result.length) {
        const currentWords = result[i].trim().split(/\s+/).length;

        // If current paragraph is too short, merge with shorter neighbor
        if (currentWords < minWords) {
            const prevWords = i > 0 ? result[i - 1].trim().split(/\s+/).length : Infinity;
            const nextWords = i < result.length - 1 ? result[i + 1].trim().split(/\s+/).length : Infinity;

            // Check if merging would create a paragraph that's too long
            const mergeWithPrev = prevWords <= nextWords && i > 0;
            const mergeWithNext = !mergeWithPrev && i < result.length - 1;

            if (mergeWithPrev) {
                const mergedWords = prevWords + currentWords;
                if (mergedWords <= 300) { // Hard limit for merged paragraphs
                    result[i - 1] = result[i - 1] + ' ' + result[i];
                    result.splice(i, 1);
                    i--; // Check the merged paragraph again
                } else {
                    i++; // Skip if would create too long paragraph
                }
            } else if (mergeWithNext) {
                const mergedWords = currentWords + nextWords;
                if (mergedWords <= 300) { // Hard limit for merged paragraphs
                    result[i] = result[i] + ' ' + result[i + 1];
                    result.splice(i + 1, 1);
                    // Don't increment i, check the merged paragraph again
                } else {
                    i++; // Skip if would create too long paragraph
                }
            } else {
                // Can't merge, move on
                i++;
            }
        } else {
            i++;
        }
    }

    return result;
}

/**
 * Validate link destinations against chapter page ranges
 * 
 * @param {Array} links - Array of link objects to validate
 * @param {Array} chapters - Array of chapter objects with page numbers
 * @returns {Array} Array of validated links (simplified - only valid links with targetChunk)
 * 
 * @example
 * const validLinks = validateLinkDestinations(links, chapters);
 * // Returns: Array of links with only text and targetChunk fields
 */
function validateLinkDestinations(links, chapters) {
    // Links are already filtered to only include those with valid targets
    // Just return them as-is since they only contain text and targetChunk
    return links;
}

module.exports = {
    resolveLinksToTargetChunks,
    findDestinationChunk,
    findChunksByCoordinates,
    estimateChunkCoordinates,
    extractTextContentWithCoordinates,
    combineTextItemsPreservingStructure,
    validateLinkDestinations
}; 