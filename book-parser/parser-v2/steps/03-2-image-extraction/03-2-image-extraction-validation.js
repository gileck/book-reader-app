/**
 * Step 3-2: Image Extraction Validation
 * 
 * Validates that image extraction was completed successfully.
 * This step should add an images array to each page with extracted images.
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

    let totalPagesChecked = 0;
    let totalPagesWithImages = 0;
    let totalImages = 0;

    // Check each chapter
    for (let i = 0; i < result.chapters.length; i++) {
        const chapter = result.chapters[i];

        // Check chapter structure
        if (!chapter.pages || !Array.isArray(chapter.pages)) {
            console.error(`Validation failed: chapter ${i} does not have pages array`);
            return false;
        }

        // Check each page
        for (let j = 0; j < chapter.pages.length; j++) {
            const page = chapter.pages[j];
            totalPagesChecked++;

            // Check page structure
            if (typeof page.pageNumber !== 'number') {
                console.error(`Validation failed: page ${j} in chapter ${i} does not have valid pageNumber`);
                return false;
            }

            if (typeof page.content !== 'string') {
                console.error(`Validation failed: page ${j} in chapter ${i} does not have valid content`);
                return false;
            }

            // Check that images array exists (even if empty)
            if (!Array.isArray(page.images)) {
                console.error(`Validation failed: page ${j} in chapter ${i} does not have images array`);
                return false;
            }

            // If page has images, validate their structure
            if (page.images.length > 0) {
                totalPagesWithImages++;
                totalImages += page.images.length;

                for (let k = 0; k < page.images.length; k++) {
                    const image = page.images[k];

                    // Check required image properties
                    if (typeof image.imageName !== 'string' || image.imageName.length === 0) {
                        console.error(`Validation failed: image ${k} on page ${j} in chapter ${i} does not have valid imageName`);
                        return false;
                    }

                    if (typeof image.imageAlt !== 'string' || image.imageAlt.length === 0) {
                        console.error(`Validation failed: image ${k} on page ${j} in chapter ${i} does not have valid imageAlt`);
                        return false;
                    }

                    // Check that extracted flag is boolean
                    if (typeof image.extracted !== 'boolean') {
                        console.error(`Validation failed: image ${k} on page ${j} in chapter ${i} does not have valid extracted flag`);
                        return false;
                    }

                    // Check that placeholder flag is boolean (optional but if present must be boolean)
                    if (image.placeholder !== undefined && typeof image.placeholder !== 'boolean') {
                        console.error(`Validation failed: image ${k} on page ${j} in chapter ${i} does not have valid placeholder flag`);
                        return false;
                    }
                }
            }
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

    for (let i = 0; i < result.chapters.length; i++) {
        const chapter = result.chapters[i];
        for (let j = 0; j < chapter.pages.length; j++) {
            const page = chapter.pages[j];
            for (let k = 0; k < page.images.length; k++) {
                const image = page.images[k];
                if (image.extracted) {
                    const imagePath = path.join(imageMetadata.imagesFolderPath, image.imageName);
                    if (fs.existsSync(imagePath)) {
                        filesExistCount++;
                    } else {
                        filesMissingCount++;
                        console.error(`Validation failed: extracted image file does not exist: ${imagePath}`);
                    }
                }
            }
        }
    }

    if (filesMissingCount > 0) {
        console.error(`Validation failed: ${filesMissingCount} extracted image files are missing from disk`);
        return false;
    }

    // All validation checks passed
    console.log(`✓ Image extraction validation passed:`);
    console.log(`  - Processed ${totalPagesChecked} pages`);
    console.log(`  - ${totalPagesWithImages} pages have images`);
    console.log(`  - Total images: ${totalImages}`);
    console.log(`  - Total extracted images: ${imageMetadata.totalExtractedImages}`);
    console.log(`  - Files verified on disk: ${filesExistCount}`);
    console.log(`  - Images folder: ${imageMetadata.imagesFolderPath}`);

    return true;
}

module.exports = { validate }; 