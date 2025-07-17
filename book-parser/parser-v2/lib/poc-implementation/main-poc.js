#!/usr/bin/env node

/**
 * Modular Book Parser POC - Main Script
 * 
 * This script orchestrates the complete parsing pipeline by running each step
 * sequentially and passing data between them. Each step is implemented in a 
 * separate module for better organization and maintainability.
 * 
 * Usage:
 *   node main-poc.js [step] [--debug]
 * 
 * Steps:
 *   step-1    - text-extraction
 *   step-2    - chapter-detection-and-text-extraction (NEW)
 *   step-3    - page-extraction-and-cross-page-merging (NEW)
 *   step-3-1  - link-detection (NEW)
 *   step-4    - paragraph-detection
 *   step-5    - header-detection
 *   step-6    - chunking-algorithm
 *   step-7    - page-assignment
 *   step-8    - output-generation
 *   all       - run all steps
 *
 * Usage examples:
 *   node main-poc.js step-3     # runs step-1, step-2, step-3 and writes output.json
 *   node main-poc.js all        # runs all steps
 *   node main-poc.js step-1     # runs only step-1
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
const paragraphDetection = require('./steps/04-paragraph-detection/04-paragraph-detection');

// Configuration
const CONFIG = {
    INPUT_PDF: '/Users/gileck/projects/temp1/files/Transformers/book.pdf',
    PDF_PATH: '/Users/gileck/projects/temp1/files/Transformers/book.pdf',
    OUTPUT_DIR: '/Users/gileck/projects/temp1/book-parser/parser-v2/lib/poc-implementation/transformers-output',
    DEBUG_DIR: '/Users/gileck/projects/temp1/book-parser/parser-v2/lib/poc-implementation/transformers-debug',
    CHUNK_TARGET_MIN: 80,
    CHUNK_TARGET_MAX: 300,
    CHUNK_ABSOLUTE_MIN: 50,
    CHUNK_ABSOLUTE_MAX: 500
};

// Pipeline state to pass between steps
let PIPELINE_STATE = {
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
        processingStartTime: null,
        processingEndTime: null,
        stepResults: {}
    }
};

// Step execution mapping
const STEPS = {
    'step-1': textExtraction.execute,
    'step-2-1': chapterDetection.execute,
    'step-2-2': chapterContentExtraction.execute,
    'step-2-3': chapterNameCleaning.execute,
    'step-3': pageExtractionAndCrossPageMerging.execute,
    'step-3-1': linkDetection.execute,
    'step-4': paragraphDetection.execute,
};

const STEP_NAMES = [
    'step-1',
    'step-2-1',
    'step-2-2',
    'step-2-3',
    'step-3',
    'step-3-1',
    'step-4'
];

// Step descriptions for help text
const STEP_DESCRIPTIONS = {
    'step-1': 'Extract raw text from PDF (with validation)',
    'step-2-1': 'Detect chapter boundaries from Table of Contents (with validation)',
    'step-2-2': 'Extract and clean chapter content (with validation)',
    'step-2-3': 'Clean chapter names/titles from beginning of chapter content (with validation)',
    'step-3': 'Extract and clean individual pages + merge split sentences across pages (with validation)',
    'step-3-1': 'Detect and resolve internal links from PDF annotations (with validation)',
    'step-4': 'Detect paragraph boundaries with size optimization (✅ IMPLEMENTED with validation)'
};

// Ensure output directories exist
function ensureDirectories() {
    [CONFIG.OUTPUT_DIR, CONFIG.DEBUG_DIR].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });
}

// Save pipeline state to file
function savePipelineState() {
    const stateFile = path.join(CONFIG.DEBUG_DIR, 'pipeline-state.json');
    fs.writeFileSync(stateFile, JSON.stringify(PIPELINE_STATE, null, 2));
}

// Write output to output.json file
function writeOutputFile(outputData, filename = 'output.json') {
    const outputFile = path.join(CONFIG.OUTPUT_DIR, filename);
    fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2));
}

// Execute a single step
async function executeStep(stepName) {
    const stepFunction = STEPS[stepName];
    if (!stepFunction) {
        throw new Error(`Unknown step: ${stepName}`);
    }

    console.log(`Running ${stepName}...`);
    const startTime = Date.now();

    try {
        // Execute step with current pipeline state and config
        const result = await stepFunction(PIPELINE_STATE, CONFIG);

        // Get the step module to check if it has a validate function
        let stepModule;
        switch(stepName) {
            case 'step-1': stepModule = textExtraction; break;
            case 'step-2-1': stepModule = chapterDetection; break;
            case 'step-2-2': stepModule = chapterContentExtraction; break;
            case 'step-2-3': stepModule = chapterNameCleaning; break;
            case 'step-3': stepModule = pageExtractionAndCrossPageMerging; break;
            case 'step-3-1': stepModule = linkDetection; break;
            case 'step-4': stepModule = paragraphDetection; break;
        }

        // Update pipeline state with result
        Object.assign(PIPELINE_STATE, result);

        const endTime = Date.now();
        const duration = endTime - startTime;

        // Save state after each step for debugging
        savePipelineState();

        // Write step-specific output file
        const stepOutputFilename = `output-${stepName}.json`;
        writeOutputFile(result, stepOutputFilename);

        // Run validation if the step has a validate function
        if (stepModule && typeof stepModule.validate === 'function') {
            // Capture any console.error messages during validation
            const originalConsoleError = console.error;
            let validationError = null;
            console.error = (message) => {
                validationError = message;
                originalConsoleError(message);
            };
            
            const isValid = stepModule.validate(result);
            console.error = originalConsoleError; // Restore original console.error
            
            if (!isValid) {
                console.log(`✗ ${stepName} validation failed${validationError ? ': ' + validationError : ''}`);
                throw new Error(`Step ${stepName} validation failed`);
            } else {
                console.log(`✓ ${stepName} validation passed`);
            }
        }

        // Store step execution metadata
        PIPELINE_STATE.metadata.stepResults[stepName] = {
            success: true,
            duration: duration,
            timestamp: new Date().toISOString()
        };

        console.log(`✓ ${stepName} completed (${duration}ms)`);

        return result;
    } catch (error) {
        const endTime = Date.now();
        const duration = endTime - startTime;

        // Store step execution metadata with error
        PIPELINE_STATE.metadata.stepResults[stepName] = {
            success: false,
            duration: duration,
            timestamp: new Date().toISOString(),
            error: error.message
        };

        console.log(`✗ ${stepName} failed (${duration}ms): ${error.message}`);
        savePipelineState();
        throw error;
    }
}

// Execute all steps in sequence
async function executeAllSteps() {
    console.log('Starting pipeline...');
    PIPELINE_STATE.metadata.processingStartTime = new Date().toISOString();

    for (const stepName of STEP_NAMES) {
        await executeStep(stepName);
    }

    PIPELINE_STATE.metadata.processingEndTime = new Date().toISOString();
    console.log('Pipeline completed successfully!');

    // Final state save
    savePipelineState();

    return PIPELINE_STATE;
}

// Execute steps up to and including the specified step
async function executeStepsUpTo(targetStep) {
    console.log(`Starting pipeline up to ${targetStep}...`);
    PIPELINE_STATE.metadata.processingStartTime = new Date().toISOString();

    const targetIndex = STEP_NAMES.indexOf(targetStep);
    if (targetIndex === -1) {
        throw new Error(`Unknown step: ${targetStep}`);
    }

    const stepsToRun = STEP_NAMES.slice(0, targetIndex + 1);

    for (const stepName of stepsToRun) {
        await executeStep(stepName);
    }

    PIPELINE_STATE.metadata.processingEndTime = new Date().toISOString();
    console.log(`Pipeline completed up to ${targetStep}!`);

    // Final state save
    savePipelineState();

    // Write final complete output file
    writeOutputFile(PIPELINE_STATE, 'output.json');

    return PIPELINE_STATE;
}

// Show usage information
function showUsage() {
    console.log(`
Modular Book Parser POC

Usage:
  node main-poc.js [step] [--debug]

Available steps:
  step-1       - ${STEP_DESCRIPTIONS['step-1']}
  step-2-1     - ${STEP_DESCRIPTIONS['step-2-1']}
  step-2-2     - ${STEP_DESCRIPTIONS['step-2-2']}
  step-2-3     - ${STEP_DESCRIPTIONS['step-2-3']}
  step-3       - ${STEP_DESCRIPTIONS['step-3']}
  step-3-1     - ${STEP_DESCRIPTIONS['step-3-1']}
  step-4       - ${STEP_DESCRIPTIONS['step-4']}
  all          - Run all steps in sequence

Implementation Status:
  ✅ COMPLETED: All core steps (1, 2-1, 2-2, 2-3, 3, 3-1, 4) with per-step validation
  🎯 PRODUCTION-READY: Complete book parsing pipeline with fail-fast validation

Step execution modes:
  • Single step: node main-poc.js step-1
  • Up to step: node main-poc.js step-4 
    (runs steps 1 through 4 and writes output.json)
  • All steps: node main-poc.js all

Options:
  --debug      - Enable detailed debug output

Examples:
  node main-poc.js all
  node main-poc.js step-1
  node main-poc.js step-4 --debug
  node main-poc.js step-5
`);
}

// Main execution
async function main() {
    const args = process.argv.slice(2);

    if (args.includes('--help') || args.includes('-h')) {
        showUsage();
        return;
    }

    const stepName = args.length === 0 ? 'all' : args[0];
    const isDebug = args.includes('--debug');

    // Setup
    ensureDirectories();

    if (isDebug) {
        console.log('Debug mode enabled');
    }

    try {
        if (stepName === 'all') {
            await executeAllSteps();
        } else if (STEP_NAMES.includes(stepName)) {
            // New step naming convention - run all steps up to and including the target step
            await executeStepsUpTo(stepName);
        } else if (STEPS[stepName]) {
            // Legacy step naming or single step execution
            await executeStep(stepName);
        } else {
            console.log(`Unknown step: ${stepName}`);
            console.log('Available steps:', STEP_NAMES.join(', '));
            process.exit(1);
        }
    } catch (error) {
        console.log('Pipeline failed:', error.message);
        if (isDebug) {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

// Execute if called directly
if (require.main === module) {
    main();
}

module.exports = {
    executeStep,
    executeAllSteps,
    CONFIG,
    PIPELINE_STATE
}; 