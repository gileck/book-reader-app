/**
 * Step 5.1: Link Chunk References
 * 
 * Add targetChunkIndex and sourceChunkIndex to links based on their roles using selector-based anchors:
 * - For "source" role links: add targetChunkIndex (chunk containing the target text)
 * - For "target" role links: add sourceChunkIndex (chunk containing the source text)
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


    if (!pipelineState.chapters || !Array.isArray(pipelineState.chapters)) {
        throw new Error('Step 5.1 requires chapters array from previous steps');
    }

    // Create a mapping of all chunks for quick lookup (by chapter and by range)
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
 * Create a mapping of all chunks for quick lookup by chapter and content ranges
 * @param {Array} chapters - All chapters with chunks
 * @returns {Object} - Chunk mapping for lookup
 */
function createChunkMap(chapters) {
    const chunkMap = {
        byChapter: new Map(), // chapterNumber -> [{chunkIndex, startOffset, endOffset, chunk}]
        allChunks: [] // Flat array of all chunks with their indexes
    };

    for (let chapterIndex = 0; chapterIndex < chapters.length; chapterIndex++) {
        const chapter = chapters[chapterIndex];
        // Build chapter-level concatenated text to compute chunk ranges
        const chapterText = typeof chapter.content === 'string' ? chapter.content : '';
        let cursor = 0;
        const ranges = [];

        for (let chunkIndex = 0; chunkIndex < chapter.chunks.length; chunkIndex++) {
            const chunk = chapter.chunks[chunkIndex];
            // Compute approximate range by searching for chunk.content starting from cursor
            let startOffset = -1;
            if (chunk.content && chapterText) {
                const idx = chapterText.indexOf(chunk.content, cursor);
                if (idx >= 0) {
                    startOffset = idx;
                    cursor = idx + chunk.content.length;
                }
            }
            const endOffset = startOffset >= 0 ? startOffset + (chunk.content ? chunk.content.length : 0) : -1;

            ranges.push({ chunkIndex, startOffset, endOffset, chunk });

            // Store in flat array for easy access
            chunkMap.allChunks.push({
                chapterNumber: chapter.chapterNumber,
                chunkIndex,
                chunk
            });
        }

        chunkMap.byChapter.set(chapter.chapterNumber, { ranges, text: chapterText });
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
            enhancedLink.targetChunkId = targetLocation.chunkId;
            enhancedLink.targetChunkIndex = targetLocation.chunkIndex;
            if (targetLocation.chapterNumber !== currentChapterNumber) {
                enhancedLink.chapterNumber = targetLocation.chapterNumber;
            }
        }
    } else if (link.role === 'target') {
        // For target links, find the source chunk (chunk that references this target)
        const sourceLocation = findSourceChunk(link, chunkMap, currentChunkIndex, currentChapterNumber);
        if (sourceLocation) {
            enhancedLink.sourceChunkId = sourceLocation.chunkId;
            enhancedLink.sourceChunkIndex = sourceLocation.chunkIndex;
            if (sourceLocation.chapterNumber !== currentChapterNumber) {
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
    // Expect `link.anchor` for targets to be set from Step 03-1 (or matched by linkId pairing)
    // Here, we use the target link's own anchor if present; otherwise skip
    const anchor = link.anchor;
    if (!anchor || typeof anchor.chapterId !== 'number' || !anchor.selector) return null;
    const chapterNumber = (anchor.chapterId + 1); // our chapters are 1-based in data
    const chapterEntry = chunkMap.byChapter.get(chapterNumber);
    if (!chapterEntry) return null;
    const { ranges } = chapterEntry;
    const start = anchor.selector.start;
    const end = anchor.selector.end;
    for (const r of ranges) {
        if (r.startOffset >= 0 && r.endOffset >= 0 && start >= r.startOffset && end <= r.endOffset) {
            return { chapterNumber, chunkIndex: r.chunkIndex, chunkId: r.chunk && r.chunk.chunkId };
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
    // Prefer the source link's own anchor if present on the global `links`
    const anchor = link.anchor;
    if (!anchor || typeof anchor.chapterId !== 'number' || !anchor.selector) return null;
    const chapterNumber = (anchor.chapterId + 1);
    const chapterEntry = chunkMap.byChapter.get(chapterNumber);
    if (!chapterEntry) return null;
    const { ranges } = chapterEntry;
    const start = anchor.selector.start;
    const end = anchor.selector.end;
    for (const r of ranges) {
        if (r.startOffset >= 0 && r.endOffset >= 0 && start >= r.startOffset && end <= r.endOffset) {
            // Avoid pointing to the same chunk if we're enhancing inside the target chunk
            if (chapterNumber === currentChapterNumber && r.chunkIndex === currentChunkIndex) continue;
            return { chapterNumber, chunkIndex: r.chunkIndex, chunkId: r.chunk && r.chunk.chunkId };
        }
    }
    return null;
}

// Import validation function
const { validate } = require('./05-2-link-chunk-references-validation');

module.exports = {
    execute,
    validate
};