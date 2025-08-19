const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

async function testMutool() {
    const pdfPath = path.join(__dirname, '..', 'files', 'Creativity-Inc', 'book.pdf');
    const pageNum = 122;
    
    try {
        console.log('🔧 Using mutool to extract font information...');
        
        // 1. Get PDF metadata and font info
        console.log('\n📋 Getting PDF info and fonts...');
        const infoOutput = execSync(`mutool info "${pdfPath}"`, { encoding: 'utf8' });
        console.log(infoOutput);
        
        // 2. Extract text with font details for specific page
        console.log(`\n📄 Extracting text with fonts from page ${pageNum}...`);
        const mutoolOutput = execSync(`mutool draw -F txt -o - "${pdfPath}" ${pageNum}`, { encoding: 'utf8' });
        
        // Parse mutool output for font sizes
        const lines = mutoolOutput.split('\n');
        const fontSizeMap = new Map();
        const fontNameMap = new Map();
        
        lines.forEach(line => {
            // Look for font size patterns in mutool output
            const fontMatch = line.match(/font="([^"]*)" size="([^"]*)".*?>(.*?)</);
            if (fontMatch) {
                const [, fontName, fontSize, text] = fontMatch;
                const size = parseFloat(fontSize);
                
                // Group by font size
                const existing = fontSizeMap.get(size) || '';
                fontSizeMap.set(size, existing + text);
                
                // Group by font name
                const existingByName = fontNameMap.get(fontName) || '';
                fontNameMap.set(fontName, existingByName + text);
            }
        });
        
        console.log('\n📊 Font sizes from mutool draw:');
        Array.from(fontSizeMap.entries())
            .sort(([a], [b]) => b - a) // Sort by size descending
            .forEach(([size, text]) => {
                console.log(`Size ${size}pt: ${text.substring(0, 80)}...`);
            });
            
        console.log('\n🔤 Font families used:');
        Array.from(fontNameMap.entries())
            .forEach(([fontName, text]) => {
                console.log(`${fontName}: ${text.substring(0, 80)}...`);
            });
        
        // 3. Show page objects for more detailed analysis
        console.log(`\n🔍 Getting page objects for page ${pageNum}...`);
        try {
            const pageObjectsOutput = execSync(`mutool show "${pdfPath}" ${pageNum}`, { encoding: 'utf8' });
            console.log('Page objects preview:');
            console.log(pageObjectsOutput.substring(0, 500) + '...');
            
            // Save detailed outputs
            fs.writeFileSync(path.join(__dirname, 'mutool-page-objects.txt'), pageObjectsOutput);
        } catch (showError) {
            console.log('Note: mutool show command not available or failed');
        }
        
        // Save all outputs for inspection
        fs.writeFileSync(path.join(__dirname, 'mutool-info.txt'), infoOutput);
        fs.writeFileSync(path.join(__dirname, 'mutool-draw-output.txt'), mutoolOutput);
        
        console.log('\n✅ Mutool outputs saved:');
        console.log('   📄 mutool-info.txt - PDF metadata and fonts');
        console.log('   📄 mutool-draw-output.txt - Page text with font details');
        console.log('   📄 mutool-page-objects.txt - Page object details');
        
    } catch (error) {
        console.error('❌ Mutool error:', error.message);
        console.log('💡 Make sure mutool is installed: brew install mupdf-tools (macOS) or apt install mupdf-tools (Linux)');
    }
}

async function testPdfJs() {
    const pdfPath = path.join(__dirname, '..', 'files', 'Creativity-Inc', 'book.pdf');
    
    try {
        console.log('\n🔧 Using pdfjs-dist to extract font information...');
        
        // Import pdfjs-dist
        const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
        
        // Read PDF file
        const pdfBuffer = fs.readFileSync(pdfPath);
        
        // Load PDF document
        const pdfDoc = await pdfjsLib.getDocument(pdfBuffer).promise;
        const pageNum = 122;
        
        console.log(`📄 PDF has ${pdfDoc.numPages} pages`);
        
        // Extract text from specific page
        const page = await pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();

        // Build a map from font size to text content
        const textSizeMap = new Map();
        textContent.items.forEach(item => {
            // Calculate approximate font size from transform matrix
            const [a, b, c, d] = item.transform;
            const approxFontSize = Math.round(Math.sqrt(a*a + b*b) * 10) / 10; // Round to 1 decimal
            const existing = textSizeMap.get(approxFontSize) || '';
            textSizeMap.set(approxFontSize, existing + item.str);
        });

        console.log('\n📊 Font sizes from pdfjs-dist:');
        Array.from(textSizeMap.entries())
            .sort(([a], [b]) => b - a) // Sort by size descending
            .forEach(([size, text]) => {
                console.log(`Size ${size}: ${text.substring(0, 100)}...`);
            });

        // Save detailed textContent for inspection
        fs.writeFileSync(path.join(__dirname, 'pdfjs-textcontent.json'), JSON.stringify(textContent, null, 2));
        console.log('✅ PDF.js textContent saved to pdfjs-textcontent.json');
        
    } catch (error) {
        console.error('❌ PDF.js error:', error.message);
    }
}

async function test() {
    console.log('🚀 Comparing mutool vs pdfjs-dist font extraction...\n');
    
    await testMutool();
    // await testPdfJs();
}

test();