/**
 * Validation functions for Step 5.1: Link Chunk References
 */

/**
 * Validate link chunk references results
 * @param {Object} output - Output from execute function
 * @returns {boolean} - True if validation passes
 */
function validate(output) {
    const validationErrors = [];

    // Extract all chunks from all chapters
    const allChunks = [];
    if (output.chapters) {
        for (const chapter of output.chapters) {
            if (chapter.chunks) {
                allChunks.push(...chapter.chunks);
            }
        }
    }

    if (allChunks.length === 0) {
        validationErrors.push('No chunks found in output');
        return false;
    }

    let totalLinks = 0;
    let sourceLinksWithTargetChunkIndex = 0;
    let targetLinksWithSourceChunkIndex = 0;
    let sourceLinksWithoutTargetChunkIndex = 0;
    let targetLinksWithoutSourceChunkIndex = 0;

    // Check each chunk's links
    for (const chunk of allChunks) {
        if (chunk.links && chunk.links.length > 0) {
            for (const link of chunk.links) {
                totalLinks++;

                // Validate required fields still exist
                if (!link.text || typeof link.text !== 'string') {
                    validationErrors.push(`Link in chunk ${chunk.chunkId} missing text field`);
                    continue;
                }

                if (!link.linkId || typeof link.linkId !== 'string') {
                    validationErrors.push(`Link in chunk ${chunk.chunkId} missing linkId field`);
                    continue;
                }

                if (!link.role || (link.role !== 'source' && link.role !== 'target')) {
                    validationErrors.push(`Link in chunk ${chunk.chunkId} has invalid role: ${link.role}`);
                    continue;
                }

                // Validate chunk references based on role
                if (link.role === 'source') {
                    if (link.targetChunkIndex !== undefined) {
                        sourceLinksWithTargetChunkIndex++;

                        // Validate targetChunkIndex format
                        if (typeof link.targetChunkIndex !== 'number' || link.targetChunkIndex < 0) {
                            validationErrors.push(`Source link in chunk at index ${chunkIndex} has invalid targetChunkIndex: ${link.targetChunkIndex}`);
                        }
                    } else {
                        sourceLinksWithoutTargetChunkIndex++;
                    }
                } else if (link.role === 'target') {
                    if (link.sourceChunkIndex !== undefined) {
                        targetLinksWithSourceChunkIndex++;

                        // Validate sourceChunkIndex format
                        if (typeof link.sourceChunkIndex !== 'number' || link.sourceChunkIndex < 0) {
                            validationErrors.push(`Target link in chunk at index ${chunkIndex} has invalid sourceChunkIndex: ${link.sourceChunkIndex}`);
                        }
                    } else {
                        targetLinksWithoutSourceChunkIndex++;
                    }
                }

                // Note: Cross-chunk validation would require chapter context
                // For now, we just validate the index format
            }
        }
    }

    // Validation criteria
    if (totalLinks === 0) {
        validationErrors.push('No links found in any chunks');
    } else {
        // At least some links should have chunk references
        const totalWithReferences = sourceLinksWithTargetChunkIndex + targetLinksWithSourceChunkIndex;
        const referenceRate = totalWithReferences / totalLinks;

        if (referenceRate < 0.3) {
            validationErrors.push(`Low chunk reference resolution rate: ${(referenceRate * 100).toFixed(1)}% (${totalWithReferences}/${totalLinks}). Expected at least 30% of links to have chunk references.`);
        }

        // Check for step-5-1 statistics
        if (!output['step-5-1']) {
            validationErrors.push('Missing step-5-1 statistics in output');
        } else {
            const stats = output['step-5-1'];
            if (stats.totalLinksProcessed !== totalLinks) {
                validationErrors.push(`Statistics mismatch: processed ${stats.totalLinksProcessed} links but found ${totalLinks} links in chunks`);
            }
        }
    }

    // Report validation results
    if (validationErrors.length > 0) {
        console.error(`❌ Link chunk references validation failed with ${validationErrors.length} error(s):`);
        validationErrors.forEach((error, index) => {
            console.error(`  ${index + 1}. ${error}`);
        });
        return false;
    }

    // Success message with statistics
    console.log(`✅ Link chunk references validation passed:`);
    console.log(`   🔗 Total links: ${totalLinks}`);
    console.log(`   📍 Source links with targetChunkIndex: ${sourceLinksWithTargetChunkIndex}`);
    console.log(`   🎯 Target links with sourceChunkIndex: ${targetLinksWithSourceChunkIndex}`);
    console.log(`   ❓ Source links without targetChunkIndex: ${sourceLinksWithoutTargetChunkIndex}`);
    console.log(`   ❓ Target links without sourceChunkIndex: ${targetLinksWithoutSourceChunkIndex}`);

    return true;
}

module.exports = {
    validate
};