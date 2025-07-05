#!/usr/bin/env node

/**
 * Example usage of the POC pipeline test
 * Demonstrates how to run the test programmatically
 */

const { runTests, TEST_RESULTS, TEST_CONFIG } = require('./test-poc-script.js');

async function example() {
    console.log('📋 POC Pipeline Test Example');
    console.log('============================');
    console.log();

    console.log('🔍 Test Configuration:');
    console.log(`Expected start text: "${TEST_CONFIG.EXPECTED_START_TEXT.substring(0, 50)}..."`);
    console.log(`Expected end text: "...${TEST_CONFIG.EXPECTED_END_TEXT.substring(TEST_CONFIG.EXPECTED_END_TEXT.length - 50)}"`);
    console.log();

    console.log('🚀 Running test...');
    console.log();

    try {
        // Run the test (this will exit the process)
        await runTests();
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    }
}

// Run example if called directly
if (require.main === module) {
    example();
}

module.exports = { example }; 