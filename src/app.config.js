const isProduction = process.env.NODE_ENV === 'production';

export const appConfig = {
    appName: 'Book Reader App',
    cacheType: isProduction ? 's3' : 's3',
    dbName: 'book_reader_db'
};
