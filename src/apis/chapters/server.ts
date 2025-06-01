export * from './index';

import {
    API_GET_CHAPTER_BY_BOOK_NUMBER
} from './index';

import { process as getChapterByNumberProcess } from './handlers/getChapterByNumberHandler';

export const chaptersApiHandlers = {
    [API_GET_CHAPTER_BY_BOOK_NUMBER]: { process: getChapterByNumberProcess }
}; 