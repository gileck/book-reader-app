import { ApiHandlerContext } from '@/apis/types';
import { TranslateTextRequest, TranslateTextResponse } from '../types';
import { translateText as googleTranslateText } from '@/server/translation/googleTranslate';
import {
  findCachedTranslation,
  saveCachedTranslation,
} from '@/server/database/collections/translation';
import { addTranslationUsageRecord, getMonthlyFreeTierUsage } from '@/server/translation-usage-monitoring';

/**
 * Handle text translation request
 */
export async function process(
  request: TranslateTextRequest,
  context: ApiHandlerContext
): Promise<TranslateTextResponse> {
  try {
    // Validate input
    if (!request.text || !request.targetLanguage) {
      return {
        success: false,
        error: 'Text and target language are required',
        translatedText: '',
      };
    }

    // Normalize target language to lowercase
    const targetLanguage = request.targetLanguage.toLowerCase();
    const sourceLanguage = request.sourceLanguage?.toLowerCase();

    // Check cache first
    const cachedTranslation = await findCachedTranslation(request.text, targetLanguage);

    if (cachedTranslation) {
      console.log(
        `[Translation] Cache hit for ${request.text.substring(0, 50)}... -> ${targetLanguage}`
      );

      // Track usage (from cache, so cost is 0)
      await addTranslationUsageRecord(
        cachedTranslation.characterCount,
        0, // No cost for cached translations
        targetLanguage,
        cachedTranslation.sourceLanguage,
        context.userId,
        true, // fromCache
        'translation-api'
      );

      // Get free tier usage
      const freeTierUsage = await getMonthlyFreeTierUsage();

      return {
        success: true,
        translatedText: cachedTranslation.translatedText,
        detectedSourceLanguage: cachedTranslation.sourceLanguage,
        characterCount: cachedTranslation.characterCount,
        cost: 0,
        fromCache: true,
        freeTierUsage,
      };
    }

    // Not in cache, call Google Translate API
    console.log(
      `[Translation] Cache miss, calling Google API for ${request.text.substring(0, 50)}... -> ${targetLanguage}`
    );

    const result = await googleTranslateText(request.text, targetLanguage, sourceLanguage);

    // Save to cache
    await saveCachedTranslation(
      request.text,
      result.translatedText,
      result.detectedSourceLanguage || sourceLanguage || 'auto',
      targetLanguage,
      result.characterCount
    );

    // Track usage (not from cache, so include cost)
    await addTranslationUsageRecord(
      result.characterCount,
      result.cost,
      targetLanguage,
      result.detectedSourceLanguage,
      context.userId,
      false, // not fromCache
      'translation-api'
    );

    // Get free tier usage
    const freeTierUsage = await getMonthlyFreeTierUsage();

    return {
      success: true,
      translatedText: result.translatedText,
      detectedSourceLanguage: result.detectedSourceLanguage,
      characterCount: result.characterCount,
      cost: result.cost,
      fromCache: false,
      freeTierUsage,
    };
  } catch (error) {
    console.error('[Translation] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Translation failed',
      translatedText: '',
    };
  }
}

