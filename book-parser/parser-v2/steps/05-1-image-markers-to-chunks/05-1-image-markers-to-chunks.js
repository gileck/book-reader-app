/**
 * Step 5-1: Image Markers to Chunks
 * 
 * Convert [[IMG ...]] markers in text chunks to dedicated image chunks.
 * This step processes the output from Step 5 (sentence detection) and converts
 * any remaining image markers into proper image chunks positioned after the
 * text chunks that contain them.
 * 
 * Requirements:
 * - Find all [[IMG ...]] markers in text chunk content
 * - Create image chunks and position them after the containing text chunks
 * - Remove the markers from the text content
 * - Preserve all other chunk types (text, header) as-is
 * - Validate that no markers remain and image chunks are created
 */

const fs = require('fs');
const path = require('path');

/**
 * Execute step 5-1: Image Markers to Chunks
 * @param {Object} pipelineState - State from previous steps
 * @returns {Object} - Updated pipeline state with image chunks
 */
function execute(pipelineState) {

    if (!pipelineState.chapters || !Array.isArray(pipelineState.chapters)) {
        throw new Error('Step 5-1 requires chapters array from previous steps');
    }

    const processedChapters = [];
    let totalImageChunksCreated = 0;
    let totalMarkersProcessed = 0;

    for (const chapter of pipelineState.chapters) {
        const { processedChunks, imageChunksCreated, markersProcessed } =
            processChapterImageMarkers(chapter);

        const processedChapter = {
            ...chapter,
            chunks: processedChunks
        };

        processedChapters.push(processedChapter);
        totalImageChunksCreated += imageChunksCreated;
        totalMarkersProcessed += markersProcessed;
    }

    // console.log(`✅ Step 5-1 completed:`);
    // console.log(`   📝 Processed ${totalMarkersProcessed} image markers`);
    // console.log(`   🖼️  Created ${totalImageChunksCreated} image chunks`);

    return {
        ...pipelineState,
        chapters: processedChapters,
        metadata: {
            ...pipelineState.metadata,
            step51ImageProcessing: {
                totalMarkersProcessed,
                totalImageChunksCreated,
                timestamp: new Date().toISOString()
            }
        }
    };
}

/**
 * Process image markers in a chapter's chunks
 * @param {Object} chapter - Chapter with text chunks that may contain image markers
 * @returns {Object} - {processedChunks, imageChunksCreated, markersProcessed}
 */
function processChapterImageMarkers(chapter) {
    if (!chapter.chunks || !Array.isArray(chapter.chunks)) {
        return { processedChunks: [], imageChunksCreated: 0, markersProcessed: 0 };
    }

    const processedChunks = [];
    let imageChunksCreated = 0;
    let markersProcessed = 0;
    let chunkIdCounter = 1;

    for (const chunk of chapter.chunks) {
        if (chunk.type === 'text') {
            // Check if this text chunk contains image markers
            const { cleanedContent, imageMarkers } = extractImageMarkersFromContent(chunk.content);

            if (imageMarkers.length > 0) {
                // Create updated text chunk with markers removed
                const updatedTextChunk = {
                    ...chunk,
                    content: cleanedContent,
                    chunkId: `${chapter.chapterNumber}_${chunkIdCounter++}`
                };
                processedChunks.push(updatedTextChunk);

                // Create image chunks for each marker found
                for (const marker of imageMarkers) {
                    const imageChunk = createImageChunk(marker, chapter.chapterNumber, chunkIdCounter++);
                    processedChunks.push(imageChunk);
                    imageChunksCreated++;
                }

                markersProcessed += imageMarkers.length;
            } else {
                // No markers, just update chunk ID and add as-is
                processedChunks.push({
                    ...chunk,
                    chunkId: `${chapter.chapterNumber}_${chunkIdCounter++}`
                });
            }
        } else {
            // Non-text chunks (header, image) pass through unchanged with updated ID
            processedChunks.push({
                ...chunk,
                chunkId: `${chapter.chapterNumber}_${chunkIdCounter++}`
            });
        }
    }

    return { processedChunks, imageChunksCreated, markersProcessed };
}

/**
 * Extract image markers from text content
 * @param {string} content - Text content that may contain image markers
 * @returns {Object} - {cleanedContent, imageMarkers}
 */
function extractImageMarkersFromContent(content) {
    const imageMarkers = [];
    const markerRegex = /\[\[IMG\s+id=([^\s]+)\s+index=(\d+)\s+alt="([^"]*)"\]\]/g;

    let match;
    while ((match = markerRegex.exec(content)) !== null) {
        imageMarkers.push({
            fullMatch: match[0],
            id: match[1],
            index: parseInt(match[2]),
            alt: match[3]
        });
    }

    // Remove all markers from content
    const cleanedContent = content.replace(markerRegex, '').replace(/\s+/g, ' ').trim();

    return { cleanedContent, imageMarkers };
}

/**
 * Create an image chunk from a marker
 * @param {Object} marker - Parsed image marker
 * @param {number} chapterNumber - Chapter number
 * @param {number} chunkIdCounter - Counter for chunk ID
 * @returns {Object} - Image chunk
 */
function createImageChunk(marker, chapterNumber, chunkIdCounter) {
    return {
        chunkId: `${chapterNumber}_${chunkIdCounter}`,
        type: 'image',
        content: marker.alt || `Image: ${marker.id}`,
        wordCount: 0,
        sentenceCount: 0,
        links: [],
        imageName: `${marker.id}.jpg`,
        imageAlt: marker.alt || marker.id,
        paragraphIndex: null // Images don't belong to paragraphs
    };
}

module.exports = { execute };
