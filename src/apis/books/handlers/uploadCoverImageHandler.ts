import { ApiHandlerContext } from '@/apis/types';
import { UploadCoverImagePayload, UploadCoverImageResponse } from '../types';
import { books } from '@/server/database/collections';
import * as vercelBlobSDK from '@/server/vercel-blob/sdk';

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

    if (!vercelBlobSDK.isConfigured()) {
        throw new Error('Vercel Blob is not configured');
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

    const blobUrl = await vercelBlobSDK.uploadFile({
        key: blobKey,
        content: buffer,
        contentType: contentType || 'application/octet-stream',
        allowOverwrite: true
    });

    const updatedBook = await books.updateBook(payload.bookId, {
        coverImage: blobUrl,
        updatedAt: new Date()
    });

    if (!updatedBook) {
        throw new Error('Failed to update book');
    }

    return {
        success: true,
        coverImageUrl: blobUrl
    };
}

export { processUploadCoverImage as process }; 