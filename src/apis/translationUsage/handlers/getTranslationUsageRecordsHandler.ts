import { ApiHandlerContext } from '@/apis/types';
import {
  TranslationRecordsParams,
  GetTranslationUsageRecordsResponse,
  TranslationUsageRecord,
} from '../types';
import { getRecentTranslationUsageRecords } from '@/server/database/collections/translationUsage';

/**
 * Get recent translation usage records
 */
export async function process(
  params: TranslationRecordsParams,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _context: ApiHandlerContext
): Promise<GetTranslationUsageRecordsResponse> {
  try {
    const lastHours = params.lastHours ?? 24;
    const dbRecords = await getRecentTranslationUsageRecords(lastHours);

    // Convert database records to API format
    const records: TranslationUsageRecord[] = dbRecords.map(record => ({
      id: record.id,
      timestamp: record.timestamp.toISOString(),
      textLength: record.textLength,
      cost: record.cost,
      targetLanguage: record.targetLanguage,
      sourceLanguage: record.sourceLanguage,
      fromCache: record.fromCache,
      userId: record.userId,
      endpoint: record.endpoint,
    }));

    return {
      success: true,
      records,
    };
  } catch (error) {
    console.error('[TranslationUsage] Error getting records:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get translation usage records',
    };
  }
}

