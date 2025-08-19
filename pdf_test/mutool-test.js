const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

async function testMutool() {
    const pdfPath = path.join(__dirname, '..', 'files', 'Creativity-Inc', 'book.pdf');
    const pageNum = 122;
    
    try {
        console.log('🔧 Using mutool to extract font information...');
        
        // Extract text with font details for specific page using HTML format
        console.log(`\n📄 Extracting text with fonts from page ${pageNum}...`);
        const mutoolOutput = execSync(`mutool draw -F html -o - "${pdfPath}" ${pageNum}`, { encoding: 'utf8' });
        
        // Parse mutool HTML output and create formatted text
        const lines = mutoolOutput.split('\n');
        const formattedLines = [];
        
        lines.forEach(line => {
            // Look for span tags with font-size in HTML output
            const fontMatch = line.match(/font-size:([0-9.]+)pt[^>]*>([^<]+)</);
            if (fontMatch) {
                const [, fontSize, text] = fontMatch;
                const cleanText = text.trim();
                if (cleanText) {
                    formattedLines.push(`[${fontSize}pt] ${cleanText}`);
                }
            }
            
            // Also look for bold text patterns
            const boldMatch = line.match(/<b><span[^>]*font-size:([0-9.]+)pt[^>]*>([^<]+)<\/span><\/b>/);
            if (boldMatch) {
                const [, fontSize, text] = boldMatch;
                const cleanText = text.trim();
                if (cleanText) {
                    formattedLines.push(`[${fontSize}pt BOLD] ${cleanText}`);
                }
            }
        });
        
        // Create the formatted text file
        const outputText = formattedLines.join('\n');
        const outputPath = path.join(__dirname, `page-${pageNum}-with-font-sizes.txt`);
        
        fs.writeFileSync(outputPath, outputText, 'utf8');
        
        console.log(`✅ Created formatted text file: ${outputPath}`);
        console.log(`📄 Found ${formattedLines.length} text lines with font information`);
        
        // Show preview of the formatted output
        console.log('\n📝 Preview of formatted text:');
        console.log('─'.repeat(60));
        formattedLines.slice(0, 10).forEach(line => console.log(line));
        if (formattedLines.length > 10) {
            console.log('...');
            console.log(`(${formattedLines.length - 10} more lines in file)`);
        }
        console.log('─'.repeat(60));
        
    } catch (error) {
        console.error('❌ Mutool error:', error.message);
    }
}


async function test() {
    console.log('🚀 Comparing mutool vs pdfjs-dist font extraction...\n');
    
    await testMutool();
    // await testPdfJs();
}

test();