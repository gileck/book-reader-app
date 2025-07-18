#!/usr/bin/env node

/**
 * Run the book parser on the Transformers book.pdf
 * This script uses the refactored parser module to parse the local book.pdf 
 * and save results to this folder
 */

const fs = require('fs');
const path = require('path');

// Get the current directory (should be files/Transformers)
const currentDir = __dirname;
const bookPdfPath = path.join(currentDir, 'book.pdf');
const parserModulePath = path.join(__dirname, '../../book-parser/parser-v2/main-poc.js');

// Check if book.pdf exists
if (!fs.existsSync(bookPdfPath)) {
    console.error('❌ book.pdf not found in current directory');
    process.exit(1);
}

// Check if parser exists
if (!fs.existsSync(parserModulePath)) {
    console.error('❌ Parser main-poc.js not found at:', parserModulePath);
    process.exit(1);
}

console.log('🚀 Starting book parser...');
console.log('📖 Book PDF:', bookPdfPath);
console.log('🔧 Parser:', parserModulePath);
console.log('📁 Output will be saved to:', currentDir);

async function runParser() {
    try {
        // Import the parser module
        const parser = require(parserModulePath);

        // Configure parsing options
        const options = {
            outputDir: currentDir,                    // Save images to current directory
            debugDir: path.join(currentDir, 'debug'), // Debug info in debug subfolder
            validate: true,                           // Run validation
            debug: true,                             // Enable debug logging
            saveStepOutputs: true                    // Save individual step outputs
        };

        console.log('\n📋 Available steps:');
        const stepDescriptions = parser.getStepDescriptions();
        Object.entries(stepDescriptions).forEach(([step, description]) => {
            console.log(`  ${step}: ${description}`);
        });

        console.log('\n🚀 Starting pipeline...');
        const startTime = Date.now();

        // Parse the book
        const results = await parser.parseBook(bookPdfPath, options);

        const endTime = Date.now();
        const totalDuration = endTime - startTime;

        // Save complete results to JSON file
        const resultsFile = path.join(currentDir, 'parser-results.json');
        fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));

        // Save just the final parsed book data (for easy access)
        const outputFile = path.join(currentDir, 'output.json');
        fs.writeFileSync(outputFile, JSON.stringify(results.finalOutput, null, 2));

        // Generate summary report
        const reportFile = path.join(currentDir, 'parsing-report.txt');
        const report = generateReport(results);
        fs.writeFileSync(reportFile, report);

        console.log('\n✅ Parser completed successfully!');
        console.log(`⏱️  Total duration: ${totalDuration}ms`);
        console.log('\n📁 Generated files:');
        console.log('   📄 output.json - Final step output (step-4: paragraph detection)');
        console.log('   📊 parser-results.json - Complete step-by-step results');
        console.log('   📝 parsing-report.txt - Summary report');
        console.log('   📁 steps-output/ - Individual step outputs (for debugging)');
        console.log('   🖼️  images/ - Extracted images (if any)');
        console.log('   🐛 debug/ - Debug information');

        // Print quick stats
        console.log('\n📈 Quick Stats:');

        // Get chapters data from step-3-2 (image extraction) which has the most complete page data
        const step32Output = results.steps['step-3-2']?.output;
        const chaptersData = step32Output?.chapters || results.finalOutput.chapters;

        if (chaptersData) {
            console.log(`   📚 Chapters: ${chaptersData.length}`);
            const totalPages = chaptersData.reduce((sum, ch) => sum + (ch.pages ? ch.pages.length : 0), 0);
            console.log(`   📄 Pages: ${totalPages}`);

            const totalImages = chaptersData.reduce((sum, ch) => {
                if (!ch.pages) return sum;
                return sum + ch.pages.reduce((pageSum, page) => pageSum + (page.images ? page.images.length : 0), 0);
            }, 0);
            console.log(`   🖼️  Images: ${totalImages}`);

            const totalLinks = chaptersData.reduce((sum, ch) => {
                if (!ch.pages) return sum;
                return sum + ch.pages.reduce((pageSum, page) => pageSum + (page.links ? page.links.length : 0), 0);
            }, 0);
            console.log(`   🔗 Links: ${totalLinks}`);
        }

    } catch (error) {
        console.error('\n❌ Parser failed:', error.message);
        console.error('\n🔍 Stack trace:');
        console.error(error.stack);
        process.exit(1);
    }
}

function generateReport(results) {
    const lines = [];
    lines.push('BOOK PARSING REPORT');
    lines.push('===================');
    lines.push('');
    lines.push(`📖 PDF File: ${results.metadata.pdfPath}`);
    lines.push(`⏱️  Start Time: ${results.metadata.startTime}`);
    lines.push(`⏱️  End Time: ${results.metadata.endTime}`);
    lines.push(`⏱️  Total Duration: ${results.metadata.totalDuration}ms`);
    lines.push(`✅ Success: ${results.metadata.success}`);
    lines.push(`📊 Steps Executed: ${results.metadata.stepCount}`);
    lines.push('');

    lines.push('STEP-BY-STEP RESULTS');
    lines.push('====================');

    Object.entries(results.steps).forEach(([stepName, stepResult]) => {
        lines.push('');
        lines.push(`${stepName.toUpperCase()}`);
        lines.push('-'.repeat(stepName.length));
        lines.push(`✅ Success: ${stepResult.success}`);
        lines.push(`⏱️  Duration: ${stepResult.duration}ms`);
        lines.push(`🕐 Timestamp: ${stepResult.timestamp}`);

        if (stepResult.validation) {
            lines.push(`✅ Validation: ${stepResult.validation.passed ? 'PASSED' : 'FAILED'}`);
            if (stepResult.validation.error) {
                lines.push(`❌ Validation Error: ${stepResult.validation.error}`);
            }
        }

        if (stepResult.error) {
            lines.push(`❌ Error: ${stepResult.error}`);
        }
    });

    // Add final output summary using data from step-3-2 (most complete)
    const step32Output = results.steps['step-3-2']?.output;
    const chaptersData = step32Output?.chapters;

    if (chaptersData) {
        lines.push('');
        lines.push('FINAL OUTPUT SUMMARY');
        lines.push('====================');
        lines.push(`📚 Total Chapters: ${chaptersData.length}`);

        chaptersData.forEach((chapter, index) => {
            lines.push(`  Chapter ${index + 1}: ${chapter.title || 'Untitled'}`);
            if (chapter.pages) {
                lines.push(`    📄 Pages: ${chapter.pages.length}`);
                const chapterImages = chapter.pages.reduce((sum, page) => sum + (page.images ? page.images.length : 0), 0);
                const chapterLinks = chapter.pages.reduce((sum, page) => sum + (page.links ? page.links.length : 0), 0);
                if (chapterImages > 0) lines.push(`    🖼️  Images: ${chapterImages}`);
                if (chapterLinks > 0) lines.push(`    🔗 Links: ${chapterLinks}`);
            }
        });
    }

    // Add note about final output structure
    lines.push('');
    lines.push('NOTE: output.json contains the final step output (step-4: paragraph detection)');
    lines.push('For complete data with images and links, see steps-output/step-3-2.json');

    lines.push('');
    lines.push('Report generated on: ' + new Date().toISOString());

    return lines.join('\n');
}

// Run the parser
runParser(); 