const parser = require('./parser.js');
const path = require('path');

async function main() {
    try {
        console.log('Starting Transformers book parsing...');

        const pdfPath = '/Users/gil/Projects/book-reader-app/files/Transformers/book.pdf';
        const outputPath = './temp/transformers-v2-output.json';

        const options = {
            outputDir: './temp',
            debugDir: './temp/debug',
            validate: true,
            debug: true,
            saveStepOutputs: true
        };

        console.log('Running parser v2...');
        const result = await parser.parseBook(pdfPath, options);

        console.log('Parser completed successfully');
        console.log('Result structure:', Object.keys(result));

        // Check if result has the proper v2 format with flat chunks
        if (result.chunks && Array.isArray(result.chunks)) {
            console.log(`Found ${result.chunks.length} chunks in flat format - perfect for upload!`);

            // Sample the first chunk to verify structure
            if (result.chunks.length > 0) {
                const firstChunk = result.chunks[0];
                console.log('First chunk structure:', Object.keys(firstChunk));
                console.log('Has sentenceCount:', 'sentenceCount' in firstChunk);
                console.log('Has links array:', Array.isArray(firstChunk.links));
            }
        } else {
            console.log('Result does not have flat chunks format');
            console.log('Available keys:', Object.keys(result));
        }

    } catch (error) {
        console.error('Parser failed:', error.message);
        process.exit(1);
    }
}

main(); 