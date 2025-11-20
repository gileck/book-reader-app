export * from './index';

import { API_SEARCH_CURRENT_CHAPTER } from './index';
import { process as searchCurrentChapterProcess } from './handlers/searchCurrentChapterHandler';

export const searchApiHandlers = {
    [API_SEARCH_CURRENT_CHAPTER]: { process: searchCurrentChapterProcess }
};

