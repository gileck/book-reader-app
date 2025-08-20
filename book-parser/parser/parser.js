/**
 * Modular Book Parser - Main Module
 * 
 * This module provides a programmatic interface to run the complete parsing pipeline
 * on a PDF file and return the results as objects.
 * 
 * Usage:
 *   const parser = require('./parser.js');
 *   const result = await parser.parseBook(pdfPath, outputPath, options);
 */

const fs = require('fs');
const path = require('path');

// Import step implementations
const textExtraction = require('./steps/01-text-extraction/01-text-extraction');
const chapterDetection = require('./steps/02-1-chapter-detection/02-1-chapter-detection');
const chapterContentExtraction = require('./steps/02-2-chapter-content-extraction/02-2-chapter-content-extraction');
const chapterNameCleaning = require('./steps/02-3-chapter-name-cleaning/02-3-chapter-name-cleaning');
const pageExtractionAndCrossPageMerging = require('./steps/03-page-extraction-and-cross-page-merging/03-page-extraction-and-cross-page-merging');
const linkDetection = require('./steps/03-1-link-detection/03-1-link-detection');
const imageExtraction = require('./steps/03-2-image-extraction/03-2-image-extraction');
const paragraphDetection = require('./steps/04-paragraph-detection/04-paragraph-detection');
const sentenceDetection = require('./steps/05-sentence-detection/05-sentence-detection');
const imageMarkersToChunks = require('./steps/05-1-image-markers-to-chunks/05-1-image-markers-to-chunks');
const linkChunkReferences = require('./steps/05-2-link-chunk-references/05-2-link-chunk-references');
const metadataExtraction = require('./steps/06-metadata-extraction/06-metadata-extraction');

// Step execution mapping
const STEPS = {
    'step-1': textExtraction.execute,
    'step-2-1': chapterDetection.execute,
    'step-2-2': chapterContentExtraction.execute,
    'step-2-3': chapterNameCleaning.execute,
    'step-3': pageExtractionAndCrossPageMerging.execute,
    'step-3-1': linkDetection.execute,
    'step-3-2': imageExtraction.execute,
    'step-4': paragraphDetection.execute,
    'step-5': sentenceDetection.execute,
    'step-5-1': imageMarkersToChunks.execute,
    'step-5-2': linkChunkReferences.execute,
    'step-6': metadataExtraction.execute,
};

const STEP_NAMES = [
    'step-1',
    'step-2-1',
    'step-2-2',
    'step-2-3',
    'step-3',
    'step-3-1',
    'step-3-2',
    'step-4',
    'step-5',
    'step-5-1',
    'step-5-2',
    'step-6'
];

// Step validation mapping
const STEP_MODULES = {
    'step-1': textExtraction,
    'step-2-1': chapterDetection,
    'step-2-2': chapterContentExtraction,
    'step-2-3': chapterNameCleaning,
    'step-3': pageExtractionAndCrossPageMerging,
    'step-3-1': linkDetection,
    'step-3-2': imageExtraction,
    'step-4': paragraphDetection,
    'step-5': sentenceDetection,
    'step-5-1': imageMarkersToChunks,
    'step-5-2': linkChunkReferences,
    'step-6': metadataExtraction,
};

/**
 * Parse a book PDF through all pipeline steps
 * @param {string} pdfPath - Path to the PDF file
 * @param {string} outputPath - Path where output folder will be created
 * @param {Object} options - Parsing options
 * @param {boolean} options.validate - Whether to run validation (default: true)
 * @param {boolean} options.debug - Enable debug logging (default: false)
 * @returns {Object} - Complete parsing results with step-by-step outputs
 */
async function parseBook(pdfPath, outputPath, options = {}) {
    // Validate input
    if (!pdfPath || !fs.existsSync(pdfPath)) {
        throw new Error(`PDF file not found: ${pdfPath}`);
    }

    if (!outputPath) {
        throw new Error('Output path is required');
    }

    // Default options
    const opts = {
        validate: options.validate !== false, // default true
        debug: options.debug || false,
        ...options
    };

    // Create output folder structure
    const outputDir = path.resolve(outputPath);

    // Delete and recreate output folder if it exists
    if (fs.existsSync(outputDir)) {
        fs.rmSync(outputDir, { recursive: true, force: true });
    }

    fs.mkdirSync(outputDir, { recursive: true });

    // Create subfolders
    const stepsDir = path.join(outputDir, 'steps');
    const imagesDir = path.join(outputDir, 'images');

    fs.mkdirSync(stepsDir, { recursive: true });
    fs.mkdirSync(imagesDir, { recursive: true });

    // Create config object
    const config = {
        INPUT_PDF: pdfPath,
        PDF_PATH: pdfPath,
        OUTPUT_DIR: outputDir,
        DEBUG_DIR: path.join(outputDir, 'debug'),
        CHUNK_TARGET_MIN: opts.chunkTargetMin || 80,
        CHUNK_TARGET_MAX: opts.chunkTargetMax || 300,
        CHUNK_ABSOLUTE_MIN: opts.chunkAbsoluteMin || 50,
        CHUNK_ABSOLUTE_MAX: opts.chunkAbsoluteMax || 500
    };

    // Create debug directory
    if (!fs.existsSync(config.DEBUG_DIR)) {
        fs.mkdirSync(config.DEBUG_DIR, { recursive: true });
    }

    // Pipeline state to pass between steps
    let pipelineState = {
        rawText: null,
        chapterMetadata: [],
        chapters: [],
        mergedChapters: [],
        paragraphs: [],
        headers: [],
        chunks: [],
        pages: [],
        finalOutput: null,
        metadata: {
            processingStartTime: new Date().toISOString(),
            processingEndTime: null,
            stepResults: {}
        }
    };

    // Validation results
    const validationResults = {};

    const overallStartTime = Date.now();

    try {
        if (opts.debug) {
            console.log(`🚀 Starting book parsing for: ${pdfPath}`);
            console.log(`📁 Output directory: ${outputDir}`);
        }

        // Execute all steps in sequence
        for (const stepName of STEP_NAMES) {
            const stepStartTime = Date.now();

            if (opts.debug) {
                console.log(`Running ${stepName}...`);
            }

            try {
                // Execute step
                const stepFunction = STEPS[stepName];
                if (!stepFunction) {
                    throw new Error(`Unknown step: ${stepName}`);
                }

                let stepResult = await stepFunction(pipelineState, config);

                // Update pipeline state
                Object.assign(pipelineState, stepResult);

                const stepEndTime = Date.now();
                const stepDuration = stepEndTime - stepStartTime;

                // Always save individual step output to steps folder (even if validation fails afterward)
                try {
                    const stepOutputFile = path.join(stepsDir, `${stepName}.json`);
                    fs.writeFileSync(stepOutputFile, JSON.stringify(stepResult, null, 2));
                } catch (writeError) {
                    if (opts.debug) {
                        console.log(`⚠️  Failed to write ${stepName} output: ${writeError.message}`);
                    }
                }

                // Run validation if enabled and available
                let validationResult = null;
                if (opts.validate) {
                    const stepModule = STEP_MODULES[stepName];
                    if (stepModule && typeof stepModule.validate === 'function') {
                        try {
                            // Capture validation output for file logging
                            let validationOutput = '';
                            const originalConsoleError = console.error;
                            
                            console.error = (...args) => {
                                const message = args.join(' ');
                                validationOutput += message + '\n';
                                return originalConsoleError.apply(console, args);
                            };

                            // Run validation
                            let isValid = stepModule.validate(stepResult);
                            
                            // Restore console immediately
                            console.error = originalConsoleError;

                            // Handle skipped validation errors (if any)
                            if (!isValid) {
                                const skippedFile = path.join(path.dirname(outputDir), 'skipped-validation-errors.json');
                                if (fs.existsSync(skippedFile)) {
                                    try {
                                        const entries = JSON.parse(fs.readFileSync(skippedFile, 'utf8'));
                                        
                                        // Handle chunk-level skipping
                                        const skippedChunkIds = new Set(
                                            entries.filter(e => e?.step === stepName && typeof e?.chunkId === 'string')
                                                   .map(e => e.chunkId)
                                        );
                                        
                                        // Handle chapter-level skipping
                                        const skippedChapters = entries.filter(e => 
                                            e?.step === stepName && 
                                            (typeof e?.chapterNumber === 'number' || typeof e?.chapterTitle === 'string')
                                        );
                                        
                                        let shouldSkip = false;
                                        
                                        // Check chunk-level skipping
                                        if (skippedChunkIds.size > 0) {
                                            const chunkIds = [...validationOutput.matchAll(/(Text chunk|Paragraph chunk|Header|Sentence chunk)\s+(\d+_\d+)/g)]
                                                            .map(match => match[2]);
                                            
                                            if (chunkIds.length > 0 && chunkIds.every(id => skippedChunkIds.has(id))) {
                                                shouldSkip = true;
                                            }
                                        }
                                        
                                        // Check chapter-level skipping
                                        if (!shouldSkip && skippedChapters.length > 0) {
                                            for (const skip of skippedChapters) {
                                                if (skip.chapterNumber !== undefined) {
                                                    // Check if validation output mentions this chapter number
                                                    const chapterNumRegex = new RegExp(`Chapter\\s+${skip.chapterNumber}\\b`, 'i');
                                                    if (chapterNumRegex.test(validationOutput)) {
                                                        shouldSkip = true;
                                                        break;
                                                    }
                                                }
                                                if (skip.chapterTitle && !shouldSkip) {
                                                    // Check if validation output mentions this chapter title
                                                    if (validationOutput.includes(`"${skip.chapterTitle}"`)) {
                                                        shouldSkip = true;
                                                        break;
                                                    }
                                                }
                                            }
                                        }
                                        
                                        if (shouldSkip) {
                                            isValid = true;
                                        }
                                        
                                    } catch (_) { /* ignore errors reading skipped file */ }
                                }
                            }

                            // Write validation output to file if validation failed
                            if (!isValid && validationOutput.trim()) {
                                const validationOutputPath = path.join(outputDir, 'validation-output.txt');
                                const header = `\n==== ${stepName} validation output @ ${new Date().toISOString()} ====\n`;
                                fs.appendFileSync(validationOutputPath, header + validationOutput + '\n');
                            }

                            validationResult = {
                                passed: isValid,
                                error: isValid ? null : 'Validation failed',
                                timestamp: new Date().toISOString(),
                                duration: Date.now() - stepEndTime
                            };

                            if (!isValid) {
                                throw new Error(`Step ${stepName} validation failed`);
                            }
                        } catch (validationError) {
                            validationResult = {
                                passed: false,
                                error: validationError.message,
                                timestamp: new Date().toISOString(),
                                duration: Date.now() - stepEndTime
                            };
                            throw validationError;
                        }
                    }
                }

                // Store validation result
                validationResults[stepName] = validationResult;

                if (opts.debug) {
                    console.log(`✓ ${stepName} completed (${stepDuration}ms)${validationResult?.passed ? ' [validated]' : ''}`);
                }

            } catch (error) {
                const stepEndTime = Date.now();
                const stepDuration = stepEndTime - stepStartTime;

                // Store validation failure if it was a validation error
                if (!validationResults[stepName]) {
                    validationResults[stepName] = {
                        passed: false,
                        error: error.message,
                        timestamp: new Date().toISOString(),
                        duration: stepDuration
                    };
                }

                // Best-effort: if we have a stepResult available in scope, write it for debugging
                try {
                    if (typeof stepResult !== 'undefined') {
                        const stepOutputFile = path.join(stepsDir, `${stepName}.json`);
                        fs.writeFileSync(stepOutputFile, JSON.stringify(stepResult, null, 2));
                    }
                } catch (_) {
                    // ignore write failures in error path
                }

                if (opts.debug) {
                    console.log(`✗ ${stepName} failed (${stepDuration}ms): ${error.message}`);
                }

                throw error;
            }
        }

        // Pipeline completed successfully
        const overallEndTime = Date.now();
        const totalDuration = overallEndTime - overallStartTime;

        pipelineState.metadata.processingEndTime = new Date().toISOString();

        // Create simplified output with only chapters and basic metadata
        // Strip transient chapter.content (concatenated text/markers) from final output
        const chaptersForOutput = (pipelineState.chapters || []).map(chapter => {
            const { content, ...rest } = chapter;
            // Strip debug-only fields from image chunks
            if (Array.isArray(rest.chunks)) {
                rest.chunks = rest.chunks.map(chunk => {
                    if (chunk && chunk.type === 'image') {
                        const cleaned = { ...chunk };
                        delete cleaned.originalName;
                        delete cleaned.extracted;
                        delete cleaned.placeholder;
                        return cleaned;
                    }
                    return chunk;
                });
            }
            return rest;
        });
        const simplifiedOutput = {
            chapters: chaptersForOutput,
            metadata: {
                title: pipelineState.metadata?.title || pipelineState.metadata?.bookTitle || 'Unknown Title',
                author: pipelineState.metadata?.author || pipelineState.metadata?.bookAuthor || 'Unknown Author'
            }
        };

        // Save output.json with ONLY chapters and basic metadata
        const outputJsonPath = path.join(outputDir, 'output.json');
        fs.writeFileSync(outputJsonPath, JSON.stringify(simplifiedOutput, null, 2));

        // Save validation.json with all validation results
        const validationJsonPath = path.join(outputDir, 'validation.json');
        const validationSummary = {
            metadata: {
                totalDuration: totalDuration,
                timestamp: new Date().toISOString(),
                success: true,
                totalSteps: STEP_NAMES.length,
                validatedSteps: Object.keys(validationResults).filter(step => validationResults[step]?.passed).length,
                failedSteps: Object.keys(validationResults).filter(step => validationResults[step] && !validationResults[step].passed).length
            },
            steps: validationResults
        };
        fs.writeFileSync(validationJsonPath, JSON.stringify(validationSummary, null, 2));

        if (opts.debug) {
            console.log(`✅ Pipeline completed successfully in ${totalDuration}ms`);
            console.log(`💾 Final output saved to: ${outputJsonPath}`);
            console.log(`🔍 Validation results saved to: ${validationJsonPath}`);
            console.log(`📁 Step outputs saved to: ${stepsDir}`);
            console.log(`🖼️  Images saved to: ${imagesDir}`);
        }

        return {
            success: true,
            outputDir: outputDir,
            finalOutput: pipelineState,
            validationResults: validationSummary,
            totalDuration: totalDuration
        };

    } catch (error) {
        const overallEndTime = Date.now();
        const totalDuration = overallEndTime - overallStartTime;

        // Save validation.json with error information
        const validationJsonPath = path.join(outputDir, 'validation.json');
        const validationSummary = {
            metadata: {
                totalDuration: totalDuration,
                timestamp: new Date().toISOString(),
                success: false,
                error: error.message,
                totalSteps: STEP_NAMES.length,
                validatedSteps: Object.keys(validationResults).filter(step => validationResults[step]?.passed).length,
                failedSteps: Object.keys(validationResults).filter(step => validationResults[step] && !validationResults[step].passed).length
            },
            steps: validationResults
        };
        fs.writeFileSync(validationJsonPath, JSON.stringify(validationSummary, null, 2));

        if (opts.debug) {
            console.log(`❌ Pipeline failed after ${totalDuration}ms: ${error.message}`);
        }

        throw error;
    }
}

/**
 * Parse a book PDF through specific steps only
 * @param {string} pdfPath - Path to the PDF file
 * @param {string} outputPath - Path where output folder will be created
 * @param {Array<string>} stepNames - Array of step names to execute
 * @param {Object} options - Parsing options (same as parseBook)
 * @returns {Object} - Parsing results for specified steps
 */
async function parseBookSteps(pdfPath, outputPath, stepNames, options = {}) {
    // Validate step names
    const invalidSteps = stepNames.filter(step => !STEPS[step]);
    if (invalidSteps.length > 0) {
        throw new Error(`Invalid step names: ${invalidSteps.join(', ')}`);
    }

    // Validate step order (steps must be in correct sequence)
    const stepIndices = stepNames.map(step => STEP_NAMES.indexOf(step));
    for (let i = 1; i < stepIndices.length; i++) {
        if (stepIndices[i] <= stepIndices[i - 1]) {
            throw new Error(`Steps must be in correct order. Invalid sequence: ${stepNames.join(' -> ')}`);
        }
    }

    // For partial execution, we need to run all steps up to the last requested step
    const lastStepIndex = Math.max(...stepIndices);
    const stepsToRun = STEP_NAMES.slice(0, lastStepIndex + 1);

    // Run all required steps
    return await parseBook(pdfPath, outputPath, options);
}

/**
 * Get available step names
 * @returns {Array<string>} - Array of available step names
 */
function getAvailableSteps() {
    return [...STEP_NAMES];
}

/**
 * Get step descriptions
 * @returns {Object} - Object mapping step names to descriptions
 */
function getStepDescriptions() {
    return {
        'step-1': 'Extract raw text from PDF (with validation)',
        'step-2-1': 'Detect chapter boundaries from Table of Contents (with validation)',
        'step-2-2': 'Extract and clean chapter content (with validation)',
        'step-2-3': 'Clean chapter names/titles from beginning of chapter content (with validation)',
        'step-3': 'Extract and clean individual pages + merge split sentences across pages (with validation)',
        'step-3-1': 'Detect and resolve internal links from PDF annotations (with validation)',
        'step-3-2': 'Extract embedded images from PDF and map to pages (with validation)',
        'step-4': 'Detect paragraph boundaries with size optimization (with validation)',
        'step-5': 'Convert paragraphs to sentences with paragraph indexing (with validation)',
        'step-5-1': 'Add chunk references to links for bidirectional navigation (with validation)',
        'step-6': 'Extract and clean metadata from PDF (with validation)'
    };
}

module.exports = {
    parseBook,
    parseBookSteps,
    getAvailableSteps,
    getStepDescriptions
}; 