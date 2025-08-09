import React, { useState } from 'react';
import { Box, Typography, CircularProgress, Alert, Dialog, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
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
    const [isModalOpen, setIsModalOpen] = useState(false);

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

    const handleOpenModal = () => setIsModalOpen(true);
    const handleCloseModal = () => setIsModalOpen(false);

    // If no image name or URL, don't render anything
    if (!imageUrl || !chunk.imageName) {
        return null;
    }

    return (
        <>
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
                            backgroundColor: 'white',
                            padding: '30px',
                            height: 'auto',
                            display: imageLoading ? 'none' : 'block',
                            cursor: 'zoom-in'
                        }}
                        onLoad={handleImageLoad}
                        onError={handleImageError}
                        onDoubleClick={handleOpenModal}
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
            {imageUrl && (
                <Dialog
                    fullScreen
                    open={isModalOpen}
                    onClose={handleCloseModal}
                    PaperProps={{
                        sx: {
                            backgroundColor: 'rgba(0,0,0,0.9)'
                        }
                    }}
                >
                    <Box sx={{ position: 'fixed', top: 8, right: 8, zIndex: 1 }}>
                        <IconButton
                            aria-label="Close"
                            onClick={handleCloseModal}
                            sx={{ color: 'white' }}
                        >
                            <CloseIcon />
                        </IconButton>
                    </Box>
                    <Box
                        onDoubleClick={handleCloseModal}
                        sx={{
                            width: '100vw',
                            height: '100vh',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            p: 2
                        }}
                    >
                        <img
                            src={imageUrl ?? undefined}
                            alt={chunk.imageAlt || 'Full size image'}
                            style={{
                                maxWidth: '95vw',
                                maxHeight: '95vh',
                                objectFit: 'contain',
                                backgroundColor: 'white',
                                padding: '12px',
                                borderRadius: '8px',
                                cursor: 'zoom-out'
                            }}
                        />
                    </Box>
                </Dialog>
            )}
        </>
    );
}; 