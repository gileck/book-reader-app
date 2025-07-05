#!/usr/bin/env node

/**
 * Test case for POC Integrated Pipeline
 * Validates that poc-script.js works correctly
 */

const fs = require('fs');
const path = require('path');
const { STEPS, PIPELINE_STATE, CONFIG } = require('./poc-script.js');

// Test configuration
const TEST_CONFIG = {
    EXPECTED_START_TEXT: "From space it looks grey and crystalline, obliterating the blue-green colours of the living Earth. It is criss-crossed by irregular patterns and convergent striations.",
    EXPECTED_END_TEXT: "builds up; in effect, a car park. To understand which one requires a lot of context and subtle interpretation. There are times when it feels as if metabolomics should just be called gnomics.",

    // Chapter-specific tests
    CHAPTERS: {
        INTRODUCTION: {
            START: "From space it looks grey and crystalline, obliterating the blue-green colours of the living Earth. It is criss-crossed by irregular patterns and convergent striations.",
            END: "builds up; in effect, a car park. To understand which one requires a lot of context and subtle interpretation. There are times when it feels as if metabolomics should just be called gnomics."
        },
        DISCOVERING_NANOCOSM: {
            START: "Burlington House, Piccadilly, 1932. Its stately Victorian façades are glittering with light at the fag-end of a particularly dismal November. A spry, silver-haired gentleman, immaculately dressed and moustachioed, is coming to the end of his anniversary address as President of the Royal Society of London.",
            END: "Mitchell was in fact correct about one of the most baffling pumping mechanisms, known as the Q cycle, in which quinones transfer protons across the membrane through precisely the type of spatial coupling proposed by Mitchell."
        }
    }
};

// Test results
const TEST_RESULTS = {
    textExtraction: false,
    chapterDetection: false,
    introductionStartText: false,
    introductionEndText: false,
    discoveringNanocosmStartText: false,
    discoveringNanocosmEndText: false,
    allChaptersIncluded: false,
    overallSuccess: false
};

/**
 * Run the pipeline up to chapter detection
 */
async function runPipelineSteps() {
    console.log('🚀 Running pipeline steps...');

    try {
        // Step 1: Text Extraction
        await STEPS['text-extraction']();
        TEST_RESULTS.textExtraction = true;
        console.log('✅ Text extraction passed');

        // Step 2: Chapter Detection
        await STEPS['chapter-detection']();
        TEST_RESULTS.chapterDetection = true;
        console.log('✅ Chapter detection passed');

        return true;
    } catch (error) {
        console.error('❌ Pipeline steps failed:', error.message);
        return false;
    }
}

/**
 * Validate that all expected chapters are detected
 */
function validateAllChaptersIncluded() {
    console.log('\n📚 Validating all chapters are included...');

    const chapters = PIPELINE_STATE.chapters;

    if (!chapters || chapters.length === 0) {
        console.error('❌ No chapters found in pipeline state');
        return false;
    }

    console.log(`Found ${chapters.length} chapters:`);
    chapters.forEach((chapter, index) => {
        console.log(`   ${index + 1}. "${chapter.title}" (${chapter.number})`);
    });

    // Check for minimum expected chapters
    const expectedMinChapters = 5;
    if (chapters.length < expectedMinChapters) {
        console.error(`❌ Expected at least ${expectedMinChapters} chapters, found ${chapters.length}`);
        return false;
    }

    // Check for Introduction chapter
    const introChapter = chapters.find(ch =>
        ch.title.toLowerCase().includes('introduction') ||
        ch.number === 0 ||
        ch.title.toLowerCase().includes('life itself')
    );

    if (!introChapter) {
        console.error('❌ Introduction chapter not found');
        return false;
    }

    console.log(`✅ Found Introduction chapter: "${introChapter.title}"`);
    TEST_RESULTS.allChaptersIncluded = true;
    return true;
}

/**
 * Validate Introduction chapter content
 */
function validateIntroductionContent() {
    console.log('\n📖 Validating Introduction chapter content...');

    const chapters = PIPELINE_STATE.chapters;

    // Find Introduction chapter
    const introChapter = chapters.find(ch =>
        ch.title.toLowerCase().includes('introduction') ||
        ch.number === 0 ||
        ch.title.toLowerCase().includes('life itself')
    );

    if (!introChapter) {
        console.error('❌ Introduction chapter not found for content validation');
        return false;
    }

    if (!introChapter.text) {
        console.error('❌ Introduction chapter has no text content');
        return false;
    }

    const chapterText = introChapter.text.trim();
    console.log(`Introduction chapter length: ${chapterText.length} characters`);

    // Check start text
    const startText = chapterText.substring(0, 200);
    console.log(`Start text preview: "${startText}..."`);

    if (chapterText.startsWith(TEST_CONFIG.CHAPTERS.INTRODUCTION.START)) {
        console.log('✅ Introduction starts with expected text');
        TEST_RESULTS.introductionStartText = true;
    } else {
        console.error('❌ Introduction does not start with expected text');
        console.log('Expected:', TEST_CONFIG.CHAPTERS.INTRODUCTION.START);
        console.log('Actual:', chapterText.substring(0, TEST_CONFIG.CHAPTERS.INTRODUCTION.START.length));
    }

    // Check end text
    const endText = chapterText.substring(chapterText.length - 200);
    console.log(`End text preview: "...${endText}"`);

    if (chapterText.endsWith(TEST_CONFIG.CHAPTERS.INTRODUCTION.END)) {
        console.log('✅ Introduction ends with expected text');
        TEST_RESULTS.introductionEndText = true;
    } else {
        console.error('❌ Introduction does not end with expected text');
        console.log('Expected:', TEST_CONFIG.CHAPTERS.INTRODUCTION.END);
        console.log('Actual:', chapterText.substring(chapterText.length - TEST_CONFIG.CHAPTERS.INTRODUCTION.END.length));
    }

    return TEST_RESULTS.introductionStartText && TEST_RESULTS.introductionEndText;
}

/**
 * Validate "Discovering the nanocosm" chapter content
 */
function validateDiscoveringNanocosmContent() {
    console.log('\n📖 Validating "Discovering the nanocosm" chapter content...');

    const chapters = PIPELINE_STATE.chapters;

    // Find "Discovering the nanocosm" chapter
    const nanocosmChapter = chapters.find(ch =>
        ch.title.toLowerCase().includes('discovering') ||
        ch.title.toLowerCase().includes('nanocosm') ||
        ch.number === 1
    );

    if (!nanocosmChapter) {
        console.error('❌ "Discovering the nanocosm" chapter not found for content validation');
        return false;
    }

    if (!nanocosmChapter.text) {
        console.error('❌ "Discovering the nanocosm" chapter has no text content');
        return false;
    }

    const chapterText = nanocosmChapter.text.trim();
    console.log(`"Discovering the nanocosm" chapter length: ${chapterText.length} characters`);

    // Check start text
    const startText = chapterText.substring(0, 200);
    console.log(`Start text preview: "${startText}..."`);

    if (chapterText.startsWith(TEST_CONFIG.CHAPTERS.DISCOVERING_NANOCOSM.START)) {
        console.log('✅ "Discovering the nanocosm" starts with expected text');
        TEST_RESULTS.discoveringNanocosmStartText = true;
    } else {
        console.error('❌ "Discovering the nanocosm" does not start with expected text');
        console.log('Expected:', TEST_CONFIG.CHAPTERS.DISCOVERING_NANOCOSM.START);
        console.log('Actual:', chapterText.substring(0, TEST_CONFIG.CHAPTERS.DISCOVERING_NANOCOSM.START.length));
    }

    // Check end text
    const endText = chapterText.substring(chapterText.length - 200);
    console.log(`End text preview: "...${endText}"`);

    if (chapterText.endsWith(TEST_CONFIG.CHAPTERS.DISCOVERING_NANOCOSM.END)) {
        console.log('✅ "Discovering the nanocosm" ends with expected text');
        TEST_RESULTS.discoveringNanocosmEndText = true;
    } else {
        console.error('❌ "Discovering the nanocosm" does not end with expected text');
        console.log('Expected:', TEST_CONFIG.CHAPTERS.DISCOVERING_NANOCOSM.END);
        console.log('Actual:', chapterText.substring(chapterText.length - TEST_CONFIG.CHAPTERS.DISCOVERING_NANOCOSM.END.length));
    }

    return TEST_RESULTS.discoveringNanocosmStartText && TEST_RESULTS.discoveringNanocosmEndText;
}

/**
 * Generate test report
 */
function generateTestReport() {
    console.log('\n' + '='.repeat(60));
    console.log('🧪 TEST REPORT');
    console.log('='.repeat(60));

    console.log('\n📋 Test Results:');
    console.log(`   Text Extraction: ${TEST_RESULTS.textExtraction ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Chapter Detection: ${TEST_RESULTS.chapterDetection ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   All Chapters Included: ${TEST_RESULTS.allChaptersIncluded ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Introduction Start Text: ${TEST_RESULTS.introductionStartText ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Introduction End Text: ${TEST_RESULTS.introductionEndText ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Discovering Nanocosm Start Text: ${TEST_RESULTS.discoveringNanocosmStartText ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Discovering Nanocosm End Text: ${TEST_RESULTS.discoveringNanocosmEndText ? '✅ PASS' : '❌ FAIL'}`);

    const passedTests = Object.values(TEST_RESULTS).filter(result => result === true).length;
    const totalTests = Object.keys(TEST_RESULTS).length - 1; // Exclude overallSuccess

    console.log(`\n📊 Summary: ${passedTests}/${totalTests} tests passed`);

    TEST_RESULTS.overallSuccess = passedTests === totalTests;

    if (TEST_RESULTS.overallSuccess) {
        console.log('🎉 ALL TESTS PASSED! poc-script.js is working correctly.');
    } else {
        console.log('❌ Some tests failed. poc-script.js needs attention.');
    }

    // Save test results
    const testResultsFile = path.join(CONFIG.OUTPUT_DIR, 'test-results.json');
    fs.writeFileSync(testResultsFile, JSON.stringify({
        timestamp: new Date().toISOString(),
        results: TEST_RESULTS,
        summary: {
            passed: passedTests,
            total: totalTests,
            success: TEST_RESULTS.overallSuccess
        }
    }, null, 2));

    console.log(`\n📁 Test results saved to: ${testResultsFile}`);
}

/**
 * Main test execution
 */
async function runTests() {
    console.log('🧪 POC Script Validation Test');
    console.log('=============================');

    try {
        // Step 1: Run pipeline steps
        const pipelineSuccess = await runPipelineSteps();
        if (!pipelineSuccess) {
            generateTestReport();
            process.exit(1);
        }

        // Step 2: Validate all chapters are included
        validateAllChaptersIncluded();

        // Step 3: Validate Introduction chapter content
        validateIntroductionContent();

        // Step 4: Validate "Discovering the nanocosm" chapter content
        validateDiscoveringNanocosmContent();

        // Step 5: Generate test report
        generateTestReport();

        // Exit with appropriate code
        process.exit(TEST_RESULTS.overallSuccess ? 0 : 1);

    } catch (error) {
        console.error('❌ Test execution failed:', error.message);
        generateTestReport();
        process.exit(1);
    }
}

// Run tests if called directly
if (require.main === module) {
    runTests();
}

module.exports = { runTests, TEST_RESULTS, TEST_CONFIG }; 