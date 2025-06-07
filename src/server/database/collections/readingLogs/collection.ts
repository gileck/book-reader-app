import { Collection, MongoClient, ObjectId } from 'mongodb';
import { ReadingLog, ReadingLogCreate, ReadingLogFilter } from './types';

export class ReadingLogsCollection {
    private collection: Collection<ReadingLog>;

    constructor(client: MongoClient, dbName: string) {
        this.collection = client.db(dbName).collection<ReadingLog>('readingLogs');
    }

    async create(logData: ReadingLogCreate): Promise<ReadingLog> {
        const result = await this.collection.insertOne(logData as ReadingLog);
        const log = await this.collection.findOne({ _id: result.insertedId });
        if (!log) {
            throw new Error('Failed to create reading log');
        }
        return log;
    }

    async findMany(filter: ReadingLogFilter, limit?: number, offset?: number): Promise<ReadingLog[]> {
        let query = this.collection.find(filter);

        if (offset) {
            query = query.skip(offset);
        }

        if (limit) {
            query = query.limit(limit);
        }

        return query.sort({ timestamp: -1 }).toArray();
    }

    async findByUserId(userId: ObjectId, limit?: number, offset?: number): Promise<ReadingLog[]> {
        return this.findMany({ userId }, limit, offset);
    }

    async countByUserId(userId: ObjectId): Promise<number> {
        return this.collection.countDocuments({ userId });
    }

    async findByUserIdAndDateRange(
        userId: ObjectId,
        startDate: Date,
        endDate: Date
    ): Promise<ReadingLog[]> {
        return this.findMany({
            userId,
            timestamp: {
                $gte: startDate,
                $lte: endDate
            }
        });
    }
} 