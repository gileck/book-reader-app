const parser = require('../book-parser/parser/parser.js');
const { uploadParsedBookV2 } = require('../book-parser/parser/upload-book.js');
const path = require('path');
const fs = require('fs');
const inquirer = require('inquirer');

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

function hasOutputFolder(folderPath) {
    const outputPath = path.join(folderPath, 'output');
    return fs.existsSync(outputPath) && fs.existsSync(path.join(outputPath, 'output.json'));
}

function getBookFolders(filesDir) {
    if (!fs.existsSync(filesDir)) {
        return [];
    }

    const items = fs.readdirSync(filesDir);
    const folders = items.filter(item => {
        const fullPath = path.join(filesDir, item);
        return fs.statSync(fullPath).isDirectory();
    });

    return folders.sort();
}

function showHelp() {
    console.log(`
Generic Book Parser & Uploader

Usage: node run-parser-and-upload.js [options] [FOLDER_PATH]

Arguments:
  FOLDER_PATH    Path to folder containing a single PDF file (optional)
                 If not provided, you can select from available folders interactively

Description:
  Processes a PDF book in the specified folder and optionally uploads it to the database.

Requirements:
  - The specified folder must contain exactly one PDF file
  - Creates an 'output' folder in the same directory as the PDF

Features:
  - Interactive folder selection from /files directory if no path provided
  - Interactive mode selection (parse only, parse + upload, or upload only)
  - Automatically finds the PDF file in the specified folder
  - Runs the complete book parsing pipeline with validation
  - Creates output folder with parsed content and extracted images

Options:
  --help, -h            Show this help message
  --force-reparse, -f   Force re-extraction from PDF (ignore cached .txt file)

Modes:
  - Parser only: Only parse the book, don't upload
  - Parse + Upload: Parse the book and upload to database (without images)
  - Parse + Upload + Images: Parse the book and upload with images to Vercel Blob
  - Upload only: Use existing output file to upload (skip parsing)

Text File Caching:
  - First run: Extracts text from PDF and saves to <book-name>.txt
  - Subsequent runs: Uses the .txt file (faster, allows manual editing)
  - Use --force-reparse to regenerate .txt from PDF

Examples:
  node run-parser-and-upload.js
  node run-parser-and-upload.js ./my-book-folder
  node run-parser-and-upload.js --force-reparse ./my-book-folder
  node run-parser-and-upload.js /path/to/book/folder
`);
}

async function selectFolder() {
    const filesDir = path.join(__dirname);
    const folders = getBookFolders(filesDir);

    if (folders.length === 0) {
        throw new Error('No book folders found in /files directory');
    }

    const choices = folders.map(folder => {
        const folderPath = path.join(filesDir, folder);
        const hasOutput = hasOutputFolder(folderPath);
        const label = hasOutput ? `${folder} (has output)` : folder;
        return {
            name: label,
            value: folder,
            short: folder
        };
    });

    const answer = await inquirer.prompt([
        {
            type: 'list',
            name: 'folder',
            message: 'Select a book folder:',
            choices: choices,
            pageSize: 15
        }
    ]);

    return path.join(filesDir, answer.folder);
}

async function selectMode(hasExistingOutput) {
    const modes = [
        {
            name: 'Parser only',
            value: 'parse-only',
            short: 'Parse only'
        },
        {
            name: 'Parse + Upload (book content only)',
            value: 'parse-upload',
            short: 'Parse + Upload'
        },
        {
            name: 'Parse + Upload + Images (upload to Vercel Blob)',
            value: 'parse-upload-images',
            short: 'Parse + Upload + Images'
        }
    ];

    // Add upload-only options if there's an existing output folder
    if (hasExistingOutput) {
        modes.push(
            {
                name: 'Upload only (book content only)',
                value: 'upload-only',
                short: 'Upload only'
            },
            {
                name: 'Upload only + Images (upload to Vercel Blob)',
                value: 'upload-only-images',
                short: 'Upload only + Images'
            }
        );
    }

    const answer = await inquirer.prompt([
        {
            type: 'list',
            name: 'mode',
            message: 'Select operation mode:',
            choices: modes
        }
    ]);

    return answer.mode;
}

async function runParser(pdfPath, outputPath, forceReparse) {
    console.log(`📚 Starting book parser...\n`);
    console.log(`   Input:  ${pdfPath}`);
    console.log(`   Output: ${outputPath}\n`);

    await parser.parseBook(pdfPath, outputPath, {
        debug: true,
        validate: true,
        forceReparse: forceReparse
    });

    console.log('\n✅ Parser completed successfully!');
}

async function runUpload(outputPath, uploadImages) {
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
}

async function main() {
    try {
        const args = process.argv.slice(2);
        const flags = new Set(args.filter(a => a.startsWith('-')));
        const positionals = args.filter(a => !a.startsWith('-'));
        const forceReparse = flags.has('--force-reparse') || flags.has('-f');

        // Show help if requested
        if (flags.has('--help') || flags.has('-h')) {
            showHelp();
            process.exit(0);
        }

        // Get folder path from command line argument or prompt user
        let targetDir;
        const folderPath = positionals[0];

        if (!folderPath) {
            console.log('📂 No folder path provided. Select from available folders:\n');
            targetDir = await selectFolder();
        } else {
            targetDir = path.resolve(folderPath);
        }

        console.log(`\n📁 Selected folder: ${targetDir}`);

        // Check if output folder exists
        const outputPath = path.join(targetDir, 'output');
        const hasExistingOutput = hasOutputFolder(targetDir);

        if (hasExistingOutput) {
            console.log('✓ Found existing output folder');
        }

        // Select operation mode
        const mode = await selectMode(hasExistingOutput);
        console.log(`\n🎯 Mode: ${mode}\n`);

        // Handle upload-only modes
        if (mode === 'upload-only' || mode === 'upload-only-images') {
            if (!hasExistingOutput) {
                throw new Error('No existing output folder found. Cannot run upload-only mode.');
            }
            const uploadImages = mode === 'upload-only-images';
            await runUpload(outputPath, uploadImages);
            console.log('\n✅ Process completed successfully!');
            process.exit(0);
        }

        // For all parse modes, find the PDF file
        console.log(`📁 Looking for PDF file in: ${targetDir}`);
        const pdfPath = findPdfFile(targetDir);
        const pdfName = path.basename(pdfPath);
        console.log(`📄 Found PDF: ${pdfName}\n`);

        // Run parser for all parse modes
        await runParser(pdfPath, outputPath, forceReparse);

        // Run upload if requested
        if (mode === 'parse-upload' || mode === 'parse-upload-images') {
            const uploadImages = mode === 'parse-upload-images';
            await runUpload(outputPath, uploadImages);
        }

        console.log('\n✅ Process completed successfully!');

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        process.exit(1);
    }
}

main();