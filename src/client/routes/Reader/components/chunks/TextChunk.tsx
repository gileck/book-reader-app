import React from 'react';
import { TextChunkClient, ChunkLink } from '@/apis/chapters/types';
import { EnhancedText } from '../EnhancedText';

interface TextChunkProps {
    chunk: TextChunkClient;
    chunkIndex: number;
    currentChunkIndex: number;
    handleLinkClick: (link: ChunkLink) => void;
    onChunkDoubleClick?: (chunkIndex: number) => void;
    ttsEnabled?: boolean;
    bionicReadingEnabled?: boolean;
    chunkSpacing?: number;
}

export const TextChunk: React.FC<TextChunkProps> = ({
    chunk,
    chunkIndex,
    currentChunkIndex,
    handleLinkClick,
    onChunkDoubleClick,
    ttsEnabled = true,
    bionicReadingEnabled = false,
    chunkSpacing = 0.5
}) => {
    const isHighlighted = ttsEnabled && currentChunkIndex === chunkIndex;

    return (
        <div
            style={{
                lineHeight: 'var(--reader-line-height, 1.6)',
                fontSize: 'var(--reader-font-size, 1rem)',
                fontFamily: 'var(--reader-font-family, inherit)',
                color: 'var(--reader-text-color, inherit)',
                padding: '0px 5px 0px 5px',
                marginBottom: `${chunkSpacing}em`, // Space between chunks (sentences)
                backgroundColor: isHighlighted ? 'var(--sentence-highlight-color, transparent)' : 'transparent',
                borderRadius: '6px',
                transition: 'all 0.3s ease',
                cursor: onChunkDoubleClick ? 'pointer' : 'default'
            }}
            id={`text-chunk-${chunkIndex}`}
            data-chunk-index={chunkIndex}
            data-paragraph-index={chunk.paragraphIndex}
            onDoubleClick={() => onChunkDoubleClick?.(chunkIndex)}
        >
            <EnhancedText
                chunk={chunk}
                chunkIndex={chunkIndex}
                onLinkClick={handleLinkClick}
                bionicReadingEnabled={bionicReadingEnabled}
            />
        </div>
    );
}; 