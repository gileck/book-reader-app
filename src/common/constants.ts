// S3 Configuration Constants
export const S3_IMAGES_BASE_PATH = 'https://app-template-1252343.s3.amazonaws.com/Book_Reader_App/books';

// Vercel Blob Configuration Constants
export const VERCEL_BLOB_IMAGES_BASE_PATH = 'https://zdllzsw6qffmlxhs.public.blob.vercel-storage.com/books';

// Use this constant to easily switch between S3 and Vercel Blob
export const IMAGES_BASE_PATH = VERCEL_BLOB_IMAGES_BASE_PATH; 