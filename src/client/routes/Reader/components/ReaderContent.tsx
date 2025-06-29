import React from 'react';
import { Box } from '@mui/material';
import { SimpleTextRenderer } from '../../../components/SimpleTextRenderer';
import type { ChapterClient } from '../../../../apis/chapters/types';
import type { BookClient } from '../../../../apis/books/types';

interface ReaderContentProps {
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

export const ReaderContent: React.FC<ReaderContentProps> = ({
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
    return (
        <Box sx={{ mt: 4 }}>
            <SimpleTextRenderer
                chapter={chapter}
                book={book}
                scrollContainerRef={scrollContainerRef}
                currentChunkIndex={currentChunkIndex}
                getWordStyle={getWordStyle}
                getWordClassName={getWordClassName}
                getSentenceStyle={getSentenceStyle}
                getSentenceClassName={getSentenceClassName}
                handleWordClick={handleWordClick}
                handleSentenceClick={handleSentenceClick}
                isChunkBookmarked={isChunkBookmarked}
                onCurrentChunkVisibilityChange={onCurrentChunkVisibilityChange}
                onExplainText={onExplainText}
            />
        </Box>
    );
}; 