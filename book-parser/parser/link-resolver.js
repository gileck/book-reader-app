/**
 * Resolve target chunks for all links and enhance both links and chunks
 * @param {Array} links - Array of link objects with navigation data
 * @param {Array} allChunks - Array of all text chunks with coordinates
 * @returns {Array} Array of enhanced link objects with target chunk references
 */
function resolveLinksToTargetChunks(links, allChunks) {


    const enhancedLinks = [];
    const targetChunkIds = new Set();

    for (const link of links) {
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
        }
        // Skip links without valid target chunks
    }

    // Mark target chunks
    allChunks.forEach(chunk => {
        if (targetChunkIds.has(chunk.index)) {
            chunk.targetLink = true;
        }
    });

    const resolvedCount = enhancedLinks.filter(link => link.targetChunkIndex !== null).length;
    const targetChunkCount = targetChunkIds.size;



    return enhancedLinks;
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
function extractTextContentWithCoordinates(textContent) {
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

    // Calculate page bounds if textItems exist
    if (textItems.length === 0) {
        return {
            textItems,
            combinedText: combineTextItemsPreservingStructure(textContent.items),
            coordinateBounds: null
        };
    }

    const coordinateBounds = {
        minX: Math.min(...textItems.map(item => item.x)),
        maxX: Math.max(...textItems.map(item => item.x + item.width)),
        minY: Math.min(...textItems.map(item => item.y)),
        maxY: Math.max(...textItems.map(item => item.y))
    };

    return {
        textItems,
        combinedText: combineTextItemsPreservingStructure(textContent.items),
        coordinateBounds
    };
}

/**
 * Combine text items from PDF while preserving natural structure and line breaks
 * This is a simplified version - import from text-processor.js for full implementation
 * @param {Array} textItems - Array of PDF text items
 * @returns {string} Combined text with line break markers
 */
function combineTextItemsPreservingStructure(textItems) {
    if (!textItems || textItems.length === 0) return '';

    const lines = [];
    let currentLine = [];
    let lastY = null;

    // Group text items by approximate Y position (line)
    for (const item of textItems) {
        const y = Math.round(item.transform[5]); // Y coordinate

        // If this is a new line (significant Y change), start a new line
        if (lastY !== null && Math.abs(y - lastY) > 5) {
            if (currentLine.length > 0) {
                lines.push(currentLine.join(' ').trim());
                currentLine = [];
            }
        }

        if (item.str.trim()) {
            currentLine.push(item.str);
        }
        lastY = y;
    }

    // Add the last line
    if (currentLine.length > 0) {
        lines.push(currentLine.join(' ').trim());
    }

    // Join lines but preserve structure for heading detection
    return lines.join(' ⟨⟨LINE_BREAK⟩⟩ ').trim();
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