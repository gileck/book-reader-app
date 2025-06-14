import { ApiHandlerContext } from '@/apis/types';
import { UploadCoverImagePayload, UploadCoverImageResponse } from '../types';
import { books } from '@/server/database/collections';
import { put } from '@vercel/blob';

export async function processUploadCoverImage(
    payload: UploadCoverImagePayload & { bookId: string },
    context: ApiHandlerContext
): Promise<UploadCoverImageResponse> {
    if (!context.userId) {
        throw new Error('Authentication required');
    }

    const existingBook = await books.findBookById(payload.bookId);
    if (!existingBook) {
        throw new Error('Book not found');
    }

    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
        throw new Error('BLOB_READ_WRITE_TOKEN environment variable is not set');
    }

    let buffer: Buffer;
    let contentType: string;
    let filename: string;

    if (payload.imageUrl) {
        const response = await fetch(payload.imageUrl);
        if (!response.ok) {
            throw new Error(`Failed to download image: ${response.statusText}`);
        }

        buffer = Buffer.from(await response.arrayBuffer());
        contentType = response.headers.get('content-type') || 'image/jpeg';
        filename = `cover-${Date.now()}.jpg`;
    } else if (payload.imageData) {
        const matches = payload.imageData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
            throw new Error('Invalid base64 data format');
        }

        contentType = matches[1];
        buffer = Buffer.from(matches[2], 'base64');
        filename = `cover-${Date.now()}.${contentType.split('/')[1]}`;
    } else {
        throw new Error('Either imageUrl or imageData must be provided');
    }

    const bookFolderName = existingBook.title.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-');
    const blobKey = `books/${bookFolderName}/covers/${filename}`;

    const blob = await put(blobKey, buffer, {
        access: 'public',
        contentType: contentType || 'application/octet-stream',
        token: token,
        allowOverwrite: true
    });

    const updatedBook = await books.updateBook(payload.bookId, {
        coverImage: blob.url,
        updatedAt: new Date()
    });

    if (!updatedBook) {
        throw new Error('Failed to update book');
    }

    return {
        success: true,
        coverImageUrl: blob.url
    };
}

export { processUploadCoverImage as process }; 