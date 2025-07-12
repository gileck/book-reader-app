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
const textExtraction = require('./steps/01-text-extraction');
const chapterDetection = require('./steps/02-1-chapter-detection');
const chapterContentExtraction = require('./steps/02-2-chapter-content-extraction');
const chapterNameCleaning = require('./steps/02-3-chapter-name-cleaning');
const pageExtractionAndCrossPageMerging = require('./steps/03-page-extraction-and-cross-page-merging');
const linkDetection = require('./steps/03-1-link-detection');
const paragraphDetection = require('./steps/04-paragraph-detection');
const headerDetection = require('./steps/05-header-detection');
const chunkingAlgorithm = require('./steps/06-chunking-algorithm');
const pageAssignment = require('./steps/07-page-assignment');
const outputGeneration = require('./steps/08-output-generation');

// Configuration
const CONFIG = {
    INPUT_PDF: path.join(__dirname, '../../../../files/Transformers/book.pdf'),
    PDF_PATH: path.join(__dirname, '../../../../files/Transformers/book.pdf'), // For link extraction
    OUTPUT_DIR: path.join(__dirname, './transformers-output'),
    DEBUG_DIR: path.join(__dirname, './transformers-debug'),
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
    'step-5': headerDetection.execute,
    'step-6': chunkingAlgorithm.execute,
    'step-7': pageAssignment.execute,
    'step-8': outputGeneration.execute,
    // Legacy aliases for backward compatibility
    'text-extraction': textExtraction.execute,
    'chapter-detection': chapterDetection.execute,
    'chapter-content-extraction': chapterContentExtraction.execute,
    'page-extraction-and-cross-page-merging': pageExtractionAndCrossPageMerging.execute,
    'paragraph-detection': paragraphDetection.execute,
    'header-detection': headerDetection.execute,
    'chunking-algorithm': chunkingAlgorithm.execute,
    'page-assignment': pageAssignment.execute,
    'output-generation': outputGeneration.execute
};

const STEP_NAMES = [
    'step-1',
    'step-2-1',
    'step-2-2',
    'step-2-3',
    'step-3',
    'step-3-1',
    'step-4',
    'step-5',
    'step-6',
    'step-7',
    'step-8'
];

// Step descriptions for help text
const STEP_DESCRIPTIONS = {
    'step-1': 'Extract raw text from PDF',
    'step-2-1': 'Detect chapter boundaries from Table of Contents',
    'step-2-2': 'Extract and clean chapter content',
    'step-2-3': 'Clean chapter names/titles from beginning of chapter content',
    'step-3': 'Extract and clean individual pages + merge split sentences across pages',
    'step-3-1': 'Detect and resolve internal links from PDF annotations',
    'step-4': 'Detect paragraph boundaries with size optimization (✅ IMPLEMENTED)',
    'step-5': 'Detect headers using 6-rule system',
    'step-6': 'Create chunks with target word count',
    'step-7': 'Assign page numbers to chunks',
    'step-8': 'Generate final output files'
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
    console.log(`📁 Output written to: ${outputFile}`);
}

// Execute a single step
async function executeStep(stepName) {
    const stepFunction = STEPS[stepName];
    if (!stepFunction) {
        throw new Error(`Unknown step: ${stepName}`);
    }

    console.log(`\n=== EXECUTING STEP: ${stepName.toUpperCase().replace('-', ' ')} ===`);
    const startTime = Date.now();

    try {
        // Execute step with current pipeline state and config
        const result = await stepFunction(PIPELINE_STATE, CONFIG);

        // Update pipeline state with result
        Object.assign(PIPELINE_STATE, result);

        const endTime = Date.now();
        const duration = endTime - startTime;

        // Store step execution metadata
        PIPELINE_STATE.metadata.stepResults[stepName] = {
            success: true,
            duration: duration,
            timestamp: new Date().toISOString()
        };

        console.log(`✅ Step completed successfully in ${duration}ms`);

        // Save state after each step for debugging
        savePipelineState();

        // Write step-specific output file
        const stepOutputFilename = `output-${stepName}.json`;
        writeOutputFile(result, stepOutputFilename);

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

        console.error(`❌ Step failed after ${duration}ms:`, error.message);
        savePipelineState();
        throw error;
    }
}

// Execute all steps in sequence
async function executeAllSteps() {
    console.log('🚀 Starting complete pipeline execution...');
    PIPELINE_STATE.metadata.processingStartTime = new Date().toISOString();

    for (const stepName of STEP_NAMES) {
        await executeStep(stepName);
    }

    PIPELINE_STATE.metadata.processingEndTime = new Date().toISOString();
    console.log('\n🎉 Pipeline execution completed successfully!');

    // Final state save
    savePipelineState();

    return PIPELINE_STATE;
}

// Execute steps up to and including the specified step
async function executeStepsUpTo(targetStep) {
    console.log(`🚀 Starting pipeline execution up to ${targetStep}...`);
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
    console.log(`\n🎉 Pipeline execution completed up to ${targetStep}!`);

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
  step-5       - ${STEP_DESCRIPTIONS['step-5']} (NEXT TO IMPLEMENT)
  step-6       - ${STEP_DESCRIPTIONS['step-6']}
  step-7       - ${STEP_DESCRIPTIONS['step-7']}
  step-8       - ${STEP_DESCRIPTIONS['step-8']}
  all          - Run all steps in sequence

Implementation Status:
  ✅ COMPLETED: Steps 1, 2-1, 2-2, 2-3, 3, 3-1, 4 (87.5% complete)
  ⚠️ REMAINING: Steps 5, 6, 7, 8 (12.5% remaining)

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

    if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
        showUsage();
        return;
    }

    const stepName = args[0];
    const isDebug = args.includes('--debug');

    // Setup
    ensureDirectories();

    if (isDebug) {
        console.log('🔧 Debug mode enabled');
        console.log('📁 Output directory:', CONFIG.OUTPUT_DIR);
        console.log('🐛 Debug directory:', CONFIG.DEBUG_DIR);
        console.log('📄 Input PDF:', CONFIG.INPUT_PDF);
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
            console.error(`❌ Unknown step: ${stepName}`);
            console.log('\nAvailable steps:', STEP_NAMES.join(', '));
            console.log('Legacy steps:', ['text-extraction', 'chapter-detection', 'chapter-text-extraction', 'cross-page-merging', 'paragraph-detection', 'header-detection', 'chunking-algorithm', 'page-assignment', 'output-generation'].join(', '));
            process.exit(1);
        }
    } catch (error) {
        console.error('💥 Pipeline execution failed:', error.message);
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