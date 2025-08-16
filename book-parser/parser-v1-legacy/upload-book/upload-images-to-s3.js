const fs = require('fs');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

require('dotenv').config();

// S3 Configuration
const AWS_BUCKET_NAME = "app-template-1252343";
const APP_FOLDER_PREFIX = 'Book_Reader_App/';

const createS3Client = () => {
    const clientConfig = {
        region: process.env.AWS_REGION || 'us-east-1',
    };

    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
        clientConfig.credentials = {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        };
    }

    return new S3Client(clientConfig);
};

/**
 * Upload a file to S3
 */
async function uploadFileToS3(s3Client, bucketName, key, content, contentType) {
    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: content,
        ContentType: contentType || 'application/octet-stream',
    });

    await s3Client.send(command);
    return key;
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
 * Upload book images to S3 and update database
 * @param {string} bookFolderPath - Path to the book folder containing images
 * @param {string} bookTitle - Title of the book to find in database
 */
async function uploadImagesToS3(bookFolderPath, bookTitle) {
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

    // Initialize S3 client
    const s3Client = createS3Client();

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

        // Create S3 folder path for this book
        const bookFolderName = book.title.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-');
        const s3BookPrefix = `${APP_FOLDER_PREFIX}books/${bookFolderName}/images/`;

        console.log(`☁️  Uploading images to S3 folder: ${s3BookPrefix}`);

        // Upload each image to S3
        const uploadPromises = imageFiles.map(async (imageFile) => {
            const s3Key = `${s3BookPrefix}${imageFile.filename}`;
            const fileContent = fs.readFileSync(imageFile.localPath);
            const contentType = getContentType(imageFile.filename);

            console.log(`   📤 Uploading: ${imageFile.filename}`);

            await uploadFileToS3(s3Client, AWS_BUCKET_NAME, s3Key, fileContent, contentType);

            return {
                filename: imageFile.filename,
                s3Key: s3Key
            };
        });

        const uploadedImages = await Promise.all(uploadPromises);
        console.log(`✅ Successfully uploaded ${uploadedImages.length} images to S3`);

        // Update book with relative imageBaseURL
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

        console.log('✅ Image upload and database update completed successfully!');
        console.log(`📊 Summary:`);
        console.log(`   📖 Book: "${book.title}"`);
        console.log(`   📸 Images uploaded: ${uploadedImages.length}`);
        console.log(`   📁 Relative path: ${relativeImagePath}`);
        console.log(`   ☁️  S3 folder: ${s3BookPrefix}`);

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
Usage: node upload-images-to-s3.js BOOK_FOLDER_PATH BOOK_TITLE

Arguments:
  BOOK_FOLDER_PATH   Path to the book folder containing images/ subfolder (required)
  BOOK_TITLE         Exact title of the book as stored in the database (required)

Examples:
  node upload-images-to-s3.js ../files/MyBook/ "The Great Book"
  node upload-images-to-s3.js ./books/transformers/ "Transformer"

Book folder structure:
  MyBook/
  ├── output.json       # Generated by parser
  ├── images/           # Contains extracted images (required)
  │   └── *.jpg, *.png, etc.
  ├── book.pdf          # Original PDF file
  └── config.json       # Book configuration

Environment Variables Required:
  AWS_ACCESS_KEY_ID     AWS access key for S3 uploads
  AWS_SECRET_ACCESS_KEY AWS secret key for S3 uploads
  AWS_REGION            AWS region (default: us-east-1)

The script will:
1. Upload all images from the images/ folder to S3
2. Update the book record with imageBaseURL
3. Update chapter chunks to use imageName instead of imageUrl
`);
}

// Main execution
async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log(`
Usage: node upload-images-to-s3.js <book-folder-path> [book-title]

Examples:
  node upload-images-to-s3.js /path/to/book-folder
  node upload-images-to-s3.js /path/to/book-folder "Custom Book Title"
        `);
        process.exit(1);
    }

    const bookFolderPath = args[0];
    const bookTitle = args[1];

    try {
        // Validate book folder path
        if (!fs.existsSync(bookFolderPath)) {
            console.error('❌ Book folder path does not exist:', bookFolderPath);
            process.exit(1);
        }

        // Check for required environment variables
        if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
            console.error('❌ AWS credentials not found in environment variables');
            console.error('   Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env file');
            process.exit(1);
        }

        console.log('🚀 Starting image upload to S3...');
        await uploadImagesToS3(bookFolderPath, bookTitle);

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { uploadImagesToS3 }; 