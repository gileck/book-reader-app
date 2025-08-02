/**
 * Step 5.1: Link Chunk References
 * 
 * Add targetChunkIndex and sourceChunkIndex to links based on their roles:
 * - For "source" role links: add targetChunkIndex (array index of chunk containing the target text)
 * - For "target" role links: add sourceChunkIndex (array index of chunk containing the source text)
 * 
 * Requirements:
 * - Process chapters from step 5 with sentence chunks
 * - Find chunks that contain link target/source text
 * - Add appropriate chunk array indexes to links
 * - Preserve all existing link data and chunk structure
 */

const fs = require('fs');
const path = require('path');

// Import validation functions
const {
    isSourceTextInContent
} = require('../05-sentence-detection/05-sentence-detection-validation');

/**
 * Execute step 5.1: Add chunk references to links
 * @param {Object} pipelineState - State from previous steps
 * @returns {Object} - Updated pipeline state with enhanced links
 */
function execute(pipelineState) {
    console.log('🔗 Adding chunk references to links...');

    if (!pipelineState.chapters || !Array.isArray(pipelineState.chapters)) {
        throw new Error('Step 5.1 requires chapters array from previous steps');
    }

    // Create a mapping of all chunks for quick lookup
    const chunkMap = createChunkMap(pipelineState.chapters);

    const processedChapters = [];
    let totalLinksProcessed = 0;
    let totalTargetChunkIndexes = 0;
    let totalSourceChunkIndexes = 0;
    let unresolved = 0;

    for (const chapter of pipelineState.chapters) {
        const processedChunks = [];

        for (let chunkIndex = 0; chunkIndex < chapter.chunks.length; chunkIndex++) {
            const chunk = chapter.chunks[chunkIndex];
            if (chunk.links && chunk.links.length > 0) {
                const enhancedLinks = chunk.links.map(link => {
                    totalLinksProcessed++;
                    return enhanceLinkWithChunkReferences(link, chunkMap, chunkIndex, chapter.chapterNumber);
                });

                // Count enhanced links
                enhancedLinks.forEach(link => {
                    if (link.targetChunkIndex !== undefined) totalTargetChunkIndexes++;
                    if (link.sourceChunkIndex !== undefined) totalSourceChunkIndexes++;
                    if (link.targetChunkIndex === undefined && link.sourceChunkIndex === undefined) unresolved++;
                });

                processedChunks.push({
                    ...chunk,
                    links: enhancedLinks
                });
            } else {
                processedChunks.push(chunk);
            }
        }

        processedChapters.push({
            ...chapter,
            chunks: processedChunks
        });
    }

    console.log(`✅ Link chunk references completed:`);
    console.log(`   🔗 Total links processed: ${totalLinksProcessed}`);
    console.log(`   🎯 Target chunk indexes added: ${totalTargetChunkIndexes}`);
    console.log(`   📍 Source chunk indexes added: ${totalSourceChunkIndexes}`);
    console.log(`   ❓ Unresolved references: ${unresolved}`);

    return {
        ...pipelineState,
        chapters: processedChapters,
        'step-5-1': {
            totalLinksProcessed,
            totalTargetChunkIndexes,
            totalSourceChunkIndexes,
            unresolved
        }
    };
}

/**
 * Create a mapping of all chunks for quick lookup by page and content
 * @param {Array} chapters - All chapters with chunks
 * @returns {Object} - Chunk mapping for lookup
 */
function createChunkMap(chapters) {
    const chunkMap = {
        byPage: new Map(), // pageNumber -> {chapterNumber, chunkIndex, chunk}[]
        byContent: new Map(), // content hash -> {chapterNumber, chunkIndex}
        allChunks: [] // Flat array of all chunks with their indexes
    };

    for (let chapterIndex = 0; chapterIndex < chapters.length; chapterIndex++) {
        const chapter = chapters[chapterIndex];
        for (let chunkIndex = 0; chunkIndex < chapter.chunks.length; chunkIndex++) {
            const chunk = chapter.chunks[chunkIndex];

            // Store by page number
            if (!chunkMap.byPage.has(chunk.pageNumber)) {
                chunkMap.byPage.set(chunk.pageNumber, []);
            }
            chunkMap.byPage.get(chunk.pageNumber).push({
                chapterNumber: chapter.chapterNumber,
                chunkIndex,
                chunk
            });

            // Store in flat array for easy access
            chunkMap.allChunks.push({
                chapterNumber: chapter.chapterNumber,
                chunkIndex,
                chunk
            });

            // Store by content for text matching
            if (chunk.content && chunk.type === 'text') {
                const contentKey = chunk.content.toLowerCase().trim();
                chunkMap.byContent.set(contentKey, {
                    chapterNumber: chapter.chapterNumber,
                    chunkIndex
                });
            }
        }
    }

    return chunkMap;
}

/**
 * Enhance a link with chunk references based on its role
 * @param {Object} link - Link object to enhance
 * @param {Object} chunkMap - Chunk mapping for lookup
 * @param {number} currentChunkIndex - Array index of the chunk containing this link
 * @param {number} currentChapterNumber - Chapter number containing this link
 * @returns {Object} - Enhanced link with chunk references
 */
function enhanceLinkWithChunkReferences(link, chunkMap, currentChunkIndex, currentChapterNumber) {
    const enhancedLink = { ...link };

    if (link.role === 'source') {
        // For source links, find the target chunk (where this link points to)
        const targetLocation = findTargetChunk(link, chunkMap);
        if (targetLocation) {
            // For same-chapter links, use just the chunk index
            // For cross-chapter links, could include chapter reference
            if (targetLocation.chapterNumber === currentChapterNumber) {
                enhancedLink.targetChunkIndex = targetLocation.chunkIndex;
            } else {
                enhancedLink.targetChunkIndex = targetLocation.chunkIndex;
                enhancedLink.chapterNumber = targetLocation.chapterNumber;
            }
        }
    } else if (link.role === 'target') {
        // For target links, find the source chunk (chunk that references this target)
        const sourceLocation = findSourceChunk(link, chunkMap, currentChunkIndex, currentChapterNumber);
        if (sourceLocation) {
            // For same-chapter links, use just the chunk index
            // For cross-chapter links, could include chapter reference  
            if (sourceLocation.chapterNumber === currentChapterNumber) {
                enhancedLink.sourceChunkIndex = sourceLocation.chunkIndex;
            } else {
                enhancedLink.sourceChunkIndex = sourceLocation.chunkIndex;
                enhancedLink.chapterNumber = sourceLocation.chapterNumber;
            }
        }
    }

    return enhancedLink;
}

/**
 * Find the chunk that contains the target text for a source link
 * @param {Object} link - Source link object
 * @param {Object} chunkMap - Chunk mapping for lookup
 * @returns {string|null} - Target chunk ID or null if not found
 */
function findTargetChunk(link, chunkMap) {
    // Look for chunks on the target page
    if (!link.targetPageNumber || !chunkMap.byPage.has(link.targetPageNumber)) {
        return null;
    }

    const targetPageChunks = chunkMap.byPage.get(link.targetPageNumber);

    // First, try to find exact target text match
    if (link.targetText) {
        for (const chunkInfo of targetPageChunks) {
            if (chunkInfo.chunk.content && isSourceTextInContent(link.targetText, chunkInfo.chunk.content)) {
                return {
                    chapterNumber: chunkInfo.chapterNumber,
                    chunkIndex: chunkInfo.chunkIndex
                };
            }
        }
    }

    // If no exact match, try finding chunk that contains the link text
    for (const chunkInfo of targetPageChunks) {
        if (chunkInfo.chunk.content && isSourceTextInContent(link.text, chunkInfo.chunk.content)) {
            return {
                chapterNumber: chunkInfo.chapterNumber,
                chunkIndex: chunkInfo.chunkIndex
            };
        }
    }

    return null;
}

/**
 * Find the chunk that contains the source reference for a target link
 * @param {Object} link - Target link object
 * @param {Object} chunkMap - Chunk mapping for lookup
 * @param {number} currentChunkIndex - Index of current chunk (should be excluded)
 * @param {number} currentChapterNumber - Chapter number of current chunk
 * @returns {Object|null} - {chapterNumber, chunkIndex} or null if not found
 */
function findSourceChunk(link, chunkMap, currentChunkIndex, currentChapterNumber) {
    // Look through all chunks to find one that contains this link as a source
    for (const chunkInfo of chunkMap.allChunks) {
        // Skip the current chunk (target)
        if (chunkInfo.chapterNumber === currentChapterNumber &&
            chunkInfo.chunkIndex === currentChunkIndex) {
            continue;
        }

        // Check if this chunk has a link that points to our target
        if (chunkInfo.chunk.links) {
            for (const chunkLink of chunkInfo.chunk.links) {
                if (chunkLink.role === 'source' &&
                    chunkLink.linkId === link.linkId &&
                    chunkLink.text === link.text) {
                    return {
                        chapterNumber: chunkInfo.chapterNumber,
                        chunkIndex: chunkInfo.chunkIndex
                    };
                }
            }
        }
    }

    return null;
}

// Import validation function
const { validate } = require('./05-1-link-chunk-references-validation');

module.exports = {
    execute,
    validate
};