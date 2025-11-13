// Re-export API names from index
export * from './index';

import { API_TRANSLATE_TEXT } from './index';
import { process as translateTextProcess } from './handlers/translateTextHandler';

/**
 * Translation API handlers object
 */
export const translationApiHandlers = {
  [API_TRANSLATE_TEXT]: { process: translateTextProcess },
};

