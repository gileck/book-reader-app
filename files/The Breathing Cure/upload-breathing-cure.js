#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

// Import the parser upload functionality
const { uploadParsedBookV2 } = require('../../book-parser/parser/upload-book.js');

/**
 * Upload the processed The Breathing Cure book to the database
 * This script uses the existing upload-book utilities to upload the
 * The Breathing Cure book that was processed by the parser pipeline.
 */

async function uploadBreathingCureBook() {
    const bookFolderPath = __dirname; // Current directory (files/The Breathing Cure/)
    const outputPath = path.join(bookFolderPath, 'output');

    console.log('🫁 Uploading The Breathing Cure book...');
    console.log(`📁 Book folder: ${bookFolderPath}`);
    console.log(`📄 Output path: ${outputPath}`);

    // Verify that the output exists
    const outputJsonPath = path.join(outputPath, 'output.json');
    if (!fs.existsSync(outputJsonPath)) {
        console.error('❌ Error: output.json not found!');
        console.error(`   Expected at: ${outputJsonPath}`);
        console.error('   Make sure you have run the parser first with: node run-breathing-cure.js');
        process.exit(1);
    }

    // Verify that images directory exists
    const imagesPath = path.join(outputPath, 'images');
    if (!fs.existsSync(imagesPath)) {
        console.warn('⚠️  Warning: images directory not found');
        console.warn(`   Expected at: ${imagesPath}`);
    } else {
        const imageFiles = fs.readdirSync(imagesPath);
        console.log(`🖼️  Found ${imageFiles.length} image files`);
    }

    try {
        // Use the parser v2 upload functionality
        console.log('\n🚀 Starting parser v2 upload process...');
        await uploadParsedBookV2(outputPath);

        console.log('\n✅ The Breathing Cure book uploaded successfully with Parser v2!');
        console.log('📖 The book should now be available in the Book Reader App');
        console.log('🔗 Enhanced with bidirectional link navigation (Step 5.1)');
        console.log('🖼️  Images uploaded to Vercel Blob (if --upload-images flag used)');

    } catch (error) {
        console.error('\n❌ Upload failed:', error.message);

        // Provide helpful error messages for common issues
        if (error.message.includes('MONGODB_URI')) {
            console.error('\n💡 Make sure your .env file contains:');
            console.error('   MONGODB_URI=your_mongodb_connection_string');
        }

        if (error.message.includes('BLOB_READ_WRITE_TOKEN')) {
            console.error('\n💡 For image uploads, make sure your .env file contains:');
            console.error('   BLOB_READ_WRITE_TOKEN=your_vercel_blob_token');
            console.error('   (Images will be skipped if this is not set)');
        }

        process.exit(1);
    }
}

async function main() {
    try {
        const args = process.argv.slice(2);

        // Show help if requested
        if (args.includes('--help') || args.includes('-h')) {
            console.log(`
🫁 The Breathing Cure Book Upload Script (Parser v2)

Description:
  Uploads the processed The Breathing Cure book to the Book Reader App database using Parser v2.
  This script uses the enhanced output from run-breathing-cure.js with bidirectional link
  navigation and uploads both the book content and images.

Usage:
  node upload-breathing-cure.js [--upload-images] [--skip-images]

Options:
  --upload-images    Upload images to Vercel Blob (requires BLOB_READ_WRITE_TOKEN)
  --skip-images      Skip uploading images to Vercel Blob
  --help             Show this help message

Prerequisites:
  1. Run the parser first: node run-breathing-cure.js
  2. Ensure .env file is configured with MONGODB_URI
  3. Set BLOB_READ_WRITE_TOKEN for image uploads (if using --upload-images)

Examples:
  node upload-breathing-cure.js                    # Upload book content only
  node upload-breathing-cure.js --upload-images    # Upload with images to Vercel Blob
  node upload-breathing-cure.js --skip-images      # Explicit skip images
`);
            process.exit(0);
        }

        // Check if force flag is provided
        const forceUpload = args.includes('--force');
        if (forceUpload) {
            console.log('🔄 Force upload mode enabled - will overwrite existing book');
        }

        await uploadBreathingCureBook();

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { uploadBreathingCureBook };