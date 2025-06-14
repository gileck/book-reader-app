export * from './index';

import {
    API_GET_CHAPTER_BY_BOOK_NUMBER,
    API_GET_CHAPTERS_BY_BOOK
} from './index';

import { process as getChapterByNumberProcess } from './handlers/getChapterByNumberHandler';
import { process as getChaptersByBookProcess } from './handlers/getChaptersByBookHandler';

export const chaptersApiHandlers = {
    [API_GET_CHAPTER_BY_BOOK_NUMBER]: { process: getChapterByNumberProcess },
    [API_GET_CHAPTERS_BY_BOOK]: { process: getChaptersByBookProcess }
}; 