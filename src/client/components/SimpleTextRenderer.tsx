import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography, Fab } from '@mui/material';
import { HelpOutline as ExplainIcon } from '@mui/icons-material';
import { useUserTheme } from './UserThemeProvider';
import type { ChapterClient } from '../../apis/chapters/types';
import type { BookClient } from '../../apis/books/types';
import { IMAGES_BASE_PATH } from '../../common/constants';

interface SimpleTextRendererProps {
    chapter: ChapterClient;
    book: BookClient;
    scrollContainerRef: React.RefObject<HTMLDivElement | null>;
    currentChunkIndex: number;
    getWordStyle: (chunkIndex: number, wordIndex: number) => React.CSSProperties;
    getWordClassName: (chunkIndex: number, wordIndex: number) => string;
    getSentenceStyle: (chunkIndex: number) => React.CSSProperties;
    getSentenceClassName: (chunkIndex: number) => string;
    handleWordClick: (chunkIndex: number, wordIndex: number) => void;
    handleSentenceClick: (chunkIndex: number) => void;
    isChunkBookmarked: (chunkIndex: number) => boolean;
    onCurrentChunkVisibilityChange?: (isVisible: boolean) => void;
    onExplainText?: (selectedText: string) => void;
}

export const SimpleTextRenderer: React.FC<SimpleTextRendererProps> = ({
    chapter,
    book,
    scrollContainerRef,
    currentChunkIndex,
    getWordStyle,
    getWordClassName,
    getSentenceStyle,
    getSentenceClassName,
    handleWordClick,
    handleSentenceClick,
    isChunkBookmarked,
    onCurrentChunkVisibilityChange,
    onExplainText
}) => {
    const { fontSize, lineHeight, fontFamily, textColor } = useUserTheme();
    const chunkRefs = useRef<Map<number, HTMLDivElement>>(new Map());
    const previousChunkIndex = useRef<number>(currentChunkIndex);
    const hasScrolledToInitialPosition = useRef<boolean>(false);
    const [isContentVisible, setIsContentVisible] = useState(currentChunkIndex === 0);
    const intersectionObserverRef = useRef<IntersectionObserver | null>(null);
    const [selectedText, setSelectedText] = useState('');
    const [showExplainButton, setShowExplainButton] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Track current chunk visibility with intersection observer
    useEffect(() => {
        if (!onCurrentChunkVisibilityChange || !scrollContainerRef.current) return;

        // Clean up previous observer
        if (intersectionObserverRef.current) {
            intersectionObserverRef.current.disconnect();
        }

        // Create new intersection observer
        intersectionObserverRef.current = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    const chunkIndex = parseInt(entry.target.getAttribute('data-chunk-index') || '0');
                    if (chunkIndex === currentChunkIndex) {
                        onCurrentChunkVisibilityChange(entry.isIntersecting);
                    }
                });
            },
            {
                root: scrollContainerRef.current,
                rootMargin: '-20% 0px -20% 0px', // Consider visible when at least 60% of viewport height
                threshold: 0.1
            }
        );

        // Observe current chunk
        const currentChunkElement = chunkRefs.current.get(currentChunkIndex);
        if (currentChunkElement) {
            intersectionObserverRef.current.observe(currentChunkElement);
        }

        return () => {
            if (intersectionObserverRef.current) {
                intersectionObserverRef.current.disconnect();
                intersectionObserverRef.current = null;
            }
        };
    }, [currentChunkIndex, onCurrentChunkVisibilityChange, scrollContainerRef]);

    // Expose method to scroll to current chunk
    useEffect(() => {
        const scrollToCurrentChunk = () => {
            const currentChunkRef = chunkRefs.current.get(currentChunkIndex);
            if (currentChunkRef) {
                currentChunkRef.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
            }
        };

        // Attach to window for external access
        (window as Window & { scrollToCurrentChunk?: () => void }).scrollToCurrentChunk = scrollToCurrentChunk;

        return () => {
            delete (window as Window & { scrollToCurrentChunk?: () => void }).scrollToCurrentChunk;
        };
    }, [currentChunkIndex]);

    // Handle initial positioning when chapter loads with a saved position
    useEffect(() => {
        if (!hasScrolledToInitialPosition.current && currentChunkIndex > 0) {
            const scrollToInitialPosition = () => {
                const currentChunkRef = chunkRefs.current.get(currentChunkIndex);
                if (currentChunkRef) {
                    // Instantly position to correct location while content is hidden
                    currentChunkRef.scrollIntoView({
                        behavior: 'instant',
                        block: 'center'
                    });
                    hasScrolledToInitialPosition.current = true;
                    previousChunkIndex.current = currentChunkIndex;

                    // Show content after positioning (small delay to ensure scroll completes)
                    setTimeout(() => {
                        setIsContentVisible(true);
                    }, 50);

                    return true;
                }
                return false;
            };

            // Try immediate positioning first
            if (!scrollToInitialPosition()) {
                // If immediate positioning fails (ref not ready), retry after a short delay
                const timeoutId = setTimeout(() => {
                    if (!scrollToInitialPosition()) {
                        // If it still fails, show content anyway to prevent infinite hiding
                        setIsContentVisible(true);
                        hasScrolledToInitialPosition.current = true;
                    }
                }, 100);

                return () => clearTimeout(timeoutId);
            }
        } else if (currentChunkIndex === 0) {
            // If starting from beginning, show content immediately
            setIsContentVisible(true);
            hasScrolledToInitialPosition.current = true;
        }
    }, [currentChunkIndex]);

    // Auto-scroll to current chunk only when chunk index changes (after initial load)
    useEffect(() => {
        if (hasScrolledToInitialPosition.current && previousChunkIndex.current !== currentChunkIndex) {
            const scrollToChunk = () => {
                const currentChunkRef = chunkRefs.current.get(currentChunkIndex);
                if (currentChunkRef) {
                    currentChunkRef.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center'
                    });
                    return true;
                }
                return false;
            };

            // Try immediate scroll first
            if (scrollToChunk()) {
                previousChunkIndex.current = currentChunkIndex;
            } else {
                // If immediate scroll fails (ref not ready), retry after a short delay
                const timeoutId = setTimeout(() => {
                    if (scrollToChunk()) {
                        previousChunkIndex.current = currentChunkIndex;
                    }
                }, 100);

                return () => clearTimeout(timeoutId);
            }
        }
    }, [currentChunkIndex]);

    // Safety timeout: ensure content becomes visible after maximum wait time
    useEffect(() => {
        if (!isContentVisible) {
            const safetyTimeout = setTimeout(() => {
                setIsContentVisible(true);
                hasScrolledToInitialPosition.current = true;
            }, 1000); // 1 second max wait

            return () => clearTimeout(safetyTimeout);
        }
    }, [isContentVisible]);

    // Handle text selection
    useEffect(() => {
        const handleSelectionChange = () => {
            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0) {
                setShowExplainButton(false);
                setSelectedText('');
                return;
            }

            const selectedText = selection.toString().trim();
            if (!selectedText) {
                setShowExplainButton(false);
                setSelectedText('');
                return;
            }

            // Check if selection is within our container
            const range = selection.getRangeAt(0);
            const containerElement = containerRef.current;
            if (!containerElement || !containerElement.contains(range.commonAncestorContainer)) {
                setShowExplainButton(false);
                setSelectedText('');
                return;
            }

            setSelectedText(selectedText);
            setShowExplainButton(true);
        };

        document.addEventListener('selectionchange', handleSelectionChange);
        return () => document.removeEventListener('selectionchange', handleSelectionChange);
    }, []);

    // Hide button when clicking elsewhere
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (showExplainButton && !(event.target as Element).closest('.explain-button')) {
                const selection = window.getSelection();
                if (!selection || !selection.toString().trim()) {
                    setShowExplainButton(false);
                    setSelectedText('');
                }
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showExplainButton]);

    const handleExplainClick = () => {
        if (selectedText && onExplainText) {
            onExplainText(selectedText);
            setShowExplainButton(false);
            setSelectedText('');
            // Clear selection
            window.getSelection()?.removeAllRanges();
        }
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (intersectionObserverRef.current) {
                intersectionObserverRef.current.disconnect();
                intersectionObserverRef.current = null;
            }
                         delete (window as Window & { scrollToCurrentChunk?: () => void }).scrollToCurrentChunk;
        };
    }, []);

    return (
        <Box
            ref={containerRef}
            sx={{
                opacity: isContentVisible ? 1 : 0,
                transition: 'none', // No transition - instant visibility change
                position: 'relative'
            }}
        >
            {chapter.content.chunks.map((chunk, index) => {
                const previousChunk = index > 0 ? chapter.content.chunks[index - 1] : null;
                const showPageNumber = chunk.pageNumber &&
                    chunk.pageNumber !== previousChunk?.pageNumber &&
                    chunk.type === 'text';

                return (
                    <React.Fragment key={index}>
                        {/* Page Number Separator */}
                        {showPageNumber && (
                            <Box
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    my: 4,
                                    gap: 2
                                }}
                            >
                                <Box sx={{ flex: 1, height: '1px', backgroundColor: 'divider' }} />
                                <Typography
                                    variant="caption"
                                    sx={{
                                        color: 'text.secondary',
                                        fontWeight: 'medium',
                                        px: 2,
                                        py: 1,
                                        backgroundColor: 'background.paper',
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        borderRadius: '16px',
                                        fontSize: '0.75rem'
                                    }}
                                >
                                    Page {chunk.pageNumber}
                                </Typography>
                                <Box sx={{ flex: 1, height: '1px', backgroundColor: 'divider' }} />
                            </Box>
                        )}

                        <Box
                            ref={(el: HTMLDivElement | null) => {
                                if (el) {
                                    chunkRefs.current.set(index, el);
                                } else {
                                    chunkRefs.current.delete(index);
                                }
                            }}
                            data-chunk-index={index}
                            sx={{
                                mb: 0.5,
                                position: 'relative'
                            }}
                        >
                            {chunk.type === 'text' ? (
                                <>
                                    {isChunkBookmarked(index) && (
                                        <Box
                                            sx={{
                                                position: 'absolute',
                                                left: -30,
                                                top: 0,
                                                color: '#1976d2',
                                                fontSize: '1.2rem'
                                            }}
                                        >
                                            🔖
                                        </Box>
                                    )}
                                    <Typography
                                        variant="body1"
                                        className={getSentenceClassName(index)}
                                        onDoubleClick={() => handleSentenceClick(index)}
                                        sx={{
                                            lineHeight: lineHeight,
                                            fontSize: `${fontSize}rem`,
                                            fontFamily: fontFamily,
                                            color: textColor,
                                            wordSpacing: 'normal',
                                            cursor: 'pointer',
                                            userSelect: 'text',
                                            ...getSentenceStyle(index)
                                        }}
                                    >
                                        {chunk.text.split(' ').filter(word => word.length > 0).map((word, wordIndex, words) => (
                                            <React.Fragment key={wordIndex}>
                                                <span
                                                    data-chunk-index={index}
                                                    data-word-index={wordIndex}
                                                    className={getWordClassName(index, wordIndex)}
                                                    style={getWordStyle(index, wordIndex)}
                                                    onDoubleClick={(e) => {
                                                        e.stopPropagation();
                                                        handleWordClick(index, wordIndex);
                                                    }}
                                                >
                                                    {word}
                                                </span>
                                                {wordIndex < words.length - 1 && ' '}
                                            </React.Fragment>
                                        ))}
                                    </Typography>
                                </>
                            ) : chunk.type === 'image' ? (
                                <Box textAlign="center" my={2}>
                                    <img
                                        src={book.imageBaseURL && chunk.imageName
                                            ? `${IMAGES_BASE_PATH}${book.imageBaseURL.startsWith('/') ? book.imageBaseURL.slice(1) : book.imageBaseURL}${chunk.imageName}`.replace(/\s+/g, '')
                                            : '/placeholder.png'}
                                        alt={chunk.imageAlt || 'Chapter image'}
                                        width={800}
                                        height={400}
                                        style={{
                                            maxWidth: '100%',
                                            height: 'auto',
                                            objectFit: 'contain',
                                            backgroundColor: 'white',
                                            padding: '20px',
                                            borderRadius: '8px'
                                        }}
                                    />
                                    {chunk.imageAlt && (
                                        <Typography variant="caption" display="block" mt={1}>
                                            {chunk.imageAlt}
                                        </Typography>
                                    )}
                                </Box>
                            ) : null}
                        </Box>
                    </React.Fragment>
                );
            })}

            {/* Floating Explain Button */}
            {showExplainButton && (
                <Fab
                    className="explain-button"
                    size="medium"
                    color="primary"
                    onClick={handleExplainClick}
                    sx={{
                        position: 'fixed',
                        bottom: { xs: 160, sm: 180 }, // Well above AudioControls
                        right: 20,
                        zIndex: 1100, // Higher than AudioControls (1000)
                        opacity: 0.95,
                        boxShadow: 3,
                        '&:hover': {
                            opacity: 1,
                            transform: 'scale(1.1)'
                        }
                    }}
                >
                    <ExplainIcon />
                </Fab>
            )}
        </Box>
    );
}; 