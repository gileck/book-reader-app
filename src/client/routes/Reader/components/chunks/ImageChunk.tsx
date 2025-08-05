import React, { useState } from 'react';
import { Box, Typography, CircularProgress, Alert } from '@mui/material';
import { TextChunkClient } from '@/apis/chapters/types';
import { BookClient } from '@/apis/books/types';
import { VERCEL_BLOB_IMAGES_BASE_PATH } from '@/common/constants';

interface ImageChunkProps {
    chunk: TextChunkClient;
    book: BookClient;
    chunkIndex: number;
}

export const ImageChunk: React.FC<ImageChunkProps> = ({
    chunk,
    book,
    chunkIndex
}) => {
    const [imageLoading, setImageLoading] = useState(true);
    const [imageError, setImageError] = useState(false);

    // Construct image URL
    const imageUrl = chunk.imageName && book.imageBaseURL
        ? `${VERCEL_BLOB_IMAGES_BASE_PATH}${book.imageBaseURL}${chunk.imageName}`
        : null;

    const handleImageLoad = () => {
        setImageLoading(false);
        setImageError(false);
    };

    const handleImageError = () => {
        setImageLoading(false);
        setImageError(true);
    };

    // If no image name or URL, don't render anything
    if (!imageUrl || !chunk.imageName) {
        return null;
    }

    return (
        <Box
            sx={{
                my: 3,
                textAlign: 'center',
                position: 'relative'
            }}
            id={`image-chunk-${chunkIndex}`}
            data-chunk-index={chunkIndex}
        >
            {imageLoading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                    <CircularProgress size={24} />
                </Box>
            )}

            {imageError ? (
                <Alert severity="warning" sx={{ mb: 2 }}>
                    Failed to load image: {chunk.imageName}
                </Alert>
            ) : (
                <img
                    src={imageUrl}
                    alt={chunk.imageAlt || `Book image from page ${chunk.pageNumber || 'unknown'}`}
                    style={{
                        width: '100%',
                        padding: '30px',
                        height: 'auto',
                        display: imageLoading ? 'none' : 'block'
                    }}
                    onLoad={handleImageLoad}
                    onError={handleImageError}
                />
            )}

            {chunk.imageAlt && !imageError && (
                <Typography
                    variant="caption"
                    sx={{
                        mt: 1,
                        display: 'block',
                        fontStyle: 'italic',
                        color: 'text.secondary',
                        maxWidth: '90%',
                        mx: 'auto'
                    }}
                >
                    {chunk.imageAlt}
                </Typography>
            )}

            {chunk.pageNumber && (
                <Typography
                    variant="caption"
                    sx={{
                        mt: 0.5,
                        display: 'block',
                        fontSize: '0.7rem',
                        color: 'text.disabled'
                    }}
                >
                    Page {chunk.pageNumber}
                </Typography>
            )}
        </Box>
    );
}; 