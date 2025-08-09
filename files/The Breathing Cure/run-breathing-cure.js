const parser = require('../../book-parser/parser-v2/parser.js');
const path = require('path');

async function main() {
    const pdfPath = path.join(__dirname, 'the-breathing-cure.pdf');
    const outputPath = path.join(__dirname, 'output');

    console.log('🚀 Running new parser on The Breathing Cure book...');
    console.log(`📖 PDF: ${pdfPath}`);
    console.log(`📁 Output will be saved to: ${outputPath}`);

    try {
        const result = await parser.parseBook(pdfPath, outputPath, {
            debug: true,
            validate: false
        });

        console.log('✅ Parser completed successfully!');
        console.log(`📊 Processing took: ${result.totalDuration}ms`);
        console.log(`📁 Output saved to: ${result.outputDir}`);
        console.log(`📚 Found ${result.finalOutput.chapters?.length || 0} chapters`);

    } catch (error) {
        console.error('❌ Parser failed:', error.message);
        process.exit(1);
    }
}

main();