#!/usr/bin/env tsx
/**
 * Script to manually create database indexes
 * Run this with: yarn create-indexes
 */

import dotenv from 'dotenv';
import path from 'path';
import { initializeIndexes } from '../src/server/database/initIndexes';
import { closeDbConnection } from '../src/server/database';

// Load environment variables from both .env and .env.local
const envPath = path.resolve(process.cwd(), '.env');
const envLocalPath = path.resolve(process.cwd(), '.env.local');

console.log('Loading env from:', envPath);
dotenv.config({ path: envPath });
dotenv.config({ path: envLocalPath });

// Debug: check if MONGO_URI is loaded
if (!process.env.MONGO_URI) {
    console.error('❌ MONGO_URI not found in environment variables');
    console.log('Available MongoDB-related vars:', Object.keys(process.env).filter(k => k.includes('MONGO')));
    process.exit(1);
}

async function main() {
    try {
        console.log('Starting index creation...\n');
        await initializeIndexes();
        console.log('\n✅ All indexes created successfully!');
        console.log('\nYour queries should now be much faster.');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Error creating indexes:', error);
        process.exit(1);
    } finally {
        await closeDbConnection();
    }
}

main();

