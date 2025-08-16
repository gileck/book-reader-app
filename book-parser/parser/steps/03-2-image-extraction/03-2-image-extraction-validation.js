/**
 * Step 3-2: Image Extraction Validation
 * 
 * Validates that image extraction was completed successfully using inline markers.
 * This step now inserts [[IMG ...]] markers into chapter content (not page images arrays).
 */

const path = require('path');
const fs = require('fs');

/**
 * Validate the output of step 3-2 (image extraction)
 * @param {Object} result - Result from execute function
 * @returns {boolean} - True if validation passes
 */
function validate(result) {
    // Check that result has chapters
    if (!result.chapters || !Array.isArray(result.chapters)) {
        console.error('Validation failed: chapters is not an array');
        return false;
    }

    if (result.chapters.length === 0) {
        console.error('Validation failed: no chapters found');
        return false;
    }

    let totalChaptersChecked = 0;
    let totalImages = 0;

    // Check each chapter's content for markers
    const markerRegex = /\[\[IMG\s+id=([^\s\]]+)\s+index=(\d+)\s+alt=\"([^\"]*)\"\]\]/g; // strict token with id/index/alt
    const seenIds = new Set();
    for (let i = 0; i < result.chapters.length; i++) {
        const chapter = result.chapters[i];
        totalChaptersChecked++;
        if (typeof chapter.content !== 'string') {
            console.error(`Validation failed: chapter ${i} does not have concatenated content with markers`);
            return false;
        }
        let match;
        while ((match = markerRegex.exec(chapter.content)) !== null) {
            const id = match[1];
            const alt = match[3];
            if (!id || seenIds.has(id)) {
                console.error(`Validation failed: duplicate or missing image id: ${id}`);
                return false;
            }
            if (!alt || alt.length === 0) {
                console.error(`Validation failed: marker with id ${id} missing alt text`);
                return false;
            }
            seenIds.add(id);
            totalImages++;
        }
    }

    // Check metadata
    if (!result.metadata) {
        console.error('Validation failed: metadata is missing');
        return false;
    }

    if (!result.metadata.imageExtraction) {
        console.error('Validation failed: imageExtraction metadata is missing');
        return false;
    }

    const imageMetadata = result.metadata.imageExtraction;

    if (typeof imageMetadata.totalImages !== 'number' || imageMetadata.totalImages < 0) {
        console.error('Validation failed: imageExtraction metadata does not have valid totalImages');
        return false;
    }

    if (typeof imageMetadata.totalExtractedImages !== 'number' || imageMetadata.totalExtractedImages < 0) {
        console.error('Validation failed: imageExtraction metadata does not have valid totalExtractedImages');
        return false;
    }

    if (typeof imageMetadata.imagesFolderPath !== 'string' || imageMetadata.imagesFolderPath.length === 0) {
        console.error('Validation failed: imageExtraction metadata does not have valid imagesFolderPath');
        return false;
    }

    if (typeof imageMetadata.processingTime !== 'number' || imageMetadata.processingTime < 0) {
        console.error('Validation failed: imageExtraction metadata does not have valid processingTime');
        return false;
    }

    if (typeof imageMetadata.extractionTime !== 'string' || imageMetadata.extractionTime.length === 0) {
        console.error('Validation failed: imageExtraction metadata does not have valid extractionTime');
        return false;
    }

    // Validate that metadata matches actual counts
    if (imageMetadata.totalImages !== totalImages) {
        console.error(`Validation failed: metadata totalImages (${imageMetadata.totalImages}) does not match actual count (${totalImages})`);
        return false;
    }

    // Verify that extracted image files actually exist on disk
    let filesExistCount = 0;
    let filesMissingCount = 0;

    // Verify that extracted image files actually exist on disk by scanning images folder
    try {
        const files = fs.readdirSync(imageMetadata.imagesFolderPath);
        for (const file of files) {
            if (/^image-.*\.(jpg|jpeg|png)$/i.test(file)) {
                filesExistCount++;
            }
        }
    } catch (e) {
        console.error('Validation failed: cannot read images folder:', e.message);
        return false;
    }

    if (filesMissingCount > 0) {
        console.error(`Validation failed: ${filesMissingCount} extracted image files are missing from disk`);
        return false;
    }

    // All validation checks passed


    return true;
}

module.exports = { validate }; 