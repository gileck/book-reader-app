export * from './index';

import {
    API_CREATE_BOOK,
    API_GET_BOOK,
    API_GET_BOOKS,
    API_UPDATE_BOOK,
    API_SEARCH_BOOKS,
    API_DELETE_BOOK,
    API_UPLOAD_COVER_IMAGE
} from './index';

import { process as createBookProcess } from './handlers/createBookHandler';
import { process as getBookProcess } from './handlers/getBookHandler';
import { process as getBooksProcess } from './handlers/getBooksHandler';
import { process as updateBookProcess } from './handlers/updateBookHandler';
import { process as searchBooksProcess } from './handlers/searchBooksHandler';
import { process as deleteBookProcess } from './handlers/deleteBookHandler';
import { process as uploadCoverImageProcess } from './handlers/uploadCoverImageHandler';

export const booksApiHandlers = {
    [API_CREATE_BOOK]: { process: createBookProcess },
    [API_GET_BOOK]: { process: getBookProcess },
    [API_GET_BOOKS]: { process: getBooksProcess },
    [API_UPDATE_BOOK]: { process: updateBookProcess },
    [API_SEARCH_BOOKS]: { process: searchBooksProcess },
    [API_DELETE_BOOK]: { process: deleteBookProcess },
    [API_UPLOAD_COVER_IMAGE]: { process: uploadCoverImageProcess }
}; 