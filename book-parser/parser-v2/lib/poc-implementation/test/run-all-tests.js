#!/usr/bin/env node

/**
 * Test Runner for POC Implementation
 * 
 * Runs all step tests and provides a summary report
 */

const { spawn } = require('child_process');
const path = require('path');

const TEST_FILES = [
    '01-text-extraction.test.js',
    '02-1-chapter-detection.test.js', 
    '02-2-chapter-content-extraction.test.js',
    '03-page-extraction-and-cross-page-merging.test.js',
    '04-paragraph-detection.test.js',
    '05-header-detection.test.js',
    '06-chunking-algorithm.test.js',
    '07-page-assignment.test.js',
    '08-output-generation.test.js'
];

async function runTest(testFile) {
    return new Promise((resolve, reject) => {
        const testPath = path.join(__dirname, 'step-tests', testFile);
        const child = spawn('node', ['--test', testPath], {
            stdio: 'pipe',
            cwd: __dirname
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        child.on('close', (code) => {
            resolve({
                testFile,
                code,
                stdout,
                stderr,
                success: code === 0
            });
        });

        child.on('error', (error) => {
            reject(error);
        });
    });
}

async function runAllTests() {
    console.log('🚀 Running POC Implementation Tests\n');
    
    const results = [];
    let passedTests = 0;
    let failedTests = 0;

    for (const testFile of TEST_FILES) {
        console.log(`Running: ${testFile}...`);
        
        try {
            const result = await runTest(testFile);
            results.push(result);
            
            if (result.success) {
                console.log(`✅ ${testFile} - PASSED`);
                passedTests++;
            } else {
                console.log(`❌ ${testFile} - FAILED`);
                failedTests++;
                if (result.stderr) {
                    console.log(`   Error: ${result.stderr.slice(0, 200)}...`);
                }
            }
        } catch (error) {
            console.log(`💥 ${testFile} - ERROR: ${error.message}`);
            failedTests++;
            results.push({
                testFile,
                code: -1,
                success: false,
                error: error.message
            });
        }
        
        console.log(''); // Empty line for readability
    }

    // Summary Report
    console.log('='.repeat(60));
    console.log('📊 TEST SUMMARY REPORT');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${TEST_FILES.length}`);
    console.log(`✅ Passed: ${passedTests}`);
    console.log(`❌ Failed: ${failedTests}`);
    console.log(`📈 Success Rate: ${Math.round((passedTests / TEST_FILES.length) * 100)}%`);
    console.log('');

    // Detailed Results
    if (failedTests > 0) {
        console.log('❌ FAILED TESTS:');
        console.log('-'.repeat(40));
        for (const result of results) {
            if (!result.success) {
                console.log(`• ${result.testFile}`);
                if (result.stderr) {
                    console.log(`  ${result.stderr.split('\n')[0]}`);
                }
            }
        }
        console.log('');
    }

    console.log('📝 Test Coverage:');
    console.log('-'.repeat(40));
    console.log('✓ Step 1: Text Extraction');
    console.log('✓ Step 2.1: Chapter Detection');
    console.log('✓ Step 2.2: Chapter Content Extraction');
    console.log('✓ Step 3: Page Extraction and Cross-Page Merging');
    console.log('✓ Step 4: Paragraph Detection');
    console.log('✓ Step 5: Header Detection');
    console.log('✓ Step 6: Chunking Algorithm');
    console.log('✓ Step 7: Page Assignment');
    console.log('✓ Step 8: Output Generation');
    console.log('');

    console.log('🔍 Test Features:');
    console.log('-'.repeat(40));
    console.log('• Content assertion testing (starts with expected text)');
    console.log('• Step output structure validation');
    console.log('• Error handling and prerequisite validation');
    console.log('• Data integrity and preservation testing');
    console.log('• Edge case handling');
    console.log('• Metadata and statistics validation');
    console.log('');

    // Exit with appropriate code
    process.exit(failedTests > 0 ? 1 : 0);
}

// Run the tests
runAllTests().catch(error => {
    console.error('💥 Test runner failed:', error);
    process.exit(1);
}); 