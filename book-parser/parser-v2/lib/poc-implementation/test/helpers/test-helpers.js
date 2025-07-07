/**
 * Test helper functions for POC implementation tests
 */

const fs = require('fs');
const path = require('path');
const { tmpdir } = require('os');
const assert = require('node:assert');

/**
 * Assert that content starts with expected text
 * @param {string} content - The content to check
 * @param {string} expectedStart - The expected beginning text
 * @param {string} message - Optional error message
 */
function assertStartsWith(content, expectedStart, message) {
    if (!content || typeof content !== 'string') {
        throw new Error(`${message || 'Content assertion failed'}: Content is not a string`);
    }
    
    if (!content.startsWith(expectedStart)) {
        throw new Error(`${message || 'Content assertion failed'}: Content does not start with expected text.\nExpected to start with: "${expectedStart}"\nActual start: "${content.substring(0, Math.min(100, content.length))}..."`);
    }
}

/**
 * Assert that content ends with expected text
 * @param {string} content - The content to check
 * @param {string} expectedEnd - The expected ending text
 * @param {string} message - Optional error message
 */
function assertEndsWith(content, expectedEnd, message) {
    if (!content || typeof content !== 'string') {
        throw new Error(`${message || 'Content assertion failed'}: Content is not a string`);
    }
    
    if (!content.endsWith(expectedEnd)) {
        throw new Error(`${message || 'Content assertion failed'}: Content does not end with expected text.\nExpected to end with: "${expectedEnd}"\nActual end: "...${content.substring(Math.max(0, content.length - 100))}"`);
    }
}

/**
 * Assert that content contains expected text
 * @param {string} content - The content to check
 * @param {string} expectedText - The expected text
 * @param {string} message - Optional error message
 */
function assertContains(content, expectedText, message) {
    if (!content || typeof content !== 'string') {
        throw new Error(`${message || 'Content assertion failed'}: Content is not a string`);
    }
    
    if (!content.includes(expectedText)) {
        throw new Error(`${message || 'Content assertion failed'}: Content does not contain expected text.\nExpected to contain: "${expectedText}"\nActual content length: ${content.length}`);
    }
}

/**
 * Assert that two numbers are approximately equal
 * @param {number} actual - The actual value
 * @param {number} expected - The expected value
 * @param {number} tolerance - The tolerance (default: 0.01)
 * @param {string} message - Optional error message
 */
function assertApproximatelyEqual(actual, expected, tolerance = 0.01, message) {
    if (Math.abs(actual - expected) > tolerance) {
        throw new Error(`${message || 'Approximate equality assertion failed'}: Expected ${expected}, got ${actual} (tolerance: ${tolerance})`);
    }
}

/**
 * Assert that an array is not empty
 * @param {Array} array - The array to check
 * @param {string} message - Optional error message
 */
function assertNotEmpty(array, message) {
    if (!Array.isArray(array) || array.length === 0) {
        throw new Error(`${message || 'Array assertion failed'}: Expected non-empty array, got ${Array.isArray(array) ? 'empty array' : typeof array}`);
    }
}

/**
 * Assert that a value is within a range
 * @param {number} value - The value to check
 * @param {number} min - Minimum value (inclusive)
 * @param {number} max - Maximum value (inclusive)
 * @param {string} message - Optional error message
 */
function assertInRange(value, min, max, message) {
    if (value < min || value > max) {
        throw new Error(`${message || 'Range assertion failed'}: Expected value between ${min} and ${max}, got ${value}`);
    }
}

/**
 * Assert that metadata has expected properties
 * @param {Object} metadata - The metadata object to check
 * @param {Array} expectedProperties - Array of expected property names
 * @param {string} message - Optional error message
 */
function assertMetadataProperties(metadata, expectedProperties, message) {
    if (!metadata || typeof metadata !== 'object') {
        throw new Error(`${message || 'Metadata assertion failed'}: Metadata is not an object`);
    }
    
    for (const prop of expectedProperties) {
        if (!(prop in metadata)) {
            throw new Error(`${message || 'Metadata assertion failed'}: Missing property "${prop}" in metadata`);
        }
    }
}

/**
 * Create a temporary directory for testing
 * @returns {string} - Path to temporary directory
 */
function createTempDir() {
    const tempPath = path.join(tmpdir(), 'book-parser-test-' + Date.now());
    fs.mkdirSync(tempPath, { recursive: true });
    return tempPath;
}

/**
 * Clean up temporary directory
 * @param {string} tempPath - Path to temporary directory
 */
function cleanupTempDir(tempPath) {
    try {
        fs.rmSync(tempPath, { recursive: true, force: true });
    } catch (error) {
        // Ignore cleanup errors
    }
}

/**
 * Create a mock config object for testing
 * @param {Object} overrides - Override properties
 * @returns {Object} - Mock config object
 */
function createMockConfig(overrides = {}) {
    const tempDir = createTempDir();
    return {
        INPUT_PDF: path.join(tempDir, 'test.pdf'),
        OUTPUT_DIR: path.join(tempDir, 'output'),
        DEBUG_DIR: path.join(tempDir, 'debug'),
        CHUNK_TARGET_MIN: 80,
        CHUNK_TARGET_MAX: 300,
        CHUNK_ABSOLUTE_MIN: 50,
        CHUNK_ABSOLUTE_MAX: 500,
        ...overrides
    };
}

/**
 * Create a mock pipeline state
 * @param {Object} overrides - Override properties
 * @returns {Object} - Mock pipeline state
 */
function createMockPipelineState(overrides = {}) {
    return {
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
        },
        ...overrides
    };
}

/**
 * Verify step output structure
 * @param {Object} result - The step result
 * @param {Array} expectedProperties - Expected properties in result
 * @param {string} stepName - Name of the step for error messages
 */
function verifyStepOutput(result, expectedProperties, stepName) {
    if (!result || typeof result !== 'object') {
        throw new Error(`${stepName}: Step result is not an object`);
    }
    
    for (const prop of expectedProperties) {
        if (!(prop in result)) {
            throw new Error(`${stepName}: Missing property "${prop}" in step result`);
        }
    }
    
    // All steps should update metadata
    if (!result.metadata || typeof result.metadata !== 'object') {
        throw new Error(`${stepName}: Step result must include metadata object`);
    }
}

/**
 * Mock fs.writeFileSync for testing
 * @returns {Object} - Mock implementation with tracking
 */
function mockWriteFileSync() {
    const originalWriteFileSync = fs.writeFileSync;
    const writtenFiles = new Map();
    
    const mockFn = (filePath, data, options) => {
        writtenFiles.set(filePath, { data, options });
        // Create directory if needed
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        // Actually write the file for debugging
        return originalWriteFileSync(filePath, data, options);
    };
    
    fs.writeFileSync = mockFn;
    
    return {
        restore: () => {
            fs.writeFileSync = originalWriteFileSync;
        },
        getWrittenFiles: () => writtenFiles,
        wasFileWritten: (filePath) => writtenFiles.has(filePath),
        getFileContent: (filePath) => writtenFiles.get(filePath)?.data
    };
}

module.exports = {
    assertStartsWith,
    assertEndsWith,
    assertContains,
    assertApproximatelyEqual,
    assertNotEmpty,
    assertInRange,
    assertMetadataProperties,
    createTempDir,
    cleanupTempDir,
    createMockConfig,
    createMockPipelineState,
    verifyStepOutput,
    mockWriteFileSync
}; 