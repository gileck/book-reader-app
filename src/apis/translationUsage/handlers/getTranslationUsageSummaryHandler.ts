import { ApiHandlerContext } from '@/apis/types';
import {
  TranslationUsageRangeParams,
  GetTranslationUsageSummaryResponse,
} from '../types';
import { getTranslationUsageSummary } from '@/server/translation-usage-monitoring';

/**
 * Get translation usage summary
 */
export async function process(
  params: TranslationUsageRangeParams,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _context: ApiHandlerContext
): Promise<GetTranslationUsageSummaryResponse> {
  try {
    const summary = await getTranslationUsageSummary({
      rangeDays: params.rangeDays ?? 30,
    });

    return {
      success: true,
      summary,
    };
  } catch (error) {
    console.error('[TranslationUsage] Error getting summary:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get translation usage summary',
    };
  }
}

