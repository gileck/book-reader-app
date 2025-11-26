const fs = require('fs');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');
const { put } = require('@vercel/blob');

require('dotenv').config();

// Vercel Blob Configuration
const VERCEL_BLOB_TOKEN = process.env.VERCEL_BLOB_READ_WRITE_TOKEN;

/**
 * Upload a file to Vercel Blob
 */
async function uploadFileToBlob(key, content, contentType) {
    if (!VERCEL_BLOB_TOKEN) {
        throw new Error('VERCEL_BLOB_READ_WRITE_TOKEN environment variable is not set');
    }

    const blob = await put(key, content, {
        access: 'public',
        contentType: contentType || 'application/octet-stream',
        token: VERCEL_BLOB_TOKEN,
        allowOverwrite: true
    });

    return blob.url;
}

/**
 * Get content type based on file extension
 */
function getContentType(filename) {
    const ext = path.extname(filename).toLowerCase();
    const types = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp'
    };
    return types[ext] || 'application/octet-stream';
}

/**
 * Upload book images to Vercel Blob and update database
 * @param {string} bookFolderPath - Path to the book folder containing images
 * @param {string} bookTitle - Title of the book to find in database
 */
async function uploadImagesToBlob(bookFolderPath, bookTitle) {
    const uri = 'mongodb+srv://gileck:jfxccnxeruiowqrioqsdjkla@cluster0.frtddwb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
    const dbName = 'book_reader_db';

    // Validate input folder
    if (!fs.existsSync(bookFolderPath)) {
        console.error(`❌ Book folder not found: ${bookFolderPath}`);
        process.exit(1);
    }

    // Find images folder
    const imagesPath = path.join(bookFolderPath, 'images');
    if (!fs.existsSync(imagesPath)) {
        console.error(`❌ Images folder not found: ${imagesPath}`);
        process.exit(1);
    }

    // Get list of image files
    const imageFiles = [];
    function findImageFiles(dir, relativePath = '') {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const fullPath = path.join(dir, file);
            const relativeFilePath = path.join(relativePath, file);

            if (fs.statSync(fullPath).isDirectory()) {
                findImageFiles(fullPath, relativeFilePath);
            } else if (/\.(jpg|jpeg|png|gif|webp)$/i.test(file)) {
                imageFiles.push({
                    localPath: fullPath,
                    relativePath: relativeFilePath,
                    filename: file
                });
            }
        }
    }

    findImageFiles(imagesPath);

    if (imageFiles.length === 0) {
        console.error(`❌ No image files found in: ${imagesPath}`);
        process.exit(1);
    }

    console.log(`📸 Found ${imageFiles.length} image files`);

    // Connect to MongoDB
    const client = new MongoClient(uri);

    try {
        console.log('🔌 Connecting to MongoDB...');
        await client.connect();

        const db = client.db(dbName);
        const booksCollection = db.collection('books');
        const chaptersCollection = db.collection('chapters');

        console.log('✅ Connected to MongoDB!');

        // Find the book by title
        const book = await booksCollection.findOne({ title: bookTitle });
        if (!book) {
            console.error(`❌ Book not found with title: "${bookTitle}"`);
            process.exit(1);
        }

        console.log(`📖 Found book: "${book.title}" (ID: ${book._id})`);

        // Create folder path for this book
        const bookFolderName = book.title.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-');
        const blobPrefix = `books/${bookFolderName}/images/`;

        console.log(`☁️  Uploading images to Vercel Blob: ${blobPrefix}`);

        // Upload each image to Vercel Blob
        const uploadPromises = imageFiles.map(async (imageFile) => {
            const blobKey = `${blobPrefix}${imageFile.filename}`;
            const fileContent = fs.readFileSync(imageFile.localPath);
            const contentType = getContentType(imageFile.filename);

            console.log(`   📤 Uploading: ${imageFile.filename}`);

            const blobUrl = await uploadFileToBlob(blobKey, fileContent, contentType);

            return {
                filename: imageFile.filename,
                blobUrl: blobUrl
            };
        });

        const uploadedImages = await Promise.all(uploadPromises);
        console.log(`✅ Successfully uploaded ${uploadedImages.length} images to Vercel Blob`);

        // Update book with relative imageBaseURL path
        const relativeImagePath = `/${bookFolderName}/images/`;

        await booksCollection.updateOne(
            { _id: book._id },
            {
                $set: {
                    imageBaseURL: relativeImagePath,
                    updatedAt: new Date()
                }
            }
        );

        console.log(`📚 Updated book with relative imageBaseURL: ${relativeImagePath}`);

        // Update chapters to use imageName instead of imageUrl
        const chapters = await chaptersCollection.find({ bookId: book._id }).toArray();

        for (const chapter of chapters) {
            let hasUpdates = false;
            const updatedChunks = chapter.content.chunks.map(chunk => {
                if (chunk.type === 'image' && chunk.imageUrl) {
                    // Extract filename from imageUrl
                    const imageName = path.basename(chunk.imageUrl);

                    // Check if this image was uploaded
                    const uploadedImage = uploadedImages.find(img => img.filename === imageName);
                    if (uploadedImage) {
                        hasUpdates = true;
                        return {
                            ...chunk,
                            imageName: imageName,
                            imageUrl: undefined // Remove the old imageUrl field
                        };
                    }
                }
                return chunk;
            });

            if (hasUpdates) {
                await chaptersCollection.updateOne(
                    { _id: chapter._id },
                    {
                        $set: {
                            'content.chunks': updatedChunks,
                            updatedAt: new Date()
                        }
                    }
                );
                console.log(`   📝 Updated Chapter ${chapter.chapterNumber} with image references`);
            }
        }

        // Get the full base URL for display purposes only
        const fullBaseUrl = uploadedImages.length > 0
            ? uploadedImages[0].blobUrl.substring(0, uploadedImages[0].blobUrl.lastIndexOf('/') + 1)
            : '';

        console.log('✅ Image upload and database update completed successfully!');
        console.log(`📊 Summary:`);
        console.log(`   📖 Book: "${book.title}"`);
        console.log(`   📸 Images uploaded: ${uploadedImages.length}`);
        console.log(`   📁 Relative path: ${relativeImagePath}`);
        console.log(`   ☁️  Full Blob URL: ${fullBaseUrl}`);

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    } finally {
        await client.close();
        console.log('🔌 Database connection closed.');
    }
}

// CLI usage help
function showHelp() {
    console.log(`
Usage: node upload-images-to-vercel-blob.js BOOK_FOLDER_PATH BOOK_TITLE

Arguments:
  BOOK_FOLDER_PATH   Path to the book folder containing images/ subfolder (required)
  BOOK_TITLE         Exact title of the book as stored in the database (required)

Examples:
  node upload-images-to-vercel-blob.js ../files/MyBook/ "The Great Book"
  node upload-images-to-vercel-blob.js ./books/transformers/ "Transformer"

Book folder structure:
  MyBook/
  ├── output.json       # Generated by parser
  ├── images/           # Contains extracted images (required)
  │   └── *.jpg, *.png, etc.
  ├── book.pdf          # Original PDF file
  └── config.json       # Book configuration

Environment Variables Required:
  VERCEL_BLOB_READ_WRITE_TOKEN    Vercel Blob read-write token for uploads

The script will:
1. Upload all images from the images/ folder to Vercel Blob
2. Update the book record with relative imageBaseURL
3. Update chapter chunks to use imageName instead of imageUrl
`);
}

// Main execution
async function main() {
    try {
        const args = process.argv.slice(2);

        // Show help if requested
        if (args.includes('--help') || args.includes('-h')) {
            showHelp();
            process.exit(0);
        }

        const bookFolderPath = args[0];
        const bookTitle = args[1];

        if (!bookFolderPath || !bookTitle) {
            console.error('❌ Both book folder path and book title are required');
            showHelp();
            process.exit(1);
        }

        // Check for required environment variables
        if (!process.env.VERCEL_BLOB_READ_WRITE_TOKEN) {
            console.error('❌ VERCEL_BLOB_READ_WRITE_TOKEN not found in environment variables');
            console.error('   Please set VERCEL_BLOB_READ_WRITE_TOKEN in .env file');
            process.exit(1);
        }

        console.log('🚀 Starting image upload to Vercel Blob...');
        await uploadImagesToBlob(bookFolderPath, bookTitle);

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { uploadImagesToBlob }; 