const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Test configuration
const TEST_PDF = path.join(__dirname, '../files/nick-lane__transformer.pdf');
const TEST_OUTPUT_DIR = path.join(__dirname, '../test-image-extraction');
const TEST_PAGES = [1, 4, 31, 37, 54, 75]; // Pages we know have images

// Ensure test output directory exists
if (fs.existsSync(TEST_OUTPUT_DIR)) {
    fs.rmSync(TEST_OUTPUT_DIR, { recursive: true });
}
fs.mkdirSync(TEST_OUTPUT_DIR, { recursive: true });

console.log('🧪 PDF Image Extraction Library Test');
console.log('=====================================');
console.log(`📄 PDF: ${TEST_PDF}`);
console.log(`📁 Output: ${TEST_OUTPUT_DIR}`);
console.log(`🎯 Test pages: ${TEST_PAGES.join(', ')}`);
console.log('');

// Results tracking
const results = [];

/**
 * Test 1: pdfimages (poppler-utils command line tool)
 */
async function testPdfImages() {
    console.log('1️⃣ Testing: pdfimages (poppler-utils)');
    const outputDir = path.join(TEST_OUTPUT_DIR, '1-pdfimages');
    fs.mkdirSync(outputDir, { recursive: true });

    try {
        // Check if pdfimages is available
        execSync('which pdfimages', { stdio: 'ignore' });

        // Extract all images
        const startTime = Date.now();
        execSync(`pdfimages -all "${TEST_PDF}" "${outputDir}/image"`, { stdio: 'inherit' });
        const duration = Date.now() - startTime;

        // Check results
        const files = fs.readdirSync(outputDir);
        const imageFiles = files.filter(f => /\.(png|jpg|jpeg|ppm|pbm)$/i.test(f));

        let totalSize = 0;
        imageFiles.forEach(file => {
            const stats = fs.statSync(path.join(outputDir, file));
            totalSize += stats.size;
        });

        results.push({
            method: 'pdfimages (poppler-utils)',
            success: true,
            imageCount: imageFiles.length,
            totalSize: `${(totalSize / 1024 / 1024).toFixed(2)}MB`,
            duration: `${duration}ms`,
            files: imageFiles.slice(0, 5), // Show first 5 files
            notes: 'Command line tool, extracts raw embedded images'
        });

        console.log(`   ✅ Success: ${imageFiles.length} images, ${(totalSize / 1024 / 1024).toFixed(2)}MB`);

    } catch (error) {
        results.push({
            method: 'pdfimages (poppler-utils)',
            success: false,
            error: 'pdfimages not installed (brew install poppler)',
            notes: 'Requires: brew install poppler'
        });
        console.log(`   ❌ Failed: pdfimages not available`);
    }
    console.log('');
}

/**
 * Test 2: pdf2pic with different configurations
 */
async function testPdf2Pic() {
    console.log('2️⃣ Testing: pdf2pic');

    // Try different configurations
    const configs = [
        { name: 'basic', options: { density: 100, format: 'png' } },
        { name: 'high-quality', options: { density: 200, format: 'png', width: 2000, height: 2000 } },
        { name: 'jpeg', options: { density: 150, format: 'jpeg', quality: 90 } }
    ];

    for (const config of configs) {
        const outputDir = path.join(TEST_OUTPUT_DIR, `2-pdf2pic-${config.name}`);
        fs.mkdirSync(outputDir, { recursive: true });

        try {
            const { fromPath } = require('pdf2pic');
            const convert = fromPath(TEST_PDF, {
                ...config.options,
                savePath: outputDir,
                saveFilename: 'page'
            });

            const startTime = Date.now();

            // Convert specific test pages
            const convertedPages = [];
            for (const pageNum of TEST_PAGES.slice(0, 3)) { // Test first 3 pages only
                try {
                    const result = await convert(pageNum);
                    if (result) convertedPages.push(result);
                } catch (pageError) {
                    console.log(`     ⚠️ Page ${pageNum} failed: ${pageError.message}`);
                }
            }

            const duration = Date.now() - startTime;

            // Check results
            const files = fs.readdirSync(outputDir);
            const imageFiles = files.filter(f => /\.(png|jpg|jpeg)$/i.test(f));

            let totalSize = 0;
            imageFiles.forEach(file => {
                const stats = fs.statSync(path.join(outputDir, file));
                totalSize += stats.size;
            });

            results.push({
                method: `pdf2pic (${config.name})`,
                success: true,
                imageCount: imageFiles.length,
                totalSize: `${(totalSize / 1024 / 1024).toFixed(2)}MB`,
                duration: `${duration}ms`,
                files: imageFiles,
                notes: 'Converts entire pages to images (not embedded images)'
            });

            console.log(`   ✅ pdf2pic-${config.name}: ${imageFiles.length} images, ${(totalSize / 1024 / 1024).toFixed(2)}MB`);

        } catch (error) {
            results.push({
                method: `pdf2pic (${config.name})`,
                success: false,
                error: error.message,
                notes: 'npm install pdf2pic required'
            });
            console.log(`   ❌ pdf2pic-${config.name} failed: ${error.message}`);
        }
    }
    console.log('');
}

/**
 * Test 3: node-poppler
 */
async function testNodePoppler() {
    console.log('3️⃣ Testing: node-poppler');
    const outputDir = path.join(TEST_OUTPUT_DIR, '3-node-poppler');
    fs.mkdirSync(outputDir, { recursive: true });

    try {
        // First install node-poppler if not installed
        try {
            require('node-poppler');
        } catch (e) {
            console.log('   📦 Installing node-poppler...');
            execSync('npm install node-poppler', { stdio: 'inherit' });
        }

        const Poppler = require('node-poppler');
        const poppler = new Poppler();

        const startTime = Date.now();

        // Extract images
        const options = {
            firstPageToConvert: 1,
            lastPageToConvert: 50, // Test first 50 pages
            pngFile: true,
        };

        await poppler.pdfImages(TEST_PDF, outputDir, options);
        const duration = Date.now() - startTime;

        // Check results
        const files = fs.readdirSync(outputDir);
        const imageFiles = files.filter(f => /\.(png|jpg|jpeg|ppm|pbm)$/i.test(f));

        let totalSize = 0;
        imageFiles.forEach(file => {
            const stats = fs.statSync(path.join(outputDir, file));
            totalSize += stats.size;
        });

        results.push({
            method: 'node-poppler',
            success: true,
            imageCount: imageFiles.length,
            totalSize: `${(totalSize / 1024 / 1024).toFixed(2)}MB`,
            duration: `${duration}ms`,
            files: imageFiles.slice(0, 5),
            notes: 'Node.js wrapper for poppler-utils'
        });

        console.log(`   ✅ Success: ${imageFiles.length} images, ${(totalSize / 1024 / 1024).toFixed(2)}MB`);

    } catch (error) {
        results.push({
            method: 'node-poppler',
            success: false,
            error: error.message,
            notes: 'Requires poppler-utils to be installed on system'
        });
        console.log(`   ❌ Failed: ${error.message}`);
    }
    console.log('');
}

/**
 * Test 4: pdf-poppler
 */
async function testPdfPoppler() {
    console.log('4️⃣ Testing: pdf-poppler');
    const outputDir = path.join(TEST_OUTPUT_DIR, '4-pdf-poppler');
    fs.mkdirSync(outputDir, { recursive: true });

    try {
        // Install if needed
        try {
            require('pdf-poppler');
        } catch (e) {
            console.log('   📦 Installing pdf-poppler...');
            execSync('npm install pdf-poppler', { stdio: 'inherit' });
        }

        const pdf = require('pdf-poppler');

        const startTime = Date.now();

        // Convert pages to images
        const options = {
            format: 'png',
            out_dir: outputDir,
            out_prefix: 'page',
            page: null // All pages
        };

        await pdf.convert(TEST_PDF, options);
        const duration = Date.now() - startTime;

        // Check results
        const files = fs.readdirSync(outputDir);
        const imageFiles = files.filter(f => /\.(png|jpg|jpeg)$/i.test(f));

        let totalSize = 0;
        imageFiles.forEach(file => {
            const stats = fs.statSync(path.join(outputDir, file));
            totalSize += stats.size;
        });

        results.push({
            method: 'pdf-poppler',
            success: true,
            imageCount: imageFiles.length,
            totalSize: `${(totalSize / 1024 / 1024).toFixed(2)}MB`,
            duration: `${duration}ms`,
            files: imageFiles.slice(0, 5),
            notes: 'Converts pages to images, not embedded image extraction'
        });

        console.log(`   ✅ Success: ${imageFiles.length} images, ${(totalSize / 1024 / 1024).toFixed(2)}MB`);

    } catch (error) {
        results.push({
            method: 'pdf-poppler',
            success: false,
            error: error.message,
            notes: 'Another poppler wrapper'
        });
        console.log(`   ❌ Failed: ${error.message}`);
    }
    console.log('');
}

/**
 * Test 5: Custom PDF.js approach (simplified)
 */
async function testCustomPdfJs() {
    console.log('5️⃣ Testing: Custom PDF.js');
    const outputDir = path.join(TEST_OUTPUT_DIR, '5-custom-pdfjs');
    fs.mkdirSync(outputDir, { recursive: true });

    try {
        const pdfjsLib = require('pdfjs-dist/legacy/build/pdf');
        pdfjsLib.GlobalWorkerOptions.workerSrc = false;

        const startTime = Date.now();

        const pdfBuffer = fs.readFileSync(TEST_PDF);
        const pdf = await pdfjsLib.getDocument(pdfBuffer).promise;

        let imageCount = 0;

        // Scan first 10 pages for images
        for (let pageNum = 1; pageNum <= Math.min(10, pdf.numPages); pageNum++) {
            const page = await pdf.getPage(pageNum);
            const operatorList = await page.getOperatorList();

            for (let i = 0; i < operatorList.fnArray.length; i++) {
                const fn = operatorList.fnArray[i];
                if (fn === pdfjsLib.OPS.paintImageXObject) {
                    imageCount++;
                }
            }
        }

        const duration = Date.now() - startTime;

        results.push({
            method: 'Custom PDF.js',
            success: true,
            imageCount: `${imageCount} detected (not extracted)`,
            totalSize: 'N/A',
            duration: `${duration}ms`,
            files: [],
            notes: 'Only detects images, extraction needs more work'
        });

        console.log(`   ✅ Success: ${imageCount} images detected`);

    } catch (error) {
        results.push({
            method: 'Custom PDF.js',
            success: false,
            error: error.message,
            notes: 'Detection only, complex extraction'
        });
        console.log(`   ❌ Failed: ${error.message}`);
    }
    console.log('');
}

/**
 * Display results summary
 */
function displayResults() {
    console.log('📊 RESULTS SUMMARY');
    console.log('==================');
    console.log('');

    results.forEach((result, index) => {
        const status = result.success ? '✅' : '❌';
        console.log(`${status} ${result.method}`);

        if (result.success) {
            console.log(`   Images: ${result.imageCount}`);
            console.log(`   Size: ${result.totalSize}`);
            console.log(`   Time: ${result.duration}`);
            if (result.files && result.files.length > 0) {
                console.log(`   Sample files: ${result.files.slice(0, 3).join(', ')}`);
            }
        } else {
            console.log(`   Error: ${result.error || 'Unknown error'}`);
        }

        console.log(`   Notes: ${result.notes}`);
        console.log('');
    });

    // Recommendation
    console.log('🎯 RECOMMENDATIONS');
    console.log('==================');

    const successful = results.filter(r => r.success);
    if (successful.length === 0) {
        console.log('❌ No methods worked successfully. Install poppler-utils:');
        console.log('   macOS: brew install poppler');
        console.log('   Ubuntu: sudo apt-get install poppler-utils');
    } else {
        console.log('✅ Working methods found:');
        successful.forEach(r => {
            console.log(`   • ${r.method}: ${r.notes}`);
        });

        // Find best method for embedded images
        const embeddedImageMethods = successful.filter(r =>
            r.method.includes('pdfimages') || r.method.includes('node-poppler')
        );

        if (embeddedImageMethods.length > 0) {
            console.log('');
            console.log('🏆 BEST FOR EMBEDDED IMAGES:');
            console.log(`   ${embeddedImageMethods[0].method} - Extracts actual embedded images`);
        }
    }
}

/**
 * Main test execution
 */
async function runTests() {
    try {
        await testPdfImages();
        await testPdf2Pic();
        await testNodePoppler();
        await testPdfPoppler();
        await testCustomPdfJs();

        displayResults();

    } catch (error) {
        console.error('❌ Test execution failed:', error);
    }
}

// Run the tests
runTests(); 