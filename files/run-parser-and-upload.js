const parser = require('../book-parser/parser/parser.js');
const { uploadParsedBookV2 } = require('../book-parser/parser/upload-book.js');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

function findPdfFile(folderPath) {
    if (!fs.existsSync(folderPath)) {
        throw new Error(`Directory not found: ${folderPath}`);
    }

    if (!fs.statSync(folderPath).isDirectory()) {
        throw new Error(`Path is not a directory: ${folderPath}`);
    }

    const files = fs.readdirSync(folderPath);
    const pdfFiles = files.filter(file => file.toLowerCase().endsWith('.pdf'));

    if (pdfFiles.length === 0) {
        throw new Error(`No PDF files found in directory: ${folderPath}\nPlease provide a directory containing exactly one PDF file.`);
    }

    if (pdfFiles.length > 1) {
        throw new Error(`Multiple PDF files found in directory: ${folderPath}\nPlease ensure only one PDF file exists.\nFound: ${pdfFiles.join(', ')}`);
    }

    return path.join(folderPath, pdfFiles[0]);
}

function showHelp() {
    console.log(`
Generic Book Parser & Uploader

Usage: node run-parser-and-upload.js [options] <FOLDER_PATH>

Arguments:
  FOLDER_PATH    Path to folder containing a single PDF file (required)

Description:
  Processes a PDF book in the specified folder and optionally uploads it to the database.

Requirements:
  - The specified folder must contain exactly one PDF file
  - Creates an 'output' folder in the same directory as the PDF
  - After successful parsing, prompts to upload the book to the database

Features:
  - Automatically finds the PDF file in the specified folder
  - Runs the complete book parsing pipeline with validation
  - Prompts to upload to database only after successful parsing
  - Creates output folder with parsed content and extracted images

Options:
  --help, -h            Show this help message
  --parser-only, -p     Run only the parser and exit without prompting for upload
  --force-reparse, -f   Force re-extraction from PDF (ignore cached .txt file)

Text File Caching:
  - First run: Extracts text from PDF and saves to <book-name>.txt
  - Subsequent runs: Uses the .txt file (faster, allows manual editing)
  - Use --force-reparse to regenerate .txt from PDF

Examples:
  node run-parser-and-upload.js ./my-book-folder
  node run-parser-and-upload.js -p ./my-book-folder
  node run-parser-and-upload.js --force-reparse ./my-book-folder
  node run-parser-and-upload.js /path/to/book/folder
  node run-parser-and-upload.js "C:\\Books\\My Book"
`);
}

async function promptUser(question) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.toLowerCase().trim());
        });
    });
}

async function runUploadScript(outputPath, uploadImages) {
    try {
        console.log('\n🚀 Running upload process...\n');

        if (uploadImages) {
            console.log('📤 Images will be uploaded to Vercel Blob');
        } else {
            console.log('⏭️ Skipping image upload (book content only)');
        }

        await uploadParsedBookV2(outputPath, {
            uploadImages: uploadImages
        });

        console.log('\n✅ Upload completed successfully!');
    } catch (error) {
        console.error('\n❌ Upload failed:', error.message);
        throw error;
    }
}

async function main() {
    try {
        const args = process.argv.slice(2);
        const flags = new Set(args.filter(a => a.startsWith('-')));
        const positionals = args.filter(a => !a.startsWith('-'));
        const parserOnly = flags.has('--parser-only') || flags.has('-p');
        const forceReparse = flags.has('--force-reparse') || flags.has('-f');

        // Show help if requested
        if (flags.has('--help') || flags.has('-h')) {
            showHelp();
            process.exit(0);
        }

        // Get folder path from command line argument
        const folderPath = positionals[0];

        if (!folderPath) {
            console.error('❌ Folder path is required');
            showHelp();
            process.exit(1);
        }

        // Resolve the folder path to absolute path
        const targetDir = path.resolve(folderPath);

        console.log(`📁 Looking for PDF file in: ${targetDir}`);

        // Find the PDF file in the specified directory
        const pdfPath = findPdfFile(targetDir);
        const pdfName = path.basename(pdfPath);
        console.log(`📄 Found PDF: ${pdfName}`);

        // Set output path in the same directory as the PDF
        const outputPath = path.join(targetDir, 'output');

        console.log(`📚 Starting book parser...\n`);
        console.log(`   Input:  ${pdfPath}`);
        console.log(`   Output: ${outputPath}\n`);

        await parser.parseBook(pdfPath, outputPath, {
            debug: true,
            validate: true,
            forceReparse: forceReparse
        });

        // Parser completed successfully - now prompt for upload
        console.log('\n✅ Parser completed successfully!');
        if (parserOnly) {
            console.log('\n⏭️  Skipping upload prompt due to --parser-only option.');
            process.exit(0);
        }

        const uploadAnswer = await promptUser('\n❓ Would you like to run the upload process? (y/n): ');

        if (uploadAnswer === 'y' || uploadAnswer === 'yes') {
            const imagesAnswer = await promptUser('\n📤 Do you want to upload images to Vercel Blob? (y/n)\n   Note: Skip if images are already uploaded to avoid re-uploading: ');
            const uploadImages = imagesAnswer === 'y' || imagesAnswer === 'yes';

            await runUploadScript(outputPath, uploadImages);
        } else {
            console.log('\n📝 Skipping upload process. You can run it later by using the upload script.');
        }

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.log('\n🚫 Upload process will not be run due to errors.');
        process.exit(1);
    }
}

main();