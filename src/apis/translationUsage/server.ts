// Re-export API names from index
export * from './index';

import {
  API_GET_TRANSLATION_USAGE_SUMMARY,
  API_GET_TRANSLATION_USAGE_RECORDS,
} from './index';
import { process as getSummaryProcess } from './handlers/getTranslationUsageSummaryHandler';
import { process as getRecordsProcess } from './handlers/getTranslationUsageRecordsHandler';

/**
 * Translation usage API handlers object
 */
export const translationUsageApiHandlers = {
  [API_GET_TRANSLATION_USAGE_SUMMARY]: { process: getSummaryProcess },
  [API_GET_TRANSLATION_USAGE_RECORDS]: { process: getRecordsProcess },
};

