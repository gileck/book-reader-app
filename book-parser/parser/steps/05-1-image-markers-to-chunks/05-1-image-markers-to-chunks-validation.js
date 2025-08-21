/**
 * Validation for Step 5-1: Image Markers to Chunks
 * 
 * Validates that:
 * - No [[IMG ...]] markers remain in any text content
 * - Image chunks are present (at least 1)
 * - All image chunks have required properties
 * - Chunk IDs are properly assigned
 */

const fs = require('fs');
const path = require('path');

/**
 * Validate Step 5-1 output
 * @param {Object} pipelineState - The pipeline state after step 5-1
 * @param {Object} config - Configuration object
 * @returns {Object} - Validation results
 */
function validate(pipelineState, config) {
    const errors = [];
    const warnings = [];

    if (!pipelineState.chapters || !Array.isArray(pipelineState.chapters)) {
        errors.push('Missing chapters array in pipeline state');
        return { valid: false, errors, warnings };
    }

    let totalImageChunks = 0;
    let totalTextChunks = 0;
    let totalRemainingMarkers = 0;

    for (const chapter of pipelineState.chapters) {
        const chapterErrors = validateChapter(chapter);
        errors.push(...chapterErrors.errors);
        warnings.push(...chapterErrors.warnings);

        totalImageChunks += chapterErrors.imageChunks;
        totalTextChunks += chapterErrors.textChunks;
        totalRemainingMarkers += chapterErrors.remainingMarkers;
    }

    // Global validations
    if (totalImageChunks === 0) {
        errors.push('No image chunks found - expected at least 1 image chunk to be created');
    }

    if (totalRemainingMarkers > 0) {
        errors.push(`Found ${totalRemainingMarkers} remaining image markers in text content - all should be converted to chunks`);
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
        stats: {
            totalImageChunks,
            totalTextChunks,
            totalRemainingMarkers
        }
    };
}

/**
 * Validate a single chapter
 * @param {Object} chapter - Chapter to validate
 * @returns {Object} - Validation results for this chapter
 */
function validateChapter(chapter) {
    const errors = [];
    const warnings = [];
    let imageChunks = 0;
    let textChunks = 0;
    let remainingMarkers = 0;

    if (!chapter.chunks || !Array.isArray(chapter.chunks)) {
        errors.push(`Chapter ${chapter.chapterNumber || 'unknown'} missing chunks array`);
        return { errors, warnings, imageChunks, textChunks, remainingMarkers };
    }

    const chunkIds = new Set();

    for (let i = 0; i < chapter.chunks.length; i++) {
        const chunk = chapter.chunks[i];
        const chunkErrors = validateChunk(chunk, i, chapter.chapterNumber);
        errors.push(...chunkErrors.errors);
        warnings.push(...chunkErrors.warnings);

        // Count chunk types
        if (chunk.type === 'image') {
            imageChunks++;
        } else if (chunk.type === 'text') {
            textChunks++;
            // Check for remaining markers in text content
            const markerCount = countImageMarkers(chunk.content);
            remainingMarkers += markerCount;
            if (markerCount > 0) {
                errors.push(`Text chunk ${chunk.chunkId || i} contains ${markerCount} remaining image markers`);
            }
        }

        // Check for duplicate chunk IDs
        if (chunk.chunkId) {
            if (chunkIds.has(chunk.chunkId)) {
                errors.push(`Duplicate chunk ID: ${chunk.chunkId}`);
            }
            chunkIds.add(chunk.chunkId);
        }
    }

    return { errors, warnings, imageChunks, textChunks, remainingMarkers };
}

/**
 * Validate a single chunk
 * @param {Object} chunk - Chunk to validate
 * @param {number} index - Index in chunks array
 * @param {number} chapterNumber - Chapter number
 * @returns {Object} - Validation results
 */
function validateChunk(chunk, index, chapterNumber) {
    const errors = [];
    const warnings = [];

    if (!chunk.type) {
        errors.push(`Chunk at index ${index} missing type`);
        return { errors, warnings };
    }

    if (!chunk.chunkId) {
        errors.push(`Chunk at index ${index} missing chunkId`);
    }

    if (typeof chunk.content !== 'string') {
        errors.push(`Chunk ${chunk.chunkId || index} missing or invalid content`);
    }

    // Type-specific validations
    if (chunk.type === 'image') {
        validateImageChunk(chunk, errors, warnings);
    } else if (chunk.type === 'text') {
        validateTextChunk(chunk, errors, warnings);
    }

    return { errors, warnings };
}

/**
 * Validate an image chunk
 * @param {Object} chunk - Image chunk to validate
 * @param {Array} errors - Errors array to push to
 * @param {Array} warnings - Warnings array to push to
 */
function validateImageChunk(chunk, errors, warnings) {
    const requiredFields = ['imageName', 'imageAlt'];

    for (const field of requiredFields) {
        if (!chunk[field]) {
            errors.push(`Image chunk ${chunk.chunkId} missing required field: ${field}`);
        }
    }

    if (chunk.wordCount !== 0) {
        warnings.push(`Image chunk ${chunk.chunkId} has non-zero word count: ${chunk.wordCount}`);
    }

    if (chunk.sentenceCount !== 0) {
        warnings.push(`Image chunk ${chunk.chunkId} has non-zero sentence count: ${chunk.sentenceCount}`);
    }

    if (chunk.paragraphIndex !== null) {
        warnings.push(`Image chunk ${chunk.chunkId} should have paragraphIndex: null`);
    }
}

/**
 * Validate a text chunk
 * @param {Object} chunk - Text chunk to validate
 * @param {Array} errors - Errors array to push to
 * @param {Array} warnings - Warnings array to push to
 */
function validateTextChunk(chunk, errors, warnings) {
    if (typeof chunk.wordCount !== 'number' || chunk.wordCount < 0) {
        errors.push(`Text chunk ${chunk.chunkId} has invalid word count: ${chunk.wordCount}`);
    }

    if (typeof chunk.sentenceCount !== 'number' || chunk.sentenceCount < 0) {
        errors.push(`Text chunk ${chunk.chunkId} has invalid sentence count: ${chunk.sentenceCount}`);
    }

    if (typeof chunk.paragraphIndex !== 'number' || chunk.paragraphIndex < 1) {
        errors.push(`Text chunk ${chunk.chunkId} has invalid paragraphIndex: ${chunk.paragraphIndex}`);
    }

    // Check that content doesn't contain image markers
    const markerCount = countImageMarkers(chunk.content);
    if (markerCount > 0) {
        errors.push(`Text chunk ${chunk.chunkId} contains ${markerCount} image markers that should have been converted`);
    }
}

/**
 * Count image markers in content
 * @param {string} content - Content to check
 * @returns {number} - Number of image markers found
 */
function countImageMarkers(content) {
    if (typeof content !== 'string') return 0;
    const markerRegex = /\[\[IMG\s+id=([^\s]+)\s+index=(\d+)\s+alt="([^"]*)"\]\]/g;
    const matches = content.match(markerRegex);
    return matches ? matches.length : 0;
}

module.exports = { validate };
