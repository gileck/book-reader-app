/**
 * Local Runner for Parser
 * 
 * This runner maintains the existing CLI/local file system behavior.
 * It uses file-based skip errors (skipped-validation-errors.json) and console logging.
 * 
 * Usage:
 *   const { runLocalParser } = require('./runners/localRunner');
 *   const result = await runLocalParser(pdfPath, outputPath, options);
 */

const fs = require('fs');
const path = require('path');
const parser = require('../parser');

/**
 * Run parser with local/CLI configuration
 * @param {string} pdfPath - Path to the PDF file
 * @param {string} outputPath - Path where output folder will be created
 * @param {Object} options - Parsing options (same as parser options)
 * @returns {Object} - Complete parsing results
 */
async function runLocalParser(pdfPath, outputPath, options = {}) {
    // Skip errors provider reads from local file, filtered by step
    const skipErrorsProvider = async (stepName) => {
        const skippedFile = path.join(path.dirname(outputPath), 'skipped-validation-errors.json');
        if (fs.existsSync(skippedFile)) {
            try {
                const allSkipErrors = JSON.parse(fs.readFileSync(skippedFile, 'utf8'));
                // Filter to only return errors for the current step
                return allSkipErrors.filter(err => err.step === stepName);
            } catch (error) {
                console.warn(`⚠️  Failed to read skipped-validation-errors.json: ${error.message}`);
                return [];
            }
        }
        return [];
    };

    // Simple console logging for step start
    const onStepStart = (stepName, stepNumber, totalSteps) => {
        if (options.debug || options.verbose) {
            console.log(`\n[${stepNumber}/${totalSteps}] Starting ${stepName}...`);
        }
    };

    // Progress updates (optional, for verbose mode)
    const onStepProgress = (stepName, percentage) => {
        if (options.verbose) {
            console.log(`  ${stepName}: ${percentage}%`);
        }
    };

    // Step completion logging
    const onStepComplete = (stepName, result) => {
        if (options.debug || options.verbose) {
            console.log(`  ✓ ${stepName} completed`);
        }
    };

    // Run parser with local callbacks
    return await parser.parseBook(pdfPath, outputPath, {
        ...options,
        skipErrorsProvider,
        onStepStart,
        onStepProgress,
        onStepComplete
        // Note: onValidationError is not set, so it falls back to file-based behavior
    });
}

module.exports = {
    runLocalParser
};

