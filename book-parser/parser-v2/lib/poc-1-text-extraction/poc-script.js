#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// POC-1: Text Extraction
// Goal: Test different PDF libraries and validate text extraction with literal newlines

const PDF_PATH = path.join(__dirname, '../../book.pdf');
const OUTPUT_DIR = path.join(__dirname, 'output');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

console.log('=== POC-1: Text Extraction ===');
console.log(`Testing PDF: ${PDF_PATH}`);
console.log(`Output directory: ${OUTPUT_DIR}`);

// Test results container
const results = {
    pdfPath: PDF_PATH,
    libraries: [],
    testDate: new Date().toISOString(),
    conclusions: []
};

// Test 1: pdf-parse library
async function testPdfParse() {
    console.log('\n--- Testing pdf-parse library ---');
    
    try {
        // Check if pdf-parse is available
        let pdfParse;
        try {
            pdfParse = require('pdf-parse');
        } catch (e) {
            console.log('pdf-parse not installed, installing...');
            const { execSync } = require('child_process');
            execSync('npm install pdf-parse', { stdio: 'inherit' });
            pdfParse = require('pdf-parse');
        }

        const dataBuffer = fs.readFileSync(PDF_PATH);
        const data = await pdfParse(dataBuffer);
        
        const result = {
            library: 'pdf-parse',
            success: true,
            textLength: data.text.length,
            pageCount: data.numpages,
            newlineCount: (data.text.match(/\n/g) || []).length,
            crlfCount: (data.text.match(/\r\n/g) || []).length,
            crCount: (data.text.match(/\r/g) || []).length,
            firstChars: data.text.substring(0, 500),
            lastChars: data.text.substring(data.text.length - 500),
            sampleParagraphs: extractSampleParagraphs(data.text),
            metadata: data.info || {}
        };
        
        // Save raw text for inspection
        fs.writeFileSync(path.join(OUTPUT_DIR, 'pdf-parse-raw-text.txt'), data.text);
        fs.writeFileSync(path.join(OUTPUT_DIR, 'pdf-parse-metadata.json'), JSON.stringify(data.info, null, 2));
        
        results.libraries.push(result);
        
        console.log(`✓ Text extracted: ${result.textLength} characters`);
        console.log(`✓ Pages: ${result.pageCount}`);
        console.log(`✓ Newlines (\\n): ${result.newlineCount}`);
        console.log(`✓ CRLF (\\r\\n): ${result.crlfCount}`);
        console.log(`✓ CR (\\r): ${result.crCount}`);
        
    } catch (error) {
        console.error('✗ pdf-parse failed:', error.message);
        results.libraries.push({
            library: 'pdf-parse',
            success: false,
            error: error.message
        });
    }
}

// Helper function to extract sample paragraphs for analysis
function extractSampleParagraphs(text) {
    const lines = text.split('\n');
    const paragraphs = [];
    
    for (let i = 0; i < Math.min(20, lines.length); i++) {
        const line = lines[i].trim();
        if (line.length > 0) {
            paragraphs.push({
                line: i + 1,
                text: line,
                length: line.length,
                startsWithCapital: /^[A-Z]/.test(line),
                endsWithPunctuation: /[.!?]$/.test(line)
            });
        }
    }
    
    return paragraphs;
}

// Analyze newline patterns
function analyzeNewlines(text) {
    const lines = text.split('\n');
    const analysis = {
        totalLines: lines.length,
        emptyLines: 0,
        shortLines: 0, // < 20 chars
        mediumLines: 0, // 20-80 chars
        longLines: 0, // > 80 chars
        potentialHeaders: [],
        potentialParagraphs: []
    };
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line.length === 0) {
            analysis.emptyLines++;
        } else if (line.length < 20) {
            analysis.shortLines++;
            // Potential header if short, starts with capital, doesn't end with punctuation
            if (/^[A-Z]/.test(line) && !/[.!?]$/.test(line)) {
                analysis.potentialHeaders.push({
                    line: i + 1,
                    text: line,
                    length: line.length
                });
            }
        } else if (line.length <= 80) {
            analysis.mediumLines++;
        } else {
            analysis.longLines++;
            // Potential paragraph if long
            analysis.potentialParagraphs.push({
                line: i + 1,
                text: line.substring(0, 100) + '...',
                length: line.length
            });
        }
    }
    
    return analysis;
}

// Main execution
async function runPOC() {
    console.log('Starting POC-1: Text Extraction tests...\n');
    
    // Check if PDF exists
    if (!fs.existsSync(PDF_PATH)) {
        console.error(`Error: PDF file not found at ${PDF_PATH}`);
        process.exit(1);
    }
    
    // Run tests
    await testPdfParse();
    
    // Analyze results
    console.log('\n=== Analysis ===');
    
    const successfulLibraries = results.libraries.filter(lib => lib.success);
    
    if (successfulLibraries.length === 0) {
        console.log('No libraries succeeded in text extraction');
        results.conclusions.push('No libraries succeeded in text extraction');
    } else {
        console.log(`${successfulLibraries.length} libraries succeeded in text extraction`);
        
        // Compare results
        successfulLibraries.forEach(lib => {
            if (lib.textLength > 0) {
                console.log(`\n${lib.library}:`);
                console.log(`  - Text length: ${lib.textLength}`);
                console.log(`  - Newlines: ${lib.newlineCount}`);
                console.log(`  - Sample paragraphs: ${lib.sampleParagraphs?.length || 0}`);
                
                // Analyze newline patterns for pdf-parse
                if (lib.library === 'pdf-parse') {
                    const rawText = fs.readFileSync(path.join(OUTPUT_DIR, 'pdf-parse-raw-text.txt'), 'utf8');
                    const analysis = analyzeNewlines(rawText);
                    fs.writeFileSync(path.join(OUTPUT_DIR, 'pdf-parse-newline-analysis.json'), JSON.stringify(analysis, null, 2));
                    
                    console.log(`  - Total lines: ${analysis.totalLines}`);
                    console.log(`  - Empty lines: ${analysis.emptyLines}`);
                    console.log(`  - Potential headers: ${analysis.potentialHeaders.length}`);
                    console.log(`  - Potential paragraphs: ${analysis.potentialParagraphs.length}`);
                }
            }
        });
    }
    
    // Save complete results
    fs.writeFileSync(path.join(OUTPUT_DIR, 'poc-results.json'), JSON.stringify(results, null, 2));
    
    console.log(`\n=== Results saved to ${OUTPUT_DIR} ===`);
    console.log('Files created:');
    console.log('- poc-results.json (complete test results)');
    console.log('- *-raw-text.txt (extracted text files)');
    console.log('- *-metadata.json (PDF metadata)');
    console.log('- *-analysis.json (text analysis)');
    
    return results;
}

// Run the POC
if (require.main === module) {
    runPOC().catch(console.error);
}

module.exports = { runPOC, extractSampleParagraphs, analyzeNewlines };
