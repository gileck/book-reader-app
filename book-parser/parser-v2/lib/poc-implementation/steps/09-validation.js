/**
 * Step 9: Validation
 * 
 * This step validates that the final pipeline output meets all requirements
 * and quality standards before considering the processing complete.
 */

/**
 * Count words in a text string
 * @param {string} text - The text to count words in
 * @returns {number} - Number of words
 */
function countWords(text) {
    if (!text || typeof text !== 'string') return 0;
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Validate chapters array
 * @param {Array} chapters - Array of chapter objects
 * @returns {Object} - Validation result with errors separated by type
 */
function validateChapters(chapters) {
    const errorsByType = {
        arrayCount: [],
        pageNumberValidation: [],
        chapterContinuity: []
    };
    const warnings = [];

    // 1. chapters array is more than 1
    if (!chapters || chapters.length <= 1) {
        errorsByType.arrayCount.push('Chapters array must have more than 1 chapter');
    }

    if (chapters && chapters.length > 0) {
        for (let i = 0; i < chapters.length; i++) {
            const chapter = chapters[i];
            
            // 2. pageNumberStart > pageNumberEnd validation
            if (chapter.pageNumberStart >= chapter.pageNumberEnd) {
                errorsByType.pageNumberValidation.push(`Chapter ${i + 1} "${chapter.title}": pageNumberStart (${chapter.pageNumberStart}) must be less than pageNumberEnd (${chapter.pageNumberEnd})`);
            }

            // 2. Validate chapter continuity (chapterStart of chapter x is 1 + pageNumberEnd of chapter x - 1)
            if (i > 0) {
                const prevChapter = chapters[i - 1];
                const expectedStart = prevChapter.pageNumberEnd + 1;
                if (chapter.pageNumberStart !== expectedStart) {
                    errorsByType.chapterContinuity.push(`Chapter ${i + 1} "${chapter.title}": pageNumberStart (${chapter.pageNumberStart}) should be ${expectedStart} (previous chapter end + 1)`);
                }
            }
        }
    }

    return { errorsByType, warnings };
}

/**
 * Validate chunks array
 * @param {Array} chunks - Array of chunk objects
 * @returns {Object} - Validation result with errors separated by type
 */
function validateChunks(chunks) {
    const errorsByType = {
        arrayCount: [],
        wordCount: [],
        capitalization: [],
        chunkTypes: []
    };
    const warnings = [];

    // 3. chunks array has more than 5 items
    if (!chunks || chunks.length <= 5) {
        errorsByType.arrayCount.push('Chunks array must have more than 5 items');
    }

    if (chunks && chunks.length > 0) {
        let hasParagraph = false;
        let hasHeader = false;

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const chunkIdentifier = chunk.chunkId || `chunk_${i + 1}`;
            
            // Track chunk types
            if (chunk.type === 'paragraph') hasParagraph = true;
            if (chunk.type === 'header') hasHeader = true;

            // 5. all paragraph and headers start with a capital letter (or valid alternatives for paragraphs)
            if (chunk.content && chunk.content.length > 0) {
                const firstChar = chunk.content.charAt(0);
                
                if (chunk.type === 'header') {
                    // Headers must start with a capital letter
                    if (firstChar !== firstChar.toUpperCase() || !/[A-Z]/.test(firstChar)) {
                        errorsByType.capitalization.push(`Header ${chunkIdentifier}: Content must start with a capital letter. Found: "${chunk.content.substring(0, 20)}..."`);
                    }
                } else if (chunk.type === 'paragraph') {
                    // Paragraphs can start with capital letters, numbers (footnotes), special characters (quotes, etc.), 
                    // Greek letters, mathematical symbols, or lowercase letters (for continuations)
                    const isValidStart = /[A-Za-z0-9'"'""«»„"‚'‛‹›αβγδεζηθικλμνξοπρστυφχψωΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ+\-=<>∞∑∏∫∂∆∇±×÷°′″‰%‱§¶†‡•‰‱]/.test(firstChar);
                    if (!isValidStart) {
                        errorsByType.capitalization.push(`Paragraph ${chunkIdentifier}: Content must start with a valid character. Found: "${chunk.content.substring(0, 20)}..."`);
                    }
                }
            }

            // 6. all paragraphs are between 80 and 300 words
            if (chunk.type === 'paragraph') {
                const wordCount = countWords(chunk.content);
                if (wordCount < 80 || wordCount > 300) {
                    errorsByType.wordCount.push(`Paragraph ${chunkIdentifier}: Word count (${wordCount}) must be between 80 and 300 words`);
                }
            }

            // 7. all headers are between 1 and 5 words
            if (chunk.type === 'header') {
                const wordCount = countWords(chunk.content);
                if (wordCount < 1 || wordCount > 5) {
                    errorsByType.wordCount.push(`Header ${chunkIdentifier}: Word count (${wordCount}) must be between 1 and 5 words. Content: "${chunk.content}"`);
                }
            }
        }

        // 4. chunks array has valid types both "paragraph" and "header"
        if (!hasParagraph) {
            errorsByType.chunkTypes.push('Chunks array must contain at least one paragraph');
        }
        if (!hasHeader) {
            errorsByType.chunkTypes.push('Chunks array must contain at least one header');
        }
    }

    return { errorsByType, warnings };
}

/**
 * Validate links array
 * @param {Array} links - Array of link objects
 * @returns {Object} - Validation result with errors separated by type
 */
function validateLinks(links) {
    const errorsByType = {
        linkRoles: [],
        linkMatching: []
    };
    const warnings = [];

    if (links && links.length > 0) {
        const linksByRole = { source: [], target: [] };
        
        // Group links by role
        for (let i = 0; i < links.length; i++) {
            const link = links[i];
            const linkIdentifier = link.linkId || `link_${i + 1}`;
            
            // 8. all links have roles (source and target)
            if (!link.role || (link.role !== 'source' && link.role !== 'target')) {
                errorsByType.linkRoles.push(`Link ${linkIdentifier}: Must have role "source" or "target". Found: "${link.role}"`);
            } else {
                linksByRole[link.role].push(link);
            }
        }

        // 8. for each source link the target link with the same id exists in the target page
        for (const sourceLink of linksByRole.source) {
            const matchingTarget = linksByRole.target.find(target => 
                target.linkId === sourceLink.linkId
            );
            
            if (!matchingTarget) {
                errorsByType.linkMatching.push(`Source link with linkId "${sourceLink.linkId}" on page ${sourceLink.pageNumber} has no matching target link`);
            } else {
                // Validate that target is on the expected page
                if (matchingTarget.pageNumber !== sourceLink.targetPageNumber) {
                    warnings.push(`Source link with linkId "${sourceLink.linkId}" expects target on page ${sourceLink.targetPageNumber} but found on page ${matchingTarget.pageNumber}`);
                }
            }
        }

        // Check for orphaned target links
        for (const targetLink of linksByRole.target) {
            const matchingSource = linksByRole.source.find(source => 
                source.linkId === targetLink.linkId
            );
            
            if (!matchingSource) {
                warnings.push(`Target link with linkId "${targetLink.linkId}" on page ${targetLink.pageNumber} has no matching source link`);
            }
        }
    }

    return { errorsByType, warnings };
}

/**
 * Execute validation step
 * @param {Object} pipelineState - Current pipeline state
 * @param {Object} config - Configuration object
 * @returns {Object} - Updated state with validation results
 */
async function execute(pipelineState, config) {
    console.log('🔍 Starting validation...');
    
    // If pipeline state is empty, try to load from the most recent complete run
    if ((!pipelineState.chapters || pipelineState.chapters.length === 0) && 
        (!pipelineState.chunks || pipelineState.chunks.length === 0)) {
        
        console.log('📁 Loading pipeline state from step-4 output...');
        try {
            const fs = require('fs');
            const path = require('path');
            const step4OutputPath = path.join(config.OUTPUT_DIR, 'output-step-4.json');
            
            if (fs.existsSync(step4OutputPath)) {
                const step4Data = JSON.parse(fs.readFileSync(step4OutputPath, 'utf8'));
                
                // Merge the loaded data into pipelineState
                Object.assign(pipelineState, step4Data);
                
                // Extract chunks from chapters if they exist
                if (pipelineState.chapters && pipelineState.chapters.length > 0) {
                    pipelineState.chunks = [];
                    pipelineState.links = [];
                    
                    for (const chapter of pipelineState.chapters) {
                        if (chapter.chunks && chapter.chunks.length > 0) {
                            pipelineState.chunks.push(...chapter.chunks);
                        }
                        if (chapter.links && chapter.links.length > 0) {
                            pipelineState.links.push(...chapter.links);
                        }
                    }
                }
                
                console.log(`✅ Loaded pipeline state: ${pipelineState.chapters?.length || 0} chapters, ${pipelineState.chunks?.length || 0} chunks, ${pipelineState.links?.length || 0} links`);
            } else {
                console.log('⚠️  No step-4 output found, validating empty pipeline state');
            }
        } catch (error) {
            console.log('⚠️  Failed to load pipeline state:', error.message);
        }
    }
    
    const validationResults = {
        chapters: { errorsByType: {}, warnings: [] },
        chunks: { errorsByType: {}, warnings: [] },
        links: { errorsByType: {}, warnings: [] },
        summary: {
            totalErrors: 0,
            totalWarnings: 0,
            isValid: false,
            timestamp: new Date().toISOString(),
            errorsByType: {
                wordCount: [],
                capitalization: [],
                arrayCount: [],
                pageNumberValidation: [],
                chapterContinuity: [],
                chunkTypes: [],
                linkRoles: [],
                linkMatching: []
            }
        }
    };

    // Validate chapters
    const chapterValidation = validateChapters(pipelineState.chapters);
    validationResults.chapters = chapterValidation;

    // Validate chunks
    const chunkValidation = validateChunks(pipelineState.chunks);
    validationResults.chunks = chunkValidation;

    // Validate links
    const linkValidation = validateLinks(pipelineState.links);
    validationResults.links = linkValidation;

    // Aggregate errors by type across all categories
    const allErrorsByType = validationResults.summary.errorsByType;
    
    // Merge chapter errors
    Object.keys(chapterValidation.errorsByType).forEach(errorType => {
        if (allErrorsByType[errorType]) {
            allErrorsByType[errorType].push(...chapterValidation.errorsByType[errorType]);
        }
    });
    
    // Merge chunk errors
    Object.keys(chunkValidation.errorsByType).forEach(errorType => {
        if (allErrorsByType[errorType]) {
            allErrorsByType[errorType].push(...chunkValidation.errorsByType[errorType]);
        }
    });
    
    // Merge link errors
    Object.keys(linkValidation.errorsByType).forEach(errorType => {
        if (allErrorsByType[errorType]) {
            allErrorsByType[errorType].push(...linkValidation.errorsByType[errorType]);
        }
    });

    // Calculate summary
    const totalErrors = Object.values(allErrorsByType).reduce((sum, errors) => sum + errors.length, 0);
    const totalWarnings = chapterValidation.warnings.length + chunkValidation.warnings.length + linkValidation.warnings.length;
    
    validationResults.summary.totalErrors = totalErrors;
    validationResults.summary.totalWarnings = totalWarnings;
    validationResults.summary.isValid = totalErrors === 0;

    // Log results
    console.log(`📊 Validation Results:`);
    console.log(`   ✅ Valid: ${validationResults.summary.isValid}`);
    console.log(`   ❌ Errors: ${totalErrors}`);
    console.log(`   ⚠️  Warnings: ${totalWarnings}`);

    if (totalErrors > 0) {
        console.log('\n❌ VALIDATION ERRORS BY TYPE:');
        
        // Word Count Errors
        if (allErrorsByType.wordCount.length > 0) {
            console.log(`\n📏 Word Count Errors (${allErrorsByType.wordCount.length}):`);
            allErrorsByType.wordCount.forEach((error, i) => {
                console.log(`   ${i + 1}. ${error}`);
            });
        }
        
        // Capitalization Errors
        if (allErrorsByType.capitalization.length > 0) {
            console.log(`\n🔤 Capitalization Errors (${allErrorsByType.capitalization.length}):`);
            allErrorsByType.capitalization.forEach((error, i) => {
                console.log(`   ${i + 1}. ${error}`);
            });
        }
        
        // Array Count Errors
        if (allErrorsByType.arrayCount.length > 0) {
            console.log(`\n📊 Array Count Errors (${allErrorsByType.arrayCount.length}):`);
            allErrorsByType.arrayCount.forEach((error, i) => {
                console.log(`   ${i + 1}. ${error}`);
            });
        }
        
        // Page Number Validation Errors
        if (allErrorsByType.pageNumberValidation.length > 0) {
            console.log(`\n📄 Page Number Validation Errors (${allErrorsByType.pageNumberValidation.length}):`);
            allErrorsByType.pageNumberValidation.forEach((error, i) => {
                console.log(`   ${i + 1}. ${error}`);
            });
        }
        
        // Chapter Continuity Errors
        if (allErrorsByType.chapterContinuity.length > 0) {
            console.log(`\n📖 Chapter Continuity Errors (${allErrorsByType.chapterContinuity.length}):`);
            allErrorsByType.chapterContinuity.forEach((error, i) => {
                console.log(`   ${i + 1}. ${error}`);
            });
        }
        
        // Chunk Types Errors
        if (allErrorsByType.chunkTypes.length > 0) {
            console.log(`\n🧩 Chunk Types Errors (${allErrorsByType.chunkTypes.length}):`);
            allErrorsByType.chunkTypes.forEach((error, i) => {
                console.log(`   ${i + 1}. ${error}`);
            });
        }
        
        // Link Roles Errors
        if (allErrorsByType.linkRoles.length > 0) {
            console.log(`\n🔗 Link Roles Errors (${allErrorsByType.linkRoles.length}):`);
            allErrorsByType.linkRoles.forEach((error, i) => {
                console.log(`   ${i + 1}. ${error}`);
            });
        }
        
        // Link Matching Errors
        if (allErrorsByType.linkMatching.length > 0) {
            console.log(`\n🎯 Link Matching Errors (${allErrorsByType.linkMatching.length}):`);
            allErrorsByType.linkMatching.forEach((error, i) => {
                console.log(`   ${i + 1}. ${error}`);
            });
        }
    }

    if (totalWarnings > 0) {
        console.log('\n⚠️  VALIDATION WARNINGS:');
        [...chapterValidation.warnings, ...chunkValidation.warnings, ...linkValidation.warnings].forEach((warning, i) => {
            console.log(`   ${i + 1}. ${warning}`);
        });
    }

    if (validationResults.summary.isValid) {
        console.log('\n🎉 All validations passed! Pipeline output is valid.');
    } else {
        console.log('\n💥 Validation failed! Please review and fix the errors above.');
    }

    return {
        validationResults
    };
}

module.exports = { execute }; 