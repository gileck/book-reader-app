/**
 * Migration Script: Migrate files from old Vercel Blob store to new dedicated store
 * 
 * Old Store: zdllzsw6qffmlxhs.public.blob.vercel-storage.com
 * New Store: adsrs5mrj2rqyazd.public.blob.vercel-storage.com (book-reader-app-blob)
 * 
 * Usage:
 *   npx ts-node scripts/migrate-vercel-blob.ts --dry-run    # Preview what will be migrated
 *   npx ts-node scripts/migrate-vercel-blob.ts              # Run actual migration
 *   npx ts-node scripts/migrate-vercel-blob.ts --verify     # Verify migration succeeded
 * 
 * Environment Variables Required:
 *   BLOB_READ_WRITE_TOKEN           - Old store token (for reading)
 *   VERCEL_BLOB_READ_WRITE_TOKEN    - New store token (for writing)
 */

import { list } from '@vercel/blob';
import * as vercelBlobSDK from '../src/server/vercel-blob/sdk';
import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configuration
const OLD_STORE_BASE_URL = 'https://zdllzsw6qffmlxhs.public.blob.vercel-storage.com';
const NEW_STORE_BASE_URL = vercelBlobSDK.VERCEL_BLOB_BASE_URL;

// MongoDB configuration
const DB_NAME = process.env.DB_NAME || 'book_reader_db';

/**
 * Get MongoDB URI from environment (required)
 */
function getMongoUri(): string {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error('❌ MONGODB_URI environment variable is required');
        process.exit(1);
    }
    return uri;
}

interface MigrationStats {
    totalFiles: number;
    migratedFiles: number;
    skippedFiles: number;
    failedFiles: number;
    totalSizeBytes: number;
    errors: string[];
}

/**
 * Get the old store token from environment
 */
function getOldStoreToken(): string {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
        throw new Error('BLOB_READ_WRITE_TOKEN (old store) environment variable is not set');
    }
    return token;
}

/**
 * Get the new store token from environment
 */
function getNewStoreToken(): string {
    const token = process.env.VERCEL_BLOB_READ_WRITE_TOKEN;
    if (!token) {
        throw new Error('VERCEL_BLOB_READ_WRITE_TOKEN (new store) environment variable is not set');
    }
    return token;
}

/**
 * List all files in the old store
 */
async function listOldStoreFiles(): Promise<Array<{ pathname: string; url: string; size: number }>> {
    const token = getOldStoreToken();
    const allBlobs: Array<{ pathname: string; url: string; size: number }> = [];
    let cursor: string | undefined;

    console.log('📂 Fetching files from old store...');

    do {
        const result = await list({
            token,
            cursor,
            limit: 1000
        });

        allBlobs.push(...result.blobs.map(b => ({
            pathname: b.pathname,
            url: b.url,
            size: b.size
        })));

        cursor = result.cursor;
        console.log(`   Found ${allBlobs.length} files so far...`);
    } while (cursor);

    console.log(`✅ Found ${allBlobs.length} total files in old store`);
    return allBlobs;
}

/**
 * Download a file from a URL
 */
async function downloadFile(url: string): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to download ${url}: ${response.statusText}`);
    }
    return Buffer.from(await response.arrayBuffer());
}

/**
 * Migrate a single file from old store to new store
 */
async function migrateFile(
    pathname: string,
    oldUrl: string,
    dryRun: boolean
): Promise<{ success: boolean; newUrl?: string; error?: string }> {
    try {
        if (dryRun) {
            console.log(`   [DRY RUN] Would migrate: ${pathname}`);
            return { success: true, newUrl: `${NEW_STORE_BASE_URL}/${pathname}` };
        }

        // Download from old store
        const content = await downloadFile(oldUrl);

        // Determine content type from extension
        const contentType = vercelBlobSDK.getContentType(pathname);

        // Upload to new store
        const newUrl = await vercelBlobSDK.uploadFile({
            key: pathname,
            content,
            contentType,
            allowOverwrite: true
        });

        console.log(`   ✅ Migrated: ${pathname}`);
        return { success: true, newUrl };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(`   ❌ Failed: ${pathname} - ${message}`);
        return { success: false, error: message };
    }
}

/**
 * Update database URLs from old store to new store
 */
async function updateDatabaseUrls(dryRun: boolean): Promise<{ updated: number; errors: string[] }> {
    console.log('\n📊 Updating database URLs...');

    const client = new MongoClient(getMongoUri());
    let updated = 0;
    const errors: string[] = [];

    try {
        await client.connect();
        const db = client.db(DB_NAME);

        // Update books collection - coverImage and imageBaseURL
        const booksCollection = db.collection('books');
        const books = await booksCollection.find({
            $or: [
                { coverImage: { $regex: OLD_STORE_BASE_URL } },
                { imageBaseURL: { $exists: true } }
            ]
        }).toArray();

        console.log(`   Found ${books.length} books to check`);

        for (const book of books) {
            const updates: Record<string, unknown> = {};

            // Update coverImage if it points to old store
            if (book.coverImage && book.coverImage.includes(OLD_STORE_BASE_URL)) {
                const newCoverImage = book.coverImage.replace(OLD_STORE_BASE_URL, NEW_STORE_BASE_URL);
                updates.coverImage = newCoverImage;
            }

            if (Object.keys(updates).length > 0) {
                if (dryRun) {
                    console.log(`   [DRY RUN] Would update book: ${book.title}`);
                } else {
                    await booksCollection.updateOne(
                        { _id: book._id },
                        { $set: { ...updates, updatedAt: new Date() } }
                    );
                    console.log(`   ✅ Updated book: ${book.title}`);
                }
                updated++;
            }
        }

        // Update bookUploads collection - images array
        const uploadsCollection = db.collection('bookUploads');
        const uploads = await uploadsCollection.find({
            'images.url': { $regex: OLD_STORE_BASE_URL }
        }).toArray();

        console.log(`   Found ${uploads.length} uploads with old image URLs`);

        for (const upload of uploads) {
            if (upload.images && Array.isArray(upload.images)) {
                const updatedImages = upload.images.map((img: { url: string; name: string; size: number; blobKey: string }) => ({
                    ...img,
                    url: img.url.replace(OLD_STORE_BASE_URL, NEW_STORE_BASE_URL)
                }));

                if (dryRun) {
                    console.log(`   [DRY RUN] Would update upload: ${upload._id}`);
                } else {
                    await uploadsCollection.updateOne(
                        { _id: upload._id },
                        { $set: { images: updatedImages, updatedAt: new Date() } }
                    );
                    console.log(`   ✅ Updated upload: ${upload._id}`);
                }
                updated++;
            }
        }

    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Database update error: ${message}`);
        console.error(`   ❌ Database error: ${message}`);
    } finally {
        await client.close();
    }

    return { updated, errors };
}

/**
 * Verify migration - check that files exist in new store
 */
async function verifyMigration(): Promise<void> {
    console.log('\n🔍 Verifying migration...\n');

    // Check new store is configured
    if (!vercelBlobSDK.isConfigured()) {
        console.error('❌ New store not configured. Set VERCEL_BLOB_READ_WRITE_TOKEN');
        process.exit(1);
    }

    // List files in new store
    console.log('📂 Fetching files from new store...');
    const newStoreFiles = await vercelBlobSDK.listAllFiles();
    console.log(`✅ Found ${newStoreFiles.length} files in new store`);

    // Get stats
    const stats = await vercelBlobSDK.getStorageStats();
    console.log(`📊 Total size: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`);

    // List old store for comparison
    try {
        const oldStoreFiles = await listOldStoreFiles();
        
        console.log('\n📊 Comparison:');
        console.log(`   Old store: ${oldStoreFiles.length} files`);
        console.log(`   New store: ${newStoreFiles.length} files`);

        if (newStoreFiles.length >= oldStoreFiles.length) {
            console.log('\n✅ Migration appears complete!');
        } else {
            console.log('\n⚠️  New store has fewer files than old store');
            console.log('   Some files may not have been migrated');
        }
    } catch {
        console.log('\n✅ New store verified (could not compare to old store)');
    }

    // Check database URLs
    console.log('\n🔍 Checking database URLs...');
    const client = new MongoClient(getMongoUri());
    
    try {
        await client.connect();
        const db = client.db(DB_NAME);

        // Check for any remaining old URLs
        const booksWithOldUrls = await db.collection('books').countDocuments({
            coverImage: { $regex: OLD_STORE_BASE_URL }
        });

        const uploadsWithOldUrls = await db.collection('bookUploads').countDocuments({
            'images.url': { $regex: OLD_STORE_BASE_URL }
        });

        if (booksWithOldUrls === 0 && uploadsWithOldUrls === 0) {
            console.log('✅ All database URLs have been updated to new store');
        } else {
            console.log(`⚠️  Found records still pointing to old store:`);
            console.log(`   Books: ${booksWithOldUrls}`);
            console.log(`   Uploads: ${uploadsWithOldUrls}`);
        }

    } finally {
        await client.close();
    }
}

/**
 * Main migration function
 */
async function migrate(dryRun: boolean): Promise<void> {
    console.log('\n🚀 Starting Vercel Blob Migration\n');
    console.log(`   Old store: ${OLD_STORE_BASE_URL}`);
    console.log(`   New store: ${NEW_STORE_BASE_URL}`);
    console.log(`   Mode: ${dryRun ? 'DRY RUN' : 'LIVE MIGRATION'}`);
    console.log('');

    // Verify tokens
    try {
        getOldStoreToken();
        console.log('✅ Old store token found');
    } catch (e) {
        console.error('❌ Old store token missing:', (e as Error).message);
        process.exit(1);
    }

    try {
        getNewStoreToken();
        console.log('✅ New store token found');
    } catch (e) {
        console.error('❌ New store token missing:', (e as Error).message);
        process.exit(1);
    }

    const stats: MigrationStats = {
        totalFiles: 0,
        migratedFiles: 0,
        skippedFiles: 0,
        failedFiles: 0,
        totalSizeBytes: 0,
        errors: []
    };

    // Step 1: List all files in old store
    const files = await listOldStoreFiles();
    stats.totalFiles = files.length;
    stats.totalSizeBytes = files.reduce((sum, f) => sum + f.size, 0);

    console.log(`\n📊 Migration Summary:`);
    console.log(`   Total files: ${stats.totalFiles}`);
    console.log(`   Total size: ${(stats.totalSizeBytes / 1024 / 1024).toFixed(2)} MB`);

    if (stats.totalFiles === 0) {
        console.log('\n✅ No files to migrate!');
        return;
    }

    // Step 2: Migrate each file
    console.log('\n📤 Migrating files...');
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const progress = `[${i + 1}/${files.length}]`;
        console.log(`${progress} Processing: ${file.pathname}`);

        const result = await migrateFile(file.pathname, file.url, dryRun);
        
        if (result.success) {
            stats.migratedFiles++;
        } else {
            stats.failedFiles++;
            stats.errors.push(`${file.pathname}: ${result.error}`);
        }

        // Add a small delay to avoid rate limiting
        if (!dryRun && i < files.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    // Step 3: Update database URLs
    const dbResult = await updateDatabaseUrls(dryRun);
    stats.errors.push(...dbResult.errors);

    // Final summary
    console.log('\n📊 Migration Complete!');
    console.log(`   Total files: ${stats.totalFiles}`);
    console.log(`   Migrated: ${stats.migratedFiles}`);
    console.log(`   Skipped: ${stats.skippedFiles}`);
    console.log(`   Failed: ${stats.failedFiles}`);
    console.log(`   Database records updated: ${dbResult.updated}`);

    if (stats.errors.length > 0) {
        console.log('\n❌ Errors:');
        stats.errors.forEach(err => console.log(`   - ${err}`));
    }

    if (!dryRun && stats.failedFiles === 0) {
        console.log('\n✅ Migration successful!');
        console.log('   Run with --verify to confirm all files are accessible');
    }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const verify = args.includes('--verify');

// Run
(async () => {
    try {
        if (verify) {
            await verifyMigration();
        } else {
            await migrate(dryRun);
        }
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
})();

