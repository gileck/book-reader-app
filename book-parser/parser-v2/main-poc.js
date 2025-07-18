/**
 * Modular Book Parser - Main Module
 * 
 * This module provides a programmatic interface to run the complete parsing pipeline
 * on a PDF file and return the results as objects.
 * 
 * Usage:
 *   const parser = require('./main-poc.js');
 *   const result = await parser.parseBook(pdfPath, options);
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
};

const STEP_NAMES = [
    'step-1',
    'step-2-1',
    'step-2-2',
    'step-2-3',
    'step-3',
    'step-3-1',
    'step-3-2',
    'step-4'
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
};

/**
 * Parse a book PDF through all pipeline steps
 * @param {string} pdfPath - Path to the PDF file
 * @param {Object} options - Parsing options
 * @param {string} options.outputDir - Directory for output files (images, debug) 
 * @param {string} options.debugDir - Directory for debug files
 * @param {boolean} options.validate - Whether to run validation (default: true)
 * @param {boolean} options.debug - Enable debug logging (default: false)
 * @param {boolean} options.saveStepOutputs - Save individual step outputs to files (default: false)
 * @returns {Object} - Complete parsing results with step-by-step outputs
 */
async function parseBook(pdfPath, options = {}) {
    // Validate input
    if (!pdfPath || !fs.existsSync(pdfPath)) {
        throw new Error(`PDF file not found: ${pdfPath}`);
    }

    // Default options
    const opts = {
        outputDir: options.outputDir || path.join(path.dirname(pdfPath), 'parser-output'),
        debugDir: options.debugDir || path.join(path.dirname(pdfPath), 'parser-debug'),
        validate: options.validate !== false, // default true
        debug: options.debug || false,
        saveStepOutputs: options.saveStepOutputs || false,
        ...options
    };

    // Create config object
    const config = {
        INPUT_PDF: pdfPath,
        PDF_PATH: pdfPath,
        OUTPUT_DIR: opts.outputDir,
        DEBUG_DIR: opts.debugDir,
        CHUNK_TARGET_MIN: opts.chunkTargetMin || 80,
        CHUNK_TARGET_MAX: opts.chunkTargetMax || 300,
        CHUNK_ABSOLUTE_MIN: opts.chunkAbsoluteMin || 50,
        CHUNK_ABSOLUTE_MAX: opts.chunkAbsoluteMax || 500
    };

    // Ensure output directories exist
    const dirsToCreate = [config.OUTPUT_DIR, config.DEBUG_DIR];

    // Add steps-output directory if saving step outputs
    if (opts.saveStepOutputs) {
        dirsToCreate.push(path.join(config.OUTPUT_DIR, 'steps-output'));
    }

    dirsToCreate.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });

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

    // Results object to store step-by-step outputs
    const results = {
        metadata: {
            pdfPath: pdfPath,
            options: opts,
            startTime: new Date().toISOString(),
            endTime: null,
            totalDuration: 0,
            stepCount: STEP_NAMES.length,
            success: false
        },
        steps: {},
        finalOutput: null
    };

    const overallStartTime = Date.now();

    try {
        if (opts.debug) {
            console.log(`🚀 Starting book parsing for: ${pdfPath}`);
            console.log(`📁 Output directory: ${config.OUTPUT_DIR}`);
            console.log(`🐛 Debug directory: ${config.DEBUG_DIR}`);
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

                const stepResult = await stepFunction(pipelineState, config);

                // Update pipeline state
                Object.assign(pipelineState, stepResult);

                const stepEndTime = Date.now();
                const stepDuration = stepEndTime - stepStartTime;

                // Run validation if enabled and available
                let validationResult = null;
                if (opts.validate) {
                    const stepModule = STEP_MODULES[stepName];
                    if (stepModule && typeof stepModule.validate === 'function') {
                        try {
                            const isValid = stepModule.validate(stepResult);
                            validationResult = {
                                passed: isValid,
                                error: null
                            };

                            if (!isValid) {
                                throw new Error(`Step ${stepName} validation failed`);
                            }
                        } catch (validationError) {
                            validationResult = {
                                passed: false,
                                error: validationError.message
                            };
                            throw validationError;
                        }
                    }
                }

                // Store step result
                results.steps[stepName] = {
                    success: true,
                    duration: stepDuration,
                    timestamp: new Date().toISOString(),
                    validation: validationResult,
                    output: stepResult
                };

                // Save individual step output to file if enabled
                if (opts.saveStepOutputs) {
                    const stepOutputFile = path.join(config.OUTPUT_DIR, 'steps-output', `${stepName}.json`);
                    fs.writeFileSync(stepOutputFile, JSON.stringify(stepResult, null, 2));
                }

                if (opts.debug) {
                    console.log(`✓ ${stepName} completed (${stepDuration}ms)${validationResult?.passed ? ' [validated]' : ''}`);
                }

            } catch (error) {
                const stepEndTime = Date.now();
                const stepDuration = stepEndTime - stepStartTime;

                // Store step failure
                results.steps[stepName] = {
                    success: false,
                    duration: stepDuration,
                    timestamp: new Date().toISOString(),
                    error: error.message,
                    output: null
                };

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

        results.metadata.endTime = new Date().toISOString();
        results.metadata.totalDuration = totalDuration;
        results.metadata.success = true;

        // Final output should be the output of the last step
        const lastStepName = STEP_NAMES[STEP_NAMES.length - 1];
        results.finalOutput = results.steps[lastStepName]?.output || pipelineState;

        if (opts.debug) {
            console.log(`✅ Pipeline completed successfully in ${totalDuration}ms`);
        }

        return results;

    } catch (error) {
        const overallEndTime = Date.now();
        const totalDuration = overallEndTime - overallStartTime;

        results.metadata.endTime = new Date().toISOString();
        results.metadata.totalDuration = totalDuration;
        results.metadata.success = false;
        results.metadata.error = error.message;

        if (opts.debug) {
            console.log(`❌ Pipeline failed after ${totalDuration}ms: ${error.message}`);
        }

        throw error;
    }
}

/**
 * Parse a book PDF through specific steps only
 * @param {string} pdfPath - Path to the PDF file
 * @param {Array<string>} stepNames - Array of step names to execute
 * @param {Object} options - Parsing options (same as parseBook)
 * @returns {Object} - Parsing results for specified steps
 */
async function parseBookSteps(pdfPath, stepNames, options = {}) {
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

    // Run all required steps but only return requested ones
    const fullResults = await parseBook(pdfPath, options);

    const filteredResults = {
        ...fullResults,
        steps: {}
    };

    // Only include requested steps in results
    stepNames.forEach(stepName => {
        if (fullResults.steps[stepName]) {
            filteredResults.steps[stepName] = fullResults.steps[stepName];
        }
    });

    return filteredResults;
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
        'step-4': 'Detect paragraph boundaries with size optimization (with validation)'
    };
}

module.exports = {
    parseBook,
    parseBookSteps,
    getAvailableSteps,
    getStepDescriptions
}; 