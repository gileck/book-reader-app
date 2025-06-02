const fs = require('fs');
const path = require('path');

const TEST_PDF = path.join(__dirname, '../files/nick-lane__transformer.pdf');
const OUTPUT_DIR = path.join(__dirname, '../test-pure-nodejs');

// Ensure output directory exists
if (fs.existsSync(OUTPUT_DIR)) {
    fs.rmSync(OUTPUT_DIR, { recursive: true });
}
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

console.log('🧪 Pure Node.js PDF Image Extraction Test');
console.log('=========================================');
console.log('');

/**
 * Test 1: unpdf package
 */
async function testUnpdf() {
    console.log('1️⃣ Testing: unpdf');

    try {
        // Install if needed
        try {
            require('unpdf');
        } catch (e) {
            console.log('   📦 Installing unpdf...');
            const { execSync } = require('child_process');
            execSync('npm install unpdf', { stdio: 'inherit' });
        }

        const { extractText, extractImages } = require('unpdf');

        console.log('   🔍 Checking unpdf capabilities...');

        // Test text extraction first
        const textResult = await extractText(TEST_PDF);
        console.log(`   📄 Text extraction: ${textResult ? 'SUCCESS' : 'FAILED'}`);

        // Test image extraction if available
        if (typeof extractImages === 'function') {
            console.log('   🖼️  Attempting image extraction...');
            const imageResult = await extractImages(TEST_PDF);
            console.log(`   📊 Result: ${JSON.stringify(imageResult)}`);
        } else {
            console.log('   ❌ No image extraction function available');
        }

    } catch (error) {
        console.log(`   ❌ Failed: ${error.message}`);
    }
    console.log('');
}

/**
 * Test 2: pdf.js-extract
 */
async function testPdfJsExtract() {
    console.log('2️⃣ Testing: pdf.js-extract');

    try {
        // Install if needed
        try {
            require('pdf.js-extract');
        } catch (e) {
            console.log('   📦 Installing pdf.js-extract...');
            const { execSync } = require('child_process');
            execSync('npm install pdf.js-extract', { stdio: 'inherit' });
        }

        const PDFExtract = require('pdf.js-extract');
        const pdfExtract = new PDFExtract();

        console.log('   🔍 Extracting PDF data...');

        const data = await new Promise((resolve, reject) => {
            pdfExtract.extract(TEST_PDF, (err, data) => {
                if (err) reject(err);
                else resolve(data);
            });
        });

        console.log(`   📄 Pages extracted: ${data.pages ? data.pages.length : 0}`);

        // Check for images in the data
        let totalImages = 0;
        if (data.pages) {
            data.pages.forEach((page, pageIndex) => {
                if (page.content) {
                    page.content.forEach(item => {
                        if (item.type === 'image' || item.tag === 'image') {
                            totalImages++;
                        }
                    });
                }
            });
        }

        console.log(`   🖼️  Images found: ${totalImages}`);

        // Save sample data for inspection
        const samplePath = path.join(OUTPUT_DIR, 'pdf-js-extract-sample.json');
        fs.writeFileSync(samplePath, JSON.stringify({
            totalPages: data.pages ? data.pages.length : 0,
            totalImages: totalImages,
            firstPageSample: data.pages && data.pages[0] ? {
                pageIndex: data.pages[0].pageIndex,
                contentItems: data.pages[0].content ? data.pages[0].content.length : 0,
                sampleContent: data.pages[0].content ? data.pages[0].content.slice(0, 3) : []
            } : null
        }, null, 2));

        console.log(`   💾 Sample data saved to: ${samplePath}`);

    } catch (error) {
        console.log(`   ❌ Failed: ${error.message}`);
    }
    console.log('');
}

/**
 * Test 3: Enhanced PDF.js approach with Canvas-based image extraction
 */
async function testEnhancedPdfJs() {
    console.log('3️⃣ Testing: Enhanced PDF.js with Canvas');

    try {
        const pdfjsLib = require('pdfjs-dist/legacy/build/pdf');
        pdfjsLib.GlobalWorkerOptions.workerSrc = false;

        // Try to install canvas if not available
        let Canvas;
        try {
            Canvas = require('canvas');
        } catch (e) {
            console.log('   📦 Installing canvas...');
            const { execSync } = require('child_process');
            execSync('npm install canvas', { stdio: 'inherit' });
            Canvas = require('canvas');
        }

        console.log('   🔍 Scanning PDF for embedded images...');

        const pdfBuffer = fs.readFileSync(TEST_PDF);
        const pdf = await pdfjsLib.getDocument(pdfBuffer).promise;

        let imageCount = 0;
        const imageData = [];

        // Scan first 5 pages for detailed analysis
        for (let pageNum = 1; pageNum <= Math.min(5, pdf.numPages); pageNum++) {
            console.log(`   📄 Analyzing page ${pageNum}...`);

            const page = await pdf.getPage(pageNum);
            const operatorList = await page.getOperatorList();

            // Count image operations
            let pageImages = 0;
            for (let i = 0; i < operatorList.fnArray.length; i++) {
                const fn = operatorList.fnArray[i];
                if (fn === pdfjsLib.OPS.paintImageXObject) {
                    pageImages++;
                    imageCount++;
                }
            }

            if (pageImages > 0) {
                imageData.push({
                    pageNumber: pageNum,
                    imageCount: pageImages
                });
                console.log(`     📊 Found ${pageImages} images on page ${pageNum}`);
            }
        }

        console.log(`   🖼️  Total images detected: ${imageCount}`);

        // Save analysis
        const analysisPath = path.join(OUTPUT_DIR, 'enhanced-pdfjs-analysis.json');
        fs.writeFileSync(analysisPath, JSON.stringify({
            totalPagesScanned: Math.min(5, pdf.numPages),
            totalImages: imageCount,
            imagesByPage: imageData,
            canvasAvailable: !!Canvas
        }, null, 2));

        console.log(`   💾 Analysis saved to: ${analysisPath}`);

    } catch (error) {
        console.log(`   ❌ Failed: ${error.message}`);
    }
    console.log('');
}

/**
 * Test 4: pdf-parse with image detection
 */
async function testPdfParseImages() {
    console.log('4️⃣ Testing: pdf-parse (checking for image detection)');

    try {
        const pdfParse = require('pdf-parse');

        console.log('   🔍 Parsing PDF with pdf-parse...');

        const pdfBuffer = fs.readFileSync(TEST_PDF);
        const data = await pdfParse(pdfBuffer, {
            // Try to get more detailed data
            version: 'v1.10.100'
        });

        console.log(`   📄 Text length: ${data.text ? data.text.length : 0} characters`);
        console.log(`   📊 Pages: ${data.numpages || 'unknown'}`);
        console.log(`   📋 Info available: ${Object.keys(data.info || {}).join(', ')}`);

        // Check if there's any image-related data
        const hasImages = data.text && (
            data.text.includes('Figure') ||
            data.text.includes('Image') ||
            data.text.includes('Chart') ||
            data.text.includes('Diagram')
        );

        console.log(`   🖼️  Potential image references in text: ${hasImages ? 'YES' : 'NO'}`);

        // Save basic info
        const infoPath = path.join(OUTPUT_DIR, 'pdf-parse-info.json');
        fs.writeFileSync(infoPath, JSON.stringify({
            textLength: data.text ? data.text.length : 0,
            numPages: data.numpages,
            info: data.info,
            hasImageReferences: hasImages
        }, null, 2));

        console.log(`   💾 Info saved to: ${infoPath}`);

    } catch (error) {
        console.log(`   ❌ Failed: ${error.message}`);
    }
    console.log('');
}

/**
 * Main test execution
 */
async function runTests() {
    try {
        await testUnpdf();
        await testPdfJsExtract();
        await testEnhancedPdfJs();
        await testPdfParseImages();

        console.log('✅ All tests completed!');
        console.log(`📁 Check results in: ${OUTPUT_DIR}`);

    } catch (error) {
        console.error('❌ Test execution failed:', error);
    }
}

// Run the tests
runTests(); 