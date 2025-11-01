import { getDb } from './index';

/**
 * Initialize all database indexes
 * This should be called on application startup
 */
export async function initializeIndexes(): Promise<void> {
    try {
        const db = await getDb();
        console.log('Initializing database indexes...');

        // Users collection indexes
        const usersCollection = db.collection('users');
        await usersCollection.createIndex({ username: 1 }, { unique: true });
        await usersCollection.createIndex({ email: 1 }, { unique: true, sparse: true });
        console.log('✓ Users indexes created');

        // Books collection indexes
        const booksCollection = db.collection('books');
        // Skipping text index due to language compatibility issues
        // await booksCollection.createIndex({ title: 'text', author: 'text' }, { default_language: 'english' });
        await booksCollection.createIndex({ isPublic: 1 });
        await booksCollection.createIndex({ uploadedBy: 1 });
        await booksCollection.createIndex({ title: 1 }); // Simple index instead of text
        await booksCollection.createIndex({ author: 1 }); // Simple index instead of text
        console.log('✓ Books indexes created');

        // Chapters collection indexes
        const chaptersCollection = db.collection('chapters');
        await chaptersCollection.createIndex({ bookId: 1, chapterNumber: 1 }, { unique: true });
        await chaptersCollection.createIndex({ bookId: 1 });
        console.log('✓ Chapters indexes created');

        // Bookmarks collection indexes
        const bookmarksCollection = db.collection('bookmarks');
        await bookmarksCollection.createIndex({ userId: 1, bookId: 1 });
        await bookmarksCollection.createIndex(
            { userId: 1, bookId: 1, chapterNumber: 1, chunkIndex: 1 },
            { unique: true }
        );
        await bookmarksCollection.createIndex({ userId: 1 });
        console.log('✓ Bookmarks indexes created');

        // Reading Progress collection indexes - THIS IS THE CRITICAL ONE
        const readingProgressCollection = db.collection('readingProgress');
        await readingProgressCollection.createIndex({ userId: 1, bookId: 1 }, { unique: true });
        await readingProgressCollection.createIndex({ userId: 1 });
        await readingProgressCollection.createIndex({ lastReadAt: -1 });
        console.log('✓ Reading Progress indexes created');

        // User Settings collection indexes
        const userSettingsCollection = db.collection('userSettings');
        await userSettingsCollection.createIndex({ userId: 1 }, { unique: true });
        console.log('✓ User Settings indexes created');

        // Reading Logs collection indexes
        const readingLogsCollection = db.collection('readingLogs');
        await readingLogsCollection.createIndex({ userId: 1, bookId: 1 });
        await readingLogsCollection.createIndex({ userId: 1, timestamp: -1 });
        await readingLogsCollection.createIndex({ bookId: 1 });
        console.log('✓ Reading Logs indexes created');

        console.log('✅ All database indexes initialized successfully');
    } catch (error) {
        console.error('Error initializing database indexes:', error);
        throw error;
    }
}

